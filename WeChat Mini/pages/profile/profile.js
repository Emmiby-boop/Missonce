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
import { getStorage, setStorage, getWindowInfo, getTheme } from '../../utils/storageManager'
import { hapticSelect, hapticLongPress, isHapticEnabled, setHapticEnabled, hapticTap } from '../../utils/haptic'

Page({
  // 点击底部 tabBar 时的轻震反馈（onTabItemTap 基础库 1.9.0+，点击当前 tab 同样触发）
  onTabItemTap() {
    hapticSelect()
  },

  data: {
    // 触感反馈开关（与 utils/haptic 的 storage 状态保持同步）
    hapticEnabled: true,
    userInfo: null,
    displayAvatarUrl: '',

    // UI States
    statusBarHeight: 20,
    navBarHeight: 44,
    isLoggingIn: false,
    showAbout: false,
    showDownload: false,
    showFavorites: false,
    showBrowse: false,
    showContactMenu: false,
    showOfficialAccount: false,

    // Official Account
    officialAccount: null,
    qrcodeLoaded: false,

    // 联系方式（通过 getConfig 云函数动态获取，以下为兜底默认值）
    contactEmail: 'missonce@icloud.com',
    officialAccountName: '小辣椒动态头像壁纸',

    // Data Lists
    downloadHistory: [],
    favoritesList: [],
    browseList: [],

    // Pagination & Loading
    downloadPage: 0,
    downloadEnded: false,
    downloadLoading: false,

    favoritesPage: 1,
    favoritesEnded: false,
    favoritesLoading: false,

    browsePage: 0,
    browseEnded: false,
    browseLoading: false,

    // Version Information
    version: '1.2.2',

    // Counts
    downloadCount: 0,
    browseCount: 0,
    favoriteCount: 0,
    recentItems: [],

    // Menu Configuration - 浅色渐变背景搭配白色描边图标
    menuItems: [
      { title: '联系我们', iconPath: '/images/menu-contact.svg', color: 'linear-gradient(135deg, #bbf7d0, #86efac)', desc: '客服与反馈' },
      { title: '推荐给好友', iconPath: '/images/menu-share.svg', color: 'linear-gradient(135deg, #bfdbfe, #93c5fd)', desc: '分享给好友', isShare: true },
      { title: '清除缓存', iconPath: '/images/menu-clear.svg', color: 'linear-gradient(135deg, #fef3c7, #fde68a)', desc: '释放存储空间' },
      { title: '关于我们', iconPath: '/images/menu-about.svg', color: 'linear-gradient(135deg, #ede9fe, #ddd6fe)', desc: '版本与介绍' }
    ]
  },

  _isHiding: false,

  // 🔥 安全的 setData：页面隐藏时跳过更新
  _safeSetData(data, callback) {
    if (this._isHiding) return
    this.setData(data, callback)
  },

  onLoad() {
    // 同步触感反馈开关状态（读取 storage，默认开启）
    this.setData({ hapticEnabled: isHapticEnabled() })
    performanceMonitor.startPageLoad('个人中心')
    this.initNavBar()

    // 🔥 低端机降级：毛玻璃/装饰光晕 blur → 纯色（wxml 在 blur 元素上挂 low-end class）
    this.setData({ lowEnd: !!(getApp().globalData && getApp().globalData.lowEnd) })

    performanceMonitor.markMilestone('个人中心', '初始化完成')

    // 🔥 并行加载：initVersion/loadDownloadCount/loadContactConfig 互不依赖，并行执行
    const tasks = [
      this.initVersion(),
      this.loadDownloadCount(),
      this.loadContactConfig()
    ]
    Promise.all(tasks).then(() => {
      performanceMonitor.markMilestone('个人中心', '并行加载完成')
      performanceMonitor.endPageLoad('个人中心')

      const pageStats = performanceMonitor.getPageStats('个人中心')
      if (pageStats?.totalTime) {
        logger.logPerformance('page_load', {
          loadTime: pageStats.totalTime
        }, 'pages/profile/profile')
      }
    })

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

    // 🔥 优化：onShow 节流（30秒内不重复查 count），避免切回页面频繁发请求
    const now = Date.now()
    const lastRefresh = this._lastRefreshTime || 0
    const shouldRefresh = !wasLoggedIn || isLoggedIn ? (now - lastRefresh > 30 * 1000) : false

    // 首次显示或登录状态变化时才加载数据
    if (!wasLoggedIn && isLoggedIn) {
      // 刚登录，加载所有数据
      this.loadFavoritesCount()
      this.syncUserInfo()
      this.loadRecentItems()
      this.loadDownloadCount()
      this.loadBrowseCount()
      this._lastRefreshTime = now
    } else if (isLoggedIn && shouldRefresh) {
      // 已登录，静默刷新（30秒节流）
      this.loadFavoritesCount()
      this.loadRecentItems()
      this.loadDownloadCount()
      this.loadBrowseCount()
      this._lastRefreshTime = now
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
      this.setData({ favoriteCount: 0 })
      return
    }

    try {
      // 🔥 优先使用本地缓存
      const favorites = getStorage('favorites') || []
      if (favorites.length > 0) {
        this.setData({ favoriteCount: favorites.length })
      }

      // 静默同步云端准确数量
      const openid = getStorage('openid')
      if (!openid) return

      const db = wx.cloud.database()
      const favRes = await db.collection('favorites').where({ _openid: openid }).count()
      const favCount = favRes.total || 0

      this.setData({ favoriteCount: favCount })

      if (favCount === 0) {
        try {
          wx.setStorage({ key: 'favorites', data: [] })
        } catch (e) {
          console.error('[profile] 重置收藏存储失败:', e)
        }
      }
    } catch (e) {
      console.error('加载收藏数失败:', e)
    }
  },

  // 🔥 最近使用：从下载记录中取最近 6 个
  loadRecentItems() {
    try {
      const history = getStorage('downloadHistory') || []
      const recent = history.slice(0, 6).map(item => ({
        url: item.url || item.coverUrl,
        coverUrl: item.coverUrl || item.url,
        type: item.type || 'wallpaper',
        title: item.title || ''
      }))
      this.setData({ recentItems: recent })
    } catch (e) {
      console.warn('[profile] 读取最近使用记录失败，降级处理:', e)
    }
  },

  onRecentTap(e) {
    const item = e.currentTarget.dataset.item
    if (!item || !item.url) return

    if (item.type === 'avatar') {
      wx.navigateTo({
        url: `/subpackages/preview/preview?url=${encodeURIComponent(item.url)}&isAvatar=true`
      })
    } else {
      wx.navigateTo({
        url: `/subpackages/wallpaper-preview/wallpaper-preview?url=${encodeURIComponent(item.url)}`
      })
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
      this.loadFavoritesCount()
      this.loadDownloadCount()
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

  loadDownloadCount() {
    try {
      const history = getStorage('downloadHistory') || []
      this.setData({ downloadCount: history.length })
    } catch (e) {
      this.setData({ downloadCount: 0 })
    }

    // 🔥 同步云端真实下载数量，避免“我的页面”永远显示 0
    const openid = getStorage('openid')
    if (!openid) return

    const db = wx.cloud.database()
    db.collection('downloads').where({ _openid: openid }).count()
      .then(res => {
        const count = res.total || 0
        this.setData({ downloadCount: count })
      })
      .catch(err => {
        console.error('加载云端下载数失败:', err)
      })
  },

  goEditProfile() {
    if (!this.data.userInfo) return
    wx.navigateTo({
      url: '/subpackages/profile-edit/profile-edit'
    })
  },

  // ---------------------------------------------------------
  // 浏览记录逻辑
  // ---------------------------------------------------------

  // 加载浏览记录总数（用于统计栏数字）
  async loadBrowseCount() {
    if (!checkLoginStatus()) return
    try {
      const db = wx.cloud.database()
      const res = await db.collection('browse_history').count()
      this.setData({ browseCount: res.total || 0 })
    } catch (e) {
      console.error('加载浏览记录数失败:', e)
    }
  },

  openBrowseHistory() {
    if (!this.data.userInfo) {
      this.handleLogin()
      return
    }

    // 🔥 优化：先渲染缓存（5分钟内），再静默刷新第一页
    const CACHE_KEY = 'profile_browse_list'
    const cached = getStorage(CACHE_KEY)
    if (cached && cached.data && (Date.now() - cached.timestamp < 5 * 60 * 1000)) {
      this.setData({
        showBrowse: true,
        browseList: cached.data.list,
        browsePage: cached.data.page,
        browseEnded: cached.data.ended,
        browseLoading: false
      })
      // 后台静默刷新第一页
      this._refreshBrowseFirstPage(CACHE_KEY)
      return
    }

    this.setData({
      showBrowse: true,
      browseList: [],
      browsePage: 0,
      browseEnded: false,
      browseLoading: false
    })
    this.loadMoreBrowse()
  },

  closeBrowsePanel() {
    this.setData({ showBrowse: false })
  },

  // 静默刷新浏览记录第一页（不显示 loading，失败保留缓存）
  async _refreshBrowseFirstPage(CACHE_KEY) {
    try {
      const db = wx.cloud.database()
      const _ = db.command
      const pageSize = 20

      const historyRes = await db.collection('browse_history')
        .orderBy('createTime', 'desc')
        .limit(pageSize)
        .get()

      const historyItems = historyRes.data || []
      const resourceIds = [...new Set(
        historyItems.map(h => h.resourceId).filter(Boolean)
      )]

      let resourceMap = new Map()
      if (resourceIds.length > 0) {
        const chunks = []
        for (let i = 0; i < resourceIds.length; i += 20) {
          chunks.push(resourceIds.slice(i, i + 20))
        }
        const chunkResults = await Promise.all(
          chunks.map(chunk =>
            db.collection('resources').where({ _id: _.in(chunk) }).get()
          )
        )
        chunkResults.forEach(r => {
          (r.data || []).forEach(item => resourceMap.set(item._id, item))
        })
      }

      const browseList = historyItems
        .map(h => {
          const resource = resourceMap.get(h.resourceId)
          if (!resource) return null
          return {
            ...resource,
            _id: resource._id,
            id: resource._id,
            type: resource.type || h.type,
            url: resource.originUrl || resource.url || '',
            coverUrl: resource.coverUrl || resource.cover || '',
            browseTime: h.createTime ? new Date(h.createTime).getTime() : Date.now()
          }
        })
        .filter(Boolean)

      // 仅当数据变化时才更新
      const currentList = this.data.browseList
      const changed = browseList.length !== currentList.length ||
        (browseList[0] && currentList[0] && browseList[0]._id !== currentList[0]._id)
      if (changed) {
        this.setData({
          browseList,
          browsePage: 1,
          browseEnded: historyItems.length < pageSize
        })
      }
      setStorage(CACHE_KEY, {
        data: { list: browseList, page: 1, ended: historyItems.length < pageSize },
        timestamp: Date.now()
      })
    } catch (e) {
      console.warn('[profile] 静默刷新浏览记录失败，保留缓存:', e)
    }
  },

  // browse_history 集合仅存 resourceId/type/tags，需关联 resources 集合查封面URL
  async loadMoreBrowse() {
    if (this.data.browseLoading || this.data.browseEnded) return
    this.setData({ browseLoading: true })

    try {
      const db = wx.cloud.database()
      const _ = db.command
      const pageSize = 20
      const page = this.data.browsePage

      // 1. 分页查 browse_history（按 createTime 倒序）
      const historyRes = await db.collection('browse_history')
        .orderBy('createTime', 'desc')
        .skip(page * pageSize)
        .limit(pageSize)
        .get()

      const historyItems = historyRes.data || []
      if (historyItems.length === 0) {
        this.setData({ browseEnded: true, browseLoading: false })
        return
      }

      // 2. 提取 resourceId 去重，批量查 resources 集合
      const resourceIds = [...new Set(
        historyItems.map(h => h.resourceId).filter(Boolean)
      )]

      let resourceMap = new Map()
      if (resourceIds.length > 0) {
        // 微信云数据库 _.in 单次最多 20 条，分批查询
        const chunks = []
        for (let i = 0; i < resourceIds.length; i += 20) {
          chunks.push(resourceIds.slice(i, i + 20))
        }
        const chunkResults = await Promise.all(
          chunks.map(chunk =>
            db.collection('resources').where({ _id: _.in(chunk) }).get()
          )
        )
        chunkResults.forEach(r => {
          (r.data || []).forEach(item => {
            resourceMap.set(item._id, item)
          })
        })
      }

      // 3. 合并数据：保留浏览时间顺序，附上资源封面
      const browseList = historyItems
        .map(h => {
          const resource = resourceMap.get(h.resourceId)
          if (!resource) return null  // 资源已被删除
          return {
            ...resource,
            _id: resource._id,
            id: resource._id,
            type: resource.type || h.type,
            url: resource.originUrl || resource.url || '',
            coverUrl: resource.coverUrl || resource.cover || '',
            browseTime: h.createTime ? new Date(h.createTime).getTime() : Date.now()
          }
        })
        .filter(Boolean)

      const newList = page === 0 ? browseList : [...this.data.browseList, ...browseList]

      this.setData({
        browseList: newList,
        browsePage: page + 1,
        browseEnded: historyItems.length < pageSize,
        browseLoading: false
      })

      // 🔥 缓存第一页数据（page=0 加载完成后）
      if (page === 0) {
        setStorage('profile_browse_list', {
          data: { list: newList, page: 1, ended: historyItems.length < pageSize },
          timestamp: Date.now()
        })
      }
    } catch (e) {
      console.error('加载浏览记录失败:', e)
      this.setData({ browseLoading: false })
    }
  },

  handleBrowseTap(e) {
    const { item } = e.currentTarget.dataset
    this.navigateToPreview(item)
  },

  clearBrowseHistory() {
    if (this.data.browseList.length === 0 && this.data.browseCount === 0) return
    wx.showModal({
      title: '确认清空',
      content: `确定要清空全部浏览记录吗？此操作不可恢复。`,
      confirmText: '确定清空',
      confirmColor: '#ff4d4f',
      cancelText: '取消',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '清空中...', mask: true })
        try {
          const db = wx.cloud.database()
          // 批量删除，每次最多20条
          let hasMore = true
          while (hasMore) {
            const r = await db.collection('browse_history')
              .limit(20)
              .get()
            if (r.data.length === 0) {
              hasMore = false
            } else {
              await Promise.all(
                r.data.map(item => db.collection('browse_history').doc(item._id).remove())
              )
            }
          }
          this.setData({
            browseList: [],
            browseEnded: true,
            browseCount: 0
          })
          setStorage('profile_browse_list', null) // 🔥 清空缓存
          wx.hideLoading()
          wx.showToast({ title: '已清空浏览记录', icon: 'success' })
        } catch (err) {
          wx.hideLoading()
          console.error('清空浏览记录失败:', err)
          wx.showToast({ title: '清空失败', icon: 'none' })
        }
      }
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

  // 通过 getConfig 云函数动态获取联系方式（邮箱、公众号名称），失败时保留默认值
  // 🔥 优化：L2 缓存（1天）+ 静默刷新，避免每次 onLoad 都发 2 个 callFunction 阻塞首屏
  async loadContactConfig() {
    // 1. L2 缓存优先（同步命中，立即可用）
    const CACHE_KEY = 'profile_contact_config'
    const cached = getStorage(CACHE_KEY)
    if (cached && cached.data && (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000)) {
      this.setData({
        contactEmail: cached.data.contactEmail || this.data.contactEmail,
        officialAccountName: cached.data.officialAccountName || this.data.officialAccountName
      })
      // 后台静默刷新（不阻塞首屏）
      this._refreshContactConfig(CACHE_KEY)
      return
    }

    // 2. 无缓存或过期：走云函数
    this._refreshContactConfig(CACHE_KEY)
  },

  // 静默刷新联系方式配置（不报错，失败保留缓存）
  async _refreshContactConfig(CACHE_KEY) {
    try {
      const [emailRes, nameRes] = await Promise.all([
        wx.cloud.callFunction({ name: 'getConfig', data: { key: 'contactEmail' } }),
        wx.cloud.callFunction({ name: 'getConfig', data: { key: 'officialAccountName' } })
      ])

      const updates = {}
      if (emailRes.result?.success && emailRes.result?.data?.value) {
        updates.contactEmail = emailRes.result.data.value
      }
      if (nameRes.result?.success && nameRes.result?.data?.value) {
        updates.officialAccountName = nameRes.result.data.value
      }
      if (Object.keys(updates).length > 0) {
        this.setData(updates)
        setStorage(CACHE_KEY, {
          data: {
            contactEmail: updates.contactEmail || this.data.contactEmail,
            officialAccountName: updates.officialAccountName || this.data.officialAccountName
          },
          timestamp: Date.now()
        })
      }
    } catch (e) {
      console.warn('[profile] 加载联系方式配置失败，使用缓存或默认值:', e)
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
      data: this.data.officialAccountName,
      success: () => {
        wx.showToast({ title: '公众号名称已复制', icon: 'success' })
      }
    })
  },

  handleShowContactInfo() {
    wx.setClipboardData({
      data: this.data.contactEmail,
      success: () => {
        wx.showToast({ title: '邮箱已复制', icon: 'success' })
      }
    })
  },

  handleClearCache() {
    wx.showModal({
      title: '提示',
      content: '确定要清除所有本地缓存吗？(签到和辣度值数据保存在云端，不会丢失)',
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

            // 🔥 清空缓存后重置节流时间戳，强制下次 onShow 重新加载
            this._lastRefreshTime = 0
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

  // 🔥 性能测试入口：长按版本号触发
  /**
   * 触感反馈开关切换
   */
  onHapticToggle(e) {
    const enabled = !!e.detail.value
    setHapticEnabled(enabled)
    this.setData({ hapticEnabled: enabled })
    // 打开时立即给一次反馈，让用户感知开关已生效
    if (enabled) hapticTap()
  },

  async runPerfTest() {
    hapticLongPress()  // 触感反馈：长按生效
    wx.showLoading({ title: '性能测试中...', mask: true })
    try {
      const perfTest = require('../../utils/perf-test.js')
      const mod = perfTest.default || perfTest
      await mod.runAllTests({ silent: false, testNavigation: false })
      wx.hideLoading()
      wx.showModal({
        title: '性能测试完成',
        content: '详细结果已输出到 Console 面板（开发者工具 F12）',
        showCancel: false,
        confirmText: '知道了'
      })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '测试失败: ' + (e.message || ''), icon: 'none' })
    }
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
            downloadCount: 0
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

    // 🔥 优化：先渲染缓存（5分钟内），再静默刷新第一页
    const CACHE_KEY = 'profile_favorites_list'
    const cached = getStorage(CACHE_KEY)
    if (cached && cached.data && (Date.now() - cached.timestamp < 5 * 60 * 1000)) {
      this.setData({
        showFavorites: true,
        favoritesList: cached.data.list,
        favoritesPage: cached.data.page,
        favoritesEnded: cached.data.ended,
        favoritesLoading: false
      })
      // 后台静默刷新第一页（不阻塞显示）
      this._refreshFavoritesFirstPage(CACHE_KEY)
      return
    }

    // 无缓存或过期：重置并加载
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

  // 静默刷新收藏列表第一页（不显示 loading，失败保留缓存）
  async _refreshFavoritesFirstPage(CACHE_KEY) {
    try {
      const res = await getFavorites('all', 1, 20)
      const list = res.data || []
      // 仅当数据变化时才更新（避免无意义 setData 闪屏）
      const currentList = this.data.favoritesList
      const changed = list.length !== currentList.length ||
        (list[0] && currentList[0] && list[0]._id !== currentList[0]._id)
      if (changed) {
        this.setData({
          favoritesList: list,
          favoritesPage: 2,
          favoritesEnded: list.length < 20
        })
      }
      setStorage(CACHE_KEY, {
        data: { list, page: 2, ended: list.length < 20 },
        timestamp: Date.now()
      })
    } catch (e) {
      console.warn('[profile] 静默刷新收藏列表失败，保留缓存:', e)
    }
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

        // 🔥 缓存第一页数据
        if (this.data.favoritesPage === 2) {
          setStorage('profile_favorites_list', {
            data: { list: newList, page: this.data.favoritesPage, ended: this.data.favoritesEnded },
            timestamp: Date.now()
          })
        }
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
      content: `确定要清空全部 ${this.data.favoritesList.length} 条喜欢吗？此操作不可恢复。`,
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
      setStorage('profile_favorites_list', null) // 🔥 清空列表缓存
      this.loadFavoritesCount()

      wx.hideLoading()
      wx.showToast({ title: '已清空全部喜欢', icon: 'success' })
    } catch (err) {
      console.error('清空喜欢失败:', err)
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
    const itemId = item._id || item.id || ''

    if (item.type === 'avatar') {
      wx.navigateTo({
        url: `/subpackages/preview/preview?url=${encodedUrl}&isAvatar=true&id=${itemId}`
      })
    } else {
      wx.navigateTo({
        url: `/subpackages/wallpaper-preview/wallpaper-preview?url=${encodedUrl}&id=${itemId}`
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

            // 清空本地数据（异步避免阻塞）
            wx.removeStorage({ key: 'downloadHistory' })
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
