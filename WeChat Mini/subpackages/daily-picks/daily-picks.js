import { getDailyPicks } from '../../utils/api.js'
import { optimizeImageUrls, getOptimalThumbnailSize, getGifThumbnailSize } from '../../utils/image.js'
import { cacheManager } from '../../utils/cache.js'
import { fetchPageAds, pickByType } from '../../utils/adUtil.js'
import { getStorage, getWindowInfo, setStorage } from '../../utils/storageManager.js'

const CACHE_KEY = 'daily_picks_cache'
const CACHE_EXPIRE = 24 * 60 * 60 * 1000

Page({
  data: {
    loading: true,
    date: '',
    title: '',
    subtitle: '',
    weekDay: '',
    dayNum: '',
    monthText: '',
    leftColumn: [],
    rightColumn: [],
    totalCount: 0,
    hasError: false,
    errorMsg: '',
    statusBarHeight: 0,
    navBarHeight: 44,
    bottomNativeVideoAd: null,
    showBottomNativeAd: false
  },

  onLoad(options) {
    // 初始化导航栏高度
    this.initNavBar()

    const today = new Date()
    const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')

    // 设置日期数字显示
    const dayNum = String(today.getDate()).padStart(2, '0')
    const monthText = (today.getMonth() + 1) + '月'

    this.setData({ date: dateStr, dayNum, monthText })

    // 🔥 优化：先尝试快速渲染缓存
    this.tryRenderFromCache()

    // 🔥 优化：后台异步加载广告
    this.loadPageAds()

    // 🔥 优化：标记已读
    this.markAsRead()
  },
  
  initNavBar() {
    try {
      const info = getWindowInfo()
      const statusBarHeight = info.statusBarHeight || 20
      const navBarHeight = 44 // 固定高度
      this.setData({ statusBarHeight, navBarHeight })
    } catch (e) {
      console.error('获取系统信息失败:', e)
    }
  },
  
  navigateBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
    } else {
      wx.switchTab({ url: '/pages/index/index' })
    }
  },
  
  // 🔥 新增：尝试从缓存快速渲染
  tryRenderFromCache() {
    const cachedData = getStorage(CACHE_KEY)
    const today = new Date()
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')

    if (cachedData && cachedData.date === todayStr && cachedData.leftColumn && cachedData.leftColumn.length > 0) {
      // 有今天的缓存，直接渲染
      this.setData({
        loading: false,
        ...cachedData
      })
      console.log('[DailyPicks] 使用缓存渲染')
      return
    }
    
    // 无缓存或过期，加载新数据
    this.loadDailyPicks()
  },

  onShow() {
    const today = new Date()
    const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')
    
    if (this.data.date !== dateStr) {
      this.setData({ date: dateStr })
      this.loadDailyPicks()
    }
  },
  
  async loadPageAds() {
    try {
      const pages = getCurrentPages()
      const current = pages && pages.length ? pages[pages.length - 1] : null
      const route = current?.route || 'subpackages/daily-picks/daily-picks'
      const list = await fetchPageAds(route.startsWith('/') ? route : '/' + route)
      const nativeBottom = pickByType(list, 'native_bottom')[0] || null
      const bottomNativeVideo = (list || []).find(it => it.type === 'native_video' && (it.position === 'bottom' || !it.position) && it.isEnable) || null
      const chosenBottom = nativeBottom || bottomNativeVideo
      if (chosenBottom) this.setData({ bottomNativeVideoAd: chosenBottom })
    } catch (e) {}
  },

  markAsRead() {
    const today = new Date()
    const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')
    setStorage('daily_picks_read_date', dateStr)
  },

  async loadDailyPicks() {
    this.setData({ loading: true, hasError: false })

    try {
      const result = await getDailyPicks(this.data.date)
      
      if (!result) {
        this.setData({
          loading: false,
          hasError: true,
          errorMsg: '暂无今日推荐'
        })
        return
      }

      // 🔥 优化：GIF 使用更小的尺寸
      const thumbSize = getGifThumbnailSize()
      
      const processColumn = (items) => {
        if (!items) return []
        const optimized = optimizeImageUrls(items, 'url', thumbSize)
        return optimized.map(item => ({
          ...item,
          id: item._id,
          url: item.optimizedUrl || item.url,
          originalUrl: item.originalUrl || item.url,
          rawUrl: item.rawUrl || item.url,
          resourceType: item.resourceType || item.type || 'wallpaper',
          categories: item.categories || [],
          tags: item.tags || []
        }))
      }

      const data = {
        date: result.date,
        title: result.title,
        subtitle: result.subtitle,
        weekDay: result.weekDay,
        leftColumn: processColumn(result.leftColumn),
        rightColumn: processColumn(result.rightColumn),
        totalCount: result.totalCount
      }

      setStorage(CACHE_KEY, data)

      this.setData({
        loading: false,
        ...data
      })
      console.log('[DailyPicks] 数据加载完成')
    } catch (err) {
      console.error('加载每日精选失败:', err)
      this.setData({
        loading: false,
        hasError: true,
        errorMsg: '加载失败，请稍后重试'
      })
    }
  },

  onWaterfallItemTap(e) {
    const { url, originalurl, type, index, column } = e.currentTarget.dataset
    const items = column === 'left' ? this.data.leftColumn : this.data.rightColumn
    const currentIndex = items.findIndex(item => item.id === e.currentTarget.dataset.id)
    
    const imageList = [
      ...this.data.leftColumn.map(item => item.originalUrl || item.url),
      ...this.data.rightColumn.map(item => item.originalUrl || item.url)
    ]

    if (type === 'avatar') {
      wx.navigateTo({
        url: '/subpackages/preview/preview?url=' + encodeURIComponent(originalurl || url) + '&isAvatar=true&currentIndex=' + currentIndex + '&imageList=' + encodeURIComponent(JSON.stringify(imageList))
      })
    } else {
      wx.navigateTo({
        url: '/subpackages/wallpaper-preview/wallpaper-preview?url=' + encodeURIComponent(originalurl || url) + '&rawUrl=' + encodeURIComponent(e.currentTarget.dataset.rawurl || '') + '&currentIndex=' + currentIndex + '&imageList=' + encodeURIComponent(JSON.stringify(imageList))
      })
    }
  },

  onPullDownRefresh() {
    setStorage(CACHE_KEY, null)
    this.loadDailyPicks().finally(() => {
      wx.stopPullDownRefresh()
    })
  },
  
  onReachBottom() {
    if (!this.data.showBottomNativeAd && this.data.bottomNativeVideoAd && this.data.bottomNativeVideoAd.adUnitId) {
      this.setData({ showBottomNativeAd: true })
    }
  },
  
  onNativeAdError() {
    if (this.data.showBottomNativeAd) {
      this.setData({ showBottomNativeAd: false })
    }
  },

  onShareAppMessage() {
    return {
      title: this.data.title || '今日精选壁纸头像',
      path: '/subpackages/daily-picks/daily-picks'
    }
  },

  // 页面滚动监听（供广告组件使用）
  onPageScroll() {},

  onUnload() {
    if (this._unreadTimer) {
      clearTimeout(this._unreadTimer)
    }
  }
})
