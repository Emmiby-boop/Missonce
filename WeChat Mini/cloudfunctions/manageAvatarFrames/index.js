const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { withAdmin } = require('./withAdmin.js')

exports.main = withAdmin(async (event, context, admin) => {
  try {
    const { action, id, data } = event
    const { OPENID } = cloud.getWXContext()

    switch (action) {
      // 列表（支持按 format 过滤：png=静态框，gif=动态框）
      case 'list': {
        const { format, status = 'active' } = data || {}
        const where = { status }
        if (format) where.format = format

        const listRes = await db.collection('avatar_frames')
          .where(where)
          .orderBy('createdAt', 'desc')
          .get()

        return { success: true, data: listRes.data }
      }

      // 新增（上传文件后调用，记录 fileID + format + name）
      case 'add': {
        if (!data || !data.fileID) {
          return { success: false, message: '缺少 fileID' }
        }
        const payload = {
          fileID: data.fileID,
          format: data.format || 'png',    // png | gif
          name: data.name || '未命名头像框',
          status: 'active',
          createdBy: OPENID,
          createdAt: new Date()
        }
        const res = await db.collection('avatar_frames').add({ data: payload })
        return { success: true, id: res._id, message: '头像框添加成功' }
      }

      // 删除单个
      case 'delete': {
        if (!id) return { success: false, message: '缺少 ID' }
        await db.collection('avatar_frames').doc(id).remove()
        return { success: true, message: '已删除' }
      }

      // 批量删除
      case 'batchDelete': {
        const ids = (data && data.ids) || event.ids || []
        if (!Array.isArray(ids) || ids.length === 0) {
          return { success: false, message: '缺少 ids' }
        }
        await Promise.all(ids.map(i => db.collection('avatar_frames').doc(i).remove()))
        return { success: true, message: `已删除 ${ids.length} 个` }
      }

      default:
        return { success: false, message: '未知 action: ' + action }
    }
  } catch (err) {
    console.error('manageAvatarFrames error:', err)
    return { success: false, message: err.message || '服务器错误' }
  }
})
