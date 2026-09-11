const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

const RETAIN_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

// ============================================================
// 缓存清理：资源删除/恢复后必须清理，否则小程序仍显示旧数据
// ============================================================
async function clearResourceCache() {
  try {
    const cacheRes = await db.collection('resources_cache').where({ _id: _.exists(true) }).limit(100).get()
    if (cacheRes.data.length > 0) {
      await Promise.all(
        cacheRes.data.map(item => db.collection('resources_cache').doc(item._id).remove())
      )
      console.log(`[deleteResources] 已清理 ${cacheRes.data.length} 条 resources_cache 缓存`)
    }
  } catch (e) {
    console.warn('[deleteResources] 清理 resources_cache 失败（非致命）:', e.message)
  }
  try {
    await db.collection('home_cache').doc('v1').remove()
    console.log('[deleteResources] 已清理 home_cache v1 缓存')
  } catch (e) {
    console.warn('[deleteResources] 清理 home_cache 失败（非致命）:', e.message)
  }
}

// 真删除：删数据库记录 + 删云存储文件
async function purgeResourcesFromDB(ids) {
  const resourcesRes = await db.collection('resources').where({ _id: _.in(ids) }).get()
  const resources = resourcesRes.data || []

  const fileIDs = []
  resources.forEach(resource => {
    if (resource.coverUrl) fileIDs.push(resource.coverUrl)
    if (resource.originUrl && resource.originUrl !== resource.coverUrl) {
      fileIDs.push(resource.originUrl)
    }
  })
  const uniqueFileIDs = [...new Set(fileIDs)]
  console.log(`[deleteResources] 彻底删除，需清理云存储文件数量: ${uniqueFileIDs.length}`)

  if (uniqueFileIDs.length > 0) {
    try {
      await cloud.deleteFile({ fileList: uniqueFileIDs })
      console.log('[deleteResources] 删除云存储文件成功')
    } catch (fileErr) {
      console.warn('[deleteResources] 删除云存储文件失败:', fileErr)
    }
  }

  const deletePromises = ids.map(id => db.collection('resources').doc(id).remove())
  await Promise.all(deletePromises)
}

/**
 * 资源删除云函数（支持软删除 + 回收站）
 *
 * 调用方式：
 *   软删除（移入回收站）：{ action: 'delete', resourceId } 或 { action: 'delete', resourceIds: [...] }
 *   获取回收站列表：    { action: 'getTrash' }
 *   恢复资源：         { action: 'restore', resourceId }
 *   彻底删除：         { action: 'purge', resourceId } 或 { action: 'purge', resourceIds: [...] }
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const callerOpenid = wxContext.OPENID

  try {
    const { action } = event

    // 🔒 安全检查：验证调用者是否为管理员
    if (!callerOpenid) {
      return { success: false, message: '未登录' }
    }
    const adminCheck = await db.collection('admins')
      .where({ _openid: callerOpenid })
      .count()
    if (adminCheck.total === 0) {
      return { success: false, message: '权限不足，仅管理员可操作' }
    }

    // ── 软删除（移入回收站）──
    if (action === 'delete') {
      let ids = []
      if (Array.isArray(event.resourceIds) && event.resourceIds.length > 0) {
        ids = event.resourceIds
      } else if (event.resourceId) {
        // 兼容：resourceId 可能是字符串或数组
        ids = Array.isArray(event.resourceId) ? event.resourceId : [event.resourceId]
      } else {
        return { success: false, message: '缺少资源ID或资源ID列表' }
      }

      console.log(`[deleteResources] 软删除 ${ids.length} 个资源`)

      await Promise.all(ids.map(id =>
        db.collection('resources').doc(id).update({
          data: {
            deletedAt: db.serverDate(),
            deletedBy: callerOpenid,
            status: 'offline'  // 同时下架，避免回收站期间仍可见
          }
        })
      ))

      await clearResourceCache()

      return {
        success: true,
        message: `已移入回收站 ${ids.length} 个资源`,
        deletedCount: ids.length
      }
    }

    // ── 获取回收站列表（仅返回 30 天内的）──
    if (action === 'getTrash') {
      const cutoff = new Date(Date.now() - RETAIN_DAYS * DAY_MS)
      const res = await db.collection('resources')
        .where({ deletedAt: _.gt(cutoff) })
        .orderBy('deletedAt', 'desc')
        .limit(100)
        .get()

      return {
        success: true,
        list: res.data || []
      }
    }

    // ── 恢复资源 ──
    if (action === 'restore') {
      const { resourceId } = event
      if (!resourceId) {
        return { success: false, message: '缺少资源ID' }
      }
      await db.collection('resources').doc(resourceId).update({
        data: {
          deletedAt: null,
          deletedBy: '',
          status: 'published'  // 恢复后重新上架
        }
      })
      await clearResourceCache()
      return { success: true, message: '已恢复' }
    }

    // ── 彻底删除（删数据库 + 删云存储）──
    if (action === 'purge') {
      let ids = []
      if (Array.isArray(event.resourceIds) && event.resourceIds.length > 0) {
        ids = event.resourceIds
      } else if (event.resourceId) {
        ids = [event.resourceId]
      } else {
        return { success: false, message: '缺少资源ID' }
      }

      console.log(`[deleteResources] 彻底删除 ${ids.length} 个资源`)
      await purgeResourcesFromDB(ids)
      await clearResourceCache()

      return {
        success: true,
        message: `已彻底删除 ${ids.length} 个资源`,
        deletedCount: ids.length
      }
    }

    return { success: false, message: `未知 action: ${action}` }

  } catch (error) {
    console.error('[deleteResources] 操作失败:', error)
    return {
      success: false,
      message: '操作失败，请稍后重试'
    }
  }
}
