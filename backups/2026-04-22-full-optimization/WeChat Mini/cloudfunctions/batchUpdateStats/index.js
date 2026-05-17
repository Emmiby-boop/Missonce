const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { resourceId, actions } = event

  if (!resourceId) {
    return {
      success: false,
      message: '缺少 resourceId 参数'
    }
  }

  if (!actions || !Array.isArray(actions) || actions.length === 0) {
    return {
      success: false,
      message: '缺少 actions 参数'
    }
  }

  try {
    const updateData = {}
    
    actions.forEach(({ field, value }) => {
      if (field && typeof value === 'number') {
        updateData[field] = _.inc(value)
      }
    })

    if (Object.keys(updateData).length === 0) {
      return {
        success: false,
        message: '没有有效的更新字段'
      }
    }

    updateData.updatedAt = db.serverDate()

    const result = await db.collection('resources').doc(resourceId).update({
      data: updateData
    })

    return {
      success: true,
      message: '批量更新成功',
      result
    }
  } catch (error) {
    console.error('批量更新失败:', error)
    return {
      success: false,
      message: error.message || '批量更新失败',
      error
    }
  }
}
