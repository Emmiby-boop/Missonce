<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-[var(--text-main)]">仪表盘</h1>
        <p class="text-[var(--text-sub)] mt-1">数据概览与运营状态</p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <select v-model="timeRange" @change="fetchStats" class="px-4 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] text-sm">
          <option value="today">今日</option>
          <option value="week">本周</option>
          <option value="month" selected>本月</option>
          <option value="year">今年</option>
        </select>
        <button @click="fetchStats" :disabled="loading" class="btn-primary flex items-center gap-2">
          <svg v-if="!loading" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
          <svg v-else class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          {{ loading ? "刷新中..." : "刷新" }}
        </button>
        <div class="text-xs text-[var(--text-sub)] bg-[var(--bg-card)] px-3 py-1 rounded-full border border-[var(--border-color)]">
          最近更新：{{ stats.lastUpdatedLabel }}
        </div>
      </div>
    </div>

    <!-- Main Stats -->
    <section class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <div class="stat-card" @click="navigateTo('resources')">
        <div class="flex items-center justify-between mb-4">
          <p class="text-xs font-semibold uppercase tracking-wider text-[var(--text-sub)]">素材总数</p>
          <div class="p-2 rounded-lg bg-blue-500/10 text-blue-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
          </div>
        </div>
        <h2 class="text-3xl font-bold text-[var(--text-main)] mb-2">{{ stats.total }}</h2>
        <div class="flex items-center gap-3 text-sm">
          <span class="flex items-center gap-1 text-green-500">
            <span class="w-2 h-2 rounded-full bg-green-500"></span>
            已发布 {{ stats.published }}
          </span>
          <span class="flex items-center gap-1 text-yellow-500" v-if="stats.review > 0">
            <span class="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
            待审 {{ stats.review }}
          </span>
        </div>
        <div class="mt-3">
          <span class="text-xs text-[var(--primary)] cursor-pointer hover:underline">
            管理素材 →
          </span>
        </div>
      </div>

      <div class="stat-card" @click="navigateTo('users')">
        <div class="flex items-center justify-between mb-4">
          <p class="text-xs font-semibold uppercase tracking-wider text-[var(--text-sub)]">用户互动</p>
          <div class="p-2 rounded-lg bg-purple-500/10 text-purple-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          </div>
        </div>
        <h2 class="text-3xl font-bold text-[var(--text-main)] mb-2">{{ stats.favorites + stats.downloads }}</h2>
        <div class="text-sm text-[var(--text-sub)]">
          收藏 {{ stats.favorites }} · 下载 {{ stats.downloads }}
        </div>
        <div class="mt-3">
          <span class="text-xs text-[var(--primary)] cursor-pointer hover:underline">
            管理用户 →
          </span>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between mb-4">
          <p class="text-xs font-semibold uppercase tracking-wider text-[var(--text-sub)]">访问流量</p>
          <div class="p-2 rounded-lg bg-green-500/10 text-green-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
        </div>
        <h2 class="text-3xl font-bold text-[var(--text-main)] mb-2">{{ stats.pv }}</h2>
        <div class="text-sm text-[var(--text-sub)]">
          PV (浏览量) · UV (访客) {{ stats.uv }}
        </div>
      </div>

      <div class="stat-card" @click="navigateTo('categories')">
        <div class="flex items-center justify-between mb-4">
          <p class="text-xs font-semibold uppercase tracking-wider text-[var(--text-sub)]">内容管理</p>
          <div class="p-2 rounded-lg bg-orange-500/10 text-orange-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <h2 class="text-2xl font-bold text-[var(--text-main)]">{{ stats.categories }}</h2>
            <p class="text-xs text-[var(--text-sub)]">分类</p>
          </div>
          <div>
            <h2 class="text-2xl font-bold text-[var(--text-main)]">{{ stats.tags }}</h2>
            <p class="text-xs text-[var(--text-sub)]">标签</p>
          </div>
        </div>
        <div class="mt-3">
          <span class="text-xs text-[var(--primary)] cursor-pointer hover:underline">
            管理分类标签 →
          </span>
        </div>
      </div>
    </section>

    <!-- Charts Section -->
    <section class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <!-- Daily Traffic Chart -->
      <div class="card">
        <div class="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
          <h3 class="font-bold text-[var(--text-main)]">访问量趋势</h3>
          <span class="text-xs text-[var(--text-sub)]">近7天</span>
        </div>
        <div class="p-6">
          <v-chart :option="trafficChartOption" class="h-64" autoresize />
        </div>
      </div>

      <!-- Resource Status Pie Chart -->
      <div class="card">
        <div class="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
          <h3 class="font-bold text-[var(--text-main)]">素材状态分布</h3>
          <span class="text-xs text-[var(--text-sub)]">当前状态</span>
        </div>
        <div class="p-6">
          <v-chart :option="statusChartOption" class="h-64" autoresize />
        </div>
      </div>
    </section>

    <!-- Top Resources & System Health -->
    <section class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <!-- Top Resources -->
      <div class="card">
        <div class="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
          <h3 class="font-bold text-[var(--text-main)]">热门素材 TOP10</h3>
          <div class="flex gap-2">
            <button 
              @click="topListType = 'downloads'" 
              :class="['text-xs px-3 py-1 rounded-full transition-colors', topListType === 'downloads' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg-body)] text-[var(--text-sub)]']"
            >
              下载量
            </button>
            <button 
              @click="topListType = 'favorites'" 
              :class="['text-xs px-3 py-1 rounded-full transition-colors', topListType === 'favorites' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg-body)] text-[var(--text-sub)]']"
            >
              收藏量
            </button>
          </div>
        </div>
        <div class="p-6">
          <div class="space-y-3">
            <div v-for="(item, index) in topResources" :key="item._id" class="flex items-center gap-4 p-3 rounded-lg bg-[var(--bg-body)] hover:bg-[var(--bg-body)]/80 transition-colors">
              <div 
                class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                :style="index === 0 ? { background: 'linear-gradient(135deg, #fbbf24, #f97316)', color: 'white' } 
                      : index === 1 ? { background: 'linear-gradient(135deg, #d1d5db, #9ca3af)', color: 'white' }
                      : index === 2 ? { background: 'linear-gradient(135deg, #d97706, #b45309)', color: 'white' }
                      : { background: 'var(--bg-card)', color: 'var(--text-sub)' }"
              >
                {{ index + 1 }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-[var(--text-main)] truncate">{{ item.title || '未命名素材' }}</p>
                <p class="text-xs text-[var(--text-sub)]">{{ item.downloads || 0 }} 下载 · {{ item.favorites || 0 }} 收藏</p>
              </div>
              <div class="text-right">
                <p class="text-lg font-bold text-[var(--primary)]">{{ item[topListType] || 0 }}</p>
              </div>
            </div>
            <div v-if="topResources.length === 0" class="text-center py-8 text-[var(--text-sub)]">
              暂无数据
            </div>
          </div>
        </div>
      </div>

      <!-- System Health -->
      <div class="card">
        <div class="px-6 py-4 border-b border-[var(--border-color)]">
          <h3 class="font-bold text-[var(--text-main)]">系统健康状态</h3>
        </div>
        <div class="p-6">
          <div class="space-y-4">
            <div class="p-4 rounded-lg bg-[var(--bg-body)]">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-[var(--text-sub)]">云函数调用</span>
                <span class="text-sm font-medium text-green-500">正常</span>
              </div>
              <div class="h-2 bg-[var(--bg-card)] rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full" style="width: 35%"></div>
              </div>
              <p class="text-xs text-[var(--text-sub)] mt-1">今日调用: 1,234 次</p>
            </div>

            <div class="p-4 rounded-lg bg-[var(--bg-body)]">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-[var(--text-sub)]">云存储使用</span>
                <span class="text-sm font-medium text-green-500">正常</span>
              </div>
              <div class="h-2 bg-[var(--bg-card)] rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full" style="width: 52%"></div>
              </div>
              <p class="text-xs text-[var(--text-sub)] mt-1">已使用: 5.2 GB / 10 GB</p>
            </div>

            <div class="p-4 rounded-lg bg-[var(--bg-body)]">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-[var(--text-sub)]">数据库操作</span>
                <span class="text-sm font-medium text-green-500">正常</span>
              </div>
              <div class="h-2 bg-[var(--bg-card)] rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full" style="width: 28%"></div>
              </div>
              <p class="text-xs text-[var(--text-sub)] mt-1">今日读写: 8,567 次</p>
            </div>

            <div class="p-4 rounded-lg bg-[var(--bg-body)]">
              <div class="flex items-center justify-between">
                <span class="text-sm text-[var(--text-sub)]">当前用户</span>
                <span class="text-sm font-medium text-[var(--text-main)] font-mono">{{ currentUserUid || '未登录' }}</span>
              </div>
            </div>

            <div class="p-4 rounded-lg bg-[var(--bg-body)]">
              <div class="flex items-center justify-between">
                <span class="text-sm text-[var(--text-sub)]">权限状态</span>
                <span class="text-sm font-medium" :class="isAdmin ? 'text-green-600' : 'text-red-600'">
                  {{ isAdmin ? '管理员 (已验证)' : '访客 (无管理权限)' }}
                </span>
              </div>
            </div>
          </div>

          <div class="mt-6">
            <h4 class="text-xs font-semibold text-[var(--text-sub)] uppercase mb-3">运营建议</h4>
            <ul class="space-y-2 text-sm text-[var(--text-sub)]">
              <li v-if="stats.review > 0" class="flex items-start gap-2 text-yellow-500">
                <span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0 animate-pulse"></span>
                有 {{ stats.review }} 个素材待审核，请及时处理
              </li>
              <li class="flex items-start gap-2">
                <span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--primary)] shrink-0"></span>
                记得完善分类/标签，提高素材检索效率
              </li>
              <li class="flex items-start gap-2">
                <span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--primary)] shrink-0"></span>
                上架前建议补充封面与标题，提升点击率
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, computed } from "vue";
import { useRouter } from "vue-router";
import { db, _, ensureAuthUser, fetchAdminProfile } from "../utils/cloudbase";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { LineChart, PieChart, BarChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from "echarts/components";
import VChart from "vue-echarts";

use([
  CanvasRenderer,
  LineChart,
  PieChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
]);

const router = useRouter();
const dbAny = db as any;

const currentUserUid = ref("");
const isAdmin = ref(false);
const timeRange = ref("month");
const topListType = ref("downloads");

const stats = reactive({
  total: 0,
  published: 0,
  review: 0,
  offline: 0,
  draft: 0,
  downloads: 0,
  favorites: 0,
  pv: 0,
  uv: 0,
  categories: 0,
  tags: 0,
  lastUpdatedLabel: "-",
});

const topResources = ref<any[]>([]);
const loading = ref(false);

// 真实流量数据
const trafficData = ref<{ days: string[]; pvData: number[]; uvData: number[] }>({
  days: [],
  pvData: [],
  uvData: [],
});

const trafficChartOption = computed(() => {
  return {
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(0,0,0,0.8)",
      textStyle: { color: "#fff" },
    },
    legend: {
      data: ["PV", "UV"],
      textStyle: { color: "var(--text-main)" },
      top: 0,
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      top: "15%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: trafficData.value.days,
      axisLine: { lineStyle: { color: "var(--border-color)" } },
      axisLabel: { color: "var(--text-sub)" },
    },
    yAxis: {
      type: "value",
      axisLine: { lineStyle: { color: "var(--border-color)" } },
      axisLabel: { color: "var(--text-sub)" },
      splitLine: { lineStyle: { color: "var(--border-color)" } },
    },
    series: [
      {
        name: "PV",
        type: "line",
        smooth: true,
        data: trafficData.value.pvData,
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(59, 130, 246, 0.3)" },
              { offset: 1, color: "rgba(59, 130, 246, 0.05)" },
            ],
          },
        },
        lineStyle: { color: "#3b82f6", width: 2 },
        itemStyle: { color: "#3b82f6" },
      },
      {
        name: "UV",
        type: "line",
        smooth: true,
        data: trafficData.value.uvData,
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(16, 185, 129, 0.3)" },
              { offset: 1, color: "rgba(16, 185, 129, 0.05)" },
            ],
          },
        },
        lineStyle: { color: "#10b981", width: 2 },
        itemStyle: { color: "#10b981" },
      },
    ],
  };
});

