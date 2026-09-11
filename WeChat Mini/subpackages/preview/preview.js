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
    type: 'avatar',
    previewPath: '/subpackages/preview/preview',
    showLoginModal: false,
    isLoginLoading: false,
    _isHiding: false,

    modalError: '',
    theme: 'light',
    statusBarHeight: 20,
    navBarHeight: 39,
    currentUrl: '',
    // 🔥 [预览页优化] 主图 URL（当前帧，已缩放/WebP），直接给 swiper 渲染
    imageList: [],
    // 🔥 [预览页优化] 邻居图 URL（上下各 1 张，更小尺寸），节省首屏带宽
    neighborList: [],
    currentIndex: 0,
    isCircular: true,
    isAvatar: true,
    isFavorite: false,
    shareImageUrl: '',
    favorites: [],
    recommendList: [],
    showPageIndicator: false,
    imageLoaded: true,
    loadedImages: {},
    iconHome: '',
    iconStarOn: '',
    iconStarOff: '',
    iconDownload: '',
    iconShare: '',
    iconBack: '',
    iconEdit: '',

    // 新增：互动数据
    viewCount: 0,
    viewCountText: '0',
    downloadCount: 0,
    downloadCountText: '0',
    hotScore: 0,
    hotScoreText: '0',

    isDownloading: false, // 防重复下载锁

    tagList: [

      { label: '头像', type: 'primary' },
      { label: '女生头像', type: 'secondary' },
      { label: '高清', type: 'light' }
    ],
    similarList: [],
    itemsList: [],
    showPosterModal: false,

    // 底部原生广告
    bottomNativeVideoAd: null,
    showBottomNativeAd: false,

    // 插屏广告冷却控制
    lastInterstitialShowTime: 0,
    interstitialCooldown: 60000, // 1分钟冷却时间
    interstitialTriggerCount: 0,
    maxTriggersPerSession: 3 // 每会话最多触发次数
  },

  onShow() {
    this.setData({ _isHiding: false })
    getApp().logEvent('pv', { page: 'preview' })
    // 🔥 P1-2 checkFavorite 改为数据驱动：仅当收藏列表已有数据时才检查
    if (this.data.favorites.length > 0 && this.data.currentUrl) {
      this.checkFavorite()
    }

    // 🔥 P0-1 插屏广告不再首屏 800ms 强弹，改为用户滑动切换 2 次后或停留 6 秒后触发
    try { interstitialAdManager.resetCooldown() } catch (e) {
      console.error('[preview] 重置插屏广告冷却失败:', e)
    }
    // 首次进入 6 秒后兜底触发一次（用户可能不滑动）
    if (!this._hasTriggeredInterstitial) {
      this._interstitialFallbackTimer = setTimeout(() => {
        if (!this._hasTriggeredInterstitial) {
          interstitialAdManager.smartTriggerInterstitialAd(0)
          this._hasTriggeredInterstitial = true
        }
      }, 6000)
    }
  },

  async handleLogin() {
    this.setData({ isLoginLoading: true, modalError: '' })

    try {
      const userInfo = await wx.getUserProfile({ desc: '用于登录' })

      await loginWithProfile({
        nickName: userInfo.userInfo.nickName,
        avatarUrl: userInfo.userInfo.avatarUrl
      })

      wx.showToast({ title: '登录成功', icon: 'success' })
      this.setData({ showLoginModal: false, isLoginLoading: false })
      this.checkFavorite()
    } catch (err) {
      console.error('登录流程异常:', err)
      this.setData({ 
        modalError: err.message || '登录异常',
        isLoginLoading: false 
      })
    }
  },

  onLoad(options) {
    // 🔥 合并 initNavBar + syncTheme + getIconSet → 1 次 setData（减少 2 次调用）
    this._initViewData()
    this.handleThemeChange = this.handleThemeChange.bind(this)
    wx.onThemeChange(this.handleThemeChange)
    // 使用通用广告管理器初始化插屏广告
    interstitialAdManager.initInterstitialAd('/subpackages/preview/preview')
    // 加载页面广告配置（底部）
    this.loadPageAds()

    const { url, isAvatar, currentIndex, imageList: listParam, avatarData, id, rawUrl } = options

    // 🔥 P0 性能优化：优先用 url 立即渲染顶部图片（复用前一页图片，避免白屏等待接口）
    // 仅当无 url 时（纯分享/扫码入口）才走 _loadResourceById 等接口返回
    if (!url && id && !avatarData) {
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
        rawUrl: rawUrl ? safeDecodeURIComponent(rawUrl) : '',
        isCircular: isAvatar === 'false' ? false : true,
        imageLoaded: true,
        loadedImages: {}
      })
      this._prepareShareImageUrl(mainList[index])

      // 设置当前头像的完整数据
      let itemsList = new Array(rawImageList.length).fill(null);
      let parsedAvatarData = null;

      if (avatarData) {
        try {
          const decodedAvatarData = safeDecodeURIComponent(avatarData)
          parsedAvatarData = JSON.parse(decodedAvatarData)

          const currentUrl = parsedAvatarData.url || parsedAvatarData.imageUrl || ''
          const stats = this._formatResourceStats(parsedAvatarData)

          this.setData({
            currentAvatar: parsedAvatarData,
            viewCount: stats.viewCount,
            viewCountText: this._formatCount(stats.viewCount),
            downloadCount: stats.downloadCount,
            downloadCountText: this._formatCount(stats.downloadCount),
            hotScore: stats.hotScore,
            hotScoreText: this._formatCount(stats.hotScore)
          })
          itemsList[index] = parsedAvatarData;

          // 🔥 P1-4 recordBrowseHistory 延迟到 3 秒后，避免与首屏图片下载竞争带宽
          if (this._browseTimer) clearTimeout(this._browseTimer)
          this._browseTimer = setTimeout(() => {
            if (parsedAvatarData && parsedAvatarData._id) {
              recordBrowseHistory(parsedAvatarData)
            }
          }, 3000)
        } catch (e) {
          console.error('解析头像数据失败:', e)
        }
      }

      // 🔥 合并 itemsList + tagList → 1 次 setData（减少 1 次调用）
      this.setData({ itemsList, tagList: this.getAvatarTagList() });

      // 如果当前项没有数据，或者数据中没有标签（例如从收藏/下载列表进入），尝试获取完整信息
      // 🔥 P0 性能优化：有 id 时优先用 id 拉取（比 url 匹配更准确，且能跳过图片重置避免闪烁）
      if ((!parsedAvatarData || !parsedAvatarData.tags || parsedAvatarData.tags.length === 0) && rawImageList[index]) {
        if (id) {
          this._loadResourceById(safeDecodeURIComponent(id), { skipImageRender: true })
        } else {
          this.fetchAvatarInfo(rawImageList[index], index);
        }
      }

      // 🔥 [方案 C] 立即合并相似推荐到主 swiper
      this._prefetchAndMergeSimilar()

      // 🔥 P1-1 loadFavorites 只调用 1 次（checkFavorite 在 loadFavorites 回调内自动调用）
      this.loadFavorites()
    } else {
      // 🔥 [方案 C] url 缺失时也立即合并相似推荐
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
        // 仅在未渲染图片时才提示并返回（避免覆盖已渲染的图片）
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
        // 🔥 [预览页优化] 分级加载
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
          isCircular: true,
          imageLoaded: true,
          loadedImages: {},
          rawUrl: safeDecodeURIComponent(item.originUrl || '')
        })
      }

      const stats = this._formatResourceStats(item)
      this.setData({
        currentAvatar: item,
        itemsList: [item],
        tagList: this.getAvatarTagList(item),
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
        console.log('[热度记录] ⏱ preview.js 3秒定时器触发, item._id:', item?._id, 'skipImageRender:', opts.skipImageRender)
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

  async loadPageAds() {
    try {
      const pages = getCurrentPages()
      const current = pages && pages.length ? pages[pages.length - 1] : null
      const route = current?.route || 'subpackages/preview/preview'
      const list = await fetchPageAds(route.startsWith('/') ? route : '/' + route)
      // 兼容两种类型：native_bottom 或 native_video（bottom位置）
      const nativeBottom = pickByType(list, 'native_bottom')[0] || null
      const bottomNativeVideo = (list || []).find(it => it.type === 'native_video' && (it.position === 'bottom' || !it.position) && it.isEnable) || null
      const chosenBottom = nativeBottom || bottomNativeVideo
      if (chosenBottom) {
        this.setData({ bottomNativeVideoAd: chosenBottom })
      }
    } catch (e) {
      console.error('[preview] 加载底部广告失败:', e)
    }
  },

  // 获取当前头像的标签列表
  getAvatarTagList(item) {
    const currentAvatar = item || this.data.currentAvatar || {}
    let rawTags = currentAvatar.tags || []
    let categories = currentAvatar.categories || []

    // 合并标签和分类
    let tags = []

    // 添加分类
    if (Array.isArray(categories)) {
      categories.forEach(cat => {
        if (typeof cat === 'string') tags.push(cat)
        else if (cat && cat.name) tags.push(cat.name)
      })
    } else if (typeof categories === 'string') {
       tags.push(categories)
    }

    // 添加标签
    if (typeof rawTags === 'string') {
      tags = tags.concat(rawTags.split(/[,，]/))
    } else if (Array.isArray(rawTags)) {
      rawTags.forEach(tag => {
        if (typeof tag === 'string') {
          tags = tags.concat(tag.split(/[,，]/))
        } else {
          tags.push(String(tag))
        }
      })
    }

    // 去除空白和空项，以及重复项
    tags = [...new Set(tags.map(t => t.trim()).filter(t => t))]

    const colors = ['primary', 'secondary', 'blue', 'orange', 'purple', 'teal']

    return tags.map((tag, index) => ({
      label: tag,
      type: colors[index % colors.length]
    }))
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

  onTouchStart() { this.onTouchStartCommon() },
  onTouchEnd() { this.onTouchEndCommon() },

  async onSwiperChange(e) {
    const index = e.detail.current

    // 更新当前数据对象
    const currentItem = this.data.itemsList[index];

    // Check if we need to fetch data:
    // 1. Item doesn't exist
    // 2. Item exists but has no tags (and we expect tags)
    const needsFetch = !currentItem || (!currentItem.tags || currentItem.tags.length === 0);

    // 🔥 [预览页优化] 升级为 main：滑动到新索引时，把"邻居图"位置替换为主图
    const rawList = this.data.rawImageList || this.data.imageList
    const mainSize = getPreviewMainSize()
    const newMainUrl = processPreviewUrl(rawList[index], mainSize)
    const imageList = [...this.data.imageList]
    imageList[index] = newMainUrl

    // 🔥 合并 stats 数据 + navigation 数据 → 1 次 setData（减少 1 次调用）
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
      Object.assign(patch, {
        currentAvatar: currentItem,
        viewCount: stats.viewCount,
        viewCountText: this._formatCount(stats.viewCount),
        downloadCount: stats.downloadCount,
        downloadCountText: this._formatCount(stats.downloadCount),
        hotScore: stats.hotScore,
        hotScoreText: this._formatCount(stats.hotScore),
        tagList: this.getAvatarTagList()
      })

      if (this.browseTimer) clearTimeout(this.browseTimer)
      this.browseTimer = setTimeout(() => {
        if (currentItem && currentItem._id) {
          recordBrowseHistory(currentItem)
        }
      }, 1000)
    } else {
      Object.assign(patch, {
        tagList: [],
        currentAvatar: {},
        viewCount: 0,
        viewCountText: '0',
        downloadCount: 0,
        downloadCountText: '0',
        hotScore: 0,
        hotScoreText: '0'
      })
    }

    this.setData(patch)
    this.checkFavorite()

    if (needsFetch) {
      const currentUrl = rawList[index];
      if (currentUrl) {
        this.fetchAvatarInfo(currentUrl, index);
      }
    }

    if (this.hideTimer) {
      clearTimeout(this.hideTimer)
    }
    this.hideTimer = setTimeout(() => {
      this.setData({ showPageIndicator: false })
    }, 2000)

    // 🔥 P0-1 插屏广告：滑动 2 次后触发，不再每次滑动都触发
    this._swiperChangeCount = (this._swiperChangeCount || 0) + 1
    if (this._swiperChangeCount === 2 && !this._hasTriggeredInterstitial) {
      this._hasTriggeredInterstitial = true
      interstitialAdManager.smartTriggerInterstitialAd(500)
    }
  },

  async fetchAvatarInfo(url, index) {
    if (!url) return;

    try {
      const item = await findResourceByUrl(url);

      if (this.data._isHiding) {
        return
      }

      if (item) {
        const itemsList = this.data.itemsList;
        itemsList[index] = item;

        if (this.data.currentIndex === index) {
           // 🔥 计算互动数据
           const itemUrl = item.url || item.coverUrl || ''
           const stats = this._formatResourceStats(item)

           // 再次检查页面状态
           if (this.data._isHiding) {
             return
           }

           this.setData({
             itemsList,
             currentAvatar: item,
             tagList: this.getAvatarTagList(item),
             viewCount: stats.viewCount,
             viewCountText: this._formatCount(stats.viewCount),
             downloadCount: stats.downloadCount,
             downloadCountText: this._formatCount(stats.downloadCount),
             hotScore: stats.hotScore,
             hotScoreText: this._formatCount(stats.hotScore)
           });

           // 🔥 P1-3 不再二次调用 buildSimilarList（onLoad 已加载，tags 变化由 onSwiperChange 处理）
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
      console.error('Fetch avatar info failed', err);
    }
  },

  toggleShape() {
    this.setData({
      isCircular: !this.data.isCircular
    })
  },

  async ensureResourceId() {
    const { currentAvatar, currentUrl, currentIndex } = this.data
    if (currentAvatar && currentAvatar._id) {
      return currentAvatar._id
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
            currentAvatar: item,
            tagList: this.getAvatarTagList(item),
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

  onTagTap(e) {
    const tag = e.currentTarget.dataset.tag
    if (!tag) return
    wx.navigateTo({
      url: `/subpackages/search/search?type=avatar&tag=${encodeURIComponent(tag)}`
    })
  },

  /**
   * 🔥 [方案 C] 进入预览页时立即把相似推荐合并到主 swiper
   * 用户在主预览大图左右滑动就能看到相似推荐
   */
  _prefetchAndMergeSimilar() {
    this.buildSimilarList().then(similarList => {
      if (this.data._isHiding) return
      if (!similarList || similarList.length === 0) {
        this.setData({ similarList: [] })
        return
      }

      this.setData({ similarList })

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
    }).catch(err => {
      console.error('[preview] 预取相似推荐失败:', err)
    })
  },

  onRecommendTap(e) {
    const url = e.currentTarget.dataset.url

    // 🔥 [预览页优化] 在 rawImageList 中查找（原始 URL，未缩放），避免和缩略图字符串匹配不上
    const rawList = this.data.rawImageList || this.data.imageList
    const index = rawList.indexOf(url) !== -1
      ? rawList.indexOf(url)
      : this.data.imageList.indexOf(url) // 兜底：兼容旧数据

    if (index !== -1) {
      // 找到对应项并更新互动数据
      const itemsList = this.data.itemsList
      const currentItem = itemsList[index]

      // 🔥 [预览页优化] 用 main 尺寸 URL（切到时要升级为主图清晰度）
      const mainSize = getPreviewMainSize()
      const newMainUrl = processPreviewUrl(rawList[index] || url, mainSize)
      const newImageList = [...this.data.imageList]
      newImageList[index] = newMainUrl

      if (currentItem) {
        const itemUrl = currentItem.url || currentItem.coverUrl || ''
        const stats = this._formatResourceStats(currentItem)

        this.setData({
          currentIndex: index,
          currentUrl: newMainUrl,
          imageList: newImageList,
          currentAvatar: currentItem,
          viewCount: stats.viewCount,
          viewCountText: this._formatCount(stats.viewCount),
          downloadCount: stats.downloadCount,
          downloadCountText: this._formatCount(stats.downloadCount),
          hotScore: stats.hotScore,
          hotScoreText: this._formatCount(stats.hotScore),
          tagList: this.getAvatarTagList(currentItem)
        })
      } else {
        this.setData({ currentIndex: index, currentUrl: newMainUrl, imageList: newImageList })
      }

      // 滚动到顶部
      wx.pageScrollTo({ scrollTop: 0, duration: 300 })
    } else {
      const newRawList = [...rawList, url]
      const newImageList = [...this.data.imageList]
      const newNeighborList = [...(this.data.neighborList || [])]
      const mainSize = getPreviewMainSize()
      const neighborSize = getPreviewNeighborSize()
      const newMainUrl = processPreviewUrl(url, mainSize)
      const newNeighborUrl = processPreviewUrl(url, neighborSize)
      newImageList.push(newMainUrl)
      newNeighborList.push(newNeighborUrl)

      // 构建新项的数据
      const similarItem = this.data.similarList.find(item => item.url === url)
      const newItem = similarItem || { url: url, coverUrl: url }
      const newItemsList = [...this.data.itemsList]
      newItemsList.push(newItem)

      if (newItem) {
        const itemUrl = newItem.url || newItem.coverUrl || ''
        const stats = this._formatResourceStats(newItem)

        this.setData({
          rawImageList: newRawList,
          imageList: newImageList,
          neighborList: newNeighborList,
          currentUrl: newMainUrl,
          itemsList: newItemsList,
          currentAvatar: newItem,
          viewCount: stats.viewCount,
          viewCountText: this._formatCount(stats.viewCount),
          downloadCount: stats.downloadCount,
          downloadCountText: this._formatCount(stats.downloadCount),
          hotScore: stats.hotScore,
          hotScoreText: this._formatCount(stats.hotScore),
          tagList: newItem.tags ? this.getAvatarTagList(newItem) : this.data.tagList
        })
      } else {
        this.setData({
          rawImageList: newRawList,
          imageList: newImageList,
          neighborList: newNeighborList,
          currentUrl: newMainUrl,
          itemsList: newItemsList
        })
      }
      this._prepareShareImageUrl(newMainUrl)
      // 滚动到顶部
      wx.pageScrollTo({ scrollTop: 0, duration: 300 })
    }
    this.checkFavorite()
  },

  onShareAppMessage() {
    const { recordShareReward } = require('../../utils/shareReward.js')
    setTimeout(() => recordShareReward(), 500)
    const { currentUrl, currentIndex, imageList, isAvatar, currentAvatar } = this.data

    // 🔥 生成更好的分享标题
    let title = '发现了一个超好看的头像'
    if (currentAvatar) {
      const categories = currentAvatar.categories || []
      const tags = currentAvatar.tags || []
      const firstTag = categories[0] || tags[0] || ''
      if (firstTag) {
        title = `${firstTag}头像 | 小辣椒壁纸`
      } else if (currentAvatar.title && !currentAvatar.title.includes('.')) {
        title = currentAvatar.title
      }
    }

    // 🔥 分享路径带上资源 ID，好友打开可直接定位到对应头像
    // 先解码再编码，防止 currentUrl 本身已编码导致双重编码
    const resourceId = currentAvatar?._id || currentAvatar?.id || ''
    const shareUrl = safeDecodeURIComponent(currentUrl)
    let path = `/subpackages/preview/preview?url=${encodeURIComponent(shareUrl)}&isAvatar=${isAvatar}&currentIndex=${currentIndex}`
    if (resourceId) {
      path += `&id=${resourceId}`
    }

    return {
      title: title,
      path: path,
      imageUrl: this.data.shareImageUrl || currentUrl
    }
  },

  onShareTimeline() {
    const { currentUrl, currentAvatar, shareImageUrl } = this.data
    const categories = currentAvatar?.categories || []
    const tags = currentAvatar?.tags || []
    const firstTag = categories[0] || tags[0] || ''
    let title = '小辣椒头像壁纸 | 精美头像免费下载'
    if (firstTag) {
      title = `${firstTag}头像 | 小辣椒壁纸`
    }
    const resourceId = currentAvatar?._id || currentAvatar?.id || ''
    const shareUrl = safeDecodeURIComponent(currentUrl)
    let query = `url=${encodeURIComponent(shareUrl)}&isAvatar=${this.data.isAvatar}`
    if (resourceId) query += `&id=${resourceId}`
    return {
      title: title,
      query: query,
      imageUrl: shareImageUrl || currentUrl
    }
  }
})

