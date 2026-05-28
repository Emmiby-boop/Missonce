<template>
  <div v-if="visible" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
    <div class="glass-panel w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-[var(--border-color)]">
        <div>
          <h3 class="font-semibold text-lg">广告单元ID配置</h3>
          <p class="text-xs text-[var(--text-sub)] mt-0.5">管理广告单元ID列表</p>
        </div>
        <button class="btn-soft" @click="$emit('close')">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto py-4">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Left: Form -->
          <div class="lg:col-span-1 space-y-4">
            <div class="form-group">
              <label class="form-label">名称</label>
              <input class="form-input" v-model="form.name" placeholder="例如：首页顶部原生广告" />
            </div>
            <div class="form-group">
              <label class="form-label">adUnitId</label>
              <input class="form-input" v-model="form.adUnitId" placeholder="adunit-xxxxxxxxxxxxxxxx" />
              <p class="text-xs mt-1" :class="validAdUnitId ? 'text-green-500' : 'text-[var(--text-sub)]'">
                {{ validAdUnitId ? '✓ 格式正确' : '需匹配 adunit-16位十六进制' }}
              </p>
            </div>
            <div class="form-group">
              <label class="form-label">类型</label>
              <select class="form-input" v-model="form.type">
                <option value="">未指定</option>
                <option value="native_top">原生顶部广告</option>
                <option value="native_bottom">原生底部广告</option>
                <option value="native_video">原生视频广告</option>
                <option value="video">视频广告</option>
                <option value="interstitial">插屏广告</option>
                <option value="rewarded">激励视频广告</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">备注</label>
              <textarea class="form-input" rows="2" v-model="form.notes" placeholder="用途说明、页面等"></textarea>
            </div>
            <div class="flex gap-2">
              <button class="btn-primary flex-1" :disabled="!canSubmit" @click="handleSubmit">
                {{ form._id ? '保存修改' : '新增' }}
              </button>
              <button v-if="form._id" class="btn-soft" @click="resetForm">重置</button>
            </div>
          </div>

          <!-- Right: List -->
          <div class="lg:col-span-2">
            <!-- Search -->
            <div class="flex items-center gap-2 mb-3">
              <input class="form-input flex-1" v-model="keyword" placeholder="搜索名称或adUnitId" @input="debouncedLoad" />
              <select class="form-input w-40" v-model="filterType" @change="load">
                <option value="">全部类型</option>
                <option value="native_top">原生顶部</option>
                <option value="native_bottom">原生底部</option>
                <option value="native_video">原生视频</option>
                <option value="video">视频</option>
                <option value="interstitial">插屏</option>
                <option value="rewarded">激励视频</option>
              </select>
            </div>

            <!-- Table -->
            <div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden">
              <table class="w-full">
                <thead>
                  <tr class="bg-[var(--bg-body)]">
                    <th class="py-3 px-4 text-left text-sm font-medium text-[var(--text-sub)]">名称</th>
                    <th class="py-3 px-4 text-left text-sm font-medium text-[var(--text-sub)]">adUnitId</th>
                    <th class="py-3 px-4 text-left text-sm font-medium text-[var(--text-sub)]">类型</th>
                    <th class="py-3 px-4 text-right text-sm font-medium text-[var(--text-sub)]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="u in units" :key="u._id" class="border-t border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors">
                    <td class="py-3 px-4 text-sm font-medium">{{ u.name }}</td>
                    <td class="py-3 px-4 font-mono text-xs text-[var(--text-sub)]">{{ u.adUnitId }}</td>
                    <td class="py-3 px-4">
                      <span class="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-xs">
                        {{ typeLabel(u.type) }}
                      </span>
                    </td>
                    <td class="py-3 px-4 text-right">
                      <div class="flex items-center justify-end gap-1">
                        <button class="btn-link text-sm px-2 py-1" @click="pick(u)">选择</button>
                        <button class="btn-link text-sm px-2 py-1" @click="edit(u)">编辑</button>
                        <button class="btn-link text-sm text-red-500 px-2 py-1 hover:bg-red-50 dark:hover:bg-red-900/20" @click="remove(u)">删除</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div v-if="units.length === 0" class="text-center py-12 text-[var(--text-sub)]">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p class="text-sm">暂无配置</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { callCloudFunction } from '../utils/cloudbase'
import { ElMessage } from 'element-plus'

const props = defineProps({
  visible: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'pick'])

const units = ref([])
const keyword = ref('')
const filterType = ref('')
const form = ref({ _id: '', name: '', adUnitId: '', type: '', notes: '' })

// 弹窗打开时加载列表
watch(() => props.visible, (val) => {
  if (val) load()
})

const ADUNIT_RE = /^adunit-[0-9a-fA-F]{16}$/
const validAdUnitId = computed(() => ADUNIT_RE.test(form.value.adUnitId || ''))
const canSubmit = computed(() => !!form.value.name && validAdUnitId.value)

function typeLabel(t){ 
  const m = {
    native_top: '原生顶部',
    native_bottom: '原生底部',
    native_video: '原生视频',
    video: '视频',
    interstitial: '插屏',
    rewarded: '激励视频'
  }; 
  return m[t] || '—' 
}

async function load(){
  try {
    const res = await callCloudFunction('adConfigManager', { action: 'adUnit:list', keyword: keyword.value, type: filterType.value })
    units.value = Array.isArray(res?.data) ? res.data : []
  } catch (err) {
    console.error('加载广告单元失败', err)
    ElMessage.error('加载广告单元列表失败：' + (err.message || '未知错误'))
  }
}
let timer
function debouncedLoad(){
  clearTimeout(timer)
  timer = setTimeout(load, 300)
}

function resetForm(){ form.value = { _id:'', name:'', adUnitId:'', type:'', notes:'' } }

function pick(u){
  emit('pick', u)
}

function edit(u){
  form.value = { _id: u._id, name: u.name, adUnitId: u.adUnitId, type: u.type || '', notes: u.notes || '' }
}

async function handleSubmit(){
  if(!canSubmit.value) return
  if(form.value._id){
    const res = await callCloudFunction('adConfigManager', { action: 'adUnit:update', id: form.value._id, updates: { name: form.value.name, adUnitId: form.value.adUnitId, type: form.value.type, notes: form.value.notes } })
    if(res?.success){ await load(); resetForm(); ElMessage.success('保存成功') } else { ElMessage.error(res?.msg || '保存失败') }
  } else {
    const res = await callCloudFunction('adConfigManager', { action: 'adUnit:add', name: form.value.name, adUnitId: form.value.adUnitId, type: form.value.type, notes: form.value.notes })
    if(res?.success){ await load(); resetForm(); ElMessage.success('新增成功') } else { ElMessage.error(res?.msg || '新增失败') }
  }
}

async function remove(u){
  if(!confirm('确认删除该配置？')) return
  const res = await callCloudFunction('adConfigManager', { action: 'adUnit:delete', id: u._id })
  if(res?.success){ await load(); ElMessage.success('已删除') } else { ElMessage.error(res?.msg || '删除失败') }
}
</script>
