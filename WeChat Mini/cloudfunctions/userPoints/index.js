const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const handlers = [
  require('./handlers/checkin'),
  require('./handlers/download'),
  require('./handlers/invite'),
  require('./handlers/share'),
  require('./handlers/member'),
  require('./handlers/query'),
]

exports.main = async (event, context) => {
  // 🔥 定时触发器保活：快速返回，避免冷启动
  if (event && event.Type === 'timer') {
    return { success: true, msg: 'keepalive' }
  }

  const { action } = event
  const openid = cloud.getWXContext().OPENID

  if (!openid) {
    return { success: false, error: '用户未登录' }
  }

  if (!action) {
    return { success: false, error: '缺少 action 参数' }
  }

  // 将 openid 注入 event，供各 handler 使用
  event.openid = openid

  try {
    for (const handler of handlers) {
      const result = await handler(event, context)
      if (result !== null) return result
    }
    return { success: false, error: '无效的 action' }
  } catch (e) {
    console.error('云函数执行失败:', e)
    return { success: false, error: e.message }
  }
}
