import { getResources, getCategories, getPageSections, getResourceList } from '../../utils/api.js'
import { optimizeImageUrls, getOptimalThumbnailSize } from '../../utils/image.js'
import { cacheManager } from '../../utils/cache.js'
import { STORAGE_KEYS, CACHE_EXPIRE } from '../../config/constants.js'
import { performanceMonitor } from '../../utils/performance.js'
import logger from '../../utils/logger.js'
import { fetchPageAds, pickByType } from '../../utils/adUtil.js'
import interstitialAdManager from '../../utils/interstitialAdManager.js'
import { getWindowInfo, getStorage, getTheme } from '../../utils/storageManager'

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,

    currentTag: 'all',
    sortType: 'hot', // 默认按 hotScore 排序
    tagList: [],
    _allTags: [], // 所有标签（内部）
    tagsLoading: true,
    tagBatchSize: 30, // 首屏渲染标签数量
    wallpapers: [],
    page: 1,
    loading: true, // 🔥 优化：初始值为 true，显示骨架屏
    hasMore: true,
    skeletons: new Array(6).fill(0),
    showBackToTop: false,

    // 🔥 新增：动态布局支持
    sections: [],
    useDynamicLayout: false,
    isSectionMode: false,
    nativeTopAd: null,
    showNativeTopAd: false,
    midNativeVideoAd: null,
    bottomNativeVideoAd: null,
    showBottomNativeAd: false
  },
  
  _isLoadingData: false, // 🔥 防止重复请求



  async onLoad(options) {
    performanceMonitor.startPageLoad('壁纸页')
    
    // 🔥 合并初始化 + 缓存渲染 → 1 次 setData
    const info = getWindowInfo()
    const updates = {
      statusBarHeight: info.statusBarHeight || 20,
      navBarHeight: 44
    }
    
    // 优先尝试加载缓存（Stale-While-Revalidate 第一步）
    const cachedWallpapers = getStorage('wallpaper_list_cache')
    if (cachedWallpapers && cachedWallpapers.length > 0) {
      updates.wallpapers = cachedWallpapers
      updates.loading = false
      performanceMonitor.markMilestone('壁纸页', '缓存加载完成')
    }
    
    this.setData(updates)
    performanceMonitor.markMilestone('壁纸页', '初始化完成')
    
    // 处理路由参数
    if (options && (options.category || options.tag)) {
      this.setData({
        currentTag: options.tag || options.category
      })
    }
    
    // 🔥 并行加载非关键数据（不阻塞首屏）
    this.loadPageSections()
    this.loadNavTags()
    this.loadPageAds()
    
    // 🔥 加载壁纸数据（首屏关键路径）
    this.loadWallpapers()
    
    // 优化：使用 IntersectionObserver 替代 onPageScroll
    this._observer = wx.createIntersectionObserver(this)
    this._observer
      .relativeToViewport()
      .observe('.nav-holder', (res) => {
        const showBackToTop = res.intersectionRatio === 0
        if (showBackToTop !== this.data.showBackToTop) {
          this.setData({ showBackToTop })
        }
      })
    
    performanceMonitor.endPageLoad('壁纸页')
  },
  
  async loadPageAds() {
    try {
      const pages = getCurrentPages()
      const current = pages && pages.length ? pages[pages.length - 1] : null
      const route = current?.route || 'pages/wallpaper/wallpaper'
      const list = await fetchPageAds(route.startsWith('/') ? route : '/' + route)
      let nativeTop = pickByType(list, 'native_top')[0] || null
      if (!nativeTop) {
        const topNativeVideo = (list || []).find(it => it.type === 'native_video' && it.position === 'top' && it.isEnable)
        if (topNativeVideo) nativeTop = topNativeVideo
      }
      if (nativeTop) this.setData({ nativeTopAd: nativeTop })
      const midNativeVideo = (list || []).find(it => it.type === 'native_video' && it.position === 'middle' && it.isEnable)
      const nativeBottom = pickByType(list, 'native_bottom')[0] || null
      const bottomNativeVideo = (list || []).find(it => it.type === 'native_video' && (it.position === 'bottom' || !it.position) && it.isEnable)
      const chosenBottom = nativeBottom || bottomNativeVideo
      if (midNativeVideo) this.setData({ midNativeVideoAd: midNativeVideo })
      if (chosenBottom) this.setData({ bottomNativeVideoAd: chosenBottom })
    } catch (e) {}
  },
  
  

  onPageScroll(e) {
    const ad = this.data.nativeTopAd
    const threshold = (ad && ad.scrollThreshold) || 200
    const shouldShow = e.scrollTop >= threshold
    if (shouldShow !== this.data.showNativeTopAd) {
      this.setData({ showNativeTopAd: shouldShow })
    }
  },

  onNativeAdError() {
    if (this.data.showNativeTopAd) {
      this.setData({ showNativeTopAd: false })
    }
  },

  // 🔥 新增：加载页面板块配置
  async loadPageSections() {
    if (this._isLoadingData) return
    
    try {
      // 🔥 优先尝试从缓存读取
      const cachedSections = cacheManager.get(STORAGE_KEYS.WALLPAPER_SECTIONS_CACHE)
      if (cachedSections && cachedSections.length > 0) {
        this.setData({
          sections: cachedSections,
          isSectionMode: true,
          useDynamicLayout: true,
          loading: false
        })
        return
      }
      
      const res = await getPageSections('wallpaper')
      
      if (res.result && res.result.success && res.result.data && res.result.data.length > 0) {
        const sections = res.result.data
        
        // 处理板块数据
        const processedSections = await this.processSections(sections)
        
        this.setData({
          sections: processedSections,
          isSectionMode: true,
          useDynamicLayout: true,
          loading: false
        })
        
        // 缓存板块配置
        cacheManager.set(STORAGE_KEYS.WALLPAPER_SECTIONS_CACHE, processedSections, CACHE_EXPIRE.LONG)
        return
      }
    } catch (err) {
      console.error('加载壁纸页面板块失败:', err)
    }
    
    // 配置加载失败，使用默认模式
    this.setData({
      isSectionMode: false,
      useDynamicLayout: false
    })
  },

  // 处理板块数据
  async processSections(sections) {
    const thumbSize = getOptimalThumbnailSize()
    
    return sections.map(section => {
      const processed = {
        ...section,
        items: []
      }
      
      if (section.items && section.items.length > 0) {
        const optimizedItems = optimizeImageUrls(section.items, 'coverUrl', thumbSize)
        
        processed.items = optimizedItems.map(item => ({
          ...item,
          id: item._id,
          url: item.optimizedUrl || item.coverUrl || item.url,
          originalUrl: item.originUrl || item.originalUrl || item.url,
          resourceType: 'wallpaper'
        }))
        
        // 预处理瀑布流列
        if (section.type === 'waterfall') {
          const leftColumn = []
          const rightColumn = []
          processed.items.forEach((item, index) => {
            if (index % 2 === 0) leftColumn.push(item)
            else rightColumn.push(item)
          })
          processed.leftColumn = leftColumn
          processed.rightColumn = rightColumn
        }
      }
      
      return processed
    })
  },

  // 🔥 新增：板块"更多"点击处理
  onSectionMore(e) {
    const section = e.currentTarget.dataset.section
    if (!section || !section.queryConfig) return
    
    const { resourceType, category, tag, sortField } = section.queryConfig
    
    // 跳转到资源列表页面
    const params = []
    if (resourceType) params.push(`type=${resourceType}`)
    if (category) params.push(`category=${encodeURIComponent(category)}`)
    if (tag) params.push(`tag=${encodeURIComponent(tag)}`)
    if (sortField) params.push(`sort=${sortField}`)
    
    const url = `/subpackages/resource-list/resource-list?${params.join('&')}`
    wx.navigateTo({ url })
  },

  onUnload() {
    if (this._observer) this._observer.disconnect()
  },

  onShow() {
    getApp().logEvent('pv', { page: 'wallpaper' })
    this.syncTheme()
    // 页面显示时智能触发插屏广告（带冷却时间检查）
    interstitialAdManager.smartTriggerInterstitialAd(2000)
  },

  syncTheme() {
    const theme = getTheme()
    this.setData({ theme })
  },

  async loadNavTags() {
    try {
      // 🔥 优先从缓存读取标签
      const cachedTags = getStorage('wallpaper_tags_cache')
      if (cachedTags && cachedTags.length > 0) {
        const batchSize = this.data.tagBatchSize || 30
        this.setData({
          tagList: cachedTags.slice(0, batchSize),
          _allTags: cachedTags,
          tagsLoading: false
        })
        return
      }
      
      const res = await getCategories({ type: 'wallpaper', source: 'tags' })
      
      if (res.result.success) {
        const allTags = res.result.data.filter(t => t.id !== 'all' && t.name !== '全部')
        const batchSize = this.data.tagBatchSize || 30
        
        // 🔥 缓存标签数据
        cacheManager.set('wallpaper_tags_cache', allTags, CACHE_EXPIRE.LONG)
        
        this.setData({
          tagList: allTags.slice(0, batchSize),
          _allTags: allTags,
          tagsLoading: false
        })
      } else {
        this.setData({ tagsLoading: false })
      }
    } catch (error) {
      console.error('加载标签失败:', error)
      this.setData({ tagsLoading: false })
    }
  },
  
  // 滚动加载更多标签
  onTagScrollToLower() {
    const allTags = this.data._allTags
    const currentLen = this.data.tagList.length
    if (currentLen >= allTags.length) return // 已全部加载
    
    const batchSize = this.data.tagBatchSize || 30
    const nextBatch = allTags.slice(currentLen, currentLen + batchSize)
    if (nextBatch.length > 0) {
      this.setData({
        tagList: [...this.data.tagList, ...nextBatch]
      })
    }
  },

  openCategoryPanel() {
    this.setData({ showCategoryPanel: true })
  },

  closeCategoryPanel() {
    this.setData({ showCategoryPanel: false })
  },

  noop() {},

  onTagChange(e) {
    const tag = e.currentTarget.dataset.tag
    if (tag === this.data.currentTag) return
    
    // 埋点统计
    getApp().logEvent('category_click', {
      type: 'wallpaper',
      tag: tag
    })

    this.setData({
      currentTag: tag,
      wallpapers: [],
      page: 1,
      hasMore: true,
      showCategoryPanel: false // 选择后关闭弹窗
    }, () => {
      this.loadWallpapers()
    })
  },


  onSortChange(e) {
    const sortType = e.currentTarget.dataset.type
    if (sortType === this.data.sortType) return
    
    this.setData({
      sortType: sortType,
      wallpapers: [],
      page: 1,
      hasMore: true
    })
    this.loadWallpapers()
  },

  initNavBar() {
    // 🔥 优化：使用全局缓存的窗口信息，避免重复调用 wx.getWindowInfo
    const info = getWindowInfo()
    const statusBarHeight = info.statusBarHeight || 20
    const navBarHeight = 44 // Fixed 44px
    this.setData({ statusBarHeight, navBarHeight })
  },

  async loadWallpapers() {
    // 🔥 防止重复请求
    if (this._isLoadingData || !this.data.hasMore) return
    this._isLoadingData = true
    
    // 如果是第一页且无缓存，显示加载状态
    if (this.data.page === 1 && this.data.wallpapers.length === 0) {
      this.setData({ loading: true })
    }
    
    try {
      const currentTag = this.data.currentTag
      const params = {
        type: 'wallpaper',
        page: this.data.page,
        pageSize: 12,
        sort: this.data.sortType
      }
      
      if (currentTag !== 'all') {
        params.tag = currentTag
      }
      
      const res = await getResources(params)
      
      if (res.result.success) {
        const newWallpapers = (res.result.data || []).map((item) => ({
          id: item.id,
          url: item.coverUrl,
          originalUrl: item.originUrl,
          rawUrl: item.coverUrl,
          rawOriginalUrl: item.originUrl,
          title: item.title,
          categories: item.categories,
          tags: item.tags
        }))
        
        const nextPage = this.data.page + 1
        const hasMore = res.result.data.length === 12
        
        // 🔥 合并所有数据更新 → 1 次 setData
        const dataUpdate = {
          page: nextPage,
          loading: false,
          hasMore
        }
        
        if (this.data.page === 1) {
          dataUpdate.wallpapers = newWallpapers
        } else {
          dataUpdate.wallpapers = [...this.data.wallpapers, ...newWallpapers]
        }
        
        this.setData(dataUpdate, () => {
          this._isLoadingData = false
          wx.stopPullDownRefresh()
          
          if (params.page === 1) {
            const pageLoadTime = performanceMonitor.getPageLoadTime('壁纸页')
            if (pageLoadTime) {
              logger.logPerformance('page_load', {
                loadTime: pageLoadTime,
                wallpaperCount: newWallpapers.length
              }, 'pages/wallpaper/wallpaper')
            }
            
            logger.logPageView('pages/wallpaper/wallpaper')
            
            // 🔥 缓存第一页数据（带 TTL）
            if (params.tag === 'all' || params.tag === undefined) {
              cacheManager.set('wallpaper_list_cache', newWallpapers, CACHE_EXPIRE.MEDIUM)
            }
          }
        })
      } else {
        if (this.data.page === 1 && this.data.wallpapers.length === 0) {
          const cached = getStorage('wallpaper_list_cache')
          if (cached) {
            this.setData({ wallpapers: cached, loading: false })
            this._isLoadingData = false
            wx.showToast({ title: '已为您展示离线内容', icon: 'none' })
            return
          }
        }
        this.setData({ loading: false, hasMore: false }, () => {
          this._isLoadingData = false
          wx.stopPullDownRefresh()
          wx.showToast({ title: '加载失败', icon: 'none' })
        })
      }
      
    } catch (error) {
      console.error('加载壁纸失败:', error)
      if (this.data.page === 1 && this.data.wallpapers.length === 0) {
        const cached = getStorage('wallpaper_list_cache')
        if (cached) {
          this.setData({ wallpapers: cached, loading: false })
          this._isLoadingData = false
          wx.showToast({ title: '网络不可用，已为您展示离线内容', icon: 'none' })
          return
        }
      }
      this.setData({ loading: false, hasMore: false }, () => {
        this._isLoadingData = false
        wx.stopPullDownRefresh()
        wx.showToast({ title: '加载失败', icon: 'none' })
      })
    }
  },

  onPullDownRefresh() {
    this.setData({
      wallpapers: [],
      page: 1,
      hasMore: true
    }, () => {
      this.loadWallpapers()
    })
  },

  handleRetry() {
    this.setData({
      wallpapers: [],
      page: 1,
      hasMore: true
    }, () => {
      this.loadWallpapers()
    })
  },

  // 移除不再需要的 resolveUrl 方法
  // async resolveUrl(value) { ... },





  previewImage(e) {
    const item = e.currentTarget.dataset
    this._previewImage(item)
  },

  onWaterfallItemTap(e) {
    const { item } = e.detail
    this._previewImage(item)
  },

  _previewImage(item) {
    const currentUrl = item.originalUrl || item.url
    const currentRawUrl = item.rawOriginalUrl || item.rawUrl
    const list = this.data.wallpapers
    
    // 从 wallpapers 数组中找到完整的 item 对象（包含 _id）
    let fullItem = list.find(i => (i.originalUrl || i.url) === currentUrl)
    fullItem = fullItem || item
    
    const currentIndex = list.findIndex(i => (i.originalUrl || i.url) === currentUrl)
    const imageList = list.map(i => i.originalUrl || i.url)

    wx.navigateTo({
      url: `/subpackages/wallpaper-preview/wallpaper-preview?url=${encodeURIComponent(currentUrl)}&rawUrl=${encodeURIComponent(currentRawUrl || '')}&currentIndex=${currentIndex}&imageList=${encodeURIComponent(JSON.stringify(imageList))}&wallpaperData=${encodeURIComponent(JSON.stringify(fullItem))}`
    })
  },

  onReachBottom() {
    this.loadWallpapers()
  },

  scrollToTop() {
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 300
    })
  },

  navigateToSearch() {
    wx.navigateTo({
      url: '/subpackages/search/search?type=wallpaper'
    })
  },

  onShareAppMessage() {
    return {
      title: '小辣椒动态头像壁纸，海量精美壁纸免费下载！',
      path: '/pages/wallpaper/wallpaper',
      imageUrl: ''
    }
  },

  onShareTimeline() {
    return {
      title: '小辣椒动态头像壁纸，海量精美壁纸免费下载！',
      query: '',
      imageUrl: ''
    }
  }
})
