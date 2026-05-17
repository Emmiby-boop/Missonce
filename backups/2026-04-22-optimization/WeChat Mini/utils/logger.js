const ENV = __wxConfig.envVersion || 'develop'

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
