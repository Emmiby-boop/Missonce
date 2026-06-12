import { 
  checkLoginStatus, 
  loginWithProfile, 
  logout, 
  saveUserToDB, 
  syncUserFromCloud 
} from '../../utils/auth.js'
import { 
  getUserDownloads, 
  getFavorites
} from '../../utils/api.js'
import { performanceMonitor } from '../../utils/performance.js'
import logger from '../../utils/logger.js'
import { getStorage, getWindowInfo, getTheme } from '../../utils/storageManager'

Page({
  data: {
    userInfo: null,
    displayAvatarUrl: '',
    isCheckedIn: false,
    checkInDays: 0,
    totalCheckInDays: 0,
    points: 0,
    totalPoints: 0,
    
    // UI States
    statusBarHeight: 20,
    navBarHeight: 44,
    isLoggingIn: false,
    showAbout: false,
    showDownload: false,
    showFavorites: false,
    showContactMenu: false,
    showOfficialAccount: false,
    
    // Official Account
    officialAccount: null,
    qrcodeLoaded: false,
    
    // Data Lists
    downloadHistory: [],
    favoritesList: [],
    
    // Pagination & Loading
    downloadPage: 0,
    downloadEnded: false,
    downloadLoading: false,
    
    favoritesPage: 1,
    favoritesEnded: false,
    favoritesLoading: false,
    
    // Version Information
    version: '1.2.2',
    
    // Counts
    downloadCount: 0,
    memberStatus: {
      isMember: false,
      memberLevel: 'none',
      memberName: '',
      daysRemaining: 0
    },
    favoriteCount: 0,
    
    // Menu Configuration
    menuItems: [
      { title: '联系我们', iconPath: '/images/menu-contact.svg', color: '#FF9C6E', desc: '客服与反馈' },
      { title: '推荐给好友', iconPath: '/images/menu-share.svg', color: '#5CDBD3', desc: '分享给好友', isShare: true },
      { title: '清除缓存', iconPath: '/images/menu-clear.svg', color: '#FF85C0', desc: '释放存储空间' },
      { title: '关于我们', iconPath: '/images/menu-about.svg', color: '#69C0FF', desc: '版本与介绍' }
    ]
  },

  _isHiding: false,

  // 🔥 安全的 setData：页面隐藏时跳过更新
  _safeSetData(data, callback) {
    if (this._isHiding) return
    this.setData(data, callback)
  },

  onLoad() {
    performanceMonitor.startPageLoad('个人中心')
    this.initNavBar()
    performanceMonitor.markMilestone('个人中心', '初始化完成')
    this.checkTodayCheckIn()
    performanceMonitor.markMilestone('个人中心', '签到检查完成')
    this.loadDownloadCount()
    performanceMonitor.markMilestone('个人中心', '下载数加载完成')
    this.initVersion()
    performanceMonitor.endPageLoad('个人中心')
    
    const pageStats = performanceMonitor.getPageStats('个人中心')
    if (pageStats?.totalTime) {
      logger.logPerformance('page_load', {
        loadTime: pageStats.totalTime
      }, 'pages/profile/profile')
    }
    
    logger.logPageView('pages/profile/profile')
  },

  initVersion() {
    try {
      const accountInfo = wx.getAccountInfoSync()
      const { miniProgram } = accountInfo
      
      // miniProgram.version 仅在正式版有效
      // miniProgram.envVersion 可能值为 develop, trial, release
      if (miniProgram.version) {
        this.setData({ version: miniProgram.version })
      } else if (miniProgram.envVersion !== 'release') {
        const envMap = {
          'develop': '开发版',
          'trial': '体验版'
        }
        this.setData({ version: envMap[miniProgram.envVersion] || miniProgram.envVersion })
      }
    } catch (e) {
      console.error('获取版本信息失败', e)
    }
  },

  initNavBar() {
    // 🔥 优化：使用全局缓存的窗口信息，避免重复调用 wx.getWindowInfo/getSystemInfoSync
    const windowInfo = getWindowInfo()
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight,
      navBarHeight: 44 // 标准导航栏高度
    })
  },

  onShow() {
    this._isHiding = false
    // 🔥 只在登录状态变化时同步数据，避免每次 onShow 都调用
    const wasLoggedIn = !!this.data.userInfo
    this.checkLoginStatus()
    const isLoggedIn = !!this.data.userInfo
    
    this.syncTheme()
    
    // 首次显示或登录状态变化时才加载数据
    if (!wasLoggedIn && isLoggedIn) {
      // 刚登录，加载所有数据
      this.loadFavoritesCount()
      this.syncUserInfo()
      this.checkTodayCheckIn()
    } else if (isLoggedIn) {
      // 已登录，静默刷新（不阻塞）
      this.loadFavoritesCount()
    }
  },

  onHide() {
    this._isHiding = true
  },

  syncTheme() {
    const theme = getTheme()
    this.setData({ theme })
  },

  async loadFavoritesCount() {
    if (!this.data.userInfo) {
      this.setData({ 
        'stats.favorites': 0,
        favoriteCount: 0 
      })
      return
    }

    try {
      // 🔥 优先使用本地缓存
      const favorites = getStorage('favorites') || []
      if (favorites.length > 0) {
        this.setData({
          'stats.favorites': favorites.length,
          favoriteCount: favorites.length
        })
      }
      
      // 静默同步云端准确数量
      const openid = getStorage('openid')
      if (!openid) return

      const db = wx.cloud.database()
      const favRes = await db.collection('favorites').where({ _openid: openid }).count()
      const favCount = favRes.total || 0
      
      this.setData({
        'stats.favorites': favCount,
        favoriteCount: favCount
      })
      
      if (favCount === 0) {
        try {
          wx.setStorage({ key: 'favorites', data: [] })
        } catch (e) {}
      }
    } catch (e) {
      console.error('加载收藏数失败:', e)
    }
  },

  checkLoginStatus() {
    if (checkLoginStatus()) {
      const userInfo = getStorage('userInfo')
      // 格式化显示ID：优先使用userId，否则截取openid后6位
      if (userInfo) {
        userInfo.displayId = userInfo.userId || (userInfo.openid ? userInfo.openid.slice(-6).toUpperCase() : '')
      }
      this.setData({ userInfo })
      this.resolveAvatarUrl(userInfo.avatarUrl)
    } else {
      this.setData({ userInfo: null, displayAvatarUrl: '' })
    }
  },

  async handleLogin() {
    if (this.data.userInfo) return
    if (this.data.isLoggingIn) return // 🔥 防止重复点击
    
    // 🔥 显示加载状态
    this.setData({ isLoggingIn: true })
    
    try {
      const user = await loginWithProfile()
      // 格式化显示ID
      if (user) {
        user.displayId = user.userId || (user.openid ? user.openid.slice(-6).toUpperCase() : '')
      }
      this.setData({ userInfo: user, isLoggingIn: false })
      this.resolveAvatarUrl(user.avatarUrl)
      
      // 登录后立即同步数据
      this.checkTodayCheckIn()
      this.loadFavoritesCount()
      this.syncUserInfo()
      this.loadMemberStatus()
      
      wx.showToast({ title: '登录成功', icon: 'success' })
    } catch (e) {
      this.setData({ isLoggingIn: false }) // 🔥 登录失败也要重置状态
      // loginWithProfile 内部已经处理了错误日志
    }
  },

  async syncUserInfo() {
    const dbUser = await syncUserFromCloud()
    if (dbUser) {
      // 🔥 优化：复用已有的 userInfo，避免重复 getStorage + setData
      let localUserInfo = this.data.userInfo
      if (!localUserInfo) {
        localUserInfo = getStorage('userInfo')
      }
      if (localUserInfo) {
        localUserInfo.displayId = localUserInfo.userId || (localUserInfo.openid ? localUserInfo.openid.slice(-6).toUpperCase() : '')
      }
      this.setData({
        userInfo: localUserInfo
      })
      if (localUserInfo) {
        this.resolveAvatarUrl(localUserInfo.avatarUrl)
      }
      this.checkTodayCheckIn()
    }
  },

  async loadMemberStatus() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { action: 'getMemberStatus' }
      })

      if (res.result && res.result.success) {
        this.setData({
          memberStatus: res.result.data
        })
      }
    } catch (e) {
      console.error('获取会员状态失败:', e)
    }
  },

  resolveAvatarUrl(avatarUrl) {
    if (!avatarUrl) {
      this.setData({ displayAvatarUrl: '/images/default-avatar.png' })
      return
    }
    // 🔥 cloud:// 链接直接使用，微信小程序 image 组件原生支持
    this.setData({ displayAvatarUrl: avatarUrl })
  },

  async checkTodayCheckIn() {
    if (!this.data.userInfo) {
      this.setData({
        isCheckedIn: false,
        checkInDays: 0,
        totalCheckInDays: 0,
        points: 0,
        totalPoints: 0
      })
      return
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { action: 'getUserInfo' }
      })

      if (res.result.success) {
        const data = res.result.data
        this.setData({
          isCheckedIn: data.isCheckedIn,
          checkInDays: data.checkInDays,
          totalCheckInDays: data.totalCheckInDays,
          points: data.points,
          totalPoints: data.totalPoints
        })
      }
    } catch (e) {
      console.error('获取签到信息失败:', e)
    }
  },

  async handleCheckIn() {
    if (!this.data.userInfo) {
      this.handleLogin()
      return
    }
    
    if (this.data.isCheckedIn) return

    wx.showLoading({ title: '签到中...', mask: true })
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { action: 'checkIn' }
      })

      wx.hideLoading()

      if (res.result.success) {
        const data = res.result.data
        this.setData({
          isCheckedIn: true,
          checkInDays: data.checkInDays,
          totalCheckInDays: data.totalCheckInDays,
          points: data.points,
          totalPoints: data.totalPoints
        })

        let message = `签到成功 +${data.pointsReward}积分`
        if (data.bonusPoints > 0) {
          message = `连续${data.checkInDays}天！+${data.totalReward}积分`
        }
        
        wx.showToast({
          title: message,
          icon: 'success',
          duration: 2000
        })
      } else {
        wx.showToast({
          title: res.result.error || '签到失败',
          icon: 'none'
        })
      }
    } catch (e) {
      wx.hideLoading()
      console.error('签到失败:', e)
      wx.showToast({
        title: '签到失败',
        icon: 'none'
      })
    }
  },

  loadDownloadCount() {
    try {
      const history = getStorage('downloadHistory') || []
      this.setData({ downloadCount: history.length })
    } catch (e) {
      this.setData({ downloadCount: 0 })
    }
  },

  goEditProfile() {
    if (!this.data.userInfo) return
    wx.navigateTo({
      url: '/subpackages/profile-edit/profile-edit'
    })
  },

  goToPoints() {
    if (!this.data.userInfo) {
      this.handleLogin()
      return
    }
    wx.navigateTo({
      url: '/subpackages/points/points'
    })
  },

  // ---------------------------------------------------------
  // 菜单处理逻辑
  // ---------------------------------------------------------

  onMenuItemTap(e) {
    const title = e.currentTarget.dataset.title
    switch (title) {
      case '联系我们':
        this.handleContact()
        break

      case '清除缓存':
        this.handleClearCache()
        break
      case '关于我们':
        this.handleAbout()
        break
      default:
        break
    }
  },


  handleContact() {
    this.setData({ showContactMenu: true })
  },

  closeContactMenu() {
    this.setData({ showContactMenu: false })
  },

  handleOfficialAccount() {
    this.setData({ showContactMenu: false })
    
    if (!this.data.officialAccount) {
      this.loadOfficialAccountConfig()
    }
    
    this.setData({ showOfficialAccount: true })
  },

  closeOfficialAccount() {
    this.setData({ showOfficialAccount: false })
  },

  async loadOfficialAccountConfig() {
    // 每次打开都重置加载状态
    this.setData({ qrcodeLoaded: false })
    
    try {
      const db = wx.cloud.database()
      const res = await db.collection('contact_config')
        .where({ type: 'official_account', enabled: true })
        .get()
      
      if (res.data && res.data.length > 0) {
        const config = res.data[0]
        
        // 如果有二维码且是云存储ID，需要获取临时链接
        if (config.qrcodeUrl && !config.qrcodeUrl.startsWith('https://') && !config.qrcodeUrl.startsWith('http://')) {
          try {
            const tempRes = await wx.cloud.getTempFileURL({
              fileList: [config.qrcodeUrl]
            })
            if (tempRes.fileList && tempRes.fileList[0].tempFileURL) {
              config.qrcodeUrl = tempRes.fileList[0].tempFileURL
            }
          } catch (e) {
            console.error('获取二维码临时链接失败:', e)
          }
        }
        
        this.setData({ 
          officialAccount: {
            ...config,
            title: config.title || '官方账号'
          }
        })
      }
    } catch (err) {
      console.error('加载官方账号配置失败:', err)
    }
  },

  onQrcodeLoad() {
    this.setData({ qrcodeLoaded: true })
  },

  onQrcodeError() {
    this.setData({ qrcodeLoaded: false })
    wx.showToast({ title: '二维码加载失败', icon: 'none' })
  },

  copyOfficialAccountName() {
    wx.setClipboardData({
      data: '小辣椒动态头像壁纸',
      success: () => {
        wx.showToast({ title: '公众号名称已复制', icon: 'success' })
      }
    })
  },

  handleShowContactInfo() {
    wx.setClipboardData({
      data: 'missonce@icloud.com', // 替换为实际商务邮箱
      success: () => {
        wx.showToast({ title: '邮箱已复制', icon: 'success' })
      }
    })
  },

  handleClearCache() {
    wx.showModal({
      title: '提示',
      content: '确定要清除所有本地缓存吗？(签到和积分数据保存在云端，不会丢失)',
      success: (res) => {
        if (res.confirm) {
          try {
            const userInfo = getStorage('userInfo')
            const token = getStorage('token')
            const openid = getStorage('openid')
            const downloadHistory = getStorage('downloadHistory')
            const favorites = getStorage('favorites')

            wx.clearStorage()

            if (userInfo) wx.setStorage({ key: 'userInfo', data: userInfo })
            if (token) wx.setStorage({ key: 'token', data: token })
            if (openid) wx.setStorage({ key: 'openid', data: openid })
            if (downloadHistory) wx.setStorage({ key: 'downloadHistory', data: downloadHistory })
            if (favorites) wx.setStorage({ key: 'favorites', data: favorites })

            wx.showToast({ title: '清除成功', icon: 'success' })
          } catch (e) {
            console.error('清除缓存失败', e)
            wx.showToast({ title: '清除失败', icon: 'none' })
          }
        }
      }
    })
  },

  handleAbout() {
    this.setData({ showAbout: true })
  },

  closeAboutPanel() {
    this.setData({ showAbout: false })
  },

  openPrivacyContract() {
    wx.openPrivacyContract({
      fail: () => {
        wx.showToast({ title: '无法打开隐私协议', icon: 'none' })
      }
    })
  },

  async handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: async (res) => {
        if (res.confirm) {
          const userInfo = this.data.userInfo
          if (userInfo) {
             wx.showLoading({ title: '正在退出...', mask: true })
             try {
               await saveUserToDB(userInfo)
             } catch (e) {
               console.error('退出前同步用户资料失败', e)
             }
             wx.hideLoading()
          }

          logout()
          this.setData({ 
            userInfo: null, 
            displayAvatarUrl: '', 
            favoriteCount: 0,
            downloadCount: 0,
            checkInDays: 0,
            isCheckedIn: false
          })
        }
      }
    })
  },

  // ---------------------------------------------------------
  // 收藏功能逻辑
  // ---------------------------------------------------------

  openLikes() {
    wx.navigateTo({
      url: '/subpackages/resource-list/resource-list?type=likes&title=我的点赞'
    })
  },

  openFavorites() {
    if (!this.data.userInfo) {
      this.handleLogin()
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
      .catch(err => {
        console.error('加载收藏列表失败:', err)
        this.setData({ favoritesLoading: false })
      })
  },

  handleFavoriteTap(e) {
    const { item } = e.currentTarget.dataset
    this.navigateToPreview(item)
  },

  clearFavorites() {
    if (this.data.favoritesList.length === 0) return

    wx.showModal({
      title: '确认清空',
      content: `确定要清空全部 ${this.data.favoritesList.length} 条收藏吗？此操作不可恢复。`,
      confirmText: '确定清空',
      confirmColor: '#ff4d4f',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.clearAllFavorites()
        }
      }
    })
  },

  async clearAllFavorites() {
    wx.showLoading({ title: '清空中...', mask: true })

    try {
      const db = wx.cloud.database()
      const openid = getStorage('openid')

      // 🔥 使用批量删除，每次最多删 20 条（微信限制）
      if (openid) {
        let hasMore = true
        while (hasMore) {
          const res = await db.collection('favorites').where({
            _openid: openid
          }).limit(20).get()
          
          if (res.data.length === 0) {
            hasMore = false
          } else {
            const deletePromises = res.data.map(item => 
              db.collection('favorites').doc(item._id).remove()
            )
            await Promise.all(deletePromises)
          }
        }
      }

      // 清空本地数据
      this.setData({ 
        favoritesList: [],
        favoritesEnded: true 
      })
      wx.setStorage({ key: 'favorites', data: [] })
      this.loadFavoritesCount()

      wx.hideLoading()
      wx.showToast({ title: '已清空全部收藏', icon: 'success' })
    } catch (err) {
      console.error('清空收藏失败:', err)
      wx.hideLoading()
      wx.showToast({ title: '清空失败，请重试', icon: 'none' })
    }
  },

  navigateToPreview(item) {
    if (!item || !item.url) return
    
    const encodedUrl = encodeURIComponent(item.url)
    // 传递完整数据以便预览页进行相似推荐等操作
    // 注意：如果数据量过大可能导致 URL 超长，建议只传递必要字段或通过全局变量/缓存传递
    // 这里先尝试直接传递，若有必要可优化
    const itemData = encodeURIComponent(JSON.stringify(item))
    
    if (item.type === 'avatar') {
      wx.navigateTo({
        url: `/subpackages/preview/preview?url=${encodedUrl}&isAvatar=true&avatarData=${itemData}`
      })
    } else {
      wx.navigateTo({
        url: `/subpackages/wallpaper-preview/wallpaper-preview?url=${encodedUrl}&wallpaperData=${itemData}`
      })
    }
  },

  // ---------------------------------------------------------
  // 下载记录逻辑
  // ---------------------------------------------------------

  openDownloadHistory() {
    if (!this.data.userInfo) {
      this.handleLogin()
      return
    }
    this.setData({ 
      showDownload: true, 
      downloadPage: 0, 
      downloadEnded: false, 
      downloadHistory: [] 
    })
    this.loadMoreDownloads()
  },

  closeDownloadPanel() {
    this.setData({ showDownload: false })
  },

  loadMoreDownloads() {
    if (this.data.downloadLoading || (this.data.downloadEnded && this.data.downloadPage > 0)) return
    
    this.setData({ downloadLoading: true })
    
    getUserDownloads(this.data.downloadPage, 20)
      .then(res => {
        const cloudHistory = res.data.map(item => ({
           ...item,
           time: item.createTime ? new Date(item.createTime).getTime() : Date.now()
        }))

        const newList = this.data.downloadPage === 0 ? cloudHistory : [...this.data.downloadHistory, ...cloudHistory]
        
        this.setData({ 
          downloadHistory: newList,
          downloadPage: this.data.downloadPage + 1,
          downloadEnded: cloudHistory.length < 20,
          downloadLoading: false
        })
        
        wx.setStorage({ key: 'downloadHistory', data: newList })
      })
      .catch(err => {
        console.error('加载云端下载记录失败:', err)
        this.setData({ downloadLoading: false })
      })
  },

  previewDownloadImage(e) {
    const { item } = e.currentTarget.dataset
    this.navigateToPreview(item)
  },

  clearDownloadHistory() {
    wx.showModal({
      title: '提示',
      content: '确定要清空所有下载记录吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '正在清空...' })
          try {
            const db = wx.cloud.database()
            const openid = getStorage('openid')

            // 🔥 使用批量删除
            if (openid) {
              let hasMore = true
              while (hasMore) {
                const res = await db.collection('downloads').where({
                  _openid: openid
                }).limit(20).get()
                
                if (res.data.length === 0) {
                  hasMore = false
                } else {
                  const deletePromises = res.data.map(item => 
                    db.collection('downloads').doc(item._id).remove()
                  )
                  await Promise.all(deletePromises)
                }
              }
            }

            // 清空本地数据
            wx.removeStorageSync('downloadHistory')
            this.setData({ 
              downloadHistory: [],
              downloadPage: 0,
              downloadEnded: true,
              downloadCount: 0
            })
            wx.showToast({ title: '已清空', icon: 'success' })
          } catch (e) {
            console.error('清空下载记录失败:', e)
            wx.showToast({ title: '清空失败', icon: 'none' })
          } finally {
            wx.hideLoading()
          }
        }
      }
    })
  },

  onShareAppMessage() {
    const userInfo = getStorage('userInfo')
    const inviterParam = userInfo && userInfo.openid ? '?inviter=' + userInfo.openid : ''
    return {
      title: '小辣椒动态头像壁纸，海量精美素材免费下载！',
      path: '/pages/index/index' + inviterParam,
      imageUrl: '/images/share-cover.png'
    }
  },

  onShareTimeline() {
    const userInfo = getStorage('userInfo')
    const inviterParam = userInfo && userInfo.openid ? 'inviter=' + userInfo.openid : ''
    return {
      title: '小辣椒动态头像壁纸，海量精美素材免费下载！',
      query: inviterParam,
      imageUrl: '/images/share-cover.png'
    }
  },

  noop() {} // 空函数，用于阻止冒泡
})
