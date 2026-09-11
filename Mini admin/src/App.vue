<template>
  <NConfigProvider :theme="isDark ? darkTheme : null" :theme-overrides="isDark ? darkThemeOverrides : lightThemeOverrides">
    <NLoadingBarProvider>
      <NMessageProvider>
        <NDialogProvider>
          <NModalProvider>
            <AppInner :is-dark="isDark" @toggle-theme="toggleTheme" @toggle-sidebar="toggleSidebar" @close-sidebar="isSidebarOpen = false" :is-sidebar-open="isSidebarOpen" />
          </NModalProvider>
        </NDialogProvider>
      </NMessageProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { darkTheme, NConfigProvider, NMessageProvider, NDialogProvider, NLoadingBarProvider, NModalProvider } from 'naive-ui'
import { lightThemeOverrides, darkThemeOverrides } from './plugins/naive'
import AppInner from './AppInner.vue'

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
})

watch(isDark, () => {
  applyThemeClass()
})
</script>
