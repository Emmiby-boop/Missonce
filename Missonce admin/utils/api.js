/**
 * API 服务层（uni-app 版）
 * 对应 Web 端的 services 和云函数调用模式。
 * 数据访问分层（与 Web 端一致）：L1 直连 DB / L2 Service / L3 云函数。
 * 本文件与 miniprogramadmin/utils/api.js 逻辑一致，仅 CommonJS 引入本地 cloud。
 */

import { callFunction, callFunctionRaw, db, cmd, serverDate, getTempFileURLs, ensureAnonymousAuth } from './cloud'

/* ════════════════════════════════════════════
 * 云存储 URL 转换工具
 * App 端不能直接渲染 cloud:// 协议，需批量转成 HTTP URL
 * ════════════════════════════════════════════ */

/**
 * 判断字符串是否为 cloud:// 协议
 */
function isCloudFileID(s) {
  return typeof s === 'string' && s.indexOf('cloud://') === 0
}

/**
 * 批量转换资源列表中的 cloud:// 封面 URL 为可访问的 HTTP URL
 * CloudBase getTempFileURL 单次最多 100 个，需分批处理
 * @param {Array} list - 资源列表
 * @param {Array} fields - 需要检查的字段名（默认 ['cover', 'coverUrl']）
 * @returns {Array} 转换后的列表（原地修改并返回）
 */
async function resolveCloudCovers(list, fields) {
  if (!Array.isArray(list) || list.length === 0) return list || []
  fields = fields || ['cover', 'coverUrl', 'url', 'resourceCover', 'originUrl', 'thumbnail', 'fileID', 'imageUrl']
  var cloudIDs = []
  var pending = [] // {item, field, fileID}
  list.forEach(function (item) {
    if (!item) return
    fields.forEach(function (f) {
      var v = item[f]
      if (isCloudFileID(v)) {
        cloudIDs.push(v)
        pending.push({ item: item, field: f, fileID: v })
      }
    })
  })
  if (cloudIDs.length === 0) return list

  // 去重，减少请求数量
  var uniqueIDs = []
  var idSet = new Set()
  cloudIDs.forEach(function (id) {
    if (!idSet.has(id)) { idSet.add(id); uniqueIDs.push(id) }
  })

  // 分批处理，每批最多 50 个（留余量）
  var BATCH_SIZE = 50
  var urlMap = {}
  for (var i = 0; i < uniqueIDs.length; i += BATCH_SIZE) {
    var batch = uniqueIDs.slice(i, i + BATCH_SIZE)
    try {
      var urls = await getTempFileURLs(batch)
      batch.forEach(function (id, idx) {
        if (urls[idx]) urlMap[id] = urls[idx]
      })
    } catch (e) {
      console.warn('[api] resolveCloudCovers 批次 ' + i + ' 转换失败（忽略）:', e && e.message)
    }
  }

  pending.forEach(function (p) {
    var url = urlMap[p.fileID]
    if (url) p.item[p.field] = url
  })
  return list
}

/* ════════════════════════════════════════════
 * 数据概览
 * ════════════════════════════════════════════ */

async function getDashboardData() {
  try {
    const res = await callFunctionRaw('operationsAssistant', { action: 'dashboard', days: 7 })
    if (res.result && res.result.success) {
      const data = res.result.data || {}
      const overview = data.overview || {}
      return {
        totalResources: overview.totalResources || 0,
        todayViews: overview.totalViews || 0,
        activeUsers: overview.activeUsers || 0,
        totalUsers: overview.totalUsers || 0,
        memberUsers: await _getMemberCount(),
        totalDownloads: overview.totalDownloads || 0,
        totalFavorites: overview.totalFavorites || 0,
        newUsers: overview.newUsers || 0,
        trends: data.trends || [],
        hotResources: data.hotResources || [],
        recentActivities: data.recentActivities || data.activities || [],
      }
    }
    throw new Error('云函数返回失败: ' + (res.result && res.result.message ? res.result.message : '未知错误'))
  } catch (err) {
    console.log('[api] operationsAssistant 不可用，回退到 DB 查询:', err.message || err)
    return await _getDashboardDirect()
  }
}

/** 直查会员数（memberLevel 不为 'none'） */
async function _getMemberCount() {
  try {
    const database = await db()
    const _ = await cmd()
    const res = await database.collection('users')
      .where({ memberLevel: _.neq('none') })
      .count()
    return res.total || 0
  } catch (e) {
    return 0
  }
}

