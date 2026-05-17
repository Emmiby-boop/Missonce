const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    // 获取公众号配置
    const res = await db.collection('contact_config')
      .where({ 
        type: 'official_account',
        enabled: true 
      })
      .get()
    
    if (res.data.length > 0) {
      const config = res.data[0]
      
      // 如果有二维码图片，获取临时链接
      if (config.qrcodeUrl) {
        try {
          // 如果已经是临时链接（https://开头），直接使用
          if (config.qrcodeUrl.startsWith('https://') || config.qrcodeUrl.startsWith('http://')) {
            // 已经是临时链接，无需处理
          } else {
            // 否则是云存储fileID，需要获取临时链接
            const tempUrl = await cloud.getTempFileURL({
              fileList: [config.qrcodeUrl]
            })
            if (tempUrl.fileList && tempUrl.fileList[0]) {
              config.qrcodeUrl = tempUrl.fileList[0].tempFileURL
            }
          }
        } catch (e) {
          console.error('获取二维码临时链接失败:', e)
        }
      }
      
      return {
        success: true,
        data: config
      }
    }
    
    return {
      success: true,
      data: null,
      message: '未配置公众号'
    }
    
  } catch (e) {
    return {
      success: false,
      message: e.message
    }
  }
}
