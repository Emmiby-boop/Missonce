const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const serverDate = () => db.serverDate()

const normalizePagePath = (path) => {
  if (!path) return ''
  let p = String(path).trim()
  if (p.startsWith('/')) p = p.slice(1)
  return p
}

const denyIfMiniProgram = () => {
  const ctx = cloud.getWXContext()
  const source = String(ctx?.SOURCE || ctx?.source || ctx?.PLATFORM || '').toLowerCase()
  return source.includes('wx')
}

exports.main = async (event) => {
  try {
    const { action, ...payload } = event || {}

    if (!action) {
      return { success: false, msg: '缺少 action', data: null }
    }

    if (denyIfMiniProgram()) {
      return { success: false, msg: 'FORBIDDEN_CLIENT', data: null }
    }

    switch (action) {
      case 'listByPage':
        return await listByPage(payload)
      case 'create':
        return await createConfig(payload)
      case 'batchCreate':
        return await batchCreate(payload)
      case 'update':
        return await updateConfig(payload)
      case 'delete':
        return await deleteConfig(payload)
      case 'batchEnable':
        return await batchEnable(payload)
      case 'getMiniProgramPages':
        return await getMiniProgramPages()
      case 'setMiniProgramPages':
        return await setMiniProgramPages(payload)
      case 'ensureCollections':
        return await ensureCollections()
      // adUnitId catalog management
      case 'adUnit:list':
        return await listAdUnits(payload)
      case 'adUnit:add':
        return await addAdUnit(payload)
      case 'adUnit:update':
        return await updateAdUnit(payload)
      case 'adUnit:delete':
        return await deleteAdUnit(payload)
      case 'adUnit:backup':
        return await backupAdUnits()
      default:
        return { success: false, msg: '未知 action', data: null }
    }
  } catch (e) {
    return { success: false, msg: e.message || '服务器错误', data: null }
  }
}

async function ensureAdmin() {
  const ctx = cloud.getWXContext()
  const uid =
    ctx?.UID ||
    ctx?.uid ||
    ctx?.OPENID ||
    ctx?.openid ||
    ctx?.TCB_UUID ||
    ''

  // 当前项目暂不强制校验管理员表，返回上下文中的 uid 供记录使用
  return { uid }
}

async function logOperation(action, detail) {
  try {
    const ctx = cloud.getWXContext()
    await db.collection('admin_operation_logs').add({
      data: {
        action,
        detail: detail || {},
        operator: {
          openid: ctx?.OPENID || '',
          uid: ctx?.UID || '',
          env: ctx?.ENV || ''
        },
        createdAt: serverDate()
      }
    })
  } catch (e) {
    // swallow
  }
}

async function listByPage({ pagePath }) {
  if (!pagePath) return { success: false, msg: '缺少 pagePath', data: [] }
  const normalized = normalizePagePath(pagePath)
  const res = await db.collection('adConfig')
    .where({ pagePath: _.in([normalized, '/' + normalized]) })
    .orderBy('updateTime', 'desc')
    .get()
  return { success: true, msg: 'ok', data: res.data || [] }
}

async function createConfig({ adId, pagePath, adUnitId, type, isEnable, position = '', scrollThreshold = 0, weight = 0, startTime = null, endTime = null, meta = {} }) {
  if (!adId || !pagePath || !type) {
    return { success: false, msg: '参数不全', data: null }
  }
  const normalized = normalizePagePath(pagePath)
  const doc = {
    adId,
    pagePath: normalized.startsWith('/') ? normalized : normalized,
    adUnitId: adUnitId || '',
    type,
    isEnable: Boolean(isEnable),
    position: position || '',
    scrollThreshold: Number(scrollThreshold || 0) || 0,
    weight: Number(weight || 0) || 0,
    startTime: startTime || null,
    endTime: endTime || null,
    meta: meta || {},
    updateTime: serverDate()
  }
  const exists = await db.collection('adConfig').where({ adId }).limit(1).get()
  if (exists.data && exists.data.length > 0) {
    return { success: false, msg: 'adId 已存在', data: null }
  }
  const res = await db.collection('adConfig').add({ data: doc })
  await logOperation('adConfig:create', { id: res._id, adId, pagePath: doc.pagePath })
  return { success: true, msg: 'created', data: { _id: res._id, ...doc } }
}

