<template>
  <div class="min-h-screen" :class="isDark ? 'theme-dark' : 'theme-light'">
    <!-- 拿不到登录态就不渲染后台外壳：避免出现「已退出却仍显示侧栏功能区」 -->
    <template v-if="user">
      <div class="app-shell">
        <AdminSidebar :is-dark="isDark" :is-open="isSidebarOpen" @close="$emit('closeSidebar')" />
        <div class="flex flex-1 flex-col w-0 min-w-0">
          <AdminTopbar
            :user="user"
            :loading="loading"
            :is-dark="isDark"
            @refresh="handleRefresh"
            @logout="handleLogout"
            @toggle-theme="$emit('toggleTheme')"
            @toggle-sidebar="$emit('toggleSidebar')"
            @change-password="openPasswordModal"
            @account-security="openSecurityModal"
          />
          <main class="flex-1 px-6 pb-16 pt-8 lg:px-10">
            <div class="content-container mx-auto w-full">
              <router-view v-slot="{ Component }">
                <transition name="page-fade" mode="out-in">
                  <component :is="Component" />
                </transition>
              </router-view>
            </div>
          </main>
        </div>
      </div>
    </template>
    <div v-else class="app-shell-boot">
      <span>{{ logoutPending ? '正在退出…' : '正在校验登录态…' }}</span>
    </div>

    <!-- 修改密码弹窗 -->
    <NModal v-model:show="showPasswordModal" preset="card" title="修改密码" style="width: 420px;">
      <NSpace vertical :size="16">
        <NInput v-model:value="pwdForm.oldPassword" type="password" placeholder="请输入旧密码" show-password-on="click" />
        <NInput v-model:value="pwdForm.newPassword" type="password" placeholder="请输入新密码" show-password-on="click" />
        <NInput v-model:value="pwdForm.confirmPassword" type="password" placeholder="请再次输入新密码" show-password-on="click" />
      </NSpace>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="showPasswordModal = false" :disabled="pwdLoading">取消</NButton>
          <NButton type="primary" @click="handlePasswordSubmit" :loading="pwdLoading">
            确认修改
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 账号安全弹窗 -->
    <NModal v-model:show="showSecurityModal" preset="card" title="账号安全" style="width: 460px;">
      <NSpace vertical :size="14">
        <div class="sec-row">
          <span class="sec-label">当前账号</span>
          <span class="sec-value font-mono">{{ user?.username || '—' }}</span>
        </div>
        <div class="sec-row">
          <span class="sec-label">手机号</span>
          <span class="sec-value font-mono">{{ secStatus.phone || '未绑定' }}</span>
        </div>

        <div class="sec-divider"></div>

        <div class="sec-head">
          <span class="sec-title">验证码登录</span>
          <NTag :type="secStatus.codeLoginEnabled ? 'success' : 'default'" size="small" round>
            {{ secStatus.codeLoginEnabled ? '已启用' : '未启用' }}
          </NTag>
        </div>
        <p class="sec-tip">
          {{ secStatus.codeLoginEnabled
            ? '本账号已可用「手机号 + 短信验证码」登录。如更换设备或担心安全，可停用后重新绑定。'
            : '启用后，可在登录页直接用「手机号 + 短信验证码」登录，无需输入密码。' }}
        </p>

        <template v-if="!secStatus.codeLoginEnabled">
          <NInput v-model:value="secPhone" placeholder="请输入手机号" maxlength="11" />
          <div class="sec-code-row">
            <NInput v-model:value="secCode" placeholder="短信验证码" maxlength="6" />
            <NButton
              :disabled="secSending || secCountdown > 0"
              :loading="secSending"
              @click="handleSendCode"
            >
              {{ secCountdown > 0 ? secCountdown + 's' : '发送验证码' }}
            </NButton>
          </div>
        </template>
      </NSpace>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="showSecurityModal = false" :disabled="secBinding">关闭</NButton>
          <NButton
            v-if="!secStatus.codeLoginEnabled"
            type="primary"
            :loading="secBinding"
            @click="handleEnableCodeLogin"
          >
            启用验证码登录
          </NButton>
          <NButton
            v-else
            type="error"
            ghost
            :loading="secBinding"
            @click="handleDisableCodeLogin"
          >
            停用验证码登录
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { NModal, NInput, NButton, NSpace, NTag, useMessage } from 'naive-ui'
import AdminSidebar from './components/AdminSidebar.vue'
import AdminTopbar from './components/AdminTopbar.vue'
import {
  getLoginState,
  changePassword,
  getSecurityStatus,
  sendPhoneCode,
  bindPhoneLoginWithCode,
  unbindPhoneLogin,
} from './utils/cloudbase'
import { useAuthStore } from './stores/auth'

defineProps<{
  isDark: boolean
  isSidebarOpen: boolean
}>()

defineEmits<{
  (e: 'toggleTheme'): void
  (e: 'toggleSidebar'): void
  (e: 'closeSidebar'): void
}>()

const message = useMessage()
const router = useRouter()
const authStore = useAuthStore()
const route = useRoute()

// 修改密码弹窗
const showPasswordModal = ref(false)
const pwdForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })
const pwdLoading = ref(false)

const openPasswordModal = () => {
  pwdForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
  showPasswordModal.value = true
}

