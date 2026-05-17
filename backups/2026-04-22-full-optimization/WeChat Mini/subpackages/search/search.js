import { getResources, getCategories } from '../../utils/api.js'
import { fetchPageAds, pickByType } from '../../utils/adUtil.js'

Page({
  data: {
    searchValue: '',
    searchResult: [],
    searchType: 'all', // all, wallpaper, avatar
    showResult: false,
    categories: [],
    historyTags: [],
    hotTags: ['星空壁纸', '简约头像', '游戏壁纸', '女生头像'],
    page: 1,
    pageSize: 30,
    loading: false,
    hasMore: true,
    lastParams: null,
    
    // Filters
    activeColor: '',
    activeStyle: '',
    filterColors: [
      { name: '红色', value: '#FF4D4F' },
      { name: '橙色', value: '#FFA940' },
      { name: '黄色', value: '#FFC53D' },
      { name: '绿色', value: '#73D13D' },
      { name: '青色', value: '#36CFC9' },
      { name: '蓝色', value: '#40A9FF' },
      { name: '紫色', value: '#9254DE' },
      { name: '粉色', value: '#F759AB' },
      { name: '黑色', value: '#262626' },
      { name: '白色', value: '#FFFFFF' }
    ],
    filterStyles: ['简约', '小清新', '插画', '二次元', '治愈系', '高级感', '极简', '唯美'],
    bottomNativeVideoAd: null,
    showBottomNativeAd: false
  },

  onLoad(options) {
    this.loadCategories()
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
  
  async loadPageAds() {
    try {
      const pages = getCurrentPages()
      const current = pages && pages.length ? pages[pages.length - 1] : null
      const route = current?.route || 'subpackages/search/search'
      const list = await fetchPageAds(route.startsWith('/') ? route : '/' + route)
      const nativeBottom = pickByType(list, 'native_bottom')[0] || null
      const bottomNativeVideo = (list || []).find(it => it.type === 'native_video' && (it.position === 'bottom' || !it.position) && it.isEnable) || null
      const chosenBottom = nativeBottom || bottomNativeVideo
      // 确保广告显示
      this.setData({ 
        bottomNativeVideoAd: chosenBottom || {}, 
        showBottomNativeAd: true 
      })
    } catch (e) {
      // 即使出错也显示广告
      this.setData({ showBottomNativeAd: true })
    }
  },

  loadHistory() {
    const history = wx.getStorageSync('searchHistory') || []
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
    wx.setStorageSync('searchHistory', history)
  },

  clearHistory() {
    wx.showModal({
      title: '提示',
      content: '确定要清空搜索历史吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ historyTags: [] })
          wx.removeStorageSync('searchHistory')
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
    const theme = wx.getAppBaseInfo().theme || 'light'
    this.setData({ theme })
  },

  onColorTap(e) {
    const color = e.currentTarget.dataset.color
    const activeColor = this.data.activeColor === color ? '' : color
    this.setData({ activeColor })
    this.performSearch(activeColor || this.data.searchValue)
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
    
    if (!cleanKeyword && !this.data.activeColor && !this.data.activeStyle) {
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
      color: this.data.activeColor,
      style: this.data.activeStyle
    })

    // 跳转到资源列表页面
    let url = `/subpackages/resource-list/resource-list?type=${this.data.searchType}`
    if (cleanKeyword) {
      url += `&keyword=${encodeURIComponent(cleanKeyword)}`
    }
    if (this.data.activeColor) {
      const colorMap = {
        '#FF4D4F': '红色',
        '#FFA940': '橙色',
        '#FFC53D': '黄色',
        '#73D13D': '绿色',
        '#36CFC9': '青色',
        '#40A9FF': '蓝色',
        '#9254DE': '紫色',
        '#F759AB': '粉色',
        '#262626': '黑色',
        '#FFFFFF': '白色'
      }
      url += `&color=${encodeURIComponent(colorMap[this.data.activeColor])}`
    }
    if (this.data.activeStyle && !cleanKeyword) {
      url += `&keyword=${encodeURIComponent(this.data.activeStyle)}`
    }
    wx.navigateTo({ url })
  },

  async appendSearchData(res) {
    const slice = await Promise.all(
      (res.result.data || []).map(async (item) => {
        const url = await this.resolveUrl(item.coverUrl)
        const originalUrl = await this.resolveUrl(item.originUrl)
        return {
          id: item.id,
          title: item.title,
          url,
          originalUrl,
          type: item.type,
          categories: item.categories,
          tags: item.tags
        }
      })
    )
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
        url: `/subpackages/wallpaper-preview/wallpaper-preview?url=${encodeURIComponent(item.originalUrl)}&rawUrl=${encodeURIComponent(item.rawOriginalUrl || '')}&currentIndex=${currentIndex}&imageList=${encodeURIComponent(JSON.stringify(imageList))}&wallpaperData=${encodeURIComponent(JSON.stringify(item))}`
      })
    } else if (item.type === 'avatar') {
      wx.navigateTo({
        url: `/subpackages/preview/preview?url=${encodeURIComponent(item.originalUrl)}&rawUrl=${encodeURIComponent(item.rawOriginalUrl || '')}&isAvatar=true&currentIndex=${currentIndex}&imageList=${encodeURIComponent(JSON.stringify(imageList))}&avatarData=${encodeURIComponent(JSON.stringify(item))}`
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
  
  onNativeAdError() {
    if (this.data.showBottomNativeAd) {
      this.setData({ showBottomNativeAd: false })
    }
  }
})
