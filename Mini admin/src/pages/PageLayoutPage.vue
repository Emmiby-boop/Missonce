<template>
  <div class="space-y-6">
    <!-- Header -->
    <section class="glass-panel">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="panel-title">{{ pageTitle }}布局管理</h2>
          <p class="panel-sub">{{ pageDescription }}</p>
        </div>
        <div class="flex gap-2">
          <select v-model="currentPage" class="select select-bordered select-sm" @change="switchPage">
            <option value="avatar">头像页面</option>
            <option value="wallpaper">壁纸页面</option>
          </select>
          <button class="btn-soft gap-2" @click="openModal()">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
            </svg>
            新增板块
          </button>
        </div>
      </div>
    </section>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 4" :key="i" class="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-5 animate-pulse">
        <div class="flex flex-col md:flex-row md:items-center gap-4">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-[var(--border-color)]"></div>
            <div class="w-12 h-12 rounded-xl bg-[var(--border-color)]"></div>
          </div>
          <div class="flex-1 min-w-0 space-y-3">
            <div class="h-5 bg-[var(--border-color)] rounded w-1/3"></div>
            <div class="flex flex-wrap gap-2">
              <div class="h-5 bg-[var(--border-color)] rounded w-20"></div>
              <div class="h-5 bg-[var(--border-color)] rounded w-24"></div>
              <div class="h-5 bg-[var(--border-color)] rounded w-16"></div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div class="h-8 w-16 bg-[var(--border-color)] rounded-lg"></div>
            <div class="h-8 w-16 bg-[var(--border-color)] rounded-lg"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Section List -->
    <div v-else-if="sections.length > 0" class="space-y-4">
      <div 
        v-for="item in sections" 
        :key="item._id" 
        class="group bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] p-5 flex flex-col md:flex-row md:items-center gap-4 hover:shadow-md transition-all duration-300"
      >
        <!-- Left: Sort & Icon -->
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-[var(--bg-body)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-sub)] font-bold text-lg shadow-inner">
            {{ item.sort }}
          </div>
          <div class="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg"
            :style="getIconColor(item.type)"
          >
             <svg v-if="item.type === 'grid'" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
             </svg>
             <svg v-else-if="item.type === 'waterfall'" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
             </svg>
             <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
             </svg>
          </div>
        </div>

        <!-- Middle: Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-3 mb-1">
            <h3 class="text-lg font-bold text-[var(--text-main)] truncate">{{ item.title }}</h3>
            <span 
              class="px-2 py-0.5 rounded-full text-xs font-medium border ml-auto md:ml-2"
              :style="item.enable 
                ? { background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderColor: 'rgba(34, 197, 94, 0.2)' } 
                : { background: 'var(--bg-body)', color: 'var(--text-sub)', borderColor: 'var(--border-color)' }"
            >
              {{ item.enable ? '已启用' : '已停用' }}
            </span>
          </div>
          
          <div class="flex flex-wrap items-center gap-2 mt-2">
            <span class="px-2 py-0.5 rounded text-xs font-medium" :style="{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }">
               {{ getTypeName(item.type) }}
            </span>
            
            <span class="px-2 py-0.5 rounded text-xs font-medium" :style="{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)' }">
               {{ getSourceTypeName(item.dataSource?.type) }}
            </span>

            <span class="px-2 py-0.5 rounded text-xs font-medium" :style="{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.2)' }">
               数量: {{ item.dataSource?.limit || 10 }}
            </span>
          </div>
        </div>

        <!-- Right: Actions -->
        <div class="flex items-center gap-2 border-t pt-3 md:border-t-0 md:pt-0 md:pl-4 md:border-l border-[var(--border-color)]">
           <button 
             class="btn-soft text-sm gap-2" 
             @click="editSection(item)"
           >
             <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
               <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
             </svg>
             编辑
           </button>
           <button 
             class="btn-soft text-sm gap-2" 
             :style="{ color: '#ef4444' }"
             @click="deleteSection(item._id)"
           >
             <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
               <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
             </svg>
             删除
           </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-16 bg-[var(--bg-card)] rounded-xl border border-dashed border-[var(--border-color)]">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-[var(--text-sub)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
      <h3 class="text-lg font-medium text-[var(--text-main)] mb-2">暂无板块配置</h3>
      <p class="text-[var(--text-sub)] text-sm mb-6">点击下方按钮添加第一个展示板块</p>
      <button class="btn-soft gap-2" @click="openModal()">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
        </svg>
        新增板块
      </button>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 transition-opacity bg-[var(--text-main)]/50" @click="showModal = false"></div>
        
        <div class="inline-block align-bottom bg-[var(--bg-card)] rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full border border-[var(--border-color)]">
          <!-- Modal Header -->
          <div class="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
            <h3 class="text-lg font-bold text-[var(--text-main)]">
              {{ isEditing ? '编辑板块' : '新增板块' }}
            </h3>
            <button @click="showModal = false" class="text-[var(--text-sub)] hover:text-[var(--text-main)]">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Modal Body -->
          <div class="px-6 py-4 max-h-[60vh] overflow-y-auto">
            <div class="space-y-4">
              <!-- Basic Info -->
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <label class="text-xs font-medium text-[var(--text-sub)]">板块标题</label>
                  <input v-model="form.title" class="input w-full" placeholder="例如: 热门头像" />
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-medium text-[var(--text-sub)]">排序序号</label>
                  <input v-model.number="form.sort" type="number" class="input w-full" />
                </div>
              </div>

              <!-- Enable Toggle -->
              <div class="flex items-center gap-3">
                <input type="checkbox" v-model="form.enable" class="w-5 h-5 rounded border-[var(--border-color)] text-[var(--primary)] focus:ring-[var(--primary)]" />
                <span class="text-sm text-[var(--text-main)]">启用此板块</span>
              </div>

              <!-- Layout Type -->
              <div class="space-y-1.5">
                <label class="text-xs font-medium text-[var(--text-sub)]">布局类型</label>
                <div class="grid grid-cols-3 gap-2">
                  <div 
                    v-for="t in layoutTypes" 
                    :key="t.value"
                    class="cursor-pointer border-2 rounded-lg p-3 text-center transition-all"
                    :style="form.type === t.value ? { borderColor: 'var(--primary)', background: 'rgba(79, 70, 229, 0.1)' } : { borderColor: 'var(--border-color)' }"
                    @click="form.type = t.value"
                  >
                    <div class="text-2xl mb-1">{{ t.icon }}</div>
                    <div class="text-xs font-medium text-[var(--text-main)]">{{ t.label }}</div>
                  </div>
                </div>
              </div>

              <!-- Data Source Type -->
              <div class="space-y-1.5">
                <label class="text-xs font-medium text-[var(--text-sub)]">数据来源</label>
                <select v-model="form.dataSource.type" class="select w-full">
                  <option value="automatic">自动筛选</option>
                  <option value="recommendation">智能推荐</option>
                  <option value="manual">手动精选</option>
                </select>
              </div>

              <!-- Resource Type -->
              <div class="space-y-1.5">
                <label class="text-xs font-medium text-[var(--text-sub)]">资源类型</label>
                <select v-model="form.dataSource.resourceType" class="select w-full">
                  <option value="avatar">头像</option>
                  <option value="wallpaper">壁纸</option>
                  <option value="all">全部</option>
                </select>
              </div>

              <!-- Category -->
              <div class="space-y-1.5">
                <label class="text-xs font-medium text-[var(--text-sub)]">指定分类 (可选)</label>
                <input v-model="form.dataSource.category" class="input w-full" placeholder="例如: 动漫" />
              </div>

              <!-- Tags -->
              <div class="space-y-1.5">
                <label class="text-xs font-medium text-[var(--text-sub)]">指定标签 (逗号分隔)</label>
                <input v-model="form.dataSource.tags" class="input w-full" placeholder="例如: 可爱,唯美" />
              </div>

              <!-- Sort Field -->
              <div class="space-y-1.5">
                <label class="text-xs font-medium text-[var(--text-sub)]">排序规则</label>
                <select v-model="form.dataSource.sortField" class="select w-full">
                  <option value="createTime">最新发布</option>
                  <option value="hotScore">最热</option>
                  <option value="favorites">最多收藏</option>
                  <option value="downloads">最多下载</option>
                </select>
              </div>

              <!-- Limit -->
              <div class="space-y-1.5">
                <label class="text-xs font-medium text-[var(--text-sub)]">显示数量</label>
                <input v-model.number="form.dataSource.limit" type="number" class="input w-full" />
              </div>

              <!-- More Link -->
              <div class="space-y-1.5">
                <label class="text-xs font-medium text-[var(--text-sub)]">更多链接 (可选)</label>
                <input v-model="form.moreLink" class="input w-full" placeholder="/pages/avatar/avatar" />
              </div>
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="px-6 py-4 bg-[var(--bg-body)] flex justify-end gap-3">
            <button @click="showModal = false" class="btn-soft">取消</button>
            <button @click="saveSection" class="btn-primary">
              {{ isEditing ? '保存修改' : '添加板块' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { db, serverDate } from '../utils/cloudbase'
import { useToast } from '../composables/useToast'
import { useCache } from '../composables/useCache'

const { success, error, confirm } = useToast()
const { get: getCache, set: setCache, clear: clearCache } = useCache<any[]>('page_layout_cache')

const currentPage = ref('avatar')
const sections = ref<any[]>([])
const showModal = ref(false)
const isEditing = ref(false)
const editingId = ref<string | null>(null)
const loading = ref(false)

const defaultForm = {
  title: '',
  sort: 10,
  enable: true,
  type: 'waterfall',
  moreLink: '',
  dataSource: {
    type: 'automatic',
    resourceType: 'avatar',
    category: '',
    tags: '',
    sortField: 'createTime',
    limit: 10,
    autoSplit: false
  }
}
const form = ref({ ...defaultForm })

const layoutTypes = [
  { value: 'grid', label: '网格', icon: '▦' },
  { value: 'waterfall', label: '瀑布流', icon: '▩' },
  { value: 'swiper', label: '横向滚动', icon: '⟲' }
]

const pageTitle = computed(() => currentPage.value === 'avatar' ? '头像页面' : '壁纸页面')
const pageDescription = computed(() => currentPage.value === 'avatar' 
  ? '配置头像页面的展示板块、布局样式及数据来源'
  : '配置壁纸页面的展示板块、布局样式及数据来源')

const collectionName = computed(() => currentPage.value === 'avatar' ? 'avatar_sections' : 'wallpaper_sections')

const loadSections = async () => {
  loading.value = true
  
  const cached = getCache()
  if (cached) {
    sections.value = cached
    loading.value = false
  }

  try {
    const res = await db.collection(collectionName.value)
      .orderBy('sort', 'asc')
      .get()
    const data = res.data || []
    sections.value = data
    setCache(data)
  } catch (err) {
    console.error('加载板块失败:', err)
  } finally {
    loading.value = false
  }
}

const switchPage = () => {
  loadSections()
}

const openModal = () => {
  isEditing.value = false
  editingId.value = null
  form.value = JSON.parse(JSON.stringify(defaultForm))
  form.value.dataSource.resourceType = currentPage.value === 'avatar' ? 'avatar' : 'wallpaper'
  showModal.value = true
}

const editSection = (item: any) => {
  isEditing.value = true
  editingId.value = item._id
  form.value = JSON.parse(JSON.stringify(item))
  if (Array.isArray(form.value.dataSource.tags)) {
    form.value.dataSource.tags = form.value.dataSource.tags.join(',')
  }
  showModal.value = true
}

const saveSection = async () => {
  if (!form.value.title) {
    error('请输入板块标题')
    return
  }

  try {
    const data = JSON.parse(JSON.stringify(form.value))
    
    if (data.dataSource.tags && typeof data.dataSource.tags === 'string') {
      data.dataSource.tags = data.dataSource.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t)
    }

    if (isEditing.value && editingId.value) {
      await db.collection(collectionName.value).doc(editingId.value).update({
        data
      })
      success('板块已更新')
    } else {
      data.createTime = serverDate()
      data.updateTime = serverDate()
      await db.collection(collectionName.value).add({
        data
      })
      success('板块已添加')
    }
    
    showModal.value = false
    clearCache()
    loadSections()
  } catch (err: any) {
    console.error('保存失败:', err)
    error('保存失败: ' + err.message)
  }
}

const deleteSection = async (id: string) => {
  const confirmed = await confirm('确定要删除这个板块吗?')
  if (!confirmed) return
  
  try {
    await db.collection(collectionName.value).doc(id).remove()
    success('板块已删除')
    clearCache()
    loadSections()
  } catch (err) {
    console.error('删除失败:', err)
    error('删除失败')
  }
}

const getIconColor = (type: string) => {
  const colors: Record<string, { background: string }> = {
    grid: { background: '#3b82f6' },
    waterfall: { background: '#8b5cf6' },
    swiper: { background: '#f97316' }
  }
  return colors[type] || { background: '#64748b' }
}

const getTypeName = (type: string) => {
  const names: Record<string, string> = {
    grid: '网格布局',
    waterfall: '瀑布流',
    swiper: '横向滚动'
  }
  return names[type] || type
}

const getSourceTypeName = (type: string) => {
  const names: Record<string, string> = {
    automatic: '自动筛选',
    recommendation: '智能推荐',
    manual: '手动精选'
  }
  return names[type] || type
}

onMounted(() => {
  loadSections()
})
</script>

<style scoped>
.input {
  width: 100%;
  padding: 0.625rem 1rem;
  border-radius: 0.5rem;
  background: var(--bg-body);
  border: 1px solid var(--border-color);
  color: var(--text-main);
}

.input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.2);
}

.select {
  width: 100%;
  padding: 0.625rem 1rem;
  border-radius: 0.5rem;
  background: var(--bg-body);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  cursor: pointer;
}

.select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.2);
}
</style>
