const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 8位短码，排除易混淆字符
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8
const EXPIRE_DAYS = 7

function generateCode() {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length))
  }
  return code
}

async function createUniqueCode() {
  let attempts = 0
  while (attempts < 5) {
    const code = generateCode()
    const existing = await db.collection('share_codes')
      .where({ code })
      .limit(1)
      .get()
    if (existing.data.length === 0) {
      return code
    }
    attempts++
  }
  // 极低概率冲突，使用带时间戳的兜底
  return generateCode() + Date.now().toString(36).slice(-2)
}

const { withAdmin } = require('./withAdmin')

const handleRequest = async (event, context) => {
  try {
    const { action } = event

    // ====== 管理员操作（需 adminToken 鉴权）======
    if (action === 'adminList') {
      return await adminList(event)
    }
    if (action === 'adminStats') {
      return await adminStats(event)
    }
    if (action === 'adminDelete') {
      return await adminDelete(event)
    }

    if (action === 'encode') {
      const { resourceId, type = 'unknown' } = event
      if (!resourceId) {
        return { success: false, error: '缺少 resourceId' }
      }

      const code = await createUniqueCode()
      const expireAt = new Date(Date.now() + EXPIRE_DAYS * 24 * 60 * 60 * 1000)

      await db.collection('share_codes').add({
        data: {
          code,
          resourceId,
          type,
          expireAt,
          createdAt: new Date()
        }
      })

      return { success: true, code }
    }

    if (action === 'decode') {
      const { code } = event
      if (!code) {
        return { success: false, error: '缺少 code' }
      }

      const res = await db.collection('share_codes')
        .where({
          code,
          expireAt: _.gt(new Date())
        })
        .limit(1)
        .get()

      if (res.data.length === 0) {
        return { success: false, error: '分享码不存在或已过期' }
      }

      const item = res.data[0]
      return {
        success: true,
        resourceId: item.resourceId,
        type: item.type
      }
    }

    return { success: false, error: '未知 action' }
  } catch (err) {
    console.error('shareCode error:', err)
    return { success: false, error: err.message || '分享码服务异常' }
  }
}

// 🔒 P0-7：adminList / adminStats / adminDelete 原先完全零鉴权，
// 任意用户可拉取并删除全部分享码记录（原注释写着「需 adminToken 鉴权」但从未实现）。
//
// encode / decode 是普通用户正常使用分享功能所必需，保持公开。
// withAdmin 仅对未列在 exclude 中的 action 做鉴权。
exports.main = withAdmin(handleRequest, { exclude: ['encode', 'decode'] })

/**
 * 管理员：分页查询分享码列表
 */
async function adminList(event) {
  const { page = 1, limit = 20, resourceId } = event
  const skip = (page - 1) * limit

  let query = db.collection('share_codes')
  if (resourceId) {
    query = query.where({ resourceId })
  }

  try {
    const [countRes, listRes] = await Promise.all([
      query.count(),
      query.orderBy('createdAt', 'desc').skip(skip).limit(limit).get()
    ])

    // 批量查询资源标题
    const resIds = [...new Set(listRes.data.map(r => r.resourceId).filter(Boolean))]
    let resMap = new Map()
    if (resIds.length > 0) {
      for (let i = 0; i < resIds.length; i += 20) {
        const batch = resIds.slice(i, i + 20)
        const resBatch = await db.collection('resources')
          .where({ _id: _.in(batch), deletedAt: null })
          .field({ _id: true, title: true, coverUrl: true, type: true })
          .get()
          .catch(() => ({ data: [] }))
        resBatch.data.forEach(r => resMap.set(r._id, r))
      }
    }

    const records = listRes.data.map(r => ({
      ...r,
      resourceTitle: resMap.get(r.resourceId)?.title || '未知资源',
      resourceCover: resMap.get(r.resourceId)?.coverUrl || '',
      resourceType: resMap.get(r.resourceId)?.type || ''
    }))

    return {
      success: true,
      data: records,
      total: countRes.total || 0,
      page,
      limit
    }
  } catch (e) {
    console.error('[shareCode] adminList error:', e)
    return { success: false, error: '查询失败' }
  }
}

/**
 * 管理员：分享码统计概览
 */
async function adminStats(event) {
  try {
    const [totalRes, expiredRes, todayRes] = await Promise.all([
      db.collection('share_codes').count(),
      db.collection('share_codes').where({ expireAt: _.lt(new Date()) }).count(),
      db.collection('share_codes').where({
        createdAt: _.gte(new Date(new Date().setHours(0, 0, 0, 0)))
      }).count()
    ])

    // 热门资源 Top 10（按分享码数量排序）
    const hotRes = await db.collection('share_codes')
      .aggregate()
      .group({
        _id: '$resourceId',
        count: _.aggregate.sum(1)
      })
      .sort({ count: -1 })
      .limit(10)
      .end()

    // 批量查热门资源标题
    const hotIds = (hotRes.list || []).map(r => r._id).filter(Boolean)
    let hotMap = new Map()
    if (hotIds.length > 0) {
      const batch = await db.collection('resources')
        .where({ _id: _.in(hotIds), deletedAt: null })
        .field({ _id: true, title: true, coverUrl: true })
        .get()
        .catch(() => ({ data: [] }))
      batch.data.forEach(r => hotMap.set(r._id, r))
    }

    const hotResources = (hotRes.list || []).map(r => ({
      resourceId: r._id,
      shareCount: r.count,
      title: hotMap.get(r._id)?.title || '未知资源',
      coverUrl: hotMap.get(r._id)?.coverUrl || ''
    }))

    return {
      success: true,
      data: {
        total: totalRes.total || 0,
        expired: expiredRes.total || 0,
        active: (totalRes.total || 0) - (expiredRes.total || 0),
        todayCreated: todayRes.total || 0,
        hotResources
      }
    }
  } catch (e) {
    console.error('[shareCode] adminStats error:', e)
    return { success: false, error: '统计查询失败' }
  }
}

/**
 * 管理员：删除分享码
 */
async function adminDelete(event) {
  const { id } = event
  if (!id) {
    return { success: false, error: '缺少分享码 ID' }
  }
  try {
    await db.collection('share_codes').doc(id).remove()
    return { success: true, message: '已删除' }
  } catch (e) {
    return { success: false, error: '删除失败' }
  }
}
