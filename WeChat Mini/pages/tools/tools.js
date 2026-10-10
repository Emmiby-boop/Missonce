import { getWindowInfo, getTheme, getStorage, setStorage } from '../../utils/storageManager'
import { performanceMonitor } from '../../utils/performance'
import { checkLoginStatus } from '../../utils/auth'
import { hapticSelect, hapticTap } from '../../utils/haptic'

// 🔥 签到信息缓存 key（5 分钟节流，避免每次切到工具页都调 userPoints 云函数）
const CHECKIN_CACHE_KEY = 'tools_checkin_cache'
const CHECKIN_CACHE_TTL = 5 * 60 * 1000

// 🔥 工具箱配置缓存 key（10 分钟缓存，与后台配置同步）
const TOOLS_CONFIG_CACHE_KEY = 'tools_config_cache'
const TOOLS_CONFIG_CACHE_TTL = 10 * 60 * 1000

// 🔥 默认工具列表（后台未配置或网络失败时降级使用）
// 布局约定：sort 最小的一项若为 primary 绿色 → 渲染为整行主推大卡；
//           其余 square = 半宽方卡（两列），wide = 整行宽卡；
//           辣度值（id=points / linkUrl=/subpackages/points/points）固定为数据卡。
const DEFAULT_TOOLS = [
  { id: 'avatar-diy', title: '头像DIY', desc: '加边框·调滤镜·写字，30秒出图', icon: '/images/tool-diy.svg', linkType: 'page', linkUrl: '/subpackages/avatar-diy/avatar-diy', size: 'square', color: 'primary', visible: true, sort: 0 },
  { id: 'watermark', title: '去水印', desc: '视频/图片', icon: '/images/tool-watermark.svg', linkType: 'miniProgram', linkUrl: 'wxbd304fe2186156e4', miniProgramPath: '', size: 'square', color: 'secondary', visible: true, sort: 1 },
  { id: 'inspiration', title: '灵感文案', desc: 'AI 帮你写', icon: '/images/quick-inspiration.svg', linkType: 'page', linkUrl: '/subpackages/inspiration-writer/inspiration-writer', size: 'square', color: 'tertiary', visible: true, sort: 2 },
  { id: 'points', title: '辣度值', desc: '查看辣度值·兑换好物', icon: '/images/icon-diamond.svg', linkType: 'page', linkUrl: '/subpackages/points/points', size: 'wide', color: 'quaternary', visible: true, sort: 3 }
]

// 辣度值中心判定（与后台配置的 id / linkUrl 对齐）
const POINTS_TOOL_IDS = ['points', 'tool_points']
const POINTS_TOOL_PATH = '/subpackages/points/points'
const STREAK_CYCLE = 7

