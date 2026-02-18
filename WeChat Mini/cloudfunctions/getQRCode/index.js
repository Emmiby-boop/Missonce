const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  try {
    const { path = 'pages/index/index', width = 280, scene = '' } = event
    
    // 生成小程序码
    const result = await cloud.openapi.wxacode.getUnlimited({
      scene: scene || 's=p', // 不能为空，随便给个值
      page: path,
      width: width,
      check_path: false // 暂时不校验路径，方便测试
    })

    if (result.errCode) {
      throw new Error(result.errMsg)
    }

    // 上传到云存储
    const upload = await cloud.uploadFile({
      cloudPath: `qrcode/qr_${Date.now()}_${Math.random()}.png`,
      fileContent: result.buffer,
    })

    // 获取临时链接
    const fileList = await cloud.getTempFileURL({
      fileList: [upload.fileID]
    })
    
    return {
      success: true,
      fileID: upload.fileID,
      url: fileList.fileList[0].tempFileURL
    }

  } catch (err) {
    console.error('获取小程序码失败', err)
    return {
      success: false,
      error: err
    }
  }
}