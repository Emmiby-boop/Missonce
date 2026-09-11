// 懒初始化：避免模块加载时同步调用 wx.getAccountInfoSync() 阻塞启动
let _env = null
const getEnv = () => {
  if (_env !== null) return _env
  try {
    _env = wx.getAccountInfoSync().miniProgram.envVersion || "develop"
  } catch (e) {
    _env = "develop"
  }
  return _env
}

const isProd = () => getEnv() === "release"

export const logger = {
  debug: (...args) => {
    if (!isProd()) console.debug(...args)
  },
  log: (...args) => {
    if (!isProd()) console.log(...args)
  },
  info: (...args) => {
    if (!isProd()) console.info(...args)
  },
  warn: (...args) => {
    if (!isProd()) console.warn(...args)
  },
  error: (...args) => {
    console.error(...args)
  },
  logError: (type, message, data) => {
    console.error(`[错误监控] ${type}:`, message, data)
  },
  logPerformance: (type, data, source) => {
    if (!isProd()) {
      console.log(`[性能监控] ${type}:`, data)
    }
  },
  logPageView: (pagePath) => {
    if (!isProd()) {
      console.log(`[页面访问] ${pagePath}`)
    }
  }
}

/**
 * 上报错误到云端（logger 云函数 action=error）
 * 兼容 preview 页面中的 reportError 调用
 */
export const reportError = (data) => {
  console.error('[上报]', data)
  // 异步上报，不阻塞主流程
  try {
    if (typeof wx !== 'undefined' && wx.cloud && wx.cloud.callFunction) {
      wx.cloud.callFunction({
        name: 'logger',
        data: { action: 'error', type: 'client_error', detail: data, timestamp: Date.now() }
      }).catch(() => {})
    }
  } catch (e) {
    console.error('[logger] 日志写入失败:', e)
  }
}

export default logger
