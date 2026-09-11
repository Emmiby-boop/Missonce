const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const { withAdmin } = require('./withAdmin.js')

exports.main = withAdmin(async (event, context, admin) => {
  const { action, topicId, layout, versionId, operator } = event
  const timestamp = Date.now()
  const { OPENID } = cloud.getWXContext()

  // Ensure operator is recorded, fallback to OPENID if not provided
  const currentOperator = operator || OPENID || 'admin'

  // Helper to ensure collection exists
  const ensureCollection = async (collectionName) => {
    try {
      await db.createCollection(collectionName)
    } catch (e) {
      console.error('[manageTopicLayout] 创建集合失败（可能已存在）:', e)
    }
  }

  try {
    if (action === 'save') {
      if (!topicId || !layout) return { success: false, error: 'Missing parameters' }

      // 1. Update topic with new layout
      // 注意：wx-server-sdk 的 update 必须用 data 包装，否则字段不会写入
      await db.collection('topics').doc(topicId).update({
        data: {
          layout: layout,
          updateTime: timestamp
        }
      })

      // 2. Create history version
      try {
        await db.collection('topic_layout_versions').add({
            data: {
              topicId,
              layout,
              createdAt: timestamp,
              createdBy: currentOperator,
              version: timestamp // use timestamp as version ID for simplicity
            }
        })
      } catch (err) {
        if (err.message && err.message.includes('not exist')) {
          await ensureCollection('topic_layout_versions')
          // Retry
          await db.collection('topic_layout_versions').add({
              data: {
                topicId,
                layout,
                createdAt: timestamp,
                createdBy: currentOperator,
                version: timestamp
              }
          })
        } else {
          throw err
        }
      }

      // 3. Log operation
      try {
        await db.collection('admin_operation_logs').add({
            data: {
              action: 'update_topic_layout',
              targetId: topicId,
              operator: currentOperator,
              details: { versionId: timestamp }, // versionId is timestamp
              timestamp
            }
        })
      } catch (e) {
        if (e.message && e.message.includes('not exist')) {
          await ensureCollection('admin_operation_logs')
          try {
             await db.collection('admin_operation_logs').add({
                data: {
                  action: 'update_topic_layout',
                  targetId: topicId,
                  operator: currentOperator,
                  details: { versionId: timestamp },
                  timestamp
                }
            })
          } catch(ignore) { console.error('[manageTopicLayout] 记录操作日志失败:', ignore) }
        }
      }

      return { success: true, versionId: timestamp }
    } 
    
    else if (action === 'getHistory') {
      if (!topicId) return { success: false, error: 'Missing topicId' }
      try {
        const res = await db.collection('topic_layout_versions')
          .where({ topicId })
          .orderBy('createdAt', 'desc')
          .limit(20)
          .get()
        return { success: true, data: res.data }
      } catch (err) {
         if (err.message && err.message.includes('not exist')) {
            return { success: true, data: [] }
         }
         throw err
      }
    }

    else if (action === 'rollback') {
      if (!topicId || !versionId) return { success: false, error: 'Missing parameters' }

      // 1. Get version data
      const versionDoc = await db.collection('topic_layout_versions').doc(versionId).get()
      if (!versionDoc.data) throw new Error('Version not found')
      
      const oldLayout = versionDoc.data.layout

      // 2. Update topic
      await db.collection('topics').doc(topicId).update({
        data: {
          layout: oldLayout,
          updateTime: timestamp
        }
      })

      // 3. Create new history entry (even for rollback, to keep track)
      await db.collection('topic_layout_versions').add({
        data: {
          topicId,
          layout: oldLayout,
          createdAt: timestamp,
          createdBy: currentOperator,
          version: timestamp,
          isRollback: true,
          rollbackFrom: versionId
        }
      })

      return { success: true }
    }

    return { success: false, error: 'Unknown action' }

  } catch (err) {
    console.error(err)
    return { success: false, error: err.message }
  }
})
