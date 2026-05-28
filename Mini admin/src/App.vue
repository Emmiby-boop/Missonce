<template>
  <div class="min-h-screen" :class="isDark ? 'theme-dark' : 'theme-light'">
    <div class="app-shell">
      <AdminSidebar :is-dark="isDark" :is-open="isSidebarOpen" @close="isSidebarOpen = false" />
      <div class="flex flex-1 flex-col w-0">
        <AdminTopbar
          :title="currentTitle"
          :subtitle="currentSubtitle"
          :user="user"
          :loading="loading"
          :is-dark="isDark"
          @refresh="handleRefresh"
          @logout="handleLogout"
          @toggle-theme="toggleTheme"
          @toggle-sidebar="toggleSidebar"
          @change-password="openPasswordModal"
        />
        <main class="flex-1 px-6 pb-12 pt-6 lg:px-10">
          <router-view v-slot="{ Component }">
            <transition name="page-fade">
              <component :is="Component" />
            </transition>
          </router-view>
        </main>
      </div>
    </div>

    <!-- Change Password Modal -->
    <div v-if="showPasswordModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div class="w-full max-w-md rounded-2xl bg-base-100 p-6 shadow-xl transition-all">
        <h3 class="text-lg font-bold mb-6">修改密码</h3>
        
        <div class="space-y-4">
          <div class="form-control">
            <label class="label"><span class="label-text">旧密码</span></label>
            <input 
              v-model="pwdForm.oldPassword" 
              type="password" 
              class="input input-bordered w-full" 
              placeholder="请输入旧密码"
            />
          </div>
          
          <div class="form-control">
            <label class="label"><span class="label-text">新密码</span></label>
            <input 
              v-model="pwdForm.newPassword" 
              type="password" 
              class="input input-bordered w-full" 
              placeholder="请输入新密码"
            />
          </div>
          
          <div class="form-control">
            <label class="label"><span class="label-text">确认新密码</span></label>
            <input 
              v-model="pwdForm.confirmPassword" 
              type="password" 
              class="input input-bordered w-full" 
              placeholder="请再次输入新密码"
            />
          </div>
        </div>

        <div class="modal-action mt-8 flex justify-end gap-3">
          <button class="btn btn-ghost" @click="showPasswordModal = false" :disabled="pwdLoading">取消</button>
          <button class="btn btn-primary" @click="handlePasswordSubmit" :disabled="pwdLoading">
            {{ pwdLoading ? "提交中..." : "确认修改" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import AdminSidebar from "./components/AdminSidebar.vue";
import AdminTopbar from "./components/AdminTopbar.vue";
import { getLoginState, logout, changePassword } from "./utils/cloudbase";

const router = useRouter();

const isDark = ref(true); // 默认深色主题
const isSidebarOpen = ref(false);

// Password Modal
const showPasswordModal = ref(false);
const pwdForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
});
const pwdLoading = ref(false);

const openPasswordModal = () => {
  pwdForm.value = {
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  };
  showPasswordModal.value = true;
};

const handlePasswordSubmit = async () => {
  if (!pwdForm.value.oldPassword || !pwdForm.value.newPassword) {
    ElMessage.warning("请填写完整信息");
    return;
  }
  if (pwdForm.value.newPassword !== pwdForm.value.confirmPassword) {
    ElMessage.warning("两次新密码输入不一致");
    return;
  }

  // Get username from user object
  // Supports both custom admin auth (user.customAdmin.username) and potential future auth
  const username = user.value?.customAdmin?.username || user.value?.username || 'admin';
  
  pwdLoading.value = true;
  try {
    const res = await changePassword(username, pwdForm.value.oldPassword, pwdForm.value.newPassword);
    if (res.success) {
      ElMessage.success("密码修改成功，请重新登录");
      showPasswordModal.value = false;
      await handleLogout();
    } else {
      ElMessage.error(res.message || "修改失败");
    }
  } catch (e: any) {
    console.error(e);
    ElMessage.error("修改失败: " + e.message);
  } finally {
    pwdLoading.value = false;
  }
};

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

// Close sidebar on route change (mobile)
watch(
  () => router.currentRoute.value.path,
  () => {
    isSidebarOpen.value = false;
  }
);

const applyThemeClass = () => {
  const root = document.documentElement;
  const body = document.body;
  if (isDark.value) {
    root.classList.add("dark");
    root.classList.remove("light");
    body.classList.add("dark");
    body.classList.remove("light");
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
    body.classList.add("light");
    body.classList.remove("dark");
  }
};

const toggleTheme = () => {
  isDark.value = !isDark.value;
  applyThemeClass();
};

// 初始化主题
onMounted(() => {
  applyThemeClass();
});

const route = useRoute();
const loading = ref(false);
const user = ref<any>(null);

const currentTitle = computed(() => {
  const map: Record<string, string> = {
    "/": "仪表盘",
    "/operations-dashboard": "智能运营助手",
    "/banners": "轮播图管理",
    "/resources": "资源管理",
    "/categories": "分类管理",
    "/tags": "标签管理",
    "/topics": "专题管理",
  };
  return map[route.path] || "后台管理";
});

const currentSubtitle = computed(() => {
  const map: Record<string, string> = {
    "/": "运营概览与快捷操作",
    "/operations-dashboard": "AI 驱动的数据分析、趋势预测与用户行为记录",
    "/resources": "素材上传、审核与上下架",
    "/categories": "分类维度与排序维护",
    "/tags": "标签体系与启用状态",
  };
  return map[route.path] || "CloudBase Admin";
});

const refreshLogin = async () => {
  loading.value = true;
  try {
    const state = await getLoginState();
    user.value = state?.user ?? null;
    const isAnonymous = Boolean((state?.user as any)?.isAnonymous);
    if (!state || !state.user || isAnonymous) {
      if (isAnonymous) {
        await logout().catch(() => {});
      }
      router.replace({ path: "/login", query: { redirect: route.fullPath } });
    }
  } finally {
    loading.value = false;
  }
};

const handleRefresh = async () => {
  // 刷新登录状态
  await refreshLogin();
};

const handleLogout = async () => {
  loading.value = true;
  try {
    await logout();
    user.value = null;
    // 退出后重定向到登录页面
    router.push("/login");
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await refreshLogin();
});


</script>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
  background: var(--bg-body);
}

.page-fade-enter-active,
.page-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.page-fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
