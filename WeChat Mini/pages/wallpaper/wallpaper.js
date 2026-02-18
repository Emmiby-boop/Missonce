import { getResources, getCategories, getPageSections, getResourceList } from '../../utils/api.js'
import { optimizeImageUrls, getOptimalThumbnailSize } from '../../utils/image.js'
import { cacheManager } from '../../utils/cache.js'
import { STORAGE_KEYS, CACHE_EXPIRE } from '../../config/constants.js'
import { performanceMonitor } from '../../utils/performance.js'

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,

    currentTag: 'all',
    sortType: 'hot', // 默认按 hotScore 排序
    tagList: [],
    tagsLoading: true,
    wallpapers: [],
    page: 1,
    loading: true, // 🔥 优化：初始值为 true，显示骨架屏
    hasMore: true,
    skeletons: new Array(6).fill(0),
    showBackToTop: false,

    // 🔥 新增：动态布局支持
    sections: [],
    useDynamicLayout: false,
    isSectionMode: false
  },
  
  _isLoadingData: false, // 🔥 防止重复请求



  async onLoad(options) {
    performanceMonitor.startPageLoad('壁纸页')
    this.initNavBar()
    performanceMonitor.markMilestone('壁纸页', '初始化完成')
    
    // 1. 优先尝试加载缓存
    const cachedWallpapers = wx.getStorageSync('wallpaper_list_cache')
    if (cachedWallpapers) {
      this.setData({ wallpapers: cachedWallpapers })
      performanceMonitor.markMilestone('壁纸页', '缓存加载完成')
    }

    // 🔥 优化：板块加载改为后台异步，不阻塞页面
    performanceMonitor.markMilestone('壁纸页', '开始加载板块')
    this.loadPageSections()

    // 🔥 优化：同时启动默认布局加载，不等待板块
    this.loadNavTags()
    if (options) {
      const { category, tag } = options
      const updates = {}
      if (category || tag) updates.currentTag = tag || category
      if (Object.keys(updates).length) {
        this.setData(updates, () => this.loadWallpapers())
      } else {
        this.loadWallpapers()
      }
    } else {
      this.loadWallpapers()
    }

    // 优化：使用 IntersectionObserver 替代 onPageScroll
    this._observer = wx.createIntersectionObserver(this)
    this._observer
      .relativeToViewport()
      .observe('.nav-holder', (res) => {
        // 当顶部占位元素离开视口时（即向下滚动了），显示回到顶部按钮
        const showBackToTop = res.intersectionRatio === 0
        if (showBackToTop !== this.data.showBackToTop) {
          this.setData({ showBackToTop })
        }
      })
    performanceMonitor.endPageLoad('壁纸页')
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
          originalUrl: item.originUrl || item.originalUrl || item.url
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
  },

  syncTheme() {
    const theme = wx.getAppBaseInfo().theme || 'light'
    this.setData({ theme })
  },

  async loadNavTags() {
    try {
      const res = await getCategories({ type: 'wallpaper', source: 'tags' })
      
      if (res.result.success) {
        // 过滤掉 'all' 或 '全部'，避免重复
        const tags = res.result.data.filter(t => t.id !== 'all' && t.name !== '全部')

        this.setData({
          tagList: tags,
          // navTagList: tags.slice(0, 10), // 不再截断
          tagsLoading: false
        })
        // console.log('成功从资源库实时加载壁纸标签:', res.result.data)
      } else {
        this.setData({ tagsLoading: false })
      }
    } catch (error) {
      console.error('加载标签失败:', error)
      this.setData({ tagsLoading: false })
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
    try {
      const info = wx.getWindowInfo()
      const statusBarHeight = info.statusBarHeight || 20
      const navBarHeight = 44 // Fixed 44px
      this.setData({ statusBarHeight, navBarHeight })

    } catch (e) {
      console.error('获取系统信息失败:', e)
    }
  },

  async loadWallpapers() {
    // 🔥 防止重复请求
    if (this._isLoadingData || !this.data.hasMore) return
    this._isLoadingData = true
    
    // 如果是第一页，显示加载状态
    if (this.data.page === 1) {
      this.setData({ loading: true })
    }
    
    try {
      const currentTag = this.data.currentTag
      // 构建查询参数
      const params = {
        type: 'wallpaper',
        page: this.data.page,
        pageSize: 12,
        sort: this.data.sortType
      }
      
      // 如果有标签筛选
      if (currentTag !== 'all') {
        params.tag = currentTag
      }
      
      const res = await getResources(params)
      
      if (res.result.success) {
        // 直接使用 cloudID，移除 resolveUrl 的耗时操作
        const newWallpapers = (res.result.data || []).map((item) => {
          return {
            id: item.id,
            url: item.coverUrl,
            originalUrl: item.originUrl,
            rawUrl: item.coverUrl,
            rawOriginalUrl: item.originUrl,
            title: item.title,
            categories: item.categories,
            tags: item.tags
          }
        })
        
        const nextPage = this.data.page + 1
        const hasMore = res.result.data.length === 12 // 如果返回的数据达到pageSize，说明还有更多
        
        const updatedWallpapers = this.data.page === 1 ? newWallpapers : [...this.data.wallpapers, ...newWallpapers]

        this.setData({
          wallpapers: updatedWallpapers,
          page: nextPage,
          loading: false,
          hasMore
        }, () => {
          this._isLoadingData = false
          wx.stopPullDownRefresh()
          // 缓存第一页数据
          if (params.page === 1 && params.tag === 'all') {
            wx.setStorageSync('wallpaper_list_cache', newWallpapers)
          }
        })
      } else {
        // 尝试使用缓存
        if (this.data.page === 1) {
          const cached = wx.getStorageSync('wallpaper_list_cache')
          if (cached) {
            this.setData({ wallpapers: cached, loading: false })
            this._isLoadingData = false
            wx.showToast({ title: '已为您展示离线内容', icon: 'none' })
            return
          }
        }
        this.setData({ 
          loading: false,
          hasMore: false 
        }, () => {
          this._isLoadingData = false
          wx.stopPullDownRefresh()
          wx.showToast({
            title: '加载失败',
            icon: 'none'
          })
        })
      }
      
    } catch (error) {
      console.error('加载壁纸失败:', error)
      // 尝试使用缓存
      if (this.data.page === 1) {
        const cached = wx.getStorageSync('wallpaper_list_cache')
        if (cached) {
          this.setData({ wallpapers: cached, loading: false })
          this._isLoadingData = false
          wx.showToast({ title: '网络不可用，已为您展示离线内容', icon: 'none' })
          return
        }
      }
      this.setData({ 
        loading: false,
        hasMore: false 
      }, () => {
        this._isLoadingData = false
        wx.stopPullDownRefresh()
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        })
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
  }
})
