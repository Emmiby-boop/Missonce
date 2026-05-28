/**
 * preview-common Behavior
 * Shared methods between avatar preview and wallpaper preview pages.
 * Extends preview-base with additional common lifecycle/data methods.
 *
 * Page using this must define:
 *   data.type: 'avatar' | 'wallpaper'
 *   data.previewPath: '/subpackages/preview/preview' | '/subpackages/wallpaper-preview/wallpaper-preview'
 *   data.currentResource: {} (aliased as currentAvatar or currentWallpaper by the page)
 */

const { getStorage, setStorage, getTheme, getWindowInfo } = require('../utils/storageManager.js')
const { getResources, addFavorite, removeFavorite, recordDownload, getFavorites, findResourceByUrl, recordBrowseHistory } = require('../utils/api.js')
const { reportError } = require('../utils/logger.js')

const HIDE_INDICATOR_DELAY = 2000
const BROWSE_RECORD_DELAY = 1000
const REWARD_AD_CACHE_TTL = 60000
const DOWNLOAD_UNLOCK_DELAY = 3000
const DOWNLOAD_HISTORY_MAX = 50

module.exports = Behavior({
  methods: {
    // ─── Helpers ──────────────────────────────────────
    _res() { return this.data.currentAvatar || this.data.currentWallpaper || {} },

    // ─── View Init ────────────────────────────────────
    getIconSet() {
      return {
        iconHome: '/images/preview-home.svg',
        iconStarOn: '/images/preview-favorite-active.svg',
        iconStarOff: '/images/preview-favorite.svg',
        iconDownload: '/images/preview-download.svg',
        iconShare: '/images/preview-share.svg',
        iconEdit: '/images/preview-edit.svg',
        iconBack: '/images/preview-back.svg',
        iconMore: '../../images/more.svg',
        iconLike: '/images/icon-like.svg',
        iconLikeActive: '/images/icon-like-active.svg',
        iconView: '/images/icon-view.svg',
        iconHot: '/images/icon-hot.svg'
      }
    },

    _initViewData() {
      const info = getWindowInfo()
      const theme = getTheme()
      this.setData(Object.assign({
        statusBarHeight: info.statusBarHeight || 20,
        navBarHeight: 44,
        theme: theme === 'dark' ? 'dark' : 'light'
      }, this.getIconSet()))
    },

    syncTheme() {
      const theme = getTheme()
      this.setData({ theme: theme === 'dark' ? 'dark' : 'light' })
    },

    goHome() {
      wx.reLaunch({ url: '/pages/index/index' })
    },

    // ─── Tag List (shared logic, page provides getTagList) ──
    _parseTags(rawTags, categories) {
      let tags = []
      if (Array.isArray(categories)) {
        categories.forEach(cat => {
          if (typeof cat === 'string') tags.push(cat)
          else if (cat && cat.name) tags.push(cat.name)
        })
      } else if (typeof categories === 'string') {
        tags.push(categories)
      }

      if (typeof rawTags === 'string') {
        tags = tags.concat(rawTags.split(/[,，]/))
      } else if (Array.isArray(rawTags)) {
        rawTags.forEach(tag => {
          if (typeof tag === 'string') {
            tags = tags.concat(tag.split(/[,，]/))
          } else {
            tags.push(String(tag))
          }
        })
      }
      return [...new Set(tags.map(t => t.trim()).filter(t => t))]
    },

    _buildTagList(resource, tagColors) {
      const colors = tagColors || ['primary', 'secondary', 'blue', 'orange', 'purple', 'teal']
      const tags = this._parseTags(resource.tags, resource.categories)
      return tags.map((tag, index) => ({ label: tag, type: colors[index % colors.length] }))
    },

    // ─── Favorites ────────────────────────────────────
    loadFavorites() {
      const type = this.data.type
      try {
        const favorites = getStorage('favorites') || []
        this.setData({ favorites })
      } catch (e) {
        console.error('加载本地收藏失败:', e)
      }

      if (typeof getFavorites === 'function') {
        getFavorites(type, 1, 100).then(res => {
          if (res.data) {
            const cloudFavorites = res.data.map(item => ({
              url: item.url,
              type: item.type,
              timestamp: item.createTime ? new Date(item.createTime).getTime() : Date.now()
            }))
            this.setData({ favorites: cloudFavorites })
            setStorage('favorites', cloudFavorites)
            this.checkFavorite()
          }
        }).catch(err => {
          console.error('加载云端收藏失败:', err)
        })
      }
    },

    checkFavorite() {
      const type = this.data.type
      const isFavorite = this.data.favorites.some(
        item => item.url === this.data.currentUrl && item.type === type
      )
      this.setData({ isFavorite })
    },

    async toggleFavorite() {
      const type = this.data.type
      if (!this.checkLogin()) {
        this.showLoginModal()
        return
      }

      const id = await this.ensureResourceId()
      const { currentUrl, favorites, isFavorite } = this.data
      const currentResource = this._res()
      const resourceId = currentResource && currentResource._id ? currentResource._id : (id || null)

      if (isFavorite) {
        const newFavorites = favorites.filter(item => item.url !== currentUrl)
        this.setData({ favorites: newFavorites, isFavorite: false })
        this.saveFavorites(newFavorites)

        const removePromise = resourceId
          ? removeFavorite(resourceId)
          : removeFavorite(currentUrl, type)
        removePromise.then(() => console.log('云端移除收藏成功')).catch(err => console.error('云端移除收藏失败:', err))
        wx.showToast({ title: '已取消收藏', icon: 'none' })
      } else {
        const newFavorite = { url: currentUrl, type, timestamp: Date.now() }
        const newFavorites = [newFavorite, ...favorites]
        this.setData({ favorites: newFavorites, isFavorite: true })
        this.saveFavorites(newFavorites)

        try {
          await addFavorite(resourceId, type, currentUrl, currentResource ? currentResource.title : '')
        } catch (err) {
          console.error('云端添加收藏失败:', err)
        }
        wx.showToast({ title: '已收藏', icon: 'none' })
      }
    },

    // ─── Like ─────────────────────────────────────────
    toggleLike() {
      const { isLiked, likeCount } = this.data
      const newIsLiked = !isLiked
      const newLikeCount = newIsLiked ? likeCount + 1 : likeCount - 1
      this.setData({
        isLiked: newIsLiked,
        likeCount: newLikeCount,
        likeCountText: this._formatCount(newLikeCount)
      })
      wx.showToast({ title: newIsLiked ? '已点赞' : '取消点赞', icon: 'none' })
    },

    // ─── Share / Copy ────────────────────────────────
    copyPagePath() {
      const { currentUrl, previewPath } = this.data
      let path = previewPath || '/subpackages/preview/preview'
      const params = [`url=${encodeURIComponent(currentUrl)}`]

      const userInfo = getStorage('userInfo')
      if (userInfo && userInfo.openid) {
        params.push(`inviter=${userInfo.openid}`)
      }

      path = path + '?' + params.join('&')
      wx.setClipboardData({
        data: path,
        success: () => wx.showToast({ title: '页面链接已复制', icon: 'success' }),
        fail: (err) => { console.error('复制链接失败:', err); wx.showToast({ title: '复制失败，请重试', icon: 'none' }) }
      })
    },

    onShareAppMessage() {
      const { currentUrl, previewPath, type } = this.data
      const r = this._res()
      const sharePath = previewPath || '/subpackages/preview/preview'
      const title = r?.title || (type === 'avatar' ? '发现了一个超好看的头像' : '发现了一个超好看的壁纸')
      return {
        title,
        path: `${sharePath}?url=${encodeURIComponent(currentUrl)}`,
        imageUrl: currentUrl
      }
    },

    onShareTimeline() {
      const { currentUrl, type } = this.data
      const r = this._res()
      return {
        title: r?.title || (type === 'avatar' ? '发现了一个超好看的头像' : '发现了一个超好看的壁纸'),
        query: `url=${encodeURIComponent(currentUrl)}`,
        imageUrl: currentUrl
      }
    },

    // ─── Download ────────────────────────────────────
    addDownloadRecord(record) {
      const type = this.data.type
      try {
        const list = getStorage('downloadHistory') || []
        const filteredList = list.filter(item => item.url !== record.url)
        const newItem = { ...record, time: Date.now() }
        const newList = [newItem, ...filteredList].slice(0, DOWNLOAD_HISTORY_MAX)
        setStorage('downloadHistory', newList)
      } catch (e) {
        console.error('保存下载记录失败', e)
      }

      recordDownload(record, type).then(res => {
        console.log('云端添加下载记录成功')
      }).catch(err => {
        console.error('云端添加下载记录失败:', err)
      })
    },

    async checkRewardAdEnabled() {
      const cache = getStorage('rewardAdEnabled_cache')
      if (cache && Date.now() - cache.time < REWARD_AD_CACHE_TTL) {
        return cache.enabled
      }
      try {
        const res = await wx.cloud.callFunction({ name: 'getConfig', data: { key: 'rewardAdEnabled' } })
        const enabled = res.result?.data?.value !== false
        setStorage('rewardAdEnabled_cache', { enabled, time: Date.now() })
        return enabled
      } catch (e) {
        return true
      }
    },

    /**
     * 🔥 预取下载相关配置，让首次点击下载时弹窗秒出
     * 在 onLoad 中非阻塞调用
     */
    _prefetchDownloadConfig() {
      // 预热 rewardAdEnabled 缓存
      this.checkRewardAdEnabled().catch(() => {})
      // 预热下载状态缓存（10s TTL）
      const cache = getStorage('downloadStatus_cache')
      if (cache && Date.now() - cache.time < 10000) return
      const type = this.data.type || 'wallpaper'
      wx.cloud.callFunction({
        name: 'userPoints',
        data: { action: 'getDownloadStatus', resourceType: type }
      }).then(res => {
        if (res.result && res.result.success) {
          setStorage('downloadStatus_cache', { data: res.result.data, time: Date.now() })
        }
      }).catch(() => {})
    },

    // ─── Image Events ────────────────────────────────
    onImageLoad(e) {
      const index = e.currentTarget.dataset.index
      const loadedImages = { ...this.data.loadedImages }
      loadedImages[index] = true
      this.setData({ loadedImages, imageLoaded: true })
    },

    onTouchStartCommon() {
      this.setData({ showPageIndicator: true })
    },

    onTouchEndCommon() {
      if (this.hideTimer) clearTimeout(this.hideTimer)
      this.hideTimer = setTimeout(() => {
        this.setData({ showPageIndicator: false })
      }, HIDE_INDICATOR_DELAY)
    },

    // ─── Lifecycle ────────────────────────────────────
    onUnloadCommon() {
      this.setData({ _isHiding: true })
      if (this.hideTimer) clearTimeout(this.hideTimer)
      if (this.browseTimer) clearTimeout(this.browseTimer)
    },

    hideLoginModal() {
      this.setData({ showLoginModal: false, modalError: '' })
    }
  }
})
