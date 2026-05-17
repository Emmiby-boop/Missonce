const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const { action, data, notificationIds } = event
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    switch (action) {
      case 'getActiveNotifications': {
        const now = db.serverDate()
        
        let query = db.collection('notifications')
          .where({
            status: 'active',
            validFrom: _.lte(now)
          })
        
        const res = await query.orderBy('sort', 'asc').orderBy('createdAt', 'desc').get()
        
        const notifications = res.data.filter(item => {
          if (!item.validTo) return true
          return new Date(item.validTo) >= new Date()
        })
        
        return {
          success: true,
          data: notifications
        }
      }

      case 'markAsRead': {
        const { notificationId } = data
        if (!notificationId) {
          return {
            success: false,
            message: '缺少公告ID'
          }
        }

        const userRes = await db.collection('user_notifications')
          .where({ _openid: openid })
          .limit(1)
          .get()

        if (userRes.data.length > 0) {
          const user = userRes.data[0]
          const readIds = user.readNotificationIds || []
          
          if (!readIds.includes(notificationId)) {
            readIds.push(notificationId)
            await db.collection('user_notifications').doc(user._id).update({
              data: {
                readNotificationIds: readIds,
                updatedAt: db.serverDate()
              }
            })
          }
        } else {
          await db.collection('user_notifications').add({
            data: {
              readNotificationIds: [notificationId],
              createdAt: db.serverDate(),
              updatedAt: db.serverDate()
            }
          })
        }

        return {
          success: true,
          message: '标记已读成功'
        }
      }

      case 'batchMarkAsRead': {
        if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
          return {
            success: false,
            message: '缺少公告ID列表'
          }
        }

        const userRes = await db.collection('user_notifications')
          .where({ _openid: openid })
          .limit(1)
          .get()

        if (userRes.data.length > 0) {
          const user = userRes.data[0]
          let readIds = user.readNotificationIds || []
          
          notificationIds.forEach(id => {
            if (!readIds.includes(id)) {
              readIds.push(id)
            }
          })
          
          await db.collection('user_notifications').doc(user._id).update({
            data: {
              readNotificationIds: readIds,
              updatedAt: db.serverDate()
            }
          })
        } else {
          await db.collection('user_notifications').add({
            data: {
              readNotificationIds: notificationIds,
              createdAt: db.serverDate(),
              updatedAt: db.serverDate()
            }
          })
        }

        return {
          success: true,
          message: '批量标记已读成功'
        }
      }

      case 'getUserReadStatus': {
        const userRes = await db.collection('user_notifications')
          .where({ _openid: openid })
          .limit(1)
          .get()

        return {
          success: true,
          data: {
            readNotificationIds: userRes.data.length > 0 ? userRes.data[0].readNotificationIds || [] : []
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
    console.error('通知操作失败:', error)
    return {
      success: false,
      message: '操作失败: ' + error.message,
      error: error.message
    }
  }
}
