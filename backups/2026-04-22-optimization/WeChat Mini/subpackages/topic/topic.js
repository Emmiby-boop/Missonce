import { getResources } from '../../utils/api.js'
import { performanceMonitor } from '../../utils/performance.js'
import logger from '../../utils/logger.js'

Page({
  data: {
    id: '',
    title: '',
    cover: '',
    description: '',
    tag: '',
    category: '',
    type: 'all', // all, wallpaper, avatar
    layout: null,
    
    list: [],
    page: 1,
    pageSize: 15,
    loading: false,
    noMore: false,
    refreshing: false
  },

  async onLoad(options) {
    performanceMonitor.startPageLoad('专题详情')
    console.log('专题详情页加载，参数:', options)
    const { id, title, cover, description, tag, category, type, sort } = options
    performanceMonitor.markMilestone('专题详情', '参数解析完成')
    
    // 优先设置标题，提升用户感知速度
    if (title) {
      wx.setNavigationBarTitle({
        title: title
      })
    }
    
    // 如果传入了ID，优先从数据库获取专题详情
    if (id) {
      console.log('加载专题详情，ID:', id)
      // 并行加载：同时发起专题详情和资源列表请求
      await this.loadTopicDetailAndResources(id)
    } else {
      console.warn('没有传入专题ID')
      this.setData({
        id: id || '',
        title: title || '精选专题',
        cover: cover ? decodeURIComponent(cover) : '',
        description: description ? decodeURIComponent(description) : '',
        tag: tag || '',
        category: category || '',
        type: type || 'all',
        sort: sort || 'latest'
      })
      performanceMonitor.markMilestone('专题详情', '设置基本信息完成')

      if (title) {
        wx.setNavigationBarTitle({
          title: title
        })
      }
      this.loadData(true)
    }
  },

  async loadTopicDetailAndResources(id) {
    try {
      let topic
      
      // 1. Check Preloaded Data
      const app = getApp()
      if (app.globalData.preloadedTopics && app.globalData.preloadedTopics[id]) {
        topic = app.globalData.preloadedTopics[id]
        delete app.globalData.preloadedTopics[id]
        performanceMonitor.markMilestone('专题详情', '使用预加载数据')
      }

      // 2. Fetch if not preloaded
      if (!topic) {
        try {
          performanceMonitor.markMilestone('专题详情', '请求云函数')
          const res = await wx.cloud.callFunction({
            name: 'getTopics',
            data: { id }
          })
          if (res.result.success && res.result.data) {
            topic = res.result.data
          }
        } catch (cfErr) {
          console.warn('Cloud function getTopics failed, fallback to DB', cfErr)
        }

        if (!topic) {
          const db = wx.cloud.database()
          performanceMonitor.markMilestone('专题详情', '直接查询数据库')
          const res = await db.collection('topics').doc(id).get()
          topic = res.data
        }
      }
      performanceMonitor.markMilestone('专题详情', '专题详情加载完成')

      const rawCover = topic.coverUrl || topic.cover || ''
      
      // 先设置专题信息，立即显示给用户
      this.setData({
        id: topic._id,
        title: topic.title,
        cover: rawCover,
        description: topic.description,
        tag: topic.filterType === 'tag' ? topic.filterValue : '',
        category: topic.filterType === 'category' ? topic.filterValue : '',
        type: topic.resourceType || 'all',
        sort: topic.defaultSort || 'latest',
        layout: topic.layout || null
      })

      // Use layout config for pageSize if available
      if (topic.layout && topic.layout.modules) {
        const gridModule = topic.layout.modules.find(m => m.type === 'resource-grid')
        if (gridModule && gridModule.config) {
          if (gridModule.config.count) {
            this.setData({ pageSize: Number(gridModule.config.count) })
          }
          
          let aspectRatio = '133.33%' // Default 3:4
          if (topic.resourceType === 'wallpaper') aspectRatio = '177.77%' // 9:16
          if (topic.resourceType === 'avatar') aspectRatio = '100%' // 1:1
          
          const newLayout = { ...topic.layout }
          newLayout.modules = newLayout.modules.map(m => {
            if (m.type === 'resource-grid') {
              return { ...m, config: { ...m.config, aspectRatio } }
            }
            return m
          })
          this.setData({ layout: newLayout })
        }
      }

      wx.setNavigationBarTitle({
        title: topic.title
      })
      performanceMonitor.markMilestone('专题详情', '页面设置完成')

      // 准备资源请求参数
      let manualIds = []
      if (topic.layout && topic.layout.modules) {
        const gridModule = topic.layout.modules.find(m => m.type === 'resource-grid')
        if (gridModule && gridModule.config && gridModule.config.sourceType === 'manual' && gridModule.config.manualIds) {
          manualIds = gridModule.config.manualIds
        }
      }

      const params = {
        page: 1,
        pageSize: this.data.pageSize,
        sort: topic.defaultSort || 'latest',
        type: topic.resourceType === 'all' ? undefined : topic.resourceType,
        category: topic.filterType === 'category' ? topic.filterValue : undefined,
        tag: topic.filterType === 'tag' ? topic.filterValue : undefined,
        ids: manualIds.length > 0 ? manualIds : undefined,
        includeMeta: false
      }

      // 并行加载：同时发起资源请求，但先显示专题信息
      this.loadDataWithParams(params, true)
    } catch (err) {
      console.error('加载专题详情失败:', err)
      wx.showToast({ title: '专题不存在', icon: 'none' })
      performanceMonitor.endPageLoad('专题详情', { error: err.message })
    }
  },

  async loadDataWithParams(params, reset = false) {
    if (this.data.loading && !this.data.refreshing) return

    this.setData({ loading: true })

    if (reset) {
      this.setData({ page: 1, list: [], noMore: false })
    }

    try {
      performanceMonitor.markMilestone('专题详情', '开始请求数据')
      
      const res = await getResources(params)
      performanceMonitor.markMilestone('专题详情', '数据请求完成')

      if (res.result && res.result.success) {
        const newList = res.result.data.map(item => ({
          ...item,
          url: item.coverUrl,
          originalUrl: item.originUrl
        }))
        
        const hasMore = res.result.hasMore !== undefined ? res.result.hasMore : (newList.length >= params.pageSize)
        
        this.setData({
          list: reset ? newList : [...this.data.list, ...newList],
          page: params.page + 1,
          noMore: !hasMore,
          loading: false,
          refreshing: false
        })
        performanceMonitor.markMilestone('专题详情', 'setData完成')
        
        if (reset) {
          performanceMonitor.endPageLoad('专题详情', { 
            itemCount: newList.length 
          })
          
          const pageLoadTime = performanceMonitor.getPageLoadTime('专题详情')
          if (pageLoadTime) {
            logger.logPerformance('page_load', {
              loadTime: pageLoadTime,
              itemCount: newList.length
            }, 'subpackages/topic/topic')
          }
          
          logger.logPageView('subpackages/topic/topic')
        }
      } else {
        this.setData({ loading: false, refreshing: false })
      }
    } catch (err) {
      console.error('加载专题数据失败:', err)
      this.setData({ loading: false, refreshing: false })
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      if (this.data.refreshing) {
        wx.stopPullDownRefresh()
      }
    }
  },

  onPullDownRefresh() {
    this.setData({ refreshing: true })
    this.loadData(true)
  },

  onReachBottom() {
    if (!this.data.noMore && !this.data.loading) {
      this.loadData(false)
    }
  },

  async loadData(reset = false) {
    const { type, category, tag, page, pageSize, sort, layout } = this.data
    
    let manualIds = []
    if (layout && layout.modules) {
      const gridModule = layout.modules.find(m => m.type === 'resource-grid')
      if (gridModule && gridModule.config && gridModule.config.sourceType === 'manual' && gridModule.config.manualIds) {
        manualIds = gridModule.config.manualIds
      }
    }

    const params = {
      page,
      pageSize,
      sort,
      type: type === 'all' ? undefined : type,
      category: category || undefined,
      tag: tag || undefined,
      ids: manualIds.length > 0 ? manualIds : undefined,
      includeMeta: false
    }

    await this.loadDataWithParams(params, reset)
  },

  // 批量获取临时链接 helper - 已废弃，直接使用 cloudID
  // async batchGetTempFileURL(list) { ... }

  previewImage(e) {
    console.log('previewImage 被触发，事件对象:', e)
    const index = e.currentTarget.dataset.index
    console.log('点击的索引:', index)
    console.log('当前列表数据:', this.data.list)
    
    if (index === undefined || index === null) {
      console.error('index 未定义')
      wx.showToast({ title: '跳转失败', icon: 'none' })
      return
    }
    
    const item = this.data.list[index]
    if (!item) {
      console.error('找不到对应的 item')
      wx.showToast({ title: '数据异常', icon: 'none' })
      return
    }
    
    console.log('点击的 item:', item)
    const currentUrl = item.originalUrl || item.url
    console.log('跳转的 URL:', currentUrl)
    
    if (item.type === 'avatar' || this.data.type === 'avatar') {
      console.log('跳转到头像预览')
       wx.navigateTo({
        url: `/subpackages/preview/preview?url=${encodeURIComponent(currentUrl)}&isAvatar=true&avatarData=${encodeURIComponent(JSON.stringify(item))}`,
        success: () => console.log('头像预览跳转成功'),
        fail: (err) => console.error('头像预览跳转失败:', err)
      })
    } else {
      console.log('跳转到壁纸预览')
      const imageList = this.data.list.map(i => i.originalUrl || i.url)
      wx.navigateTo({
        url: `/subpackages/wallpaper-preview/wallpaper-preview?url=${encodeURIComponent(currentUrl)}&currentIndex=${index}&imageList=${encodeURIComponent(JSON.stringify(imageList))}&wallpaperData=${encodeURIComponent(JSON.stringify(item))}`,
        success: () => console.log('壁纸预览跳转成功'),
        fail: (err) => console.error('壁纸预览跳转失败:', err)
      })
    }
  },
  
  onShareAppMessage() {
    return {
      title: this.data.title || '精选专题',
      path: `/pages/topic/topic?id=${this.data.id}&tag=${this.data.tag}&title=${this.data.title}`
    }
  },

  // 页面滚动监听（供广告组件使用）
  onPageScroll() {}
})
