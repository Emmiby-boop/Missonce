<template>
  <aside class="sidebar" :class="{ 'is-open': isOpen }">
    <!-- 品牌 -->
    <div class="brand">
      <div class="brand-mark">
        <img src="/logo.svg" alt="Missonce Logo" class="w-full h-full" />
      </div>
      <div class="brand-text">
        <p class="brand-title">Missonce</p>
        <p class="brand-sub">运营控制台</p>
      </div>
    </div>

    <!-- 导航 -->
    <nav class="nav" role="navigation" aria-label="主导航">
      <template v-for="group in navGroups" :key="group.label">
        <button class="nav-group-header" @click="toggleGroup(group.label)" :aria-expanded="openGroups[group.label]">
          <span class="nav-group-title">{{ group.label }}</span>
          <svg class="nav-group-arrow" :class="{ 'is-open': openGroups[group.label] }" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div v-show="openGroups[group.label]" class="nav-group-items">
          <RouterLink
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            :class="{ active: route.path === item.path }"
            @click="$emit('close')"
          >
            <span class="nav-icon" v-html="item.icon"></span>
            <span class="nav-label">{{ item.label }}</span>
            <span class="nav-badge" v-if="item.badge">{{ item.badge }}</span>
          </RouterLink>
        </div>
      </template>
    </nav>
  </aside>

  <div v-if="isOpen" class="backdrop lg:hidden" @click="$emit('close')"></div>
</template>

<script setup lang="ts">
import { reactive, computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useAuthStore } from "../stores/auth";

const route = useRoute();
const authStore = useAuthStore();

// 默认全展开 — 减少点击成本
const openGroups = reactive<Record<string, boolean>>({
  '总览': true,
  '去水印精灵': true,
  '壁纸头像': true,
  '系统': true,
});

function toggleGroup(label: string) {
  openGroups[label] = !openGroups[label];
}

const icons = {
  dashboard: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
  ai: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>',
  parse: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  trending: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
  monitor: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  cookie: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21.6 11.5a8 8 0 1 1-9.1-9.1"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="14" cy="15" r="1"/><path d="M21 7a2 2 0 0 0 0-4"/></svg>',
  shield: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  ops: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  page: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>',
  announcement: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
  resource: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  user: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  aiConfig: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  ad: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  download: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  home: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  topic: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  frame: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="4"/></svg>',
  tag: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
  bell: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  contact: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  admin: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/></svg>',
  log: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  store: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
};

