<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-[var(--text-main)]">运维工具</h1>
      <p class="text-[var(--text-sub)] mt-1">定时任务、代理配置、下载统计</p>
    </div>

    <!-- 定时任务 -->
    <div class="glass-panel">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-[var(--text-main)]">定时同步</h3>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" v-model="scheduler.enabled" @change="saveScheduler" class="w-4 h-4 accent-[var(--primary)]" />
          <span class="text-sm text-[var(--text-sub)]">{{ scheduler.enabled ? '已开启' : '已关闭' }}</span>
        </label>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium text-[var(--text-sub)] mb-1">同步间隔（分钟）</label>
          <input v-model.number="scheduler.interval" type="number" min="5" max="1440" class="form-input w-full" @change="saveScheduler" />
        </div>
        <div>
          <label class="block text-xs font-medium text-[var(--text-sub)] mb-1">同步平台</label>
          <div class="flex gap-2 mt-1">
            <label v-for="(val, key) in scheduler.tasks" :key="key" class="flex items-center gap-1 text-sm">
              <input type="checkbox" v-model="scheduler.tasks[key]" @change="saveScheduler" class="w-3 h-3 accent-[var(--primary)]" />
              {{ key === 'douyin' ? '抖音' : key === 'kuaishou' ? '快手' : '小红书' }}
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- 代理IP配置 -->
    <div class="glass-panel">
      <h3 class="font-semibold text-[var(--text-main)] mb-4">代理IP配置</h3>
      <p class="text-xs text-[var(--text-sub)] mb-3">配置住宅代理解决抖音等平台IP封锁问题</p>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium text-[var(--text-sub)] mb-1">代理地址</label>
          <input v-model="proxy.host" type="text" class="form-input w-full" placeholder="例：proxy.example.com" />
        </div>
        <div>
          <label class="block text-xs font-medium text-[var(--text-sub)] mb-1">端口</label>
          <input v-model="proxy.port" type="text" class="form-input w-full" placeholder="例：8080" />
        </div>
        <div>
          <label class="block text-xs font-medium text-[var(--text-sub)] mb-1">用户名</label>
          <input v-model="proxy.username" type="text" class="form-input w-full" placeholder="可选" />
        </div>
        <div>
          <label class="block text-xs font-medium text-[var(--text-sub)] mb-1">密码</label>
          <input v-model="proxy.password" type="password" class="form-input w-full" placeholder="可选" />
        </div>
      </div>
      <div class="flex items-center gap-4 mt-4">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" v-model="proxy.enabled" class="w-4 h-4 accent-[var(--primary)]" />
          <span class="text-sm text-[var(--text-sub)]">启用代理</span>
        </label>
        <button @click="saveProxy" class="btn-primary text-sm px-4 py-2">保存配置</button>
      </div>
    </div>

    <!-- 下载统计 -->
    <div class="glass-panel">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-[var(--text-main)]">下载统计</h3>
        <button @click="loadStats" class="btn-ghost text-xs px-3 py-1">刷新</button>
      </div>
      <div class="grid grid-cols-3 gap-4 mb-4">
        <div class="stat-card">
          <div class="text-2xl font-bold text-blue-500">{{ stats.total || 0 }}</div>
          <div class="text-xs text-[var(--text-sub)]">总下载量</div>
        </div>
        <div class="stat-card">
          <div class="text-2xl font-bold text-green-500">{{ stats.daily?.[today] || 0 }}</div>
          <div class="text-xs text-[var(--text-sub)]">今日下载</div>
        </div>
        <div class="stat-card">
          <div class="text-2xl font-bold text-purple-500">{{ Object.keys(stats.byPlatform || {}).length }}</div>
          <div class="text-xs text-[var(--text-sub)]">活跃平台</div>
        </div>
      </div>
      <div v-if="stats.byPlatform && Object.keys(stats.byPlatform).length > 0">
        <h4 class="text-sm font-medium text-[var(--text-main)] mb-2">各平台下载量</h4>
        <div v-for="(count, platform) in stats.byPlatform" :key="platform" class="flex items-center justify-between py-2 border-b border-[var(--border-color)]/50">
          <span class="text-sm text-[var(--text-main)]">{{ platform }}</span>
          <span class="text-sm font-mono text-[var(--primary)]">{{ count }}</span>
        </div>
      </div>
      <button @click="clearStats" class="btn-ghost text-xs px-3 py-1 text-red-500 mt-3">清空统计</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const API_BASE = 'https://api.missonce.cc'

const scheduler = ref({
  enabled: false,
  interval: 30,
  tasks: { douyin: true, kuaishou: true, xiaohongshu: true }
})

const proxy = ref({ host: '', port: '', username: '', password: '', enabled: false })

const stats = ref<any>({})
const today = new Date().toISOString().slice(0, 10)

const loadScheduler = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/scheduler`)
    const data = await res.json()
    if (data.retcode === 200) scheduler.value = data.data
  } catch (e) { console.error(e) }
}

const saveScheduler = async () => {
  try {
    await fetch(`${API_BASE}/api/scheduler`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scheduler.value)
    })
    ElMessage.success('定时任务配置已保存')
  } catch (e) { ElMessage.error('保存失败') }
}

const loadProxy = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/proxy`)
    const data = await res.json()
    if (data.retcode === 200) proxy.value = data.data
  } catch (e) { console.error(e) }
}

const saveProxy = async () => {
  try {
    await fetch(`${API_BASE}/api/proxy`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proxy.value)
    })
    ElMessage.success('代理配置已保存')
  } catch (e) { ElMessage.error('保存失败') }
}

const loadStats = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/stats`)
    const data = await res.json()
    if (data.retcode === 200) stats.value = data.data
  } catch (e) { console.error(e) }
}

const clearStats = async () => {
  if (!confirm('确定清空所有下载统计？')) return
  try {
    await fetch(`${API_BASE}/api/stats`, { method: 'DELETE' })
    ElMessage.success('统计已清空')
    await loadStats()
  } catch (e) { ElMessage.error('清空失败') }
}

onMounted(() => {
  loadScheduler()
  loadProxy()
  loadStats()
})
</script>

<style scoped>
.stat-card {
  @apply bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-color)];
}
</style>
