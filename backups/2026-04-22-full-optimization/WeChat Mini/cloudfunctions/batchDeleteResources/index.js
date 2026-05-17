const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  console.log('收到event:', JSON.stringify(event))
  
  try {
    const resourceIds = event.resourceIds
    
    console.log('resourceIds:', resourceIds)
    
    if (!resourceIds || !Array.isArray(resourceIds) || resourceIds.length === 0) {
      return {
        success: false,
        message: '缺少资源ID列表'
      }
    }
    
    const resourcesRes = await db.collection('resources')
      .where({
        _id: db.command.in(resourceIds)
      })
      .get()
    
    const resources = resourcesRes.data || []
    console.log('找到资源数量:', resources.length)
    
    const fileIDs = []
    resources.forEach(resource => {
      if (resource.coverUrl) fileIDs.push(resource.coverUrl)
      if (resource.originUrl && resource.originUrl !== resource.coverUrl) {
        fileIDs.push(resource.originUrl)
      }
    })
    
    const uniqueFileIDs = [...new Set(fileIDs)]
    console.log('需要删除的文件数量:', uniqueFileIDs.length)
    
    if (uniqueFileIDs.length > 0) {
      try {
        await cloud.deleteFile({
          fileList: uniqueFileIDs
        })
        console.log('删除云存储文件成功')
      } catch (fileErr) {
        console.warn('删除云存储文件失败:', fileErr)
      }
    }
    
    const deletePromises = resourceIds.map(id => 
      db.collection('resources').doc(id).remove()
    )
    
    await Promise.all(deletePromises)
    
    console.log('删除数据库记录成功')
    
    return {
      success: true,
      message: `成功删除 ${resourceIds.length} 个资源`,
      deletedCount: resourceIds.length
    }
    
  } catch (error) {
    console.error('批量删除失败:', error)
    return {
      success: false,
      message: error.message || '删除失败',
      error: error.message
    }
  }
}
