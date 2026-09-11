<template>
  <div class="space-y-6">
    <PageHeader title="运维工具" subtitle="定时任务、代理配置、下载统计" />

    <!-- 定时任务 -->
    <NCard>
      <template #header>
        <div class="flex items-center justify-between w-full">
          <h3 class="font-semibold text-[var(--text-main)]">定时同步</h3>
          <NSpace align="center" :size="8">
            <NTag :type="scheduler.enabled ? 'success' : 'default'" size="small" round>
              {{ scheduler.enabled ? '已开启' : '已关闭' }}
            </NTag>
            <NSwitch v-model:value="scheduler.enabled" @update:value="saveScheduler" />
          </NSpace>
        </div>
      </template>
      <NForm label-placement="top">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NFormItem label="同步间隔（分钟）">
            <NInputNumber
              v-model:value="scheduler.interval"
              :min="5"
              :max="1440"
              class="w-full"
              @update:value="saveScheduler"
            />
          </NFormItem>
          <NFormItem label="同步平台">
            <NSpace>
              <NCheckbox v-model:checked="scheduler.tasks.douyin" @update:checked="saveScheduler">抖音</NCheckbox>
              <NCheckbox v-model:checked="scheduler.tasks.kuaishou" @update:checked="saveScheduler">快手</NCheckbox>
              <NCheckbox v-model:checked="scheduler.tasks.xiaohongshu" @update:checked="saveScheduler">小红书</NCheckbox>
            </NSpace>
          </NFormItem>
        </div>
      </NForm>
    </NCard>

    <!-- 代理IP配置 -->
    <NCard title="代理IP配置">
      <p class="text-xs text-[var(--text-sub)] mb-3">配置住宅代理解决抖音等平台IP封锁问题</p>
      <NForm label-placement="top">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NFormItem label="代理地址">
            <NInput v-model:value="proxy.host" placeholder="例：proxy.example.com" />
          </NFormItem>
          <NFormItem label="端口">
            <NInput v-model:value="proxy.port" placeholder="例：8080" />
          </NFormItem>
          <NFormItem label="用户名">
            <NInput v-model:value="proxy.username" placeholder="可选" />
          </NFormItem>
          <NFormItem label="密码">
            <NInput
              v-model:value="proxy.password"
              type="password"
              show-password-on="click"
              placeholder="可选"
            />
          </NFormItem>
        </div>
        <NSpace align="center" :size="16">
          <NSpace align="center" :size="8">
            <NSwitch v-model:value="proxy.enabled" />
            <span class="text-sm text-[var(--text-sub)]">启用代理</span>
          </NSpace>
          <NButton type="primary" :loading="proxySaving" @click="saveProxy">保存配置</NButton>
        </NSpace>
      </NForm>
    </NCard>

    <!-- 下载统计 -->
    <NCard>
      <template #header>
        <div class="flex items-center justify-between w-full">
          <h3 class="font-semibold text-[var(--text-main)]">下载统计</h3>
          <NButton size="small" quaternary @click="loadStats">刷新</NButton>
        </div>
      </template>
      <NSpin :show="statsLoading">
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
          <div
            v-for="(count, platform) in stats.byPlatform"
            :key="platform"
            class="flex items-center justify-between py-2"
            style="border-bottom: 1px solid var(--border-color);"
          >
            <span class="text-sm text-[var(--text-main)]">{{ platform }}</span>
            <NTag type="success" size="small">{{ count }}</NTag>
          </div>
        </div>
        <NEmpty v-else description="暂无统计数据" />
        <div class="mt-3">
          <NButton size="small" quaternary type="error" @click="clearStats">清空统计</NButton>
        </div>
      </NSpin>
    </NCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  NCard,
  NButton,
  NInput,
  NInputNumber,
  NSwitch,
  NCheckbox,
  NForm,
  NFormItem,
  NTag,
  NSpace,
  NSpin,
  NEmpty,
  useMessage,
  useDialog,
} from 'naive-ui'
import PageHeader from '../components/PageHeader.vue'
import mediaApi from '../services/mediaApi'

const message = useMessage()
const dialog = useDialog()

const scheduler = ref({
  enabled: false,
  interval: 30,
  tasks: { douyin: true, kuaishou: true, xiaohongshu: true },
})

const proxy = ref({ host: '', port: '', username: '', password: '', enabled: false })
const proxySaving = ref(false)

const stats = ref<any>({})
const statsLoading = ref(false)
const today = new Date().toISOString().slice(0, 10)

const loadScheduler = async () => {
  try {
    const data = await mediaApi.getScheduler()
    if (data.data) scheduler.value = data.data
  } catch (e) {
    console.error(e)
  }
}

const saveScheduler = async () => {
  try {
    await mediaApi.request('/api/admin/scheduler', { method: 'POST', body: scheduler.value })
    message.success('定时任务配置已保存')
  } catch (e: any) {
    message.error(e.message || '保存失败')
  }
}

const loadProxy = async () => {
  try {
    const data = await mediaApi.getProxyConfig()
    if (data.data) proxy.value = data.data
  } catch (e) {
    console.error(e)
  }
}

const saveProxy = async () => {
  proxySaving.value = true
  try {
    await mediaApi.saveProxyConfig(proxy.value)
    message.success('代理配置已保存')
  } catch (e: any) {
    message.error(e.message || '保存失败')
  } finally {
    proxySaving.value = false
  }
}

const loadStats = async () => {
  statsLoading.value = true
  try {
    const data = await mediaApi.request('/api/admin/stats')
    if (data.data) stats.value = data.data
  } catch (e) {
    console.error(e)
  } finally {
    statsLoading.value = false
  }
}

const clearStats = () => {
  dialog.warning({
    title: '提示',
    content: '确定清空所有下载统计？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await mediaApi.request('/api/admin/stats', { method: 'DELETE' })
        message.success('统计已清空')
        await loadStats()
      } catch (e: any) {
        message.error(e.message || '清空失败')
      }
    },
  })
}

onMounted(() => {
  loadScheduler()
  loadProxy()
  loadStats()
})
</script>

<style scoped>
.stat-card {
  background: var(--bg-card);
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
}
</style>
