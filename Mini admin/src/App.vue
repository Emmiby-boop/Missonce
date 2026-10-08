<template>
  <NConfigProvider :theme="isDark ? darkTheme : null" :theme-overrides="isDark ? darkThemeOverrides : lightThemeOverrides">
    <NLoadingBarProvider>
      <NMessageProvider>
        <NDialogProvider>
          <NModalProvider>
            <!-- 登录/注册是全屏独立页：不能套后台外壳，否则登录框会被塞进右侧内容区 -->
            <router-view v-if="isAuthRoute" />
            <!-- 其余页面走后台外壳（侧栏 + 顶栏） -->
            <AppInner
              v-else-if="appReady"
              :is-dark="isDark"
              @toggle-theme="toggleTheme"
              @toggle-sidebar="toggleSidebar"
              @close-sidebar="isSidebarOpen = false"
              :is-sidebar-open="isSidebarOpen"
            />
            <!-- 首次路由守卫 resolve 前不渲染任何东西，避免未登录时侧栏闪一下 -->
            <div v-else class="app-boot"><span>加载中…</span></div>
          </NModalProvider>
        </NDialogProvider>
      </NMessageProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { darkTheme, NConfigProvider, NMessageProvider, NDialogProvider, NLoadingBarProvider, NModalProvider, useDialog } from 'naive-ui'
import { lightThemeOverrides, darkThemeOverrides } from './plugins/naive'
import { registerDialogInstance } from './composables/useDialog'
import AppInner from './AppInner.vue'

// 无需后台外壳的公开页
const AUTH_ROUTES = ['/login', '/register']
const route = useRoute()
const router = useRouter()
const isAuthRoute = computed(() => AUTH_ROUTES.includes(route.path))

// 首次导航的路由守卫是异步的（要服务端校验 token），
// 在它 resolve 之前渲染后台外壳，会让未登录用户看到侧栏一闪而过。
const appReady = ref(false)
router.isReady().then(() => {
  appReady.value = true
})

const isDark = ref(localStorage.getItem('theme_preference') !== 'light')

const applyThemeClass = () => {
  const root = document.documentElement
  const body = document.body
  if (isDark.value) {
    root.classList.add('dark')
    root.classList.remove('light')
    body.classList.add('dark')
    body.classList.remove('light')
  } else {
    root.classList.add('light')
    root.classList.remove('dark')
    body.classList.add('light')
    body.classList.remove('dark')
  }
}

const toggleTheme = () => {
  isDark.value = !isDark.value
  localStorage.setItem('theme_preference', isDark.value ? 'dark' : 'light')
  applyThemeClass()
}

const isSidebarOpen = ref(false)
const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

onMounted(() => {
  applyThemeClass()
  // 注册全局 dialog 实例：confirmDialog() 需要它（详见 composables/useDialog.ts）
  registerDialogInstance(useDialog())
})

watch(isDark, () => {
  applyThemeClass()
})
</script>

<style scoped>
/* 路由守卫校验登录态期间的占位背景 */
.app-boot {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  color: var(--text-sub, #8a8f98);
  font-size: 14px;
  background: var(--bg-body, #f6f7f9);
}
</style>
