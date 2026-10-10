/**
 * virtualPayNotify - 虚拟支付消息推送接收
 *
 * 配置方式：MP 后台 → 开发与服务 → 开发管理 → 消息推送
 *   服务器 URL：云开发环境中可将此云函数发布为 HTTP 访问服务（或用 Nightly 开发者工具
 *   Skills 的「消息推送订阅」自动绑定），推送 Token/EncodingAESKey 按后台生成的填。
 *
 * 处理的事件：
 *   xpay_goods_deliver_notify  发货推送（核心）：验幂等 → 开通会员 → 返回 ErrCode 0
 *   xpay_refund_notify         退款推送：更新订单状态为 refunded
 *
 * 返回格式（XML）：<xml><ErrCode>0</ErrCode><ErrMsg><![CDATA[success]]></ErrMsg></xml>
 * 返回 0 后平台停止重试；非 0 平台最多重试 15 次。
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// ─── 极简 XML 解析（只取需要的字段，避免引第三方依赖） ───

function xmlToJson(xml) {
  const obj = {}
  let body = String(xml || '')
  // 去掉 XML 声明与外层 <xml> 包裹（否则外层标签会把全部内容吞成一个值）
  body = body.replace(/<\?xml[^>]*\?>/g, '')
  const wrapper = body.match(/<xml[^>]*>([\s\S]*)<\/xml>/)
  if (wrapper) body = wrapper[1]

  // 第一轮：平级字段
  const re = /<([A-Za-z0-9_.]+)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/\1>/g
  let m
  while ((m = re.exec(body)) !== null) {
    obj[m[1]] = m[2] !== undefined ? m[2] : (m[3] || '').trim()
  }

  // 第二轮：值为子 XML 的字段（如 WeChatPayInfo/GoodsInfo 嵌套），递归拍平合并
  for (const key of Object.keys(obj)) {
    const val = obj[key]
    if (typeof val === 'string' && val.startsWith('<')) {
      try {
        const inner = xmlToJson(val)
        Object.assign(obj, inner) // MchOrderNo / ProductId 等内层字段平铺到顶层
      } catch (e) { /* 忽略解析失败的嵌套 */ }
    }
  }
  return obj
}

// ─── 会员开通（与 virtualPay/deliverMember 同构；独立实现避免跨函数 require） ───

const MEMBER_DAYS = { weekly: 7, monthly: 30, quarterly: 90, yearly: 365, lifetime: null }

