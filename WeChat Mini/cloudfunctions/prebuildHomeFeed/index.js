const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 预构建首页数据缓存
// 设计：每 10 分钟定时拉取 home_tabs 配置 + 推荐/最新流第一页资源，
// 写入 home_cache 集合（单文档 _id='v1'），供小程序前端直读库读取，
// 跳过 callFunction 链路（约省 100-300ms），实现冷启动秒开。

// 字段投影：与 getResources 云函数的 RESOURCE_FIELD 保持一致
const RESOURCE_FIELD = {
  _id: true, type: true, title: true, coverUrl: true,
  originUrl: true, url: true, categories: true, tags: true,
  views: true, hotScore: true, dailyHotScore: true, downloads: true, favorites: true, createdAt: true
}

// 排序字段映射
const SORT_FIELD_MAP = {
  'latest': 'createdAt', 'createTime': 'createdAt', 'createdAt': 'createdAt',
  'hot': 'hotScore', 'hotScore': 'hotScore',
  'todayHot': 'dailyHotScore', 'daily': 'dailyHotScore', 'dailyHotScore': 'dailyHotScore',
  // 🔥 混合排序（实际在 fetchFirstPage 中单独处理，这里仅占位避免 fallback）
  'hotRandom': 'hotScore', 'latestRandom': 'createdAt'
}

const DEFAULT_FIXED_TABS = {
  recommend: { type: 'fixed', fixedId: 'recommend', title: '推荐', visible: true, resourceType: 'all', sortBy: 'hot', sort: 0 },
  latest: { type: 'fixed', fixedId: 'latest', title: '最新', visible: true, resourceType: 'all', sortBy: 'latest', sort: 1 }
}

// 数据清洗：与 getResources 的 cleanResource 保持一致
function cleanResource(item) {
  return {
    id: item._id,
    title: item.title,
    type: item.type,
    coverUrl: item.coverUrl,
    originUrl: item.originUrl || item.coverUrl,
    url: item.url || item.coverUrl,
    categories: item.categories || [],
    tags: item.tags || [],
    views: item.views || 0,
    hotScore: item.hotScore || 0,
    dailyHotScore: item.dailyHotScore || 0,
    downloads: item.downloads || 0,
    favorites: item.favorites || 0,
    createdAt: item.createdAt || null
  }
}

// 拉取单个 Tab 的第一页资源（20 条）
// 🔥 修复：必须过滤 status='published'，否则后台下线/草稿/待审资源会进入首页缓存
async function fetchFirstPage(resourceType, sort, tag) {
  const sortField = SORT_FIELD_MAP[sort] || 'createdAt'
  let query

  if (tag) {
    // 标签 Tab：与 getResources buildConditions 的 tag 逻辑一致
    const conditions = [{ status: 'published' }, { deletedAt: null }]
    if (resourceType && resourceType !== 'all') {
      conditions.push({ type: resourceType })
    }
    conditions.push(_.or([
      { tags: tag },
      { categories: tag },
      { category: tag }
    ]))
    query = db.collection('resources').where(_.and(conditions))
  } else if (resourceType && resourceType !== 'all') {
    query = db.collection('resources').where({ type: resourceType, status: 'published', deletedAt: null })
  } else {
    query = db.collection('resources').where({ status: 'published', deletedAt: null })
  }

  // 🔥 混合排序：从 Top 50 中随机抽取 20 条（与 getResources 云函数逻辑一致）
  if (sort === 'hotRandom' || sort === 'latestRandom') {
    const baseSortField = sort === 'hotRandom' ? 'hotScore' : 'createdAt'
    const topRes = await query
      .field(RESOURCE_FIELD)
      .orderBy(baseSortField, 'desc')
      .limit(50)
      .get()
    const topList = topRes.data || []
    // Fisher-Yates 随机打乱
    for (let i = topList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [topList[i], topList[j]] = [topList[j], topList[i]]
    }
    const list = topList.slice(0, 20).map(cleanResource)
    return { list, hasMore: list.length >= 20 }
  }

  const res = await query
    .field(RESOURCE_FIELD)
    .orderBy(sortField, 'desc')
    .limit(20)
    .get()

  const list = (res.data || []).map(cleanResource)
  return {
    list,
    hasMore: list.length >= 20
  }
}

