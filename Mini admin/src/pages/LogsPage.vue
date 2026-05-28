<template>
  <div class="space-y-8">
    <section class="glass-panel">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="panel-title">日志管理</h2>
          <p class="panel-sub">查看错误日志和事件日志</p>
        </div>
        <div class="flex gap-2">
          <button class="btn-soft" @click="fetchLogs(false)">
            刷新列表
          </button>
        </div>
      </div>
      
      <!-- 筛选区域 -->
      <div class="mt-6 grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label class="text-sm text-[var(--text-sub)] mb-2 block">日志来源</label>
          <select v-model="filters.source" class="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-main)]">
            <option value="">全部</option>
            <option value="error">错误日志</option>
            <option value="event">事件日志</option>
          </select>
        </div>
        <div>
          <label class="text-sm text-[var(--text-sub)] mb-2 block">日志类型</label>
          <select v-model="filters.type" class="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-main)]">
            <option value="">全部</option>
            <option v-if="filters.source === 'error' || filters.source === ''" value="error">错误</option>
            <option v-if="filters.source === 'error' || filters.source === ''" value="warning">警告</option>
            <option v-if="filters.source === 'error' || filters.source === ''" value="info">信息</option>
            <option v-if="filters.source === 'error' || filters.source === ''" value="performance_slow">性能慢</option>
            <option v-if="filters.source === 'event' || filters.source === ''" value="page_view">页面访问</option>
            <option v-if="filters.source === 'event' || filters.source === ''" value="action_">行为事件</option>
            <option v-if="filters.source === 'event' || filters.source === ''" value="performance_">性能事件</option>
            <option v-if="filters.source === 'event' || filters.source === ''" value="pv">页面浏览</option>
          </select>
        </div>
        <div>
          <label class="text-sm text-[var(--text-sub)] mb-2 block">时间范围</label>
          <select v-model="filters.timeRange" class="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-main)]">
            <option value="">全部</option>
            <option value="1h">最近1小时</option>
            <option value="24h">最近24小时</option>
            <option value="7d">最近7天</option>
            <option value="30d">最近30天</option>
          </select>
        </div>
        <div>
          <label class="text-sm text-[var(--text-sub)] mb-2 block">页面</label>
          <input v-model="filters.page" placeholder="输入页面路径" class="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-main)]" />
        </div>
        <div class="flex items-end">
          <button class="btn-primary w-full" @click="applyFilters">
            应用筛选
          </button>
        </div>
      </div>
    </section>

    <section class="glass-panel">
      <!-- Loading Skeleton -->
      <div v-if="loading && logs.length === 0" class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="text-[var(--text-sub)] text-sm border-b border-[var(--border-color)]">
              <th class="p-4 font-medium">来源</th>
              <th class="p-4 font-medium">时间</th>
              <th class="p-4 font-medium">类型</th>
              <th class="p-4 font-medium">页面</th>
              <th class="p-4 font-medium">内容</th>
              <th class="p-4 font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="text-sm">
            <tr v-for="i in 5" :key="i" class="border-b border-[var(--border-color)]/50">
              <td class="p-4"><div class="h-4 bg-[var(--border-color)] rounded w-16 animate-pulse"></div></td>
              <td class="p-4"><div class="h-4 bg-[var(--border-color)] rounded w-28 animate-pulse"></div></td>
              <td class="p-4"><div class="h-6 bg-[var(--border-color)] rounded w-16 animate-pulse"></div></td>
              <td class="p-4"><div class="h-4 bg-[var(--border-color)] rounded w-24 animate-pulse"></div></td>
              <td class="p-4"><div class="h-4 bg-[var(--border-color)] rounded w-48 mb-2 animate-pulse"></div><div class="h-3 bg-[var(--border-color)] rounded w-32 animate-pulse"></div></td>
              <td class="p-4"><div class="h-6 bg-[var(--border-color)] rounded w-12 animate-pulse"></div></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="text-[var(--text-sub)] text-sm border-b border-[var(--border-color)]">
              <th class="p-4 font-medium">来源</th>
              <th class="p-4 font-medium">时间</th>
              <th class="p-4 font-medium">类型</th>
              <th class="p-4 font-medium">页面</th>
              <th class="p-4 font-medium">内容</th>
              <th class="p-4 font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="text-sm">
            <tr v-if="logs.length === 0">
              <td colspan="6" class="p-8 text-center text-[var(--text-sub)]">暂无日志</td>
            </tr>
            <tr
              v-for="log in logs"
              :key="log._id + log._source"
              class="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-body)]/50 transition-colors"
            >
              <td class="p-4">
                <span 
                  class="px-2 py-1 rounded text-xs font-medium"
                  :class="log._source === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'"
                >
                  {{ log._source === 'error' ? '错误' : '事件' }}
                </span>
              </td>
              <td class="p-4 whitespace-nowrap text-[var(--text-sub)] font-mono text-xs">
                {{ formatTime(log.createTime) }}
              </td>
              <td class="p-4">
                <span class="px-2 py-1 rounded text-xs" :class="getTypeClass(log)">
                  {{ log.type || 'unknown' }}
                </span>
              </td>
              <td class="p-4 text-xs text-[var(--text-sub)]">
                {{ log.page || '-' }}
              </td>
              <td class="p-4 max-w-[300px]">
                <div class="font-medium truncate text-[var(--text-main)]" :title="getContent(log)">
                  {{ getContent(log) }}
                </div>
              </td>
              <td class="p-4">
                <button class="text-xs text-[var(--primary)] hover:text-[var(--primary)]/80" @click="showDetail(log)">
                  查看详情
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Pagination -->
      <div class="mt-6 flex justify-center" v-if="hasMore">
        <button class="btn-soft text-sm px-6" @click="loadMore" :disabled="loading">
          {{ loading ? '加载中...' : '加载更多' }}
        </button>
      </div>
    </section>

    <!-- Detail Modal -->
    <div v-if="selectedLog" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-[var(--text-main)]/40 backdrop-blur-sm" @click="selectedLog = null"></div>
      <div class="relative w-full max-w-2xl bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div class="p-6 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-body)]/50">
          <h3 class="text-lg font-bold text-[var(--text-main)]">
            {{ selectedLog._source === 'error' ? '错误详情' : '事件详情' }}
          </h3>
          <button @click="selectedLog = null" class="text-2xl leading-none text-[var(--text-sub)] hover:text-[var(--text-main)]">&times;</button>
        </div>
        <div class="p-6 overflow-y-auto space-y-4">
          <pre class="bg-[var(--primary)]/5 border border-[var(--primary)]/20 text-[var(--primary)] p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap">{{ JSON.stringify(selectedLog, null, 2) }}</pre>
        </div>
        <div class="p-4 border-t border-[var(--border-color)] bg-[var(--bg-body)]/50 text-right">
          <button class="btn-primary" @click="selectedLog = null">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db } from '../utils/cloudbase';
