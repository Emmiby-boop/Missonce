<template>
  <view class="page-container detail-page">
    <!-- 加载骨架 -->
    <block v-if="loading">
      <view class="detail-hero">
        <view class="detail-hero__content">
          <mc-skeleton height="144rpx" width="144rpx" radius="50%" style="margin: 0 auto 24rpx;" />
          <mc-skeleton height="38rpx" width="40%" radius="12rpx" style="margin: 0 auto 12rpx;" />
          <mc-skeleton height="24rpx" width="50%" radius="8rpx" style="margin: 0 auto;" />
        </view>
      </view>
      <mc-skeleton height="160rpx" radius="20rpx" style="margin-bottom: 24rpx;" />
      <mc-skeleton height="320rpx" radius="20rpx" style="margin-bottom: 24rpx;" />
      <mc-skeleton height="240rpx" radius="20rpx" />
    </block>

    <!-- 错误状态 -->
    <mc-error
      v-else-if="loadError"
      :text="errorMsg || '加载失败，请稍后重试'"
    >
      <mc-btn type="ghost" size="sm" @click="retryLoad">重试</mc-btn>
    </mc-error>

    <block v-else-if="userInfo">
      <!-- Hero 资料 -->
      <view class="detail-hero">
        <view class="detail-hero__bg"></view>
        <view class="detail-hero__content">
          <view class="detail-avatar-wrap">
            <image v-if="userInfo.avatarUrl" class="detail-avatar" :src="userInfo.avatarUrl" mode="aspectFill" />
            <view v-else class="detail-avatar" :style="{ background: userInfo.avatarColor }">{{ userInfo.initial }}</view>
          </view>
          <view class="detail-name">{{ userInfo.nickName }}</view>
          <view class="detail-id">ID · {{ userInfo.openid || '——' }}</view>
        </view>
      </view>

      <!-- 关键数据三宫格 -->
      <view class="key-stats">
        <view class="key-stat">
          <view class="key-stat__value" :class="'key-stat__value--' + userInfo.memberLevel">{{ userInfo.memberLevelLabel }}</view>
          <view class="key-stat__label">会员等级</view>
        </view>
        <view class="key-stat">
          <view class="key-stat__value">{{ userInfo.points }}</view>
          <view class="key-stat__label">积分余额</view>
        </view>
        <view class="key-stat">
          <view class="key-stat__value key-stat__value--green">{{ userInfo.checkInDays || 0 }}</view>
          <view class="key-stat__label">连续签到</view>
        </view>
      </view>

      <!-- 账户信息卡 -->
      <view class="info-card">
        <view class="info-card__title">账户信息</view>
        <view class="status-grid">
          <view class="status-item">
            <view class="status-item__label">注册时间</view>
            <view class="status-item__value">{{ userInfo.registeredAtText }}</view>
          </view>
          <view class="status-item">
            <view class="status-item__label">最近登录</view>
            <view class="status-item__value">{{ userInfo.lastLoginAtText }}</view>
          </view>
          <view class="status-item">
            <view class="status-item__label">到期时间</view>
            <view class="status-item__value">
              <text class="badge" :class="userInfo.expireBadgeClass" v-if="userInfo.expireBadgeClass">{{ userInfo.expireDateText }}</text>
              <text v-else>{{ userInfo.expireDateText }}</text>
            </view>
          </view>
          <view class="status-item">
            <view class="status-item__label">免广告</view>
            <view class="status-item__value">
              <text class="badge" :class="userInfo.skipAd ? 'badge--green' : 'badge--gray'">{{ userInfo.skipAdText }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 会员等级编辑 -->
      <view class="info-card">
        <view class="info-card__title">会员等级</view>
        <view class="level-picker">
          <view
            class="level-option"
            :class="{ 'level-option--active': editForm.memberLevel === item.value }"
            v-for="item in memberLevels"
            :key="item.value"
            @tap="onLevelOptionTap(item.value)"
          >
            <view class="level-option__name">{{ item.label }}</view>
            <view class="level-option__days">{{ item.days > 0 ? item.days + ' 天' : (item.value === 'lifetime' ? '永久' : '—') }}</view>
          </view>
        </view>

        <!-- 当前选择提示 -->
        <view class="level-hint" :class="'level-hint--' + editForm.memberLevel">
          <text>当前选择：{{ editForm.memberLevelLabel }}</text>
          <text class="level-hint__sub" v-if="editForm.memberLevel === 'lifetime'">· 永久有效</text>
          <text class="level-hint__sub" v-else-if="editForm.memberLevel === 'none'">· 无会员权益</text>
          <text class="level-hint__sub" v-else>· 到期 {{ editForm.memberExpireDate || '自动计算' }}</text>
        </view>

        <!-- 到期时间 picker（非终身/非会员时显示） -->
        <view class="expire-picker-row" v-if="showExpireDate">
          <text class="expire-picker-row__label">到期时间</text>
          <picker mode="date" :value="editForm.memberExpireDate" @change="onExpireDateChange">
            <view class="expire-picker">
              <text class="expire-picker__text" :class="{ 'expire-picker__placeholder': !editForm.memberExpireDate }">{{ editForm.memberExpireDate || '留空自动计算' }}</text>
              <text class="expire-picker__arrow">›</text>
            </view>
          </picker>
        </view>
      </view>

      <!-- 其他设置 -->
      <view class="info-card">
        <view class="info-card__title">其他设置</view>

        <!-- 积分余额 -->
        <view class="form-row">
          <view class="form-row__left">
            <view class="form-row__label">积分余额</view>
            <view class="form-row__hint">留空不修改</view>
          </view>
          <input
            class="form-row__input"
            type="number"
            placeholder="不修改"
            :value="editForm.points"
            @input="onPointsInput"
            adjust-position="true"
            cursor-spacing="20"
          />
        </view>

        <!-- 跳过广告开关 -->
        <view class="form-row">
          <view class="form-row__left">
            <view class="form-row__label">跳过广告</view>
            <view class="form-row__hint">调试用 · 无需观看广告</view>
          </view>
          <mc-toggle :model-value="editForm.skipAd" @change="onToggleSkipAd" />
        </view>

        <!-- 重置下载广告状态 -->
        <view class="form-row form-row--tap" @tap="onResetAd">
          <view class="form-row__left">
            <view class="form-row__label">重置下载广告</view>
            <view class="form-row__hint">清除今日免费下载记录</view>
          </view>
          <view class="form-row__value">
            <text class="form-row__value-text" :class="{ 'form-row__value-text--warn': true }">{{ resettingAd ? '重置中…' : '重置' }}</text>
            <text class="form-row__arrow">›</text>
          </view>
        </view>
      </view>
    </block>

    <!-- 底部保存栏 -->
    <mc-bottom-bar v-if="!loading && !loadError && userInfo" :style="keyboardHeight ? 'transform: translateY(-' + keyboardHeight + 'px)' : ''">
      <mc-btn type="primary" block :loading="saving" :disabled="saving" @click="onSave">
        保存修改
      </mc-btn>
    </mc-bottom-bar>
  </view>
</template>

<script>
import api from '../../utils/api'
import logger from '../../utils/logger'
import { getInitial, getAvatarColor, toast, showLoading, hideLoading } from '../../utils/format'

const MEMBER_LEVELS = [
  { value: 'none', label: '非会员', badge: 'badge--gray', days: 0 },
  { value: 'weekly', label: '周卡', badge: 'badge--yellow', days: 7 },
  { value: 'monthly', label: '月卡', badge: 'badge--green', days: 30 },
  { value: 'quarterly', label: '季卡', badge: 'badge--cyan', days: 90 },
  { value: 'yearly', label: '年卡', badge: 'badge--blue', days: 365 },
  { value: 'lifetime', label: '终身', badge: 'badge--purple', days: -1 },
]

const MEMBER_LEVEL_MAP = {}
MEMBER_LEVELS.forEach((m) => { MEMBER_LEVEL_MAP[m.value] = m })

// 到期状态对应的 badge 颜色
function getExpireBadgeClass(date, level) {
  if (level === 'lifetime') return 'badge--purple'
  if (level === 'none') return ''
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  const diff = d.getTime() - Date.now()
  if (diff < 0) return 'badge--red'
  if (diff <= 7 * 24 * 60 * 60 * 1000) return 'badge--yellow'
  return 'badge--green'
}

export default {
  data() {
    return {
      loading: true,
      userId: '',
      user: null,
      userInfo: null,
      loadError: false,
      errorMsg: '',
      editForm: {
        memberLevel: 'none',
        memberLevelLabel: '非会员',
        memberExpireDate: '',
        points: '',
        skipAd: false,
      },
      showExpireDate: false,
      memberLevels: MEMBER_LEVELS,
      saving: false,
      resettingAd: false,
      keyboardHeight: 0,
    }
  },

  onLoad(options) {
    const userId = options.id ? decodeURIComponent(options.id) : ''
    this.userId = userId
    this.loadUser(userId)

    if (uni.onKeyboardHeightChange) {
      this._onKeyboard = (res) => { this.keyboardHeight = res.height || 0 }
      uni.onKeyboardHeightChange(this._onKeyboard)
    }
  },

  onUnload() {
    if (uni.offKeyboardHeightChange && this._onKeyboard) {
      uni.offKeyboardHeightChange(this._onKeyboard)
    }
  },

  methods: {
    async loadUser(userId) {
      if (!userId) {
        toast('用户 ID 缺失')
        this.loading = false
        this.loadError = true
        this.errorMsg = '用户 ID 缺失'
        return
      }
      this.loading = true
      this.loadError = false
      try {
        const user = await api.getUserDetail(userId)
        if (!user) {
          toast('未找到用户')
          this.loading = false
          this.loadError = true
          this.errorMsg = '未找到该用户'
          return
        }
        this.fillUser(user)
      } catch (err) {
        logger.error('[user-detail] 加载失败', err)
        this.loadError = true
        this.errorMsg = err.message || '加载失败，请稍后重试'
        toast('加载失败')
      } finally {
        this.loading = false
      }
    },

    retryLoad() {
      this.loadUser(this.userId)
    },

    fillUser(u) {
      // 优先使用进入页面时传入的 userId（url 参数），其次用 API 返回的 _openid/_id
      const openid = this.userId || u._openid || u._id || ''
      const level = u.memberLevel || 'none'
      const levelInfo = MEMBER_LEVEL_MAP[level] || MEMBER_LEVEL_MAP.none
      const name = u.nickName || '匿名用户'
      const expireDateText = this.formatExpireDate(u.memberExpireDate, level)
      this.user = u
      this.userInfo = {
        _openid: openid,
        openid: openid || '',
        nickName: name,
        avatarUrl: u.avatarUrl || '',
        initial: getInitial(name),
        avatarColor: getAvatarColor(name),
        registeredAtText: this.formatDateOnly(u.registeredAt),
        lastLoginAtText: this.formatRelativeTime(u.lastLoginAt),
        points: u.points || 0,
        checkInDays: u.checkInDays || 0,
        memberLevel: level,
        memberLevelLabel: levelInfo.label,
        expireDateText: expireDateText,
        expireBadgeClass: getExpireBadgeClass(u.memberExpireDate, level),
        skipAd: !!u.skipAd,
        skipAdText: u.skipAd ? '已开启' : '正常',
      }
      this.editForm = {
        memberLevel: level,
        memberLevelLabel: levelInfo.label,
        memberExpireDate: '',
        points: '',
        skipAd: !!u.skipAd,
      }
      this.showExpireDate = level !== 'none' && level !== 'lifetime'
    },

    formatDateOnly(ts) {
      if (!ts) return '-'
      const date = new Date(ts)
      if (isNaN(date.getTime())) return '-'
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return y + '-' + m + '-' + d
    },

    formatRelativeTime(ts) {
      if (!ts) return '暂无记录'
      const date = new Date(ts)
      if (isNaN(date.getTime())) return '暂无记录'
      const diff = Date.now() - date.getTime()
      if (diff < 0) return '刚刚'
      const ONE_DAY = 24 * 60 * 60 * 1000
      const day = Math.floor(diff / ONE_DAY)
      if (day === 0) {
        const h = String(date.getHours()).padStart(2, '0')
        const min = String(date.getMinutes()).padStart(2, '0')
        return '今日 ' + h + ':' + min
      }
      if (day === 1) return '昨日'
      if (day < 7) return day + ' 天前'
      if (day < 30) return Math.floor(day / 7) + ' 周前'
      return this.formatDateOnly(ts)
    },

    formatExpireDate(date, level) {
      if (level === 'lifetime') return '永久'
      if (!date) return '-'
      const d = new Date(date)
      if (isNaN(d.getTime())) return '-'
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return y + '-' + m + '-' + day
    },

    calcExpireDate(days) {
      const d = new Date()
      d.setDate(d.getDate() + days)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return y + '-' + m + '-' + day
    },

    onLevelOptionTap(levelValue) {
      const level = MEMBER_LEVEL_MAP[levelValue]
      if (!level) return
      this.editForm.memberLevel = level.value
      this.editForm.memberLevelLabel = level.label
      if (level.value === 'none' || level.value === 'lifetime') {
        this.editForm.memberExpireDate = ''
        this.showExpireDate = false
      } else {
        this.showExpireDate = true
        if (!this.editForm.memberExpireDate) {
          this.editForm.memberExpireDate = this.calcExpireDate(level.days)
        }
      }
    },

    onExpireDateChange(e) {
      this.editForm.memberExpireDate = e.detail.value
    },

    onPointsInput(e) {
      this.editForm.points = e.detail.value
    },

    onToggleSkipAd(val) {
      this.editForm.skipAd = typeof val === 'boolean' ? val : !this.editForm.skipAd
    },

    async onResetAd() {
      const userId = this.userId
      if (!userId || this.resettingAd) return
      this.resettingAd = true
      showLoading('重置中…')
      try {
        const res = await api.resetWatchAdCount(userId)
        hideLoading()
        const msg = (res && (res.message || res.msg)) || '重置成功'
        toast(msg, 'success')
      } catch (err) {
        logger.error('[user-detail] 重置广告失败', err)
        hideLoading()
        toast('重置失败')
      } finally {
        this.resettingAd = false
      }
    },

    async onSave() {
      const form = this.editForm
      const userId = this.userId
      if (!userId) return

      this.saving = true
      showLoading('保存中…')
      try {
        const params = {
          userOpenid: userId,
          memberLevel: form.memberLevel,
          skipAd: form.skipAd,
        }
        if (form.memberExpireDate && form.memberLevel !== 'none' && form.memberLevel !== 'lifetime') {
          params.memberExpireDate = form.memberExpireDate
        }
        if (form.points !== '' && Number(form.points) >= 0) {
          params.points = Number(form.points)
        }
        await api.updateMembership(params)
        hideLoading()
        toast('保存成功', 'success')
        setTimeout(() => uni.navigateBack(), 600)
      } catch (err) {
        logger.error('[user-detail] 保存失败', err)
        hideLoading()
        toast('保存失败')
      } finally {
        this.saving = false
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.detail-page {
  padding-bottom: 180rpx;
}

/* ============== Hero 资料 ============== */
.detail-hero {
  background: var(--bg-card);
  border-radius: var(--r-lg);
  padding: 56rpx 32rpx 40rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--shadow-card);
  position: relative;
  overflow: hidden;
}

.detail-hero__bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 200rpx;
  background: linear-gradient(135deg, var(--pri) 0%, var(--info) 100%);
  opacity: 0.08;
  pointer-events: none;
}

.detail-hero__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.detail-avatar-wrap {
  position: relative;
  margin-bottom: 24rpx;
}

.detail-avatar {
  width: 144rpx;
  height: 144rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 56rpx;
  font-weight: 700;
  border: 6rpx solid var(--bg-card);
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
}

.detail-name {
  font-size: 38rpx;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 12rpx;
}

.detail-id {
  font-size: 22rpx;
  color: var(--text-tertiary);
  font-family: monospace;
  background: var(--divider);
  padding: 6rpx 16rpx;
  border-radius: 12rpx;
  word-break: break-all;
  max-width: 90%;
  text-align: center;
  line-height: 1.5;
}

/* ============== 关键数据三宫格 ============== */
.key-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rpx;
  background: var(--divider);
  border-radius: var(--r-md);
  overflow: hidden;
  margin-bottom: 24rpx;
  box-shadow: var(--shadow-card);
}

.key-stat {
  background: var(--bg-card);
  padding: 32rpx 16rpx;
  text-align: center;
}

.key-stat__value {
  font-size: 44rpx;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
  font-variant-numeric: tabular-nums;
  margin-bottom: 12rpx;
}

.key-stat__value--green {
  color: var(--pri);
}

.key-stat__value--purple {
  color: var(--purple);
}

.key-stat__value--weekly {
  color: var(--warning-d);
}

.key-stat__value--monthly {
  color: var(--pri-d);
}

.key-stat__value--quarterly {
  color: var(--info);
}

.key-stat__value--yearly {
  color: var(--info);
}

.key-stat__value--lifetime {
  color: var(--purple);
}

.key-stat__value--none {
  color: var(--text-secondary);
  font-size: 36rpx;
}

.key-stat__label {
  font-size: 22rpx;
  color: var(--text-secondary);
}

/* ============== 信息卡通用 ============== */
.info-card {
  background: var(--bg-card);
  border-radius: var(--r-md);
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--shadow-card);
}

.info-card__title {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 28rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.info-card__title::before {
  content: '';
  width: 6rpx;
  height: 24rpx;
  background: var(--pri);
  border-radius: var(--r-pill);
}

/* ============== 账户信息状态网格 ============== */
.status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24rpx;
}

.status-item {
  background: var(--bg-page);
  border-radius: var(--r-sm);
  padding: 24rpx;
}

.status-item__label {
  font-size: 22rpx;
  color: var(--text-secondary);
  margin-bottom: 12rpx;
}

.status-item__value {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 12rpx;
}

/* ============== 会员等级网格选择器 ============== */
.level-picker {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.level-option {
  padding: 20rpx 16rpx;
  border-radius: var(--r-sm);
  background: var(--bg-page);
  text-align: center;
  border: 4rpx solid transparent;
  transition: all 0.2s;
}

.level-option--active {
  background: var(--pri-l);
  border-color: var(--pri);
}

.level-option__name {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4rpx;
}

.level-option__days {
  font-size: 20rpx;
  color: var(--text-tertiary);
}

.level-hint {
  padding: 20rpx 24rpx;
  border-radius: var(--r-sm);
  font-size: 24rpx;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-wrap: wrap;
}

.level-hint--none {
  background: var(--divider);
  color: var(--text-secondary);
}

.level-hint--weekly {
  background: var(--warning-l);
  color: var(--warning-d);
}

.level-hint--monthly {
  background: var(--pri-l);
  color: var(--pri-d);
}

.level-hint--quarterly {
  background: var(--info-l);
  color: var(--info);
}

.level-hint--yearly {
  background: var(--info-l);
  color: var(--info);
}

.level-hint--lifetime {
  background: linear-gradient(135deg, var(--purple-l), var(--pink-l));
  color: var(--purple);
}

.level-hint__sub {
  font-weight: 400;
  opacity: 0.85;
}

/* 到期时间 picker 行 */
.expire-picker-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20rpx;
  padding: 20rpx 24rpx;
  background: var(--bg-page);
  border-radius: var(--r-sm);
}

.expire-picker-row__label {
  font-size: 26rpx;
  color: var(--text-primary);
  font-weight: 500;
}

.expire-picker {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.expire-picker__text {
  font-size: 26rpx;
  color: var(--text-primary);
}

.expire-picker__placeholder {
  color: var(--text-tertiary);
}

.expire-picker__arrow {
  font-size: 32rpx;
  color: var(--text-tertiary);
  line-height: 1;
}

/* ============== 其他设置行式表单 ============== */
.form-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 0;
  border-bottom: 1rpx solid var(--divider);
  gap: 24rpx;
}

.form-row:last-child {
  border-bottom: none;
}

.form-row--tap {
  cursor: pointer;
}

.form-row--tap:active {
  background: var(--divider);
  margin: 0 -32rpx;
  padding-left: 32rpx;
  padding-right: 32rpx;
}

.form-row__left {
  flex: 1;
  min-width: 0;
}

.form-row__label {
  font-size: 28rpx;
  color: var(--text-primary);
  font-weight: 500;
}

.form-row__hint {
  font-size: 22rpx;
  color: var(--text-tertiary);
  margin-top: 6rpx;
  line-height: 1.4;
}

.form-row__input {
  border: none;
  background: var(--bg-page);
  font-size: 28rpx;
  color: var(--text-primary);
  text-align: right;
  outline: none;
  width: 200rpx;
  height: 64rpx;
  border-radius: var(--r-sm);
  padding: 0 20rpx;
}

.form-row__value {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-shrink: 0;
}

.form-row__value-text {
  font-size: 28rpx;
  color: var(--text-secondary);
}

.form-row__value-text--warn {
  color: var(--warning-d);
  font-weight: 500;
}

.form-row__arrow {
  color: var(--text-tertiary);
  font-size: 32rpx;
  line-height: 1;
}

/* ============== Badge ============== */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 6rpx 16rpx;
  border-radius: var(--r-pill);
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.2;
}

.badge--gray {
  background: var(--divider);
  color: var(--text-secondary);
}

.badge--green {
  background: var(--pri-l);
  color: var(--pri-d);
}

.badge--yellow {
  background: var(--warning-l);
  color: var(--warning-d);
}

.badge--cyan {
  background: var(--info-l);
  color: var(--info);
}

.badge--blue {
  background: var(--info-l);
  color: var(--info);
}

.badge--purple {
  background: var(--purple-l);
  color: var(--purple);
}

.badge--red {
  background: var(--danger-l);
  color: var(--danger);
}
</style>