// 千分位格式化（1,280）
function formatThousands(n) {
  const num = Number(n) || 0
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// 当天标识：签到状态必须按天失效，避免 23:58 打开、00:01 再打开时
// 命中 5 分钟缓存仍显示「今日已签到」，导致新一天签不了到
function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

Page({
  // 点击底部 tabBar 时的轻震反馈（onTabItemTap 基础库 1.9.0+，点击当前 tab 同样触发）
  onTabItemTap() {
    hapticSelect()
  },

  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    // 签到 + 积分
    isLoggedIn: false,
    isCheckedIn: false,
    checkInDays: 0,
    points: 0,
    // 签到卡片展示态
    checkInReward: 10,
    checkInPercent: 0,
    progressTitle: '开始你的连续签到',
    progressSub: '连续 7 天领专属好礼',
    pointsText: '0',
    // 工具列表（从后台配置加载，降级到 DEFAULT_TOOLS）
    toolsList: [],
    toolsCount: 0
  },

  onLoad() {
    performanceMonitor.startPageLoad('工具页')
    const info = getWindowInfo()
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      navBarHeight: 44
    })
    // 🔥 优先用缓存渲染工具列表（秒开），再后台静默刷新
    this._loadToolsConfig()
    performanceMonitor.endPageLoad('工具页')
  },

  onShow() {
    this._isHiding = false
    getApp().logEvent('pv', { page: 'tools' })
    this.syncTheme()
    this.refreshLoginAndCheckIn()
    // 🔥 工具配置静默刷新（检查后台是否有更新，不阻塞 UI）
    this._refreshToolsConfigInBackground()
    // 延迟触发插屏广告，不阻塞页面切换
    setTimeout(() => {
      // 🔥 已离开本页（onHide）就不再触发插屏广告，避免广告弹在其他页面
      if (this._isHiding) return
      try {
        const _mod = require('../../utils/interstitialAdManager.js')
        const interstitialAdManager = _mod.default || _mod
        interstitialAdManager.smartTriggerInterstitialAd(2000)
      } catch (e) {
        console.warn('[tools] 加载插屏广告管理器失败，降级处理:', e)
      }
    }, 500)
  },

  onHide() {
    this._isHiding = true
  },

  syncTheme() {
    const theme = getTheme()
    this.setData({ theme })
  },

  // ===== 工具箱配置加载 =====
  // L1 内存缓存 → L2 storage 缓存 → 网络 → 降级默认
  _loadToolsConfig() {
    // L1：先尝试 storage 缓存（同步，秒开）
    const cached = getStorage(TOOLS_CONFIG_CACHE_KEY)
    if (cached && cached.tools && (Date.now() - cached.timestamp < TOOLS_CONFIG_CACHE_TTL)) {
      this._applyToolsList(cached.tools)
      return
    }

    // 无缓存：先用默认列表把工具区铺满（避免首屏空白），网络回来后再覆盖为线上配置
    this._applyToolsList(DEFAULT_TOOLS.filter(t => t.visible !== false))

    // L2：网络加载
    this._fetchToolsConfig()
  },

  // 后台静默刷新工具配置（onShow 触发，不显示 loading）
  async _refreshToolsConfigInBackground() {
    // 10 分钟内不重复刷新
    const cached = getStorage(TOOLS_CONFIG_CACHE_KEY)
    if (cached && (Date.now() - cached.timestamp < TOOLS_CONFIG_CACHE_TTL)) {
      return
    }
    this._fetchToolsConfig()
  },

  async _fetchToolsConfig() {
    let useDefault = true
    try {
      const res = await wx.cloud.callFunction({
        name: 'getConfig',
        data: { key: 'toolsConfig' }
      })
      if (res.result && res.result.success && res.result.data && res.result.data.value) {
        const tools = res.result.data.value.tools
        if (Array.isArray(tools) && tools.length > 0) {
          // 按 sort 排序，过滤不可见
          const sorted = tools
            .filter(t => t.visible !== false)
            .sort((a, b) => (a.sort || 0) - (b.sort || 0))
          if (sorted.length > 0) {
            this._applyToolsList(sorted)
            // 写入缓存
            setStorage(TOOLS_CONFIG_CACHE_KEY, {
              tools: sorted,
              timestamp: Date.now()
            })
            useDefault = false
          }
        }
      }
    } catch (e) {
      console.warn('[tools] 加载工具配置失败，使用默认配置:', e)
    }
    // 🔥 兜底：云函数失败 / 配置为空 / 全部隐藏 → 用默认配置
    if (useDefault && this.data.toolsList.length === 0) {
      this._applyToolsList(DEFAULT_TOOLS.filter(t => t.visible !== false))
    }
  },

  // 应用工具列表到 data，并按后台配置推导每个工具的排版形态
  // variant: featured（整行主推大卡）/ stat（辣度值数据卡）/ wide（整行宽卡）/ square（半宽方卡）
  _applyToolsList(tools) {
    const list = (tools || []).map((t, index) => {
      const isPoints = POINTS_TOOL_IDS.indexOf(t.id) > -1 || t.linkUrl === POINTS_TOOL_PATH

      let variant
      if (isPoints) {
        variant = 'stat'
      } else if (t.size === 'wide') {
        variant = 'wide'
      } else {
        // 列表首项且为品牌绿 → 升级为整行主推大卡（与设计稿一致，不依赖后台额外配置）
        variant = (index === 0 && t.color === 'primary') ? 'featured' : 'square'
      }

      return {
        ...t,
        variant,
        initial: (t.title || '工').slice(0, 1)
      }
    })

    // 半宽方卡两列排布：若某一段连续方卡为奇数个，把最后一个升级为整行，避免右侧留空
    let runStart = -1
    const flushRun = (endExclusive) => {
      if (runStart < 0) return
      if ((endExclusive - runStart) % 2 === 1) {
        list[endExclusive - 1].variant = 'wide'
      }
      runStart = -1
    }
    for (let i = 0; i < list.length; i++) {
      if (list[i].variant === 'square') {
        if (runStart < 0) runStart = i
      } else {
        flushRun(i)
      }
    }
    flushRun(list.length)

    this.setData({ toolsList: list, toolsCount: list.length })
  },

  // ===== 签到 + 积分 =====
  refreshLoginAndCheckIn() {
    const isLoggedIn = checkLoginStatus()
    this.setData({ isLoggedIn })
    if (isLoggedIn) {
      this.checkTodayCheckIn()
    } else {
      this._syncCheckInView({
        isCheckedIn: false,
        checkInDays: 0,
        points: 0
      })
    }
  },

  // 统一收敛签到卡片的展示数据（进度环 / 文案 / 辣度值格式化）
  _syncCheckInView({ isCheckedIn, checkInDays, points }) {
    const days = Number(checkInDays) || 0
    const pct = Math.max(0, Math.min(100, Math.round((days / STREAK_CYCLE) * 100)))

    let progressTitle
    let progressSub
    if (!this.data.isLoggedIn) {
      progressTitle = '登录后开始签到'
      progressSub = '每天签到都能领取辣度值'
    } else if (isCheckedIn) {
      progressTitle = `已连续签到 ${days} 天`
      progressSub = '明天记得再来，连续签到不断档'
    } else if (days <= 0) {
      progressTitle = '开始你的连续签到'
      progressSub = `连续 ${STREAK_CYCLE} 天解锁专属头像框`
    } else if (days < STREAK_CYCLE) {
      progressTitle = `连续签到 ${days} 天`
      progressSub = `再签 ${STREAK_CYCLE - days} 天解锁专属头像框`
    } else {
      progressTitle = `连续签到 ${days} 天`
      progressSub = '继续签到累积更多辣度值'
    }

    this.setData({
      isCheckedIn: !!isCheckedIn,
      checkInDays: days,
      points: Number(points) || 0,
      checkInPercent: pct,
      progressTitle,
      progressSub,
      pointsText: formatThousands(points)
    })
  },

  async checkTodayCheckIn() {
    // 🔥 5 分钟节流：优先用本地缓存，避免每次切页都调 userPoints 云函数
    const cached = getStorage(CHECKIN_CACHE_KEY)
    const sameDay = cached && cached.date === todayKey()
    if (sameDay && (Date.now() - cached.timestamp < CHECKIN_CACHE_TTL)) {
      const data = cached.data
      this._syncCheckInView(data)
      // 后台静默刷新（不阻塞 UI）
      this._refreshCheckInBackground()
      return
    }

    // 无缓存或已过期：走网络
    try {
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { action: 'getUserInfo' }
      })
      if (res.result.success) {
        const data = res.result.data
        this._syncCheckInView(data)
        // 写入缓存
        setStorage(CHECKIN_CACHE_KEY, { data, timestamp: Date.now(), date: todayKey() })
      }
    } catch (e) {
      console.error('获取签到信息失败:', e)
    }
  },

  // 后台静默刷新签到信息（不显示 loading，失败静默）
  async _refreshCheckInBackground() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { action: 'getUserInfo' }
      })
      if (res.result.success) {
        const data = res.result.data
        this._syncCheckInView(data)
        setStorage(CHECKIN_CACHE_KEY, { data, timestamp: Date.now(), date: todayKey() })
      }
    } catch (e) {
      // 静默失败，保留缓存数据
    }
  },

  async handleCheckIn() {
    if (!this.data.isLoggedIn) {
      wx.navigateTo({ url: '/subpackages/login/login' })
      return
    }
    if (this.data.isCheckedIn) return

    wx.showLoading({ title: '签到中...', mask: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { action: 'checkIn' }
      })
      wx.hideLoading()

      if (res.result.success) {
        const data = res.result.data
        this._syncCheckInView({
          isCheckedIn: true,
          checkInDays: data.checkInDays,
          points: data.points
        })
        // 🔥 签到成功后更新缓存
        setStorage(CHECKIN_CACHE_KEY, {
          data: { isCheckedIn: true, checkInDays: data.checkInDays, points: data.points },
          timestamp: Date.now(),
          date: todayKey()
        })
        // 🔥 兜底：云函数没返回奖励字段时不要显示 "+undefined"
        const baseReward = Number(data.pointsReward) || this.data.checkInReward
        let message = `签到成功 +${baseReward}辣度值`
        if (Number(data.bonusPoints) > 0) {
          const total = Number(data.totalReward) || (baseReward + Number(data.bonusPoints))
          message = `连续${data.checkInDays}天！+${total}辣度值`
        }
        wx.showToast({ title: message, icon: 'success', duration: 2000 })
      } else {
        wx.showToast({ title: res.result.error || '签到失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      console.error('签到失败:', e)
      wx.showToast({ title: '签到失败', icon: 'none' })
    }
  },

  // ===== 工具入口统一跳转 =====
  onToolTap(e) {
    hapticTap()  // 触感反馈：点击工具项
    const tool = e.currentTarget.dataset.tool
    if (!tool) return

    const { linkType, linkUrl, miniProgramPath, title } = tool

    // 🔥 兜底：后台新增项漏配 linkUrl / linkType 时不要「点了没反应」
    if (!linkUrl) {
      wx.showToast({ title: '该工具暂未开放', icon: 'none' })
      return
    }

    if (linkType === 'page') {
      // 内部页面
      wx.navigateTo({
        url: linkUrl,
        fail: (err) => {
          // tabBar 页面不能用 navigateTo，降级 switchTab（常见于后台把首页/专题页配成工具入口）
          wx.switchTab({
            url: linkUrl,
            fail: () => {
              console.error('[tools] 跳转失败:', err)
              wx.showToast({ title: '页面不存在', icon: 'none' })
            }
          })
        }
      })
    } else if (linkType === 'miniProgram') {
      // 外部小程序
      wx.navigateToMiniProgram({
        appId: linkUrl,  // linkUrl 存的是 appId
        path: miniProgramPath || '',
        extraData: { source: 'avatar_app' },
        envVersion: 'release',
        success(res) {
          console.log('[tools] 跳转小程序成功:', title)
        },
        fail(err) {
          console.error('[tools] 跳转小程序失败:', err)
          wx.showToast({ title: '跳转失败，请重试', icon: 'none' })
        }
      })
    } else if (linkType === 'webview') {
      // 网页链接
      const encodedUrl = encodeURIComponent(linkUrl)
      wx.navigateTo({
        url: `/subpackages/webview/webview?url=${encodedUrl}&title=${encodeURIComponent(title || '')}`,
        fail: (err) => {
          console.error('[tools] 跳转 webview 失败:', err)
          // 降级：如果没有 webview 分包，用 wx.openWebView 或提示
          wx.showToast({ title: '网页打开失败', icon: 'none' })
        }
      })
    } else {
      // 未知/未配置的 linkType
      console.warn('[tools] 未支持的 linkType:', linkType, tool)
      wx.showToast({ title: '该工具暂未开放', icon: 'none' })
    }
  },

  noop() {},

  onShareAppMessage() {
    const { recordShareReward } = require('../../utils/shareReward.js')
    setTimeout(() => recordShareReward(), 500)
    return {
      title: '小辣椒动态头像 | 海量精美素材免费下载',
      path: '/pages/tools/tools',
      imageUrl: '/images/share-cover.png'
    }
  },

  onShareTimeline() {
    return {
      title: '小辣椒动态头像 | 海量精美素材免费下载',
      query: '',
      imageUrl: '/images/share-cover.png'
    }
  }
})
