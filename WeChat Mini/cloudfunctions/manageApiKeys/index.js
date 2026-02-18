const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action, ...data } = event
  const { OPENID } = cloud.getWXContext()
  
  try {
    switch (action) {
      case 'list':
        return await listKeys()
      case 'add':
        return await addKey(data, OPENID)
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
  
  return {
    success: true,
    data: result.data
  }
}

async function addKey(data, openid) {
  const keyData = {
    name: data.name,
    provider: data.provider,
    key: data.key,
    notes: data.notes || '',
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  }
  
  const result = await db.collection('api_keys').add({
    data: keyData
  })
  
  return {
    success: true,
    data: {
      _id: result._id,
      ...keyData
    }
  }
}

async function updateKey(data) {
  const updateData = {
    name: data.name,
    provider: data.provider,
    key: data.key,
    notes: data.notes || '',
    updatedAt: db.serverDate()
  }
  
  await db.collection('api_keys').doc(data.id).update({
    data: updateData
  })
  
  return {
    success: true,
    data: {
      _id: data.id,
      ...updateData
    }
  }
}

async function deleteKey(id) {
  await db.collection('api_keys').doc(id).remove()
  
  return {
    success: true
  }
}
