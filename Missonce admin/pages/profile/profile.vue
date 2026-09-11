<template>
  <view class="page-container profile-page">
    <!-- 资料头部 -->
    <view class="profile-header">
      <view class="profile-header__avatar">
        <image v-if="admin && admin.avatarUrl" class="profile-header__avatar-img" :src="admin.avatarUrl" mode="aspectFill" />
        <text v-else>{{ initial }}</text>
      </view>
      <view class="profile-header__info">
        <view class="profile-header__name">{{ (admin && admin.username) || 'Admin' }}</view>
        <view class="profile-header__role">{{ (admin && admin.role === 'super') ? '超级管理员' : '管理员' }}</view>
      </view>
    </view>

    <!-- 错误态：登录信息缺失 -->
    <mc-error v-if="!admin" text="登录状态已失效，请重新登录" @retry="onRelogin" />

    <block v-else>
      <!-- 修改密码 -->
      <view v-if="type === 'password'" class="card card--padded form-card">
        <view class="form-title">
          <mc-icon :path="icons.lock" color="#07C160" :size="32" />
          <text>修改密码</text>
        </view>

        <view class="input-group">
          <text class="input-label">原密码</text>
          <view class="pwd-input-wrap">
            <input
              class="input pwd-input"
              :type="showOld ? 'text' : 'password'"
              v-model="oldPassword"
              placeholder="请输入原密码"
            />
            <view class="pwd-eye" @tap="toggleOld">
              <mc-icon :path="showOld ? icons.eye : icons['eye-off']" color="#B8B8C8" :size="36" />
            </view>
          </view>
        </view>

        <view class="input-group">
          <text class="input-label">新密码</text>
          <view class="pwd-input-wrap">
            <input
              class="input pwd-input"
              :type="showNew ? 'text' : 'password'"
              v-model="newPassword"
              placeholder="至少 6 位"
            />
            <view class="pwd-eye" @tap="toggleNew">
              <mc-icon :path="showNew ? icons.eye : icons['eye-off']" color="#B8B8C8" :size="36" />
            </view>
          </view>
        </view>

        <view class="input-group input-group--last">
          <text class="input-label">确认新密码</text>
          <input
            class="input"
            :type="showNew ? 'text' : 'password'"
            v-model="confirmPassword"
            placeholder="请再次输入新密码"
          />
        </view>
      </view>
      <view v-if="type === 'password'" class="form-tip">密码至少 6 位，建议包含字母与数字</view>

      <!-- 绑定手机 -->
      <view v-else class="card card--padded form-card">
        <view class="form-title">
          <mc-icon :path="icons.phone" color="#5A5A6E" :size="32" />
          <text>绑定手机</text>
        </view>

        <view class="input-group">
          <text class="input-label">当前手机号</text>
          <view class="picker-row picker-row--readonly">
            <text class="picker-value">{{ currentPhone }}</text>
          </view>
        </view>

        <view class="input-group">
          <text class="input-label">新手机号</text>
          <input
            class="input"
            type="number"
            maxlength="11"
            v-model="newPhone"
            placeholder="请输入新手机号"
          />
        </view>

        <view class="input-group input-group--last">
          <text class="input-label">验证码</text>
          <view class="code-row">
            <input
              class="input code-input"
              type="number"
              maxlength="6"
              v-model="code"
              placeholder="请输入验证码"
            />
            <button class="btn btn--ghost btn--sm code-btn" :disabled="sending || countdown > 0" @tap="onSendCode">
              {{ countdown > 0 ? countdown + 's' : (sending ? '发送中' : '发送验证码') }}
            </button>
          </view>
        </view>
      </view>
      <view v-if="type === 'phone'" class="form-tip">更换手机号后需重新验证</view>
    </block>
  </view>

  <!-- 底部保存栏 -->
  <view v-if="admin" class="bottom-bar">
    <button class="btn btn--primary btn--block save-btn" :disabled="saving" @tap="onSave">
      <mc-icon :path="icons.save" color="#FFFFFF" :size="28" />
      <text>{{ saving ? '保存中…' : '保存' }}</text>
    </button>
  </view>
</template>

<script>
import api from '../../utils/api'
import { getAdmin } from '../../utils/cloud'
import appGlobal from '../../utils/app-global'
import { maskPhone, getInitial, toast, showLoading, hideLoading } from '../../utils/format'

// 原始 SVG 路径（统一通过 mc-icon :path + :color 渲染）
const SVG = {
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 1 1-4.24-4.24"/><path d="M1 1l22 22"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
}

