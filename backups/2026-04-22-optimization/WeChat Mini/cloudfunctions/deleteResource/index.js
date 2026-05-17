const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  console.log('收到event:', event)
  
  try {
    const resourceId = event.resourceId
    
    console.log('resourceId:', resourceId)
    
    if (!resourceId) {
      return {
        success: false,
        message: '缺少资源ID'
      }
    }
    
    const resourceRes = await db.collection('resources').doc(resourceId).get()
    const resource = resourceRes.data
    
    if (!resource) {
      return {
        success: false,
        message: '资源不存在'
      }
    }
    
    const fileIDs = []
    if (resource.coverUrl) fileIDs.push(resource.coverUrl)
    if (resource.originUrl && resource.originUrl !== resource.coverUrl) {
      fileIDs.push(resource.originUrl)
    }
    
    if (fileIDs.length > 0) {
      try {
        await cloud.deleteFile({
          fileList: fileIDs
        })
        console.log('删除云存储文件成功:', fileIDs)
      } catch (fileErr) {
        console.warn('删除云存储文件失败:', fileErr)
      }
    }
    
    const result = await db.collection('resources').doc(resourceId).remove()
    
    console.log('删除成功:', result)
    
    return {
      success: true,
      message: '删除成功',
      result: result
    }
    
  } catch (error) {
    console.error('删除失败:', error)
    return {
      success: false,
      message: error.message || '删除失败',
      error: error.message
    }
  }
}
