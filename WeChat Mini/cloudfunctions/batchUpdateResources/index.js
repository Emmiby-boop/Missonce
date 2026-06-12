const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

/**
 * batchUpdateResources 云函数
 *
 * [P1-2 修复] 将前端直连数据库的批量操作收归云函数
 *
 * 支持的 action：
 * - updateStatus:   批量修改资源状态
 * - addTags:        批量添加标签（去重合并）
 * - approveAllPending: 一键通过所有待审资源
 *
 * 最大批量 200 条/次，超过则分批处理
 */
const BATCH_LIMIT = 200

exports.main = async (event, context) => {
  const db = cloud.database()
  const { action, resourceIds, status, tags } = event
  const _ = db.command

  // --------------------------------------------------
  // action: updateStatus — 批量修改状态
  // --------------------------------------------------
  if (action === 'updateStatus') {
    if (!resourceIds || !Array.isArray(resourceIds) || resourceIds.length === 0) {
      return { success: false, message: '资源 ID 列表不能为空' }
    }

    if (!status || !['published', 'offline', 'draft', 'review'].includes(status)) {
      return { success: false, message: '无效的状态值' }
    }

    try {
      await processBatch(resourceIds, (batch) =>
        Promise.all(batch.map(id =>
          db.collection('resources').doc(id).update({
            data: { status, updatedAt: db.serverDate() }
          })
        ))
      )

      return {
        success: true,
        message: `已成功修改 ${resourceIds.length} 个资源状态`,
      }
    } catch (err) {
      console.error('批量更新状态失败:', err)
      return { success: false, message: '批量更新失败: ' + err.message }
    }
  }

  // --------------------------------------------------
  // action: addTags — 批量添加标签（去重合并）
  // --------------------------------------------------
  if (action === 'addTags') {
    if (!resourceIds || !Array.isArray(resourceIds) || resourceIds.length === 0) {
      return { success: false, message: '资源 ID 列表不能为空' }
    }

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return { success: false, message: '标签列表不能为空' }
    }

    try {
      await processBatch(resourceIds, async (batch) => {
        for (const id of batch) {
          // 先读取现有标签
          const res = await db.collection('resources').doc(id).get()
          const existing = res.data?.tags || []
          // 去重合并
          const merged = [...new Set([...existing, ...tags])]
          await db.collection('resources').doc(id).update({
            data: { tags: merged, updatedAt: db.serverDate() }
          })
        }
      })

      return {
        success: true,
        message: `已成功为 ${resourceIds.length} 个资源添加标签`,
      }
    } catch (err) {
      console.error('批量添加标签失败:', err)
      return { success: false, message: '批量添加标签失败: ' + err.message }
    }
  }

  // --------------------------------------------------
  // action: approveAllPending — 一键通过所有待审
  // --------------------------------------------------
  if (action === 'approveAllPending') {
    try {
      let totalApproved = 0
      let hasMore = true

      while (hasMore) {
        const res = await db.collection('resources')
          .where({ status: 'review' })
          .limit(BATCH_LIMIT)
          .get()

        const items = res.data || []
        if (items.length === 0) {
          hasMore = false
          break
        }

        await Promise.all(items.map(item =>
          db.collection('resources').doc(item._id).update({
            data: { status: 'published', updatedAt: db.serverDate() }
          })
        ))

        totalApproved += items.length
        hasMore = items.length === BATCH_LIMIT
      }

      return {
        success: totalApproved > 0,
        totalApproved,
        message: totalApproved > 0
          ? `已成功通过 ${totalApproved} 个资源`
          : '暂无待审资源',
      }
    } catch (err) {
      console.error('一键通过失败:', err)
      return { success: false, message: '操作失败: ' + err.message }
    }
  }

  return { success: false, message: '未知 action: ' + action }
}

/**
 * 分批处理工具函数
 * @param {string[]} ids - 完整的 ID 列表
 * @param {Function} handler - 处理每批数据的异步回调
 */
async function processBatch(ids, handler) {
  for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
    const batch = ids.slice(i, i + BATCH_LIMIT)
    await handler(batch)
  }
}
