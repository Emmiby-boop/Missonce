import { 
  checkLoginStatus, 
  loginWithProfile, 
  logout, 
  saveUserToDB, 
  syncUserFromCloud 
} from '../../utils/auth.js'
import { 
  getFavoritesCount, 
  getUserDownloads, 
  clearUserDownloads,
  getFavorites
} from '../../utils/api.js'
import { performanceMonitor } from '../../utils/performance.js'

const ENV_ID = 'prod-2gfd169w229986b8' // 保持原有常量

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
    favoriteCount: 0,
    
    // Menu Configuration
    menuItems: [
      { title: '联系我们', iconPath: '/images/menu-contact.svg', color: '#ff9c6e' },
      { title: '推荐给好友', iconPath: '/images/menu-share.svg', color: '#5cdbd3', isShare: true },
      { title: '清除缓存', iconPath: '/images/menu-clear.svg', color: '#ff85c0' },
      { title: '关于我们', iconPath: '/images/menu-about.svg', color: '#69c0ff' }
    ]
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
    try {
      // 使用 wx.getWindowInfo 替代已废弃的 wx.getSystemInfoSync
      const windowInfo = wx.getWindowInfo()
      this.setData({
        statusBarHeight: windowInfo.statusBarHeight,
        navBarHeight: 44 // 标准导航栏高度
      })
    } catch (e) {
      console.error('获取系统信息失败', e)
      // 降级处理：如果新 API 不可用，尝试旧 API
      try {
        const sysInfo = wx.getSystemInfoSync()
        this.setData({
          statusBarHeight: sysInfo.statusBarHeight
        })
      } catch (err) {
        console.error('降级获取系统信息失败', err)
      }
    }
  },

  onShow() {
    this.checkLoginStatus()
    this.loadFavoritesCount()
    this.syncUserInfo()
    this.syncTheme()
  },

  syncTheme() {
    const theme = wx.getAppBaseInfo().theme || 'light'
    this.setData({ theme })
    this.loadFavoritesCount()
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
      const openid = wx.getStorageSync('openid')
      if (!openid) return

      const db = wx.cloud.database()
      const [favRes] = await Promise.all([
        db.collection('favorites').where({ _openid: openid }).count()
      ])

      const favCount = favRes.total || 0
      
      // Update both stats object (for WXML) and legacy favoriteCount
      this.setData({
        'stats.favorites': favCount,
        favoriteCount: favCount
      })
      
      // Sync legacy local storage if needed
      if (favCount === 0) {
        try {
          wx.setStorageSync('favorites', [])
        } catch (e) {}
      }
    } catch (e) {
      console.error('加载统计数据失败:', e)
      // Fallback to local storage if cloud fails
      try {
        const favorites = wx.getStorageSync('favorites') || []
        this.setData({ 
          'stats.favorites': favorites.length,
          favoriteCount: favorites.length 
        })
      } catch (err) {}
    }
  },

  checkLoginStatus() {
    if (checkLoginStatus()) {
      const userInfo = wx.getStorageSync('userInfo')
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
      
      wx.showToast({ title: '登录成功', icon: 'success' })
    } catch (e) {
      this.setData({ isLoggingIn: false }) // 🔥 登录失败也要重置状态
      // loginWithProfile 内部已经处理了错误日志
    }
  },

  async syncUserInfo() {
    const dbUser = await syncUserFromCloud()
    if (dbUser) {
      // 强制更新页面数据，确保视图刷新
      const localUserInfo = wx.getStorageSync('userInfo')
      // 格式化显示ID
      if (localUserInfo) {
        localUserInfo.displayId = localUserInfo.userId || (localUserInfo.openid ? localUserInfo.openid.slice(-6).toUpperCase() : '')
      }
      this.setData({
        userInfo: localUserInfo
      })
      this.resolveAvatarUrl(localUserInfo.avatarUrl)
      
      this.checkTodayCheckIn() // 刷新签到状态
    }
  },

  resolveAvatarUrl(avatarUrl) {
    if (!avatarUrl) {
      this.setData({ displayAvatarUrl: '/images/default-avatar.png' })
      return
    }
    // 如果是云存储ID，需要转换
    if (avatarUrl.startsWith('cloud://')) {
      wx.cloud.getTempFileURL({
        fileList: [avatarUrl],
        success: res => {
          if (res.fileList && res.fileList[0].tempFileURL) {
            this.setData({ displayAvatarUrl: res.fileList[0].tempFileURL })
          }
        },
        fail: () => {
          this.setData({ displayAvatarUrl: avatarUrl })
        }
      })
    } else {
      this.setData({ displayAvatarUrl: avatarUrl })
    }
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
      const history = wx.getStorageSync('downloadHistory') || []
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
    // TODO: 请在此处填入您的公众号关联文章链接，用于引导用户关注
    // 只有配置了链接，点击才会跳转到文章页面
    // 例如: https://mp.weixin.qq.com/s/xxxxxxxxxxxx
    const articleUrl = 'https://mp.weixin.qq.com/s/3M2ZItekDXs3e4_vTejaGg' 

    if (articleUrl && articleUrl.startsWith('http')) {
      wx.navigateTo({
        url: `/subpackages/webview/webview?url=${encodeURIComponent(articleUrl)}`,
        fail: (err) => {
          console.error('跳转Webview失败', err)
          this.copyOfficialAccountName()
        }
      })
    } else {
      // 如果没有配置链接，则执行原来的复制逻辑
      this.copyOfficialAccountName()
    }
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
            const userInfo = wx.getStorageSync('userInfo')
            const token = wx.getStorageSync('token')
            const openid = wx.getStorageSync('openid')
            const downloadHistory = wx.getStorageSync('downloadHistory')
            const favorites = wx.getStorageSync('favorites')
            
            wx.clearStorageSync()
            
            if (userInfo) wx.setStorageSync('userInfo', userInfo)
            if (token) wx.setStorageSync('token', token)
            if (openid) wx.setStorageSync('openid', openid)
            if (downloadHistory) wx.setStorageSync('downloadHistory', downloadHistory)
            if (favorites) wx.setStorageSync('favorites', favorites)
            
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
        
        wx.setStorageSync('downloadHistory', newList)
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
            await clearUserDownloads()
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
    return {
      title: '动态头像精选壁纸',
      path: '/pages/index/index',
      imageUrl: '/images/share-cover.png'
    }
  },

  noop() {} // 空函数，用于阻止冒泡
})
