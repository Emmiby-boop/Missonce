import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHashHistory } from "vue-router";
import App from "./App.vue";
import "./style.css";
import { getLoginState, logEvent, logout } from "./utils/cloudbase";
import { useAuthStore } from "./stores/auth";

// 扩展 Vue Router RouteMeta 类型，支持 RBAC 角色约束
declare module 'vue-router' {
  interface RouteMeta {
    /** 要求最低角色，不满足则重定向到首页 */
    requireRole?: 'admin' | 'superadmin'
  }
}

const DashboardPage = () => import("./pages/DashboardPage.vue");
const ResourcesPage = () => import("./pages/ResourcesPage.vue");
const CategoriesTagsPage = () => import("./pages/CategoriesTagsPage.vue");
const TopicsPage = () => import("./pages/TopicsPage.vue");
const AvatarFramesPage = () => import("./pages/AvatarFramesPage.vue");
const LogsPage = () => import("./pages/LogsPage.vue");
const AIConfigPage = () => import("./pages/AIConfigPage.vue");
const TopicLayoutDesigner = () => import("./pages/TopicLayoutDesigner.vue");
const HomeTabsPage = () => import("./pages/HomeTabsPage.vue");

const LoginPage = () => import("./pages/Login.vue");
const RegisterPage = () => import("./pages/Register.vue");
const ToolsIndexPage = () => import("./pages/ToolsIndexPage.vue");
const OperationsDashboardPage = () => import("./pages/OperationsDashboardPage.vue");
const QuotesPage = () => import("./pages/QuotesPage.vue");
const AdminsPage = () => import("./pages/AdminsPage.vue");
const NotificationsPage = () => import("./pages/NotificationsPage.vue");
const PageAdsManager = () => import("./pages/PageAdsManager.vue");
const ContactConfigPage = () => import("./pages/ContactConfigPage.vue");
const UserManagerPage = () => import("./pages/UserManagerPage.vue");
const MediaParsePage = () => import("./pages/MediaParsePage.vue");
const MediaTrendingPage = () => import("./pages/MediaTrendingPage.vue");
const MediaPlatformsPage = () => import("./pages/MediaPlatformsPage.vue");
const MediaCookiesPage = () => import("./pages/MediaCookiesPage.vue");
const MediaWhitelistPage = () => import("./pages/MediaWhitelistPage.vue");
const MediaPageConfigPage = () => import("./pages/MediaPageConfig.vue");
const MediaOpsPage = () => import("./pages/MediaOpsPage.vue");
const MediaAnnouncementPage = () => import("./pages/MediaAnnouncementPage.vue");
const DownloadManagerPage = () => import("./pages/DownloadManagerPage.vue");
const PointsConfigPage = () => import("./pages/PointsConfigPage.vue");
const ShareCodePage = () => import("./pages/ShareCodePage.vue");
const DailyPicksPage = () => import("./pages/DailyPicksPage.vue");
const StoreProductsPage = () => import("./pages/StoreProductsPage.vue");
const ToolsConfigPage = () => import("./pages/ToolsConfigPage.vue");
const GroupQrConfigPage = () => import("./pages/GroupQrConfigPage.vue");

const routes = [
  { path: "/", component: DashboardPage },
  { path: "/login", component: LoginPage },
  { path: "/register", component: RegisterPage },
  { path: "/resources", component: ResourcesPage },
  { path: "/categories-tags", component: CategoriesTagsPage },
  { path: "/home-tabs", component: HomeTabsPage },
  { path: "/topics", component: TopicsPage },
  { path: "/avatar-frames", component: AvatarFramesPage },
  { path: "/topic-layout/:id", component: TopicLayoutDesigner },
  { path: "/logs", component: LogsPage },
  { path: "/ai-config", component: AIConfigPage },
  { path: "/tools-index", component: ToolsIndexPage },
  { path: "/operations-dashboard", component: OperationsDashboardPage },
  { path: "/quotes", component: QuotesPage },
  { path: "/admins", component: AdminsPage, meta: { requireRole: 'superadmin' } },
  { path: "/notifications", component: NotificationsPage },
  { path: "/page-ads", component: PageAdsManager },
  { path: "/contact-config", component: ContactConfigPage },
  { path: "/user-manager", component: UserManagerPage },
  { path: "/media", component: MediaParsePage },
  { path: "/media-trending", component: MediaTrendingPage },
  { path: "/media-platforms", component: MediaPlatformsPage },
  { path: "/media-cookies", component: MediaCookiesPage },
  { path: "/media-whitelist", component: MediaWhitelistPage },
  { path: "/media-page-config", component: MediaPageConfigPage },
  { path: "/media-ops", component: MediaOpsPage },
  { path: "/media-announcement", component: MediaAnnouncementPage },
  { path: "/download-manager", component: DownloadManagerPage },
  { path: "/points-config", component: PointsConfigPage },
  { path: "/share-codes", component: ShareCodePage },
  { path: "/daily-picks", component: DailyPicksPage },
  { path: "/store-products", component: StoreProductsPage },
  { path: "/tools-config", component: ToolsConfigPage },
  { path: "/group-qr-config", component: GroupQrConfigPage },
  { path: "/media-parse", redirect: "/media" },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach(async (to) => {
  // 登录页面不需要检查
  if (to.path === "/login" || to.path === "/register") return true;

  const authStore = useAuthStore();

  try {
    const state = await getLoginState();
    const isAnonymous = Boolean(state?.user?.isAnonymous);

    if (!state || !state.user || isAnonymous) {
      if (isAnonymous) {
        await logout().catch(() => {});
      }
      authStore.clear();
      return { path: "/login", query: { redirect: to.fullPath } };
    }

    // 🔒 通过 Pinia auth store 验证管理员权限（内部调用 adminAuth.verifyToken 服务端校验）
    const profile = await authStore.fetchProfile();
    if (!profile) {
      console.warn("管理员校验失败：无管理员权限");
      await logout().catch(() => {});
      authStore.clear();
      return { path: "/login", query: { redirect: to.fullPath } };
    }

    // 🔒 RBAC 角色检查：如果路由要求 superadmin 且当前用户不是 superadmin，重定向到首页
    if (to.meta.requireRole === 'superadmin' && profile.role !== 'superadmin') {
      console.warn(`权限不足：需要 superadmin 角色，当前角色为 ${profile.role}`);
      return { path: '/' };
    }

    return true;
  } catch (err) {
    console.error("路由守卫错误:", err);
    authStore.clear();
    return { path: "/login", query: { redirect: to.fullPath } };
  }
});

router.afterEach((to) => {
  logEvent({ type: "pv", page: to.path });
});

const app = createApp(App);

// 全局错误处理
app.config.errorHandler = (err) => {
  console.error("Global error:", err);
  // 可选：上报到错误追踪服务
  // reportError({ error: err, info, timestamp: new Date() });
};

// 未捕获的 Promise 拒绝处理
app.config.warnHandler = (msg) => {
  console.warn("Vue warning:", msg);
};

app.use(createPinia());
app.use(router);
app.mount("#app");
