const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 日志云函数（合并原 logEvent + logError）
 *
 * 调用方式：
 *   事件埋点：{ action: 'event', type, resourceId, ...data }
 *   错误上报：{ action: 'error', type, message, detail, deviceInfo, page }
 *
 * 默认 action='event'（向后兼容旧 logEvent 调用方）
 */
exports.main = async (event, context) => {
  // 🔥 定时触发器保活：快速返回，避免冷启动
  if (event && event.Type === 'timer') {
    return { success: true, msg: 'keepalive' }
  }

  const wxContext = cloud.getWXContext()
  const { action = 'event' } = event

  try {
    // --------------------------------------------------
    // 批量事件上报（PV 等，减少 callFunction 次数）
    // --------------------------------------------------
    if (action === 'batch') {
      const { events = [] } = event
      if (!events.length) return { success: true }
      const tasks = events.map(evt => {
        const { type, ...data } = evt
        return db.collection('events').add({
          data: {
            type,
            ...data,
            _openid: wxContext.OPENID,
            clientIp: wxContext.CLIENTIP,
            createTime: db.serverDate()
          }
        }).catch(() => {})
      })
      await Promise.all(tasks)
      return { success: true, count: events.length }
    }

    // --------------------------------------------------
    // 事件埋点（原 logEvent）
    // --------------------------------------------------
    if (action === 'event') {
      const { type, resourceId, ...data } = event

      // 1. 记录到事件表
      const logPromise = db.collection('events').add({
        data: {
          type,
          resourceId,
          ...data,
          _openid: wxContext.OPENID,
          clientIp: wxContext.CLIENTIP,
          createTime: db.serverDate()
        }
      })

      // 2. 如果是 PV 事件且有资源ID，同步更新资源的浏览量和热度
      let statsPromise = Promise.resolve()
      if (type === 'pv' && resourceId && typeof resourceId === 'string' && !resourceId.startsWith('http') && !resourceId.startsWith('cloud:')) {
        const _ = db.command
        statsPromise = db.collection('resources').doc(resourceId).update({
          data: {
            viewCount: _.inc(1),
            updatedAt: db.serverDate()
          }
        }).catch(err => {
          console.warn('[logger] Update resource stats failed for pv:', err)
        })
      }

      await Promise.all([logPromise, statsPromise])

      return { success: true }
    }

    // --------------------------------------------------
    // 错误上报（原 logError）
    // --------------------------------------------------
    if (action === 'error') {
      const { type, message, detail, deviceInfo, page } = event

      return await db.collection('error_logs').add({
        data: {
          openid: wxContext.OPENID,
          type: type || 'error', // error, warning, info
          message: message || '未知错误',
          detail: detail || {},
          deviceInfo: deviceInfo || {}, // 客户端设备信息
          page: page || '',
          timestamp: Date.now(),
          createTime: db.serverDate(),
          env: wxContext.ENV
        }
      })
    }

    return { success: false, message: `未知 action: ${action}` }
  } catch (err) {
    console.error('[logger] failed', err)
    return {
      success: false,
      errMsg: err
    }
  }
}
