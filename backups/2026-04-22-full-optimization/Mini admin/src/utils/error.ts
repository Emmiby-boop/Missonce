/**
 * 统一错误处理工具 - 管理后台版本
 */
import { ElMessage, ElMessageBox } from 'element-plus'
import logger from './logger'

/**
 * 应用错误类
 */
export class AppError extends Error {
  code: string
  statusCode: number

  constructor(message: string, code = 'UNKNOWN', statusCode = 500) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
  }
}

/**
 * 处理错误并提示用户
 */
export const handleError = (
  error: any,
  context: string = '',
  options: { showToast?: boolean; showDialog?: boolean; title?: string } = {}
) => {
  const { showToast = true, showDialog = false, title = '错误' } = options

  // 获取错误消息
  let message = '操作失败，请稍后重试'
  if (error instanceof Error) {
    message = error.message
  } else if (typeof error === 'string') {
    message = error
  } else if (error?.message) {
    message = error.message
  }

  // 记录日志
  logger.error(`[${context}] ${message}`, error)

  // 弹窗提示
  if (showDialog) {
    ElMessageBox.alert(message, title, {
      type: 'error',
      confirmButtonText: '确定'
    })
  } else if (showToast) {
    ElMessage.error(message)
  }

  return { success: false, message, code: error?.code }
}

/**
 * 处理 API 错误
 */
export const handleApiError = (error: any, context = '') => {
  let message = '请求失败，请稍后重试'
  let code = 'API_ERROR'

  if (error?.response?.data?.message) {
    message = error.response.data.message
  } else if (error?.message) {
    message = error.message
  } else if (error?.msg) {
    message = error.msg
  }

  if (error?.code) {
    code = error.code
  }

  logger.error(`[API Error] ${context}:`, { message, code, error })

  ElMessage.error(message)

  return { success: false, message, code }
}

/**
 * Try-Catch 包装函数
 */
export const tryCatch = async <T>(
  promise: Promise<T>,
  context = ''
): Promise<{ success: true; data: T } | { success: false; message: string }> => {
  try {
    const data = await promise
    return { success: true, data }
  } catch (error) {
    return handleError(error, context) as any
  }
}

/**
 * 确认对话框
 */
export const confirm = (
  message: string,
  title = '确认'
): Promise<boolean> => {
  return ElMessageBox.confirm(message, title, {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => true)
    .catch(() => false)
}

export default {
  AppError,
  handleError,
  handleApiError,
  tryCatch,
  confirm
}
