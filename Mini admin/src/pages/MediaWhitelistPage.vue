<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-[var(--text-main)]">域名白名单</h1>
      <p class="text-[var(--text-sub)] mt-1">管理代理下载和音频提取允许的域名</p>
    </div>

    <!-- 代理域名白名单 -->
    <div class="glass-panel">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-blue-500"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          </div>
          <div>
            <h3 class="font-semibold text-[var(--text-main)]">代理下载域名</h3>
            <p class="text-xs text-[var(--text-sub)]">{{ proxyDomains.length }} 个域名</p>
          </div>
        </div>
      </div>
      <!-- 添加 -->
      <div class="flex gap-2 mb-4">
        <input v-model="newProxyDomain" type="text" class="form-input flex-1" placeholder="输入域名，如 douyinvod.com" @keyup.enter="addProxyDomain" />
        <button @click="addProxyDomain" :disabled="!newProxyDomain.trim()" class="btn-primary text-sm px-4">添加</button>
      </div>
      <!-- 域名列表 -->
      <div class="flex flex-wrap gap-2">
        <span v-for="d in proxyDomains" :key="d" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-body)] border border-[var(--border-color)] text-sm text-[var(--text-main)] group">
          {{ d }}
          <button @click="removeProxyDomain(d)" class="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity ml-1" title="移除">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </span>
      </div>
      <p v-if="!proxyDomains.length" class="text-sm text-[var(--text-sub)]">暂无数据</p>
    </div>

    <!-- 音频域名白名单 -->
    <div class="glass-panel">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-purple-500"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </div>
          <div>
            <h3 class="font-semibold text-[var(--text-main)]">音频提取域名</h3>
            <p class="text-xs text-[var(--text-sub)]">{{ audioDomains.length }} 个域名</p>
          </div>
        </div>
      </div>
      <div class="flex gap-2 mb-4">
        <input v-model="newAudioDomain" type="text" class="form-input flex-1" placeholder="输入域名，如 bilivideo.com" @keyup.enter="addAudioDomain" />
        <button @click="addAudioDomain" :disabled="!newAudioDomain.trim()" class="btn-primary text-sm px-4">添加</button>
      </div>
      <div class="flex flex-wrap gap-2">
        <span v-for="d in audioDomains" :key="d" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-body)] border border-[var(--border-color)] text-sm text-[var(--text-main)] group">
          {{ d }}
          <button @click="removeAudioDomain(d)" class="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity ml-1" title="移除">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </span>
      </div>
      <p v-if="!audioDomains.length" class="text-sm text-[var(--text-sub)]">暂无数据</p>
    </div>

    <!-- 操作 -->
    <div class="flex gap-3">
      <button @click="resetDefaults" class="btn-ghost text-sm text-[var(--text-sub)]">恢复默认</button>
    </div>

    <!-- 使用说明 -->
    <div class="glass-panel">
      <h3 class="font-semibold text-[var(--text-main)] mb-3">说明</h3>
      <div class="text-sm text-[var(--text-sub)] space-y-2">
        <p>1. <strong>代理下载域名</strong>：小程序通过服务器代理下载视频时，只允许这些域名的请求通过</p>
        <p>2. <strong>音频提取域名</strong>：从视频中提取音频时，只允许这些域名的请求通过</p>
        <p>3. 添加域名时只需输入主域名（如 douyinvod.com），子域名会自动匹配</p>
        <p>4. 修改立即生效，无需重启服务</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const API_BASE = 'https://api.missonce.cc'
const API_KEY = import.meta.env.VITE_ADMIN_API_KEY || ''

const proxyDomains = ref<string[]>([])
const audioDomains = ref<string[]>([])
const newProxyDomain = ref('')
const newAudioDomain = ref('')

const loadWhitelist = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/whitelist`)
    const data = await res.json()
    if (data.retcode === 200) {
      proxyDomains.value = data.data?.proxy || []
      audioDomains.value = data.data?.audio || []
    }
  } catch (e) {
    console.error('加载白名单失败:', e)
  }
}

const addProxyDomain = async () => {
  const d = newProxyDomain.value.trim().toLowerCase()
  if (!d) return
  try {
    const res = await fetch(`${API_BASE}/api/whitelist/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({ domain: d }),
    })
    const data = await res.json()
    if (data.retcode === 200) {
      ElMessage.success(data.retdesc || '已添加')
      newProxyDomain.value = ''
      await loadWhitelist()
    } else {
      ElMessage.error(data.retdesc || '添加失败')
    }
  } catch (e) {
    ElMessage.error('添加失败')
  }
}

const removeProxyDomain = async (domain: string) => {
  try {
    const res = await fetch(`${API_BASE}/api/whitelist/proxy/${encodeURIComponent(domain)}`, { method: 'DELETE', headers: { 'x-api-key': API_KEY } })
    const data = await res.json()
    if (data.retcode === 200) {
      ElMessage.success('已移除')
      await loadWhitelist()
    } else {
      ElMessage.error(data.retdesc || '移除失败')
    }
  } catch (e) {
    ElMessage.error('移除失败')
  }
}

const addAudioDomain = async () => {
  const d = newAudioDomain.value.trim().toLowerCase()
  if (!d) return
  try {
    const res = await fetch(`${API_BASE}/api/whitelist/audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({ domain: d }),
    })
    const data = await res.json()
    if (data.retcode === 200) {
      ElMessage.success(data.retdesc || '已添加')
      newAudioDomain.value = ''
      await loadWhitelist()
    } else {
      ElMessage.error(data.retdesc || '添加失败')
    }
  } catch (e) {
    ElMessage.error('添加失败')
  }
}

const removeAudioDomain = async (domain: string) => {
  try {
    const res = await fetch(`${API_BASE}/api/whitelist/audio/${encodeURIComponent(domain)}`, { method: 'DELETE', headers: { 'x-api-key': API_KEY } })
    const data = await res.json()
    if (data.retcode === 200) {
      ElMessage.success('已移除')
      await loadWhitelist()
    } else {
      ElMessage.error(data.retdesc || '移除失败')
    }
  } catch (e) {
    ElMessage.error('移除失败')
  }
}

const resetDefaults = async () => {
  if (!confirm('确定恢复默认白名单？')) return
  try {
    const res = await fetch(`${API_BASE}/api/whitelist/reset`, { method: 'POST', headers: { 'x-api-key': API_KEY } })
    const data = await res.json()
    if (data.retcode === 200) {
      ElMessage.success('已恢复默认')
      await loadWhitelist()
    }
  } catch (e) {
    ElMessage.error('重置失败')
  }
}

onMounted(() => {
  loadWhitelist()
})
</script>
