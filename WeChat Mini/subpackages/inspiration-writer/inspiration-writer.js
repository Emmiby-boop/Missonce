import { fetchPageAds, pickByType, getListAdConfig } from '../../utils/adUtil.js'
import { getStorage, getWindowInfo, setStorage } from '../../utils/storageManager.js'

const CACHE_KEY = 'quotes_cache'
const CACHE_EXPIRE = 15 * 60 * 1000 // 15分钟缓存
const PAGE_PATH = '/subpackages/inspiration-writer/inspiration-writer'

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    loading: true,
    quotes: [],
    categories: [
      { id: '', name: '全部' },
      { id: '朋友圈', name: '朋友圈' },
      { id: '个性签名', name: '个性签名' },
      { id: '表白文案', name: '表白文案' },
      { id: '励志文案', name: '励志文案' },
      { id: '治愈文案', name: '治愈文案' },
      { id: '伤感文案', name: '伤感文案' },
      { id: '生日文案', name: '生日文案' },
      { id: '节日文案', name: '节日文案' }
    ],
    currentCategory: '',
    scrollIntoView: '',
    keyword: '',
    page: 1,
    pageSize: 20,
    hasMore: true,
    total: 0,
    showSearch: false,
    sections: [],
    adInterval: 0,
    adEnabled: false,
    bottomNativeVideoAd: null,
    showBottomNativeAd: false
  },

  _isLoading: false,

  onLoad() {
    this.initNavBar()
    this.loadListAdConfig()
    // 先尝试从缓存渲染
    this.tryRenderFromCache()
    this.loadPageAds()
  },

  // 加载后台 listAdConfig 广告间隔配置
  async loadListAdConfig() {
    try {
      const cfg = await getListAdConfig(PAGE_PATH, 0)
      this.setData({ adEnabled: cfg.enabled, adInterval: cfg.interval })
      this._rebuildSections()
    } catch (e) {
      console.warn('[inspiration-writer] 加载 listAdConfig 失败:', e)
    }
  },

  // 按广告间隔重建分段（与 resource-list 一致）
  _rebuildSections() {
    const list = this.data.quotes
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

  // 尝试从缓存快速渲染
  tryRenderFromCache() {
    const cacheKey = `${CACHE_KEY}_${this.data.currentCategory}`
    try {
      const cached = getStorage(cacheKey)
      const now = Date.now()
      if (cached && cached.expire > now && cached.data && cached.data.length > 0) {
        this.setData({
          loading: false,
          quotes: cached.data,
          total: cached.total,
          hasMore: cached.data.length >= this.data.pageSize,
          page: cached.page || 1
        }, () => this._rebuildSections())
        return
      }
    } catch (e) {
      console.warn('[inspiration-writer] 读取缓存失败:', e)
    }
    // 无缓存，加载新数据
    this.loadQuotes(true)
  },

  initNavBar() {
    try {
      const info = getWindowInfo()
      const statusBarHeight = info.statusBarHeight || 20
      const navBarHeight = 44
      this.setData({ statusBarHeight, navBarHeight })
    } catch (e) {
      console.error('获取系统信息失败:', e)
    }
  },

  navigateBack() {
    wx.navigateBack()
  },

  onToggleSearch() {
    this.setData({ showSearch: !this.data.showSearch })
  },

  onPullDownRefresh() {
    this.loadQuotes(true).then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    if (!this.data.showBottomNativeAd && this.data.bottomNativeVideoAd && this.data.bottomNativeVideoAd.adUnitId) {
      this.setData({ showBottomNativeAd: true })
    }
    this.loadQuotes()
  },

  async loadQuotes(reset = false) {

    if (this._isLoading) {
      return
    }

    if (reset) {
      this.setData({
        page: 1,
        quotes: [],
        hasMore: true
      })
    }

    if (!reset && !this.data.hasMore) {
      return
    }

    this._isLoading = true
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'getQuotes',
        data: {
          page: this.data.page,
          pageSize: this.data.pageSize,
          category: this.data.currentCategory,
          keyword: this.data.keyword
        }
      })

      if (res.result.success) {
        const newQuotes = res.result.data || []
        const quotes = reset ? newQuotes : [...this.data.quotes, ...newQuotes]
        this.setData({
          quotes,
          total: res.result.total,
          hasMore: newQuotes.length === this.data.pageSize,
          page: this.data.page + 1
        }, () => this._rebuildSections())

        // 缓存首页数据
        if (reset && newQuotes.length > 0) {
          const cacheKey = `${CACHE_KEY}_${this.data.currentCategory}`
          setStorage(cacheKey, {
            data: newQuotes,
            total: res.result.total,
            page: 2,
            expire: Date.now() + CACHE_EXPIRE
          })
        }
      } else {
        console.error('[inspiration-writer] 云函数返回失败:', res.result)
      }
    } catch (error) {
      console.error('[inspiration-writer] 加载文案失败:', error)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this._isLoading = false
      this.setData({ loading: false })
    }
  },

  onCategoryTap(e) {
    const category = e.currentTarget.dataset.category
    // 先清空再设置，确保 scroll-into-view 每次都能触发动画
    this.setData({ scrollIntoView: '' }, () => {
      this.setData({
        currentCategory: category,
        scrollIntoView: 'cat-' + category
      })
      this.loadQuotes(true)
    })
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  onSearch() {
    this.loadQuotes(true)
  },

  onQuoteTap(e) {
    const quote = e.currentTarget.dataset.quote
    wx.setClipboardData({
      data: quote.content,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' })
      }
    })
  },

  async loadPageAds() {
    try {
      const pages = getCurrentPages()
      const current = pages && pages.length ? pages[pages.length - 1] : null
      const route = current?.route || 'subpackages/inspiration-writer/inspiration-writer'
      const list = await fetchPageAds(route.startsWith('/') ? route : '/' + route)
      const nativeBottom = pickByType(list, 'native_bottom')[0] || null
      const bottomNativeVideo = (list || []).find(it => it.type === 'native_video' && (it.position === 'bottom' || !it.position) && it.isEnable) || null
      const chosenBottom = nativeBottom || bottomNativeVideo
      if (chosenBottom) this.setData({ bottomNativeVideoAd: chosenBottom })
    } catch (e) {
      console.error('[inspiration-writer] 加载底部广告失败:', e)
    }
  },

  onNativeAdError() {
    if (this.data.showBottomNativeAd) {
      this.setData({ showBottomNativeAd: false })
    }
  }
})
