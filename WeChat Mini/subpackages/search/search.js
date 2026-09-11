import { getResources, getCategories } from '../../utils/api.js'
import { fetchPageAds, pickByType } from '../../utils/adUtil.js'
import { getStorage, getTheme, setStorage, getWindowInfo } from '../../utils/storageManager.js'

Page({
  data: {
    searchValue: '',
    searchResult: [],
    searchType: 'all', // all, wallpaper, avatar
    showResult: false,
    categories: [],
    historyTags: [],
    hotTags: [],
    page: 1,
    pageSize: 30,
    loading: false,
    hasMore: true,
    lastParams: null,

    // Filters
    activeStyle: '',
    filterStyles: ['简约', '小清新', '插画', '二次元', '治愈系', '高级感', '极简', '唯美'],
    bottomNativeVideoAd: null,
    showBottomNativeAd: false,
    statusBarHeight: 20,
    navBarHeight: 44
  },

  onLoad(options) {
    const info = getWindowInfo()
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      navBarHeight: 44
    })
    this.loadCategories()
    this.loadHotTags()
    this.loadHistory()
    this.loadPageAds()

    if (options) {
      const updates = {}
      if (options.type) {
        updates.searchType = options.type
      }
      if (options.tag) {
        updates.searchValue = decodeURIComponent(options.tag)
        this.setData(updates, () => {
          if (this.data.searchValue) this.performSearch(this.data.searchValue)
        })
        return
      }
      if (Object.keys(updates).length) {
        this.setData(updates)
      }
    }
  },

  // 动态加载热门标签（优先从缓存读取，后端可通过 sys_config 热更新）
  async loadHotTags() {
    const cached = getStorage('search_hot_tags')
    if (cached && Array.isArray(cached)) {
      this.setData({ hotTags: cached })
      return
    }
    // 从分类中提取热门标签
    try {
      const cats = await getCategories()
      if (cats && cats.length > 0) {
        const tags = cats.slice(0, 8).map(c => c.name || c.key)
        this.setData({ hotTags: tags })
        setStorage('search_hot_tags', tags)
        return
      }
    } catch (e) { /* fall through */ }
    // 兜底
    const fallback = ['星空壁纸', '简约头像', '游戏壁纸', '女生头像']
    this.setData({ hotTags: fallback })
    setStorage('search_hot_tags', fallback)
  },

    async loadPageAds() {
    try {
      const pages = getCurrentPages()
      const current = pages && pages.length ? pages[pages.length - 1] : null
      const route = current?.route || 'subpackages/search/search'
      const list = await fetchPageAds(route.startsWith('/') ? route : '/' + route)
      const nativeBottom = pickByType(list, 'native_bottom')[0] || null
      const bottomNativeVideo = (list || []).find(it => it.type === 'native_video' && (it.position === 'bottom' || !it.position) && it.isEnable) || null
      const chosenBottom = nativeBottom || bottomNativeVideo
      if (chosenBottom) {
        this.setData({ 
          bottomNativeVideoAd: chosenBottom, 
          showBottomNativeAd: true 
        })
      }
    } catch (e) {
      console.error('[search] 加载底部广告失败:', e)
    }
  },

  loadHistory() {
    const history = getStorage('searchHistory') || []
    this.setData({ historyTags: history })
  },

  saveHistory(keyword) {
    let history = this.data.historyTags
    // 移除已存在的相同关键词
    history = history.filter(item => item !== keyword)
    // 添加到头部
    history.unshift(keyword)
    // 最多保留10条
    if (history.length > 10) {
      history = history.slice(0, 10)
    }
    this.setData({ historyTags: history })
    setStorage('searchHistory', history)
  },

  clearHistory() {
    wx.showModal({
      title: '提示',
      content: '确定要清空搜索历史吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ historyTags: [] })
          wx.removeStorage({ key: 'searchHistory' })
        }
      }
    })
  },

  onTagTap(e) {
    const keyword = e.currentTarget.dataset.keyword
    this.setData({ searchValue: keyword })
    this.performSearch(keyword)
  },

  onShow() {
    this.syncTheme()
  },

  syncTheme() {
    const theme = getTheme()
    this.setData({ theme })
  },

  onStyleTap(e) {
    const style = e.currentTarget.dataset.style
    const activeStyle = this.data.activeStyle === style ? '' : style
    this.setData({ activeStyle })
    this.performSearch(activeStyle || this.data.searchValue)
  },

  async loadCategories() {
    try {
      // 搜索页也直接从资源标签中读取
      const res = await getCategories({ type: 'all', source: 'tags' })
      if (res.result.success) {
        this.setData({
          categories: res.result.data
        })
      }
    } catch (error) {
      console.error('加载标签失败:', error)
    }
  },

  onSearchInput(e) {
    this.setData({
      searchValue: e.detail.value
    })
  },

  onSearchConfirm(e) {
    const keyword = e.detail.value || this.data.searchValue
    if (!keyword.trim()) {
      wx.showToast({
        title: '请输入关键词',
        icon: 'none'
      })
      return
    }

    this.performSearch(keyword)
  },

  async performSearch(keyword) {
    const cleanKeyword = (keyword || this.data.searchValue || '').trim()

    if (!cleanKeyword && !this.data.activeStyle) {
      return
    }

    // 保存搜索历史（只有有关键词时才保存）
    if (cleanKeyword) {
      this.saveHistory(cleanKeyword)
    }

    // 埋点统计
    getApp().logEvent('search', { 
      keyword: cleanKeyword, 
      type: this.data.searchType,
      style: this.data.activeStyle
    })

    // 跳转到资源列表页面
    let url = `/subpackages/resource-list/resource-list?type=${this.data.searchType}`
    if (cleanKeyword) {
      url += `&keyword=${encodeURIComponent(cleanKeyword)}`
    }
    if (this.data.activeStyle && !cleanKeyword) {
      url += `&keyword=${encodeURIComponent(this.data.activeStyle)}`
    }
    wx.navigateTo({ url })
  },

  async appendSearchData(res) {
    // 直接使用原始 URL，cloud:// 由 image 组件原生处理，无需逐条 getTempFileURL
    const slice = (res.result.data || []).map(item => ({
      id: item.id,
      title: item.title,
      url: item.coverUrl,
      originalUrl: item.originUrl || item.coverUrl,
      type: item.type,
      categories: item.categories,
      tags: item.tags
    }))
    const nextList = (this.data.searchResult || []).concat(slice)
    this.setData({
      searchResult: nextList,
      showResult: true,
      loading: false,
      hasMore: res.result.hasMore === true,
      page: this.data.page + 1
    })
    if (nextList.length === 0) {
      wx.showToast({
        title: '没有找到相关内容',
        icon: 'none'
      })
    }
  },

  onTypeChange(e) {

    const type = e.currentTarget.dataset.type
    this.setData({
      searchType: type
    })
  },

  async loadMore() {
    if (!this.data.hasMore || this.data.loading || !this.data.lastParams) return
    this.setData({ loading: true })
    try {
      const params = {
        ...this.data.lastParams,
        page: this.data.page,
        pageSize: this.data.pageSize
      }
      const res = await getResources(params)
      if (res.result && res.result.success) {
        await this.appendSearchData(res)
      } else {
        this.setData({ loading: false, hasMore: false })
      }
    } catch (e) {
      console.error('加载更多失败:', e)
      this.setData({ loading: false })
    }
  },

  async resolveUrl(value) {
    if (!value) return ''
    if (/^https?:\/\//i.test(value)) return value
    if (value.startsWith('cloud://')) {
      try {
        const res = await wx.cloud.getTempFileURL({ fileList: [value] })
        return res.fileList?.[0]?.tempFileURL || ''
      } catch (e) {
        console.error('获取临时文件URL失败:', value, e)
        return ''
      }
    }
    return value
  },

  previewImage(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.searchResult[index]
    if (!item) return

    const currentIndex = index
    const imageList = this.data.searchResult.map(i => i.originalUrl)

    if (item.type === 'wallpaper') {
      wx.navigateTo({
        url: `/subpackages/wallpaper-preview/wallpaper-preview?url=${encodeURIComponent(item.originalUrl)}&rawUrl=${encodeURIComponent(item.rawOriginalUrl || '')}&id=${item._id || item.id || ''}`
      })
    } else if (item.type === 'avatar') {
      wx.navigateTo({
        url: `/subpackages/preview/preview?url=${encodeURIComponent(item.originalUrl)}&rawUrl=${encodeURIComponent(item.rawOriginalUrl || '')}&isAvatar=true&id=${item._id || item.id || ''}`
      })
    } else {
      wx.previewImage({
        urls: imageList,
        current: item.originalUrl
      })
    }
  },

  clearSearch() {
    this.setData({
      searchValue: '',
      searchResult: [],
      showResult: false
    })
  },

  goBack() {
    wx.navigateBack()
  },

  onReachBottom() {
    if (this.data.showResult) {
      this.loadMore()
    }
  },

  onPageScroll(e) {
    // 🔥 预加载：距底部约 2 屏时提前加载
    if (!this.data.showResult || this.data.loading || !this.data.hasMore) return
    const now = Date.now()
    if (this._lastPrefetchTime && now - this._lastPrefetchTime < 500) return
    const { windowHeight } = getWindowInfo()
    if (e.scrollHeight - e.scrollTop - windowHeight < windowHeight * 2) {
      this._lastPrefetchTime = now
      this.loadMore()
    }
  },

  onNativeAdError() {
    if (this.data.showBottomNativeAd) {
      this.setData({ showBottomNativeAd: false })
    }
  }
})