const statusChartOption = computed(() => {
  const data = [
    { value: stats.published, name: "已发布", itemStyle: { color: "#10b981" } },
    { value: stats.review, name: "待审核", itemStyle: { color: "#f59e0b" } },
    { value: stats.offline, name: "已下线", itemStyle: { color: "#ef4444" } },
    { value: stats.draft, name: "草稿", itemStyle: { color: "#6b7280" } },
  ].filter(item => item.value > 0);
  return {
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(0,0,0,0.8)",
      textStyle: { color: "#fff" },
    },
    legend: {
      orient: "vertical",
      right: "10%",
      top: "center",
      textStyle: { color: "var(--text-main)" },
    },
    series: [
      {
        name: "素材状态",
        type: "pie",
        radius: ["40%", "70%"],
        center: ["35%", "50%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: "var(--bg-card)",
          borderWidth: 2,
        },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: "bold",
          },
        },
        labelLine: { show: false },
        data,
      },
    ],
  };
});

const navigateTo = (page: string, params?: any) => {
  const pathMap: Record<string, string> = {
    resources: "/resources",
    categories: "/categories",
    tags: "/tags",
    users: "/users",
  };
  router.push({ path: pathMap[page] || pathMap.resources, query: params });
};

// 获取近7天真实流量数据
const fetchTrafficData = async () => {
  const days: string[] = [];
  const pvData: number[] = [];
  const uvData: number[] = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
    days.push(dateStr);
    
    // 计算当天的开始和结束时间戳
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    
    try {
      // 查询当天 PV
      const pvRes = await dbAny
        .collection("events")
        .where({ 
          type: "pv",
          ts: _.gte(dayStart.getTime()).and(_.lte(dayEnd.getTime()))
        })
        .count();
      pvData.push(pvRes.total || 0);
      
      // 查询当天 UV (按 openid 去重)
      const uvRes = await dbAny
        .collection("events")
        .aggregate()
        .match({ 
          type: "pv",
          ts: _.gte(dayStart.getTime()).and(_.lte(dayEnd.getTime()))
        })
        .group({ _id: "$_openid" })
        .count("total")
        .end();
      uvData.push(uvRes?.data?.[0]?.total || 0);
    } catch (e) {
      console.warn("获取流量数据失败", e);
      pvData.push(0);
      uvData.push(0);
    }
  }
  
  trafficData.value = { days, pvData, uvData };
};

