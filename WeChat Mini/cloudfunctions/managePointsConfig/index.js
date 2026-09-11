const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const { withAdmin } = require('./withAdmin.js')

// 默认积分配置
const DEFAULT_CONFIG = {
  checkInReward: 10,
  shareReward: 10,
  shareDailyLimit: 5,
  inviteReward: 50,
  watchAdPoints: 20,
  watchAdDailyLimit: 15,
  quoteInterval: 7
}

exports.main = withAdmin(async (event, context, admin) => {
  const { action } = event

  try {
    switch (action) {
      case 'getConfig':
        return await getConfig()
      case 'updateConfig':
        return await updateConfig(event)
      case 'getPointsRecords':
        return await getPointsRecords(event)
      case 'adjustPoints':
        return await adjustPoints(event, admin)
      case 'getCheckInStats':
        return await getCheckInStats(event)
      default:
        return { success: false, message: `未知 action: ${action}` }
    }
  } catch (error) {
    console.error('[managePointsConfig] 错误:', error)
    return { success: false, message: error.message || '操作失败' }
  }
})

/**
 * 获取积分配置（优先读 points_config 集合，无则返回默认值）
 */
async function getConfig() {
  try {
    await ensureCollection()
    const res = await db.collection('points_config').limit(1).get()
    if (res.data.length > 0) {
      return { success: true, data: res.data[0] }
    }
    return { success: true, data: { ...DEFAULT_CONFIG, _isDefault: true } }
  } catch (e) {
    return { success: true, data: { ...DEFAULT_CONFIG, _isDefault: true } }
  }
}

/**
 * 更新积分配置（upsert）
 */
async function updateConfig(event) {
  const { data } = event
  if (!data || typeof data !== 'object') {
    return { success: false, message: '缺少配置数据' }
  }

  await ensureCollection()

  // 只允许更新白名单字段
  const allowedKeys = Object.keys(DEFAULT_CONFIG)
  const updateData = {}
  for (const key of allowedKeys) {
    if (data[key] !== undefined) {
      const val = Number(data[key])
      if (isNaN(val) || val < 0) {
        return { success: false, message: `${key} 必须为非负数` }
      }
      updateData[key] = val
    }
  }

  if (Object.keys(updateData).length === 0) {
    return { success: false, message: '无可更新的字段' }
  }
  updateData.updatedAt = new Date()

  const existing = await db.collection('points_config').limit(1).get()
  if (existing.data.length > 0) {
    await db.collection('points_config').doc(existing.data[0]._id).update({ data: updateData })
  } else {
    await db.collection('points_config').add({
      data: { ...DEFAULT_CONFIG, ...updateData, createdAt: new Date() }
    })
  }

  return { success: true, message: '配置已更新' }
}

/**
 * 分页查询积分流水（points_records 集合）
 */
async function getPointsRecords(event) {
  const { page = 1, limit = 20, userId, type, startDate, endDate } = event

  let query = db.collection('points_records')

  const conditions = {}
  if (userId) {
    conditions._openid = userId
  }
  if (type) {
    conditions.type = type
  }
  if (startDate || endDate) {
    const timeCondition = {}
    if (startDate) timeCondition.$gte = new Date(startDate)
    if (endDate) timeCondition.$lte = new Date(endDate)
    conditions.createdAt = _.and(Object.entries(timeCondition).map(([op, val]) => {
      if (op === '$gte') return _.gte(val)
      if (op === '$lte') return _.lte(val)
      return null
    }).filter(Boolean))
  }

  if (Object.keys(conditions).length > 0) {
    query = query.where(conditions)
  }

  const skip = (page - 1) * limit

  try {
    const [countRes, listRes] = await Promise.all([
      query.count(),
      query.orderBy('createdAt', 'desc').skip(skip).limit(limit).get()
    ])

    // 批量查用户昵称
    const openids = [...new Set(listRes.data.map(r => r._openid).filter(Boolean))]
    let usersMap = new Map()
    if (openids.length > 0) {
      // 分批查（in 最多 20）
      for (let i = 0; i < openids.length; i += 20) {
        const batch = openids.slice(i, i + 20)
        const usersRes = await db.collection('users')
          .where({ _openid: _.in(batch) })
          .field({ _openid: true, nickName: true, avatarUrl: true })
          .get()
          .catch(() => ({ data: [] }))
        usersRes.data.forEach(u => usersMap.set(u._openid, u))
      }
    }

    const records = listRes.data.map(r => ({
      ...r,
      nickName: usersMap.get(r._openid)?.nickName || '未知用户',
      avatarUrl: usersMap.get(r._openid)?.avatarUrl || ''
    }))

    return {
      success: true,
      data: records,
      total: countRes.total || 0,
      page,
      limit
    }
  } catch (e) {
    console.error('[managePointsConfig] 查询积分流水失败:', e)
    return { success: false, message: '查询失败: ' + e.message }
  }
}

