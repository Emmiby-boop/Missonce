<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-[var(--text-main)]">解析公告</h1>
      <p class="text-[var(--text-sub)] mt-1">管理去水印小程序首页公告内容</p>
    </div>

    <!-- 当前公告预览 -->
    <div class="glass-panel">
      <h3 class="font-semibold text-[var(--text-main)] mb-4">当前公告</h3>
      <div v-if="loading" class="text-center text-[var(--text-sub)] py-4">加载中...</div>
      <div v-else>
        <div class="p-4 rounded-lg border" :class="announcement.priority === 'high' ? 'border-red-500/30 bg-red-500/5' : 'border-[var(--border-color)] bg-[var(--bg-body)]'">
          <p class="text-sm text-[var(--text-main)]">{{ announcement.content || '暂无公告' }}</p>
          <div class="flex items-center gap-3 mt-2">
            <span v-if="announcement.url" class="text-xs text-[var(--primary)]">跳转链接已设置</span>
            <span class="text-xs px-2 py-0.5 rounded-full" :class="{
              'bg-red-100 text-red-500': announcement.priority === 'high',
              'bg-yellow-100 text-yellow-600': announcement.priority === 'normal',
              'bg-gray-100 text-gray-500': !announcement.priority || announcement.priority === 'low',
            }">{{ announcement.priority === 'high' ? '高优先级' : announcement.priority === 'low' ? '低优先级' : '普通' }}</span>
            <span v-if="announcement.showPopup" class="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-500">弹窗显示</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑公告 -->
    <div class="glass-panel">
      <h3 class="font-semibold text-[var(--text-main)] mb-4">编辑公告</h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-[var(--text-sub)] mb-1.5">公告内容 *</label>
          <textarea v-model="form.content" class="form-input w-full" rows="3" placeholder="输入公告内容..."></textarea>
        </div>
        <div>
          <label class="block text-sm font-medium text-[var(--text-sub)] mb-1.5">跳转链接（可选）</label>
          <input v-model="form.url" type="text" class="form-input w-full" placeholder="点击公告跳转的页面路径或网页链接" />
        </div>
        <div class="flex items-center gap-6">
          <div>
            <label class="block text-sm font-medium text-[var(--text-sub)] mb-1.5">优先级</label>
            <select v-model="form.priority" class="form-input">
              <option value="high">高</option>
              <option value="normal">普通</option>
              <option value="low">低</option>
            </select>
          </div>
          <div class="pt-6">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" v-model="form.showPopup" class="w-4 h-4 accent-[var(--primary)]" />
              <span class="text-sm text-[var(--text-sub)]">弹窗显示</span>
            </label>
          </div>
        </div>
        <div class="flex gap-3">
          <button @click="saveAnnouncement" :disabled="saving || !form.content.trim()" class="btn-primary">
            {{ saving ? '保存中...' : '保存公告' }}
          </button>
          <button @click="loadAnnouncement" class="btn-ghost">重置</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const API_BASE = 'https://api.missonce.cc'
// API Key 从环境变量读取，不硬编码
const API_KEY = import.meta.env.VITE_ADMIN_API_KEY || ''

const loading = ref(true)
const saving = ref(false)
const announcement = reactive({ content: '', url: '', showPopup: false, priority: 'normal' })
const form = reactive({ content: '', url: '', showPopup: false, priority: 'normal' })

const loadAnnouncement = async () => {
  loading.value = true
  try {
    const res = await fetch(`${API_BASE}/api/announcement`)
    const data = await res.json()
    if (data.success && data.data) {
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
    ElMessage.warning('请输入公告内容')
    return
  }
  saving.value = true
  try {
    const res = await fetch(`${API_BASE}/api/announcement`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (data.success) {
      ElMessage.success('公告保存成功')
      await loadAnnouncement()
    } else {
      ElMessage.error(data.retdesc || '保存失败')
    }
  } catch (e) {
    ElMessage.error('保存失败，请检查后端服务')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadAnnouncement()
})
</script>
