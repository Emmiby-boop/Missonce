<template>
  <header class="topbar">
    <div class="top-left">
      <button class="menu-btn lg:hidden" @click="$emit('toggleSidebar')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>
      <div>
        <p class="top-label">后台管理中心</p>
        <h1 class="top-title">{{ title }}</h1>
        <p class="top-sub">{{ subtitle }}</p>
      </div>
    </div>
    
    <div class="top-actions">
      <div class="user-pill">
        <span class="dot"></span>
        <div>
          <p class="user-label">当前账号</p>
          <p class="user-value">
            {{ user?.phone || user?.uid || "未登录" }}
          </p>
        </div>
      </div>
      <button class="btn-soft icon-btn" :disabled="loading" @click="$emit('refresh')" title="刷新">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      </button>
      <button class="btn-soft icon-btn" @click="$emit('toggleTheme')" title="切换主题">
        <span v-if="isDark">🌙</span>
        <span v-else>☀️</span>
      </button>
      <button class="btn-soft icon-btn" @click="$emit('changePassword')" title="修改密码">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
      </button>
      <button class="btn-soft" :disabled="loading" @click="$emit('logout')">
        退出
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  subtitle: string;
  user: any;
  loading: boolean;
  isDark: boolean;
}>();

defineEmits(['refresh', 'logout', 'toggleTheme', 'toggleSidebar', 'changePassword']);
</script>

<style scoped>
.topbar {
  padding: 16px 20px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-body);
  flex-wrap: wrap;
  position: sticky;
  top: 0;
  z-index: 40;
}

.top-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.menu-btn {
  padding: 8px;
  margin-left: -8px;
  color: var(--text-main);
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
}

@media (min-width: 1024px) {
  .topbar {
    padding: 24px 40px;
    flex-wrap: nowrap;
  }
  
  .menu-btn {
    display: none;
  }
}

.top-label {
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-sub);
  margin: 0 0 4px;
  font-weight: 600;
}

.top-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--text-main);
  line-height: 1.2;
}

.top-sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-sub);
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.user-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  background: var(--bg-body);
  border: 1px solid var(--border-color);
  border-radius: 99px;
  margin-right: 8px;
}

.dot {
  width: 8px;
  height: 8px;
  background: var(--primary);
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(7, 193, 96, 0.2);
}

.user-label {
  font-size: 10px;
  color: var(--text-sub);
  line-height: 1;
  margin-bottom: 2px;
}

.user-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-main);
  line-height: 1;
}

.icon-btn {
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
