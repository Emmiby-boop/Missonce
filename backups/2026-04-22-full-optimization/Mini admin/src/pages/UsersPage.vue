<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-[var(--text-main)]">用户与行为</h1>
        <p class="text-[var(--text-sub)] mt-1">收藏与下载行为追踪</p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <select v-model="timeRange" @change="() => fetchData()" class="px-4 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] text-sm">
          <option value="all">全部时间</option>
          <option value="today">今日</option>
          <option value="week">本周</option>
          <option value="month">本月</option>
        </select>
        <button @click="() => fetchData()" :disabled="loading" class="btn-icon" title="刷新">
          <svg v-if="!loading" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
          <svg v-else class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        </button>
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="stat-card">
        <div class="stat-icon bg-[var(--primary)]/10 text-[var(--primary)]">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
        </div>
        <div>
          <p class="text-sm text-[var(--text-sub)]">收藏总数</p>
          <p class="text-2xl font-bold text-[var(--text-main)] mt-1">{{ stats.favorites }}</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon bg-[var(--primary)]/10 text-[var(--primary)]">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
        </div>
        <div>
          <p class="text-sm text-[var(--text-sub)]">下载总数</p>
          <p class="text-2xl font-bold text-[var(--text-main)] mt-1">{{ stats.downloads }}</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon bg-blue-500/10 text-blue-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div>
          <p class="text-sm text-[var(--text-sub)]">活跃用户</p>
          <p class="text-2xl font-bold text-[var(--text-main)] mt-1">{{ stats.uniqueUsers }}</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon bg-orange-500/10 text-orange-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        </div>
        <div>
          <p class="text-sm text-[var(--text-sub)]">热门资源</p>
          <p class="text-2xl font-bold text-[var(--text-main)] mt-1">{{ stats.popularResources }}</p>
        </div>
      </div>
    </div>

    <section class="card">
      <div class="border-b border-[var(--border-color)]">
        <div class="flex">
          <button 
            @click="activeTab = 'favorites'" 
            :class="['flex-1 py-4 px-6 text-sm font-medium transition-colors', activeTab === 'favorites' ? 'text-[var(--primary)] border-b-2 border-[var(--primary)]' : 'text-[var(--text-sub)] hover:text-[var(--text-main)]']"
          >
            收藏记录
            <span class="ml-2 px-2 py-0.5 rounded-full text-xs bg-[var(--primary)]/10 text-[var(--primary)]">{{ stats.favorites }}</span>
          </button>
          <button 
            @click="activeTab = 'downloads'" 
            :class="['flex-1 py-4 px-6 text-sm font-medium transition-colors', activeTab === 'downloads' ? 'text-[var(--primary)] border-b-2 border-[var(--primary)]' : 'text-[var(--text-sub)] hover:text-[var(--text-main)]']"
          >
            下载记录
            <span class="ml-2 px-2 py-0.5 rounded-full text-xs bg-[var(--primary)]/10 text-[var(--primary)]">{{ stats.downloads }}</span>
          </button>
        </div>
      </div>
      <div class="p-4">
        <div v-if="loading && currentList.length === 0" class="space-y-3">
          <div v-for="i in 5" :key="i" class="flex items-center gap-4 p-3 rounded-lg bg-[var(--bg-body)] animate-pulse">
            <div class="w-12 h-12 rounded-lg bg-[var(--border-color)]"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 bg-[var(--border-color)] rounded w-3/4"></div>
              <div class="h-3 bg-[var(--border-color)] rounded w-1/2"></div>
            </div>
            <div class="h-3 bg-[var(--border-color)] rounded w-24"></div>
          </div>
        </div>

        <div v-else-if="currentList.length === 0" class="text-center py-12">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 text-[var(--text-sub)]"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="9" x2="15" y1="9" y2="15"/><line x1="15" x2="15" y1="9" y2="9"/></svg>
          <p class="text-[var(--text-sub)]">暂无{{ activeTab === 'favorites' ? '收藏' : '下载' }}记录</p>
        </div>

        <div v-else class="space-y-3">
          <div 
            v-for="item in currentList" 
            :key="item._id" 
            class="flex items-center gap-4 p-3 rounded-lg bg-[var(--bg-body)] border border-[var(--border-color)] hover:border-[var(--primary)]/30 transition-colors"
          >
            <div class="flex-shrink-0 w-12 h-12 rounded-lg bg-[var(--bg-card)] overflow-hidden border border-[var(--border-color)]">
              <img v-if="item.resource?.cover" :src="item.resource.cover" class="w-full h-full object-cover" alt="封面">
              <div v-else class="w-full h-full flex items-center justify-center text-[var(--text-sub)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
              </div>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-[var(--text-main)] truncate">
                {{ item.resource?.title || `资源 #${item.resourceId?.slice(-8)}` }}
              </p>
              <p class="text-xs text-[var(--text-sub)] mt-1 truncate">
                用户: {{ item._openid?.slice(-8) || '未知' }}
              </p>
            </div>
            <div class="text-right">
              <p class="text-xs text-[var(--text-sub)] whitespace-nowrap">{{ formatDate(item.createTime || item.createdAt) }}</p>
            </div>
          </div>
        </div>

        <div v-if="!loading && hasMore && currentList.length > 0" class="mt-4 text-center">
          <button @click="loadMore" :disabled="loadingMore" class="btn-secondary">
            {{ loadingMore ? '加载中...' : '加载更多' }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, computed } from "vue";
