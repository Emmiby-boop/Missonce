const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

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
      case 'add': {
        const bannerData = {
          title: cleanField(data.title),
          image: cleanField(data.image),
          type: cleanField(data.type),
          target: cleanField(data.target),
          sort: data.sort || 0,
          status: data.status || 'active',
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }

        const res = await db.collection('banners').add({ data: bannerData })
        return {
          success: true,
          message: '轮播图创建成功',
          data: { ...bannerData, _id: res._id }
        }
      }

      case 'update': {
        if (!id) {
          return {
            success: false,
            message: '缺少轮播图ID'
          }
        }

        const updateData = {
          title: cleanField(data.title),
          image: cleanField(data.image),
          type: cleanField(data.type),
          target: cleanField(data.target),
          sort: data.sort || 0,
          status: data.status || 'active',
          updatedAt: db.serverDate()
        }

        await db.collection('banners').doc(id).update({ data: updateData })
        return {
          success: true,
          message: '轮播图更新成功'
        }
      }

      case 'delete': {
        if (!id) {
          return {
            success: false,
            message: '缺少轮播图ID'
          }
        }

        await db.collection('banners').doc(id).remove()
        return {
          success: true,
          message: '轮播图删除成功'
        }
      }

      case 'batchToggleStatus': {
        const { ids, status } = data
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return {
            success: false,
            message: '缺少轮播图ID列表'
          }
        }

        const promises = ids.map(bannerId => 
          db.collection('banners').doc(bannerId).update({ 
            data: {
              status: status,
              updatedAt: db.serverDate()
            }
          })
        )
        await Promise.all(promises)

        return {
          success: true,
          message: `已成功${status === 'active' ? '启用' : '停用'} ${ids.length} 个轮播图`
        }
      }

      case 'batchDelete': {
        const { ids } = data
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return {
            success: false,
            message: '缺少轮播图ID列表'
          }
        }

        const promises = ids.map(bannerId => 
          db.collection('banners').doc(bannerId).remove()
        )
        await Promise.all(promises)

        return {
          success: true,
          message: `已成功删除 ${ids.length} 个轮播图`
        }
      }

      case 'getAll': {
        const { status } = data || {}
        let query = db.collection('banners')
        
        if (status) {
          query = query.where({ status })
        }

        try {
          const res = await query.orderBy('sort', 'asc').get()
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

      default:
        return {
          success: false,
          message: '未知操作类型'
        }
    }
  } catch (error) {
    console.error('轮播图操作失败:', error)
    return {
      success: false,
      message: '操作失败: ' + error.message,
      error: error.message
    }
  }
}