interface NavItem {
  path: string;
  label: string;
  icon: string;
  badge?: string;
  requireRole?: 'admin' | 'superadmin';
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const allNavGroups: NavGroup[] = [
  {
    label: '总览',
    items: [
      { path: '/', label: '概览', icon: icons.dashboard },
      { path: '/operations-dashboard', label: '智能运营助手', icon: icons.ai },
    ]
  },
  {
    label: '去水印精灵',
    items: [
      { path: '/media', label: '解析工具', icon: icons.parse },
      { path: '/media-trending', label: '热门榜单', icon: icons.trending },
      { path: '/media-platforms', label: '平台监控', icon: icons.monitor },
      { path: '/media-cookies', label: 'Cookie配置', icon: icons.cookie },
      { path: '/media-whitelist', label: '域名白名单', icon: icons.shield },
      { path: '/media-ops', label: '运维工具', icon: icons.ops },
      { path: '/media-page-config', label: '页面管理', icon: icons.page },
      { path: '/media-announcement', label: '解析公告', icon: icons.announcement },
    ]
  },
  {
    label: '壁纸头像',
    items: [
      { path: '/resources', label: '资源管理', icon: icons.resource },
      { path: '/user-manager', label: '用户管理', icon: icons.user },
      { path: '/ai-config', label: 'AI配置', icon: icons.aiConfig },
      { path: '/page-ads', label: '广告管理', icon: icons.ad },
      { path: '/download-manager', label: '下载管理', icon: icons.download },
      { path: '/home-tabs', label: '首页Tab', icon: icons.home },
      { path: '/topics', label: '专题管理', icon: icons.topic },
      { path: '/avatar-frames', label: '动态头像框', icon: icons.frame },
      { path: '/categories-tags', label: '分类标签', icon: icons.tag },
      { path: '/notifications', label: '公告管理', icon: icons.bell },
      { path: '/contact-config', label: '联系方式', icon: icons.contact },
      { path: '/points-config', label: '辣度值配置', icon: icons.ops },
      { path: '/daily-picks', label: '每日精选', icon: icons.resource },
      { path: '/share-codes', label: '分享码管理', icon: icons.parse },
      { path: '/store-products', label: '小店商品', icon: icons.store },
      { path: '/tools-config', label: '工具箱', icon: icons.ops },
      { path: '/group-qr-config', label: '加群页配置', icon: icons.contact },
    ]
  },
  {
    label: '系统',
    items: [
      { path: '/admins', label: '管理员管理', icon: icons.admin, requireRole: 'superadmin' },
      { path: '/logs', label: '日志管理', icon: icons.log },
    ]
  },
];

// RBAC 过滤：隐藏当前用户无权访问菜单项，空分组整体隐藏
const navGroups = computed<NavGroup[]>(() => {
  const userRole = authStore.role;
  return allNavGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (!item.requireRole) return true;
        // superadmin 可以看到所有菜单
        if (userRole === 'superadmin') return true;
        return false;
      }),
    }))
    .filter(group => group.items.length > 0);
});

defineProps<{
  isDark: boolean;
  isOpen: boolean;
}>();

defineEmits(['close']);
</script>

<style scoped>
.sidebar {
  width: 248px;
  padding: 24px 16px;
  border-right: 1px solid var(--border-color);
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  gap: 24px;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 50;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform: translateX(-100%);
}

.sidebar.is-open {
  transform: translateX(0);
}

.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
  z-index: 40;
}

@media (min-width: 1024px) {
  .sidebar {
    position: sticky;
    top: 0;
    height: 100vh;
    transform: none !important;
    width: 248px;
    flex-shrink: 0;
  }
}

/* 品牌 */
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 8px;
}

.brand-mark {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: linear-gradient(135deg, var(--primary-soft), transparent);
  border: 1px solid var(--border-color);
}

.brand-title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 15px;
  color: var(--text-main);
  line-height: 1.2;
  letter-spacing: -0.01em;
}

.brand-sub {
  font-size: 10px;
  color: var(--text-sub);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 600;
  margin-top: 2px;
}

/* 导航 */
.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--border-color) transparent;
  padding-right: 4px;
}

.nav::-webkit-scrollbar { width: 4px; }
.nav::-webkit-scrollbar-track { background: transparent; }
.nav::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 2px; }

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  color: var(--text-sub);
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.18s ease;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-main);
}

.nav-item.active {
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 600;
}

/* 激活项左侧指示条 */
.nav-item.active::before {
  content: '';
  position: absolute;
  left: -16px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  background: var(--primary);
  border-radius: 0 2px 2px 0;
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: 0.65;
}

.nav-item:hover .nav-icon {
  opacity: 1;
}

.nav-item.active .nav-icon {
  opacity: 1;
}

.nav-label {
  flex: 1;
}

.nav-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 99px;
  background: var(--primary);
  color: #fff;
  font-weight: 600;
}

/* 分组标题 */
.nav-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 12px 6px;
  margin-top: 4px;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.2s;
}

.nav-group-header:first-child {
  margin-top: 0;
}

.nav-group-header:hover {
  color: var(--text-main);
}

.nav-group-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-sub);
  opacity: 0.55;
}

.nav-group-arrow {
  color: var(--text-sub);
  opacity: 0.4;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.nav-group-arrow.is-open {
  transform: rotate(180deg);
}

.nav-group-items {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
</style>
