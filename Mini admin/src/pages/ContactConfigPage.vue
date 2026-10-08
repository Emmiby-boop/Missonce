<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="glass-panel">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="panel-title">联系方式配置</h2>
          <p class="panel-sub">配置公众号二维码，展示在小程序中</p>
        </div>
        <button class="btn-primary" @click="openAddModal">
          <PlusIcon class="w-5 h-5 mr-1" />
          添加配置
        </button>
      </div>
    </div>

    <!-- Config List -->
    <div class="grid gap-4">
      <!-- Loading -->
      <div v-if="loading" class="glass-panel flex justify-center py-12">
        <NSpin size="large" />
      </div>

      <!-- Empty -->
      <div v-else-if="configs.length === 0" class="glass-panel flex flex-col items-center text-center py-12">
        <PhotoIcon class="w-16 h-16 text-[var(--text-sub)] opacity-30" />
        <h2 class="panel-title mt-4">暂无配置</h2>
        <p class="panel-sub">点击上方按钮添加公众号配置</p>
      </div>

      <!-- Cards -->
      <div v-else v-for="config in configs" :key="config._id" class="glass-panel !p-4">
        <div class="flex items-start gap-4">
          <!-- QR Code Preview -->
          <div class="w-24 h-24 rounded-lg overflow-hidden bg-[var(--bg-body)] flex-shrink-0">
            <img
              v-if="config.qrcodeUrl"
              :src="config.qrcodeUrl"
              class="w-full h-full object-cover"
              alt="二维码"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <PhotoIcon class="w-8 h-8 text-[var(--text-sub)] opacity-30" />
            </div>
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span
                class="badge"
                :class="config.type === 'official_account' ? 'badge-info' : 'badge-success'"
              >
                {{ config.type === 'official_account' ? '公众号' : '其他' }}
              </span>
              <span
                class="badge"
                :class="config.enabled ? 'badge-success' : 'badge'"
              >
                {{ config.enabled ? '已启用' : '已禁用' }}
              </span>
            </div>
            <h3 class="font-semibold mt-2 text-[var(--text-main)]">{{ config.name || '未命名' }}</h3>
            <p class="text-sm text-[var(--text-sub)] mt-1 line-clamp-2">
              {{ config.description || '暂无描述' }}
            </p>
          </div>

          <!-- Actions -->
          <div class="flex gap-2">
            <button class="btn-ghost btn-sm" @click="openEditModal(config)" title="编辑">
              <PencilIcon class="w-4 h-4" />
            </button>
            <button class="btn-danger-ghost btn-sm" @click="handleDelete(config)" title="删除">
              <TrashIcon class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <NModal
      v-model:show="showModal"
      preset="card"
      :title="editingConfig ? '编辑配置' : '添加配置'"
      style="width: 480px; max-width: 90vw;"
      :bordered="false"
    >
      <NSpace vertical :size="16">
        <!-- Type -->
        <div class="field">
          <label class="form-label">类型</label>
          <NSelect
            v-model:value="formData.type"
            :options="typeOptions"
          />
        </div>

        <!-- Name -->
        <div class="field">
          <label class="form-label">名称</label>
          <NInput
            v-model:value="formData.name"
            placeholder="例如：关注公众号"
          />
        </div>

        <!-- Description -->
        <div class="field">
          <label class="form-label">描述</label>
          <NInput
            v-model:value="formData.description"
            type="textarea"
            :rows="2"
            placeholder="显示在二维码下方的描述文字"
          />
        </div>

        <!-- QR Code -->
        <div class="field">
          <label class="form-label">二维码图片</label>
          <div
            class="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-[var(--primary)] transition-colors"
            @click="triggerFileInput"
          >
            <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleFileChange"
            />
            <div v-if="uploading" class="py-4 flex flex-col items-center gap-2">
              <NSpin size="small" />
              <p class="text-sm text-[var(--text-sub)]">上传中...</p>
            </div>
            <div v-else-if="formData.qrcodeUrl" class="relative inline-block">
              <img :src="formData.qrcodeUrl" class="w-32 h-32 mx-auto object-contain rounded" />
              <button
                type="button"
                class="btn-danger-ghost btn-circle btn-xs absolute -top-2 -right-2"
                @click.stop="formData.qrcodeUrl = ''"
              >
                ✕
              </button>
            </div>
            <div v-else class="py-4">
              <ArrowUpTrayIcon class="w-8 h-8 mx-auto text-[var(--text-sub)] opacity-40" />
              <p class="mt-2 text-sm text-[var(--text-sub)]">点击上传二维码图片</p>
            </div>
          </div>
        </div>

        <!-- Enabled -->
        <div class="flex items-center justify-between">
          <span class="form-label !mb-0">启用</span>
          <NSwitch v-model:value="formData.enabled" />
        </div>
      </NSpace>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="closeModal">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="handleSubmit">
            保存
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NModal, NInput, NSelect, NSwitch, NButton, NSpin, NSpace, useMessage } from 'naive-ui'
import { app, callFunctionWithAuth } from '../utils/cloudbase'
import { confirmDeleteDialog } from '../composables/useDialog'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PhotoIcon,
  ArrowUpTrayIcon
} from '@heroicons/vue/24/outline'

