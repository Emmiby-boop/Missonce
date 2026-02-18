<template>
  <div class="login-page">
    <!-- Toast Notification -->
    <div v-if="toast.show" class="fixed top-6 left-1/2 transform -translate-x-1/2 z-50">
      <div class="bg-slate-800 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-fade-in-down">
        <svg v-if="toast.type === 'success'" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        <span class="font-medium text-sm">{{ toast.message }}</span>
      </div>
    </div>

    <div class="login-container">
      <div class="brand-section">
        <div class="brand-logo">
          <img src="/logo.svg" alt="Missonce Logo" class="w-full h-full">
        </div>
        <h1 class="brand-title">Missonce</h1>
        <p class="brand-sub">后台管理系统</p>
      </div>

      <div class="login-card glass-panel">
        <div class="card-header">
          <h2 class="card-title">欢迎回来</h2>
          <p class="card-sub">请选择登录方式</p>
        </div>

        <!-- Login Method Tabs -->
        <div class="tabs tabs-boxed mb-6 bg-base-200/50 p-1">
          <a 
            class="tab flex-1 transition-all duration-300" 
            :class="{ 'tab-active !bg-[#07c160] !text-white shadow-sm': loginMethod === 'account' }"
            @click="switchMethod('account')"
          >账号</a>
          <a 
            class="tab flex-1 transition-all duration-300" 
            :class="{ 'tab-active !bg-[#07c160] !text-white shadow-sm': loginMethod === 'phone' }"
            @click="switchMethod('phone')"
          >手机号</a>
          <a 
            class="tab flex-1 transition-all duration-300" 
            :class="{ 'tab-active !bg-[#07c160] !text-white shadow-sm': loginMethod === 'email' }"
            @click="switchMethod('email')"
          >邮箱</a>
        </div>

        <!-- Account Login Form -->
        <form v-if="loginMethod === 'account'" class="login-form" @submit.prevent="handleAccountLogin">
          <div class="form-group">
            <label class="form-label">账号</label>
            <div class="input-wrapper">
              <input
                v-model="username"
                type="text"
                class="input"
                placeholder="请输入用户名"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">密码</label>
            <div class="input-wrapper">
              <input
                v-model="password"
                type="password"
                class="input"
                placeholder="请输入密码"
              />
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-login submit-btn" :class="{ 'btn-loading': loading }" :disabled="loading">
              <span class="btn-text">{{ loading ? "登录中..." : "立即登录" }}</span>
              <svg v-if="loading" class="btn-spinner animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </button>
          </div>
        </form>

        <!-- Phone Login Form -->
        <form v-if="loginMethod === 'phone'" class="login-form" @submit.prevent="handleLogin">
          <div class="form-group">
            <label class="form-label">手机号</label>
            <div class="input-wrapper">
              <input
                v-model="phone"
                type="tel"
                class="input"
                placeholder="请输入手机号"
                maxlength="11"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">验证码</label>
            <div class="input-group">
              <input
                v-model="code"
                type="text"
                class="input"
                placeholder="6位验证码"
                maxlength="6"
              />
              <button
                type="button"
                class="btn-verify verify-btn"
                :class="{ 'btn-sending': isSendingCode || timeRemaining > 0 }"
                :disabled="isSendingCode || timeRemaining > 0"
                @click="sendVerificationCode"
              >
                {{ sendLabel }}
              </button>
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-login submit-btn" :class="{ 'btn-loading': loading }" :disabled="loading">
              <span class="btn-text">{{ loading ? "登录中..." : "立即登录" }}</span>
              <svg v-if="loading" class="btn-spinner animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </button>
          </div>
        </form>

        <!-- Email Login Form -->
        <form v-if="loginMethod === 'email'" class="login-form" @submit.prevent="handleEmailLogin">
          <div class="form-group">
            <label class="form-label">邮箱地址</label>
            <div class="input-wrapper">
              <input
                v-model="email"
                type="email"
                class="input"
                placeholder="请输入管理员邮箱"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">验证码</label>
            <div class="input-group">
              <input
                v-model="emailCode"
                type="text"
                class="input"
                placeholder="验证码"
              />
              <button
                type="button"
                class="btn-verify verify-btn"
                :class="{ 'btn-sending': isSendingEmailCode || emailTimeRemaining > 0 }"
                :disabled="isSendingEmailCode || emailTimeRemaining > 0"
                @click="sendEmailCode"
              >
                {{ emailSendLabel }}
              </button>
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-login submit-btn" :class="{ 'btn-loading': loading }" :disabled="loading">
              <span class="btn-text">{{ loading ? "登录中..." : "立即登录" }}</span>
              <svg v-if="loading" class="btn-spinner animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </button>
          </div>
        </form>

        <div class="card-footer">
          <p class="footer-text">
            还没有账号？
            <a href="/register" class="link">联系管理员添加</a>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, reactive } from "vue";
