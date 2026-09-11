<template>
  <view class="login-page">
    <!-- 背景装饰 -->
    <view class="login-bg">
      <view class="login-bg__circle login-bg__circle--1" />
      <view class="login-bg__circle login-bg__circle--2" />
    </view>

    <!-- 顶部 Logo 区域 -->
    <view class="login-header" :style="{ paddingTop: statusBarHeight + 100 + 'rpx' }">
      <view class="login-logo">
        <text class="login-logo__text">M</text>
      </view>
      <view class="login-title">Missonce Admin</view>
      <view class="login-subtitle">移动管理后台</view>
    </view>

    <!-- 登录方式切换 -->
    <mc-seg
      class="login-seg"
      :model-value="mode"
      :options="[{ label: '账号登录', value: 'account' }, { label: '邮箱登录', value: 'email' }]"
      @change="switchMode"
    />

    <!-- 登录表单 -->
    <view class="login-form">
      <block v-if="mode === 'account'">
        <mc-input
          v-model="username"
          label="用户名"
          type="text"
          placeholder="请输入管理员账号"
          confirm-type="next"
        />

        <view class="input-group">
          <view class="input-label">密码</view>
          <view class="input-wrapper">
            <input
              class="input-field"
              :password="!showPassword"
              placeholder="请输入密码"
              placeholder-class="input-placeholder"
              :value="password"
              auto-capitalize="off"
              :auto-correct="false"
              :spellcheck="false"
              @input="onPasswordInput"
              confirm-type="go"
              @confirm="handleLogin"
            />
            <view class="input-suffix" @tap="togglePassword">
              <view class="input-suffix__icon" :style="{ backgroundImage: eyeIconBg }" />
            </view>
          </view>
        </view>

        <!-- 记住密码 -->
        <view class="remember-row" @tap="toggleRemember">
          <view class="remember-checkbox" :class="{ checked: rememberPwd }">
            <view v-if="rememberPwd" class="remember-tick" />
          </view>
          <text class="remember-label">记住密码</text>
        </view>
      </block>

      <block v-else>
        <mc-input
          v-model="email"
          label="邮箱"
          type="text"
          placeholder="请输入管理员绑定邮箱"
          confirm-type="next"
        />

        <view class="input-group">
          <view class="input-label">验证码</view>
          <view class="input-wrapper input-wrapper--code">
            <input
              class="input-field"
              type="number"
              maxlength="6"
              placeholder="请输入 6 位验证码"
              placeholder-class="input-placeholder"
              :value="code"
              auto-capitalize="off"
              :auto-correct="false"
              :spellcheck="false"
              @input="onCodeInput"
              confirm-type="go"
              @confirm="handleLogin"
            />
            <view
              class="code-btn"
              :class="{ 'code-btn--disabled': sending || countdown > 0 }"
              @tap="sendCode"
            >{{ countdown > 0 ? countdown + 's' : '获取验证码' }}</view>
          </view>
        </view>
        <view class="login-tip">
          验证码 5 分钟内有效
          <block v-if="devCode">（开发模式，本次验证码：{{ devCode }}）</block>
          <block v-else>，将发送至绑定邮箱</block>
        </view>
      </block>

      <mc-btn
        class="login-btn"
        :loading="loading"
        block
        @click="handleLogin"
      >{{ loading ? '登录中…' : '登 录' }}</mc-btn>
    </view>

    <!-- 底部信息 -->
    <view class="login-footer">
      <text class="login-footer__text">仅限管理员使用 · v2.1.0</text>
    </view>
  </view>
</template>

<script>
import { loginByAccount, loginByEmail, sendEmailCode } from '../../utils/cloud'
import { toast, showLoading, hideLoading } from '../../utils/format'
import { makeIcon } from '../../utils/icons'
import storage from '../../utils/storage'
import appGlobal from '../../utils/app-global'

const REMEMBER_KEY = 'admin_remember_cred'

