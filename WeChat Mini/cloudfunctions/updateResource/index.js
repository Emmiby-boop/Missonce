const cloud = require('wx-server-sdk')
const { withAdmin } = require('./withAdmin.js')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// ============================================================
// 缓存清理：资源状态变更（如上下线）后必须清理，否则小程序仍显示旧数据
// ============================================================
async function clearResourceCache() {
  // 1. 清理 resources_cache 集合（getResources 云函数的数据库缓存层）
  try {
    const cacheRes = await db.collection('resources_cache').where({ _id: _.exists(true) }).limit(100).get()
    if (cacheRes.data.length > 0) {
      const deletePromises = cacheRes.data.map(item =>
        db.collection('resources_cache').doc(item._id).remove()
      )
      await Promise.all(deletePromises)
      console.log(`[updateResource] 已清理 ${cacheRes.data.length} 条 resources_cache 缓存`)
    }
  } catch (e) {
    console.warn('[updateResource] 清理 resources_cache 失败（非致命）:', e.message)
  }

  // 2. 清理 home_cache 集合（prebuildHomeFeed 预构建的首页缓存）
  //    删除后前端会走降级路径（L3直读/L4网络），下次定时任务会重新构建
  try {
    await db.collection('home_cache').doc('v1').remove()
    console.log('[updateResource] 已清理 home_cache v1 缓存')
  } catch (e) {
    // 文档不存在时也会报错，忽略
    console.warn('[updateResource] 清理 home_cache 失败（非致命）:', e.message)
  }
}

// 允许更新的字段白名单
const ALLOWED_FIELDS = [
  'title', 'type', 'status', 'category', 'categories', 'tags',
  'hotScore', 'downloads', 'favorites', 'coverUrl', 'originUrl', 'isNewPath'
]

// 判断值是否有效（非空且不是 undefined/null）
function isValidValue(val) {
  if (val === undefined || val === null) return false
  if (typeof val === 'string' && val.trim() === '') return false
  if (Array.isArray(val) && val.length === 0) return false
  return true
}

exports.main = withAdmin(async (event, context, admin) => {
  console.log('=== updateResource 开始 ===')
  console.log('原始event:', JSON.stringify(event))
  
  try {
    // 兼容 Web TCB SDK 的调用方式（参数可能在 event.data 里）
    let resourceId = event.resourceId || (event.data && event.data.resourceId)
    let updateData = event.updateData || (event.data && event.data.updateData)
    
    console.log('解析后 resourceId:', resourceId)
    console.log('解析后 updateData:', JSON.stringify(updateData))
    
    // 参数校验
    if (!resourceId) {
      return { success: false, message: '缺少 resourceId 参数' }
    }
    
    if (!updateData || typeof updateData !== 'object') {
      return { success: false, message: '缺少 updateData 参数或格式错误' }
    }
    
    // 构建干净的更新对象：只包含白名单字段且值为有效值
    // 注意：腾讯云数据库 update() 不接受 undefined，不自动过滤
    const updateObj = {}
    let hasValidField = false
    
    for (const field of ALLOWED_FIELDS) {
      if (updateData.hasOwnProperty(field) && isValidValue(updateData[field])) {
        updateObj[field] = updateData[field]
        hasValidField = true
        console.log(`包含字段 ${field}:`, updateData[field])
      }
    }
    
    console.log('最终 updateObj:', JSON.stringify(updateObj))
    console.log('hasValidField:', hasValidField)
    
    if (!hasValidField) {
      return { success: false, message: '没有需要更新的有效字段' }
    }
    
    // 执行更新 - 注意：腾讯云数据库 update() 需要 { data: {...} } 格式
    const result = await db.collection('resources').doc(resourceId).update({
      data: updateObj
    })

    console.log('=== 更新成功 ===')
    console.log('更新stats:', result)

    // 🔥 修复：更新成功后清理 resources_cache 和 home_cache 缓存
    // 否则小程序仍会读取旧缓存，导致后台下线资源后小程序仍显示
    await clearResourceCache()

    return {
      success: true,
      message: '更新成功',
      updated: result.updated
    }
    
  } catch (error) {
    console.error('=== 更新失败 ===')
    console.error('错误详情:', error)
    
    // 返回更有用的错误信息
    const errMsg = error.message || String(error)
    return {
      success: false,
      message: `更新失败: ${errMsg}`,
      error: errMsg,
      code: error.code,
      errCode: error.errCode,
      errMsg: error.errMsg
    }
  }
})