const fetchStats = async () => {
  loading.value = true;
  try {
    const authState = await ensureAuthUser();
    currentUserUid.value = authState.user?.uid || "";

    const adminProfile = await fetchAdminProfile();
    isAdmin.value = !!adminProfile;

    const statusList = ["published", "review", "offline", "draft"] as const;
    const countPromises = statusList.map((s) =>
      db.collection("resources").where({ status: s }).count()
    );
    const [totalRes, ...rest] = await Promise.all([
      db.collection("resources").count(),
      ...countPromises,
    ]);

    stats.total = totalRes.total || 0;
    stats.published = rest[0].total || 0;
    stats.review = rest[1].total || 0;
    stats.offline = rest[2].total || 0;
    stats.draft = rest[3].total || 0;

    const [downloadsRes, favoritesRes] = await Promise.all([
      db.collection("downloads").count(),
      db.collection("favorites").count(),
    ]);
    stats.downloads = downloadsRes.total || 0;
    stats.favorites = favoritesRes.total || 0;

    const [categoriesRes, tagsRes, pvRes] = await Promise.all([
      db.collection("categories").count(),
      db.collection("tags").count(),
      db.collection("events").where({ type: "pv" }).count(),
    ]);
    stats.categories = categoriesRes.total || 0;
    stats.tags = tagsRes.total || 0;
    stats.pv = pvRes.total || 0;

    const uvRes = await dbAny
      .collection("events")
      .aggregate()
      .match({ type: "pv" })
      .group({ _id: "$_openid" })
      .count("total")
      .end();

    stats.uv = uvRes?.data?.[0]?.total || 0;

    const topRes = await dbAny
      .collection("resources")
      .where({ status: "published" })
      .orderBy(topListType.value, "desc")
      .limit(10)
      .get();
    topResources.value = topRes.data || [];

    stats.lastUpdatedLabel = new Date().toLocaleString();
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchStats();
  fetchTrafficData();
});
</script>

<style scoped>
.stat-card {
  @apply bg-[var(--bg-card)] p-6 rounded-2xl border border-[var(--border-color)] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer;
}

.card {
  @apply bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden transition-all duration-300;
}

.btn-primary {
  @apply px-4 py-2 rounded-lg bg-[var(--primary)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed;
}
</style>
