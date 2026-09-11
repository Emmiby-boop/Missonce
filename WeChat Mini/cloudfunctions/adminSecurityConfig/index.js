/**
 * adminSecurityConfig - 敏感配置管理（api_keys / ai_config / ai_writer_config）
 *
 * 安全说明：这些集合（api_keys 含第三方密钥、ai_config 含 AI API KEY）原本由
 * 前端 utils/api.js 直连数据库读写。在「与管理端共用云环境」下，若数据库安全规则
 * 开放读，C 端任意用户可直接拉取密钥。故统一收敛到本云函数（withAdmin 鉴权），
 * 前端不再直连这些敏感集合。对应数据库集合应配置为「仅后端/私有」安全规则。
 */

const cloud = require('wx-server-sdk')
const { withAdmin } = require('./withAdmin.js')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 允许通过本函数读取/写入的敏感文档白名单（避免被当作任意集合的写代理）
const ALLOWED_DOCS = {
  ai_config: 'sys_config',
  ai_writer_config: 'sys_config',
  api_keys: 'api_keys', // 集合级（列表），单独处理
}

exports.main = withAdmin(async (event, context, admin) => {
  try {
    const { action, data } = event || {}
    if (!action) {
      return { success: false, msg: '缺少 action', data: null }
    }

    switch (action) {
      case 'getAIConfig':
        return await getDoc('sys_config', 'ai_config')
      case 'updateAIConfig':
        return await setDoc('sys_config', 'ai_config', data || {})
      case 'getAIWriterConfig':
        return await getDoc('sys_config', 'ai_writer_config')
      case 'getApiKeys':
        return await listApiKeys()
      case 'manageApiKey':
        return await manageApiKey(data || {})
      default:
        return { success: false, msg: '未知 action', data: null }
    }
  } catch (e) {
    return { success: false, msg: e.message || '服务器错误', data: null }
  }
})

async function getDoc(collection, docId) {
  try {
    const res = await db.collection(collection).doc(docId).get()
    return { success: true, data: res.data || {} }
  } catch (e) {
    return { success: true, data: {} }
  }
}

async function setDoc(collection, docId, payload) {
  const data = { ...payload, updatedAt: db.serverDate() }
  try {
    await db.collection(collection).doc(docId).set({ data })
    return { success: true, data }
  } catch (e) {
    return { success: false, msg: '保存失败: ' + e.message }
  }
}

async function listApiKeys() {
  try {
    const res = await db.collection('api_keys').orderBy('createdAt', 'desc').get()
    return { success: true, data: res.data || [] }
  } catch (e) {
    return { success: true, data: [] }
  }
}

async function manageApiKey({ action, item, id } = {}) {
  try {
    if (action === 'create') {
      const res = await db.collection('api_keys').add({
        data: { ...(item || {}), createdAt: db.serverDate(), updatedAt: db.serverDate() },
      })
      return { success: true, data: { _id: res._id } }
    }
    if (action === 'update') {
      if (!id) return { success: false, msg: '缺少 id' }
      await db.collection('api_keys').doc(id).set({
        data: { ...(item || {}), updatedAt: db.serverDate() },
      })
      return { success: true }
    }
    if (action === 'delete') {
      if (!id) return { success: false, msg: '缺少 id' }
      await db.collection('api_keys').doc(id).remove()
      return { success: true }
    }
    return { success: false, msg: '未知的子操作' }
  } catch (e) {
    return { success: false, msg: '操作失败: ' + e.message }
  }
}
