import { createApp, defineAsyncComponent } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import App from "./App.vue";
import "./style.css";
import { getLoginState, requireAdmin, logEvent, logout } from "./utils/cloudbase";

const DashboardPage = defineAsyncComponent(() => import("./pages/DashboardPage.vue"));
const ResourcesPage = defineAsyncComponent(() => import("./pages/ResourcesPage.vue"));
const CategoriesTagsPage = defineAsyncComponent(() => import("./pages/CategoriesTagsPage.vue"));
const BannersPage = defineAsyncComponent(() => import("./pages/BannersPage.vue"));
const TopicsPage = defineAsyncComponent(() => import("./pages/TopicsPage.vue"));
const LogsPage = defineAsyncComponent(() => import("./pages/LogsPage.vue"));
const AIConfigPage = defineAsyncComponent(() => import("./pages/AIConfigPage.vue"));
const TopicLayoutDesigner = defineAsyncComponent(() => import("./pages/TopicLayoutDesigner.vue"));
const HomeLayoutPage = defineAsyncComponent(() => import("./pages/HomeLayoutPage.vue"));

const LoginPage = defineAsyncComponent(() => import("./pages/Login.vue"));
const RegisterPage = defineAsyncComponent(() => import("./pages/Register.vue"));
const ToolsIndexPage = defineAsyncComponent(() => import("./pages/ToolsIndexPage.vue"));
const OperationsDashboardPage = defineAsyncComponent(() => import("./pages/OperationsDashboardPage.vue"));
const QuotesPage = defineAsyncComponent(() => import("./pages/QuotesPage.vue"));
const AdminsPage = defineAsyncComponent(() => import("./pages/AdminsPage.vue"));
const NotificationsPage = defineAsyncComponent(() => import("./pages/NotificationsPage.vue"));
const PageAdsManager = defineAsyncComponent(() => import("./pages/PageAdsManager.vue"));
const ContactConfigPage = defineAsyncComponent(() => import("./pages/ContactConfigPage.vue"));
const UserManagerPage = defineAsyncComponent(() => import("./pages/UserManagerPage.vue"));
const MediaParsePage = defineAsyncComponent(() => import("./pages/MediaParsePage.vue"));

const routes = [
  { path: "/", component: DashboardPage },
  { path: "/login", component: LoginPage },
  { path: "/register", component: RegisterPage },
  { path: "/resources", component: ResourcesPage },
  { path: "/categories-tags", component: CategoriesTagsPage },
  { path: "/banners", component: BannersPage },
  { path: "/home-layout", component: HomeLayoutPage },
  { path: "/topics", component: TopicsPage },
  { path: "/topic-layout/:id", component: TopicLayoutDesigner },
  { path: "/logs", component: LogsPage },
  { path: "/ai-config", component: AIConfigPage },
  { path: "/tools-index", component: ToolsIndexPage },
  { path: "/operations-dashboard", component: OperationsDashboardPage },
  { path: "/quotes", component: QuotesPage },
  { path: "/admins", component: AdminsPage },
  { path: "/notifications", component: NotificationsPage },
  { path: "/page-ads", component: PageAdsManager },
  { path: "/contact-config", component: ContactConfigPage },
  { path: "/user-manager", component: UserManagerPage },
  { path: "/media-parse", component: MediaParsePage },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach(async (to) => {
  // 登录页面不需要检查
  if (to.path === "/login" || to.path === "/register") return true;

  try {
    const state = await getLoginState();
    const isAnonymous = Boolean((state?.user as any)?.isAnonymous);
    
    if (!state || !state.user || isAnonymous) {
      if (isAnonymous) {
        await logout().catch(() => {});
      }
      return { path: "/login", query: { redirect: to.fullPath } };
    }

    // 非首页需要验证管理员权限
    if (to.path !== "/") {
      try {
        await requireAdmin();
      } catch (err) {
        console.warn("管理员校验失败", err);
        // 权限不足时重定向到首页
        return { path: "/" };
      }
    }
    
    return true;
  } catch (err) {
    console.error("路由守卫错误:", err);
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

app.use(router);
app.mount("#app");
