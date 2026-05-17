Component({
  properties: {
    list: {
      type: Array,
      value: [],
      observer: function(newVal) {
        this.distributeItems(newVal)
      }
    },
    type: {
      type: String,
      value: 'wallpaper' // wallpaper | avatar
    },
    columnCount: {
      type: Number,
      value: 2,
      observer: function(newVal) {
        if (this.data.list && this.data.list.length > 0) {
          this.distributeItems(this.data.list)
        }
      }
    },
    // 壁纸模式：固定2列但保持瀑布流高度
    layoutMode: {
      type: String,
      value: 'auto' // auto: 自适应, fixed: 固定2列9:16
    },
    useAdaptive: {
      type: Boolean,
      value: false
    }
  },

  data: {
    columns: [],
    processedCount: 0
  },

  lifetimes: {
    attached() {
      if (this.data.useAdaptive) {
        this.initAdaptive()
        // Listen to window resize
        this._resizeHandler = (res) => {
          this.initAdaptive()
        }
        wx.onWindowResize(this._resizeHandler)
      }
    },
    detached() {
      if (this._resizeHandler) {
        wx.offWindowResize(this._resizeHandler)
      }
    }
  },

  methods: {
    initAdaptive() {
      const query = this.createSelectorQuery()
      query.select('.waterfall-container').boundingClientRect((rect) => {
        if (rect && rect.width) {
          this.calculateOptimalColumns(rect.width)
        }
      }).exec()
    },

    calculateOptimalColumns(containerWidth) {
      // 固定2列模式（用于壁纸页面）
      if (this.data.layoutMode === 'fixed') {
        if (this.data.columnCount !== 2) {
          this.setData({ columnCount: 2 })
        }
        return
      }
      
      // 头像类型使用自适应列数
      const minColWidth = this.data.type === 'avatar' ? 90 : 160 // px
      const gap = 10 // approximate gap in px
      
      // Calculate max possible columns
      // width = count * colWidth + (count - 1) * gap
      let count = Math.floor((containerWidth + gap) / (minColWidth + gap))
      
      // Clamp between 2 and 4
      count = Math.max(2, Math.min(count, 4))
      
      if (count !== this.data.columnCount) {
        this.setData({ columnCount: count })
      }
    },

    distributeItems(list) {
      if (!list) return
      
      const count = this.data.columnCount
      const processedCount = this.data.processedCount
      
      // Case 1: 列表被重置或减少 (如下拉刷新)
      // 如果 list.length < processedCount，说明列表变短了，必须全量重排
      // 如果 list.length === processedCount 但内容变了（这种情况很难检测，除非比较），
      // 这里假设长度没变就不变，或者为了安全，长度变小才重置。
      // 实际上，为了支持“重新加载”，如果 list.length <= processedCount 且不是 0，我们也应该重排，
      // 除非我们能确定是同一个列表。
      // 简化逻辑：如果长度小于等于已处理长度，视为重置（因为加载更多肯定是变长）。
      // 唯一的特例是：加载更多失败，长度不变。此时重排也没事。
      if (list.length <= processedCount) {
         this.fullDistribute(list, count)
         return
      }

      // Case 2: 加载更多 (增量更新)
      const newItems = list.slice(processedCount)
      this.incrementalDistribute(newItems, count, processedCount)
    },

    fullDistribute(list, count) {
      const columns = Array.from({ length: count }, () => [])
      
      // 固定2列模式：简单左右交替分配
      if (this.data.layoutMode === 'fixed') {
        list.forEach((item, index) => {
          const colIndex = index % count
          columns[colIndex].push(item)
        })
        this.setData({
          columns,
          processedCount: list.length
        })
        return
      }
      
      const columnHeights = Array(count).fill(0)
      
      // 直接处理列表，找到最小高度列分配
      list.forEach((item) => {
        const isAvatar = item.resourceType === 'avatar' || item.type === 'avatar'
        const itemHeight = isAvatar ? 1 : 2
        
        // 找到当前高度最小的列
        let minHeight = columnHeights[0]
        let minIndex = 0
        for (let i = 1; i < count; i++) {
          if (columnHeights[i] < minHeight) {
            minHeight = columnHeights[i]
            minIndex = i
          }
        }
        
        columns[minIndex].push(item)
        columnHeights[minIndex] += itemHeight
      })
      
      this.setData({
        columns,
        processedCount: list.length
      })
    },

    incrementalDistribute(newItems, count, startIndex) {
      let columns = this.data.columns
      // 确保columns数组存在且每个元素都是数组
      if (!columns || !Array.isArray(columns)) {
        columns = Array.from({ length: count }, () => [])
      } else {
        // 确保每个列都是数组
        for (let i = 0; i < count; i++) {
          if (!columns[i] || !Array.isArray(columns[i])) {
            columns[i] = []
          }
        }
      }
      
      // 固定2列模式：简单左右交替分配
      if (this.data.layoutMode === 'fixed') {
        newItems.forEach((item, index) => {
          const colIndex = (startIndex + index) % count
          if (!columns[colIndex]) {
            columns[colIndex] = []
          }
          columns[colIndex].push(item)
        })
        this.setData({
          columns,
          processedCount: startIndex + newItems.length
        })
        return
      }
      
      const columnHeights = columns.map(col => {
        let height = 0
        if (col && Array.isArray(col)) {
          col.forEach(item => {
            const isAvatar = item.resourceType === 'avatar' || item.type === 'avatar'
            height += isAvatar ? 1 : 2
          })
        }
        return height
      })
      
      newItems.forEach((item) => {
        // 计算项目高度
        const isAvatar = item.resourceType === 'avatar' || item.type === 'avatar'
        const itemHeight = isAvatar ? 1 : 2
        
        // 找到当前高度最小的列
        let minHeight = columnHeights[0]
        let minIndex = 0
        for (let i = 1; i < count; i++) {
          if (columnHeights[i] < minHeight) {
            minHeight = columnHeights[i]
            minIndex = i
          }
        }
        
        // 将项目分配到最小高度的列
        if (!columns[minIndex]) {
          columns[minIndex] = []
        }
        columns[minIndex].push(item)
        columnHeights[minIndex] += itemHeight
      })
      
      this.setData({
        columns,
        processedCount: startIndex + newItems.length
      })
    },

    onItemTap(e) {
      const item = e.currentTarget.dataset.item
      this.triggerEvent('itemtap', { item })
    }
  }
})