<template>
  <section class="card p-6 space-y-6">
    <!-- 标题 -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h3 class="text-lg font-bold text-[var(--text-main)]">自定义 API 厂商</h3>
        <p class="text-xs text-[var(--text-sub)] mt-1">
          添加内置厂商之外的服务（如 OpenAI 兼容接口、本地 LLM 等）。配置后可在模型配置和文案配置中选用。
        </p>
      </div>
      <button @click="openAddModal" class="btn-primary px-4 py-2">
        + 新增厂商
      </button>
    </div>

    <!-- 加载中 -->
    <div v-if="store.loading" class="flex justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="store.customProviders.length === 0" class="text-center py-12">
      <div class="text-4xl mb-3 opacity-30">🔌</div>
      <p class="text-sm text-[var(--text-sub)]">暂无自定义厂商</p>
      <p class="text-xs text-[var(--text-sub)] mt-1">点击"新增厂商"添加一个 OpenAI 兼容的 API 服务</p>
    </div>

    <!-- 厂商列表 -->
    <div v-else class="space-y-3">
      <div
        v-for="provider in store.customProviders"
        :key="provider.id"
        class="border border-[var(--border-color)] rounded-xl p-4 hover:border-[var(--primary)] transition-colors"
      >
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-semibold text-[var(--text-main)]">{{ provider.name }}</span>
              <span class="text-xs px-2 py-0.5 rounded bg-[var(--primary)] text-white">自定义</span>
              <span class="text-xs px-2 py-0.5 rounded bg-[var(--bg-body)] text-[var(--text-sub)]">
                {{ provider.apiType === 'openai' ? 'OpenAI 兼容' : '自定义' }}
              </span>
            </div>
            <div class="text-xs text-[var(--text-sub)] mt-1 font-mono truncate">
              {{ provider.baseUrl }}
            </div>
            <div class="text-xs text-[var(--text-sub)] mt-1">
              模型数：{{ provider.models?.length || 0 }}
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button @click="openEditModal(provider)" class="btn-soft px-3 py-1.5 text-sm">编辑</button>
            <button @click="removeProvider(provider)" class="px-3 py-1.5 text-sm rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">删除</button>
          </div>
        </div>
        <!-- 模型列表 -->
        <div v-if="provider.models && provider.models.length > 0" class="mt-3 flex flex-wrap gap-1.5">
          <span
            v-for="model in provider.models"
            :key="model.id"
            class="text-xs px-2 py-1 rounded bg-[var(--bg-body)] text-[var(--text-sub)] border border-[var(--border-color)]"
          >
            {{ model.name }}
          </span>
        </div>
      </div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <div v-if="showModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="closeModal">
      <div class="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div class="p-6 border-b border-[var(--border-color)]">
          <h3 class="text-lg font-bold text-[var(--text-main)]">
            {{ editing ? '编辑厂商' : '新增厂商' }}
          </h3>
        </div>

        <div class="p-6 space-y-4">
          <!-- 名称 -->
          <div class="space-y-2">
            <label class="text-sm font-medium text-[var(--text-main)]">厂商名称 *</label>
            <input v-model="form.name" class="input w-full" placeholder="如：OpenAI、DeepSeek、月之暗面" />
            <p class="text-xs text-[var(--text-sub)]">用于在模型配置的下拉菜单中显示</p>
          </div>

          <!-- Base URL -->
          <div class="space-y-2">
            <label class="text-sm font-medium text-[var(--text-main)]">API Base URL *</label>
            <input
              v-model="form.baseUrl"
              class="input w-full font-mono text-sm"
              placeholder="https://api.openai.com/v1/chat/completions"
            />
            <p class="text-xs text-[var(--text-sub)]">完整的聊天补全接口地址（含 /chat/completions 路径）</p>
          </div>

          <!-- API 类型 -->
          <div class="space-y-2">
            <label class="text-sm font-medium text-[var(--text-main)]">接口协议</label>
            <select v-model="form.apiType" class="input w-full">
              <option value="openai">OpenAI 兼容（推荐）</option>
              <option value="custom">自定义</option>
            </select>
            <p class="text-xs text-[var(--text-sub)]">绝大多数国产 API 都兼容 OpenAI 协议</p>
          </div>

          <!-- 模型列表 -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-sm font-medium text-[var(--text-main)]">模型列表</label>
              <button @click="addModel" type="button" class="text-xs text-[var(--primary)] hover:underline">+ 添加模型</button>
            </div>
            <div v-for="(model, idx) in form.models" :key="idx" class="flex gap-2 items-center">
              <input v-model="model.id" class="input flex-1 font-mono text-sm" placeholder="模型 ID（如 gpt-4o）" />
              <input v-model="model.name" class="input flex-1 text-sm" placeholder="显示名称（如 GPT-4o）" />
              <button @click="removeModel(idx)" type="button" class="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded text-sm">✕</button>
            </div>
            <p class="text-xs text-[var(--text-sub)]">模型 ID 用于 API 调用，显示名称用于下拉菜单</p>
          </div>

          <!-- 备注 -->
          <div class="space-y-2">
            <label class="text-sm font-medium text-[var(--text-main)]">备注（可选）</label>
            <textarea v-model="form.notes" class="input w-full h-20" placeholder="记录 API 申请入口、计费方式等..."></textarea>
          </div>
        </div>

        <div class="p-6 border-t border-[var(--border-color)] flex gap-3 justify-end">
          <button @click="closeModal" class="btn-soft px-4 py-2">取消</button>
          <button @click="save" class="btn-primary px-4 py-2" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { useCustomProvidersStore } from '../stores/customProviders'
