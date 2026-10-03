import { performanceMonitor } from '../../utils/performance.js'
import logger from '../../utils/logger.js'
import { getStorage, setStorage, getWindowInfo } from '../../utils/storageManager.js'
import { hapticSelect, hapticRefresh } from '../../utils/haptic'

// 角标配置映射
const BADGE_CONFIG = {
  hot: { text: '热门', class: 'badge-hot' },
  new: { text: '新品', class: 'badge-new' },
  limited: { text: '限时', class: 'badge-limited' }
}

Page({
  // 点击底部 tabBar 时的轻震反馈（onTabItemTap 基础库 1.9.0+，点击当前 tab 同样触发）
  onTabItemTap() {
    hapticSelect()
  },

  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    menuRightGap: 10,  // 搜索图标距屏幕右侧距离（避开胶囊按钮）
    topics: [],          // 全部专题
    featuredTopics: [],  // 精选专题（isFeatured）
    filteredTopics: [],  // 当前标签过滤后的专题（网格展示）
    tags: [],            // 标签列表（从 filterValue 聚合）
    activeTag: '',       // 当前选中标签（空字符串=全部）
    loading: true,        // 首屏骨架屏
    loadingMore: false,   // 底部加载更多
    page: 1,
    pageSize: 20,
    hasMore: true,
    skeletons: new Array(4).fill(0),
    listColumns: 2  // 专题列表每行列数（后台可配置 1~4，默认 2）
  },

  _rawTopics: [],         // 原始专题数据（未做角标映射，避免重复处理）

  onLoad() {
    performanceMonitor.startPageLoad('专题页')

    // 🔥 低端机降级：毛玻璃 blur → 纯色（wxml 在 blur 元素上挂 low-end class）
    this.setData({ lowEnd: !!(getApp().globalData && getApp().globalData.lowEnd) })

    try {
      const info = getWindowInfo()
      const statusBarHeight = info.statusBarHeight || 20
      const screenWidth = info.screenWidth || 375

      let navBarHeight = 44
      let menuRightGap = 10

      try {
        const menuButton = wx.getMenuButtonBoundingClientRect()
        if (menuButton && menuButton.width > 0) {
          navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
          menuRightGap = screenWidth - menuButton.left + 8
        }
      } catch (e) {
        console.error('[topics] 获取胶囊按钮位置失败:', e)
      }

      this.setData({ statusBarHeight, navBarHeight, menuRightGap })
    } catch (e) {
      console.error('[topics] 初始化导航栏失败:', e)
    }

    // 🔥 列数配置延迟到首屏后加载，避免与 L2 直读竞争网络并发
    setTimeout(() => this.loadListColumnsConfig(), 0)

    // 优先用缓存渲染，随后后台静默刷新
    const cachedData = getStorage('topics_list_cache')
    if (cachedData) {
      const { topics, timestamp } = cachedData
      if (topics && topics.length > 0 && (Date.now() - timestamp < 30 * 60 * 1000)) {
        this._rawTopics = topics
        this._processTopics(topics)
        this.setData({ loading: false })
        performanceMonitor.markMilestone('专题页', '缓存加载完成')
        // 🔥 L1 命中后跳过 L2 直读，直接后台静默刷新 callFunction
        // （L1 已有数据，L2 直读成功也会返回相同数据，没必要多查一次）
        this._silentRefreshFromCloud()
        return
      }
    }

    // L1 未命中：优先 L2 直读 topics_cache 集合
    this.loadTopics(1, true)
  },

  // 🔥 L1 命中后的后台静默刷新：走 callFunction 检查是否有更新
  // 失败不报错，保留 L1 缓存数据
  async _silentRefreshFromCloud() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getTopics',
        data: {
          status: 'active',
          page: 1,
          pageSize: this.data.pageSize
        }
      })
      if (res.result && res.result.success && res.result.data && res.result.data.length > 0) {
        const newTopics = res.result.data.map(item => ({
          ...item,
          coverUrl: item.coverUrl || item.cover || ''
        }))
        // 仅当数据确实变化时才更新（避免无意义的 setData 闪屏）
        if (newTopics.length !== this._rawTopics.length ||
            (newTopics[0] && newTopics[0]._id !== (this._rawTopics[0] && this._rawTopics[0]._id))) {
          this._rawTopics = newTopics
          this._processTopics(newTopics)
          setStorage('topics_list_cache', {
            topics: newTopics,
            timestamp: Date.now()
          })
          performanceMonitor.markMilestone('专题页', '静默刷新完成')
        }
      }
    } catch (e) {
      console.warn('[专题页] 静默刷新失败，保留缓存:', e.message)
    }
  },

  onPullDownRefresh() {
    hapticRefresh()  // 触感反馈：下拉到达刷新阈值
    if (this.data.activeTag !== '') {
      this.setData({ activeTag: '' })
    }
    this.loadTopics(1, true)
  },

  onReachBottom() {
    // 标签筛选模式下不触发分页（前端过滤，已全部加载）
    if (this.data.activeTag !== '') return
    if (this.data.hasMore && !this.data.loading && !this.data.loadingMore) {
      this.loadTopics(this.data.page + 1)
    }
  },

  // 读取专题列表每行列数配置（后台 config 集合）
  async loadListColumnsConfig() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getConfig',
        data: { key: 'topicsListConfig' }
      })
      if (res.result && res.result.success && res.result.data) {
        const cols = Number(res.result.data.value && res.result.data.value.columns)
        if (cols >= 1 && cols <= 4) {
          this.setData({ listColumns: cols })
        }
      }
    } catch (e) {
      console.warn('[专题页] 列表列数配置加载失败，使用默认 2 列:', e)
    }
  },

  // ===== 处理专题数据：分组 + 标签聚合 + 角标映射 =====
  _processTopics(topics) {
    // 角标映射
    const processedTopics = topics.map(item => ({
      ...item,
      name: item.title || item.name,
      itemCount: item.itemCount || 0,
      badgeText: item.badge ? (BADGE_CONFIG[item.badge]?.text || '') : '',
      badgeClass: item.badge ? (BADGE_CONFIG[item.badge]?.class || '') : ''
    }))

    // 精选专题（isFeatured 为 true 的）
    const featuredTopics = processedTopics.filter(t => t.isFeatured)

    // 标签聚合（从 filterValue 去重）
    const tagSet = new Set()
    processedTopics.forEach(t => {
      if (t.filterValue && t.filterType === 'tag') {
        tagSet.add(t.filterValue)
      }
    })
    const tags = Array.from(tagSet)

    // 当前过滤结果
    const filteredTopics = this._filterByTag(processedTopics, this.data.activeTag)

    this.setData({
      topics: processedTopics,
      featuredTopics,
      tags,
      filteredTopics
    })
  },

  // ===== 按标签过滤 =====
  // 注意：page/webview 类型专题（内部页面/网页链接）的 filterValue 为空，
  // 不参与标签筛选，应始终显示
  _filterByTag(topics, tag) {
    if (!tag) return topics
    return topics.filter(t => {
      const linkType = t.linkType || 'resource'
      // 非资源列表类型专题始终显示
      if (linkType === 'page' || linkType === 'webview') return true
      return t.filterValue === tag
    })
  },

  // ===== 加载专题列表 =====
  // 优先级：直读 topics_cache 集合（第一页，跳过 callFunction 链路）
  //       → callFunction getTopics（分页或缓存未命中）
  //       → 降级到本地 storage 缓存
  async loadTopics(page = 1, reset = false, options = {}) {
    const { silent = false } = options

    if (this.data.loadingMore && !reset) return

    try {
      if (reset) {
        if (!silent) {
          this.setData({ loading: true })
        }
      } else {
        this.setData({ loadingMore: true })
      }

      let newTopics = []
      let hasMore = false

      // 第一页优先直读预构建缓存集合（比 callFunction 快 100-300ms）
      if (page === 1) {
        try {
          const db = wx.cloud.database()
          const cacheRes = await db.collection('topics_cache').doc('v1').get()
          const cachedData = cacheRes && cacheRes.data
          if (cachedData && Array.isArray(cachedData.data) && cachedData.data.length > 0) {
            newTopics = cachedData.data.map(item => ({
              ...item,
              coverUrl: item.coverUrl || item.cover || ''
            }))
            // 缓存集合包含全部 active 专题，第一页后还有数据则标记 hasMore
            hasMore = cachedData.totalCount > this.data.pageSize
            performanceMonitor.markMilestone('专题页', 'topics_cache直读命中')
          }
        } catch (cacheErr) {
          // 缓存集合不存在或读取失败，降级到 callFunction
          console.warn('[专题页] topics_cache 直读失败，降级 callFunction:', cacheErr.errMsg || cacheErr.message)
        }
      }

      // 缓存未命中或分页：走 callFunction
      if (newTopics.length === 0) {
        const res = await wx.cloud.callFunction({
          name: 'getTopics',
          data: {
            status: 'active',
            page,
            pageSize: this.data.pageSize
          }
        })

        if (res.result && res.result.success) {
          newTopics = (res.result.data || []).map(item => ({
            ...item,
            coverUrl: item.coverUrl || item.cover || ''
          }))
          hasMore = res.result.hasMore !== undefined
            ? res.result.hasMore
            : (newTopics.length >= this.data.pageSize)
        } else {
          throw new Error(res.result?.message || res.result?.error || '加载失败')
        }
      }

      const finalRaw = reset ? newTopics : this._rawTopics.concat(newTopics)
      this._rawTopics = finalRaw

      this._processTopics(finalRaw)

      const updateData = { page, hasMore }
      if (reset) updateData.loading = false
      else updateData.loadingMore = false
      this.setData(updateData)

      // 缓存第一页
      if (page === 1 && newTopics.length > 0) {
        setStorage('topics_list_cache', {
          topics: newTopics,
          timestamp: Date.now()
        })
      }

      if (reset && !silent) {
        performanceMonitor.endPageLoad('专题页', { topicCount: finalRaw.length })
        const pageLoadTime = performanceMonitor.getPageLoadTime('专题页')
        if (pageLoadTime) {
          logger.logPerformance('page_load', {
            loadTime: pageLoadTime,
            topicCount: finalRaw.length
          }, 'pages/topics/topics')
        }
        logger.logPageView('pages/topics/topics')
      }
    } catch (err) {
      console.error('[专题页] 加载专题失败:', err)
      // 最终降级：尝试用本地 storage 缓存
      if (reset) {
        const fallback = getStorage('topics_list_cache')
        if (fallback && fallback.topics && fallback.topics.length > 0) {
          console.warn('[专题页] 网络失败，使用本地缓存降级')
          this._rawTopics = fallback.topics
          this._processTopics(fallback.topics)
          this.setData({ loading: false, hasMore: false })
          wx.showToast({ title: '使用缓存数据', icon: 'none' })
          return
        }
      }
      if (!silent) {
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
      this.setData({
        loading: false,
        loadingMore: false
      })
    } finally {
      wx.stopPullDownRefresh()
    }
  },

  // ===== 标签切换 =====
  onTagTap(e) {
    const tag = e.currentTarget.dataset.tag || ''
    const filteredTopics = this._filterByTag(this.data.topics, tag)
    this.setData({ activeTag: tag, filteredTopics })
  },

  // ===== 专题点击 =====
  onTopicTap(e) {
    const id = e.currentTarget.dataset.id
    if (!id) {
      wx.showToast({ title: '跳转失败', icon: 'none' })
      return
    }

    // 从列表数据中找到对应专题
    const topic = this.data.topics.find(t => (t.id || t._id) === id) || {}

    // 根据跳转类型路由
    const linkType = topic.linkType || 'resource'

    // 内部页面跳转
    if (linkType === 'page' && topic.linkUrl) {
      wx.navigateTo({
        url: topic.linkUrl,
        fail: () => {
          // switchTab 类页面（tabBar 页）navigateTo 会失败，降级 switchTab
          if (topic.linkUrl.startsWith('/pages/')) {
            wx.switchTab({
              url: topic.linkUrl,
              fail: () => wx.showToast({ title: '跳转失败', icon: 'none' })
            })
          } else {
            wx.showToast({ title: '跳转失败', icon: 'none' })
          }
        }
      })
      return
    }

    // 网页链接跳转（通过 webview 页面打开）
    if (linkType === 'webview' && topic.linkUrl) {
      wx.navigateTo({
        url: `/subpackages/webview/webview?url=${encodeURIComponent(topic.linkUrl)}&title=${encodeURIComponent(topic.title || '外部链接')}`,
        fail: () => wx.showToast({ title: '跳转失败', icon: 'none' })
      })
      return
    }

    // 默认：资源列表模式
    const params = {
      type: topic.resourceType || 'all',
      sort: topic.defaultSort || 'latest',
      title: topic.title || '',
      columns: topic.gridColumns || 3
    }

    // 手动选择模式：传 ids 参数，按指定资源ID列表展示
    if (Array.isArray(topic.manualIds) && topic.manualIds.length > 0) {
      params.ids = topic.manualIds.join(',')
    } else {
      // 自动筛选模式：传 tag/category 参数
      if (topic.filterType === 'tag') {
        params.tag = topic.filterValue || ''
      } else if (topic.filterType === 'category') {
        params.category = topic.filterValue || ''
      }
    }

    const query = Object.keys(params)
      .filter(k => params[k] !== '' && params[k] !== undefined)
      .map(k => `${k}=${encodeURIComponent(params[k])}`)
      .join('&')

    wx.navigateTo({
      url: `/subpackages/resource-list/resource-list?${query}`,
      fail: () => wx.showToast({ title: '跳转失败', icon: 'none' })
    })
  },

  navigateToSearch() {
    wx.navigateTo({ url: '/subpackages/search/search' })
  }
})
