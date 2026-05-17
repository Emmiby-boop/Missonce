import { getResources, getCategories } from '../../utils/api.js'
import { getWindowInfo } from '../../utils/storageManager.js'

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    currentTag: 'all', // all, hot, latest, or other tag ID
    tagList: [
      { id: 'all', name: '全部' },
      { id: 'hot', name: '热门' },
      { id: 'latest', name: '最新' }
    ],
    wallpapers: [],
    page: 1,
    pageSize: 15,
    loading: false,
    hasMore: true,
    tagsLoading: true
  },

  onLoad(options) {
    this.initNavBar()
    this.loadNavTags()
    
    if (options.tag) {
      this.setData({ currentTag: options.tag })
    }
    
    this.loadWallpapers()
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

  async loadNavTags() {
    try {
      const res = await getCategories({ type: 'wallpaper', source: 'tags' })
      if (res.result.success) {
        const fetchedTags = res.result.data || []
        // 过滤掉特殊标签
        const newTags = fetchedTags.filter(t => t.name !== '热门' && t.name !== '最新')
        
        this.setData({
          tagList: [...this.data.tagList, ...newTags],
          tagsLoading: false
        })
      }
    } catch (error) {
      console.error('加载标签失败:', error)
      this.setData({ tagsLoading: false })
    }
  },

  async loadWallpapers(reset = false) {
    if (this.data.loading) return
    if (!reset && !this.data.hasMore) return

    this.setData({ loading: true })

    try {
      const page = reset ? 1 : this.data.page
      const { currentTag, pageSize } = this.data
      
      const params = {
        type: 'wallpaper',
        page,
        pageSize
      }

      // 处理排序和筛选
      if (currentTag === 'all') {
        params.sort = 'latest'
      } else if (currentTag === 'hot') {
        params.sort = 'hot'
      } else if (currentTag === 'latest') {
        params.sort = 'latest'
      } else {
        params.tag = currentTag
      }

      const res = await getResources(params)
      
      if (res.result.success) {
        // 将 cloud:// 文件ID 转成 HTTPS 临时链接，避免发布环境的域名限制
        const newWallpapers = await Promise.all(
          (res.result.data || []).map(async (item) => {
            const url = await this.resolveUrl(item.coverUrl)
            const originalUrl = await this.resolveUrl(item.originUrl)
            return {
              id: item.id || item._id,
              url,
              originalUrl,
              rawUrl: item.coverUrl,
              rawOriginalUrl: item.originUrl,
              title: item.title,
              categories: item.categories,
              tags: item.tags
            }
          })
        )

        this.setData({
          wallpapers: reset ? newWallpapers : [...this.data.wallpapers, ...newWallpapers],
          page: page + 1,
          hasMore: newWallpapers.length === pageSize,
          loading: false
        })
      } else {
        this.setData({ loading: false })
      }
    } catch (error) {
      console.error('加载壁纸失败:', error)
      this.setData({ loading: false })
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  onTagChange(e) {
    const tag = e.currentTarget.dataset.tag
    if (tag === this.data.currentTag) return

    this.setData({
      currentTag: tag,
      wallpapers: [],
      page: 1,
      hasMore: true,
      loading: false
    }, () => {
      this.loadWallpapers(true)
    })
  },

  onPullDownRefresh() {
    this.setData({
      page: 1,
      hasMore: true,
      loading: false
    }, async () => {
      await this.loadNavTags()
      await this.loadWallpapers(true)
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    this.loadWallpapers()
  },

  previewImage(e) {
    const { url, originalUrl, rawUrl, rawOriginalUrl, categories, tags } = e.currentTarget.dataset
    const currentUrl = originalUrl || url
    const currentRawUrl = rawOriginalUrl || rawUrl

    wx.navigateTo({
      url: `/subpackages/wallpaper-preview/wallpaper-preview?url=${encodeURIComponent(currentUrl)}&rawUrl=${encodeURIComponent(currentRawUrl || '')}&wallpaperData=${encodeURIComponent(JSON.stringify({ categories, tags }))}`
    })
  },

  navigateBack() {
    wx.navigateBack()
  }
  ,
  async resolveUrl(value) {
    if (!value) return ''
    if (/^https?:\/\//i.test(value)) return value
    if (value.startsWith('cloud://')) {
      try {
        const res = await wx.cloud.getTempFileURL({ fileList: [value] })
        return res.fileList?.[0]?.tempFileURL || ''
      } catch (e) {
        console.error('获取临时文件URL失败:', value, e)
        return ''
      }
    }
    return value
  },

  // 页面滚动监听（供广告组件使用）
  onPageScroll() {}
})
