// section-avatar-row 组件
Component({
  properties: {
    title: String,
    items: Array,
    showMore: { type: Boolean, value: true },
    moreText: { type: String, value: '查看更多' },
    moreUrl: String,
    maxItems: { type: Number, value: 6 },
    size: { type: String, value: 'medium' } // small, medium, large
  },
  data: {
    visible: true,
    displayItems: []
  },
  observers: {
    'items': function(items) {
      if (items && items.length > 0) {
        this.updateDisplayItems(items)
      }
    },
    'maxItems': function(maxItems) {
      if (this.data.items && this.data.items.length > 0) {
        this.updateDisplayItems(this.data.items)
      }
    }
  },
  lifetimes: {
    attached: function() {
      if (this.data.items && this.data.items.length > 0) {
        this.updateDisplayItems(this.data.items)
      }
    }
  },
  methods: {
    updateDisplayItems(items) {
      const displayItems = items.slice(0, this.properties.maxItems)
      this.setData({ displayItems })
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
      const { index } = e.currentTarget.dataset
      const item = this.data.displayItems[index]
      this.triggerEvent('itemtap', { item, index })
    }
  }
})