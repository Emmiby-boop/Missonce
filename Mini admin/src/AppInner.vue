<template>
  <div class="min-h-screen" :class="isDark ? 'theme-dark' : 'theme-light'">
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { NModal, NInput, NButton, NSpace, useMessage } from 'naive-ui'
import AdminSidebar from './components/AdminSidebar.vue'
import AdminTopbar from './components/AdminTopbar.vue'
import { getLoginState, changePassword } from './utils/cloudbase'
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

const handleLogout = async () => {
  loading.value = true
  try {
    await authStore.logout()
    router.push('/login')
  } finally {
    loading.value = false
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

/* 路由切换：纯 opacity 淡入，避免左右滑动误导 */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.18s ease;
}

.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}
</style>