/** 直接查询 DB 获取仪表盘数据 */
async function _getDashboardDirect() {
  try {
    return await _doDashboardQuery()
  } catch (err) {
    // 认证失败时重新匿名登录后重试一次
    var errStr = ((err && err.error) || '') + ' ' + ((err && err.error_description) || '') + ' ' + ((err && err.message) || '')
    if (errStr.indexOf('unauthenticated') >= 0 || errStr.indexOf('credentials not found') >= 0) {
      console.warn('[api] DB 直查遇到未认证错误，重新匿名登录后重试')
      var reauthed = await ensureAnonymousAuth()
      if (reauthed) {
        return await _doDashboardQuery()
      }
    }
    console.error('[api] DB 直查仪表盘失败', err)
    return {
      totalResources: 0,
      totalUsers: 0,
      todayViews: 0,
      activeUsers: 0,
      memberUsers: 0,
      totalDownloads: 0,
      totalFavorites: 0,
      newUsers: 0,
      weekEvents: 0,
      hotResources: [],
      recentActivities: [],
    }
  }
}

/** 实际执行仪表盘 DB 查询 */
async function _doDashboardQuery() {
  const database = await db()
  const _ = await cmd()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const [resourcesCount, usersCount, eventsCount, activeUsersCount, downloadsCount, favoritesCount] = await Promise.all([
    database.collection('resources').count(),
    database.collection('users').count(),
    database.collection('events').where({ ts: _.gt(sevenDaysAgo.getTime()) }).count(),
    database.collection('users').where({ lastLoginAt: _.gte(sevenDaysAgo) }).count(),
    database.collection('downloads').count(),
    database.collection('favorites').count(),
  ])

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  let todayPV = 0
  try {
    const pvRes = await database.collection('events')
      .where({ ts: _.gte(todayStart.getTime()) })
      .count()
    todayPV = pvRes.total || 0
  } catch (e) { /* 忽略 */ }

  const memberCount = await _getMemberCount()

  return {
    totalResources: resourcesCount.total || 0,
    totalUsers: usersCount.total || 0,
    todayViews: todayPV,
    activeUsers: activeUsersCount.total || 0,
    memberUsers: memberCount,
    totalDownloads: downloadsCount.total || 0,
    totalFavorites: favoritesCount.total || 0,
    newUsers: 0,
    weekEvents: eventsCount.total || 0,
    hotResources: [],
    recentActivities: [],
  }
}

async function getDownloadRecords(limit = 20, skip = 0) {
  try {
    const res = await callFunctionRaw('operationsAssistant', { action: 'downloadRecords', limit, skip })
    const list = (res.result && res.result.success) ? (res.result.data || []) : []
    await resolveCloudCovers(list)
    return list
  } catch (err) {
    console.log('[api] getDownloadRecords 不可用:', err.message || err)
    return []
  }
}

async function getFavoriteRecords(limit = 20, skip = 0) {
  try {
    const res = await callFunctionRaw('operationsAssistant', { action: 'favoriteRecords', limit, skip })
    const list = (res.result && res.result.success) ? (res.result.data || []) : []
    await resolveCloudCovers(list)
    return list
  } catch (err) {
    console.log('[api] getFavoriteRecords 不可用:', err.message || err)
    return []
  }
}

async function getBehaviorStats() {
  try {
    const res = await callFunctionRaw('operationsAssistant', { action: 'behaviorStats' })
    if (res.result && res.result.success) return res.result.data || {}
    return {}
  } catch (err) {
    console.log('[api] getBehaviorStats 不可用:', err.message || err)
    return {}
  }
}

async function getTrafficTrend() {
  try {
    const res = await callFunctionRaw('operationsAssistant', { action: 'dashboard', days: 7 })
    if (res.result && res.result.success && Array.isArray(res.result.data.trends)) {
      return res.result.data.trends.map(t => ({
        date: t.date, pv: t.views || 0, uv: t.activeUsers || 0,
      }))
    }
    throw new Error('云函数趋势不可用')
  } catch (err) {
    console.warn('[api] 趋势回退到 DB 直查', err.message)
    return await _getTrafficTrendDirect()
  }
}

async function _getTrafficTrendDirect() {
  const database = await db()
  const _ = await cmd()
  const $ = database.command.aggregate
  const now = new Date()
  const days = []

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const next = new Date(d)
    next.setDate(next.getDate() + 1)

    try {
      const pvAgg = await database.collection('events').aggregate()
        .match({ ts: _.gte(d.getTime()).and(_.lt(next.getTime())) })
        .group({ _id: null, pv: $.sum($.cond({ if: $.eq(['$type', 'pv']), then: 1, else: 0 })), uv: $.sum(1) })
        .end()

      const uvAgg = await database.collection('events').aggregate()
        .match({ ts: _.gte(d.getTime()).and(_.lt(next.getTime())) })
        .project({
          uid: $.cond({
            if: $.neq(['$userId', null]), then: '$userId',
            else: $.cond({ if: $.neq(['$_openid', null]), then: '$_openid', else: $.cond({ if: '$anonymous', then: 'anon', else: null }) }),
          }),
        })
        .match({ uid: _.neq(null) })
        .group({ _id: '$uid' })
        .count('uv')
        .end()

      const pv = (pvAgg.list && pvAgg.list[0] && pvAgg.list[0].pv) || 0
      const uv = (uvAgg.list && uvAgg.list[0] && uvAgg.list[0].uv) || 0
      days.push({ date: d.toISOString().split('T')[0], pv, uv })
    } catch (e) {
      days.push({ date: d.toISOString().split('T')[0], pv: 0, uv: 0 })
    }
  }
  return days
}

