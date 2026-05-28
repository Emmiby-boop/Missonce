import { getAppBaseInfo, getDeviceInfo } from './storageManager.js'

class ErrorMonitor {
  constructor() {
    this.errorQueue = []
    this.maxQueueSize = 50
    this.flushInterval = 30000
    this.isDevelopment = false
    this.init()
  }

  init() {
    try {
      const accountInfo = wx.getAccountInfoSync()
      this.isDevelopment = accountInfo.miniProgram.envVersion === 'develop'
      
      wx.onError(error => {
        this.captureError(error, { type: 'uncaught' })
      })
      
      wx.onUnhandledRejection(res => {
        this.captureError(res.reason, { 
          type: 'unhandledRejection',
          promise: res.promise 
        })
      })
      
      setInterval(() => this.flush(), this.flushInterval)
      
      console.log('[ErrorMonitor] Initialized')
    } catch (err) {
      console.error('[ErrorMonitor] Init failed:', err)
    }
  }

  captureError(error, context = {}) {
    if (this.isDevelopment) {
      console.error('[ErrorMonitor]', error, context)
    }

    const errorInfo = {
      message: error?.message || String(error),
      stack: error?.stack || '',
      name: error?.name || 'Error',
      context: {
        ...context,
        timestamp: Date.now(),
        page: this.getCurrentPage(),
        userInfo: this.getUserInfo(),
        systemInfo: this.getSystemInfo()
      }
    }

    this.errorQueue.push(errorInfo)

    if (this.errorQueue.length >= this.maxQueueSize) {
      this.flush()
    }
  }

  async flush() {
    if (this.errorQueue.length === 0) return

    const errors = [...this.errorQueue]
    this.errorQueue = []

    try {
      await wx.cloud.callFunction({
        name: 'logError',
        data: { errors }
      })
      console.log(`[ErrorMonitor] Reported ${errors.length} errors`)
    } catch (err) {
      console.error('[ErrorMonitor] Failed to report errors:', err)
      this.errorQueue.unshift(...errors)
    }
  }

  getCurrentPage() {
    try {
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1]
      return currentPage?.route || 'unknown'
    } catch (err) {
      return 'unknown'
    }
  }

  getUserInfo() {
    try {
      const app = getApp()
      return {
        userId: app?.globalData?.userId || 'anonymous',
        hasLogin: !!app?.globalData?.userId
      }
    } catch (err) {
      return { userId: 'anonymous', hasLogin: false }
    }
  }

  getSystemInfo() {
    try {
      const appBaseInfo = getAppBaseInfo()
      const deviceInfo = getDeviceInfo()
      return {
        platform: deviceInfo.platform,
        system: deviceInfo.system,
        version: appBaseInfo.version,
        SDKVersion: appBaseInfo.SDKVersion,
        brand: deviceInfo.brand,
        model: deviceInfo.model
      }
    } catch (err) {
      return {}
    }
  }
}

const errorMonitor = new ErrorMonitor()

export const captureError = (error, context) => {
  errorMonitor.captureError(error, context)
}

export const captureException = (error, context) => {
  errorMonitor.captureError(error, { ...context, type: 'exception' })
}

export const captureMessage = (message, context) => {
  errorMonitor.captureError(new Error(message), { ...context, type: 'message' })
}

export default errorMonitor
