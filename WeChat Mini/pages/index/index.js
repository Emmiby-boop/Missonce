import { performanceMonitor } from '../../utils/performance.js'
import { getWindowInfo, getStorage, getStorageAsync, removeStorage, getTheme } from '../../utils/storageManager'
import { STORAGE_KEYS } from '../../config/constants'
import { hapticSelect, hapticRefresh } from '../../utils/haptic'

const homeCache = require('./modules/home-cache')
const homeTab = require('./modules/home-tab')
const homeFeed = require('./modules/home-feed')
const homeAnnounce = require('./modules/home-announce')
const homeInspire = require('./modules/home-inspire')
const { getListAdConfig, clearListAdConfigCache } = require('../../utils/adUtil.js')

Page({
  // 点击底部 tabBar 时的轻震反馈（onTabItemTap 基础库 1.9.0+，点击当前 tab 同样触发）
  onTabItemTap() {
    hapticSelect()
  },

  data: {
    unreadNotificationCount: 0,
    statusBarHeight: 20,
    navBarHeight: 44,
    menuRightGap: 10,  // 搜索图标距屏幕右侧距离（避开胶囊按钮）
    loading: true,

    // Announcement Popup
    showAnnouncement: false,
    currentAnnouncement: null,
    dontShowAgain: false,

    // 分类 Tab（从 home_tabs 集合动态加载）
    categoryTabs: [
      { id: 'recommend', name: '推荐', type: 'fixed', fixedId: 'recommend', resourceType: 'all', sortBy: 'hot' },
      { id: 'latest', name: '最新', type: 'fixed', fixedId: 'latest', resourceType: 'all', sortBy: 'latest' }
    ],  // 默认兜底，loadCategoryTabs 会覆盖
    activeCategory: 'recommend',                          // 当前选中的分类 id
    categoryTabsLoaded: false,                            // 标签是否已加载

    // 推荐 Tab 的热门资源瀑布流
    recommendResources: [],  // 资源列表（含文案 + 伪装的 9:16 广告卡片）
    recommendLoading: false,
    recommendPage: 1,
    recommendHasMore: true,
    recommendLoaded: false,  // 是否已加载过
    recommendAdCounter: 0,   // 推荐 Tab 已生成广告序号（用于稳定 wx:key）

    // 最新 Tab 的资源瀑布流（按上传时间倒序）
    latestResources: [],
    latestLoading: false,
    latestPage: 1,
    latestHasMore: true,
    latestLoaded: false,
    latestAdCounter: 0,

    // 标签 Tab 的资源瀑布流
    tagResources: [],        // 资源列表（含文案 + 伪装的 9:16 广告卡片）
    tagLoading: false,
    tagPage: 1,
    tagHasMore: true,
    tagAdCounter: 0,

    // 🔥 低端机渲染上限（benchmarkLevel ≤ 10）：达到上限后停止触底自动加载，
    // 改为"点击加载更多"手动分批渲染，防止图片/GIF 节点无限累积导致掉帧与 OOM
    lowEnd: false,
    recommendCap: 60,
    latestCap: 60,
    tagCap: 60,
    recommendCapped: false,
    latestCapped: false,
    tagCapped: false,

    // Tab 栏横向滚动
    tabScrollLeft: 0,
  },

  _lastNotificationCheck: 0,
  _tagCache: {},  // 标签第一页数据缓存 { tagName: { resources, adCounter, timestamp } }
  _tabScrollLeft: 0,  // Tab 栏当前实际滚动位置（由 bindscroll 同步）
  _recommendCache: null,  // 推荐第一页内存缓存（{ resources, adCounter, page, hasMore, timestamp }）
  _recommendRefreshing: false,  // 推荐是否正在后台刷新
  _latestCache: null,  // 最新第一页内存缓存（{ resources, adCounter, page, hasMore, timestamp }）
  _tagPrefetched: false,  // 标签 Tab 是否已后台预拉取过
  _quotePool: [],  // 灵感文案池（从 quotes 集合加载，每 7 项穿插一张）
  _quotePoolPromise: null,  // 文案池加载 Promise（供 loadXxxResources await）

  onLoad(options) {
    // 显式初始化缓存，确保实例属性一定存在
    this._tagCache = {}
    this._recommendCache = null
    this._recommendRefreshing = false
    this._latestCache = null
    this._latestRefreshing = false
    this._tagPrefetched = false
    this._lastVisibleIndex = 0      // 预加载：已滚过的最大可见项索引
    this._lastPrefetchCheck = 0     // 预加载：上次检查时间（节流）
    this._quotePool = []
    this._quotePoolPromise = null
    // 🔥 初始化加载同步锁：防止预加载与触底加载并发触发同一函数
    this._recommendLock = false
    this._latestLock = false
    this._tagLock = false
    this._listAdConfig = null  // 后台广告间隔配置（listAdConfig）

    performanceMonitor.startPageLoad('首页')

    // 🔥 低端机标记（app.js onLaunch 已检测，用于渲染上限 + 效果降级）
    this.setData({ lowEnd: !!(getApp().globalData && getApp().globalData.lowEnd) })

    // 🔥 处理分享/扫码入口，优先跳转到预览页
    if (this._handleShareOptions(options)) {
      // 消费掉 App.onShow 可能存入的 pending，避免 onShow 重复跳转
      this._clearPendingShareRedirect()
      return
    }

    this._loadHomePage(options)
    // 后台异步加载广告间隔配置（不阻塞首屏）
    this._loadListAdConfig()
  },

  // 加载后台 listAdConfig 广告间隔配置
  async _loadListAdConfig() {
    try {
      const cfg = await getListAdConfig('/pages/index/index', 0)
      this._listAdConfig = cfg
    } catch (e) {
      console.warn('[首页] 加载 listAdConfig 失败:', e)
    }
  },

  onShow() {
    // 🔥 热启动：App.onShow 可能把分享/扫码参数存入 globalData
    const app = getApp()
    const pending = app && app.globalData && app.globalData.pendingShareRedirect
    if (pending) {
      // 消费掉，避免重复跳转
      app.globalData.pendingShareRedirect = null
      if (pending.type === 'id') {
        this._redirectToPreviewById(pending.value)
      } else if (pending.type === 'code') {
        this._handleShareCode(pending.value)
      }
      // 跳转后不再执行后续 onShow 逻辑
      return
    }

    // 🔥 性能测试打点：首屏 onShow（首次）
    try {
      const perfTest = require('../../utils/perf-test.js')
      const mod = perfTest.default || perfTest
      if (!mod.perf.getMark('first_show')) {
        mod.perf.mark('first_show')
      }
    } catch (e) {}

    app.logEvent && app.logEvent('pv', { page: 'index' })

    // 通知 badge：5 分钟内不重复查询
    const now = Date.now()
    if (now - this._lastNotificationCheck > 5 * 60 * 1000) {
      this._lastNotificationCheck = now
      this.loadNotificationBadge()
    }

    this.syncTheme()

    // 插屏广告：延迟执行，不阻塞页面切换
    setTimeout(() => {
      try {
        // 🔥 interstitialAdManager.js 用 export default 导出，require 拿到的是 ES Module 包装对象
        // 方法挂在 .default 上，直接访问会得到 undefined（smartTriggerInterstitialAd is not a function）
        const _mod = require('../../utils/interstitialAdManager.js')
        const interstitialAdManager = _mod.default || _mod
        interstitialAdManager.smartTriggerInterstitialAd(2000)
      } catch (e) {
        console.warn('[index] 加载插屏广告管理器失败，降级处理:', e)
      }
    }, 500)
  },

  _clearPendingShareRedirect() {
    const app = getApp()
    if (app && app.globalData) {
      app.globalData.pendingShareRedirect = null
    }
  },

  /**
   * 解析分享/扫码参数，命中则跳转预览页并返回 true
   */
  _handleShareOptions(options) {
    if (!options) return false

    // 1. 处理二维码 scene：options.scene 形如 "c=ABC123" 或 "id=xxx"
    let scene = options.scene
    if (scene) {
      try {
        scene = decodeURIComponent(scene)
      } catch (e) {
        console.warn('[index] scene 解码失败，降级处理:', e)
      }
      if (scene.startsWith('c=')) {
        this._handleShareCode(scene.substring(2))
        return true
      }
      if (scene.startsWith('id=')) {
        this._redirectToPreviewById(scene.substring(3))
        return true
      }
    }

    // 2. 处理普通 query 参数 id（直接分享卡片）
    if (options.id) {
      this._redirectToPreviewById(options.id)
      return true
    }

    // 3. 处理普通 query 参数 c（带短码的分享链接）
    if (options.c) {
      this._handleShareCode(options.c)
      return true
    }

    return false
  },

  /**
   * 通过资源 ID 查询类型并跳转到对应预览页
   */
  _redirectToPreviewById(id) {
    if (!id) {
      this._loadHomePage()
      return
    }
    wx.cloud.database().collection('resources').doc(id).get().then(res => {
      const item = res.data
      if (item) {
        const url = item.url || item.coverUrl || item.originUrl || ''
        const isAvatar = (item.type === 'avatar')
        const targetPath = isAvatar
          ? `/subpackages/preview/preview?id=${id}&url=${encodeURIComponent(url)}&isAvatar=true`
          : `/subpackages/wallpaper-preview/wallpaper-preview?id=${id}&url=${encodeURIComponent(url)}`
        wx.redirectTo({ url: targetPath })
      } else {
        this._loadHomePage()
      }
    }).catch(() => {
      this._loadHomePage()
    })
  },

  /**
   * 通过短分享码解码资源 ID，再跳转预览页
   */
  _handleShareCode(code) {
    if (!code) {
      this._loadHomePage()
      return
    }
    wx.cloud.callFunction({
      name: 'shareCode',
      data: { action: 'decode', code }
    }).then(res => {
      if (res.result?.success) {
        const { resourceId, type } = res.result
        const isAvatar = type === 'avatar'
        const targetPath = isAvatar
          ? `/subpackages/preview/preview?id=${resourceId}&isAvatar=true`
          : `/subpackages/wallpaper-preview/wallpaper-preview?id=${resourceId}`
        wx.redirectTo({ url: targetPath })
      } else {
        wx.showToast({ title: '分享码已失效', icon: 'none' })
        this._loadHomePage()
      }
    }).catch(() => {
      wx.showToast({ title: '分享码解析失败', icon: 'none' })
      this._loadHomePage()
    })
  },

  _loadHomePage(options) {
    this.initNavBar()
    performanceMonitor.markMilestone('首页', '初始化完成')

    // 🔥 L1 内存缓存秒开（本次运行期间有效）
    const memCached = this._recommendCache
    if (memCached && memCached.resources && memCached.resources.length > 0) {
      console.log('[首页] L1 内存缓存命中')
      this.setData({
        loading: false,
        recommendResources: memCached.resources,
        recommendAdCounter: memCached.adCounter,
        recommendPage: memCached.page,
        recommendHasMore: memCached.hasMore,
        recommendLoaded: true
      })
      this._logPageLoadDone('L1内存缓存', memCached.resources.length)
      this._refreshRecommendInBackground()
      this._loadNonCriticalData()
      return
    }

    // 🔥 L2 storage 缓存秒开（storageManager 内存命中时同步返回，App 重启后首次进入可能命中）
    const feedCache = getStorage(STORAGE_KEYS.HOME_FEED_CACHE)
    if (feedCache && feedCache.recommend && feedCache.recommend.list && feedCache.recommend.list.length > 0) {
      console.log('[首页] L2 storage 缓存命中（同步）')
      this._renderFromFeedCache(feedCache, 'L2同步')
      this._refreshRecommendInBackground()
      this._loadNonCriticalData(feedCache.tabs)
      return
    }

    // 🔥 L3/L4 异步降级链路：storage 异步读取 → home_cache 直读 → 网络
    console.log('[首页] 无同步缓存，进入异步降级链路')
    this.setData({ loading: true })
    this._loadFromAsyncChain()
    this._loadNonCriticalData()
  },

  // 异步降级链路：L2 storage 异步 → L3 home_cache 直读 → L4 网络
  async _loadFromAsyncChain() {
    try {
      // L2: 异步读取 storage（storageManager 内存未命中时）
      const storageCache = await getStorageAsync(STORAGE_KEYS.HOME_FEED_CACHE)
      if (storageCache && storageCache.recommend && storageCache.recommend.list && storageCache.recommend.list.length > 0) {
        console.log('[首页] L2 storage 缓存命中（异步）')
        this._renderFromFeedCache(storageCache, 'L2异步')
        this._refreshRecommendInBackground()
        this.setData({ loading: false })
        return
      }

      // L3: home_cache 集合直读（跳过 callFunction，比网络快 100-300ms）
      const homeCacheData = await this._tryLoadFromHomeCache()
      if (homeCacheData) {
        console.log('[首页] L3 home_cache 直读命中')
        this._renderFromFeedCache(homeCacheData, 'L3直读')
        this._refreshRecommendInBackground()
        this.setData({ loading: false })
        return
      }
    } catch (e) {
      console.warn('[首页] 异步降级链路异常:', e)
    }

    // L4: 网络加载（callFunction）
    console.log('[首页] L4 网络加载')
    this.loadRecommendResources().finally(() => {
      this.setData({ loading: false })
    })
  },

  // 并行加载非关键数据（通知、公告、tabs）
  _loadNonCriticalData(cachedTabs) {
    this.loadNotificationBadge()
    this.checkAnnouncement()
    this.loadCategoryTabs(cachedTabs)
    // 🔥 后台预加载灵感文案池（不阻塞首屏，loadXxxResources 会 await 该 Promise）
    this._ensureQuotePool()
  },

  // 加载灵感文案池：优先用 storage 缓存，无则调用 getQuotes 云函数
  // 写入 this._quotePool，返回 Promise（供 loadXxxResources await）
  _ensureQuotePool() {
    return homeInspire.ensureQuotePool(this)
  },

  // 文案池加载完后，刷新当前已渲染列表中 quote 卡片的文案
  // 仅更新 text 字段，不改变卡片结构/位置，避免影响广告卡片
  _refreshQuoteTexts() {
    return homeInspire.refreshQuoteTexts(this)
  },

  // 打印首页启动时间日志（参考专题页的 page_load 日志格式）
  _logPageLoadDone(source, resourceCount) {
    return homeCache.logPageLoadDone(this, source, resourceCount)
  },

  // 公共方法：将 cleanResource 格式的原始数据转换为首页渲染格式
  _processResourceItems(rawItems) {
    return homeFeed.processResourceItems(this, rawItems)
  },

  // 从 feedCache 渲染首屏（tabs + recommend 第一页）
  _renderFromFeedCache(feedCache, source) {
    return homeCache.renderFromFeedCache(this, feedCache, source)
  },

  // L3: 直读 home_cache 集合（跳过 callFunction）
  async _tryLoadFromHomeCache() {
    return homeCache.tryLoadFromHomeCache(this)
  },

  // 后台静默刷新推荐第一页（有缓存时调用，不显示 loading）
  async _refreshRecommendInBackground() {
    return homeCache.refreshRecommendInBackground(this)
  },

  // 后台静默刷新最新第一页（有缓存时调用，不显示 loading）
  async _refreshLatestInBackground() {
    return homeCache.refreshLatestInBackground(this)
  },

  // 将推荐流和 latest 流第一页写入 storage 持久化缓存
  _persistHomeFeedCache() {
    return homeCache.persistHomeFeedCache(this)
  },

  // 加载首页 Tab 配置（优先用缓存渲染，后台 callFunction 静默刷新）
  async loadCategoryTabs(cachedTabs) {
    return homeTab.loadCategoryTabs(this, cachedTabs)
  },

  // 标准化 Tab 数据格式
  _normalizeTabs(allTabs) {
    return homeTab.normalizeTabs(this, allTabs)
  },

  // 确保当前 Tab 的资源已加载
  _ensureFirstTabLoaded(tabs) {
    return homeTab.ensureFirstTabLoaded(this, tabs)
  },

  // 后台静默刷新 tabs 配置
  async _refreshTabsInBackground() {
    return homeTab.refreshTabsInBackground(this)
  },

  // 降级：默认推荐+最新
  _setDefaultTabs() {
    return homeTab.setDefaultTabs(this)
  },

  // 点击分类 Tab
  onCategoryTap(e) {
    return homeTab.onCategoryTap(this, e)
  },

  // Tab 栏滚动事件：同步当前实际滚动位置
  onTabScroll(e) {
    return homeTab.onTabScroll(this, e)
  },

  // 智能滚动：让选中 tab 出现在 scroll-view 宽度 1/4 处（靠左，类似第2-3个位置）
  _scrollTabToView(index) {
    return homeTab.scrollTabToView(this, index)
  },

  // 后台静默刷新标签第一页（有缓存时调用，不显示 loading）
  async _refreshTagInBackground(tag) {
    return homeTab.refreshTagInBackground(this, tag)
  },

  // 🔥 后台预拉取所有标签 Tab 第一页数据（首屏渲染完成后触发，用户切换 Tab 时秒开）
  _prefetchTagTabs() {
    return homeTab.prefetchTagTabs(this)
  },

  // 加载推荐 Tab 的热门资源瀑布流（调用 getResources 拉取热门资源）
  async loadRecommendResources() {
    return homeFeed.loadRecommendResources(this)
  },

  // 加载最新 Tab 的资源瀑布流（按上传时间倒序，无标签过滤）
  async loadLatestResources() {
    return homeFeed.loadLatestResources(this)
  },

  // 加载标签资源（调用 getResources 按 tag 查询，复用 avatar/wallpaper 页面同款链路）
  async loadTagResources() {
    return homeFeed.loadTagResources(this)
  },

  // 🔥 低端机渲染上限：点击"加载更多"手动分批渲染（上限提升一批后继续加载当前 Tab）
  onLoadMoreCapped() {
    homeFeed.loadMoreBeyondCap(this)
  },

  // 将灵感文案卡片穿插进资源列表
  // 灵感文案：每 7 项固定插一个，文案内容从云端 quotes 集合获取（_quotePool）
  _mergeInspirationCards(newItems, existingCount) {
    return homeFeed.mergeInspirationCards(this, newItems, existingCount)
  },

  // 在已经合并文案卡片后的数组里，随机位置插入 1 张广告卡片
  // 广告卡片伪装成 9:16 的 wallpaper，混入瀑布流后由 2 列布局自动分配到某一列
  // 插入位置 10-17 之间随机，保证同屏最多 1 个广告
  _injectAdCard(mergedItems, adCounter, idPrefix) {
    return homeFeed.injectAdCard(this, mergedItems, adCounter, idPrefix)
  },

  // 触底加载更多 / 预加载（推荐 Tab 和标签 Tab 分别加载对应资源）
  onTagReachBottom() {
    return homeFeed.onTagReachBottom(this)
  },

  // 🔥 预加载：剩余项数 ≤ 阈值时提前加载下一页（避免用户滑到底部看到 loading）
  _tryPrefetchNextPage() {
    return homeFeed.tryPrefetchNextPage(this)
  },

  onPageScroll(e) {
    // 🔥 预加载：根据滚动位置估算可见项索引，剩余项数 ≤ 阈值时提前加载下一页
    // 节流：滚动事件高频触发，每 200ms 最多判断一次
    const now = Date.now()
    if (this._lastPrefetchCheck && now - this._lastPrefetchCheck < 200) return
    this._lastPrefetchCheck = now

    // 估算当前可见项索引（每项约高度 280rpx ≈ 屏宽 * 0.4，2 列布局）
    const scrollTop = e.scrollTop
    const windowHeight = getWindowInfo().windowHeight
    // 每行高度估算（2 列瀑布流，每项宽≈屏宽/2，9:16 比例 → 高≈屏宽*0.72，加间距约 0.75 * 屏宽）
    const screenWidth = getWindowInfo().windowWidth
    const estimatedRowHeight = screenWidth * 0.75  // 单行高度（rpx 转 px 近似）
    // 当前可视区域顶部对应的项索引（2 列，每行 2 项）
    const topItemIndex = Math.floor(scrollTop / estimatedRowHeight) * 2
    // 可视区域底部对应的项索引
    const bottomItemIndex = Math.floor((scrollTop + windowHeight) / estimatedRowHeight) * 2
    // 记录已滚过的最大可见项索引（用于计算剩余项数）
    if (!this._lastVisibleIndex || bottomItemIndex > this._lastVisibleIndex) {
      this._lastVisibleIndex = bottomItemIndex
    }

    this._tryPrefetchNextPage()
  },

  // 触底加载更多（标签 Tab 时加载下一页资源）
  onReachBottom() {
    this.onTagReachBottom()
  },

  onPullDownRefresh() {
    hapticRefresh()  // 触感反馈：下拉到达刷新阈值
    // 下拉刷新时清除所有缓存，强制获取最新数据
    try {
      // 异步清除旧版缓存 key（避免同步 API 阻塞）
      wx.removeStorage({ key: 'categories_cache_all_tags' })
      wx.removeStorage({ key: 'resources_cache_all_all_hot' })
      wx.removeStorage({ key: 'resources_cache_all_all_latest' })
      // 用 removeStorage 同时清除 storageManager 内存缓存和 wx.storage
      removeStorage(STORAGE_KEYS.HOME_FEED_CACHE)
      removeStorage(STORAGE_KEYS.HOME_TABS_CACHE)
    } catch (e) {
      console.error('[index] 清除下拉刷新缓存失败:', e)
    }

    // 清除内存缓存（推荐 + 最新 + 标签）
    this._tagCache = {}
    this._recommendCache = null
    this._latestCache = null
    this._tagPrefetched = false
    this._lastVisibleIndex = 0
    // 🔥 重置同步锁：避免加载中下拉刷新导致后续 loadXxxResources 被锁阻塞
    this._recommendLock = false
    this._latestLock = false
    // 清除广告间隔配置缓存，下次加载强制拉取最新
    clearListAdConfigCache()
    this._tagLock = false

    // 下拉刷新时重置推荐/最新资源 + 重新加载分类标签
    this.setData({
      categoryTabsLoaded: false,
      recommendResources: [],
      recommendAdCounter: 0,
      recommendPage: 1,
      recommendHasMore: true,
      recommendLoaded: false,
      latestResources: [],
      latestAdCounter: 0,
      latestPage: 1,
      latestHasMore: true,
      latestLoaded: false,
      tagResources: [],
      tagAdCounter: 0,
      tagPage: 1,
      tagHasMore: true,
      // 🔥 低端机渲染上限：刷新后恢复初始上限，重新累计
      recommendCap: 60,
      latestCap: 60,
      tagCap: 60,
      recommendCapped: false,
      latestCapped: false,
      tagCapped: false
    })
    Promise.all([
      this.loadCategoryTabs(),
      this.loadRecommendResources()
    ]).then(() => {
      // 当前在最新 Tab：重新加载最新资源；在标签 Tab：重新加载标签资源
      if (this.data.activeCategory === 'latest') {
        this.loadLatestResources()
      } else if (this.data.activeCategory !== 'recommend') {
        this.loadTagResources()
      }
      wx.stopPullDownRefresh()
      wx.showToast({
        title: '刷新成功',
        icon: 'none'
      })
    }).catch(() => {
      wx.stopPullDownRefresh()
    })
  },

  onHide() {
  },

  onUnload() {
  },

  syncTheme() {
    const theme = getTheme()
    this.setData({ theme })
  },

  initNavBar() {
    const info = getWindowInfo()
    const statusBarHeight = info.statusBarHeight || 20
    const screenWidth = info.screenWidth || 375

    let navBarHeight = 44
    let menuRightGap = 10

    try {
      const menuButton = wx.getMenuButtonBoundingClientRect()
      if (menuButton && menuButton.width > 0) {
        // 导航栏高度：与胶囊按钮垂直居中对齐
        navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
        // 搜索图标紧贴胶囊按钮左侧（间距 8px）
        menuRightGap = screenWidth - menuButton.left + 8
      }
    } catch (e) {
      console.error('[index] 获取胶囊按钮位置失败:', e)
    }

    this.setData({ statusBarHeight, navBarHeight, menuRightGap })
  },

  onWaterfallItemTap(e) {
    const { item } = e.detail
    this._previewImage(item)
  },

  // 灵感文案卡片点击：跳转到灵感文案页
  onQuoteTap() {
    return homeInspire.onQuoteTap(this)
  },

  _previewImage(item) {
    const currentUrl = item.originalUrl || item.url
    const currentRawUrl = item.rawOriginalUrl || item.rawUrl
    const type = item.type || 'wallpaper'

    // 从数据列表中找到完整的 item 对象（包含 _id）
    let fullItem = null

    // 从推荐资源瀑布流中查找
    if (this.data.recommendResources) {
      fullItem = this.data.recommendResources.find(i => (i.originalUrl || i.url) === currentUrl)
    }

    // 从最新资源瀑布流中查找
    if (!fullItem && this.data.latestResources) {
      fullItem = this.data.latestResources.find(i => (i.originalUrl || i.url) === currentUrl)
    }

    // 从标签资源瀑布流中查找
    if (!fullItem && this.data.tagResources) {
      fullItem = this.data.tagResources.find(i => (i.originalUrl || i.url) === currentUrl)
    }

    // 如果找不到完整对象，使用传入的 item
    fullItem = fullItem || item

    // 如果是头像，跳转到自定义预览页面（支持圆形/方形切换和下载）
    if (type === 'avatar') {
      wx.navigateTo({
        url: `/subpackages/preview/preview?url=${encodeURIComponent(currentUrl)}&rawUrl=${encodeURIComponent(currentRawUrl || '')}&isAvatar=true&id=${fullItem._id || fullItem.id || ''}`
      })
    } else {
      // 如果是壁纸，也跳转到自定义预览页
      wx.navigateTo({
        url: `/subpackages/wallpaper-preview/wallpaper-preview?url=${encodeURIComponent(currentUrl)}&rawUrl=${encodeURIComponent(currentRawUrl || '')}&id=${fullItem._id || fullItem.id || ''}`
      })
    }
  },

  navigateToSearch() {
    wx.navigateTo({
      url: '/subpackages/search/search'
    })
  },

  navigateToInspiration() {
    wx.navigateTo({
      url: '/subpackages/inspiration-writer/inspiration-writer'
    })
  },

  noop() {}, // 空函数，用于阻止冒泡

  onShareAppMessage() {
    const { recordShareReward } = require('../../utils/shareReward.js')
    // 🔥 分享成功后记录奖励
    setTimeout(() => recordShareReward(), 500)
    return {
      title: '小辣椒头像壁纸 | 海量精美素材免费下载',
      path: '/pages/index/index',
      imageUrl: '/images/share-cover.png'
    }
  },

  onShareTimeline() {
    return {
      title: '小辣椒头像壁纸 | 海量精美素材免费下载',
      query: '',
      imageUrl: '/images/share-cover.png'
    }
  },

  navigateToNotifications() {
    wx.navigateTo({
      url: '/subpackages/notifications/notifications'
    })
  },

  async loadNotificationBadge() {
    return homeAnnounce.loadNotificationBadge(this)
  },

  async checkAnnouncement() {
    return homeAnnounce.checkAnnouncement(this)
  },

  closeAnnouncement() {
    return homeAnnounce.closeAnnouncement(this)
  },

  handleAnnouncementConfirm() {
    return homeAnnounce.handleAnnouncementConfirm(this)
  },

  toggleDontShowAgain() {
    return homeAnnounce.toggleDontShowAgain(this)
  }
})
