<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="glass-panel">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="panel-title">头像框管理</h2>
          <p class="panel-sub">直接上传 PNG / GIF 头像框 · PNG 自动归类为静态框 · GIF 自动归类为动态框</p>
        </div>
        <div class="flex gap-2">
          <button v-if="selectedFrames.length > 0" class="btn-soft" :style="{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }" @click="batchDelete">
            批量删除 ({{ selectedFrames.length }})
          </button>
          <button class="btn-primary gap-2" :disabled="uploading" @click="triggerUpload">
            <svg v-if="!uploading" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5.5 17a4.5 4.5 0 01-1.44-8.765 4.5 4.5 0 018.302-3.046 3.5 3.5 0 014.504 4.272A4 4 0 0115 17H5.5zm3.75-2.75a.75.75 0 001.5 0V9.66l2.95 2.95a.75.75 0 101.06-1.06l-4.25-4.25a.75.75 0 00-1.06 0l-4.25 4.25a.75.75 0 101.06 1.06l2.95-2.95v4.59z" clip-rule="evenodd" />
            </svg>
            <svg v-else class="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ uploading ? '上传中...' : '上传头像框' }}
          </button>
          <input ref="fileInput" type="file" accept="image/png,image/gif" multiple class="hidden" @change="handleFileChange" />
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      <div v-for="i in 10" :key="i" class="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden animate-pulse">
        <div class="aspect-square bg-[var(--border-color)]"></div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="frames.length === 0" class="glass-panel flex flex-col items-center justify-center py-16 text-center">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-[var(--text-sub)] opacity-30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <p class="text-[var(--text-sub)] mb-2">还没有上传头像框</p>
      <p class="text-sm text-[var(--text-sub)] opacity-70">点击右上角"上传头像框"按钮添加</p>
    </div>

    <!-- Frames Grid -->
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      <div
        v-for="item in frames"
        :key="item._id"
        class="group relative bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] overflow-hidden hover:shadow-lg transition-all duration-300"
        :class="{'ring-2 ring-[var(--primary)]': selectedFrames.includes(item._id)}"
      >
        <!-- 勾选 -->
        <div class="absolute top-2 right-2 z-10">
          <input
            type="checkbox"
            :value="item._id"
            v-model="selectedFrames"
            class="w-5 h-5 rounded border-[var(--border-color)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
          />
        </div>

        <!-- 格式角标 -->
        <div class="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-xs font-bold backdrop-blur-md"
             :class="item.format === 'gif' ? 'bg-purple-500/90 text-white' : 'bg-blue-500/90 text-white'">
          {{ item.format === 'gif' ? 'GIF' : 'PNG' }}
        </div>

        <!-- 删除按钮 -->
        <button
          class="absolute bottom-2 right-2 z-10 w-8 h-8 rounded-full bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          @click.stop="deleteFrame(item)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        </button>

        <!-- 预览图 -->
        <div class="aspect-square w-full bg-[var(--bg-body)] relative overflow-hidden">
          <img v-if="item.displayUrl" :src="item.displayUrl" class="w-full h-full object-contain" />
          <div v-else class="w-full h-full flex items-center justify-center text-[var(--text-sub)]">
            <span class="text-xs">加载中</span>
          </div>
        </div>

        <!-- 底部信息 -->
        <div class="p-3">
          <p class="text-sm font-medium truncate">{{ item.name }}</p>
          <p class="text-xs text-[var(--text-sub)] mt-0.5">{{ item.format === 'gif' ? '动态框' : '静态框' }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import { callCloudFunction, app } from '../utils/cloudbase'
import { confirmDeleteDialog } from '../composables/useDialog'

const message = useMessage()

const frames = ref([])
const loading = ref(true)
const uploading = ref(false)
const selectedFrames = ref([])
const fileInput = ref(null)

onMounted(() => {
  loadFrames()
})

async function loadFrames() {
  loading.value = true
  try {
    const res = await callCloudFunction('manageAvatarFrames', { action: 'list', data: { status: 'active' } })
    // 修复：callCloudFunction 已返回 res.result，应直接访问 res?.data
    const list = res?.data || []

    // 批量获取临时 URL
    const fileIDs = list.map(f => f.fileID).filter(Boolean)
    if (fileIDs.length > 0) {
      const chunks = []
      for (let i = 0; i < fileIDs.length; i += 50) {
        chunks.push(fileIDs.slice(i, i + 50))
      }
      const urlMap = {}
      for (const chunk of chunks) {
        const urlRes = await app.getTempFileURL({ fileList: chunk })
        urlRes.fileList.forEach(f => {
          if (f.tempFileURL) urlMap[f.fileID] = f.tempFileURL
        })
      }
      list.forEach(f => { f.displayUrl = urlMap[f.fileID] || '' })
    }

    frames.value = list
  } catch (e) {
    console.error('加载头像框失败:', e)
    message.error('加载失败')
  } finally {
    loading.value = false
  }
}

function triggerUpload() {
  fileInput.value?.click()
}

async function handleFileChange(e) {
  const files = Array.from(e.target.files || [])
  if (files.length === 0) return

  uploading.value = true
  let successCount = 0

  try {
    for (const file of files) {
      // 根据扩展名判断格式
      const ext = file.name.split('.').pop().toLowerCase()
      const format = ext === 'gif' ? 'gif' : 'png'

      // 上传到云存储
      const cloudPath = `avatar_frames/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`
      const uploadRes = await app.uploadFile({ cloudPath, filePath: file })

      // 写入数据库
      await callCloudFunction('manageAvatarFrames', {
        action: 'add',
        data: {
          fileID: uploadRes.fileID,
          format,
          name: file.name.replace(/\.[^.]+$/, '')
        }
      })
      successCount++
    }

    message.success(`成功上传 ${successCount} 个头像框`)
    await loadFrames()
  } catch (e) {
    console.error('上传失败:', e)
    message.error('上传失败: ' + (e.message || '未知错误'))
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function deleteFrame(item) {
  const confirmed = await confirmDeleteDialog(`确定删除"${item.name}"吗？`)
  if (!confirmed) return
  try {
    await callCloudFunction('manageAvatarFrames', { action: 'delete', id: item._id })
    message.success('已删除')
    await loadFrames()
  } catch {
    message.error('删除失败')
  }
}

async function batchDelete() {
  const confirmed = await confirmDeleteDialog(`确定删除选中的 ${selectedFrames.value.length} 个头像框吗？`)
  if (!confirmed) return
  try {
    await callCloudFunction('manageAvatarFrames', {
      action: 'batchDelete',
      data: { ids: selectedFrames.value }
    })
    message.success('批量删除成功')
    selectedFrames.value = []
    await loadFrames()
  } catch {
    message.error('批量删除失败')
  }
}
</script>
