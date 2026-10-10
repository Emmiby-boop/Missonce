import { STORE_APPID, STORE_PRODUCT_IDS } from '../../config/constants'

const db = wx.cloud.database()

// store-product 是微信小店官方插件（plugin://wx-wxa-secommerce-store），
// 已在 store.json 的 plugins 段声明。漏掉声明真机上整页渲染失败。

Page({
  data: {
    loading: true,
    error: '',
    // 微信小店ID（不是小程序AppID），取自 config/constants.js
    storeAppid: STORE_APPID,
    // 商品 ID 列表
    productIds: [],
    // 是否已配置商品
    hasProducts: false
  },

  onLoad() {
    this.loadProducts()
  },

  async loadProducts() {
    this.setData({ loading: true, error: '' })
    try {
      // 优先从数据库读取（后台管理页面通过 manageConfig 云函数配置，存储在 config 集合，格式为 { key, value }）
      const res = await db.collection('config').where({ key: 'storeProducts' }).limit(1).get()
      const data = res.data && res.data.length > 0 ? res.data[0] : null
      let products = []
      if (data && Array.isArray(data.value)) {
        products = data.value
      }

      // 提取商品 ID
      const ids = products
        .map(p => (typeof p === 'string' ? p : p.id))
        .filter(id => id)

      if (ids.length > 0) {
        this.setData({ productIds: ids, hasProducts: true, loading: false })
      } else {
        // 数据库没有，兜底用 constants.js 的配置
        const fallbackIds = STORE_PRODUCT_IDS || []
        this.setData({
          productIds: fallbackIds,
          hasProducts: fallbackIds.length > 0,
          loading: false
        })
      }
    } catch (err) {
      console.warn('[Store] 从数据库读取商品失败，使用本地配置:', err)
      // 兜底：使用 constants.js 的配置
      const fallbackIds = STORE_PRODUCT_IDS || []
      this.setData({
        productIds: fallbackIds,
        hasProducts: fallbackIds.length > 0,
        loading: false
      })
    }
  },

  onStoreProductError(e) {
    console.error('[Store] store-product 加载失败:', e.detail)
    this.setData({ error: '商品加载失败，请稍后重试' })
  },

  onRetry() {
    this.loadProducts()
  }
})
