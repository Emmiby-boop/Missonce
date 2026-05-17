// section-card 组件
Component({
  properties: {
    title: String,
    items: Array,
    showMore: { type: Boolean, value: true },
    moreText: { type: String, value: '查看更多' },
    moreUrl: String
  },
  data: {
    visible: true
  },
  methods: {
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
      const item = this.properties.items[index]
      this.triggerEvent('itemtap', { item, index })
    }
  }
})