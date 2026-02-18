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
    // 生产环境也保留错误日志，以便监控
    console.error(...args)
  }
}

export default logger
