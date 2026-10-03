<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="glass-panel">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="panel-title">首页 Tab 管理</h2>
          <p class="panel-sub">配置小程序首页顶部标签栏 · 拖拽调整排序 · 点击齿轮编辑内容来源</p>
        </div>
        <div class="flex gap-2">
          <button v-if="tabs.length === 0 && !loading" class="btn-soft" @click="initDefaultTabs">
            初始化默认配置
          </button>
          <button class="btn-soft gap-2" @click="openCreateModal">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
            </svg>
            新增标签 Tab
          </button>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 animate-pulse">
        <div class="h-5 bg-[var(--border-color)] rounded w-1/3 mb-3"></div>
        <div class="h-4 bg-[var(--border-color)] rounded w-1/2"></div>
      </div>
    </div>

    <!-- Tabs List (拖拽排序) -->
    <draggable
      v-else-if="tabs.length > 0"
      v-model="tabs"
      item-key="id"
      :animation="200"
      ghost-class="opacity-50"
      drag-class="!cursor-grabbing"
      class="space-y-3"
      @end="onDragEnd"
    >
      <template #item="{ element: item, index }">
        <div
          class="group bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] p-4 hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
          :class="{ 'opacity-50': !item.visible }"
        >
          <div class="flex items-center gap-4">
            <!-- 排序序号 -->
            <div class="w-8 h-8 rounded-lg bg-[var(--bg-body)] flex items-center justify-center text-sm font-bold text-[var(--text-sub)] shrink-0">
              {{ index + 1 }}
            </div>

            <!-- 类型标识 -->
            <div
              class="px-2 py-1 rounded-md text-xs font-medium shrink-0"
              :style="item.type === 'fixed'
                ? { background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }
                : { background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }"
            >
              {{ item.type === 'fixed' ? '固定' : '标签' }}
            </div>

            <!-- 标题 + 配置摘要 -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="font-bold text-base text-[var(--text-main)] truncate">{{ item.title }}</h3>
                <span v-if="item.type === 'fixed'" class="text-xs text-[var(--text-sub)]">({{ item.fixedId === 'recommend' ? '热门' : '最新' }})</span>
              </div>
              <div class="flex flex-wrap gap-2 mt-1 text-xs text-[var(--text-sub)]">
                <span v-if="item.type === 'tag'" class="bg-[var(--bg-body)] px-2 py-0.5 rounded">标签: {{ item.tag || '未设置' }}</span>
                <span class="bg-[var(--bg-body)] px-2 py-0.5 rounded">类型: {{ resourceTypeLabel(item.resourceType) }}</span>
                <span class="bg-[var(--bg-body)] px-2 py-0.5 rounded">排序: {{ sortByLabel(item.sortBy) }}</span>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="flex items-center gap-2 shrink-0">
              <!-- 显示/隐藏切换 -->
              <button
                class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                :style="item.visible
                  ? { background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }
                  : { background: 'rgba(100, 116, 139, 0.1)', color: '#64748b' }"
                @click.stop="toggleVisible(item)"
              >
                {{ item.visible ? '显示中' : '已隐藏' }}
              </button>

              <!-- 编辑 -->
              <button class="p-2 text-[var(--text-sub)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-colors" @click.stop="openEditModal(item)" title="编辑">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                </svg>
              </button>

              <!-- 删除（仅标签类型） -->
              <button
                v-if="item.type === 'tag'"
                class="p-2 text-[var(--text-sub)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                @click.stop="deleteTab(item)"
                title="删除"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 000-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </template>
    </draggable>

    <!-- Empty State -->
    <div v-else class="flex flex-col items-center justify-center py-20 bg-[var(--bg-card)] rounded-2xl border-2 border-dashed border-[var(--border-color)]">
      <p class="text-[var(--text-sub)] font-medium text-lg">暂无 Tab 配置</p>
      <p class="text-[var(--text-sub)] text-sm mt-1">初始化默认配置或手动新增标签 Tab</p>
    </div>

    <!-- 拖拽提示 -->
    <div v-if="!loading && tabs.length > 0" class="flex items-center gap-2 text-xs text-[var(--text-sub)] bg-[var(--bg-card)] rounded-lg px-4 py-2.5 border border-[var(--border-color)]/50">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>拖拽卡片调整 Tab 顺序 · 固定 Tab（推荐/最新）不可删除但可隐藏和调整顺序 · 编辑齿轮可配置内容来源</span>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--text-main)]/60 backdrop-blur-sm" @click="closeModal">
      <div class="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-[var(--border-color)]" @click.stop>
        <div class="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between sticky top-0 bg-[var(--bg-card)] z-10">
          <h3 class="text-lg font-bold text-[var(--text-main)]">{{ editingId ? '编辑 Tab' : '新增标签 Tab' }}</h3>
          <button class="text-[var(--text-sub)] hover:text-[var(--text-main)] p-1 rounded-lg hover:bg-[var(--bg-body)] transition-colors" @click="closeModal">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>

        <div class="p-6 space-y-5">
          <!-- 标题 -->
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-[var(--text-main)]">Tab 名称</label>
            <input v-model="form.title" class="input w-full" placeholder="例如：少女感" />
          </div>

          <!-- 标签选择（仅标签类型） -->
          <div v-if="form.type === 'tag'" class="space-y-1.5">
            <label class="text-sm font-medium text-[var(--text-main)]">筛选标签</label>
            <select v-model="form.tag" class="select w-full">
              <option value="">请选择标签</option>
              <option v-for="tag in availableTags" :key="tag" :value="tag">{{ tag }}</option>
            </select>
            <p class="text-xs text-[var(--text-sub)]">标签来自资源库中实际使用的标签（实时聚合）</p>
          </div>

          <!-- 资源类型 -->
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-[var(--text-main)]">资源类型</label>
            <select v-model="form.resourceType" class="select w-full">
              <option value="all">全部</option>
              <option value="avatar">仅头像</option>
              <option value="wallpaper">仅壁纸</option>
            </select>
          </div>

          <!-- 排序方式 -->
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-[var(--text-main)]">内容排序</label>
            <select v-model="form.sortBy" class="input w-full">
              <option value="hot">热门优先</option>
              <option value="latest">最新优先</option>
              <option value="hotRandom">热门随机（推荐）</option>
              <option value="latestRandom">最新随机</option>
              <option value="random">完全随机</option>
            </select>
            <p class="text-xs text-[var(--text-sub)]">
              <span v-if="form.sortBy === 'hotRandom' || form.sortBy === 'latestRandom'" class="text-[var(--primary)]">
                混合排序：从热门/最新 Top 50 中随机抽取，既保证质量又有新鲜感，每次进入内容都不同
              </span>
              <span v-else-if="form.sortBy === 'random'">
                完全随机：每次从全部资源中随机抽取，内容差异最大但质量参差
              </span>
              <span v-else>
                固定排序：按热度/时间倒序，同一时刻所有用户看到的内容一致
              </span>
            </p>
          </div>

          <!-- 显示/隐藏 -->
          <div class="flex items-center gap-2 bg-[var(--bg-body)] rounded-lg px-3 py-2.5 border border-[var(--border-color)]">
            <button
              class="w-9 h-5 rounded-full relative transition-all shrink-0"
              :style="form.visible ? { background: 'var(--primary)' } : { background: '#d1d5db' }"
              @click="form.visible = !form.visible"
            >
              <span class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm" :style="{ transform: form.visible ? 'translateX(16px)' : '' }"></span>
            </button>
            <span class="text-sm text-[var(--text-sub)]">{{ form.visible ? '显示在首页' : '已隐藏' }}</span>
          </div>
        </div>

        <div class="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-body)] flex justify-end gap-3 rounded-b-2xl">
          <button class="px-4 py-2 text-sm font-medium text-[var(--text-sub)] hover:bg-[var(--bg-card)] rounded-lg transition-colors" @click="closeModal">取消</button>
          <button class="btn-soft px-6" @click="saveTab" :disabled="!canSave || saving">
            <svg v-if="saving" class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import draggable from "vuedraggable";
