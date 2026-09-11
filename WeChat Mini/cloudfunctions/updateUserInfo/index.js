// 云函数入口文件 - updateUserInfo
// 更新用户个人信息（头像、昵称）
// 鉴权：通过 wxContext.OPENID 确保用户只能更新自己的信息
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    return { success: false, message: '未登录' }
  }

  const { avatarUrl, nickName } = event || {}

  // 至少需要一项更新
  if (!avatarUrl && !nickName) {
    return { success: false, message: '缺少更新字段' }
  }

  // 安全校验：禁止传入空字符串覆盖
  const updateData = {}
  let updateTime = new Date()
  if (avatarUrl && avatarUrl.length > 0) updateData.avatarUrl = avatarUrl
  if (nickName && nickName.length > 0) updateData.nickName = nickName
  updateData.updatedAt = updateTime

  if (Object.keys(updateData).length <= 1) {
    return { success: false, message: '无有效更新字段' }
  }

  try {
    const userCollection = db.collection('users')

    // 使用 _id = openid 查询（与 login 云函数保持一致）
    let user = null
    try {
      const res = await userCollection.doc(openid).get()
      user = res.data
    } catch (e) {
      // 如果按 _id 没找到，尝试按 openid 字段查询（兼容旧数据）
      try {
        const res = await userCollection.where({ openid }).get()
        if (res.data && res.data.length > 0) {
          user = res.data[0]
        }
      } catch (err) {
        console.error('updateUserInfo 查询用户失败:', err)
      }
    }

    if (!user) {
      return { success: false, message: '用户不存在' }
    }

    // 使用 _id 精确更新（与 login 云函数保持一致）
    await userCollection.doc(openid).update({ data: updateData })

    // 返回更新后的用户信息
    const updated = { ...user, ...updateData }
    return { success: true, user: updated, message: '更新成功' }
  } catch (e) {
    console.error('updateUserInfo 失败:', e)
    return { success: false, message: '更新失败', error: e.message }
  }
}