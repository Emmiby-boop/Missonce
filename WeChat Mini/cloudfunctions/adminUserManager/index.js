const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const { withAdmin } = require('./withAdmin.js')

// 会员等级配置
const MEMBER_LEVELS = {
  none: { name: '非会员', days: 0 },
  weekly: { name: '周卡会员', days: 7 },
  monthly: { name: '月卡会员', days: 30 },
  quarterly: { name: '季卡会员', days: 90 },
  yearly: { name: '年卡会员', days: 365 },
  lifetime: { name: '终身会员', days: 0 }
}

exports.main = withAdmin(async (event, context, admin) => {
  const { action } = event

  try {
    switch (action) {
      case 'searchUser':
        return await searchUser(event)
      case 'updateMembership':
        return await updateMembership(event)
      case 'getUserList':
        return await getUserList(event)
      case 'resetWatchAdCount':
        return await resetWatchAdCount(event)
      case 'getMemberList':
        return await getMemberList(event)
      case 'getMemberStats':
        return await getMemberStats()
      case 'updateMemberPrices':
        return await updateMemberPrices(event)
      case 'getMemberPrices':
        return await getMemberPrices()
      default:
        return { success: false, message: `未知 action: ${action}` }
    }
  } catch (error) {
    console.error('[adminUserManager] 错误:', error)
    return {
      success: false,
      message: error.message || '操作失败，请稍后重试'
    }
  }
})

/**
 * 按用户 ID 后缀搜索用户
 * 用户看到的 ID 是 openid 最后6位大写，这里同时匹配 _openid（系统字段）和 openid（自定义字段）
 * 策略：先查 users 集合的 openid 字段正则匹配，再拿结果去 user_points 查
 */
async function searchUser(event) {
  const { keyword } = event

  if (!keyword || keyword.trim().length === 0) {
    return { success: false, message: '请输入搜索关键词' }
  }

  const trimmed = keyword.trim().toUpperCase()

  // 构建正则匹配 openid 末尾（大小写不敏感）
  const reg = db.RegExp({
    regexp: trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$',
    options: 'i'
  })

  try {
    // users 集合用 openid 字段搜索（自定义字段，支持正则）
    const usersRes = await db.collection('users')
      .where({ openid: reg })
      .limit(20)
      .get()
      .catch(() => ({ data: [] }))

    if (usersRes.data.length === 0) {
      return { success: true, data: [], total: 0 }
    }

    // 提取找到的 openid 列表
    const foundOpenids = usersRes.data.map(u => u.openid)

    // 用 openid 列表去 user_points 精确匹配 _openid
    const pointsRes = await db.collection('user_points')
      .where({ _openid: _.in(foundOpenids) })
      .limit(20)
      .get()
      .catch(() => ({ data: [] }))

    // 建立 openid -> user 映射
    const usersMap = new Map()
    usersRes.data.forEach(u => {
      // users 集合用 openid 字段存，但系统注入的 _openid 也可能有值
      usersMap.set(u.openid, u)
    })

    // 建立 openid -> points 映射
    const pointsMap = new Map()
    pointsRes.data.forEach(p => pointsMap.set(p._openid, p))

    // 合并结果
    const results = []
    foundOpenids.forEach(openid => {
      const userInfo = usersMap.get(openid) || {}
      const pointsInfo = pointsMap.get(openid) || {}

      results.push({
        _openid: openid,
        _id: pointsInfo._id || userInfo._id,
        nickName: userInfo.nickName || '未知用户',
        avatarUrl: userInfo.avatarUrl || '',
        registeredAt: userInfo.createdAt || userInfo.registeredAt || null,
        lastLoginAt: userInfo.lastLoginAt || null,
        points: pointsInfo.points || 0,
        memberLevel: pointsInfo.memberLevel || 'none',
        memberExpireDate: pointsInfo.memberExpireDate || null,
        bonusDownloads: pointsInfo.bonusDownloads || 0,
        downloadsRemaining: pointsInfo.downloadsRemaining || 0,
        checkInDays: pointsInfo.checkInDays || 0,
        totalCheckInDays: pointsInfo.totalCheckInDays || 0,
        skipAd: !!pointsInfo.skipAd,
        updatedAt: pointsInfo.updatedAt || null,
        hasPointsRecord: pointsMap.has(openid)
      })
    })

    return {
      success: true,
      data: results,
      total: results.length
    }
  } catch (err) {
    console.error('[adminUserManager] 搜索用户失败:', err)
    return { success: false, message: '搜索失败，请稍后重试' }
  }
}

