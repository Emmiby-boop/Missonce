import { fetchPageAds, pickByType } from '../../utils/adUtil.js'
import interstitialAdManager from '../../utils/interstitialAdManager.js'
import { getAppBaseInfo, getWindowInfo } from '../../utils/storageManager.js'

Component({
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
    _adReady: false,
    _adWatched: false,
    isLoading: false,
    _pageHidden: false, // 页面是否隐藏
    adConfig: null, // 广告配置信息
    scrollY: 0, // 页面滚动位置
    navBarHeight: 0, // 导航栏高度
    statusBarHeight: 0 // 状态栏高度
  },
  lifetimes: {
    attached() {
      this.isAttached = true
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
      this._initRewarding = false
      if (this._lazyInitTimer) {
        clearTimeout(this._lazyInitTimer)
        this._lazyInitTimer = null
      }
      if (this._observer) {
        try { this._observer.disconnect() } catch (e) {}
        this._observer = null
      }
      // wx.onPageScroll 是全局监听，页面卸载自动失效，无需手动清理
      if (this._originalOnPageScroll) {
        const page = getCurrentPages()[getCurrentPages().length - 1]
        if (page) {
          page.onPageScroll = this._originalOnPageScroll
          this.dlog('[AD][Unit] restored original onPageScroll')
        }
        this._originalOnPageScroll = null
      }
      if (this.videoAd && this.videoAd.destroy) {
        try { this.videoAd.destroy() } catch (e) {}
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
        // 🔥 页面恢复时，如果有待处理的 resolve，先清理掉
        if (this._adResolve) {
          this._adResolve({ success: false, skipped: true })
          this._adResolve = null
        }
      }
      if (this.data.kind === 'interstitial' && interstitialAdManager) {
        interstitialAdManager.smartTriggerInterstitialAd(2000)
      }
      // 激励广告组件：如果已销毁则重新初始化，避免旧实例残留
      if (this.data.kind === 'rewarded' && !this.videoAd && this.isAttached) {
        this.dlog('[AD][Rewarded] page show, re-init')
        this.initRewarded()
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
      if (this._hideAdTimer) { clearTimeout(this._hideAdTimer); this._hideAdTimer = null } // 清理上一次遗留的延迟隐藏定时器
      this._initRewarding = false

      // 延迟设置 showAd=false，确保 _pageHidden 触发的 DOM 销毁已完成
      // 使用较短延迟即可，因为 wx:if 的 DOM 移除是同步的
      if (this.data.showAd) {
        this._hideAdTimer = setTimeout(() => {
          this._hideAdTimer = null
          if (this.data.kind === 'native') {
            // 仅在组件仍 attached 时才 setData，防止 detached 后的无效渲染调用
            if (this.isAttached) {
              this.setData({ showAd: false })
            }
          }
        }, 50)
      }
      // 断开交叉观察器，防止页面隐藏后继续触发回调
      if (this._observer) {
        try { this._observer.disconnect() } catch (e) {}
        this._observer = null
      }
      // 激励广告：页面隐藏时安全销毁广告实例
      // 先暂停再销毁，避免 destroy 内部 pause 与正在进行的 play 产生竞态
      // 这个错误发生在原生渲染层，JS try-catch 无法完全捕获
      if (this.videoAd) {
        this.dlog('[AD][Rewarded] page hide, safe destroy videoAd')
        const ad = this.videoAd
        this.videoAd = null
        this.data._adReady = false
        this.data._adShowing = false
        this.data.isLoading = false // data-only，不触发setData渲染
        if (interstitialAdManager) interstitialAdManager.setExternalAdPlaying(false)
        if (this._adResolve) {
          this._adResolve({ success: false, error: '页面隐藏' })
          this._adResolve = null
        }
        // 分步销毁：先暂停（如果支持），再延迟 destroy
        // 这样给播放器足够时间完成当前的 play/pause 状态机转换
        try {
          if (ad.pause) { ad.pause() }
        } catch (e) {}
        setTimeout(() => {
          try { if (ad.destroy) ad.destroy() } catch (e) {}
        }, 100)
      }
    }
  },
  methods: {
    dlog() {
      if (!this.data.debug) return
      try {
        const args = Array.prototype.slice.call(arguments)
        console.log.apply(console, args)
      } catch (e) {}
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
          adUnitId = adConfig?.adUnitId || ''
        } else {
          adConfig = pickByType(list, 'native_bottom')[0] || (list || []).find(it => it.type === 'native_video' && (it.position === 'bottom' || !it.position) && it.isEnable) || null
          adUnitId = adConfig?.adUnitId || ''
        }
        
        if (!adUnitId) {
          this.dlog('[AD][Unit] no adUnitId for position=', this.data.position)
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
        
        // 监听页面滚动
        this.setupScrollListener()
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
          try { this._observer.disconnect() } catch (e) {}
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
    
    setupScrollListener() {
      try {
        const page = getCurrentPages()[getCurrentPages().length - 1]
        if (page) {
          // 保存原有的 onPageScroll 方法
          this._originalOnPageScroll = page.onPageScroll || null
          const self = this
          page.onPageScroll = function(e) {
            self.onPageScroll(e)
            // 如果页面原来有 onPageScroll，继续执行
            if (self._originalOnPageScroll) {
              self._originalOnPageScroll.call(this, e)
            }
          }
          this.dlog('[AD][Unit] setupScrollListener success')
        }
      } catch (e) {
        this.dlog('[AD][Unit] setupScrollListener error:', e)
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
    onPageScroll(e) {
      if (!this.isAttached || this.data.position !== 'top') return
      if (this.data._pageHidden) return
      
      const scrollTop = e.scrollTop
      this.setData({ scrollY: scrollTop })
      
      // 从广告配置中获取显示阈值，默认为200
      const threshold = this.data.adConfig?.threshold || this.data.threshold || 200
      
      if (scrollTop >= threshold && !this.data.showAd) {
        this.showIfNeeded()
      } else if (scrollTop < threshold && this.data.showAd) {
        this.setData({ showAd: false })
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
      if (!this.isAttached || this.data.showAd || !this.data.adUnitId) return
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
        } catch (e) {}
      }
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
      } catch (e) {}
    },
    async initRewarded() {
      if (this._initRewarding) return // 防止并发重复初始化
      this._initRewarding = true
      try {
        // 🔥 递增生成代数，用于让旧实例的回调（onClose/onError）识别自己已过时
        const gen = (this._adGeneration = (this._adGeneration || 0) + 1)
        if (this.videoAd) {
          try { this.videoAd.destroy && this.videoAd.destroy() } catch (e) {}
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
          this.data._adReady = false
          this.data._adWatched = false
          this.data._adShowing = false
          this.videoAd.onLoad && this.videoAd.onLoad(() => { 
            if (this._adGeneration !== gen) return  // 🔥 旧实例回调，忽略
            this.data._adReady = true
            if (this.isAttached && !this.data._pageHidden && this.data.isLoading) {
              this.setData({ isLoading: false })
            }
          })
          this.videoAd.onError && this.videoAd.onError((err) => { 
            if (this._adGeneration !== gen) return  // 🔥 旧实例回调，忽略
            this.data._adReady = false
            if (this.isAttached && !this.data._pageHidden && this.data.isLoading) {
              this.setData({ isLoading: false })
            }
            if (interstitialAdManager) interstitialAdManager.setExternalAdPlaying(false)
            console.log('[AD][Rewarded] onError:', err, '_adShowing:', this.data._adShowing)
            const errMsg = err && (err.errMsg || err.message || '')
            if (errMsg && errMsg.indexOf('interrupt') !== -1) {
              console.log('[AD][Rewarded] onError ignored (interrupt)')
              return
            }
            if (this._adResolve && this.data._adShowing) {
              this.data._adShowing = false
              this._adResolve({ success: false, error: '广告播放失败' })
              this._adResolve = null
            }
          })
          this.videoAd.onClose && this.videoAd.onClose(async (res) => {
            if (this._adGeneration !== gen) {
              // 🔥 旧实例回调，仅清理自己的引用，不干扰当前广告
              console.log('[AD][Rewarded] onClose ignored (stale gen=', gen, 'current=', this._adGeneration, ')')
              return
            }
            console.log('[AD][Rewarded] onClose fired, res=', JSON.stringify(res), 'isAttached=', this.isAttached, '_pageHidden=', this.data._pageHidden)
            // 🔥 无论如何先重置加载状态，防止 loading 永远不消失
            if (this.isAttached && !this.data._pageHidden) {
              this.setData({ isLoading: false })
            } else if (this.isAttached) {
              this.data.isLoading = false
            }
            if (!this.isAttached) {
              // 组件已销毁，仍需 resolve 防止 Promise 泄漏
              if (this._adResolve) {
                this._adResolve({ success: false, error: '组件已销毁' })
                this._adResolve = null
              }
              return
            }
            if (this.data._pageHidden) {
              // 🔥 页面隐藏时广告关闭，仍需 resolve 防止状态不一致
              if (this._adResolve) {
                this._adResolve({ success: false, skipped: true })
                this._adResolve = null
              }
              return
            }
            this.data._adShowing = false
            this.data._adWatched = (typeof res === 'undefined') ? true : !!(res && res.isEnded)
            // 🔥 广告关闭后重置 _adReady，下次必须重新 load
            this.data._adReady = false
            console.log('[AD][Rewarded] _adWatched=', this.data._adWatched, 'rewardCloud=', this.data.rewardCloudName, this.data.rewardCloudAction)
            if (interstitialAdManager) interstitialAdManager.setExternalAdPlaying(false)
            if (this.data._adWatched) {
              // 只有配置了 rewardCloudName 才调云函数发奖励（积分中心等页面）
              // 预览页等不需要云函数发奖励的页面，直接触发 rewarded 事件
              if (this.data.rewardCloudName) {
                try {
                  const callRes = await wx.cloud.callFunction({
                    name: this.data.rewardCloudName,
                    data: { action: this.data.rewardCloudAction }
                  })
                  console.log('[AD][Rewarded] cloudFunction result=', JSON.stringify(callRes.result))
                  if (!this.isAttached) return
                  if (callRes.result && callRes.result.success) {
                    const added = (callRes.result.data && callRes.result.data.addedAmount) || this.data.rewardPoints || 0
                    wx.showToast({ title: `+${added} 积分`, icon: 'success' })
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
              wx.showToast({ title: '需要完整观看视频才可获得积分', icon: 'none' })
              this.triggerEvent('rewarded', { success: false, skipped: true })
            }
            // _adResolve 在 onClose 开头已处理组件销毁的情况，此处处理正常流程
            if (this._adResolve) {
              this._adResolve({ success: this.data._adWatched, skipped: !this.data._adWatched })
              this._adResolve = null
            }
          })
          // 🔥 延迟加载 + 失败重试（最多3次）
          // 立即 load 会导致"play interrupted by pause"错误（页面切换时内部视频播放器冲突）
          if (!this.data._pageHidden) {
            let retryCount = 0
            const maxRetries = 3
            const doLoad = () => {
              if (!this.isAttached || this.data._pageHidden || !this.videoAd || this._adGeneration !== gen) return
              this.videoAd.load().then(() => {
                console.log('[AD][Rewarded] load success after', retryCount, 'retries')
              }).catch((err) => {
                retryCount++
                const errMsg = err && (err.errMsg || err.message || '')
                console.log('[AD][Rewarded] load failed (attempt', retryCount, '/', maxRetries, '):', errMsg)
                if (retryCount < maxRetries && this._adGeneration === gen && this.isAttached) {
                  setTimeout(doLoad, 2000 * retryCount)  // 递增延迟: 2s, 4s
                }
              })
            }
            this._initTimer = setTimeout(doLoad, 500)
          }
        }
      } catch (e) {} finally {
        this._initRewarding = false
      }
    },
    async onRewardTap() {
      console.log('[AD][Rewarded] onRewardTap called, videoAd=', !!this.videoAd, 'isLoading=', this.data.isLoading, '_pageHidden=', this.data._pageHidden)
      return new Promise(async (resolve, reject) => {
        if (!this.isAttached) {
          resolve({ success: false, error: '组件已销毁' })
          return
        }
        if (this.data._pageHidden) {
          console.log('[AD][Rewarded] onRewardTap skipped, page hidden')
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
        this.data._adWatched = false
        this.data._adShowing = false
        this._adResolve = null

        // 🔥 10 秒超时兜底，防止 load/show 挂住导致 loading 永远不消失
        let _loadTimeout = null
        const clearLoadTimeout = () => {
          if (_loadTimeout) { clearTimeout(_loadTimeout); _loadTimeout = null }
        }
        const onTimeout = () => {
          _loadTimeout = null
          console.log('[AD][Rewarded] load timeout, resolving')
          this.data._adShowing = false
          if (interstitialAdManager) interstitialAdManager.setExternalAdPlaying(false)
          this.setData({ isLoading: false })
          this._adResolve = null
          resolve({ success: false, error: '广告加载超时' })
        }
        _loadTimeout = setTimeout(onTimeout, 10000)

        try {
          if (interstitialAdManager) interstitialAdManager.setExternalAdPlaying(true)
          this._adResolve = resolve
          this.data._adShowing = true
          if (this.data._adReady && this.videoAd && this.videoAd.show) {
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
              console.log('[AD][Rewarded] page hidden after load, abort show')
              this.data._adShowing = false
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
          
          this.data._adShowing = false
          if (interstitialAdManager) interstitialAdManager.setExternalAdPlaying(false)
          this._adResolve = null
          
          if (isPageSwitch) {
            // 页面切换场景：使用 data-only 避免触发渲染层 insert/remove 错误
            console.log('[AD][Rewarded] show aborted (page switch):', errMsg)
            this.data.isLoading = false
            resolve({ success: false, error: '页面切换，广告取消' })
          } else if (errMsg.indexOf('destroyed') !== -1 || errMsg.indexOf('destroy') !== -1) {
            // 🔥 广告实例已被 SDK 销毁（常见于中途退出后），重建后提示用户重试
            console.log('[AD][Rewarded] ad destroyed, re-initializing...')
            this.videoAd = null
            this.data._adReady = false
            this.data._adWatched = false
            this.data._adShowing = false
            if (this.isAttached && !this.data._pageHidden) {
              this.setData({ isLoading: false })
              // 异步重建，不阻塞当前流程
              this.initRewarded()
            }
            resolve({ success: false, error: '广告加载失败，请稍后重试' })
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