import type { CustomProvider, ModelOption } from '../constants/aiProviders'
import { confirmDeleteDialog } from '../composables/useDialog'

type MessageType = 'success' | 'error'
const emit = defineEmits<{
  notify: [payload: { msg: string; type: MessageType }]
}>()

const store = useCustomProvidersStore()

const showModal = ref(false)
const editing = ref(false)
const saving = ref(false)
const editingId = ref('')

interface FormState {
  name: string
  baseUrl: string
  apiType: 'openai' | 'custom'
  models: ModelOption[]
  notes: string
}

const form = reactive<FormState>({
  name: '',
  baseUrl: '',
  apiType: 'openai',
  models: [],
  notes: ''
})

const notify = (msg: string, type: MessageType) => {
  emit('notify', { msg, type })
}

const openAddModal = () => {
  editing.value = false
  editingId.value = ''
  form.name = ''
  form.baseUrl = ''
  form.apiType = 'openai'
  form.models = [{ id: '', name: '' }]
  form.notes = ''
  showModal.value = true
}

const openEditModal = (provider: CustomProvider) => {
  editing.value = true
  editingId.value = provider.id
  form.name = provider.name
  form.baseUrl = provider.baseUrl
  form.apiType = provider.apiType
  form.models = provider.models?.length
    ? provider.models.map(m => ({ ...m }))
    : [{ id: '', name: '' }]
  form.notes = provider.notes || ''
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const addModel = () => {
  form.models.push({ id: '', name: '' })
}

const removeModel = (idx: number) => {
  form.models.splice(idx, 1)
}

const save = async () => {
  // 校验
  if (!form.name.trim()) {
    notify('请填写厂商名称', 'error')
    return
  }
  if (!form.baseUrl.trim()) {
    notify('请填写 API Base URL', 'error')
    return
  }

  // 过滤空模型
  const models = form.models
    .filter(m => m.id.trim() && m.name.trim())
    .map(m => ({ id: m.id.trim(), name: m.name.trim() }))

  saving.value = true
  try {
    if (editing.value) {
      await store.update(editingId.value, {
        name: form.name.trim(),
        baseUrl: form.baseUrl.trim(),
        apiType: form.apiType,
        models,
        notes: form.notes.trim()
      })
      notify('厂商已更新', 'success')
    } else {
      await store.add({
        name: form.name.trim(),
        baseUrl: form.baseUrl.trim(),
        apiType: form.apiType,
        models,
        notes: form.notes.trim()
      })
      notify('厂商已添加', 'success')
    }
    showModal.value = false
  } catch (e) {
    notify('保存失败：' + (e as Error).message, 'error')
  } finally {
    saving.value = false
  }
}

const removeProvider = async (provider: CustomProvider) => {
  const confirmed = await confirmDeleteDialog(`确定要删除厂商「${provider.name}」吗？正在使用此厂商的模型配置需要手动切换。`)
  if (!confirmed) return
  try {
    await store.remove(provider.id)
    notify('厂商已删除', 'success')
  } catch (e) {
    notify('删除失败：' + (e as Error).message, 'error')
  }
}

onMounted(() => {
  store.load()
})
</script>