/* ════════════════════════════════════════════
 * 资源管理（L2: Service 封装，直连 resources 集合）
 * ══════════════════════════════════════════ */

async function getResources(params = {}) {
  const { type, status, page = 1, pageSize = 20, keyword, category, tags } = params
  const database = await db()
  const _ = await cmd()
  const skip = (page - 1) * pageSize
  const where = {}
  if (type && type !== 'all') where.type = type
  if (status && status !== 'all') where.status = status
  if (category) where.categories = _.in([category])
  if (tags) {
    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)
    if (tagList.length > 0) where.tags = _.in(tagList)
  }
  if (keyword) where.title = database.RegExp({ regexp: keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), options: 'i' })

  const [countRes, listRes] = await Promise.all([
    database.collection('resources').where(where).count(),
    database.collection('resources').where(where).orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get(),
  ])
  const list = listRes.data || []
  // App 端不能直接渲染 cloud://，批量转换为 HTTP URL
  await resolveCloudCovers(list)
  return { list, total: countRes.total || 0 }
}

async function updateResource(resourceId, updateData) {
  return callFunction('updateResource', { resourceId, updateData })
}

async function deleteResources(resourceId) {
  return callFunction('deleteResources', { action: 'delete', resourceId })
}

// 资源回收站
async function getRecycleBin() {
  return callFunction('deleteResources', { action: 'getTrash' })
}

async function restoreResource(resourceId) {
  return callFunction('deleteResources', { action: 'restore', resourceId })
}

async function purgeResource(resourceId) {
  return callFunction('deleteResources', { action: 'purge', resourceId })
}

async function purgeResources(resourceIds) {
  return callFunction('deleteResources', { action: 'purge', resourceIds })
}

async function analyzeResource(id) {
  return callFunctionRaw('analyzeResource', { id })
}

async function uploadResource(data) {
  return callFunction('uploadResource', data)
}

/* ════════════════════════════════════════════
 * 专题管理（L3: 云函数）
 * ══════════════════════════════════════════ */

async function getTopics(params = {}) {
  const { status = 'all' } = params
  const result = await callFunction('getTopics', { status })
  return result.data || result || []
}

async function manageTopics(action, data) {
  return callFunction('manageTopics', { action, ...data })
}

/* ════════════════════════════════════════════
 * 分类标签（L1: 直连 categories / tags 集合）
 * ══════════════════════════════════════════ */

async function fetchAll(query, { pageSize = 100, orderByField, hasWhere = false } = {}) {
  const all = []
  let skip = 0
  while (true) {
    let q = query
    if (hasWhere) {
      if (orderByField) q = q.orderBy(orderByField, 'asc')
    }
    const res = await q.skip(skip).limit(pageSize).get()
    const list = res.data || []
    if (list.length === 0) break
    all.push(...list)
    if (list.length < pageSize) break
    skip += pageSize
  }
  return all
}

async function getCategories(type = 'all') {
  const database = await db()
  if (type && type !== 'all') {
    const query = database.collection('categories').where({ type: (await cmd()).eq(type) })
    return fetchAll(query, { orderByField: 'order', hasWhere: true })
  }
  return fetchAll(database.collection('categories'), { orderByField: 'order', hasWhere: false })
}

async function getTags(type = 'all') {
  const database = await db()
  if (type && type !== 'all') {
    const query = database.collection('tags').where({ type: (await cmd()).eq(type) })
    return fetchAll(query, { orderByField: 'order', hasWhere: true })
  }
  return fetchAll(database.collection('tags'), { orderByField: 'order', hasWhere: false })
}

async function manageCategories(action, data) {
  const { collection: colName = 'categories' } = data
  return callFunction('manageCategories', { action, data: { ...data, collection: colName } })
}

/* ════════════════════════════════════════════
 * 首页 Tab（L3: 云函数 getHomeTabs + manageHomeTabs）
 * ══════════════════════════════════════════ */

