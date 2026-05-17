import { fetchPageAds, pickByType } from '../../utils/adUtil.js'

const CACHE_KEY = 'quotes_cache'
const CACHE_EXPIRE = 15 * 60 * 1000 // 15分钟缓存

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
    keyword: '',
    page: 1,
    pageSize: 20,
    hasMore: true,
    total: 0,
    showTopAd: false,
    topAdClosed: false,
    bottomNativeVideoAd: null,
    showBottomNativeAd: false
  },

  _isLoading: false,

  onLoad() {
    this.initNavBar()
    // 先尝试从缓存渲染
    this.tryRenderFromCache()
    this.loadPageAds()
  },

  // 尝试从缓存快速渲染
  tryRenderFromCache() {
    const cacheKey = `${CACHE_KEY}_${this.data.currentCategory}`
    try {
      const cached = wx.getStorageSync(cacheKey)
      const now = Date.now()
      if (cached && cached.expire > now && cached.data && cached.data.length > 0) {
        this.setData({
          loading: false,
          quotes: cached.data,
          total: cached.total,
          hasMore: cached.data.length >= this.data.pageSize,
          page: cached.page || 1
        })
        console.log('[inspiration-writer] 使用缓存渲染')
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
      const info = wx.getWindowInfo()
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
    console.log('[inspiration-writer] loadQuotes 被调用, reset:', reset)
    
    if (this._isLoading) {
      console.log('[inspiration-writer] 正在加载中，跳过')
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
      console.log('[inspiration-writer] 没有更多数据，跳过')
      return
    }

    this._isLoading = true
    console.log('[inspiration-writer] 开始加载...')
    this.setData({ loading: true })

    try {
      console.log('[inspiration-writer] 准备调用 getQuotes 云函数')
      const res = await wx.cloud.callFunction({
        name: 'getQuotes',
        data: {
          page: this.data.page,
          pageSize: this.data.pageSize,
          category: this.data.currentCategory,
          keyword: this.data.keyword
        }
      })

      console.log('[inspiration-writer] 云函数返回结果:', res)

      if (res.result.success) {
        const newQuotes = res.result.data || []
        console.log('[inspiration-writer] 解析到的文案:', newQuotes)
        const quotes = reset ? newQuotes : [...this.data.quotes, ...newQuotes]
        this.setData({
          quotes,
          total: res.result.total,
          hasMore: newQuotes.length === this.data.pageSize,
          page: this.data.page + 1
        })

        // 缓存首页数据
        if (reset && newQuotes.length > 0) {
          const cacheKey = `${CACHE_KEY}_${this.data.currentCategory}`
          wx.setStorageSync(cacheKey, {
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
      console.log('[inspiration-writer] 加载完成, loading:', this.data.loading)
    }
  },

  onCategoryTap(e) {
    const category = e.currentTarget.dataset.category
    this.setData({ currentCategory: category }, () => {
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

  onPageScroll(e) {
    if (this.data.topAdClosed) return
    
    const scrollTop = e.scrollTop
    const shouldShow = scrollTop > 200
    
    if (shouldShow !== this.data.showTopAd) {
      this.setData({ showTopAd: shouldShow })
    }
  },

  closeTopAd() {
    this.setData({ 
      showTopAd: false,
      topAdClosed: true
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
    } catch (e) {}
  },
  
  onNativeAdError() {
    if (this.data.showBottomNativeAd) {
      this.setData({ showBottomNativeAd: false })
    }
  }
})
