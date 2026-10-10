const { getWindowInfo } = require('../../utils/storageManager.js')
const { MEMBER_AGREEMENT, AGREEMENT_META } = require('../points/agreementContent.js')

/**
 * 会员服务协议 · 独立整页
 *
 * 为什么从「支付弹窗内的 78vh 抽屉」改为独立页面（2026-10-10）：
 *  1) 显示问题修复：抽屉弹窗在部分机型上正文左右溢出 / 被截断，且可用高度不足，正文冗长时阅读体验差；
 *  2) 独立整页可给出完整的「更新时间 / 生效日期 / 章节编号 / 底部同意按钮」，更贴合合规审查对「协议可完整查阅」的要求；
 *  3) 协议正文与支付流程解耦，用户可在任意入口（会员中心 / 我的 / 支付弹窗）跳转到同一份文本，不会出现多版本不一致。
 *
 * 交互约定：从「支付弹窗」进入时（url 带 from=pay），底部按钮为「同意并返回」，
 * 返回后通过 getOpenerEventChannel 通知来源页把协议勾选为已同意，避免用户二次勾选。
 */
Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    meta: AGREEMENT_META,
    sections: MEMBER_AGREEMENT,
    /** 是否来自支付流程（决定底部按钮文案与是否回传同意状态） */
    fromPay: false,
    /** 用户是否已勾选过同意（从来源页带过来，用于按钮态） */
    preAgreed: false,
    agreed: false,
    /** 阅读进度百分比（导航栏下的进度条） */
    progress: 0
  },

  onLoad(query) {
    const sysInfo = getWindowInfo()
    const fromPay = query && query.from === 'pay'
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 20,
      navBarHeight: 44,
      fromPay,
      preAgreed: !!(query && query.agreed === '1'),
      agreed: !!(query && query.agreed === '1')
    })
  },

  onBack() {
    wx.navigateBack({
      fail: () => wx.switchTab({ url: '/pages/index/index' })
    })
  },

  /** 滚动阅读进度（用于顶部进度条，让用户知道全文很长） */
  onScroll(e) {
    const { scrollTop, scrollHeight, deltaY } = e.detail
    // deltaY 仅在 enhanced 下才有
    const h = scrollHeight - this._viewportHeight
    if (!h || h <= 0) return
    const progress = Math.min(100, Math.max(0, Math.round((scrollTop / h) * 100)))
    if (progress !== this._progress) {
      this._progress = progress
      this.setData({ progress })
    }
  },

  onReady() {
    wx.createSelectorQuery()
      .select('#ag-scroll')
      .boundingClientRect(rect => {
        if (rect) this._viewportHeight = rect.height
      })
      .exec()
  },

  /** 「我已阅读并同意」：勾选 → 回传来源页 → 返回 */
  onAgree() {
    if (this.data.agreed) {
      this.onBack()
      return
    }
    this.setData({ agreed: true })

    if (this.data.fromPay) {
      // 双通道回传，保证「同意」状态一定不丢：
      // ① EventChannel 立即生效（打开方在 wx.navigateTo 的 events 里注册回调）；
      // ② 写 storage 时间戳兜底，来源页 onShow 时复查（防 EventChannel 未注册/被回收）。
      try {
        wx.setStorageSync('memberAgreementAcceptedAt', Date.now())
      } catch (e) { /* storage 失败不阻塞返回 */ }
      try {
        const ch = this.getOpenerEventChannel && this.getOpenerEventChannel()
        if (ch && ch.emit) ch.emit('agreementAccepted')
      } catch (e) { /* 走 ② 兜底 */ }
    }

    setTimeout(() => this.onBack(), 350)
  },

  onShareAppMessage() {
    return {
      title: '小辣椒动态头像，会员服务协议',
      path: '/subpackages/agreement/agreement'
    }
  }
})