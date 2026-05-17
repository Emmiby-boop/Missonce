/**
 * 统一日志工具
 * 根据环境控制日志输出，生产环境只保留 error 级别
 */

// 判断是否为生产环境
const isProduction = import.meta.env.MODE === 'production' || import.meta.env.DEV === false

/**
 * 日志级别
 */
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
} as const

/**
 * 当前日志级别
 * 生产环境: ERROR only
 * 开发环境: ALL
 */
const currentLevel = isProduction ? LogLevel.ERROR : LogLevel.DEBUG

/**
 * 格式化日志消息
 */
const formatMessage = (level: string, context: string, message: string) => {
  const timestamp = new Date().toISOString()
  return `[${timestamp}] [${level}]${context ? ` [${context}]` : ''} ${message}`
}

/**
 * Debug 日志 - 仅开发环境
 */
export const debug = (message: string, ...args: any[]) => {
  if (currentLevel <= LogLevel.DEBUG) {
    console.debug(formatMessage('DEBUG', '', message), ...args)
  }
}

/**
 * Info 日志 - 仅开发环境
 */
export const info = (message: string, ...args: any[]) => {
  if (currentLevel <= LogLevel.INFO) {
    console.info(formatMessage('INFO', '', message), ...args)
  }
}

/**
 * Warn 日志 - 仅开发环境
 */
export const warn = (message: string, ...args: any[]) => {
  if (currentLevel <= LogLevel.WARN) {
    console.warn(formatMessage('WARN', '', message), ...args)
  }
}

/**
 * Error 日志 - 所有环境保留
 */
export const error = (message: string, error?: Error | any, ...args: any[]) => {
  if (currentLevel <= LogLevel.ERROR) {
    const errorInfo = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : error
    console.error(formatMessage('ERROR', '', message), errorInfo, ...args)
  }
}

/**
 * 带上下文的日志器
 */
export const createLogger = (context: string) => ({
  debug: (message: string, ...args: any[]) => debug(`[${context}] ${message}`, ...args),
  info: (message: string, ...args: any[]) => info(`[${context}] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => warn(`[${context}] ${message}`, ...args),
  error: (message: string, error?: Error | any, ...args: any[]) => error(`[${context}] ${message}`, error, ...args)
})

/**
 * 默认导出
 */
export default {
  debug,
  info,
  warn,
  error,
  createLogger
}
