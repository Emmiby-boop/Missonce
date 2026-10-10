import { getStorage } from '../../utils/storageManager.js'

/**
 * 辣度值页（2026-10-10 新建，从会员中心拆分而来）
 *
 * ═══ 为什么要拆 ═══
 * 原「会员中心」一页承载了 8 类职责（会员卡位 / 套餐 / 支付 / 积分余额 / 签到 /
 * 赚积分 / 规则 / 流水）+ 3 个弹窗，wxml 470 行。用户反馈"功能太复杂"。
 *
 * 拆分依据是**用户想干什么**，不是「钱从哪来」：
 *   · 会员页（subpackages/points/points）→ 「我要买会员」：一个目标，付钱
 *   · 辣度值页（本页）→ 「我的积分」：一个目标，攒与花
 * 「现金 or 辣度值」是**支付方式**，不是商品维度，所以仍留在会员页的支付弹窗里二选一。
 *
 * ═══ 本页承接的内容 ═══
 *   余额卡 + 签到条 + 赚辣度值（分享/邀请/看视频）+ 兑换（含兑换会员）+ 流水 + 规则
 * 其中「兑换会员」与会员页的现金购买共用 userPoints.exchangeMember 云函数。
 *
 * ═══ 顺手修掉的既有问题 ═══
 * ① 分享奖励此前只挂在 pages/tools 的 onShareAppMessage，
 *    在会员中心/我的页分享拿不到辣度值但界面写着 +10 → 本页 onShareAppMessage 已接上。
 * ② 兑换选项（downloads 三档）云端已实现（getExchangeOptions / exchangeDownloads）
 *    但前端从未调用 → 本页已接线。
 */
/**
 * 计算签到进度圆点（7 天一循环）
 * 抽成独立方法而不是在 wxml 里写 checkInStreak % 7 —— 后者在连续 7/14/21 天时
 * 会出现 0 个圆点全亮、或该亮的没亮等边界错误。
 * @param {number} streak 连续签到天数
 * @param {boolean} checkedToday 今日是否已签
 * @returns {Array<number>} 长度 7，0=未达成 1=已完成 2=今天待签
 */
