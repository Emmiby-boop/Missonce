const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { action, key, value, description } = event
  const collection = db.collection('config')

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
      message: err.message || 'Internal Server Error'
    }
  }
}