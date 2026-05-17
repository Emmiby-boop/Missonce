import { getResources, addFavorite, removeFavorite, recordDownload, getFavorites, findResourceByUrl, recordBrowseHistory } from '../../utils/api.js'
import { loginWithProfile, checkLoginStatus } from '../../utils/auth.js'
import { reportError } from '../../utils/logger.js'
import { fetchPageAds, pickByType } from '../../utils/adUtil.js'
import interstitialAdManager from '../../utils/interstitialAdManager.js'
import { generateInteractionStats } from '../../utils/statsGenerator.js'

const APPID = 'wx78c0b02bd2db5462'

Page({
  data: {
    showLoginModal: false,
    isLoginLoading: false,

    modalError: '',
    theme: 'light',
    statusBarHeight: 20,
    navBarHeight: 39,
    currentUrl: '',
    imageList: [],
    currentIndex: 0,
    isCircular: true,
    isAvatar: true,
    isFavorite: false,
    favorites: [],
    recommendList: [],
    showPageIndicator: false,
    imageLoaded: true,
    loadedImages: {},
    iconHome: '',
    iconStarOn: '',
    iconStarOff: '',
    iconDownload: '',
    iconShare: '',
    iconBack: '',
    iconEdit: '',

    // 🔥 新增：互动数据
    viewCount: 0,
    likeCount: 0,
    isLiked: false,

    tagList: [


      { label: '头像', type: 'primary' },
      { label: '女生头像', type: 'secondary' },
      { label: '高清', type: 'light' }
    ],
    similarList: [],
    itemsList: [],
    showPosterModal: false,
    
    // 底部原生广告
    bottomNativeVideoAd: null,
    showBottomNativeAd: false,

    // 插屏广告冷却控制
    lastInterstitialShowTime: 0,
    interstitialCooldown: 60000, // 1分钟冷却时间
    interstitialTriggerCount: 0,
    maxTriggersPerSession: 3 // 每会话最多触发3次
  },

  onShow() {
    getApp().logEvent('pv', { page: 'preview' })
    this.checkFavorite()
    
    // 页面显示时：重置冷却并智能触发插屏广告（避免首次进入被冷却挡住）
    try { interstitialAdManager.resetCooldown() } catch (e) {}
    interstitialAdManager.smartTriggerInterstitialAd(800).then((shown) => {
      if (!shown) {
        // 二次兜底触发（可能因环境限制第一次未展示）
        setTimeout(() => interstitialAdManager.smartTriggerInterstitialAd(1500), 1500)
      }
    })
  },

  onReachBottom() {
    if (!this.data.showBottomNativeAd && this.data.bottomNativeVideoAd && this.data.bottomNativeVideoAd.adUnitId) {
      this.setData({ showBottomNativeAd: true })
    }
  },


  getIconSet() {
    return {
      iconHome: '/images/preview-home.svg',
      iconStarOn: '/images/preview-favorite-active.svg',
      iconStarOff: '/images/preview-favorite.svg',
      iconDownload: '/images/preview-download.svg',
      iconShare: '/images/preview-share.svg',
      iconEdit: '/images/preview-edit.svg',
      iconBack: '/images/preview-back.svg',
      iconMore: '../../images/more.svg',
      iconLike: '/images/icon-like.svg',
      iconLikeActive: '/images/icon-like-active.svg',
      iconView: '/images/icon-view.svg',
      iconHot: '/images/icon-hot.svg'
    }
  },

  getTagList() {
    const similarList = this.data.similarList || []
    const allTags = new Set()
    const colors = ['primary', 'secondary', 'blue', 'orange', 'purple', 'teal']
    
    similarList.forEach(item => {
      if (item.tags && item.tags.length > 0) {
        item.tags.forEach(tag => allTags.add(tag))
      }
    })
    
    return Array.from(allTags).slice(0, 4).map((tag, index) => ({
      label: tag,
      type: colors[index % colors.length]
    }))
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

  buildSimilarList() {
    // 获取当前头像的标签和分类，用于相似推荐
    const currentAvatar = this.data.currentAvatar || {}
    let rawTags = currentAvatar.tags || []
    
    // 处理标签数据：可能是字符串，也可能是数组，数组中可能包含逗号分隔的字符串
    let tags = []
    if (typeof rawTags === 'string') {
      tags = rawTags.split(/[,，]/)
    } else if (Array.isArray(rawTags)) {
      rawTags.forEach(tag => {
        if (typeof tag === 'string') {
          tags = tags.concat(tag.split(/[,，]/))
        } else {
          tags.push(String(tag))
        }
      })
    }
    
    // 去除空白和空项
    tags = tags.map(t => t.trim()).filter(t => t)

    // 🔥 优化：增加推荐数量到 12
    return getResources({
      type: 'avatar',
      pageSize: 12,
      page: 1,
      sort: 'hot',
      tag: tags.length > 0 ? tags[0] : undefined
    }).then(res => {
      const similarList = (res.result.data || []).map(item => ({
        url: item.coverUrl || item.url,
        originalUrl: item.originUrl,
        title: item.title,
        categories: item.categories,
        tags: item.tags || [],
        category: item.categories && item.categories.length > 0 ? item.categories[0].name : '相似头像'
      }))
      
      return similarList
    }).catch(error => {
      console.error('获取相似头像失败:', error)
      return []
    })
  },

  checkLogin() {
    return checkLoginStatus()
  },

  showLoginModal() {
    this.setData({ showLoginModal: true })
  },

  hideLoginModal() {
    this.setData({ 
      showLoginModal: false,

      modalError: ''
    })
  },



  async handleLogin() {
    this.setData({ isLoginLoading: true, modalError: '' })
    
    try {
      const userInfo = await wx.getUserProfile({ desc: '用于登录' })
      await wx.login()
      
      await loginWithProfile({
        nickName: userInfo.userInfo.nickName,
        avatarUrl: userInfo.userInfo.avatarUrl
      })
      
      wx.showToast({ title: '登录成功', icon: 'success' })
      this.setData({ showLoginModal: false, isLoginLoading: false })
      this.checkFavorite()
    } catch (err) {
      console.error('登录流程异常:', err)
      this.setData({ 
        modalError: err.message || '登录异常',
        isLoginLoading: false 
      })
    }
  },

  onLoad(options) {
    this.initNavBar()
    this.syncTheme()
    this.handleThemeChange = this.handleThemeChange.bind(this)
    wx.onThemeChange(this.handleThemeChange)
    this.setData(this.getIconSet())
    this._adLoadingTimer = null
    this.setData({ showAdLoading: false })
    
    // 使用通用广告管理器初始化插屏广告
    interstitialAdManager.initInterstitialAd('/subpackages/preview/preview')
    console.log('[AD][Manager] preview onLoad: 插屏广告已初始化')
    // 加载页面广告配置（底部）
    this.loadPageAds()

    const { url, isAvatar, currentIndex, imageList: listParam, avatarData } = options

    console.log('预览页面加载参数:', { url, isAvatar, currentIndex, imageList: listParam, avatarData })

    if (url) {

      const decodedUrl = decodeURIComponent(url)
      let imageList = []

      if (listParam) {
        try {
          imageList = JSON.parse(decodeURIComponent(listParam))
        } catch (e) {
          console.error('解析图片列表失败:', e)
        }
      }

      if (imageList.length === 0 && decodedUrl) {
        imageList = [decodedUrl]
      }

      if (!imageList.length) {
        wx.showToast({ title: '暂无可预览的图片', icon: 'none' })
        return
      }

      let index = 0

      if (currentIndex) {
        index = parseInt(currentIndex, 10)
        if (index >= imageList.length) index = 0
      }

      this.setData({
        currentUrl: imageList[index],
        imageList: imageList,
        currentIndex: index,
        rawUrl: options.rawUrl ? decodeURIComponent(options.rawUrl) : '',
        isCircular: isAvatar === 'false' ? false : true,
        imageLoaded: true,
        loadedImages: {}
      })
      
      // 设置当前头像的完整数据
      let itemsList = new Array(imageList.length).fill(null);
      let parsedAvatarData = null;
      
      if (avatarData) {
        try {
          const decodedAvatarData = decodeURIComponent(avatarData)
          parsedAvatarData = JSON.parse(decodedAvatarData)
          
          const currentUrl = parsedAvatarData.url || parsedAvatarData.imageUrl || ''
          const stats = generateInteractionStats(currentUrl)

          this.setData({
            currentAvatar: parsedAvatarData,
            viewCount: stats.viewCount,
            likeCount: stats.likeCount,
            hotScore: Math.floor(stats.viewCount * 0.3)
          })
          itemsList[index] = parsedAvatarData;
          console.log('当前头像数据:', parsedAvatarData)
          
          recordBrowseHistory(parsedAvatarData)
        } catch (e) {
          console.error('解析头像数据失败:', e)
        }
      }
      
      this.setData({ itemsList });
      
      // 直接使用当前头像的数据来设置标签列表
      this.setData({
        tagList: this.getAvatarTagList()
      })

      // 如果当前项没有数据，或者数据中没有标签（例如从收藏/下载列表进入），尝试获取完整信息
      if ((!parsedAvatarData || !parsedAvatarData.tags || parsedAvatarData.tags.length === 0) && imageList[index]) {
        this.fetchAvatarInfo(imageList[index], index);
      }
      
      this.buildSimilarList().then(similarList => {
        // 将相似推荐合并到轮播列表
        const newImages = similarList.map(item => item.url);
        const newItems = similarList;
        
        // 去重逻辑：过滤掉已经存在的图片
        const currentUrls = new Set(this.data.imageList);
        const filteredSimilarList = similarList.filter(item => !currentUrls.has(item.url));
        
        if (filteredSimilarList.length > 0) {
           const filteredImages = filteredSimilarList.map(item => item.url);
           
           this.setData({
             similarList: similarList, // 保持底部相似列表不变，或者也可以更新
             imageList: this.data.imageList.concat(filteredImages),
             itemsList: this.data.itemsList.concat(filteredSimilarList)
           });
        } else {
            this.setData({ similarList });
        }
        
        this.loadFavorites()
        this.checkFavorite()
      })
    } else {
      this.setData({
        similarList: this.buildSimilarList()
      })
    }
    this.loadFavorites()
    this.checkFavorite()
  },
  
  // 加载页面广告配置（仅底部原生/视频）
  async loadPageAds() {
    try {
      const pages = getCurrentPages()
      const current = pages && pages.length ? pages[pages.length - 1] : null
      const route = current?.route || 'subpackages/preview/preview'
      const list = await fetchPageAds(route.startsWith('/') ? route : '/' + route)
      // 兼容两种类型：native_bottom 或 native_video(position=bottom|空)
      const nativeBottom = pickByType(list, 'native_bottom')[0] || null
      const bottomNativeVideo = (list || []).find(it => it.type === 'native_video' && (it.position === 'bottom' || !it.position) && it.isEnable) || null
      const chosenBottom = nativeBottom || bottomNativeVideo
      if (chosenBottom) {
        this.setData({ bottomNativeVideoAd: chosenBottom })
      }
    } catch (e) {}
  },

  onNativeAdError() {
    if (this.data.showBottomNativeAd) {
      this.setData({ showBottomNativeAd: false })
    }
  },

  onRewarded(e) {
    console.log('[AD][Rewarded] onRewarded:', e.detail)
    this.hideAdLoading('rewarded', 'completed')
  },
  
  showAdLoading(kind = 'rewarded') {
    if (this.data.showAdLoading) return
    this.setData({ showAdLoading: true })
    try { getApp().logEvent('ad_loading_show', { kind, page: 'preview' }) } catch (e) {}
    if (this._adLoadingTimer) { clearTimeout(this._adLoadingTimer); this._adLoadingTimer = null }
    this._adLoadingTimer = setTimeout(() => {
      if (this.data.showAdLoading) {
        this.setData({ showAdLoading: false })
        wx.showToast({ title: '加载超时，请重试', icon: 'none' })
        try { getApp().logEvent('ad_loading_timeout', { kind, page: 'preview' }) } catch (e) {}
      }
      this._adLoadingTimer = null
    }, 10000)
  },

  hideAdLoading(kind = 'unknown', reason = '') {
    if (this._adLoadingTimer) { clearTimeout(this._adLoadingTimer); this._adLoadingTimer = null }
    if (this.data.showAdLoading) {
      this.setData({ showAdLoading: false })
    }
    try { getApp().logEvent('ad_loading_hide', { kind, reason, page: 'preview' }) } catch (e) {}
  },


  
  ensureRewardedForFirstDownload() {
    const that = this
    // 返回: { success: true/false, method: 'free'/'points'/'member' }
    let adResult = { success: false, method: 'points' }
    
    return new Promise(async (resolve) => {
      try {
        const statusRes = await wx.cloud.callFunction({
          name: 'userPoints',
          data: { action: 'getDownloadStatus', resourceType: 'avatar' }
        })
        if (!that) return resolve(adResult)
        
        const status = statusRes.result && statusRes.result.success ? statusRes.result.data : null
        console.log('[AD][Rewarded] getDownloadStatus:', status)
        
        if (!status) {
          adResult = { success: true, method: 'points' }
          return resolve(adResult)
        }
        
        // 会员直接通过
        if (status.isMember) {
          adResult = { success: true, method: 'member' }
          return resolve(adResult)
        }
        
        // 如果今天已经看过广告，直接下载
        if (status.freeDownloadUsed) {
          adResult = { success: true, method: 'free' }
          return resolve(adResult)
        }
        
        // 🔥 首次下载：必须观看激励广告
        try {
          wx.showModal({
            title: '首次下载提示',
            content: '首次下载需要观看激励视频，观看后可免费下载今日所有资源！',
            confirmText: '观看视频',
            cancelText: '取消',
            success: async (modalRes) => {
              if (!that) return resolve(adResult)
              
              if (modalRes.confirm) {
                const rewardedAdComponent = that.selectComponent('#rewardedAd')
                if (rewardedAdComponent) {
                  console.log('[AD][Rewarded] show rewarded ad')
                  that.showAdLoading('rewarded')
                  const result = await rewardedAdComponent.showRewarded()
                  that.hideAdLoading('rewarded', result.success ? 'completed' : 'skipped')
                  
                  if (result.success) {
                    adResult = { success: true, method: 'free' }
                  } else {
                    wx.showToast({ title: '需要完整观看广告才能下载', icon: 'none' })
                  }
                }
              }
              resolve(adResult)
            }
          })
        } catch (e) {
          console.log('[AD][Rewarded] ad show failed:', e)
          resolve(adResult)
        }
      } catch (e) {
        console.log('[AD][Rewarded] getDownloadStatus failed:', e)
        resolve(adResult)
      }
    })
  },

  // 获取当前头像的标签列表
  getAvatarTagList(item) {
    const currentAvatar = item || this.data.currentAvatar || {}
    let rawTags = currentAvatar.tags || []
    let categories = currentAvatar.categories || []
    
    // 合并标签和分类
    let tags = []
    
    // 添加分类
    if (Array.isArray(categories)) {
      categories.forEach(cat => {
        if (typeof cat === 'string') tags.push(cat)
        else if (cat && cat.name) tags.push(cat.name)
      })
    } else if (typeof categories === 'string') {
       tags.push(categories)
    }

    // 添加标签
    if (typeof rawTags === 'string') {
      tags = tags.concat(rawTags.split(/[,，]/))
    } else if (Array.isArray(rawTags)) {
      rawTags.forEach(tag => {
        if (typeof tag === 'string') {
          tags = tags.concat(tag.split(/[,，]/))
        } else {
          tags.push(String(tag))
        }
      })
    }
    
    // 去除空白和空项，以及重复项
    tags = [...new Set(tags.map(t => t.trim()).filter(t => t))]

    const colors = ['primary', 'secondary', 'blue', 'orange', 'purple', 'teal']
    
    console.log('当前头像完整标签数据:', tags)
    
    return tags.map((tag, index) => ({
      label: tag,
      type: colors[index % colors.length]
    }))
  },

  async fetchAvatarInfo(url, index) {
    if (!url) return;
    
    try {
      const item = await findResourceByUrl(url)
      if (item) {
        // 更新 itemsList
        const itemsList = this.data.itemsList;
        itemsList[index] = item;
        
        // 如果当前还在查看这张图，则更新视图
        if (this.data.currentIndex === index) {
           this.setData({
             itemsList,
             currentAvatar: item,
             tagList: this.getAvatarTagList(item)
           });
           
           // 更新相似推荐
           this.setData({
             similarList: await this.buildSimilarList()
           })
        } else {
           this.setData({ itemsList });
        }
      } else {
        console.warn(`No resource found for url: ${url}`);
      }
    } catch (err) {
      console.error('Fetch avatar info failed', err);
    }
  },



  onUnload() {
    wx.offThemeChange && wx.offThemeChange(this.handleThemeChange)
    if (this.hideTimer) {
      clearTimeout(this.hideTimer)
    }
    
    // 清理广告资源
    interstitialAdManager.destroy()
  },

  handleThemeChange(res) {
    this.setData({ theme: res.theme === 'dark' ? 'dark' : 'light' })
  },

  syncTheme() {
    try {
      const { theme } = wx.getAppBaseInfo()
      this.setData({ theme: theme === 'dark' ? 'dark' : 'light' })
    } catch (e) {
      console.warn('获取主题失败，使用默认亮色', e)
      this.setData({ theme: 'light' })
    }
  },

  goBack() {
    wx.navigateBack()
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    })
  },

  onImageLoad(e) {
    const index = e.currentTarget.dataset.index
    const loadedImages = this.data.loadedImages
    loadedImages[index] = true
    this.setData({
      imageLoaded: true,
      loadedImages: loadedImages
    })
  },

  onTouchStart() {
    this.setData({ showPageIndicator: true })
  },

  onTouchEnd() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer)
    }
    this.hideTimer = setTimeout(() => {
      this.setData({ showPageIndicator: false })
    }, 2000)
  },

  async onSwiperChange(e) {
    const index = e.detail.current
    
    // 更新当前数据对象
    const currentItem = this.data.itemsList[index];
    
    // Check if we need to fetch data: 
    // 1. Item doesn't exist
    // 2. Item exists but has no tags (and we expect tags)
    const needsFetch = !currentItem || (!currentItem.tags || currentItem.tags.length === 0);

    if (currentItem) {
      this.setData({
        currentAvatar: currentItem
      });
      // 更新标签
      this.setData({
        tagList: this.getAvatarTagList()
      });
      
      // 记录浏览历史 (带防抖逻辑，避免快速滑动频繁调用)
      if (this.browseTimer) clearTimeout(this.browseTimer)
      this.browseTimer = setTimeout(() => {
        if (currentItem && currentItem._id) {
          recordBrowseHistory(currentItem)
        }
      }, 1000)
    } else {
       // Reset if no item yet
       this.setData({
        tagList: [],
        currentAvatar: {}
      });
    }

    if (needsFetch) {
      const currentUrl = this.data.imageList[index];
      if (currentUrl) {
        this.fetchAvatarInfo(currentUrl, index);
      }
    }

    this.setData({
      currentIndex: index,
      currentUrl: this.data.imageList[index],
      rawUrl: '', // 切换后清除初始传入的 rawUrl，避免下载时一直使用第一张图的链接
      showPageIndicator: true
    })
    this.checkFavorite()

    if (this.hideTimer) {
      clearTimeout(this.hideTimer)
    }
    this.hideTimer = setTimeout(() => {
      this.setData({ showPageIndicator: false })
    }, 2000)
    
    // 滑动切换时智能触发插屏广告（带防抖和冷却时间）
    interstitialAdManager.smartTriggerInterstitialAd(1500)
  },

  async fetchAvatarInfo(url, index) {
    if (!url) return;
    console.log(`Fetching avatar info for url: ${url} at index ${index}`);
    const db = wx.cloud.database();
    const _ = db.command;
    
    // Construct query conditions
    const conditions = [
      { coverUrl: url },
      { originUrl: url },
      { url: url }
    ];

    try {
      const decodedUrl = decodeURIComponent(url);
      if (decodedUrl !== url) {
        conditions.push({ coverUrl: decodedUrl });
        conditions.push({ originUrl: decodedUrl });
        conditions.push({ url: decodedUrl });
      }

      // Extract filename for loose matching
      const parts = decodedUrl.split('/');
      if (parts.length > 0) {
        const filename = parts[parts.length - 1];
        if (filename && (filename.includes('.') || filename.length > 10)) {
           const escapedFilename = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
           conditions.push({ coverUrl: db.RegExp({ regexp: escapedFilename + '$', options: 'i' }) });
           conditions.push({ originUrl: db.RegExp({ regexp: escapedFilename + '$', options: 'i' }) });
        }
      }
    } catch (e) {
      console.error('URL parse failed', e);
    }
    
    db.collection('resources').where(_.or(conditions)).get().then(res => {
      console.log(`Fetch avatar result for index ${index}:`, res.data);
      if (res.data && res.data.length > 0) {
        const item = res.data[0];
        const itemsList = this.data.itemsList;
        itemsList[index] = item;
        
        if (this.data.currentIndex === index) {
           this.setData({
             itemsList,
             currentAvatar: item,
           });
           // Explicitly update tag list after setting currentAvatar
           this.setData({
             tagList: this.getAvatarTagList() 
           });
           
           // 延迟补录浏览历史
           if (item && item._id) {
             recordBrowseHistory(item)
           }
        } else {
           this.setData({ itemsList });
        }
      } else {
        console.warn(`No avatar resource found for url: ${url}`);
      }
    }).catch(err => {
      console.error('Fetch avatar info failed', err);
    });
  },

  toggleShape() {
    this.setData({
      isCircular: !this.data.isCircular
    })
  },

  loadFavorites() {
    // 优先加载本地缓存
    try {
      const favorites = wx.getStorageSync('favorites') || []
      this.setData({ favorites })
    } catch (e) {
      console.error('加载本地收藏失败:', e)
    }

    // 同步云端数据
    const db = wx.cloud.database()
    const openid = wx.getStorageSync('openid')
    
    if (!openid) return

    db.collection('favorites').where({
      _openid: openid
    }).orderBy('createTime', 'desc').get().then(res => {
      if (res.data) {
        const cloudFavorites = res.data.map(item => ({
          url: item.url,
          type: item.type,
          timestamp: item.createTime ? new Date(item.createTime).getTime() : Date.now()
        }))
        
        this.setData({ favorites: cloudFavorites })
        wx.setStorageSync('favorites', cloudFavorites)
        this.checkFavorite()
      }
    }).catch(err => {
      console.error('加载云端收藏失败:', err)
    })
  },

  checkFavorite() {
    const isFavorite = this.data.favorites.some(item => item.url === this.data.currentUrl)
    this.setData({ isFavorite })
  },

  async toggleFavorite() {
    const { currentUrl, favorites, isFavorite, currentAvatar } = this.data
    
    if (!this.checkLogin()) {
      this.showLoginModal()
      return
    }

    // 确保有资源ID
    const id = await this.ensureResourceId()
    // 重新获取最新的 currentAvatar (ensureResourceId 可能更新了它)
    const updatedAvatar = this.data.currentAvatar || {}
    const resourceId = updatedAvatar._id || id || null

    if (isFavorite) {
      // Local
      const newFavorites = favorites.filter(item => item.url !== currentUrl)
      this.setData({ favorites: newFavorites, isFavorite: false })
      this.saveFavorites(newFavorites)

      // Cloud
      // 如果有ID，优先使用ID删除 (这样能触发热度更新)
      const removePromise = resourceId 
        ? removeFavorite(resourceId) 
        : removeFavorite(currentUrl, 'avatar')

      removePromise.then(res => {
        console.log('云端移除收藏成功')
      }).catch(err => {
        console.error('云端移除收藏失败:', err)
      })

      wx.showToast({ title: '已取消收藏', icon: 'none' })
    } else {
      // Local
      const newFavorite = { url: currentUrl, type: 'avatar', timestamp: Date.now() }
      const newFavorites = [newFavorite, ...favorites]
      this.setData({ favorites: newFavorites, isFavorite: true })
      this.saveFavorites(newFavorites)

      try {
        // Cloud
        await addFavorite(resourceId, 'avatar', currentUrl, currentAvatar ? currentAvatar.title : '')
        console.log('云端添加收藏成功')
      } catch (err) {
        console.error('云端添加收藏失败:', err)
        // 即使云端失败，本地状态已更新，不影响用户体验
      }

      wx.showToast({ title: '已收藏', icon: 'none' })
    }
  },

  saveFavorites(favorites) {
    try {
      wx.setStorageSync('favorites', favorites)
    } catch (e) {
      console.error('保存收藏失败:', e)
      wx.showToast({ title: '收藏失败', icon: 'none' })
    }
  },

  // 🔥 新增：点赞功能
  toggleLike() {
    const { isLiked, likeCount, currentAvatar } = this.data
    
    // 切换点赞状态
    const newIsLiked = !isLiked
    const newLikeCount = newIsLiked ? likeCount + 1 : likeCount - 1
    
    this.setData({
      isLiked: newIsLiked,
      likeCount: newLikeCount
    })
    
    // 提示用户
    wx.showToast({
      title: newIsLiked ? '已点赞' : '取消点赞',
      icon: 'none'
    })
  },

  showPoster() {
    this.setData({ showPosterModal: true })
  },

  hidePoster() {
    this.setData({ showPosterModal: false })
  },

  onMoreTap() {
    wx.showActionSheet({
      itemList: ['复制页面链接', '分享给好友'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.copyPagePath()
        } else if (res.tapIndex === 1) {
          this.showPoster()
        }
      }
    })
  },

  copyPagePath() {
    const { currentUrl, isAvatar } = this.data
    let path = '/subpackages/preview/preview'
    const params = []
    
    if (currentUrl) {
      params.push(`url=${encodeURIComponent(currentUrl)}`)
    }
    params.push(`isAvatar=${isAvatar || true}`)
    
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo && userInfo.openid) {
      params.push(`inviter=${userInfo.openid}`)
    }
    
    path = path + '?' + params.join('&')
    
    wx.setClipboardData({
      data: path,
      success: () => {
        wx.showToast({ title: '页面链接已复制', icon: 'success' })
      },
      fail: (err) => {
        console.error('复制链接失败:', err)
        wx.showToast({ title: '复制失败，请重试', icon: 'none' })
      }
    })
  },



  addDownloadRecord(record) {
    // Local
    try {
      const list = wx.getStorageSync('downloadHistory') || []
      const newItem = { ...record, time: Date.now() }
      const newList = [newItem, ...list].slice(0, 50)
      wx.setStorageSync('downloadHistory', newList)
    } catch (e) {
      console.error('保存下载记录失败', e)
    }

    // Cloud
    recordDownload(record, 'avatar').then(res => {
      console.log('云端添加下载记录成功')
    }).catch(err => {
      console.error('云端添加下载记录失败:', err)
    })
  },

  getSafeUrl(raw) {
    if (!raw) return ''
    let url = decodeURIComponent(raw)
    if (url.startsWith('//')) url = 'https:' + url
    if (url.startsWith('http:')) url = url.replace(/^http:/i, 'https:')
    if (!/^https?:\/\//i.test(url)) return ''
    return url
  },

  ensureAlbumPermission() {
    return new Promise((resolve) => {
      wx.getSetting({
        success: (res) => {
          const has = res.authSetting && res.authSetting['scope.writePhotosAlbum']
          if (has) {
            resolve(true)
            return
          }
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success: () => resolve(true),
            fail: () => {
              wx.showModal({
                title: '提示',
                content: '需要您授权保存图片到相册',
                confirmText: '去授权',
                cancelText: '取消',
                success: (r) => {
                  if (r.confirm) {
                    wx.openSetting({
                      success: (settingRes) => {
                        const granted = !!(settingRes.authSetting && settingRes.authSetting['scope.writePhotosAlbum'])
                        resolve(granted)
                      },
                      fail: () => resolve(false)
                    })
                  } else {
                    resolve(false)
                  }
                }
              })
            }
          })
        },
        fail: () => resolve(false)
      })
    })
  },

  pickUrl() {
    const avatar = this.data.currentAvatar || {}
    // 优先使用 rawUrl (通常是 cloud://)，然后是 cloud:// 链接 (originUrl/url/coverUrl)，最后使用 https (currentUrl)
    const candidates = [this.data.rawUrl, avatar.originUrl, avatar.url, avatar.coverUrl, this.data.currentUrl]
    for (const c of candidates) {
      if (c) return c
    }
    return ''
  },

  async ensureResourceId() {
    const { currentAvatar, currentUrl, currentIndex } = this.data
    if (currentAvatar && currentAvatar._id) {
      return currentAvatar._id
    }

    if (!currentUrl) return null

    // 如果正在获取中，等待
    if (this.fetchingInfoPromise) {
      return this.fetchingInfoPromise
    }

    console.log('Resource ID missing, fetching by URL...', currentUrl)
    
    this.fetchingInfoPromise = new Promise(async (resolve) => {
      try {
        const item = await findResourceByUrl(currentUrl)
        if (item) {
          console.log('Resource found:', item._id)
          // 更新当前数据
          const itemsList = this.data.itemsList
          itemsList[currentIndex] = item
          
          this.setData({
            itemsList,
            currentAvatar: item,
            tagList: this.getAvatarTagList(item)
          })
          resolve(item._id)
        } else {
          console.warn('Resource not found for URL:', currentUrl)
          resolve(null)
        }
      } catch (e) {
        console.error('ensureResourceId error:', e)
        resolve(null)
      } finally {
        this.fetchingInfoPromise = null
      }
    })

    return this.fetchingInfoPromise
  },

  async checkRewardAdEnabled() {
    const cache = wx.getStorageSync('rewardAdEnabled_cache')
    if (cache && Date.now() - cache.time < 60000) {
      return cache.enabled
    }
    try {
      const res = await wx.cloud.callFunction({
        name: 'getConfig',
        data: { key: 'rewardAdEnabled' }
      })
      const enabled = res.result?.data?.value !== false
      wx.setStorageSync('rewardAdEnabled_cache', { enabled, time: Date.now() })
      return enabled
    } catch (e) {
      return true
    }
  },

  async downloadImage() {
    console.log('downloadImage 被点击')
    if (!this.checkLogin()) {
      console.log('用户未登录，显示登录弹窗')
      this.showLoginModal()
      return
    }

    const that = this

    try {
      console.log('开始获取下载状态')
      const rewardAdEnabled = await this.checkRewardAdEnabled()
      console.log('激励广告开关状态:', rewardAdEnabled)

      let adResult
      if (!rewardAdEnabled) {
        adResult = { success: true, method: 'free' }
      } else {
        adResult = await this.ensureRewardedForFirstDownload()
      }
      console.log('ensureRewardedForFirstDownload done, result:', adResult)

      if (!adResult.success) {
        console.log('广告未完成，取消下载')
        return
      }

      if (adResult.method === 'free') {
        that.doDownload(true, 'free')
      } else if (adResult.method === 'member') {
        that.doDownload(true, 'member')
      } else {
        that.doDownload(false, 'points')
      }
    } catch (e) {
      console.error('检查下载状态失败:', e)
      that.doDownload(true)
    }
  },

  async doDownload(isFree = false, downloadMethod = 'points') {
    const that = this
    console.log('doDownload 开始执行')
    
    await this.ensureResourceId()
    console.log('ensureResourceId 完成')

    const hasAlbumPermission = await this.ensureAlbumPermission()
    console.log('相册权限:', hasAlbumPermission)
    if (!hasAlbumPermission) {
      console.log('没有相册权限')
      return
    }
    const rawUrl = this.pickUrl()
    console.log('图片地址:', rawUrl)
    if (!rawUrl) {
      wx.showToast({ title: '图片地址缺失', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...', mask: true })

    if (rawUrl.startsWith('cloud://')) {
      console.log('使用云文件下载')
      wx.cloud.downloadFile({
        fileID: rawUrl,
        success(res) {
          if (res.statusCode === 200) {
            that.saveToAlbum(res.tempFilePath, rawUrl, downloadMethod)
          } else {
            wx.hideLoading()
            wx.showToast({ title: '下载云文件失败', icon: 'none' })
          }
        },
        fail(err) {
          wx.hideLoading()
          console.error('cloud.downloadFile fail:', err)
          wx.showToast({ title: '下载云文件失败: ' + (err.errMsg || '未知错误'), icon: 'none' })
        }
      })
      return
    }

    const url = this.getSafeUrl(rawUrl)
    if (!url) {
      wx.showToast({ title: '图片地址无效', icon: 'none' })
      return
    }

    let ext = '.jpg'
    if (url.includes('.png')) ext = '.png'
    else if (url.includes('.gif')) ext = '.gif'
    else if (url.includes('.webp')) ext = '.webp'
    
    wx.downloadFile({
      url,
      success(res) {
        if (res.statusCode === 200) {
          const tempFilePath = res.filePath || res.tempFilePath
          that.saveToAlbum(tempFilePath, url, downloadMethod)
        } else {
          that.tryProxyDownload(url, downloadMethod)
        }
      },
      fail(err) {
        console.warn('wx.downloadFile fail, trying proxy:', err)
        that.tryProxyDownload(url, downloadMethod)
      }
    })
  },

  // 辅助方法：保存文件到相册
  saveToAlbum(tempFilePath, originalUrl, downloadMethod = 'points') {
    const that = this
    
    // 尝试修正文件后缀，防止 saveImageToPhotosAlbum 因无后缀报错
    const fs = wx.getFileSystemManager()
    let finalPath = tempFilePath

    try {
      // 简单判断后缀
      let ext = '.jpg'
      if (originalUrl.includes('.png')) ext = '.png'
      else if (originalUrl.includes('.gif')) ext = '.gif'
      else if (originalUrl.includes('.webp')) ext = '.webp'
      
      // 使用 wx.env.USER_DATA_PATH 临时目录，避免触发文件监听器导致重编译
      // 如果临时文件没有后缀，手动重命名（复制）
      if (!tempFilePath.match(/\.[a-zA-Z0-9]+$/) || tempFilePath.indexOf(wx.env.USER_DATA_PATH) === -1) {
        const newPath = `${wx.env.USER_DATA_PATH}/${Date.now()}_${Math.random().toString(36).substr(2)}${ext}`
        fs.saveFileSync(tempFilePath, newPath)
        finalPath = newPath
      }
    } catch (e) {
      console.error('修正文件后缀失败，尝试直接保存', e)
    }

    wx.saveImageToPhotosAlbum({
      filePath: finalPath,
      success: () => {
        wx.hideLoading()
        const currentAvatar = that.data.currentAvatar || {}
        that.addDownloadRecord({ 
          url: originalUrl, 
          type: 'avatar',
          id: currentAvatar._id, // Pass ID to trigger hotScore update
          downloadMethod: downloadMethod
        })
        wx.showToast({ 
          title: '已保存到相册', 
          icon: 'success',
          duration: 2000
        })
        // 清理临时文件
        if (finalPath !== tempFilePath) {
          try { fs.unlinkSync(finalPath) } catch(e) {}
        }
      },
      fail(err) {
        // 清理临时文件
        if (finalPath !== tempFilePath) {
          try { fs.unlinkSync(finalPath) } catch(e) {}
        }

        wx.hideLoading()
        if (err.errMsg && err.errMsg.includes('auth')) {
          wx.showModal({
            title: '提示',
            content: '需要您授权保存图片到相册',
            confirmText: '去授权',
            success(res) {
              if (res.confirm) {
                wx.openSetting({
                  success(settingRes) {
                    if (settingRes.authSetting['scope.writePhotosAlbum']) {
                      that.downloadImage()
                    }
                  }
                })
              }
            }
          })
        } else {
          // 上报错误日志
          reportError({
            message: 'saveToAlbum fail',
            detail: err,
            type: 'download_error'
          })
          
          // 仅提示失败，不再显示复制按钮
          wx.showModal({
            title: '保存失败',
            content: '图片保存失败，请稍后重试',
            showCancel: false,
            confirmText: '知道了'
          })
        }
      }
    })
  },

  // 辅助方法：尝试使用云函数代理下载
  tryProxyDownload(url, downloadMethod = 'points') {
    const that = this
    wx.cloud.callFunction({
      name: 'proxyDownload',
      data: { url }
    }).then(cfRes => {
      const result = cfRes && cfRes.result
      if (result && result.success && result.fileID) {
        wx.cloud.downloadFile({
          fileID: result.fileID,
          success(res2) {
            that.saveToAlbum(res2.tempFilePath, url, downloadMethod)
          },
          fail(e2) {
            wx.hideLoading()
            wx.showToast({ title: '代理下载失败', icon: 'none' })
          }
        })
      } else {
        wx.hideLoading()
        console.error('proxyDownload result error:', result)
        wx.showToast({ 
          title: (result && result.message) || '下载失败', 
          icon: 'none',
          duration: 3000
        })
      }
    }).catch((err) => {
      wx.hideLoading()
      console.error('proxyDownload call fail:', err)
      wx.showToast({ 
        title: '云函数调用失败: ' + (err.errMsg || err.message || '未知错误'), 
        icon: 'none',
        duration: 3000
      })
    })
  },



  onTagTap(e) {
    const tag = e.currentTarget.dataset.tag
    if (!tag) return
    wx.navigateTo({
      url: `/subpackages/search/search?type=avatar&tag=${encodeURIComponent(tag)}`
    })
  },

  onRecommendTap(e) {
    const url = e.currentTarget.dataset.url
    const index = this.data.imageList.indexOf(url)
    if (index !== -1) {
      this.setData({ currentIndex: index, currentUrl: url })
      // 滚动到顶部
      wx.pageScrollTo({ scrollTop: 0, duration: 300 })
    } else {
      const newImageList = [...this.data.imageList]
      newImageList[this.data.currentIndex] = url
      this.setData({ imageList: newImageList, currentUrl: url, loadedImages: {} })
      // 滚动到顶部
      wx.pageScrollTo({ scrollTop: 0, duration: 300 })
    }
    this.checkFavorite()
  },



  onShareAppMessage() {
    const { currentUrl, currentIndex, imageList, isAvatar, currentAvatar } = this.data
    const title = currentAvatar?.title || '发现了一个超好看的头像'
    return {
      title: title,
      path: `/subpackages/preview/preview?url=${encodeURIComponent(currentUrl)}&isAvatar=${isAvatar}&currentIndex=${currentIndex}&imageList=${encodeURIComponent(JSON.stringify(imageList))}`,
      imageUrl: currentUrl
    }
  },

  onShareTimeline() {
    const { currentUrl, currentAvatar } = this.data
    return {
      title: currentAvatar?.title || '发现了一个超好看的头像',
      query: `url=${encodeURIComponent(currentUrl)}&isAvatar=${this.data.isAvatar}`,
      imageUrl: currentUrl
    }
  }
})
