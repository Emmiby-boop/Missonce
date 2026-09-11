<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-[var(--text-main)]">热门榜单</h1>
      <p class="text-[var(--text-sub)] mt-1">手动添加 + 多平台热门数据同步</p>
    </div>

    <!-- 操作栏 -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <NSpace>
        <NButton :loading="syncing === 'douyin'" :disabled="!!syncing && syncing !== 'douyin'" @click="syncDouyin">同步抖音</NButton>
        <NButton :loading="syncing === 'kuaishou'" :disabled="!!syncing && syncing !== 'kuaishou'" @click="syncKuaishou">同步快手</NButton>
        <NButton :loading="syncing === 'xiaohongshu'" :disabled="!!syncing && syncing !== 'xiaohongshu'" @click="syncXiaohongshu">同步小红书</NButton>
        <NButton type="primary" @click="showAddModal = true">手动添加</NButton>
      </NSpace>

      <NSpace align="center" :size="6">
        <span class="text-xs text-[var(--text-sub)]">清空：</span>
        <NButton size="tiny" type="error" ghost @click="clearPlatform('douyin')">抖音</NButton>
        <NButton size="tiny" type="error" ghost @click="clearPlatform('kuaishou')">快手</NButton>
        <NButton size="tiny" type="error" ghost @click="clearPlatform('xiaohongshu')">小红书</NButton>
        <NButton size="tiny" type="error" ghost @click="clearPlatform('manual')">手动</NButton>
        <NButton size="tiny" type="error" @click="clearAll">清空全部</NButton>
      </NSpace>
    </div>

    <!-- 来源筛选 + 排序 -->
    <div class="flex gap-3 flex-wrap items-center">
      <NSpace align="center" :size="8">
        <span class="text-xs text-[var(--text-sub)]">来源：</span>
        <NSelect
          v-model:value="trendingSource"
          :options="sourceOptions"
          size="small"
          style="width: 140px"
        />
      </NSpace>
      <NSpace align="center" :size="8" class="ml-auto">
        <span class="text-xs text-[var(--text-sub)]">排序：</span>
        <NSelect
          v-model:value="sortBy"
          :options="sortOptions"
          size="small"
          style="width: 120px"
        />
      </NSpace>
    </div>

    <!-- 热门列表 -->
    <NCard>
      <NDataTable
        :columns="columns"
        :data="filteredTrending"
        :loading="trendingLoading"
        :pagination="pagination"
        :row-key="(row: any) => row.id"
        :bordered="false"
      />
    </NCard>

    <!-- 热门添加/编辑弹窗 -->
    <NModal v-model:show="showAddModal" preset="card" :title="editingTrending ? '编辑热门' : '添加热门内容'" style="max-width: 560px">
      <div v-if="!editingTrending" class="flex gap-2 mb-4">
        <NButton size="small" :type="addMode === 'single' ? 'primary' : 'default'" @click="addMode = 'single'">单条添加</NButton>
        <NButton size="small" :type="addMode === 'batch' ? 'primary' : 'default'" @click="addMode = 'batch'">批量导入</NButton>
      </div>

      <!-- 单条添加 -->
      <div v-if="addMode === 'single' || editingTrending" class="flex flex-col gap-4">
        <div>
          <label class="block text-sm font-medium text-[var(--text-sub)] mb-1.5">链接 *</label>
          <NInput v-model:value="trendingForm.url" placeholder="粘贴视频/图文链接" />
        </div>
        <div>
          <label class="block text-sm font-medium text-[var(--text-sub)] mb-1.5">标题</label>
          <NInput v-model:value="trendingForm.title" placeholder="留空将自动解析" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-[var(--text-sub)] mb-1.5">平台</label>
            <NInput v-model:value="trendingForm.platform" placeholder="如：抖音、B站" />
          </div>
          <div>
            <label class="block text-sm font-medium text-[var(--text-sub)] mb-1.5">封面URL（可选）</label>
            <NInput v-model:value="trendingForm.cover" placeholder="留空自动获取" />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-[var(--text-sub)] mb-1.5">描述（可选）</label>
          <NInput v-model:value="trendingForm.desc" type="textarea" :rows="2" placeholder="内容简介" />
        </div>
      </div>

      <!-- 批量导入 -->
      <div v-if="addMode === 'batch' && !editingTrending" class="flex flex-col gap-4">
        <div>
          <label class="block text-sm font-medium text-[var(--text-sub)] mb-1.5">批量导入链接</label>
          <NInput
            v-model:value="batchText"
            type="textarea"
            :rows="10"
            placeholder="每行一个链接，支持以下格式：&#10;&#10;https://v.douyin.com/xxx/&#10;https://v.douyin.com/xxx/ | 标题文字&#10;https://v.douyin.com/xxx/&#9;Tab标题"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-[var(--text-sub)] mb-1.5">统一平台（可选）</label>
          <NInput v-model:value="batchPlatform" placeholder="如：抖音，留空则显示为未知" />
        </div>
        <p class="text-xs text-[var(--text-sub)]">已识别 <span class="text-[var(--primary)] font-medium">{{ batchCount }}</span> 条有效链接</p>
      </div>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="closeTrendingModal">取消</NButton>
          <template v-if="addMode === 'batch' && !editingTrending">
            <NButton type="primary" :loading="savingTrending" :disabled="!batchCount" @click="batchImport">批量导入</NButton>
          </template>
          <template v-else>
            <NButton type="primary" :loading="savingTrending" @click="saveTrending">保存</NButton>
          </template>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { h, ref, computed, reactive, onMounted } from 'vue'
