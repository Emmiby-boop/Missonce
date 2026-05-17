import { getStorage, getWindowInfo } from '../../utils/storageManager.js'

Component({
  properties: {
    defaultPosition: {
      type: Object,
      value: { x: 0, y: 0 }
    }
  },

  data: {
    unreadCount: 0,
    showButton: false,
    x: 0,
    y: 0,
    windowWidth: 375,
    windowHeight: 667,
    buttonSize: 60,
    isDragging: false,
    statusBarHeight: 20,
    bottomTabBarHeight: 100,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
    touchStartTime: 0,
    touchStartX: 0,
    touchStartY: 0
  },

  lifetimes: {
    attached() {
      this.isAttached = true
      this.getSystemInfo()
      this._loadTimer = setTimeout(() => {
        if (this.isAttached !== false) {
          this.loadUnreadCount()
        }
      }, 1200)
    },
    detached() {
      this.isAttached = false
      if (this._loadTimer) {
        clearTimeout(this._loadTimer)
        this._loadTimer = null
      }
      if (this.hideTimer) {
        clearTimeout(this.hideTimer)
        this.hideTimer = null
      }
    }
  },

  methods: {
    getSystemInfo() {
      const windowInfo = getWindowInfo()
      
      this.setData({
        windowWidth: windowInfo.windowWidth,
        windowHeight: windowInfo.windowHeight,
        statusBarHeight: windowInfo.statusBarHeight || 20,
        buttonSize: 60,
        x: windowInfo.windowWidth - 60 - 8,
        y: 300
      })
    },

    async loadUnreadCount() {
      try {
        // 清除之前的隐藏定时器
        if (this.hideTimer) {
          clearTimeout(this.hideTimer)
          this.hideTimer = null
        }

        const res = await wx.cloud.callFunction({
          name: 'getNotifications',
          data: {
            action: 'getActiveNotifications'
          }
        })

        if (res.result && res.result.success) {
          const notifications = res.result.data || []

          let localReadIds = []
          try {
            localReadIds = getStorage('local_read_notification_ids') || []
          } catch (e) {}

          const readRes = await wx.cloud.callFunction({
            name: 'getNotifications',
            data: {
              action: 'getUserReadStatus'
            }
          })

          let readIds = []
          if (readRes.result && readRes.result.success) {
            readIds = readRes.result.data.readNotificationIds || []
          }

          const mergedReadIds = [...new Set([...readIds, ...localReadIds])]
          const unreadCount = notifications.filter(n => !mergedReadIds.includes(n._id)).length
          
          // 只有当有未读通知时才显示按钮
          const showButton = unreadCount > 0
          
          this.setData({
            unreadCount,
            showButton
          })

          if (showButton) {
            this.showButtonWithAnimation()
          }
        } else {
          // 获取通知失败时，不显示按钮
          this.setData({
            unreadCount: 0,
            showButton: false
          })
        }
      } catch (err) {
        console.error('加载未读消息失败:', err)
        // 出错时，不显示按钮
        this.setData({
          unreadCount: 0,
          showButton: false
        })
      }
    },

    showButtonWithAnimation() {
      this.setData({ showButton: true })
    },

    onTouchStart(e) {
      this.setData({
        isDragging: false,
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        startLeft: this.data.x,
        startTop: this.data.y,
        touchStartTime: Date.now(),
        touchStartX: e.touches[0].clientX,
        touchStartY: e.touches[0].clientY
      })
    },

    onTouchMove(e) {
      const { touchStartX, touchStartY } = this.data
      const currentX = e.touches[0].clientX
      const currentY = e.touches[0].clientY
      
      const diffX = Math.abs(currentX - touchStartX)
      const diffY = Math.abs(currentY - touchStartY)
      
      if (diffX > 5 || diffY > 5) {
        this.setData({ isDragging: true })
      }
      
      if (!this.data.isDragging) return

      const { startX, startY, startLeft, startTop, windowWidth, windowHeight, buttonSize, statusBarHeight, bottomTabBarHeight } = this.data
      
      let newX = startLeft + (e.touches[0].clientX - startX)
      let newY = startTop + (e.touches[0].clientY - startY)
      
      const minX = 12
      const maxX = windowWidth - buttonSize - 12
      const minY = statusBarHeight + 44 + 12
      const maxY = windowHeight - buttonSize - bottomTabBarHeight - 12
      
      if (newX < minX) newX = minX
      if (newX > maxX) newX = maxX
      if (newY < minY) newY = minY
      if (newY > maxY) newY = maxY
      
      this.setData({
        x: newX,
        y: newY
      })
    },

    onTouchEnd() {
      if (this.data.isDragging) {
        const { x, y, windowWidth, buttonSize } = this.data
        
        let newX = x
        
        if (newX < windowWidth / 2 - buttonSize / 2) {
          newX = 12
        } else {
          newX = windowWidth - buttonSize - 12
        }
        
        this.setData({
          x: newX,
          isDragging: false
        })
      } else {
        // 如果不是拖拽，直接调用点击处理
        this.handleTap()
      }
    },

    handleTap() {
      wx.navigateTo({
        url: '/subpackages/notifications/notifications'
      })
    },

    refresh() {
      // 刷新未读计数
      this.loadUnreadCount()
    }
  }
})
