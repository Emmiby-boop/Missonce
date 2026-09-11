<template>
  <view class="page-container points-config-page" style="padding-bottom: calc(180rpx + env(safe-area-inset-bottom));">
    <!-- 说明卡 -->
    <view class="tip-card" v-if="isDefault">
      <mc-icon :path="icons.info" color="#FF9500" :size="32" />
      <text class="tip-card__text">当前为系统默认积分规则，修改后将写入配置并立即生效。</text>
    </view>

    <!-- 配置表单 -->
    <view class="config-card">
      <view class="card-title">辣度值规则</view>
      <view class="field" v-for="f in fields" :key="f.key">
        <view class="field__head">
          <text class="field__label">{{ f.label }}</text>
          <text class="field__suffix">{{ f.suffix }}</text>
        </view>
        <text class="field__desc">{{ f.desc }}</text>
        <input class="field__input" type="number" :value="config[f.key]" @input="onInput(f.key, $event)" :adjust-position="true" cursor-spacing="20" />
      </view>
    </view>

    <!-- 签到统计 -->
    <view class="stats-card" v-if="stats">
      <view class="card-title">近 30 天签到</view>
      <view class="stats-row">
        <view class="stat">
          <text class="stat__num">{{ stats.totalCheckIns }}</text>
          <text class="stat__label">签到人次</text>
        </view>
        <view class="stat">
          <text class="stat__num">{{ stats.avgDaily }}</text>
          <text class="stat__label">日均签到</text>
        </view>
      </view>
    </view>

    <!-- 保存栏 -->
    <view class="save-bar">
      <mc-btn type="primary" :loading="saving" :disabled="saving" @click="onSave">{{ saving ? '保存中…' : '保存配置' }}</mc-btn>
    </view>
  </view>
</template>

<script>
import api from '../../utils/api'
import { toast, showLoading, hideLoading } from '../../utils/format'

const FIELDS = [
  { key: 'checkInReward', label: '签到奖励', desc: '每日签到获得的辣度值', suffix: '分/次' },
  { key: 'shareReward', label: '分享奖励', desc: '每次分享内容获得', suffix: '分/次' },
  { key: 'shareDailyLimit', label: '分享每日上限', desc: '每日分享最多计入次数', suffix: '次/天' },
  { key: 'inviteReward', label: '邀请奖励', desc: '每成功邀请一位好友', suffix: '分/人' },
  { key: 'watchAdPoints', label: '看广告奖励', desc: '每次观看激励视频', suffix: '分/次' },
  { key: 'watchAdDailyLimit', label: '看广告每日上限', desc: '每日观看最多计入次数', suffix: '次/天' },
  { key: 'quoteInterval', label: '文案生成间隔', desc: '两次 AI 文案生成最小间隔', suffix: '秒' },
]

const DEFAULTS = {
  checkInReward: 10,
  shareReward: 10,
  shareDailyLimit: 5,
  inviteReward: 50,
  watchAdPoints: 20,
  watchAdDailyLimit: 15,
  quoteInterval: 7,
}

export default {
  data() {
    return {
      fields: FIELDS,
      config: { ...DEFAULTS },
      isDefault: false,
      stats: null,
      saving: false,
      icons: {
        info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
      },
    }
  },

  onLoad() {
    this.loadConfig()
    this.loadStats()
  },

  methods: {
    async loadConfig() {
      try {
        const data = await api.getPointsConfig()
        if (data) {
          this.config = { ...DEFAULTS, ...data }
          this.isDefault = !!data._isDefault
        }
      } catch (err) {
        console.error('[points-config] 加载配置失败', err)
      }
    },

    async loadStats() {
      try {
        const data = await api.getCheckInStats(30)
        if (data) this.stats = data
      } catch (err) {
        console.error('[points-config] 加载签到统计失败', err)
      }
    },

    onInput(key, e) {
      const val = Number(e.detail.value)
      this.config[key] = isNaN(val) ? 0 : val
    },

    async onSave() {
      this.saving = true
      showLoading('保存中…')
      try {
        const res = await api.updatePointsConfig(this.config)
        hideLoading()
        this.saving = false
        if (res && res.success) {
          this.isDefault = false
          toast('配置已保存', 'success')
        } else {
          toast((res && res.message) || '保存失败')
        }
      } catch (err) {
        hideLoading()
        this.saving = false
        console.error('[points-config] 保存失败', err)
        toast('保存失败')
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.points-config-page {
  // padding 由内联 style 控制，避免被底部保存栏遮挡
}

.tip-card {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  background: #FFF7E8;
  border: 1rpx solid #FFE2B0;
  border-radius: var(--r-lg, 28rpx);
  padding: 24rpx;
  margin-bottom: 24rpx;
}
.tip-card__text {
  font-size: 24rpx;
  color: #B76E00;
  line-height: 1.6;
  flex: 1;
}

.config-card,
.stats-card {
  background: var(--bg-card, #FFFFFF);
  border-radius: var(--r-lg, 28rpx);
  padding: 28rpx 32rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--shadow-card, 0 4rpx 16rpx rgba(0, 0, 0, 0.04));
}

.card-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary, #1A1A2E);
  margin-bottom: 20rpx;
}

.field {
  padding: 24rpx 0;
  border-bottom: 1rpx solid var(--divider, #F0F0F5);
}
.field:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.field__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.field__label {
  font-size: 28rpx;
  color: var(--text-primary, #1A1A2E);
  font-weight: 500;
}
.field__suffix {
  font-size: 22rpx;
  color: var(--text-tertiary, #B8B8C8);
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

.stats-row {
  display: flex;
  gap: 24rpx;
}
.stat {
  flex: 1;
  text-align: center;
  background: var(--bg, #F5F6F8);
  border-radius: var(--r-sm, 14rpx);
  padding: 28rpx 0;
}
.stat__num {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: var(--pri, #07C160);
}
.stat__label {
  font-size: 22rpx;
  color: var(--text-secondary, #8C8CA1);
  margin-top: 8rpx;
  display: block;
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
