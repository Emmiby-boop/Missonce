import { getStorage } from '../../utils/storageManager.js'

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
    cashFirstPurchase: false,
    showStrike: false,
    cashWeeklyOldYuan: '',
    cashMonthlyOldYuan: '',
    cashQuarterlyOldYuan: '',
    cashYearlyOldYuan: '',
    cashLifetimeOldYuan: '',
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
          memberLevel: member.level || 'none',
          memberDaysRemaining: member.daysRemaining || 0,
          memberName: this.getMemberName(member.level)
        })
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
      title: '小辣椒动态头像壁纸，海量精美素材免费下载！',
      path: '/pages/index/index' + inviterParam,
      imageUrl: '/images/share-cover.png'
    }
  },

  onShareTimeline() {
    const userInfo = getStorage('userInfo')
    const inviterParam = userInfo && userInfo.openid ? 'inviter=' + userInfo.openid : ''
    return {
      title: '小辣椒动态头像壁纸，海量精美素材免费下载！',
      query: inviterParam,
      imageUrl: '/images/share-cover.png'
    }
  },

  showMemberModal() {
    this.setData({ activeTab: 'vip' })
  },

  async exchangeMember(e) {
    const level = e.currentTarget.dataset.level
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

  // ═══════════ 虚拟支付：现金购买会员 ═══════════

  /** 识别是否 iOS：iOS 端隐藏划线原价，只展示首购到手价 */
  initPlatform() {
    let isIOS = false
    try {
      const info = typeof wx.getDeviceInfo === 'function'
        ? wx.getDeviceInfo()
        : wx.getSystemInfoSync()
      isIOS = String(info.platform || info.system || '').toLowerCase().indexOf('ios') >= 0
    } catch (e) {
      isIOS = false
    }
    this.setData({ isIOS })
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

        this.setData({
          cashProducts: products,
          showStrike,
          cashFirstPurchase: isFirst,
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
    this.setData({ showCashModal: false, cashModalProduct: null })
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
      await new Promise((resolve, reject) => {
        wx.requestVirtualPayment({
          signData: payData.signData,
          paySig: payData.paySig,
          signature: payData.signature,
          mode: payData.mode,
          success: resolve,
          fail: (err) => {
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
      const msg = (e && e.message) || '支付失败'
      wx.showToast({ title: msg.indexOf('cancel') > -1 ? '已取消支付' : msg, icon: 'none' })
    } finally {
      this.setData({ cashBuying: false })
    }
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
