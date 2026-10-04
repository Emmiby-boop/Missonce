const { getResources } = require('../../../utils/api.js')
const { getStorage, setStorage } = require('../../../utils/storageManager')
const { STORAGE_KEYS } = require('../../../config/constants')

// 加载首页 Tab 配置（优先用缓存渲染，后台 callFunction 静默刷新）
// 🔥 幂等：多次调用共用同一个 Promise。依赖 tabConfig.sortBy 的加载器必须先 await
// 它（见 waitTabsReady），否则会读到 data 里的默认 sortBy='hot'，把后台配的随机排序覆盖掉
function loadCategoryTabs(page, cachedTabs) {
  if (page._tabsPromise) return page._tabsPromise
  page._tabsPromise = loadCategoryTabsOnce(page, cachedTabs)
  return page._tabsPromise
}

// 等待 Tab 配置就绪；未发起过加载或超时（1.5s）都直接放行，不拖慢首屏
async function waitTabsReady(page) {
  if (!page._tabsPromise) return
  try {
    await Promise.race([
      page._tabsPromise,
      new Promise(resolve => setTimeout(resolve, 1500))
    ])
  } catch (e) {
    // tabs 加载失败不影响资源拉取，用默认配置继续
  }
}

async function loadCategoryTabsOnce(page, cachedTabs) {
  if (page.data.categoryTabsLoaded) return

  // 🔥 优先用传入的缓存 tabs 或 storage 缓存立即渲染（秒开）
  const tabsFromCache = cachedTabs || getStorage(STORAGE_KEYS.HOME_TABS_CACHE)
  if (tabsFromCache && Array.isArray(tabsFromCache) && tabsFromCache.length > 0) {
    const tabs = page._normalizeTabs(tabsFromCache)
    if (tabs.length > 0) {
      page.setData({ categoryTabs: tabs, categoryTabsLoaded: true })
      page._ensureFirstTabLoaded(tabs)
      // 后台静默刷新 tabs 配置
      page._refreshTabsInBackground()
      // 🔥 后台预拉取所有标签 Tab 数据（用户切换时秒开）
      page._prefetchTagTabs()
      return
    }
  }

  // 无缓存：走网络
  try {
    const res = await wx.cloud.callFunction({ name: 'getHomeTabs', data: {} })
    if (res.result && res.result.success && Array.isArray(res.result.data)) {
      const allTabs = res.result.data
      const tabs = page._normalizeTabs(allTabs)

      if (tabs.length > 0) {
        page.setData({ categoryTabs: tabs, categoryTabsLoaded: true })
        // 写入 storage 持久化缓存
        setStorage(STORAGE_KEYS.HOME_TABS_CACHE, allTabs)
        page._ensureFirstTabLoaded(tabs)
        // 🔥 后台预拉取所有标签 Tab 数据（用户切换时秒开）
        page._prefetchTagTabs()
        return
      }
    }

    // 降级：默认推荐+最新
    page._setDefaultTabs()
  } catch (e) {
    console.error('loadCategoryTabs error:', e)
    page._setDefaultTabs()
  }
}

// 标准化 Tab 数据格式
function normalizeTabs(page, allTabs) {
  return allTabs
    .filter(t => t.visible !== false)
    .map(t => ({
      id: t.type === 'fixed' ? t.fixedId : t.tag,
      name: t.title,
      type: t.type,
      fixedId: t.fixedId || '',
      tag: t.tag || '',
      resourceType: t.resourceType || 'all',
      sortBy: t.sortBy || 'hot'
    }))
}

// 确保当前 Tab 的资源已加载
function ensureFirstTabLoaded(page, tabs) {
  const firstTabId = tabs[0].id
  if (firstTabId && page.data.activeCategory !== firstTabId) {
    page.setData({ activeCategory: firstTabId })
    if (firstTabId === 'recommend') {
      if (!page.data.recommendLoaded) page.loadRecommendResources()
    } else if (firstTabId === 'latest') {
      if (!page.data.latestLoaded) page.loadLatestResources()
    } else {
      page.loadTagResources()
    }
  }
}

