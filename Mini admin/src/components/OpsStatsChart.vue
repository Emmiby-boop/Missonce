<template>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    <div class="card p-4">
      <div class="text-2xl font-bold text-[var(--text-main)]">{{ dashboard.overview?.totalUsers || 0 }}</div>
      <div class="text-sm text-[var(--text-sub)]">总用户数</div>
    </div>
    <div class="card p-4">
      <div class="text-2xl font-bold text-[var(--primary)]">{{ dashboard.overview?.activeUsers || 0 }}</div>
      <div class="text-sm text-[var(--text-sub)]">活跃用户</div>
    </div>
    <div class="card p-4">
      <div class="text-2xl font-bold text-green-500">{{ dashboard.overview?.totalResources || 0 }}</div>
      <div class="text-sm text-[var(--text-sub)]">资源总数</div>
    </div>
    <div class="card p-4">
      <div class="text-2xl font-bold text-orange-500">{{ dashboard.overview?.totalViews || 0 }}</div>
      <div class="text-sm text-[var(--text-sub)]">总浏览量</div>
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
    <section class="card">
      <h3 class="text-base font-semibold text-[var(--text-main)] mb-4">📈 7天趋势</h3>
      <div class="space-y-3">
        <div v-if="dashboard.trends?.length === 0" class="text-center py-8 text-[var(--text-sub)]">
          暂无数据
        </div>
        <div v-else class="space-y-2">
          <div v-for="trend in dashboard.trends" :key="trend.date" class="flex items-center gap-4">
            <span class="w-20 text-sm text-[var(--text-sub)]">{{ trend.date.slice(5) }}</span>
            <div class="flex-1 flex gap-2">
              <div
                class="h-4 bg-[var(--primary)] rounded"
                :style="{ width: `${(trend.views / maxTrendValue) * 100}%`, minWidth: '4px' }"
              ></div>
            </div>
            <span class="text-sm text-[var(--text-sub)] w-16 text-right">{{ trend.views }}</span>
          </div>
        </div>
      </div>
    </section>

    <slot name="hotResources" />
  </div>

  <section class="card mb-6">
    <h3 class="text-base font-semibold text-[var(--text-main)] mb-4">🗂️ 分类分布</h3>
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div v-if="dashboard.categoryDistribution?.length === 0" class="col-span-full text-center py-8 text-[var(--text-sub)]">
        暂无数据
      </div>
      <template v-else>
        <div v-for="cat in dashboard.categoryDistribution?.slice(0, 10)" :key="cat.name" class="p-3 rounded-lg bg-[var(--bg-body)] border border-[var(--border-color)]">
          <div class="text-lg font-bold text-[var(--text-main)]">{{ cat.count }}</div>
          <div class="text-xs text-[var(--text-sub)] truncate">{{ cat.name }}</div>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface TrendItem {
  date: string;
  views: number;
}

interface OverviewData {
  totalUsers?: number;
  activeUsers?: number;
  totalResources?: number;
  totalViews?: number;
}

interface CategoryItem {
  name: string;
  count: number;
}

interface DashboardData {
  overview?: OverviewData;
  trends?: TrendItem[];
  categoryDistribution?: CategoryItem[];
}

const props = defineProps<{
  dashboard: DashboardData;
}>();

const maxTrendValue = computed(() => {
  if (!props.dashboard.trends?.length) return 1;
  return Math.max(...props.dashboard.trends.map((t) => t.views || 0));
});
</script>

<style scoped>
.card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s ease;
}

.card:hover {
  border-color: rgba(99, 102, 241, 0.2);
}
</style>
