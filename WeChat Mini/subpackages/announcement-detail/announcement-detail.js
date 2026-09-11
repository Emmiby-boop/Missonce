const { getStorage, setStorage } = require('../../utils/storageManager.js')

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    loading: true,
    notification: null,
    coverUrl: '',       // 封面图临时 URL
    qrUrl: '',          // 二维码临时 URL（详情页底部展示，长按识别）
    contentHtml: '',    // 富文本 HTML（已处理图片 URL）
    displayContent: ''  // 纯文本内容（无富文本时使用）
  },

  onLoad(options) {
    // 🔥 低端机降级：毛玻璃 blur → 纯色（wxml 在 custom-nav 上挂 low-end class）
    this.setData({ lowEnd: !!(getApp().globalData && getApp().globalData.lowEnd) })

    try {
      const sysInfo = wx.getWindowInfo()
      const menuBtn = wx.getMenuButtonBoundingClientRect()
      const statusBarHeight = sysInfo.statusBarHeight
      const navBarHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height
      this.setData({ statusBarHeight, navBarHeight })
    } catch (e) {
      console.error('[announcement-detail] 初始化导航栏失败:', e)
    }

    if (options.id) {
      this.loadNotification(options.id)
    } else {
      this.setData({ loading: false })
    }
  },

  // 通过 getNotifications 云函数读取单条公告详情
  async loadNotification(id) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getNotifications',
        data: { action: 'getActiveNotifications' }
      })

      if (res.result && res.result.success) {
        const list = res.result.data || []
        // 兼容直接返回数组或 { list: [...] }
        const notifications = Array.isArray(list) ? list : (list.list || [])
        const notification = notifications.find(n => n._id === id)

        if (notification) {
          // 格式化创建时间用于展示
          if (notification.createdAt) {
            try {
              const d = new Date(notification.createdAt)
              const Y = d.getFullYear()
              const M = (d.getMonth() + 1).toString().padStart(2, '0')
              const D = d.getDate().toString().padStart(2, '0')
              const h = d.getHours().toString().padStart(2, '0')
              const m = d.getMinutes().toString().padStart(2, '0')
              notification.createTimeText = `${Y}-${M}-${D} ${h}:${m}`
            } catch (e) {
              console.error('[announcement-detail] 格式化时间失败:', e)
            }
          }

          this.setData({ notification, loading: false })
          this.processContent(notification)
          this.markAsRead(id)

          // 设置导航栏标题
          wx.setNavigationBarTitle({ title: notification.title || '公告详情' })
        } else {
          this.setData({ loading: false })
          wx.showToast({ title: '公告不存在', icon: 'none' })
        }
      } else {
        this.setData({ loading: false })
      }
    } catch (err) {
      console.error('[公告详情] 加载失败:', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 处理内容：封面图 URL 转换 + 富文本图片 URL 替换 + 图片样式注入
  async processContent(notification) {
    const fileIDs = []

    // 收集封面图 fileID
    if (notification.coverImage && notification.coverImage.startsWith('cloud://')) {
      fileIDs.push(notification.coverImage)
    }

    // 收集二维码 fileID
    if (notification.qrImage && notification.qrImage.startsWith('cloud://')) {
      fileIDs.push(notification.qrImage)
    }

    // 收集富文本中的 cloud:// 图片
    let html = notification.contentHtml || ''
    const cloudRegex = /cloud:\/\/[^"')\s]+/g
    const matches = html.match(cloudRegex) || []
    matches.forEach(url => {
      if (!fileIDs.includes(url)) fileIDs.push(url)
    })

    if (fileIDs.length === 0) {
      // 无需转换，直接设置
      this.setData({
        coverUrl: notification.coverImage || '',
        qrUrl: notification.qrImage || '',
        contentHtml: this._optimizeHtmlImages(html),
        displayContent: notification.content || ''
      })
      return
    }

    // 批量获取临时 URL
    try {
      const urlRes = await wx.cloud.getTempFileURL({ fileList: fileIDs })
      const urlMap = {}
      if (urlRes.fileList) {
        urlRes.fileList.forEach(item => {
          if (item.tempFileURL) {
            urlMap[item.fileID] = item.tempFileURL
          }
        })
      }

      // 替换封面 URL
      let coverUrl = notification.coverImage || ''
      if (coverUrl.startsWith('cloud://') && urlMap[coverUrl]) {
        coverUrl = urlMap[coverUrl]
      }

      // 替换二维码 URL
      let qrUrl = notification.qrImage || ''
      if (qrUrl.startsWith('cloud://') && urlMap[qrUrl]) {
        qrUrl = urlMap[qrUrl]
      }

      // 替换富文本中的 cloud:// URL
      Object.keys(urlMap).forEach(fileID => {
        // 转义正则特殊字符
        const escaped = fileID.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        html = html.replace(new RegExp(escaped, 'g'), urlMap[fileID])
      })

      this.setData({
        coverUrl,
        qrUrl,
        contentHtml: this._optimizeHtmlImages(html),
        displayContent: notification.content || ''
      })
    } catch (err) {
      console.warn('[公告详情] 图片 URL 转换失败:', err)
      this.setData({
        coverUrl: '',
        qrUrl: '',
        contentHtml: this._optimizeHtmlImages(html),
        displayContent: notification.content || ''
      })
    }
  },

  // 优化富文本中的 img 标签：注入 max-width/圆角/间距等内联样式
  // rich-text 组件无法用外层 wxss 控制内部图片样式，只能靠内联 style
  _optimizeHtmlImages(html) {
    if (!html) return ''
    // 给所有 <img 注入样式（已有 style 的合并，没有的添加）
    return html.replace(/<img\b([^>]*)>/gi, (match, attrs) => {
      // 提取已有 style
      const styleMatch = attrs.match(/\bstyle\s*=\s*["']([^"']*)["']/i)
      let style = styleMatch ? styleMatch[1] : ''

      // 注入必要样式（如果已有相同属性则不重复添加）
      const inject = [
        'max-width: 100%',
        'height: auto',
        'border-radius: 12rpx',
        'display: block',
        'margin: 16rpx auto'
      ]
      inject.forEach(rule => {
        const prop = rule.split(':')[0].trim()
        if (!new RegExp('(^|;)\\s*' + prop + '\\s*:', 'i').test(style)) {
          style = (style ? style + '; ' : '') + rule
        }
      })

      // 重建 img 标签
      let newAttrs = attrs
      if (styleMatch) {
        newAttrs = newAttrs.replace(/\bstyle\s*=\s*["'][^"']*["']/i, `style="${style}"`)
      } else {
        newAttrs = newAttrs + ` style="${style}"`
      }
      return `<img${newAttrs}>`
    })
  },

  // 标记已读
  async markAsRead(id) {
    try {
      // 更新本地已读记录
      const readIds = getStorage('local_read_notification_ids') || []
      if (!readIds.includes(id)) {
        readIds.push(id)
        setStorage('local_read_notification_ids', readIds)
      }

      // 同步到云端
      await wx.cloud.callFunction({
        name: 'getNotifications',
        data: {
          action: 'markAsRead',
          data: { notificationId: id }
        }
      })
    } catch (e) {
      console.warn('[公告详情] 标记已读失败:', e)
    }
  },

  onBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
    } else {
      wx.switchTab({ url: '/pages/index/index' })
    }
  },

  // 处理跳转链接
  handleAction() {
    const n = this.data.notification
    if (!n) return

    if (n.linkType === 'page' && n.linkValue) {
      wx.navigateTo({ url: n.linkValue })
    } else if (n.linkType === 'webview' && n.linkValue) {
      const url = encodeURIComponent(n.linkValue)
      wx.navigateTo({ url: `/subpackages/webview/webview?url=${url}` })
    }
  }
})