import { db, ensureAuthUser } from "../utils/cloudbase";

const activeTab = ref<"favorites" | "downloads">("favorites");
const timeRange = ref("all");
const loading = ref(false);
const loadingMore = ref(false);
const favorites = ref<any[]>([]);
const downloads = ref<any[]>([]);
const resourceCache = ref<Map<string, any>>(new Map());

const PAGE_SIZE = 10;

const stats = reactive({
  favorites: 0,
  downloads: 0,
  uniqueUsers: 0,
  popularResources: 0,
});

const currentList = computed(() => activeTab.value === "favorites" ? favorites.value : downloads.value);
const hasMore = computed(() => currentList.value.length > 0 && currentList.value.length % PAGE_SIZE === 0);

const getTimeRangeFilter = () => {
  const now = new Date();
  let startTime: Date | null = null;

  switch (timeRange.value) {
    case "today":
      startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week":
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "month":
      startTime = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      return null;
  }

  return startTime.getTime();
};

const fetchResources = async (resourceIds: string[]) => {
  const uniqueIds = [...new Set(resourceIds.filter(id => id && !resourceCache.value.has(id)))];
  if (uniqueIds.length === 0) return;

  try {
    const res = await db.collection("resources").where({
      _id: db.command.in(uniqueIds)
    }).get();

    res.data?.forEach((resource: any) => {
      resourceCache.value.set(resource._id, resource);
    });
  } catch (err) {
    console.error("Failed to fetch resources:", err);
  }
};

const enrichWithResourceData = (items: any[]) => {
  return items.map(item => ({
    ...item,
    resource: resourceCache.value.get(item.resourceId) || null
  }));
};

const fetchData = async (loadMoreMode = false) => {
  if (!loadMoreMode) {
    loading.value = true;
  } else {
    loadingMore.value = true;
  }

  try {
    await ensureAuthUser();
    const collectionName = activeTab.value === "favorites" ? "favorites" : "downloads";
    const targetList = activeTab.value === "favorites" ? favorites : downloads;

    let query = db.collection(collectionName) as any;
    const timeFilter = getTimeRangeFilter();
    if (timeFilter) {
      query = query.where({
        createTime: db.command.gte(timeFilter)
      });
    }

    if (loadMoreMode && targetList.value.length > 0) {
      const lastItem = targetList.value[targetList.value.length - 1];
      query = query.where({
        createTime: db.command.lt(lastItem.createTime || lastItem.createdAt)
      });
    }

    const [countRes, listRes] = await Promise.all([
      db.collection(collectionName).count(),
      query.orderBy("createTime", "desc").limit(PAGE_SIZE).get()
    ]);

    if (activeTab.value === "favorites") {
      stats.favorites = countRes.total || 0;
    } else {
      stats.downloads = countRes.total || 0;
    }

    const newItems = listRes.data || [];
    const resourceIds = newItems.map((item: any) => item.resourceId).filter(Boolean);
    await fetchResources(resourceIds);

    const enrichedItems = enrichWithResourceData(newItems);

    if (loadMoreMode) {
      targetList.value = [...targetList.value, ...enrichedItems];
    } else {
      targetList.value = enrichedItems;
    }

    const allItems = [...favorites.value, ...downloads.value];
    const userSet = new Set(allItems.map((item: any) => item._openid).filter(Boolean));
    stats.uniqueUsers = userSet.size;

    const resourceCount = new Map<string, number>();
    allItems.forEach((item: any) => {
      if (item.resourceId) {
        resourceCount.set(item.resourceId, (resourceCount.get(item.resourceId) || 0) + 1);
      }
    });
    stats.popularResources = resourceCount.size;

  } catch (err) {
    console.error("Failed to fetch data:", err);
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
};

const loadMore = () => {
  fetchData(true);
};

const formatDate = (value: any) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

onMounted(fetchData);
</script>

<style scoped>
.card {
  @apply bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden transition-all duration-300;
}

.stat-card {
  @apply bg-[var(--bg-card)] p-5 rounded-xl border border-[var(--border-color)] flex items-center gap-4 transition-all duration-300 hover:shadow-lg;
}
.stat-card:hover {
  border-color: color-mix(in srgb, var(--primary), transparent 80%);
}

.stat-icon {
  @apply w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0;
}

.btn-icon {
  @apply p-2 rounded-lg text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-[var(--bg-body)] transition-colors disabled:opacity-50;
}

.btn-secondary {
  @apply px-4 py-2 rounded-lg bg-[var(--bg-body)] text-[var(--text-main)] border border-[var(--border-color)] hover:bg-[var(--bg-card)] transition-colors disabled:opacity-50;
}
</style>
