const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const callerOpenid = wxContext.OPENID
  const { action, key, value, description } = event
  const collection = db.collection('config')

  // 🔒 写操作需要管理员鉴权
  const WRITE_ACTIONS = ['set', 'delete']
  if (WRITE_ACTIONS.includes(action)) {
    if (!callerOpenid) {
      return { success: false, message: '未登录' }
    }
    
    const adminCheck = await db.collection('admins')
      .where({ _openid: callerOpenid })
      .count()
    
    if (adminCheck.total === 0) {
      return { success: false, message: '权限不足，仅管理员可修改配置' }
    }
  }

  try {
    switch (action) {
      case 'get':
        if (!key) return { success: false, message: 'key is required' }
        const getRes = await collection.where({ key }).limit(1).get()
        const item = (getRes.data && getRes.data[0]) || null
        return {
          success: true,
          data: item
        }

      case 'getAll':
        const allRes = await collection.get()
        return {
          success: true,
          data: allRes.data || []
        }

      case 'set':
        if (!key) return { success: false, message: 'key is required' }
        const existing = await collection.where({ key }).limit(1).get()

        if (existing.data && existing.data.length > 0) {
          await collection.doc(existing.data[0]._id).update({
            data: {
              value,
              description: description || existing.data[0].description,
              updatedAt: db.serverDate()
            }
          })
        } else {
          await collection.add({
            data: {
              key,
              value,
              description: description || '',
              createdAt: db.serverDate(),
              updatedAt: db.serverDate()
            }
          })
        }
        return { success: true }

      case 'delete':
        if (!key) return { success: false, message: 'key is required' }
        const delRes = await collection.where({ key }).limit(1).get()
        if (delRes.data && delRes.data.length > 0) {
          await collection.doc(delRes.data[0]._id).remove()
        }
        return { success: true }

      default:
        return {
          success: false,
          message: 'Unknown action'
        }
    }
  } catch (err) {
    console.error(err)
    return {
      success: false,
      message: '操作失败，请稍后重试'
    }
  }
}