export default {
  data() {
    return {
      type: 'password',
      admin: null,
      initial: 'A',
      currentPhone: '未绑定',
      // 密码表单
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
      showOld: false,
      showNew: false,
      saving: false,
      // 手机表单
      newPhone: '',
      code: '',
      sending: false,
      countdown: 0,
      icons: SVG,
    }
  },

  onLoad(options) {
    const type = options.type === 'phone' ? 'phone' : 'password'
    this.type = type
    uni.setNavigationBarTitle({ title: type === 'phone' ? '绑定手机' : '修改密码' })

    const admin = getAdmin()
    if (admin) {
      const username = admin.username || 'Admin'
      this.admin = admin
      this.initial = getInitial(username)
      this.currentPhone = admin.phone ? maskPhone(admin.phone) : '未绑定'
    }
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer)
  },

  /* ─── 密码表单 ─── */
  toggleOld() {
    this.showOld = !this.showOld
  },

  toggleNew() {
    this.showNew = !this.showNew
  },

  async onSavePassword() {
    const { oldPassword, newPassword, confirmPassword } = this
    const username = this.admin ? this.admin.username : ''
    if (!username) {
      toast('登录信息缺失，请重新登录')
      return
    }
    if (!oldPassword) {
      toast('请输入原密码')
      return
    }
    if (!newPassword || newPassword.length < 6) {
      toast('新密码至少 6 位')
      return
    }
    if (newPassword !== confirmPassword) {
      toast('两次密码输入不一致')
      return
    }
    if (newPassword === oldPassword) {
      toast('新密码不能与原密码相同')
      return
    }

    this.saving = true
    showLoading('保存中…')
    try {
      await api.changePassword(username, oldPassword, newPassword)
      hideLoading()
      toast('密码修改成功', 'success')
      this.oldPassword = ''
      this.newPassword = ''
      this.confirmPassword = ''
      setTimeout(() => uni.navigateBack(), 800)
    } catch (err) {
      console.error('[profile] 修改密码失败', err)
      hideLoading()
      toast(err.message || '修改失败，请检查原密码')
    } finally {
      this.saving = false
    }
  },

  /* ─── 手机表单 ─── */
  onSendCode() {
    if (this.sending || this.countdown > 0) return
    const { newPhone } = this
    if (!newPhone || !/^1\d{10}$/.test(newPhone)) {
      toast('请输入正确的手机号')
      return
    }
    this.sending = true
    // 模拟发送验证码（实际需对接短信服务）
    setTimeout(() => {
      this.sending = false
      this.countdown = 60
      toast('验证码已发送', 'success')
      this.startCountdown()
    }, 600)
  },

  startCountdown() {
    this._timer = setInterval(() => {
      if (this.countdown <= 0) {
        clearInterval(this._timer)
        this.countdown = 0
      } else {
        this.countdown = this.countdown - 1
      }
    }, 1000)
  },

  async onSavePhone() {
    const { newPhone, code } = this
    if (!newPhone || !/^1\d{10}$/.test(newPhone)) {
      toast('请输入正确的手机号')
      return
    }
    if (!code || code.length < 4) {
      toast('请输入验证码')
      return
    }

    this.saving = true
    showLoading('保存中…')
    try {
      // 通过管理员更新接口保存手机号（复用现有接口）
      const admin = this.admin || {}
      await api.updateUser(admin._id || admin.id, { phone: newPhone })
      hideLoading()
      toast('手机号更新成功', 'success')
      // 更新本地缓存
      this.admin = { ...admin, phone: newPhone }
      this.currentPhone = maskPhone(newPhone)
      if (appGlobal && typeof appGlobal.setAdmin === 'function') {
        appGlobal.setAdmin(this.admin)
      }
      setTimeout(() => uni.navigateBack(), 800)
    } catch (err) {
      console.error('[profile] 更新手机号失败', err)
      hideLoading()
      toast(err.message || '更新失败')
    } finally {
      this.saving = false
    }
  },

  onSave() {
    if (this.type === 'password') {
      this.onSavePassword()
    } else {
      this.onSavePhone()
    }
  },

  onRelogin() {
    uni.reLaunch({ url: '/pages/login/login' })
  },
}
</script>

<style scoped>
.profile-page {
  padding-bottom: 180rpx;
}

/* 资料头部 */
.profile-header {
  display: flex;
  align-items: center;
  gap: 24rpx;
  background: var(--bg-card);
  border-radius: var(--r-lg);
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--shadow-card);
}

.profile-header__avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: var(--pri);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 38rpx;
  font-weight: 700;
  flex-shrink: 0;
  overflow: hidden;
}

.profile-header__avatar-img {
  width: 100%;
  height: 100%;
}

.profile-header__info {
  flex: 1;
  min-width: 0;
}

.profile-header__name {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.profile-header__role {
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-top: 4rpx;
}

/* 表单卡片 */
.form-card {
  margin-bottom: 16rpx;
}

.form-title {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 28rpx;
}

.input-group--last {
  margin-bottom: 0;
}

/* 密码输入框（带眼睛） */
.pwd-input-wrap {
  position: relative;
}

.pwd-input {
  padding-right: 80rpx;
}

.pwd-eye {
  position: absolute;
  top: 0;
  right: 12rpx;
  height: 88rpx;
  width: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* picker 行 */
.picker-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--r-sm);
  padding: 0 28rpx;
}

.picker-row--readonly {
  background: var(--divider);
}

.picker-value {
  font-size: 28rpx;
  color: var(--text-primary);
}

/* 验证码行 */
.code-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.code-input {
  flex: 1;
}

.code-btn {
  flex-shrink: 0;
  white-space: nowrap;
}

/* 表单提示 */
.form-tip {
  font-size: 22rpx;
  color: var(--text-tertiary);
  padding: 0 8rpx;
}

/* 底部保存按钮（图标 + 文字） */
.save-btn {
  gap: 10rpx;
}

/* ── 深色模式微调 ── */
@media (prefers-color-scheme: dark) {
  .picker-row--readonly {
    background: var(--divider);
  }
}
</style>
