import logger from './logger'
import { getStorage, setStorage, getStorageAsync } from './storageManager'

// 云函数调用工具
// 小程序客户端不需要引入wx-server-sdk，直接使用wx.cloud
// const cloud = require('wx-server-sdk')

/**
 * 获取资源列表
 * @param {Object} params 
 * @param {String} params.type - 资源类型: wallpaper | avatar
 * @param {String} params.category - 分类名称
 * @param {String} params.tag - 标签名称
 * @param {Number} params.page - 页码,默认1
 * @param {Number} params.pageSize - 每页数量,默认20
 * @param {String} params.keyword - 搜索关键词
 */
export const getResources = async (params = {}) => {
  // 如果有搜索关键词或颜色，不使用缓存
  if (params.page === 1 && !params.keyword && !params.color) {
    const cacheKey = `resources_cache_${params.type}_${params.tag || 'all'}_${params.sort || 'latest'}`
    const now = Date.now()
    
    // 异步读取缓存
    const cached = await getStorageAsync(cacheKey)
    if (cached && cached.expire > now) {
      return cached.data
    }
    
    const res = await wx.cloud.callFunction({
      name: 'getResources',
      data: params
    })
    
    if (res.result && res.result.success) {
      // 异步写入缓存
      setStorage(cacheKey, {
        data: res,
        expire: now + 5 * 60 * 1000
      })
    }
    return res
  }
  
  // 非第一页不缓存
  return wx.cloud.callFunction({
    name: 'getResources',
    data: params
  })
}

/**
 * 获取分类/标签列表
 * @param {Object} params
 * @param {String} params.type - 类型: wallpaper | avatar | all
 * @param {String} params.source - 数据源: categories | tags
 */
export const getCategories = async (params = {}) => {
  const data = typeof params === 'string' ? { type: params } : params;
  const type = data.type || 'all'
  const source = data.source || 'categories'
  
  // 缓存 key
  const cacheKey = `categories_cache_${type}_${source}`
  const now = Date.now()
  
  // 异步读取缓存
  const cached = await getStorageAsync(cacheKey)
  if (cached && cached.expire > now) {
    return cached.data
  }
  
  const res = await wx.cloud.callFunction({
    name: 'getCategories',
    data: { type, source }
  })
  
  // 异步写入缓存（分类标签变化较少，缓存时间可以长一些）
  setStorage(cacheKey, {
    data: res,
    expire: now + 10 * 60 * 1000
  })
  return res
}

/**
 * 获取标签列表
 * @param {String} type - 类型: wallpaper | avatar | all
 */
export const getTags = (type = 'all') => {
  return wx.cloud.callFunction({
    name: 'getTags',
    data: { type }
  })
}

/**
 * 下载资源
 * @param {String} fileId - 云存储文件ID
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
 * 添加收藏
 * @param {String|null} resourceId - 资源ID (可选)
 * @param {String} type - 类型: wallpaper | avatar
 * @param {String} url - 资源URL
 * @param {String} title - 资源标题 (可选)
 */
