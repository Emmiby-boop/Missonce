const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/**
 * 更新资源统计
 * 支持单字段更新和批量更新
 * 
 * @param {Object} event
 * @param {string} event.resourceId - 资源ID（单字段更新时必需）
 * @param {string} event.field - 字段名（单字段更新时必需）
 * @param {number} event.value - 增量值（单字段更新时使用）
 * @param {Array} event.updates - 批量更新数组 [{field, value}, ...]
 */
exports.main = async (event, context) => {
  const { resourceId, field, value, updates } = event
  
  // Allowed fields to update
  const allowedFields = ['likes', 'downloads', 'favorites', 'hotScore', 'views', 'viewCount']

  // 批量更新模式
  if (updates && Array.isArray(updates) && updates.length > 0) {
    if (!resourceId) {
      return { success: false, message: 'resourceId is required for batch update' }
    }

    try {
      const updateData = {}
      for (const update of updates) {
        const { field: f, value: v } = update
        if (!allowedFields.includes(f)) {
          console.warn(`Invalid field: ${f}, skipping`)
          continue
        }
        updateData[f] = _.inc(v || 1)
        
        // 同时更新 viewCount 和 views，保持兼容性
        if (f === 'views') {
          updateData.viewCount = _.inc(v || 1)
        } else if (f === 'viewCount') {
          updateData.views = _.inc(v || 1)
        }
      }

      if (Object.keys(updateData).length === 0) {
        return { success: false, message: 'No valid fields to update' }
      }

      updateData.updatedAt = db.serverDate()

      await db.collection('resources').doc(resourceId).update({
        data: updateData
      })

      return { success: true }
    } catch (err) {
      console.error('Batch update stats failed:', err)
      return { success: false, error: err.message }
    }
  }

  // 单字段更新模式（兼容旧版本）
  if (!resourceId || !field) {
    return { success: false, message: 'Missing parameters' }
  }

  if (!allowedFields.includes(field)) {
    return { success: false, message: 'Invalid field' }
  }

  try {
    const updateData = {
      [field]: _.inc(value || 1),
      updatedAt: db.serverDate()
    }
    
    // 同时更新 viewCount 和 views，保持兼容性
    if (field === 'views') {
      updateData.viewCount = _.inc(value || 1)
    } else if (field === 'viewCount') {
      updateData.views = _.inc(value || 1)
    }

    await db.collection('resources').doc(resourceId).update({
      data: updateData
    })
    return { success: true }
  } catch (err) {
    console.error('Update stats failed:', err)
    return { success: false, error: err }
  }
}
