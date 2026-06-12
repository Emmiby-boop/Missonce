import logger from "./utils/logger"
import { initStorageCache } from "./utils/storageManager"

// 🔥 优化：仅包装关键生命周期方法，减少包装开销
const originalPage = Page

Page = function(pageConfig) {
  const criticalMethods = ["onLoad", "onShow", "onUnload"]
  
  criticalMethods.forEach(methodName => {
    if (typeof pageConfig[methodName] === "function") {
      const originalMethod = pageConfig[methodName]
      pageConfig[methodName] = function(...args) {
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
          throw e
        }
      }
    }
  })
  
  return originalPage(pageConfig)
}

// 🔥 启动性能监控
const PERFORMANCE_MARK = {
  launchStart: 0,
  launchEnd: 0
}

App({
  onLaunch() {
    PERFORMANCE_MARK.launchStart = Date.now()

    // 🔥 关键路径：初始化 storage 缓存
    initStorageCache()
    
    // 🔥 云开发必须同步初始化（页面可能立即使用）
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力")
    } else {
      wx.cloud.init({ env: "missonce-99-1gfaff6n002f6ac1", traceUser: false })
    }
    
    // 🔥 预热首页数据（延迟执行，不阻塞首屏）
    setTimeout(() => {
      this._preheatAfterCloudInit()
    }, 100)
    
    // 🔥 记录启动完成时间
    this.performanceMonitor("launch")
  },

  _preheatAfterCloudInit() {
    try {
      const api = require("./utils/api.js")
      this.globalData.homeDataPromise = api.getHomeData().then(res => {
        console.log("[预热] getHomeData 完成")
        return res
      }).catch(err => {
        console.warn("[预热] getHomeData 失败:", err)
        this.globalData.homeDataPromise = null
        return null
      })
    } catch (e) {
      console.warn("[预热] api 模块加载失败:", e)
    }
  },

  performanceMonitor(type) {
    const now = Date.now()
    if (type === "launch") {
      PERFORMANCE_MARK.launchEnd = now
      const launchTime = PERFORMANCE_MARK.launchEnd - PERFORMANCE_MARK.launchStart
      console.log(`🚀 启动耗时: ${launchTime}ms`)
      
      if (launchTime > 3000) {
        console.warn(`[性能] 启动耗时过长: ${launchTime}ms`)
      }
    }
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
