// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

/**
 * 统一交互处理函数 (收藏/点赞)
 * 保证数据一致性：同时更新关联表和资源统计
 * @param {Object} event
 * @param {String} event.interactionType - 'favorite' | 'like'
 * @param {String} event.action - 'add' | 'remove'
 * @param {String} event.resourceId - 资源ID
 * @param {Object} event.payload - 附加数据 (url, title, type等)
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  const { interactionType, action, resourceId, payload = {} } = event
  
  if (!openid) return { success: false, message: '未登录' }
  if (!resourceId) return { success: false, message: '缺少资源ID' }
  if (!['favorite', 'like'].includes(interactionType)) return { success: false, message: '未知交互类型' }

  const collectionName = interactionType === 'favorite' ? 'favorites' : 'likes'
  const isFavorite = interactionType === 'favorite'
  
  // 统计字段映射
  const statsField = isFavorite ? 'favorites' : 'likes'
  // 热度分变化: 收藏+8, 点赞+5 (与 interactionManager 保持一致)
  const scoreDelta = isFavorite ? 8 : 5
  
  const now = db.serverDate()

  try {
    const transaction = await db.startTransaction()
    
    if (action === 'add') {
      // 1. 检查是否已存在
      const checkRes = await transaction.collection(collectionName).where({
        _openid: openid,
        resourceId: resourceId
      }).get()

      if (checkRes.data.length > 0) {
        await transaction.rollback()
        return { success: true, message: '已存在' }
      }

      // 2. 插入记录
      const docData = {
        _openid: openid,
        resourceId,
        createTime: now,
        ...payload // 混入 url, title, type 等
      }
      
      await transaction.collection(collectionName).add({
        data: docData
      })

      // 3. 更新资源统计
      // 注意: updateResourceStats 是另一个云函数，事务中无法直接调用云函数。
      // 必须直接操作 resources 集合。
      await transaction.collection('resources').doc(resourceId).update({
        data: {
          [statsField]: _.inc(1),
          hotScore: _.inc(scoreDelta),       // 总热度
          dailyHotScore: _.inc(scoreDelta)  // 每日热度
        }
      })

      await transaction.commit()
      return { success: true, state: true }

    } else {
      // action === 'remove'
      // 1. 删除记录
      const removeRes = await transaction.collection(collectionName).where({
        _openid: openid,
        resourceId: resourceId
      }).remove()

      if (removeRes.stats.removed === 0) {
        // 没删掉（可能本来就不存在），但也算成功
        await transaction.rollback()
        return { success: true, state: false }
      }

      // 2. 更新资源统计 (递减)
      await transaction.collection('resources').doc(resourceId).update({
        data: {
          [statsField]: _.inc(-1),
          hotScore: _.inc(-scoreDelta),        // 总热度
          dailyHotScore: _.inc(-scoreDelta)    // 每日热度
        }
      })

      await transaction.commit()
      return { success: true, state: false }
    }

  } catch (e) {
    console.error('交互事务执行失败:', e)
    return { success: false, message: '操作失败', error: e }
  }
}