// 后台静默刷新 tabs 配置
async function refreshTabsInBackground(page) {
  try {
    const res = await wx.cloud.callFunction({ name: 'getHomeTabs', data: {} })
    if (res.result && res.result.success && Array.isArray(res.result.data)) {
      const tabs = page._normalizeTabs(res.result.data)
      if (tabs.length > 0) {
        page.setData({ categoryTabs: tabs })
        setStorage(STORAGE_KEYS.HOME_TABS_CACHE, res.result.data)
        // 🔥 tabs 刷新后重置预拉取标志，预拉取新增的标签 Tab
        page._tagPrefetched = false
        page._prefetchTagTabs()
      }
    }
  } catch (e) {
    console.warn('[index] 获取标签页失败，降级处理:', e)
  }
}

// 降级：默认推荐+最新
function setDefaultTabs(page) {
  page.setData({
    categoryTabs: [
      { id: 'recommend', name: '推荐', type: 'fixed', fixedId: 'recommend', resourceType: 'all', sortBy: 'hot' },
      { id: 'latest', name: '最新', type: 'fixed', fixedId: 'latest', resourceType: 'all', sortBy: 'latest' }
    ],
    categoryTabsLoaded: true
  })
}

// 点击分类 Tab
function onCategoryTap(page, e) {
  const categoryId = e.currentTarget.dataset.id
  const index = e.currentTarget.dataset.index
  if (!categoryId || categoryId === page.data.activeCategory) return

  // 🔥 切换 Tab 时重置预加载索引（新列表从顶部开始）
  page._lastVisibleIndex = 0

  // 🔥 切换 Tab 时把页面滚动位置重置到顶部（避免新 Tab 仍停留在原滚动偏移）
  wx.pageScrollTo({ scrollTop: 0, duration: 0 })

  // 🔥 修复虚拟滚动状态残留：切换 Tab 时重置 waterfallScrollTop
  // 否则上一个 Tab 的滚动位置会传递给新 Tab 的 waterfall，导致可见区间计算错误
  page._lastVsScrollTop = 0
  if (page._vsScrollTimer) {
    clearTimeout(page._vsScrollTimer)
    page._vsScrollTimer = null
  }
  page.setData({ waterfallScrollTop: 0 })

  // 🔥 智能滚动：让选中标签滚到靠前位置（类似第2-3个位置），露出后续标签
  page._scrollTabToView(index)

  // 切换到推荐 Tab：显示推荐资源瀑布流
  if (categoryId === 'recommend') {
    page.setData({ activeCategory: 'recommend' })
    // 如果推荐资源还没加载，触发加载
    if (!page.data.recommendLoaded && page.data.recommendResources.length === 0) {
      page.loadRecommendResources()
    }
    return
  }

  // 切换到最新 Tab：优先用内存缓存渲染，后台静默刷新
  if (categoryId === 'latest') {
    const latestCached = page._latestCache
    if (latestCached && latestCached.resources && latestCached.resources.length > 0) {
      // 命中缓存：立即渲染，后台静默刷新
      page.setData({
        activeCategory: 'latest',
        latestResources: latestCached.resources,
        latestAdCounter: latestCached.adCounter,
        latestPage: latestCached.page,
        latestHasMore: latestCached.hasMore,
        latestLoaded: true
      })
      page._refreshLatestInBackground()
    } else {
      page.setData({ activeCategory: 'latest' })
      if (!page.data.latestLoaded && page.data.latestResources.length === 0) {
        page.loadLatestResources()
      }
    }
    return
  }

  // 切换到标签 Tab：优先用缓存渲染，后台静默刷新
  const cached = page._tagCache[categoryId]
  if (cached && cached.resources && cached.resources.length > 0) {
    // 立即显示缓存数据，避免白屏
    page.setData({
      activeCategory: categoryId,
      tagResources: cached.resources,
      tagAdCounter: cached.adCounter,
      tagPage: 1,
      tagHasMore: true,
      tagLoading: false
    })
    // 后台静默刷新第一页（不显示 loading，不阻塞渲染）
    page._refreshTagInBackground(categoryId)
  } else {
    // 无缓存，正常加载
    page.setData({
      activeCategory: categoryId,
      tagResources: [],
      tagAdCounter: 0,
      tagPage: 1,
      tagHasMore: true
    })
    page.loadTagResources()
  }
}

// Tab 栏滚动事件：同步当前实际滚动位置
function onTabScroll(page, e) {
  page._tabScrollLeft = e.detail.scrollLeft
}

