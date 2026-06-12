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
    type: 'wallpaper',
    previewPath: '/subpackages/wallpaper-preview/wallpaper-preview',
    showLoginModal: false,
    isLoginLoading: false,
    _isHiding: false,
    theme: 'light',
    statusBarHeight: 20,
    navBarHeight: 44,
    currentUrl: '',
    imageList: [],
    currentIndex: 0,
    isFavorite: false,
    favorites: [],
    showPageIndicator: false,
    loadedImages: {},
    iconStarOn: '',
    iconStarOff: '',
    iconDownload: '',
    iconShare: '',
    iconBack: '',
    iconHome: '',
    iconEdit: '',
    tagList: [],
    similarList: [],
    itemsList: [],
    
    // Simulation
    showSimulation: false,
    simMode: 'lock', // 'lock' or 'home'
    simTime: '09:41',
    simDate: '1月1日 星期一',
    showPosterModal: false,
    // 底部原生广告
    bottomNativeVideoAd: null,
    showBottomNativeAd: false,
    
    // 新增：互动数据
    viewCount: 0,
    viewCountText: '0',
    likeCount: 0,
    likeCountText: '0',
    isLiked: false,
    hotScore: 0,
    hotScoreText: '0',
    isDownloading: false, // 防重复下载锁
  },

  onShow() {
    this.setData({ _isHiding: false })
    getApp().logEvent('pv', { page: 'wallpaper-preview' })
    this.updateSimTime()
    this.syncTheme()
    // 🔥 插屏广告：延迟执行，不阻塞页面切换
    setTimeout(() => {
      try {
        interstitialAdManager.smartTriggerInterstitialAd(2000)
      } catch (e) {}
    }, 500)
  },

  updateSimTime() {
    const now = new Date()
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    const month = now.getMonth() + 1
    const date = now.getDate()
    const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    const day = weekDays[now.getDay()]
    
    this.setData({
      simTime: `${hours}:${minutes}`,
      simDate: `${month}月${date}日 ${day}`
    })
  },

  toggleSimulation() {
    this.setData({
      showSimulation: !this.data.showSimulation
    })
    if (this.data.showSimulation) {
      this.updateSimTime()
    }
  },

  // 根据资源数据计算互动数据
  // - 热度值：真实数据
  // - 浏览量：根据热度值按比例生成，上限2000
  // - 点赞数：基于浏览量按比例生成（点赞率 3%~10%）
  // - 每日增量：每天在昨天基础上增加，保证只增不减

  // 根据字符串生成固定数值（用于生成稳定随机因子）

  // 格式化数字显示

  setSimMode(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ simMode: mode })
  },

  noop() {},

  previewImage() {
    const currentUrl = this.data.imageList[this.data.currentIndex]
    wx.previewImage({
      current: currentUrl,
      urls: this.data.imageList
    })
  },

  buildSimilarList() {
    // 获取当前壁纸的标签和分类，用于相似推荐
    const currentWallpaper = this.data.currentWallpaper || {}
    let rawTags = currentWallpaper.tags || []
    
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
    
    // 使用当前壁纸的标签进行相似推荐
    // 🔥 优化：增加推荐数量到 12
    return getResources({
      type: 'wallpaper',
      pageSize: 12,
      page: 1,
      sort: 'hot',
      // category: currentCategories.length > 0 ? currentCategories[0].name : undefined,
      tag: tags.length > 0 ? tags[0] : undefined
    }).then(res => {
      const similarList = (res.result.data || []).map(item => ({
        _id: item.id || item._id,
        url: item.url || item.coverUrl || item.originUrl || '',
        coverUrl: item.coverUrl,
        originUrl: item.originUrl || '',
        title: item.title || '',
        categories: item.categories || [],
        tags: item.tags || [],
        views: item.views || 0,
        favorites: item.favorites || 0,
        hotScore: item.hotScore || 0,
        category: item.categories && item.categories.length > 0 ? item.categories[0].name : '相似壁纸'
      })).filter(item => item.url)
      
      return similarList
    }).catch(error => {
      console.error('获取相似壁纸失败:', error)
      return []
    })
  },


  async handleLogin() {
    this.setData({ isLoginLoading: true })
    
    try {
      const userInfo = await wx.getUserProfile({ desc: '用于登录' })
      
      await loginWithProfile({
        nickName: userInfo.userInfo.nickName,
        avatarUrl: userInfo.userInfo.avatarUrl
      })
      
      this.setData({ 
        showLoginModal: false,
        isLoginLoading: false 
      })
      wx.showToast({ title: '登录成功', icon: 'success' })
      
      this.loadFavorites()
    } catch (err) {
      console.error('登录流程异常:', err)
      this.setData({ isLoginLoading: false })
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    }
  },

  onLoad(options) {
    // 合并 initNavBar + getIconSet -> 1 次 setData
    this._initViewData()
    this.handleThemeChange = this.handleThemeChange.bind(this)
    wx.onThemeChange(this.handleThemeChange)
    
    // 初始化插屏广告管理器
    interstitialAdManager.initInterstitialAd('/subpackages/wallpaper-preview/wallpaper-preview')
    this.initBottomNativeAd()

    const { url, currentIndex, imageList: listParam, wallpaperData, rawUrl } = options

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
        loadedImages: {},
        rawUrl: rawUrl ? decodeURIComponent(rawUrl) : ''
      })
      
      // 设置当前壁纸的完整数据
      let itemsList = new Array(imageList.length).fill(null);
      let parsedWallpaperData = null;

      if (wallpaperData) {
        try {
          const decodedWallpaperData = decodeURIComponent(wallpaperData)
          parsedWallpaperData = JSON.parse(decodedWallpaperData)
          console.log('预览页面加载参数:', options)
          console.log('当前壁纸数据:', parsedWallpaperData)
          
          const currentUrl = parsedWallpaperData.url || parsedWallpaperData.imageUrl || ''
          const stats = this._computeInteractionData(parsedWallpaperData, currentUrl)

          this.setData({
            currentWallpaper: parsedWallpaperData,
            viewCount: stats.viewCount,
            viewCountText: this._formatCount(stats.viewCount),
            likeCount: stats.likeCount,
            likeCountText: this._formatCount(stats.likeCount),
            hotScore: stats.hotScore,
            hotScoreText: this._formatCount(stats.hotScore)
          })
          itemsList[index] = parsedWallpaperData;
          
          if (parsedWallpaperData) {
            recordBrowseHistory(parsedWallpaperData)
          }
        } catch (e) {
          console.error('解析壁纸数据失败:', e)
        }
      }
      
      // 合并 itemsList + tagList -> 1 次 setData
      this.setData({
        itemsList,
        tagList: this.getWallpaperTagList(parsedWallpaperData)
      })
      // 如果当前项没有数据，或者数据中没有标签（例如从收藏/下载列表进入），尝试获取
      if ((!parsedWallpaperData || !parsedWallpaperData.tags || parsedWallpaperData.tags.length === 0) && imageList[index]) {
        this.fetchWallpaperInfo(imageList[index], index);
      }
      
      this.buildSimilarList().then(similarList => {
        // 将相似推荐合并到轮播列表
        const newImages = similarList.map(item => item.url);
        
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
      this.buildSimilarList().then(similarList => {
        this.setData({ similarList })
        this.loadFavorites()
        this.checkFavorite()
      })
    }
    // 🔥 延迟 2 秒预取下载配置，避免与 onLoad 中的广告初始化请求竞争
    setTimeout(() => this._prefetchDownloadConfig(), 2000)
  },

  async initBottomNativeAd() {
    try {
      const pages = getCurrentPages()
      const current = pages && pages.length ? pages[pages.length - 1] : null
      const route = current?.route || 'subpackages/wallpaper-preview/wallpaper-preview'
      const list = await fetchPageAds(route.startsWith('/') ? route : '/' + route)
      const nativeBottom = pickByType(list, 'native_bottom')[0] || null
      const bottomNativeVideo = (list || []).find(it => it.type === 'native_video' && (it.position === 'bottom' || !it.position) && it.isEnable) || null
      const chosenBottom = nativeBottom || bottomNativeVideo
      if (chosenBottom) {
        this.setData({ bottomNativeVideoAd: chosenBottom }, () => {
          this.maybeAutoShowBottomAd()
        })
      }
    } catch (e) {}
  },


  maybeAutoShowBottomAd() {
    if (!this.data.bottomNativeVideoAd || this.data.showBottomNativeAd) return
    const win = getWindowInfo()
    wx.createSelectorQuery()
      .select('.container')
      .boundingClientRect(rect => {
        if (!rect) return
        const threshold = 40
        if (rect.bottom <= win.windowHeight + threshold) {
          this.setData({ showBottomNativeAd: true })
        }
      })
      .exec()
  },
  
  onPageScroll(e) {
    if (!this.data.showBottomNativeAd && this.data.bottomNativeVideoAd && this.data.bottomNativeVideoAd.adUnitId) {
      if (!this._winH || !this._contentH) {
        const win = getWindowInfo()
        this._winH = win.windowHeight
        wx.createSelectorQuery()
          .select('.container')
          .boundingClientRect(rect => {
            if (rect) this._contentH = rect.bottom
          })
          .exec()
      } else {
        const near = e.scrollTop + this._winH + 40 >= this._contentH
        if (near) this.setData({ showBottomNativeAd: true })
      }
    }
  },
  
  onRewarded(e) {
    console.log('[AD][Rewarded][WP] onRewarded:', e.detail)

  },
  
  ensureRewardedForFirstDownload() {
    const that = this
    let adResult = { success: false, method: 'points' }
    
    return new Promise(async (resolve) => {
      try {
        const statusRes = await wx.cloud.callFunction({
          name: 'userPoints',
          data: { action: 'getDownloadStatus', resourceType: 'wallpaper' }
        })
        if (!that) return resolve(adResult)
        
        const status = statusRes.result && statusRes.result.success ? statusRes.result.data : null
        console.log('[AD][Rewarded][WP] getDownloadStatus:', status)
        
        if (!status) {
          // 无法获取状态，用积分
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
                // 用户选择观看广告
                const rewardedAdComponent = that.selectComponent('#rewardedAd')
                if (rewardedAdComponent) {
                  console.log('[AD][Rewarded][WP] show rewarded ad')
                  const result = await rewardedAdComponent.showRewarded()
                  
                  // 广告观看成功
                  if (result.success) {
                    adResult = { success: true, method: 'free' }
                    // 🔥 广告看完立即调用云函数记录，不等文件下载完成，防止二次点击时 recordDownload 还未写入导致重复弹窗
                    wx.cloud.callFunction({
                      name: 'userPoints',
                      data: { action: 'recordDownload', downloadMethod: 'free', resourceType: 'wallpaper' }
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
              // 返回结果
              resolve(adResult)
            }
          })
        } catch (e) {
          console.log('[AD][Rewarded][WP] ad show failed:', e)
          resolve(adResult)
        }
      } catch (e) {
        console.log('[AD][Rewarded][WP] getDownloadStatus failed:', e)
        resolve(adResult)
      }
    })
  },

  getWallpaperTagList(item) {
    const currentWallpaper = item || this.data.currentWallpaper || {}
    let rawTags = currentWallpaper.tags || []
    
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

    const colors = ['primary', 'secondary', 'blue', 'orange', 'purple', 'teal']
    
    return tags.map((tag, index) => ({
      label: tag,
      type: colors[index % colors.length]
    }))
  },

  async fetchWallpaperInfo(url, index) {
    if (!url) return;
    
    try {
      const item = await findResourceByUrl(url)
      
      // 检查页面是否已卸载
      if (this.data._isHiding) {
        console.log('[wallpaper-preview] 页面已卸载，跳过数据更新')
        return
      }
      
      if (item) {
        // 更新 itemsList
        const itemsList = this.data.itemsList;
        itemsList[index] = item;
        
        // 如果当前还在查看这张图，则更新视图
        if (this.data.currentIndex === index) {
           const url = item.url || item.coverUrl || ''
           const stats = this._computeInteractionData(item, url)

           // 再次检查页面状态
           if (this.data._isHiding) {
             console.log('[wallpaper-preview] 页面已卸载，跳过 setData')
             return
           }
           
           this.setData({
             itemsList,
             currentWallpaper: item,
             tagList: this.getWallpaperTagList(item),
             viewCount: stats.viewCount,
             viewCountText: this._formatCount(stats.viewCount),
             likeCount: stats.likeCount,
             likeCountText: this._formatCount(stats.likeCount),
             hotScore: stats.hotScore,
             hotScoreText: this._formatCount(stats.hotScore)
           });
           
           // 更新相似推荐
           this.buildSimilarList().then(similarList => {
             // 再次检查页面状态
             if (this.data._isHiding) {
               console.log('[wallpaper-preview] 页面已卸载，跳过相似推荐更新')
               return
             }
             this.setData({ similarList })
           })
           
           // 延迟补录浏览历史
           if (item && item._id) {
             recordBrowseHistory(item)
           }
        } else {
           // 再次检查页面状态
           if (this.data._isHiding) {
             console.log('[wallpaper-preview] 页面已卸载，跳过 itemsList 更新')
             return
           }
           this.setData({ itemsList });
        }
      } else {
        console.warn(`No resource found for url: ${url}`);
      }
    } catch (err) {
      console.error('Fetch wallpaper info failed', err);
    }
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
    this.setData({ loadedImages })
  },

  onImageTap(e) {
    const now = Date.now()
    const lastTap = this.lastTapTime || 0
    const gap = now - lastTap
    
    if (gap > 0 && gap < 300) {
      // Double tap detected
      this.toggleFavorite()
    }
    
    this.lastTapTime = now
  },

  onRecommendTap(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return

    // 在当前图片列表中查找
    let index = this.data.imageList.indexOf(url)

    if (index !== -1) {
      // 如果找到了，直接切换并滚动到顶部
      this.setData({ currentIndex: index })
      // 滚动到顶部
      wx.pageScrollTo({ scrollTop: 0, duration: 300 })
      // 手动触发 swiper change 逻辑以更新状态
      this.onSwiperChange({ detail: { current: index } })
    } else {
      // 如果没找到，追加并切换
      const newImageList = [...this.data.imageList, url]
      const newItemsList = [...this.data.itemsList, null] // 占位
      const newIndex = newImageList.length - 1
      
      this.setData({
        imageList: newImageList,
        itemsList: newItemsList,
        currentIndex: newIndex
      })
      
      // 滚动到顶部
      wx.pageScrollTo({ scrollTop: 0, duration: 300 })
      this.onSwiperChange({ detail: { current: newIndex } })
    }
  },

  onTagTap(e) {
    const tag = e.currentTarget.dataset.tag
    if (!tag) return
    
    wx.navigateTo({
      url: `/subpackages/resource-list/resource-list?tag=${encodeURIComponent(tag)}&title=${encodeURIComponent(tag)}`
    })
  },


  onTouchStart(e) {
    this.setData({ showPageIndicator: true })
    this.touchStartX = e.touches[0].clientX
    this.touchStartY = e.touches[0].clientY
  },

  onTouchEnd(e) {
    if (this.hideTimer) clearTimeout(this.hideTimer)
    this.hideTimer = setTimeout(() => {
      this.setData({ showPageIndicator: false })
    }, 2000)
    
    this.touchEndX = e.changedTouches[0].clientX
    this.touchEndY = e.changedTouches[0].clientY
    
    const deltaX = this.touchEndX - this.touchStartX
    const deltaY = this.touchEndY - this.touchStartY
    
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
      this.slideDirection = deltaX > 0 ? 'right' : 'left'
    }
  },

  async onSwiperChange(e) {
    const index = e.detail.current
    const previous = this.data.currentIndex

    // 更新当前数据对象
    const currentItem = this.data.itemsList[index];
    
    // Check if we need to fetch data: 
    // 1. Item doesn't exist
    // 2. Item exists but has no tags (and we expect tags)
    const needsFetch = !currentItem || (!currentItem.tags || currentItem.tags.length === 0);

    // 合并 stats + navigation -> 1 次 setData
    const patch = {
      currentIndex: index,
      currentUrl: this.data.imageList[index],
      rawUrl: '',
      showPageIndicator: true
    }

    if (currentItem) {
      const url = currentItem.url || currentItem.coverUrl || ''
      const stats = this._computeInteractionData(currentItem, url)

      const loadedImages = { ...this.data.loadedImages }
      loadedImages[index] = false
      
      Object.assign(patch, {
        currentWallpaper: currentItem,
        viewCount: stats.viewCount,
        viewCountText: this._formatCount(stats.viewCount),
        likeCount: stats.likeCount,
        likeCountText: this._formatCount(stats.likeCount),
        hotScore: stats.hotScore,
        hotScoreText: this._formatCount(stats.hotScore),
        tagList: this.getWallpaperTagList(currentItem),
        loadedImages
      })
      
      setTimeout(() => {
        this.setData({
          [`loadedImages.${index}`]: true
        })
      }, 50)
      
      if (this.browseTimer) clearTimeout(this.browseTimer)
      this.browseTimer = setTimeout(() => {
        if (currentItem && currentItem._id) {
          recordBrowseHistory(currentItem)
        }
      }, 1000)
    } else {
      Object.assign(patch, {
        tagList: [],
        currentWallpaper: {},
        viewCount: 0,
        viewCountText: '0',
        likeCount: 0,
        likeCountText: '0',
        hotScore: 0,
        hotScoreText: '0'
      })
    }

    this.setData(patch)

    if (needsFetch) {
      const currentUrl = this.data.imageList[index];
      if (currentUrl) {
        this.fetchWallpaperInfo(currentUrl, index);
      }
    }
    this.checkFavorite()

    if (this.hideTimer) clearTimeout(this.hideTimer)
    this.hideTimer = setTimeout(() => {
      this.setData({ showPageIndicator: false })
    }, 2000)
    
    this.slideDirection = index > previous ? 'left' : 'right'
  },

  loadFavorites() {
    // 优先加载本地缓存
    try {
      const favorites = getStorage('favorites') || []
      this.setData({ favorites })
    } catch (e) {
      console.error('加载本地收藏失败:', e)
    }

    // 同步云端数据
    getFavorites('all', 1, 100).then(res => {
      if (res.data) {
        const cloudFavorites = res.data.map(item => ({
          url: item.url,
          type: item.type,
          timestamp: item.createTime ? new Date(item.createTime).getTime() : Date.now()
        }))
        
        // 更新本地存储和页面数据
        this.setData({ favorites: cloudFavorites })
        setStorage('favorites', cloudFavorites)
        this.checkFavorite()
      }
    }).catch(err => {
      console.error('加载云端收藏失败:', err)
    })
  },

  checkFavorite() {
    const isFavorite = this.data.favorites.some(item => item.url === this.data.currentUrl && item.type === 'wallpaper')
    this.setData({ isFavorite })
  },

  async toggleFavorite() {
    if (!this.checkLogin()) {
      this.showLoginModal()
      return
    }

    // 确保有资源ID
    const id = await this.ensureResourceId()
    const { currentUrl, favorites, isFavorite, currentWallpaper } = this.data
    // 尝试获取资源ID
    const resourceId = currentWallpaper && currentWallpaper._id ? currentWallpaper._id : (id || null)

    if (isFavorite) {
      // 本地移除
      const newFavorites = favorites.filter(item => item.url !== currentUrl)
      this.setData({ favorites: newFavorites, isFavorite: false })
      this.saveFavorites(newFavorites)
      
      // 云端移除
          // 如果有ID，优先使用ID删除 (这样能触发热度更新)
      const removePromise = resourceId 
        ? removeFavorite(resourceId) 
        : removeFavorite(currentUrl, 'wallpaper')

      removePromise.then(res => {
        console.log('云端移除收藏成功')
      }).catch(err => {
        console.error('云端移除收藏失败:', err)
      })

      wx.showToast({ title: '已取消收藏', icon: 'none' })
    } else {
      // 本地添加
      const newFavorite = { url: currentUrl, type: 'wallpaper', timestamp: Date.now() }
      const newFavorites = [newFavorite, ...favorites]
      this.setData({ favorites: newFavorites, isFavorite: true })
      this.saveFavorites(newFavorites)

      try {
        // 云端添加
        await addFavorite(resourceId, 'wallpaper', currentUrl, currentWallpaper ? currentWallpaper.title : '')
        console.log('云端添加收藏成功')
      } catch (err) {
        console.error('云端添加收藏失败:', err)
        // 即使云端失败，本地状态已更新，不影响用户体验
      }

      wx.showToast({ title: '已收藏', icon: 'none' })
    }
  },


  // 新增：点赞功能
  toggleLike() {
    const { isLiked, likeCount } = this.data
    
    // 切换点赞状态
    const newIsLiked = !isLiked
    const newLikeCount = newIsLiked ? likeCount + 1 : likeCount - 1
    
    this.setData({
      isLiked: newIsLiked,
      likeCount: newLikeCount,
      likeCountText: this._formatCount(newLikeCount)
    })
    
    // 提示用户
    wx.showToast({
      title: newIsLiked ? '已点赞' : '取消点赞',
      icon: 'none'
    })
  },

  // 新增：显示评论弹窗


  copyPagePath() {
    const { currentUrl } = this.data
    let path = '/subpackages/wallpaper-preview/wallpaper-preview'
    const params = []
    
    if (currentUrl) {
      params.push(`url=${encodeURIComponent(currentUrl)}`)
    }
    
    const userInfo = getStorage('userInfo')
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

  onShareAppMessage() {
    return {
      title: '发现了一个超好看的壁纸',
      path: `/subpackages/wallpaper-preview/wallpaper-preview?url=${encodeURIComponent(this.data.currentUrl)}`,
      imageUrl: this.data.currentUrl
    }
  },

  onShareTimeline() {
    return {
      title: '发现了一个超好看的壁纸',
      imageUrl: this.data.currentUrl
    }
  },

  addDownloadRecord(record) {
    // Local - 基于url去重，同一资源不重复记录
    try {
      const list = getStorage('downloadHistory') || []
      // 去重：如果已存在相同 url 的记录，先移除旧的
      const filteredList = list.filter(item => item.url !== record.url)
      const newItem = { ...record, time: Date.now() }
      const newList = [newItem, ...filteredList].slice(0, 50)
      setStorage('downloadHistory', newList)
    } catch (e) {
      console.error('保存下载记录失败', e)
    }

    // Cloud
    recordDownload(record, 'wallpaper').then(res => {
      console.log('云端添加下载记录成功')
    }).catch(err => {
      console.error('云端添加下载记录失败:', err)
    })
  },


  pickUrl() {
    const wp = this.data.currentWallpaper || {}
    // 优先使用传递过来的 rawUrl (通常是 cloud://)，然后是 wp 对象中的 cloud:// 链接，最后是 https
    const candidates = [this.data.rawUrl, wp.originUrl, wp.url, wp.coverUrl, this.data.currentUrl]
    for (const c of candidates) {
      if (c) return c
    }
    return ''
  },

  async ensureResourceId() {
    const { currentWallpaper, currentUrl, currentIndex } = this.data
    if (currentWallpaper && currentWallpaper._id) {
      return currentWallpaper._id
    }

    if (!currentUrl) return null

    // 如果正在获取中，等待
    if (this.fetchingInfoPromise) {
      return this.fetchingInfoPromise
    }

    console.log('Wallpaper ID missing, fetching by URL...', currentUrl)
    
    this.fetchingInfoPromise = new Promise(async (resolve) => {
      try {
        const item = await findResourceByUrl(currentUrl)
        if (item) {
          console.log('Wallpaper found:', item._id)
          // 更新当前数据
          const itemsList = this.data.itemsList
          itemsList[currentIndex] = item
          
          const url = item.url || item.coverUrl || ''
          const stats = this._computeInteractionData(item, url)

          this.setData({
            itemsList,
            currentWallpaper: item,
            tagList: this.getWallpaperTagList(item),
            viewCount: stats.viewCount,
            viewCountText: this._formatCount(stats.viewCount),
            likeCount: stats.likeCount,
            likeCountText: this._formatCount(stats.likeCount),
            hotScore: stats.hotScore,
            hotScoreText: this._formatCount(stats.hotScore)
          })
          resolve(item._id)
        } else {
          console.warn('Wallpaper not found for URL:', currentUrl)
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
    const cache = getStorage('rewardAdEnabled_cache')
    if (cache && Date.now() - cache.time < 60000) {
      return cache.enabled
    }
    try {
      const res = await wx.cloud.callFunction({
        name: 'getConfig',
        data: { key: 'rewardAdEnabled' }
      })
      const enabled = res.result?.data?.value !== false
      setStorage('rewardAdEnabled_cache', { enabled, time: Date.now() })
      return enabled
    } catch (e) {
      return true
    }
  },

  async downloadImage() {
    console.log('[WP] downloadImage click')
    // 防重复点击：如果正在下载中，忽略本次点击
    if (this.data.isDownloading) {
      console.log('[WP] 正在下载中，忽略重复点击')
      return
    }
    this.setData({ isDownloading: true })
    
    // 🔥 埋点：下载开始
    getApp().logEvent('download_start', {
      type: 'wallpaper',
      url: this.data.currentUrl
    })

    try {
      if (!this.checkLogin()) {
        console.log('[WP] not logged in, show login modal')
        this.showLoginModal()
        this.setData({ isDownloading: false })
        return
      }

      const that = this

      try {
        console.log('[WP] ensureRewardedForFirstDownload start')
        const rewardAdEnabled = await this.checkRewardAdEnabled()
        console.log('激励广告开关状态', rewardAdEnabled)

        let adResult
        if (!rewardAdEnabled) {
          adResult = { success: true, method: 'free' }
        } else {
          adResult = await this.ensureRewardedForFirstDownload()
        }
        console.log('[WP] ensureRewardedForFirstDownload done, result:', adResult)

        if (!adResult.success) {
          console.log('[WP] ad not completed, cancel download')
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
        that.doDownload(false, 'points')
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
    console.log('[WP] doDownload start, isFree=', isFree, 'method=', downloadMethod)
    if (!this.checkLogin()) {
      console.log('[WP] not logged in, abort')
      this.showLoginModal()
      return
    }

    await this.ensureResourceId()
    console.log('[WP] ensureResourceId done')

    const that = this
    const hasAlbumPermission = await this.ensureAlbumPermission()
    console.log('[WP] album permission:', hasAlbumPermission)
    if (!hasAlbumPermission) {
      this.setData({ isDownloading: false })
      return
    }
    const rawUrl = this.pickUrl()
    console.log('[WP] picked url:', rawUrl)
    if (!rawUrl) {
      wx.showToast({ title: '图片地址缺失', icon: 'none' })
      this.setData({ isDownloading: false })
      return
    }

    if (!isFree) {
      try {
        const statusRes = await wx.cloud.callFunction({
          name: 'userPoints',
          data: { action: 'getDownloadStatus' }
        })
        const status = statusRes.result && statusRes.result.success ? statusRes.result.data : {}
        const downloadCost = status.downloadCost || status.pointsRequired || 6
        
        const deductRes = await wx.cloud.callFunction({
          name: 'userPoints',
          data: {
            action: 'deductPoints',
            amount: downloadCost,
            type: 'download',
            description: '下载消耗积分'
          }
        })
        
        if (!deductRes.result || !deductRes.result.success) {
          wx.showToast({ title: '积分扣除失败', icon: 'none' })
          return
        }
      } catch (e) {
        console.error('积分扣除失败:', e)
        wx.showToast({ title: '积分扣除失败', icon: 'none' })
        return
      }
    }

    wx.showLoading({ title: '保存中..', mask: true })

    // 处理 cloud:// 协议的云存储文件
    if (rawUrl.startsWith('cloud://')) {
      wx.cloud.downloadFile({
        fileID: rawUrl,
        success(res) {
          if (res.statusCode === 200) {
            that.saveToAlbum(res.tempFilePath, rawUrl, downloadMethod)
          } else {
            wx.hideLoading()
            that.setData({ isDownloading: false })
            wx.showToast({ title: '下载云文件失败', icon: 'none' })}
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

    // 处理普通 HTTP/HTTPS 链接
    let ext = '.jpg'
    if (url.includes('.png')) ext = '.png'
    else if (url.includes('.gif')) ext = '.gif'
    else if (url.includes('.webp')) ext = '.webp'
    
    // const filePath = `${wx.env.USER_DATA_PATH}/${Date.now()}${Math.random().toString(36).slice(2)}${ext}`
    wx.downloadFile({
      url,
      timeout: 30000,
      // filePath,
      success(res) {
        if (res.statusCode === 200) {
          const tempFilePath = res.filePath || res.tempFilePath
          that.saveToAlbum(tempFilePath, url, downloadMethod)
        } else {
          // 下载失败尝试代理
          that.tryProxyDownload(url, downloadMethod)
        }
      },
      fail(err) {
        // 下载失败尝试代理
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
        const wp = that.data.currentWallpaper || {}
        that.addDownloadRecord({
          url: originalUrl,
          type: 'wallpaper',
          id: wp._id, // Pass ID to trigger hotScore update
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
                      // 重新获取文件路径并保存到相册
                      const wp = that.data.currentWallpaper || {}
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
})

