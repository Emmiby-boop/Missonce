<template>
  <div class="space-y-6">
    <PageHeader title="Cookie 配置" subtitle="配置抖音、小红书的登录 Cookie，用于获取视频直链" />

    <NSpin :show="loading">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NCard v-for="cp in cookiePlatforms" :key="cp.key">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="platform-icon" :style="{ background: cp.color }">{{ cp.name.charAt(0) }}</div>
              <div>
                <h3 class="font-semibold text-[var(--text-main)]">{{ cp.name }}</h3>
                <p class="text-xs text-[var(--text-sub)]">{{ cp.desc }}</p>
              </div>
            </div>
            <NTag :type="getCookieStatusType(cp.key)" size="small" round>{{ getCookieStatusText(cp.key) }}</NTag>
          </div>
          <NSpace vertical :size="12">
            <div>
              <label class="block text-xs font-medium text-[var(--text-sub)] mb-1">Cookie 值</label>
              <NInput
                v-model:value="cookieForms[cp.key]"
                type="textarea"
                :rows="3"
                :placeholder="`粘贴 ${cp.name} 的 Cookie...`"
              />
            </div>
            <div class="flex items-end gap-3">
              <div class="flex-1">
                <label class="block text-xs font-medium text-[var(--text-sub)] mb-1">过期时间（可选）</label>
                <NDatePicker v-model:value="expireForms[cp.key]" type="datetime" clearable class="w-full" />
              </div>
              <NSpace :size="8">
                <NButton
                  type="primary"
                  size="small"
                  :loading="saving[cp.key]"
                  :disabled="!cookieForms[cp.key]?.trim()"
                  @click="saveCookie(cp.key)"
                >保存</NButton>
                <NButton
                  size="small"
                  :disabled="!cookieStatus[cp.key]?.hasCookie"
                  @click="deleteCookie(cp.key)"
                >删除</NButton>
              </NSpace>
            </div>
            <p v-if="cookieStatus[cp.key]?.updatedAt" class="text-xs text-[var(--text-sub)]">
              上次更新: {{ formatCookieTime(cookieStatus[cp.key].updatedAt) }}
            </p>
          </NSpace>
        </NCard>
      </div>
    </NSpin>

    <NCard title="使用说明">
      <div class="text-sm text-[var(--text-sub)] space-y-2">
        <p>1. 在电脑/手机浏览器登录对应平台</p>
        <p>2. 打开开发者工具 → Network → 找到任意请求 → 复制 Cookie 头的值</p>
        <p>3. 粘贴到上方输入框，点击保存</p>
        <p>4. Cookie 过期后在后台重新配置即可</p>
        <p class="text-yellow-500 mt-3">⚠ Cookie 有效期通常为 7-30 天，过期后需要重新获取</p>
      </div>
    </NCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NCard, NButton, NInput, NTag, NDatePicker, NSpin, NSpace, useMessage, useDialog } from 'naive-ui'
import PageHeader from '../components/PageHeader.vue'
import mediaApi from '../services/mediaApi'

const message = useMessage()
const dialog = useDialog()

const cookiePlatforms = [
  { key: 'douyin', name: '抖音', color: '#161823', desc: '获取抖音视频直链' },
  { key: 'xiaohongshu', name: '小红书', color: '#FE2C55', desc: '获取小红书笔记内容' },
]
const cookieStatus = ref<Record<string, any>>({})
const cookieForms = ref<Record<string, string>>({})
const expireForms = ref<Record<string, number | undefined>>({})
const loading = ref(false)
const saving = ref<Record<string, boolean>>({})

const loadCookieStatus = async () => {
  loading.value = true
  try {
    const data = await mediaApi.getCookies()
    cookieStatus.value = data.data || {}
  } catch (e) {
    console.error('加载 Cookie 状态失败:', e)
  } finally {
    loading.value = false
  }
}

const saveCookie = async (platform: string) => {
  const cookie = cookieForms.value[platform]?.trim()
  if (!cookie) return
  saving.value[platform] = true
  try {
    const ts = expireForms.value[platform]
    await mediaApi.saveCookie(platform, cookie, ts ? new Date(ts).toISOString() : undefined)
    message.success(`${platform} Cookie 保存成功`)
    cookieForms.value[platform] = ''
    expireForms.value[platform] = undefined
    await loadCookieStatus()
  } catch (e: any) {
    message.error(e.message || '保存失败')
  } finally {
    saving.value[platform] = false
  }
}

const deleteCookie = (platform: string) => {
  dialog.warning({
    title: '提示',
    content: `确定删除 ${platform} 的 Cookie？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await mediaApi.request('/api/admin/cookies', { method: 'DELETE', body: { platform } })
        message.success('已删除')
        await loadCookieStatus()
      } catch (e: any) {
        message.error(e.message || '删除失败')
      }
    },
  })
}

const getCookieStatusType = (platform: string): 'default' | 'error' | 'success' => {
  const c = cookieStatus.value[platform]
  if (!c?.hasCookie) return 'default'
  if (c.status === 'expired') return 'error'
  return 'success'
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

<style scoped>
.platform-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
}
</style>
