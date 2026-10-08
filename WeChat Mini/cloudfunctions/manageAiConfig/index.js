const cloud = require('wx-server-sdk')
const { withAdmin } = require('./withAdmin')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * manageAiConfig —— AI 配置后台读写（sys_config / api_keys / poster_quotes）
 *
 * 背景：这三个集合由管理端（云函数）创建，文档没有 _openid。
 * 数据库安全规则是「仅创建者可读写」，前端 Web SDK 直连时：
 *   - doc().set()  → 服务端走 upsert-insert，报 E11000 duplicate key
 *   - doc().update() → 规则过滤后匹配 0 条，返回 { updated: 0 } 且不报错
 *   两者都表现为「界面提示保存成功，实际没写进去」。
 * 因此统一收口到本云函数：云函数是管理端权限，不受安全规则限制。
 *
 * 鉴权由 withAdmin 统一处理（Web 后台走 adminToken，小程序端走 openid）。
 */

const SYS_CONFIG = 'sys_config'
const API_KEYS = 'api_keys'
const POSTER_QUOTES = 'poster_quotes'

// 读取单个配置文档（不存在返回 null）
async function getDoc(collection, docId) {
  try {
    const res = await db.collection(collection).doc(docId).get()
    return res.data || null
  } catch (e) {
    // 文档不存在时 CloudBase 会抛错/返回空，统一按 null 处理
    const msg = String((e && e.message) || e)
    if (/document.*not exist|不存在|DOCUMENT_NOT_EXIST/i.test(msg)) return null
    throw e
  }
}

// 新增或更新（文档已存在 → update；不存在 → set 创建）
async function upsertDoc(collection, docId, data) {
  const payload = Object.assign({}, data)
  delete payload._id
  const exists = !!(await getDoc(collection, docId))
  if (exists) {
    const res = await db.collection(collection).doc(docId).update({
      data: Object.assign({}, payload, { updatedAt: db.serverDate() })
    })
    // stats.updated 是判断是否真的写进去的关键：安全规则不匹配时会返回 0 且不报错
    return { upserted: true, created: false, updated: (res && res.stats && res.stats.updated) || 0 }
  }
  await db.collection(collection).doc(docId).set({
    data: Object.assign({}, payload, { createdAt: db.serverDate(), updatedAt: db.serverDate() })
  })
  return { upserted: true, created: true, updated: 1 }
}

const handleRequest = async (event, context, admin) => {
  const { action } = event || {}
  const data = (event && event.data) || {}

  switch (action) {
    // ---------- sys_config ----------
    case 'getConfig': {
      const { docId } = data
      if (!docId) return { success: false, message: 'docId is required' }
      return { success: true, data: await getDoc(SYS_CONFIG, docId) }
    }

    case 'getConfigs': {
      // 批量读取：{ docIds: ['ai_config', 'ai_writer_config', ...] }
      const { docIds } = data
      if (!Array.isArray(docIds)) return { success: false, message: 'docIds must be an array' }
      const out = {}
      await Promise.all(docIds.map(async (id) => {
        out[id] = await getDoc(SYS_CONFIG, id)
      }))
      return { success: true, data: out }
    }

    case 'setConfig': {
      const { docId, doc } = data
      if (!docId) return { success: false, message: 'docId is required' }
      if (!doc || typeof doc !== 'object') return { success: false, message: 'doc must be an object' }
      const r = await upsertDoc(SYS_CONFIG, docId, doc)
      return { success: true, data: r }
    }

    // ---------- api_keys ----------
    case 'listApiKeys': {
      const res = await db.collection(API_KEYS)
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get()
      return { success: true, data: res.data || [] }
    }

    case 'saveApiKey': {
      const { id, doc } = data
      if (!doc || typeof doc !== 'object') return { success: false, message: 'doc must be an object' }
      const payload = Object.assign({}, doc)
      delete payload._id
      if (id) {
        const res = await db.collection(API_KEYS).doc(id).update({
          data: Object.assign({}, payload, { updatedAt: db.serverDate() })
        })
        return { success: true, data: { id, updated: (res && res.stats && res.stats.updated) || 0 } }
      }
      const addRes = await db.collection(API_KEYS).add({
        data: Object.assign({}, payload, { createdAt: db.serverDate(), updatedAt: db.serverDate() })
      })
      return { success: true, data: { id: addRes._id, created: true } }
    }

    case 'deleteApiKey': {
      const { id } = data
      if (!id) return { success: false, message: 'id is required' }
      await db.collection(API_KEYS).doc(id).remove()
      return { success: true }
    }

    // ---------- poster_quotes ----------
    case 'listPosterQuotes': {
      const res = await db.collection(POSTER_QUOTES)
        .orderBy('createdAt', 'desc')
        .limit(200)
        .get()
      return { success: true, data: res.data || [] }
    }

    case 'countPosterQuotes': {
      const res = await db.collection(POSTER_QUOTES).count()
      return { success: true, data: { total: res.total || 0 } }
    }

    case 'savePosterQuote': {
      const { id, text } = data
      if (!text || !String(text).trim()) return { success: false, message: '语录内容不能为空' }
      if (id) {
        await db.collection(POSTER_QUOTES).doc(id).update({ data: { text: String(text).trim() } })
        return { success: true, data: { id } }
      }
      const addRes = await db.collection(POSTER_QUOTES).add({
        data: { text: String(text).trim(), createdAt: db.serverDate() }
      })
      return { success: true, data: { id: addRes._id } }
    }

    case 'addPosterQuotes': {
      // 批量保存 AI 生成的语录：{ texts: [...] }
      const { texts } = data
      if (!Array.isArray(texts)) return { success: false, message: 'texts must be an array' }
      const list = texts.map(t => String(t || '').trim()).filter(Boolean)
      for (const t of list) {
        await db.collection(POSTER_QUOTES).add({ data: { text: t, createdAt: db.serverDate() } })
      }
      return { success: true, data: { added: list.length } }
    }

    case 'deletePosterQuote': {
      const { id } = data
      if (!id) return { success: false, message: 'id is required' }
      await db.collection(POSTER_QUOTES).doc(id).remove()
      return { success: true }
    }

    default:
      return { success: false, message: `未知 action: ${action}` }
  }
}

exports.main = withAdmin(handleRequest)
