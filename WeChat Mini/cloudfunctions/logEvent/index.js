const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { type, resourceId, ...data } = event
  const wxContext = cloud.getWXContext()
  
  try {
    // 1. 记录到事件表
    const logPromise = db.collection('events').add({
      data: {
        type,
        resourceId,
        ...data,
        _openid: wxContext.OPENID,
        clientIp: wxContext.CLIENTIP,
        createTime: db.serverDate()
      }
    })

    // 2. 如果是 PV 事件且有资源ID，同步更新资源的浏览量和热度
    let statsPromise = Promise.resolve()
    if (type === 'pv' && resourceId && typeof resourceId === 'string' && !resourceId.startsWith('http') && !resourceId.startsWith('cloud:')) {
       const _ = db.command
       statsPromise = db.collection('resources').doc(resourceId).update({
         data: {
           viewCount: _.inc(1),
           hotScore: _.inc(1), // 浏览也增加热度
           updatedAt: db.serverDate()
         }
       }).catch(err => {
         // 忽略资源不存在的错误，可能是因为 resourceId 不正确或是新上传的资源
         console.warn('Update resource stats failed for pv:', err)
       })
    }

    await Promise.all([logPromise, statsPromise])
    
    return { success: true }
  } catch (err) {
    console.error('Log event failed', err)
    return {
      success: false,
      errMsg: err
    }
  }
}
