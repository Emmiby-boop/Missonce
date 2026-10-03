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
const { reportError, logger } = require('../utils/logger.js')
const { hapticSuccess } = require('../utils/haptic.js')

const HIDE_INDICATOR_DELAY = 2000
const BROWSE_RECORD_DELAY = 1000
const REWARD_AD_CACHE_TTL = 60000
const DOWNLOAD_UNLOCK_DELAY = 3000
const DOWNLOAD_HISTORY_MAX = 50

// 🔥 P0-3 cloud:// 临时URL缓存（30 分钟，远小于临时URL 2小时有效期）
const _tempUrlCache = new Map()
const TEMP_URL_TTL = 30 * 60 * 1000

// 定期清理过期条目，避免内存泄漏
// 存储 interval ID 以便清理，并防止重复创建
let _cacheCleanupIntervalId = null

function _startCacheCleanup() {
  if (_cacheCleanupIntervalId) clearInterval(_cacheCleanupIntervalId)
  _cacheCleanupIntervalId = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of _tempUrlCache) {
      if (entry && now - entry.time > TEMP_URL_TTL) {
        _tempUrlCache.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

function _stopCacheCleanup() {
  if (_cacheCleanupIntervalId) {
    clearInterval(_cacheCleanupIntervalId)
    _cacheCleanupIntervalId = null
  }
}

_startCacheCleanup()

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
        // 🔥 仅底部 💗 按钮联动 isFavorite；互动数据区已改为展示下载量，不再需要 likeCount/isLiked
        this.setData({
          favorites: newFavorites,
          isFavorite: false
        })
        this.saveFavorites(newFavorites)

        const removePromise = resourceId
          ? removeFavorite(resourceId)
          : removeFavorite(currentUrl, type)
        removePromise.catch(err => console.error('云端移除收藏失败:', err))
        wx.showToast({ title: '取消喜欢', icon: 'none' })
      } else {
        const newFavorite = { url: currentUrl, type, timestamp: Date.now() }
        const newFavorites = [newFavorite, ...favorites]
        // 🔥 仅底部 💗 按钮联动 isFavorite；互动数据区已改为展示下载量，不再需要 likeCount/isLiked
        this.setData({
          favorites: newFavorites,
          isFavorite: true
        })
        this.saveFavorites(newFavorites)

        try {
          await addFavorite(resourceId, type, currentUrl, currentResource ? currentResource.title : '')
        } catch (err) {
          console.error('云端添加收藏失败:', err)
        }
        wx.showToast({ title: '喜欢啦', icon: 'none' })
      }
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

    // ─── Reward Ad + Download Gate ──────────────────
    /**
     * 首次下载需观看激励广告的完整流程
     * - 查询下载状态 → 会员/已免费则直接通过 → 否则弹窗看广告
     * - 🔥 修复：不再使用 `new Promise(async ...)` 反模式，改用 Promise + 回调
     * - 🔥 修复：使用 this.data.type 参数化 resourceType，avatar/wallpaper 自动适配
     */
    ensureRewardedForFirstDownload() {
      const resourceType = this.data.type || 'wallpaper'
      console.warn('[DL] ensureRewardedForFirstDownload start, resourceType=', resourceType)

      return new Promise((resolve) => {
        let adResult = { success: false, method: 'points' }

        wx.cloud.callFunction({
          name: 'userPoints',
          data: { action: 'getDownloadStatus', resourceType }
        }).then((statusRes) => {
          const status = statusRes.result && statusRes.result.success ? statusRes.result.data : null
          console.warn('[DL] getDownloadStatus result=', JSON.stringify(status))

          if (!status) {
            console.warn('[DL] getDownloadStatus: no status, fallback to points')
            resolve({ success: true, method: 'points' })
            return
          }

          // 会员直接通过
          if (status.isMember) {
            console.warn('[DL] getDownloadStatus: isMember=true')
            resolve({ success: true, method: 'member' })
            return
          }

          // 如果今天已经看过广告，直接下载
          if (status.freeDownloadUsed) {
            console.warn('[DL] getDownloadStatus: freeDownloadUsed=true, skip ad')
            resolve({ success: true, method: 'free' })
            return
          }

          console.warn('[DL] getDownloadStatus: need to show ad')
          // 首次下载：必须观看激励广告
          wx.showModal({
            title: '首次下载提示',
            content: '首次下载需要观看激励视频，观看后可免费下载今日所有资源！',
            confirmText: '观看视频',
            cancelText: '取消',
            success: (modalRes) => {
              if (!modalRes.confirm) {
                console.warn('[DL] user cancelled ad modal')
                resolve(adResult)
                return
              }

              console.warn('[DL] user confirmed, finding rewardedAd component')
              const rewardedAdComponent = this.selectComponent('#rewardedAd')
              if (!rewardedAdComponent) {
                console.warn('[DL] rewardedAd component NOT found!')
                resolve(adResult)
                return
              }

              console.warn('[DL] calling showRewarded()')
              rewardedAdComponent.showRewarded().then((result) => {
                console.warn('[DL] showRewarded result=', JSON.stringify(result))
                if (result.success) {
                  // 🔥 标记今日已观看广告，后续下载不再提示看广告
                  console.warn('[DL] ad watched, calling markAdWatched')
                  wx.cloud.callFunction({
                    name: 'userPoints',
                    data: { action: 'markAdWatched' }
                  }).then(() => {
                    console.warn('[DL] markAdWatched success')
                    resolve({ success: true, method: 'free' })
                  }).catch((e) => {
                    console.warn('[DL] markAdWatched FAILED:', e)
                    // 即使标记失败，广告已看完，仍允许本次下载
                    resolve({ success: true, method: 'free' })
                  })
                } else {
                  console.warn('[DL] showRewarded: ad not watched, result=', JSON.stringify(result))
                  // 根据 reason 区分提示
                  if (result.skipped) {
                    if (result.reason === 'not_completed') {
                      wx.showToast({ title: '请完整观看广告后下载', icon: 'none' })
                    } else {
                      wx.showToast({ title: '广告中断，请勿切后台', icon: 'none' })
                    }
                  } else if (result.error) {
                    wx.showToast({ title: result.error, icon: 'none' })
                  } else {
                    wx.showToast({ title: '广告加载失败，请稍后重试', icon: 'none' })
                  }
                  resolve(adResult)
                }
              }).catch((e) => {
                console.warn('[DL] showRewarded error:', e)
                resolve(adResult)
              })
            },
            fail: () => {
              console.warn('[DL] wx.showModal fail')
              resolve(adResult)
            }
          })
        }).catch((e) => {
          console.warn('[DL] getDownloadStatus cloud error:', e)
          resolve(adResult)
        })
      })
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

      recordDownload(record, type).catch(err => {
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
        logger.warn('rewardAdEnabled 查询失败，降级返回 true', e)
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

    // 🔥 [预览页优化] 图片加载失败：自动降级到 rawImageList 原图（如果当前是缩略图）
    onImageError(e) {
      const index = e.currentTarget.dataset.index
      const rawList = this.data.rawImageList || []
      if (!rawList[index]) return
      const fallbackUrl = rawList[index]
      // 避免重复降级
      if (this.data._lastErrorIndex === index) return
      this._lastErrorIndex = index
      // 把原图塞回 imageList[index]，触发 image 重新加载
      const imageList = [...this.data.imageList]
      imageList[index] = fallbackUrl
      this.setData({ imageList })
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
      if (this._browseTimer) clearTimeout(this._browseTimer)
      // 清理模块级缓存清理定时器，避免页面卸载后继续运行
      _stopCacheCleanup()
    },

    hideLoginModal() {
      this.setData({ showLoginModal: false, modalError: '' })
    },

    // ─── Build Similar List ─────────────────────────
    buildSimilarList() {
      const type = this.data.type
      const current = this._res()
      let rawTags = current.tags || []

      let tags = []
      if (typeof rawTags === 'string') {
        tags = rawTags.split(/[,，]/)
      } else if (Array.isArray(rawTags)) {
        rawTags.forEach(tag => {
          if (typeof tag === 'string') {
            tags = tags.concat(tag.split(/[,，]/))
          } else {
            tags.push(String(tag))
          }
        })
      }

      tags = tags.map(t => t.trim()).filter(t => t)

      const categoryLabel = type === 'avatar' ? '相似头像' : '相似壁纸'
      const currentId = current._id || current.id || ''

      // 🔥 [相似推荐多样性] 多 tag 轮询 + 随机排序
      // 解决：之前 sort: 'hot' + tag: tags[0] 导致不同图推荐完全一样
      // 1. tag 轮询：每次进入切换 tag 索引（让不同图推不同 tag 下的内容）
      // 2. sort: 'random'：云函数已有 aggregate.sample() 支持
      // 3. 排除当前图：避免推荐自己
      this._similarTagRound = ((this._similarTagRound || 0) + 1) % Math.max(tags.length, 1)
      const pickedTag = tags.length > 0 ? tags[this._similarTagRound] : undefined

      return getResources({
        type: type,
        pageSize: 12,
        page: 1,
        sort: 'random',
        tag: pickedTag,
        includeMeta: false
      }).then(res => {
        const similarList = (res.result.data || [])
          .filter(item => {
            const itemId = item.id || item._id
            return !currentId || itemId !== currentId
          })
          .slice(0, 12)
          .map(item => ({
            _id: item.id || item._id,
            url: item.url || item.coverUrl || item.originUrl || '',
            coverUrl: item.coverUrl,
            originUrl: item.originUrl || '',
            title: item.title || '',
            categories: item.categories || [],
            tags: item.tags || [],
            views: item.views || 0,
            downloads: item.downloads || 0,
            favorites: item.favorites || 0,
            hotScore: item.hotScore || 0,
            category: item.categories && item.categories.length > 0 ? item.categories[0].name : categoryLabel
          })).filter(item => item.url)

        return similarList
      }).catch(error => {
        console.error(`获取相似${categoryLabel}失败:`, error)
        return []
      })
    },

    // ─── Pick URL ────────────────────────────────────
    pickUrl() {
      const res = this._res()
      const candidates = [this.data.rawUrl, res.originUrl, res.url, res.coverUrl, this.data.currentUrl]
      for (const c of candidates) {
        if (c) return c
      }
      return ''
    },

    // ─── Share Image URL ─────────────────────────────
    // 🔥 P0-3 getTempFileURL 缓存（30 分钟），避免每次进预览页都申请
    _prepareShareImageUrl(url) {
      if (!url || !url.startsWith('cloud://')) {
        if (this.data.shareImageUrl !== url) this.setData({ shareImageUrl: url })
        return
      }
      // 命中缓存直接用
      const entry = _tempUrlCache.get(url)
      if (entry && Date.now() - entry.time < TEMP_URL_TTL) {
        if (this.data.shareImageUrl !== entry.tempUrl) this.setData({ shareImageUrl: entry.tempUrl })
        return
      }
      wx.cloud.getTempFileURL({
        fileList: [url],
        success: (res) => {
          const tempUrl = res.fileList && res.fileList[0] && res.fileList[0].tempFileURL
          if (tempUrl) {
            _tempUrlCache.set(url, { tempUrl, time: Date.now() })  // 🔥 P0-3 写入缓存
            if (this.data.shareImageUrl !== tempUrl) this.setData({ shareImageUrl: tempUrl })
          }
        },
        fail: () => {
          if (this.data.shareImageUrl !== url) this.setData({ shareImageUrl: url })
        }
      })
    },

    // ─── Download ────────────────────────────────────
    async downloadImage() {
      // 同步锁：防止极短时间内多次点击穿透 setData 异步
      if (this._dlLock) {
        // 🔥 已点击但按钮 spinner 还未渲染出来时，给用户即时反馈避免重复点击
        // 用 showToast 而非 showLoading：toast 不会和后续 wx.showModal 冲突（互斥自动替换）
        wx.showToast({ title: '准备中', icon: 'loading', duration: 1500, mask: false })
        return
      }
      this._dlLock = true

      console.warn('[DL] downloadImage start, isDownloading=', this.data.isDownloading)
      if (this.data.isDownloading) {
        console.warn('[DL] already downloading, skip')
        this._dlLock = false
        return
      }
      // 🔥 立即显示轻量级 toast，弥补 setData 渲染延迟（约 50-200ms）期间的视觉空白
      // toast duration=1500ms，刚好覆盖到 isDownloading spinner 渲染完成；且与 wx.showModal 互斥，
      // 后续 ensureRewardedForFirstDownload 弹 modal 时会自动替换 toast，不冲突
      wx.showToast({ title: '准备中', icon: 'loading', duration: 1500, mask: false })
      this.setData({ isDownloading: true })

      getApp().logEvent('download_start', {
        type: this.data.type,
        url: this.data.currentUrl
      })

      try {
        console.warn('[DL] checkLogin...')
        if (!this.checkLogin()) {
          console.warn('[DL] not logged in, show login modal')
          wx.hideToast()
          this.showLoginModal()
          this.setData({ isDownloading: false })
          this._dlLock = false
          return
        }

        // 🔥 不在此处 showLoading：ensureRewardedForFirstDownload 内部会弹 wx.showModal，
        // 而 wx.showLoading 的 mask 会和 modal 叠加，导致 modal 关闭后 loading 遮罩仍在
        // 卡住页面"关不掉"。下载文件时的"保存中.."loading 由 doDownload 内部负责。
        const that = this

        try {
          const rewardAdEnabled = await this.checkRewardAdEnabled()
          console.warn('[DL] rewardAdEnabled=', rewardAdEnabled)

          let adResult
          if (!rewardAdEnabled) {
            console.warn('[DL] reward ad DISABLED, bypass')
            adResult = { success: true, method: 'free' }
          } else {
            console.warn('[DL] calling ensureRewardedForFirstDownload...')
            adResult = await this.ensureRewardedForFirstDownload()
            console.warn('[DL] ensureRewardedForFirstDownload result=', JSON.stringify(adResult))
          }

          if (!adResult.success) {
            console.warn('[DL] adResult.success=false, abort')
            wx.hideToast()
            wx.hideLoading()
            this.setData({ isDownloading: false })
            this._dlLock = false
            return
          }

          console.warn('[DL] calling doDownload with method=', adResult.method)
          // doDownload 内部会 showLoading('保存中..')，先清理 toast 避免 UI 残留
          wx.hideToast()
          if (adResult.method === 'free') {
            that.doDownload(true, 'free')
          } else if (adResult.method === 'member') {
            that.doDownload(true, 'member')
          } else {
            that.doDownload(false, 'points')
          }
        } catch (e) {
          console.error('检查下载状态失败', e)
          wx.hideToast()
          wx.hideLoading()
          that.doDownload(false, 'points')
        }
      } finally {
        // 🔥 兜底 timer：45 秒后强制清理 loading 和锁，防止异常路径导致 loading 卡死关不掉
        // 注意：不在 finally 顶部立即 hideLoading，因为 doDownload 内部会 showLoading('保存中..')
        // 立即 hideLoading 会清掉 doDownload 的 loading
        if (this._fallbackTimer) clearTimeout(this._fallbackTimer)
        this._fallbackTimer = setTimeout(() => {
          if (this.data.isDownloading) {
            this.setData({ isDownloading: false })
          }
          this._dlLock = false
          // 兜底清理 loading/toast，防止 doDownload 内部 showLoading 后异常未清理
          wx.hideLoading()
          wx.hideToast()
        }, 45000)
      }
    },

    async doDownload(isFree = false, downloadMethod = 'points') {
      if (!this.checkLogin()) {
        this.showLoginModal()
        this._dlLock = false
        return
      }

      await this.ensureResourceId()

      const that = this
      const hasAlbumPermission = await this.ensureAlbumPermission()
      if (!hasAlbumPermission) {
        this.setData({ isDownloading: false })
        this._dlLock = false
        return
      }
      const rawUrl = this.pickUrl()
      if (!rawUrl) {
        wx.showToast({ title: '图片地址缺失', icon: 'none' })
        this.setData({ isDownloading: false })
        this._dlLock = false
        return
      }

      if (!isFree) {
        try {
          const statusRes = await wx.cloud.callFunction({
            name: 'userPoints',
            data: { action: 'getDownloadStatus' }
          })
          const status = statusRes.result && statusRes.result.success ? statusRes.result.data : {}
          const downloadCost = status.downloadCost || status.pointsRequired || 6

          const deductRes = await wx.cloud.callFunction({
            name: 'userPoints',
            data: {
              action: 'deductPoints',
              amount: downloadCost,
              type: 'download',
              description: '下载消耗辣度值'
            }
          })

          if (!deductRes.result || !deductRes.result.success) {
            wx.showToast({ title: '辣度值扣除失败', icon: 'none' })
            this.setData({ isDownloading: false })
            this._dlLock = false
            return
          }
        } catch (e) {
          console.error('辣度值扣除失败:', e)
          wx.showToast({ title: '辣度值扣除失败', icon: 'none' })
          this.setData({ isDownloading: false })
          this._dlLock = false
          return
        }
      }

      wx.showLoading({ title: '保存中..', mask: true })

      if (rawUrl.startsWith('cloud://')) {
        wx.cloud.downloadFile({
          fileID: rawUrl,
          success(res) {
            if (res.statusCode === 200) {
              that.saveToAlbum(res.tempFilePath, rawUrl, downloadMethod)
            } else {
              wx.hideLoading()
              that.setData({ isDownloading: false })
              that._dlLock = false
              wx.showToast({ title: '下载云文件失败', icon: 'none' })
            }
          },
          fail(err) {
            wx.hideLoading()
            that.setData({ isDownloading: false })
            that._dlLock = false
            console.error('cloud.downloadFile fail:', err)
            wx.showToast({ title: '下载云文件失败: ' + (err.errMsg || '未知错误'), icon: 'none' })
          }
        })
        return
      }

      const url = this.getSafeUrl(rawUrl)
      if (!url) {
        wx.showToast({ title: '图片地址无效', icon: 'none' })
        this.setData({ isDownloading: false })
        this._dlLock = false
        return
      }

      let ext = '.jpg'
      if (url.includes('.png')) ext = '.png'
      else if (url.includes('.gif')) ext = '.gif'
      else if (url.includes('.webp')) ext = '.webp'

      wx.downloadFile({
        url,
        timeout: 30000,
        success(res) {
          if (res.statusCode === 200) {
            const tempFilePath = res.filePath || res.tempFilePath
            that.saveToAlbum(tempFilePath, url, downloadMethod)
          } else {
            that.tryProxyDownload(url, downloadMethod)
          }
        },
        fail(err) {
          that.tryProxyDownload(url, downloadMethod)
        }
      })
    },

    // ─── Save To Album ───────────────────────────────
    saveToAlbum(tempFilePath, originalUrl, downloadMethod = 'points') {
      const that = this

      const fs = wx.getFileSystemManager()
      let finalPath = tempFilePath

      try {
        let ext = '.jpg'
        if (originalUrl.includes('.png')) ext = '.png'
        else if (originalUrl.includes('.gif')) ext = '.gif'
        else if (originalUrl.includes('.webp')) ext = '.webp'

        if (!tempFilePath.match(/\.[a-zA-Z0-9]+$/) || tempFilePath.indexOf(wx.env.USER_DATA_PATH) === -1) {
          const newPath = `${wx.env.USER_DATA_PATH}/${Date.now()}_${Math.random().toString(36).substr(2)}${ext}`
          fs.saveFileSync(tempFilePath, newPath)
          finalPath = newPath
        }
      } catch (e) {
        console.error('修正文件后缀失败，尝试直接保存', e)
      }

      wx.saveImageToPhotosAlbum({
        filePath: finalPath,
        success: () => {
          wx.hideLoading()
          that.setData({ isDownloading: false })
          that._dlLock = false
          const current = that._res()
          that.addDownloadRecord({
            url: originalUrl,
            type: that.data.type,
            id: current._id,
            downloadMethod: downloadMethod
          })
          hapticSuccess()  // 触感反馈：下载保存成功
          wx.showToast({
            title: '已保存到相册',
            icon: 'success',
            duration: 2000
          })
          if (finalPath !== tempFilePath) {
            try { fs.unlinkSync(finalPath) } catch(e) {
              console.error('[preview] 清理临时文件失败:', e)
            }
          }
        },
        fail(err) {
          if (finalPath !== tempFilePath) {
            try { fs.unlinkSync(finalPath) } catch(e) {
              console.error('[preview] 清理临时文件失败:', e)
            }
          }

          wx.hideLoading()
          that.setData({ isDownloading: false })
          that._dlLock = false
          if (err.errMsg && err.errMsg.includes('auth')) {
            wx.showModal({
              title: '提示',
              content: '需要您授权保存图片到相册',
              confirmText: '去授权',
              success(res) {
                if (res.confirm) {
                  wx.openSetting({
                    success(settingRes) {
                      if (settingRes.authSetting['scope.writePhotosAlbum']) {
                        const rawUrl = that.pickUrl()
                        if (rawUrl) {
                          const url = that.getSafeUrl(rawUrl)
                          if (url.startsWith('cloud://')) {
                            wx.cloud.downloadFile({
                              fileID: url,
                              success(res2) {
                                if (res2.statusCode === 200) {
                                  that.saveToAlbum(res2.tempFilePath, url, downloadMethod)
                                }
                              }
                            })
                          } else {
                            wx.downloadFile({
                              url,
                              timeout: 30000,
                              success(res2) {
                                if (res2.statusCode === 200) {
                                  that.saveToAlbum(res2.tempFilePath || res2.filePath, url, downloadMethod)
                                }
                              },
                              fail() {
                                wx.showToast({ title: '重新下载失败', icon: 'none' })
                              }
                            })
                          }
                        }
                      }
                    }
                  })
                }
              }
            })
            reportError({
              message: 'saveToAlbum fail',
              detail: err,
              type: 'download_error'
            })
            that._onSaveAlbumFail(err)
          }
        }
      })
    },

    // 钩子：保存到相册失败且为 auth 错误时的额外提示，页面可按需覆盖
    _onSaveAlbumFail(err) { /* noop by default */ },

    onRewarded(e) {}
  }
})
