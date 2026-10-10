import { getStorage } from '../../utils/storageManager.js'
import { setMember as setMemberAdFree } from '../../utils/memberAdFree.js'

/**
 * 会员服务协议
 *
 * 2026-10-10 重构：协议正文从「支付弹窗内的 78vh 抽屉」改为**独立整页**
 *   subpackages/agreement/agreement（正文数据仍在本文件 agreementContent.js，供整页渲染）。
 * 原因：
 *   1) 抽屉弹窗在部分机型上正文左右溢出 / 被截断，可用高度也不足；
 *   2) 独立整页能完整展示「版本 / 更新日期 / 生效日期 / 编号条款 / 底部同意」，
 *      更贴合合规审查对「协议可完整查阅」的要求。
 *
 * ⚠️ 改价纪律：MP 后台 virtual_pay_config.products 或后台 memberPrices 变动后，
 *    必须同步更新 agreementContent.js 第三、四、五条的价格表述（避免被判定误导）。
 */

Page({
  data: {
    statusBarHeight: 20,
    points: 0,
    isMember: false,
    memberLevel: 'none',
    memberName: '',
    memberDaysRemaining: 0,
    memberPrices: {
      // 与云端 shared.js 的 memberXxxPoints 一致（2026-10-10 重定，倍率 1.05x→0.86x递减）
      weekly: 400,
      monthly: 900,
      quarterly: 1800,
      yearly: 3500,
      lifetime: 5900
    },
    // ── 虚拟支付（现金购买会员）──
    cashProducts: [],
    cashBuying: false,
    showCashModal: false,
    cashModalProduct: null,
    // 首购优惠：iOS 端不展示划线原价（规避机审对折扣文案的抓取），只显示到手价
    isIOS: false,
    // 桌面端微信（Windows / macOS）：不走 Apple IAP，是 iOS 用户的替代开通路径
    isPC: false,
    platform: '',
    // Apple IAP 拒付后的自定义引导弹窗
    showPayGuideModal: false,
    payGuideOnPC: false,
    cashFirstPurchase: false,
    cashFirstYuan: '',
    showStrike: false,
    cashWeeklyYuan: '',
    cashMonthlyYuan: '',
    cashQuarterlyYuan: '',
    cashYearlyYuan: '',
    cashLifetimeYuan: '',
    cashWeeklyOldYuan: '',
    cashMonthlyOldYuan: '',
    cashQuarterlyOldYuan: '',
    cashYearlyOldYuan: '',
    cashLifetimeOldYuan: '',
    // ── 会员服务协议（正文在独立整页 agreement/agreement，此处只保留勾选态）──
    agreementAgreed: false,
  },

  onLoad() {
    try {
      const info = wx.getWindowInfo()
      this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    } catch (e) {
      // fallback to default
    }
    this.loadConfigs()
    this.loadUserInfo()
    this.initPlatform()
    this.loadCashProducts()
  },

  onShow() {
    this.loadUserInfo()
    this.syncAgreementAccepted()
  },

  goBack() {
    wx.navigateBack()
  },

  scrollToVip() {
    wx.pageScrollTo({ selector: '#vip-section', duration: 300 })
  },

  /**
   * 顶部会员卡位点击 → 滚到套餐区。
   * 说明：未开通用户来这个页面就是为了买会员，滚到套餐区是对的；
   * 已开通用户想看有效期，卡位上已经直接显示剩余天数，不需要跳记录。
   */
  onVipCardTap() {
    this.scrollToVip()
  },

  /**
   * 导航栏「?」→ 打开会员服务协议整页。
   * 2026-10-10 拆分后规则/积分说明已迁至辣度值页，会员页的「?」
   * 改为指向《会员服务协议》（与页面付费属性一致），不再是死跳转。
   */
  toggleRules() {
    this.openAgreement()
  },

  /**
   * 「辣度值不足 → 去赚辣度值」：跳辣度值页的赚分区。
   * 旧实现是 setData({ activeTab: 'rules' })，但 activeTab 是死字段（wxml 零引用），
   * 点了毫无反应 —— 属于确定的 bug，已改为真实跳转。
   */
  goEarnPoints() {
    wx.navigateTo({
      url: '/subpackages/spicy/spicy?focus=earn',
      fail: () => wx.showToast({ title: '页面打开失败，请重试', icon: 'none' })
    })
  },

  /** 会员页 → 辣度值页（积分内容已迁出，这里提供入口） */
  goSpicyPage() {
    wx.navigateTo({
      url: '/subpackages/spicy/spicy',
      fail: () => wx.showToast({ title: '页面打开失败，请重试', icon: 'none' })
    })
  },

  async loadConfigs() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { action: 'getConfigs' }
      })

      if (res.result && res.result.success && res.result.data) {
        const configs = res.result.data
        this.setData({
          // 兜底值与云端 shared.js 保持一致（2026-10-10 重定定价）
          memberPrices: {
            weekly: configs.memberWeeklyPoints || 400,
            monthly: configs.memberMonthlyPoints || 900,
            quarterly: configs.memberQuarterlyPoints || 1800,
            yearly: configs.memberYearlyPoints || 3500,
            lifetime: configs.memberLifetimePoints || 5900
          }
        })
      }
    } catch (e) {
      console.error('加载配置失败:', e)
    }
  },

  async loadUserInfo() {
    try {
      const [userRes, memberRes] = await Promise.all([
        wx.cloud.callFunction({
          name: 'userPoints',
          data: { action: 'getUserInfo' }
        }),
        wx.cloud.callFunction({
          name: 'userPoints',
          data: { action: 'getMemberStatus' }
        })
      ])

      if (userRes.result && userRes.result.success) {
        const data = userRes.result.data
        this.setData({
          // 辣度值余额（用于「辣度值不足」判定与入口展示）
          points: data.points,
          openid: data._openid
        })
      }

      if (memberRes.result && memberRes.result.success) {
        const member = memberRes.result.data
        this.setData({
          isMember: member.isMember,
          memberLevel: member.memberLevel || member.level || 'none',
          memberDaysRemaining: member.daysRemaining || 0,
          memberName: member.memberName || this.getMemberName(member.memberLevel || member.level)
        })
        // 🔥 同步插屏广告闸门：刚开通/刚兑换完会员，立刻免插屏，不用等下次冷启动
        setMemberAdFree(!!member.isMember)
      }
    } catch (e) {
      console.error('加载用户信息失败:', e)
    }
  },

  getMemberName(level) {
    const names = {
      weekly: '周卡会员',
      monthly: '月卡会员',
      quarterly: '季卡会员',
      yearly: '年卡会员',
      lifetime: '终身会员'
    }
    return names[level] || ''
  },

  onShareAppMessage() {
    // 分享奖励发放 —— 2026-10-10 修 bug：
    // 此前只有 pages/tools 的 onShareAppMessage 调了recordShareReward，
    // 导致用户在「会员中心」「我的」页分享**拿不到辣度值**，但界面写着「分享 +10」。
    const { recordShareReward } = require('../../utils/shareReward.js')
    setTimeout(() => recordShareReward(), 500)

    const userInfo = getStorage('userInfo')
    const inviterParam = userInfo && userInfo.openid ? '?inviter=' + userInfo.openid : ''
    return {
      title: '小辣椒动态头像，海量精美素材免费下载！',
      path: '/pages/index/index' + inviterParam,
      imageUrl: '/images/share-cover.png'
    }
  },

  onShareTimeline() {
    // 朋友圈分享同样发放奖励（此前只有会话分享有）
    const { recordShareReward } = require('../../utils/shareReward.js')
    setTimeout(() => recordShareReward(), 500)

    const userInfo = getStorage('userInfo')
    const inviterParam = userInfo && userInfo.openid ? 'inviter=' + userInfo.openid : ''
    return {
      title: '小辣椒动态头像，海量精美素材免费下载！',
      query: inviterParam,
      imageUrl: '/images/share-cover.png'
    }
  },

  async exchangeMember(e) {
    const level = e.currentTarget.dataset.level

    // 未同意会员服务协议：引导去阅读，但**不关弹窗**。
    // 旧实现在这里 setData({showCashModal:false}) 把弹窗关掉，
    // 用户从协议页返回后弹窗已消失、勾选被重置，得从头再来一遍（最长 8 次点击）。
    // 现在：只跳协议页，弹窗保留，返回后勾选态由 syncAgreementAccepted 自动接上。
    if (!this.data.agreementAgreed) {
      this.requireAgreement()
      return
    }

    const price = this.data.memberPrices[level]

    if (this.data.points < price) {
      wx.showModal({
        title: '辣度值不足',
        content: '兑换' + this.getMemberName(level) + '需要 ' + price + ' 辣度值，当前辣度值 ' + this.data.points + '，是否前往赚取辣度值？',
        success: (res) => {
          if (res.confirm) this.goEarnPoints()
        }
      })
      return
    }

    wx.showModal({
      title: '确认兑换',
      content: '确定用 ' + price + ' 辣度值兑换' + this.getMemberName(level) + '？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const res = await wx.cloud.callFunction({
              name: 'userPoints',
              data: {
                action: 'exchangeMember',
                level: level
              }
            })

            if (res.result && res.result.success) {
              wx.showToast({ title: '兑换成功！', icon: 'success' })
              this.loadUserInfo()
            } else {
              wx.showToast({ title: res.result.error || '兑换失败', icon: 'none' })
            }
          } catch (e) {
            wx.showToast({ title: '兑换失败', icon: 'none' })
          }
        }
      }
    })
  },

  // ═══════════ 会员服务协议 ═══════════

  /**
   * 打开协议全文 → 独立整页 subpackages/agreement/agreement
   * 2026-10-10：由页内 78vh 抽屉改为整页（修复左右溢出 / 正文被截断 + 阅读空间不足）。
   * from=pay 时协议页底部按钮会把「已同意」回传本页，省掉用户二次勾选。
   */
  openAgreement() {
    const from = this.data.showCashModal ? 'pay' : 'vip'
    wx.navigateTo({
      url: `/subpackages/agreement/agreement?from=${from}&agreed=${this.data.agreementAgreed ? '1' : '0'}`,
      events: {
        // 协议页点「我已阅读并同意」时回传
        agreementAccepted: () => this.setData({ agreementAgreed: true })
      },
      fail: () => {
        wx.showToast({ title: '协议页面打开失败，请重试', icon: 'none' })
      }
    })
  },

  /** onShow 兜底：读取协议页写入的 storage 标记（防 EventChannel 未送达） */
  syncAgreementAccepted() {
    if (this.data.agreementAgreed) return
    let ts = 0
    try {
      ts = wx.getStorageSync('memberAgreementAcceptedAt') || 0
    } catch (e) {
      return
    }
    if (!ts) return
    try {
      wx.removeStorageSync('memberAgreementAcceptedAt')
    } catch (e) { /* 清理失败不阻塞 */ }
    this.setData({ agreementAgreed: true })
  },

  /** 勾选 / 取消勾选协议 */
  toggleAgree() {
    if (this.data.cashBuying) return
    const next = !this.data.agreementAgreed
    this.setData({ agreementAgreed: next })
    // 取消勾选时同步清掉 storage 标记，避免下次 onShow 又被误判为已同意
    if (!next) {
      try { wx.removeStorageSync('memberAgreementAcceptedAt') } catch (e) {}
    }
  },

  /** 未勾选时的拦截提示：引导去整页阅读 */
  requireAgreement() {
    wx.showToast({ title: '请先阅读并同意《会员服务协议》', icon: 'none' })
    this.openAgreement()
    return false
  },

  // ═══════════ 虚拟支付：现金购买会员 ═══════════

  /**
   * 平台识别：
   *  - isIOS      iOS 端隐藏划线原价（机审扫折扣文案会驳回），且虚拟支付走 Apple IAP
   *  - isPC       Windows / macOS 微信。**桌面端不走 Apple IAP**，虚拟支付可正常走通，
   *               是 iOS 用户被 Apple 拒付后的可行替代路径 → 支付失败引导里要推荐
   */
  initPlatform() {
    let platform = ''
    try {
      const info = typeof wx.getDeviceInfo === 'function'
        ? wx.getDeviceInfo()
        : wx.getSystemInfoSync()
      platform = String(info.platform || info.system || '').toLowerCase()
    } catch (e) {
      platform = ''
    }
    const isIOS = platform.indexOf('ios') >= 0
    const isPC = platform.indexOf('windows') >= 0 || platform.indexOf('mac') >= 0 ||
                 platform.indexOf('devtools') >= 0
    this.setData({ isIOS, isPC, platform })
  },

  async loadCashProducts() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'virtualPay',
        data: { action: 'getProducts' }
      })
      if (res.result && res.result.success) {
        const products = res.result.data || []
        const byLevel = {}
        products.forEach(p => { byLevel[p.level] = p })

        // 首购且非 iOS → 才展示划线原价（iOS 只给到手价）
        const isFirst = !!(products[0] && products[0].isFirstPurchase)
        const showStrike = isFirst && !this.data.isIOS

        const yuanOf = (lvl, key) => (byLevel[lvl] ? (byLevel[lvl][key] || '') : '')

        //会员卡位上的「¥x 起首购」：取现金档位里的最低价
        let lowest = 0
        products.forEach(p => {
          if (p && p.price > 0 && (lowest === 0 || p.price < lowest)) lowest = p.price
        })
        const lowestYuan = lowest > 0
          ? (lowest % 100 === 0 ? String(lowest / 100) : String((lowest / 100).toFixed(2)).replace(/\.?0+$/, ''))
          : ''

        this.setData({
          cashProducts: products,
          showStrike,
          cashFirstPurchase: isFirst,
          cashFirstYuan: lowestYuan,
          cashWeeklyYuan: yuanOf('weekly', 'priceYuan'),
          cashMonthlyYuan: yuanOf('monthly', 'priceYuan'),
          cashQuarterlyYuan: yuanOf('quarterly', 'priceYuan'),
          cashYearlyYuan: yuanOf('yearly', 'priceYuan'),
          cashLifetimeYuan: yuanOf('lifetime', 'priceYuan'),
          cashWeeklyOldYuan: yuanOf('weekly', 'originalYuan'),
          cashMonthlyOldYuan: yuanOf('monthly', 'originalYuan'),
          cashQuarterlyOldYuan: yuanOf('quarterly', 'originalYuan'),
          cashYearlyOldYuan: yuanOf('yearly', 'originalYuan'),
          cashLifetimeOldYuan: yuanOf('lifetime', 'originalYuan')
        })
      }
    } catch (e) {
      // 未配置虚拟支付时静默降级：现金购买入口不展示（cashProducts 为空 → wx:if 隐藏）
      console.log('[cashPay] 虚拟支付未启用')
    }
  },

  /** 找到会员等级对应的现金商品 */
  getCashProduct(level) {
    return (this.data.cashProducts || []).find(p => p.level === level) || null
  },

  /**
   * 卡片点击：有现金价 → 弹选择（现金/辣度值）；无现金价 → 直接辣度值兑换
   */
  onTierTap(e) {
    const level = e.currentTarget.dataset.level
    const cash = this.getCashProduct(level)
    if (cash && !this.data.cashBuying) {
      this.setData({ showCashModal: true, cashModalProduct: cash })
      return
    }
    // 无现金商品，走原积分兑换（或支付中禁止操作）
    this.exchangeMember(e)
  },

  closeCashModal() {
    if (this.data.cashBuying) return // 支付进行中不允许关
    // ⚠️ 不在此重置 agreementAgreed。
    // 旧实现在这里无条件重置，导致用户取消一次弹窗后重新购买还要再勾一遍协议 ——
    // 而「已勾选同意」是**会话级**状态，不是弹窗级状态。
    // 真正需要清空的是：用户主动取消勾选（toggleAgree 已处理）、
    // 以及支付成功后（buyWithCash 的 finally 里已处理）。
    this.setData({ showCashModal: false, cashModalProduct: null })
  },

  /** 弹窗里选「辣度值兑换」：关弹窗后走原兑换流程 */
  exchangeMemberByModal(e) {
    if (this.data.cashBuying) return
    // 同样只关弹窗，不动 agreementAgreed —— 兑换流程里已做过协议校验
    this.setData({ showCashModal: false, cashModalProduct: null })
    this.exchangeMember(e)
  },

  /** 弹窗里选「现金购买」 */
  async buyWithCash() {
    const product = this.data.cashModalProduct
    if (!product || this.data.cashBuying) return

    // 合规兜底：必须已勾选同意《会员服务协议》
    if (!this.data.agreementAgreed) {
      this.requireAgreement()
      return
    }

    // iOS 版本校验（虚拟支付要求微信 ≥ 8.0.68）
    if (!this.checkIosPayVersion()) return

    // 基础库校验（wx.requestVirtualPayment 需 ≥ 2.19.2）
    if (!this.canUseVirtualPayment()) {
      wx.showModal({
        title: '暂不支持',
        content: '当前微信版本过低，无法使用现金支付。请升级微信后重试，或使用辣度值兑换。',
        showCancel: false
      })
      return
    }

    // ⚠️ 开发者工具的 requestVirtualPayment 是桩实现，不会真正校验道具/签名，
    //    在模拟器里测虚拟支付毫无意义（永远报 PRODUCT_ID_NOT_PUBLISH）。
    //    放在 wx.login / createOrder 之前，避免模拟器里刷出一堆无效订单。
    if (this.isDevtools()) {
      wx.showModal({
        title: '请用真机测试',
        content: '开发者工具无法模拟虚拟支付（道具校验是桩实现）。\n\n请点工具栏「预览」用手机扫码，在真机上完成支付测试。',
        showCancel: false
      })
      return
    }

    this.setData({ cashBuying: true })
    try {
      // 1. wx.login 拿 code（云函数用它换 session_key 计算用户态签名）
      const codeRes = await new Promise((resolve, reject) => {
        wx.login({ success: resolve, fail: reject })
      })
      if (!codeRes.code) throw new Error('获取登录凭证失败')

      // 2. 下单（只传 level，具体用首购档还是原价档由云函数判定）
      const orderRes = await wx.cloud.callFunction({
        name: 'virtualPay',
        data: { action: 'createOrder', level: product.level, code: codeRes.code }
      })
      const order = orderRes.result
      if (!order || !order.success) {
        throw new Error((order && order.error) || '下单失败')
      }

      // 3. 拉起支付
      const payData = order.data
      // 排障日志：把真正发给微信的 signData 原文打出来（productId / goodsPrice / offerId / env）
      // 核对后台道具时需要逐字符比对大小写，console 里最直观
      console.log('[cashPay] signData =', payData.signData)
      console.log('[cashPay] mode =', payData.mode, '| outTradeNo =', payData.outTradeNo)
      await new Promise((resolve, reject) => {
        wx.requestVirtualPayment({
          signData: payData.signData,
          paySig: payData.paySig,
          signature: payData.signature,
          mode: payData.mode,
          success: resolve,
          fail: (err) => {
            console.error('[cashPay] requestVirtualPayment fail:', JSON.stringify(err))
            console.log('[cashPay] 系统弹窗即将弹出，等待其消退后再显示自定义指引')
            // -2 = 用户取消，不算错误
            if (err && err.errCode === -2) return resolve({ cancelled: true })
            reject(new Error((err && err.errMsg) || '支付失败'))
          }
        })
      })

      // 4. 支付成功（success 回调可能丢失，这里只做查询兜底，真正的发货以服务端推送为准）
      let delivered = false
      for (let i = 0; i < 3; i++) {
        await new Promise(r => setTimeout(r, 1500))
        try {
          const q = await wx.cloud.callFunction({
            name: 'virtualPay',
            data: { action: 'queryOrder', outTradeNo: payData.outTradeNo }
          })
          if (q.result && q.result.success && q.result.data.status === 'delivered') {
            delivered = true
            break
          }
        } catch (e) { /* 重试 */ }
      }

      this.setData({ showCashModal: false, cashModalProduct: null })
      if (delivered) {
        wx.showToast({ title: '开通成功', icon: 'success' })
      } else {
        // 支付成功但发货确认延迟，提示稍后自动到账（服务端推送兜底）
        wx.showModal({
          title: '支付成功',
          content: '会员权益将在几秒内自动到账，可下拉刷新查看。如有疑问请联系客服。',
          showCancel: false
        })
      }
      this.loadUserInfo()
    } catch (e) {
      console.error('[cashPay] 购买失败:', e)
      const rawMsg = (e && e.message) || ''
      // Apple 侧拒绝（errno 4）：原生弹窗文案不受我们控制，盖一层自己的引导
      if (/App\s*Store\s*暂无法完成充值/i.test(rawMsg)) {
        this.showAppleRegionGuide()
        return
      }
      wx.showToast({ title: this.humanizePayError(rawMsg), icon: 'none' })
    } finally {
      this.setData({ cashBuying: false })
    }
  },

  /**
   * Apple IAP 拒绝（errno 4「App Store 暂无法完成充值」）。
   *
   * ⚠️ 那个弹窗是 iOS / Apple IAP 弹的**原生弹窗**，文案来自 Apple，
   *    小程序侧没有任何 API 能改写。行业通行做法是：捕获该错误后
   *    立刻弹出自己的引导弹窗覆盖在原生弹窗之上（本方法即此）。
   *
   * 社区反馈的绝大多数成因是「Apple ID 账号非中国大陆区」，
   * 次要是「同账号在别的平台存在未完结交易」。
   *
   * ⛔ 合规注意：微信支付规范禁止「引导 iOS 用户至外部网页/APP 完成支付」。
   *    桌面端微信仍属微信生态内、且虚拟支付本身已合规开通（走官方 Apple IAP），
   *    但文案上**只用陈述语气**（「本小程序在电脑版微信同样支持开通」），
   *    不写「请你去电脑版开通」这类祈使句，降低机审风险。
   */
  showAppleRegionGuide() {
    // 已在桌面端微信里就别再推荐「去电脑版开通」了，换成排查指引
    const onPC = !!this.data.isPC
    // ⚠️ iOS 上 Apple 的系统弹窗（"暂不支持非大陆地区账号"，无按钮、自动消失）
    //    属于独立窗口层，会盖住我们自己的弹窗且此时 setData 会被忽略。
    //    必须等它自行消失后再弹，否则页面上的 pg-modal 永远不显示。
    setTimeout(() => {
      console.log('[cashPay] 系统弹窗已消退，弹出支付未完成指引')
      // 同时关掉支付方式弹窗（如果还开着），避免与指引弹窗叠加
      this.setData({
        showCashModal: false,
        cashModalProduct: null,
        showPayGuideModal: true,
        payGuideOnPC: onPC
      })
    }, 1600)
  },

  closePayGuide() {
    this.setData({ showPayGuideModal: false })
  },


  /**
   * 是否运行在微信开发者工具模拟器里。
   * 模拟器的 requestVirtualPayment / getSystemInfoSync 平台值是 'devtools'。
   */
  isDevtools() {
    try {
      if (wx.getDeviceInfo && wx.getDeviceInfo().platform === 'devtools') return true
      return wx.getSystemInfoSync().platform === 'devtools'
    } catch (e) {
      return false
    }
  },

  /**
   * 把微信虚拟支付的原始 errMsg 转成用户看得懂的文案。
   * 常见的几个码都跟「商户侧配置」有关，不是用户能解决的，必须明确指向下一步。
   */
  humanizePayError(rawMsg) {
    const msg = String(rawMsg || '')
    if (/cancel/i.test(msg)) return '已取消支付'
    // 道具已创建但未发布 / 未同步到微信支付（MP 后台发布后有 10~30 分钟同步延迟）
    if (/PRODUCT_ID_NOT_PUBLISH|not\s*publish/i.test(msg)) {
      return '支付通道同步中，请稍后再试'
    }
    // errno 4：Apple 侧拒绝。catch 里会优先走 showAppleRegionGuide，
    // 这里只做兜底（万一走到 toast 分支），文案保持与 modal 一致。
    if (/App\s*Store\s*暂无法完成充值/i.test(msg)) {
      return '暂不支持非中国大陆地区苹果账号支付'
    }
    // iOS 未开 IAP 开关 / 未配小程序简称
    if (/尚未开启\s*iOS支付|not\s*open\s*ios/i.test(msg)) {
      return '当前 iOS 支付暂不可用，请稍后再试'
    }
    // 单笔低于 1 元（iOS 硬性门槛）
    if (/低于最低|min.*amount|1\s*元/i.test(msg)) {
      return '支付金额低于平台最低限制'
    }
    // 商品不存在 / 已下架
    if (/PRODUCT_ID_NOT_EXIST|product\s*not\s*exist/i.test(msg)) {
      return '该套餐已下架，请选择其他套餐'
    }
    // 开发者未开通虚拟支付
    if (/NOT_ENABLE|未开通.*虚拟支付/i.test(msg)) {
      return '现金购买暂未开放，可先用辣度值兑换'
    }
    // 去掉前缀，只留核心错误
    return msg.replace(/^requestVirtualPayment:fail\s*/, '') || '支付失败'
  },

  /** iOS 微信版本 ≥ 8.0.68 */
  checkIosPayVersion() {
    try {
      const sys = wx.getSystemInfoSync()
      if (sys.platform !== 'ios') return true
      const cur = (sys.version || '').split('.').map(Number)
      const base = [8, 0, 68]
      for (let i = 0; i < 3; i++) {
        if ((cur[i] || 0) > base[i]) return true
        if ((cur[i] || 0) < base[i]) break
      }
      wx.showModal({
        title: '提示',
        content: '请将微信更新至最新版后再使用现金支付',
        showCancel: false
      })
      return false
    } catch (e) {
      return true
    }
  },

  /** 基础库 ≥ 2.19.2 */
  canUseVirtualPayment() {
    try {
      const sdk = (wx.getSystemInfoSync().SDKVersion || '0').split('.').map(Number)
      const base = [2, 19, 2]
      for (let i = 0; i < 3; i++) {
        if ((sdk[i] || 0) > base[i]) return true
        if ((sdk[i] || 0) < base[i]) return false
      }
      return true
    } catch (e) {
      return wx.canIUse && wx.canIUse('requestVirtualPayment')
    }
  }
})