// 智能滚动：让选中 tab 出现在 scroll-view 宽度 1/4 处（靠左，类似第2-3个位置）
function scrollTabToView(page, index) {
  const query = page.createSelectorQuery()
  query.select('.category-sticky').boundingClientRect()
  query.select(`#tab-${index}`).boundingClientRect()
  query.exec(res => {
    if (!res || !res[0] || !res[1]) return
    const scrollView = res[0]
    const tab = res[1]
    if (!scrollView.width || !tab.width) return

    // 当前 tab 中心点在 scroll-view 视口中的偏移
    const tabOffsetInViewport = tab.left - scrollView.left + tab.width / 2
    // 目标位置：scroll-view 宽度的 1/2 处（居中，让用户看到前后都有标签）
    const targetOffset = scrollView.width * 0.5
    // 需要滚动的增量
    const delta = tabOffsetInViewport - targetOffset
    // 新的 scrollLeft = 当前实际 scrollLeft + 增量（不小于 0）
    const newScrollLeft = Math.max(0, (page._tabScrollLeft || 0) + delta)
    page.setData({ tabScrollLeft: newScrollLeft })
  })
}

// 后台静默刷新标签第一页（有缓存时调用，不显示 loading）
async function refreshTagInBackground(page, tag) {
  try {
    // 取 Tab 配置前先等就绪，避免读到默认 sortBy
    await waitTabsReady(page)
    // 读取当前标签 Tab 的 resourceType 和 sortBy 配置
    const tabConfig = page.data.categoryTabs.find(t => t.id === tag) || {}
    const resourceType = tabConfig.resourceType || 'all'
    const sortBy = tabConfig.sortBy || 'hot'

    const res = await getResources({
      type: resourceType,
      tag: tag,
      sort: sortBy,
      page: 1,
      pageSize: 20,
      includeMeta: false  // 首页不需要分类标签元数据
    })

    if (res.result && res.result.success && Array.isArray(res.result.data)) {
      const newItems = page._processResourceItems(res.result.data)

      const merged = page._mergeInspirationCards(newItems, 0)
      const withAd = page._injectAdCard(merged, 0, 'ad-tag')
      const adAdded = withAd.filter(it => it && it._cardType === 'ad').length

      // 更新缓存
      page._tagCache[tag] = {
        resources: withAd,
        adCounter: adAdded,
        timestamp: Date.now()
      }

      // 只有当前还在该标签时才更新 UI
      if (page.data.activeCategory === tag) {
        page.setData({
          tagResources: withAd,
          tagAdCounter: adAdded,
          tagPage: 2,
          tagHasMore: res.result.hasMore !== false && newItems.length >= 20
        })
      }
    }
  } catch (e) {
    console.warn('[首页] 后台刷新标签失败:', e)
  }
}

// 🔥 后台预拉取所有标签 Tab 第一页数据（首屏渲染完成后触发，用户切换 Tab 时秒开）
function prefetchTagTabs(page) {
  // 防重：已预拉取过则跳过
  if (page._tagPrefetched) return
  // 需 tabs 已加载
  const tabs = page.data.categoryTabs || []
  if (tabs.length === 0) return

  page._tagPrefetched = true
  console.log('[首页] 开始后台预拉取标签 Tab 数据')

  // 筛选需要预拉取的标签 Tab（type !== 'fixed' 且尚无缓存的）
  const tabsToPrefetch = tabs.filter(t => {
    if (t.type === 'fixed') return false  // 固定 Tab 已有独立缓存机制
    if (!t.id) return false
    const cached = page._tagCache[t.id]
    // 已有缓存且非空则跳过
    if (cached && cached.resources && cached.resources.length > 0) return false
    return true
  })

  if (tabsToPrefetch.length === 0) {
    console.log('[首页] 所有标签 Tab 已有缓存，无需预拉取')
    return
  }

  console.log(`[首页] 预拉取 ${tabsToPrefetch.length} 个标签 Tab:`, tabsToPrefetch.map(t => t.id).join(', '))

  // 串行预拉取（避免瞬间大量并发请求影响性能）
  const prefetchNext = (index) => {
    if (index >= tabsToPrefetch.length) {
      console.log('[首页] 标签 Tab 预拉取全部完成')
      return
    }
    const tab = tabsToPrefetch[index]
    page._refreshTagInBackground(tab.id).finally(() => {
      prefetchNext(index + 1)
    })
  }
  prefetchNext(0)
}

module.exports = {
  loadCategoryTabs,
  waitTabsReady,
  normalizeTabs,
  ensureFirstTabLoaded,
  refreshTabsInBackground,
  setDefaultTabs,
  onCategoryTap,
  onTabScroll,
  scrollTabToView,
  refreshTagInBackground,
  prefetchTagTabs
}