async function updateConfig({ id, adId, updates = {} }) {
  const where = id ? { _id: id } : adId ? { adId } : null
  if (!where) return { success: false, msg: '缺少 id 或 adId', data: null }

  const data = {}
  if (typeof updates.adUnitId !== 'undefined') data.adUnitId = updates.adUnitId
  if (typeof updates.isEnable !== 'undefined') data.isEnable = Boolean(updates.isEnable)
  if (typeof updates.type !== 'undefined') data.type = updates.type
  if (typeof updates.pagePath !== 'undefined') data.pagePath = normalizePagePath(updates.pagePath)
  if (typeof updates.position !== 'undefined') data.position = updates.position
  if (typeof updates.scrollThreshold !== 'undefined') data.scrollThreshold = Number(updates.scrollThreshold || 0) || 0
  if (typeof updates.weight !== 'undefined') data.weight = Number(updates.weight || 0) || 0
  if (typeof updates.startTime !== 'undefined') data.startTime = updates.startTime || null
  if (typeof updates.endTime !== 'undefined') data.endTime = updates.endTime || null
  if (typeof updates.meta !== 'undefined') data.meta = updates.meta || {}
  data.updateTime = serverDate()

  const res = await db.collection('adConfig').where(where).update({ data })
  await logOperation('adConfig:update', { where, updates: data })
  return { success: true, msg: 'updated', data: res }
}

