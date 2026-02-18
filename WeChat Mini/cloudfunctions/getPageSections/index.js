const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate

/**
 * 获取页面板块配置
 * 支持页面: home, avatar, wallpaper
 */
exports.main = async (event, context) => {
  const { page = 'home' } = event

  try {
    // 根据页面名称映射到对应的集合
    const collectionMap = {
      'home': 'home_sections',
      'avatar': 'avatar_sections',
      'wallpaper': 'wallpaper_sections'
    }

    const collectionName = collectionMap[page] || 'home_sections'

    // 获取板块配置
    const sectionsRes = await db.collection(collectionName)
      .where({ enable: true })
      .orderBy('sort', 'asc')
      .get()

    const sectionsConfig = sectionsRes.data

    // 如果没有配置，返回空数组（前端可使用默认布局）
    if (!sectionsConfig || sectionsConfig.length === 0) {
      return {
        success: true,
        data: [],
        message: '暂无板块配置'
      }
    }

    // 获取每个板块的数据
    const sectionDataPromises = sectionsConfig.map(async (config) => {
      const dataSource = config.dataSource || {}
      const queryConfig = config.queryConfig || {}

      const sourceType = dataSource.type || 'automatic'
      const limit = Number(dataSource.limit || queryConfig.limit) || 10

      let items = []

      // --- 数据源类型处理 ---
      // 手动精选
      if (sourceType === 'manual' && dataSource.manualItems?.length > 0) {
        const manualRes = await db.collection('resources')
          .where({
            _id: _.in(dataSource.manualItems),
            status: 'published'
          })
          .get()

        items = dataSource.manualItems
          .map(id => manualRes.data.find(item => item._id === id))
          .filter(item => item)
      }
      // 智能推荐
      else if (sourceType === 'recommendation') {
        const rule = dataSource.recommendationRule || 'trending_now'
        const recResourceType = dataSource.resourceType || 'all'

        let matchStage = { status: 'published' }
        if (recResourceType && recResourceType !== 'all') {
          matchStage.type = recResourceType
        } else {
          matchStage.type = _.in(['wallpaper', 'avatar'])
        }

        if (rule === 'random_discovery') {
          const sampleRes = await db.collection('resources')
            .aggregate()
            .match(matchStage)
            .sample({ size: limit })
            .end()
          items = sampleRes.list
        } else {
          const trendRes = await db.collection('resources')
            .where(matchStage)
            .orderBy('hotScore', 'desc')
            .orderBy('createTime', 'desc')
            .limit(limit)
            .get()
          items = trendRes.data
        }
      }
      // 自动筛选（默认）
      else {
        items = await queryResources(dataSource, queryConfig, limit)
      }

      return {
        ...config,
        items
      }
    })

    const sectionsData = await Promise.all(sectionDataPromises)

    return {
      success: true,
      data: sectionsData
    }

  } catch (err) {
    console.error('getPageSections error:', err)
    return {
      success: false,
      error: err.message
    }
  }
}

/**
 * 查询资源数据
 */
async function queryResources(dataSource, queryConfig, limit) {
  const resourceType = dataSource.resourceType || queryConfig.resourceType || 'all'
  const category = dataSource.category || queryConfig.category
  const tagsRaw = dataSource.tags || queryConfig.tags
  const autoSplit = dataSource.autoSplit === true
  const rawSortField = dataSource.sortField || queryConfig.sortField || 'createTime'

  // 排序字段映射
  const SORT_FIELD_MAP = {
    'createTime': 'createdAt',
    'createdAt': 'createdAt',
    'hotScore': 'hotScore',
    'viewCount': 'hotScore',
    'likeCount': 'favorites',
    'favorites': 'favorites',
    'downloadCount': 'downloads',
    'downloads': 'downloads'
  }
  const sortField = SORT_FIELD_MAP[rawSortField] || 'createdAt'

  const conditions = { status: 'published' }

  // 资源类型筛选
  if (resourceType && resourceType !== 'all') {
    conditions.type = resourceType
  }

  // 分类筛选
  if (category && category !== 'all') {
    conditions.categories = _.in([category])
  }

  // 标签筛选
  let filterTags = []
  if (tagsRaw) {
    filterTags = Array.isArray(tagsRaw) ? tagsRaw : 
      typeof tagsRaw === 'string' ? tagsRaw.split(/[,，]/).map(t => t.trim()).filter(t => t) : []
  }

  let queryConditions = conditions
  if (filterTags.length > 0) {
    const tagOrConditions = filterTags.map(t => ({ tags: t }))
    queryConditions = _.and(conditions, _.or(tagOrConditions))
  }

  // 混合类型处理
  if (resourceType === 'all' && !autoSplit) {
    const validSortFields = ['createdAt', 'hotScore', 'favorites', 'downloads']
    const sortFieldName = validSortFields.includes(sortField) ? sortField : 'createdAt'

    const wallpaperRes = await db.collection('resources')
      .where({ ...queryConditions, type: 'wallpaper' })
      .orderBy(sortFieldName, 'desc')
      .limit(limit)
      .get()

    const avatarRes = await db.collection('resources')
      .where({ ...queryConditions, type: 'avatar' })
      .orderBy(sortFieldName, 'desc')
      .limit(limit)
      .get()

    return [...wallpaperRes.data, ...avatarRes.data]
  }

  // 普通查询
  const validSortFields = ['createdAt', 'hotScore', 'favorites', 'downloads']
  let query = db.collection('resources').where(queryConditions)

  if (validSortFields.includes(sortField)) {
    query = query.orderBy(sortField, 'desc')
    if (sortField !== 'createdAt') {
      query = query.orderBy('createdAt', 'desc')
    }
  } else {
    query = query.orderBy('createdAt', 'desc')
  }

  const result = await query.limit(limit).get()
  return result.data
}
