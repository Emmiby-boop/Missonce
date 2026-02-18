import { getResources, addFavorite, removeFavorite, recordDownload, getFavorites, findResourceByUrl, recordBrowseHistory } from '../../utils/api.js'
import { loginWithProfile, checkLoginStatus } from '../../utils/auth.js'
import { reportError } from '../../utils/logger.js'

const APPID = 'wx78c0b02bd2db5462'

Page({
  data: {
    showLoginModal: false,
    isLoginLoading: false,
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
    showPosterModal: false
  },

  onShow() {
    getApp().logEvent('pv', { page: 'wallpaper-preview' })
    this.updateSimTime()
    this.syncTheme()
  },

  syncTheme() {
    const theme = wx.getAppBaseInfo().theme || 'light'
    this.setData({ theme })
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

  setSimMode(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ simMode: mode })
  },

  noop() {},

  goHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    })
  },

  previewImage() {
    const currentUrl = this.data.imageList[this.data.currentIndex]
    wx.previewImage({
      current: currentUrl,
      urls: this.data.imageList
    })
  },

  getIconSet() {
    return {
      iconStarOn: '/images/preview-favorite-active.svg',
      iconStarOff: '/images/preview-favorite.svg',
      iconDownload: '/images/preview-download.svg',
      iconShare: '/images/preview-share.svg',
      iconBack: '/images/preview-back.svg',
      iconHome: '/images/preview-home.svg',
      iconEdit: '/images/preview-edit.svg'
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
    return getResources({
      type: 'wallpaper',
      pageSize: 6,
      page: 1,
      sort: 'hot',
      // category: currentCategories.length > 0 ? currentCategories[0].name : undefined,
      tag: tags.length > 0 ? tags[0] : undefined
    }).then(res => {
      const similarList = (res.result.data || []).map(item => ({
        url: item.coverUrl || item.url || '', // Fallback to empty string
        originalUrl: item.originUrl || '',
        title: item.title || '',
        categories: item.categories || [],
        tags: item.tags || [],
        category: item.categories && item.categories.length > 0 ? item.categories[0].name : '相似壁纸'
      })).filter(item => item.url) // Filter out items with no url
      
      return similarList
    }).catch(error => {
      console.error('获取相似壁纸失败:', error)
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
    this.setData({ showLoginModal: false })
  },

  async handleLogin() {
    this.setData({ isLoginLoading: true })
    
    try {
      await loginWithProfile()
      
      this.setData({ 
        showLoginModal: false,
        isLoginLoading: false 
      })
      wx.showToast({ title: '登录成功', icon: 'success' })
      
      // Refresh favorite status
      this.loadFavorites()
    } catch (err) {
      console.error('登录流程异常:', err)
      this.setData({ isLoginLoading: false })
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    }
  },

  onLoad(options) {
    this.initNavBar()
    this.handleThemeChange = this.handleThemeChange.bind(this)
    wx.onThemeChange(this.handleThemeChange)
    this.setData(this.getIconSet())

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
          this.setData({
            currentWallpaper: parsedWallpaperData
          })
          itemsList[index] = parsedWallpaperData;
          
          // 记录浏览历史
          if (parsedWallpaperData) {
            recordBrowseHistory(parsedWallpaperData)
          }
        } catch (e) {
          console.error('解析壁纸数据失败:', e)
        }
      }
      
      this.setData({ itemsList });
      
      // 直接使用当前壁纸的数据来设置标签列表
      this.setData({
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
      if (item) {
        // 更新 itemsList
        const itemsList = this.data.itemsList;
        itemsList[index] = item;
        
        // 如果当前还在查看这张图，则更新视图
        if (this.data.currentIndex === index) {
           this.setData({
             itemsList,
             currentWallpaper: item,
             tagList: this.getWallpaperTagList(item)
           });
           
           // 更新相似推荐
           this.buildSimilarList().then(similarList => {
             this.setData({ similarList })
           })
           
           // 延迟补录浏览历史
           if (item && item._id) {
             recordBrowseHistory(item)
           }
        } else {
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
    wx.offThemeChange && wx.offThemeChange(this.handleThemeChange)
    if (this.hideTimer) clearTimeout(this.hideTimer)
  },

  handleThemeChange(res) {
    this.setData({ theme: res.theme === 'dark' ? 'dark' : 'light' })
  },

  goBack() {
    wx.navigateBack()
  },

  onImageLoad(e) {
    const index = e.currentTarget.dataset.index
    const loadedImages = this.data.loadedImages
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
      // 如果找到了，直接切换
      this.setData({ currentIndex: index })
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


  onTouchStart() {
    this.setData({ showPageIndicator: true })
  },

  onTouchEnd() {
    if (this.hideTimer) clearTimeout(this.hideTimer)
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
        currentAvatar: currentItem, 
        currentWallpaper: currentItem,
        tagList: this.getWallpaperTagList(currentItem)
      });
      
      // 记录浏览历史 (带防抖)
      if (this.browseTimer) clearTimeout(this.browseTimer)
      this.browseTimer = setTimeout(() => {
        if (currentItem && currentItem._id) {
          recordBrowseHistory(currentItem)
        }
      }, 1000)
    } else {
       this.setData({
        tagList: [],
        currentWallpaper: {}
      });
    }

    if (needsFetch) {
      const currentUrl = this.data.imageList[index];
      if (currentUrl) {
        this.fetchWallpaperInfo(currentUrl, index);
      }
    }

    this.setData({
      currentIndex: index,
      currentUrl: this.data.imageList[index],
      rawUrl: '', // 切换后清除初始传入的 rawUrl，避免下载时一直使用第一张图的链接
      showPageIndicator: true
    })
    this.checkFavorite()

    if (this.hideTimer) clearTimeout(this.hideTimer)
    this.hideTimer = setTimeout(() => {
      this.setData({ showPageIndicator: false })
    }, 2000)
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
    getFavorites('all', 1, 100).then(res => {
      if (res.data) {
        const cloudFavorites = res.data.map(item => ({
          url: item.url,
          type: item.type,
          timestamp: item.createTime ? new Date(item.createTime).getTime() : Date.now()
        }))
        
        // 更新本地存储和页面数据
        this.setData({ favorites: cloudFavorites })
        wx.setStorageSync('favorites', cloudFavorites)
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

      // 云端添加
      addFavorite(resourceId, 'wallpaper', currentUrl, currentWallpaper ? currentWallpaper.title : '').then(res => {
        console.log('云端添加收藏成功')
      }).catch(err => {
        console.error('云端添加收藏失败:', err)
      })

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

  showPoster() {
    this.setData({ showPosterModal: true })
  },

  hidePoster() {
    this.setData({ showPosterModal: false })
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
    recordDownload(record, 'wallpaper').then(res => {
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
          
          this.setData({
            itemsList,
            currentWallpaper: item,
            tagList: this.getWallpaperTagList(item)
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

  async downloadImage() {
    if (!this.checkLogin()) {
      this.showLoginModal()
      return
    }

    // 确保有资源ID (用于热度统计)
    await this.ensureResourceId()

    const that = this
    const hasAlbumPermission = await this.ensureAlbumPermission()
    if (!hasAlbumPermission) {
      return
    }
    const rawUrl = this.pickUrl()
    if (!rawUrl) {
      wx.showToast({ title: '图片地址缺失', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...', mask: true })

    // 处理 cloud:// 协议的云存储文件
    if (rawUrl.startsWith('cloud://')) {
      wx.cloud.downloadFile({
        fileID: rawUrl,
        success(res) {
          if (res.statusCode === 200) {
            that.saveToAlbum(res.tempFilePath, rawUrl)
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

    // 处理普通 HTTP/HTTPS 链接
    let ext = '.jpg'
    if (url.includes('.png')) ext = '.png'
    else if (url.includes('.gif')) ext = '.gif'
    else if (url.includes('.webp')) ext = '.webp'
    
    // const filePath = `${wx.env.USER_DATA_PATH}/${Date.now()}${Math.random().toString(36).slice(2)}${ext}`
    wx.downloadFile({
      url,
      // filePath,
      success(res) {
        if (res.statusCode === 200) {
          const tempFilePath = res.filePath || res.tempFilePath
          that.saveToAlbum(tempFilePath, url)
        } else {
          // 下载失败尝试代理
          that.tryProxyDownload(url)
        }
      },
      fail(err) {
        // 下载失败尝试代理
        console.warn('wx.downloadFile fail, trying proxy:', err)
        that.tryProxyDownload(url)
      }
    })
  },

  // 辅助方法：保存文件到相册
  saveToAlbum(tempFilePath, originalUrl) {
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
        const wp = that.data.currentWallpaper || {}
        that.addDownloadRecord({ 
          url: originalUrl, 
          type: 'wallpaper',
          id: wp._id // Pass ID to trigger hotScore update
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
  tryProxyDownload(url) {
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
            that.saveToAlbum(res2.tempFilePath, url)
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
  }
})
