// 云函数入口文件
const cloud = require('wx-server-sdk')
const crypto = require('crypto')

// 使用当前环境，避免“云开发环境未提前初始化”错误
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { code, appid } = event || {}

  if (!code) {
    return { success: false, message: '缺少登录 code' }
  }

  let openid = wxContext.OPENID
  let session_key = ''
  let unionid = ''

  try {
    // 1) code2Session 获取 openid / session_key；若不可用则降级使用 wxContext.OPENID
    const sess = await cloud.openapi.auth.code2Session({
      js_code: code,
      grant_type: 'authorization_code',
      appid: appid || wxContext.APPID
    })
    openid = sess?.openid || openid
    session_key = sess?.session_key || ''
    unionid = sess?.unionid || ''
  } catch (error) {
    console.warn('code2Session 调用失败，降级使用 wxContext.OPENID:', error)
  }

  if (!openid) {
    return { success: false, message: '未获取到 openid' }
  }

  // 检查用户是否已存在
  const db = cloud.database()
  const userCollection = db.collection('users')
  
  // 优先通过 _id (即 openid) 查询，确保与 profile-edit.js 逻辑一致
  let user = null
  try {
    const res = await userCollection.doc(openid).get()
    user = res.data
  } catch (e) {
    // 如果按 _id 没找到，尝试按字段查询（兼容旧数据）
    try {
      const res = await userCollection.where({ openid }).get()
      if (res.data && res.data.length > 0) {
        user = res.data[0]
      }
    } catch (err) {
      console.warn('查询用户失败:', err)
    }
  }

  // 如果用户不存在，创建新用户
  if (!user) {
    // 尝试从 event.userInfo 中获取用户资料 (如果前端传了)
    const clientUserInfo = event.userInfo || {}
    const deviceInfo = event.deviceInfo || {}
    
    user = {
      _id: openid, // 强制使用 openid 作为主键，防止产生重复记录
      openid,
      unionid: unionid || '',
      createdAt: new Date(),
      lastLoginAt: new Date(),
      nickName: clientUserInfo.nickName || '', // 优先使用前端传入的资料
      avatarUrl: clientUserInfo.avatarUrl || '', // 优先使用前端传入的资料
      deviceInfo: deviceInfo // 保存设备信息
    }
    
    try {
      await userCollection.add({
        data: user
      })
    } catch (e) {
      // 并发处理：如果 add 失败（可能刚刚被创建），尝试重新读取
      console.warn('创建用户失败，尝试重新读取:', e)
      try {
        const res = await userCollection.doc(openid).get()
        user = res.data
      } catch (err) {
        // 再次失败，无法恢复
        return { success: false, message: '创建用户失败' }
      }
    }
  } else {
    // 更新最后登录时间和设备信息
    const updateData = {
        lastLoginAt: new Date()
    }
    
    // 仅在数据库中字段为空时，才使用前端传入的资料填充
    // 避免覆盖用户已修改的自定义资料
    const clientUserInfo = event.userInfo || {}
    const deviceInfo = event.deviceInfo || {}
    
    if (!user.nickName && clientUserInfo.nickName) {
        updateData.nickName = clientUserInfo.nickName
    }
    if (!user.avatarUrl && clientUserInfo.avatarUrl) {
        updateData.avatarUrl = clientUserInfo.avatarUrl
    }
    
    // 更新设备信息
    updateData.deviceInfo = deviceInfo
    
    try {
        await userCollection.doc(user._id).update({
            data: updateData
        })
        // 合并最新数据返回
        user = { ...user, ...updateData }
    } catch(e) {
        console.warn('更新登录时间失败', e)
    }
  }

  // 2) 生成更安全的 Token (使用 crypto 生成随机字符串)
  // 生产环境建议结合 JWT 签名，这里使用高强度随机字符串作为 Session ID
  const token = crypto.randomBytes(32).toString('hex')
  
  // session_key 仅服务端使用（解密手机号等），严禁下发到客户端
  console.log('[login] session_key 已获取，长度:', session_key.length)
  
  // 返回完整用户信息（包含 nickName, avatarUrl 等）
  return {
    success: true,
    openid,
    unionid,
    token,
    user
  }
}
