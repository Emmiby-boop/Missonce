const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()
const _ = db.command

const cleanField = (value) => {
  if (typeof value === 'string') {
    return value.trim().replace(/^`\s*/, '').replace(/\s*`$/, '')
  }
  return value
}

exports.main = async (event, context) => {
  try {
    const { action, data, id } = event

    switch (action) {
      case 'getAll': {
        const { status, type } = data || {}
        let query = db.collection('notifications')
        const where = {}
        
        if (status) {
          where.status = status
        }
        if (type) {
          where.type = type
        }
        
        if (Object.keys(where).length > 0) {
          query = query.where(where)
        }

        try {
          const res = await query.orderBy('sort', 'asc').orderBy('createdAt', 'desc').get()
          return {
            success: true,
            data: res.data
          }
        } catch (sortErr) {
          console.warn('带排序获取失败，尝试降级获取', sortErr)
          const res = await query.get()
          return {
            success: true,
            data: res.data
          }
        }
      }

      case 'batchToggleStatus': {
        const { ids, status } = data
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return {
            success: false,
            message: '缺少公告ID列表'
          }
        }

        const promises = ids.map(notificationId => 
          db.collection('notifications').doc(notificationId).update({ 
            data: {
              status: status,
              updatedAt: db.serverDate()
            }
          })
        )
        await Promise.all(promises)

        return {
          success: true,
          message: '已成功' + (status === 'active' ? '启用' : '停用') + ' ' + ids.length + ' 个公告'
        }
      }

      case 'batchDelete': {
        const { ids } = data
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return {
            success: false,
            message: '缺少公告ID列表'
          }
        }

        const promises = ids.map(notificationId => 
          db.collection('notifications').doc(notificationId).remove()
        )
        await Promise.all(promises)

        return {
          success: true,
          message: '已成功删除 ' + ids.length + ' 个公告'
        }
      }

      case 'add': {
        const notificationData = {
          title: cleanField(data.title),
          content: cleanField(data.content),
          type: data.type || 'announcement',
          priority: data.priority || 'normal',
          showPopup: data.showPopup !== false,
          popupOnce: data.popupOnce !== false,
          linkType: data.linkType || 'none',
          linkValue: cleanField(data.linkValue),
          validFrom: data.validFrom ? new Date(data.validFrom) : db.serverDate(),
          validTo: data.validTo ? new Date(data.validTo) : null,
          status: data.status || 'active',
          sort: data.sort || 0,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }

        const res = await db.collection('notifications').add({ data: notificationData })
        return {
          success: true,
          message: '公告创建成功',
          data: { ...notificationData, _id: res._id }
        }
      }

      case 'update': {
        if (!id) {
          return {
            success: false,
            message: '缺少公告ID'
          }
        }

        const updateData = {
          title: data.title !== undefined ? cleanField(data.title) : undefined,
          content: data.content !== undefined ? cleanField(data.content) : undefined,
          type: data.type,
          priority: data.priority,
          showPopup: data.showPopup !== undefined ? data.showPopup : undefined,
          popupOnce: data.popupOnce !== undefined ? data.popupOnce : undefined,
          linkType: data.linkType,
          linkValue: data.linkValue !== undefined ? cleanField(data.linkValue) : undefined,
          validFrom: data.validFrom ? new Date(data.validFrom) : (data.validFrom === null ? null : undefined),
          validTo: data.validTo ? new Date(data.validTo) : (data.validTo === null ? null : undefined),
          status: data.status,
          sort: data.sort,
          updatedAt: db.serverDate()
        }

        const cleanUpdateData = {}
        for (const [key, value] of Object.entries(updateData)) {
          if (value !== undefined) {
            cleanUpdateData[key] = value
          }
        }

        await db.collection('notifications').doc(id).update({ data: cleanUpdateData })
        return {
          success: true,
          message: '公告更新成功'
        }
      }

      case 'delete': {
        if (!id) {
          return {
            success: false,
            message: '缺少公告ID'
          }
        }

        await db.collection('notifications').doc(id).remove()
        return {
          success: true,
          message: '公告删除成功'
        }
      }

      default:
        return {
          success: false,
          message: '未知操作类型'
        }
    }
  } catch (error) {
    console.error('公告操作失败:', error)
    return {
      success: false,
      message: '操作失败: ' + error.message,
      error: error.message
    }
  }
}
