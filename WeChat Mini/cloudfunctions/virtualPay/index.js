/**
 * virtualPay - 个人主体虚拟支付（道具直购）
 *
 * 链路（对照官方文档 5.1/5.2 节）：
 *   前端 createOrder → 本函数签名 → wx.requestVirtualPayment 拉起支付
 *   → 支付成功 → 平台推送 xpay_goods_deliver_notify 到 virtualPayNotify 云函数发货
 *   → 推送丢失时 queryOrder 兜底查单补发货
 *
 * 配置存放：sys_config 集合 doc: virtual_pay_config
 *   { offerId, appKey, sandbox(0/1), products: { productId: { level, days, name, price, type } } }
 *   type: 'normal' = 原价道具（续费买）/ 'first' = 首购优惠道具
 *
 *   首购双轨：同一会员等级对应两个道具
 *     member_monthly       type:'normal' price:1000  ← 续费价（¥10）
 *     member_monthly_first type:'first'  price:499   ← 首购价（¥4.99），展示划线价 ¥10
 *   下单时按「是否从未开通过会员」自动选道具：首次 → first，老客 → normal。
 *   getProducts 把同 level 的两个道具合并成一个档位，附带 originalPrice 供前端画划线价。
 *
 * ⚠️ goodsPrice 必须与 MP 后台【道具管理】里该道具的价格完全一致（单位分），
 *    否则下单报 -15013 goodsPrice 道具价格错误。
 *
 * 订单表：virtual_pay_orders
 *   { _openid, outTradeNo, wxOrderId, productId, level, status(pending/paid/delivered/refunded),
 *     amount, env, attach, createdAt, paidAt, deliveredAt }
 */
const cloud = require('wx-server-sdk')
const https = require('https')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// ─── 配置 ────────────────────────────────────────

let _cfgCache = null
let _cfgCacheTs = 0
const CFG_TTL = 60 * 1000

async function loadConfig() {
  const now = Date.now()
  if (_cfgCache && (now - _cfgCacheTs) < CFG_TTL) return _cfgCache
  let cfg = null
  try {
    const res = await db.collection('sys_config').doc('virtual_pay_config').get()
    cfg = res.data
  } catch (e) {
    cfg = null
  }
  if (!cfg || !cfg.offerId || !cfg.appKey) {
    const err = new Error('虚拟支付未配置：请在后台 AI/系统配置里填写 virtual_pay_config（offerId/appKey/products）')
    err.code = 'VP_NOT_CONFIGURED'
    throw err
  }
  _cfgCache = cfg
  _cfgCacheTs = now
  return cfg
}

// ─── 签名（官方文档 5.5 节，两套签名） ────────────────

/**
 * paySig：HMAC-SHA256(appKey, uri + '&' + postBody)
 * C 端下单 uri 固定为 requestVirtualPayment
 */
function calcPaySig(uri, postBody, appKey) {
  return crypto.createHmac('sha256', appKey).update(uri + '&' + postBody, 'utf8').digest('hex')
}

/**
 * signature（用户态）：HMAC-SHA256(sessionKey, postBody)
 */
function calcSignature(postBody, sessionKey) {
  return crypto.createHmac('sha256', sessionKey).update(postBody, 'utf8').digest('hex')
}

// ─── sessionKey 获取：前端传 code，服务端 code2Session ───

async function getSessionKeyByCode(code, appid) {
  const wxContext = cloud.getWXContext()
  const sess = await cloud.openapi.auth.code2Session({
    js_code: code,
    grant_type: 'authorization_code',
    appid: appid || wxContext.APPID
  })
  if (!sess || !sess.session_key) {
    throw new Error('code2Session 未返回 session_key')
  }
  return sess
}

// ─── outTradeNo 生成（8-32 位，唯一，不以下划线开头） ──

function genOutTradeNo() {
  const ts = Date.now().toString(36) // 8 位
  const rnd = crypto.randomBytes(5).toString('hex') // 10 位
  return 'T' + ts + rnd // 19 位
}

// ─── 首购判定 ────────────────────────────────────
// 判定口径：该用户在 virtual_pay_orders 里没有任何已支付/已发货的现金订单。
// 只看现金订单，不看 member_records —— 用辣度值兑换过的用户，
// 对现金购买来说仍然是「首次」，照样该享受首购价（拉新逻辑优先）。
const PAID_STATUS = ['paid', 'delivered']