async function getHomeTabs() {
  try {
    const result = await callFunction('getHomeTabs', {})
    return result.data || result || []
  } catch (err) {
    console.warn('[api] getHomeTabs 云函数不可用，回退到 DB 查询', err.message)
    return _getHomeTabsDirect()
  }
}

async function _getHomeTabsDirect() {
  const database = await db()
  try {
    const res = await database.collection('home_tabs').orderBy('sort', 'asc').get()
    if (res.data && res.data.length > 0) return res.data
  } catch (e) { /* 集合可能不存在 */ }
  try {
    const res = await database.collection('sys_config').doc('homeTabsConfig').get()
    const config = res.data || {}
    const tabs = config.tabs || config.homeTabs || []
    if (Array.isArray(tabs)) return tabs
  } catch (e) { /* 文档可能不存在 */ }
  return []
}

async function manageHomeTabs(action, data) {
  try {
    return await callFunction('manageHomeTabs', { action, ...data })
  } catch (err) {
    console.warn('[api] manageHomeTabs 云函数不可用，回退到 DB 操作', err.message)
    return _manageHomeTabsDirect(action, data)
  }
}

async function _manageHomeTabsDirect(action, data) {
  const database = await db()
  const col = database.collection('home_tabs')
  switch (action) {
    case 'add': {
      const item = data.data || {}
      const res = await col.add({ data: { ...item, sort: item.sort || 0, visible: item.visible !== false, createdAt: await serverDate(), updatedAt: await serverDate() } })
      return { success: true, data: { _id: res._id } }
    }
    case 'update': {
      const item = data.data || {}
      await col.doc(data.id).update({ data: { ...item, updatedAt: await serverDate() } })
      return { success: true }
    }
    case 'delete':
      await col.doc(data.id).remove()
      return { success: true }
    case 'sort': {
      const tabs = ((data.data && data.data.tabs) || []).filter(function (t) { return t && t.id })
      await Promise.all(tabs.map(function (t) { return col.doc(t.id).update({ data: { sort: t.sort } }) }))
      return { success: true }
    }
    case 'toggleVisible': {
      const res = await col.doc(data.id).get()
      const current = res.data || {}
      const newVisible = !current.visible
      await col.doc(data.id).update({ data: { visible: newVisible } })
      return { success: true, data: { visible: newVisible } }
    }
    case 'initDefault': {
      const defaults = [
        { title: '推荐', type: 'fixed', fixedId: 'recommend', resourceType: 'all', sortBy: 'hot', visible: true, sort: 0 },
        { title: '最新', type: 'fixed', fixedId: 'latest', resourceType: 'all', sortBy: 'latest', visible: true, sort: 1 },
      ]
      const now = await serverDate()
      await Promise.all(defaults.map(d => col.add({ data: { ...d, createdAt: now } })))
      return { success: true, message: '已初始化默认 Tab' }
    }
    default:
      throw new Error(`未知操作: ${action}`)
  }
}

/* ════════════════════════════════════════════
 * 广告配置（L3: 云函数 manageAdConfig）
 * ══════════════════════════════════════════ */

async function getAdUnits(params = {}) {
  try {
    const result = await callFunction('manageAdConfig', { action: 'adUnit:list', ...params })
    return result.data || result || []
  } catch (err) {
    console.warn('[api] manageAdConfig 云函数不可用，回退到 DB 查询', err.message)
    return _getAdUnitsDirect(params)
  }
}

async function _getAdUnitsDirect(params = {}) {
  const database = await db()
  const _ = await cmd()
  try {
    let query = database.collection('ad_units')
    if (params.keyword) {
      query = query.where({ name: database.RegExp({ regexp: params.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), options: 'i' }) })
    }
    if (params.type) query = query.where({ type: _.eq(params.type) })
    const res = await query.orderBy('createdAt', 'desc').get()
    return res.data || []
  } catch (e) {
    console.error('[api] getAdUnits DB 回退失败', e)
    return []
  }
}

async function getAdConfigs(params = {}) {
  const { pagePath } = params
  if (pagePath) {
    try {
      const result = await callFunction('manageAdConfig', { action: 'listByPage', pagePath })
      return result.data || result || []
    } catch (err) {
      console.warn('[api] manageAdConfig(listByPage) 云函数不可用，回退到 DB 查询', err.message)
      try {
        const database = await db()
        const _ = await cmd()
        const res = await database.collection('adConfig').where({ pagePath: _.eq(pagePath) }).get()
        return res.data || []
      } catch (e) {
        console.error('[api] getAdConfigs DB 回退失败', e)
        return []
      }
    }
  }
  return getAdUnits(params)
}

async function manageAd(action, data) {
  try {
    return await callFunction('manageAdConfig', { action, ...data })
  } catch (err) {
    console.warn('[api] manageAdConfig 云函数不可用，回退到 DB 操作', err.message)
    return _manageAdDirect(action, data)
  }
}

