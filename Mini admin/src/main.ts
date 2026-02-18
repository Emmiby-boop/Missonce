import { createApp, defineAsyncComponent } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import App from "./App.vue";
import "./style.css";
import { getLoginState, requireAdmin, logEvent, logout } from "./utils/cloudbase";

const DashboardPage = defineAsyncComponent(() => import("./pages/DashboardPage.vue"));
const ResourcesPage = defineAsyncComponent(() => import("./pages/ResourcesPage.vue"));
const CategoriesPage = defineAsyncComponent(() => import("./pages/CategoriesPage.vue"));
const TagsPage = defineAsyncComponent(() => import("./pages/TagsPage.vue"));
const BannersPage = defineAsyncComponent(() => import("./pages/BannersPage.vue"));
const TopicsPage = defineAsyncComponent(() => import("./pages/TopicsPage.vue"));
const ErrorLogsPage = defineAsyncComponent(() => import("./pages/ErrorLogsPage.vue"));
const AIConfigPage = defineAsyncComponent(() => import("./pages/AIConfigPage.vue"));
const TopicLayoutDesigner = defineAsyncComponent(() => import("./pages/TopicLayoutDesigner.vue"));
const HomeLayoutPage = defineAsyncComponent(() => import("./pages/HomeLayoutPage.vue"));
const PageLayoutPage = defineAsyncComponent(() => import("./pages/PageLayoutPage.vue"));
const LoginPage = defineAsyncComponent(() => import("./pages/Login.vue"));
const RegisterPage = defineAsyncComponent(() => import("./pages/Register.vue"));
const ToolsIndexPage = defineAsyncComponent(() => import("./pages/ToolsIndexPage.vue"));
const OperationsDashboardPage = defineAsyncComponent(() => import("./pages/OperationsDashboardPage.vue"));

const routes = [
  { path: "/", component: DashboardPage },
  { path: "/login", component: LoginPage },
  { path: "/register", component: RegisterPage },
  { path: "/resources", component: ResourcesPage },
  { path: "/categories", component: CategoriesPage },
  { path: "/tags", component: TagsPage },
  { path: "/banners", component: BannersPage },
  { path: "/home-layout", component: HomeLayoutPage },
  { path: "/page-layout", component: PageLayoutPage },
  { path: "/topics", component: TopicsPage },
  { path: "/topic-layout/:id", component: TopicLayoutDesigner },
  { path: "/error-logs", component: ErrorLogsPage },
  { path: "/ai-config", component: AIConfigPage },
  { path: "/tools-index", component: ToolsIndexPage },
  { path: "/operations-dashboard", component: OperationsDashboardPage },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach(async (to) => {
  if (to.path === "/login") return true;

  const state = await getLoginState();
  const isAnonymous = Boolean((state?.user as any)?.isAnonymous);
  if (!state || !state.user || isAnonymous) {
    if (isAnonymous) {
      await logout().catch(() => {});
    }
    return { path: "/login", query: { redirect: to.fullPath } };
  }

  if (to.path !== "/") {
    try {
      await requireAdmin();
    } catch (err) {
      console.warn("管理员校验失败", err);
    }
  }
  return true;
});

router.afterEach((to) => {
  logEvent({ type: "pv", page: to.path });
});

const app = createApp(App);
app.use(router);
app.mount("#app");