import { NCard, NDataTable, NSelect, NButton, NTag, NModal, NInput, NSpace, useMessage, useDialog } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import mediaApi from '../services/mediaApi'

const message = useMessage()
const dialog = useDialog()

const trendingSource = ref<'all' | 'manual' | 'douyin' | 'kuaishou' | 'xiaohongshu'>('all')
const sortBy = ref<'time' | 'heat' | 'random'>('time')
const trendingLoading = ref(false)
const trendingItems = ref<any[]>([])
const showAddModal = ref(false)
const editingTrending = ref<any>(null)
const savingTrending = ref(false)
const syncing = ref<string | false>(false)

const sourceOptions = [
  { label: '全部', value: 'all' },
  { label: '手动', value: 'manual' },
  { label: '抖音', value: 'douyin' },
  { label: '快手', value: 'kuaishou' },
  { label: '小红书', value: 'xiaohongshu' },
]
const sortOptions = [
  { label: '最新', value: 'time' },
  { label: '热度', value: 'heat' },
  { label: '随机', value: 'random' },
]

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

const pagination = reactive({
  page: 1,
  pageSize: 10,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
  onChange: (page: number) => { pagination.page = page },
  onUpdatePageSize: (size: number) => { pagination.pageSize = size; pagination.page = 1 },
})

const batchCount = computed(() => {
  return batchText.value.split('\n').filter(l => /^https?:\/\//i.test(l.trim())).length
})

const filteredTrending = computed(() => {
  let list = trendingSource.value === 'all'
    ? [...trendingItems.value]
    : trendingItems.value.filter(i => i.source === trendingSource.value)

  if (sortBy.value === 'heat') {
    list.sort((a, b) => (b.heat || 0) - (a.heat || 0))
  } else if (sortBy.value === 'random') {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]]
    }
  }
  return list
})

const formatViews = (views: number) => {
  if (!views) return ''
  if (views >= 10000) return (views / 10000).toFixed(1) + '万'
  return views.toString()
}

const sourceTagType = (source: string): 'default' | 'error' | 'warning' | 'info' => {
  const map: Record<string, 'default' | 'error' | 'warning' | 'info'> = {
    manual: 'default',
    douyin: 'error',
    kuaishou: 'warning',
    xiaohongshu: 'info',
  }
  return map[source] || 'default'
}

const sourceLabel = (source: string) => {
  const map: Record<string, string> = {
    douyin: '抖音',
    kuaishou: '快手',
    xiaohongshu: '小红书',
    manual: '手动',
  }
  return map[source] || source
}

const fetchTrending = async () => {
  trendingLoading.value = true
  try {
    const data = await mediaApi.getTrending()
    trendingItems.value = data?.data?.list || data?.data || []
  } catch (e) {
    console.error('获取热门列表失败:', e)
    message.error('获取热门列表失败')
  } finally {
    trendingLoading.value = false
  }
}

const doSync = async (platform: string, label: string) => {
  syncing.value = platform
  try {
    const data = await mediaApi.syncTrending(platform)
    message.success(`${label}同步成功，获取 ${data?.data?.count || 0} 条`)
    await fetchTrending()
  } catch (e: any) {
    message.error(e.message || `${label}同步失败`)
    await fetchTrending()
  } finally {
    syncing.value = false
  }
}

const syncDouyin = () => doSync('douyin', '抖音')
const syncKuaishou = () => doSync('kuaishou', '快手')
const syncXiaohongshu = () => doSync('xiaohongshu', '小红书')