async function batchCreate({ pages = [], ad = {}, adIdPrefix = '' }) {
  if (!Array.isArray(pages) || pages.length === 0) {
    return { success: false, msg: '缺少 pages', data: null }
  }
  if (!ad || !ad.type) {
    return { success: false, msg: '缺少广告核心字段(type)', data: null }
  }
  const { uid } = await ensureAdmin()
  const normalizedPages = pages.map(normalizePagePath).filter(Boolean)
  const tsBase = Date.now().toString(36)
  const results = []
  const concurrency = 20
  let idx = 0
  async function createOne(pagePath, i) {
    const slug = pagePath.replace(/\//g, '_')
    const adId = (ad.adId && String(ad.adId).trim()) || 
      (adIdPrefix ? `${adIdPrefix}_${slug}` : `${ad.type}_${ad.position || 'auto'}_${tsBase}_${i}`)
    try {
      const doc = {
        adId,
        pagePath: pagePath.startsWith('/') ? pagePath : '/' + pagePath,
        adUnitId: ad.adUnitId || '',
        type: ad.type,
        isEnable: typeof ad.isEnable === 'undefined' ? true : Boolean(ad.isEnable),
        position: ad.position || '',
        scrollThreshold: Number(ad.scrollThreshold || 0) || 0,
        weight: Number(ad.weight || 0) || 0,
        startTime: ad.startTime || null,
        endTime: ad.endTime || null,
        meta: ad.meta || {},
        updateTime: serverDate()
      }
      // 唯一 adId 校验
      const exists = await db.collection('adConfig').where({ adId }).limit(1).get()
      if (exists.data && exists.data.length > 0) {
        throw new Error('adId 已存在')
      }
      const addRes = await db.collection('adConfig').add({ data: doc })
      results.push({ pagePath: doc.pagePath, adId, ok: true, id: addRes._id })
      return true
    } catch (e) {
      results.push({ pagePath: '/' + pagePath, adId, ok: false, error: e.message || 'unknown' })
      return false
    }
  }
  const queue = []
  while (idx < normalizedPages.length) {
    const slice = normalizedPages.slice(idx, idx + concurrency)
    // 并发执行
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(slice.map((p, i) => createOne(p, idx + i)))
    idx += concurrency
  }
  const successCount = results.filter(r => r.ok).length
  const failCount = results.length - successCount
  await logOperation('adConfig:batchCreate', { pages: normalizedPages, ad: { type: ad.type, position: ad.position, weight: ad.weight }, operator: uid, successCount, failCount })
  return { success: true, msg: 'ok', data: { total: results.length, successCount, failCount, results } }
}

async function deleteConfig({ id, adId }) {
  const where = id ? { _id: id } : adId ? { adId } : null
  if (!where) return { success: false, msg: '缺少 id 或 adId', data: null }
  const res = await db.collection('adConfig').where(where).remove()
  await logOperation('adConfig:delete', { where })
  return { success: true, msg: 'deleted', data: res }
}

async function batchEnable({ pagePath, isEnable }) {
  if (typeof isEnable === 'undefined') {
    return { success: false, msg: '缺少 isEnable', data: null }
  }
  const normalized = normalizePagePath(pagePath || '')
  if (!normalized) return { success: false, msg: '缺少 pagePath', data: null }
  const res = await db.collection('adConfig').where({
    pagePath: _.in([normalized, '/' + normalized])
  }).update({
    data: { isEnable: Boolean(isEnable), updateTime: serverDate() }
  })
  return { success: true, msg: 'ok', data: res }
}

async function getMiniProgramPages() {
  try {
    const res = await db.collection('sys_config').doc('mini_program_pages').get()
    const doc = Array.isArray(res.data) ? res.data[0] : res.data
    return { success: true, msg: 'ok', data: doc?.pages || [] }
  } catch (e) {
    return { success: true, msg: 'empty', data: [] }
  }
}

async function setMiniProgramPages({ pages = [] }) {
  const data = { pages, updateTime: serverDate() }
  try {
    await db.collection('sys_config').doc('mini_program_pages').update({ data })
  } catch (e) {
    await db.collection('sys_config').add({ data: { _id: 'mini_program_pages', ...data } })
  }
  return { success: true, msg: 'ok', data: pages.length }
}

async function ensureCollections() {
  const created = []
  
  // Try to create collections first
  try {
    await db.createCollection('adConfig')
    created.push('adConfig (new)')
  } catch (e) {
    // Ignore if already exists
  }

  try {
    await db.createCollection('sys_config')
    created.push('sys_config (new)')
  } catch (e) {
    // Ignore if already exists
  }

  try {
    await db.createCollection('ad_units')
    created.push('ad_units (new)')
  } catch (e) {}

  try {
    await db.createCollection('ad_units_backups')
    created.push('ad_units_backups (new)')
  } catch (e) {}

  // Ensure adConfig is writable (test with marker)
  try {
    await db.collection('adConfig').add({
      data: {
        _id: 'adConfig_init_marker',
        adId: 'init_marker',
        pagePath: '/init',
        type: 'init',
        isEnable: false,
        updateTime: serverDate()
      }
    })
    await db.collection('adConfig').doc('adConfig_init_marker').remove()
  } catch (e) {
    // If add fails but createCollection succeeded, it might be permission issue or transient
    console.error('adConfig check failed', e)
  }

  // Ensure sys_config/mini_program_pages exists
  try {
    const res = await db.collection('sys_config').doc('mini_program_pages').get()
    if (!res.data) {
       throw new Error('not found')
    }
  } catch (e) {
    try {
      await db.collection('sys_config').add({
        data: { _id: 'mini_program_pages', pages: [], updateTime: serverDate() }
      })
      created.push('sys_config.mini_program_pages')
    } catch (e2) {}
  }

  return { success: true, msg: 'ok', data: { created } }
}

// ---------- adUnitId catalog ----------
const ADUNIT_TYPES = ['native_top', 'native_bottom', 'native_video', 'video', 'interstitial', 'rewarded']
const ADUNIT_RE = /^adunit-[0-9a-fA-F]{16}$/

async function listAdUnits({ keyword = '', type = '' } = {}) {
  await ensureAdmin()
  const reg = keyword ? db.RegExp({ regexp: keyword, options: 'i' }) : null
  const whereBase = {}
  if (type && ADUNIT_TYPES.includes(type)) whereBase.type = type
  const where = reg ? _.and(whereBase, _.or([{ name: reg }, { adUnitId: reg }])) : whereBase
  const [cur, legacy] = await Promise.allSettled([
    db.collection('ad_units').where(where).orderBy('updatedAt', 'desc').get(),
    db.collection('adUnits').where(where).orderBy('updatedAt', 'desc').get()
  ])
  const list1 = cur.status === 'fulfilled' && cur.value?.data ? cur.value.data : []
  const list2 = legacy.status === 'fulfilled' && legacy.value?.data ? legacy.value.data : []
  // 合并去重（以 adUnitId 作为唯一键）
  const map = new Map()
  for (const it of [...list1, ...list2]) {
    const key = it.adUnitId || it._id
    if (!map.has(key)) map.set(key, it)
  }
  const arr = Array.from(map.values()).sort((a, b) => {
    const ta = new Date(a.updatedAt || a.createdAt || 0).getTime()
    const tb = new Date(b.updatedAt || b.createdAt || 0).getTime()
    return tb - ta
  })
  return { success: true, msg: 'ok', data: arr }
}

async function addAdUnit(payload) {
  const admin = await ensureAdmin()
  if (!payload) {
    return { success: false, msg: '请求参数不合法', data: null }
  }
  const { name, adUnitId, type = '', notes = '' } = payload
  if (!name || !adUnitId) return { success: false, msg: '缺少必填字段', data: null }
  if (!ADUNIT_RE.test(adUnitId)) return { success: false, msg: 'adUnitId 格式不正确', data: null }
  if (type && !ADUNIT_TYPES.includes(type)) return { success: false, msg: '非法类型', data: null }
  const dup = await db.collection('ad_units').where(_.or([{ adUnitId }, { name }])).limit(1).get()
  if (dup.data && dup.data.length) return { success: false, msg: '名称或 adUnitId 已存在', data: null }
  const doc = {
    name,
    adUnitId,
    type: type || '',
    notes: notes || '',
    createdAt: serverDate(),
    updatedAt: serverDate(),
    createdBy: admin?.uid || ''
  }
  const res = await db.collection('ad_units').add({ data: doc })
  await logOperation('adUnit:add', { id: res._id, name, adUnitId })
  return { success: true, msg: 'created', data: { _id: res._id, ...doc } }
}

async function updateAdUnit({ id, updates = {} }) {
  await ensureAdmin()
  if (!id) return { success: false, msg: '缺少 id', data: null }
  const data = {}
  if (typeof updates.name !== 'undefined') data.name = updates.name
  if (typeof updates.type !== 'undefined') {
    if (updates.type && !ADUNIT_TYPES.includes(updates.type)) return { success: false, msg: '非法类型', data: null }
    data.type = updates.type || ''
  }
  if (typeof updates.adUnitId !== 'undefined') {
    if (!ADUNIT_RE.test(updates.adUnitId)) return { success: false, msg: 'adUnitId 格式不正确', data: null }
    const dup = await db.collection('ad_units').where(_.and({ adUnitId: updates.adUnitId }, { _id: _.neq(id) })).limit(1).get()
    if (dup.data && dup.data.length) return { success: false, msg: 'adUnitId 已存在', data: null }
    data.adUnitId = updates.adUnitId
  }
  if (typeof updates.notes !== 'undefined') data.notes = updates.notes || ''
  data.updatedAt = serverDate()
  const res = await db.collection('ad_units').doc(id).update({ data })
  await logOperation('adUnit:update', { id, updates: data })
  return { success: true, msg: 'updated', data: res }
}

async function deleteAdUnit({ id }) {
  await ensureAdmin()
  if (!id) return { success: false, msg: '缺少 id', data: null }
  const res = await db.collection('ad_units').doc(id).remove()
  await logOperation('adUnit:delete', { id })
  return { success: true, msg: 'deleted', data: res }
}

async function backupAdUnits() {
  await ensureAdmin()
  const res = await db.collection('ad_units').get()
  const snapshot = res.data || []
  const backupDoc = {
    snapshot,
    count: snapshot.length,
    createdAt: serverDate()
  }
  const r = await db.collection('ad_units_backups').add({ data: backupDoc })
  await logOperation('adUnit:backup', { id: r._id, count: snapshot.length })
  return { success: true, msg: 'ok', data: { id: r._id, count: snapshot.length } }
}
