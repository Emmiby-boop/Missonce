<template>
  <header class="topbar">
    <!-- 左侧：移动端菜单按钮 + 极简标识 -->
    <div class="top-left">
      <button class="menu-btn lg:hidden" @click="$emit('toggleSidebar')" aria-label="打开菜单">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>
      <div class="top-mark lg:hidden">
        <img src="/logo.svg" alt="Missonce" class="w-7 h-7" />
      </div>
    </div>

    <!-- 右侧：用户信息 + 操作 -->
    <div class="top-actions">
      <div class="user-pill" :title="user?.phone || user?.username || '未登录'">
        <span class="dot" :class="{ 'dot-off': !user }"></span>
        <div class="user-info">
          <p class="user-label">当前账号</p>
          <p class="user-value font-mono">{{ user?.phone || user?.username || '未登录' }}</p>
        </div>
      </div>
      <div class="action-group">
        <button class="icon-btn" :disabled="loading" @click="$emit('refresh')" title="刷新登录态" aria-label="刷新">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-[18px] h-[18px]">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
        <button class="icon-btn" @click="$emit('toggleTheme')" :title="isDark ? '切换到亮色' : '切换到暗色'" aria-label="切换主题">
          <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-[18px] h-[18px]">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-[18px] h-[18px]">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
          </svg>
        </button>
        <button class="icon-btn" @click="$emit('changePassword')" title="修改密码" aria-label="修改密码">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-[18px] h-[18px]">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </button>
        <button class="icon-btn" @click="$emit('accountSecurity')" title="账号安全" aria-label="账号安全">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-[18px] h-[18px]">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
          </svg>
        </button>
        <button class="icon-btn icon-btn-danger" :disabled="loading" @click="$emit('logout')" title="退出登录" aria-label="退出">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-[18px] h-[18px]">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l3 3m0 0-3 3m3-3H2.25" />
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  user: any;
  loading: boolean;
  isDark: boolean;
}>();

defineEmits(['refresh', 'logout', 'toggleTheme', 'toggleSidebar', 'changePassword', 'accountSecurity']);
</script>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 24px;
  height: 60px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-card);
  position: sticky;
  top: 0;
  z-index: 40;
  backdrop-filter: blur(12px);
}

.top-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.top-mark {
  display: flex;
  align-items: center;
}

.menu-btn {
  padding: 6px;
  color: var(--text-main);
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  transition: all 0.2s;
}
.menu-btn:hover {
  background: var(--bg-hover);
  border-color: var(--text-sub);
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
  padding: 5px 14px 5px 12px;
  background: var(--bg-body);
  border: 1px solid var(--border-color);
  border-radius: 99px;
  max-width: 240px;
}

.dot {
  width: 7px;
  height: 7px;
  background: var(--primary);
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 0 3px rgba(7, 193, 96, 0.15);
  animation: dot-breath 2.4s ease-in-out infinite;
}
.dot-off {
  background: var(--text-sub);
  box-shadow: 0 0 0 3px rgba(120, 113, 108, 0.15);
  animation: none;
}

@keyframes dot-breath {
  0%, 100% { box-shadow: 0 0 0 3px rgba(7, 193, 96, 0.15); }
  50% { box-shadow: 0 0 0 5px rgba(7, 193, 96, 0.08); }
}

.user-info {
  min-width: 0;
}

.user-label {
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-sub);
  line-height: 1;
  margin-bottom: 3px;
  font-weight: 600;
}

.user-value {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-main);
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: var(--bg-body);
  border: 1px solid var(--border-color);
  border-radius: 12px;
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-sub);
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.icon-btn:hover:not(:disabled) {
  background: var(--bg-card);
  color: var(--text-main);
  box-shadow: var(--shadow-sm);
}
.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.icon-btn-danger:hover:not(:disabled) {
  color: var(--danger);
}

@media (max-width: 640px) {
  .topbar {
    padding: 0 16px;
  }
  .user-info {
    display: none;
  }
  .user-pill {
    padding: 6px;
    max-width: none;
  }
  .action-group {
    gap: 2px;
    padding: 3px;
  }
}
</style>
