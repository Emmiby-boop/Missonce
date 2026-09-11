import logger from "./utils/logger"
import { initStorageCache } from "./utils/storageManager"
import { ENV_ID } from "./config/constants.js"
import { isLowEndDevice } from "./utils/device.js"

// 🔥 PV 事件本地批量上报：避免每次切页都调 logger 云函数（单次 callFunction 约 300-600ms）
// 策略：PV 先缓存到内存，累积 5 条或每 30 秒批量上报一次
const _eventBuffer = []
const _EVENT_FLUSH_THRESHOLD = 5
const _EVENT_FLUSH_INTERVAL = 30 * 1000
let _eventFlushTimer = null

function _scheduleFlush() {
  if (_eventFlushTimer) return
  _eventFlushTimer = setTimeout(() => {
    _eventFlushTimer = null
    _flushEvents()
  }, _EVENT_FLUSH_INTERVAL)
}

function _flushEvents() {
  if (_eventBuffer.length === 0) return
  const batch = _eventBuffer.splice(0, _eventBuffer.length)
  if (!wx.cloud) return
  wx.cloud.callFunction({
    name: "logger",
    data: { action: 'batch', events: batch }
  }).catch(() => {
    // 上报失败不影响用户体验，静默丢弃
  })
}

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
          } catch (_) {
            console.error('[app] 获取当前页面路由失败:', _)
          }

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
      wx.cloud.init({ env: ENV_ID, traceUser: false })
    }

    // 🔥 低端机检测（benchmarkLevel ≤ 10）：供页面挂 low-end class 降级毛玻璃等效果
    this.globalData.lowEnd = isLowEndDevice()

    // 🔥 记录启动完成时间
    this.performanceMonitor("launch")
  },

  onShow(options) {
    // 🔥 热启动：记录分享/扫码参数，供首页 onShow 消费
    if (options) {
      const path = options.path || ''
      // 只有入口页是首页时才需要存 pending（直接分享到预览页由预览页自己处理）
      if (path === 'pages/index/index' || path === 'pages/index/index.html') {
        const shareOpts = this._parseShareOptions(options)
        if (shareOpts) {
          this.globalData.pendingShareRedirect = shareOpts
        }
      }
    }
  },

  _parseShareOptions(options) {
    // 优先取 query，再取 query.scene（扫码场景）
    const query = options.query || {}

    if (query.id) return { type: 'id', value: query.id }
    if (query.c) return { type: 'code', value: query.c }

    let scene = query.scene
    if (scene) {
      try {
        scene = decodeURIComponent(scene)
      } catch (e) {
        console.warn('[app] scene 解码失败，降级处理:', e)
      }
      if (scene.startsWith('c=')) return { type: 'code', value: scene.substring(2) }
      if (scene.startsWith('id=')) return { type: 'id', value: scene.substring(3) }
    }

    return null
  },

  performanceMonitor(type) {
    const now = Date.now()
    if (type === "launch") {
      PERFORMANCE_MARK.launchEnd = now
      // 🔥 启动耗时存入 globalData（轻量数字），perf-test 手动测试时回读，
      //    避免 onLaunch 顶层 import 整个 perf-test 模块（约 20KB）阻塞启动解析
      if (this.globalData) {
        this.globalData._perfLaunch = {
          start: PERFORMANCE_MARK.launchStart,
          end: now
        }
      }
      const launchTime = PERFORMANCE_MARK.launchEnd - PERFORMANCE_MARK.launchStart

      if (launchTime > 3000) {
        console.warn(`[性能] 启动耗时过长: ${launchTime}ms`)
      }

      // 🔥 自动性能测试已关闭（避免每次启动跑 5+ 秒的完整测试）
      // 如需手动测试：在「我的」页面长按版本号触发
    }
  },

  logEvent(type, data = {}) {
    if (!wx.cloud) return
    // 🔥 PV 事件走批量上报，非 PV 事件（如 download/error）立即上报
    if (type === 'pv') {
      _eventBuffer.push({ type, ...data, timestamp: Date.now() })
      if (_eventBuffer.length >= _EVENT_FLUSH_THRESHOLD) {
        _flushEvents()
      } else {
        _scheduleFlush()
      }
      return
    }
    // 非 PV 事件立即上报
    wx.cloud.callFunction({
      name: "logger",
      data: {
        action: 'event',
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
    // 🔥 低端机标记（onLaunch 时检测一次，页面读取挂 low-end class）
    lowEnd: false,
    // 🔥 启动耗时打点（perf-test 手动测试时回读）
    _perfLaunch: null
  }
})
