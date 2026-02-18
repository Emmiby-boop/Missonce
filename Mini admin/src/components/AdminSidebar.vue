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

    <nav class="nav">
      <RouterLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ active: route.path === item.path }"
        @click="$emit('close')"
      >
        <span class="nav-label">{{ item.label }}</span>
        <span class="nav-arrow" v-if="route.path === item.path">→</span>
      </RouterLink>
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
import { RouterLink, useRoute } from "vue-router";

const route = useRoute();

const navItems = [
  { path: '/', label: '概览' },
  { path: '/operations-dashboard', label: '智能运营助手' },
  { path: '/resources', label: '资源管理' },
  { path: '/ai-config', label: 'AI配置' },
  { path: '/banners', label: '轮播图管理' },
  { path: '/home-layout', label: '首页布局管理' },
  { path: '/topics', label: '专题管理' },
  { path: '/page-layout', label: '头像/壁纸布局' },
  { path: '/categories', label: '分类管理' },
  { path: '/tags', label: '标签管理' },
  { path: '/error-logs', label: '错误日志' },
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

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--border-color);
  margin-top: auto;
}

.text-sub {
  color: var(--text-sub);
}
</style>
