const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

exports.main = async (event, context) => {
  const { action, data } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    // 获取管理员列表验证权限
    const adminRes = await db.collection('admins')
      .where({
        _openid: openid,
        role: 'admin'
      })
      .get()

    if (adminRes.data.length === 0) {
      return {
        success: false,
        message: '无权限操作'
      }
    }

    switch (action) {
      case 'add':
        // 检查是否已存在公众号配置
        const existing = await db.collection('contact_config')
          .where({ type: 'official_account' })
          .get()
        
        if (existing.data.length > 0) {
          // 如果已存在，更新
          const updateRes = await db.collection('contact_config')
            .doc(existing.data[0]._id)
            .update({
              data: {
                name: data.name,
                description: data.description,
                qrcodeUrl: data.qrcodeUrl,
                enabled: data.enabled,
                updateTime: db.serverDate()
              }
            })
          return {
            success: true,
            data: updateRes
          }
        } else {
          // 新增
          const addRes = await db.collection('contact_config')
            .add({
              data: {
                type: 'official_account',
                name: data.name,
                description: data.description,
                qrcodeUrl: data.qrcodeUrl,
                enabled: data.enabled,
                createTime: db.serverDate(),
                updateTime: db.serverDate()
              }
            })
          return {
            success: true,
            data: addRes
          }
        }

      case 'update':
        const updateRes = await db.collection('contact_config')
          .doc(data._id)
          .update({
            data: {
              name: data.name,
              description: data.description,
              qrcodeUrl: data.qrcodeUrl,
              enabled: data.enabled,
              updateTime: db.serverDate()
            }
          })
        return {
          success: true,
          data: updateRes
        }

      case 'delete':
        const deleteRes = await db.collection('contact_config')
          .doc(data._id)
          .remove()
        return {
          success: true,
          data: deleteRes
        }

      case 'list':
        const listRes = await db.collection('contact_config')
          .orderBy('createTime', 'desc')
          .get()
        return {
          success: true,
          data: listRes.data
        }

      default:
        return {
          success: false,
          message: '未知操作'
        }
    }
  } catch (e) {
    return {
      success: false,
      message: e.message
    }
  }
}