async function hasPaidCashOrder(openid) {
  try {
    const res = await db.collection('virtual_pay_orders')
      .where({ _openid: openid, status: _.in(PAID_STATUS) })
      .limit(1)
      .get()
    return !!(res.data && res.data.length)
  } catch (e) {
    console.error('[virtualPay] 首购判定失败:', e)
    return false // 判定失败时按首购处理（对用户有利，且下单金额仍以道具后台价为准）
  }
}

/**
 * 首购优惠总开关。
 * MP 后台的 5 个 *_first 道具没建好 / 还没发布（同步要 10~30 分钟）时，
 * 必须让首购价下线，否则用户点了支付会报 -15010 productId 未发布。
 * 建好后把 sys_config.virtual_pay_config.firstPurchaseEnabled 改成 true 即可。
 */
function isFirstPurchaseEnabled(cfg) {
  return cfg.firstPurchaseEnabled === true
}

/** 把同 level 的 normal / first 两个道具合并成一个档位 */
function buildLevelTiers(cfg) {
  const byLevel = {}
  Object.keys(cfg.products || {}).forEach((id) => {
    const p = cfg.products[id]
    if (!p || !p.level) return
    const tier = byLevel[p.level] || (byLevel[p.level] = {
      level: p.level,
      name: p.name,
      normalId: '',
      firstId: ''
    })
    if (p.type === 'first') tier.firstId = id
    else tier.normalId = id
  })
  return byLevel
}

function yuanOf(cent) {
  if (cent === undefined || cent === null || cent === '') return ''
  const n = Number(cent)
  if (Number.isNaN(n)) return ''
  // 整数分（如 300/1000/6800/12800）→ 不带小数
  if (n % 100 === 0) return String(n / 100)
  // 非整数分：¥3.80 → "3.8"（去掉末尾一个 0），但 ¥3.05 → "3.05" 保留两位
  const s = (n / 100).toFixed(2)
  return s.endsWith('0') ? s.slice(0, -1) : s
}

// ─── 发货：开通会员（写 user_points，与 exchangeMember 同构） ──

const MEMBER_DAYS = { weekly: 7, monthly: 30, quarterly: 90, yearly: 365, lifetime: null }

async function deliverMember(openid, level, productName, orderId) {
  const days = MEMBER_DAYS[level]
  if (days === undefined) throw new Error('无效会员等级: ' + level)

  // 幂等：先查订单是否已发货（virtualPayNotify 与 queryOrder 兜底可能并发到达）
  const orderRes = await db.collection('virtual_pay_orders')
    .where({ outTradeNo: orderId }).limit(1).get()
  const order = orderRes.data[0]
  if (!order) throw new Error('订单不存在: ' + orderId)
  if (order.status === 'delivered') {
    return { alreadyDelivered: true } // 幂等命中
  }

  let userRes = await db.collection('user_points').where({ _openid: openid }).limit(1).get()
  let user = userRes.data[0]

  // 计算新过期时间（在现有会员基础上顺延，与 exchangeMember 逻辑一致）
  let newExpireDate
  if (level === 'lifetime') {
    newExpireDate = new Date('2099-12-31')
  } else {
    const currentExpire = user && user.memberExpireDate ? new Date(user.memberExpireDate) : null
    if (currentExpire && currentExpire > new Date()) {
      newExpireDate = new Date(currentExpire.getTime() + days * 24 * 3600 * 1000)
    } else {
      newExpireDate = new Date(Date.now() + days * 24 * 3600 * 1000)
    }
  }

  if (user) {
    await db.collection('user_points').doc(user._id).update({
      data: {
        memberLevel: level,
        memberExpireDate: newExpireDate,
        updatedAt: new Date()
      }
    })
  } else {
    // 无 user_points 记录（新用户直接购买）：创建
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

  // 会员开通记录（与积分兑换区分来源）
  await db.collection('member_records').add({
    data: {
      _openid: openid,
      memberLevel: level,
      startDate: new Date(),
      expireDate: newExpireDate,
      pointsCost: 0,
      source: 'virtual_pay',
      productName: productName || '',
      outTradeNo: orderId,
      createdAt: new Date()
    }
  })

  // 订单标记已发货
  await db.collection('virtual_pay_orders').doc(order._id).update({
    data: {
      status: 'delivered',
      deliveredAt: new Date()
    }
  })

  return { alreadyDelivered: false, memberLevel: level, expireDate: newExpireDate }
}

// ─── 查单兜底：调平台 query_order（云托管/服务器方式，云函数内 https 直调） ──

async function callXpayApi(path, body, appKey, accessToken) {
  const postBody = JSON.stringify(body)
  const paySig = calcPaySig(path, postBody, appKey)
  // signature 用 sessionKey —— query_order 场景按官方示例可复用支付时的用户态签名密钥；
  // 但推送兜底场景拿不到 sessionKey，官方允许 B 端接口只带 pay_sig（signature 为空即可通过验签的场景以实测为准）
  const data = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.weixin.qq.com',
      path: path + '?access_token=' + accessToken,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postBody),
        'pay_sig': paySig
      },
      timeout: 10000
    }, (res) => {
      let buf = ''
      res.on('data', (c) => buf += c)
      res.on('end', () => {
        try { resolve(JSON.parse(buf)) } catch (e) { reject(new Error('query_order 响应解析失败: ' + buf.slice(0, 200))) }
      })
    })
    req.on('timeout', () => { req.destroy(); reject(new Error('query_order 超时')) })
    req.on('error', reject)
    req.write(postBody)
    req.end()
  })
  return data
}

