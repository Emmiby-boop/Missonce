<template>
  <div class="space-y-6">
    <PageHeader title="域名白名单" subtitle="管理代理下载和音频提取允许的域名" />

    <NSpin :show="loading">
      <div class="space-y-6">
        <!-- 代理域名白名单 -->
        <NCard>
          <template #header>
            <div class="flex items-center gap-3">
              <div class="domain-icon blue">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              </div>
              <div>
                <h3 class="font-semibold text-[var(--text-main)]">代理下载域名</h3>
                <p class="text-xs text-[var(--text-sub)]">{{ proxyDomains.length }} 个域名</p>
              </div>
            </div>
          </template>
          <NSpace vertical :size="16">
            <NSpace>
              <NInput
                v-model:value="newProxyDomain"
                placeholder="输入域名，如 douyinvod.com"
                style="min-width: 280px"
                @keyup.enter="addProxyDomain"
              />
              <NButton type="primary" :loading="proxyAdding" :disabled="!newProxyDomain.trim()" @click="addProxyDomain">添加</NButton>
            </NSpace>
            <div v-if="proxyDomains.length" class="flex flex-wrap gap-2">
              <div v-for="d in proxyDomains" :key="d" class="domain-item">
                <NTag type="info" round>{{ d }}</NTag>
                <NButton size="tiny" quaternary type="error" @click="confirmRemoveProxy(d)">删除</NButton>
              </div>
            </div>
            <NEmpty v-else description="暂无数据" />
          </NSpace>
        </NCard>

        <!-- 音频域名白名单 -->
        <NCard>
          <template #header>
            <div class="flex items-center gap-3">
              <div class="domain-icon purple">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </div>
              <div>
                <h3 class="font-semibold text-[var(--text-main)]">音频提取域名</h3>
                <p class="text-xs text-[var(--text-sub)]">{{ audioDomains.length }} 个域名</p>
              </div>
            </div>
          </template>
          <NSpace vertical :size="16">
            <NSpace>
              <NInput
                v-model:value="newAudioDomain"
                placeholder="输入域名，如 bilivideo.com"
                style="min-width: 280px"
                @keyup.enter="addAudioDomain"
              />
              <NButton type="primary" :loading="audioAdding" :disabled="!newAudioDomain.trim()" @click="addAudioDomain">添加</NButton>
            </NSpace>
            <div v-if="audioDomains.length" class="flex flex-wrap gap-2">
              <div v-for="d in audioDomains" :key="d" class="domain-item">
                <NTag type="info" round>{{ d }}</NTag>
                <NButton size="tiny" quaternary type="error" @click="confirmRemoveAudio(d)">删除</NButton>
              </div>
            </div>
            <NEmpty v-else description="暂无数据" />
          </NSpace>
        </NCard>
      </div>
    </NSpin>

    <!-- 操作 -->
    <NSpace>
      <NButton @click="resetDefaults">恢复默认</NButton>
    </NSpace>

    <!-- 使用说明 -->
    <NCard title="说明">
      <div class="text-sm text-[var(--text-sub)] space-y-2">
        <p>1. <strong>代理下载域名</strong>：小程序通过服务器代理下载视频时，只允许这些域名的请求通过</p>
        <p>2. <strong>音频提取域名</strong>：从视频中提取音频时，只允许这些域名的请求通过</p>
        <p>3. 添加域名时只需输入主域名（如 douyinvod.com），子域名会自动匹配</p>
        <p>4. 修改立即生效，无需重启服务</p>
      </div>
    </NCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NCard, NButton, NInput, NTag, NSpace, NSpin, NEmpty, useMessage, useDialog } from 'naive-ui'
import PageHeader from '../components/PageHeader.vue'
import mediaApi from '../services/mediaApi'

const message = useMessage()
const dialog = useDialog()

const proxyDomains = ref<string[]>([])
const audioDomains = ref<string[]>([])
const newProxyDomain = ref('')
const newAudioDomain = ref('')
const proxyAdding = ref(false)
const audioAdding = ref(false)
const loading = ref(false)

const loadWhitelist = async () => {
  loading.value = true
  try {
    const data = await mediaApi.getWhitelist()
    proxyDomains.value = data.data?.proxy || []
    audioDomains.value = data.data?.audio || []
  } catch (e) {
    console.error('加载白名单失败:', e)
  } finally {
    loading.value = false
  }
}

const addProxyDomain = async () => {
  const d = newProxyDomain.value.trim().toLowerCase()
  if (!d) return
  proxyAdding.value = true
  try {
    const res = await mediaApi.addProxyDomain(d)
    message.success(res.retdesc || '已添加')
    newProxyDomain.value = ''
    await loadWhitelist()
  } catch (e: any) {
    message.error(e.message || '添加失败')
  } finally {
    proxyAdding.value = false
  }
}

const confirmRemoveProxy = (domain: string) => {
  dialog.warning({
    title: '提示',
    content: `确定移除域名 ${domain}？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await mediaApi.removeProxyDomain(domain)
        message.success('已移除')
        await loadWhitelist()
      } catch (e: any) {
        message.error(e.message || '移除失败')
      }
    },
  })
}

const addAudioDomain = async () => {
  const d = newAudioDomain.value.trim().toLowerCase()
  if (!d) return
  audioAdding.value = true
  try {
    const res = await mediaApi.addAudioDomain(d)
    message.success(res.retdesc || '已添加')
    newAudioDomain.value = ''
    await loadWhitelist()
  } catch (e: any) {
    message.error(e.message || '添加失败')
  } finally {
    audioAdding.value = false
  }
}

const confirmRemoveAudio = (domain: string) => {
  dialog.warning({
    title: '提示',
    content: `确定移除域名 ${domain}？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await mediaApi.removeAudioDomain(domain)
        message.success('已移除')
        await loadWhitelist()
      } catch (e: any) {
        message.error(e.message || '移除失败')
      }
    },
  })
}

const resetDefaults = () => {
  dialog.warning({
    title: '提示',
    content: '确定恢复默认白名单？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await mediaApi.request('/api/admin/whitelist/reset', { method: 'POST' })
        message.success('已恢复默认')
        await loadWhitelist()
      } catch (e: any) {
        message.error(e.message || '重置失败')
      }
    },
  })
}

onMounted(() => {
  loadWhitelist()
})
</script>

<style scoped>
.domain-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.domain-icon.blue {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}
.domain-icon.purple {
  background: rgba(168, 85, 247, 0.1);
  color: #a855f7;
}
.domain-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
