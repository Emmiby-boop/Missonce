import { getStorage, setStorage } from '../utils/storageManager.js'

let cachedNotifications = null
let cachedReadIds = null
let cachedUnreadCount = null

export const notificationService = {
  async getActiveNotifications() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getNotifications',
        data: { action: 'getActiveNotifications' }
      })

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
      const res = await wx.cloud.callFunction({
        name: 'getNotifications',
        data: { action: 'getUserReadStatus' }
      })

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