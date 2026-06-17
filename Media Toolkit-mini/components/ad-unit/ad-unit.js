import { fetchPageAds, pickByType } from '../../utils/adUtil.js';

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
    isLoading: false,
    cooldownSec: 0,
    adConfig: null,
    scrollY: 0,
    navBarHeight: 44,
    statusBarHeight: 20
  },

  lifetimes: {
    attached() {
      this._destroyed = false
      this.init()
    },
    detached() {
      this._destroyed = true
      this._destroyAd()
      this._clearCooldown()
    }
  },

  pageLifetimes: {
    show() {
      // 页面恢复时，如果之前广告被中断，启动冷却后再重建
      if (this._needCooldown) {
        this._needCooldown = false
        this._startCooldown()
      }
    },
    hide() {
      // 页面隐藏时标记，回来后需要冷却
      if (this._adShowing) {
        this._needCooldown = true
      }
    }
  },

  methods: {
    async init() {
      try {
        const windowInfo = wx.getWindowInfo()
        const deviceInfo = wx.getDeviceInfo()
        this.setData({
          statusBarHeight: windowInfo.statusBarHeight || 20,
          navBarHeight: deviceInfo.platform === 'ios' ? 44 : 48
        })
        if (!this.properties.pagePath) return
        const list = await fetchPageAds(this.properties.pagePath)
        const typeKey = this.getAdTypeKey()
        const adConfig = pickByType(list, typeKey)[0]
        if (adConfig && adConfig.adUnitId) {
          this.setData({ adUnitId: adConfig.adUnitId, adConfig, showAd: true })
        }
      } catch (e) {
        console.error('广告组件初始化失败:', e)
      }
    },

    getAdTypeKey() {
      const { kind, position } = this.properties
      if (kind === 'rewarded') return 'rewarded'
      if (kind === 'interstitial') return 'interstitial'
      if (position === 'top') return 'native_top'
      if (position === 'bottom') return 'native_bottom'
      return 'native'
    },

    onAdError(e) {
      console.error('广告加载失败:', e.detail)
    },

    onRewardTap() {
      if (this.data.isLoading) return
      if (this.data.cooldownSec > 0) {
        wx.showToast({ title: '请等待 ' + this.data.cooldownSec + ' 秒', icon: 'none' })
        return
      }
      return this.showRewarded()
    },

    // ---- 冷却机制 ----
    _startCooldown() {
      const sec = 3
      this.setData({ cooldownSec: sec })
      this._clearCooldown()
      this._cooldownTimer = setInterval(() => {
        if (this._destroyed) { this._clearCooldown(); return }
        const next = this.data.cooldownSec - 1
        if (next <= 0) {
          this._clearCooldown()
          this.setData({ cooldownSec: 0, isLoading: false })
          wx.showToast({ title: '可以重新观看了', icon: 'none', duration: 1500 })
        } else {
          this.setData({ cooldownSec: next })
        }
      }, 1000)
    },

    _clearCooldown() {
      if (this._cooldownTimer) {
        clearInterval(this._cooldownTimer)
        this._cooldownTimer = null
      }
    },

    // ---- 广告实例管理 ----
    _destroyAd() {
      if (this._rewardedAd) {
        try { this._rewardedAd.destroy() } catch (e) {}
        this._rewardedAd = null
      }
      this._adShowing = false
    },

    showRewarded() {
      return new Promise((resolve) => {
        if (this._destroyed) {
          resolve({ success: false, error: '组件已销毁' })
          return
        }
        if (!wx.createRewardedVideoAd) {
          resolve({ success: false, error: '当前版本不支持激励视频' })
          return
        }
        if (!this.data.adUnitId) {
          resolve({ success: false, error: '广告单元ID为空' })
          return
        }
        if (this.data.cooldownSec > 0) {
          resolve({ success: false, error: '冷却中' })
          return
        }

        this.setData({ isLoading: true })

        // 先彻底销毁旧实例，再延迟重建，确保微信 SDK 完全释放
        this._destroyAd()

        // 延迟 300ms 等微信 SDK 清理完毕
        setTimeout(() => {
          if (this._destroyed) {
            this.setData({ isLoading: false })
            resolve({ success: false, error: '组件已销毁' })
            return
          }

          this._adShowing = true
          const rewardedAd = wx.createRewardedVideoAd({
            adUnitId: this.data.adUnitId,
            multiton: true  // 关键：多例模式，避免复用已销毁实例
          })
          this._rewardedAd = rewardedAd

          let resolved = false
          const done = (result) => {
            if (resolved) return
            resolved = true
            this._adShowing = false
            this._destroyAd()
            this.setData({ isLoading: false })

            // 非正常结束 → 启动冷却
            if (result && !result.success) {
              this._startCooldown()
            }
            resolve(result)
          }

          rewardedAd.onError((e) => {
            done({ success: false, error: e.message || '广告加载失败' })
          })

          rewardedAd.onClose((res) => {
            if (res && res.isEnded) {
              this.triggerEvent('rewarded', { rewardPoints: this.properties.rewardPoints })
              done({ success: true })
            } else {
              done({ success: false, error: '未完整观看' })
            }
          })

          rewardedAd.load()
            .then(() => {
              if (!this._adShowing || resolved) return
              return rewardedAd.show()
            })
            .catch((e) => {
              done({ success: false, error: e.message || '广告播放失败' })
            })
        }, 300)
      })
    }
  }
})
