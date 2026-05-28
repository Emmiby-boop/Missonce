import logger from '../logger'
import { getStorageAsync, setStorage } from '../storageManager'

/**
 * 获取资源列表
 */
export const getResources = async (params = {}) => {
  if (params.page === 1 && !params.keyword && !params.color) {
    const cacheKey = `resources_cache_${params.type}_${params.tag || 'all'}_${params.sort || 'latest'}`
    const now = Date.now()
    
    const cached = await getStorageAsync(cacheKey)
    if (cached && cached.expire > now) {
      return cached.data
    }
    
    const res = await wx.cloud.callFunction({
      name: 'getResources',
      data: params
    })
    
    if (res.result && res.result.success) {
      setStorage(cacheKey, {
        data: res,
        expire: now + 5 * 60 * 1000
      })
    }
    return res
  }
  
  return wx.cloud.callFunction({
    name: 'getResources',
    data: params
  })
}

/**
 * 获取分类/标签列表
 */
export const getCategories = async (params = {}) => {
  const data = typeof params === 'string' ? { type: params } : params
  const type = data.type || 'all'
  const source = data.source || 'categories'
  
  const cacheKey = `categories_cache_${type}_${source}`
  const now = Date.now()
  
  const cached = await getStorageAsync(cacheKey)
  if (cached && cached.expire > now) {
    return cached.data
  }
  
  const res = await wx.cloud.callFunction({
    name: 'getCategories',
    data: { type, source }
  })
  
  setStorage(cacheKey, {
    data: res,
    expire: now + 10 * 60 * 1000
  })
  return res
}

/**
 * 获取标签列表
 */
export const getTags = (type = 'all') => {
  return wx.cloud.callFunction({
    name: 'getTags',
    data: { type }
  })
}

/**
 * 下载资源
 */
export const downloadFile = (fileId) => {
  return new Promise((resolve, reject) => {
    wx.cloud.downloadFile({
      fileID: fileId,
      success: resolve,
      fail: reject
    })
  })
}

/**
 * 获取资源列表（通用）
 */
export const getResourceList = (params = {}) => {
  return wx.cloud.callFunction({
    name: 'getResourceList',
    data: params
  })
}

/**
 * 获取相似资源
 */
export const getSimilarResources = async ({ type, tags = [], excludeId, limit = 6 }) => {
  const db = wx.cloud.database()
  const _ = db.command
  
  try {
    const where = {
      type,
      _id: _.neq(excludeId)
    }
    
    if (tags && tags.length > 0) {
      where.tags = _.in(tags)
    }
    
    const res = await db.collection('resources')
      .where(where)
      .limit(limit)
      .get()
      
    return res.data
  } catch (e) {
    console.error('获取相似资源失败:', e)
    return []
  }
}

/**
 * 根据URL查找资源
 */
export const findResourceByUrl = async (url) => {
  if (!url) return null
  
  const db = wx.cloud.database()
  const _ = db.command
  
  const conditions = [
    { coverUrl: url },
    { originUrl: url },
    { url: url }
  ]

  try {
    const decodedUrl = decodeURIComponent(url)
    if (decodedUrl !== url) {
      conditions.push({ coverUrl: decodedUrl })
      conditions.push({ originUrl: decodedUrl })
      conditions.push({ url: decodedUrl })
    }

    // 尝试匹配文件名
    const parts = decodedUrl.split('/')
    if (parts.length > 0) {
      const filename = parts[parts.length - 1]
      if (filename && (filename.includes('.') || filename.length > 10)) {
         const escapedFilename = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
         conditions.push({ coverUrl: db.RegExp({ regexp: escapedFilename + '$', options: 'i' }) })
         conditions.push({ originUrl: db.RegExp({ regexp: escapedFilename + '$', options: 'i' }) })
      }
    }
  } catch (e) {
    logger.error('URL解析失败', e)
  }
  
  try {
    const res = await db.collection('resources').where(_.or(conditions)).get()
    if (res.data && res.data.length > 0) {
      return res.data[0]
    }
  } catch (err) {
    logger.error('查找资源失败', err)
  }
  return null
}

/**
 * 上传资源
 */
export const uploadResource = (params) => {
  return wx.cloud.callFunction({
    name: 'uploadResource',
    data: params
  })
}
