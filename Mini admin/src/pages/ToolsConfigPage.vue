<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="glass-panel">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="panel-title">工具箱管理</h2>
          <p class="panel-sub">配置小程序工具箱页面的工具入口 · 拖拽调整排序 · 支持内部页面/外部小程序/网页链接</p>
        </div>
        <div class="flex gap-2">
          <button v-if="tools.length === 0 && !loading" class="btn-soft" @click="initDefaultTools">
            初始化默认配置
          </button>
          <button class="btn-soft gap-2" @click="openCreateModal">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
            </svg>
            新增工具
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

    <!-- Tools List (拖拽排序) -->
    <draggable
      v-else-if="tools.length > 0"
      v-model="tools"
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

            <!-- 图标预览 -->
            <div
              class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-white"
              :style="iconBgStyle(item.color)"
            >
              <span class="text-xs font-bold">{{ item.title?.charAt(0) || '?' }}</span>
            </div>

            <!-- 尺寸标识 -->
            <div
              class="px-2 py-1 rounded-md text-xs font-medium shrink-0"
              :style="item.size === 'square'
                ? { background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }
                : { background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }"
            >
              {{ item.size === 'square' ? '方形' : '宽形' }}
            </div>

            <!-- 标题 + 配置摘要 -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="font-bold text-base text-[var(--text-main)] truncate">{{ item.title }}</h3>
              </div>
              <div class="flex flex-wrap gap-2 mt-1 text-xs text-[var(--text-sub)]">
                <span class="bg-[var(--bg-body)] px-2 py-0.5 rounded">{{ item.desc || '无描述' }}</span>
                <span class="bg-[var(--bg-body)] px-2 py-0.5 rounded">{{ linkTypeLabel(item.linkType) }}</span>
                <span class="bg-[var(--bg-body)] px-2 py-0.5 rounded font-mono truncate max-w-[200px]">{{ item.linkUrl || item.appId || '-' }}</span>
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

              <!-- 删除 -->
              <button
                class="p-2 text-[var(--text-sub)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                @click.stop="deleteTool(item)"
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
      <p class="text-[var(--text-sub)] font-medium text-lg">暂无工具配置</p>
      <p class="text-[var(--text-sub)] text-sm mt-1">初始化默认配置或手动新增工具</p>
    </div>

    <!-- 拖拽提示 -->
    <div v-if="!loading && tools.length > 0" class="flex items-center gap-2 text-xs text-[var(--text-sub)] bg-[var(--bg-card)] rounded-lg px-4 py-2.5 border border-[var(--border-color)]/50">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>拖拽卡片调整工具顺序 · 方形卡片占 1 格，宽形卡片占 2 格 · 保存后小程序即时生效</span>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--text-main)]/60 backdrop-blur-sm" @click="closeModal">
      <div class="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-[var(--border-color)]" @click.stop>
        <div class="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between sticky top-0 bg-[var(--bg-card)] z-10">
          <h3 class="text-lg font-bold text-[var(--text-main)]">{{ editingId ? '编辑工具' : '新增工具' }}</h3>
          <button class="text-[var(--text-sub)] hover:text-[var(--text-main)] p-1 rounded-lg hover:bg-[var(--bg-body)] transition-colors" @click="closeModal">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>

        <div class="p-6 space-y-5">
          <!-- 工具名称 -->
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-[var(--text-main)]">工具名称</label>
            <input v-model="form.title" class="input w-full" placeholder="例如：头像DIY" />
          </div>

          <!-- 描述 -->
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-[var(--text-main)]">描述</label>
            <input v-model="form.desc" class="input w-full" placeholder="例如：边框/滤镜/文字" />
          </div>

          <!-- 图标选择 -->
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-[var(--text-main)]">图标</label>
            <select v-model="form.icon" class="input w-full">
              <option v-for="opt in iconOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <p class="text-xs text-[var(--text-sub)]">选择预设图标，或不选则显示工具名首字</p>
          </div>

          <!-- 跳转类型 -->
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-[var(--text-main)]">跳转类型</label>
            <select v-model="form.linkType" class="input w-full">
              <option value="page">内部页面</option>
              <option value="miniProgram">外部小程序</option>
              <option value="webview">网页链接</option>
            </select>
            <p class="text-xs text-[var(--text-sub)]">
              <span v-if="form.linkType === 'page'">跳转到小程序内指定页面（如 /subpackages/avatar-diy/avatar-diy）</span>
              <span v-else-if="form.linkType === 'miniProgram'">跳转到另一个小程序（需填写 AppID）</span>
              <span v-else>通过 webview 打开外部 H5 网页（需 https:// 开头）</span>
            </p>
          </div>

          <!-- 跳转路径 -->
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-[var(--text-main)]">
              {{ form.linkType === 'miniProgram' ? '目标小程序 AppID' : '跳转路径/URL' }}
            </label>
            <input
              v-model="form.linkUrl"
              class="input w-full"
              :placeholder="form.linkType === 'miniProgram' ? '例如：wxbd304fe2186156e4' : form.linkType === 'webview' ? 'https://example.com' : '/subpackages/xxx/xxx'"
            />
          </div>

          <!-- 小程序路径（仅 miniProgram 类型） -->
          <div v-if="form.linkType === 'miniProgram'" class="space-y-1.5">
            <label class="text-sm font-medium text-[var(--text-main)]">小程序内路径（选填）</label>
            <input v-model="form.miniProgramPath" class="input w-full" placeholder="留空跳目标小程序首页" />
          </div>

          <!-- 卡片尺寸 -->
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-[var(--text-main)]">卡片尺寸</label>
            <select v-model="form.size" class="input w-full">
              <option value="square">方形（占 1 格）</option>
              <option value="wide">宽形（占 2 格，整行）</option>
            </select>
          </div>

          <!-- 图标颜色 -->
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-[var(--text-main)]">图标背景色</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="c in colorOptions"
                :key="c.value"
                class="w-10 h-10 rounded-lg border-2 transition-all"
                :style="{ background: c.bg, borderColor: form.color === c.value ? 'var(--primary)' : 'transparent' }"
                @click="form.color = c.value"
                :title="c.label"
              ></button>
            </div>
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
            <span class="text-sm text-[var(--text-sub)]">{{ form.visible ? '显示在工具箱' : '已隐藏' }}</span>
          </div>
        </div>

        <div class="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-body)] flex justify-end gap-3 rounded-b-2xl">
          <button class="px-4 py-2 text-sm font-medium text-[var(--text-sub)] hover:bg-[var(--bg-card)] rounded-lg transition-colors" @click="closeModal">取消</button>
          <button class="btn-soft px-6" @click="saveTool" :disabled="!canSave || saving">
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
import { useMessage } from 'naive-ui'
import { confirmDialog, confirmDeleteDialog } from '../composables/useDialog'

