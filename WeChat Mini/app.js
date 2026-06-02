import { checkLoginStatus } from './utils/auth'
import logger from './utils/logger'
import { getStorage, initStorageCache } from './utils/storageManager'
import { getHomeData } from './utils/api.js'

const originalPage = Page

Page = function(pageConfig) {
  
  const wrapMethod = (methodName, originalMethod) => {
    return function(...args) {
      try {
        return originalMethod.apply(this, args)
      } catch (e) {
        // 动态获取当前页面路径，而非硬编码空字符串
        let currentRoute = ''
        try {
          const pages = getCurrentPages()
          if (pages && pages.length > 0) {
            currentRoute = pages[pages.length - 1].route || ''
          }
        } catch (_) {}
        
        console.error(`页面方法 ${methodName} 出错 (${currentRoute}):`, e)
        logger.logError('page_error', `页面${methodName}出错`, {
          error: e.message,
          stack: e.stack,
          method: methodName
        }, currentRoute)
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

const DELAY_INVITE = 1000
const DELAY_NON_CRITICAL = 3000
const DELAY_INVITE_BIND = 2000

App({
  onLaunch() {
    PERFORMANCE_MARK.launchStart = Date.now()

    // 🔥 P1 优化：仅保留关键路径，初始化storage缓存（极快）
    initStorageCache()
    
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({ env: 'missonce-99-1gfaff6n002f6ac1', traceUser: false })
    }
    
    // 🔥 P1 优化：处理邀请链接（非关键，延迟执行）
    setTimeout(() => {
      this.handleInviteLink()
    }, DELAY_INVITE)
    
    // 🔥 记录启动完成时间（此时应该 < 30ms）
    this.performanceMonitor('launch')
    
    // 🔥 关键优化：预热首页数据，使用 nextTick 延迟到 onLaunch 完成后执行
    // 避免阻塞启动流程，但仍在首屏渲染前完成预热
    if (!this.globalData._preheatStarted) {
      this.globalData._preheatStarted = true
      wx.nextTick(() => {
        this._preheatHomeData()
      })
    }
    
    // 🔥 P1 优化：所有非关键任务延迟到首屏渲染完成后执行
    setTimeout(() => {
      this.preheatCloudFunctions()
      this.preloadOtherPagesData()
      this.initLoginStatus()
    }, DELAY_NON_CRITICAL)
  },

  async handleInviteLink() {
    try {
      const launchOptions = wx.getLaunchOptionsSync()
      const query = launchOptions.query
      
      if (query && query.inviter) {
        const inviterOpenid = query.inviter
        
        setTimeout(async () => {
          const userInfo = getStorage('userInfo')
          if (userInfo && userInfo.openid && userInfo.openid !== inviterOpenid) {
            await wx.cloud.callFunction({
              name: 'userPoints',
              data: {
                action: 'bindInviter',
                inviterOpenid: inviterOpenid
              }
            })
          }
        }, DELAY_INVITE_BIND)
      }
    } catch (e) {
      console.error('处理邀请链接失败:', e)
    }
  },

  // 🔥 关键优化：开屏广告期间预热首页数据（立即开始，不阻塞）
  // 预热结果存入 globalData.homeDataPromise，首页直接复用避免重复请求
  _preheatHomeData() {
    if (!wx.cloud) return
    
    // getHomeData 已在文件顶部 import，此处直接使用
    // 它会检查本地缓存，有则直接返回；无则调云函数
    // 同时把 Promise 保存到 globalData 供首页复用
    this.globalData.homeDataPromise = getHomeData().then(res => {
      console.log('[预热] getHomeData 完成，结果已缓存')
      return res
    }).catch(err => {
      console.warn('[预热] getHomeData 失败:', err)
      this.globalData.homeDataPromise = null
      return null
    })
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
        console.warn(`[性能] 启动耗时过长: ${launchTime}ms`)
      }
    }
  },

  // 异步初始化登录状态
  async initLoginStatus() {
    checkLoginStatus()
  },

  // 🔥 预热云函数（延迟到首屏渲染完成后，不阻塞启动）
  // 注意：首页数据预热已在 onLaunch 中由 _preheatHomeData() 完成，这里不再重复
  preheatCloudFunctions() {
    if (!wx.cloud) return
    
    // 其他预热请求
    wx.cloud.callFunction({
      name: 'getBanners',
      data: { status: 'active' }
    }).catch(() => {})
  },

  // 🔥 预加载壁纸页和头像页数据（延迟到首屏渲染完成后）
  preloadOtherPagesData() {
    if (!wx.cloud) return
    
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
    user: null,
    // 🔥 预热 Promise，供页面复用
    homeDataPromise: null
  }
})
