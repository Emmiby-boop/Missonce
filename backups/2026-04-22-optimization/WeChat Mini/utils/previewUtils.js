import { checkLoginStatus, loginWithProfile } from './auth'
import { getFavorites, addFavorite, removeFavorite } from './api'

const previewUtils = {
  loadFavorites(pageInstance) {
    try {
      const favorites = wx.getStorageSync('favorites') || []
      pageInstance.setData({ favorites })
    } catch (e) {
      console.error('加载本地收藏失败:', e)
    }

    getFavorites('all', 1, 100).then(res => {
      if (res.data) {
        const cloudFavorites = res.data.map(item => ({
          url: item.url,
          type: item.type,
          timestamp: item.createTime ? new Date(item.createTime).getTime() : Date.now()
        }))

        pageInstance.setData({ favorites: cloudFavorites })
        wx.setStorageSync('favorites', cloudFavorites)
        previewUtils.checkFavorite(pageInstance)
      }
    }).catch(err => {
      console.error('加载云端收藏失败:', err)
    })
  },

  checkFavorite(pageInstance) {
    const { currentUrl, favorites } = pageInstance.data
    const type = previewUtils.getResourceType(pageInstance)
    const isFavorite = favorites.some(item => item.url === currentUrl && item.type === type)
    pageInstance.setData({ isFavorite })
  },

  async toggleFavorite(pageInstance, getCurrentResource, getResourceType, ensureResourceId) {
    if (!previewUtils.checkLogin()) {
      previewUtils.showLoginModal(pageInstance)
      return
    }

    const id = await ensureResourceId()
    const { currentUrl, favorites, isFavorite } = pageInstance.data
    const currentResource = getCurrentResource()
    const resourceId = currentResource?.id || currentResource?._id || id || null
    const type = getResourceType()

    if (isFavorite) {
      const newFavorites = favorites.filter(item => item.url !== currentUrl)
      pageInstance.setData({ favorites: newFavorites, isFavorite: false })
      previewUtils.saveFavorites(pageInstance, newFavorites)

      const removePromise = resourceId
        ? removeFavorite(resourceId)
        : removeFavorite(currentUrl, type)

      removePromise.then(res => {
        console.log('云端移除收藏成功')
      }).catch(err => {
        console.error('云端移除收藏失败:', err)
      })

      wx.showToast({ title: '已取消收藏', icon: 'none' })
    } else {
      const newFavorite = { url: currentUrl, type, timestamp: Date.now() }
      const newFavorites = [newFavorite, ...favorites]
      pageInstance.setData({ favorites: newFavorites, isFavorite: true })
      previewUtils.saveFavorites(pageInstance, newFavorites)

      try {
        await addFavorite(resourceId, type, currentUrl, currentResource?.title || '')
        console.log('云端添加收藏成功')
      } catch (err) {
        console.error('云端添加收藏失败:', err)
      }

      wx.showToast({ title: '已收藏', icon: 'none' })
    }
  },

  saveFavorites(pageInstance, favorites) {
    try {
      wx.setStorageSync('favorites', favorites)
    } catch (e) {
      console.error('保存收藏失败:', e)
      wx.showToast({ title: '收藏失败', icon: 'none' })
    }
  },

  async loadRealStats(pageInstance, resourceId) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'interactionManager',
        data: {
          action: 'getStats',
          resourceId: resourceId
        }
      })

      if (res.result && res.result.success && res.result.data) {
        const stats = res.result.data
        pageInstance.setData({
          hotScore: stats.hotScore || 0,
          likeCount: stats.likeCount || 0,
          isLiked: stats.isLiked || false
        })
      }
    } catch (e) {
      console.warn('加载统计数据失败:', e)
    }
  },

  checkLogin() {
    return checkLoginStatus()
  },

  showLoginModal(pageInstance) {
    pageInstance.setData({ showLoginModal: true })
  },

  hideLoginModal(pageInstance) {
    pageInstance.setData({
      showLoginModal: false,
      modalError: ''
    })
  },

  async handleLogin(pageInstance) {
    pageInstance.setData({
      isLoginLoading: true,
      modalError: ''
    })

    try {
      const userInfo = await wx.getUserProfile({ desc: '用于登录' })

      await wx.login()

      await loginWithProfile({
        nickName: userInfo.userInfo.nickName,
        avatarUrl: userInfo.userInfo.avatarUrl
      })

      pageInstance.setData({
        showLoginModal: false,
        isLoginLoading: false,
        modalError: ''
      })
      wx.showToast({ title: '登录成功', icon: 'success' })

      previewUtils.loadFavorites(pageInstance)
      previewUtils.checkFavorite(pageInstance)
    } catch (err) {
      console.error('登录流程异常:', err)
      pageInstance.setData({
        isLoginLoading: false,
        modalError: err.message || '登录异常'
      })
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    }
  },

  initNavBar(pageInstance) {
    const systemInfo = wx.getWindowInfo()
    const statusBarHeight = systemInfo.statusBarHeight
    const platform = wx.getDeviceInfo().platform

    let navBarHeight = 44
    if (platform === 'android') {
      navBarHeight = 48
    }

    pageInstance.setData({
      statusBarHeight,
      navBarHeight
    })
  },

  handleThemeChange(pageInstance, res) {
    pageInstance.setData({ theme: res.theme === 'dark' ? 'dark' : 'light' })
  },

  getResourceType(pageInstance) {
    return pageInstance.data.isAvatar ? 'avatar' : 'wallpaper'
  },

  formatTime(timestamp) {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`
    return `${date.getMonth() + 1}-${date.getDate()}`
  }
}

export default previewUtils