const message = useMessage()

const tools = ref<any[]>([]);
const loading = ref(false);
const showModal = ref(false);
const saving = ref(false);
const editingId = ref("");

const colorOptions = [
  { value: 'primary', label: '绿色', bg: 'linear-gradient(135deg, #22c55e, #16a34a)' },
  { value: 'secondary', label: '粉色', bg: 'linear-gradient(135deg, #f093fb, #f5576c)' },
  { value: 'tertiary', label: '黄色', bg: 'linear-gradient(135deg, rgba(251, 191, 36, 0.3), rgba(251, 191, 36, 0.1))' },
  { value: 'quaternary', label: '紫色', bg: 'linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(168, 85, 247, 0.1))' },
  { value: 'store', label: '玫红', bg: 'linear-gradient(135deg, rgba(236, 72, 153, 0.3), rgba(236, 72, 153, 0.1))' },
];

// 🔥 预设图标列表（与小程序 PRESET_ICONS 保持一致，路径相对于小程序根目录）
const iconOptions = [
  { label: '不使用图标（显示首字）', value: '' },
  { label: 'DIY', value: '/images/tool-diy.svg' },
  { label: '去水印', value: '/images/tool-watermark.svg' },
  { label: '头像框', value: '/images/tool-frame.svg' },
  { label: '滤镜', value: '/images/tool-color.svg' },
  { label: '裁剪', value: '/images/tool-crop.svg' },
  { label: '灵感', value: '/images/quick-inspiration.svg' },
  { label: '每日', value: '/images/quick-daily.svg' },
  { label: '小店', value: '/images/quick-store.svg' },
  { label: '钻石/积分', value: '/images/icon-diamond.svg' },
  { label: '相机', value: '/images/icon-camera.svg' },
  { label: '热门', value: '/images/icon-hot.svg' },
  { label: '通知', value: '/images/icon-bell.svg' },
];

const form = reactive({
  title: "",
  desc: "",
  icon: "",
  linkType: "page" as "page" | "miniProgram" | "webview",
  linkUrl: "",
  miniProgramPath: "",
  size: "square" as "square" | "wide",
  color: "primary",
  visible: true,
});

const canSave = computed(() => {
  if (!form.title) return false;
  if (!form.linkUrl) return false;
  return true;
});

onMounted(() => {
  loadTools();
});

const loadTools = async () => {
  loading.value = true;
  try {
    const res = await callCloudFunction("getConfig", { key: 'toolsConfig' });
    const data = res?.data?.value;
    if (data && Array.isArray(data.tools)) {
      tools.value = data.tools;
    }
  } catch (err) {
    console.error("加载工具配置失败", err);
    message.error("加载失败，请刷新重试");
  } finally {
    loading.value = false;
  }
};

const linkTypeLabel = (type: string) => {
  const map: Record<string, string> = { page: "内部页面", miniProgram: "外部小程序", webview: "网页" };
  return map[type] || "内部页面";
};

const iconBgStyle = (color: string) => {
  const found = colorOptions.find(c => c.value === color);
  return found ? { background: found.bg } : { background: colorOptions[0].bg };
};