import { callCloudFunction } from "../utils/cloudbase";
import { useMessage, useDialog } from 'naive-ui'

const message = useMessage()
const dialog = useDialog()

const tabs = ref<any[]>([]);
const loading = ref(false);
const showModal = ref(false);
const saving = ref(false);
const editingId = ref("");
const availableTags = ref<string[]>([]);

const form = reactive({
  title: "",
  type: "tag" as "fixed" | "tag",
  fixedId: "" as string,
  tag: "" as string,
  resourceType: "all" as string,
  sortBy: "hot" as string,
  visible: true,
});

const canSave = computed(() => {
  if (!form.title) return false;
  if (form.type === "tag" && !form.tag) return false;
  return true;
});

/**
 * Tab 主键取值：getHomeTabs 云函数返回的是 `id`（不是 `_id`）。
 * 统一兼容两种，避免写操作时拿到 undefined —— 那会导致保存静默走「新增」分支，
 * 表现为「排序保存不生效」，并额外插入重复 Tab。
 */
const tabId = (item: any): string => item?._id || item?.id || "";

onMounted(() => {
  loadTabs();
  loadAvailableTags();
});

const loadTabs = async () => {
  loading.value = true;
  try {
    const res = await callCloudFunction("getHomeTabs", {});
    tabs.value = res.data || [];
  } catch (err) {
    console.error("加载 Tab 配置失败", err);
    message.error("加载失败，请刷新重试");
  } finally {
    loading.value = false;
  }
};

