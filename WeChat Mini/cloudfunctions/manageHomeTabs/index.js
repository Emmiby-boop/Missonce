const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { withAdmin } = require('./withAdmin.js')

// 默认 Tab 配置
const DEFAULT_TABS = [
  { type: 'fixed', fixedId: 'recommend', title: '推荐', visible: true, sort: 0, resourceType: 'all', sortBy: 'hot' },
  { type: 'fixed', fixedId: 'latest', title: '最新', visible: true, sort: 1, resourceType: 'all', sortBy: 'latest' }
]

// 确保集合存在（云函数有权限创建集合）
async function ensureCollection() {
  try {
    await db.createCollection('home_tabs')
  } catch (e) {
    console.error('[manageHomeTabs] 创建集合失败（可能已存在）:', e)
  }
}

exports.main = withAdmin(async (event, context, admin) => {
  try {
    await ensureCollection()

    const { action, data, id } = event

    switch (action) {
      case 'add': {
        const tabData = {
          type: data.type || 'tag',
          fixedId: data.fixedId || '',
          title: (data.title || '').trim(),
          visible: data.visible !== false,
          sort: data.sort || 0,
          tag: data.tag || '',
          resourceType: data.resourceType || 'all',
          sortBy: data.sortBy || 'hot',
          createTime: db.serverDate()
        }

        const res = await db.collection('home_tabs').add({ data: tabData })
        return {
          success: true,
          message: 'Tab 创建成功',
          data: { ...tabData, _id: res._id }
        }
      }

      case 'update': {
        if (!id) {
          return { success: false, message: '缺少 Tab ID' }
        }

        // sortBy 只在「完全没传」时才兜底为 hot，避免空串等异常值被静默吞成 hot
        const finalSortBy = (data.sortBy === undefined || data.sortBy === null)
          ? 'hot'
          : (data.sortBy || 'hot')

        const updateData = {
          title: (data.title || '').trim(),
          tag: data.tag || '',
          resourceType: data.resourceType || 'all',
          sortBy: finalSortBy,
          visible: data.visible !== false
        }

        await db.collection('home_tabs').doc(id).update({ data: updateData })
        return {
          success: true,
          message: 'Tab 更新成功'
        }
      }

      case 'delete': {
        if (!id) {
          return { success: false, message: '缺少 Tab ID' }
        }

        await db.collection('home_tabs').doc(id).remove()
        return {
          success: true,
          message: 'Tab 已删除'
        }
      }

      case 'sort': {
        // 批量更新排序，data.tabs 是 [{ id, sort }] 数组
        const tabs = data.tabs || []
        const promises = tabs.map(item =>
          db.collection('home_tabs').doc(item.id).update({ data: { sort: item.sort } })
        )
        await Promise.all(promises)
        return {
          success: true,
          message: '排序已更新'
        }
      }

      case 'toggleVisible': {
        if (!id) {
          return { success: false, message: '缺少 Tab ID' }
        }

        const docRes = await db.collection('home_tabs').doc(id).get()
        const current = docRes.data
        const newVisible = !current.visible
        await db.collection('home_tabs').doc(id).update({ data: { visible: newVisible } })
        return {
          success: true,
          message: newVisible ? '已显示' : '已隐藏',
          data: { visible: newVisible }
        }
      }

      case 'initDefault': {
        // 检查是否已有数据
        const existing = await db.collection('home_tabs').count()
        if (existing.total > 0) {
          return { success: false, message: '已存在 Tab 配置，无法重复初始化' }
        }

        // 固定 Tab 用确定性主键（与 getHomeTabs 的自愈逻辑一致，安全字符）
        const promises = DEFAULT_TABS.map(tab =>
          db.collection('home_tabs').add({
            data: {
              ...tab,
              _id: tab.fixedId === 'recommend' ? 'fixed_recommend' : 'fixed_latest',
              createTime: db.serverDate()
            }
          })
        )
        await Promise.all(promises)
        return {
          success: true,
          message: '默认配置初始化成功'
        }
      }

      default:
        return { success: false, message: '未知操作' }
    }
  } catch (e) {
    console.error('manageHomeTabs error:', e)
    return { success: false, message: '操作失败: ' + e.message }
  }
})
