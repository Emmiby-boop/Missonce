import { fetchPageAds, pickByType } from '../../utils/adUtil.js'
import interstitialAdManager from '../../utils/interstitialAdManager.js'

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
    debug: { type: Boolean, value: false }
  },
  data: {
    adUnitId: '',
    showAd: false,
    adLoaded: false,
    _exposed: false,
    _adReady: false,
    _adWatched: false,
    isLoading: false,
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
      
      if (this.data.kind === 'interstitial') {
        this.initInterstitial()
      } else if (this.data.kind === 'rewarded') {
        this.initRewarded()
      } else {
        this.init()
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
      if (this.data.kind === 'interstitial' && interstitialAdManager) {
        interstitialAdManager.smartTriggerInterstitialAd(2000)
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
        const systemInfo = wx.getSystemInfoSync()
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
        
        // 监听页面滚动
        this.setupScrollListener()
        
        // 顶部广告需要额外检查：如果页面已经滚动超过阈值，立即显示
        if (this.data.position === 'top') {
          setTimeout(() => {
            if (!this.isAttached || this.data.showAd) return
            const threshold = this.data.adConfig?.threshold || this.data.threshold || 200
            wx.createSelectorQuery()
              .selectViewport()
              .scrollOffset(res => {
                if (!this.isAttached || this.data.showAd) return
                const scrollTop = res?.scrollTop || 0
                this.dlog('[AD][Unit] init top ad check scrollTop=', scrollTop, 'threshold=', threshold)
                if (scrollTop >= threshold) {
                  this.showIfNeeded()
                }
              })
              .exec()
          }, 300)
        }
      } catch (e) {
        console.error('[AD][Unit] init error:', e)
        // 异常时隐藏广告
        this.setData({ showAd: false })
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
          const obs = wx.createIntersectionObserver(this, { observeAll: false })
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
          
          // 初始化时检查当前滚动位置
          if (this.data.position === 'top' && page.scrollTop !== undefined) {
            const threshold = this.data.adConfig?.threshold || this.data.threshold || 200
            if (page.scrollTop >= threshold && !this.data.showAd) {
              this.dlog('[AD][Unit] setupScrollListener init show (scrollTop=', page.scrollTop, '>=', threshold, ')')
              this.showIfNeeded()
            }
          }
        }
      } catch (e) {
        this.dlog('[AD][Unit] setupScrollListener error:', e)
      }
    },
    getNavBarHeight() {
      try {
        const info = wx.getWindowInfo()
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
      
      const scrollTop = e.scrollTop
      // 🔥 修复：只更新 scrollY，不每次都 setData；且只在状态真正需要切换时才 setData
      const threshold = this.data.adConfig?.threshold || this.data.threshold || 200
      const shouldShow = scrollTop >= threshold
      
      if (shouldShow !== this.data.showAd) {
        // 状态要切换时才 setData，减少渲染次数
        this._showing = false // 重置锁，允许下次显示
        this.setData({ scrollY: scrollTop, showAd: shouldShow })
      } else if (Math.abs(scrollTop - this.data.scrollY) > 5) {
        // 滚动超过 5px 才更新 scrollY，避免每次滚动都 setData
        this.setData({ scrollY: scrollTop })
      }
    },
    maybeAutoShow() {
      if (!this.isAttached || this.data.showAd || !this.data.adUnitId) return
      try {
        const win = wx.getWindowInfo()
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
      // 🔥 修复：加执行锁，防止多路触发（交叉观察器 + scroll + maybeAutoShow）同时调用导致快速切换
      if (this._showing) return
      this._showing = true
      this.dlog('[AD][Unit] showIfNeeded trigger position=', this.data.position, 'adUnitId=', this.data.adUnitId)
      this.setData({ showAd: true })
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
      this.dlog('[AD][Unit] ad-custom error=', e && e.detail ? e.detail : e)
      if (this.data.showAd) {
        this._showing = false
        this.setData({ showAd: false })
      }
    },
    onAdLoad(e) {
      if (!this.isAttached) return
      this.dlog('[AD][Unit] ad-custom load success=', e && e.detail ? e.detail : e)
      this.setData({ adLoaded: true })
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
      try {
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
            this.data._adReady = true
            if (this.isAttached && this.data.isLoading) {
              this.setData({ isLoading: false })
            }
          })
          this.videoAd.onError && this.videoAd.onError((err) => { 
            this.data._adReady = false
            if (this.isAttached && this.data.isLoading) {
              this.setData({ isLoading: false })
            }
            if (interstitialAdManager) interstitialAdManager.setExternalAdPlaying(false)
            console.log('[AD][Rewarded] onError:', err, '_adShowing:', this.data._adShowing)
            if (this._adResolve && this.data._adShowing) {
              this.data._adShowing = false
              this._adResolve({ success: false, error: '广告播放失败' })
              this._adResolve = null
            }
          })
          this.videoAd.onClose && this.videoAd.onClose(async (res) => {
            if (!this.isAttached) return
            this.data._adShowing = false
            this.data._adWatched = (typeof res === 'undefined') ? true : !!(res && res.isEnded)
            if (interstitialAdManager) interstitialAdManager.setExternalAdPlaying(false)
            if (this.data._adWatched) {
              try {
                const callRes = await wx.cloud.callFunction({
                  name: this.data.rewardCloudName,
                  data: { action: this.data.rewardCloudAction }
                })
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
                if (!this.isAttached) return
                wx.showToast({ title: '奖励发放失败', icon: 'none' })
                this.triggerEvent('rewarded', { success: false })
              }
            } else {
              wx.showToast({ title: '需要完整观看视频才可获得积分', icon: 'none' })
              this.triggerEvent('rewarded', { success: false, skipped: true })
            }
            if (this.isAttached) {
              this.setData({ isLoading: false })
            }
            if (this._adResolve) {
              this._adResolve({ success: this.data._adWatched })
              this._adResolve = null
            }
          })
          this.videoAd.load && this.videoAd.load().catch(() => {})
        }
      } catch (e) {}
    },
    async onRewardTap() {
      return new Promise(async (resolve, reject) => {
        if (!this.isAttached) {
          resolve({ success: false, error: '组件已销毁' })
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
        this.setData({ isLoading: true })
        this.data._adWatched = false
        this.data._adShowing = false
        this._adResolve = null
        try {
          if (interstitialAdManager) interstitialAdManager.setExternalAdPlaying(true)
          this._adResolve = resolve
          this.data._adShowing = true
          if (this.data._adReady && this.videoAd.show) {
            this.dlog('[AD][Rewarded] show directly')
            await this.videoAd.show()
          } else if (this.videoAd.load) {
            this.dlog('[AD][Rewarded] load then show')
            await this.videoAd.load()
            await this.videoAd.show()
          }
        } catch (e) {
          this.data._adShowing = false
          if (this.isAttached) {
            this.setData({ isLoading: false })
          }
          if (interstitialAdManager) interstitialAdManager.setExternalAdPlaying(false)
          // 不显示错误提示，让调用方处理
          this._adResolve = null
          resolve({ success: false, error: e.message })
        }
      })
    },
    showRewarded() {
      return this.onRewardTap()
    }
  }
})
