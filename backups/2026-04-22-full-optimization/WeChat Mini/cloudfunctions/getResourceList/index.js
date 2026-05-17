const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate

/**
 * 通用资源列表获取
 * 支持动态排序、筛选、分页
 */
exports.main = async (event, context) => {
  try {
    const {
      type = 'all',           // 资源类型: wallpaper | avatar | all
      category,               // 分类筛选
      tag,                   // 标签筛选
      keyword,                // 关键词搜索
      sortField = 'createTime', // 排序字段
      sortOrder = 'desc',    // 排序方向: desc | asc
      page = 1,
      pageSize = 20,
      excludeIds = []         // 排除的ID（用于推荐）
    } = event

    // 构建查询条件
    const conditions = { status: 'published' }

    // 资源类型
    if (type && type !== 'all') {
      conditions.type = type
    } else {
      conditions.type = _.in(['wallpaper', 'avatar'])
    }

    // 分类筛选
    if (category && category !== 'all') {
      conditions.categories = _.in([category])
    }

    // 标签筛选
    if (tag) {
      const tags = Array.isArray(tag) ? tag : tag.split(/[,，]/).map(t => t.trim()).filter(t => t)
      if (tags.length > 0) {
        conditions.tags = _.in(tags)
      }
    }

    // 关键词搜索
    if (keyword) {
      conditions.title = db.RegExp({
        regexp: keyword,
        options: 'i'
      })
    }

    // 排除ID
    if (excludeIds && excludeIds.length > 0) {
      conditions._id = _.nin(excludeIds.slice(0, 50))
    }

    // 排序字段映射
    const SORT_FIELD_MAP = {
      'createTime': 'createdAt',
      'createdAt': 'createdAt',
      'hotScore': 'hotScore',
      'viewCount': 'hotScore',
      'views': 'hotScore',
      'likeCount': 'favorites',
      'favorites': 'favorites',
      'downloadCount': 'downloads',
      'downloads': 'downloads'
    }

    const dbSortField = SORT_FIELD_MAP[sortField] || 'createdAt'
    const validSortFields = ['createdAt', 'hotScore', 'favorites', 'downloads']
    const finalSortField = validSortFields.includes(dbSortField) ? dbSortField : 'createdAt'

    // 构建查询
    let query = db.collection('resources').where(conditions)

    // 排序
    query = query.orderBy(finalSortField, sortOrder === 'asc' ? 'asc' : 'desc')
    // 如果不是按时间排序，增加时间作为二级排序
    if (finalSortField !== 'createdAt') {
      query = query.orderBy('createdAt', 'desc')
    }

    // 分页
    const skip = (page - 1) * pageSize
    query = query.skip(skip).limit(pageSize)

    // 执行查询
    const result = await query.get()

    // 获取总数（用于分页）
    const countResult = await db.collection('resources').where(conditions).count()

    return {
      success: true,
      data: {
        list: result.data,
        total: countResult.total,
        page,
        pageSize,
        hasMore: skip + result.data.length < countResult.total
      }
    }

  } catch (err) {
    console.error('getResourceList error:', err)
    return {
      success: false,
      error: err.message
    }
  }
}
