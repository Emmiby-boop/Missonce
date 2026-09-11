import { setStorage, getWindowInfo } from '../../utils/storageManager.js'
import notificationService from '../../services/notificationService.js'

Page({
  data: {
    notifications: [],
    readIds: [],
    loading: true,
    error: null,
    showModal: false,
    currentNotification: null,
    statusBarHeight: 20,
    navBarHeight: 44
  },

  onLoad(options) {
    // 初始化导航栏高度
    try {
      const info = getWindowInfo()
      const statusBarHeight = info.statusBarHeight || 20
      let navBarHeight = 44
      try {
        const menuButton = wx.getMenuButtonBoundingClientRect()
        if (menuButton && menuButton.width > 0) {
          navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
        }
      } catch (e) {
        console.error('[notifications] 获取胶囊按钮位置失败:', e)
      }
      this.setData({ statusBarHeight, navBarHeight })
    } catch (e) {
      console.error('[notifications] 初始化导航栏失败:', e)
    }

    this.loadNotifications()
  },

  onBack() {
    wx.navigateBack({ delta: 1, fail: () => wx.switchTab({ url: '/pages/index/index' }) })
  },

  onShow() {
    // 避免与 onLoad 重复加载，只在数据为空时刷新
    if (this.data.notifications.length === 0) {
      this.loadNotifications()
    }
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

        // 后台异步获取封面图临时URL（cloud:// fileID 转可显示 URL）
        this._fetchCoverUrls(notifications)
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

  // 批量获取封面图临时URL，更新到对应 item 的 coverUrl 字段
  async _fetchCoverUrls(notifications) {
    const fileIds = notifications
      .map(n => n.coverImage)
      .filter(url => url && typeof url === 'string' && url.startsWith('cloud://'))

    if (fileIds.length === 0) return

    // 去重
    const uniqueFileIds = [...new Set(fileIds)]

    try {
      const res = await wx.cloud.getTempFileURL({
        fileList: uniqueFileIds
      })
      if (!res || !res.fileList) return

      // 构建 fileID -> tempURL 映射
      const urlMap = {}
      res.fileList.forEach(item => {
        if (item.status === 0 && item.tempFileURL) {
          urlMap[item.fileID] = item.tempFileURL
        }
      })

      // 更新列表中每个 item 的 coverUrl
      const updated = this.data.notifications.map(n => {
        if (n.coverImage && urlMap[n.coverImage]) {
          return { ...n, coverUrl: urlMap[n.coverImage] }
        }
        return n
      })

      this.setData({ notifications: updated })
    } catch (err) {
      console.warn('获取封面临时URL失败:', err)
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
      // 🔥 同步 notificationService 缓存并通知首页刷新角标
      notificationService.clearCache()
      this._refreshHomeBadge()
    } catch (err) {
      console.error('标记已读失败:', err)
      this.saveReadIdsToStorage(newReadIds)
    }
  },

  saveReadIdsToStorage(readIds) {
    try {
      setStorage('local_read_notification_ids', readIds)
    } catch (e) {
      console.error('[notifications] 保存已读ID失败:', e)
    }
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
      // 🔥 同步 notificationService 缓存并通知首页刷新角标
      notificationService.clearCache()
      this._refreshHomeBadge()
      wx.showToast({ title: '已全部标为已读', icon: 'success' })
    } catch (err) {
      console.error('批量标记已读失败:', err)
      const allIds = this.data.notifications.map(n => n._id)
      this.setData({ readIds: allIds })
      this.saveReadIdsToStorage(allIds) // 即使失败也保存到本地
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  // 🔥 通知首页强制刷新通知角标（绕过 onShow 的 5 分钟节流）
  _refreshHomeBadge() {
    try {
      const pages = getCurrentPages()
      // 栈中找到首页实例
      const homePage = pages.find(p => p.route === 'pages/index/index')
      if (homePage && typeof homePage.loadNotificationBadge === 'function') {
        // 重置首页节流时间戳，让 onShow 重新加载
        homePage._lastNotificationCheck = 0
        homePage.loadNotificationBadge()
      }
    } catch (e) {
      console.warn('[notifications] 通知首页刷新角标失败:', e)
    }
  },

  handleNotificationTap(e) {
    const { item } = e.currentTarget.dataset
    if (!item) return

    // 标记已读
    if (!this.data.readIds.includes(item._id)) {
      this.markAsRead(item._id)
    }

    // 配置了小程序页面跳转：直接跳转，不进详情页
    if (item.linkType === 'page' && item.linkValue) {
      wx.navigateTo({ url: item.linkValue })
      return
    }

    // 有富文本或封面图时跳转详情页
    if (item.contentHtml || item.coverImage) {
      wx.navigateTo({
        url: `/subpackages/announcement-detail/announcement-detail?id=${item._id}`
      })
      return
    }

    // 简单文本公告：弹窗展示
    this.setData({
      showModal: true,
      currentNotification: item
    })
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
  }
})
