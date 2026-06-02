/**
 * 网络请求重试工具
 * 用于提升网络请求的可靠性
 */

/**
 * 包装函数，添加自动重试
 * @param {Function} fn - 异步请求函数
 * @param {Number} maxRetries - 最大重试次数（默认2次，总共3次尝试）
 * @param {Number} baseDelay - 基础延迟毫秒数（每次重试递增）
 */
export const withRetry = (fn, maxRetries = 2, baseDelay = 1000) => {
  return async (...args) => {
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn(...args)
      } catch (err) {
        if (i === maxRetries) throw err
        const delay = baseDelay * (i + 1)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
}

/**
 * 包装 wx.request，添加超时和重试
 * @param {Object} options - wx.request 参数
 * @param {Number} retries - 重试次数
 */
export const requestWithRetry = (options, retries = 1) => {
  const { timeout = 15000, ...restOptions } = options
  
  const doRequest = (attempt) => {
    return new Promise((resolve, reject) => {
      wx.request({
        ...restOptions,
        timeout,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res)
          } else if (res.statusCode >= 500 && attempt < retries) {
            // 服务端错误可重试
            setTimeout(() => {
              doRequest(attempt + 1).then(resolve).catch(reject)
            }, 1000 * (attempt + 1))
          } else {
            reject(new Error(`Request failed with status ${res.statusCode}`))
          }
        },
        fail: (err) => {
          if (attempt < retries) {
            setTimeout(() => {
              doRequest(attempt + 1).then(resolve).catch(reject)
            }, 1000 * (attempt + 1))
          } else {
            reject(err)
          }
        }
      })
    })
  }
  
  return doRequest(0)
}

export default {
  withRetry,
  requestWithRetry
}