export const addFavorite = async (resourceId, type, url, title) => {
  const db = wx.cloud.database()
  
  // 先尝试使用云函数（如果有资源ID）
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

  // 降级方案：直接操作数据库
  const data = {
    type,
    url,
    createTime: db.serverDate()
  }
  if (resourceId) data.resourceId = resourceId
  if (title) data.title = title
  
  // 先检查是否已存在
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
 * @param {String} identifier - 资源ID 或 资源URL
 * @param {String} [type] - 资源类型 (如果identifier是URL，则必填)
 */
export const removeFavorite = async (identifier, type) => {
  const db = wx.cloud.database()
  const openid = await getStorageAsync('openid')
  
  // 1. 尝试识别是否为 resourceId
  const isResourceId = !identifier.startsWith('http') && !identifier.startsWith('cloud:') && !type
  
  if (isResourceId) {
    try {
      // 推荐：使用事务云函数
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

  // 降级：根据 URL 删除 (旧逻辑)
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
 * @param {String} identifier - 资源ID 或 资源URL
 * @param {String} [type] - 资源类型 (如果identifier是URL，则必填)
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
 * 切换点赞状态
 * @param {String} resourceId - 资源ID
 * @param {Boolean} isLiked - 当前是否已点赞
 */
export const toggleLike = async (resourceId, isLiked) => {
  if (!resourceId) return { liked: isLiked }
  
  const openid = await getStorageAsync('openid')
  if (!openid) throw new Error('请先登录')

  // 使用事务云函数
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
 * @param {String} resourceId - 资源ID
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
 * @param {Object} resource - 资源对象
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
 * 获取个性化推荐资源
 * @param {Number} limit - 获取数量
 */
export const getPersonalizedRecommendations = async (limit = 10) => {
  try {
    const res = await wx.cloud.callFunction({
      name: 'getRecommendations',
      data: {
        action: 'personalized',
        limit
      }
    })
    
    if (res.result && res.result.success) {
      return res.result.data
    }
    throw new Error(res.result?.message || '获取推荐失败')
  } catch (e) {
    console.error('获取个性化推荐失败:', e)
    const db = wx.cloud.database()
    try {
      const fallback = await db.collection('resources')
        .orderBy('hotScore', 'desc')
        .limit(limit)
        .get()
      return fallback.data
    } catch (err) {
      return []
    }
  }
}

/**
 * 获取每日精选
 * @param {String} date - 日期字符串 (可选，默认当天)
 */
export const getDailyPicks = async (date = '') => {
  try {
    const res = await wx.cloud.callFunction({
      name: 'getDailyPicks',
      data: { date }
    })
    
    if (res.result && res.result.success) {
      return res.result.data
    }
    throw new Error(res.result?.error || '获取每日精选失败')
  } catch (e) {
    console.error('获取每日精选失败:', e)
    return null
  }
}

/**
 * 获取相关推荐资源
 * @param {String} resourceId - 资源ID
 * @param {Number} limit - 获取数量
 */
export const getRelatedRecommendations = async (resourceId, limit = 6) => {
  try {
    const res = await wx.cloud.callFunction({
      name: 'getRecommendations',
      data: {
        action: 'related',
        resourceId,
        limit
      }
    })
    
    if (res.result && res.result.success) {
      return res.result.data
    }
    throw new Error(res.result?.message || '获取相关推荐失败')
  } catch (e) {
    console.error('获取相关推荐失败:', e)
    return []
  }
}

/**
 * 获取相似资源
 * @param {Object} params
 * @param {String} params.type - wallpaper | avatar
 * @param {Array} params.tags - 标签列表
 * @param {String} params.excludeId - 排除的ID
 * @param {Number} params.limit - 数量
 */
export const getSimilarResources = async ({ type, tags = [], excludeId, limit = 6 }) => {
  const db = wx.cloud.database()
  const _ = db.command
  
  try {
    // 基础查询条件
    const where = {
      type,
      _id: _.neq(excludeId)
    }
    
    // 如果有标签，增加标签匹配逻辑
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
 * 获取收藏列表
 * @param {String} type - 类型: wallpaper | avatar | all
 * @param {Number} page - 页码
 * @param {Number} pageSize - 每页数量
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

/**
 * 获取下载记录
 * @param {Number} page - 页码 (从0开始)
 * @param {Number} pageSize - 每页数量
 */
export const getUserDownloads = (page = 0, pageSize = 20) => {
  const db = wx.cloud.database()
  return db.collection('downloads')
    .orderBy('createTime', 'desc')
    .skip(page * pageSize)
    .limit(pageSize)
    .get()
}




/**
 * 记录下载
 * @param {String|Object} resource - 资源ID 或 资源对象
 * @param {String} type - 类型: wallpaper | avatar
 */
export const recordDownload = (resource, type) => {
  const db = wx.cloud.database()
  
  const resourceId = typeof resource === 'string' ? resource : (resource.id || resource._id || 'unknown')
  
  getApp().logEvent('download', {
    type: type,
    resourceId: resourceId,
    url: typeof resource === 'object' ? resource.url : ''
  })

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
 * 上传资源
 * @param {Object} params - 资源参数
 * @param {String} params.type - 资源类型: wallpaper | avatar
 * @param {String} params.title - 资源标题
 * @param {String} params.category - 分类名称
 * @param {Array} params.categories - 分类数组
 * @param {Array} params.tags - 标签数组
 * @param {String} params.coverUrl - 缩略图URL
 * @param {String} params.originUrl - 原图URL
 * @param {Number} params.hotScore - 热度分数
 * @param {String} params.status - 状态: published | draft
 */
export const uploadResource = (params) => {
  return wx.cloud.callFunction({
    name: 'uploadResource',
    data: params
  })
}

/**
 * 获取首页数据（Banners + 动态布局）
 */
let _homeDataRefreshCallback = null

export const onHomeDataRefresh = (callback) => {
  _homeDataRefreshCallback = callback
  return () => {
    _homeDataRefreshCallback = null
  }
}

const _fetchHomeDataFromCloud = () => {
  return new Promise((resolve) => {
    wx.cloud.getTempFileURL({
      fileList: ['cloud://missonce-99-1gfaff6n002f6ac1.6d69-missonce-99-1gfaff6n002f6ac1-1318542519/miniprogram/home/home_prebuilt_v1.json']
    }).then(res => {
      if (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) {
        const tempUrl = res.fileList[0].tempFileURL
        console.log('[API] 云存储 CDN 链接获取成功:', tempUrl)
        wx.request({
          url: tempUrl,
          dataType: 'json',
          success: (reqRes) => {
            if (reqRes.data && reqRes.data.success) {
              console.log('[API] 云存储直连成功，跳过 callFunction 链路')
              resolve({ result: reqRes.data })
            } else {
              console.warn('[API] 云存储返回数据异常')
              resolve(null)
            }
          },
          fail: (err) => {
            console.warn('[API] 云存储 wx.request 失败:', err)
            resolve(null)
          }
        })
      } else {
        console.warn('[API] 云存储文件不存在，降级')
        resolve(null)
      }
    }).catch((err) => {
      console.warn('[API] getTempFileURL 失败，降级:', err)
      resolve(null)
    })
  })
}

export const getHomeData = async () => {
  const cacheKey = 'home_data_api_cache'
  const now = Date.now()

  // 异步读取缓存
  const cached = await getStorageAsync(cacheKey)
  if (cached && cached.expire > now) {
    console.log('[API] 使用本地缓存: getHomeData')
    return cached.data
  }

  const res = await _fetchHomeDataFromCloud()
  if (res) {
    // 异步写入缓存
    if (res.result && res.result.success) {
      setStorage(cacheKey, {
        data: res,
        expire: now + 10 * 60 * 1000
      })
      console.log('[API] 已缓存: getHomeData')
      if (_homeDataRefreshCallback) {
        _homeDataRefreshCallback(res)
      }
    }
    return res
  }

  console.log('[API] 云存储直连失败，降级使用云函数 getHomeData')
  const funcRes = await wx.cloud.callFunction({
    name: 'getHomeData'
  })
  
  if (!funcRes) {
    return { result: { success: false, message: '获取首页数据失败' } }
  }
  console.log('[API] getHomeData 返回结果:', funcRes)
  if (funcRes.result && funcRes.result.success) {
    // 异步写入缓存
    setStorage(cacheKey, {
      data: funcRes,
      expire: now + 10 * 60 * 1000
    })
    console.log('[API] 已缓存: getHomeData')
    if (_homeDataRefreshCallback) {
      _homeDataRefreshCallback(funcRes)
    }
  }
  return funcRes
}

/**
 * 获取页面板块配置（通用）
 * @param {String} page - 页面名称: home | avatar | wallpaper
 */
export const getPageSections = async (page = 'home') => {
  const cacheKey = `page_sections_cache_${page}`
  const now = Date.now()
  
  // 异步读取缓存
  const cached = await getStorageAsync(cacheKey)
  if (cached && cached.expire > now) {
    return cached.data
  }
  
  const res = await wx.cloud.callFunction({
    name: 'getPageSections',
    data: { page }
  })
  
  // 异步写入缓存（10 分钟）
  setStorage(cacheKey, {
    data: res,
    expire: now + 10 * 60 * 1000
  })
  return res
}

/**
 * 获取资源列表（通用）
 * @param {Object} params - 查询参数
 */
export const getResourceList = (params = {}) => {
  return wx.cloud.callFunction({
    name: 'getResourceList',
    data: params
  })
}

/**
 * 获取轮播图
 * @param {String} status - 状态: active | all
 */
export const getBanners = async (status = 'active') => {
  const cacheKey = `banners_cache_${status}`
  const now = Date.now()
  
  // 1. 异步读取本地缓存
  const cached = await getStorageAsync(cacheKey)
  if (cached && cached.data && cached.expire > now) {
    return cached.data
  }

  try {
    // 2. 调用云函数获取新数据
    const res = await wx.cloud.callFunction({
      name: 'getBanners',
      data: { status }
    })
    if (res.result && res.result.success) {
      const data = res.result.data
      // 异步缓存 5 分钟
      setStorage(cacheKey, {
        data,
        expire: now + 5 * 60 * 1000
      })
      return data
    }
    throw new Error('云函数返回失败')
  } catch (e) {
    console.warn('云函数获取轮播图失败，尝试降级查库', e)
    // 降级：直接查库
    const db = wx.cloud.database()
    const res = await db.collection('banners')
      .where({ status })
      .orderBy('sort', 'asc')
      .get()
    const data = res.data
    // 异步缓存降级数据（时间短一些）
    setStorage(cacheKey, {
      data,
      expire: now + 2 * 60 * 1000
    })
    return data
  }
}

/**
 * 根据URL查找资源（用于预览页的详细信息补全）
 * @param {String} url - 图片URL
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

export default {
  getResources,
  getCategories,
  getTags,
  downloadFile,
  addFavorite,
  removeFavorite,
  checkFavorite,
  getFavorites,
  getFavoritesCount,
  toggleLike,
  checkIsLiked,
  getUserDownloads,
  recordDownload,
  uploadResource,
  getHomeData,
  onHomeDataRefresh,
  getPageSections,
  getResourceList,
  getBanners,
  findResourceByUrl,
  getPersonalizedRecommendations,
  getRelatedRecommendations,
  getDailyPicks
}
