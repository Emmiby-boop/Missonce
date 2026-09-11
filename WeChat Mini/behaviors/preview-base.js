/**
 * preview-base Behavior
 * Shared methods between avatar preview and wallpaper preview pages.
 * Extracted from preview.js / wallpaper-preview.js to eliminate duplication.
 */

const { getStorage, setStorage } = require('../utils/storageManager.js')
const { checkLoginStatus } = require('../utils/auth.js')

module.exports = Behavior({
  lifetimes: {
    attached() {
      // 兼容历史：保留空对象，避免外部引用 this._statsCache 时报错
      this._statsCache = {}
      this._statsDirtyKeys = new Set()
      // 🔥 预热海报云函数：进入预览页就触发，避免点击分享时等待冷启动
      //    getPosterQuotes 和 getQRCode 是海报生成的主要冷启动瓶颈
      wx.cloud.callFunction({ name: 'getPosterQuotes' }).catch(() => {})
    },
    detached() {
      // 不再需要刷入 Storage（伪数据逻辑已移除）
    }
  },

  methods: {
    onReachBottom() {
      if (!this.data.showBottomNativeAd && this.data.bottomNativeVideoAd && this.data.bottomNativeVideoAd.adUnitId) {
        this.setData({ showBottomNativeAd: true })
      }
    },

    /**
     * 🔥 P0-1 真实数据方案：从 resource 对象直接读取真实统计字段
     * - viewCount     ← resource.views（浏览量，由 recordBrowseHistory 递增）
     * - downloadCount ← resource.downloads（下载量，由 recordDownload 递增）
     * - hotScore      ← resource.hotScore（热度值，浏览/下载/收藏/点赞都会递增）
     *
     * 互动数据区不再展示收藏数（数据量过小），改为展示下载量
     * 底部 💗 按钮仍保留收藏功能（沿用 favorites 云函数事务），文案"喜欢"，toast"已点赞"
     * 用户的收藏数据在个人页面"我的喜欢"列表展示
     * 老资源可能没有 views/downloads 字段，用 0 兜底
     */
    _formatResourceStats(resource) {
      const r = resource || {}
      const viewCount = Math.max(0, parseInt(r.views, 10) || 0)
      const downloadCount = Math.max(0, parseInt(r.downloads, 10) || 0)
      const hotScore = Math.max(0, parseInt(r.hotScore, 10) || 0)
      return {
        viewCount,
        viewCountText: this._formatCount(viewCount),
        downloadCount,
        downloadCountText: this._formatCount(downloadCount),
        hotScore,
        hotScoreText: this._formatCount(hotScore)
      }
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
        wx.showToast({ title: '保存失败', icon: 'none' })
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
      // 🔒 安全修复：先调用 getProxySign 获取签名，再调用 proxyDownload
      wx.cloud.callFunction({
        name: 'getProxySign',
        data: { url }
      }).then(signRes => {
        const signResult = signRes && signRes.result
        if (!signResult || !signResult.success) {
          wx.hideLoading()
          that.setData({ isDownloading: false })
          that._dlLock = false
          console.error('getProxySign failed:', signResult)
          wx.showToast({ title: '签名获取失败', icon: 'none' })
          return
        }
        return wx.cloud.callFunction({
          name: 'proxyDownload',
          data: { url, sign: signResult.sign, expireTs: signResult.expireTs }
        })
      }).then(cfRes => {
        if (!cfRes) return
        const result = cfRes.result
        if (result && result.success && result.fileID) {
          wx.cloud.downloadFile({
            fileID: result.fileID,
            success(res2) {
              that.saveToAlbum(res2.tempFilePath, url, downloadMethod)
            },
            fail(e2) {
              wx.hideLoading()
              that.setData({ isDownloading: false })
              that._dlLock = false
              wx.showToast({ title: '代理下载失败', icon: 'none' })
            }
          })
        } else {
          wx.hideLoading()
          that.setData({ isDownloading: false })
          that._dlLock = false
          console.error('proxyDownload result error:', result)
          wx.showToast({
            title: (result && result.message) || '下载失败',
            icon: 'none',
            duration: 3000
          })
        }
      }).catch((err) => {
        wx.hideLoading()
        that.setData({ isDownloading: false })
        that._dlLock = false
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
