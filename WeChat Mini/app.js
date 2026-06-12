import logger from "./utils/logger"
import { initStorageCache } from "./utils/storageManager"

const originalPage = Page

Page = function(pageConfig) {
  
  const wrapMethod = (methodName, originalMethod) => {
    return function(...args) {
      try {
        return originalMethod.apply(this, args)
      } catch (e) {
        let currentRoute = ""
        try {
          const pages = getCurrentPages()
          if (pages && pages.length > 0) {
            currentRoute = pages[pages.length - 1].route || ""
          }
        } catch (_) {}
        
        console.error(`页面方法 ${methodName} 出错 (${currentRoute}):`, e)
        logger.logError("page_error", `页面${methodName}出错`, {
          error: e.message,
          stack: e.stack,
          method: methodName
        }, currentRoute)
        throw e
      }
    }
  }
  
  const methodNames = ["onLoad", "onShow", "onReady", "onHide", "onUnload", "onPullDownRefresh", "onReachBottom", "onShareAppMessage", "onShareTimeline", "onAddToFavorites"]
  
  methodNames.forEach(methodName => {
    if (typeof pageConfig[methodName] === "function") {
      pageConfig[methodName] = wrapMethod(methodName, pageConfig[methodName])
    }
  })
  
  return originalPage(pageConfig)
}

// 🔥 启动性能监控
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

    // 🔥 仅保留关键路径：初始化storage缓存（极快）
    initStorageCache()
    
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力")
    } else {
      wx.cloud.init({ env: "missonce-99-1gfaff6n002f6ac1", traceUser: false })
    }
    
    // 🔥 处理邀请链接（非关键，延迟执行）
    setTimeout(() => {
      this.handleInviteLink()
    }, DELAY_INVITE)
    
    // 🔥 记录启动完成时间（此时应 < 30ms）
    this.performanceMonitor("launch")
    
    // 🔥 关键优化：预热首页数据，使用 nextTick 延迟到 onLaunch 完成后执行
    if (!this.globalData._preheatStarted) {
      this.globalData._preheatStarted = true
      wx.nextTick(() => {
        // 动态导入 api 模块，不阻塞模块加载
        import("./utils/api.js").then(({ getHomeData }) => {
          this._preheatHomeData(getHomeData)
        }).catch(err => {
          console.warn("[预热] api 模块加载失败:", err)
        })
      })
    }
    
    // 🔥 所有非关键任务延迟到首屏渲染完成后执行
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
          // 动态导入 storageManager 的 getStorage
          const { getStorage } = await import("./utils/storageManager")
          const userInfo = getStorage("userInfo")
          if (userInfo && userInfo.openid && userInfo.openid !== inviterOpenid) {
            await wx.cloud.callFunction({
              name: "userPoints",
              data: {
                action: "bindInviter",
                inviterOpenid: inviterOpenid
              }
            })
          }
        }, DELAY_INVITE_BIND)
      }
    } catch (e) {
      console.error("处理邀请链接失败", e)
    }
  },

  // 🔥 开屏广告期间预热首页数据
  _preheatHomeData(getHomeData) {
    if (!wx.cloud) return
    
    this.globalData.homeDataPromise = getHomeData().then(res => {
      console.log("[预热] getHomeData 完成，结果已缓存")
      return res
    }).catch(err => {
      console.warn("[预热] getHomeData 失败:", err)
      this.globalData.homeDataPromise = null
      return null
    })
  },

  performanceMonitor(type) {
    const now = Date.now()
    if (type === "launch") {
      PERFORMANCE_MARK.launchEnd = now
      const launchTime = PERFORMANCE_MARK.launchEnd - PERFORMANCE_MARK.launchStart
      console.log(`🚀 启动耗时: ${launchTime}ms`)
      
      logger.logPerformance("launch", {
        launchTime: launchTime,
        timestamp: now
      }, "app")
      
      if (launchTime > 3000) {
        console.warn(`[性能] 启动耗时过长: ${launchTime}ms`)
      }
    }
  },

  async initLoginStatus() {
    // 动态导入 auth 模块
    try {
      const { checkLoginStatus } = await import("./utils/auth")
      checkLoginStatus()
    } catch (e) {
      console.error("auth 模块加载失败:", e)
    }
  },

  preheatCloudFunctions() {
    if (!wx.cloud) return
    
    wx.cloud.callFunction({
      name: "getBanners",
      data: { status: "active" }
    }).catch(() => {})
  },

  preloadOtherPagesData() {
    if (!wx.cloud) return
    
    wx.cloud.callFunction({
      name: "getPageSections",
      data: { type: "wallpaper" }
    }).catch(() => {})
    
    wx.cloud.callFunction({
      name: "getPageSections",
      data: { type: "avatar" }
    }).catch(() => {})
  },

  logEvent(type, data = {}) {
    if (!wx.cloud) return
    wx.cloud.callFunction({
      name: "logEvent",
      data: {
        type,
        ...data,
        timestamp: Date.now()
      }
    }).catch(() => {})
  },

  globalData: {
    userInfo: null,
    token: null,
    isLoggedIn: false,
    user: null,
    homeDataPromise: null
  }
})