export default {
  data() {
    return {
      mode: 'account', // 'account' | 'email'
      username: '',
      password: '',
      email: '',
      code: '',
      devCode: '',
      loading: false,
      sending: false,
      countdown: 0,
      showPassword: false,
      rememberPwd: false,
      statusBarHeight: 20,
      eyeOpenIcon: makeIcon('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>', '#B8B8C8'),
      eyeOffIcon: makeIcon('<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/>', '#B8B8C8')
    }
  },

  onLoad() {
    const sysInfo = (uni.getWindowInfo && uni.getWindowInfo()) || uni.getSystemInfoSync()
    this.statusBarHeight = (sysInfo.statusBarHeight || 20)
    try {
      const saved = storage.get(REMEMBER_KEY)
      if (saved && saved.username) {
        this.username = saved.username
        this.password = saved.password || ''
        this.rememberPwd = true
      }
    } catch (e) {}
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer)
  },

  computed: {
    // 微信小程序 <image> 不支持 SVG data URI，改用 background-image（WXSS 支持）
    eyeIconBg() {
      const uri = this.showPassword ? this.eyeOpenIcon : this.eyeOffIcon
      return `url('${uri}')`
    }
  },

  methods: {
    switchMode(val) {
      if (this._timer) {
        clearInterval(this._timer)
        this._timer = null
      }
      this.mode = val
      this.code = ''
      this.email = ''
      this.devCode = ''
      this.countdown = 0
    },

    onPasswordInput(e) {
      this.password = e.detail.value
    },

    onCodeInput(e) {
      this.code = e.detail.value
    },

    togglePassword() {
      this.showPassword = !this.showPassword
    },

    toggleRemember() {
      const next = !this.rememberPwd
      this.rememberPwd = next
      if (!next) {
        try { storage.remove(REMEMBER_KEY) } catch (e) {}
      }
    },

    async sendCode() {
      const { mode, email, sending, countdown } = this
      if (sending || countdown > 0) return
      if (mode !== 'email') return
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        toast('请输入正确的邮箱')
        return
      }

      this.sending = true
      try {
        const res = await sendEmailCode(email.trim())
        if (res && res.smtpError === '' && res.devCode === '') {
          toast('验证码已发送至邮箱，请查收', 'success')
        } else if (res && res.devCode) {
          uni.showToast({ title: `验证码：${res.devCode}`, icon: 'none', duration: 3000 })
          this.devCode = res.devCode
          if (res.smtpError && res.smtpError !== 'SMTP_NOT_CONFIGURED') {
            setTimeout(() => {
              toast('邮件发送失败: ' + res.smtpError)
            }, 3500)
          }
        } else {
          toast(res && res.message ? res.message : '验证码已发送', 'success')
        }
        this.countdown = 60
        this._timer = setInterval(() => {
          const c = this.countdown - 1
          if (c <= 0) {
            clearInterval(this._timer)
            this._timer = null
            this.countdown = 0
          } else {
            this.countdown = c
          }
        }, 1000)
      } catch (err) {
        toast(err.message || '获取验证码失败')
      } finally {
        this.sending = false
      }
    },

    async handleLogin() {
      const { mode, username, password, email, code } = this

      if (mode === 'account') {
        if (!username.trim()) { toast('请输入用户名'); return }
        if (!password) { toast('请输入密码'); return }
      } else if (mode === 'email') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { toast('请输入正确的邮箱'); return }
        if (!/^\d{6}$/.test(code.trim())) { toast('请输入 6 位验证码'); return }
      }

      this.loading = true
      showLoading('登录中…')

      try {
        if (mode === 'account') {
          await loginByAccount(username.trim(), password)
          if (this.rememberPwd) {
            try { storage.set(REMEMBER_KEY, { username: username.trim(), password: password }) } catch (e) {}
          } else {
            try { storage.remove(REMEMBER_KEY) } catch (e) {}
          }
        } else {
          await loginByEmail(email.trim(), code.trim())
        }
        hideLoading()
        toast('登录成功', 'success')
        setTimeout(() => {
          uni.reLaunch({ url: '/pages/dashboard/dashboard' })
        }, 500)
      } catch (err) {
        hideLoading()
        // CloudBase SDK 错误可能是 { errCode, errMsg } 格式（无 message），需兼容
        console.error('[login] 登录失败完整错误:', JSON.stringify(err), err)
        let msg = err.message || err.errMsg || err.msg || ''
        if (!msg) {
          // 兜底：根据 errCode 给出可读提示
          const code = err.errCode != null ? err.errCode : err.code
          if (code != null) {
            msg = '登录失败（错误码 ' + code + '）'
          } else {
            msg = '登录失败，请检查账号密码'
          }
        }
        if (err.debug && err.debug.existingEmails && err.debug.existingEmails.length > 0) {
          msg += `\n（已存在的邮箱：${err.debug.existingEmails.join(', ')}）`
        }
        toast(msg)
        if (err.debug) console.log('[login-debug]', JSON.stringify(err.debug))
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  background: #F5F6F8;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

@media (prefers-color-scheme: dark) {
  .login-page { background: #0F1117; }
}

.login-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 600rpx;
  overflow: hidden;
  pointer-events: none;
}

.login-bg__circle {
  position: absolute;
  border-radius: 50%;
  filter: blur(80rpx);
  opacity: 0.3;
}

.login-bg__circle--1 {
  width: 400rpx;
  height: 400rpx;
  background: #07C160;
  top: -100rpx;
  right: -80rpx;
}

.login-bg__circle--2 {
  width: 300rpx;
  height: 300rpx;
  background: #10AEFF;
  top: 200rpx;
  left: -100rpx;
  opacity: 0.15;
}

.login-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 60rpx;
  position: relative;
  z-index: 1;
}

