const cloud = require('wx-server-sdk')
const { withAdmin } = require('./withAdmin')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

const handleRequest = async (event, context, admin) => {
  const { action, data } = event

  // 鉴权由 withAdmin 统一处理：Web 后台走 adminToken，小程序端管理员走 openid。
  // 旧实现在这里查 { _openid: openid, role: 'admin' } —— Web 后台没有 openid 恒为空，
  // 导致后台无法新增/编辑/删除任何联系配置；且 super_admin 也会被这条查询挡在门外。

  try {
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

exports.main = withAdmin(handleRequest)