const onDragEnd = async () => {
  // 拖拽后立即保存排序
  try {
    const sortedTools = tools.value.map((item, index) => ({ ...item, sort: index }));
    tools.value = sortedTools;
    await callCloudFunction("manageConfig", {
      action: "set",
      key: "toolsConfig",
      value: { tools: sortedTools },
      description: "工具箱配置"
    });
    message.success("排序已更新");
  } catch {
    message.error("排序保存失败，请重试");
    loadTools();
  }
};

const toggleVisible = async (item: any) => {
  const original = item.visible;
  item.visible = !item.visible;
  try {
    await callCloudFunction("manageConfig", {
      action: "set",
      key: "toolsConfig",
      value: { tools: tools.value },
      description: "工具箱配置"
    });
  } catch {
    item.visible = original;
    message.error("操作失败");
  }
};

const openCreateModal = () => {
  editingId.value = "";
  form.title = "";
  form.desc = "";
  form.icon = "";
  form.linkType = "page";
  form.linkUrl = "";
  form.miniProgramPath = "";
  form.size = "square";
  form.color = "primary";
  form.visible = true;
  showModal.value = true;
};

const openEditModal = (item: any) => {
  editingId.value = item.id;
  form.title = item.title;
  form.desc = item.desc || "";
  form.icon = item.icon || "";
  form.linkType = item.linkType || "page";
  form.linkUrl = item.linkUrl || "";
  form.miniProgramPath = item.miniProgramPath || "";
  form.size = item.size || "square";
  form.color = item.color || "primary";
  form.visible = item.visible !== false;
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  editingId.value = "";
};

const saveTool = async () => {
  if (!canSave.value || saving.value) return;
  saving.value = true;
  try {
    if (editingId.value) {
      // 编辑
      const idx = tools.value.findIndex(t => t.id === editingId.value);
      if (idx >= 0) {
        tools.value[idx] = {
          ...tools.value[idx],
          title: form.title,
          desc: form.desc,
          icon: form.icon,
          linkType: form.linkType,
          linkUrl: form.linkUrl,
          miniProgramPath: form.miniProgramPath,
          size: form.size,
          color: form.color,
          visible: form.visible
        };
      }
    } else {
      // 新增
      tools.value.push({
        id: 'tool_' + Date.now(),
        title: form.title,
        desc: form.desc,
        icon: form.icon,
        linkType: form.linkType,
        linkUrl: form.linkUrl,
        miniProgramPath: form.miniProgramPath,
        size: form.size,
        color: form.color,
        visible: form.visible,
        sort: tools.value.length
      });
    }

    await callCloudFunction("manageConfig", {
      action: "set",
      key: "toolsConfig",
      value: { tools: tools.value },
      description: "工具箱配置"
    });

    message.success(editingId.value ? "保存成功" : "创建成功");
    closeModal();
    loadTools();
  } catch (err) {
    console.error("保存失败", err);
    message.error("保存失败，请重试");
  } finally {
    saving.value = false;
  }
};

const deleteTool = async (item: any) => {
  const confirmed = await confirmDeleteDialog(`确定删除「${item.title}」工具吗？`)
  if (!confirmed) return
  try {
    tools.value = tools.value.filter(t => t.id !== item.id);
    await callCloudFunction("manageConfig", {
      action: "set",
      key: "toolsConfig",
      value: { tools: tools.value },
      description: "工具箱配置"
    });
    message.success("已删除");
  } catch {
    message.error("删除失败");
    loadTools();
  }
};

const initDefaultTools = async () => {
  const confirmed = await confirmDialog("初始化默认配置？将创建头像DIY、去水印、灵感文案、积分中心 4 个默认工具。")
  if (!confirmed) return
  const defaultTools = [
    { id: 'tool_avatar_diy', title: '头像DIY', desc: '边框/滤镜/文字', icon: '/images/tool-diy.svg', linkType: 'page', linkUrl: '/subpackages/avatar-diy/avatar-diy', size: 'square', color: 'primary', visible: true, sort: 0 },
    { id: 'tool_watermark', title: '去水印', desc: '视频/图片一键去除', icon: '/images/tool-watermark.svg', linkType: 'miniProgram', linkUrl: 'wxbd304fe2186156e4', miniProgramPath: '', size: 'square', color: 'secondary', visible: true, sort: 1 },
    { id: 'tool_inspiration', title: '灵感文案', desc: '激发创作火花', icon: '/images/quick-inspiration.svg', linkType: 'page', linkUrl: '/subpackages/inspiration-writer/inspiration-writer', size: 'wide', color: 'tertiary', visible: true, sort: 2 },
    { id: 'tool_points', title: '积分中心', desc: '查看积分·兑换好物', icon: '/images/icon-diamond.svg', linkType: 'page', linkUrl: '/subpackages/points/points', size: 'wide', color: 'quaternary', visible: true, sort: 3 }
  ];
  try {
    await callCloudFunction("manageConfig", {
      action: "set",
      key: "toolsConfig",
      value: { tools: defaultTools },
      description: "工具箱配置"
    });
    message.success("初始化成功");
    loadTools();
  } catch {
    message.error("初始化失败");
  }
};
</script>
