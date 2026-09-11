const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 默认固定 Tab（始终保证存在）
const DEFAULT_FIXED_TABS = {
  recommend: { type: 'fixed', fixedId: 'recommend', title: '推荐', visible: true, resourceType: 'all', sortBy: 'hot' },
  latest: { type: 'fixed', fixedId: 'latest', title: '最新', visible: true, resourceType: 'all', sortBy: 'latest' }
}

exports.main = async (event, context) => {
  // 🔥 定时触发器保活：仅维持热实例，不执行业务查询（首页 Tab 配置在冷启动关键路径上）
  if (event && event.Type === 'timer') {
    return { success: true, message: 'keepalive', timestamp: Date.now() }
  }

  try {
    const res = await db.collection('home_tabs')
      .orderBy('sort', 'asc')
      .limit(50)
      .get()

    // 集合为空时返回默认配置
    if (!res.data || res.data.length === 0) {
      return { success: true, data: Object.values(DEFAULT_FIXED_TABS) }
    }

    const dbTabs = res.data.map(item => ({
      id: item._id,
      type: item.type || 'tag',
      fixedId: item.fixedId || '',
      title: item.title || '未命名',
      visible: item.visible !== false,
      sort: item.sort || 0,
      tag: item.tag || '',
      resourceType: item.resourceType || 'all',
      sortBy: item.sortBy || 'hot'
    }))

    // 检查数据库中是否已包含两个固定 Tab，缺失的用默认配置补齐
    const hasRecommend = dbTabs.some(t => t.type === 'fixed' && t.fixedId === 'recommend')
    const hasLatest = dbTabs.some(t => t.type === 'fixed' && t.fixedId === 'latest')

    const merged = []
    if (!hasRecommend) merged.push({ ...DEFAULT_FIXED_TABS.recommend, sort: 0 })
    if (!hasLatest) merged.push({ ...DEFAULT_FIXED_TABS.latest, sort: hasRecommend ? 1 : 0 })

    // 合并：缺失的固定 Tab + 数据库中的所有 Tab
    const finalTabs = [...merged, ...dbTabs]

    return { success: true, data: finalTabs }
  } catch (e) {
    console.error('getHomeTabs error:', e)
    // 出错时降级返回默认配置
    return { success: true, data: Object.values(DEFAULT_FIXED_TABS) }
  }
}
