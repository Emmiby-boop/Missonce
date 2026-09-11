import { getDailyPicks } from '../../utils/api.js'
import { optimizeImageUrls, getOptimalThumbnailSize, getGifThumbnailSize } from '../../utils/image.js'
import { cacheManager } from '../../utils/cache.js'
import { getStorage, getWindowInfo, setStorage } from '../../utils/storageManager.js'
import { getListAdConfig } from '../../utils/adUtil.js'

const CACHE_KEY = 'daily_picks_cache'
const CACHE_EXPIRE = 24 * 60 * 60 * 1000

Page({
  data: {
    loading: true,
    date: '',
    title: '',
    subtitle: '',
    weekDay: '',
    dayNum: '',
    monthText: '',
    leftColumn: [],
    rightColumn: [],
    totalCount: 0,
    hasError: false,
    errorMsg: '',
    statusBarHeight: 0,
    navBarHeight: 44
  },

  onLoad(options) {
    // 初始化导航栏高度
    this.initNavBar()
    this._listAdConfig = null
    this._loadListAdConfig()

    const today = new Date()
    const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')

    // 设置日期数字显示
    const dayNum = String(today.getDate()).padStart(2, '0')
    const monthText = (today.getMonth() + 1) + '月'

    this.setData({ date: dateStr, dayNum, monthText })

    // 🔥 优化：先尝试快速渲染缓存
    this.tryRenderFromCache()

    // 🔥 优化：标记已读
    this.markAsRead()
  },

  initNavBar() {
    try {
      const info = getWindowInfo()
      const statusBarHeight = info.statusBarHeight || 20
      const navBarHeight = 44 // 固定高度
      this.setData({ statusBarHeight, navBarHeight })
    } catch (e) {
      console.error('获取系统信息失败:', e)
    }
  },

  navigateBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
    } else {
      wx.switchTab({ url: '/pages/index/index' })
    }
  },

  // 🔥 新增：尝试从缓存快速渲染
  tryRenderFromCache() {
    const cachedData = getStorage(CACHE_KEY)
    const today = new Date()
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')

    if (cachedData && cachedData.date === todayStr && cachedData.leftColumn && cachedData.leftColumn.length > 0) {
      // 有今天的缓存，直接渲染
      this.setData({
        loading: false,
        ...cachedData
      })
      return
    }

    // 无缓存或过期，加载新数据
    this.loadDailyPicks()
  },

  onShow() {
    const today = new Date()
    const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')

    if (this.data.date !== dateStr) {
      this.setData({ date: dateStr })
      this.loadDailyPicks()
    }
  },

  markAsRead() {
    const today = new Date()
    const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')
    setStorage('daily_picks_read_date', dateStr)
  },

  async loadDailyPicks() {
    this.setData({ loading: true, hasError: false })

    try {
      // 🔥 L2 直读：优先直读 daily_picks 集合（跳 callFunction，省 100-300ms）
      // 集合权限需设为"所有用户可读"（与 home_cache 一致）
      // 集合内只存 resourceId 列表，需关联 resources 集合查完整数据
      let result = null
      try {
        const db = wx.cloud.database()
        const _ = db.command
        const cacheRes = await db.collection('daily_picks')
          .where({ date: this.data.date })
          .limit(1)
          .get()

        if (cacheRes.data && cacheRes.data.length > 0) {
          const cachedPicks = cacheRes.data[0]
          const resourceIds = (cachedPicks.items || [])
            .map(item => item.resourceId || item._id)
            .filter(id => id)

          if (resourceIds.length > 0) {
            // 分批查询（每批 ≤ 20 条，避免 _.in 性能问题）
            const batches = []
            for (let i = 0; i < resourceIds.length; i += 20) {
              batches.push(resourceIds.slice(i, i + 20))
            }
            const batchResults = await Promise.all(
              batches.map(batch => db.collection('resources').where({ _id: _.in(batch) }).get())
            )
            const resourceMap = new Map()
            batchResults.forEach(r => r.data.forEach(item => resourceMap.set(item._id, item)))

            // 按 position 重组
            const items = (cachedPicks.items || [])
              .map(entry => {
                const resource = resourceMap.get(entry.resourceId || entry._id)
                if (!resource) return null
                return { ...resource, position: entry.position, resourceType: entry.resourceType || resource.type || 'wallpaper' }
              })
              .filter(Boolean)

            if (items.length > 0) {
              console.log('[daily-picks] L2 直读命中，items:', items.length)
              result = this._formatPicksResponse(items, this.data.date)
            }
          }
        }
      } catch (e) {
        console.warn('[daily-picks] L2 直读失败，降级到 callFunction:', e.message)
      }

      // 🔥 L3 兜底：直读未命中或失败，走 callFunction
      if (!result) {
        console.log('[daily-picks] L2 未命中，走 callFunction')
        result = await getDailyPicks(this.data.date)
      }

      if (!result) {
        this.setData({
          loading: false,
          hasError: true,
          errorMsg: '暂无今日推荐'
        })
        return
      }

      // 🔥 优化：GIF 使用更小的尺寸
      const thumbSize = getGifThumbnailSize()

      const processColumn = (items) => {
        if (!items) return []
        const optimized = optimizeImageUrls(items, 'url', thumbSize)
        return optimized.map(item => ({
          ...item,
          id: item._id,
          url: item.optimizedUrl || item.url,
          originalUrl: item.originalUrl || item.url,
          rawUrl: item.rawUrl || item.url,
          resourceType: item.resourceType || item.type || 'wallpaper',
          categories: item.categories || [],
          tags: item.tags || []
        }))
      }

      const data = {
        date: result.date,
        title: result.title,
        subtitle: result.subtitle,
        weekDay: result.weekDay,
        leftColumn: processColumn(result.leftColumn),
        rightColumn: processColumn(result.rightColumn),
        totalCount: result.totalCount
      }

      // 🔥 注入伪装广告卡片：两列合并计算间隔（每 9-12 张插 1 个）
      // 广告随机分配到左或右列，单实例不会同屏出现两个广告
      const adResult = this._injectAdCard(data.leftColumn, data.rightColumn)
      data.leftColumn = adResult.leftColumn
      data.rightColumn = adResult.rightColumn

      setStorage(CACHE_KEY, data)

      this.setData({
        loading: false,
        ...data
      })
    } catch (err) {
      console.error('加载每日精选失败:', err)
      this.setData({
        loading: false,
        hasError: true,
        errorMsg: '加载失败，请稍后重试'
      })
    }
  },

  // 🔥 L2 直读时复用云函数的格式化逻辑（前端版）
  _formatPicksResponse(picks, dateStr) {
    const targetDate = new Date(dateStr)
    const month = targetDate.getMonth() + 1
    const day = targetDate.getDate()
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const weekDay = weekDays[targetDate.getDay()]

    const title = month + '月' + day + '日 · 每日推荐'
    const subtitle = '为你推荐' + picks.length + '张壁纸头像'

    const leftColumn = []
    const rightColumn = []

    picks.forEach((item, index) => {
      const processedItem = {
        id: item._id,
        _id: item._id,
        url: item.coverUrl || item.url,
        originalUrl: item.originUrl || item.originalUrl || item.url,
        rawUrl: item.coverUrl || item.url,
        rawOriginalUrl: item.originUrl || item.originalUrl || item.url,
        resourceType: item.resourceType || item.type || 'wallpaper',
        categories: item.categories || [],
        tags: item.tags || [],
        width: item.width || 1080,
        height: item.height || 1920
      }

      if (index % 2 === 0) {
        leftColumn.push(processedItem)
      } else {
        rightColumn.push(processedItem)
      }
    })

    return {
      date: dateStr,
      title,
      subtitle,
      weekDay,
      items: picks,
      leftColumn,
      rightColumn,
      totalCount: picks.length
    }
  },

  // 加载后台 listAdConfig 广告间隔配置
  async _loadListAdConfig() {
    try {
      const cfg = await getListAdConfig('/subpackages/daily-picks/daily-picks', 0)
      this._listAdConfig = cfg
    } catch (e) {
      console.warn('[daily-picks] 加载 listAdConfig 失败:', e)
    }
  },

  // 🔥 注入伪装广告卡片：两列合并计算间隔，广告随机出现在左或右列
  // 后台未配置时默认 9-12 随机；配置后按 interval 等距插入
  _injectAdCard(leftColumn, rightColumn) {
    const left = leftColumn || []
    const right = rightColumn || []
    const total = left.length + right.length
    if (total < 9) return { leftColumn: left, rightColumn: right }

    // 合并两列，保留列归属
    const merged = []
    const maxLen = Math.max(left.length, right.length)
    for (let i = 0; i < maxLen; i++) {
      if (i < left.length) merged.push({ data: left[i], col: 'left' })
      if (i < right.length) merged.push({ data: right[i], col: 'right' })
    }

    // 读取后台配置
    const cfg = this._listAdConfig
    const enabled = cfg && cfg.enabled
    const interval = cfg && cfg.interval > 0 ? cfg.interval : 0

    const result = []
    let adCounter = 0

    if (!enabled || interval <= 0) {
      // 未启用：沿用默认 9-12 随机
      let nextAdIndex = 9 + Math.floor(Math.random() * 4)
      merged.forEach((entry, index) => {
        result.push(entry)
        if (index === nextAdIndex && index < merged.length - 2) {
          const adId = 'ad-daily-' + Date.now() + '-' + adCounter
          const adCol = Math.random() < 0.5 ? 'left' : 'right'
          result.push({
            data: {
              _id: adId,
              id: adId,
              _cardType: 'ad',
              type: 'wallpaper',
              resourceType: 'wallpaper',
              url: '',
              coverUrl: ''
            },
            col: adCol
          })
          adCounter++
          nextAdIndex = index + 1 + 9 + Math.floor(Math.random() * 4)
        }
      })
    } else {
      // 已启用：按 interval 等距插入
      merged.forEach((entry, index) => {
        result.push(entry)
        if ((index + 1) % interval === 0 && index < merged.length - 2) {
          const adId = 'ad-daily-' + Date.now() + '-' + adCounter
          const adCol = Math.random() < 0.5 ? 'left' : 'right'
          result.push({
            data: {
              _id: adId,
              id: adId,
              _cardType: 'ad',
              type: 'wallpaper',
              resourceType: 'wallpaper',
              url: '',
              coverUrl: ''
            },
            col: adCol
          })
          adCounter++
        }
      })
    }

    // 拆回两列
    const newLeft = result.filter(e => e.col === 'left').map(e => e.data)
    const newRight = result.filter(e => e.col === 'right').map(e => e.data)

    return { leftColumn: newLeft, rightColumn: newRight }
  },

  onWaterfallItemTap(e) {
    const { url, originalurl, type, index, column } = e.currentTarget.dataset
    const items = column === 'left' ? this.data.leftColumn : this.data.rightColumn
    const currentIndex = items.findIndex(item => item.id === e.currentTarget.dataset.id)

    const imageList = [
      ...this.data.leftColumn.map(item => item.originalUrl || item.url),
      ...this.data.rightColumn.map(item => item.originalUrl || item.url)
    ]

    if (type === 'avatar') {
      wx.navigateTo({
        url: '/subpackages/preview/preview?url=' + encodeURIComponent(originalurl || url) + '&rawUrl=' + encodeURIComponent(e.currentTarget.dataset.rawurl || '') + '&isAvatar=true&id=' + (e.currentTarget.dataset.id || '')
      })
    } else {
      wx.navigateTo({
        url: '/subpackages/wallpaper-preview/wallpaper-preview?url=' + encodeURIComponent(originalurl || url) + '&rawUrl=' + encodeURIComponent(e.currentTarget.dataset.rawurl || '') + '&id=' + (e.currentTarget.dataset.id || '')
      })
    }
  },

  onPullDownRefresh() {
    setStorage(CACHE_KEY, null)
    this.loadDailyPicks().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    // 🔥 已改用中部伪装广告卡片（混入瀑布流），不再需要底部原生广告
  },

  onShareAppMessage() {
    return {
      title: this.data.title || '今日精选壁纸头像',
      path: '/subpackages/daily-picks/daily-picks'
    }
  },

  onUnload() {
    if (this._unreadTimer) {
      clearTimeout(this._unreadTimer)
    }
  }
})
