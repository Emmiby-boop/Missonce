const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

/**
 * 每日热度重置云函数
 * 每天凌晨执行，将所有资源的 dailyHotScore 归零
 * 
 * 调用方式：
 * 1. 云函数定时触发（推荐）
 * 2. 手动调用
 */
exports.main = async (event, context) => {
  console.log('=== 开始重置每日热度 ===')
  console.log('执行时间:', new Date().toISOString())

  try {
    // 获取所有有热度的资源
    const resources = await db.collection('resources')
      .where({
        dailyHotScore: _.gt(0)
      })
      .field({
        _id: true,
        dailyHotScore: true
      })
      .limit(1000)
      .get()

    const list = resources.data || []
    console.log(`找到 ${list.length} 个需要重置的资源`)

    if (list.length === 0) {
      return {
        success: true,
        message: '无需重置的资源',
        resetCount: 0
      }
    }

    // 批量重置（每批 50 条）
    const batchSize = 50
    let processedCount = 0

    for (let i = 0; i < list.length; i += batchSize) {
      const batch = list.slice(i, i + batchSize)
      const tasks = batch.map(resource => {
        return db.collection('resources').doc(resource._id).update({
          data: {
            dailyHotScore: 0
          }
        })
      })

      await Promise.all(tasks)
      processedCount += batch.length
      console.log(`已处理 ${processedCount}/${list.length}`)
    }

    console.log(`=== 每日热度重置完成，共重置 ${processedCount} 个资源 ===`)

    return {
      success: true,
      message: '重置完成',
      resetCount: processedCount
    }

  } catch (error) {
    console.error('重置每日热度失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
