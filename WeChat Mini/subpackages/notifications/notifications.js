import { setStorage } from '../../utils/storageManager.js'

Page({
  data: {
    notifications: [],
    readIds: [],
    loading: true,
    error: null,
    showModal: false,
    currentNotification: null
  },

  onLoad(options) {
    this.loadNotifications()
  },

  onShow() {
    this.loadNotifications()
  },

  async loadNotifications() {
    this.setData({ loading: true, error: null })

    try {
      const [notificationsRes, readRes] = await Promise.all([
        wx.cloud.callFunction({
          name: 'getNotifications',
          data: { action: 'getActiveNotifications' }
        }),
        wx.cloud.callFunction({
          name: 'getNotifications',
          data: { action: 'getUserReadStatus' }
        })
      ])

      if (notificationsRes.result && notificationsRes.result.success) {
        const notifications = notificationsRes.result.data || []
        
        let readIds = []
        if (readRes.result && readRes.result.success) {
          readIds = readRes.result.data.readNotificationIds || []
        }

        this.setData({ 
          notifications, 
          readIds,
          loading: false 
        })
      } else {
        throw new Error(notificationsRes.result?.message || '获取通知失败')
      }
    } catch (err) {
      console.error('加载通知失败:', err)
      this.setData({ 
        error: err.message || '加载失败，请重试',
        loading: false 
      })
    }
  },

  async markAsRead(notificationId) {
    if (this.data.readIds.includes(notificationId)) return

    const newReadIds = [...this.data.readIds, notificationId]
    this.setData({ readIds: newReadIds })

    try {
      await wx.cloud.callFunction({
        name: 'getNotifications',
        data: {
          action: 'markAsRead',
          data: { notificationId }
        }
      })

      this.saveReadIdsToStorage(newReadIds)
      this.refreshFloatingNotification()
    } catch (err) {
      console.error('标记已读失败:', err)
      this.saveReadIdsToStorage(newReadIds)
      this.refreshFloatingNotification()
    }
  },

  saveReadIdsToStorage(readIds) {
    try {
      setStorage('local_read_notification_ids', readIds)
    } catch (e) {}
  },

  async markAllAsRead() {
    const unreadIds = this.data.notifications
      .filter(n => !this.data.readIds.includes(n._id))
      .map(n => n._id)

    if (unreadIds.length === 0) {
      wx.showToast({ title: '暂无未读消息', icon: 'none' })
      return
    }

    try {
      await wx.cloud.callFunction({
        name: 'getNotifications',
        data: { 
          action: 'batchMarkAsRead',
          notificationIds: unreadIds
        }
      })

      const allIds = this.data.notifications.map(n => n._id)
      this.setData({ readIds: allIds })
      this.saveReadIdsToStorage(allIds) // 保存到本地存储
      wx.showToast({ title: '已全部标为已读', icon: 'success' })
    } catch (err) {
      console.error('批量标记已读失败:', err)
      const allIds = this.data.notifications.map(n => n._id)
      this.setData({ readIds: allIds })
      this.saveReadIdsToStorage(allIds) // 即使失败也保存到本地
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  handleNotificationTap(e) {
    const { item } = e.currentTarget.dataset
    if (!item) return

    this.setData({
      showModal: true,
      currentNotification: item
    })

    if (!this.data.readIds.includes(item._id)) {
      this.markAsRead(item._id)
    }
  },

  closeModal() {
    this.setData({
      showModal: false,
      currentNotification: null
    })
  },

  preventBubble() {},

  formatFullDate(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hour = date.getHours().toString().padStart(2, '0')
    const minute = date.getMinutes().toString().padStart(2, '0')
    return year + '-' + month + '-' + day + ' ' + hour + ':' + minute
  },

  formatDate(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now - date
    
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
    
    const month = date.getMonth() + 1
    const day = date.getDate()
    return month + '月' + day + '日'
  },

  getPriorityIcon(priority) {
    const map = {
      high: '🔴',
      normal: '📢',
      low: 'ℹ️'
    }
    return map[priority] || '📢'
  },

  getTypeText(type) {
    const map = {
      announcement: '公告',
      activity: '活动',
      system: '系统',
      update: '更新'
    }
    return map[type] || '公告'
  },

  retry() {
    this.loadNotifications()
  },

  refreshFloatingNotification() {
    // 通知首页的悬浮通知组件刷新未读计数
    const pages = getCurrentPages()
    const indexPage = pages.find(page => page.route === 'pages/index/index')
    if (indexPage) {
      const floatingComponent = indexPage.selectComponent('#floatingNotification')
      if (floatingComponent && floatingComponent.refresh) {
        floatingComponent.refresh()
      }
    }
  }
})
