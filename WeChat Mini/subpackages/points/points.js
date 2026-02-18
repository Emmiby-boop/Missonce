Page({
  data: {
    activeTab: 'records',
    points: 0,
    totalPoints: 0,
    records: [],
    loading: true,
    loadingMore: false,
    hasMore: true,
    page: 1
  },

  onLoad() {
    this.loadUserInfo()
    this.loadRecords()
  },

  onShow() {
    this.loadUserInfo()
  },

  goBack() {
    wx.navigateBack()
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    
    if (tab === 'records' && this.data.records.length === 0) {
      this.loadRecords()
    }
  },

  async loadUserInfo() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { action: 'getUserInfo' }
      })

      if (res.result.success) {
        const data = res.result.data
        this.setData({
          points: data.points,
          totalPoints: data.totalPoints
        })
      }
    } catch (e) {
      console.error('加载用户信息失败:', e)
    }
  },

  async loadRecords() {
    this.setData({ loading: true, page: 1, records: [] })
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { 
          action: 'getRecords',
          page: 1,
          limit: 20
        }
      })

      if (res.result.success) {
        this.setData({
          records: res.result.data,
          hasMore: res.result.hasMore,
          page: 1
        })
      }
    } catch (e) {
      console.error('加载记录失败:', e)
    } finally {
      this.setData({ loading: false })
    }
  },

  async loadMore() {
    if (this.data.loadingMore || !this.data.hasMore) return

    this.setData({ loadingMore: true })
    
    try {
      const nextPage = this.data.page + 1
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { 
          action: 'getRecords',
          page: nextPage,
          limit: 20
        }
      })

      if (res.result.success) {
        this.setData({
          records: [...this.data.records, ...res.result.data],
          hasMore: res.result.hasMore,
          page: nextPage
        })
      }
    } catch (e) {
      console.error('加载更多失败:', e)
    } finally {
      this.setData({ loadingMore: false })
    }
  },

  formatTime(dateStr) {
    if (!dateStr) return ''
    
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    
    return `${year}-${month}-${day} ${hours}:${minutes}`
  }
})