import { useRouter } from "vue-router";
import { 
  loginWithPhoneCode, 
  sendPhoneCode, 
  sendLoginEmail, 
  verifyEmailLogin,
  loginByAccount
} from "../utils/cloudbase";

const router = useRouter();

// Login Method State
const loginMethod = ref<'phone' | 'email' | 'account'>('account');

// Phone Login State
const phone = ref("");
const code = ref("");
const loading = ref(false);
const isSendingCode = ref(false);
const timeRemaining = ref(0);

// Account Login State
const username = ref("");
const password = ref("");

// Email Login State
const email = ref("");
const emailCode = ref("");
const isSendingEmailCode = ref(false);
const emailTimeRemaining = ref(0);

// Toast State
const toast = reactive({
  show: false,
  message: "",
  type: "success" as "success" | "error"
});

const showToast = (message: string, type: "success" | "error" = "success") => {
  toast.show = true;
  toast.message = message;
  toast.type = type;
  setTimeout(() => {
    toast.show = false;
  }, 3000);
};

// Phone Logic
const sendLabel = computed(() => {
  if (isSendingCode.value) return "发送中...";
  if (timeRemaining.value > 0) return `${timeRemaining.value}s`;
  return "获取验证码";
});

const sendVerificationCode = async () => {
  if (!phone.value || phone.value.length !== 11) {
    showToast("请输入正确的手机号", "error");
    return;
  }

  isSendingCode.value = true;
  try {
    await sendPhoneCode(phone.value);
    startTimer();
    showToast("验证码已发送，请注意查收");
  } catch (error: any) {
    console.error("发送验证码失败", error);
    showToast("发送失败：" + error.message, "error");
  } finally {
    isSendingCode.value = false;
  }
};

const startTimer = () => {
  timeRemaining.value = 60;
  const timer = setInterval(() => {
    timeRemaining.value--;
    if (timeRemaining.value <= 0) {
      clearInterval(timer);
    }
  }, 1000);
};

const handleLogin = async () => {
  if (!phone.value || !code.value) {
    alert("请填写完整信息");
    return;
  }

  loading.value = true;
  try {
    await loginWithPhoneCode(phone.value, code.value);
    router.push("/");
  } catch (error: any) {
    console.error("登录失败", error);
    alert("登录失败：" + error.message);
  } finally {
    loading.value = false;
  }
};

const handleAccountLogin = async () => {
  if (!username.value || !password.value) {
    alert("请填写账号和密码");
    return;
  }
  
  loading.value = true;
  try {
    const res = await loginByAccount(username.value, password.value);
    if (res.success) {
      // Store custom auth session
      localStorage.setItem('custom_admin_auth', JSON.stringify(res.admin));
      router.push("/");
    } else {
      alert(res.message || "登录失败");
    }
  } catch (error: any) {
    console.error("登录失败", error);
    alert("登录失败：" + error.message);
  } finally {
    loading.value = false;
  }
};

// Email Logic
const emailSendLabel = computed(() => {
  if (isSendingEmailCode.value) return "发送中...";
  if (emailTimeRemaining.value > 0) return `${emailTimeRemaining.value}s`;
  return "获取验证码";
});

const sendEmailCode = async () => {
  if (!email.value || !email.value.includes('@')) {
    alert("请输入正确的邮箱地址");
    return;
  }
  
  isSendingEmailCode.value = true;
  try {
    await sendLoginEmail(email.value);
    startEmailTimer();
    alert("验证码已发送，请检查邮箱");
  } catch (error: any) {
    console.error("发送失败", error);
    alert("发送失败：" + error.message);
  } finally {
    isSendingEmailCode.value = false;
  }
};

const startEmailTimer = () => {
  emailTimeRemaining.value = 60;
  const timer = setInterval(() => {
    emailTimeRemaining.value--;
    if (emailTimeRemaining.value <= 0) {
      clearInterval(timer);
    }
  }, 1000);
};

