const { getResources } = require('../../../utils/api.js')
const { optimizeImageUrls, getOptimalThumbnailSize } = require('../../../utils/image.js')

// 灵感文案兜底（仅在云端加载失败时使用，避免文案位空白）
const FALLBACK_QUOTES = [
  '换个头像，换个心情',
  '今天的你，值得被喜欢',
  '把热爱藏在头像里'
]

// 检测 URL 是否为 GIF（与 utils/image.js 的 processUrl 逻辑保持一致）
function _detectGif(url) {
  if (!url || typeof url !== 'string') return false
  const lower = url.toLowerCase()
  return lower.endsWith('.gif') || lower.includes('.gif?') || lower.includes('&gif=') || lower.includes('?gif=')
}

// 🔥 低端机渲染上限：达到上限后停止触底自动加载（防止图片/GIF 节点无限累积导致掉帧与 OOM）
const LOW_END_MAX_ITEMS = 60
const LOW_END_STEP = 40

// 达到低端机上限时置 capped 标志并返回 true（wxml 据此显示"点击加载更多"）
// kind: 'recommend' | 'latest' | 'tag'，对应 page.data 中的 {kind}Resources/{kind}Cap/{kind}Capped
function checkLowEndCap(page, kind) {
  if (!page.data.lowEnd) return false
  const cap = page.data[kind + 'Cap'] || LOW_END_MAX_ITEMS
  const list = page.data[kind + 'Resources'] || []
  if (list.length < cap) return false
  if (!page.data[kind + 'Capped']) {
    page.setData({ [kind + 'Capped']: true })
  }
  return true
}

// "点击加载更多"：上限提升一批后继续加载当前 Tab（由 index.js onLoadMoreCapped 调用）
function loadMoreBeyondCap(page) {
  const cat = page.data.activeCategory
  if (cat === 'recommend') {
    page.setData({
      recommendCap: (page.data.recommendCap || LOW_END_MAX_ITEMS) + LOW_END_STEP,
      recommendCapped: false
    })
    page.loadRecommendResources()
    return
  }
  if (cat === 'latest') {
    page.setData({
      latestCap: (page.data.latestCap || LOW_END_MAX_ITEMS) + LOW_END_STEP,
      latestCapped: false
    })
    page.loadLatestResources()
    return
  }
  // 标签 Tab（activeCategory 为标签 id）
  page.setData({
    tagCap: (page.data.tagCap || LOW_END_MAX_ITEMS) + LOW_END_STEP,
    tagCapped: false
  })
  page.loadTagResources()
}

// 公共方法：将 cleanResource 格式的原始数据转换为首页渲染格式
function processResourceItems(page, rawItems) {
  const thumbSize = getOptimalThumbnailSize()
  const optimized = optimizeImageUrls(rawItems, 'coverUrl', thumbSize)
  return optimized.map(item => ({
    ...item,
    id: item.id || item._id,
    _id: item._id || item.id,
    url: item.optimizedUrl || item.coverUrl || item.url,
    originalUrl: item.originUrl || item.originalUrl || item.url,
    rawUrl: item.coverUrl || item.url,
    rawOriginalUrl: item.originUrl || item.originalUrl || item.url,
    resourceType: item.type || 'wallpaper',
    isGif: _detectGif(item.coverUrl || item.url || item.originUrl || '')
  }))
}

