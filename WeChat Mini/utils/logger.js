// 使用微信官方 API 获取环境版本，替代不可靠的 __wxConfig 内部变量
const ENV = (() => {
  try {
    return wx.getAccountInfoSync().miniProgram.envVersion || 'develop'
  } catch (e) {
    return 'develop'
  }
})()

export const logger = {
  debug: (...args) => {
    if (ENV !== 'release') console.debug(...args)
  },
  log: (...args) => {
    if (ENV !== 'release') console.log(...args)
  },
  info: (...args) => {
    if (ENV !== 'release') console.info(...args)
  },
  warn: (...args) => {
    if (ENV !== 'release') console.warn(...args)
  },
  error: (...args) => {
    console.error(...args)
  },
  logError: (type, message, data) => {
    console.error(`[错误监控] ${type}:`, message, data)
  },
  logPerformance: (type, data, source) => {
    if (ENV !== 'release') {
      console.log(`[性能监控] ${type}:`, data)
    }
  },
  logPageView: (pagePath) => {
    if (ENV !== 'release') {
      console.log(`[页面访问] ${pagePath}`)
    }
  }
}

export default logger
