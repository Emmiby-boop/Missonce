import { getResources } from '../../utils/api.js'
import interstitialAdManager from '../../utils/interstitialAdManager.js'
import { getStorage, setStorage, getWindowInfo } from '../../utils/storageManager.js'

// 🔥 P0-2 资源列表页缓存层：与首页 L1/L2 模式对齐，避免每次进入页面都走网络
// 缓存 TTL 5 分钟，与 getResources 云函数缓存对齐
const RL_CACHE_TTL = 5 * 60 * 1000

function buildCacheKey(params) {
  const { type, category, tag, sort, keyword, color } = params
  return `rl_cache_${type}_${category || 'all'}_${tag || 'all'}_${sort || 'hot'}_${keyword || ''}_${color || ''}`
}

Page({
  _isLoadingData: false,
  _isFromCache: false,      // 当前显示的数据是否来自缓存（用于静默刷新失败时保留缓存）
  _cacheKey: '',            // 当前页面的缓存 key
  _silentRefreshing: false, // 是否正在后台静默刷新

  data: {
    statusBarHeight: 20,
    navBarHeight: 44,

    // Params
    type: 'wallpaper', // wallpaper | avatar
    currentCategory: '',
    currentTag: 'all',
    currentSort: 'hot', // 默认按热门排序
    pageTitle: '资源列表',
    keyword: '',
    color: '',

    // Data
    list: [],
    // 分段列表：每 N 个资源切一段，段间插入横幅广告（占整行）
    // [{ resources: [...], adAfter: true }]
    sections: [],
    // 广告配置：从 config 集合拉取，0 或 enabled=false 时关闭
    adInterval: 12,
    adEnabled: true,

    // Pagination
    page: 1,
    pageSize: 15,
    loading: false,
    hasMore: true,

    // 手动选择模式配置
    resourceIds: [],       // 指定资源ID列表
    columnCount: 3,        // 网格列数
    isManualMode: false,   // 是否手动模式（隐藏标签栏/排序栏）
  },

  onLoad(options) {
    this.initNavBar()

    // 初始化插屏广告管理器
    interstitialAdManager.initInterstitialAd('/subpackages/resource-list/resource-list')

    const decode = (val) => val ? decodeURIComponent(val) : ''

    // 优先使用 options 中的 sort，如果没有则默认为 'hot'
    const { type = 'wallpaper', category = '', tag = 'all', sort = 'hot', title, keyword = '', color = '', ids = '', columns = '' } = options

    const decodedKeyword = decode(keyword)
    const decodedColor = decode(color)
    const decodedCategory = decode(category)
    const decodedTitle = decode(title)
    // tag 参数：标签名（需解码，topics.js 跳转时 encodeURIComponent 编码过）
    const decodedTag = decode(tag) || 'all'
    // ids 参数：逗号分隔的资源ID列表（手动选择模式）
    const decodedIds = decode(ids)
    const resourceIds = decodedIds ? decodedIds.split(',').map(s => s.trim()).filter(Boolean) : []
    // columns 参数：网格列数（后台配置）
    const columnCount = columns ? Math.min(4, Math.max(2, parseInt(columns, 10) || 3)) : 3

    // 智能识别标题
    let pageTitle = decodedTitle
    if (!pageTitle) {
      if (decodedKeyword) {
        pageTitle = decodedKeyword
      } else if (decodedColor) {
        pageTitle = `${decodedColor}系`
      } else if (decodedCategory) {
        pageTitle = decodedCategory
      } else if (type === 'avatar') {
        pageTitle = '头像列表'
      } else {
        pageTitle = '壁纸精选'
      }
    }

    this.setData({
      type,
      currentCategory: decodedCategory,
      currentTag: decodedTag,
      currentSort: sort,
      keyword: decodedKeyword,
      color: decodedColor,
      pageTitle,
      resourceIds,           // 手动模式：指定资源ID列表
      columnCount,           // 网格列数
      isManualMode: resourceIds.length > 0,  // 是否手动选择模式
      list: [],
      sections: [],
      page: 1,
      hasMore: true,
      loading: false
    })

    // 加载广告配置（不阻塞首屏，配置失败时用默认值）
    this.loadAdConfig()

    // 🔥 P0-2 缓存秒开：手动模式(按ids查询)和点赞列表不缓存，其他类型优先读 storage 缓存
    // 命中缓存 → 立即渲染 → 后台静默刷新；未命中 → 正常网络加载
    const cacheKey = buildCacheKey({
      type, category: decodedCategory, tag: decodedTag,
      sort, keyword: decodedKeyword, color: decodedColor
    })
    this._cacheKey = cacheKey

    if (type !== 'likes' && !this.data.isManualMode) {
      const cached = getStorage(cacheKey)
      if (cached && cached.list && cached.list.length > 0 && (Date.now() - cached.timestamp) < RL_CACHE_TTL) {
        console.log('[resource-list] L2 缓存命中，秒开，list:', cached.list.length)
        this._isFromCache = true
        this.setData({
          list: cached.list,
          page: cached.page,
          hasMore: cached.hasMore,
          loading: false
        }, () => {
          this._rebuildSections()
        })
        // 后台静默刷新，不显示 loading
        this._refreshInBackground()
        return
      }
    }

    // 无缓存，正常加载
    this.loadData(true)
  },

  // 后台静默刷新：只重新拉取第一页更新缓存，不影响用户当前浏览的 list
  // 失败时保留缓存数据不报错；用户下次进入页面会读到新缓存
  async _refreshInBackground() {
    if (this._silentRefreshing) return
    this._silentRefreshing = true
    try {
      const { type, currentCategory, currentTag, currentSort, pageSize, keyword, color } = this.data
      const params = { type, page: 1, pageSize, includeMeta: false }
      if (keyword) params.keyword = keyword
      if (color) params.color = color
      if (currentCategory) params.category = currentCategory
      if (currentTag && currentTag !== 'all') params.tag = currentTag
      if (currentSort) params.sort = currentSort

      const res = await getResources(params)
      if (res.result && res.result.success) {
        const rawList = res.result.data || []
        const newData = rawList.map(item => ({
          id: item.id || item._id,
          url: item.coverUrl,
          originalUrl: item.originUrl || item.coverUrl,
          rawUrl: item.coverUrl,
          rawOriginalUrl: item.originUrl,
          title: item.title,
          categories: item.categories,
          tags: item.tags,
          type: item.type
        }))
        const newHasMore = rawList.length === pageSize
        // 仅更新缓存，不动当前 list（避免用户滚动位置跳动）
        if (this._cacheKey) {
          setStorage(this._cacheKey, {
            list: newData,
            page: 2,
            hasMore: newHasMore,
            timestamp: Date.now()
          })
        }
        // 🔥 修复：缓存命中后 hasMore 不会随后台刷新更新
        // 如果缓存中 hasMore=false 但后台刷新发现还有更多数据，需同步更新当前 UI
        // 否则用户 onReachBottom 不会触发加载更多
        if (this._isFromCache && !this.data.hasMore && newHasMore) {
          this.setData({ hasMore: true })
        }
        console.log('[resource-list] 后台刷新完成，已更新缓存，list:', newData.length)
      }
    } catch (e) {
      console.warn('[resource-list] 后台刷新失败，保留缓存数据:', e.message)
    } finally {
      this._silentRefreshing = false
    }
  },

  // 加载资源列表横幅广告配置（从 config 集合按页面路径读取）
  // 新格式: { pages: { '/subpackages/resource-list/resource-list': { enabled: true, interval: 12 } } }
  // 旧格式兼容: { enabled: true, interval: 12 }（所有页面共用）
  async loadAdConfig() {
    const PAGE_PATH = '/subpackages/resource-list/resource-list'
    try {
      const res = await wx.cloud.callFunction({
        name: 'getConfig',
        data: { key: 'listAdConfig' }
      })
      if (res.result && res.result.success && res.result.data) {
        const cfg = res.result.data.value || {}
        let pageCfg
        if (cfg.pages && typeof cfg.pages === 'object') {
          // 新格式：按页面路径查找，未配置则默认关闭
          pageCfg = cfg.pages[PAGE_PATH] || { enabled: false, interval: 12 }
        } else {
          // 旧格式：全局共用
          pageCfg = cfg
        }
        const interval = Math.max(0, Math.min(50, Number(pageCfg.interval) || 12))
        const enabled = pageCfg.enabled !== false && interval > 0
        this.setData({ adInterval: interval, adEnabled: enabled })
        // 配置加载后重新分段（首次列表可能已加载完）
        this._rebuildSections()
      }
    } catch (e) {
      console.warn('[listAd] 配置加载失败，使用默认值:', e)
    }
  },

  // 根据当前 list 和 adInterval 重建分段
  _rebuildSections() {
    const list = this.data.list
    const interval = this.data.adInterval
    const enabled = this.data.adEnabled
    if (!enabled || interval <= 0 || list.length === 0) {
      this.setData({ sections: [{ resources: list, adAfter: false }] })
      return
    }
    const sections = []
    for (let i = 0; i < list.length; i += interval) {
      const chunk = list.slice(i, i + interval)
      const isLast = i + interval >= list.length
      sections.push({ resources: chunk, adAfter: !isLast })
    }
    this.setData({ sections })
  },

  _tryPrefetch(e) {
    if (this._isLoadingData || !this.data.hasMore) return
    // 节流：500ms 内只触发一次
    const now = Date.now()
    if (this._lastPrefetchTime && now - this._lastPrefetchTime < 500) return
    // 估算：提前 2 屏 + 10 项时触发预加载
    const { windowHeight } = getWindowInfo()
    const threshold = windowHeight * 2 + 2000
    const scrollHeight = e.scrollHeight || 99999
    if (scrollHeight - e.scrollTop - windowHeight < threshold) {
      this._lastPrefetchTime = now
      this.loadData()
    }
  },

  onReachBottom() {
    this.loadData()
  },

  onPageScroll(e) {
    // 滚动时智能触发插屏广告（带冷却与防抖）
    interstitialAdManager.smartTriggerInterstitialAd(1500)
    // 🔥 预加载：滚动到距底部约 2 屏时提前加载下一页
    this._tryPrefetch(e)
  },

  onShow() {
    // 页面显示时智能触发插屏广告（带冷却时间检查）
    interstitialAdManager.smartTriggerInterstitialAd(2000)
  },

  initNavBar() {
    try {
      const info = getWindowInfo()
      const statusBarHeight = info.statusBarHeight || 20
      const navBarHeight = 44 // Fixed 44px
      this.setData({ statusBarHeight, navBarHeight })
    } catch (e) {
      console.error('获取系统信息失败:', e)
      this.setData({ statusBarHeight: 20, navBarHeight: 44 })
    }
  },

  navigateBack() {
    wx.navigateBack()
  },

  async loadData(reset = false) {
    if (this._isLoadingData) return
    if (!reset && !this.data.hasMore) return

    this._isLoadingData = true
    this.setData({ loading: true })

    try {
      const page = reset ? 1 : this.data.page
      const { type, currentCategory, currentTag, currentSort, pageSize, keyword, color } = this.data

      let res;
      if (type === 'likes') {
        // 加载点赞列表
        const db = wx.cloud.database()
        const openid = getStorage('openid')
        if (!openid) {
          this.setData({ loading: false, hasMore: false })
          return
        }

        const likesRes = await db.collection('likes')
          .where({ _openid: openid })
          .orderBy('createTime', 'desc')
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .get()

        const resourceIds = likesRes.data.map(l => l.resourceId)
        if (resourceIds.length === 0) {
          this.setData({
            list: reset ? [] : this.data.list,
            hasMore: false,
            loading: false
          })
          return
        }

        const _ = db.command
        const resourcesRes = await db.collection('resources')
          .where({ _id: _.in(resourceIds) })
          .get()

        // 保持点赞顺序
        const orderedResources = resourceIds.map(id => resourcesRes.data.find(r => r._id === id)).filter(Boolean)
        // 确保有 type 字段
        orderedResources.forEach(item => {
          if (!item.id) item.id = item._id
          if (!item.type) item.type = item.type || 'wallpaper'
        })
        res = { result: { success: true, data: orderedResources } }
      } else {
        const params = {
          type,
          page,
          pageSize,
          includeMeta: false  // 🔥 优化：不需要分类标签，减少查询
        }

        // 手动选择模式：按指定 ids 拉取资源
        if (this.data.isManualMode && this.data.resourceIds.length > 0) {
          params.ids = this.data.resourceIds
        }

        if (keyword) {
          params.keyword = keyword
        }

        if (color) {
          params.color = color
        }

        if (currentCategory) {
          params.category = currentCategory
        }

        if (currentTag && currentTag !== 'all') {
          params.tag = currentTag
        }

        if (currentSort) {
          params.sort = currentSort
        }

        res = await getResources(params)
      }

      if (res.result.success) {
        const rawList = res.result.data || []

        // 直接使用原始 URL，cloud:// 由瀑布流组件 WXS 原生处理，无需 getTempFileURL
        const newData = rawList.map(item => ({
          id: item.id || item._id,
          url: item.coverUrl,
          originalUrl: item.originUrl || item.coverUrl,
          rawUrl: item.coverUrl,
          rawOriginalUrl: item.originUrl,
          title: item.title,
          categories: item.categories,
          tags: item.tags,
          type: item.type
        }))

        // 注入广告：每 N 个资源切一段，段间插横幅广告（由 _rebuildSections 处理）
        const merged = reset ? newData : [...this.data.list, ...newData]
        const newHasMore = this.data.isManualMode ? false : (rawList.length === pageSize)
        this.setData({
          list: merged,
          page: page + 1,
          // 手动模式一次性加载完，不分页
          hasMore: newHasMore,
          loading: false
        }, () => {
          this._rebuildSections()
        })

        // 🔥 P0-2 写入缓存：仅 reset 第一页 + 非手动模式 + 非likes 才缓存
        if (reset && type !== 'likes' && !this.data.isManualMode && this._cacheKey) {
          setStorage(this._cacheKey, {
            list: merged,
            page: page + 1,
            hasMore: newHasMore,
            timestamp: Date.now()
          })
        }
        // 标记数据已从网络刷新（不再是缓存态）
        if (reset) this._isFromCache = false
      } else {
        this.setData({ loading: false })
      }
    } catch (error) {
      console.error('加载资源失败:', error)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this._isLoadingData = false
    }
  },

  onPullDownRefresh() {
    this.loadData(true).then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onWaterfallItemTap(e) {
    const item = e.detail.item
    this.previewImage({ currentTarget: { dataset: item } })
  },

  previewImage(e) {
    const item = e.currentTarget.dataset
    const { list } = this.data
    const currentUrl = item.url || item.originalUrl

    // 从 list 数组中找到完整的 item 对象
    let fullItem = list.find(i => (i.url || i.originalUrl) === currentUrl)
    fullItem = fullItem || item
    const itemType = fullItem.type || 'wallpaper'

    if (itemType === 'avatar') {
        wx.navigateTo({
            url: `/subpackages/preview/preview?url=${encodeURIComponent(fullItem.url)}&rawUrl=${encodeURIComponent(fullItem.rawUrl || '')}&isAvatar=true&id=${fullItem._id || fullItem.id || ''}`
        })
    } else {
        wx.navigateTo({
            url: `/subpackages/wallpaper-preview/wallpaper-preview?url=${encodeURIComponent(fullItem.url)}&rawUrl=${encodeURIComponent(fullItem.rawUrl || '')}&id=${fullItem._id || fullItem.id || ''}`
        })
    }
  }
})
