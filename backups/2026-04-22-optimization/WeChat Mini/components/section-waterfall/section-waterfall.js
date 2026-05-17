// section-waterfall 组件
Component({
  properties: {
    title: String,
    list: Array,
    columnCount: { type: Number, value: 2 },
    type: { type: String, value: 'wallpaper' }, // avatar 或 wallpaper
    layoutMode: { type: String, value: 'adaptive' }, // adaptive 或 fixed
    showMore: { type: Boolean, value: true },
    moreUrl: String
  },
  data: {
    columns: [],
    visible: true
  },
  observers: {
    'list': function(list) {
      if (list && list.length > 0) {
        this.layoutItems(list)
      }
    }
  },
  lifetimes: {
    attached: function() {
      if (this.data.list && this.data.list.length > 0) {
        this.layoutItems(this.data.list)
      }
    }
  },
  methods: {
    layoutItems(list) {
      const columns = Array(this.data.columnCount).fill().map(() => [])
      const columnHeights = Array(this.data.columnCount).fill(0)

      list.forEach((item, index) => {
        const minHeightIndex = columnHeights.indexOf(Math.min(...columnHeights))
        columns[minHeightIndex].push(item)
        
        // 简单估算高度
        if (this.data.type === 'avatar') {
          columnHeights[minHeightIndex] += 300 // 假设头像高度
        } else {
          columnHeights[minHeightIndex] += 400 // 假设壁纸高度
        }
      })

      this.setData({ columns })
    },
    onMoreTap() {
      if (this.properties.moreUrl) {
        wx.navigateTo({
          url: this.properties.moreUrl
        })
      }
      this.triggerEvent('moretap')
    },
    onItemTap(e) {
      const { column, index } = e.currentTarget.dataset
      const item = this.data.columns[column][index]
      this.triggerEvent('itemtap', { item, column, index })
    }
  }
})