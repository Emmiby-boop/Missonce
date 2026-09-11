<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="glass-panel">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="panel-title">分享码管理</h2>
          <p class="panel-sub">查看分享码列表 · 分享统计概览 · 热门分享排行</p>
        </div>
        <button class="btn-soft" @click="loadStats">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
          刷新统计
        </button>
      </div>
    </div>

    <!-- Stats Cards -->
    <div v-if="stats" class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="glass-panel text-center">
        <p class="text-2xl font-bold text-[var(--primary)]">{{ stats.total || 0 }}</p>
        <p class="text-xs text-[var(--text-sub)] mt-1">总分享码</p>
      </div>
      <div class="glass-panel text-center">
        <p class="text-2xl font-bold text-green-500">{{ stats.active || 0 }}</p>
        <p class="text-xs text-[var(--text-sub)] mt-1">有效</p>
      </div>
      <div class="glass-panel text-center">
        <p class="text-2xl font-bold text-[var(--text-sub)]">{{ stats.expired || 0 }}</p>
        <p class="text-xs text-[var(--text-sub)] mt-1">已过期</p>
      </div>
      <div class="glass-panel text-center">
        <p class="text-2xl font-bold text-blue-500">{{ stats.todayCreated || 0 }}</p>
        <p class="text-xs text-[var(--text-sub)] mt-1">今日新增</p>
      </div>
    </div>

    <!-- Hot Resources -->
    <div v-if="stats?.hotResources?.length" class="glass-panel">
      <h3 class="text-sm font-semibold text-[var(--text-main)] mb-4">热门分享排行 Top 10</h3>
      <div class="space-y-2">
        <div v-for="(r, idx) in stats.hotResources" :key="r.resourceId" class="flex items-center gap-3 py-2 border-b border-[var(--border-color)]/50 last:border-0">
          <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            :class="idx < 3 ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg-body)] text-[var(--text-sub)]'">
            {{ idx + 1 }}
          </span>
          <img v-if="r.coverUrl" :src="r.coverUrl" class="w-10 h-10 rounded-lg object-cover shrink-0" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">{{ r.title }}</p>
            <p class="text-xs text-[var(--text-sub)] font-mono">{{ r.resourceId?.slice(-8) }}</p>
          </div>
          <span class="text-sm font-bold text-[var(--primary)]">{{ r.shareCount }}</span>
          <span class="text-xs text-[var(--text-sub)]">次</span>
        </div>
      </div>
    </div>

    <!-- Filter & Table -->
    <div class="glass-panel space-y-4">
      <div class="flex flex-wrap gap-3 items-end">
        <div>
          <label class="text-xs text-[var(--text-sub)] block mb-1">资源ID筛选</label>
          <input v-model="filterResourceId" placeholder="留空查全部" class="input w-48" />
        </div>
        <button class="btn-soft" @click="loadList(1)">查询</button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-[var(--text-sub)] border-b border-[var(--border-color)]">
              <th class="py-3 px-4 font-medium">分享码</th>
              <th class="py-3 px-4 font-medium">资源</th>
              <th class="py-3 px-4 font-medium">类型</th>
              <th class="py-3 px-4 font-medium">创建时间</th>
              <th class="py-3 px-4 font-medium">过期时间</th>
              <th class="py-3 px-4 font-medium">状态</th>
              <th class="py-3 px-4 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="listLoading" class="animate-pulse">
              <td colspan="7" class="py-8 text-center text-[var(--text-sub)]">加载中...</td>
            </tr>
            <tr v-else-if="list.length === 0">
              <td colspan="7" class="py-8 text-center text-[var(--text-sub)]">暂无数据</td>
            </tr>
            <tr v-else v-for="item in list" :key="item._id" class="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-hover)]/50">
              <td class="py-3 px-4 font-mono text-sm font-bold text-[var(--primary)]">{{ item.code }}</td>
              <td class="py-3 px-4">
                <div class="flex items-center gap-2">
                  <img v-if="item.resourceCover" :src="item.resourceCover" class="w-8 h-8 rounded object-cover" />
                  <span class="truncate max-w-[160px]">{{ item.resourceTitle }}</span>
                </div>
              </td>
              <td class="py-3 px-4">
                <span class="px-2 py-0.5 rounded text-xs" :style="item.resourceType === 'avatar' ? { background: 'rgba(168,85,247,0.1)', color: '#a855f7' } : { background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }">
                  {{ item.resourceType === 'avatar' ? '头像' : '壁纸' }}
                </span>
              </td>
              <td class="py-3 px-4 text-xs text-[var(--text-sub)]">{{ formatTime(item.createdAt) }}</td>
              <td class="py-3 px-4 text-xs text-[var(--text-sub)]">{{ formatTime(item.expireAt) }}</td>
              <td class="py-3 px-4">
                <span class="px-2 py-0.5 rounded text-xs font-medium" :class="isExpired(item.expireAt) ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'">
                  {{ isExpired(item.expireAt) ? '已过期' : '有效' }}
                </span>
              </td>
              <td class="py-3 px-4">
                <button class="text-xs text-red-500 hover:underline" @click="deleteCode(item)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="listTotal > 0" class="flex items-center justify-between border-t border-[var(--border-color)] pt-3">
        <span class="text-xs text-[var(--text-sub)]">共 {{ listTotal }} 条</span>
        <div class="flex gap-2">
          <button class="btn-soft text-xs px-3" :disabled="listPage <= 1" @click="loadList(listPage - 1)">上一页</button>
          <span class="text-xs text-[var(--text-sub)] leading-8">{{ listPage }} / {{ Math.ceil(listTotal / 20) }}</span>
          <button class="btn-soft text-xs px-3" :disabled="listPage >= Math.ceil(listTotal / 20)" @click="loadList(listPage + 1)">下一页</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMessage, useDialog } from 'naive-ui'
import { callCloudFunction } from '../utils/cloudbase'

const message = useMessage()
const dialog = useDialog()

// Stats
const stats = ref<any>(null)

async function loadStats() {
  try {
    const res = await callCloudFunction('shareCode', { action: 'adminStats' })
    stats.value = res?.data || null
  } catch (e) {
    console.error(e)
  }
}

// List
const filterResourceId = ref('')
const list = ref<any[]>([])
const listLoading = ref(false)
const listPage = ref(1)
const listTotal = ref(0)

async function loadList(page = 1) {
  listPage.value = page
  listLoading.value = true
  try {
    const res = await callCloudFunction('shareCode', {
      action: 'adminList',
      page,
      limit: 20,
      resourceId: filterResourceId.value || undefined
    })
    list.value = res?.data || []
    listTotal.value = res?.total || 0
  } catch (_e: any) {
    message.error('查询失败')
  } finally {
    listLoading.value = false
  }
}

async function deleteCode(item: any) {
  const confirmed = await dialog.warning({
    title: '提示',
    content: `确定删除分享码 ${item.code} 吗？`,
    positiveText: '确定',
    negativeText: '取消'
  })
  if (!confirmed) return
  try {
    await callCloudFunction('shareCode', { action: 'adminDelete', id: item._id })
    message.success('已删除')
    loadList(listPage.value)
    loadStats()
  } catch (_e: any) {
    message.error('删除失败')
  }
}

function formatTime(t: any) {
  if (!t) return '-'
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function isExpired(t: any) {
  if (!t) return false
  return new Date(t).getTime() < Date.now()
}

onMounted(() => {
  loadStats()
  loadList()
})
</script>
