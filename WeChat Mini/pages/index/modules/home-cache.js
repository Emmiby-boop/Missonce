const { getResources } = require('../../../utils/api.js')
const { performanceMonitor } = require('../../../utils/performance.js')
const { getStorage, setStorage } = require('../../../utils/storageManager')
const { STORAGE_KEYS, CACHE_EXPIRE } = require('../../../config/constants')

// 首页缓存有效期（10 分钟，与 prebuildHomeFeed 定时刷新周期一致）
const HOME_CACHE_TTL = CACHE_EXPIRE.MEDIUM

// L3: 直读 home_cache 集合（跳过 callFunction）
async function tryLoadFromHomeCache(page) {
  try {
    const db = wx.cloud.database()
    const cacheRes = await db.collection('home_cache').doc('v1').get()
    const cached = cacheRes && cacheRes.data
    if (!cached || !cached.feed) return null

    const feedCache = {
      tabs: cached.tabs || [],
      recommend: cached.feed.recommend || null,
      latest: cached.feed.latest || null,
      timestamp: Date.now()
    }

    // 同时写入 storage 持久化缓存（供下次 L2 同步命中）
    setStorage(STORAGE_KEYS.HOME_FEED_CACHE, feedCache)
    return feedCache
  } catch (e) {
    // home_cache 集合不存在或文档不存在
    return null
  }
}

// 后台静默刷新推荐第一页（有缓存时调用，不显示 loading）
async function refreshRecommendInBackground(page) {
  if (page._recommendRefreshing) return
  page._recommendRefreshing = true
  try {
    // 🔥 必须等 Tab 配置就绪再取 sortBy：否则会读到默认 'hot'，
    // 把后台配的「热门随机」拉成了固定热门顺序，随机就失效了
    await page.waitTabsReady()
    const tabConfig = page.data.categoryTabs.find(t => t.id === 'recommend') || {}
    const resourceType = tabConfig.resourceType || 'all'
    const sortBy = tabConfig.sortBy || 'hot'  // 🔥 读取后台配置的排序方式

    const res = await getResources({
      type: resourceType,
      sort: sortBy,
      page: 1,
      pageSize: 20,
      includeMeta: false
    })

    if (res.result && res.result.success && Array.isArray(res.result.data)) {
      const newItems = page._processResourceItems(res.result.data)
      const merged = page._mergeInspirationCards(newItems, 0)
      const withAd = page._injectAdCard(merged, 0, 'ad-rec')
      const adAdded = withAd.filter(it => it && it._cardType === 'ad').length
      const hasMore = res.result.hasMore !== false && newItems.length >= 20

      // 更新内存缓存
      page._recommendCache = {
        resources: withAd,
        adCounter: adAdded,
        page: 2,
        hasMore,
        timestamp: Date.now()
      }

      // 更新 storage 持久化缓存（后台刷新拿到最新数据后写入）
      page._persistHomeFeedCache()

      // 当前还在推荐 Tab 时才更新 UI
      if (page.data.activeCategory === 'recommend') {
        page.setData({
          recommendResources: withAd,
          recommendAdCounter: adAdded,
          recommendPage: 2,
          recommendHasMore: hasMore,
          recommendLoaded: true
        })
      }
    }
  } catch (e) {
    console.warn('[首页] 后台刷新推荐失败:', e)
  } finally {
    page._recommendRefreshing = false
  }
}

// 后台静默刷新最新第一页（有缓存时调用，不显示 loading）
async function refreshLatestInBackground(page) {
  if (page._latestRefreshing) return
  page._latestRefreshing = true
  try {
    await page.waitTabsReady()
    const tabConfig = page.data.categoryTabs.find(t => t.id === 'latest') || {}
    const resourceType = tabConfig.resourceType || 'all'
    const sortBy = tabConfig.sortBy || 'latest'  // 🔥 读取后台配置的排序方式

    const res = await getResources({
      type: resourceType,
      sort: sortBy,
      page: 1,
      pageSize: 20,
      includeMeta: false
    })

    if (res.result && res.result.success && Array.isArray(res.result.data)) {
      const newItems = page._processResourceItems(res.result.data)
      const merged = page._mergeInspirationCards(newItems, 0)
      const withAd = page._injectAdCard(merged, 0, 'ad-latest')
      const adAdded = withAd.filter(it => it && it._cardType === 'ad').length
      const hasMore = res.result.hasMore !== false && newItems.length >= 20

      page._latestCache = {
        resources: withAd,
        adCounter: adAdded,
        page: 2,
        hasMore,
        timestamp: Date.now()
      }

      // 更新 storage 持久化缓存
      page._persistHomeFeedCache()

      if (page.data.activeCategory === 'latest') {
        page.setData({
          latestResources: withAd,
          latestAdCounter: adAdded,
          latestPage: 2,
          latestHasMore: hasMore,
          latestLoaded: true
        })
      }
    }
  } catch (e) {
    console.warn('[首页] 后台刷新最新失败:', e)
  } finally {
    page._latestRefreshing = false
  }
}

