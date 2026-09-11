import { getWindowInfo, getTheme, getStorage, setStorage } from '../../utils/storageManager'
import { performanceMonitor } from '../../utils/performance'
import { checkLoginStatus } from '../../utils/auth'

// 🔥 签到信息缓存 key（5 分钟节流，避免每次切到工具页都调 userPoints 云函数）
const CHECKIN_CACHE_KEY = 'tools_checkin_cache'
const CHECKIN_CACHE_TTL = 5 * 60 * 1000

// 🔥 工具箱配置缓存 key（10 分钟缓存，与后台配置同步）
const TOOLS_CONFIG_CACHE_KEY = 'tools_config_cache'
const TOOLS_CONFIG_CACHE_TTL = 10 * 60 * 1000

// 🔥 默认工具列表（后台未配置或网络失败时降级使用）
const DEFAULT_TOOLS = [
  { id: 'avatar-diy', title: '头像DIY', desc: '边框/滤镜/文字', icon: '/images/tool-diy.svg', linkType: 'page', linkUrl: '/subpackages/avatar-diy/avatar-diy', size: 'square', color: 'primary', visible: true, sort: 0 },
  { id: 'watermark', title: '去水印', desc: '视频/图片一键去除', icon: '/images/tool-watermark.svg', linkType: 'miniProgram', linkUrl: 'wxbd304fe2186156e4', miniProgramPath: '', size: 'square', color: 'secondary', visible: true, sort: 1 },
  { id: 'inspiration', title: '灵感文案', desc: '激发创作火花', icon: '/images/quick-inspiration.svg', linkType: 'page', linkUrl: '/subpackages/inspiration-writer/inspiration-writer', size: 'wide', color: 'tertiary', visible: true, sort: 2 },
  { id: 'points', title: '辣度值', desc: '查看辣度值·兑换好物', icon: '/images/icon-diamond.svg', linkType: 'page', linkUrl: '/subpackages/points/points', size: 'wide', color: 'quaternary', visible: true, sort: 3 }
]

// 🔥 预设图标列表（后台配置时可选，路径相对于小程序根目录）
const PRESET_ICONS = [
  { label: 'DIY', value: '/images/tool-diy.svg' },
  { label: '去水印', value: '/images/tool-watermark.svg' },
  { label: '头像框', value: '/images/tool-frame.svg' },
  { label: '滤镜', value: '/images/tool-color.svg' },
  { label: '裁剪', value: '/images/tool-crop.svg' },
  { label: '灵感', value: '/images/quick-inspiration.svg' },
  { label: '每日', value: '/images/quick-daily.svg' },
  { label: '小店', value: '/images/quick-store.svg' },
  { label: '钻石/辣度值', value: '/images/icon-diamond.svg' },
  { label: '相机', value: '/images/icon-camera.svg' },
  { label: '热门', value: '/images/icon-hot.svg' },
  { label: '通知', value: '/images/icon-bell.svg' }
]

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    // 签到 + 积分
    isLoggedIn: false,
    isCheckedIn: false,
    checkInDays: 0,
    points: 0,
    // 工具列表（从后台配置加载，降级到 DEFAULT_TOOLS）
    toolsList: [],
    // 辣度值中心工具的动态描述（显示当前辣度值）
    pointsToolDesc: '查看辣度值·兑换好物'
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

  // 应用工具列表到 data，并更新辣度值中心描述
  _applyToolsList(tools) {
    // 动态更新辣度值中心工具的描述（显示当前辣度值）
    const toolsWithStats = tools.map(t => {
      if (t.id === 'points' || t.linkUrl === '/subpackages/points/points') {
        return {
          ...t,
          desc: this.data.isLoggedIn ? `当前 ${this.data.points} 辣度值` : (t.desc || '查看辣度值·兑换好物')
        }
      }
      return t
    })
    this.setData({ toolsList: toolsWithStats })
  },

  // ===== 签到 + 积分 =====
  refreshLoginAndCheckIn() {
    const isLoggedIn = checkLoginStatus()
    this.setData({ isLoggedIn })
    if (isLoggedIn) {
      this.checkTodayCheckIn()
    } else {
      this.setData({
        isCheckedIn: false,
        checkInDays: 0,
        points: 0
      })
      // 未登录时也更新工具列表（积分中心显示默认描述）
      if (this.data.toolsList.length > 0) {
        this._applyToolsList(this.data.toolsList)
      }
    }
  },

  async checkTodayCheckIn() {
    // 🔥 5 分钟节流：优先用本地缓存，避免每次切页都调 userPoints 云函数
    const cached = getStorage(CHECKIN_CACHE_KEY)
    if (cached && (Date.now() - cached.timestamp < CHECKIN_CACHE_TTL)) {
      const data = cached.data
      this.setData({
        isCheckedIn: data.isCheckedIn,
        checkInDays: data.checkInDays,
        points: data.points
      })
      // 同步更新积分中心描述
      if (this.data.toolsList.length > 0) {
        this._applyToolsList(this.data.toolsList)
      }
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
        this.setData({
          isCheckedIn: data.isCheckedIn,
          checkInDays: data.checkInDays,
          points: data.points
        })
        // 同步更新积分中心描述
        if (this.data.toolsList.length > 0) {
          this._applyToolsList(this.data.toolsList)
        }
        // 写入缓存
        setStorage(CHECKIN_CACHE_KEY, { data, timestamp: Date.now() })
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
        this.setData({
          isCheckedIn: data.isCheckedIn,
          checkInDays: data.checkInDays,
          points: data.points
        })
        if (this.data.toolsList.length > 0) {
          this._applyToolsList(this.data.toolsList)
        }
        setStorage(CHECKIN_CACHE_KEY, { data, timestamp: Date.now() })
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
        this.setData({
          isCheckedIn: true,
          checkInDays: data.checkInDays,
          points: data.points
        })
        // 🔥 签到成功后更新缓存 + 工具列表
        setStorage(CHECKIN_CACHE_KEY, {
          data: { isCheckedIn: true, checkInDays: data.checkInDays, points: data.points },
          timestamp: Date.now()
        })
        if (this.data.toolsList.length > 0) {
          this._applyToolsList(this.data.toolsList)
        }
        let message = `签到成功 +${data.pointsReward}辣度值`
        if (data.bonusPoints > 0) {
          message = `连续${data.checkInDays}天！+${data.totalReward}辣度值`
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
    const tool = e.currentTarget.dataset.tool
    if (!tool) return

    const { linkType, linkUrl, miniProgramPath, title } = tool

    if (linkType === 'page') {
      // 内部页面
      wx.navigateTo({
        url: linkUrl,
        fail: (err) => {
          console.error('[tools] 跳转失败:', err)
          wx.showToast({ title: '页面不存在', icon: 'none' })
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
    }
  },

  noop() {},

  onShareAppMessage() {
    const { recordShareReward } = require('../../utils/shareReward.js')
    setTimeout(() => recordShareReward(), 500)
    return {
      title: '小辣椒头像工具 | 海量精美素材免费下载',
      path: '/pages/tools/tools',
      imageUrl: '/images/share-cover.png'
    }
  },

  onShareTimeline() {
    return {
      title: '小辣椒头像工具 | 海量精美素材免费下载',
      query: '',
      imageUrl: '/images/share-cover.png'
    }
  }
})
