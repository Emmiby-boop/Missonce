<template>
  <aside class="sidebar" :class="{ 'is-open': isOpen }">
    <div class="brand">
      <div class="brand-mark">
        <img src="/logo.svg" alt="Missonce Logo" class="w-full h-full">
      </div>
      <div>
        <p class="brand-title">Missonce</p>
        <p class="brand-sub">后台管理系统</p>
      </div>
    </div>

    <nav class="nav" role="navigation" aria-label="主导航">
      <template v-for="group in navGroups" :key="group.label">
        <template v-if="group.flat">
          <RouterLink
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            :class="{ active: route.path === item.path }"
            @click="$emit('close')"
          >
            <span class="nav-label">{{ item.label }}</span>
            <span class="nav-arrow" v-if="route.path === item.path"></span>
          </RouterLink>
        </template>
        <template v-else>
          <button class="nav-group-header" @click="toggleGroup(group.label)">
            <span class="nav-group-title">{{ group.label }}</span>
            <svg class="nav-group-arrow" :class="{ 'is-open': openGroups[group.label] }" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div v-show="openGroups[group.label]" class="nav-group-items">
            <RouterLink v-for="item in group.items" :key="item.path" :to="item.path" class="nav-item" :class="{ active: route.path === item.path }" @click="$emit('close')">
              <span class="nav-label">{{ item.label }}</span>
              <span class="nav-arrow" v-if="route.path === item.path"></span>
            </RouterLink>
          </div>
        </template>
      </template>
    </nav>

    <div class="sidebar-footer">
      <p class="text-xs text-sub">ENV · missonce-99</p>
      <p class="text-xs text-sub opacity-70">ap-shanghai · v1.1.5</p>
    </div>
  </aside>

  <!-- Mobile Backdrop -->
  <div v-if="isOpen" class="backdrop lg:hidden" @click="$emit('close')"></div>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import { RouterLink, useRoute } from "vue-router";

const route = useRoute();

// 默认展开"去水印精灵"分组（当前活跃菜单所在分组）
const openGroups = reactive<Record<string, boolean>>({
  '总览': true,
  '去水印精灵': true,
  '壁纸头像': false,
  '系统': false,
});

function toggleGroup(label: string) {
  openGroups[label] = !openGroups[label];
}

interface NavItem {
  path: string;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  flat?: boolean;
}

const navGroups: NavGroup[] = [
  {
    label: '总览',
    items: [
      { path: '/', label: '概览' },
      { path: '/operations-dashboard', label: '智能运营助手' },
    ]
  },
  {
    label: '去水印精灵',
    items: [
      { path: '/media', label: '解析工具' },
      { path: '/media-trending', label: '热门榜单' },
      { path: '/media-platforms', label: '平台监控' },
      { path: '/media-cookies', label: 'Cookie配置' },
      { path: '/media-whitelist', label: '域名白名单' },
      { path: '/media-ops', label: '运维工具' },
      { path: '/media-page-config', label: '页面管理' },
      { path: '/media-announcement', label: '解析公告' },
    ]
  },
  {
    label: '',
    flat: true,
    items: [
      { path: '/resources', label: '资源管理' },
      { path: '/user-manager', label: '用户管理' },
      { path: '/ai-config', label: 'AI配置' },
      { path: '/page-ads', label: '广告管理' },
      { path: '/banners', label: '轮播图' },
      { path: '/home-layout', label: '首页布局' },
      { path: '/topics', label: '专题管理' },
      { path: '/categories-tags', label: '分类标签' },
      { path: '/notifications', label: '公告管理' },
      { path: '/contact-config', label: '联系方式' },
    ]
  },
  {
    label: '系统',
    items: [
      { path: '/admins', label: '管理员管理' },
      { path: '/logs', label: '日志管理' },
    ]
  },
];

defineProps<{
  isDark: boolean;
  isOpen: boolean;
}>();

defineEmits(['close']);
</script>

<style scoped>
.sidebar {
  width: 260px;
  padding: 32px 24px;
  border-right: 1px solid var(--border-color);
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  gap: 32px;
  
  /* Mobile fixed positioning */
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
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(2px);
  z-index: 40;
}

/* Desktop static positioning */
@media (min-width: 1024px) {
  .sidebar {
    position: sticky;
    top: 0;
    height: 100vh;
    transform: none !important;
    border-right: 1px solid var(--border-color);
    background: var(--bg-card);
  }
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-left: 8px;
}

.brand-mark {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.brand-title {
  font-family: 'Inter', sans-serif;
  font-weight: 700;
  font-size: 16px;
  color: var(--text-main);
  line-height: 1.2;
}

.brand-sub {
  font-size: 11px;
  color: var(--text-sub);
  letter-spacing: 0.05em;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  overflow-y: auto;
  min-height: 0; /* 允许 flex 子元素收缩并出现滚动条 */
  scrollbar-width: thin;
  scrollbar-color: var(--border-color) transparent;
}

.nav::-webkit-scrollbar {
  width: 4px;
}

.nav::-webkit-scrollbar-track {
  background: transparent;
}

.nav::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 2px;
}

.nav::-webkit-scrollbar-thumb:hover {
  background: var(--text-sub);
}

.nav-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 12px;
  color: var(--text-sub);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: var(--bg-body);
  color: var(--text-main);
}

.nav-item.active {
  background: var(--bg-body);
  color: var(--primary);
  font-weight: 600;
}

.nav-arrow {
  font-size: 12px;
  opacity: 0;
  transform: translateX(-4px);
  transition: all 0.2s;
}

.nav-item.active .nav-arrow {
  opacity: 1;
  transform: translateX(0);
}

.nav-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 12px 4px 12px;
  margin-top: 8px;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.2s;
}

.nav-group-header:hover {
  color: var(--primary);
}

.nav-group-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-sub);
  opacity: 0.6;
}

.nav-group-arrow {
  color: var(--text-sub);
  opacity: 0.5;
  transition: transform 0.2s;
}

.nav-group-arrow.is-open {
  transform: rotate(180deg);
}

.nav-group-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 0;
}

.nav-group-items .nav-item {
  padding-left: 24px;
  font-size: 13px;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--border-color);
  margin-top: auto;
}

.text-sub {
  color: var(--text-sub);
}
</style>