/**
 * 修改用户会员等级和过期时间
 */
async function updateMembership(event) {
  const { userOpenid, memberLevel, memberExpireDate, points, skipAd } = event

  if (!userOpenid) {
    return { success: false, message: '缺少用户 openid' }
  }

  if (!MEMBER_LEVELS[memberLevel]) {
    return { success: false, message: `无效的会员等级: ${memberLevel}` }
  }

  try {
    // 查找用户在 user_points 中的记录
    const userRes = await db.collection('user_points')
      .where({ _openid: userOpenid })
      .limit(1)
      .get()

    const updateData = {
      memberLevel: memberLevel,
      updatedAt: new Date()
    }

    // 计算过期时间
    if (memberLevel === 'lifetime') {
      updateData.memberExpireDate = new Date('2099-12-31')
    } else if (memberExpireDate) {
      updateData.memberExpireDate = new Date(memberExpireDate)
    } else if (memberLevel === 'none') {
      updateData.memberExpireDate = null
    } else {
      // 根据等级计算默认天数
      const days = MEMBER_LEVELS[memberLevel].days
      if (days > 0) {
        const expireDate = new Date()
        expireDate.setDate(expireDate.getDate() + days)
        updateData.memberExpireDate = expireDate
      }
    }

    // 如果传了积分，也一并更新
    if (typeof points === 'number' && points >= 0) {
      updateData.points = points
    }

    // 如果传了 skipAd 开关，更新
    if (typeof skipAd === 'boolean') {
      updateData.skipAd = skipAd
    }

    if (userRes.data.length > 0) {
      // 已有记录，直接更新
      await db.collection('user_points').doc(userRes.data[0]._id).update({
        data: updateData
      })
    } else {
      // 无记录，创建一条
      await db.collection('user_points').add({
        data: {
          _openid: userOpenid,
          ...updateData,
          bonusDownloads: 0,
          downloadsRemaining: 0,
          checkInDays: 0,
          totalCheckInDays: 0,
          createdAt: new Date()
        }
      })
    }

    // 记录操作日志到 member_records
    try {
      await db.collection('member_records').add({
        data: {
          _openid: userOpenid,
          memberLevel: memberLevel,
          expireDate: updateData.memberExpireDate,
          operatedBy: 'admin-web',
          operatedAt: new Date(),
          remark: '管理员手动设置'
        }
      })
    } catch (logErr) {
      console.warn('[adminUserManager] 记录会员变更日志失败:', logErr)
      // 不阻断主流程
    }

    console.log(`[adminUserManager] 管理员已将用户 ${userOpenid.slice(-6)} 会员等级设为 ${memberLevel}`)

    return {
      success: true,
      message: `会员等级已更新为${MEMBER_LEVELS[memberLevel].name}`,
      data: updateData
    }
  } catch (err) {
    console.error('[adminUserManager] 更新会员失败:', err)
    return { success: false, message: '更新失败，请稍后重试' }
  }
}

/**
 * 分页获取用户列表
 */