// 将推荐流和 latest 流第一页写入 storage 持久化缓存
function persistHomeFeedCache(page) {
  try {
    // 从内存缓存中提取 cleanResource 格式的原始数据（去除灵感卡片和广告卡片）
    const extractRawList = (cache) => {
      if (!cache || !cache.resources) return null
      return cache.resources
        .filter(item => !item._cardType)  // 过滤掉灵感文案和广告卡片
        .map(item => ({
          id: item.id || item._id,
          _id: item._id || item.id,
          title: item.title,
          type: item.type,
          coverUrl: item.rawUrl || item.coverUrl || item.url,
          originUrl: item.rawOriginalUrl || item.originUrl || item.url,
          url: item.url,
          categories: item.categories || [],
          tags: item.tags || [],
          views: item.views || 0,
          hotScore: item.hotScore || 0,
          dailyHotScore: item.dailyHotScore || 0,
          downloads: item.downloads || 0,
          favorites: item.favorites || 0,
          createdAt: item.createdAt || null
        }))
    }

    const recommendList = extractRawList(page._recommendCache)
    const latestList = extractRawList(page._latestCache)

    if (!recommendList || recommendList.length === 0) return

    // 保留已有的 tabs 数据（从 storage 缓存或当前 categoryTabs 构造）
    const existingCache = getStorage(STORAGE_KEYS.HOME_FEED_CACHE) || {}
    const tabs = existingCache.tabs || page.data.categoryTabs.map(t => ({
      type: t.type,
      fixedId: t.fixedId || '',
      title: t.name,
      visible: true,
      sort: 0,
      tag: t.tag || '',
      resourceType: t.resourceType || 'all',
      sortBy: t.sortBy || 'hot'
    }))

    const feedCache = {
      tabs,
      recommend: {
        list: recommendList,
        hasMore: page._recommendCache ? page._recommendCache.hasMore : true
      },
      latest: latestList && latestList.length > 0 ? {
        list: latestList,
        hasMore: page._latestCache ? page._latestCache.hasMore : true
      } : null,
      timestamp: Date.now()
    }

    setStorage(STORAGE_KEYS.HOME_FEED_CACHE, feedCache)
  } catch (e) {
    console.warn('[首页] 写入 storage 缓存失败:', e)
  }
}

// 从 feedCache 渲染首屏（tabs + recommend 第一页）
function renderFromFeedCache(page, feedCache, source) {
  const recList = feedCache.recommend || {}
  const items = page._processResourceItems(recList.list || [])
  const merged = page._mergeInspirationCards(items, 0)
  const withAd = page._injectAdCard(merged, 0, 'ad-rec')
  const adAdded = withAd.filter(it => it && it._cardType === 'ad').length
  const hasMore = recList.hasMore !== false && items.length >= 20

  // 更新内存缓存
  page._recommendCache = {
    resources: withAd,
    adCounter: adAdded,
    page: 2,
    hasMore,
    timestamp: Date.now()
  }

  page.setData({
    loading: false,
    recommendResources: withAd,
    recommendAdCounter: adAdded,
    recommendPage: 2,
    recommendHasMore: hasMore,
    recommendLoaded: true
  })

  page._logPageLoadDone(source || '缓存', withAd.length)

  // 如果缓存中包含 latest 流数据，也写入 latest 内存缓存
  if (feedCache.latest && feedCache.latest.list && feedCache.latest.list.length > 0) {
    const latestItems = page._processResourceItems(feedCache.latest.list)
    const latestMerged = page._mergeInspirationCards(latestItems, 0)
    const latestWithAd = page._injectAdCard(latestMerged, 0, 'ad-latest')
    const latestAdAdded = latestWithAd.filter(it => it && it._cardType === 'ad').length
    page._latestCache = {
      resources: latestWithAd,
      adCounter: latestAdAdded,
      page: 2,
      hasMore: feedCache.latest.hasMore !== false && latestItems.length >= 20,
      timestamp: Date.now()
    }
  }
}

// 打印首页启动时间日志（参考专题页的 page_load 日志格式）
function logPageLoadDone(page, source, resourceCount) {
  const stats = performanceMonitor.getPageStats('首页')
  if (!stats) return
  const loadTime = Date.now() - stats.startTime
  console.log(`[Performance] ✅ 首页 页面加载完成`)
  console.log(`[性能监控] page_load: { loadTime: ${loadTime}, source: "${source}", resourceCount: ${resourceCount || 0} }`)

  // 🔥 性能测试打点：首屏数据就绪
  try {
    const perfTest = require('../../utils/perf-test.js')
    const mod = perfTest.default || perfTest
    if (!mod.perf.getMark('first_data_ready')) {
      mod.perf.mark('first_data_ready')
    }
  } catch (e) {}
}

module.exports = {
  tryLoadFromHomeCache,
  refreshRecommendInBackground,
  refreshLatestInBackground,
  persistHomeFeedCache,
  renderFromFeedCache,
  logPageLoadDone
}
