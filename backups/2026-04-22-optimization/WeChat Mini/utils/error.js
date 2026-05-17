import { STORAGE_KEYS } from '../config/constants'

export class AppError extends Error {
  constructor(message, code = 'UNKNOWN', originalError = null) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.originalError = originalError
  }
}

export const handleError = (error, context = '') => {
  const msg = error.message || '操作失败，请稍后重试'
  
  // 生产环境保留错误日志
  console.error(`[${context}] Error:`, error)
  
  wx.showToast({
    title: msg,
    icon: 'none',
    duration: 2000
  })
  
  return { success: false, message: msg }
}

export const tryCatch = async (promise, context = '') => {
  try {
    return await promise
  } catch (error) {
    return handleError(error, context)
  }
}
