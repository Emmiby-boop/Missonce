<template>
  <div>
    <!-- Page Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">联系方式配置</h1>
        <p class="text-base-content/60 mt-1">配置公众号二维码在小，展示程序中</p>
      </div>
      <button class="btn btn-primary" @click="openAddModal">
        <PlusIcon class="w-5 h-5 mr-1" />
        添加配置
      </button>
    </div>

    <!-- Config List -->
    <div class="grid gap-4">
      <div v-if="loading" class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
      
      <div v-else-if="configs.length === 0" class="card bg-base-100 shadow-xl">
        <div class="card-body items-center text-center py-12">
          <PhotoIcon class="w-16 h-16 text-base-content/30" />
          <h2 class="card-title mt-4">暂无配置</h2>
          <p class="text-base-content/60">点击上方按钮添加公众号配置</p>
        </div>
      </div>

      <div v-else v-for="config in configs" :key="config._id" class="card bg-base-100 shadow-md">
        <div class="card-body p-4">
          <div class="flex items-start gap-4">
            <!-- QR Code Preview -->
            <div class="w-24 h-24 rounded-lg overflow-hidden bg-base-200 flex-shrink-0">
              <img 
                v-if="config.qrcodeUrl" 
                :src="config.qrcodeUrl" 
                class="w-full h-full object-cover"
                alt="二维码"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <PhotoIcon class="w-8 h-8 text-base-content/30" />
              </div>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span 
                  class="badge"
                  :class="config.type === 'official_account' ? 'badge-info' : 'badge-success'"
                >
                  {{ config.type === 'official_account' ? '公众号' : '其他' }}
                </span>
                <span 
                  class="badge"
                  :class="config.enabled ? 'badge-success' : 'badge-ghost'"
                >
                  {{ config.enabled ? '已启用' : '已禁用' }}
                </span>
              </div>
              <h3 class="font-semibold mt-2">{{ config.name || '未命名' }}</h3>
              <p class="text-sm text-base-content/60 mt-1 line-clamp-2">
                {{ config.description || '暂无描述' }}
              </p>
            </div>

            <!-- Actions -->
            <div class="flex gap-2">
              <button class="btn btn-sm btn-ghost" @click="openEditModal(config)">
                <PencilIcon class="w-4 h-4" />
              </button>
              <button class="btn btn-sm btn-ghost text-error" @click="handleDelete(config)">
                <TrashIcon class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h3 class="font-bold text-lg mb-4">
          {{ editingConfig ? '编辑配置' : '添加配置' }}
        </h3>
        
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <!-- Type -->
          <div class="form-control">
            <label class="label">
              <span class="label-text">类型</span>
            </label>
            <select v-model="formData.type" class="select select-bordered">
              <option value="official_account">公众号</option>
            </select>
          </div>

          <!-- Name -->
          <div class="form-control">
            <label class="label">
              <span class="label-text">名称</span>
            </label>
            <input 
              v-model="formData.name" 
              type="text" 
              class="input input-bordered" 
              placeholder="例如：关注公众号"
              required
            />
          </div>

          <!-- Description -->
          <div class="form-control">
            <label class="label">
              <span class="label-text">描述</span>
            </label>
            <textarea 
              v-model="formData.description" 
              class="textarea textarea-bordered" 
              placeholder="显示在二维码下方的描述文字"
              rows="2"
            ></textarea>
          </div>

          <!-- QR Code -->
          <div class="form-control">
            <label class="label">
              <span class="label-text">二维码图片</span>
            </label>
            <div 
              class="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
              @click="triggerFileInput"
            >
              <input 
                ref="fileInputRef"
                type="file" 
                accept="image/*" 
                class="hidden" 
                @change="handleFileChange"
              />
              <div v-if="uploading" class="py-4">
                <span class="loading loading-spinner"></span>
                <p class="mt-2 text-sm">上传中...</p>
              </div>
              <div v-else-if="formData.qrcodeUrl" class="relative">
                <img :src="formData.qrcodeUrl" class="w-32 h-32 mx-auto object-contain rounded" />
                <button 
                  type="button" 
                  class="btn btn-xs btn-circle btn-error absolute -top-2 -right-2"
                  @click.stop="formData.qrcodeUrl = ''"
                >
                  ✕
                </button>
              </div>
              <div v-else class="py-4">
                <ArrowUpTrayIcon class="w-8 h-8 mx-auto text-base-content/40" />
                <p class="mt-2 text-sm text-base-content/60">点击上传二维码图片</p>
              </div>
            </div>
          </div>

          <!-- Enabled -->
          <div class="form-control">
            <label class="label cursor-pointer">
              <span class="label-text">启用</span>
              <input 
                v-model="formData.enabled" 
                type="checkbox" 
                class="toggle toggle-primary"
              />
            </label>
          </div>

          <!-- Actions -->
          <div class="flex gap-2 justify-end">
            <button type="button" class="btn" @click="closeModal">取消</button>
            <button 
              type="submit" 
              class="btn btn-primary"
              :disabled="submitting"
            >
              <span v-if="submitting" class="loading loading-spinner loading-sm"></span>
              {{ submitting ? '保存中...' : '保存' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { app } from '../utils/cloudbase'
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  PhotoIcon,
  ArrowUpTrayIcon
} from '@heroicons/vue/24/outline'

interface ContactConfig {
  _id?: string
  type: string
  name: string
  description: string
  qrcodeUrl: string
  enabled: boolean
  _cloudPath?: string
}

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
    const res = await app.callFunction({
      name: 'manageContactConfig',
      data: { action: 'list' }
    })
    
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
    alert('上传失败，请重试')
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

    const res = await app.callFunction({
      name: 'manageContactConfig',
      data: {
        action,
        data: editingConfig.value
          ? { ...submitData, _id: editingConfig.value._id }
          : submitData
      }
    })

    if (res.result?.success) {
      closeModal()
      loadConfigs()
    } else {
      alert(res.result?.message || '保存失败')
    }
  } catch (error) {
    console.error('保存失败:', error)
    alert('保存失败，请重试')
  } finally {
    submitting.value = false
  }
}

async function handleDelete(config: ContactConfig) {
  if (!confirm(`确定要删除"${config.name}"吗？`)) return

  try {
    const res = await app.callFunction({
      name: 'manageContactConfig',
      data: { action: 'delete', data: { _id: config._id } }
    })

    if (res.result?.success) {
      loadConfigs()
    } else {
      alert(res.result?.message || '删除失败')
    }
  } catch (error) {
    console.error('删除失败:', error)
    alert('删除失败，请重试')
  }
}
</script>