// 加载推荐 Tab 的热门资源瀑布流（调用 getResources 拉取热门资源）
async function loadRecommendResources(page) {
  // 🔥 同步锁：setData 异步生效，预加载和触底加载可能并发触发同一函数
  // 仅靠 page.data.recommendLoading 检查会有时间窗，导致重复请求 → 列表出现重复数据 → wx:key 冲突
  if (page._recommendLock) return
  if (page.data.recommendLoading) return
  if (!page.data.recommendHasMore && page.data.recommendResources.length > 0) return
  // 🔥 低端机渲染上限：达到后停止触底自动加载，改由"点击加载更多"手动分批
  if (checkLowEndCap(page, 'recommend')) return

  page._recommendLock = true
  page.setData({ recommendLoading: true })

  try {
    // 🔥 第一页加载前确保文案池就绪（通常已在 _loadNonCriticalData 中预加载完成）
    if (page.data.recommendPage === 1) {
      await page._ensureQuotePool()
      // 🔥 同时等 Tab 配置就绪：sortBy 必须来自后台配置，否则随机排序会被默认值 'hot' 覆盖
      await page.waitTabsReady()
    }
    // 读取推荐 Tab 配置的 resourceType 和 sortBy（支持后台自定义排序方式）
    const tabConfig = page.data.categoryTabs.find(t => t.id === 'recommend') || {}
    const resourceType = tabConfig.resourceType || 'all'
    const sortBy = tabConfig.sortBy || 'hot'  // 🔥 读取后台配置的排序方式（hot/latest/hotRandom/random 等）

    const res = await getResources({
      type: resourceType,
      sort: sortBy,       // 🔥 使用后台配置的排序方式
      page: page.data.recommendPage,
      pageSize: 20,
      includeMeta: false  // 首页不需要分类标签元数据，跳过昂贵的 getAllTags 查询
    })

    console.log('[首页] loadRecommendResources 返回:', res?.result?.success, '数据量:', res?.result?.data?.length)

    if (res.result && res.result.success && Array.isArray(res.result.data)) {
      const newItems = page._processResourceItems(res.result.data)

      // 穿插灵感文案卡片：每 7 项插入一张
      const existingCount = page.data.recommendResources.length
      const merged = page._mergeInspirationCards(newItems, existingCount)

      // 在本批次中随机位置插入 1 张广告卡片（伪装成 9:16 壁纸，混进瀑布流）
      const withAd = page._injectAdCard(merged, page.data.recommendAdCounter, 'ad-rec')
      const adAdded = withAd.filter(it => it && it._cardType === 'ad').length

      const hasMore = res.result.hasMore !== false && newItems.length >= 20
      page.setData({
        recommendResources: page.data.recommendResources.concat(withAd),
        recommendAdCounter: page.data.recommendAdCounter + adAdded,
        recommendPage: page.data.recommendPage + 1,
        recommendHasMore: hasMore,
        recommendLoading: false,
        recommendLoaded: true
      })

      // 🔥 首屏第一页加载成功后写入内存缓存 + storage 持久化缓存
      if (page.data.recommendPage === 2) {  // 已自增，第一页加载后为 2
        page._recommendCache = {
          resources: page.data.recommendResources,
          adCounter: page.data.recommendAdCounter,
          page: page.data.recommendPage,
          hasMore,
          timestamp: Date.now()
        }
        // 异步写入 storage（不阻塞渲染）
        page._persistHomeFeedCache()
        // 打印启动时间日志
        page._logPageLoadDone('L4网络', page.data.recommendResources.length)
      }
      console.log('[首页] 推荐资源加载成功，当前总数:', page.data.recommendResources.length)
    } else {
      console.warn('[首页] 推荐资源返回失败或为空:', res?.result)
      page.setData({ recommendLoading: false, recommendHasMore: false, recommendLoaded: true })
    }
  } catch (e) {
    console.error('[首页] loadRecommendResources error:', e)
    page.setData({ recommendLoading: false, recommendLoaded: true })
  } finally {
    // 🔥 释放同步锁：必须放在 finally 中，避免异常导致锁泄漏永久阻塞加载
    page._recommendLock = false
  }
}

// 加载最新 Tab 的资源瀑布流（按上传时间倒序，无标签过滤）
async function loadLatestResources(page) {
  // 🔥 同步锁（同 loadRecommendResources）
  if (page._latestLock) return
  if (page.data.latestLoading) return
  if (!page.data.latestHasMore && page.data.latestResources.length > 0) return
  // 🔥 低端机渲染上限（同推荐 Tab）
  if (checkLowEndCap(page, 'latest')) return

  page._latestLock = true
  page.setData({ latestLoading: true })

  try {
    // 🔥 第一页加载前确保文案池就绪
    if (page.data.latestPage === 1) {
      await page._ensureQuotePool()
      await page.waitTabsReady()
    }
    // 读取最新 Tab 配置的 resourceType 和 sortBy（支持后台自定义排序方式）
    const tabConfig = page.data.categoryTabs.find(t => t.id === 'latest') || {}
    const resourceType = tabConfig.resourceType || 'all'
    const sortBy = tabConfig.sortBy || 'latest'  // 🔥 读取后台配置的排序方式

    const res = await getResources({
      type: resourceType,
      sort: sortBy,      // 🔥 使用后台配置的排序方式
      page: page.data.latestPage,
      pageSize: 20,
      includeMeta: false  // 首页不需要分类标签元数据
    })

    if (res.result && res.result.success && Array.isArray(res.result.data)) {
      const newItems = page._processResourceItems(res.result.data)

      const existingCount = page.data.latestResources.length
      const merged = page._mergeInspirationCards(newItems, existingCount)
      const withAd = page._injectAdCard(merged, page.data.latestAdCounter, 'ad-latest')
      const adAdded = withAd.filter(it => it && it._cardType === 'ad').length

      const hasMore = res.result.hasMore !== false && newItems.length >= 20
      page.setData({
        latestResources: page.data.latestResources.concat(withAd),
        latestAdCounter: page.data.latestAdCounter + adAdded,
        latestPage: page.data.latestPage + 1,
        latestHasMore: hasMore,
        latestLoading: false,
        latestLoaded: true
      })

      // 🔥 第一页加载成功后写入内存缓存 + storage 持久化缓存
      if (page.data.latestPage === 2) {
        page._latestCache = {
          resources: page.data.latestResources,
          adCounter: page.data.latestAdCounter,
          page: page.data.latestPage,
          hasMore,
          timestamp: Date.now()
        }
        page._persistHomeFeedCache()
      }
    } else {
      page.setData({ latestLoading: false, latestHasMore: false, latestLoaded: true })
    }
  } catch (e) {
    console.error('[首页] loadLatestResources error:', e)
    page.setData({ latestLoading: false, latestLoaded: true })
  } finally {
    page._latestLock = false
  }
}