.login-logo {
  width: 128rpx;
  height: 128rpx;
  border-radius: 32rpx;
  background: linear-gradient(135deg, #07C160, #06AD56);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12rpx 32rpx rgba(7, 193, 96, 0.3);
  margin-bottom: 24rpx;
}

.login-logo__text {
  font-size: 64rpx;
  font-weight: 800;
  color: #fff;
}

.login-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #1A1A2E;
  letter-spacing: 1rpx;
}

@media (prefers-color-scheme: dark) {
  .login-title { color: #E8E8ED; }
}

.login-subtitle {
  font-size: 26rpx;
  color: #8C8CA1;
  margin-top: 8rpx;
}

.login-form {
  padding: 0 64rpx;
  position: relative;
  z-index: 1;
}

/* 密码 / 验证码 输入框（带后缀按钮，用原生 input 以保证 password 切换稳定） */
.input-group { margin-bottom: 36rpx; }
.input-label {
  font-size: 26rpx;
  color: #8C8CA1;
  margin-bottom: 16rpx;
  font-weight: 500;
}
.input-wrapper {
  display: flex;
  align-items: center;
  background: #FFFFFF;
  border: 1rpx solid #EBEBF0;
  border-radius: 16rpx;
  padding: 0 28rpx;
  height: 96rpx;
  transition: border-color 0.2s;
}
.input-wrapper:focus-within { border-color: #07C160; }
@media (prefers-color-scheme: dark) {
  .input-wrapper { background: #1A1D28; border-color: #2A2E3A; }
}
.input-field {
  flex: 1;
  height: 96rpx;
  font-size: 30rpx;
  color: #1A1A2E;
}
@media (prefers-color-scheme: dark) {
  .input-field { color: #E8E8ED; }
}
.input-placeholder { color: #B8B8C8; font-size: 28rpx; }
.input-suffix { padding: 16rpx; display: flex; align-items: center; }
.input-suffix__icon {
  width: 36rpx;
  height: 36rpx;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
}

.login-btn {
  margin-top: 20rpx;
}

.login-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 40rpx 0 calc(40rpx + env(safe-area-inset-bottom));
  text-align: center;
}
.login-footer__text {
  font-size: 22rpx;
  color: #B8B8C8;
}

.login-seg {
  display: block;
  margin: 0 64rpx 40rpx;
  position: relative;
  z-index: 1;
}

.login-tip {
  font-size: 24rpx;
  color: #8C8CA1;
  margin: -12rpx 0 36rpx;
  padding-left: 4rpx;
}

.remember-row {
  display: flex;
  align-items: center;
  margin: -8rpx 0 28rpx;
  padding-left: 4rpx;
}
.remember-checkbox {
  width: 36rpx;
  height: 36rpx;
  border-radius: 8rpx;
  border: 2rpx solid #C8C8D6;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
@media (prefers-color-scheme: dark) {
  .remember-checkbox { background: #1C1E26; border-color: #3A3D4A; }
}
.remember-checkbox.checked {
  background: #07C160;
  border-color: #07C160;
}
.remember-tick {
  width: 14rpx;
  height: 8rpx;
  border-left: 4rpx solid #fff;
  border-bottom: 4rpx solid #fff;
  transform: rotate(-45deg) translate(2rpx, -2rpx);
}
.remember-label {
  font-size: 26rpx;
  color: #8C8CA1;
  margin-left: 12rpx;
}

.input-wrapper--code { padding-right: 12rpx; }
.code-btn {
  flex: none;
  height: 60rpx;
  padding: 0 24rpx;
  border-radius: 12rpx;
  background: #E8F8EE;
  color: #07C160;
  font-size: 26rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.code-btn:active { background: #D2F0DD; }
.code-btn--disabled {
  background: #F0F0F5;
  color: #B8B8C8;
}
@media (prefers-color-scheme: dark) {
  .code-btn { background: rgba(7, 193, 96, 0.18); color: #2BD07E; }
  .code-btn--disabled { background: #1A1D28; color: #5A5F70; }
}
</style>