exports.main = async (event, context) => {
  const startTime = Date.now()
  try {
    console.log('[prebuildHomeFeed] 开始预构建首页缓存')

    // 1. 读取 Tab 配置（与 getHomeTabs 逻辑一致）
    const tabsRes = await db.collection('home_tabs').orderBy('sort', 'asc').limit(50).get()
    let tabs = (tabsRes.data || []).map(item => ({
      type: item.type || 'tag',
      fixedId: item.fixedId || '',
      title: item.title || '未命名',
      visible: item.visible !== false,
      sort: item.sort || 0,
      tag: item.tag || '',
      resourceType: item.resourceType || 'all',
      sortBy: item.sortBy || 'hot'
    }))

    // 补齐缺失的固定 Tab（与 getHomeTabs 逻辑一致）
    const hasRecommend = tabs.some(t => t.type === 'fixed' && t.fixedId === 'recommend')
    const hasLatest = tabs.some(t => t.type === 'fixed' && t.fixedId === 'latest')
    const merged = []
    if (!hasRecommend) merged.push({ ...DEFAULT_FIXED_TABS.recommend })
    if (!hasLatest) merged.push({ ...DEFAULT_FIXED_TABS.latest, sort: hasRecommend ? 1 : 0 })
    tabs = [...merged, ...tabs].sort((a, b) => (a.sort || 0) - (b.sort || 0))

    // 2. 为推荐 Tab 和最新 Tab 预构建第一页资源（首屏关键路径）
    const feed = {}
    const visibleTabs = tabs.filter(t => t.visible !== false)

    const tabPromises = visibleTabs.map(async (tab) => {
      // 只预构建固定 Tab（recommend/latest），标签 Tab 数据量不稳定且非首屏关键
      if (tab.type !== 'fixed') return
      const tabId = tab.fixedId
      if (!tabId || (tabId !== 'recommend' && tabId !== 'latest')) return

      const resourceType = tab.resourceType || 'all'
      const sort = tab.sortBy || (tabId === 'recommend' ? 'hot' : 'latest')

      try {
        const pageData = await fetchFirstPage(resourceType, sort, '')
        feed[tabId] = pageData
        console.log(`[prebuildHomeFeed] Tab "${tabId}" 预构建 ${pageData.list.length} 条`)
      } catch (e) {
        console.warn(`[prebuildHomeFeed] Tab "${tabId}" 预构建失败:`, e.message)
        feed[tabId] = { list: [], hasMore: false }
      }
    })

    await Promise.all(tabPromises)

    // 3. 写入 home_cache 集合（单文档 v1，前端直读库）
    const cacheData = {
      tabs,
      feed,
      updatedAt: db.serverDate()
    }

    try {
      await db.collection('home_cache').doc('v1').set({ data: cacheData })
      console.log('[prebuildHomeFeed] home_cache 写入成功')
    } catch (e) {
      // 集合不存在时尝试 add（首次部署）
      console.warn('[prebuildHomeFeed] home_cache set 失败，尝试 add:', e.message)
      try {
        await db.collection('home_cache').add({ data: { _id: 'v1', ...cacheData } })
        console.log('[prebuildHomeFeed] home_cache 首次写入成功')
      } catch (addErr) {
        console.error('[prebuildHomeFeed] home_cache 写入彻底失败:', addErr.message)
      }
    }

    const cost = Date.now() - startTime
    const totalItems = Object.values(feed).reduce((sum, f) => sum + (f.list?.length || 0), 0)
    console.log(`[prebuildHomeFeed] ✅ 预构建完成，耗时: ${cost}ms，tabs: ${tabs.length}，资源: ${totalItems} 条`)

    return {
      success: true,
      cost,
      tabsCount: tabs.length,
      totalItems,
      updatedAt: new Date().toISOString()
    }

  } catch (err) {
    console.error('[prebuildHomeFeed] ❌ 预构建失败:', err)
    return {
      success: false,
      error: err.message || String(err)
    }
  }
}
