
import { checkLoginStatus } from './utils/auth'

// 启动性能监控
const PERFORMANCE_MARK = {
  launchStart: 0,
  launchEnd: 0,
  firstScreenReady: 0
}

App({
  onLaunch() {
    PERFORMANCE_MARK.launchStart = Date.now()
    console.log('小程序启动')
    
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({ env: 'missonce-99-1gfaff6n002f6ac1', traceUser: false })
    }
    
    // 🔥 立即预热云函数（不阻塞）
    this.preheatCloudFunctions()
    
    // 🔥 优化：改为异步执行，不阻塞启动
    // 登录状态检查延迟到首屏渲染完成后
    setTimeout(() => {
      this.initLoginStatus()
    }, 1000)
    
    // 记录启动完成时间
    this.performanceMonitor('launch')
  },

  // 性能监控
  performanceMonitor(type) {
    const now = Date.now()
    if (type === 'launch') {
      PERFORMANCE_MARK.launchEnd = now
      const launchTime = PERFORMANCE_MARK.launchEnd - PERFORMANCE_MARK.launchStart
      console.log(`🚀 启动耗时: ${launchTime}ms`)
      
      // 上报启动性能（可选择发送到服务器）
      if (launchTime > 3000) {
        console.warn('⚠️ 启动超时警告:', launchTime)
      }
    }
  },

  // 异步初始化登录状态
  async initLoginStatus() {
    // 移除动态import，使用顶部导入
    checkLoginStatus()
  },

  // 🔥 预热云函数（不阻塞首屏）
  // 在小程序启动后静默调用云函数，使其保持活跃状态
  preheatCloudFunctions() {
    if (!wx.cloud) return
    
    // 静默预热，不阻塞用户操作
    wx.cloud.callFunction({
      name: 'getBanners',
      data: { status: 'active' }
    }).catch(() => {})
    
    wx.cloud.callFunction({
      name: 'getHomeData'
    }).catch(() => {})
    
    console.log('🔥 云函数已预热')
  },

  // 🔥 预加载壁纸页和头像页数据
  // 在首页加载完成后静默预加载，提升后续页面访问速度
  preloadOtherPagesData() {
    if (!wx.cloud) return
    
    const now = Date.now()
    
    // 预加载壁纸页板块数据
    wx.cloud.callFunction({
      name: 'getPageSections',
      data: { page: 'wallpaper' }
    }).then(res => {
      if (res.result && res.result.success && res.result.data) {
        wx.setStorageSync('wallpaper_sections_cache', {
          data: res.result.data,
          expire: now + 10 * 60 * 1000
        })
      }
    }).catch(() => {})
    
    // 预加载头像页板块数据
    wx.cloud.callFunction({
      name: 'getPageSections',
      data: { page: 'avatar' }
    }).then(res => {
      if (res.result && res.result.success && res.result.data) {
        wx.setStorageSync('avatar_sections_cache', {
          data: res.result.data,
          expire: now + 10 * 60 * 1000
        })
      }
    }).catch(() => {})
    
    console.log('🔥 页面数据已预加载')
  },

  onShow(options) {
    if (options && options.referrerInfo) {
      console.log('App Show referrerInfo:', options.referrerInfo)
    }
    // onShow 中改为延迟检查
    setTimeout(() => {
      const { checkLoginStatus } = require('./utils/auth.js')
      checkLoginStatus()
    }, 2000)
  },

  logEvent(type, data = {}) {
    if (!wx.cloud) return;
    // Use cloud function to log events to bypass DB permission issues
    wx.cloud.callFunction({
      name: 'logEvent',
      data: {
        type,
        ...data
      }
    }).catch(err => {
      console.error('Event log failed', err);
    });
  },

  globalData: {
    userInfo: null,
    isLoggedIn: false,
    token: null,
    openid: null,
    user: null
  }
})