const handleEmailLogin = async () => {
  if (!email.value || !emailCode.value) {
    alert("请填写完整信息");
    return;
  }

  loading.value = true;
  try {
    const res = await verifyEmailLogin(email.value, emailCode.value);
    if (res.success) {
      // 登录成功，保存 admin 信息
      localStorage.setItem('custom_admin_auth', JSON.stringify(res.admin));
      router.push("/");
    } else {
      alert(res.message);
    }
  } catch (error: any) {
    console.error("登录失败", error);
    alert("登录失败：" + error.message);
  } finally {
    loading.value = false;
  }
};

const switchMethod = (method: 'phone' | 'email' | 'account') => {
  loginMethod.value = method;
};
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8f0f8 100%);
  padding: 20px;
  position: relative;
  overflow: hidden;
}

/* 背景装饰 */
.login-page::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(7, 193, 96, 0.08) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.login-page::after {
  content: '';
  position: absolute;
  bottom: -30%;
  left: -15%;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.login-container {
  width: 100%;
  max-width: 460px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  position: relative;
  z-index: 1;
}

.brand-section {
  text-align: center;
}

.brand-logo {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  position: relative;
  overflow: hidden;
}

.brand-title {
  font-size: 28px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 8px;
  letter-spacing: -0.02em;
}

.brand-sub {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
  font-weight: 400;
}

.login-card {
  background: #ffffff;
  padding: 48px 40px;
  border-radius: 24px;
  box-shadow: 0 20px 40px -4px rgba(0, 0, 0, 0.08), 0 8px 16px -4px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(229, 231, 235, 0.5);
  backdrop-filter: blur(10px);
  position: relative;
  overflow: hidden;
}

.login-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #07c160 0%, #059a4e 50%, #07c160 100%);
  background-size: 200% 100%;
  animation: gradient-shift 3s ease infinite;
}

@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.card-header {
  margin-bottom: 36px;
  text-align: center;
}

.card-title {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 8px;
  letter-spacing: -0.01em;
}

.card-sub {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.form-group {
  margin-bottom: 24px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 10px;
  letter-spacing: 0.01em;
}

.input-wrapper,
.input-group {
  position: relative;
}

.input {
  width: 100%;
  padding: 14px 16px;
  border-radius: 12px;
  border: 2px solid #e5e7eb;
  background-color: #fafbfc;
  color: #1f2937;
  font-size: 15px;
  font-weight: 400;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.input:hover {
  border-color: #d1d5db;
  background-color: #ffffff;
}

.input:focus {
  outline: none;
  border-color: #07c160;
  background-color: #ffffff;
  box-shadow: 0 0 0 4px rgba(7, 193, 96, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1);
}

.input::placeholder {
  color: #9ca3af;
  font-weight: 400;
}

.input-group {
  display: flex;
  gap: 12px;
  align-items: stretch;
}

.input-group .input {
  flex: 1;
}

/* 验证码按钮样式 */
.btn-verify {
  white-space: nowrap;
  padding: 0 24px;
  min-width: 120px;
  height: 48px;
  background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
  color: #374151;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  position: relative;
  overflow: hidden;
}

.btn-verify::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(7, 193, 96, 0.05) 0%, transparent 100%);
  opacity: 0;
  transition: opacity 0.3s;
}

.btn-verify:hover:not(:disabled) {
  border-color: #07c160;
  background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%);
  color: #07c160;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(7, 193, 96, 0.15);
}

.btn-verify:hover:not(:disabled)::before {
  opacity: 1;
}

.btn-verify:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.btn-verify:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  color: #9ca3af;
  border-color: #e5e7eb;
  background: #f9fafb;
}

.btn-verify.btn-sending {
  color: #9ca3af;
}

/* 主登录按钮样式 */
.btn-login {
  width: 100%;
  height: 52px;
  padding: 0;
  margin-top: 16px;
  background: linear-gradient(135deg, #07c160 0%, #059a4e 100%);
  color: white;
  border: none;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 16px rgba(7, 193, 96, 0.3), 0 2px 4px rgba(7, 193, 96, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-login::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, transparent 50%);
  pointer-events: none;
}

.btn-login::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}

.btn-login:hover:not(:disabled) {
  background: linear-gradient(135deg, #06ad56 0%, #048a42 100%);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(7, 193, 96, 0.4), 0 4px 8px rgba(7, 193, 96, 0.3);
}

.btn-login:hover:not(:disabled)::after {
  width: 300px;
  height: 300px;
}

.btn-login:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(7, 193, 96, 0.3), 0 1px 2px rgba(7, 193, 96, 0.2);
}

