const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const ERROR_COLLECTION = 'error_logs'
const MAX_ERROR_LOGS = 1000

class ErrorMonitor {
  constructor() {
    this.errorCounts = {}
    this.lastAlertTime = {}
    this.alertThreshold = 10
    this.alertTimeWindow = 60000
  }

  async logError(error, context = {}) {
    try {
      const errorKey = this.getErrorKey(error)
      const now = Date.now()

      const errorLog = {
        message: error.message || String(error),
        stack: error.stack || '',
        name: error.name || 'UnknownError',
        context: {
          ...context,
          timestamp: now,
          userAgent: context.userAgent || 'unknown',
          page: context.page || 'unknown',
          userId: context.userId || 'anonymous'
        }
      }

      console.error('[ErrorMonitor]', errorLog)

      await db.collection(ERROR_COLLECTION).add({
        data: errorLog
      })

      this.errorCounts[errorKey] = (this.errorCounts[errorKey] || 0) + 1

      if (this.shouldAlert(errorKey, now)) {
        await this.sendAlert(errorKey, this.errorCounts[errorKey], errorLog)
        this.lastAlertTime[errorKey] = now
      }

      await this.cleanupOldLogs()
    } catch (err) {
      console.error('[ErrorMonitor] Failed to log error:', err)
    }
  }

  getErrorKey(error) {
    return `${error.name || 'Error'}:${error.message || 'Unknown'}`
  }

  shouldAlert(errorKey, now) {
    const count = this.errorCounts[errorKey] || 0
    const lastAlert = this.lastAlertTime[errorKey] || 0

    return count >= this.alertThreshold && 
           (now - lastAlert) > this.alertTimeWindow
  }

  async sendAlert(errorKey, count, errorLog) {
    console.warn(`[ErrorMonitor] Alert: ${errorKey} occurred ${count} times`)
    
    try {
      await db.collection('admin_notifications').add({
        data: {
          type: 'error_alert',
          title: `错误警报: ${errorKey}`,
          message: `错误 "${errorKey}" 在短时间内发生了 ${count} 次`,
          level: 'high',
          data: {
            errorKey,
            count,
            errorLog
          },
          createdAt: db.serverDate(),
          read: false
        }
      })
    } catch (err) {
      console.error('[ErrorMonitor] Failed to send alert:', err)
    }
  }

  async cleanupOldLogs() {
    try {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
      
      const oldLogs = await db.collection(ERROR_COLLECTION)
        .where({
          'context.timestamp': db.command.lt(thirtyDaysAgo)
        })
        .limit(100)
        .get()

      if (oldLogs.data.length > 0) {
        const deletePromises = oldLogs.data.map(log => 
          db.collection(ERROR_COLLECTION).doc(log._id).remove()
        )
        await Promise.all(deletePromises)
        console.log(`[ErrorMonitor] Cleaned up ${oldLogs.data.length} old error logs`)
      }
    } catch (err) {
      console.error('[ErrorMonitor] Failed to cleanup:', err)
    }
  }

  async getErrorStats() {
    try {
      const logs = await db.collection(ERROR_COLLECTION)
        .orderBy('context.timestamp', 'desc')
        .limit(100)
        .get()

      const stats = {
        total: logs.data.length,
        byType: {},
        recent: logs.data.slice(0, 10)
      }

      logs.data.forEach(log => {
        const key = log.name || 'Unknown'
        stats.byType[key] = (stats.byType[key] || 0) + 1
      })

      return stats
    } catch (err) {
      console.error('[ErrorMonitor] Failed to get stats:', err)
      return { total: 0, byType: {}, recent: [] }
    }
  }
}

module.exports = ErrorMonitor