const clearPlatform = (source: string) => {
  dialog.warning({
    title: '提示',
    content: `确定清空 ${sourceLabel(source)} 的所有数据？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await mediaApi.request(`/api/admin/trending/clear/${source}`, { method: 'DELETE' })
        message.success(`${sourceLabel(source)} 数据已清空`)
        await fetchTrending()
      } catch (e: any) {
        message.error(e.message || '清空失败')
      }
    },
  })
}

const clearAll = () => {
  dialog.warning({
    title: '提示',
    content: '确定清空所有热门数据？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await mediaApi.request('/api/admin/trending/clear/all', { method: 'DELETE' })
        message.success('所有数据已清空')
        await fetchTrending()
      } catch (e: any) {
        message.error(e.message || '清空失败')
      }
    },
  })
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

const confirmDeleteTrending = (id: string) => {
  dialog.warning({
    title: '提示',
    content: '确定删除该热门内容？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await mediaApi.deleteTrending(id)
        message.success('已删除')
        await fetchTrending()
      } catch (e: any) {
        message.error(e.message || '删除失败')
      }
    },
  })
}

const saveTrending = async () => {
  if (!trendingForm.value.url) {
    message.warning('请输入链接')
    return
  }
  savingTrending.value = true
  try {
    if (editingTrending.value) {
      await mediaApi.request(`/api/admin/trending/${editingTrending.value.id}`, {
        method: 'PUT',
        body: trendingForm.value,
      })
      message.success('已更新')
    } else {
      await mediaApi.saveTrending(trendingForm.value)
      message.success('已添加')
    }
    closeTrendingModal()
    await fetchTrending()
  } catch (e: any) {
    message.error(e.message || '保存失败')
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

const parseBatchItems = () => {
  return batchText.value
    .split('\n')
    .map(line => {
      const trimmed = line.trim()
      if (!/^https?:\/\//i.test(trimmed)) return null
      const parts = trimmed.split(/[|\t]/).map(s => s.trim())
      const item: any = { url: parts[0] }
      if (parts[1]) item.title = parts[1]
      if (batchPlatform.value.trim()) item.platform = batchPlatform.value.trim()
      return item
    })
    .filter(Boolean)
}

const batchImport = async () => {
  if (!batchText.value.trim()) {
    message.warning('请输入链接')
    return
  }
  const items = parseBatchItems()
  if (!items.length) {
    message.warning('未识别到有效链接')
    return
  }
  savingTrending.value = true
  try {
    const data = await mediaApi.batchImportTrending(items)
    message.success(data?.retdesc || '导入成功')
    closeTrendingModal()
    await fetchTrending()
  } catch (e: any) {
    message.error(e.message || '导入失败')
  } finally {
    savingTrending.value = false
  }
}

const columns: DataTableColumns<any> = [
  {
    title: '封面',
    key: 'cover',
    width: 90,
    render(row) {
      return row.cover
        ? h('img', { src: row.cover, style: 'width: 72px; height: 50px; object-fit: cover; border-radius: 6px;' })
        : h('span', { style: 'color: var(--text-sub); font-size: 12px;' }, '无图')
    },
  },
  {
    title: '标题',
    key: 'title',
    render(row) {
      return h('div', [
        h('p', { style: 'font-weight: 500; color: var(--text-main); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;' }, row.title || '无标题'),
        h('div', { style: 'margin-top: 4px; display: flex; gap: 8px; align-items: center;' }, [
          h('span', { style: 'font-size: 12px; color: var(--text-sub);' }, row.platform || '未知'),
          row.heat ? h('span', { style: 'font-size: 12px; color: var(--text-sub);' }, formatViews(row.heat)) : null,
        ]),
      ])
    },
  },
  {
    title: '来源',
    key: 'source',
    width: 100,
    render(row) {
      return h(NTag, { type: sourceTagType(row.source), size: 'small', round: true }, { default: () => sourceLabel(row.source) })
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 180,
    render(row) {
      const children: any[] = []
      if (row.url) {
        children.push(h(NButton, { size: 'tiny', quaternary: true, tag: 'a', href: row.url, target: '_blank' }, { default: () => '查看' }))
      }
      children.push(h(NButton, { size: 'tiny', quaternary: true, onClick: () => editTrending(row) }, { default: () => '编辑' }))
      children.push(h(NButton, { size: 'tiny', quaternary: true, type: 'error', onClick: () => confirmDeleteTrending(row.id) }, { default: () => '删除' }))
      return h(NSpace, { size: 4 }, { default: () => children })
    },
  },
]

onMounted(() => {
  fetchTrending()
})
</script>
