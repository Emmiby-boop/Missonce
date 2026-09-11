import logger from '../logger'
import { getStorageAsync, setStorage } from '../storageManager'

/**
 * 获取资源列表
 */
export const getResources = async (params = {}) => {
  // 🔥 [相似推荐] sort=random/hotRandom/latestRandom 必须跳过缓存：随机结果被缓存会变成"固定的随机"，失去随机意义
  // 5分钟缓存对热门/最新列表很有效，但对每次进入都要换内容的随机排序反而是 bug
  const isRandom = params.sort === 'random' || params.sort === 'hotRandom' || params.sort === 'latestRandom'

  if (!isRandom && params.page === 1 && !params.keyword && !params.color) {
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

// 🔥 P0-2 资源直查缓存：避免每次进预览页都查库（5 分钟 TTL）
const _findCache = new Map()
const FIND_CACHE_TTL = 5 * 60 * 1000

function _getCached(key) {
  const entry = _findCache.get(key)
  if (entry && Date.now() - entry.time < FIND_CACHE_TTL) {
    return entry.data
  }
  if (entry) _findCache.delete(key)
  return null
}

function _setCached(key, data) {
  _findCache.set(key, { data, time: Date.now() })
}

/**
 * 使资源缓存失效（资源更新/删除时调用）
 */
export const invalidateResourceCache = (idOrUrl) => {
  if (!idOrUrl) return
  _findCache.delete(idOrUrl)
}

/**
 * 根据URL查找资源
 */
export const findResourceByUrl = async (url) => {
  if (!url) return null

  // 🔥 P0-2 命中缓存直接返回
  const cached = _getCached(url)
  if (cached !== null) return cached

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
      _setCached(url, res.data[0])  // 🔥 P0-2 写入缓存
      return res.data[0]
    }
  } catch (err) {
    logger.error('查找资源失败', err)
  }
  return null
}

/**
 * 根据资源ID查找资源
 */
export const findResourceById = async (id) => {
  if (!id) return null
  // 🔥 P0-2 命中缓存直接返回
  const cached = _getCached(id)
  if (cached !== null) return cached
  try {
    const db = wx.cloud.database()
    const res = await db.collection('resources').doc(id).get()
    const data = res.data || null
    if (data) _setCached(id, data)  // 🔥 P0-2 写入缓存
    return data
  } catch (err) {
    // doc(id).get() 在 id 不存在时抛异常
    logger.error('根据ID查找资源失败', err)
    return null
  }
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
