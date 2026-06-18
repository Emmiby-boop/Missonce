<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-[var(--text-main)]">Cookie 配置</h1>
      <p class="text-[var(--text-sub)] mt-1">配置抖音、小红书的登录 Cookie，用于获取视频直链</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div v-for="cp in cookiePlatforms" :key="cp.key" class="glass-panel">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold" :style="{ background: cp.color }">
              {{ cp.name.charAt(0) }}
            </div>
            <div>
              <h3 class="font-semibold text-[var(--text-main)]">{{ cp.name }}</h3>
              <p class="text-xs text-[var(--text-sub)]">{{ cp.desc }}</p>
            </div>
          </div>
          <span :class="getCookieStatusClass(cp.key)">{{ getCookieStatusText(cp.key) }}</span>
        </div>
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-[var(--text-sub)] mb-1">Cookie 值</label>
            <textarea v-model="cookieForms[cp.key]" class="form-input w-full text-xs font-mono" rows="3" :placeholder="'粘贴 ' + cp.name + ' 的 Cookie...'"></textarea>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex-1">
              <label class="block text-xs font-medium text-[var(--text-sub)] mb-1">过期时间（可选）</label>
              <input v-model="expireForms[cp.key]" type="datetime-local" class="form-input w-full text-xs" />
            </div>
            <div class="flex gap-2 pt-5">
              <button @click="saveCookie(cp.key)" :disabled="!cookieForms[cp.key]?.trim()" class="btn-primary text-xs px-4 py-2">保存</button>
              <button @click="deleteCookie(cp.key)" class="btn-ghost text-xs px-4 py-2 text-red-500">删除</button>
            </div>
          </div>
          <p v-if="cookieStatus[cp.key]?.updatedAt" class="text-xs text-[var(--text-sub)]">
            上次更新: {{ formatCookieTime(cookieStatus[cp.key].updatedAt) }}
          </p>
        </div>
      </div>
    </div>

    <div class="glass-panel">
      <h3 class="font-semibold text-[var(--text-main)] mb-3">使用说明</h3>
      <div class="text-sm text-[var(--text-sub)] space-y-2">
        <p>1. 在电脑/手机浏览器登录对应平台</p>
        <p>2. 打开开发者工具 → Network → 找到任意请求 → 复制 Cookie 头的值</p>
        <p>3. 粘贴到上方输入框，点击保存</p>
        <p>4. Cookie 过期后在后台重新配置即可</p>
        <p class="text-yellow-500 mt-3">⚠ Cookie 有效期通常为 7-30 天，过期后需要重新获取</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const API_BASE = 'https://api.missonce.cc'
const API_KEY = import.meta.env.VITE_ADMIN_API_KEY || ''

function authHeaders() {
  return API_KEY ? { 'x-api-key': API_KEY, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
}

const cookiePlatforms = [
  { key: 'douyin', name: '抖音', color: '#161823', desc: '获取抖音视频直链' },
  { key: 'xiaohongshu', name: '小红书', color: '#FE2C55', desc: '获取小红书笔记内容' },
]
const cookieStatus = ref<Record<string, any>>({})
const cookieForms = ref<Record<string, string>>({})
const expireForms = ref<Record<string, string>>({})

const loadCookieStatus = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/cookies`)
    const data = await res.json()
    if (data.retcode === 200) cookieStatus.value = data.data || {}
  } catch (e) { console.error('加载 Cookie 状态失败:', e) }
}

const saveCookie = async (platform: string) => {
  const cookie = cookieForms.value[platform]?.trim()
  if (!cookie) return
  try {
    const body: any = { cookie }
    if (expireForms.value[platform]) body.expiresAt = new Date(expireForms.value[platform]).getTime()
    const res = await fetch(`${API_BASE}/api/cookies/${platform}`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.retcode === 200) {
      ElMessage.success(`${platform} Cookie 保存成功`)
      await loadCookieStatus()
      cookieForms.value[platform] = ''
    } else {
      ElMessage.error(data.retdesc || '保存失败')
    }
  } catch (e) { ElMessage.error('保存失败') }
}

const deleteCookie = async (platform: string) => {
  if (!confirm(`确定删除 ${platform} 的 Cookie？`)) return
  try {
    await fetch(`${API_BASE}/api/cookies/${platform}`, { method: 'DELETE', headers: authHeaders() })
    ElMessage.success('已删除')
    await loadCookieStatus()
  } catch (e) { ElMessage.error('删除失败') }
}

const getCookieStatusClass = (platform: string) => {
  const c = cookieStatus.value[platform]
  if (!c?.hasCookie) return 'text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-400'
  if (c.status === 'expired') return 'text-xs px-2 py-1 rounded-full bg-red-100 text-red-500'
  return 'text-xs px-2 py-1 rounded-full bg-green-100 text-green-600'
}

const getCookieStatusText = (platform: string) => {
  const c = cookieStatus.value[platform]
  if (!c?.hasCookie) return '未配置'
  if (c.status === 'expired') return '已过期'
  return '已配置'
}

const formatCookieTime = (ts: number) => {
  if (!ts) return ''
  return new Date(ts).toLocaleString('zh-CN')
}

onMounted(() => {
  loadCookieStatus()
})
</script>
