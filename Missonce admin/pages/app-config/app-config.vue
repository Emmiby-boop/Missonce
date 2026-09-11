<template>
  <view class="page-container app-config-page" style="padding-bottom: calc(180rpx + env(safe-area-inset-bottom));">
    <!-- 微信小店 -->
    <view class="card">
      <view class="card__title">微信小店</view>
      <view class="field">
        <text class="field__label">商品 ID 列表</text>
        <text class="field__desc">多个用逗号分隔，前端 store 页据此展示商品</text>
        <textarea class="field__input area" :value="storeProductsText" @input="onStore" :adjust-position="true" cursor-spacing="20" />
      </view>
    </view>

    <!-- 联系方式与社群 -->
    <view class="card">
      <view class="card__title">联系方式与社群</view>
      <view class="field">
        <text class="field__label">联系邮箱</text>
        <input class="field__input" :value="contactEmail" @input="onEmail" placeholder="support@example.com" />
      </view>
      <view class="field">
        <text class="field__label">公众号名称</text>
        <input class="field__input" :value="officialAccountName" @input="onOfficial" placeholder="公众号名称" />
      </view>
      <view class="field">
        <text class="field__label">粉丝群二维码</text>
        <text class="field__desc">cloud:// 或 https 图片地址</text>
        <input class="field__input" :value="groupQr" @input="onGroupQr" placeholder="二维码图片地址" />
      </view>
    </view>

    <!-- 下载配置 -->
    <view class="card">
      <view class="card__title">下载配置</view>
      <view class="field field--row">
        <view class="field__col">
          <text class="field__label">下载奖励广告</text>
          <text class="field__desc">开启后下载可看广告获得免费次数</text>
        </view>
        <view class="toggle" :class="{ 'toggle--on': rewardAdEnabled }" @tap="rewardAdEnabled = !rewardAdEnabled">
          <view class="toggle__knob" />
        </view>
      </view>
      <view class="field">
        <text class="field__label">看广告后免费下载次数</text>
        <input class="field__input narrow" type="number" :value="freeDownloadsAfterAd" @input="onFree" />
      </view>
    </view>

    <view class="save-bar">
      <mc-btn type="primary" :loading="saving" :disabled="saving" @click="onSave">保存配置</mc-btn>
    </view>
  </view>
</template>

<script>
import api from '../../utils/api'
import { toast, showLoading, hideLoading } from '../../utils/format'

export default {
  data() {
    return {
      storeProductsText: '',
      contactEmail: '',
      officialAccountName: '',
      groupQr: '',
      rewardAdEnabled: true,
      freeDownloadsAfterAd: 1,
      saving: false,
    }
  },

  onLoad() {
    this.load()
  },

  methods: {
    async load() {
      try {
        const list = await api.getAppConfigAll()
        const map = {}
        ;(list || []).forEach((it) => { map[it.key] = it.value })
        const store = map.storeProducts
        this.storeProductsText = Array.isArray(store) ? store.join(', ') : ''
        this.contactEmail = map.contactEmail || ''
        this.officialAccountName = map.officialAccountName || ''
        this.groupQr = map.groupQr || ''
        this.rewardAdEnabled = map.rewardAdEnabled !== false
        const dl = map.downloadConfig
        this.freeDownloadsAfterAd = (dl && dl.freeDownloadsAfterAd) || 1
      } catch (err) {
        console.error('[app-config] 加载失败', err)
        toast('加载失败')
      }
    },

    onStore(e) { this.storeProductsText = e.detail.value },
    onEmail(e) { this.contactEmail = e.detail.value },
    onOfficial(e) { this.officialAccountName = e.detail.value },
    onGroupQr(e) { this.groupQr = e.detail.value },
    onFree(e) { this.freeDownloadsAfterAd = Number(e.detail.value) || 0 },

    async onSave() {
      this.saving = true
      showLoading('保存中…')
      try {
        const storeIds = this.storeProductsText.split(/[\s,，]+/).map((s) => s.trim()).filter(Boolean)
        const tasks = [
          api.setAppConfig('storeProducts', storeIds, '微信小店商品ID列表'),
          api.setAppConfig('contactEmail', this.contactEmail, '联系邮箱'),
          api.setAppConfig('officialAccountName', this.officialAccountName, '公众号名称'),
          api.setAppConfig('groupQr', this.groupQr, '粉丝群二维码'),
          api.setAppConfig('rewardAdEnabled', this.rewardAdEnabled, '下载奖励广告开关'),
          api.setAppConfig('downloadConfig', { freeDownloadsAfterAd: this.freeDownloadsAfterAd }, '下载配置'),
        ]
        await Promise.all(tasks)
        hideLoading()
        this.saving = false
        toast('已保存', 'success')
      } catch (err) {
        hideLoading()
        this.saving = false
        console.error('[app-config] 保存失败', err)
        toast('保存失败')
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.app-config-page {
  // padding 由内联 style 控制
}

.card {
  background: var(--bg-card, #FFFFFF);
  border-radius: var(--r-lg, 28rpx);
  padding: 28rpx 32rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--shadow-card, 0 4rpx 16rpx rgba(0, 0, 0, 0.04));
}
.card__title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary, #1A1A2E);
  margin-bottom: 20rpx;
}

.field {
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--divider, #F0F0F5);
}
.field:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.field--row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.field__col {
  flex: 1;
  min-width: 0;
}
.field__label {
  font-size: 28rpx;
  color: var(--text-primary, #1A1A2E);
  font-weight: 500;
}
.field__desc {
  font-size: 22rpx;
  color: var(--text-secondary, #8C8CA1);
  margin-top: 6rpx;
  display: block;
}
.field__input {
  margin-top: 16rpx;
  height: 80rpx;
  background: var(--bg, #F5F6F8);
  border: 1rpx solid var(--border, #EBEBF0);
  border-radius: var(--r-sm, 14rpx);
  padding: 0 24rpx;
  font-size: 28rpx;
  color: var(--text-primary, #1A1A2E);
}
.field__input.area {
  height: 160rpx;
  padding: 20rpx 24rpx;
  line-height: 1.5;
  box-sizing: border-box;
}
.field__input.narrow {
  width: 200rpx;
}

.toggle {
  width: 88rpx;
  height: 48rpx;
  border-radius: 24rpx;
  background: var(--tx3, #B8B8C8);
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
}
.toggle--on {
  background: var(--pri, #07C160);
}
.toggle__knob {
  position: absolute;
  top: 4rpx;
  left: 4rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
}
.toggle--on .toggle__knob {
  transform: translateX(40rpx);
}

.save-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 20rpx 32rpx calc(20rpx + env(safe-area-inset-bottom));
  background: var(--bg-card, #FFFFFF);
  border-top: 1rpx solid var(--divider, #F0F0F5);
  z-index: 50;
}
</style>
