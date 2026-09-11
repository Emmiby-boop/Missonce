<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-[var(--text-main)]">解析工具</h1>
      <p class="text-[var(--text-sub)] mt-1">粘贴链接解析视频/图片/音频，支持抖音、小红书、快手、B站等平台</p>
    </div>

    <NCard>
      <div class="flex flex-col gap-4">
        <div class="flex flex-col md:flex-row gap-3">
          <NInput
            v-model:value="inputUrl"
            placeholder="粘贴视频/图文链接..."
            :disabled="parsing"
            clearable
            style="flex: 1"
            @keydown.enter="handleParse"
          />
          <NButton
            type="primary"
            :loading="parsing"
            :disabled="!inputUrl.trim()"
            @click="handleParse"
          >
            解析
          </NButton>
        </div>
        <div class="flex flex-wrap gap-2 items-center">
          <span class="text-xs text-[var(--text-sub)]">测试：</span>
          <NButton
            v-for="demo in demoLinks"
            :key="demo.label"
            size="tiny"
            round
            :disabled="parsing"
            @click="handleParseDemo(demo.url)"
          >
            {{ demo.label }}
          </NButton>
        </div>
      </div>
    </NCard>

    <NCard v-if="parseError" :bordered="false" class="error-card">
      <p class="text-sm text-red-500">{{ parseError }}</p>
    </NCard>

    <div v-if="parsing" class="flex justify-center py-12">
      <NSpin size="large" />
    </div>

    <NEmpty v-if="!result && !parseError && !parsing" description="粘贴链接开始解析" />

    <NCard v-if="result">
      <template #header-extra>
        <NSpace align="center" :size="12">
          <NTag type="primary" round>{{ result.platform }}</NTag>
          <span v-if="parseDuration" class="text-xs text-[var(--text-sub)]">耗时 {{ parseDuration }}ms</span>
          <NButton quaternary size="small" @click="result = null">关闭</NButton>
        </NSpace>
      </template>

      <NDescriptions label-placement="left" bordered :column="2" size="small" class="mb-4">
        <NDescriptionsItem label="平台">{{ result.platform }}</NDescriptionsItem>
        <NDescriptionsItem label="作者">{{ result.author || '-' }}</NDescriptionsItem>
        <NDescriptionsItem label="标题" :span="2">{{ result.title || '无标题' }}</NDescriptionsItem>
      </NDescriptions>

      <div v-if="result.cover_url" class="mb-3">
        <img :src="signedCoverUrl || getProxyUrlSync(result.cover_url)" class="w-full max-h-64 object-cover rounded-lg" alt="封面" />
      </div>

      <div v-if="result.video_url" class="mb-3">
        <NSpace align="center" :size="8" class="mb-2">
          <NButton size="small" type="primary" @click="downloadVideo">下载视频</NButton>
          <NButton size="small" @click="copyText(signedVideoUrl || result.video_url)">复制链接</NButton>
        </NSpace>
        <video :src="signedVideoUrl || result.video_url" controls class="w-full max-h-96 rounded-lg bg-black"></video>
      </div>

      <div v-if="result.image_list?.length" class="mt-3">
        <div class="grid grid-cols-3 gap-3">
          <img
            v-for="(img, i) in result.image_list"
            :key="i"
            :src="signedImageUrls[i] || getProxyUrlSync(typeof img === 'object' ? img.url : img)"
            class="rounded-lg cursor-pointer"
            @click="previewImage(i)"
          />
        </div>
      </div>
    </NCard>

    <div v-if="previewingImage" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" @click="previewingImage = null">
      <img :src="previewingImageUrl" class="max-w-full max-h-[90vh] object-contain" @click.stop />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { NCard, NInput, NButton, NSpace, NTag, NEmpty, NSpin, NDescriptions, NDescriptionsItem, useMessage } from 'naive-ui'
import mediaApi from '../services/mediaApi'

const API_BASE = 'https://api.missonce.cc'
const message = useMessage()

const inputUrl = ref('')
const parsing = ref(false)
const result = ref<any>(null)
const parseError = ref('')
const parseDuration = ref(0)
const signedVideoUrl = ref('')
const signedCoverUrl = ref('')
const signedImageUrls = ref<string[]>([])
const previewingImage = ref<string | null>(null)
const previewingImageUrl = ref('')

const demoLinks = [
  { label: '抖音', url: 'https://v.douyin.com/iRNBho6M/' },
  { label: '小红书', url: 'https://www.xiaohongshu.com/explore/' },
  { label: '快手', url: 'https://v.kuaishou.com/' },
]

const getProxyUrlSync = (url: string) => url ? `${API_BASE}/api/proxyDownload?url=${encodeURIComponent(url)}` : ''

const handleParse = async () => {
  if (!inputUrl.value.trim() || parsing.value) return
  parsing.value = true
  parseError.value = ''
  result.value = null
  const t0 = Date.now()
  try {
    const d = await mediaApi.parseUrl(inputUrl.value.trim())
    parseDuration.value = Date.now() - t0
    if (d.succ && d.data) {
      result.value = d.data
      if (d.data.video_url) signedVideoUrl.value = await mediaApi.buildProxyUrl(d.data.video_url)
      if (d.data.cover_url) signedCoverUrl.value = await mediaApi.buildProxyUrl(d.data.cover_url)
      if (d.data.image_list?.length) {
        signedImageUrls.value = await Promise.all(
          d.data.image_list.map((img: any) => mediaApi.buildProxyUrl(typeof img === 'object' ? img.url : img))
        )
      }
      message.success(`解析成功 · ${d.data.platform}`)
    } else {
      parseError.value = d.retdesc || '解析失败'
    }
  } catch (e: any) {
    parseError.value = e.message || '网络错误'
  } finally {
    parsing.value = false
  }
}

const handleParseDemo = (url: string) => {
  inputUrl.value = url
  handleParse()
}

const previewImage = (i: number) => {
  const img = result.value?.image_list?.[i]
  const url = typeof img === 'object' ? img.url : img
  previewingImageUrl.value = signedImageUrls.value[i] || getProxyUrlSync(url)
  previewingImage.value = url
}

const downloadVideo = () => {
  const url = signedVideoUrl.value || result.value?.video_url
  if (url) window.open(url, '_blank')
}

const copyText = async (text: string) => {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    message.success('已复制')
  } catch {
    message.error('复制失败')
  }
}
</script>

<style scoped>
.error-card {
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.3);
}
</style>
