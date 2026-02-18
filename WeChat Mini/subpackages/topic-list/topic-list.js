import { performanceMonitor } from '../../utils/performance.js'

Page({
  data: {
    topics: [],
    loading: true,
    refreshing: false,
    page: 1,
    pageSize: 10,
    hasMore: true
  },

  onLoad() {
    performanceMonitor.startPageLoad('专题列表')
    
    // 1. Check local cache for first page
    const cachedData = wx.getStorageSync('topic_list_cache')
    if (cachedData) {
      const { topics, timestamp } = cachedData
      // Cache valid for 30 minutes
      if (topics && topics.length > 0 && (Date.now() - timestamp < 30 * 60 * 1000)) {
        this.setData({ 
          topics,
          loading: false 
        })
        performanceMonitor.markMilestone('专题列表', '缓存加载完成')
      }
    }
    
    // 2. Load fresh data
    performanceMonitor.markMilestone('专题列表', '开始请求数据')
    this.loadTopics(1, true)
  },

  onPullDownRefresh() {
    this.setData({ refreshing: true })
    this.loadTopics(1, true)
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadTopics(this.data.page + 1)
    }
  },

  async loadTopics(page = 1, reset = false) {
    if (this.data.loading && !reset) return
    
    try {
      this.setData({ loading: true })
      
      const res = await wx.cloud.callFunction({
        name: 'getTopics',
        data: {
          status: 'active',
          page,
          pageSize: this.data.pageSize
        }
      })
      performanceMonitor.markMilestone('专题列表', '数据请求完成')

      if (res.result && res.result.success) {
        const newTopics = (res.result.data || []).map(item => ({
          ...item,
          // 兼容 cover 和 coverUrl 字段，优先使用 coverUrl
          coverUrl: item.coverUrl || item.cover || ''
        }))
        
        // Optimize: Use cloud:// URLs directly, skip resolveCoverUrls for performance
        // If specific WebP is needed, ensure uploaded images are optimized or use cloud functions to process
        
        const hasMore = res.result.hasMore
        
        let finalTopics = []
        if (reset) {
          finalTopics = newTopics
        } else {
          finalTopics = this.data.topics.concat(newTopics)
        }
        
        this.setData({
          topics: finalTopics,
          loading: false,
          refreshing: false,
          page,
          hasMore
        })
        performanceMonitor.markMilestone('专题列表', 'setData完成')

        // Cache first page
        if (page === 1 && newTopics.length > 0) {
          wx.setStorageSync('topic_list_cache', {
            topics: newTopics,
            timestamp: Date.now()
          })
        }
        
        if (reset) {
          performanceMonitor.endPageLoad('专题列表', { 
            topicCount: finalTopics.length 
          })
        }
      } else {
        throw new Error(res.result?.error || 'Failed to load topics')
      }

    } catch (err) {
      console.error('加载专题列表失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false, refreshing: false })
    } finally {
      if (this.data.refreshing) {
        wx.stopPullDownRefresh()
      }
    }
  },

  // Removed resolveCoverUrls usage for performance optimization
  // Direct cloud:// access is much faster than getting tempFileURL

  onTopicTap(e) {
    const id = e.currentTarget.dataset.id
    if (!id) {
      console.error('专题ID为空:', e)
      wx.showToast({ title: '跳转失败', icon: 'none' })
      return
    }

    // Preload detail data
    const app = getApp()
    if (!app.globalData.preloadedTopics) {
      app.globalData.preloadedTopics = {}
    }
    
    if (!app.globalData.preloadedTopics[id]) {
      wx.cloud.callFunction({
        name: 'getTopics',
        data: { id }
      }).then(res => {
        if (res.result && res.result.success) {
          app.globalData.preloadedTopics[id] = res.result.data
        }
      }).catch(err => {
        console.warn('Preload failed', err)
      })
    }

    console.log('跳转到专题详情:', id)
    wx.navigateTo({
      url: `/subpackages/topic/topic?id=${id}`,
      success: () => {
        console.log('跳转成功')
      },
      fail: (err) => {
        console.error('跳转失败:', err)
        wx.showToast({ title: '跳转失败', icon: 'none' })
      }
    })
  }
})
