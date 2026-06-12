import { getResources, addFavorite, removeFavorite, recordDownload, getFavorites, findResourceByUrl, recordBrowseHistory } from '../../utils/api.js'
import { loginWithProfile } from '../../utils/auth.js'
import { reportError } from '../../utils/logger.js'
import { fetchPageAds, pickByType } from '../../utils/adUtil.js'
import interstitialAdManager from '../../utils/interstitialAdManager.js'
import { getStorage, getTheme, getWindowInfo, setStorage } from '../../utils/storageManager.js'

const previewBase = require('../../behaviors/preview-base.js')
const previewCommon = require('../../behaviors/preview-common.js')

const APPID = 'wx78c0b02bd2db5462'

Page({
  behaviors: [previewBase, previewCommon],
  data: {
    type: 'avatar',
    previewPath: '/subpackages/preview/preview',
    showLoginModal: false,
    isLoginLoading: false,
    _isHiding: false,

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

    // 新增：互动数据
    viewCount: 0,
    viewCountText: '0',
    likeCount: 0,
    likeCountText: '0',
    isLiked: false,
    hotScore: 0,
    hotScoreText: '0',

    isDownloading: false, // 防重复下载锁

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
    maxTriggersPerSession: 3 // 每会话最多触发次数
  },

  onShow() {
    this.setData({ _isHiding: false })
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
        _id: item.id || item._id,
        url: item.url || item.coverUrl || item.originUrl,
        coverUrl: item.coverUrl,
        originUrl: item.originUrl,
        title: item.title,
        categories: item.categories,
        tags: item.tags || [],
        views: item.views || 0,
        favorites: item.favorites || 0,
        hotScore: item.hotScore || 0,
        category: item.categories && item.categories.length > 0 ? item.categories[0].name : '相似头像'
      }))
      
      return similarList
    }).catch(error => {
      console.error('获取相似头像失败:', error)
      return []
    })
  },


  async handleLogin() {
    this.setData({ isLoginLoading: true, modalError: '' })
    
    try {
      const userInfo = await wx.getUserProfile({ desc: '用于登录' })
      
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
    // 🔥 合并 initNavBar + syncTheme + getIconSet → 1 次 setData（减少 2 次调用）
    this._initViewData()
    this.handleThemeChange = this.handleThemeChange.bind(this)
    wx.onThemeChange(this.handleThemeChange)
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
          const stats = this._computeInteractionData(parsedAvatarData, currentUrl)

          this.setData({
            currentAvatar: parsedAvatarData,
            viewCount: stats.viewCount,
            viewCountText: this._formatCount(stats.viewCount),
            likeCount: stats.likeCount,
            likeCountText: this._formatCount(stats.likeCount),
            hotScore: stats.hotScore,
            hotScoreText: this._formatCount(stats.hotScore)
          })
          itemsList[index] = parsedAvatarData;
          console.log('当前头像数据:', parsedAvatarData)
          
          recordBrowseHistory(parsedAvatarData)
        } catch (e) {
          console.error('解析头像数据失败:', e)
        }
      }
      
      // 🔥 合并 itemsList + tagList → 1 次 setData（减少 1 次调用）
      this.setData({ itemsList, tagList: this.getAvatarTagList() });

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
             similarList: similarList,
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
    // 🔥 延迟 2 秒预取下载配置，避免与 onLoad 中的广告初始化请求竞争
    setTimeout(() => this._prefetchDownloadConfig(), 2000)
  },
  async loadPageAds() {
    try {
      const pages = getCurrentPages()
      const current = pages && pages.length ? pages[pages.length - 1] : null
      const route = current?.route || 'subpackages/preview/preview'
      const list = await fetchPageAds(route.startsWith('/') ? route : '/' + route)
      // 兼容两种类型：native_bottom 或 native_video（bottom位置）
      const nativeBottom = pickByType(list, 'native_bottom')[0] || null
      const bottomNativeVideo = (list || []).find(it => it.type === 'native_video' && (it.position === 'bottom' || !it.position) && it.isEnable) || null
      const chosenBottom = nativeBottom || bottomNativeVideo
      if (chosenBottom) {
        this.setData({ bottomNativeVideoAd: chosenBottom })
      }
    } catch (e) {}
  },


  onRewarded(e) {
    console.log('[AD][Rewarded] onRewarded:', e.detail)
  },
  
  ensureRewardedForFirstDownload() {
    const that = this
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
        
        // 首次下载：必须观看激励广告
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
                  const result = await rewardedAdComponent.showRewarded()
                  
                  if (result.success) {
                    adResult = { success: true, method: 'free' }
                    // 🔥 广告看完立即调用云函数记录，不等文件下载完成，防止二次点击时 recordDownload 还未写入导致重复弹窗
                    wx.cloud.callFunction({
                      name: 'userPoints',
                      data: { action: 'recordDownload', downloadMethod: 'free', resourceType: 'avatar' }
                    }).catch(() => {})
                  } else {
                    // 🔥 区分失败原因：未完整观看 vs 广告加载/播放失败
                    if (result.skipped) {
                      wx.showToast({ title: '需要完整观看广告才能下载', icon: 'none' })
                    } else if (result.error) {
                      wx.showToast({ title: result.error, icon: 'none' })
                    } else {
                      wx.showToast({ title: '广告加载失败，请稍后重试', icon: 'none' })
                    }
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

  onUnload() {
    this.onUnloadCommon()
    wx.offThemeChange && wx.offThemeChange(this.handleThemeChange)
    interstitialAdManager.destroy()
  },

  onImageLoad(e) {
    const index = e.currentTarget.dataset.index
    const loadedImages = { ...this.data.loadedImages }
    loadedImages[index] = true
    this.setData({ imageLoaded: true, loadedImages })
  },

  onTouchStart() { this.onTouchStartCommon() },
  onTouchEnd() { this.onTouchEndCommon() },

  async onSwiperChange(e) {
    const index = e.detail.current
    
    // 更新当前数据对象
    const currentItem = this.data.itemsList[index];
    
    // Check if we need to fetch data: 
    // 1. Item doesn't exist
    // 2. Item exists but has no tags (and we expect tags)
    const needsFetch = !currentItem || (!currentItem.tags || currentItem.tags.length === 0);

    // 🔥 合并 stats 数据 + navigation 数据 → 1 次 setData（减少 1 次调用）
    const patch = {
      currentIndex: index,
      currentUrl: this.data.imageList[index],
      rawUrl: '',
      showPageIndicator: true
    }

    if (currentItem) {
      const url = currentItem.url || currentItem.coverUrl || ''
      const stats = this._computeInteractionData(currentItem, url)
      Object.assign(patch, {
        currentAvatar: currentItem,
        viewCount: stats.viewCount,
        viewCountText: this._formatCount(stats.viewCount),
        likeCount: stats.likeCount,
        likeCountText: this._formatCount(stats.likeCount),
        hotScore: stats.hotScore,
        hotScoreText: this._formatCount(stats.hotScore),
        tagList: this.getAvatarTagList()
      })
      
      if (this.browseTimer) clearTimeout(this.browseTimer)
      this.browseTimer = setTimeout(() => {
        if (currentItem && currentItem._id) {
          recordBrowseHistory(currentItem)
        }
      }, 1000)
    } else {
      Object.assign(patch, {
        tagList: [],
        currentAvatar: {},
        viewCount: 0,
        viewCountText: '0',
        likeCount: 0,
        likeCountText: '0',
        hotScore: 0,
        hotScoreText: '0'
      })
    }

    this.setData(patch)
    this.checkFavorite()

    if (needsFetch) {
      const currentUrl = this.data.imageList[index];
      if (currentUrl) {
        this.fetchAvatarInfo(currentUrl, index);
      }
    }

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
    
    try {
      const item = await findResourceByUrl(url);
      
      if (this.data._isHiding) {
        console.log('[preview] 页面已卸载，跳过数据更新')
        return
      }
      
      if (item) {
        console.log(`Fetch avatar result for index ${index}:`, item);
        const itemsList = this.data.itemsList;
        itemsList[index] = item;
        
        if (this.data.currentIndex === index) {
           // 🔥 计算互动数据
           const itemUrl = item.url || item.coverUrl || ''
           const stats = this._computeInteractionData(item, itemUrl)
           
           // 再次检查页面状态
           if (this.data._isHiding) {
             console.log('[preview] 页面已卸载，跳过 setData')
             return
           }
           
           this.setData({
             itemsList,
             currentAvatar: item,
             tagList: this.getAvatarTagList(item),
             viewCount: stats.viewCount,
             viewCountText: this._formatCount(stats.viewCount),
             likeCount: stats.likeCount,
             likeCountText: this._formatCount(stats.likeCount),
             hotScore: stats.hotScore,
             hotScoreText: this._formatCount(stats.hotScore)
           });
           
           // 更新相似推荐
           const similarList = await this.buildSimilarList()
           
           // 再次检查页面状态
           if (this.data._isHiding) {
             console.log('[preview] 页面已卸载，跳过相似推荐更新')
             return
           }
           this.setData({ similarList })
           
           // 延迟补录浏览历史
           if (item && item._id) {
             recordBrowseHistory(item)
           }
        } else {
           // 再次检查页面状态
           if (this.data._isHiding) {
             console.log('[preview] 页面已卸载，跳过 itemsList 更新')
             return
           }
           this.setData({ itemsList });
        }
      } else {
        console.warn(`No avatar resource found for url: ${url}`);
      }
    } catch (err) {
      console.error('Fetch avatar info failed', err);
    }
  },

  toggleShape() {
    this.setData({
      isCircular: !this.data.isCircular
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
          
          const url = item.url || item.coverUrl || ''
          const stats = this._computeInteractionData(item, url)

          this.setData({
            itemsList,
            currentAvatar: item,
            tagList: this.getAvatarTagList(item),
            viewCount: stats.viewCount,
            viewCountText: this._formatCount(stats.viewCount),
            likeCount: stats.likeCount,
            likeCountText: this._formatCount(stats.likeCount),
            hotScore: stats.hotScore,
            hotScoreText: this._formatCount(stats.hotScore)
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

  async downloadImage() {
    console.log('downloadImage 被点击')
    // 防重复点击：如果正在下载中，忽略本次点击
    if (this.data.isDownloading) {
      console.log('[Preview] 正在下载中，忽略重复点击')
      return
    }
    this.setData({ isDownloading: true })
    
    // 🔥 埋点：下载开始
    getApp().logEvent('download_start', {
      type: this.data.isAvatar ? 'avatar' : 'wallpaper',
      url: this.data.currentUrl
    })

    try {
      if (!this.checkLogin()) {
        console.log('用户未登录，显示登录弹窗')
        this.showLoginModal()
        this.setData({ isDownloading: false })
        return
      }

      const that = this

      try {
        console.log('开始获取下载状态')
        const rewardAdEnabled = await this.checkRewardAdEnabled()
        console.log('激励广告开关状态', rewardAdEnabled)

        let adResult
        if (!rewardAdEnabled) {
          adResult = { success: true, method: 'free' }
        } else {
          adResult = await this.ensureRewardedForFirstDownload()
        }
        console.log('ensureRewardedForFirstDownload done, result:', adResult)

        if (!adResult.success) {
          console.log('广告未完成，取消下载')
          this.setData({ isDownloading: false })
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
        console.error('检查下载状态失败', e)
        that.doDownload(true)
      }
    } finally {
      // 安全兜底：15 秒后强制解锁，防止异常路径下 isDownloading 永不清除
      setTimeout(() => {
        if (this.data.isDownloading) {
          this.setData({ isDownloading: false })
        }
      }, 15000)
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
      this.setData({ isDownloading: false })
      return
    }
    const rawUrl = this.pickUrl()
    console.log('图片地址:', rawUrl)
    if (!rawUrl) {
      wx.showToast({ title: '图片地址缺失', icon: 'none' })
      this.setData({ isDownloading: false })
      return
    }

    wx.showLoading({ title: '保存中..', mask: true })

    if (rawUrl.startsWith('cloud://')) {
      console.log('使用云文件下载')
      wx.cloud.downloadFile({
        fileID: rawUrl,
        success(res) {
          if (res.statusCode === 200) {
            that.saveToAlbum(res.tempFilePath, rawUrl, downloadMethod)
          } else {
            wx.hideLoading()
            that.setData({ isDownloading: false })
            wx.showToast({ title: '下载云文件失败', icon: 'none' })
          }
        },
        fail(err) {
          wx.hideLoading()
          that.setData({ isDownloading: false })
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
      timeout: 30000,
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
        // 下载完成，立即解锁
        that.setData({ isDownloading: false })
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
        // 保存失败时也要解锁
        that.setData({ isDownloading: false })
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
                      // 授权成功后重新保存，不再走完整下载流程（避免重复扣积分/看广告）
                      const rawUrl = that.pickUrl()
                      if (rawUrl) {
                        const url = that.getSafeUrl(rawUrl)
                        if (url.startsWith('cloud://')) {
                          wx.cloud.downloadFile({
                            fileID: url,
                            success(res2) {
                              if (res2.statusCode === 200) {
                                that.saveToAlbum(res2.tempFilePath, url, downloadMethod)
                              }
                            }
                          })
                        } else {
                          wx.downloadFile({
                            url,
                            timeout: 30000,
                            success(res2) {
                              if (res2.statusCode === 200) {
                                that.saveToAlbum(res2.tempFilePath || res2.filePath, url, downloadMethod)
                              }
                            },
                            fail() {
                              wx.showToast({ title: '重新下载失败', icon: 'none' })
                            }
                          })
                        }
                      }
                    }
                  }
                })
              }
            }
          })
          // 上报错误日志
          reportError({
            message: 'saveToAlbum fail',
            detail: err,
            type: 'download_error'
          })
          
          // 非权限错误才提示保存失败（权限错误已在上方弹窗引导用户授权）
          if (!err.errMsg || !err.errMsg.includes('auth')) {
            wx.showToast({ title: '图片保存失败，请稍后重试', icon: 'none' })
          }
        }
      }
    })
  },

  // 辅助方法：尝试使用云函数代理下载


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
      // 找到对应项并更新互动数据
      const itemsList = this.data.itemsList
      const currentItem = itemsList[index]
      
      if (currentItem) {
        const itemUrl = currentItem.url || currentItem.coverUrl || ''
        const stats = this._computeInteractionData(currentItem, itemUrl)
        
        this.setData({ 
          currentIndex: index, 
          currentUrl: url,
          currentAvatar: currentItem,
          viewCount: stats.viewCount,
          viewCountText: this._formatCount(stats.viewCount),
          likeCount: stats.likeCount,
          likeCountText: this._formatCount(stats.likeCount),
          hotScore: stats.hotScore,
          hotScoreText: this._formatCount(stats.hotScore),
          tagList: this.getAvatarTagList(currentItem)
        })
      } else {
        this.setData({ currentIndex: index, currentUrl: url })
      }
      
      // 滚动到顶部
      wx.pageScrollTo({ scrollTop: 0, duration: 300 })
    } else {
      const newImageList = [...this.data.imageList]
      newImageList[this.data.currentIndex] = url
      
      // 构建新项的数据
      const similarItem = this.data.similarList.find(item => item.url === url)
      const newItem = similarItem || { url: url, coverUrl: url }
      const newItemsList = [...this.data.itemsList]
      newItemsList[this.data.currentIndex] = newItem
      
      if (newItem) {
        const itemUrl = newItem.url || newItem.coverUrl || ''
        const stats = this._computeInteractionData(newItem, itemUrl)
        
        this.setData({ 
          imageList: newImageList,
          currentUrl: url,
          itemsList: newItemsList,
          currentAvatar: newItem,
          viewCount: stats.viewCount,
          viewCountText: this._formatCount(stats.viewCount),
          likeCount: stats.likeCount,
          likeCountText: this._formatCount(stats.likeCount),
          hotScore: stats.hotScore,
          hotScoreText: this._formatCount(stats.hotScore),
          tagList: newItem.tags ? this.getAvatarTagList(newItem) : this.data.tagList
        })
      } else {
        this.setData({ imageList: newImageList, currentUrl: url, itemsList: newItemsList })
      }
      // 滚动到顶部
      wx.pageScrollTo({ scrollTop: 0, duration: 300 })
    }
    this.checkFavorite()
  },


  onShareAppMessage() {
    const { recordShareReward } = require('../../utils/shareReward.js')
    setTimeout(() => recordShareReward(), 500)
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