// 加载标签资源（调用 getResources 按 tag 查询，复用 avatar/wallpaper 页面同款链路）
async function loadTagResources(page) {
  const tag = page.data.activeCategory
  // 推荐/最新 Tab 不加载标签资源；正在加载时跳过；无更多数据时跳过
  if (tag === 'recommend' || tag === 'latest') return
  // 🔥 同步锁（同 loadRecommendResources）
  if (page._tagLock) return
  if (page.data.tagLoading) return
  if (!page.data.tagHasMore && page.data.tagResources.length > 0) return
  // 🔥 低端机渲染上限（同推荐 Tab）
  if (checkLowEndCap(page, 'tag')) return

  page._tagLock = true
  page.setData({ tagLoading: true })

  try {
    // 🔥 第一页加载前确保文案池就绪
    if (page.data.tagPage === 1) {
      await page._ensureQuotePool()
      await page.waitTabsReady()
    }
    // 读取当前标签 Tab 的 resourceType 和 sortBy 配置
    const tabConfig = page.data.categoryTabs.find(t => t.id === tag) || {}
    const resourceType = tabConfig.resourceType || 'all'
    const sortBy = tabConfig.sortBy || 'hot'

    const res = await getResources({
      type: resourceType,
      tag: tag,
      sort: sortBy,
      page: page.data.tagPage,
      pageSize: 20,
      includeMeta: false  // 首页不需要分类标签元数据
    })

    if (res.result && res.result.success && Array.isArray(res.result.data)) {
      const newItems = page._processResourceItems(res.result.data)

      // 穿插灵感文案卡片：每 7 项插入一张
      const existingCount = page.data.tagResources.length
      const merged = page._mergeInspirationCards(newItems, existingCount)

      // 在本批次中随机位置插入 1 张广告卡片
      const withAd = page._injectAdCard(merged, page.data.tagAdCounter, 'ad-tag')
      const adAdded = withAd.filter(it => it && it._cardType === 'ad').length

      const hasMore = res.result.hasMore !== false && newItems.length >= 20
      const newTagResources = page.data.tagResources.concat(withAd)
      // 修复：在 setData 之前用局部变量保存当前 tagPage，避免 setData 后判断错误
      const isFirstPage = page.data.tagPage === 1

      page.setData({
        tagResources: newTagResources,
        tagAdCounter: page.data.tagAdCounter + adAdded,
        tagPage: page.data.tagPage + 1,
        tagHasMore: hasMore,
        tagLoading: false
      })

      // 第一页加载成功后写入缓存
      if (isFirstPage) {
        page._tagCache[tag] = {
          resources: newTagResources,
          adCounter: page.data.tagAdCounter + adAdded,
          timestamp: Date.now()
        }
      }
    } else {
      page.setData({ tagLoading: false, tagHasMore: false })
    }
  } catch (e) {
    console.error('loadTagResources error:', e)
    page.setData({ tagLoading: false })
  } finally {
    page._tagLock = false
  }
}

// 将灵感文案卡片穿插进资源列表
// 灵感文案：每 7 项固定插一个，文案内容从云端 quotes 集合获取（_quotePool）
function mergeInspirationCards(page, newItems, existingCount) {
  const result = []
  const QUOTE_INTERVAL = 7
  const pool = page._quotePool && page._quotePool.length > 0 ? page._quotePool : FALLBACK_QUOTES
  const poolLen = pool.length

  newItems.forEach((item, index) => {
    result.push(item)
    const absoluteIndex = existingCount + index + 1
    if (index >= newItems.length - 1) return

    // 灵感文案：每 7 项插一个
    if (absoluteIndex % QUOTE_INTERVAL === 0) {
      const quoteIndex = (Math.floor(absoluteIndex / QUOTE_INTERVAL) - 1) % poolLen
      const quoteId = 'quote_' + absoluteIndex
      result.push({
        _id: quoteId,
        id: quoteId,
        _cardType: 'quote',
        text: pool[quoteIndex]
      })
    }
  })
  return result
}

