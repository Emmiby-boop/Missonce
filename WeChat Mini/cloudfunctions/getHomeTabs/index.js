const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 默认固定 Tab（始终保证存在）
const DEFAULT_FIXED_TABS = {
  recommend: { type: 'fixed', fixedId: 'recommend', title: '推荐', visible: true, resourceType: 'all', sortBy: 'hot' },
  latest: { type: 'fixed', fixedId: 'latest', title: '最新', visible: true, resourceType: 'all', sortBy: 'latest' }
}

// 固定 Tab 的确定性主键（自愈写入用，重复插入会主键冲突，天然幂等）
const FIXED_IDS = { recommend: 'fixed_recommend', latest: 'fixed_latest' }

/** 数据库文档 → 对外返回结构（同时带 _id 与 id，兼容新旧前端取主键方式） */
const toApiTab = (item) => ({
  _id: item._id,
  id: item._id,
  type: item.type || 'tag',
  fixedId: item.fixedId || '',
  title: item.title || '未命名',
  visible: item.visible !== false,
  sort: item.sort || 0,
  tag: item.tag || '',
  resourceType: item.resourceType || 'all',
  sortBy: item.sortBy || 'hot'
})

/** 新建固定 Tab 的文档结构 */
const toFixedDoc = (key, sort) => ({
  _id: FIXED_IDS[key],
  type: 'fixed',
  fixedId: key,
  title: DEFAULT_FIXED_TABS[key].title,
  visible: true,
  sort,
  tag: '',
  resourceType: 'all',
  sortBy: DEFAULT_FIXED_TABS[key].sortBy,
  createTime: db.serverDate()
})

/**
 * 兜底用的默认 Tab 列表（集合为空 / 自愈失败 / 查询异常时返回）。
 * 必须带上确定性 _id，否则管理后台取不到主键，编辑/排序会静默降级成「新增」，
 * 这正是当初「热门排序保存不生效」的同一个坑。
 */
const toDefaultApiTabs = () =>
  Object.keys(DEFAULT_FIXED_TABS).map((key, index) => ({
    ...DEFAULT_FIXED_TABS[key],
    _id: FIXED_IDS[key],
    id: FIXED_IDS[key],
    sort: index
  }))

/**
 * 展示排序：保持旧版语义 —— 固定 Tab（推荐 → 最新）置顶，其余按 sort 升序。
 * 不能纯按 sort 排：历史 tag Tab 的 sort 可能是 0，会把固定 Tab 挤到后面。
 */
const sortForDisplay = (tabs) => [...tabs].sort((a, b) => {
  const rank = (t) => (t._id === FIXED_IDS.recommend ? -2 : t._id === FIXED_IDS.latest ? -1 : 0)
  const ra = rank(a)
  const rb = rank(b)
  if (ra !== rb) return ra - rb
  return (a.sort || 0) - (b.sort || 0)
})

/** 自愈写入缺失的固定 Tab（add + 自定义 _id，主键冲突即并发已插入，幂等） */
const healFixedTabs = async (missingKeys) => {
  const sorts = { recommend: 0, latest: 1 }
  await Promise.all(missingKeys.map(key =>
    db.collection('home_tabs').add({ data: toFixedDoc(key, sorts[key]) })
  ))
}

exports.main = async (event, context) => {
  // 🔥 定时触发器保活：仅维持热实例，不执行业务查询（首页 Tab 配置在冷启动关键路径上）
  if (event && event.Type === 'timer') {
    return { success: true, message: 'keepalive', timestamp: Date.now() }
  }

  try {
    let res = await db.collection('home_tabs')
      .orderBy('sort', 'asc')
      .limit(50)
      .get()

    // 自愈：固定 Tab（推荐/最新）缺失时写入数据库，而不是每次凭空拼虚拟对象。
    // 虚拟对象没有 _id，管理后台将无法编辑/排序/删除它们（「热门排序保存不生效」的根源）。
    const apiTabs = (res.data || []).map(toApiTab)
    const missingKeys = ['recommend', 'latest'].filter(
      key => !apiTabs.some(t => t.type === 'fixed' && t.fixedId === key)
    )

    if (missingKeys.length > 0) {
      try {
        await healFixedTabs(missingKeys)
        // 重新查询，保证返回的是带真实 _id 的完整列表
        res = await db.collection('home_tabs')
          .orderBy('sort', 'asc')
          .limit(50)
          .get()
      } catch (e) {
        // 自愈失败（如主键冲突）：本次降级拼虚拟对象，下次调用即恢复正常
        console.error('[getHomeTabs] 固定 Tab 自愈失败，降级为虚拟对象:', e)
        // 降级时同样必须带确定性 _id，否则管理后台无法编辑这两个 Tab
        const merged = missingKeys.map((key) => ({
          ...DEFAULT_FIXED_TABS[key],
          _id: FIXED_IDS[key],
          id: FIXED_IDS[key],
          sort: key === 'recommend' ? 0 : 1
        }))
        return { success: true, data: sortForDisplay([...merged, ...apiTabs]) }
      }
    }

    // 集合为空且自愈也失败（理论极小概率）：返回默认配置
    if (!res.data || res.data.length === 0) {
      return { success: true, data: toDefaultApiTabs() }
    }

    return { success: true, data: sortForDisplay(res.data.map(toApiTab)) }
  } catch (e) {
    console.error('getHomeTabs error:', e)
    // 出错时降级返回默认配置（同样带确定性 _id）
    return { success: true, data: toDefaultApiTabs() }
  }
}