async function getUserList(event) {
  const { page = 1, limit = 20, filter } = event
  const skip = (page - 1) * limit

  try {
    // 按 filter 构造查询条件与总数统计
    // - all:      user_points 全量
    // - member:   会员（memberLevel != none）
    // - normal:   非会员（memberLevel == none）
    // - today:    今日新增（registeredAt/createdAt 在今天 0 点之后）
    let countQuery = db.collection('user_points')
    let listQuery = db.collection('user_points').orderBy('updatedAt', 'desc')

    if (filter === 'member') {
      countQuery = countQuery.where({ memberLevel: _.neq('none') })
      listQuery = listQuery.where({ memberLevel: _.neq('none') })
    } else if (filter === 'normal') {
      countQuery = countQuery.where({ memberLevel: 'none' })
      listQuery = listQuery.where({ memberLevel: 'none' })
    } else if (filter === 'today') {
      // 今日活跃/新增：以 users 集合的 registeredAt 为口径，统计今日注册的真实用户数
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayCountRes = await db.collection('users')
        .where({ createdAt: _.gte(todayStart) })
        .count()
      const total = todayCountRes.total || 0
      // today 维度下列表仅作展示，按 limit 取最近注册用户
      const recentRes = await db.collection('users')
        .where({ createdAt: _.gte(todayStart) })
        .orderBy('createdAt', 'desc')
        .skip(skip)
        .limit(limit)
        .get()
      const results = recentRes.data.map(u => ({
        _openid: u._openid || '',
        _id: u._id,
        nickName: u.nickName || '未知用户',
        avatarUrl: u.avatarUrl || '',
        registeredAt: u.createdAt || null,
        lastLoginAt: u.lastLoginAt || null,
        memberLevel: u.memberLevel || 'none',
        hasPointsRecord: false
      }))
      return { success: true, data: results, total, page, limit }
    }

    const [countRes, pointsRes] = await Promise.all([
      countQuery.count(),
      listQuery.skip(skip).limit(limit).get()
    ])

    // 批量查询用户基本信息
    const openids = pointsRes.data.map(p => p._openid)
    let usersMap = new Map()

    if (openids.length > 0) {
      const usersRes = await db.collection('users')
        .where({ _openid: _.in(openids) })
        .limit(openids.length)
        .get()
        .catch(() => ({ data: [] }))

      usersRes.data.forEach(u => usersMap.set(u._openid, u))
    }

    const results = pointsRes.data.map(p => {
      const userInfo = usersMap.get(p._openid) || {}
      return {
        _openid: p._openid,
        _id: p._id,
        nickName: userInfo.nickName || '未知用户',
        avatarUrl: userInfo.avatarUrl || '',
        registeredAt: userInfo.createdAt || null,
        lastLoginAt: userInfo.lastLoginAt || null,
        points: p.points || 0,
        memberLevel: p.memberLevel || 'none',
        memberExpireDate: p.memberExpireDate || null,
        checkInDays: p.checkInDays || 0,
        totalCheckInDays: p.totalCheckInDays || 0,
        bonusDownloads: p.bonusDownloads || 0,
        downloadsRemaining: p.downloadsRemaining || 0,
        skipAd: !!p.skipAd,
        todayWatchAdCount: p.todayWatchAdCount || 0,
        updatedAt: p.updatedAt || null,
        hasPointsRecord: true
      }
    })

    return {
      success: true,
      data: results,
      total: countRes.total || 0,
      page,
      limit
    }
  } catch (err) {
    console.error('[adminUserManager] 获取用户列表失败:', err)
    return { success: false, message: '获取用户列表失败' }
  }
}

/**
 * 获取会员列表（仅会员用户，支持按等级筛选）
 */
async function getMemberList(event) {
  const { page = 1, limit = 20, memberLevel, sortField = 'updatedAt', sortOrder = 'desc' } = event
  const skip = (page - 1) * limit

  try {
    const conditions = { memberLevel: _.neq('none') }
    if (memberLevel && memberLevel !== 'all') {
      conditions.memberLevel = memberLevel
    }

    const query = db.collection('user_points').where(conditions)

    const [countRes, listRes] = await Promise.all([
      query.count(),
      query.orderBy(sortField, sortOrder).skip(skip).limit(limit).get()
    ])

    // 批量查用户信息
    const openids = listRes.data.map(p => p._openid)
    let usersMap = new Map()
    if (openids.length > 0) {
      const usersRes = await db.collection('users')
        .where({ _openid: _.in(openids) })
        .limit(openids.length)
        .get()
        .catch(() => ({ data: [] }))
      usersRes.data.forEach(u => usersMap.set(u._openid, u))
    }

    const results = listRes.data.map(p => {
      const userInfo = usersMap.get(p._openid) || {}
      return {
        _openid: p._openid,
        _id: p._id,
        nickName: userInfo.nickName || '未知用户',
        avatarUrl: userInfo.avatarUrl || '',
        memberLevel: p.memberLevel || 'none',
        memberExpireDate: p.memberExpireDate || null,
        points: p.points || 0,
        checkInDays: p.checkInDays || 0,
        updatedAt: p.updatedAt || null
      }
    })

    return {
      success: true,
      data: results,
      total: countRes.total || 0,
      page,
      limit
    }
  } catch (err) {
    console.error('[adminUserManager] 获取会员列表失败:', err)
    return { success: false, message: '获取会员列表失败' }
  }
}

/**
 * 会员统计概览
 */
