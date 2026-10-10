import { getResources, addFavorite, removeFavorite, recordDownload, getFavorites, findResourceByUrl, findResourceById, recordBrowseHistory } from '../../utils/api.js'
import { loginWithProfile } from '../../utils/auth.js'
import { reportError } from '../../utils/logger.js'
import { fetchPageAds, pickByType } from '../../utils/adUtil.js'
import interstitialAdManager from '../../utils/interstitialAdManager.js'
import { getStorage, getTheme, getWindowInfo, setStorage } from '../../utils/storageManager.js'
import { processPreviewUrl, getPreviewMainSize, getPreviewNeighborSize } from '../../utils/image.js'

// 🔥 安全解码：微信分享/扫码 path 中的 query 参数有时会被双重 URL 编码
function safeDecodeURIComponent(str) {
  if (!str || typeof str !== 'string') return str
  let decoded = str
  for (let i = 0; i < 2; i++) {
    try {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    } catch (e) {
      break
    }
  }
  return decoded
}

const previewBase = require('../../behaviors/preview-base.js')
const previewCommon = require('../../behaviors/preview-common.js')

Page({
  behaviors: [previewBase, previewCommon],
  data: {
    type: 'wallpaper',
    previewPath: '/subpackages/wallpaper-preview/wallpaper-preview',
    showLoginModal: false,
    isLoginLoading: false,
    _isHiding: false,
    theme: 'light',
    statusBarHeight: 20,
    navBarHeight: 44,
    currentUrl: '',
    // 🔥 [预览页优化] 主图 URL（当前帧，已缩放/WebP），直接给 swiper 渲染
    // 当用户切到该图时，如果该位置是 neighbor，会升级为 main
    imageList: [],
    // 🔥 [预览页优化] 邻居图 URL（上下各 1 张，更小尺寸），节省首屏带宽
    neighborList: [],
    currentIndex: 0,
    isFavorite: false,
    favorites: [],
    showPageIndicator: false,
    loadedImages: {},
    shareImageUrl: '',
    iconStarOn: '',
    iconStarOff: '',
    iconDownload: '',
    iconShare: '',
    iconBack: '',
    iconHome: '',
    iconEdit: '',
    tagList: [],
    similarList: [],
    itemsList: [],

    // Simulation
    showSimulation: false,
    simMode: 'lock', // 'lock' or 'home'
    simTime: '09:41',
    simDate: '1月1日 星期一',
    showPosterModal: false,
    // 底部原生广告
    bottomNativeVideoAd: null,
    showBottomNativeAd: false,

    // 新增：互动数据
    viewCount: 0,
    viewCountText: '0',
    downloadCount: 0,
    downloadCountText: '0',
    hotScore: 0,
    hotScoreText: '0',
    isDownloading: false, // 防重复下载锁
  },

  onShow() {
    this.setData({ _isHiding: false })
    getApp().logEvent('pv', { page: 'wallpaper-preview' })
    this.updateSimTime()
    this.syncTheme()
    // 🔥 P1-2 checkFavorite 改为数据驱动：仅当收藏列表已有数据时才检查
    if (this.data.favorites.length > 0 && this.data.currentUrl) {
      this.checkFavorite()
    }
    // 🔥 P0-1 插屏广告不再首屏强弹，改为滑动 2 次后或停留 6 秒后触发
    try { interstitialAdManager.resetCooldown() } catch (e) {
      console.error('[wallpaper-preview] 重置插屏广告冷却失败:', e)
    }
    if (!this._hasTriggeredInterstitial) {
      this._interstitialFallbackTimer = setTimeout(() => {
        if (!this._hasTriggeredInterstitial) {
          interstitialAdManager.smartTriggerInterstitialAd(0)
          this._hasTriggeredInterstitial = true
        }
      }, 6000)
    }
  },

  updateSimTime() {
    const now = new Date()
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    const month = now.getMonth() + 1
    const date = now.getDate()
    const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    const day = weekDays[now.getDay()]

    this.setData({
      simTime: `${hours}:${minutes}`,
      simDate: `${month}月${date}日 ${day}`
    })
  },

  toggleSimulation() {
    this.setData({
      showSimulation: !this.data.showSimulation
    })
    if (this.data.showSimulation) {
      this.updateSimTime()
    }
  },

  setSimMode(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ simMode: mode })
  },

  noop() {},

  async handleLogin() {
    this.setData({ isLoginLoading: true })

    try {
      const userInfo = await wx.getUserProfile({ desc: '用于登录' })

      await loginWithProfile({
        nickName: userInfo.userInfo.nickName,
        avatarUrl: userInfo.userInfo.avatarUrl
      })

      this.setData({ 
        showLoginModal: false,
        isLoginLoading: false 
      })
      wx.showToast({ title: '登录成功', icon: 'success' })

      this.loadFavorites()
    } catch (err) {
      console.error('登录流程异常:', err)
      this.setData({ isLoginLoading: false })
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    }
  },

  onLoad(options) {
    // 合并 initNavBar + getIconSet -> 1 次 setData
    this._initViewData()
    this.handleThemeChange = this.handleThemeChange.bind(this)
    wx.onThemeChange(this.handleThemeChange)

    // 初始化插屏广告管理器
    interstitialAdManager.initInterstitialAd('/subpackages/wallpaper-preview/wallpaper-preview')
    this.initBottomNativeAd()

    const { url, currentIndex, imageList: listParam, wallpaperData, rawUrl, id } = options

    // 🔥 P0 性能优化：优先用 url 立即渲染顶部图片（复用前一页图片，避免白屏等待接口）
    // 仅当无 url 时（纯分享/扫码入口）才走 _loadResourceById 等接口返回
    if (!url && id && !wallpaperData) {
      this._loadResourceById(safeDecodeURIComponent(id))
      return
    }

    if (url) {
      const decodedUrl = safeDecodeURIComponent(url)
      let rawImageList = []

      if (listParam) {
        try {
          rawImageList = JSON.parse(safeDecodeURIComponent(listParam))
        } catch (e) {
          console.error('解析图片列表失败:', e)
        }
      }

      if (rawImageList.length === 0 && decodedUrl) {
        rawImageList = [decodedUrl]
      }

      if (!rawImageList.length) {
        wx.showToast({ title: '暂无可预览的图片', icon: 'none' })
        return
      }

      let index = 0

      if (currentIndex) {
        index = parseInt(currentIndex, 10)
        if (index >= rawImageList.length) index = 0
      }

      // 🔥 [预览页优化] 分级加载：main（主图全分辨率）+ neighbor（邻居图小尺寸）
      // 原始 URL 始终保留在 rawImageList 里；下载/全屏时按需取
      const mainSize = getPreviewMainSize()
      const neighborSize = getPreviewNeighborSize()
      const mainList = rawImageList.map(u => processPreviewUrl(u, mainSize))
      const neighborList = rawImageList.map(u => processPreviewUrl(u, neighborSize))

      this.setData({
        rawImageList: rawImageList,
        currentUrl: mainList[index],
        imageList: mainList,
        neighborList: neighborList,
        currentIndex: index,
        loadedImages: {},
        rawUrl: rawUrl ? safeDecodeURIComponent(rawUrl) : '',
        // 🔥 互动区占位数据
        viewCount: 0,
        viewCountText: '0',
        downloadCount: 0,
        downloadCountText: '0',
        hotScore: 0,
        hotScoreText: '0'
      })
      this._prepareShareImageUrl(mainList[index])

      // 🔥 [方案 C] 立即预取相似推荐 → 合并到主 swiper
      // 用户进入预览页后就能左右滑动看相似
      this._prefetchAndMergeSimilar()

      // 设置当前壁纸的完整数据
      let itemsList = new Array(rawImageList.length).fill(null);
      let parsedWallpaperData = null;

      if (wallpaperData) {
        try {
          const decodedWallpaperData = safeDecodeURIComponent(wallpaperData)
          parsedWallpaperData = JSON.parse(decodedWallpaperData)

          const currentUrl = parsedWallpaperData.url || parsedWallpaperData.imageUrl || ''
          const stats = this._formatResourceStats(parsedWallpaperData)

          this.setData({
            currentWallpaper: parsedWallpaperData,
            viewCount: stats.viewCount,
            viewCountText: this._formatCount(stats.viewCount),
            downloadCount: stats.downloadCount,
            downloadCountText: this._formatCount(stats.downloadCount),
            hotScore: stats.hotScore,
            hotScoreText: this._formatCount(stats.hotScore)
          })
          itemsList[index] = parsedWallpaperData;

          // 🔥 P1-4 recordBrowseHistory 延迟 3 秒
          if (this._browseTimer) clearTimeout(this._browseTimer)
          this._browseTimer = setTimeout(() => {
            if (parsedWallpaperData && parsedWallpaperData._id) {
              recordBrowseHistory(parsedWallpaperData)
            }
          }, 3000)
        } catch (e) {
          console.error('解析壁纸数据失败:', e)
        }
      }

      // 合并 itemsList + tagList -> 1 次 setData
      this.setData({
        itemsList,
        tagList: this.getWallpaperTagList(parsedWallpaperData)
      })
      // 如果当前项没有数据，或者数据中没有标签（例如从收藏/下载列表进入），尝试获取
      // 🔥 P0 性能优化：有 id 时优先用 id 拉取（比 url 匹配更准确，且能跳过图片重置避免闪烁）
      if ((!parsedWallpaperData || !parsedWallpaperData.tags || parsedWallpaperData.tags.length === 0) && rawImageList[index]) {
        if (id) {
          this._loadResourceById(safeDecodeURIComponent(id), { skipImageRender: true })
        } else {
          this.fetchWallpaperInfo(rawImageList[index], index);
        }
      }

      // 🔥 P1-1 loadFavorites 只调 1 次
      this.loadFavorites()
    } else {
      // 🔥 [方案 C] url 缺失时（分享/扫码入口），仍然立即合并相似推荐
      this._prefetchAndMergeSimilar()
      this.loadFavorites()
    }
    // 🔥 延迟 2 秒预取下载配置，避免与 onLoad 中的广告初始化请求竞争
    setTimeout(() => this._prefetchDownloadConfig(), 2000)
  },

  /**
   * 🔥 通过资源 ID 加载资源（分享/扫码入口，比 url 匹配更准确可靠）
   * opts.skipImageRender: 当外层已用 url 渲染图片时设为 true，跳过图片重置避免闪烁
   */
  async _loadResourceById(id, opts = {}) {
    try {
      const item = await findResourceById(id)
      if (this.data._isHiding) return

      if (!item) {
        if (!opts.skipImageRender) {
          wx.showToast({ title: '资源不存在或已下架', icon: 'none' })
          setTimeout(() => wx.navigateBack(), 1500)
        }
        return
      }

      const currentUrl = safeDecodeURIComponent(item.url || item.coverUrl || item.originUrl || '')
      if (!currentUrl) {
        if (!opts.skipImageRender) {
          wx.showToast({ title: '资源数据异常', icon: 'none' })
        }
        return
      }

      // skipImageRender=true 时跳过图片重置（外层 url 已渲染，避免图片重新加载造成闪烁）
      if (!opts.skipImageRender) {
        // 🔥 [预览页优化] 分级加载：原始 URL 包装为 main + neighbor
        const rawImageList = [currentUrl]
        const mainSize = getPreviewMainSize()
        const neighborSize = getPreviewNeighborSize()
        const mainList = rawImageList.map(u => processPreviewUrl(u, mainSize))
        const neighborList = rawImageList.map(u => processPreviewUrl(u, neighborSize))

        this.setData({
          rawImageList: rawImageList,
          currentUrl: mainList[0],
          imageList: mainList,
          neighborList: neighborList,
          currentIndex: 0,
          loadedImages: {},
          rawUrl: safeDecodeURIComponent(item.originUrl || '')
        })
        this._prepareShareImageUrl(mainList[0])
      }

      const stats = this._formatResourceStats(item)
      this.setData({
        currentWallpaper: item,
        itemsList: [item],
        tagList: this.getWallpaperTagList(item),
        viewCount: stats.viewCount,
        viewCountText: this._formatCount(stats.viewCount),
        downloadCount: stats.downloadCount,
        downloadCountText: this._formatCount(stats.downloadCount),
        hotScore: stats.hotScore,
        hotScoreText: this._formatCount(stats.hotScore)
      })

      // 🔥 P1-4 recordBrowseHistory 延迟 3 秒（无论是否跳过图片渲染都要记录热度）
      if (this._browseTimer) clearTimeout(this._browseTimer)
      this._browseTimer = setTimeout(() => {
        console.log('[热度记录] ⏱ wallpaper-preview.js 3秒定时器触发, item._id:', item?._id, 'skipImageRender:', opts.skipImageRender)
        if (item && item._id) recordBrowseHistory(item)
      }, 3000)

      // skipImageRender=true 时这些副作用调用由外层 url 分支负责，避免重复
      if (!opts.skipImageRender) {
        // 🔥 [方案 C] 通过 ID 加载时也立即合并相似推荐
        this._prefetchAndMergeSimilar()

        // 🔥 P1-1 loadFavorites 只调 1 次
        this.loadFavorites()

        setTimeout(() => this._prefetchDownloadConfig(), 2000)
      }
    } catch (e) {
      console.error('通过ID加载资源失败:', e)
      if (!opts.skipImageRender) {
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    }
  },

  async initBottomNativeAd() {
    try {
      const pages = getCurrentPages()
      const current = pages && pages.length ? pages[pages.length - 1] : null
      const route = current?.route || 'subpackages/wallpaper-preview/wallpaper-preview'
      const list = await fetchPageAds(route.startsWith('/') ? route : '/' + route)
      const nativeBottom = pickByType(list, 'native_bottom')[0] || null
      const bottomNativeVideo = (list || []).find(it => it.type === 'native_video' && (it.position === 'bottom' || !it.position) && it.isEnable) || null
      const chosenBottom = nativeBottom || bottomNativeVideo
      if (chosenBottom) {
        this.setData({ bottomNativeVideoAd: chosenBottom }, () => {
          this.maybeAutoShowBottomAd()
        })
      }
    } catch (e) {
      console.error('[wallpaper-preview] 加载底部广告失败:', e)
    }
  },

  maybeAutoShowBottomAd() {
    if (!this.data.bottomNativeVideoAd || this.data.showBottomNativeAd) return
    const win = getWindowInfo()
    wx.createSelectorQuery()
      .select('.container')
      .boundingClientRect(rect => {
        if (!rect) return
        const threshold = 40
        if (rect.bottom <= win.windowHeight + threshold) {
          this.setData({ showBottomNativeAd: true })
        }
      })
      .exec()
  },

  getWallpaperTagList(item) {
    const currentWallpaper = item || this.data.currentWallpaper || {}
    let rawTags = currentWallpaper.tags || []

    // 处理标签数据：可能是字符串，也可能是数组，数组中可能包含逗号分隔的字符串
    let tags = []
    if (typeof rawTags === 'string') {
      tags = rawTags.split(/[,，]/)
    } else if (Array.isArray(rawTags)) {
      rawTags.forEach(tag => {
        if (typeof tag === 'string') {
          tags = tags.concat(tag.split(/[,，]/))
        } else {
          tags.push(String(tag))
        }
      })
    }

    // 去除空白和空项
    tags = tags.map(t => t.trim()).filter(t => t)

    const colors = ['primary', 'secondary', 'blue', 'orange', 'purple', 'teal']

    return tags.map((tag, index) => ({
      label: tag,
      type: colors[index % colors.length]
    }))
  },

  async fetchWallpaperInfo(url, index) {
    if (!url) return;

    try {
      const item = await findResourceByUrl(url)

      // 检查页面是否已卸载
      if (this.data._isHiding) {
        return
      }

      if (item) {
        // 更新 itemsList
        const itemsList = this.data.itemsList;
        itemsList[index] = item;

        // 如果当前还在查看这张图，则更新视图
        if (this.data.currentIndex === index) {
           const url = item.url || item.coverUrl || ''
           const stats = this._formatResourceStats(item)

           // 再次检查页面状态
           if (this.data._isHiding) {
             return
           }

           this.setData({
             itemsList,
             currentWallpaper: item,
             tagList: this.getWallpaperTagList(item),
             viewCount: stats.viewCount,
             viewCountText: this._formatCount(stats.viewCount),
             downloadCount: stats.downloadCount,
             downloadCountText: this._formatCount(stats.downloadCount),
             hotScore: stats.hotScore,
             hotScoreText: this._formatCount(stats.hotScore)
           });

           // 🔥 P1-3 不再二次调用 buildSimilarList（onLoad 已加载）
           // 🔥 P1-4 recordBrowseHistory 延迟 3 秒
           if (this._browseTimer) clearTimeout(this._browseTimer)
           this._browseTimer = setTimeout(() => {
             if (item && item._id) recordBrowseHistory(item)
           }, 3000)
        } else {
           // 再次检查页面状态
           if (this.data._isHiding) {
             return
           }
           this.setData({ itemsList });
        }
      } else {
      }
    } catch (err) {
      console.error('Fetch wallpaper info failed', err);
    }
  },

  onUnload() {
    this.onUnloadCommon()
    wx.offThemeChange && wx.offThemeChange(this.handleThemeChange)
    interstitialAdManager.destroy()
    if (this._fallbackTimer) {
      clearTimeout(this._fallbackTimer)
      this._fallbackTimer = null
    }
    // 🔥 P0-1 清理插屏广告兜底 timer
    if (this._interstitialFallbackTimer) {
      clearTimeout(this._interstitialFallbackTimer)
      this._interstitialFallbackTimer = null
    }
  },

  onImageTap(e) {
    const now = Date.now()
    const lastTap = this.lastTapTime || 0
    const gap = now - lastTap

    if (gap > 0 && gap < 300) {
      // Double tap detected
      this.toggleFavorite()
    }

    this.lastTapTime = now
  },

  onRecommendTap(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return

    // 🔥 [预览页优化] 在 rawImageList 中查找（原始 URL，未缩放），避免和缩略图字符串匹配不上
    const rawList = this.data.rawImageList || this.data.imageList
    let index = rawList.indexOf(url)

    if (index !== -1) {
      // 找到对应项并切到主预览（确保 URL 一致）
      // 🔥 [相似推荐] 同步主预览源
      this.setData({ currentIndex: index })
      // 滚动到顶部
      wx.pageScrollTo({ scrollTop: 0, duration: 300 })
      // 手动触发 swiper change 逻辑以更新状态
      this.onSwiperChange({ detail: { current: index } })
    } else {
      // 如果没找到，追加到 rawImageList + main + neighbor 三处保持一致
      const newRawList = [...rawList, url]
      const newMainList = this.data.imageList
      const newNeighborList = this.data.neighborList
      const mainSize = getPreviewMainSize()
      const neighborSize = getPreviewNeighborSize()
      newMainList.push(processPreviewUrl(url, mainSize))
      newNeighborList.push(processPreviewUrl(url, neighborSize))
      const newItemsList = [...this.data.itemsList, null] // 占位
      const newIndex = newRawList.length - 1

      this.setData({
        rawImageList: newRawList,
        imageList: newMainList,
        neighborList: newNeighborList,
        itemsList: newItemsList,
        currentIndex: newIndex
      })

      // 滚动到顶部
      wx.pageScrollTo({ scrollTop: 0, duration: 300 })
      this.onSwiperChange({ detail: { current: newIndex } })
    }
  },

  onTagTap(e) {
    const tag = e.currentTarget.dataset.tag
    if (!tag) return

    wx.navigateTo({
      url: `/subpackages/resource-list/resource-list?tag=${encodeURIComponent(tag)}&title=${encodeURIComponent(tag)}`
    })
  },

  onTouchStart(e) {
    this.setData({ showPageIndicator: true })
    this.touchStartX = e.touches[0].clientX
    this.touchStartY = e.touches[0].clientY
  },

  onTouchEnd(e) {
    if (this.hideTimer) clearTimeout(this.hideTimer)
    this.hideTimer = setTimeout(() => {
      this.setData({ showPageIndicator: false })
    }, 2000)

    this.touchEndX = e.changedTouches[0].clientX
    this.touchEndY = e.changedTouches[0].clientY

    const deltaX = this.touchEndX - this.touchStartX
    const deltaY = this.touchEndY - this.touchStartY

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
      this.slideDirection = deltaX > 0 ? 'right' : 'left'
    }
  },

  async onSwiperChange(e) {
    const index = e.detail.current
    const previous = this.data.currentIndex

    // 更新当前数据对象
    const currentItem = this.data.itemsList[index];

    // Check if we need to fetch data:
    // 1. Item doesn't exist
    // 2. Item exists but has no tags (and we expect tags)
    const needsFetch = !currentItem || (!currentItem.tags || currentItem.tags.length === 0);

    // 🔥 [预览页优化] 升级为 main：滑动到新索引时，把"邻居图"位置替换为主图
    // 避免用户看到低清邻居图；主图体积大约是邻居的 1.5-2x，但只在切到时才下载
    const rawList = this.data.rawImageList || this.data.imageList
    const mainSize = getPreviewMainSize()
    const newMainUrl = processPreviewUrl(rawList[index], mainSize)
    const imageList = [...this.data.imageList]
    imageList[index] = newMainUrl

    // 合并 stats + navigation -> 1 次 setData
    const patch = {
      currentIndex: index,
      currentUrl: newMainUrl,
      imageList: imageList,
      rawUrl: '',
      showPageIndicator: true
    }

    if (currentItem) {
      const url = currentItem.url || currentItem.coverUrl || ''
      const stats = this._formatResourceStats(currentItem)

      const loadedImages = { ...this.data.loadedImages }
      loadedImages[index] = false

      Object.assign(patch, {
        currentWallpaper: currentItem,
        viewCount: stats.viewCount,
        viewCountText: this._formatCount(stats.viewCount),
        downloadCount: stats.downloadCount,
        downloadCountText: this._formatCount(stats.downloadCount),
        hotScore: stats.hotScore,
        hotScoreText: this._formatCount(stats.hotScore),
        tagList: this.getWallpaperTagList(currentItem),
        loadedImages
      })

      // 🔥 [预览页优化] 真实 onLoad 后再标记 loaded（方案 D），不再用 setTimeout 50ms 假装
      // onImageLoad 会负责把对应 index 置 true

      if (this.browseTimer) clearTimeout(this.browseTimer)
      this.browseTimer = setTimeout(() => {
        if (currentItem && currentItem._id) {
          recordBrowseHistory(currentItem)
        }
      }, 1000)
    } else {
      Object.assign(patch, {
        tagList: [],
        currentWallpaper: {},
        viewCount: 0,
        viewCountText: '0',
        downloadCount: 0,
        downloadCountText: '0',
        hotScore: 0,
        hotScoreText: '0'
      })
    }

    this.setData(patch)

    if (needsFetch) {
      const currentUrl = rawList[index];
      if (currentUrl) {
        this.fetchWallpaperInfo(currentUrl, index);
      }
    }
    this.checkFavorite()

    if (this.hideTimer) clearTimeout(this.hideTimer)
    this.hideTimer = setTimeout(() => {
      this.setData({ showPageIndicator: false })
    }, 2000)

    this.slideDirection = index > previous ? 'left' : 'right'

    // 🔥 P0-1 插屏广告：滑动 2 次后触发
    this._swiperChangeCount = (this._swiperChangeCount || 0) + 1
    if (this._swiperChangeCount === 2 && !this._hasTriggeredInterstitial) {
      this._hasTriggeredInterstitial = true
      interstitialAdManager.smartTriggerInterstitialAd(500)
    }
  },

  /**
   * 🔥 [方案 C] 进入预览页时立即把相似推荐合并到主 swiper
   * 用户在主预览大图左右滑动就能看到相似推荐
   * 一次性合并，避免重复
   */
  _prefetchAndMergeSimilar() {
    this.buildSimilarList().then(similarList => {
      if (this.data._isHiding) return
      if (!similarList || similarList.length === 0) {
        this.setData({ similarList: [] })
        return
      }

      this.setData({ similarList })

      // 🔥 立即合并到主 swiper
      const mainSize = getPreviewMainSize()
      const neighborSize = getPreviewNeighborSize()

      const newRawUrls = []
      const newMainUrls = []
      const newNeighborUrls = []

      similarList.forEach(item => {
        if (!item.url) return
        // 跳过已存在的（避免重复）
        if ((this.data.rawImageList || []).indexOf(item.url) !== -1) return
        newRawUrls.push(item.url)
        newMainUrls.push(processPreviewUrl(item.url, mainSize))
        newNeighborUrls.push(processPreviewUrl(item.url, neighborSize))
      })

      if (newRawUrls.length === 0) return

      const rawImageList = [...(this.data.rawImageList || []), ...newRawUrls]
      const imageList = [...this.data.imageList, ...newMainUrls]
      const neighborList = [...(this.data.neighborList || []), ...newNeighborUrls]
      const itemsList = [...this.data.itemsList, ...new Array(newRawUrls.length).fill(null)]

      this.setData({
        rawImageList,
        imageList,
        neighborList,
        itemsList
      })
    }).catch(err => {
      console.error('[wallpaper-preview] 预取相似推荐失败:', err)
    })
  },

  /**
   * 🔥 [方案 A 保留] 边界追加：若相似推荐异步追加到了主列表，仍能兜底
   * 当前方案 C 已经把相似推荐合并到主列表，此方法作为防御性兜底保留
   */
  _appendSimilarToMain() {
    const similarList = this.data.similarList || []
    if (similarList.length === 0) return

    this._similarAppended = true

    const mainSize = getPreviewMainSize()
    const neighborSize = getPreviewNeighborSize()

    const newRawUrls = []
    const newMainUrls = []
    const newNeighborUrls = []

    similarList.forEach(item => {
      if (!item.url) return
      if ((this.data.rawImageList || []).indexOf(item.url) !== -1) return
      newRawUrls.push(item.url)
      newMainUrls.push(processPreviewUrl(item.url, mainSize))
      newNeighborUrls.push(processPreviewUrl(item.url, neighborSize))
    })

    if (newRawUrls.length === 0) return

    const rawImageList = [...(this.data.rawImageList || []), ...newRawUrls]
    const imageList = [...this.data.imageList, ...newMainUrls]
    const neighborList = [...(this.data.neighborList || []), ...newNeighborUrls]
    const itemsList = [...this.data.itemsList, ...new Array(newRawUrls.length).fill(null)]

    this.setData({
      rawImageList,
      imageList,
      neighborList,
      itemsList
    })
  },

  loadFavorites() {
    // 优先加载本地缓存
    try {
      const favorites = getStorage('favorites') || []
      this.setData({ favorites })
    } catch (e) {
      console.error('加载本地收藏失败:', e)
    }

    // 同步云端数据
    getFavorites('all', 1, 100).then(res => {
      if (res.data) {
        const cloudFavorites = res.data.map(item => ({
          url: item.url,
          type: item.type,
          timestamp: item.createTime ? new Date(item.createTime).getTime() : Date.now()
        }))

        // 更新本地存储和页面数据
        this.setData({ favorites: cloudFavorites })
        setStorage('favorites', cloudFavorites)
        this.checkFavorite()
      }
    }).catch(err => {
      console.error('加载云端收藏失败:', err)
    })
  },

  // 新增：显示评论弹窗

  copyPagePath() {
    const { currentUrl } = this.data
    let path = '/subpackages/wallpaper-preview/wallpaper-preview'
    const params = []

    if (currentUrl) {
      params.push(`url=${encodeURIComponent(currentUrl)}`)
    }

    const userInfo = getStorage('userInfo')
    if (userInfo && userInfo.openid) {
      params.push(`inviter=${userInfo.openid}`)
    }

    path = path + '?' + params.join('&')

    wx.setClipboardData({
      data: path,
      success: () => {
        wx.showToast({ title: '页面链接已复制', icon: 'success' })
      },
      fail: (err) => {
        console.error('复制链接失败:', err)
        wx.showToast({ title: '复制失败，请重试', icon: 'none' })
      }
    })
  },

  onShareAppMessage() {
    const { recordShareReward } = require('../../utils/shareReward.js')
    setTimeout(() => recordShareReward(), 500)

    // 🔥 生成更好的分享标题
    const wallpaperData = this.data.currentWallpaper || this.data.wallpaperData || {}
    const categories = wallpaperData.categories || []
    const tags = wallpaperData.tags || []
    const firstTag = categories[0] || tags[0] || ''
    let title = '发现了一张超好看的壁纸'
    if (firstTag) {
      title = `${firstTag}壁纸 | 小辣椒动态头像`
    } else if (wallpaperData.title && !wallpaperData.title.includes('.')) {
      title = wallpaperData.title
    }

    // 🔥 分享路径带上资源 ID，好友打开可直接定位到对应壁纸
    // 先解码再编码，防止 currentUrl 本身已编码导致双重编码
    const resourceId = wallpaperData._id || wallpaperData.id || ''
    const shareUrl = safeDecodeURIComponent(this.data.currentUrl)
    let path = `/subpackages/wallpaper-preview/wallpaper-preview?url=${encodeURIComponent(shareUrl)}`
    if (resourceId) {
      path += `&id=${resourceId}`
    }

    return {
      title: title,
      path: path,
      imageUrl: this.data.shareImageUrl || this.data.currentUrl
    }
  },

  onShareTimeline() {
    const wallpaperData = this.data.wallpaperData || this.data.currentWallpaper || {}
    const categories = wallpaperData.categories || []
    const tags = wallpaperData.tags || []
    const firstTag = categories[0] || tags[0] || ''
    let title = '小辣椒动态头像 | 精美壁纸免费下载'
    if (firstTag) {
      title = `${firstTag}壁纸 | 小辣椒动态头像`
    }
    const resourceId = wallpaperData._id || wallpaperData.id || ''
    const shareUrl = safeDecodeURIComponent(this.data.currentUrl)
    let query = `url=${encodeURIComponent(shareUrl)}`
    if (resourceId) query += `&id=${resourceId}`
    return {
      title: title,
      query: query,
      imageUrl: this.data.shareImageUrl || this.data.currentUrl
    }
  },

  async ensureResourceId() {
    const { currentWallpaper, currentUrl, currentIndex } = this.data
    if (currentWallpaper && currentWallpaper._id) {
      return currentWallpaper._id
    }

    if (!currentUrl) return null

    // 如果正在获取中，等待
    if (this.fetchingInfoPromise) {
      return this.fetchingInfoPromise
    }

    this.fetchingInfoPromise = new Promise(async (resolve) => {
      try {
        const item = await findResourceByUrl(currentUrl)
        if (item) {
          // 更新当前数据
          const itemsList = this.data.itemsList
          itemsList[currentIndex] = item

          const url = item.url || item.coverUrl || ''
          const stats = this._formatResourceStats(item)

          this.setData({
            itemsList,
            currentWallpaper: item,
            tagList: this.getWallpaperTagList(item),
            viewCount: stats.viewCount,
            viewCountText: this._formatCount(stats.viewCount),
            downloadCount: stats.downloadCount,
            downloadCountText: this._formatCount(stats.downloadCount),
            hotScore: stats.hotScore,
            hotScoreText: this._formatCount(stats.hotScore)
          })
          resolve(item._id)
        } else {
          resolve(null)
        }
      } catch (e) {
        console.error('ensureResourceId error:', e)
        resolve(null)
      } finally {
        this.fetchingInfoPromise = null
      }
    })

    return this.fetchingInfoPromise
  },

  // 钩子：保存到相册失败且为 auth 错误时，wallpaper 额外提示用户
  _onSaveAlbumFail(err) {
    wx.showModal({
      title: '保存失败',
      content: '图片保存失败，请稍后重试',
      showCancel: false,
      confirmText: '知道了'
    })
  }
})

