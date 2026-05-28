// 云函数入口文件 - 评论管理（带内容安全检查）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

/**
 * 评论管理云函数
 * 支持：获取评论列表、添加评论、删除评论、获取评论数
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  const { action, resourceId, resourceType, resourceUrl, data = {} } = event
  
  // 路由处理
  const handlers = {
    'list': () => getComments(resourceId, data.lastId, data.pageSize || 20),
    'add': () => addComment({
      openid,
      resourceId,
      resourceType,
      resourceUrl,
      content: data.content,
      nickName: data.nickName,
      avatarUrl: data.avatarUrl
    }),
    'remove': () => removeComment(openid, data.commentId),
    'count': () => getCommentCount(resourceId)
  }
  
  if (!handlers[action]) {
    return { success: false, message: '未知操作: ' + action }
  }
  
  return await handlers[action]()
}

/**
 * 获取评论列表
 */
async function getComments(resourceId, lastId, pageSize) {
  if (!resourceId) return { success: false, message: '缺少资源ID' }
  
  try {
    let query = db.collection('comments')
      .where({
        resourceId: resourceId,
        status: 'normal'
      })
      .orderBy('createTime', 'desc')
      .limit(pageSize)
    
    // 游标分页
    if (lastId) {
      try {
        const lastDoc = await db.collection('comments').doc(lastId).get()
        query = query.where({
          createTime: _.lt(lastDoc.data.createTime)
        })
      } catch (e) {
        console.log('lastId not found, ignore pagination')
      }
    }
    
    const res = await query.get()
    
    // 格式化返回数据
    const comments = (res.data || []).map(c => ({
      id: c._id,
      _openid: c._openid,
      resourceId: c.resourceId,
      content: c.content,
      nickName: c.nickName,
      avatarUrl: c.avatarUrl,
      likeCount: c.likeCount || 0,
      createTime: c.createTime,
      time: formatTime(c.createTime)
    }))
    
    return {
      success: true,
      data: comments,
      hasMore: comments.length === pageSize
    }
  } catch (e) {
    console.error('Get comments error:', e)
    return { success: false, error: e.message }
  }
}

/**
 * 添加评论（带内容安全检查）
 */
async function addComment({ openid, resourceId, resourceType, resourceUrl, content, nickName, avatarUrl }) {
  if (!openid) return { success: false, message: '请先登录' }
  if (!resourceId) return { success: false, message: '缺少资源ID' }
  if (!content || content.trim() === '') return { success: false, message: '评论内容不能为空' }
  
  const trimmedContent = content.trim()
  
  // 内容长度限制
  if (trimmedContent.length > 500) return { success: false, message: '评论内容过长' }
  
  const now = db.serverDate()
  
  try {
    // === 内容安全检查（必选）===
    try {
      const securityResult = await cloud.openapi.security.msgSecCheck({
        content: trimmedContent
      })
      
      if (securityResult.errCode !== 0) {
        console.log('Content security check failed:', securityResult.errCode)
        return { success: false, message: '评论内容包含敏感信息，请修改后重试' }
      }
    } catch (securityErr) {
      console.error('Security check error:', securityErr)
      // 检查失败时保守处理：允许通过（可能是配额用尽）
      // 生产环境建议：返回错误让用户稍后重试
    }
    
    // 添加评论
    const addResult = await db.collection('comments').add({
      data: {
        _openid: openid,
        resourceId,
        resourceType: resourceType || 'avatar',
        resourceUrl: resourceUrl || '',
        content: trimmedContent,
        nickName: nickName || '匿名用户',
        avatarUrl: avatarUrl || '',
        status: 'normal',
        likeCount: 0,
        createTime: now
      }
    })
    
    // 更新资源评论数
    try {
      await db.collection('resources').doc(resourceId).update({
        data: {
          commentCount: _.inc(1),
          hotScore: _.inc(10),        // 总热度 +10
          dailyHotScore: _.inc(10)    // 每日热度 +10
        }
      })
    } catch (e) {
      console.log('Update resource comment count failed:', e.message)
    }
    
    return {
      success: true,
      commentId: addResult._id
    }
  } catch (e) {
    console.error('Add comment error:', e)
    return { success: false, message: '评论失败', error: e.message }
  }
}

/**
 * 删除评论（仅限本人）
 */
async function removeComment(openid, commentId) {
  if (!openid) return { success: false, message: '请先登录' }
  if (!commentId) return { success: false, message: '缺少评论ID' }
  
  try {
    // 获取评论
    let comment
    try {
      const commentRes = await db.collection('comments').doc(commentId).get()
      comment = commentRes.data
    } catch (e) {
      return { success: false, message: '评论不存在' }
    }
    
    // 验证权限
    if (comment._openid !== openid) {
      return { success: false, message: '无权删除此评论' }
    }
    
    // 软删除
    await db.collection('comments').doc(commentId).update({
      data: { status: 'deleted' }
    })
    
    // 更新资源评论数
    try {
      await db.collection('resources').doc(comment.resourceId).update({
        data: { commentCount: _.inc(-1) }
      })
    } catch (e) {
      console.log('Update resource comment count failed:', e.message)
    }
    
    return { success: true }
  } catch (e) {
    console.error('Remove comment error:', e)
    return { success: false, message: '删除失败', error: e.message }
  }
}

/**
 * 获取评论数
 */
async function getCommentCount(resourceId) {
  if (!resourceId) return { success: false, message: '缺少资源ID' }
  
  try {
    const res = await db.collection('comments').where({
      resourceId: resourceId,
      status: 'normal'
    }).count()
    
    return {
      success: true,
      count: res.total
    }
  } catch (e) {
    console.error('Get comment count error:', e)
    return { success: false, error: e.message }
  }
}

/**
 * 格式化时间显示
 */
function formatTime(date) {
  if (!date) return ''
  
  // 处理云函数返回的 serverDate
  const d = date instanceof Date ? date : new Date(date)
  const now = new Date()
  
  // 如果是云函数 serverDate，直接返回空，后续由前端处理
  if (!d.getTime()) return '刚刚'
  
  const diff = now - d
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前'
  
  return `${d.getMonth() + 1}月${d.getDate()}日`
}
