const cloud = require('wx-server-sdk')
const CryptoJS = require('crypto-js')
const { requireAdmin } = require('../shared/adminAuth')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 加密密钥 — 必须通过环境变量注入
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_SECRET
if (!ENCRYPTION_KEY) {
  console.warn('API_KEY_ENCRYPTION_SECRET not set, API keys will be stored unencrypted')
}

function encrypt(text) {
  if (!ENCRYPTION_KEY) return text
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString()
}

function decrypt(encryptedText) {
  if (!ENCRYPTION_KEY) return encryptedText
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY)
    return bytes.toString(CryptoJS.enc.Utf8)
  } catch (e) {
    console.error('Decrypt failed, returning raw:', e)
    return encryptedText
  }
}

exports.main = async (event, context) => {
  const { action, ...data } = event
  const { OPENID } = cloud.getWXContext()

  // 鉴权检查
  if (!OPENID) {
    return { success: false, error: '未登录' }
  }
  const auth = await requireAdmin(db, OPENID)
  if (!auth.isAdmin) {
    return auth.response
  }

  try {
    switch (action) {
      case 'list':
        return await listKeys()
      case 'add':
        return await addKey(data)
      case 'update':
        return await updateKey(data)
      case 'delete':
        return await deleteKey(data.id)
      default:
        return { success: false, error: '未知操作' }
    }
  } catch (error) {
    console.error('API Keys 管理错误:', error)
    return { success: false, error: error.message }
  }
}

async function listKeys() {
  const result = await db.collection('api_keys')
    .orderBy('createdAt', 'desc')
    .get()

  const masked = result.data.map(item => ({
    ...item,
    key: item.key ? decrypt(item.key).replace(/^(.{4}).*(.{4})$/, '$1****$2') : ''
  }))

  return { success: true, data: masked }
}

async function addKey(data) {
  const encryptedKey = encrypt(data.key)
  const keyData = {
    name: data.name,
    provider: data.provider,
    key: encryptedKey,
    notes: data.notes || '',
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  }

  const result = await db.collection('api_keys').add({ data: keyData })

  return {
    success: true,
    data: { _id: result._id, ...keyData, key: '****' }
  }
}

async function updateKey(data) {
  const updateData = {
    name: data.name,
    provider: data.provider,
    key: data.key ? encrypt(data.key) : undefined,
    notes: data.notes || '',
    updatedAt: db.serverDate()
  }

  Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k])

  await db.collection('api_keys').doc(data.id).update({ data: updateData })

  return {
    success: true,
    data: { _id: data.id, ...updateData, key: '****' }
  }
}

async function deleteKey(id) {
  await db.collection('api_keys').doc(id).remove()
  return { success: true }
}