async function _manageAdDirect(action, data) {
  const database = await db()
  const _ = await cmd()

  if (action === 'adUnit:add') {
    return database.collection('ad_units').add({
      data: { name: data.name, adUnitId: data.adUnitId, type: data.type, notes: data.notes || '', createdAt: await serverDate(), updatedAt: await serverDate() }
    })
  }
  if (action === 'adUnit:update') {
    return database.collection('ad_units').doc(data.id).update({ data: { ...(data.updates || {}), updatedAt: await serverDate() } })
  }
  if (action === 'adUnit:delete') {
    return database.collection('ad_units').doc(data.id).remove()
  }

  const cfgCol = database.collection('adConfig')
  const normalizedPage = (p) => {
    if (!p) return ''
    const s = String(p).trim()
    return s.startsWith('/') ? s.slice(1) : s
  }

  if (action === 'create') {
    const pagePath = normalizedPage(data.pagePath)
    return cfgCol.add({
      data: {
        adId: data.adId, pagePath, adUnitId: data.adUnitId || '',
        type: data.type, isEnable: data.isEnable !== false, position: data.position || '',
        scrollThreshold: Number(data.scrollThreshold || 0) || 0, weight: Number(data.weight || 0) || 0,
        startTime: data.startTime || null, endTime: data.endTime || null, meta: data.meta || {}, updateTime: await serverDate()
      }
    })
  }
  if (action === 'update') {
    const target = data.id ? cfgCol.doc(data.id) : cfgCol.where({ adId: data.adId })
    return target.update({ data: { ...(data.updates || {}), updateTime: await serverDate() } })
  }
  if (action === 'delete') {
    const target = data.id ? cfgCol.doc(data.id) : cfgCol.where({ adId: data.adId })
    return target.remove()
  }
  if (action === 'batchEnable') {
    const pagePath = normalizedPage(data.pagePath)
    return cfgCol.where({ pagePath: _.in([pagePath, '/' + pagePath]) }).update({ data: { isEnable: Boolean(data.isEnable), updateTime: await serverDate() } })
  }
  throw new Error(`不支持 DB 回退的广告操作: ${action}`)
}

/* ════════════════════════════════════════════
 * 用户管理（L3: 云函数 adminUserManager）
 * ══════════════════════════════════════════ */

async function getTotalUsers() {
  try {
    const database = await db()
    const res = await database.collection('users').count()
    return res.total || 0
  } catch (e) { return 0 }
}

async function getUsers(params = {}) {
  const { page = 1, pageSize = 20, keyword, filter } = params
  const result = await callFunction('adminUserManager', { action: 'getUserList', page, limit: pageSize, keyword, filter })
  return { list: result.data || [], total: result.total || 0 }
}

async function searchUser(keyword) {
  const result = await callFunction('adminUserManager', { action: 'searchUser', keyword })
  return result.data || null
}

async function getMemberStats() {
  const result = await callFunction('adminUserManager', { action: 'getMemberStats' })
  return result.data || {}
}

async function getMemberPrices() {
  const result = await callFunction('adminUserManager', { action: 'getMemberPrices' })
  return result.data || {}
}

async function updateMemberPrices(prices) {
  return callFunction('adminUserManager', { action: 'updateMemberPrices', prices })
}

async function updateMembership(data) {
  return callFunction('adminUserManager', {
    action: 'updateMembership',
    userOpenid: data.userOpenid, memberLevel: data.memberLevel,
    memberExpireDate: data.memberExpireDate, points: data.points, skipAd: data.skipAd,
  })
}

async function resetWatchAdCount(userOpenid) {
  return callFunction('adminUserManager', { action: 'resetWatchAdCount', userOpenid })
}

async function getUserDetail(id) {
  const database = await db()
  try {
    const res = await database.collection('users').where({ _openid: id }).limit(1).get()
    if (res.data && res.data.length > 0) return res.data[0]
    try {
      const docRes = await database.collection('users').doc(id).get()
      if (docRes.data) return docRes.data
    } catch (e) { }
    const result = await callFunction('adminUserManager', { action: 'getUserList', keyword: id, page: 1, limit: 1 })
    return (result.data || [])[0] || null
  } catch (err) {
    console.warn('[api] 获取用户详情失败', err.message)
    try {
      const result = await callFunction('adminUserManager', { action: 'getUserList', keyword: id, page: 1, limit: 1 })
      return (result.data || [])[0] || null
    } catch (e) {
      console.warn('[api] getUserList 回退也失败', e.message)
      return null
    }
  }
}

async function updateUser(id, data) {
  return callFunction('adminUserManager', { action: 'update', userId: id, updateData: data })
}

