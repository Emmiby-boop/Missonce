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
    avatars: [],
    page: 1,
    loading: true, // 🔥 优化：初始值为 true，显示骨架屏
    hasMore: true,
    skeletons: new Array(12).fill(0),
    showBackToTop: false,
    
    // 🔥 新增：动态布局支持
    sections: [],           // 板块配置
    useDynamicLayout: false, // 是否使用动态布局
    isSectionMode: false     // 是否为板块模式
  },
  
  _isLoadingData: false, // 🔥 防止重复请求


  async onLoad(options) {
    performanceMonitor.startPageLoad('头像页')
    // 初始化导航栏
    this.initNavBar()
    performanceMonitor.markMilestone('头像页', '初始化完成')
    
    // 1. 优先尝试加载缓存
    const cachedAvatars = wx.getStorageSync('avatar_list_cache')
    if (cachedAvatars) {
      this.setData({ avatars: cachedAvatars })
      performanceMonitor.markMilestone('头像页', '缓存加载完成')
    }

    // 🔥 优化：板块加载改为后台异步，不阻塞页面
    performanceMonitor.markMilestone('头像页', '开始加载板块')
    this.loadPageSections()

    // 🔥 优化：同时启动默认布局加载，不等待板块
    this.loadNavTags()
    if (options) {
      const { category, tag } = options
      const updates = {}
      if (category || tag) updates.currentTag = tag || category
      if (Object.keys(updates).length) {
        this.setData(updates, () => this.loadAvatars())
      } else {
        this.loadAvatars()
      }
    } else {
      this.loadAvatars()
    }

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
    performanceMonitor.endPageLoad('头像页')
  },

  // 🔥 新增：加载页面板块配置
  async loadPageSections() {
    if (this._isLoadingData) return
    
    try {
      // 🔥 优先尝试从缓存读取
      const cachedSections = cacheManager.get(STORAGE_KEYS.AVATAR_SECTIONS_CACHE)
      if (cachedSections && cachedSections.length > 0) {
        this.setData({
          sections: cachedSections,
          isSectionMode: true,
          useDynamicLayout: true,
          loading: false
        })
        return
      }
      
      const res = await getPageSections('avatar')
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
        cacheManager.set(STORAGE_KEYS.AVATAR_SECTIONS_CACHE, processedSections, CACHE_EXPIRE.LONG)
        return
      }
    } catch (err) {
      console.error('加载头像页面板块失败:', err)
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
    getApp().logEvent('pv', { page: 'avatar' })
    this.syncTheme()
  },

  syncTheme() {
    const theme = wx.getAppBaseInfo().theme || 'light'
    this.setData({ theme })
  },

  async loadNavTags() {
    try {
      // 直接从数据库所有图片的标签中实时读取展示
      const res = await getCategories({ type: 'avatar', source: 'tags' })
      if (res.result.success) {
        // 过滤掉 'all' 或 '全部'，避免重复
        const tags = res.result.data.filter(t => t.id !== 'all' && t.name !== '全部')
        
        this.setData({
          tagList: tags,
          // navTagList: tags.slice(0, 10), // 不再截断，横向滚动展示所有
          tagsLoading: false
        })
        // console.log('成功从资源库实时加载头像标签:', res.result.data)
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
      type: 'avatar',
      tag: tag
    })

    this.setData({
      currentTag: tag,
      avatars: [],
      page: 1,
      hasMore: true,
      showCategoryPanel: false // 选择后关闭弹窗
    }, () => {
      this.loadAvatars()
    })
  },


  onSortChange(e) {
    const sortType = e.currentTarget.dataset.type
    if (sortType === this.data.sortType) return
    
    this.setData({
      sortType: sortType,
      avatars: [],
      page: 1,
      hasMore: true
    })
    this.loadAvatars()
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

  loadAvatars() {
    // 🔥 防止重复请求
    if (this._isLoadingData || !this.data.hasMore) return
    this._isLoadingData = true
    
    // 如果是第一页，显示加载状态
    if (this.data.page === 1) {
      this.setData({ loading: true })
    }
    
    const sort = this.data.sortType
    const currentTag = this.data.currentTag
    
    const params = {
      type: 'avatar',
      page: this.data.page,
      pageSize: 12,
      sort: sort
    }

    if (currentTag !== 'all') {
      params.tag = currentTag
    }
    
    getResources(params).then(async (res) => {
      // console.log('getResources 返回:', res.result)
      // console.log('查询参数:', params)
      
      if (!res.result || !res.result.success) {
        console.error('getResources 请求失败:', res.result?.message)
        wx.showToast({
          title: '加载头像失败',
          icon: 'none'
        })
        this.setData({ loading: false })
        this._isLoadingData = false
        return
      }
      
      const newAvatars = res.result.data || []
      
      // 批量优化图片链接 (动态计算最佳宽度)
      const thumbSize = getOptimalThumbnailSize()
      const optimizedAvatars = await optimizeImageUrls(newAvatars, 'coverUrl', thumbSize)
      
      const processedAvatars = optimizedAvatars.map((item) => {
        return {
          ...item,
          url: item.optimizedUrl || item.coverUrl, // 优先使用优化后的链接
          originalUrl: item.originUrl,
          rawUrl: item.coverUrl,
          rawOriginalUrl: item.originUrl
        }
      })
      
      const nextPage = this.data.page + 1
      const hasMore = processedAvatars.length >= 12
      
      const updatedAvatars = this.data.page === 1 ? processedAvatars : [...this.data.avatars, ...processedAvatars]

      this.setData({
        avatars: updatedAvatars,
        page: nextPage,
        loading: false,
        hasMore
      }, () => {
        this._isLoadingData = false
        wx.stopPullDownRefresh()
        // 缓存第一页数据
        if (params.page === 1 && params.tag === undefined) {
          wx.setStorageSync('avatar_list_cache', processedAvatars)
        }
      })
    }).catch(error => {
      console.error('加载头像失败:', error)
      this.setData({
        loading: false
      })
      this._isLoadingData = false
      
      // 如果是第一页加载失败，尝试读取缓存
      if (this.data.page === 1) {
        const cached = wx.getStorageSync('avatar_list_cache')
        if (cached) {
          this.setData({ avatars: cached })
          wx.showToast({
            title: '网络不稳定，已为您展示缓存内容',
            icon: 'none'
          })
          return
        }
      }

      wx.showToast({
        title: '加载头像失败',
        icon: 'none'
      })
    })
  },

  onPullDownRefresh() {
    this.setData({
      avatars: [],
      page: 1,
      hasMore: true
    }, () => {
      this.loadAvatars()
    })
  },

  handleRetry() {
    this.setData({
      avatars: [],
      page: 1,
      hasMore: true
    }, () => {
      this.loadAvatars()
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

    // 从 avatars 数组中找到完整的 item 对象（包含 _id）
    let fullItem = this.data.avatars.find(i => (i.originalUrl || i.url) === currentUrl)
    
    // 如果在 sections 模式下，从 sections 中查找
    if (!fullItem && this.data.isSectionMode && this.data.sections) {
      for (const section of this.data.sections) {
        if (section.items) {
          fullItem = section.items.find(i => (i.originalUrl || i.url) === currentUrl)
          if (fullItem) break
        }
        if (section.leftColumn) {
          fullItem = section.leftColumn.find(i => (i.originalUrl || i.url) === currentUrl)
          if (fullItem) break
        }
        if (section.rightColumn) {
          fullItem = section.rightColumn.find(i => (i.originalUrl || i.url) === currentUrl)
          if (fullItem) break
        }
      }
    }
    
    // 如果找不到完整对象，使用传入的 item
    fullItem = fullItem || item

    // 查找当前图片在列表中的索引
    const currentIndex = this.data.avatars.findIndex(i => (i.originalUrl || i.url) === currentUrl)

    // 构建图片列表
    const imageList = this.data.avatars.map(i => i.originalUrl || i.url)

    // 跳转到自定义预览页面，传递图片列表、当前索引和完整资源数据
    wx.navigateTo({
      url: `/subpackages/preview/preview?url=${encodeURIComponent(currentUrl)}&rawUrl=${encodeURIComponent(currentRawUrl || '')}&isAvatar=true&currentIndex=${currentIndex}&imageList=${encodeURIComponent(JSON.stringify(imageList))}&avatarData=${encodeURIComponent(JSON.stringify(fullItem))}`
    })
  },

  onReachBottom() {
    this.loadAvatars()
  },

  scrollToTop() {
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 300
    })
  },

  navigateToSearch() {
    wx.navigateTo({
      url: '/subpackages/search/search?type=avatar'
    })
  }
})
