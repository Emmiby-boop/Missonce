const { getStorage, setStorage } = require('../../../utils/storageManager')

async function loadNotificationBadge(page) {
  // 防止短时间内重复调用
  if (page._notificationBadgeLoading) return
  page._notificationBadgeLoading = true
  try {
    const { notificationService } = require('../../../services/notificationService.js')
    const unreadCount = await notificationService.getUnreadCount()
    page.setData({ unreadNotificationCount: unreadCount })
  } catch (e) {
    console.error('[index] 加载通知徽标失败:', e)
  } finally {
    page._notificationBadgeLoading = false
  }
}

async function checkAnnouncement(page) {
  try {
    const { notificationService } = require('../../../services/notificationService.js')
    // 🔥 并行获取（原先串行 await，慢一拍；service 内部有在途去重，与 loadNotificationBadge 并发也只发 2 个请求）
    const [notifications, readIds] = await Promise.all([
      notificationService.getActiveNotifications(),
      notificationService.getUserReadStatus()
    ])
    const popupAnnouncements = notifications.filter(n =>
      n.showPopup && !readIds.includes(n._id)
    )

    if (popupAnnouncements.length > 0) {
      const announcement = popupAnnouncements[0]

      const dismissedAnnouncements = getStorage('dismissed_announcements') || {}
      if (dismissedAnnouncements[announcement._id]) {
        return
      }

      const priorityIconMap = { high: '🔴', normal: '📢', low: 'ℹ️' }
      announcement.icon = priorityIconMap[announcement.priority] || '📢'

      page.setData({
        showAnnouncement: true,
        currentAnnouncement: announcement,
        dontShowAgain: false
      })

      // 若有封面图（cloud:// fileID），异步获取临时URL用于弹窗预览
      if (announcement.coverImage && String(announcement.coverImage).startsWith('cloud://')) {
        wx.cloud.getTempFileURL({
          fileList: [announcement.coverImage]
        }).then(res => {
          if (res && res.fileList && res.fileList[0] && res.fileList[0].status === 0 && res.fileList[0].tempFileURL) {
            page.setData({ 'currentAnnouncement.coverUrl': res.fileList[0].tempFileURL })
          }
        }).catch(() => {})
      }
    }
  } catch (e) {
    console.error('[index] 检查公告失败:', e)
  }
}

function closeAnnouncement(page) {
  const { currentAnnouncement, dontShowAgain } = page.data

  if (dontShowAgain && currentAnnouncement) {
    const dismissedAnnouncements = getStorage('dismissed_announcements') || {}
    dismissedAnnouncements[currentAnnouncement._id] = true
    setStorage('dismissed_announcements', dismissedAnnouncements)
  }

  if (currentAnnouncement) {
    try {
      const { notificationService } = require('../../../services/notificationService.js')
      notificationService.markAsRead(currentAnnouncement._id).catch(() => {})
    } catch (e) {
      console.warn('[index] 加载通知服务失败，降级处理:', e)
    }
  }

  page.setData({
    showAnnouncement: false,
    currentAnnouncement: null
  })

  page.loadNotificationBadge()
}

function handleAnnouncementConfirm(page) {
  const { currentAnnouncement } = page.data
  if (!currentAnnouncement) return

  // 有富文本内容或封面图时跳转详情页（文章式展示）
  if (currentAnnouncement.contentHtml || currentAnnouncement.coverImage) {
    const id = currentAnnouncement._id
    page.closeAnnouncement()
    wx.navigateTo({
      url: `/subpackages/announcement-detail/announcement-detail?id=${id}`
    })
    return
  }

  page.closeAnnouncement()

  if (currentAnnouncement.linkType === 'page' && currentAnnouncement.linkValue) {
    wx.navigateTo({ url: currentAnnouncement.linkValue })
  } else if (currentAnnouncement.linkType === 'webview' && currentAnnouncement.linkValue) {
    wx.navigateTo({ url: '/subpackages/webview/webview?url=' + encodeURIComponent(currentAnnouncement.linkValue) })
  }
}

function toggleDontShowAgain(page) {
  page.setData({
    dontShowAgain: !page.data.dontShowAgain
  })
}

module.exports = {
  loadNotificationBadge,
  checkAnnouncement,
  closeAnnouncement,
  handleAnnouncementConfirm,
  toggleDontShowAgain
}
