const { getStorageAsync, setStorage } = require('../../../utils/storageManager')

// 灵感文案兜底（仅在云端加载失败时使用，避免文案位空白）
const FALLBACK_QUOTES = [
  '换个头像，换个心情',
  '今天的你，值得被喜欢',
  '把热爱藏在头像里'
]
const QUOTE_CACHE_KEY = 'home_quotes_pool'
const QUOTE_CACHE_TTL = 10 * 60 * 1000  // 10 分钟

// 加载灵感文案池：优先用 storage 缓存，无则调用 getQuotes 云函数
// 写入 page._quotePool，返回 Promise（供 loadXxxResources await）
function ensureQuotePool(page) {
  if (page._quotePoolPromise) return page._quotePoolPromise
  if (page._quotePool && page._quotePool.length > 0) return Promise.resolve()

  page._quotePoolPromise = (async () => {
    try {
      // L1: 尝试 storage 异步缓存（10 分钟内有效）
      const cached = await getStorageAsync(QUOTE_CACHE_KEY)
      if (cached && cached.data && Array.isArray(cached.data) && cached.data.length > 0) {
        const age = Date.now() - (cached.timestamp || 0)
        if (age < QUOTE_CACHE_TTL) {
          page._quotePool = cached.data
          console.log('[首页] 文案池命中 storage 缓存，数量:', page._quotePool.length)
          page._refreshQuoteTexts()
          return
        }
      }

      // L2: 云端拉取（getQuotes 有内存缓存，10 分钟内重复调用很快）
      const res = await wx.cloud.callFunction({
        name: 'getQuotes',
        data: { page: 1, pageSize: 30 }
      })
      if (res.result && res.result.success && Array.isArray(res.result.data) && res.result.data.length > 0) {
        // 提取 content 字段作为文案文本
        page._quotePool = res.result.data.map(q => q.content).filter(Boolean)
        console.log('[首页] 文案池云端加载成功，数量:', page._quotePool.length)
        // 写入 storage 缓存
        setStorage(QUOTE_CACHE_KEY, {
          data: page._quotePool,
          timestamp: Date.now()
        })
        page._refreshQuoteTexts()
        return
      }
      // 云端返回空，用兜底
      page._quotePool = FALLBACK_QUOTES.slice()
    } catch (e) {
      console.warn('[首页] 文案池加载失败，使用兜底文案:', e)
      page._quotePool = FALLBACK_QUOTES.slice()
    }
  })()
  return page._quotePoolPromise
}

// 文案池加载完后，刷新当前已渲染列表中 quote 卡片的文案
// 仅更新 text 字段，不改变卡片结构/位置，避免影响广告卡片
function refreshQuoteTexts(page) {
  const pool = page._quotePool
  if (!pool || pool.length === 0) return
  const poolLen = pool.length
  const QUOTE_INTERVAL = 7

  const active = page.data.activeCategory
  let listKey, setDataKey
  if (active === 'recommend') {
    listKey = 'recommendResources'
    setDataKey = 'recommendResources'
  } else if (active === 'latest') {
    listKey = 'latestResources'
    setDataKey = 'latestResources'
  } else {
    listKey = 'tagResources'
    setDataKey = 'tagResources'
  }

  const arr = page.data[listKey]
  if (!arr || arr.length === 0) return

  // 检查是否有 quote 卡片需要更新
  let changed = false
  const newList = arr.map(item => {
    if (item._cardType !== 'quote') return item
    // 从 _id (quote_${absoluteIndex}) 提取 absoluteIndex，重新计算文案索引
    const match = /^quote_(\d+)$/.exec(item.id || item._id || '')
    if (!match) return item
    const absoluteIndex = parseInt(match[1], 10)
    const quoteIndex = (Math.floor(absoluteIndex / QUOTE_INTERVAL) - 1) % poolLen
    const newText = pool[quoteIndex]
    if (newText && newText !== item.text) {
      changed = true
      return { ...item, text: newText }
    }
    return item
  })

  if (changed) {
    page.setData({ [setDataKey]: newList })
  }
}

// 灵感文案卡片点击：跳转到灵感文案页
function onQuoteTap(page) {
  page.navigateToInspiration()
}

module.exports = {
  ensureQuotePool,
  refreshQuoteTexts,
  onQuoteTap
}
