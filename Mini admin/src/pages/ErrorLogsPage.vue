<template>
  <div class="space-y-8">
    <section class="glass-panel">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="panel-title">错误日志</h2>
          <p class="panel-sub">查看小程序端上报的异常信息</p>
        </div>
        <div class="flex gap-2">
          <button class="btn-soft" @click="() => fetchLogs(false)">
            刷新列表
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
              <th class="p-4 font-medium">发生时间</th>
              <th class="p-4 font-medium">错误类型</th>
              <th class="p-4 font-medium">错误信息</th>
              <th class="p-4 font-medium">设备信息</th>
              <th class="p-4 font-medium">用户ID</th>
              <th class="p-4 font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="text-sm">
            <tr v-for="i in 5" :key="i" class="border-b border-[var(--border-color)]/50">
              <td class="p-4"><div class="h-4 bg-[var(--border-color)] rounded w-28 animate-pulse"></div></td>
              <td class="p-4"><div class="h-6 bg-[var(--border-color)] rounded w-16 animate-pulse"></div></td>
              <td class="p-4"><div class="h-4 bg-[var(--border-color)] rounded w-48 mb-2 animate-pulse"></div><div class="h-3 bg-[var(--border-color)] rounded w-32 animate-pulse"></div></td>
              <td class="p-4"><div class="h-4 bg-[var(--border-color)] rounded w-20 mb-1 animate-pulse"></div><div class="h-3 bg-[var(--border-color)] rounded w-16 animate-pulse"></div></td>
              <td class="p-4"><div class="h-4 bg-[var(--border-color)] rounded w-24 animate-pulse"></div></td>
              <td class="p-4"><div class="h-6 bg-[var(--border-color)] rounded w-12 animate-pulse"></div></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="text-[var(--text-sub)] text-sm border-b border-[var(--border-color)]">
              <th class="p-4 font-medium">发生时间</th>
              <th class="p-4 font-medium">错误类型</th>
              <th class="p-4 font-medium">错误信息</th>
              <th class="p-4 font-medium">设备信息</th>
              <th class="p-4 font-medium">用户ID</th>
              <th class="p-4 font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="text-sm">
            <tr v-if="logs.length === 0">
              <td colspan="6" class="p-8 text-center text-[var(--text-sub)]">暂无错误日志</td>
            </tr>
            <tr
              v-for="log in logs"
              :key="log._id"
              class="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-body)]/50 transition-colors"
            >
              <td class="p-4 whitespace-nowrap text-[var(--text-sub)] font-mono text-xs">
                {{ formatTime(log.createTime) }}
              </td>
              <td class="p-4">
                <span class="px-2 py-1 rounded text-xs" :style="{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }">
                  {{ log.type || 'unknown' }}
                </span>
              </td>
              <td class="p-4 max-w-[300px]">
                <div class="font-medium truncate text-[var(--text-main)]" :title="log.message">{{ log.message }}</div>
                <div class="text-xs text-[var(--text-sub)] truncate" :title="getDetailMsg(log)">
                  {{ getDetailMsg(log) }}
                </div>
              </td>
              <td class="p-4 text-xs text-[var(--text-sub)]">
                <div>{{ log.deviceInfo?.model || '-' }}</div>
                <div>SDK: {{ log.deviceInfo?.SDKVersion || '-' }}</div>
              </td>
              <td class="p-4 font-mono text-xs text-[var(--text-sub)] truncate max-w-[100px]" :title="log.openid">
                {{ log.openid ? log.openid.slice(0, 8) + '...' : '-' }}
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
          <h3 class="text-lg font-bold text-[var(--text-main)]">错误详情</h3>
          <button @click="selectedLog = null" class="text-2xl leading-none text-[var(--text-sub)] hover:text-[var(--text-main)]">&times;</button>
        </div>
        <div class="p-6 overflow-y-auto space-y-4">
          <div>
            <div class="text-xs font-bold text-[var(--text-sub)] mb-1 uppercase tracking-wider">Basic Info</div>
            <div class="grid grid-cols-2 gap-4 text-sm text-[var(--text-main)]">
              <div><span class="text-[var(--text-sub)]">Type:</span> {{ selectedLog.type }}</div>
              <div><span class="text-[var(--text-sub)]">Time:</span> {{ formatTime(selectedLog.createTime) }}</div>
              <div><span class="text-[var(--text-sub)]">OpenID:</span> <span class="font-mono text-xs">{{ selectedLog.openid }}</span></div>
              <div><span class="text-[var(--text-sub)]">Page:</span> {{ selectedLog.page || '-' }}</div>
            </div>
          </div>
          
          <div>
            <div class="text-xs font-bold text-[var(--text-sub)] mb-1 uppercase tracking-wider">Device Info</div>
            <pre class="bg-[var(--text-main)]/90 text-[var(--bg-card)] p-3 rounded text-xs overflow-x-auto">{{ JSON.stringify(selectedLog.deviceInfo, null, 2) }}</pre>
          </div>

          <div>
            <div class="text-xs font-bold text-[var(--text-sub)] mb-1 uppercase tracking-wider">Error Detail</div>
            <pre class="bg-[var(--primary)]/5 border border-[var(--primary)]/20 text-[var(--primary)] p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap">{{ JSON.stringify(selectedLog.detail, null, 2) }}</pre>
          </div>
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
import { useCache } from '../composables/useCache';

const { error } = useToast();
const { get: getCache, set: setCache } = useCache<any[]>('error_logs_cache');

const logs = ref<any[]>([]);
const loading = ref(false);
const hasMore = ref(true);
const selectedLog = ref<any>(null);
const pageSize = 20;

const fetchLogs = async (isLoadMore = false) => {
  if (loading.value) return;
  loading.value = true;
  
  if (!isLoadMore) {
    const cached = getCache();
    if (cached) {
      logs.value = cached;
      loading.value = false;
    }
  }
  
  try {
    let query = db.collection('error_logs')
      .orderBy('createTime', 'desc')
      .limit(pageSize);

    if (isLoadMore && logs.value.length > 0) {
      query = query.skip(logs.value.length);
    }

    const res = await query.get();
    
    if (isLoadMore) {
      logs.value = [...logs.value, ...(res.data || [])];
    } else {
      logs.value = res.data || [];
      setCache(logs.value);
    }
    
    hasMore.value = res.data && res.data.length === pageSize;
  } catch (err) {
    console.error('Fetch logs failed', err);
    error('加载日志失败');
  } finally {
    loading.value = false;
  }
};

const loadMore = () => {
  fetchLogs(true);
};

const formatTime = (ts: string | number) => {
  if (!ts) return '-';
  return new Date(ts).toLocaleString();
};

const getDetailMsg = (log: any) => {
  if (log.detail && typeof log.detail === 'object') {
    return log.detail.errMsg || log.detail.message || JSON.stringify(log.detail);
  }
  return log.detail || '-';
};

const showDetail = (log: any) => {
  selectedLog.value = log;
};

onMounted(() => {
  fetchLogs();
});
</script>