/* ════════════════════════════════════════════
 * 通知管理（L3: 云函数 adminNotifications）
 * ══════════════════════════════════════════ */

async function getNotifications(params = {}) {
  const { isActive, type } = params
  try {
    const result = await callFunction('adminNotifications', { action: 'getAll' })
    let list = result.data || result || []
    if (isActive !== undefined) list = list.filter(n => (n.isActive !== false) === isActive)
    if (type && type !== 'all') list = list.filter(n => n.type === type)
    return { list, total: list.length }
  } catch (err) {
    console.warn('[api] adminNotifications 云函数不可用，回退到 DB 查询', err.message)
    return _getNotificationsDirect(params)
  }
}

async function _getNotificationsDirect(params = {}) {
  const { isActive, type } = params
  const database = await db()
  const _ = await cmd()
  try {
    let query = database.collection('notifications')
    if (isActive !== undefined) query = query.where({ isActive: _.eq(isActive) })
    if (type && type !== 'all') query = query.where({ type: _.eq(type) })
    const res = await query.orderBy('createdAt', 'desc').get()
    const list = res.data || []
    return { list, total: list.length }
  } catch (e) {
    console.error('[api] getNotifications DB 回退失败', e)
    return { list: [], total: 0 }
  }
}

async function manageNotification(action, data) {
  try {
    return await callFunction('adminNotifications', { action, ...data })
  } catch (err) {
    console.warn('[api] adminNotifications 云函数不可用，回退到 DB 操作', err.message)
    return _manageNotificationDirect(action, data)
  }
}

async function _manageNotificationDirect(action, data) {
  const database = await db()
  const col = database.collection('notifications')
  switch (action) {
    case 'add':
      return col.add({ data: { ...data.data, createdAt: await serverDate(), updatedAt: await serverDate() } })
    case 'update':
      return col.doc(data.id).update({ data: { ...data.data, updatedAt: await serverDate() } })
    case 'delete':
      return col.doc(data.id).remove()
    case 'batchDelete':
      return Promise.all((data.ids || []).map(id => col.doc(id).remove()))
    case 'batchToggleStatus':
      return Promise.all((data.ids || []).map(id => col.doc(id).update({ data: { isActive: data.isActive } })))
    default:
      throw new Error(`未知操作: ${action}`)
  }
}

/* ════════════════════════════════════════════
 * AI 配置（L1: 直连 sys_config 集合）
 * ══════════════════════════════════════════ */

async function getAIConfig() {
  try {
    const res = await callFunction('adminSecurityConfig', { action: 'getAIConfig' })
    return (res && res.data) || {}
  } catch (err) {
    console.error('[api] 获取 AI 配置失败', err)
    return {}
  }
}

async function updateAIConfig(data) {
  return callFunction('adminSecurityConfig', { action: 'updateAIConfig', data })
}

async function updateAIWriterConfig(data) {
  return callFunction('adminSecurityConfig', { action: 'updateAIWriterConfig', data })
}

async function getAIWriterConfig() {
  try {
    const res = await callFunction('adminSecurityConfig', { action: 'getAIWriterConfig' })
    return (res && res.data) || {}
  } catch (err) {
    console.error('[api] 获取文案配置失败', err)
    return {}
  }
}

/* ════════════════════════════════════════════
 * API Keys（经 adminSecurityConfig 云函数）
 * ══════════════════════════════════════════ */

async function getApiKeys() {
  try {
    const res = await callFunction('adminSecurityConfig', { action: 'getApiKeys' })
    return (res && res.data) || []
  } catch (err) {
    console.error('[api] 获取 API Keys 失败', err)
    return []
  }
}

async function manageApiKey(action, data) {
  return callFunction('adminSecurityConfig', { action: 'manageApiKey', data: { action, ...data } })
}

async function testAiConnection(params) {
  return callFunctionRaw('testAiConnection', params)
}

async function generatePosterQuotes(count = 5) {
  return callFunction('generatePosterQuotes', { action: 'generate', count })
}

/* ════════════════════════════════════════════
 * 海报语录（L1: 直连 poster_quotes 集合）
 * ══════════════════════════════════════════ */

async function getPosterQuotes() {
  const database = await db()
  try {
    const res = await database.collection('poster_quotes').orderBy('createdAt', 'desc').get()
    return res.data || []
  } catch (err) {
    console.warn('[api] 获取海报语录失败（集合可能不存在）', err.message)
    return []
  }
}

async function savePosterQuote(text) {
  const database = await db()
  return database.collection('poster_quotes').add({ data: { text, createdAt: await serverDate() } })
}

async function deletePosterQuote(id) {
  const database = await db()
  return database.collection('poster_quotes').doc(id).remove()
}

