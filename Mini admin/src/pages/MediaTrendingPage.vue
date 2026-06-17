<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-[var(--text-main)]">热门榜单</h1>
      <p class="text-[var(--text-sub)] mt-1">手动添加 + 多平台热门数据同步</p>
    </div>

    <!-- 操作栏 -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex gap-2">
        <button @click="syncDouyin" :disabled="syncing" class="btn-soft flex items-center gap-2">
          <svg v-if="!syncing" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          <svg v-else class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          {{ syncing === 'douyin' ? '同步中...' : '同步抖音' }}
        </button>
        <button @click="syncKuaishou" :disabled="syncing" class="btn-soft flex items-center gap-2">
          <svg v-if="!syncing" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          <svg v-else class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          {{ syncing === 'kuaishou' ? '同步中...' : '同步快手' }}
        </button>
        <button @click="syncXiaohongshu" :disabled="syncing" class="btn-soft flex items-center gap-2">
          <svg v-if="!syncing" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          <svg v-else class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          {{ syncing === 'xiaohongshu' ? '同步中...' : '同步小红书' }}
        </button>
        <button @click="showAddModal = true" class="btn-primary flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          手动添加
        </button>
      </div>

      <!-- 清空操作 -->
      <div class="flex gap-2">
        <span class="text-xs text-[var(--text-sub)] self-center">清空：</span>
        <button @click="clearPlatform('douyin')" class="text-xs px-2.5 py-1 rounded bg-red-50 text-red-500 hover:bg-red-100">抖音</button>
        <button @click="clearPlatform('kuaishou')" class="text-xs px-2.5 py-1 rounded bg-red-50 text-red-500 hover:bg-red-100">快手</button>
        <button @click="clearPlatform('xiaohongshu')" class="text-xs px-2.5 py-1 rounded bg-red-50 text-red-500 hover:bg-red-100">小红书</button>
        <button @click="clearPlatform('manual')" class="text-xs px-2.5 py-1 rounded bg-red-50 text-red-500 hover:bg-red-100">手动</button>
        <button @click="clearAll()" class="text-xs px-2.5 py-1 rounded bg-red-500 text-white hover:bg-red-600">清空全部</button>
      </div>
    </div>

    <!-- 来源筛选 -->
    <div class="flex gap-2 flex-wrap">
      <button
        v-for="source in ['all', 'manual', 'douyin', 'kuaishou', 'xiaohongshu']"
        :key="source"
        @click="trendingSource = source"
        class="px-4 py-2 text-sm rounded-lg transition-all font-medium"
        :class="trendingSource === source
          ? 'bg-[var(--primary)] text-white'
          : 'bg-[var(--bg-body)] border border-[var(--border-color)] text-[var(--text-sub)] hover:border-[var(--primary)]'"
      >
        {{ source === 'all' ? '全部' : source === 'manual' ? '手动' : source === 'douyin' ? '抖音' : source === 'kuaishou' ? '快手' : '小红书' }}
        <span class="ml-1 text-xs opacity-70">({{ getTrendingCount(source) }})</span>
      </button>
    </div>

    <!-- 热门列表 -->
    <div class="glass-panel" style="padding:0">
      <div v-if="trendingLoading" class="p-8 text-center text-[var(--text-sub)]">
        <div class="animate-spin w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full mx-auto mb-3"></div>
        加载中...
      </div>
      <div v-else-if="filteredTrending.length === 0" class="p-8 text-center text-[var(--text-sub)]">
        暂无热门内容
      </div>
      <div v-else>
        <div
          v-for="item in filteredTrending"
          :key="item.id"
          class="flex items-center gap-4 p-4 border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-body)]/50 transition-colors"
        >
          <div class="w-20 h-14 rounded-lg overflow-hidden bg-[var(--bg-body)] flex-shrink-0">
            <img v-if="item.cover" :src="item.cover" class="w-full h-full object-cover" alt="" />
            <div v-else class="w-full h-full flex items-center justify-center text-[var(--text-sub)] text-xs">无图</div>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-[var(--text-main)] truncate">{{ item.title || '无标题' }}</p>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-xs px-2 py-0.5 rounded-full"             :class="{
                'bg-purple-500/10 text-purple-500': item.source === 'manual',
                'bg-pink-500/10 text-pink-500': item.source === 'douyin',
                'bg-orange-500/10 text-orange-500': item.source === 'kuaishou',
                'bg-red-500/10 text-red-500': item.source === 'xiaohongshu',
              }">
                {{ item.source === 'douyin' ? '抖音' : item.source === 'kuaishou' ? '快手' : item.source === 'xiaohongshu' ? '小红书' : '手动' }}
              </span>
              <span class="text-xs text-[var(--text-sub)]">{{ item.platform || '未知' }}</span>
              <span class="text-xs text-[var(--text-sub)]">{{ item.heat ? formatViews(item.heat) : '' }}</span>
            </div>
          </div>
          <a v-if="item.url" :href="item.url" target="_blank" class="text-xs text-[var(--primary)] hover:underline flex-shrink-0">查看</a>
          <div class="flex gap-1 flex-shrink-0">
            <button @click="editTrending(item)" class="p-2 rounded-lg hover:bg-[var(--bg-body)] text-[var(--text-sub)] hover:text-[var(--primary)] transition-colors" title="编辑">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button @click="deleteTrending(item.id)" class="p-2 rounded-lg hover:bg-red-500/10 text-[var(--text-sub)] hover:text-red-500 transition-colors" title="删除">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 热门添加/编辑弹窗 -->
    <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" @click.self="closeTrendingModal">
      <div class="glass-panel w-full max-w-lg" @click.stop>
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-bold text-[var(--text-main)]">{{ editingTrending ? '编辑热门' : '添加热门内容' }}</h3>
          <button @click="closeTrendingModal" class="p-1.5 rounded-lg hover:bg-[var(--bg-body)] text-[var(--text-sub)] transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <!-- 单条/批量 切换 -->
        <div v-if="!editingTrending" class="flex gap-2 mb-4">
          <button @click="addMode = 'single'" class="px-4 py-1.5 text-sm rounded-lg transition-all font-medium"
            :class="addMode === 'single' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg-body)] border border-[var(--border-color)] text-[var(--text-sub)] hover:border-[var(--primary)]'">
            单条添加
          </button>
          <button @click="addMode = 'batch'" class="px-4 py-1.5 text-sm rounded-lg transition-all font-medium"
            :class="addMode === 'batch' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg-body)] border border-[var(--border-color)] text-[var(--text-sub)] hover:border-[var(--primary)]'">
            批量导入
          </button>
        </div>

        <!-- 单条添加 -->
        <div v-if="addMode === 'single' || editingTrending" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-[var(--text-sub)] mb-1.5">链接 *</label>
            <input v-model="trendingForm.url" type="text" class="form-input w-full" placeholder="粘贴视频/图文链接" />
          </div>
          <div>
            <label class="block text-sm font-medium text-[var(--text-sub)] mb-1.5">标题</label>
            <input v-model="trendingForm.title" type="text" class="form-input w-full" placeholder="留空将自动解析" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-[var(--text-sub)] mb-1.5">平台</label>
              <input v-model="trendingForm.platform" type="text" class="form-input w-full" placeholder="如：抖音、B站" />
            </div>
            <div>
              <label class="block text-sm font-medium text-[var(--text-sub)] mb-1.5">封面URL（可选）</label>
              <input v-model="trendingForm.cover" type="text" class="form-input w-full" placeholder="留空自动获取" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-[var(--text-sub)] mb-1.5">描述（可选）</label>
            <textarea v-model="trendingForm.desc" class="form-input w-full" rows="2" placeholder="内容简介"></textarea>
          </div>
        </div>

        <!-- 批量导入 -->
        <div v-if="addMode === 'batch' && !editingTrending" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-[var(--text-sub)] mb-1.5">批量导入链接</label>
            <textarea v-model="batchText" class="form-input w-full text-xs font-mono" rows="10"
              placeholder="每行一个链接，支持以下格式：&#10;&#10;https://v.douyin.com/xxx/&#10;https://v.douyin.com/xxx/ | 标题文字&#10;https://v.douyin.com/xxx/&#9Tabc标题"></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-[var(--text-sub)] mb-1.5">统一平台（可选）</label>
            <input v-model="batchPlatform" type="text" class="form-input w-full" placeholder="如：抖音，留空则显示为未知" />
          </div>
          <p class="text-xs text-[var(--text-sub)]">已识别 <span class="text-[var(--primary)] font-medium">{{ batchCount }}</span> 条有效链接</p>
        </div>

        <div class="flex justify-end gap-3 mt-6">
          <button @click="closeTrendingModal" class="btn-ghost">取消</button>
          <template v-if="addMode === 'batch' && !editingTrending">
            <button @click="batchImport" :disabled="savingTrending || !batchCount" class="btn-primary">
              {{ savingTrending ? '导入中...' : '批量导入' }}
            </button>
          </template>
          <template v-else>
            <button @click="saveTrending" :disabled="savingTrending" class="btn-primary">
              {{ savingTrending ? '保存中...' : '保存' }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const API_BASE = 'https://api.missonce.cc'

const trendingSource = ref<'all' | 'manual' | 'douyin' | 'kuaishou' | 'xiaohongshu'>('all')
const trendingLoading = ref(false)
const trendingItems = ref<any[]>([])
const showAddModal = ref(false)
const editingTrending = ref<any>(null)
const savingTrending = ref(false)
const syncing = ref<string | false>(false)

const trendingForm = ref({
  url: '',
  title: '',
  platform: '',
  cover: '',
  desc: '',
})
const addMode = ref<'single' | 'batch'>('single')
const batchText = ref('')
const batchPlatform = ref('')

const batchCount = computed(() => {
  return batchText.value.split('\n').filter(l => /^https?:\/\//i.test(l.trim())).length
})

const filteredTrending = computed(() => {
  if (trendingSource.value === 'all') return trendingItems.value
  return trendingItems.value.filter(i => i.source === trendingSource.value)
})

const getTrendingCount = (source: string) => {
  if (source === 'all') return trendingItems.value.length
  return trendingItems.value.filter(i => i.source === source).length
}

const formatViews = (views: number) => {
  if (!views) return ''
  if (views >= 10000) return (views / 10000).toFixed(1) + '万'
  return views.toString()
}

const fetchTrending = async () => {
  trendingLoading.value = true
  try {
    const res = await fetch(`${API_BASE}/api/trending/merged`, { cache: 'no-store' })
    const data = await res.json()
    trendingItems.value = data?.data?.list || []
  } catch (e) {
    console.error('获取热门列表失败:', e)
    ElMessage.error('获取热门列表失败')
  } finally {
    trendingLoading.value = false
  }
}

const doSync = async (platform: string, label: string) => {
  syncing.value = platform
  try {
    const res = await fetch(`${API_BASE}/api/trending/sync/${platform}`, { method: 'POST' })
    const data = await res.json()
    if (data.retcode === 200) {
      ElMessage.success(`${label}同步成功，获取 ${data.data?.count || 0} 条`)
      await fetchTrending()
    } else {
      ElMessage.warning(data.retdesc || `${label}同步返回空数据`)
      await fetchTrending()
    }
  } catch (e) {
    ElMessage.error(`${label}同步失败`)
  } finally {
    syncing.value = false
  }
}

const syncDouyin = () => doSync('douyin', '抖音')
const syncKuaishou = () => doSync('kuaishou', '快手')
const syncXiaohongshu = () => doSync('xiaohongshu', '小红书')

const clearPlatform = async (source: string) => {
  if (!confirm(`确定清空 ${source} 的所有数据？`)) return
  try {
    const res = await fetch(`${API_BASE}/api/trending/clear/${source}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.retcode === 200) {
      ElMessage.success(`${source} 数据已清空`)
      await fetchTrending()
    } else {
      ElMessage.error(data.retdesc || '清空失败')
    }
  } catch (e) {
    ElMessage.error('清空失败')
  }
}

const clearAll = async () => {
  if (!confirm('确定清空所有热门数据？')) return
  try {
    const res = await fetch(`${API_BASE}/api/trending/clear/all`, { method: 'DELETE' })
    const data = await res.json()
    if (data.retcode === 200) {
      ElMessage.success('所有数据已清空')
      await fetchTrending()
    } else {
      ElMessage.error(data.retdesc || '清空失败')
    }
  } catch (e) {
    ElMessage.error('清空失败')
  }
}

const editTrending = (item: any) => {
  editingTrending.value = item
  trendingForm.value = {
    url: item.url || '',
    title: item.title || '',
    platform: item.platform || '',
    cover: item.cover || '',
    desc: item.desc || '',
  }
  showAddModal.value = true
}

const deleteTrending = async (id: string) => {
  if (!confirm('确定删除该热门内容？')) return
  try {
    const res = await fetch(`${API_BASE}/api/trending/manual/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.retcode === 200) {
      ElMessage.success('已删除')
      await fetchTrending()
    } else {
      ElMessage.error(data.retdesc || '删除失败')
    }
  } catch (e) {
    ElMessage.error('删除失败')
  }
}

const saveTrending = async () => {
  if (!trendingForm.value.url) {
    ElMessage.warning('请输入链接')
    return
  }
  savingTrending.value = true
  try {
    const method = editingTrending.value ? 'PUT' : 'POST'
    const url = editingTrending.value
      ? `${API_BASE}/api/trending/manual/${editingTrending.value.id}`
      : `${API_BASE}/api/trending/manual`
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trendingForm.value),
    })
    const data = await res.json()
    if (data.retcode === 200) {
      ElMessage.success(editingTrending.value ? '已更新' : '已添加')
      closeTrendingModal()
      await fetchTrending()
    } else {
      ElMessage.error(data.retdesc || '保存失败')
    }
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    savingTrending.value = false
  }
}

const closeTrendingModal = () => {
  showAddModal.value = false
  editingTrending.value = null
  addMode.value = 'single'
  batchText.value = ''
  batchPlatform.value = ''
  trendingForm.value = { url: '', title: '', platform: '', cover: '', desc: '' }
}

const batchImport = async () => {
  if (!batchText.value.trim()) {
    ElMessage.warning('请输入链接')
    return
  }
  savingTrending.value = true
  try {
    const res = await fetch(`${API_BASE}/api/trending/manual/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: batchText.value, platform: batchPlatform.value }),
    })
    const data = await res.json()
    if (data.retcode === 200) {
      ElMessage.success(data.retdesc || '导入成功')
      closeTrendingModal()
      await fetchTrending()
    } else {
      ElMessage.error(data.retdesc || '导入失败')
    }
  } catch (e) {
    ElMessage.error('导入失败')
  } finally {
    savingTrending.value = false
  }
}

onMounted(() => {
  fetchTrending()
})
</script>