const loadAvailableTags = async () => {
  try {
    const res = await callCloudFunction("getCategories", { type: "all", source: "tags" });
    const data = res.data || [];
    availableTags.value = data.map((t: any) => t.name).filter(Boolean);
  } catch (err) {
    console.error("加载标签列表失败", err);
  }
};

const resourceTypeLabel = (type: string) => {
  const map: Record<string, string> = { all: "全部", avatar: "头像", wallpaper: "壁纸" };
  return map[type] || "全部";
};

const sortByLabel = (sort: string) => {
  const map: Record<string, string> = {
    hot: "热门",
    latest: "最新",
    hotRandom: "热门随机",
    latestRandom: "最新随机",
    random: "完全随机"
  };
  return map[sort] || "热门";
};

const onDragEnd = async () => {
  try {
    const tabsData = tabs.value.map((item, index) => ({ id: tabId(item), sort: index }));
    await callCloudFunction("manageHomeTabs", { action: "sort", data: { tabs: tabsData } });
    message.success("排序已更新");
  } catch {
    message.error("排序保存失败，请重试");
    loadTabs();
  }
};

const toggleVisible = async (item: any) => {
  try {
    const res = await callCloudFunction("manageHomeTabs", { action: "toggleVisible", id: tabId(item) });
    item.visible = res.data.visible;
  } catch {
    message.error("操作失败");
  }
};

const openCreateModal = () => {
  editingId.value = "";
  form.title = "";
  form.type = "tag";
  form.fixedId = "";
  form.tag = "";
  form.resourceType = "all";
  form.sortBy = "hot";
  form.visible = true;
  showModal.value = true;
};

const openEditModal = (item: any) => {
  const id = tabId(item);
  // 内置默认 Tab 没有主键，直接拦下，避免保存时静默降级成「新增」
  if (!id) {
    message.error("该 Tab 缺少标识，无法编辑");
    return;
  }
  editingId.value = id;
  form.title = item.title;
  form.type = item.type;
  form.fixedId = item.fixedId || "";
  form.tag = item.tag || "";
  form.resourceType = item.resourceType || "all";
  // 🔥 读取实际配置的 sortBy（固定 Tab 也允许自定义排序方式）
  form.sortBy = item.sortBy || (item.fixedId === "recommend" ? "hot" : "latest");
  form.visible = item.visible !== false;
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  editingId.value = "";
};

const saveTab = async () => {
  if (!canSave.value || saving.value) return;
  saving.value = true;
  try {
    // 🔥 解除固定 Tab 排序限制：推荐/最新 Tab 也可自定义排序方式（含混合排序）
    const finalSortBy = form.sortBy || "hot";

    if (editingId.value) {
      // 编辑
      await callCloudFunction("manageHomeTabs", {
        action: "update",
        id: editingId.value,
        data: {
          title: form.title,
          tag: form.tag,
          resourceType: form.resourceType,
          sortBy: finalSortBy,
          visible: form.visible,
        },
      });
      message.success("保存成功");
    } else {
      // 新增
      await callCloudFunction("manageHomeTabs", {
        action: "add",
        data: {
          type: "tag",
          title: form.title,
          tag: form.tag,
          resourceType: form.resourceType,
          sortBy: finalSortBy,
          visible: form.visible,
          sort: tabs.value.length,
        },
      });
      message.success("创建成功");
    }
    closeModal();
    loadTabs();
  } catch (err) {
    console.error("保存失败", err);
    message.error("保存失败，请重试");
  } finally {
    saving.value = false;
  }
};

const deleteTab = async (item: any) => {
  const confirmed = await dialog.warning({
    title: '提示',
    content: `确定删除「${item.title}」Tab 吗？`,
    positiveText: '确定',
    negativeText: '取消',
  })
  if (!confirmed) return
  try {
    await callCloudFunction("manageHomeTabs", { action: "delete", id: tabId(item) });
    message.success("已删除");
    loadTabs();
  } catch {
    message.error("删除失败");
  }
};

const initDefaultTabs = async () => {
  const confirmed = await dialog.warning({
    title: '提示',
    content: "初始化默认配置？将创建「推荐」和「最新」两个固定 Tab。",
    positiveText: '确定',
    negativeText: '取消',
  })
  if (!confirmed) return
  try {
    const res = await callCloudFunction("manageHomeTabs", { action: "initDefault" });
    // 修复：callCloudFunction 已返回 res.result，应直接访问 res?.success
    if (res && res.success) {
      message.success("初始化成功");
    } else {
      message.error(res?.message || "初始化失败");
    }
    loadTabs();
  } catch {
    message.error("初始化失败");
  }
};
</script>