/* ════════════════════════════════════════════
 * 灵感文案（L1: 直连 quotes 集合 + aiGenerateText 云函数）
 * ══════════════════════════════════════════ */

async function getQuotes(params) {
  const database = await db()
  const _ = await cmd()
  const { page = 1, pageSize = 20, category = '', keyword = '', status = '' } = params || {}
  const conditions = []
  if (status) conditions.push({ status: status })
  if (category) conditions.push({ category: category })
  if (keyword) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    conditions.push(_.or([{ content: database.RegExp({ regexp: escaped, options: 'i' }) }, { tags: database.RegExp({ regexp: escaped, options: 'i' }) }]))
  }
  const where = conditions.length > 0 ? _.and(conditions) : {}
  const skip = (page - 1) * pageSize
  const [countRes, dataRes] = await Promise.all([
    database.collection('quotes').where(where).count(),
    database.collection('quotes').where(where).orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get()
  ])
  return { data: dataRes.data || [], total: countRes.total || 0 }
}

async function saveQuote(data) {
  const database = await db()
  return database.collection('quotes').add({
    data: {
      content: data.content || '', category: data.category || '', tags: data.tags || [],
      status: data.status || 'published', createdAt: await serverDate(), updatedAt: await serverDate(),
    }
  })
}

async function updateQuote(id, data) {
  const database = await db()
  const updateData = { updatedAt: await serverDate() }
  if (data.content !== undefined) updateData.content = data.content
  if (data.category !== undefined) updateData.category = data.category
  if (data.tags !== undefined) updateData.tags = data.tags
  if (data.status !== undefined) updateData.status = data.status
  return database.collection('quotes').doc(id).update({ data: updateData })
}

async function deleteQuote(id) {
  const database = await db()
  return database.collection('quotes').doc(id).remove()
}

async function generateText(params) {
  return callFunction('aiGenerateText', params)
}

/* ════════════════════════════════════════════
 * 标签白名单（L1: 直连 sys_config 集合）
 * ════════════════════════════════════════════ */

async function getCategoriesWhitelist() {
  const database = await db()
  try {
    const res = await database.collection('sys_config').doc('categories_whitelist').get()
    return (res.data && res.data.categories) || []
  } catch (err) {
    console.error('[api] 获取分类白名单失败', err)
    return []
  }
}

async function getTagsWhitelist() {
  const database = await db()
  try {
    const res = await database.collection('sys_config').doc('tags_whitelist').get()
    return (res.data && res.data.tags) || []
  } catch (err) {
    console.error('[api] 获取标签白名单失败', err)
    return []
  }
}

async function saveCategoriesWhitelist(categories) {
  const database = await db()
  return database.collection('sys_config').doc('categories_whitelist').set({ data: { categories } })
}

async function saveTagsWhitelist(tags) {
  const database = await db()
  return database.collection('sys_config').doc('tags_whitelist').set({ data: { tags } })
}

/* ════════════════════════════════════════════
 * 管理员管理（L1+L3: 列表直连 DB，增删改走云函数）
 * ════════════════════════════════════════════ */

async function getAdmins() {
  try {
    const res = await callFunction('adminAuth', { action: 'manageAdmins', data: { action: 'list' } })
    return (res && res.data) || []
  } catch (err) {
    console.error('[api] 获取管理员列表失败', err)
    return []
  }
}

async function addAdmin(data) {
  return callFunction('adminAuth', {
    action: 'manageAdmins',
    data: { action: 'create', username: data.username, password: data.password, phone: data.phone, email: data.email, role: data.role || 'admin' },
  })
}

async function removeAdmin(id) {
  return callFunction('adminAuth', { action: 'manageAdmins', data: { action: 'delete', id } })
}

async function updateAdmin(id, data) {
  return callFunction('adminAuth', {
    action: 'manageAdmins',
    data: { action: 'update', id, role: data.role, phone: data.phone, email: data.email, ...(data.newPassword ? { newPassword: data.newPassword } : {}) },
  })
}

/* ════════════════════════════════════════════
 * 日志（L1: 直连 events / error_logs 集合）
 * ════════════════════════════════════════════ */

async function getLogs(params = {}) {
  const { page = 1, pageSize = 20, type } = params
  const database = await db()
  const _ = await cmd()
  const skip = (page - 1) * pageSize
  // 改为查询管理员操作日志集合
  let query = database.collection('admin_operation_logs')
  let countQuery = database.collection('admin_operation_logs')
  if (type && type !== 'all') {
    // 按 action 前缀匹配（如 type='ad' 匹配 action 以 'ad' 开头的记录）
    const where = { action: database.RegExp({ regexp: '^' + type, options: 'i' }) }
    query = query.where(where)
    countQuery = countQuery.where(where)
  }
  const [countRes, listRes] = await Promise.all([
    countQuery.count(),
    query.orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get(),
  ])
  return { list: listRes.data || [], total: countRes.total || 0 }
}

