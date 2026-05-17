const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  console.log('收到event:', JSON.stringify(event))
  
  try {
    const resourceId = event.resourceId
    const updateData = event.updateData
    
    console.log('resourceId:', resourceId)
    console.log('updateData:', updateData)
    
    if (!resourceId) {
      return {
        success: false,
        message: '缺少资源ID'
      }
    }
    
    if (!updateData) {
      return {
        success: false,
        message: '缺少更新数据'
      }
    }
    
    const updateObj = {
      updatedAt: new Date()
    }
    
    if (updateData.title) updateObj.title = updateData.title
    if (updateData.type) updateObj.type = updateData.type
    if (updateData.status) updateObj.status = updateData.status
    if (updateData.category) updateObj.category = updateData.category
    if (updateData.categories) updateObj.categories = updateData.categories
    if (updateData.tags) updateObj.tags = updateData.tags
    if (updateData.coverUrl) updateObj.coverUrl = updateData.coverUrl
    if (updateData.originUrl) updateObj.originUrl = updateData.originUrl
    if (updateData.isNewPath) updateObj.isNewPath = updateData.isNewPath
    
    console.log('准备更新的对象:', updateObj)
    
    if (Object.keys(updateObj).length === 1) {
      return {
        success: false,
        message: '没有需要更新的字段'
      }
    }
    
    // 直接使用db.collection().doc().update()，不使用中间变量
    const result = await db.collection('resources').doc(resourceId).update(updateObj)
    
    console.log('更新成功:', result)
    
    return {
      success: true,
      message: '更新成功',
      result: result
    }
    
  } catch (error) {
    console.error('更新失败:', error)
    return {
      success: false,
      message: error.message || '更新失败',
      error: error.message
    }
  }
}
