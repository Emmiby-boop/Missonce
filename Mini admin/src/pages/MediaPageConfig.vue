<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-[var(--text-main)]">页面管理</h1>
      <p class="text-[var(--text-sub)] mt-1">控制小程序页面的显示/隐藏</p>
    </div>

    <!-- TabBar 页面 -->
    <div class="glass-panel">
      <h3 class="font-semibold text-[var(--text-main)] mb-4">底部导航栏</h3>
      <div class="space-y-3">
        <div v-for="(page, key) in tabPages" :key="key"
          class="flex items-center justify-between p-3 rounded-lg border border-[var(--border-color)]">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
              :class="page.enabled ? 'bg-green-500/10 text-green-500' : 'bg-gray-100 text-gray-400'">
              {{ page.title.charAt(0) }}
            </div>
            <div>
              <div class="text-sm font-medium text-[var(--text-main)]">{{ page.title }}</div>
              <div class="text-xs text-[var(--text-sub)]">{{ key }}</div>
            </div>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" :checked="page.enabled" @change="togglePage(key, $event)" class="sr-only peer">
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)]"></div>
          </label>
        </div>
      </div>
    </div>

    <!-- 子页面 -->
    <div class="glass-panel">
      <h3 class="font-semibold text-[var(--text-main)] mb-4">子页面</h3>
      <div class="space-y-3">
        <div v-for="(page, key) in subPages" :key="key"
          class="flex items-center justify-between p-3 rounded-lg border border-[var(--border-color)]">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
              :class="page.enabled ? 'bg-blue-500/10 text-blue-500' : 'bg-gray-100 text-gray-400'">
              {{ page.title.charAt(0) }}
            </div>
            <div>
              <div class="text-sm font-medium text-[var(--text-main)]">{{ page.title }}</div>
              <div class="text-xs text-[var(--text-sub)]">{{ key }}</div>
            </div>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" :checked="page.enabled" @change="togglePage(key, $event)" class="sr-only peer">
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)]"></div>
          </label>
        </div>
      </div>
    </div>

    <!-- 说明 -->
    <div class="glass-panel">
      <h3 class="font-semibold text-[var(--text-main)] mb-3">说明</h3>
      <div class="text-sm text-[var(--text-sub)] space-y-2">
        <p>1. 关闭底部导航栏页面后，小程序不会显示该 Tab</p>
        <p>2. 关闭子页面后，相关入口会隐藏</p>
        <p>3. 修改立即生效，用户下次打开小程序时生效</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const API_BASE = 'https://api.missonce.cc'
const API_KEY = import.meta.env.VITE_ADMIN_API_KEY || ''

function authHeaders() {
  return API_KEY ? { 'x-api-key': API_KEY, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
}

const pageConfig = ref<Record<string, any>>({})

const tabPages = computed(() => {
  const result: Record<string, any> = {}
  for (const [key, val] of Object.entries(pageConfig.value)) {
    if (val.tab) result[key] = val
  }
  return result
})

const subPages = computed(() => {
  const result: Record<string, any> = {}
  for (const [key, val] of Object.entries(pageConfig.value)) {
    if (!val.tab) result[key] = val
  }
  return result
})

const loadConfig = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/page-config`)
    const data = await res.json()
    if (data.retcode === 200 || data.success) {
      pageConfig.value = data.data?.pages || {}
    }
  } catch (e) {
    console.error('加载页面配置失败:', e)
  }
}

const togglePage = async (key: string, event: Event) => {
  const enabled = (event.target as HTMLInputElement).checked
  pageConfig.value[key].enabled = enabled
  try {
    const pages: Record<string, any> = {}
    pages[key] = { enabled }
    const res = await fetch(`${API_BASE}/api/page-config`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ pages }),
    })
    const data = await res.json()
    if (data.success) {
      ElMessage.success(`${pageConfig.value[key].title} 已${enabled ? '启用' : '禁用'}`)
    } else {
      ElMessage.error(data.retdesc || '保存失败')
      pageConfig.value[key].enabled = !enabled
    }
  } catch (e) {
    ElMessage.error('保存失败')
    pageConfig.value[key].enabled = !enabled
  }
}

onMounted(() => {
  loadConfig()
})
</script>