async function getErrorLogs(params = {}) {
  const { page = 1, pageSize = 20 } = params
  const database = await db()
  const skip = (page - 1) * pageSize
  const [countRes, listRes] = await Promise.all([
    database.collection('error_logs').count(),
    database.collection('error_logs').orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get(),
  ])
  return { list: listRes.data || [], total: countRes.total || 0 }
}

/* ════════════════════════════════════════════
 * 修改密码（L3: 云函数 adminAuth）
 * ════════════════════════════════════════════ */

async function changePassword(username, oldPassword, newPassword) {
  return callFunction('adminAuth', { action: 'changePassword', username, oldPassword, newPassword })
}

/* ════════════════════════════════════════════
 * 积分配置（L3: 云函数 managePointsConfig）
 * ════════════════════════════════════════════ */

async function getPointsConfig() {
  try {
    const res = await callFunction('managePointsConfig', { action: 'getConfig' })
    return (res && res.data) || null
  } catch (err) {
    console.error('[api] 获取积分配置失败', err)
    return null
  }
}

async function updatePointsConfig(data) {
  return callFunction('managePointsConfig', { action: 'updateConfig', data })
}

async function getCheckInStats(days = 30) {
  try {
    const res = await callFunction('managePointsConfig', { action: 'getCheckInStats', days })
    return (res && res.data) || null
  } catch (err) {
    console.error('[api] 获取签到统计失败', err)
    return null
  }
}

/* ════════════════════════════════════════════
 * 每日精选（L3: 云函数 manageDailyPicks）
 * ════════════════════════════════════════════ */

async function getDailyPicksByDate(date) {
  const res = await callFunctionRaw('manageDailyPicks', { action: 'getPicksByDate', date })
  return (res && res.result && res.result.data) || { resources: [], autoGenerated: false }
}

async function setDailyPicks(date, resourceIds) {
  return callFunctionRaw('manageDailyPicks', { action: 'setPicks', date, resourceIds })
}

async function removeDailyPick(date, resourceId) {
  return callFunctionRaw('manageDailyPicks', { action: 'removePick', date, resourceId })
}

async function getDailyPicksAutoConfig() {
  const res = await callFunctionRaw('manageDailyPicks', { action: 'getAutoConfig' })
  return (res && res.result && res.result.data) || { enabled: true, minCount: 6, maxCount: 12 }
}

async function updateDailyPicksAutoConfig(data) {
  return callFunctionRaw('manageDailyPicks', { action: 'updateAutoConfig', data })
}

/* ════════════════════════════════════════════
 * 应用通用配置（L3: 云函数 manageConfig）
 * ════════════════════════════════════════════ */

async function getAppConfigAll() {
  const res = await callFunction('manageConfig', { action: 'getAll' })
  return (res && res.data) || []
}

async function setAppConfig(key, value, description) {
  return callFunction('manageConfig', { action: 'set', key, value, description })
}

const api = {
  getDashboardData, getTrafficTrend, getDownloadRecords, getFavoriteRecords, getBehaviorStats,
  resolveCloudCovers,
  getResources, updateResource, deleteResources, analyzeResource, uploadResource,
  getRecycleBin, restoreResource, purgeResource, purgeResources,
  getTopics, manageTopics,
  getCategories, getTags, manageCategories,
  getHomeTabs, manageHomeTabs,
  getAdConfigs, getAdUnits, manageAd,
  getUsers, getTotalUsers, searchUser, getMemberStats, getMemberPrices, updateMemberPrices,
  updateMembership, resetWatchAdCount, getUserDetail, updateUser,
  getNotifications, manageNotification,
  getAIConfig, updateAIConfig, updateAIWriterConfig, getAIWriterConfig,
  getApiKeys, manageApiKey, testAiConnection, generatePosterQuotes,
  getPosterQuotes, savePosterQuote, deletePosterQuote,
  getQuotes, saveQuote, updateQuote, deleteQuote, generateText,
  getCategoriesWhitelist, getTagsWhitelist, saveCategoriesWhitelist, saveTagsWhitelist,
  getAdmins, addAdmin, removeAdmin, updateAdmin,
  getPointsConfig, updatePointsConfig, getCheckInStats,
  getDailyPicksByDate, setDailyPicks, removeDailyPick, getDailyPicksAutoConfig, updateDailyPicksAutoConfig,
  getAppConfigAll, setAppConfig,
  getLogs, getErrorLogs,
  changePassword,
}

export default api
