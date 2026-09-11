import { fetchPageAds, pickByType } from '../../utils/adUtil.js'
import interstitialAdManager from '../../utils/interstitialAdManager.js'
import { getAppBaseInfo, getWindowInfo } from '../../utils/storageManager.js'

Component({
  options: {
    styleIsolation: 'apply-shared',  // 允许外部样式穿透到组件内部，让瀑布流广告卡片能撑满
    multipleSlots: false
  },
  properties: {
    position: { type: String, value: 'bottom' },
    kind: { type: String, value: 'native' },
    pagePath: { type: String, value: '' },
    customClass: { type: String, value: '' },
    adIntervals: { type: Number, value: 60 },
    fixedBottom: { type: Boolean, value: false },
    immediate: { type: Boolean, value: false },
    threshold: { type: Number, value: 200 },
    extStyle: { type: String, value: '' },
    rewardCloudName: { type: String, value: 'userPoints' },
    rewardCloudAction: { type: String, value: 'rewardAdWatch' },
    rewardPoints: { type: Number, value: 0 },
    buttonText: { type: String, value: '观看激励视频' },
    showButton: { type: Boolean, value: true },
    lazyDelay: { type: Number, value: 300 },
    debug: { type: Boolean, value: false }
  },
  data: {
    adUnitId: '',
    showAd: false,
    _exposed: false,
    isLoading: false,
    _pageHidden: false, // 页面是否隐藏
    adConfig: null, // 广告配置信息
    navBarHeight: 0, // 导航栏高度
    statusBarHeight: 0 // 状态栏高度
  },
  lifetimes: {
    attached() {
      this.isAttached = true
      // 🔥 内部状态移到实例属性，避免 setData 序列化开销
      this._adReady = false
      this._adWatched = false
      this._adShowing = false
      if (this.data.debug) console.log('[AD][Unit] attached kind=', this.data.kind, 'position=', this.data.position, 'pagePath=', this.data.pagePath)
      
      // 获取导航栏和状态栏高度
      this.getNavBarHeight()
      
      const startInit = () => {
        if (!this.isAttached) return
        if (this.data.kind === 'interstitial') {
          this.initInterstitial()
        } else if (this.data.kind === 'rewarded') {
          this.initRewarded()
        } else {
          this.init()
        }
      }

      if (this.data.immediate || this.data.kind === 'rewarded') {
        startInit()
      } else {
        this._lazyInitTimer = setTimeout(startInit, this.data.lazyDelay)
      }
    },
    ready() {
      // 组件准备就绪时再次检查导航栏高度
      if (this.data.position === 'top') {
        this.getNavBarHeight()
      }
    },
    detached() {
      this.isAttached = false
      if (this._autoShowTimer) {
        clearTimeout(this._autoShowTimer)
        this._autoShowTimer = null
      }
      if (this._showRaceCheck) {
        clearTimeout(this._showRaceCheck)
        this._showRaceCheck = null
      }
      if (this._hideAdTimer) {
        clearTimeout(this._hideAdTimer)
        this._hideAdTimer = null
      }
      if (this._reinitTimer) {
        clearTimeout(this._reinitTimer)
        this._reinitTimer = null
      }
      this._initRewarding = false
      if (this._lazyInitTimer) {
        clearTimeout(this._lazyInitTimer)
        this._lazyInitTimer = null
      }
      if (this._observer) {
        try { this._observer.disconnect() } catch (e) {
          console.error('[ad-unit] 断开观察器失败:', e)
        }
        this._observer = null
      }
      if (this.videoAd && this.videoAd.destroy) {
        try { this.videoAd.destroy() } catch (e) {
          console.error('[ad-unit] 销毁视频广告失败:', e)
        }
        this.videoAd = null
      }
    }
  },
  pageLifetimes: {
    show() {
      this.setData({ _pageHidden: false })
      // 激励广告：页面恢复时强制重置加载状态，防止 hide 期间残留的加载遮罩
      if (this.data.kind === 'rewarded') {
        this.setData({ isLoading: false })
        // 清理上一次可能遗留的重建定时器
        if (this._reinitTimer) { clearTimeout(this._reinitTimer); this._reinitTimer = null }
        // 🔥 关键修复：不再主动 resolve _adResolve
        //    onClose 回调已经通过"先领取后清空"模式保护，不会被遗漏
        //    旧逻辑在 show() 中强制 resolve({success:false}) 会与 onClose 中的
        //    await 云函数形成竞态，导致用户看完广告仍被提示需要重看
        // 🔥 如果实例不存在（被 SDK 销毁），尝试重建
        //    如果实例还在，不做任何操作 — 让用户点击时 onRewardTap 自然走 load→show
        if (!this.videoAd && this.isAttached) {
          this.dlog('[AD][Rewarded] page show, no instance, re-init')
          this.initRewarded()
        }
      }
      if (this.data.kind === 'interstitial' && interstitialAdManager) {
        interstitialAdManager.smartTriggerInterstitialAd(2000)
      }
    },
    hide() {
      // 标记页面隐藏，外层 wx:if="{{!_pageHidden}}" 会销毁整个内容区域（包括 ad-custom）
      // 不在此处设置 showAd=false，避免与 _pageHidden 同时触发导致 "updateTextView not found" 竞态
      // 原生广告组件会随父容器一起被移除，无需单独控制 hidden
      this.setData({ _pageHidden: true })

      // 取消所有待执行的定时器，防止回调触发 setData 导致渲染层错误
      if (this._initTimer) { clearTimeout(this._initTimer); this._initTimer = null }
      if (this._autoShowTimer) { clearTimeout(this._autoShowTimer); this._autoShowTimer = null }
      if (this._showRaceCheck) { clearTimeout(this._showRaceCheck); this._showRaceCheck = null }
      if (this._hideAdTimer) { clearTimeout(this._hideAdTimer); this._hideAdTimer = null }
      if (this._reinitTimer) { clearTimeout(this._reinitTimer); this._reinitTimer = null }
      this._initRewarding = false

      // 延迟设置 showAd=false，确保 _pageHidden 触发的 DOM 销毁已完成
      if (this.data.showAd) {
        this._hideAdTimer = setTimeout(() => {
          this._hideAdTimer = null
          if (this.data.kind === 'native') {
            if (this.isAttached) {
              this.setData({ showAd: false })
            }
          }
        }, 50)
      }
      // 断开交叉观察器，防止页面隐藏后继续触发回调
      if (this._observer) {
        try { this._observer.disconnect() } catch (e) {
          console.error('[ad-unit] 断开观察器失败:', e)
        }
        this._observer = null
      }
      if (this.videoAd) {
        const wasShowing = !!this._adResolve
        this.dlog('[AD][Rewarded] page hide, wasShowing=', wasShowing, '- keeping instance alive')
        this.data._adReady = false
        this.data.isLoading = false
        if (interstitialAdManager) interstitialAdManager.setExternalAdPlaying(false)
        // 🔥 关键：不在 hide 中 resolve _adResolve，交给 onClose 统一处理
        //     hide 中只暂停广告、清理 loading 状态，不干扰观看会话
        if (!this._adResolve) {
          try { this.videoAd.pause && this.videoAd.pause() } catch (e) {
            console.error('[ad-unit] 暂停视频广告失败:', e)
          }
        }
      }
    }
  },
  methods: {
    dlog() {
      if (!this.data.debug) return
      try {
        const args = Array.prototype.slice.call(arguments)
        console.log.apply(console, args)
      } catch (e) {
        console.error('[ad-unit] 调试日志输出失败:', e)
      }
    },
    async init() {
      try {
        // 检查基础库版本兼容性
        const systemInfo = getAppBaseInfo()
        const SDKVersion = systemInfo.SDKVersion
        this.dlog('[AD][Unit] SDKVersion:', SDKVersion)

        const pages = getCurrentPages()
        const current = pages && pages.length ? pages[pages.length - 1] : null
        const route = this.data.pagePath || (current?.route || '')
        const list = await fetchPageAds(route.startsWith('/') ? route : '/' + route)
        this.dlog('[AD][Unit] init route=', route, 'position=', this.data.position, 'list.len=', list ? list.length : 0)

        let adConfig = null
        let adUnitId = ''

        if (this.data.position === 'top') {
          adConfig = pickByType(list, 'native_top')[0] || (list || []).find(it => it.type === 'native_video' && it.position === 'top' && it.isEnable) || null
          adUnitId = adConfig?.adUnitId || ''
        } else if (this.data.position === 'middle') {
          adConfig = (list || []).find(it => it.type === 'native_video' && it.position === 'middle' && it.isEnable) || null
          if (!adConfig) {
            adConfig = (list || []).find(it => it.type === 'native_video' && it.position === '' && it.isEnable) || null
          }
          adUnitId = adConfig?.adUnitId || ''
        } else if (this.data.position === 'inline') {
          adConfig = (list || []).find(it => it.type === 'native_video' && it.position === 'middle' && it.isEnable) || null
          if (!adConfig) {
            adConfig = pickByType(list, 'native_top')[0] || (list || []).find(it => it.type === 'native_video' && it.position === 'top' && it.isEnable) || null
          }
          adUnitId = adConfig?.adUnitId || ''
        } else {
          adConfig = pickByType(list, 'native_bottom')[0] || (list || []).find(it => it.type === 'native_video' && (it.position === 'bottom' || !it.position) && it.isEnable) || null
          adUnitId = adConfig?.adUnitId || ''
        }

        if (!adUnitId) {
          this.dlog('[AD][Unit] no adUnitId for position=', this.data.position, 'pagePath=', this.data.pagePath, '- check miniadmin ad_config for this page')
          return
        }
        
        if (this.data._pageHidden) {
          this.dlog('[AD][Unit] init skipped, page hidden')
          return
        }
        
        this.setData({ 
          adUnitId,
          adConfig
        })
        this.dlog('[AD][Unit] set adUnitId=', adUnitId, 'adConfig=', adConfig)
        
        // 仅原生广告在 fixedBottom/immediate 时直接展示
        if (this.data.kind === 'native' && (this.data.fixedBottom || this.data.immediate)) {
          this.showIfNeeded()
          return
        }
        
        this.setupObserver()
        this.maybeAutoShow()
        this._autoShowTimer = setTimeout(() => this.maybeAutoShow(), 800)
      } catch (e) {
        console.error('[AD][Unit] init error:', e)
        // 异常时隐藏广告（页面已隐藏则跳过，避免 insertTextView 错误）
        if (this.isAttached && !this.data._pageHidden) {
          this.setData({ showAd: false })
        }
      }
    },
    setupObserver() {
      try {
        if (this._observer) {
          try { this._observer.disconnect() } catch (e) {
            console.error('[ad-unit] 断开观察器失败:', e)
          }
          this._observer = null
        }
        
        // 从广告配置中获取显示阈值，默认为200
        const threshold = this.data.adConfig?.threshold || this.data.threshold || 200
        
        this.dlog('[AD][Unit] setupObserver start, position=', this.data.position, 'threshold=', threshold)
        
        if (this.data.position === 'top') {
          // 顶部广告主要通过滚动监听控制，这里不再使用交叉观察器
          this.dlog('[AD][Unit] top ad uses scroll listener instead of intersection observer')
        } else {
          // 其他位置的广告使用交叉观察器
          const obs = wx.createIntersectionObserver(this, { observeAll: false, nativeMode: true })
          this.dlog('[AD][Unit] setupObserver position=', this.data.position, 'threshold=', threshold)
          obs.relativeToViewport({ bottom: 0 }).observe('#ad-anchor', (res) => {
            if (!this.isAttached) return
            this.dlog('[AD][Unit] other observer res=', res ? { ir: res.intersectionRatio, top: res.boundingClientRect && res.boundingClientRect.top } : null)
            if (!this.data.showAd && res.intersectionRatio > 0) {
              this.showIfNeeded()
            }
          })
          this._observer = obs
        }
      } catch (e) {
        this.dlog('[AD][Unit] setupObserver error:', e)
        this.showIfNeeded()
      }
    },
    getNavBarHeight() {
      try {
        const info = getWindowInfo()
        const statusBarHeight = info.statusBarHeight || 20
        const navBarHeight = 44 // 导航栏固定高度
        
        this.setData({
          statusBarHeight,
          navBarHeight
        })
        
        this.dlog('[AD][Unit] getNavBarHeight statusBarHeight:', statusBarHeight, 'navBarHeight:', navBarHeight)
      } catch (e) {
        this.dlog('[AD][Unit] getNavBarHeight error:', e)
      }
    },
    maybeAutoShow() {
      if (!this.isAttached || this.data.showAd || !this.data.adUnitId) return
      if (this.data._pageHidden) {
        this.dlog('[AD][Unit] maybeAutoShow skipped, page hidden')
        return
      }
      try {
        const win = getWindowInfo()
        wx.createSelectorQuery()
          .in(this)
          .select('#ad-anchor')
          .boundingClientRect(rect => {
            if (!this.isAttached || !rect) {
              this.dlog('[AD][Unit] maybeAutoShow rect=null or component detached')
              return
            }
            // 从广告配置中获取显示阈值，默认为200
            const threshold = this.data.adConfig?.threshold || this.data.threshold || 200
            
            // 明确记录当前位置，确保位置判断正确
            this.dlog('[AD][Unit] maybeAutoShow current position=', this.data.position, 'rect.top=', rect.top, 'threshold=', threshold)
            if (this.data.position === 'top') {
              // 顶部广告主要通过滚动监听控制，这里不再处理
              this.dlog('[AD][Unit] maybeAutoShow top ad skipped (using scroll listener)')
              return
            }
            // inline 位置：进入视口即显示（与其他内嵌位置一致）
            const otherThreshold = 40
            this.dlog('[AD][Unit] maybeAutoShow other rect.top=', rect.top, 'winH=', win.windowHeight)
            if (rect.top <= win.windowHeight + otherThreshold) {
              this.showIfNeeded()
            }
          })
          .exec()
      } catch (e) {
        this.dlog('[AD][Unit] maybeAutoShow error:', e)
      }
    },
    showIfNeeded() {
      if (!this.isAttached || this.data.showAd || !this.data.adUnitId) {
        if (!this.data.adUnitId) {
          this.dlog('[AD][Unit] showIfNeeded blocked: no adUnitId, position=', this.data.position, 'pagePath=', this.data.pagePath)
        }
        return
      }
      if (this.data._pageHidden) {
        this.dlog('[AD][Unit] showIfNeeded skipped, page hidden')
        return
      }
      this.dlog('[AD][Unit] showIfNeeded trigger position=', this.data.position, 'adUnitId=', this.data.adUnitId)
      this.setData({ showAd: true })
      // 竞态兜底：setData 异步渲染期间页面可能隐藏，延迟检查
      if (this._showRaceCheck) { clearTimeout(this._showRaceCheck) }
      this._showRaceCheck = setTimeout(() => {
        this._showRaceCheck = null
        if (this.data._pageHidden && this.data.showAd) {
          this.dlog('[AD][Unit] race detected after showIfNeeded, hiding ad')
          this.setData({ showAd: false })
        }
      }, 100)
      if (!this.data._exposed) {
        this.data._exposed = true
        try {
          const pages = getCurrentPages()
          const current = pages && pages.length ? pages[pages.length - 1] : null
          const route = current?.route || ''
          getApp().logEvent && getApp().logEvent('ad_exposure', {
            route,
            position: this.data.position,
            adUnitId: this.data.adUnitId
          })
        } catch (e) {
          console.error('[ad-unit] 上报广告曝光失败:', e)
        }
      }
    },
    onAdLoad(e) {
      this.dlog('[AD][Unit] ad-custom load success, adUnitId=', this.data.adUnitId)
    },
    onAdError(e) {
      if (!this.isAttached) return
      if (this.data._pageHidden) return
      this.dlog('[AD][Unit] ad-custom error=', e && e.detail ? e.detail : e)
      if (this.data.showAd) {
        this.setData({ showAd: false })
      }
    },
    async initInterstitial() {
      try {
        if (!interstitialAdManager) return
        const pages = getCurrentPages()
        const current = pages && pages.length ? pages[pages.length - 1] : null
        const route = this.data.pagePath || (current?.route || '')
        await interstitialAdManager.initInterstitialAd(route.startsWith('/') ? route : '/' + route)
        interstitialAdManager.smartTriggerInterstitialAd(2000)
      } catch (e) {
        console.error('[ad-unit] 初始化插屏广告失败:', e)
      }
    },
    async initRewarded() {
      if (this._initRewarding) return // 防止并发重复初始化
      this._initRewarding = true
      try {
        // 🔥 递增生成代数，用于让旧实例的回调（onClose/onError）识别自己已过时
        const gen = (this._adGeneration = (this._adGeneration || 0) + 1)
        if (this.videoAd) {
          try { this.videoAd.destroy && this.videoAd.destroy() } catch (e) {
            console.error('[ad-unit] 销毁视频广告失败:', e)
          }
          this.videoAd = null
        }
        const pages = getCurrentPages()
        const current = pages && pages.length ? pages[pages.length - 1] : null
        const route = this.data.pagePath || (current?.route || '')
        const list = await fetchPageAds(route.startsWith('/') ? route : '/' + route)
        const rv = pickByType(list, 'rewarded')[0]
        this.dlog('[AD][Rewarded] init route=', route, 'cfg=', rv)
        if (rv && rv.adUnitId && wx.createRewardedVideoAd) {
          this.videoAd = wx.createRewardedVideoAd({ adUnitId: rv.adUnitId })
          this._adReady = false
          this._adWatched = false
          this._adShowing = false
          this.videoAd.onLoad && this.videoAd.onLoad(() => { 
            if (this._adGeneration !== gen) return  // 🔥 旧实例回调，忽略
            this._adReady = true
            if (this.isAttached && !this.data._pageHidden && this.data.isLoading) {
              this.setData({ isLoading: false })
            }
          })
          this.videoAd.onError && this.videoAd.onError((err) => { 
            if (this._adGeneration !== gen) return  // 🔥 旧实例回调，忽略
            this._adReady = false
            if (this.isAttached && !this.data._pageHidden && this.data.isLoading) {
              this.setData({ isLoading: false })
            }
            if (interstitialAdManager) interstitialAdManager.setExternalAdPlaying(false)
            const errMsg = err && (err.errMsg || err.message || '')
            if (errMsg && errMsg.indexOf('interrupt') !== -1) {
              return
            }
            if (this._adResolve && this._adShowing) {
              this._adShowing = false
              this._adResolve({ success: false, error: '广告播放失败' })
              this._adResolve = null
            }
          })
          this.videoAd.onClose && this.videoAd.onClose(async (res) => {
            if (this._adGeneration !== gen) {
              // 🔥 旧实例回调，仅清理自己的引用，不干扰当前广告
              return
            }
            // 🔥 关键修复：立即领取并清空 _adResolve，防止 pageLifetimes.show() 在 await 云函数期间抢占注入失败结果
            const pendingResolve = this._adResolve
            this._adResolve = null
            // 🔥 无论如何先重置加载状态，防止 loading 永远不消失
            if (this.isAttached && !this.data._pageHidden) {
              this.setData({ isLoading: false })
            } else if (this.isAttached) {
              this.data.isLoading = false
            }
            if (!this.isAttached) {
              // 组件已销毁，仍需 resolve 防止 Promise 泄漏
              if (pendingResolve) {
                pendingResolve({ success: false, error: '组件已销毁' })
              }
              return
            }
            if (this.data._pageHidden) {
              // 🔥 页面隐藏时广告被关闭（如用户按 Home 键退出）
              //    设置 _adReady=false 确保下次点击走 load→show 而非直接 show
              this.data._adReady = false
              if (pendingResolve) {
                pendingResolve({ success: false, skipped: true, reason: 'hidden' })
              }
              return
            }
            this._adShowing = false
            this._adWatched = (typeof res === 'undefined') ? true : !!(res && res.isEnded)
            // 🔥 广告关闭后重置 _adReady，下次必须重新 load
            this._adReady = false
            if (interstitialAdManager) interstitialAdManager.setExternalAdPlaying(false)
            // 🔥 只有存在活跃观看会话 (pendingResolve 不为 null) 时才做副作用
            //    防止旧会话的 onClose 延迟触发时显示错误的 toast/triggerEvent
            if (pendingResolve) {
              if (this._adWatched) {
                // 只有配置了 rewardCloudName 才调云函数发奖励（辣度值中心等页面）
                // 预览页等不需要云函数发奖励的页面，直接触发 rewarded 事件
                if (this.data.rewardCloudName) {
                  try {
                    const callRes = await wx.cloud.callFunction({
                      name: this.data.rewardCloudName,
                      data: { action: this.data.rewardCloudAction }
                    })
                    if (!this.isAttached) return
                    if (callRes.result && callRes.result.success) {
                      const added = (callRes.result.data && callRes.result.data.addedAmount) || this.data.rewardPoints || 0
                      wx.showToast({ title: `+${added} 辣度值`, icon: 'success' })
                      this.triggerEvent('rewarded', { success: true, added })
                    } else {
                      wx.showToast({ title: callRes.result?.error || '今日次数已满', icon: 'none' })
                      this.triggerEvent('rewarded', { success: false, error: callRes.result?.error || '' })
                    }
                  } catch (e) {
                    console.error('[AD][Rewarded] cloudFunction error=', e)
                    if (!this.isAttached) return
                    wx.showToast({ title: '奖励发放失败', icon: 'none' })
                    this.triggerEvent('rewarded', { success: false })
                  }
                } else {
                  // 无云函数配置，仅触发 rewarded 事件（预览页等）
                  this.triggerEvent('rewarded', { success: true })
                }
              } else {
                // 广告未完整观看：根据是否有云函数配置决定提示方式
                if (this.data.rewardCloudName) {
                  wx.showToast({ title: '需要完整观看广告才可获得辣度值', icon: 'none' })
                }
                this.triggerEvent('rewarded', { success: false, skipped: true })
              }
            }
            // 🔥 使用提前领取的 pendingResolve，而非 this._adResolve（已被清空，不会被 show() 抢占）
            if (pendingResolve) {
              pendingResolve({ 
                success: this._adWatched, 
                skipped: !this._adWatched,
                reason: this._adWatched ? undefined : 'not_completed'
              })
            }
          })
          // 🔥 立即加载 + 失败重试（最多3次）
          // 不再延迟：show 中已有足够的冷却期，此时加载是安全的
          // 旧版延迟 500ms 是为防止"页面切换时视频播放器冲突"，现在切换已完成
          if (!this.data._pageHidden) {
            let retryCount = 0
            const maxRetries = 3
            const doLoad = () => {
              if (!this.isAttached || this.data._pageHidden || !this.videoAd || this._adGeneration !== gen) return
              this.videoAd.load().then(() => {
              }).catch((err) => {
                retryCount++
                const errMsg = err && (err.errMsg || err.message || '')
                if (retryCount < maxRetries && this._adGeneration === gen && this.isAttached) {
                  setTimeout(doLoad, 2000 * retryCount)  // 递增延迟: 2s, 4s
                }
              })
            }
            doLoad()  // 🔥 立即执行，不再 setTimeout 500ms
          }
        }
      } catch (e) {
        console.error('[ad-unit] 初始化激励广告失败:', e)
      } finally {
        this._initRewarding = false
      }
    },
    async onRewardTap() {
      return new Promise(async (resolve, reject) => {
        if (!this.isAttached) {
          resolve({ success: false, error: '组件已销毁' })
          return
        }
        if (this.data._pageHidden) {
          resolve({ success: false, error: '页面已隐藏' })
          return
        }
        if (!this.videoAd) {
          wx.showToast({ title: '广告未配置', icon: 'none' })
          resolve({ success: false, error: '广告未配置' })
          return
        }
        if (this.data.isLoading) {
          resolve({ success: false, error: '广告正在加载' })
          return
        }
        if (this.data._pageHidden) {
          resolve({ success: false, error: '页面已隐藏' })
          return
        }
        this.setData({ isLoading: true })
        this._adWatched = false
        this._adShowing = false
        this._adResolve = null

        // 🔥 10 秒超时兜底，防止 load/show 挂住导致 loading 永远不消失
        let _loadTimeout = null
        const clearLoadTimeout = () => {
          if (_loadTimeout) { clearTimeout(_loadTimeout); _loadTimeout = null }
        }
        const onTimeout = () => {
          _loadTimeout = null
          this._adShowing = false
          if (interstitialAdManager) interstitialAdManager.setExternalAdPlaying(false)
          this.setData({ isLoading: false })
          this._adResolve = null
          resolve({ success: false, error: '广告加载超时' })
        }
        _loadTimeout = setTimeout(onTimeout, 10000)

        try {
          if (interstitialAdManager) interstitialAdManager.setExternalAdPlaying(true)
          this._adResolve = resolve
          this._adShowing = true
          if (this._adReady && this.videoAd && this.videoAd.show) {
            this.dlog('[AD][Rewarded] show directly')
            clearLoadTimeout()
            await this.videoAd.show()
            // show() 成功 → 广告已在播放，立即隐藏加载遮罩
            if (this.isAttached && !this.data._pageHidden) {
              this.setData({ isLoading: false })
            } else {
              this.data.isLoading = false
            }
          } else if (this.videoAd && this.videoAd.load) {
            this.dlog('[AD][Rewarded] load then show')
            await this.videoAd.load()
            clearLoadTimeout()
            // 再次检查页面状态，避免 load 等待期间页面切换
            if (this.data._pageHidden) {
              this._adShowing = false
              if (interstitialAdManager) interstitialAdManager.setExternalAdPlaying(false)
              this.setData({ isLoading: false })
              this._adResolve = null
              resolve({ success: false, error: '页面已隐藏' })
              return
            }
            await this.videoAd.show()
            // show() 成功 → 广告已在播放，立即隐藏加载遮罩
            if (this.isAttached && !this.data._pageHidden) {
              this.setData({ isLoading: false })
            } else {
              this.data.isLoading = false
            }
          }
          // loading 遮罩已在上述两个分支中清除，onClose/onError 兜底重置
        } catch (e) {
          clearLoadTimeout()
          const errMsg = e && (e.errMsg || e.message || '') + ''
          // 判断是否是页面切换导致的异常（interrupt/abort）
          const isPageSwitch = errMsg.indexOf('interrupt') !== -1 || errMsg.indexOf('abort') !== -1
          
          this._adShowing = false
          if (interstitialAdManager) interstitialAdManager.setExternalAdPlaying(false)
          this._adResolve = null
          
          if (isPageSwitch) {
            // 页面切换场景：使用 data-only 避免触发渲染层 insert/remove 错误
            this.data.isLoading = false
            resolve({ success: false, error: '页面切换，广告取消' })
          } else if (errMsg.indexOf('destroyed') !== -1 || errMsg.indexOf('destroy') !== -1) {
            // 🔥 广告实例已被 SDK 销毁（常见于中途退出后同 adUnitId 冲突）
            // 重建后延迟自动重试一次，避免用户手动再点
            this.videoAd = null
            this._adReady = false
            this._adWatched = false
            this._adShowing = false
            // 🔥 清理上一次可能遗留的重建定时器
            if (this._reinitTimer) { clearTimeout(this._reinitTimer); this._reinitTimer = null }
            if (this.isAttached && !this.data._pageHidden) {
              // 异步重建，完成后自动重试
              this.initRewarded().then(() => {
                // 给 SDK 足够时间完成内部清理 + load（2.5s 冷却）
                this._reinitTimer = setTimeout(() => {
                  this._reinitTimer = null
                  if (!this.videoAd || !this._adReady || !this.isAttached || this.data._pageHidden) {
                    this.setData({ isLoading: false })
                    resolve({ success: false, error: '广告加载失败，请稍后重试' })
                    return
                  }
                  // 🔥 自动重试观看
                  this.onRewardTap().then(resolve).catch(() => {
                    resolve({ success: false, error: '广告加载失败，请稍后重试' })
                  })
                }, 2500)
              }).catch(() => {
                this.setData({ isLoading: false })
                resolve({ success: false, error: '广告加载失败，请稍后重试' })
              })
            } else {
              this.setData({ isLoading: false })
              resolve({ success: false, error: '广告加载失败，请稍后重试' })
            }
          } else {
            // 正常异常（加载失败等）：必须通过 setData 重置 UI，否则加载动画永远不消失
            console.error('[AD][Rewarded] show failed:', errMsg)
            if (this.isAttached && !this.data._pageHidden) {
              this.setData({ isLoading: false })
            } else {
              this.data.isLoading = false
            }
            resolve({ success: false, error: e.message || '广告播放失败' })
          }
        }
      })
    },
    showRewarded() {
      return this.onRewardTap()
    }
  }
})