function buildCheckInDots(streak, checkedToday) {
  const done = Math.min(7, streak % 7)
  const fullCycle = streak > 0 && streak % 7 === 0// 刚好满7 的倍数
  const dots = [0, 0, 0, 0, 0, 0, 0]

  if (checkedToday) {
    // 今日已签：前 done 个实心；若是满周期的最后一天，7 个全实心
    if (fullCycle) return [1, 1, 1, 1, 1, 1, 1]
    for (let i = 0; i < done; i++) dots[i] = 1
    return dots
  }

  // 今日未签：done 个已实心，第 done 个（若<7）标记为「今天待签」
  for (let i = 0; i < done; i++) dots[i] = 1
  if (done < 7) dots[done] = 2
  return dots
}

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,

    // ── 余额 ──
    points: 0,
    totalPoints: 0,

    // ── 签到 ──
    isCheckedIn: false,
    checkInReward: 10,
    /** 连续签到天数（云端字段 checkInDays） */
    checkInStreak: 0,
    /**
     * 签到进度条的7 个圆点状态（派生数据，不在 wxml 里做取模）
     * 规则：已连续签到 N 天 → 前 N%7 个点亮；今日未签且刚好第 7 天整→ 7 个全亮
     * 值：0=未达成, 1=已完成, 2=今天待签
     */
    checkInDots: [0, 0, 0, 0, 0, 0, 0],

    // ── 赚辣度值 ──
    shareReward: 10,
    shareDailyLimit: 5,
    inviteReward: 25,
    watchAdPoints: 20,
    watchAdDailyLimit: 15,
    showInviteModal: false,
    inviteInfo: {
      rewardPoints: 25,
      todayInvites: 0,
      totalInvites: 0,
      validInvites: 0,
      canInvite: true,
      rules: []
    },

    // ── 兑换 ──
    /** 云端 getExchangeOptions 返回：{ members:[5], downloads:[3], downloadPoints } */
    exchangeOptions: null,
    /** 兑换弹窗选中项 { type:'member'|'download', level|key, price, title, desc } */
    exchangePick: null,
    exchanging: false,

    // ── 流水 ──
    records: [],
    loading: true,
    loadingMore: false,
    hasMore: true,
    page: 1,

    // ── 会员（兑换会员时展示当前状态）──
    isMember: false,
    memberPrices: {
      weekly: 400,
      monthly: 900,
      quarterly: 1800,
      yearly: 3500,
      lifetime: 5900
    },

    /** 是否为登录态（未登录时赚取入口需提示登录） */
    logged: false
  },

  onLoad(query) {
    try {
      const info = wx.getWindowInfo()
      this.setData({
        statusBarHeight: info.statusBarHeight || 20,
        navBarHeight: 44
      })
    } catch (e) {
      this.setData({ navBarHeight: 44 })
    }

    this.loadConfigs()
    this.loadUserInfo()
    this.loadRecords()
    this.loadInviteInfo()
    this.loadExchangeOptions()

    // 从会员页「辣度值不足 → 去赚取」跳进来时，直接滚到赚取分区
    if (query && query.focus === 'earn') {
      setTimeout(() => this.scrollToEarn(), 400)
    }
  },

  onShow() {
    this.loadUserInfo()
    // 从会员页跳来时可能刚兑换过，刷新兑换选项
    if (this.data.exchangePick) this.loadExchangeOptions()
  },

  goBack() {
    wx.navigateBack({
      fail: () => wx.switchTab({ url: '/pages/index/index' })
    })
  },

  noop() {},

  scrollToEarn() {
    wx.pageScrollTo({ selector: '#earn-section', duration: 300 })
  },

  scrollToExchange() {
    wx.pageScrollTo({ selector: '#exchange-section', duration: 300 })
  },

  /** 导航栏「?」→ 滚到规则区（规则常驻展示在页面底部，不需要折叠开关） */
  toggleRules() {
    wx.pageScrollTo({ selector: '#spicy-rules', duration: 300 })
  },

  // ═══════════ 数据加载 ═══════════

  async loadConfigs() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { action: 'getConfigs' }
      })
      const configs = res.result && res.result.data
      if (!configs) return

      this.setData({
        checkInReward: configs.checkInPoints || 10,
        shareReward: configs.sharePoints || 10,
        // 兜底必须与云端 shared.js 的 inviteRewardPoints 一致（25）
        inviteReward: configs.inviteRewardPoints || 25,
        shareDailyLimit: configs.shareDailyLimit || 5,
        watchAdPoints: configs.watchAdPoints || 20,
        watchAdDailyLimit: configs.watchAdDailyLimit || 15,
        memberPrices: {
          weekly: configs.memberWeeklyPoints || 400,
          monthly: configs.memberMonthlyPoints || 900,
          quarterly: configs.memberQuarterlyPoints || 1800,
          yearly: configs.memberYearlyPoints || 3500,
          lifetime: configs.memberLifetimePoints || 5900
        }
      })
    } catch (e) {
      console.error('[辣度值] 加载配置失败:', e)
    }
  },

  async loadUserInfo() {
    const userInfo = getStorage('userInfo')
    this.setData({ logged: !!(userInfo && userInfo.openid) })

    try {
      const [infoRes, memberRes] = await Promise.all([
        wx.cloud.callFunction({ name: 'userPoints', data: { action: 'getUserInfo' } }),
        wx.cloud.callFunction({ name: 'userPoints', data: { action: 'getMemberStatus' } })
      ])

      if (infoRes.result && infoRes.result.success && infoRes.result.data) {
        const d = infoRes.result.data
        const isCheckedIn = !!d.isCheckedIn
        const checkInStreak = d.checkInDays || 0
        this.setData({
          points: d.points || 0,
          totalPoints: d.totalPoints || 0,
          isCheckedIn,
          checkInStreak,
          checkInDots: buildCheckInDots(checkInStreak, isCheckedIn)
        })
      }

      if (memberRes.result && memberRes.result.success && memberRes.result.data) {
        this.setData({ isMember: !!memberRes.result.data.isMember })
      }
    } catch (e) {
      console.error('[辣度值] 加载用户信息失败:', e)
    }
  },

  /**
   * 流水记录
   * ⚠️ 云端返回结构：{ success, data: [...数组本身...], hasMore }
   *    —— data 直接是数组，没有 list/records/total 外层，别按常规分页结构解析。
   *    参数用 limit（原 points.js 传的 pageSize 云端不认，会退回默认 20）。
   * ⚠️ createdAt 云端存 new Date()，序列化到前端是 ISO 字符串。
   *    WXML 绑定里调不了 Page 方法（{{formatTime(x)}} 渲染为空），
   *    所以在这里预格式化成 timeText，wxml 直接展示派生字段。
   */
  async loadRecords(page = 1) {
    if (page === 1) this.setData({ loading: true, records: [], page: 1 })

    try {
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { action: 'getRecords', page, limit: 20 }
      })

      if (res.result && res.result.success) {
        const raw = Array.isArray(res.result.data) ? res.result.data : []
        const list = raw.map(r => ({ ...r, timeText: this.formatTime(r.createdAt) }))
        const records = page === 1 ? list : this.data.records.concat(list)
        this.setData({
          records,
          page,
          hasMore: res.result.hasMore !== false && list.length > 0,
          loading: false
        })
      } else {
        this.setData({ loading: false, hasMore: false })
      }
    } catch (e) {
      console.error('[辣度值] 加载记录失败:', e)
      this.setData({ loading: false })
    }
  },

  loadMore() {
    if (this.data.loadingMore || !this.data.hasMore) return
    this.setData({ loadingMore: true })
    this.loadRecords(this.data.page + 1).then(() => this.setData({ loadingMore: false }))
  },

  async loadInviteInfo() {
    if (!this.data.logged) return
    try {
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { action: 'getInviteStatus' }
      })
      if (res.result && res.result.success) {
        this.setData({
          inviteInfo: res.result.data,
          // 兜底 25，与云端一致，避免数字跳变
          inviteReward: res.result.data.rewardPoints || 25
        })
      }
    } catch (e) {
      console.error('[辣度值] 获取邀请信息失败:', e)
    }
  },

  /**
   * 兑换选项 —— 云端已实现（downloads 三档），但原会员中心加载后从不渲染，
   * 本页首次真正把它接上线。
   */
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
      console.error('[辣度值] 加载兑换选项失败:', e)
    }
  },

  // ═══════════ 签到 ═══════════

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
      if (res.result && res.result.success && res.result.data) {
        const d = res.result.data
        const streak = d.checkInDays || (this.data.checkInStreak + 1)
        // 云端返回 totalReward（含连续签到额外奖励），字段 checkInDays
        wx.showToast({
          title: '+' + (d.totalReward || this.data.checkInReward) + ' 辣度值',
          icon: 'success'
        })
        this.setData({
          points: d.points != null ? d.points : this.data.points,
          totalPoints: d.totalPoints != null ? d.totalPoints : this.data.totalPoints,
          isCheckedIn: true,
          checkInStreak: streak,
          checkInDots: buildCheckInDots(streak, true)
        })
        this.loadRecords()
      } else {
        wx.showToast({
          title: (res.result && (res.result.error || res.result.msg)) || '签到失败',
          icon: 'none'
        })
      }
    } catch (e) {
      console.error('[辣度值] 签到失败:', e)
      wx.showToast({ title: '签到失败，请重试', icon: 'none' })
    }
  },

  // ═══════════ 赚辣度值 ═══════════

  watchAdForPoints() {
    const comp = this.selectComponent('#rewardAdComp')
    if (comp && comp.showRewarded) {
      comp.showRewarded()
    } else {
      wx.showToast({ title: '广告加载中，请稍候', icon: 'none' })
    }
  },

  /**
 * 激励视频看完后的回调
 * ⚠️ 云端rewardAdWatch 的错误字段是 error，且不保证返回 points ——
 *    所以统一走一次 getUserInfo 拉权威余额，不猜增量。
 */
  async onRewardedFinished() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { action: 'getUserInfo' }
      })
      if (res.result && res.result.success && res.result.data) {
        const before = this.data.points
        const after = res.result.data.points || 0
        this.setData({
          points: after,
          totalPoints: res.result.data.totalPoints || 0
        })
        const gained = after - before
        if (gained > 0) {
          wx.showToast({ title: '+' + gained + ' 辣度值', icon: 'success' })
        } else {
          wx.showToast({ title: '今日观看次数已达上限', icon: 'none' })
        }
      }
      this.loadRecords()
    } catch (e) {
      console.error('[辣度值] 刷新积分失败:', e)
    }
  },

  inviteFriend() {
    if (!this.data.logged) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    this.setData({ showInviteModal: true })
  },

  closeInviteModal() {
    this.setData({ showInviteModal: false })
  },

  // ═══════════ 兑换 ═══════════

  /** 选兑换项 → 弹确认弹窗 */
  onPickExchange(e) {
    const type = e.currentTarget.dataset.type // 'member' | 'download'
    const key = e.currentTarget.dataset.key

    if (this.data.points <= 0) {
      wx.showToast({ title: '还没有辣度值，先去赚一些吧', icon: 'none' })
      return
    }

    let pick
    if (type === 'member') {
      const names = { weekly: '周卡会员', monthly: '月卡会员', quarterly: '季卡会员', yearly: '年卡会员', lifetime: '终身会员' }
      // 优先用云端返回的 members 配置（points 字段），兜底用本地 memberPrices
      const opt = (this.data.exchangeOptions && this.data.exchangeOptions.members || [])
        .find(m => m.level === key)
      const price = opt ? opt.points : this.data.memberPrices[key]
      if (!price) return
      pick = {
        type: 'member',
        level: key,
        price,
        title: (opt && opt.name) || names[key] || key,
        desc: opt && opt.days ? ('有效期 ' + opt.days + ' 天，兑换后立即生效') : '兑换后立即生效'
      }
    } else {
      // ⚠️ 云端 downloads 字段名是 points / count（数字），不是 price
      const item = (this.data.exchangeOptions && this.data.exchangeOptions.downloads || [])
        .find(d => String(d.count) === String(key))
      if (!item) return
      const price = item.points
      pick = {
        type: 'download',
        key: item.count,
        price,
        title: item.name || (item.count + ' 次下载'),
        desc: item.bonus ? ('兑换后可在下载时抵扣，' + item.bonus) : '兑换后可在下载时抵扣'
      }
    }

    if (this.data.points < pick.price) {
      wx.showModal({
        title: '辣度值不足',
        content: '需要 ' + pick.price + ' 辣度值，当前 ' + this.data.points + '。是否前往赚取？',
        success: (res) => { if (res.confirm) this.scrollToEarn() }
      })
      return
    }

    this.setData({ exchangePick: pick })
  },

  closeExchange() {
    if (this.data.exchanging) return
    this.setData({ exchangePick: null })
  },

  async confirmExchange() {
    const pick = this.data.exchangePick
    if (!pick || this.data.exchanging) return

    const isMember = pick.type === 'member'
    wx.showModal({
      title: '确认兑换',
      content: isMember
        ? '确定用 ' + pick.price + ' 辣度值兑换' + pick.title + '？'
        : '确定用 ' + pick.price + ' 辣度值兑换' + pick.title + '？',
      success: async (res) => {
        if (!res.confirm) return
        this.setData({ exchanging: true, exchangePick: null })

        try {
          const payload = isMember
            ? { action: 'exchangeMember', level: pick.level }
            : { action: 'exchangeDownloads', count: pick.key }

          const result = await wx.cloud.callFunction({ name: 'userPoints', data: payload })
          const r = result.result || {}

          if (r.success) {
            wx.showToast({ title: '兑换成功', icon: 'success' })
            const d = r.data || {}
            if (d.points != null) this.setData({ points: d.points })
            this.loadUserInfo()
            this.loadRecords()
          } else {
            // ⚠️ 云端错误信息字段是 error，不是 msg
            wx.showToast({ title: r.error || '兑换失败', icon: 'none' })
          }
        } catch (e) {
          console.error('[辣度值] 兑换失败:', e)
          wx.showToast({ title: '兑换失败，请重试', icon: 'none' })
        } finally {
          this.setData({ exchanging: false })
        }
      }
    })
  },

  // ═══════════ 分享 ═══════════

  onShareAppMessage() {
    // 分享奖励发放（此前只有 pages/tools 接了，导致其他页分享拿不到积分）
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

  formatTime(ts) {
    if (!ts) return ''
    const d = new Date(ts)
    const now = new Date()
    const pad = (n) => (n < 10 ? '0' + n : '' + n)
    const date = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    const time = pad(d.getHours()) + ':' + pad(d.getMinutes())
    // 同年不显示年份
    return d.getFullYear() === now.getFullYear() ? date + ' ' + time : date
  },

  onReachBottom() {
    this.loadMore()
  }
})