const handlePasswordSubmit = async () => {
  if (!pwdForm.value.oldPassword || !pwdForm.value.newPassword) {
    message.warning('请填写完整信息')
    return
  }
  if (pwdForm.value.newPassword !== pwdForm.value.confirmPassword) {
    message.warning('两次新密码输入不一致')
    return
  }

  const username = user.value?.username || 'admin'

  pwdLoading.value = true
  try {
    const res = await changePassword(username, pwdForm.value.oldPassword, pwdForm.value.newPassword)
    if (res.success) {
      message.success('密码修改成功，请重新登录')
      showPasswordModal.value = false
      await handleLogout()
    } else {
      message.error(res.message || '修改失败')
    }
  } catch (e: any) {
    console.error(e)
    message.error('修改失败: ' + e.message)
  } finally {
    pwdLoading.value = false
  }
}

const loading = ref(false)
// user 直接从 authStore 派生（响应式），登录后 store 更新会自动反映到 UI
const user = computed(() => authStore.admin)

// ---- 账号安全弹窗 ----
const showSecurityModal = ref(false)
const secLoading = ref(false)
const secStatus = ref<{ phone: string; codeLoginEnabled: boolean }>({ phone: '', codeLoginEnabled: false })
const secPhone = ref('')
const secCode = ref('')
const secSending = ref(false)
const secBinding = ref(false)
const secCountdown = ref(0)
let secTimer: ReturnType<typeof setInterval> | null = null

const loadSecurityStatus = async () => {
  secLoading.value = true
  try {
    const res = await getSecurityStatus()
    const d = res?.data || ({} as any)
    secStatus.value = { phone: d.phone || '', codeLoginEnabled: !!d.codeLoginEnabled }
    if (d.phone) secPhone.value = d.phone
  } catch (e: any) {
    message.error(e?.message || '读取账号安全状态失败')
  } finally {
    secLoading.value = false
  }
}

const openSecurityModal = async () => {
  showSecurityModal.value = true
  secCode.value = ''
  secPhone.value = user.value?.phone || ''
  await loadSecurityStatus()
}

const handleSendCode = async () => {
  if (!/^1\d{10}$/.test(secPhone.value)) {
    message.warning('请输入正确的手机号')
    return
  }
  secSending.value = true
  try {
    await sendPhoneCode(secPhone.value)
    message.success('验证码已发送，请注意查收')
    secCountdown.value = 60
    if (secTimer) clearInterval(secTimer)
    secTimer = setInterval(() => {
      secCountdown.value -= 1
      if (secCountdown.value <= 0 && secTimer) {
        clearInterval(secTimer)
        secTimer = null
      }
    }, 1000)
  } catch (e: any) {
    message.error('发送失败：' + (e?.message || ''))
  } finally {
    secSending.value = false
  }
}

const handleEnableCodeLogin = async () => {
  if (!/^1\d{10}$/.test(secPhone.value)) {
    message.warning('请输入正确的手机号')
    return
  }
  if (!secCode.value || secCode.value.length < 4) {
    message.warning('请先获取并填写验证码')
    return
  }
  secBinding.value = true
  try {
    await bindPhoneLoginWithCode(secPhone.value, secCode.value)
    message.success('已启用验证码登录，之后可在登录页用手机号登录')
    await loadSecurityStatus()
  } catch (e: any) {
    message.error('启用失败：' + (e?.message || ''))
  } finally {
    secBinding.value = false
  }
}

const handleDisableCodeLogin = async () => {
  secBinding.value = true
  try {
    await unbindPhoneLogin()
    message.success('已停用验证码登录')
    await loadSecurityStatus()
  } catch (e: any) {
    message.error('停用失败：' + (e?.message || ''))
  } finally {
    secBinding.value = false
  }
}

onUnmounted(() => {
  if (secTimer) clearInterval(secTimer)
})

const refreshLogin = async () => {
  loading.value = true
  try {
    const state = await getLoginState()
    const isAnonymous = Boolean(state?.user?.isAnonymous)
    if (!state || !state.user || isAnonymous) {
      if (isAnonymous) {
        await authStore.logout().catch(() => {})
      }
      router.replace({ path: '/login', query: { redirect: route.fullPath } })
      return
    }
    // 已登录：拉取最新管理员信息（更新 authStore.admin）
    await authStore.fetchProfile()
  } finally {
    loading.value = false
  }
}

const handleRefresh = async () => {
  await refreshLogin()
}

// user 为空且正在退出时，占位文案切为「正在退出…」
const logoutPending = ref(false)

const handleLogout = async () => {
  loading.value = true
  logoutPending.value = true
  try {
    await authStore.logout()
    router.replace({ path: '/login' })
  } finally {
    loading.value = false
    logoutPending.value = false
  }
}

onMounted(async () => {
  await refreshLogin()
})
</script>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
  background: var(--bg-body);
}

/* 内容最大宽度限制 — 超宽屏不再拉扯 */
.content-container {
  max-width: 1440px;
}

/* 无登录态 / 正在退出时的占位 */
.app-shell-boot {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  color: var(--text-sub, #8a8f98);
  font-size: 14px;
  background: var(--bg-body);
}

/* 路由切换：纯 opacity 淡入，避免左右滑动误导 */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.18s ease;
}

.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}

/* 账号安全弹窗 */
.sec-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.sec-label {
  font-size: 13px;
  color: var(--text-sub);
}
.sec-value {
  font-size: 13px;
  color: var(--text-main);
}
.sec-divider {
  height: 1px;
  background: var(--border-color);
}
.sec-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sec-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
}
.sec-tip {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-sub);
  margin: 0;
}
.sec-code-row {
  display: flex;
  gap: 8px;
}
.sec-code-row :deep(.n-input) {
  flex: 1;
}
</style>
