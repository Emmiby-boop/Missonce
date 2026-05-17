const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const callerOpenid = wxContext.OPENID
  
  // Use provided UID or fall back to authenticated user's UID/OPENID
  // event.uid allows passing the UID explicitly from the client
  const uid = event.uid || wxContext.UID || wxContext.OPENID

  if (!uid) {
    return {
      success: false,
      message: 'No UID found in event or context'
    }
  }

  try {
    // 🔒 安全检查：验证调用者是否为管理员（首次初始化除外）
    const adminsCount = await db.collection('admins').count()
    
    if (adminsCount.total > 0) {
      // 已有管理员，必须验证调用者身份
      const callerCheck = await db.collection('admins')
        .where({ _openid: callerOpenid })
        .count()
      
      if (callerCheck.total === 0) {
        return {
          success: false,
          message: '权限不足，仅管理员可添加新管理员'
        }
      }
    }
    // 如果 admins 集合为空（首次初始化），允许直接添加第一个超级管理员

    // Check if already exists
    const countRes = await db.collection('admins').where({ uid }).count()
    if (countRes.total > 0) {
      return {
        success: true,
        message: 'User is already an admin',
        uid
      }
    }

    // Add admin
    const res = await db.collection('admins').add({
      data: {
        uid: uid,
        _openid: uid, // 关联 openid 用于鉴权
        role: adminsCount.total === 0 ? 'super_admin' : 'admin',
        createdAt: new Date(),
        comment: 'Added via addAdmin function'
      }
    })

    return {
      success: true,
      id: res._id,
      message: 'Admin added successfully',
      uid
    }
  } catch (err) {
    console.error(err)
    return {
      success: false,
      error: err.toString(),
      message: 'Failed to add admin'
    }
  }
}
