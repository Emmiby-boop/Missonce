import { getStorageAsync } from '../storageManager'

/**
 * 添加收藏
 */
export const addFavorite = async (resourceId, type, url, title) => {
  const db = wx.cloud.database()
  
  if (resourceId && !resourceId.startsWith('http') && !resourceId.startsWith('cloud:')) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'toggleInteraction',
        data: {
          interactionType: 'favorite',
          action: 'add',
          resourceId,
          payload: { type, url, title }
        }
      })
      if (res.result && res.result.success) {
        return res.result
      }
    } catch (e) {
      console.warn('云函数调用失败，降级使用直接数据库操作:', e)
    }
  }

  const data = {
    type,
    url,
    createTime: db.serverDate()
  }
  if (resourceId) data.resourceId = resourceId
  if (title) data.title = title
  
  const openid = await getStorageAsync('openid')
  if (openid) {
    try {
      const checkRes = await db.collection('favorites').where({
        _openid: openid,
        url: url
      }).count()
      
      if (checkRes.total > 0) {
        return { success: true, message: '已存在' }
      }
    } catch (e) {
      console.warn('检查收藏状态失败:', e)
    }
  }
  
  return db.collection('favorites').add({ data })
}

/**
 * 移除收藏
 */
export const removeFavorite = async (identifier, type) => {
  const db = wx.cloud.database()
  const openid = await getStorageAsync('openid')
  
  const isResourceId = !identifier.startsWith('http') && !identifier.startsWith('cloud:') && !type
  
  if (isResourceId) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'toggleInteraction',
        data: {
          interactionType: 'favorite',
          action: 'remove',
          resourceId: identifier
        }
      })
      if (res.result && res.result.success) {
        return res.result
      }
    } catch (e) {
      console.warn('云函数调用失败，降级使用直接数据库操作:', e)
    }
  }

  const where = {
    _openid: openid
  }

  if (type) {
    where.url = identifier
    where.type = type
  } else {
    where.resourceId = identifier
  }
  
  return db.collection('favorites').where(where).remove()
}

/**
 * 检查是否已收藏
 */
export const checkFavorite = async (identifier, type) => {
  const db = wx.cloud.database()
  const openid = await getStorageAsync('openid')
  
  const where = {
    _openid: openid
  }

  if (type) {
    where.url = identifier
    where.type = type
  } else {
    where.resourceId = identifier
  }
  
  return db.collection('favorites').where(where).count()
}

/**
 * 获取收藏总数
 */
export const getFavoritesCount = async () => {
  const db = wx.cloud.database()
  const openid = await getStorageAsync('openid')
  if (!openid) return { total: 0 }
  return db.collection('favorites').where({ _openid: openid }).count()
}

/**
 * 获取收藏列表
 */
export const getFavorites = async (type = 'all', page = 1, pageSize = 20) => {
  const db = wx.cloud.database()
  const openid = await getStorageAsync('openid')
  
  const where = {
    _openid: openid
  }
  
  if (type !== 'all') {
    where.type = type
  }
  
  return db.collection('favorites')
    .where(where)
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
}
