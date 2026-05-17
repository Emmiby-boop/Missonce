import { checkLoginStatus } from './utils/auth'
import logger from './utils/logger'
import { initStorageCache } from './utils/storageManager'

const originalPage = Page

Page = function(pageConfig) {
  const pagePath = ''
  
  const wrapMethod = (methodName, originalMethod) => {
    return function(...args) {
      try {
        return originalMethod.apply(this, args)
      } catch (e) {
        console.error(`页面方法 ${methodName} 出错:`, e)
        logger.logError('page_error', `页面${methodName}出错`, {
          error: e.message,
          stack: e.stack,
          method: methodName
        }, pagePath)
        throw e
      }
    }
  }
  
  const methodNames = ['onLoad', 'onShow', 'onReady', 'onHide', 'onUnload', 'onPullDownRefresh', 'onReachBottom', 'onShareAppMessage', 'onShareTimeline', 'onAddToFavorites']
  
  methodNames.forEach(methodName => {
    if (typeof pageConfig[methodName] === 'function') {
      pageConfig[methodName] = wrapMethod(methodName, pageConfig[methodName])
    }
  })
  
  return originalPage(pageConfig)
}

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
    
    // 初始化storage缓存
    initStorageCache()
    
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({ env: 'missonce-99-1gfaff6n002f6ac1', traceUser: false })
    }
    
    // 🔥 处理邀请链接
    this.handleInviteLink()
    
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

  async handleInviteLink() {
    try {
      const launchOptions = wx.getLaunchOptionsSync()
      const query = launchOptions.query
      
      if (query && query.inviter) {
        const inviterOpenid = query.inviter
        
        setTimeout(async () => {
          const userInfo = wx.getStorageSync('userInfo')
          if (userInfo && userInfo.openid && userInfo.openid !== inviterOpenid) {
            await wx.cloud.callFunction({
              name: 'userPoints',
              data: {
                action: 'bindInviter',
                inviterOpenid: inviterOpenid
              }
            })
          }
        }, 2000)
      }
    } catch (e) {
      console.error('处理邀请链接失败:', e)
    }
  },

  // 性能监控
  performanceMonitor(type) {
    const now = Date.now()
    if (type === 'launch') {
      PERFORMANCE_MARK.launchEnd = now
      const launchTime = PERFORMANCE_MARK.launchEnd - PERFORMANCE_MARK.launchStart
      console.log(`🚀 启动耗时: ${launchTime}ms`)
      
      logger.logPerformance('launch', {
        launchTime: launchTime,
        timestamp: now
      }, 'app')
      
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
      data: { type: 'wallpaper' }
    }).catch(() => {})
    
    // 预加载头像页板块数据
    wx.cloud.callFunction({
      name: 'getPageSections',
      data: { type: 'avatar' }
    }).catch(() => {})
    
    console.log('🔥 预加载完成')
  },

  // 事件埋点
  logEvent(type, data = {}) {
    if (!wx.cloud) return
    wx.cloud.callFunction({
      name: 'logEvent',
      data: {
        type,
        ...data,
        timestamp: Date.now()
      }
    }).catch(() => {})
  },

  // 全局数据
  globalData: {
    userInfo: null,
    token: null,
    isLoggedIn: false,
    user: null
  }
})