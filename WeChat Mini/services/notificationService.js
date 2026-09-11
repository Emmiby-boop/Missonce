import { getStorage, setStorage } from '../utils/storageManager.js'
import logger from '../utils/logger.js'

let cachedNotifications = null
let cachedReadIds = null
let cachedUnreadCount = null

// 🔥 在途去重 + 结果缓存：冷启动时 loadNotificationBadge 与 checkAnnouncement 并发调用
// 同一批云函数（此前 getActiveNotifications/getUserReadStatus 各被发 2 次 = 4 个请求）。
// 相同 action 在途时共享同一个 Promise；成功结果缓存 3 分钟（通知非高频变化数据）。
const PENDING_TTL = 3 * 60 * 1000
const _pending = new Map()   // action -> Promise（在途请求）
const _resultCache = new Map() // action -> { data, time }（成功结果）

async function _callGetNotifications(action, extraData) {
  const cacheKey = extraData ? `${action}:${JSON.stringify(extraData)}` : action

  // 1) 成功结果缓存
  const cached = _resultCache.get(cacheKey)
  if (cached && Date.now() - cached.time < PENDING_TTL) {
    return cached.data
  }

  // 2) 在途去重：相同请求共享同一 Promise
  if (_pending.has(cacheKey)) {
    return _pending.get(cacheKey)
  }

  const req = wx.cloud.callFunction({
    name: 'getNotifications',
    data: extraData ? { action, data: extraData } : { action }
  }).then(res => {
    _resultCache.set(cacheKey, { data: res, time: Date.now() })
    return res
  }).finally(() => {
    _pending.delete(cacheKey)
  })

  _pending.set(cacheKey, req)
  return req
}

export const notificationService = {
  async getActiveNotifications() {
    try {
      const res = await _callGetNotifications('getActiveNotifications')

      if (res.result && res.result.success) {
        cachedNotifications = res.result.data || []
        return cachedNotifications
      }
      return cachedNotifications || []
    } catch (err) {
      console.error('获取通知列表失败:', err)
      return cachedNotifications || []
    }
  },

  async getUserReadStatus() {
    try {
      const res = await _callGetNotifications('getUserReadStatus')

      if (res.result && res.result.success) {
        cachedReadIds = res.result.data.readNotificationIds || []
        return cachedReadIds
      }
      return cachedReadIds || []
    } catch (err) {
      console.error('获取用户已读状态失败:', err)
      return cachedReadIds || []
    }
  },

  async getUnreadCount() {
    try {
      const [notifications, readIds] = await Promise.all([
        this.getActiveNotifications(),
        this.getUserReadStatus()
      ])

      const localReadIds = this.getLocalReadIds()
      const mergedReadIds = [...new Set([...readIds, ...localReadIds])]
      const unreadCount = notifications.filter(n => !mergedReadIds.includes(n._id)).length
      cachedUnreadCount = unreadCount
      return unreadCount
    } catch (err) {
      console.error('获取未读通知数失败:', err)
      return cachedUnreadCount || 0
    }
  },

  async markAsRead(notificationId) {
    if (!notificationId) return false

    try {
      const localReadIds = this.getLocalReadIds()
      if (!localReadIds.includes(notificationId)) {
        localReadIds.push(notificationId)
        this.saveLocalReadIds(localReadIds)
      }

      await wx.cloud.callFunction({
        name: 'getNotifications',
        data: {
          action: 'markAsRead',
          data: { notificationId }
        }
      })

      // 🔥 已读状态已变化，清除 getUserReadStatus 结果缓存（否则 3 分钟内未读数偏大）
      _resultCache.delete('getUserReadStatus')

      if (cachedUnreadCount !== null && cachedUnreadCount > 0) {
        cachedUnreadCount--
      }

      return true
    } catch (err) {
      console.error('标记已读失败:', err)
      return false
    }
  },

  async markAllAsRead(notificationIds) {
    if (!notificationIds || !Array.isArray(notificationIds)) return false

    try {
      const localReadIds = this.getLocalReadIds()
      const newReadIds = [...new Set([...localReadIds, ...notificationIds])]
      this.saveLocalReadIds(newReadIds)

      await wx.cloud.callFunction({
        name: 'getNotifications',
        data: {
          action: 'batchMarkAsRead',
          notificationIds
        }
      })

      // 🔥 同上：批量已读后清缓存
      _resultCache.delete('getUserReadStatus')

      cachedUnreadCount = 0
      return true
    } catch (err) {
      console.error('批量标记已读失败:', err)
      return false
    }
  },

  getLocalReadIds() {
    try {
      return getStorage('local_read_notification_ids') || []
    } catch (e) {
      logger.warn('getLocalReadIds 读取失败', e)
      return []
    }
  },

  saveLocalReadIds(readIds) {
    try {
      setStorage('local_read_notification_ids', readIds)
    } catch (e) {
      console.error('保存已读状态失败:', e)
    }
  },

  getPopupNotifications() {
    return cachedNotifications?.filter(n => n.showPopup) || []
  },

  hasUnread() {
    return (cachedUnreadCount || 0) > 0
  },

  clearCache() {
    cachedNotifications = null
    cachedReadIds = null
    cachedUnreadCount = null
  }
}

export default notificationService