async function getMemberStats() {
  try {
    const totalRes = await db.collection('user_points')
      .where({ memberLevel: _.neq('none') })
      .count()

    // 各等级人数
    const levelStats = {}
    for (const level of ['weekly', 'monthly', 'quarterly', 'yearly', 'lifetime']) {
      const res = await db.collection('user_points')
        .where({ memberLevel: level })
        .count()
      levelStats[level] = res.total || 0
    }

    // 即将到期（7天内）
    const soon = new Date()
    soon.setDate(soon.getDate() + 7)
    const expiringRes = await db.collection('user_points')
      .where({
        memberLevel: _.neq('none').and(_.neq('lifetime')),
        memberExpireDate: _.lte(soon).and(_.gte(new Date()))
      })
      .count()

    // 已过期
    const expiredRes = await db.collection('user_points')
      .where({
        memberLevel: _.neq('none').and(_.neq('lifetime')),
        memberExpireDate: _.lt(new Date())
      })
      .count()

    return {
      success: true,
      data: {
        totalMembers: totalRes.total || 0,
        levelStats,
        expiringSoon: expiringRes.total || 0,
        expired: expiredRes.total || 0
      }
    }
  } catch (err) {
    console.error('[adminUserManager] 获取会员统计失败:', err)
    return { success: false, message: '统计查询失败' }
  }
}

/**
 * 更新会员定价（积分兑换价格）
 */
async function updateMemberPrices(event) {
  const { prices } = event
  if (!prices || typeof prices !== 'object') {
    return { success: false, message: '缺少定价数据' }
  }

  const allowedLevels = ['weekly', 'monthly', 'quarterly', 'yearly', 'lifetime']
  const updateData = {}
  for (const level of allowedLevels) {
    if (prices[level] !== undefined) {
      const val = Number(prices[level])
      if (isNaN(val) || val < 0) {
        return { success: false, message: `${level} 定价必须为非负数` }
      }
      updateData[level] = val
    }
  }

  if (Object.keys(updateData).length === 0) {
    return { success: false, message: '无可更新的定价' }
  }

  const existing = await db.collection('config')
    .where({ key: 'member_prices' })
    .limit(1)
    .get()

  const value = { ...updateData, updatedAt: new Date() }

  if (existing.data.length > 0) {
    await db.collection('config').doc(existing.data[0]._id).update({
      data: { value, updatedAt: db.serverDate() }
    })
  } else {
    await db.collection('config').add({
      data: { key: 'member_prices', value, createdAt: db.serverDate() }
    })
  }

  return { success: true, message: '会员定价已更新' }
}

/**
 * 获取会员定价
 */
async function getMemberPrices() {
  const defaultPrices = { weekly: 500, monthly: 1800, quarterly: 4800, yearly: 16800, lifetime: 50000 }
  try {
    const res = await db.collection('config')
      .where({ key: 'member_prices' })
      .limit(1)
      .get()
    if (res.data.length > 0 && res.data[0].value) {
      return { success: true, data: { ...defaultPrices, ...res.data[0].value } }
    }
    return { success: true, data: defaultPrices }
  } catch (e) {
    return { success: true, data: defaultPrices }
  }
}

/**
 * 重置用户今天首次下载的广告状态
 * 🔥 修复：改为清除 user_points.lastAdWatchedDate（与 getDownloadStatus / markAdWatched 对齐）
 * 让用户下次下载时重新需要观看激励广告。
 */
async function resetWatchAdCount(event) {
  const { userOpenid } = event

  if (!userOpenid) {
    return { success: false, message: '缺少用户 openid' }
  }

  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    // 清除 user_points 中的 lastAdWatchedDate，同时删除今天的 free 下载记录
    const userRes = await db.collection('user_points').where({ _openid: userOpenid }).limit(1).get()
    const user = userRes.data[0]
    if (user) {
      await db.collection('user_points').doc(user._id).update({
        data: {
          lastAdWatchedDate: db.command.remove(),
          updatedAt: new Date()
        }
      })
    }

    // 同时清理今天的免费下载记录（download_records）
    const countRes = await db.collection('download_records')
      .where({
        _openid: userOpenid,
        downloadMethod: 'free',
        createdAt: _.gte(todayStart)
      })
      .count()

    const count = countRes.total || 0

    if (count > 0) {
      await db.collection('download_records')
        .where({
          _openid: userOpenid,
          downloadMethod: 'free',
          createdAt: _.gte(todayStart)
        })
        .remove()
    }

    console.log(`[adminUserManager] 已重置用户 ${userOpenid.slice(-6)} 的下载广告状态，清除 lastAdWatchedDate，删除 ${count} 条 free 记录`)

    return {
      success: true,
      message: `已重置，用户下次下载需要重新观看广告`,
      deletedCount: count
    }
  } catch (err) {
    console.error('[adminUserManager] 重置下载广告状态失败:', err)
    return { success: false, message: '重置失败: ' + (err.message || '未知错误') }
  }
}
