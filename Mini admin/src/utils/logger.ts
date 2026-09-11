/**
 * 统一日志工具
 * - log：调试日志，仅开发环境输出（生产构建由 esbuild pure 选项移除）
 * - warn：警告日志，始终保留
 * - error：错误日志，始终保留，后续可扩展上报到监控平台
 *
 * 使用方式：
 *   import { logger } from '@/utils/logger'
 *   logger.log('调试信息', data)
 *   logger.warn('警告信息')
 *   logger.error('错误信息', err)
 */
const isDev = import.meta.env.DEV

export const logger = {
  log: (...args: unknown[]): void => {
    // eslint-disable-next-line no-console
    if (isDev) console.log(...args)
  },
  warn: (...args: unknown[]): void => {
    console.warn(...args)
  },
  error: (...args: unknown[]): void => {
    console.error(...args)
  },
}
