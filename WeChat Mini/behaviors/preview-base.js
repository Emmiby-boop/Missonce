/**
 * preview-base Behavior
 * Shared methods between avatar preview and wallpaper preview pages.
 * Extracted from preview.js / wallpaper-preview.js to eliminate duplication.
 */
const { generateInteractionStats } = require('../utils/statsGenerator.js')
const { getStorage, setStorage } = require('../utils/storageManager.js')
const { checkLoginStatus } = require('../utils/auth.js')

module.exports = Behavior({
  methods: {
    onReachBottom() {
      if (!this.data.showBottomNativeAd && this.data.bottomNativeVideoAd && this.data.bottomNativeVideoAd.adUnitId) {
        this.setData({ showBottomNativeAd: true })
      }
    },

    _computeInteractionData(resource, url) {
      const effectiveUrl = url || resource?.url || resource?.coverUrl || resource?.originUrl || ''
      const hashInput = effectiveUrl || (resource?.id || resource?._id) || JSON.stringify(resource || {})
      const seed = this._hashString(hashInput)
      const today = new Date().toISOString().split('T')[0]
      const storageKey = `stats_base_${seed}`
      let storedData = null
      
      try {
        const cached = getStorage(storageKey)
        if (cached) storedData = JSON.parse(cached)
      } catch (e) {}

      if (storedData && storedData.date !== today) {
        storedData = {
          date: today,
          baseViews: storedData.currentViews || 0,
          baseLikes: storedData.currentLikes || 0
        }
        try {
          setStorage(storageKey, JSON.stringify(storedData))
        } catch (e) {}
      }

      const hotScore = resource?.hotScore
      const hasRealHot = hotScore != null && hotScore > 0

      if (hasRealHot) {
        const hotFactor = 0.95 + (seed % 10) * 0.01
        const finalHotScore = Math.floor(hotScore * hotFactor)
        const viewMultiplier = 1 + (seed % 20) / 10
        let viewCount = Math.floor(finalHotScore * viewMultiplier)
        viewCount = Math.min(viewCount, 2000)
        const likeRate = 0.03 + (seed % 8) / 100
        let likeCount = Math.floor(viewCount * likeRate)

        if (storedData && storedData.date === today) {
          viewCount = Math.max(viewCount, storedData.baseViews)
          likeCount = Math.max(likeCount, storedData.baseLikes)
          const dailyGrowth = 1 + (seed % 3 + 1) / 100
          viewCount = Math.max(viewCount, Math.floor(storedData.baseViews * dailyGrowth))
          likeCount = Math.max(likeCount, Math.floor(storedData.baseLikes * dailyGrowth))
        }

        try {
          setStorage(storageKey, JSON.stringify({
            date: today,
            baseViews: viewCount,
            baseLikes: likeCount,
            currentViews: viewCount,
            currentLikes: likeCount
          }))
        } catch (e) {}

        return { viewCount, likeCount, hotScore: finalHotScore }
      }

      return generateInteractionStats(effectiveUrl)
    },

    _hashString(str) {
      let hash = 0
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
      }
      return Math.abs(hash)
    },

    _formatCount(n) {
      if (n >= 10000) {
        return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万'
      }
      return n >= 1000 ? n.toLocaleString() : n
    },

    getTagList() {
      const similarList = this.data.similarList || []
      const allTags = new Set()
      const colors = ['primary', 'secondary', 'blue', 'orange', 'purple', 'teal']
      
      similarList.forEach(item => {
        if (item.tags && item.tags.length > 0) {
          item.tags.forEach(tag => allTags.add(tag))
        }
      })
      
      return Array.from(allTags).slice(0, 4).map((tag, index) => ({
        label: tag,
        type: colors[index % colors.length]
      }))
    },

    checkLogin() {
      return checkLoginStatus()
    },

    showLoginModal() {
      this.setData({ showLoginModal: true })
    },

    onNativeAdError() {
      if (this.data.showBottomNativeAd) {
        this.setData({ showBottomNativeAd: false })
      }
    },

    handleThemeChange(res) {
      this.setData({ theme: res.theme === 'dark' ? 'dark' : 'light' })
    },

    goBack() {
      wx.navigateBack()
    },

    saveFavorites(favorites) {
      try {
        setStorage('favorites', favorites)
      } catch (e) {
        console.error('保存收藏失败:', e)
        wx.showToast({ title: '收藏失败', icon: 'none' })
      }
    },

    showPoster() {
      this.setData({ showPosterModal: true })
    },

    hidePoster() {
      this.setData({ showPosterModal: false })
    },

    onMoreTap() {
      wx.showActionSheet({
        itemList: ['复制页面链接', '分享给好友'],
        success: (res) => {
          if (res.tapIndex === 0) {
            this.copyPagePath()
          } else if (res.tapIndex === 1) {
            this.showPoster()
          }
        }
      })
    },

    getSafeUrl(raw) {
      if (!raw) return ''
      let url = decodeURIComponent(raw)
      if (url.startsWith('//')) url = 'https:' + url
      if (url.startsWith('http:')) url = url.replace(/^http:/i, 'https:')
      if (!/^https?:\/\//i.test(url)) return ''
      return url
    },

    ensureAlbumPermission() {
      return new Promise((resolve) => {
        wx.getSetting({
          success: (res) => {
            const has = res.authSetting && res.authSetting['scope.writePhotosAlbum']
            if (has) { resolve(true); return }
            wx.authorize({
              scope: 'scope.writePhotosAlbum',
              success: () => resolve(true),
              fail: () => {
                wx.showModal({
                  title: '提示',
                  content: '需要您授权保存图片到相册',
                  confirmText: '去授权',
                  cancelText: '取消',
                  success: (r) => {
                    if (r.confirm) {
                      wx.openSetting({
                        success: (settingRes) => {
                          const granted = !!(settingRes.authSetting && settingRes.authSetting['scope.writePhotosAlbum'])
                          resolve(granted)
                        },
                        fail: () => resolve(false)
                      })
                    } else {
                      resolve(false)
                    }
                  }
                })
              }
            })
          },
          fail: () => resolve(false)
        })
      })
    },

    tryProxyDownload(url, downloadMethod = 'points') {
      const that = this
      wx.cloud.callFunction({
        name: 'proxyDownload',
        data: { url }
      }).then(cfRes => {
        const result = cfRes && cfRes.result
        if (result && result.success && result.fileID) {
          wx.cloud.downloadFile({
            fileID: result.fileID,
            success(res2) {
              that.saveToAlbum(res2.tempFilePath, url, downloadMethod)
            },
            fail(e2) {
              wx.hideLoading()
              wx.showToast({ title: '代理下载失败', icon: 'none' })
            }
          })
        } else {
          wx.hideLoading()
          console.error('proxyDownload result error:', result)
          wx.showToast({ 
            title: (result && result.message) || '下载失败', 
            icon: 'none',
            duration: 3000
          })
        }
      }).catch((err) => {
        wx.hideLoading()
        console.error('proxyDownload call fail:', err)
        wx.showToast({ 
          title: '云函数调用失败: ' + (err.errMsg || err.message || '未知错误'), 
          icon: 'none',
          duration: 3000
        })
      })
    }
  }
})