import { useToast } from '../composables/useToast';

const { error } = useToast();

const logs = ref<any[]>([]);
const loading = ref(false);
const hasMore = ref(true);
const selectedLog = ref<any>(null);
const pageSize = 20;

const filters = ref({
  source: '',
  type: '',
  timeRange: '',
  page: ''
});

const applyFilters = () => {
  logs.value = [];
  hasMore.value = true;
  fetchLogs(false);
};

const fetchLogs = async (isLoadMore = false) => {
  if (loading.value) return;
  loading.value = true;
  
  try {
    let errorLogs: any[] = [];
    let eventLogs: any[] = [];
    
    if (!filters.value.source || filters.value.source === 'error') {
      errorLogs = await fetchFromCollection('error_logs', isLoadMore && !filters.value.source);
    }
    
    if (!filters.value.source || filters.value.source === 'event') {
      eventLogs = await fetchFromCollection('events', isLoadMore && !filters.value.source);
    }
    
    const allLogs = [
      ...errorLogs.map(log => ({ ...log, _source: 'error' })),
      ...eventLogs.map(log => ({ ...log, _source: 'event' }))
    ];
    
    allLogs.sort((a, b) => {
      const timeA = a.createTime ? new Date(a.createTime).getTime() : 0;
      const timeB = b.createTime ? new Date(b.createTime).getTime() : 0;
      return timeB - timeA;
    });
    
    if (isLoadMore) {
      logs.value = [...logs.value, ...allLogs];
    } else {
      logs.value = allLogs;
    }
    
    hasMore.value = allLogs.length === pageSize * (!filters.value.source ? 2 : 1);
  } catch (err) {
    console.error('Fetch logs failed', err);
    error('加载日志失败');
  } finally {
    loading.value = false;
  }
};

const fetchFromCollection = async (collectionName: string, isLoadMore: boolean) => {
  let query = db.collection(collectionName).orderBy('createTime', 'desc');

  if (filters.value.type) {
    const type = filters.value.type;
    if (type.endsWith('_')) {
      query = query.where({
        type: db.RegExp({
          regexp: '^' + type,
          options: 'i'
        })
      });
    } else {
      query = query.where({ type: type });
    }
  }

  if (filters.value.page) {
    query = query.where({
      page: db.RegExp({
        regexp: filters.value.page,
        options: 'i'
      })
    });
  }

  if (filters.value.timeRange) {
    const now = Date.now();
    let startTime = 0;
    switch (filters.value.timeRange) {
      case '1h':
        startTime = now - 3600 * 1000;
        break;
      case '24h':
        startTime = now - 24 * 3600 * 1000;
        break;
      case '7d':
        startTime = now - 7 * 24 * 3600 * 1000;
        break;
      case '30d':
        startTime = now - 30 * 24 * 3600 * 1000;
        break;
    }
    if (startTime > 0) {
      query = query.where({
        timestamp: db.command.gte(startTime)
      });
    }
  }

  query = query.limit(pageSize);

  const res = await query.get();
  return res.data || [];
};

const loadMore = () => {
  fetchLogs(true);
};

const formatTime = (ts: string | number) => {
  if (!ts) return '-';
  return new Date(ts).toLocaleString();
};

const getTypeClass = (log: any) => {
  if (log._source === 'error') {
    return { background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' };
  }
  const type = log.type || '';
  if (type.startsWith('performance_')) return 'bg-purple-100 text-purple-800';
  if (type.startsWith('action_')) return 'bg-blue-100 text-blue-800';
  if (type === 'page_view' || type === 'pv') return 'bg-green-100 text-green-800';
  return 'bg-gray-100 text-gray-800';
};

const getContent = (log: any) => {
  if (log._source === 'error') {
    return log.message || log.detail?.errMsg || log.detail?.message || '-';
  }
  const data = { ...log };
  delete data._id;
  delete data._openid;
  delete data._source;
  delete data.type;
  delete data.page;
  delete data.createTime;
  delete data.clientIp;
  return Object.keys(data).length > 0 ? JSON.stringify(data) : '-';
};

const showDetail = (log: any) => {
  selectedLog.value = log;
};

onMounted(() => {
  fetchLogs();
});
</script>
