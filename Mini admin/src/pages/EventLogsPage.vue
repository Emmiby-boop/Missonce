<template>
  <div class="space-y-8">
    <section class="glass-panel">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="panel-title">事件日志</h2>
          <p class="panel-sub">查看用户行为和性能日志</p>
        </div>
        <div class="flex gap-2">
          <button class="btn-soft" @click="() => fetchEvents(false)">
            刷新列表
          </button>
        </div>
      </div>
      
      <div class="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="text-sm text-[var(--text-sub)] mb-2 block">事件类型</label>
          <select v-model="filters.type" class="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-main)]">
            <option value="">全部</option>
            <option value="page_view">页面访问</option>
            <option value="action_">行为事件</option>
            <option value="performance_">性能事件</option>
            <option value="pv">页面浏览</option>
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
      <div v-if="loading && events.length === 0" class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-[var(--border-color)]">
              <th class="text-left py-3 px-4 text-sm font-medium text-[var(--text-sub)]">类型</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-[var(--text-sub)]">页面</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-[var(--text-sub)]">数据</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-[var(--text-sub)]">时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in 5" :key="i">
              <td class="py-3 px-4"><div class="skeleton h-4 w-20"></div></td>
              <td class="py-3 px-4"><div class="skeleton h-4 w-32"></div></td>
              <td class="py-3 px-4"><div class="skeleton h-4 w-40"></div></td>
              <td class="py-3 px-4"><div class="skeleton h-4 w-24"></div></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="events.length === 0" class="text-center py-12 text-[var(--text-sub)]">
        暂无事件记录
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-[var(--border-color)]">
              <th class="text-left py-3 px-4 text-sm font-medium text-[var(--text-sub)]">类型</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-[var(--text-sub)]">页面</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-[var(--text-sub)]">数据</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-[var(--text-sub)]">时间</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-[var(--text-sub)]">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="event in events" :key="event._id" class="border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)]">
              <td class="py-3 px-4">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      :class="getTypeClass(event.type)">
                  {{ event.type }}
                </span>
              </td>
              <td class="py-3 px-4 text-sm text-[var(--text-main)]">
                {{ event.page || '-' }}
              </td>
              <td class="py-3 px-4 text-sm text-[var(--text-sub)] max-w-xs truncate">
                {{ formatEventData(event) }}
              </td>
              <td class="py-3 px-4 text-sm text-[var(--text-sub)]">
                {{ formatTime(event.createTime) }}
              </td>
              <td class="py-3 px-4">
                <button @click="showEventDetail(event)" class="text-[var(--accent)] hover:text-[var(--accent-hover)] text-sm">
                  详情
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="hasMore" class="mt-4 text-center">
          <button class="btn-soft" @click="loadMore" :disabled="loading">
            {{ loading ? '加载中...' : '加载更多' }}
          </button>
        </div>
      </div>
    </section>

    <div v-if="selectedEvent" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="selectedEvent = null">
      <div class="glass-panel w-full max-w-2xl max-h-[80vh] overflow-auto">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-[var(--text-main)]">事件详情</h3>
          <button @click="selectedEvent = null" class="text-[var(--text-sub)] hover:text-[var(--text-main)]">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <pre class="bg-[var(--bg-card)] p-4 rounded-lg overflow-auto text-sm text-[var(--text-main)]">{{ JSON.stringify(selectedEvent, null, 2) }}</pre>
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
const { get: getCache, set: setCache } = useCache<any[]>('event_logs_cache');

const events = ref<any[]>([]);
const loading = ref(false);
const hasMore = ref(true);
const selectedEvent = ref<any>(null);
const pageSize = 20;

const filters = ref({
  type: '',
  timeRange: '',
  page: ''
});

const applyFilters = () => {
  events.value = [];
  hasMore.value = true;
  fetchEvents(false);
};

const getTypeClass = (type: string) => {
  if (type.startsWith('performance_')) return 'bg-purple-100 text-purple-800';
  if (type.startsWith('action_')) return 'bg-blue-100 text-blue-800';
  if (type === 'page_view' || type === 'pv') return 'bg-green-100 text-green-800';
  return 'bg-gray-100 text-gray-800';
};

const formatEventData = (event: any) => {
  const data = { ...event };
  delete data._id;
  delete data._openid;
  delete data.type;
  delete data.page;
  delete data.createTime;
  delete data.clientIp;
  return Object.keys(data).length > 0 ? JSON.stringify(data) : '-';
};

const formatTime = (time: any) => {
  if (!time) return '-';
  const date = time instanceof Date ? time : new Date(time);
  return date.toLocaleString('zh-CN');
};

const showEventDetail = (event: any) => {
  selectedEvent.value = event;
};

const fetchEvents = async (isLoadMore = false) => {
  if (loading.value) return;
  loading.value = true;
  
  if (!isLoadMore) {
    const cached = getCache();
    if (cached && !filters.value.type && !filters.value.timeRange && !filters.value.page) {
      events.value = cached;
      loading.value = false;
      return;
    }
  }
  
  try {
    let query = db.collection('events')
      .orderBy('createTime', 'desc');

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
        query = query.where({
          type: type
        });
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
    }

    query = query.limit(pageSize);

    if (isLoadMore && events.value.length > 0) {
      query = query.skip(events.value.length);
    }

    const res = await query.get();
    
    if (isLoadMore) {
      events.value = [...events.value, ...(res.data || [])];
    } else {
      events.value = res.data || [];
      if (!filters.value.type && !filters.value.timeRange && !filters.value.page) {
        setCache(events.value);
      }
    }
    
    hasMore.value = res.data && res.data.length === pageSize;
  } catch (err) {
    console.error('Fetch events failed', err);
    error('加载事件日志失败');
  } finally {
    loading.value = false;
  }
};

const loadMore = () => {
  fetchEvents(true);
};

onMounted(() => {
  fetchEvents(false);
});
</script>