async function deliverMember(openid, level, productName, outTradeNo, wxOrderId) {
  const days = MEMBER_DAYS[level]
  if (days === undefined) throw new Error('无效会员等级: ' + level)

  // 幂等：wxOrderId 优先（平台单号），退化用 outTradeNo
  const orderIdKey = wxOrderId || outTradeNo
  const orderRes = await db.collection('virtual_pay_orders')
    .where(outTradeNo ? { outTradeNo } : { wxOrderId })
    .limit(1).get()
  const order = orderRes.data[0]

  if (order && order.status === 'delivered') {
    return { alreadyDelivered: true }
  }

  let newExpireDate
  if (level === 'lifetime') {
    newExpireDate = new Date('2099-12-31')
  } else {
    let user = null
    if (order) {
      const u = await db.collection('user_points').where({ _openid: openid }).limit(1).get()
      user = u.data[0]
    } else {
      const u = await db.collection('user_points').where({ _openid: openid }).limit(1).get()
      user = u.data[0]
    }
    const currentExpire = user && user.memberExpireDate ? new Date(user.memberExpireDate) : null
    if (currentExpire && currentExpire > new Date()) {
      newExpireDate = new Date(currentExpire.getTime() + days * 24 * 3600 * 1000)
    } else {
      newExpireDate = new Date(Date.now() + days * 24 * 3600 * 1000)
    }
  }

  // upsert user_points
  const uRes = await db.collection('user_points').where({ _openid: openid }).limit(1).get()
  const userDoc = uRes.data[0]
  if (userDoc) {
    await db.collection('user_points').doc(userDoc._id).update({
      data: {
        memberLevel: level,
        memberExpireDate: newExpireDate,
        updatedAt: new Date()
      }
    })
  } else {
    await db.collection('user_points').add({
      data: {
        _openid: openid,
        points: 0,
        totalPoints: 0,
        checkInDays: 0,
        totalCheckInDays: 0,
        lastCheckInDate: '',
        memberLevel: level,
        memberExpireDate: newExpireDate,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })
  }

  await db.collection('member_records').add({
    data: {
      _openid: openid,
      memberLevel: level,
      startDate: new Date(),
      expireDate: newExpireDate,
      pointsCost: 0,
      source: 'virtual_pay',
      productName: productName || '',
      outTradeNo: outTradeNo || '',
      wxOrderId: wxOrderId || '',
      createdAt: new Date()
    }
  })

  // 订单更新（可能订单不存在——例如推送先于 createOrder 落库的极端时序，此时补建一条）
  if (order) {
    await db.collection('virtual_pay_orders').doc(order._id).update({
      data: {
        status: 'delivered',
        wxOrderId: wxOrderId || order.wxOrderId || '',
        paidAt: order.paidAt || new Date(),
        deliveredAt: new Date()
      }
    })
  } else {
    await db.collection('virtual_pay_orders').add({
      data: {
        _openid: openid,
        outTradeNo: outTradeNo || ('PUSH' + Date.now().toString(36)),
        wxOrderId: wxOrderId || '',
        productId: '',
        level,
        productName: productName || '',
        status: 'delivered',
        amount: 0,
        env: 0,
        attach: '',
        createdAt: new Date(),
        paidAt: new Date(),
        deliveredAt: new Date(),
        note: '由推送补建（下单记录缺失）'
      }
    })
  }

  return { alreadyDelivered: false, memberLevel: level, expireDate: newExpireDate }
}

// ─── 主入口 ────────────────────────────────────────

exports.main = async (event, context) => {
  console.log('[virtualPayNotify] 收到推送 event keys:', Object.keys(event || {}))

  // 云函数接收消息推送：event 可能是 XML 字符串，或 { xml: '...' }，或已解析对象
  let payload = event
  if (typeof event === 'string') {
    payload = xmlToJson(event)
  } else if (event && typeof event.xml === 'string') {
    payload = xmlToJson(event.xml)
  } else if (event && event.body && typeof event.body === 'string') {
    payload = xmlToJson(event.body)
  }

  const eventType = payload.Event || payload.event || ''
  const openid = payload.OpenId || payload.openid || payload.FromUserName || ''

  try {
    // ── 道具发货推送（核心） ──
    if (eventType === 'xpay_goods_deliver_notify') {
      const outTradeNo = payload.OutTradeNo || payload.outTradeNo || ''
      const wxOrderId = (payload.WeChatPayInfo && payload.WeChatPayInfo.MchOrderNo)
        || payload['WeChatPayInfo.MchOrderNo'] || payload.MchOrderNo || payload.order_id || ''
      const productId = (payload.GoodsInfo && payload.GoodsInfo.ProductId)
        || payload['GoodsInfo.ProductId'] || payload.ProductId || payload.product_id || ''
      const attach = payload.Attach || payload.attach || ''

      console.log('[virtualPayNotify] 发货推送:', { openid, outTradeNo, wxOrderId, productId, attach })

      // 从 attach 或 productId 推导会员等级（attach 格式：member:monthly）
      let level = ''
      if (attach && attach.startsWith('member:')) {
        level = attach.slice('member:'.length)
      }
      // 兜底：查订单拿 level
      if (!level && outTradeNo) {
        const o = await db.collection('virtual_pay_orders').where({ outTradeNo }).limit(1).get()
        level = o.data[0] && o.data[0].level
      }
      // 再兜底：productId 直接命名（如 productId 配成 monthly）
      if (!level && productId && MEMBER_DAYS[productId] !== undefined) {
        level = productId
      }
      if (!level) {
        console.error('[virtualPayNotify] 无法确定会员等级:', { attach, productId, outTradeNo })
        return buildXml(0, 'level_unknown_but_ack') // 返回 0 防止无限重试，错误已记录日志人工排查
      }

      const result = await deliverMember(openid, level, '', outTradeNo, wxOrderId)
      console.log('[virtualPayNotify] 发货完成:', result)
      return buildXml(0, 'success')
    }

    // ── 退款推送：订单标记 refunded（会员不自动回收，人工决定；如需自动回收可扩展） ──
    if (eventType === 'xpay_refund_notify') {
      const outTradeNo = payload.OutTradeNo || payload.outTradeNo || ''
      const wxOrderId = payload.MchOrderNo || payload.order_id || ''
      console.log('[virtualPayNotify] 退款推送:', { openid, outTradeNo, wxOrderId })
      if (outTradeNo || wxOrderId) {
        const q = outTradeNo ? { outTradeNo } : { wxOrderId }
        const o = await db.collection('virtual_pay_orders').where(q).limit(1).get()
        if (o.data[0]) {
          await db.collection('virtual_pay_orders').doc(o.data[0]._id).update({
            data: { status: 'refunded', refundedAt: new Date() }
          })
        }
      }
      return buildXml(0, 'success')
    }

    // ── 其它事件（代币/投诉/订阅类，当前未用到，先 ACK 记录） ──
    console.log('[virtualPayNotify] 未处理的事件类型:', eventType)
    return buildXml(0, 'success')
  } catch (e) {
    console.error('[virtualPayNotify] 处理失败:', e)
    // 返回非 0 让平台重试（最多 15 次）
    return buildXml(-1, e.message.slice(0, 100))
  }
}

function buildXml(errCode, errMsg) {
  return `<xml><ErrCode>${errCode}</ErrCode><ErrMsg><![CDATA[${errMsg || 'success'}]]></ErrMsg></xml>`
}
