// 云函数入口文件 - 创建互动相关数据库集合
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

/**
 * 创建互动相关集合
 */
exports.main = async (event, context) => {
  try {
    const collections = ['likes', 'views', 'comments']
    const results = []
    
    for (const name of collections) {
      try {
        // 尝试创建集合并添加一个临时文档，然后删除
        const tempDoc = await db.collection(name).add({
          data: {
            _temp: true,
            createTime: db.serverDate()
          }
        })
        
        // 删除临时文档
        await db.collection(name).doc(tempDoc._id).remove()
        
        results.push({ name, status: 'created' })
        console.log(`Collection ${name} created successfully`)
      } catch (e) {
        // 集合可能已存在
        if (e.message && e.message.includes('already exists')) {
          results.push({ name, status: 'exists' })
        } else {
          results.push({ name, status: 'error', error: e.message })
        }
      }
    }
    
    return {
      success: true,
      message: '集合初始化完成',
      data: { results }
    }
  } catch (e) {
    console.error('Init collections error:', e)
    return { success: false, message: e.message }
  }
}