.btn-login:disabled {
  background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%);
  cursor: not-allowed;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.btn-login:disabled:hover {
  transform: none;
}

.btn-text {
  position: relative;
  z-index: 1;
  font-size: 16px;
  font-weight: 600;
}

.btn-spinner {
  width: 20px;
  height: 20px;
  position: relative;
  z-index: 1;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

.btn-loading .btn-text {
  opacity: 0;
}

.card-footer {
  margin-top: 28px;
  text-align: center;
  padding-top: 20px;
  border-top: 1px solid #f3f4f6;
}

.footer-text {
  font-size: 14px;
  color: #6b7280;
  font-weight: 400;
}

.link {
  color: #07c160;
  text-decoration: none;
  font-weight: 600;
  margin-left: 4px;
  transition: color 0.2s;
}

.link:hover {
  color: #059a4e;
  text-decoration: underline;
}

/* 响应式设计 */
@media (max-width: 640px) {
  .login-page {
    padding: 16px;
    background: linear-gradient(180deg, #f5f7fa 0%, #ffffff 100%);
  }

  .login-page::before,
  .login-page::after {
    display: none;
  }

  .login-container {
    gap: 24px;
  }

  .brand-logo {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    margin-bottom: 16px;
  }

  .brand-title {
    font-size: 24px;
  }

  .login-card {
    padding: 32px 24px;
    border-radius: 20px;
    box-shadow: 0 10px 20px -4px rgba(0, 0, 0, 0.1);
  }

  .card-title {
    font-size: 22px;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .input {
    padding: 12px 14px;
    font-size: 14px;
  }

  .btn-verify {
    min-width: 100px;
    padding: 0 18px;
    font-size: 13px;
  }

  .btn-login {
    height: 48px;
    font-size: 15px;
  }
}

/* 深色模式适配 */
:root.dark .login-page {
  background: linear-gradient(135deg, #111827 0%, #1f2937 100%);
}

:root.dark .login-page::before {
  background: radial-gradient(circle, rgba(7, 193, 96, 0.15) 0%, transparent 70%);
}

:root.dark .login-page::after {
  background: radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%);
}

:root.dark .brand-title {
  color: #f9fafb;
}

:root.dark .brand-sub {
  color: #9ca3af;
}

:root.dark .login-card {
  background: #1f2937;
  border-color: rgba(55, 65, 81, 0.5);
  box-shadow: 0 20px 40px -4px rgba(0, 0, 0, 0.3);
}

:root.dark .card-title {
  color: #f9fafb;
}

:root.dark .card-sub {
  color: #9ca3af;
}

:root.dark .form-label {
  color: #d1d5db;
}

:root.dark .input {
  background-color: #111827;
  border-color: #374151;
  color: #f9fafb;
}

:root.dark .input:hover {
  background-color: #1f2937;
  border-color: #4b5563;
}

:root.dark .input:focus {
  background-color: #1f2937;
  box-shadow: 0 0 0 4px rgba(7, 193, 96, 0.15);
}

:root.dark .input::placeholder {
  color: #6b7280;
}

:root.dark .btn-verify {
  background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
  border-color: #374151;
  color: #d1d5db;
}

:root.dark .btn-verify:hover:not(:disabled) {
  border-color: #07c160;
  background: linear-gradient(135deg, #1f2937 0%, #064e3b 100%);
  color: #10b981;
}

:root.dark .btn-verify:disabled {
  background: #1f2937;
  border-color: #374151;
  color: #6b7280;
}

:root.dark .card-footer {
  border-top-color: #374151;
}

:root.dark .footer-text {
  color: #9ca3af;
}

:root.dark .link {
  color: #10b981;
}

:root.dark .link:hover {
  color: #34d399;
}

/* 平板设备优化 */
@media (min-width: 641px) and (max-width: 1024px) {
  .login-container {
    max-width: 420px;
  }
}

/* 高分辨率屏幕优化 */
@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
  .login-card {
    box-shadow: 0 20px 40px -4px rgba(0, 0, 0, 0.06), 0 8px 16px -4px rgba(0, 0, 0, 0.03);
  }

  .btn-login {
    box-shadow: 0 4px 16px rgba(7, 193, 96, 0.25), 0 2px 4px rgba(7, 193, 96, 0.15);
  }
}
</style>
