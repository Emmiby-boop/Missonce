import { getFavorites, removeFavorite } from '../../utils/api.js'
import { checkLoginStatus, navigateToLogin } from '../../utils/auth.js'
import { getStorage, setStorage } from '../../utils/storageManager.js'

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
      const favorites = getStorage('favorites') || []
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
        setStorage('favorites', cloudFavorites)
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
          setStorage('favorites', newFavorites)

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
    setStorage('favoriteCount', count)
  },

  onClearAll() {
    if (this.data.favorites.length === 0) return

    wx.showModal({
      title: '确认清空',
      content: `确定要清空全部 ${this.data.favorites.length} 条收藏吗？此操作不可恢复。`,
      confirmText: '确定清空',
      confirmColor: '#ff4d4f',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.clearAllFavorites()
        }
      }
    })
  },

  async clearAllFavorites() {
    wx.showLoading({ title: '清空中...', mask: true })

    try {
      const db = wx.cloud.database()
      const openid = getStorage('openid')

      // 1. 清空云端数据
      if (openid) {
        // 分批删除，避免一次删除太多
        const batchDelete = async () => {
          const res = await db.collection('favorites').where({
            _openid: openid
          }).limit(100).get()
          
          if (res.data.length > 0) {
            const deletePromises = res.data.map(item => 
              db.collection('favorites').doc(item._id).remove()
            )
            await Promise.all(deletePromises)
            // 继续删除下一批
            await batchDelete()
          }
        }
        await batchDelete()
      }

      // 2. 清空本地数据
      this.setData({ favorites: [] })
      setStorage('favorites', [])
      this.updateStats(0)

      wx.hideLoading()
      wx.showToast({
        title: '已清空全部收藏',
        icon: 'success'
      })
    } catch (err) {
      console.error('清空收藏失败:', err)
      wx.hideLoading()
      wx.showToast({
        title: '清空失败，请重试',
        icon: 'none'
      })
    }
  }
})
