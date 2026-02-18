const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { status = 'active' } = event
    
    // 尝试带排序获取
    try {
      const res = await db.collection('banners')
        .where({ status })
        .orderBy('sort', 'asc')
        .get()
      return { success: true, data: res.data }
    } catch (sortErr) {
      console.warn('带排序获取失败，尝试降级获取', sortErr)
      // 降级：如果因为缺少索引导致失败，尝试不排序获取
      const res = await db.collection('banners')
        .where({ status })
        .get()
      return { success: true, data: res.data }
    }
  } catch (err) {
    console.error('获取轮播图失败:', err)
    return { success: false, error: err }
  }
}
