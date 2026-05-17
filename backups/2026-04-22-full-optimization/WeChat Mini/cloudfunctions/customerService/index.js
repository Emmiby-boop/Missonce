const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  // 防止重复调用或死循环
  if (event.FromUserName === 'oW4nO5...') { 
    return
  }

  try {
    // ---------------------------------------------------------
    // 1. 发送自动回复 (即时响应用户)
    // ---------------------------------------------------------
    // 仅在用户发送文本、图片或进入会话时回复
    if (event.MsgType === 'text' || event.MsgType === 'image' || event.MsgType === 'event') {
      const replyContent = '👋 您好！欢迎来到小辣椒动态头像壁纸精选。\n\n' +
        '✨ 我们已收到您的消息，人工客服会在第一时间为您处理，请稍候。\n\n' +
        '💡 常见问题：\n' +
        '1. 图片下载：点击图片进入预览页，长按或点击保存即可。\n' +
        '2. 商务合作：请联系邮箱 missonce@icloud.com\n' +
        '3. 资源投稿：欢迎发送高质量资源至上述邮箱。\n\n' +
        '再次感谢您的支持！🌹';

      await cloud.openapi.customerServiceMessage.send({
        touser: wxContext.OPENID,
        msgtype: 'text',
        text: {
          content: replyContent
        }
      })
    }

    // ---------------------------------------------------------
    // 2. 将消息转发给人工客服
    // ---------------------------------------------------------
    // 必须返回此特定 JSON 对象，微信服务器才会将消息继续推送到
    // “微信客服”或“客服小助手”小程序，否则人工客服将收不到消息。
    // 注意：请确保在小程序后台 -> 开发 -> 开发设置 -> 消息推送 中已正确配置。
    return {
      MsgType: 'transfer_customer_service',
      ToUserName: event.FromUserName,
      FromUserName: event.ToUserName,
      CreateTime: Math.floor(Date.now() / 1000)
    }

  } catch (err) {
    console.error('客服消息处理失败', err)
    return err
  }
}