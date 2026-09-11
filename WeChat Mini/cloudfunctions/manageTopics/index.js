const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const { withAdmin } = require('./withAdmin.js')

exports.main = withAdmin(async (event, context, admin) => {
  try {
    const { action, id, ids, data } = event

    console.log('[manageTopics] 收到调用 action=%s, data=%j', action, data)

    switch (action) {
      case 'create': {
        const payload = {
          title: data.title || '',
          filterType: data.filterType || 'tag',
          filterValue: data.filterValue || '',
          status: data.status || 'active',
          sort: data.sort || 0,
          resourceType: data.resourceType || 'all',
          defaultSort: data.defaultSort || 'latest',
          isFeatured: data.isFeatured || false,
          badge: data.badge || '',
          description: data.description || '',
          cover: data.cover || data.coverFileID || '',
          coverFileID: data.coverFileID || '',
          linkType: data.linkType || 'resource',
          linkUrl: data.linkUrl || '',
          createdAt: new Date(),
          updatedAt: new Date()
        }
        console.log('[manageTopics] create payload=%j', payload)
        const res = await db.collection('topics').add({ data: payload })
        console.log('[manageTopics] create 写入成功 _id=%s', res._id)
        return { success: true, message: '专题创建成功', id: res._id }
      }

      case 'update': {
        if (!id) {
          return { success: false, message: '缺少专题 ID' }
        }
        const allowedFields = ['title', 'description', 'cover', 'coverFileID', 'resourceType', 'defaultSort', 'filterType', 'filterValue', 'status', 'sort', 'contentType', 'resourceIds', 'isFeatured', 'badge', 'linkType', 'linkUrl']
        const updatePayload = { updatedAt: new Date() }
        allowedFields.forEach(field => {
          if (data && typeof data[field] !== 'undefined') {
            updatePayload[field] = data[field]
          }
        })
        if (Object.keys(updatePayload).length === 1) {
          return { success: false, message: '没有可更新的字段' }
        }
        await db.collection('topics').doc(id).update({ data: updatePayload })
        return { success: true, message: '专题更新成功' }
      }

      case 'updateStatus': {
        if (!id || !data || !data.status) {
          return { success: false, message: '缺少参数' }
        }
        await db.collection('topics').doc(id).update({
          data: {
            status: data.status,
            updatedAt: new Date()
          }
        })
        return { success: true, message: '状态更新成功' }
      }

      case 'batchUpdateStatus': {
        if (!Array.isArray(ids) || ids.length === 0 || !data || !data.status) {
          return { success: false, message: '缺少参数' }
        }
        const promises = ids.map(topicId =>
          db.collection('topics').doc(topicId).update({
            data: {
              status: data.status,
              updatedAt: new Date()
            }
          })
        )
        await Promise.all(promises)
        return { success: true, message: `已更新 ${ids.length} 个专题状态` }
      }

      case 'updateFeatured': {
        if (!id || typeof data?.isFeatured !== 'boolean') {
          return { success: false, message: '缺少参数' }
        }
        await db.collection('topics').doc(id).update({
          data: {
            isFeatured: data.isFeatured,
            updatedAt: new Date()
          }
        })
        return { success: true, message: '精选状态更新成功' }
      }

      case 'updateBadge': {
        if (!id) {
          return { success: false, message: '缺少专题 ID' }
        }
        await db.collection('topics').doc(id).update({
          data: {
            badge: data.badge || '',
            updatedAt: new Date()
          }
        })
        return { success: true, message: '角标更新成功' }
      }

      case 'updateSort': {
        if (!Array.isArray(data?.sortMap)) {
          return { success: false, message: '缺少排序数据' }
        }
        const promises = data.sortMap.map(({ id: topicId, sort }) =>
          db.collection('topics').doc(topicId).update({
            data: {
              sort,
              updatedAt: new Date()
            }
          })
        )
        await Promise.all(promises)
        return { success: true, message: '排序更新成功' }
      }

      case 'delete': {
        if (!id) {
          return { success: false, message: '缺少专题 ID' }
        }
        await db.collection('topics').doc(id).remove()
        return { success: true, message: '专题已删除' }
      }

      case 'batchDelete': {
        if (!Array.isArray(ids) || ids.length === 0) {
          return { success: false, message: '缺少专题 ID 列表' }
        }
        const promises = ids.map(topicId =>
          db.collection('topics').doc(topicId).remove()
        )
        await Promise.all(promises)
        return { success: true, message: `已删除 ${ids.length} 个专题` }
      }

      default:
        return { success: false, message: '未知操作' }
    }
  } catch (e) {
    console.error('manageTopics error:', e)
    return { success: false, message: e.message || '操作失败' }
  }
})