// 在已经合并文案卡片后的数组里，按后台配置的间隔插入广告卡片
// 广告卡片伪装成 9:16 的 wallpaper，混入瀑布流后由 2 列布局自动分配到某一列
// 未配置时默认每页插入 1 张（位置 10-17 随机）；配置后按 interval 等距插入
function injectAdCard(page, mergedItems, adCounter, idPrefix) {
  if (!mergedItems || mergedItems.length === 0) {
    return mergedItems
  }

  // 读取后台配置（由 index.js _loadListAdConfig 注入到 page._listAdConfig）
  const cfg = page._listAdConfig
  const enabled = cfg && cfg.enabled
  const interval = cfg && cfg.interval > 0 ? cfg.interval : 0

  // 未启用：沿用默认行为，每页插入 1 张（位置 10-17 随机）
  if (!enabled || interval <= 0) {
    if (mergedItems.length < 11) return mergedItems
    const MIN_AD_GAP = 10
    const maxSplit = Math.min(17, mergedItems.length - 1)
    const minSplit = Math.min(MIN_AD_GAP, maxSplit)
    const insertIndex = minSplit + Math.floor(Math.random() * (maxSplit - minSplit + 1))
    const adId = 'ad-' + idPrefix + '-' + adCounter
    const adItem = {
      _id: adId,
      id: adId,
      _cardType: 'ad',
      type: 'wallpaper',
      resourceType: 'wallpaper',
      url: '',
      coverUrl: ''
    }
    const result = mergedItems.slice()
    result.splice(insertIndex, 0, adItem)
    return result
  }

  // 已启用：按 interval 等距插入多张广告
  const result = []
  let counter = 0
  mergedItems.forEach((item, index) => {
    result.push(item)
    // 每 interval 项插入一张广告，不在末尾插入
    if ((index + 1) % interval === 0 && index < mergedItems.length - 2) {
      const adId = 'ad-' + idPrefix + '-' + (adCounter + counter)
      result.push({
        _id: adId,
        id: adId,
        _cardType: 'ad',
        type: 'wallpaper',
        resourceType: 'wallpaper',
        url: '',
        coverUrl: ''
      })
      counter++
    }
  })
  return result
}

// 触底加载更多 / 预加载（推荐 Tab 和标签 Tab 分别加载对应资源）
function onTagReachBottom(page) {
  if (page.data.activeCategory === 'recommend') {
    // 推荐 Tab：加载更多热门资源
    if (!page.data.recommendHasMore || page.data.recommendLoading) return
    page.loadRecommendResources()
    return
  }
  if (page.data.activeCategory === 'latest') {
    // 最新 Tab：加载更多最新资源
    if (!page.data.latestHasMore || page.data.latestLoading) return
    page.loadLatestResources()
    return
  }
  // 标签 Tab：加载更多标签资源
  if (!page.data.tagHasMore || page.data.tagLoading) return
  page.loadTagResources()
}

// 🔥 预加载：剩余项数 ≤ 阈值时提前加载下一页（避免用户滑到底部看到 loading）
function tryPrefetchNextPage(page) {
  const PREFETCH_THRESHOLD = 10  // 剩余 10 条时触发预加载（约 1.5 屏，给网络请求足够时间）
  const cat = page.data.activeCategory
  if (cat === 'recommend') {
    if (!page.data.recommendHasMore || page.data.recommendLoading) return
    // 剩余项数 = 总数 - 已渲染项数（估算每屏约 6-8 条可见）
    const remaining = page.data.recommendResources.length - page._lastVisibleIndex
    if (remaining <= PREFETCH_THRESHOLD) {
      console.log(`[首页] 预加载推荐流（剩余 ${remaining} 条）`)
      page.loadRecommendResources()
    }
  } else if (cat === 'latest') {
    if (!page.data.latestHasMore || page.data.latestLoading) return
    const remaining = page.data.latestResources.length - page._lastVisibleIndex
    if (remaining <= PREFETCH_THRESHOLD) {
      console.log(`[首页] 预加载最新流（剩余 ${remaining} 条）`)
      page.loadLatestResources()
    }
  } else {
    if (!page.data.tagHasMore || page.data.tagLoading) return
    const remaining = page.data.tagResources.length - page._lastVisibleIndex
    if (remaining <= PREFETCH_THRESHOLD) {
      console.log(`[首页] 预加载标签流（剩余 ${remaining} 条）`)
      page.loadTagResources()
    }
  }
}

module.exports = {
  loadRecommendResources,
  loadLatestResources,
  loadTagResources,
  loadMoreBeyondCap,
  mergeInspirationCards,
  injectAdCard,
  onTagReachBottom,
  tryPrefetchNextPage,
  processResourceItems
}
