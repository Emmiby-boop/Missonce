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
        // 🔥 P0-3 列数变化时重新计算列宽
        this._refreshColWidth(newVal)
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
    },
    // 🔥 P0-3 虚拟滚动开关：项数 > 30 时才真正启用窗口化
    // ⚠️ 当前所有调用方（pages/index, subpackages/resource-list, subpackages/daily-picks）
    //    都设为 false。代码骨架保留以便未来启用 — 启用时需先解决"瀑布流项高度不一致"
    //    的占位符高度问题（见 _updateVisibleRange 注释），否则会导致 scrollTop 跳变。
    enableVirtualScroll: {
      type: Boolean,
      value: false
    }
  },

  data: {
    columns: [],
    processedCount: 0,
    // 🔥 P0-3 虚拟滚动相关（当前未启用，保留以便未来启用 — 见 _updateVisibleRange 注释）
    visibleStart: 0,   // 可见区间起始索引（列内索引）
    visibleEnd: 999,   // 可见区间结束索引
    colWidth: 187,     // 列宽（px），attached 时计算，供 wxs 计算占位符高度
    windowHeight: 600  // 窗口高度（px），attached 时计算
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
      // 🔥 P0-3 计算列宽和窗口高度供虚拟滚动使用
      this._refreshColWidth(this.data.columnCount)
      try {
        const sysInfo = wx.getWindowInfo()
        this.setData({ windowHeight: sysInfo.windowHeight || 600 })
      } catch (e) {}
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

    // 分离广告卡片和其他卡片
    // 注：广告卡片已不在父级 list 中混入（由父页面在 sections 层面单独渲染全宽广告），
    //     此方法保留为空以避免破坏既有调用；始终返回空 ads 数组。
    _splitAds(items) {
      return { ads: [], others: items || [] }
    },

    // 🔥 P0-3 刷新列宽（供 wxs 计算占位符高度使用）
    _refreshColWidth(columnCount) {
      try {
        const sysInfo = wx.getWindowInfo()
        const count = columnCount || this.data.columnCount || 2
        this.setData({ colWidth: sysInfo.windowWidth / count })
      } catch (e) {}
    },

    // 🔥 P0-3 虚拟滚动：根据 scrollTop 计算可见区间 [visibleStart, visibleEnd]
    // 项数 < 30 时不启用（小列表全量渲染）；用粗粒度估算高度，前后各留 10 项缓冲
    // ⚠️ 注意：瀑布流项高度不一致（壁纸9:16/头像1:1/文案矮卡/广告高卡），单一估算高度
    // 必然不准，占位符高度与实际项高度不符会导致页面总高度突变 → scrollTop 跳变 →
    // 区间反复重算 → 滑动一跳一跳 → 最终白屏。因此当前所有页面均禁用虚拟滚动，
    // 此方法仅保留逻辑正确性，未来若启用需确保估算高度偏大（宁可多渲染也不漏）
    _updateVisibleRange() {
      if (!this.data.enableVirtualScroll) return

      const totalItems = this.data.processedCount || 0
      // 项数太少时全量渲染，避免短列表也走虚拟滚动逻辑
      if (totalItems < 30) {
        if (this.data.visibleStart !== 0 || this.data.visibleEnd !== 999) {
          this.setData({ visibleStart: 0, visibleEnd: 999 })
        }
        return
      }

      // 🔥 启用虚拟滚动时需从外部传入 scrollTop（当前调用方未传，所以这里直接 return 即可）
      if (this.data.scrollTop === undefined || this.data.scrollTop === null) {
        return
      }

      const scrollTop = this.data.scrollTop || 0
      const windowHeight = this.data.windowHeight || 600
      const colWidth = this.data.colWidth || 187
      // 平均项高度估算：壁纸 9:16 ≈ colWidth*1.78，头像 1:1 ≈ colWidth
      // 列表以壁纸为主，取偏大值 colWidth*1.78，宁可多渲染也不漏（漏渲染会显示空白）
      // ⚠️ scrollTop 对应"每列已滚过 N 项的高度"，直接用单列项高度估算项索引即可，
      //    不要除以列数（之前错误地 /2 会导致 start 翻倍 → 上方项被误判为不可见 →
      //    占位符撑开高度变小 → 页面总高度变小 → scrollTop 相对变大 → start 更大 →
      //    恶性循环 → 滑动一跳一跳 → 最终白屏）
      const estimatedItemHeight = colWidth * 1.78
      const buffer = 10  // 前后各缓冲 10 项，快速滚动时减少空白概率

      const start = Math.max(0, Math.floor(scrollTop / estimatedItemHeight) - buffer)
      const end = start + Math.ceil(windowHeight / estimatedItemHeight) + buffer * 2

      if (start !== this.data.visibleStart || end !== this.data.visibleEnd) {
        this.setData({ visibleStart: start, visibleEnd: end })
      }
    },

    distributeItems(list) {
      if (!list) return

      const count = this.data.columnCount
      const processedCount = this.data.processedCount

      if (list.length <= processedCount) {
         this.fullDistribute(list, count)
      } else {
        const newItems = list.slice(processedCount)
        this.incrementalDistribute(newItems, count, processedCount)
      }

      // 🔥 P0-3 分发完成后重新计算可见区间（list 变化后项数可能超过阈值）
      this._updateVisibleRange()
    },

    fullDistribute(list, count) {
      const { others } = this._splitAds(list)
      const columns = Array.from({ length: count }, () => [])

      if (this.data.layoutMode === 'fixed') {
        others.forEach((item, index) => {
          const colIndex = index % count
          columns[colIndex].push(item)
        })
        // 🔥 修复 Tab 切换时虚拟滚动状态未重置的 bug：
        // 全量重分发时必须重置可见区间，否则上一个 Tab 滚动到 visibleStart=25 后切换到新 Tab，
        // 新 Tab 项数较少（如每列10项）会全部被误判为不可见，导致内容全变占位符
        this.setData({
          columns,
          processedCount: list.length,
          visibleStart: 0,
          visibleEnd: 999
        })
        return
      }

      const columnHeights = Array(count).fill(0)

      others.forEach((item) => {
        const itemHeight = this._getItemHeight(item)
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

      // 🔥 修复 Tab 切换时虚拟滚动状态未重置的 bug（同上）
      this.setData({
        columns,
        processedCount: list.length,
        visibleStart: 0,
        visibleEnd: 999
      })
    },

    incrementalDistribute(newItems, count, startIndex) {
      const { others } = this._splitAds(newItems)

      let columns = this.data.columns
      if (!columns || !Array.isArray(columns)) {
        columns = Array.from({ length: count }, () => [])
      } else {
        for (let i = 0; i < count; i++) {
          if (!columns[i] || !Array.isArray(columns[i])) {
            columns[i] = []
          }
        }
      }

      // 🔥 去重：收集已存在的 id 集合，防止增量加载返回重复数据导致 wx:key 冲突
      // 重复 key 会触发"Do not set same key"警告，并造成渲染异常（空白/闪屏）
      const existingIds = new Set()
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i]
        if (!col) continue
        for (let j = 0; j < col.length; j++) {
          const id = col[j] && (col[j].id || col[j]._id)
          if (id) existingIds.add(id)
        }
      }

      // 过滤掉重复项（已存在的 id 跳过），并记录有效新增数
      const dedupedItems = []
      let skippedCount = 0
      others.forEach((item) => {
        if (!item) return
        const id = item.id || item._id
        if (id && existingIds.has(id)) {
          skippedCount++
          return
        }
        if (id) existingIds.add(id)
        dedupedItems.push(item)
      })
      if (skippedCount > 0) {
        console.warn(`[waterfall] 增量分发去重：跳过 ${skippedCount} 个重复项`)
      }
      if (dedupedItems.length === 0) {
        // 本批全部为重复数据，仅推进 processedCount 避免重复处理
        this.setData({ processedCount: startIndex + newItems.length })
        return
      }

      if (this.data.layoutMode === 'fixed') {
        // 路径式增量 setData：只更新新增项，避免全量 diff
        const updates = {}
        dedupedItems.forEach((item, index) => {
          const colIndex = (startIndex + index) % count
          if (!columns[colIndex]) columns[colIndex] = []
          const insertIndex = columns[colIndex].length
          columns[colIndex].push(item)
          updates[`columns[${colIndex}][${insertIndex}]`] = item
        })
        updates.processedCount = startIndex + newItems.length
        this.setData(updates)
        return
      }

      // 计算各列当前高度（内存中遍历，不触发渲染）
      const columnHeights = columns.map(col => {
        let height = 0
        if (col && Array.isArray(col)) {
          col.forEach(item => {
            height += this._getItemHeight(item)
          })
        }
        return height
      })

      // 路径式增量 setData：只更新新增项，避免全量 diff
      const updates = {}
      dedupedItems.forEach((item) => {
        const itemHeight = this._getItemHeight(item)
        let minHeight = columnHeights[0]
        let minIndex = 0
        for (let i = 1; i < count; i++) {
          if (columnHeights[i] < minHeight) {
            minHeight = columnHeights[i]
            minIndex = i
          }
        }
        if (!columns[minIndex]) columns[minIndex] = []
        const insertIndex = columns[minIndex].length
        columns[minIndex].push(item)
        columnHeights[minIndex] += itemHeight
        updates[`columns[${minIndex}][${insertIndex}]`] = item
      })
      updates.processedCount = startIndex + newItems.length
      this.setData(updates)
    },

    // 计算项目高度权重：头像=1（1:1），壁纸=2（9:16），灵感文案=0.6（矮卡）
    // 广告高度由 <ad-custom> 自动计算，权重按 9:16 估算（后台应创建 9:16 模板以匹配瀑布流）
    _getItemHeight(item) {
      if (item && item._cardType === 'quote') return 0.6
      if (item && item._cardType === 'ad') return 2  // 假设 9:16，实际高度由广告自动撑开
      const isAvatar = item.resourceType === 'avatar' || item.type === 'avatar'
      return isAvatar ? 1 : 2
    },

    onItemTap(e) {
      const item = e.currentTarget.dataset.item
      this.triggerEvent('itemtap', { item })
    },

    // 灵感文案卡片点击：触发 quotetap 事件，由父页面处理跳转
    onQuoteTap(e) {
      const item = e.currentTarget.dataset.item
      this.triggerEvent('quotetap', { item })
    }
  }
})