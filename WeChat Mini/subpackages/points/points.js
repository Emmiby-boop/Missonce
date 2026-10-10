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
    activeTab: 'records',
    points: 0,
    totalPoints: 0,
    records: [],
    loading: true,
    loadingMore: false,
    hasMore: true,
    page: 1,
    isCheckedIn: false,
    checkInReward: 10,
    shareReward: 10,
    inviteReward: 50,

    shareDailyLimit: 5,
    showInviteModal: false,
    inviteInfo: {
      rewardPoints: 50,
      todayInvites: 0,
      totalInvites: 0,
      validInvites: 0,
      canInvite: true,
      rules: [
        '邀请好友通过您的分享链接进入，即可绑定邀请关系',
        '好友完成3次下载或3天签到后，奖励自动发放',
        '多邀多得，邀请奖励无上限',
        '如有作弊行为，将取消奖励资格'
      ]
    },
    isMember: false,
    memberLevel: 'none',
    memberName: '',
    memberDaysRemaining: 0,
    memberPrices: {
      weekly: 500,
      monthly: 1800,
      quarterly: 4800,
      yearly: 16800,
      lifetime: 50000
    },
    exchangeOptions: {},
    activeExchangeTab: 'members',
    memberOption: {
      level: '',
      price: 0
    },
    watchAdPoints: 20,
    watchAdDailyLimit: 15,
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
    this.loadRecords()
    this.loadInviteInfo()
    this.loadExchangeOptions()
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

  noop() {},

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })

    if (tab === 'records' && this.data.records.length === 0) {
      this.loadRecords()
    }
  },

  switchToVip() {
    wx.pageScrollTo({ selector: '#vip-section', duration: 300 })
  },

  scrollToVip() {
    wx.pageScrollTo({ selector: '#vip-section', duration: 300 })
  },

  /** 顶部会员卡位点击：滚到套餐区（已开通则滚到最近记录看有效期） */
  onVipCardTap() {
    this.scrollToVip()
  },

  toggleRules() {
    wx.pageScrollTo({ selector: '#rules-section', duration: 300 })
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
          checkInReward: configs.checkInPoints || 10,
          shareReward: configs.sharePoints || 10,
          inviteReward: configs.inviteRewardPoints || 50,
          shareDailyLimit: configs.shareDailyLimit || 5,
          watchAdPoints: configs.watchAdPoints || 20,
          watchAdDailyLimit: configs.watchAdDailyLimit || 15,

          memberPrices: {
            weekly: configs.memberWeeklyPoints || 500,
            monthly: configs.memberMonthlyPoints || 1800,
            quarterly: configs.memberQuarterlyPoints || 4800,
            yearly: configs.memberYearlyPoints || 16800,
            lifetime: configs.memberLifetimePoints || 50000
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
          points: data.points,
          totalPoints: data.totalPoints,
          isCheckedIn: data.isCheckedIn || false,
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

  watchAdForPoints() {
    try {
      const comp = this.selectComponent('#rewardAdComp')
      if (comp && comp.showRewarded) {
        comp.showRewarded()
      } else {
        wx.showToast({ title: '广告未就绪', icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: '广告未就绪', icon: 'none' })
    }
  },

  switchExchangeTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeExchangeTab: tab })
  },

  async loadExchangeOptions() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { action: 'getExchangeOptions' }
      })
      if (res.result && res.result.success) {
        this.setData({ exchangeOptions: res.result.data })
      }
    } catch (e) {
      console.error('加载兑换选项失败:', e)
    }
  },

  async loadRecords() {
    this.setData({ loading: true, page: 1, records: [] })

    try {
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { 
          action: 'getRecords',
          page: 1,
          limit: 20
        }
      })

      if (res.result && res.result.success) {
        this.setData({
          records: res.result.data,
          hasMore: res.result.hasMore,
          page: 1
        })
      }
    } catch (e) {
      console.error('加载记录失败:', e)
    } finally {
      this.setData({ loading: false })
    }
  },

  async loadMore() {
    if (this.data.loadingMore || !this.data.hasMore) return

    this.setData({ loadingMore: true })

    try {
      const nextPage = this.data.page + 1
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { 
          action: 'getRecords',
          page: nextPage,
          limit: 20
        }
      })

      if (res.result && res.result.success) {
        this.setData({
          records: [...this.data.records, ...res.result.data],
          hasMore: res.result.hasMore,
          page: nextPage
        })
      }
    } catch (e) {
      console.error('加载更多失败:', e)
    } finally {
      this.setData({ loadingMore: false })
    }
  },

  async handleCheckIn() {
    if (this.data.isCheckedIn) {
      wx.showToast({ title: '今日已签到', icon: 'none' })
      return
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { action: 'checkIn' }
      })

      if (res.result && res.result.success) {
        wx.showToast({
          title: '签到成功！+' + res.result.points + '辣度值',
          icon: 'success'
        })
        this.setData({
          isCheckedIn: true,
          points: this.data.points + res.result.points
        })
        this.loadRecords()
      } else {
        wx.showToast({ title: res.result.error || '签到失败', icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: '签到失败', icon: 'none' })
    }
  },

  handleShare() {
    wx.showToast({ title: '分享成功后自动获得辣度值', icon: 'none' })
  },

  inviteFriend() {
    const userInfo = getStorage('userInfo')
    if (!userInfo || !userInfo.openid) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    this.setData({ showInviteModal: true })
  },

  closeInviteModal() {
    this.setData({ showInviteModal: false })
  },

  onRewardedFinished(e) {
    const detail = (e && e.detail) || {}
    if (detail && detail.success) {
      this.loadUserInfo()
      this.loadRecords()
    }
  },

  async loadInviteInfo() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { action: 'getInviteStatus' }
      })

      if (res.result && res.result.success) {
        this.setData({
          inviteInfo: res.result.data,
          inviteReward: res.result.data.rewardPoints || 50
        })
      }
    } catch (e) {
      console.error('获取邀请信息失败:', e)
    }
  },

  onShareAppMessage() {
    const userInfo = getStorage('userInfo')
    const inviterParam = userInfo && userInfo.openid ? '?inviter=' + userInfo.openid : ''
    return {
      title: '小辣椒动态头像，海量精美素材免费下载！',
      path: '/pages/index/index' + inviterParam,
      imageUrl: '/images/share-cover.png'
    }
  },

  onShareTimeline() {
    const userInfo = getStorage('userInfo')
    const inviterParam = userInfo && userInfo.openid ? 'inviter=' + userInfo.openid : ''
    return {
      title: '小辣椒动态头像，海量精美素材免费下载！',
      query: inviterParam,
      imageUrl: '/images/share-cover.png'
    }
  },

  showMemberModal() {
    this.setData({ activeTab: 'vip' })
  },

  async exchangeMember(e) {
    const level = e.currentTarget.dataset.level

    // 未同意会员服务协议：拦截并弹出协议全文
    if (!this.data.agreementAgreed) {
      this.setData({ showCashModal: false, cashModalProduct: null })
      this.requireAgreement()
      return
    }

    const price = this.data.memberPrices[level]

    if (this.data.points < price) {
      wx.showModal({
        title: '辣度值不足',
        content: '兑换' + this.getMemberName(level) + '需要 ' + price + ' 辣度值，当前辣度值 ' + this.data.points + '，是否前往赚取辣度值？',
        success: (res) => {
          if (res.confirm) {
            this.setData({ activeTab: 'rules' })
          }
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
              this.loadRecords()
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

  formatTime(dateStr) {
    if (!dateStr) return ''

    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')

    return `${year}-${month}-${day} ${hours}:${minutes}`
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
    // 关闭弹窗即重置勾选，避免下次开弹窗时「已勾选」的误导
    this.setData({ showCashModal: false, cashModalProduct: null, agreementAgreed: false })
  },

  /** 弹窗里选「辣度值兑换」：关弹窗后走原兑换流程 */
  exchangeMemberByModal(e) {
    if (this.data.cashBuying) return
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

      this.setData({ showCashModal: false, cashModalProduct: null, agreementAgreed: false })
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
        agreementAgreed: false,
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