const message = useMessage()

interface ContactConfig {
  _id?: string
  type: string
  name: string
  description: string
  qrcodeUrl: string
  enabled: boolean
  _cloudPath?: string
}

const typeOptions = [
  { label: '公众号', value: 'official_account' }
]

const loading = ref(true)
const configs = ref<ContactConfig[]>([])
const showModal = ref(false)
const submitting = ref(false)
const uploading = ref(false)
const editingConfig = ref<ContactConfig | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

const defaultFormData: ContactConfig = {
  type: 'official_account',
  name: '',
  description: '',
  qrcodeUrl: '',
  enabled: true
}

const formData = ref<ContactConfig>({ ...defaultFormData })

onMounted(() => {
  loadConfigs()
})

async function loadConfigs() {
  loading.value = true
  try {
    const res = await callFunctionWithAuth('manageContactConfig', { action: 'list' })

    if (res.result?.success) {
      // 获取临时链接
      const configsWithUrl = await Promise.all(
        (res.result.data || []).map(async (config: ContactConfig) => {
          if (config.qrcodeUrl) {
            try {
              const urlRes = await app.getTempFileURL({ fileList: [config.qrcodeUrl] })
              if (urlRes.fileList?.[0]?.tempFileURL) {
                config.qrcodeUrl = urlRes.fileList[0].tempFileURL
              }
            } catch (e) {
              console.error('获取临时链接失败:', e)
            }
          }
          return config
        })
      )
      configs.value = configsWithUrl
    }
  } catch (error) {
    console.error('加载配置失败:', error)
  } finally {
    loading.value = false
  }
}

function openAddModal() {
  editingConfig.value = null
  formData.value = { ...defaultFormData }
  showModal.value = true
}

function openEditModal(config: ContactConfig) {
  editingConfig.value = config
  formData.value = { ...config }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingConfig.value = null
  formData.value = { ...defaultFormData }
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

async function handleFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  uploading.value = true
  try {
    // 上传到云存储
    const uploadRes = await app.uploadFile({
      cloudPath: `contact-qrcode/${Date.now()}-${file.name}`,
      filePath: file
    })

    if (uploadRes.fileID) {
      // 获取临时链接
      const tempUrlRes = await app.getTempFileURL({ fileList: [uploadRes.fileID] })
      if (tempUrlRes.fileList?.[0]?.tempFileURL) {
        formData.value.qrcodeUrl = tempUrlRes.fileList[0].tempFileURL
        // 保存云存储 ID 用于提交
        formData.value._cloudPath = uploadRes.fileID
      }
    }
  } catch (error) {
    console.error('上传失败:', error)
    message.error('上传失败，请重试')
  } finally {
    uploading.value = false
  }
}

async function handleSubmit() {
  submitting.value = true
  try {
    const action = editingConfig.value ? 'update' : 'add'
    const submitData = { ...formData.value }

    // 如果是新上传的图片，使用云存储路径
    if (submitData._cloudPath) {
      submitData.qrcodeUrl = submitData._cloudPath
    }
    delete submitData._cloudPath

    const res = await callFunctionWithAuth('manageContactConfig', {
      action,
      data: editingConfig.value
        ? { ...submitData, _id: editingConfig.value._id }
        : submitData
    })

    if (res.result?.success) {
      message.success('保存成功')
      closeModal()
      loadConfigs()
    } else {
      message.error(res.result?.message || '保存失败')
    }
  } catch (error) {
    console.error('保存失败:', error)
    message.error('保存失败，请重试')
  } finally {
    submitting.value = false
  }
}

async function handleDelete(config: ContactConfig) {
  const confirmed = await confirmDeleteDialog(`确定要删除"${config.name}"吗？`)
  if (!confirmed) return

  try {
    const res = await callFunctionWithAuth('manageContactConfig', { action: 'delete', data: { _id: config._id } })

    if (res.result?.success) {
      message.success('删除成功')
      loadConfigs()
    } else {
      message.error(res.result?.message || '删除失败')
    }
  } catch (error) {
    console.error('删除失败:', error)
    message.error('删除失败，请重试')
  }
}
</script>
