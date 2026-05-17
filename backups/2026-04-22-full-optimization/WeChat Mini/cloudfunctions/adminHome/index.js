const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { action, data, id } = event
  const collection = db.collection('home_sections')

  try {
    switch (action) {
      case 'get':
        const res = await collection.orderBy('sort', 'asc').get()
        return {
          success: true,
          data: res.data
        }

      case 'add':
        if (!data) return { success: false, message: 'Data is required' }
        const addRes = await collection.add({
          data: {
            ...data,
            createTime: db.serverDate(),
            updateTime: db.serverDate()
          }
        })
        return {
          success: true,
          id: addRes._id
        }

      case 'update':
        if (!id || !data) return { success: false, message: 'ID and Data are required' }
        // Remove _id from data if present to avoid immutable field error
        const { _id, ...updateData } = data
        await collection.doc(id).update({
          data: {
            ...updateData,
            updateTime: db.serverDate()
          }
        })
        return {
          success: true
        }

      case 'delete':
        if (!id) return { success: false, message: 'ID is required' }
        await collection.doc(id).remove()
        return {
          success: true
        }

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
