import { logger } from './logger'
import { STORAGE_KEYS } from '../config/constants'

/**
 * 统一认证管理模块
 */

/**
 * 检查登录状态
 */
export const checkLoginStatus = () => {
  const token = wx.getStorageSync(STORAGE_KEYS.TOKEN)
  const user = wx.getStorageSync(STORAGE_KEYS.USER)
  
  // 同步全局状态
  const app = getApp()
  if (app) {
    if (token && user) {
      app.globalData.isLoggedIn = true
      app.globalData.token = token
      app.globalData.user = user
      app.globalData.userInfo = user
    } else {
      app.globalData.isLoggedIn = false
      app.globalData.token = null
      app.globalData.user = null
      app.globalData.userInfo = null
    }
  }
  
  return !!token
}

/**
 * 获取用户信息
 */
export const getUserInfo = () => {
  return wx.getStorageSync(STORAGE_KEYS.USER) || wx.getStorageSync(STORAGE_KEYS.USER_INFO) || null
}

/**
 * 获取 Token
 */
export const getToken = () => {
  return wx.getStorageSync(STORAGE_KEYS.TOKEN) || null
}

/**
 * 登出
 */
export const logout = () => {
  wx.removeStorageSync(STORAGE_KEYS.TOKEN)
  wx.removeStorageSync(STORAGE_KEYS.OPENID)
  wx.removeStorageSync(STORAGE_KEYS.USER)
  wx.removeStorageSync(STORAGE_KEYS.USER_INFO)
  
  const app = getApp()
  if (app) {
    app.globalData.isLoggedIn = false
    app.globalData.token = null
    app.globalData.openid = null
    app.globalData.user = null
    app.globalData.userInfo = null
  }
  
  wx.showToast({ title: '已登出', icon: 'none' })
}

/**
 * 获取登录凭证
 */
const getLoginCode = () => {
  return new Promise((resolve, reject) => {
    // 优先使用 wx.login
    wx.login({ success: resolve, fail: reject })
  })
}

/**
 * 完整的登录流程：获取用户信息 -> 获取Code -> 云函数登录 -> 保存状态
 * @returns {Promise<Object>} 用户信息对象
 */
export const loginWithProfile = async () => {
  try {
    // 1. 获取用户信息 (需要用户授权)
    const profileRes = await wx.getUserProfile({ desc: '用于完善用户资料' })
    const userInfo = profileRes.userInfo || {}
    
    // 2. 准备用户数据
    const safeNick = userInfo.nickName || `用户${Math.floor(100000 + Math.random() * 900000)}`
    const safeAvatar = userInfo.avatarUrl || '/images/default-avatar.png'
    const mergedUser = { ...userInfo, nickName: safeNick, avatarUrl: safeAvatar }

    // 3. 获取 Code
    const codeRes = await getLoginCode()
    if (!codeRes.code) {
      throw new Error('获取登录凭证失败')
    }

    // 4. 调用云函数登录
    const loginRes = await wx.cloud.callFunction({
      name: 'login',
      data: { 
        code: codeRes.code, 
        // appid: APPID, // 云函数通常能自动获取，不需要传
        userInfo: mergedUser 
      }
    })

    const result = loginRes.result || {}
    
    if (result.success && result.token) {
      // 5. 构造最终用户对象
      const dbUser = result.user || {}
      
      // 优先使用云端返回的数据（因为云端可能已经更新了），如果没有则回退到前端获取的数据
      const finalUser = {
        ...mergedUser, // 基础数据
        ...dbUser,     // 云端数据覆盖
        token: result.token,
        openid: result.openid,
        // 确保关键字段存在
        nickName: dbUser.nickName || mergedUser.nickName,
        avatarUrl: dbUser.avatarUrl || mergedUser.avatarUrl,
        isVip: dbUser.isVip || false,
        vipExpire: dbUser.vipExpire || null
      }
      
      // 6. 保存到本地存储
      wx.setStorageSync(STORAGE_KEYS.TOKEN, result.token)
      wx.setStorageSync(STORAGE_KEYS.OPENID, result.openid)
      wx.setStorageSync(STORAGE_KEYS.USER, finalUser)
      wx.setStorageSync(STORAGE_KEYS.USER_INFO, finalUser)
      
      // 7. 更新全局状态
      const app = getApp()
      if (app) {
        app.globalData.isLoggedIn = true
        app.globalData.token = result.token
        app.globalData.openid = result.openid
        app.globalData.user = finalUser
        app.globalData.userInfo = finalUser
      }
      
      return finalUser
    } else {
      throw new Error(result.message || '登录失败')
    }
  } catch (err) {
    logger.error('登录流程失败:', err)
    throw err
  }
}

/**
 * 更新用户信息 (仅更新资料，不重新登录)
 */
export const updateUserProfile = async (userInfo) => {
  const token = getToken()
  if (!token) return
  
  try {
    const res = await wx.cloud.callFunction({
      name: 'updateUserInfo',
      data: {
        token: token,
        avatarUrl: userInfo.avatarUrl,
        nickName: userInfo.nickName
      }
    })
    
    if (res.result && res.result.success) {
      // 更新本地存储
      const currentUser = getUserInfo() || {}
      const newUser = { ...currentUser, ...res.result.user }
      
      wx.setStorageSync(STORAGE_KEYS.USER, newUser)
      wx.setStorageSync(STORAGE_KEYS.USER_INFO, newUser)
      
      const app = getApp()
      if (app) {
        app.globalData.user = newUser
        app.globalData.userInfo = newUser
      }
      return newUser
    }
  } catch (err) {
    logger.error('更新用户信息失败:', err)
    throw err
  }
}

