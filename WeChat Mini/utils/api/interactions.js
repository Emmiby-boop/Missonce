import logger from '../logger'
import { getStorageAsync } from '../storageManager'

/**
 * 切换点赞状态
 */
export const toggleLike = async (resourceId, isLiked) => {
  if (!resourceId) return { liked: isLiked }
  
  const openid = await getStorageAsync('openid')
  if (!openid) throw new Error('请先登录')

  const res = await wx.cloud.callFunction({
    name: 'toggleInteraction',
    data: {
      interactionType: 'like',
      action: isLiked ? 'remove' : 'add',
      resourceId
    }
  })

  if (!res.result.success) {
    logger.error('切换点赞失败', res.result.message)
    throw new Error(res.result.message)
  }

  return { liked: !isLiked }
}

/**
 * 检查资源是否被点赞
 */
export const checkIsLiked = async (resourceId) => {
  const db = wx.cloud.database()
  const openid = await getStorageAsync('openid')
  
  if (!openid) return false
  
  try {
    const res = await db.collection('likes').where({
      _openid: openid,
      resourceId: resourceId
    }).count()
    return res.total > 0
  } catch (e) {
    return false
  }
}

/**
 * 记录浏览历史
 */
export const recordBrowseHistory = async (resource) => {
  const db = wx.cloud.database()
  const openid = await getStorageAsync('openid')
  console.log('[浏览记录] openid:', openid, 'resource:', resource)

  try {
    const resourceId = resource.id || resource._id
    console.log('[浏览记录] resourceId:', resourceId)
    if (!resourceId) {
      console.warn('[浏览记录] 没有resourceId，跳过记录')
      return
    }

    const promises = []

    if (openid) {
      promises.push(
        db.collection('browse_history').add({
          data: {
            resourceId,
            type: resource.type,
            categories: resource.categories || [],
            tags: resource.tags || [],
            createTime: db.serverDate()
          }
        }).then(() => {
          console.log('[浏览记录] 写入browse_history成功')
        }).catch(err => {
          console.error('[浏览记录] 写入browse_history失败:', err)
        })
      )
    } else {
      console.log('[浏览记录] 未登录，跳过浏览历史记录')
    }

    promises.push(
      wx.cloud.callFunction({
        name: 'batchUpdateStats',
        data: {
          resourceId,
          actions: [
            { field: 'views', value: 1 },
            { field: 'hotScore', value: 1 }
          ]
        }
      }).then(res => {
        console.log('[浏览记录] 批量更新统计成功:', res)
      }).catch(err => {
        console.error('[浏览记录] 批量更新统计失败:', err)
      })
    )

    await Promise.all(promises)
  } catch (e) {
    console.error('记录浏览历史失败:', e)
  }
}

/**
 * 记录下载（带去重）
 */
export const recordDownload = async (resource, type) => {
  const db = wx.cloud.database()

  const resourceId = typeof resource === 'string' ? resource : (resource.id || resource._id || 'unknown')
  const resourceUrl = typeof resource === 'object' ? (resource.url || '') : ''

  getApp().logEvent('download', {
    type: type,
    resourceId: resourceId,
    url: resourceUrl
  })

  // 云端去重：同一用户 + 同一资源 24小时内不重复记录
  if (resourceId && resourceId !== 'unknown') {
    try {
      const _ = db.command
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const dupConditions = [
        { createTime: _.gt(oneDayAgo) },
        _.or([
          { resourceId: resourceId },
          ...(resourceUrl ? [{ url: resourceUrl }] : [])
        ])
      ]
      const dupQuery = await db.collection('downloads')
        .where(_.and(dupConditions))
        .count()

      if (dupQuery.total > 0) {
        console.log('[下载记录] 资源已存在近期下载记录，跳过重复写入, resourceId:', resourceId)
        return { success: true, message: '已存在，跳过重复记录', skipped: true }
      }
    } catch (e) {
      console.warn('[下载记录] 去重查询失败，继续写入:', e)
    }
  }

  wx.cloud.callFunction({
    name: 'userPoints',
    data: {
      action: 'recordDownload',
      resourceId: resourceId,
      resourceType: type,
      downloadMethod: 'free'
    }
  }).then(res => {
    console.log('记录下载成功:', res)
  }).catch(err => {
    console.error('记录下载失败:', err)
  })

  if (resourceId && resourceId !== 'unknown' && !resourceId.startsWith('http') && !resourceId.startsWith('cloud:')) {
    wx.cloud.callFunction({
      name: 'batchUpdateStats',
      data: {
        resourceId,
        actions: [
          { field: 'downloads', value: 1 },
          { field: 'hotScore', value: 5 },
          { field: 'views', value: 1 }
        ]
      }
    }).then(() => console.log('批量更新统计成功')).catch(err => console.error('批量更新统计失败:', err))
  } else {
    console.warn('Invalid resourceId for stats update:', resourceId, 'resource object:', resource)
  }

  let data = {
    type,
    createTime: db.serverDate()
  }

  if (typeof resource === 'string') {
    data.resourceId = resource
  } else if (typeof resource === 'object') {
    data = { ...data, ...resource }
    data.createTime = db.serverDate()
  }

  return db.collection('downloads').add({
    data
  })
}

/**
 * 获取下载记录
 */
export const getUserDownloads = (page = 0, pageSize = 20) => {
  const db = wx.cloud.database()
  return db.collection('downloads')
    .orderBy('createTime', 'desc')
    .skip(page * pageSize)
    .limit(pageSize)
    .get()
}
