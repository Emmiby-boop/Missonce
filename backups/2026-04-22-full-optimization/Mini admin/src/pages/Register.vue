<template>
  <div class="login-page">
    <div class="login-container">
      <div class="brand-section">
        <div class="brand-logo">
          <span class="brand-dot"></span>
        </div>
        <h1 class="brand-title">Mini Admin</h1>
        <p class="brand-sub">注册管理员账号</p>
      </div>

      <div class="login-card glass-panel">
        <div class="card-header">
          <h2 class="card-title">创建账号</h2>
          <p class="card-sub">请填写以下信息完成注册</p>
        </div>

        <form class="login-form" @submit.prevent="handleRegister">
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
                class="btn-soft verify-btn"
                :disabled="isSendingCode || timeRemaining > 0"
                @click="sendVerificationCode"
              >
                {{ sendLabel }}
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">设置密码</label>
            <input 
              v-model="password" 
              type="password" 
              class="input" 
              placeholder="请设置登录密码" 
            />
          </div>

          <div class="form-group">
            <label class="form-label">确认密码</label>
            <input 
              v-model="confirmPassword" 
              type="password" 
              class="input" 
              placeholder="请再次输入密码" 
            />
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-soft submit-btn" :disabled="isLoading">
              {{ isLoading ? "注册中..." : "立即注册" }}
            </button>
          </div>
        </form>

        <div v-if="error" class="message error-message">
           {{ error }}
        </div>
        <div v-if="success" class="message success-message">
           {{ success }}
        </div>

        <div class="card-footer">
          <p class="footer-text">
            已有账号？
            <a href="/login" class="link">立即登录</a>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { requestPhoneOtp, signUpWithOtp } from "../utils/cloudbase";

const router = useRouter();

const phone = ref("");
const code = ref("");
const password = ref("");
const confirmPassword = ref("");
const isLoading = ref(false);
const isSendingCode = ref(false);
const timeRemaining = ref(0);
const error = ref("");
const success = ref("");

const otpSession = ref<any>(null);

const sendLabel = computed(() => {
  if (isSendingCode.value) return "发送中...";
  if (timeRemaining.value > 0) return `${timeRemaining.value}s`;
  return "获取验证码";
});

const sendVerificationCode = async () => {
  if (!/^1[3-9]\d{9}$/.test(phone.value)) {
    error.value = "请输入正确的中国大陆手机号";
    return;
  }

  isSendingCode.value = true;
  error.value = "";
  success.value = "";

  try {
    const data = await requestPhoneOtp(phone.value);
    otpSession.value = data;
    success.value = "验证码已发送，请查收短信";
    timeRemaining.value = 60;

    const timer = setInterval(() => {
      timeRemaining.value--;
      if (timeRemaining.value <= 0) {
        clearInterval(timer);
        isSendingCode.value = false;
      }
    }, 1000);
  } catch (err) {
    error.value = "发送验证码失败: " + (err as Error).message;
    isSendingCode.value = false;
  }
};

const handleRegister = async () => {
  if (!phone.value || !code.value || !password.value || !confirmPassword.value) {
    error.value = "请填写所有字段";
    return;
  }

  if (password.value !== confirmPassword.value) {
    error.value = "两次输入的密码不一致";
    return;
  }

  if (!otpSession.value?.verifyOtp) {
    error.value = "请先发送验证码";
    return;
  }

  isLoading.value = true;
  error.value = "";
  success.value = "";

  try {
    await signUpWithOtp({ phone: phone.value, code: code.value, password: password.value });
    success.value = "注册成功，正在跳转登录...";
    setTimeout(() => {
      router.push("/login");
    }, 1500);
  } catch (err) {
    error.value = "注册失败: " + (err as Error).message;
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-body);
  padding: 20px;
}

.login-container {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.brand-section {
  text-align: center;
}

.brand-logo {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  box-shadow: 0 8px 16px rgba(7, 193, 96, 0.2);
}

.brand-dot {
  width: 12px;
  height: 12px;
  background: #fff;
  border-radius: 50%;
}

.brand-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-main);
  margin: 0 0 8px;
}

.brand-sub {
  font-size: 14px;
  color: var(--text-sub);
  margin: 0;
}

.login-card {
  background: var(--bg-card);
  padding: 40px;
  border-radius: 24px;
  box-shadow: 0 20px 40px -4px rgba(0, 0, 0, 0.05);
}

.card-header {
  margin-bottom: 32px;
  text-align: center;
}

.card-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-main);
  margin: 0 0 8px;
}

.card-sub {
  font-size: 14px;
  color: var(--text-sub);
  margin: 0;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-main);
  margin-bottom: 8px;
}

.input-group {
  display: flex;
  gap: 12px;
}

.verify-btn {
  white-space: nowrap;
  padding: 0 20px;
  background: var(--bg-body);
  color: var(--text-main);
  border: 1px solid var(--border-color);
}

.verify-btn:hover:not(:disabled) {
  background: var(--border-color);
  color: var(--text-main);
  transform: none;
}

.submit-btn {
  width: 100%;
  padding: 12px;
  font-size: 16px;
  margin-top: 12px;
  box-shadow: 0 4px 12px rgba(7, 193, 96, 0.25);
}

.submit-btn:hover:not(:disabled) {
  box-shadow: 0 6px 16px rgba(7, 193, 96, 0.35);
}

.card-footer {
  margin-top: 24px;
  text-align: center;
}

.footer-text {
  font-size: 14px;
  color: var(--text-sub);
}

.link {
  color: var(--primary);
  text-decoration: none;
  font-weight: 500;
  margin-left: 4px;
}

.link:hover {
  text-decoration: underline;
}

.message {
  margin-top: 16px;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.4;
}

.error-message {
  background-color: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.success-message {
  background-color: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}
</style>