/**
 * 跳转到登录页 (如果需要)
 */
export const navigateToLogin = () => {
  wx.navigateTo({ url: '/subpackages/login/login' })
}

/**
 * 保存用户资料到云数据库
 * @param {Object} userInfo - 用户信息对象
 */
export const saveUserToDB = async (userInfo) => {
  const db = wx.cloud.database()
  const openid = userInfo.openid || wx.getStorageSync(STORAGE_KEYS.OPENID)
  if (!openid) return

  const now = db.serverDate()
  
  // 获取最新的签到数据 (保留本地签到进度)
  const checkInDays = wx.getStorageSync(STORAGE_KEYS.CHECK_IN_DAYS) || 0
  const lastCheckInDate = wx.getStorageSync(STORAGE_KEYS.LAST_CHECK_IN_DATE) || ''

  const data = {
    nickName: userInfo.nickName,
    avatarUrl: userInfo.avatarUrl,
    phoneNumber: userInfo.phoneNumber,
    gender: userInfo.gender,
    country: userInfo.country,
    province: userInfo.province,
    city: userInfo.city,
    checkInDays,
    lastCheckInDate,
    updatedAt: now
  }
  
  try {
    const check = await db.collection('users').doc(openid).get().catch(() => null)
    if (!check) {
      data.createdAt = now
      data._id = openid
      await db.collection('users').add({ data })
    } else {
      await db.collection('users').doc(openid).update({ data })
    }
    return true
  } catch (e) {
    logger.error('保存用户资料失败', e)
    throw e
  }
}

// 内存缓存上次同步时间
let lastSyncTime = 0
const SYNC_INTERVAL = 5 * 60 * 1000 // 5分钟内不重复同步

/**
 * 从云端同步用户信息到本地
 * @param {Boolean} force - 是否强制同步
 */
export const syncUserFromCloud = async (force = false) => {
  const openid = wx.getStorageSync(STORAGE_KEYS.OPENID)
  if (!openid) return null

  // 频率限制
  const now = Date.now()
  if (!force && (now - lastSyncTime < SYNC_INTERVAL)) {
    // console.log('距离上次同步不足5分钟，使用本地缓存')
    return wx.getStorageSync(STORAGE_KEYS.USER_INFO)
  }

  try {
    const db = wx.cloud.database()
    const res = await db.collection('users').doc(openid).get()
    const dbUser = res.data
    
    if (dbUser) {
      lastSyncTime = now // 更新同步时间
      const localUserInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO) || {}
      
      // 1. 同步基础信息
      // 即使数据一样，也强制更新一次本地存储，防止字段缺失
      logger.log('正在从云端同步用户信息...')
      const newUserInfo = {
          ...localUserInfo,
          ...dbUser, // 优先使用云端数据
          nickName: dbUser.nickName || localUserInfo.nickName,
          avatarUrl: dbUser.avatarUrl || localUserInfo.avatarUrl
      }
      
      wx.setStorageSync(STORAGE_KEYS.USER_INFO, newUserInfo)
      wx.setStorageSync(STORAGE_KEYS.USER, newUserInfo) // 保持一致
      
      const app = getApp()
      if (app) {
          app.globalData.userInfo = newUserInfo
          app.globalData.user = newUserInfo
      }

      // 2. 强制同步签到数据 (防止本地缓存丢失)
      if (dbUser.checkInDays && dbUser.checkInDays !== wx.getStorageSync(STORAGE_KEYS.CHECK_IN_DAYS)) {
        wx.setStorageSync(STORAGE_KEYS.CHECK_IN_DAYS, dbUser.checkInDays)
      }
      if (dbUser.lastCheckInDate && dbUser.lastCheckInDate !== wx.getStorageSync(STORAGE_KEYS.LAST_CHECK_IN_DATE)) {
        wx.setStorageSync(STORAGE_KEYS.LAST_CHECK_IN_DATE, dbUser.lastCheckInDate)
      }
      
      return dbUser
    }
  } catch (e) {
    logger.warn('同步用户信息失败:', e)
  }
  return null
}

/**
 * 上传用户头像到云存储
 * @param {String} filePath - 本地文件路径
 * @param {String} openid - 用户OpenID (可选)
 * @returns {Promise<String>} 文件ID
 */
export const uploadUserAvatar = async (filePath, openid) => {
  if (!filePath) return ''
  if (filePath.startsWith('cloud://')) return filePath
  if (filePath === '/images/default-avatar.png') return filePath

  const finalOpenid = openid || wx.getStorageSync(STORAGE_KEYS.OPENID)
  if (!finalOpenid) throw new Error('未获取到OpenID')

  const cloudPath = `user-avatars/${finalOpenid}-${Date.now()}.png`
  
  try {
    const res = await wx.cloud.uploadFile({
      cloudPath,
      filePath
    })
    return res.fileID
  } catch (e) {
    logger.error('上传头像失败:', e)
    throw e
  }
}

export default {
  checkLoginStatus,
  getUserInfo,
  getToken,
  logout,
  loginWithProfile,
  updateUserProfile,
  navigateToLogin,
  saveUserToDB,
  syncUserFromCloud,
  uploadUserAvatar
}
