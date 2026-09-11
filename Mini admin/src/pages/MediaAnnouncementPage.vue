<template>
  <div class="announcement-page">
    <div class="page-header-block">
      <h1 class="page-title">解析公告</h1>
      <p class="page-subtitle">管理去水印小程序首页公告内容</p>
    </div>

    <!-- 当前公告预览 -->
    <NCard title="当前公告" class="section-card">
      <NSpin :show="loading">
        <div
          class="preview-box"
          :class="announcement.priority === 'high' ? 'preview-high' : 'preview-normal'"
        >
          <p class="preview-content">{{ announcement.content || '暂无公告' }}</p>
          <div class="preview-meta">
            <span v-if="announcement.url" class="meta-link">跳转链接已设置</span>
            <span class="badge" :class="priorityBadgeClass">{{ priorityLabel }}</span>
            <span v-if="announcement.showPopup" class="badge badge-popup">弹窗显示</span>
          </div>
        </div>
      </NSpin>
    </NCard>

    <!-- 编辑公告 -->
    <NCard title="编辑公告" class="section-card">
      <div class="form-list">
        <div class="form-row">
          <label class="form-label">公告内容 *</label>
          <NInput
            v-model:value="form.content"
            type="textarea"
            :rows="3"
            placeholder="输入公告内容..."
          />
        </div>
        <div class="form-row">
          <label class="form-label">跳转链接（可选）</label>
          <NInput
            v-model:value="form.url"
            placeholder="点击公告跳转的页面路径或网页链接"
          />
        </div>
        <div class="form-row-inline">
          <div class="form-row inline-item">
            <label class="form-label">优先级</label>
            <NSelect
              v-model:value="form.priority"
              :options="priorityOptions"
              class="priority-select"
            />
          </div>
          <div class="form-row inline-item switch-row">
            <label class="form-label">弹窗显示</label>
            <NSwitch v-model:value="form.showPopup" />
          </div>
        </div>
        <div class="form-actions">
          <NButton
            type="primary"
            :loading="saving"
            :disabled="!form.content.trim()"
            @click="saveAnnouncement"
          >
            保存公告
          </NButton>
          <NButton @click="loadAnnouncement">重置</NButton>
        </div>
      </div>
    </NCard>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { NSpin, NCard, NInput, NSelect, NSwitch, NButton, useMessage } from 'naive-ui'
import mediaApi from '../services/mediaApi'

const message = useMessage()

const loading = ref(true)
const saving = ref(false)
const announcement = reactive({ content: '', url: '', showPopup: false, priority: 'normal' })
const form = reactive({ content: '', url: '', showPopup: false, priority: 'normal' })

const priorityOptions = [
  { label: '高', value: 'high' },
  { label: '普通', value: 'normal' },
  { label: '低', value: 'low' },
]

const priorityLabel = computed(() => {
  if (announcement.priority === 'high') return '高优先级'
  if (announcement.priority === 'low') return '低优先级'
  return '普通'
})

const priorityBadgeClass = computed(() => {
  if (announcement.priority === 'high') return 'badge-high'
  if (announcement.priority === 'normal') return 'badge-normal'
  return 'badge-low'
})

const loadAnnouncement = async () => {
  loading.value = true
  try {
    const data = await mediaApi.getAnnouncement()
    if (data.data) {
      announcement.content = data.data.content || ''
      announcement.url = data.data.url || ''
      announcement.showPopup = !!data.data.showPopup
      announcement.priority = data.data.priority || 'normal'
      form.content = announcement.content
      form.url = announcement.url
      form.showPopup = announcement.showPopup
      form.priority = announcement.priority
    }
  } catch (e) {
    console.error('加载公告失败:', e)
  } finally {
    loading.value = false
  }
}

const saveAnnouncement = async () => {
  if (!form.content.trim()) {
    message.warning('请输入公告内容')
    return
  }
  saving.value = true
  try {
    await mediaApi.saveAnnouncement(form)
    message.success('公告保存成功')
    await loadAnnouncement()
  } catch (e: any) {
    message.error(e.message || '保存失败，请检查后端服务')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadAnnouncement()
})
</script>

<style scoped>
.announcement-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.page-header-block {
  margin-bottom: 4px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--text-main);
  line-height: 1.2;
}

.page-subtitle {
  margin: 8px 0 0;
  font-size: 14px;
  color: var(--text-sub);
}

.section-card {
  margin-bottom: 16px;
}

.preview-box {
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-body);
}

.preview-high {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.05);
}

.preview-normal {
  border-color: var(--border-color);
  background: var(--bg-body);
}

.preview-content {
  margin: 0;
  font-size: 14px;
  color: var(--text-main);
}

.preview-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.meta-link {
  font-size: 12px;
  color: var(--primary);
}

.badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 9999px;
}

.badge-high {
  background: #fee2e2;
  color: #ef4444;
}

.badge-normal {
  background: #fef9c3;
  color: #ca8a04;
}

.badge-low {
  background: #f3f4f6;
  color: #6b7280;
}

.badge-popup {
  background: #f3e8ff;
  color: #a855f7;
}

.form-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-row-inline {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  flex-wrap: wrap;
}

.inline-item {
  gap: 6px;
}

.priority-select {
  width: 200px;
}

.switch-row {
  padding-top: 0;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-sub);
}

.form-actions {
  display: flex;
  gap: 12px;
}
</style>