async function getAccessToken() {
  // 云开发环境下优先用 openapi 免鉴权方式（cloud.openapi 内部自动管理 token）
  // 这里用一次无关调用探测：直接走 cloud.getAccessToken()（wx-server-sdk >= 2.6.0 支持）
  return cloud.getAccessToken()
}

// ─── 主入口 ────────────────────────────────────────

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action } = event

  try {
    // ── 下单：前端传 code + level（不再直接传 productId，避免前端自己挑优惠档） ──
    if (action === 'createOrder') {
      if (!openid) return { success: false, error: '未获取到用户身份' }
      const cfg = await loadConfig()
      if (!event.code) return { success: false, error: '缺少登录 code' }

      // 按 level 定位应售道具：首次购买 → first 优惠档；已购过 → normal 原价档
      const firstEnabled = isFirstPurchaseEnabled(cfg)
      const isFirst = firstEnabled && !(await hasPaidCashOrder(openid))
      let productId = ''
      let product = null

      if (event.productId && cfg.products && cfg.products[event.productId]) {
        // 兼容旧调用：直接给了 productId 就按给的来
        productId = event.productId
        product = cfg.products[productId]
      } else {
        const level = event.level
        const tier = buildLevelTiers(cfg)[level]
        if (!tier) return { success: false, error: '无效的会员档位: ' + level }
        const wantId = isFirst && tier.firstId ? tier.firstId : tier.normalId
        if (!wantId) return { success: false, error: '该档位未配置对应道具: ' + level }
        productId = wantId
        product = cfg.products[productId]
      }
      if (!product) return { success: false, error: '无效的商品: ' + productId }

      // code2Session 拿 sessionKey（一次性使用，避免存储）
      let sessionKey, payerOpenid
      try {
        const sess = await getSessionKeyByCode(event.code, event.appid)
        sessionKey = sess.session_key
        payerOpenid = sess.openid
      } catch (e) {
        return { success: false, error: '获取 session_key 失败：' + e.message }
      }
      if (payerOpenid && payerOpenid !== openid) {
        // 下单人 ≠ 支付人，防代付套利
        return { success: false, error: '支付账号与登录账号不一致' }
      }

      const outTradeNo = genOutTradeNo()
      const env = cfg.sandbox ? 1 : 0 // 现网固定 0；沙箱调试时配置里设 sandbox:1
      const signDataObj = {
        offerId: String(cfg.offerId),
        buyQuantity: 1,
        env,
        currencyType: 'CNY',
        productId: String(productId),
        goodsPrice: Number(product.price), // 分
        outTradeNo,
        attach: 'member:' + product.level
      }
      const signData = JSON.stringify(signDataObj)
      const paySig = calcPaySig('requestVirtualPayment', signData, cfg.appKey)
      const signature = calcSignature(signData, sessionKey)

      // 订单入库
      await db.collection('virtual_pay_orders').add({
        data: {
          _openid: openid,
          outTradeNo,
          wxOrderId: '',
          productId,
          level: product.level,
          productName: product.name || product.level,
          status: 'pending',
          amount: product.price,
          isFirst: product.type === 'first',
          env,
          attach: signDataObj.attach,
          createdAt: new Date()
        }
      })

      return {
        success: true,
        data: {
          signData, // 前端原样传给 wx.requestVirtualPayment
          paySig,
          signature,
          mode: 'short_series_goods',
          outTradeNo
        }
      }
    }

    // ── 查单兜底：前端支付回调 success 后主动调用，或查订单状态 ──
    if (action === 'queryOrder') {
      if (!openid) return { success: false, error: '未获取到用户身份' }
      const cfg = await loadConfig()
      const outTradeNo = event.outTradeNo
      if (!outTradeNo) return { success: false, error: '缺少 outTradeNo' }

      const orderRes = await db.collection('virtual_pay_orders')
        .where({ _openid: openid, outTradeNo }).limit(1).get()
      const order = orderRes.data[0]
      if (!order) return { success: false, error: '订单不存在' }

      // 已发货直接返回
      if (order.status === 'delivered') {
        return { success: true, data: { status: 'delivered', level: order.level } }
      }

      // 调平台 query_order 查真实状态
      let token
      try {
        token = await getAccessToken()
      } catch (e) {
        return { success: false, error: '获取 access_token 失败：' + e.message }
      }
      const queryRes = await callXpayApi('/xpay/query_order', {
        openid,
        env: order.env,
        order_id: outTradeNo
      }, cfg.appKey, token)

      if (queryRes.errcode !== 0 && queryRes.errcode !== undefined) {
        return { success: false, error: 'query_order 失败: ' + (queryRes.errmsg || queryRes.errcode) }
      }

      // 查到已支付 → 补发货（推送丢失的兜底路径）
      const paid = queryRes.order && queryRes.order.status === 'PAID'
        || queryRes.status === 'PAID' || queryRes.order_status === 2 // 兼容多种返回结构
      if (paid && order.status !== 'delivered') {
        // 先标记 paid
        await db.collection('virtual_pay_orders').doc(order._id).update({
          data: { status: 'paid', paidAt: new Date(), wxOrderId: queryRes.order && queryRes.order.order_id || order.wxOrderId }
        })
        await deliverMember(openid, order.level, order.productName, outTradeNo)
        return { success: true, data: { status: 'delivered', level: order.level } }
      }

      return { success: true, data: { status: order.status, platformStatus: queryRes } }
    }

    // ── 我的订单列表（前端展示） ──
    if (action === 'myOrders') {
      if (!openid) return { success: false, error: '未获取到用户身份' }
      const res = await db.collection('virtual_pay_orders')
        .where({ _openid: openid })
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get()
      return { success: true, data: res.data }
    }

    // ── 商品列表（前端展示价格） ──
    // 返回「按档位合并」的列表：
    //   isFirstPurchase=true  → price 为首购到手价，originalPrice 为划线原价（前端画删除线）
    //   isFirstPurchase=false → price 为续费原价，无划线价
    if (action === 'getProducts') {
      const cfg = await loadConfig()
      const firstEnabled = isFirstPurchaseEnabled(cfg)
      const isFirst = firstEnabled ? (openid ? !(await hasPaidCashOrder(openid)) : false) : false
      const tiers = buildLevelTiers(cfg)
      const order = { weekly: 0, monthly: 1, quarterly: 2, yearly: 3, lifetime: 4 }

      const list = Object.keys(tiers)
        .map((level) => {
          const tier = tiers[level]
          const normal = tier.normalId ? cfg.products[tier.normalId] : null
          const first = tier.firstId ? cfg.products[tier.firstId] : null
          // 首购价优先；没配 first 道具就退回原价
          const use = isFirst && first ? first : (normal || first)
          const origin = normal || first
          if (!use) return null
          return {
            level,
            name: use.name || tier.name,
            price: use.price,
            priceYuan: yuanOf(use.price),
            // 划线原价：仅首购档且确实便宜于原价时才给
            originalPrice: isFirst && first && normal && first.price < normal.price
              ? normal.price
              : 0,
            originalYuan: isFirst && first && normal && first.price < normal.price
              ? yuanOf(normal.price)
              : '',
            isFirstPurchase: isFirst,
            // 下单仍以 level 为准，云函数内部再选道具；此字段仅供调试对照
            productId: (isFirst && tier.firstId) ? tier.firstId : (tier.normalId || tier.firstId || '')
          }
        })
        .filter(Boolean)
        .sort((a, b) => (order[a.level] ?? 99) - (order[b.level] ?? 99))

      return { success: true, data: list }
    }

    return { success: false, error: '无效的 action: ' + action }
  } catch (e) {
    console.error('[virtualPay] 错误:', e)
    return { success: false, error: e.message, code: e.code || undefined }
  }
}
