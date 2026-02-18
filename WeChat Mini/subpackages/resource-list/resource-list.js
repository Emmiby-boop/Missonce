import { getResources, getCategories } from '../../utils/api.js'

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    
    // Params
    type: 'wallpaper', // wallpaper | avatar
    currentCategory: '',
    currentTag: 'all',
    currentSort: 'hot', // 默认按热门排序
    pageTitle: '资源列表',
    
    // Data
    list: [],
    tagList: [], // Optional tags if we want to allow filtering within the category
    
    // Pagination
    page: 1,
    pageSize: 15,
    loading: false,
    hasMore: true,
  },

  onLoad(options) {
    this.initNavBar()
    
    // 优先使用 options 中的 sort，如果没有则默认为 'hot'
    const { type = 'wallpaper', category = '', tag = 'all', sort = 'hot', title } = options
    
    this.setData({
      type,
      currentCategory: category,
      currentTag: tag,
      currentSort: sort,
      pageTitle: title || (type === 'avatar' ? '头像列表' : '壁纸精选')
    })

    // 加载标签列表
    this.loadNavTags()
    
    this.loadData()
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
    if (this.data.loading) return
    if (!reset && !this.data.hasMore) return

    this.setData({ loading: true })

    try {
      const page = reset ? 1 : this.data.page
      const { type, currentCategory, currentTag, currentSort, pageSize } = this.data
      
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
        res = { result: { success: true, data: orderedResources } }
      } else {
        const params = {
          type,
          page,
          pageSize
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
          tags: item.tags
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

  previewImage(e) {
    const item = e.currentTarget.dataset
    const { type, list } = this.data
    const currentUrl = item.url || item.originalUrl
    
    // 从 list 数组中找到完整的 item 对象（包含 _id）
    let fullItem = list.find(i => (i.url || i.originalUrl) === currentUrl)
    fullItem = fullItem || item
    
    if (type === 'avatar') {
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
