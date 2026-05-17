// 云函数入口文件 - 统一交互管理（点赞/浏览/用户状态）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

// 管理员数据库实例（用于更新 resources 集合）
const adminDb = cloud.database({
  env: cloud.DYNAMIC_CURRENT_ENV,
  throwOnNotFound: false
})

/**
 * 统一交互处理函数
 * 支持：点赞、记录浏览、获取用户交互状态、获取资源统计
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  const { action, resourceId, resourceType, payload = {} } = event
  
  console.log('Received action:', action, 'resourceId:', resourceId, 'openid:', openid)
  
  // 路由处理
  const handlers = {
    'toggleLike': () => handleToggleLike({ resourceId, resourceType, openid }),
    'recordView': () => handleRecordView(resourceId, openid),
    'getUserInteraction': () => getUserInteractionStatus(resourceId, openid),
    'getStats': () => getResourceStats(resourceId)
  }
  
  if (!handlers[action]) {
    return { success: false, message: '未知操作: ' + action }
  }
  
  try {
    return await handlers[action]()
  } catch (e) {
    console.error('Handler error:', e)
    return { success: false, message: '操作失败', error: e.message }
  }
}

/**
 * 处理点赞/取消点赞
 */
async function handleToggleLike({ resourceId, resourceType, openid }) {
  if (!openid) return { success: false, message: '未登录' }
  if (!resourceId) return { success: false, message: '缺少资源ID' }
  
  const now = db.serverDate()
  
  try {
    // 检查是否已点赞
    let existing
    try {
      existing = await db.collection('likes').where({
        _openid: openid,
        resourceId: resourceId
      }).get()
    } catch (e) {
      console.log('likes collection not found, will create')
      existing = { data: [] }
    }
    
    if (existing.data.length > 0) {
      // 取消点赞
      await db.collection('likes').where({
        _openid: openid,
        resourceId: resourceId
      }).remove()
      
      // 更新资源统计（忽略错误）
      try {
        await db.collection('resources').doc(resourceId).update({
          data: {
            likeCount: _.inc(-1),
            hotScore: _.inc(-5),       // 总热度 -5
            dailyHotScore: _.inc(-5)   // 每日热度 -5
          }
        })
      } catch (e) {
        console.log('Update resource stats failed:', e.message)
      }
      
      return { success: true, isLiked: false }
    } else {
      // 添加点赞
      await db.collection('likes').add({
        data: {
          _openid: openid,
          resourceId,
          resourceType: resourceType || 'avatar',
          createTime: now
        }
      })
      
      // 更新资源统计（忽略错误）
      try {
        await db.collection('resources').doc(resourceId).update({
          data: {
            likeCount: _.inc(1),
            hotScore: _.inc(5),        // 总热度 +5
            dailyHotScore: _.inc(5)    // 每日热度 +5
          }
        })
      } catch (e) {
        console.log('Update resource stats failed:', e.message)
      }
      
      return { success: true, isLiked: true }
    }
  } catch (e) {
    console.error('Toggle like error:', e)
    return { success: false, message: '操作失败: ' + e.message }
  }
}

/**
 * 记录浏览（带去重逻辑）
 */
async function handleRecordView(resourceId, openid) {
  if (!resourceId) return { success: false, message: '缺少资源ID' }
  
  const now = db.serverDate()
  
  try {
    // 检查是否已浏览过（仅记录首次浏览的热度）
    let existing
    try {
      existing = await db.collection('views').where({
        _openid: openid,
        resourceId: resourceId
      }).get()
    } catch (e) {
      console.log('views collection not found')
      existing = { data: [] }
    }
    
    if (existing.data.length > 0) {
      // 已浏览过，只更新时间戳和浏览次数
      await db.collection('views').doc(existing.data[0]._id).update({
        data: {
          viewCount: _.inc(1),
          lastViewTime: now
        }
      })
      // 已浏览不再增加热度
      return { success: true, isFirstView: false }
    } else {
      // 首次浏览
      await db.collection('views').add({
        data: {
          _openid: openid,
          resourceId,
          viewCount: 1,
          firstViewTime: now,
          lastViewTime: now
        }
      })
      
      // 增加资源浏览量和热度（忽略错误）
      try {
        await db.collection('resources').doc(resourceId).update({
          data: {
            viewCount: _.inc(1),
            hotScore: _.inc(1),        // 总热度 +1
            dailyHotScore: _.inc(1)     // 每日热度 +1
          }
        })
      } catch (e) {
        console.log('Update resource view count failed:', e.message)
      }
      
      return { success: true, isFirstView: true }
    }
  } catch (e) {
    console.error('Record view error:', e)
    return { success: false, message: '操作失败: ' + e.message }
  }
}

/**
 * 获取用户交互状态（是否点赞、是否收藏）
 */
async function getUserInteractionStatus(resourceId, openid) {
  if (!openid) {
    return { success: true, data: { isLiked: false, isFavorite: false } }
  }
  
  try {
    const [likeRes, favoriteRes] = await Promise.all([
      db.collection('likes').where({ _openid: openid, resourceId }).get(),
      db.collection('favorites').where({ _openid: openid, resourceId }).get()
    ])
    
    return {
      success: true,
      data: {
        isLiked: likeRes.data.length > 0,
        isFavorite: favoriteRes.data.length > 0
      }
    }
  } catch (e) {
    console.error('Get user interaction error:', e)
    return { success: false, error: e.message }
  }
}

/**
 * 获取资源统计数据
 */
async function getResourceStats(resourceId) {
  if (!resourceId) {
    return { success: false, message: '缺少资源ID' }
  }
  
  try {
    const res = await db.collection('resources').doc(resourceId).get()
    const data = res.data || {}
    
    return {
      success: true,
      data: {
        hotScore: data.hotScore || 0,
        dailyHotScore: data.dailyHotScore || 0,
        likeCount: data.likeCount || 0,
        commentCount: data.commentCount || 0,
        favoriteCount: data.favoriteCount || 0
      }
    }
  } catch (e) {
    console.error('Get stats error:', e)
    // 资源可能不存在，返回默认值
    return {
      success: true,
      data: {
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        favoriteCount: 0
      }
    }
  }
}
