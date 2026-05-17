import { getResources, getCategories } from '../../utils/api.js'
import { fetchPageAds, pickByType } from '../../utils/adUtil.js'
import interstitialAdManager from '../../utils/interstitialAdManager.js'

Page({
  _isLoadingData: false,
  
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    
    // Params
    type: 'wallpaper', // wallpaper | avatar
    currentCategory: '',
    currentTag: 'all',
    currentSort: 'hot', // 默认按热门排序
    pageTitle: '资源列表',
    keyword: '',
    color: '',
    
    // Data
    list: [],
    tagList: [], // Optional tags if we want to allow filtering within the category
    
    // Pagination
    page: 1,
    pageSize: 15,
    loading: false,
    hasMore: true,
    nativeTopAd: null,
    showNativeTopAd: false,
    midNativeVideoAd: null,
    bottomNativeVideoAd: null,
    showBottomNativeAd: false,
  },

  onLoad(options) {
    this.initNavBar()
    
    // 初始化插屏广告管理器
    interstitialAdManager.initInterstitialAd('/subpackages/resource-list/resource-list')
    
    const decode = (val) => val ? decodeURIComponent(val) : ''
    
    // 优先使用 options 中的 sort，如果没有则默认为 'hot'
    const { type = 'wallpaper', category = '', tag = 'all', sort = 'hot', title, keyword = '', color = '' } = options
    
    const decodedKeyword = decode(keyword)
    const decodedColor = decode(color)
    const decodedCategory = decode(category)
    const decodedTitle = decode(title)
    
    // 智能识别标题
    let pageTitle = decodedTitle
    if (!pageTitle) {
      if (decodedKeyword) {
        pageTitle = decodedKeyword
      } else if (decodedColor) {
        pageTitle = `${decodedColor}系`
      } else if (decodedCategory) {
        pageTitle = decodedCategory
      } else if (type === 'avatar') {
        pageTitle = '头像列表'
      } else {
        pageTitle = '壁纸精选'
      }
    }
    
    // 保存原始标题，用于类型切换时重新生成
    const originalTitle = pageTitle
    
    this.setData({
      type,
      currentCategory: decodedCategory,
      currentTag: tag,
      currentSort: sort,
      keyword: decodedKeyword,
      color: decodedColor,
      pageTitle,
      originalTitle,
      list: [],
      page: 1,
      hasMore: true,
      loading: false
    })

    // 只有非搜索模式下才加载标签列表
    if (!decodedKeyword && !decodedColor) {
      this.loadNavTags()
    }
    
    this.loadData(true)
    this.loadPageAds()
  },
  
  onReachBottom() {
    if (!this.data.showBottomNativeAd && this.data.bottomNativeVideoAd && this.data.bottomNativeVideoAd.adUnitId) {
      this.setData({ showBottomNativeAd: true })
    }
  },
  
  async loadPageAds() {
    try {
      const pages = getCurrentPages()
      const current = pages && pages.length ? pages[pages.length - 1] : null
      const route = current?.route || 'subpackages/resource-list/resource-list'
      const list = await fetchPageAds(route.startsWith('/') ? route : '/' + route)
      let nativeTop = pickByType(list, 'native_top')[0] || null
      if (!nativeTop) {
        const topNativeVideo = (list || []).find(it => it.type === 'native_video' && it.position === 'top' && it.isEnable)
        if (topNativeVideo) nativeTop = topNativeVideo
      }
      if (nativeTop) this.setData({ nativeTopAd: nativeTop })
      const midNativeVideo = (list || []).find(it => it.type === 'native_video' && it.position === 'middle' && it.isEnable)
      const nativeBottom = pickByType(list, 'native_bottom')[0] || null
      const bottomNativeVideo = (list || []).find(it => it.type === 'native_video' && (it.position === 'bottom' || !it.position) && it.isEnable)
      const chosenBottom = nativeBottom || bottomNativeVideo
      if (midNativeVideo) this.setData({ midNativeVideoAd: midNativeVideo })
      if (chosenBottom) this.setData({ bottomNativeVideoAd: chosenBottom })
    } catch (e) {}
  },
  
  onPageScroll(e) {
    const ad = this.data.nativeTopAd
    const threshold = (ad && ad.scrollThreshold) || 200
    const shouldShow = e.scrollTop >= threshold
    if (shouldShow !== this.data.showNativeTopAd) {
      this.setData({ showNativeTopAd: shouldShow })
    }
    // 滚动时智能触发插屏广告（带冷却与防抖）
    interstitialAdManager.smartTriggerInterstitialAd(1500)
  },
  
  onShow() {
    // 页面显示时智能触发插屏广告（带冷却时间检查）
    interstitialAdManager.smartTriggerInterstitialAd(2000)
  },
  
  onNativeAdError() {
    if (this.data.showNativeTopAd) {
      this.setData({ showNativeTopAd: false })
    }
  },

  async loadNavTags() {
    try {
      const { type } = this.data
      if (type === 'likes') {
        this.setData({ tagList: [] })
        return
      }
      const res = await getCategories({ type, source: 'tags' })
      
      if (res.result.success) {
        const fetchedTags = res.result.data || []
        
        // 优先级排序逻辑 (保留原 dynamic-avatar 的体验)
        let sortedTags = fetchedTags
        if (type === 'avatar') {
          const priorityTags = ['女生', '男生', '动漫', '游戏']
          const pList = []
          const oList = []
          
          fetchedTags.forEach(tag => {
            if (priorityTags.includes(tag.name)) {
              pList.push(tag)
            } else {
              oList.push(tag)
            }
          })
          
          // 按优先级顺序排序
          pList.sort((a, b) => priorityTags.indexOf(a.name) - priorityTags.indexOf(b.name))
          sortedTags = [...pList, ...oList]
        }
        
        // 过滤掉重复的 'all'
        sortedTags = sortedTags.filter(t => t.id !== 'all' && t.name !== '全部')
        
        this.setData({
          tagList: [{ id: 'all', name: '全部' }, ...sortedTags]
        })
      }
    } catch (error) {
      console.error('加载标签失败:', error)
    }
  },

  onTypeChange(e) {
    const type = e.currentTarget.dataset.type
    if (type === this.data.type) return
    
    this.setData({
      type,
      list: [],
      page: 1,
      hasMore: true,
      loading: false
    }, () => {
      if (!this.data.keyword && !this.data.color) {
        this.loadNavTags()
      }
      this.loadData(true)
    })
  },

  onTagChange(e) {
    const tag = e.currentTarget.dataset.tag
    if (tag === this.data.currentTag) return
    
    this.setData({
      currentTag: tag,
      list: [],
      page: 1,
      hasMore: true,
      loading: false
    }, () => {
      this.loadData()
    })
  },

  onSortChange(e) {
    const sort = e.currentTarget.dataset.type
    if (sort === this.data.currentSort) return
    
    this.setData({
      currentSort: sort,
      list: [],
      page: 1,
      hasMore: true,
      loading: false
    }, () => {
      this.loadData()
    })
  },

  initNavBar() {
    try {
      const info = wx.getWindowInfo()
      const statusBarHeight = info.statusBarHeight || 20
      const navBarHeight = 44 // Fixed 44px
      this.setData({ statusBarHeight, navBarHeight })
    } catch (e) {
      console.error('获取系统信息失败:', e)
      this.setData({ statusBarHeight: 20, navBarHeight: 44 })
    }
  },

  navigateBack() {
    wx.navigateBack()
  },

  async loadData(reset = false) {
    if (this._isLoadingData) return
    if (!reset && !this.data.hasMore) return
    
    this._isLoadingData = true
    this.setData({ loading: true })

    try {
      const page = reset ? 1 : this.data.page
      const { type, currentCategory, currentTag, currentSort, pageSize, keyword, color } = this.data
      
      let res;
      if (type === 'likes') {
        // 加载点赞列表
        const db = wx.cloud.database()
        const openid = wx.getStorageSync('openid')
        if (!openid) {
          this.setData({ loading: false, hasMore: false })
          return
        }

        const likesRes = await db.collection('likes')
          .where({ _openid: openid })
          .orderBy('createTime', 'desc')
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .get()
        
        const resourceIds = likesRes.data.map(l => l.resourceId)
        if (resourceIds.length === 0) {
          this.setData({
            list: reset ? [] : this.data.list,
            hasMore: false,
            loading: false
          })
          return
        }

        const _ = db.command
        const resourcesRes = await db.collection('resources')
          .where({ _id: _.in(resourceIds) })
          .get()
        
        // 保持点赞顺序
        const orderedResources = resourceIds.map(id => resourcesRes.data.find(r => r._id === id)).filter(Boolean)
        // 确保有 type 字段
        orderedResources.forEach(item => {
          if (!item.id) item.id = item._id
          if (!item.type) item.type = item.type || 'wallpaper'
        })
        res = { result: { success: true, data: orderedResources } }
      } else {
        const params = {
          type,
          page,
          pageSize,
          includeMeta: false  // 🔥 优化：不需要分类标签，减少查询
        }

        if (keyword) {
          params.keyword = keyword
        }
        
        if (color) {
          params.color = color
        }
        
        if (currentCategory) {
          params.category = currentCategory
        }
        
        if (currentTag && currentTag !== 'all') {
          params.tag = currentTag
        }

        if (currentSort) {
          params.sort = currentSort
        }

        res = await getResources(params)
      }
      
      if (res.result.success) {
        const rawList = res.result.data || []
        
        // 批量获取临时链接
        const fileList = []
        rawList.forEach(item => {
          if (item.coverUrl && !item.coverUrl.startsWith('http')) fileList.push(item.coverUrl)
          if (item.originUrl && !item.originUrl.startsWith('http')) fileList.push(item.originUrl)
        })
        
        const uniqueFileList = [...new Set(fileList)]
        const urlMap = new Map()
        
        if (uniqueFileList.length > 0) {
          try {
            const tempRes = await wx.cloud.getTempFileURL({ fileList: uniqueFileList })
            tempRes.fileList.forEach(f => {
              urlMap.set(f.fileID, f.tempFileURL)
            })
          } catch (err) {
            console.error('批量获取图片链接失败', err)
          }
        }
        
        const newData = rawList.map(item => ({
          id: item.id || item._id,
          url: item.coverUrl && !item.coverUrl.startsWith('http') ? (urlMap.get(item.coverUrl) || item.coverUrl) : item.coverUrl,
          originalUrl: item.originUrl && !item.originUrl.startsWith('http') ? (urlMap.get(item.originUrl) || item.originUrl) : item.originUrl,
          rawUrl: item.coverUrl,
          rawOriginalUrl: item.originUrl,
          title: item.title,
          categories: item.categories,
          tags: item.tags,
          type: item.type
        }))

        this.setData({
          list: reset ? newData : [...this.data.list, ...newData],
          page: page + 1,
          hasMore: rawList.length === pageSize,
          loading: false
        })
      } else {
        this.setData({ loading: false })
      }
    } catch (error) {
      console.error('加载资源失败:', error)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this._isLoadingData = false
    }
  },

  onReachBottom() {
    this.loadData()
  },

  onPullDownRefresh() {
    this.loadData(true).then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onWaterfallItemTap(e) {
    const item = e.detail.item
    this.previewImage({ currentTarget: { dataset: item } })
  },

  previewImage(e) {
    const item = e.currentTarget.dataset
    const { list } = this.data
    const currentUrl = item.url || item.originalUrl
    
    // 从 list 数组中找到完整的 item 对象（包含 _id）
    let fullItem = list.find(i => (i.url || i.originalUrl) === currentUrl)
    fullItem = fullItem || item
    const itemType = fullItem.type || 'wallpaper'
    
    if (itemType === 'avatar') {
        wx.navigateTo({
            url: `/subpackages/preview/preview?url=${encodeURIComponent(fullItem.url)}&rawUrl=${encodeURIComponent(fullItem.rawUrl)}&isAvatar=true&avatarData=${encodeURIComponent(JSON.stringify(fullItem))}`
        })
    } else {
        const currentIndex = list.findIndex(i => (i.url || i.originalUrl) === currentUrl)
        
        // Construct imageList, limit size to prevent URL overflow if list is too large
        // We take a window around the current index, e.g., 50 items
        const windowSize = 50
        const start = Math.max(0, currentIndex - windowSize / 2)
        const end = Math.min(list.length, start + windowSize)
        const subList = list.slice(start, end)
        const subCurrentIndex = currentIndex - start
        
        const imageList = subList.map(i => i.originalUrl || i.url)
        
        wx.navigateTo({
            url: `/subpackages/wallpaper-preview/wallpaper-preview?url=${encodeURIComponent(fullItem.url)}&rawUrl=${encodeURIComponent(fullItem.rawUrl || '')}&currentIndex=${subCurrentIndex}&imageList=${encodeURIComponent(JSON.stringify(imageList))}&wallpaperData=${encodeURIComponent(JSON.stringify(fullItem))}`
        })
    }
  }
})
