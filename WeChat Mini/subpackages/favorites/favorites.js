import { getFavorites, removeFavorite } from '../../utils/api.js'
import { checkLoginStatus, navigateToLogin } from '../../utils/auth.js'

Page({
  data: {
    favorites: []
  },

  onLoad() {
    this.loadFavorites()
  },

  onShow() {
    this.loadFavorites()
  },

  loadFavorites() {
    if (!this.checkLogin()) {
      this.setData({ favorites: [] })
      this.showLoginModal()
      return
    }

    // Local Cache First
    try {
      const favorites = wx.getStorageSync('favorites') || []
      this.setData({ favorites })
    } catch (e) {
      console.error('加载本地收藏失败:', e)
    }

    // Cloud Sync
    getFavorites('all', 1, 100).then(res => { // Fetch more to be safe, or implement pagination
      if (res.data) {
        const cloudFavorites = res.data.map(item => ({
          url: item.url,
          type: item.type,
          timestamp: item.createTime ? new Date(item.createTime).getTime() : Date.now()
        }))
        this.setData({ favorites: cloudFavorites })
        wx.setStorageSync('favorites', cloudFavorites)
      }
    }).catch(err => {
      console.error('加载云端收藏失败:', err)
    })
  },

  checkLogin() {
    return checkLoginStatus()
  },

  showLoginModal() {
    wx.showModal({
      title: '请先登录',
      content: '查看收藏夹需要登录',
      confirmText: '去登录',
      cancelText: '返回',
      success: (res) => {
        if (res.confirm) {
          navigateToLogin()
        } else {
          wx.navigateBack()
        }
      }
    })
  },

  onFavoriteTap(e) {
    const url = e.currentTarget.dataset.url
    const favorites = this.data.favorites
    const index = favorites.findIndex(item => item.url === url)

    // 查找是否是头像还是壁纸
    const isAvatar = favorites[index].type === 'avatar'

    // 根据类型跳转到不同的预览页
    if (isAvatar) {
        wx.navigateTo({
            url: `/subpackages/preview/preview?url=${encodeURIComponent(url)}&isAvatar=true&currentIndex=${index}&imageList=${encodeURIComponent(JSON.stringify(favorites.map(item => item.url)))}`
        })
    } else {
        wx.navigateTo({
            url: `/subpackages/wallpaper-preview/wallpaper-preview?url=${encodeURIComponent(url)}&currentIndex=${index}&imageList=${encodeURIComponent(JSON.stringify(favorites.map(item => item.url)))}`
        })
    }
  },

  onDeleteFavorite(e) {
    const { url, index } = e.currentTarget.dataset
    const type = this.data.favorites[index].type

    wx.showModal({
      title: '提示',
      content: '确定取消收藏吗？',
      success: (res) => {
        if (res.confirm) {
          const newFavorites = [...this.data.favorites]
          newFavorites.splice(index, 1)

          this.setData({
            favorites: newFavorites
          })

          // 保存到本地存储
          wx.setStorageSync('favorites', newFavorites)

          // Cloud Remove
          removeFavorite(url, type).then(res => {
            console.log('云端删除收藏成功')
          }).catch(err => {
            console.error('云端删除收藏失败:', err)
          })

          wx.showToast({
            title: '已取消收藏',
            icon: 'none'
          })

          // 更新统计数量
          this.updateStats(newFavorites.length)
        }
      }
    })
  },

  updateStats(count) {
    // 更新profile页面的收藏数量（通过本地存储传递）
    wx.setStorageSync('favoriteCount', count)
  }
})