/**
 * 管理员手动调整用户积分
 */
async function adjustPoints(event, admin) {
  const { userOpenid, delta, reason } = event

  if (!userOpenid) {
    return { success: false, message: '缺少用户 openid' }
  }
  if (typeof delta !== 'number' || delta === 0) {
    return { success: false, message: '积分变动值必须为非零数字' }
  }

  // 查找用户积分记录
  const userRes = await db.collection('user_points')
    .where({ _openid: userOpenid })
    .limit(1)
    .get()

  if (userRes.data.length === 0) {
    return { success: false, message: '用户积分记录不存在' }
  }

  const userDoc = userRes.data[0]
  const currentPoints = userRes.data[0].points || 0
  const newPoints = Math.max(0, currentPoints + delta)

  // 更新积分
  await db.collection('user_points').doc(userDoc._id).update({
    data: {
      points: newPoints,
      updatedAt: new Date()
    }
  })

  // 写入积分流水记录
  try {
    await db.collection('points_records').add({
      data: {
        _openid: userOpenid,
        type: 'admin_adjust',
        delta,
        points: newPoints,
        reason: reason || '管理员手动调整',
        operatedBy: admin?.username || 'admin',
        createdAt: new Date()
      }
    })
  } catch (e) {
    console.warn('[managePointsConfig] 写入积分流水失败:', e)
  }

  return {
    success: true,
    message: `积分已调整：${currentPoints} → ${newPoints}（${delta > 0 ? '+' : ''}${delta}）`,
    data: { previousPoints: currentPoints, newPoints, delta }
  }
}

/**
 * 获取签到统计（最近30天每日签到人数）
 */
async function getCheckInStats(event) {
  const { days = 30 } = event
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  try {
    // 查询最近 N 天内有签到记录的用户数
    const res = await db.collection('user_points')
      .where({ lastCheckInDate: _.gte(startDate) })
      .field({ lastCheckInDate: true, checkInDays: true, totalCheckInDays: true })
      .get()

    // 按日期聚合
    const dailyStats = {}
    const now = new Date()
    for (let i = 0; i < days; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      dailyStats[key] = { date: key, count: 0 }
    }

    res.data.forEach(u => {
      if (u.lastCheckInDate) {
        const key = new Date(u.lastCheckInDate).toISOString().slice(0, 10)
        if (dailyStats[key]) {
          dailyStats[key].count++
        }
      }
    })

    // 转为数组并按日期升序
    const stats = Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date))

    // 汇总
    const totalCheckIns = res.data.length
    const avgDaily = days > 0 ? Math.round(totalCheckIns / days) : 0
    const streakDistribution = {}
    res.data.forEach(u => {
      const streak = u.checkInDays || 0
      const bucket = streak >= 30 ? '30+' : streak >= 14 ? '14-29' : streak >= 7 ? '7-13' : streak >= 3 ? '3-6' : '1-2'
      streakDistribution[bucket] = (streakDistribution[bucket] || 0) + 1
    })

    return {
      success: true,
      data: {
        daily: stats,
        totalCheckIns,
        avgDaily,
        streakDistribution
      }
    }
  } catch (e) {
    console.error('[managePointsConfig] 获取签到统计失败:', e)
    return { success: false, message: '统计查询失败' }
  }
}

async function ensureCollection() {
  try {
    await db.createCollection('points_config')
  } catch (e) {
    // 集合已存在
  }
}
