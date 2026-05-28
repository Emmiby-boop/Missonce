import { getHomeData, getPersonalizedRecommendations, onHomeDataRefresh, getFavoritesCount } from '../../utils/api.js'
import { checkLoginStatus, loginWithProfile } from '../../utils/auth'
import { optimizeImageUrls, getOptimalThumbnailSize } from '../../utils/image.js'
import logger from '../../utils/logger.js'
import { cacheManager } from '../../utils/cache.js'
import { STORAGE_KEYS, CACHE_EXPIRE } from '../../config/constants.js'
import { performanceMonitor } from '../../utils/performance.js'
import interstitialAdManager from '../../utils/interstitialAdManager.js'
import { fetchPageAds, pickByType } from '../../utils/adUtil.js'
import { notificationService } from '../../services/notificationService.js'
import { getWindowInfo, getStorage, setStorage, getTheme } from '../../utils/storageManager'
 

Page({
  data: {
    favoritesCount: 0,
    showDailyBadge: false,
    unreadNotificationCount: 0,
    statusBarHeight: 20,
    navBarHeight: 44,
    banners: [],
    sections: [], // 动态首页板块
    recommendations: [], // 个性化推荐
    loading: true,
    showGuide: false,

    // Favorites Popup
    showFavorites: false,
   favoritesList: [],
    favoritesPage: 1,
    favoritesEnded: false,
    favoritesLoading: false,

    // Announcement Popup
    showAnnouncement: false,
    currentAnnouncement: null,
    dontShowAgain: false,
    
    // Native Top Ad
    nativeTopAd: null,
    showNativeTopAd: false,
  },

  _isFirstLoad: true, // 标记是否为首次加载
  _isLoadingData: false, // 标记是否正在加载数据

  onLoad(options) {
    performanceMonitor.startPageLoad('首页')
    
    // 处理邀请参数
    this.handleInvite(options)
    
    this.initNavBar()
    this.setData({ loading: true })
    performanceMonitor.markMilestone('首页', '初始化完成')

    // 🔥 优化：先尝试从本地缓存渲染（Stale-While-Revalidate 第一步）
    let hasCacheRendered = false
    try {
      const apiCache = getStorage('home_data_api_cache')
      if (apiCache && apiCache.data?.result?.success) {
        const { banners, sections } = apiCache.data.result.data
        let updateData = { loading: false }
        
        if (banners && banners.length > 0) {
          const optimizedBanners = optimizeImageUrls(banners, 'image', 750)
          updateData.banners = optimizedBanners.map(item => ({
            ...item, 
            id: item._id, 
            image: item.optimizedUrl || item.image 
          }))
        }
        
        if (sections) {
          // 异步处理 sections（图片优化），完成后更新
          this.processSections(sections).then(processedSections => {
            this.setData({ sections: processedSections })
          })
          // 不在 updateData 中设置未处理的 sections，避免先渲染原始数据再被异步覆盖闪烁
        }
        
        if (Object.keys(updateData).length > 1 || updateData.loading === false) {
          this.setData(updateData)
          hasCacheRendered = true
          performanceMonitor.markMilestone('首页', '本地缓存渲染完成')
        }
      }
    } catch (e) {
      // 缓存读取失败，忽略
    }

    // 如果API缓存没渲染成功，再尝试 cacheManager 的缓存
    if (!hasCacheRendered) {
      const cachedData = cacheManager.get(STORAGE_KEYS.HOME_DATA_CACHE)
      if (cachedData) {
        const { banners, sections } = cachedData
        let updateData = { loading: false }
        if (banners && banners.length > 0) {
          updateData.banners = banners.map(item => ({ ...item, id: item._id }))
        }
        if (sections) {
          updateData.sections = sections
        }
        if (Object.keys(updateData).length > 1 || updateData.loading === false) {
          this.setData(updateData)
          hasCacheRendered = true
          performanceMonitor.markMilestone('首页', '缓存渲染完成')
        }
      }
    }

    // 🔥 优化：本地缓存已渲染时，loadCriticalData 只负责后台刷新（不重复渲染相同数据）
    this._hasCacheRendered = hasCacheRendered
    this.loadCriticalData()
    
    // 🔥 优化：延迟加载非关键数据（不影响首屏）
    setTimeout(() => {
      this.loadRecommendations()
      this.checkDailyBadge()
      this.loadNotificationBadge()
      this.checkAnnouncement()
    }, 1000)
  },

  onNativeAdError() {
    if (this.data.showNativeTopAd) {
      this.setData({ showNativeTopAd: false })
    }
  },

  async loadPageAds() {
    try {
      const pages = getCurrentPages()
      const current = pages && pages.length ? pages[pages.length - 1] : null
      const route = current?.route || 'pages/index/index'
      const list = await fetchPageAds(route.startsWith('/') ? route : '/' + route)
      let nativeTop = pickByType(list, 'native_top')[0] || null
      if (!nativeTop) {
        const topNativeVideo = (list || []).find(it => it.type === 'native_video' && it.position === 'top' && it.isEnable)
        if (topNativeVideo) nativeTop = topNativeVideo
      }
      if (nativeTop) this.setData({ nativeTopAd: nativeTop })
    } catch (e) {
      console.error('loadPageAds error:', e)
    }
  },

  onPageScroll(e) {
    const ad = this.data.nativeTopAd
    const threshold = (ad && ad.scrollThreshold) || 200
    const shouldShow = e.scrollTop >= threshold
    if (shouldShow !== this.data.showNativeTopAd) {
      this.setData({ showNativeTopAd: shouldShow })
    }
  },

  // 只加载首屏关键数据
  async loadCriticalData() {
    // 防止重复请求
    if (this._isLoadingData) {
      return
    }
    
    this._isLoadingData = true
    
    try {
      performanceMonitor.markMilestone('首页', '开始请求数据')
      
      // 🔥 核心优化：复用 app.onLaunch 预热的 Promise，避免重复请求
      // 如果预热已完成（Promise resolved），直接复用
      // 如果预热还在进行（Promise pending），等待复用
      // 如果没有预热（Promise 为 null），走正常流程
      let homeDataRes
      const app = getApp()
      if (app.globalData.homeDataPromise) {
        console.log('[首页] 复用预热数据...')
        homeDataRes = await app.globalData.homeDataPromise
        app.globalData.homeDataPromise = null  // 用完清空，防止下次重复
      } else {
        console.log('[首页] 无预热数据，单独请求...')
        homeDataRes = await getHomeData()
      }
      performanceMonitor.markMilestone('首页', '数据请求完成')

      // 注册后台刷新回调：当 Stale-While-Revalidate 后台刷新完成时，静默更新UI
      this._unsubscribeHomeRefresh = onHomeDataRefresh(async (freshRes) => {
        if (freshRes && freshRes.result && freshRes.result.success && !this._isHiding) {
          console.log('[首页] 后台刷新完成，静默更新UI')
          await this._renderHomeData(freshRes)
        }
      })

      // 如果 onLoad 已经从本地缓存渲染了数据，且 getHomeData 返回的也是缓存数据，跳过重复渲染
      if (this._hasCacheRendered) {
        const cachedBanners = homeDataRes?.result?.data?.banners
        const currentBanners = this.data.banners
        const isSameData = cachedBanners && currentBanners && 
          cachedBanners.length === currentBanners.length &&
          cachedBanners[0]?._id === currentBanners[0]?.id
        
        if (isSameData) {
          console.log('[首页] 数据与缓存一致，跳过重复渲染')
        } else {
          console.log('[首页] 检测到新数据，静默更新UI')
          await this._renderHomeData(homeDataRes)
        }
      } else {
        // 无缓存，正常渲染
        const rendered = await this._renderHomeData(homeDataRes)
        
        if (rendered) {
          performanceMonitor.endPageLoad('首页', {
            bannerCount: this.data.banners?.length || 0,
            sectionCount: this.data.sections?.length || 0
          })
          
          const pageStats = performanceMonitor.getPageStats('首页')
          if (pageStats && pageStats.totalTime) {
            logger.logPerformance('page_load', {
              loadTime: pageStats.totalTime,
              bannerCount: this.data.banners?.length || 0,
              sectionCount: this.data.sections?.length || 0
            }, 'pages/index/index')
          }
          
          logger.logPageView('pages/index/index')
        }
      }
      
      this.loadFavoritesCount()
      
      // 🔥 预加载其他页面数据（不阻塞用户操作）
      setTimeout(() => {
        getApp().preloadOtherPagesData()
      }, 1000)
    } finally {
      this._isLoadingData = false
      this._isFirstLoad = false
    }
  },

  // 渲染首页数据（提取为独立方法，stale-while-revalidate 可复用）
  // 返回 Promise<boolean>，等待 sections 也处理完才 resolve
  async _renderHomeData(homeDataRes) {
    const updateData = { loading: false }
    let hasUpdates = false
    let newBanners = null
    let newSections = null

    if (homeDataRes.result && homeDataRes.result.success) {
      const { banners, sections } = homeDataRes.result.data
      
      if (banners && banners.length > 0) {
        const optimizedBanners = optimizeImageUrls(banners, 'image', 750)
        newBanners = optimizedBanners.map(item => ({
          ...item, 
          id: item._id, 
          image: item.optimizedUrl || item.image 
        }))
        updateData.banners = newBanners
        hasUpdates = true
      }

      if (sections) {
        const processedSections = await this.processSections(sections)
        newSections = processedSections
        updateData.sections = processedSections
        hasUpdates = true
      }
    }

    if (hasUpdates) {
      this.setData(updateData)
      performanceMonitor.markMilestone('首页', 'setData完成')
      // 更新缓存
      if (newBanners && newSections) {
        cacheManager.set(STORAGE_KEYS.HOME_DATA_CACHE, { 
          banners: newBanners, 
          sections: newSections 
        }, CACHE_EXPIRE.MEDIUM)
      }
    }
    
    return hasUpdates
  },

  // 分离推荐数据加载（延迟执行）
  async loadRecommendations() {
    try {
      const recRes = await getPersonalizedRecommendations(6)
      if (recRes && recRes.length > 0) {
        const thumbSize = getOptimalThumbnailSize()
        const optimized = optimizeImageUrls(recRes, 'coverUrl', thumbSize)
        
        this.setData({
          recommendations: optimized.map(item => ({
            ...item,
            id: item._id,
            url: item.optimizedUrl || item.coverUrl || item.url,
            originalUrl: item.originUrl || item.originalUrl || item.url
          }))
        })
      }
    } catch (e) {
      console.error('loadRecommendations error:', e)
    }

  },

  // 提取数据处理逻辑
  async processSections(sections) {
    const processedSections = []
    const thumbSize = getOptimalThumbnailSize()

    for (const section of sections) {
      const processed = { ...section, items: [] }
      
      if (section.items && section.items.length > 0) {
        const optimizedItems = optimizeImageUrls(section.items, 'coverUrl', thumbSize)
        
        processed.items = optimizedItems.map(item => ({
          ...item,
          id: item._id,
          url: item.optimizedUrl || item.coverUrl || item.url,
          originalUrl: item.originUrl || item.originalUrl || item.url,
          rawUrl: item.coverUrl || item.url,
          rawOriginalUrl: item.originUrl || item.originalUrl || item.url,
          resourceType: item.type || item.resourceType || 'wallpaper'
        }))
      }
      
      if (processed.items.length > 0 && section.dataSource?.autoSplit) {
        const types = new Set(processed.items.map(i => i.resourceType))
        if (types.size > 1) {
          const avatarItems = processed.items.filter(i => i.resourceType === 'avatar')
          const wallpaperItems = processed.items.filter(i => i.resourceType !== 'avatar')
          
          if (avatarItems.length > 0) {
            processedSections.push({
              ...processed,
              _id: processed._id + '-avatar',
              type: 'avatar_row',
              items: avatarItems,
              leftColumn: undefined,
              rightColumn: undefined
            })
          }
          
          if (wallpaperItems.length > 0) {
            const leftCol = []
            const rightCol = []
            wallpaperItems.forEach((item, index) => {
              if (index % 2 === 0) leftCol.push(item)
              else rightCol.push(item)
            })
            processedSections.push({
              ...processed,
              _id: processed._id + '-wallpaper',
              type: 'wallpaper_grid',
              items: wallpaperItems,
              leftColumn: leftCol,
              rightColumn: rightCol
            })
          }
          continue
        }
      }
      
      processedSections.push(processed)
    }
    
    return processedSections
  },

  onPullDownRefresh() {
    // 下拉刷新时清除缓存，确保获取最新数据
    try {
      wx.removeStorageSync('home_data_api_cache')
      wx.removeStorageSync('home_data_cache')
    } catch (e) {}

    // 下拉刷新时加载所有数据（完整刷新）
    Promise.all([
      this.loadCriticalData(),
      this.loadRecommendations()
    ]).then(() => {
      wx.stopPullDownRefresh()
      wx.showToast({
        title: '刷新成功',
        icon: 'none'
      })
    }).catch(() => {
      wx.stopPullDownRefresh()
    })
  },



  onShow() {
    this._isHiding = false
    getApp().logEvent('pv', { page: 'index' })
    this.loadFavoritesCount()
    this.loadNotificationBadge()
    
    // 刷新悬浮组件的未读计数
    const floatingComponent = this.selectComponent('#floatingNotification')
    if (floatingComponent && floatingComponent.refresh) {
      floatingComponent.refresh()
    }
    
    // 🔥 优化：首次加载由 onLoad 处理，onShow 只在特定情况下重新加载
    // 避免 onLoad 后紧接着 onShow 触发重复请求
    if (!this._isFirstLoad && (this.data.banners.length === 0 || this.data.sections.length === 0)) {
      this.loadCriticalData()
    }
    
    // 推荐数据延迟加载
    if (this.data.recommendations.length === 0) {
      setTimeout(() => this.loadRecommendations(), 500)
    }
    
    // 同步深色模式
    this.syncTheme()
    
    // 页面显示时智能触发插屏广告（带冷却时间检查）
    interstitialAdManager.smartTriggerInterstitialAd(2000)
  },

  onHide() {
    this._isHiding = true
  },

  onUnload() {
    this._isHiding = true
    this._unsubscribeHomeRefresh?.()
  },

  syncTheme() {
    const theme = getTheme()
    this.setData({ theme })
  },

  loadFavoritesCount() {
    // 防止短时间内重复调用（onLoad → loadCriticalData 和 onShow 都会触发）
    if (this._favoritesCountLoading) return
    this._favoritesCountLoading = true
    
    if (!this.checkLogin()) {
      this.setData({ favoritesCount: 0 })
      this._favoritesCountLoading = false
      return
    }
    
    // 1. 优先读取本地缓存（快速展示）
    wx.getStorage({
      key: 'favorites',
      success: (res) => {
        const favorites = res.data || []
        this.setData({ favoritesCount: favorites.length })
      },
      fail: () => {
        // 忽略错误，可能是没有缓存
      }
    })

    // 2. 静默同步云端准确数量（修正角标）
    getFavoritesCount().then(res => {
      if (res.total !== this.data.favoritesCount) {
        this.setData({ favoritesCount: res.total })
        
        // 如果云端是0，说明本地缓存可能是脏数据，清空它
        if (res.total === 0) {
          setStorage('favorites', [])
        }
      }
    }).catch(() => {}).finally(() => {
      this._favoritesCountLoading = false
    })

  },

  onSectionMore(e) {
    const section = e.currentTarget.dataset.section
    if (!section) return

    // 优先使用配置的 moreLink
    if (section.moreLink) {
      // 检查是否是 TabBar 页面
      const tabPages = [
        '/pages/index/index',
        '/pages/avatar/avatar',
        '/pages/wallpaper/wallpaper',
        '/pages/profile/profile'
      ]
      
      // 确保链接以 / 开头，修复相对路径问题
      let targetUrl = section.moreLink
      if (!targetUrl.startsWith('/')) {
        targetUrl = '/' + targetUrl
      }
      
      // 自动修正路径：将 /pages/resource-list 修正为 /subpackages/resource-list
      if (targetUrl.includes('/pages/resource-list/')) {
        targetUrl = targetUrl.replace('/pages/resource-list/', '/subpackages/resource-list/')
      }
      
      if (tabPages.includes(targetUrl)) {
        wx.switchTab({ url: targetUrl })
        return
      }
      
      wx.navigateTo({
        url: targetUrl,
        fail: (err) => {
          logger.error('跳转失败:', err)
          wx.showToast({ title: '页面跳转失败', icon: 'none' })
        }
      })
      return
    }

    // 如果没有配置 moreLink，则根据 queryConfig 跳转到通用列表页
    const config = section.queryConfig || {}
    const params = []
    
    if (config.resourceType) params.push(`type=${config.resourceType}`)
    if (config.category) params.push(`category=${encodeURIComponent(config.category)}`)
    if (config.sortField) params.push(`sort=${config.sortField}`)
    if (section.title) params.push(`title=${encodeURIComponent(section.title)}`)
    
    const url = `/subpackages/resource-list/resource-list?${params.join('&')}`
    
    wx.navigateTo({ url })
  },

  initNavBar() {
    // 🔥 优化：使用全局缓存的窗口信息，避免重复调用 wx.getWindowInfo
    const info = getWindowInfo()
    const statusBarHeight = info.statusBarHeight || 20
    const navBarHeight = 44 // Fixed 44px to match CSS
    this.setData({ statusBarHeight, navBarHeight })
  },

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
    const type = item.type || 'wallpaper'

    // 从数据列表中找到完整的 item 对象（包含 _id）
    let fullItem = null
    
    // 先从 avatarList 中查找
    if (this.data.avatarList) {
      fullItem = this.data.avatarList.find(i => (i.originalUrl || i.url) === currentUrl)
    }
    
    // 再从 wallpaperList 中查找
    if (!fullItem && this.data.wallpaperList) {
      fullItem = this.data.wallpaperList.find(i => (i.originalUrl || i.url) === currentUrl)
    }
    
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

    // 如果是头像，跳转到自定义预览页面（支持圆形/方形切换和下载）
    if (type === 'avatar') {
      wx.navigateTo({
        url: `/subpackages/preview/preview?url=${encodeURIComponent(currentUrl)}&rawUrl=${encodeURIComponent(currentRawUrl || '')}&isAvatar=true&avatarData=${encodeURIComponent(JSON.stringify(fullItem))}`
      })
    } else {
      // 如果是壁纸，也跳转到自定义预览页
      wx.navigateTo({
        url: `/subpackages/wallpaper-preview/wallpaper-preview?url=${encodeURIComponent(currentUrl)}&rawUrl=${encodeURIComponent(currentRawUrl || '')}&wallpaperData=${encodeURIComponent(JSON.stringify(fullItem))}`
      })
    }
  },

  navigateToWallpaper() {
    wx.switchTab({
      url: '/pages/wallpaper/wallpaper'
    })
  },

  navigateToAvatar() {
    wx.switchTab({
      url: '/pages/avatar/avatar'
    })
  },

  navigateToSearch() {
    wx.navigateTo({
      url: '/subpackages/search/search'
    })
  },

  navigateToTopicList() {
    wx.navigateTo({
      url: '/subpackages/topic-list/topic-list'
    })
  },

  navigateToInspiration() {
    wx.navigateTo({
      url: '/subpackages/inspiration-writer/inspiration-writer'
    })
  },

  navigateToDailyPicks() {
    wx.navigateTo({
      url: '/subpackages/daily-picks/daily-picks'
    })
  },

  checkLogin() {
    return checkLoginStatus()
  },

  async handleLogin() {
    try {
      const user = await loginWithProfile()
      if (user) {
        this.loadFavoritesCount()
        return true
      }
      return false
    } catch (e) {
      return false
    }
  },

  showLoginModal() {
    wx.showModal({
      title: '请先登录',
      content: '查看收藏夹需要登录',
      confirmText: '去登录',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          // 尝试直接调用登录逻辑
          const success = await this.handleLogin()
          if (success) {
             this.openFavorites()
          }
        }
      }
    })
  },

  navigateToWatermark() {
    wx.navigateToMiniProgram({
      appId: 'wxbd304fe2186156e4',
      path: '',
      fail: (err) => {
        console.error('跳转去水印小程序失败:', err)
        wx.showToast({ title: '跳转失败', icon: 'none' })
      }
    })
  },

  navigateToFavorites() {
    this.openFavorites()
  },

  // ---------------------------------------------------------
  // 收藏功能逻辑 (复用自 Profile 页面)
  // ---------------------------------------------------------

  openFavorites() {
    if (!this.checkLogin()) {
      this.showLoginModal()
      return
    }
    
    // 重置并加载
    this.setData({ 
      showFavorites: true,
      favoritesList: [],
      favoritesPage: 1,
      favoritesEnded: false
    })
    
    this.loadMoreFavorites()
  },

  closeFavoritesPanel() {
    this.setData({ showFavorites: false })
  },

  loadMoreFavorites() {
    if (this.data.favoritesLoading || this.data.favoritesEnded) return
    
    this.setData({ favoritesLoading: true })
    
    getFavorites('all', this.data.favoritesPage, 20)
      .then(res => {
        const list = res.data || []
        const newList = this.data.favoritesPage === 1 ? list : [...this.data.favoritesList, ...list]
        
        this.setData({
          favoritesList: newList,
          favoritesPage: this.data.favoritesPage + 1,
          favoritesEnded: list.length < 20,
          favoritesLoading: false
        })
      })

  },

  handleFavoriteTap(e) {
    const { url, type } = e.currentTarget.dataset
    if (!url) return
    
    if (type === 'wallpaper') {
      wx.navigateTo({
        url: `/subpackages/wallpaper-preview/wallpaper-preview?url=${encodeURIComponent(url)}`
      })
    } else if (type === 'avatar') {
      wx.navigateTo({
        url: `/subpackages/preview/preview?url=${encodeURIComponent(url)}&isAvatar=true`
      })
    } else {
      wx.previewImage({
        urls: [url],
        current: url
      })
    }
  },

  noop() {}, // 空函数，用于阻止冒泡

  randomWallpaper() {
    const list = []
    // 从当前展示的板块中收集所有壁纸
    this.data.sections.forEach(sec => {
      if (sec.type === 'wallpaper_grid' && sec.items) {
        list.push(...sec.items)
      }
    })

    if (!list.length) {
      wx.showToast({ title: '暂无壁纸可随机', icon: 'none' })
      return
    }

    const picked = list[Math.floor(Math.random() * list.length)]
    const currentUrl = picked.originalUrl || picked.url
    const currentRawUrl = picked.rawOriginalUrl || picked.rawUrl
    const currentIndex = list.findIndex(item => (item.originalUrl || item.url) === currentUrl)
    const imageList = list.map(item => item.originalUrl || item.url)

    wx.navigateTo({
      url: `/subpackages/wallpaper-preview/wallpaper-preview?url=${encodeURIComponent(currentUrl)}&rawUrl=${encodeURIComponent(currentRawUrl || '')}&currentIndex=${currentIndex}&imageList=${encodeURIComponent(JSON.stringify(imageList))}&wallpaperData=${encodeURIComponent(JSON.stringify({ categories: picked.categories, tags: picked.tags }))}`
    })
  },

  randomAvatar() {
    const list = []
    // 从当前展示的板块中收集所有头像
    this.data.sections.forEach(sec => {
      if (sec.type === 'avatar_row' && sec.items) {
        list.push(...sec.items)
      }
    })

    if (!list.length) {
      wx.showToast({ title: '暂无头像可随机', icon: 'none' })
      return
    }

    const picked = list[Math.floor(Math.random() * list.length)]
    const currentUrl = picked.originalUrl || picked.url
    const currentRawUrl = picked.rawOriginalUrl || picked.rawUrl

    wx.navigateTo({
      url: `/subpackages/preview/preview?url=${encodeURIComponent(currentUrl)}&rawUrl=${encodeURIComponent(currentRawUrl || '')}&isAvatar=true&avatarData=${encodeURIComponent(JSON.stringify({ categories: picked.categories, tags: picked.tags }))}`
    })
  },


  onBannerTap(e) {
    const id = e.currentTarget.dataset.id
    const target = (this.data.banners || []).find(item => item.id === id)
    if (!target) return

    // 新版配置处理
    if (target.type === 'page' && target.target) {
      const tabPages = [
        '/pages/index/index',
        '/pages/avatar/avatar',
        '/pages/wallpaper/wallpaper',
        '/pages/profile/profile'
      ]
      
      if (tabPages.some(path => target.target.startsWith(path))) {
        wx.switchTab({ url: target.target })
      } else {
        wx.navigateTo({ 
          url: target.target,
          fail: (err) => {
            console.error('跳转失败:', err)
            wx.showToast({ title: '页面路径无效', icon: 'none' })
          }
        })
      }
      return
    }

    if (target.type === 'resource' && target.target) {
        // 假设 target 是资源ID，跳转到预览页
        // 这里暂时假设是壁纸，如果是头像可能需要额外字段区分，或者去详情页
        // 简单起见，跳转到通用预览
        // TODO: 完善资源类型判断
        wx.showToast({ title: '暂不支持直接跳转资源ID', icon: 'none' })
        return
    }

    if (target.type === 'webview' && target.target) {
        // 跳转到 webview 页面
        wx.navigateTo({ 
          url: `/subpackages/webview/webview?url=${encodeURIComponent(target.target)}`,
          fail: (err) => {
            console.error('跳转Webview失败', err)
            wx.showToast({ title: '无法打开链接', icon: 'none' })
          }
        })
        return
    }

    // 兼容旧版 link 字段（数据库直接存的 URL）
    if (target.link) {
      const linkUrl = target.link.trim()
      if (linkUrl.startsWith('http://') || linkUrl.startsWith('https://')) {
        wx.navigateTo({
          url: `/subpackages/webview/webview?url=${encodeURIComponent(linkUrl)}`,
          fail: (err) => {
            console.error('link跳转失败:', err)
            wx.showToast({ title: '无法打开链接', icon: 'none' })
          }
        })
        return
      }
    }

    // 兼容旧版自动生成的轮播图
    if (target.targetPath) {
      wx.switchTab({
        url: target.targetPath,
        fail: () => wx.navigateTo({ url: target.targetPath })
      })
      return
    }

    wx.showToast({ title: '暂未配置跳转', icon: 'none' })
  },

  checkDailyBadge() {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const readDate = getStorage('daily_picks_read_date')
    this.setData({
      showDailyBadge: readDate !== todayStr
    })
  },

  onShareAppMessage() {
    return {
      title: '小辣椒动态头像壁纸，海量精美素材免费下载！',
      path: '/pages/index/index',
      imageUrl: ''
    }
  },

  onShareTimeline() {
    return {
      title: '小辣椒动态头像壁纸，海量精美素材免费下载！',
      query: '',
      imageUrl: ''
    }
  },

  navigateToNotifications() {
    wx.navigateTo({
      url: '/subpackages/notifications/notifications'
    })
  },

  async loadNotificationBadge() {
    // 防止短时间内重复调用
    if (this._notificationBadgeLoading) return
    this._notificationBadgeLoading = true
    try {
      const unreadCount = await notificationService.getUnreadCount()
      this.setData({ unreadNotificationCount: unreadCount })
    } catch (e) {
    } finally {
      this._notificationBadgeLoading = false
    }
  },

  async checkAnnouncement() {
    try {
      const notifications = await notificationService.getActiveNotifications()
      const readIds = await notificationService.getUserReadStatus()
      const popupAnnouncements = notifications.filter(n => 
        n.showPopup && !readIds.includes(n._id)
      )

      if (popupAnnouncements.length > 0) {
        const announcement = popupAnnouncements[0]
        
        const dismissedAnnouncements = getStorage('dismissed_announcements') || {}
        if (dismissedAnnouncements[announcement._id]) {
          return
        }

        this.setData({
          showAnnouncement: true,
          currentAnnouncement: announcement,
          dontShowAgain: false
        })
      }
    } catch (e) {}
  },

  closeAnnouncement() {
    const { currentAnnouncement, dontShowAgain } = this.data

    if (dontShowAgain && currentAnnouncement) {
      const dismissedAnnouncements = getStorage('dismissed_announcements') || {}
      dismissedAnnouncements[currentAnnouncement._id] = true
      setStorage('dismissed_announcements', dismissedAnnouncements)
    }

    if (currentAnnouncement) {
      notificationService.markAsRead(currentAnnouncement._id)
    }

    this.setData({
      showAnnouncement: false,
      currentAnnouncement: null
    })

    this.loadNotificationBadge()
  },

  handleAnnouncementConfirm() {
    const { currentAnnouncement } = this.data
    if (!currentAnnouncement) return

    this.closeAnnouncement()

    if (currentAnnouncement.linkType === 'page' && currentAnnouncement.linkValue) {
      wx.navigateTo({ url: currentAnnouncement.linkValue })
    } else if (currentAnnouncement.linkType === 'webview' && currentAnnouncement.linkValue) {
      wx.navigateTo({ url: '/subpackages/webview/webview?url=' + encodeURIComponent(currentAnnouncement.linkValue) })
    }
  },

  toggleDontShowAgain() {
    this.setData({
      dontShowAgain: !this.data.dontShowAgain
    })
  },

  async handleInvite(options) {
    const inviterOpenid = options.inviter || options.from
    if (!inviterOpenid) return
    
    const userInfo = getStorage('userInfo')
    if (!userInfo || !userInfo.openid) {
      setStorage('pendingInviter', inviterOpenid)
      return
    }
    
    if (userInfo.openid === inviterOpenid) return
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: {
          action: 'bindInviter',
          inviterOpenid: inviterOpenid
        }
      })
      
      if (res.result && res.result.success) {
        console.log('[邀请] 绑定邀请人成功:', inviterOpenid)
      } else {
        console.warn('[邀请] 绑定邀请人失败:', res.result?.message || '未知错误')
      }
    } catch (e) {
      console.error('绑定邀请人失败:', e)
    }
  }
})
