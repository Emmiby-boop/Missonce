<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="glass-panel">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="panel-title">加群页配置</h2>
          <p class="panel-sub">配置小程序加群页面的二维码、文案、功能卡片等内容</p>
        </div>
        <button class="btn-primary" :disabled="saving" @click="handleSave">
          {{ saving ? '保存中...' : '保存配置' }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="glass-panel flex justify-center py-12">
      <NSpin size="large" />
    </div>

    <!-- Form -->
    <div v-else class="space-y-6">
      <!-- 二维码上传 -->
      <div class="glass-panel">
        <h3 class="section-title">二维码图片</h3>
        <p class="section-sub">用户长按此图片识别加群，建议上传高清二维码</p>
        <div class="flex items-center gap-4 mt-4">
          <div v-if="qrPreview" class="relative w-32 h-32 rounded-lg overflow-hidden border border-[var(--border-color)]">
            <img :src="qrPreview" class="w-full h-full object-cover" />
            <button class="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/80" @click="removeQrImage">×</button>
          </div>
          <label v-else class="w-32 h-32 rounded-lg border-2 border-dashed border-[var(--border-color)] flex items-center justify-center cursor-pointer hover:border-[var(--primary)] transition-colors">
            <span class="text-xs text-[var(--text-sub)]">点击上传</span>
            <input type="file" accept="image/*" class="hidden" @change="handleQrUpload" />
          </label>
          <span v-if="uploading" class="text-sm text-[var(--text-sub)]">上传中...</span>
        </div>
      </div>

      <!-- 文案配置 -->
      <div class="glass-panel">
        <h3 class="section-title">页面文案</h3>
        <div class="grid gap-4 mt-4">
          <div class="field">
            <label class="form-label">徽章文案</label>
            <NInput v-model:value="form.eyebrow" placeholder="如：社群公告" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="field">
              <label class="form-label">标题第一行</label>
              <NInput v-model:value="form.title1" placeholder="如：小辣椒" />
            </div>
            <div class="field">
              <label class="form-label">标题第二行</label>
              <NInput v-model:value="form.title2" placeholder="如：动态头像交流群" />
            </div>
          </div>
          <div class="field">
            <label class="form-label">副标题</label>
            <NInput v-model:value="form.subtitle" type="textarea" :rows="2" placeholder="如：欢迎加入，一起玩转动效头像..." />
          </div>
        </div>
      </div>

      <!-- 统计卡片 -->
      <div class="glass-panel">
        <h3 class="section-title">统计卡片</h3>
        <p class="section-sub">二维码上方的 3 个数据卡片</p>
        <div class="grid grid-cols-3 gap-4 mt-4">
          <div v-for="(stat, idx) in form.stats" :key="idx" class="space-y-2">
            <div class="field">
              <label class="form-label">卡片{{ idx + 1 }}数值</label>
              <NInput v-model:value="stat.value" placeholder="如：24h" />
            </div>
            <div class="field">
              <label class="form-label">卡片{{ idx + 1 }}标签</label>
              <NInput v-model:value="stat.label" placeholder="如：活跃交流" />
            </div>
          </div>
        </div>
      </div>

      <!-- 功能卡片 -->
      <div class="glass-panel">
        <h3 class="section-title">功能卡片</h3>
        <p class="section-sub">二维码下方的 3 个特色介绍卡片</p>
        <div class="grid gap-4 mt-4">
          <div v-for="(feature, idx) in form.features" :key="idx" class="grid grid-cols-[auto_1fr] gap-4 items-start p-3 rounded-lg bg-[var(--bg-body)]">
            <span class="w-8 h-8 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center text-sm font-bold shrink-0">{{ idx + 1 }}</span>
            <div class="grid gap-2 flex-1">
              <div class="field">
                <label class="form-label">标题</label>
                <NInput v-model:value="feature.title" placeholder="如：趣味头像" />
              </div>
              <div class="field">
                <label class="form-label">描述</label>
                <NInput v-model:value="feature.desc" type="textarea" :rows="2" placeholder="如：精选动态头像资源..." />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NInput, NSpin, useMessage } from 'naive-ui'
import { app } from '../utils/cloudbase'
import { useConfigStore } from '../stores/config'

const message = useMessage()
const configStore = useConfigStore()

interface StatItem { value: string; label: string }
interface FeatureItem { title: string; desc: string }
interface GroupQrConfig {
  qrImage: string
  eyebrow: string
  title1: string
  title2: string
  subtitle: string
  stats: StatItem[]
  features: FeatureItem[]
}

const defaultConfig: GroupQrConfig = {
  qrImage: '',
  eyebrow: '社群公告',
  title1: '小辣椒',
  title2: '动态头像交流群',
  subtitle: '欢迎加入，一起玩转动效头像、分享创意素材，让每一次聊天都更有趣。',
  stats: [
    { value: '24h', label: '活跃交流' },
    { value: '素材', label: '免费共享' },
    { value: '反馈', label: '在线答疑' }
  ],
  features: [
    { title: '趣味头像', desc: '精选动态头像资源，让你的头像更吸睛。' },
    { title: '互助答疑', desc: '遇到问题随时提问，热心群友一起解决。' },
    { title: '素材投稿', desc: '好的素材，可以一起分享。' }
  ]
}

const loading = ref(true)
const saving = ref(false)
const uploading = ref(false)
const form = ref<GroupQrConfig>({ ...defaultConfig, stats: [...defaultConfig.stats], features: [...defaultConfig.features] })
const qrPreview = ref('')

onMounted(async () => {
  await loadConfig()
})

async function loadConfig() {
  loading.value = true
  try {
    const config = await configStore.get<GroupQrConfig>('groupQr')
    if (config) {
      form.value = {
        ...defaultConfig,
        ...config,
        stats: config.stats?.length === 3 ? config.stats : defaultConfig.stats,
        features: config.features?.length === 3 ? config.features : defaultConfig.features
      }
      // 加载二维码预览
      if (form.value.qrImage) {
        if (form.value.qrImage.startsWith('cloud://')) {
          try {
            const urlRes = await app.getTempFileURL({ fileList: [form.value.qrImage] })
            qrPreview.value = urlRes.fileList?.[0]?.tempFileURL || ''
          } catch { qrPreview.value = '' }
        } else {
          qrPreview.value = form.value.qrImage
        }
      }
    }
  } catch (e) {
    console.error('加载加群页配置失败:', e)
  } finally {
    loading.value = false
  }
}

async function handleQrUpload(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return
  const file = files[0]
  uploading.value = true
  try {
    const cloudPath = `config/group-qr-${Date.now()}-${file.name}`
    const res = await app.uploadFile({ cloudPath, filePath: file as unknown as string })
    form.value.qrImage = res.fileID
    const urlRes = await app.getTempFileURL({ fileList: [res.fileID] })
    qrPreview.value = urlRes.fileList?.[0]?.tempFileURL || ''
  } catch (err) {
    console.error('二维码上传失败:', err)
    message.error('二维码上传失败')
  } finally {
    uploading.value = false
    target.value = ''
  }
}

function removeQrImage() {
  form.value.qrImage = ''
  qrPreview.value = ''
}

async function handleSave() {
  if (!form.value.qrImage) {
    message.warning('请先上传二维码图片')
    return
  }
  saving.value = true
  try {
    const ok = await configStore.set('groupQr', { ...form.value })
    if (ok) {
      message.success('保存成功')
    } else {
      message.error('保存失败')
    }
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
}
.section-sub {
  font-size: 13px;
  color: var(--text-sub);
  margin-top: 4px;
}
</style>
