<template>
  <div class="space-y-6">
    <section class="glass-panel">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="panel-title">公告管理</h2>
          <p class="panel-sub">管理小程序公告和消息推送</p>
        </div>
        <div class="flex gap-2">
          <button v-if="selectedNotifications.length > 0" class="btn-soft bg-red-500/10 text-red-500 border border-red-200 hover:bg-red-500/20" @click="batchDelete">
            批量删除 ({{ selectedNotifications.length }})
          </button>
          <button v-if="selectedNotifications.length > 0" class="btn-soft" @click="batchToggleStatus">
            批量{{ hasActiveSelected ? '停用' : '启用' }}
          </button>
          <button class="btn-soft" @click="openModal()">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
            </svg>
            新增公告
          </button>
        </div>
      </div>
    </section>

    <div v-if="loading" class="space-y-4">
      <div v-for="i in 4" :key="i" class="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6 animate-pulse">
        <div class="h-6 bg-[var(--border-color)] rounded w-1/3 mb-4"></div>
        <div class="h-4 bg-[var(--border-color)] rounded w-2/3 mb-2"></div>
        <div class="h-4 bg-[var(--border-color)] rounded w-1/2"></div>
      </div>
    </div>

    <AnimatedList
      v-else-if="notifications.length > 0"
      :items="notifications"
      :show-gradients="false"
      :get-key="(item) => item._id || item.id"
      class="space-y-4 max-h-[calc(100vh-300px)]"
    >
      <template #item="{ item }">
        <div
          class="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6 hover:shadow-md transition-all duration-300"
          :class="{'ring-2 ring-[var(--primary)]': selectedNotifications.includes(item._id || item.id)}"
        >
        <div class="flex items-start gap-4">
          <div class="flex items-center pt-1">
            <input
              type="checkbox"
              :value="item._id || item.id"
              v-model="selectedNotifications"
              class="w-5 h-5 rounded border-[var(--border-color)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
            />
          </div>
          
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3 mb-2 flex-wrap">
              <span class="text-2xl">{{ getPriorityIcon(item.priority) }}</span>
              <h3 class="font-bold text-lg truncate flex-1">{{ item.title }}</h3>
              <span
                class="px-2.5 py-1 rounded-full text-xs font-medium"
                :class="item.status === 'active'
                  ? 'bg-green-500/10 text-green-600 border border-green-200'
                  : 'bg-slate-500/10 text-slate-500 border border-slate-200'"
              >
                {{ item.status === 'active' ? '已启用' : '已停用' }}
              </span>
              <span class="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 border border-blue-200">
                {{ getTypeText(item.type) }}
              </span>
              <span v-if="item.showPopup" class="px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-600 border border-orange-200">
                弹窗显示
              </span>
              <span v-if="item.contentHtml" class="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-600 border border-purple-200">
                富文本
              </span>
            </div>

            <div class="flex gap-3 mb-3">
              <div v-if="item.coverImage" class="w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-gray-700">
                <img :src="getCoverUrl(item)" class="w-full h-full object-cover" />
              </div>
              <p class="text-[var(--text-sub)] line-clamp-2 flex-1">{{ item.summary || item.content }}</p>
            </div>

            <div class="flex items-center gap-4 text-sm text-[var(--text-sub)] flex-wrap">
              <span>排序: {{ item.sort }}</span>
              <span v-if="item.validFrom">生效: {{ formatDate(item.validFrom) }}</span>
              <span v-if="item.validTo">到期: {{ formatDate(item.validTo) }}</span>
              <span>创建: {{ formatDate(item.createdAt) }}</span>
            </div>
          </div>
          
          <div class="flex items-center gap-1">
            <button 
              class="p-2 text-[var(--text-sub)] hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
              @click="editNotification(item)" 
              title="编辑"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
            <button 
              class="p-2 text-[var(--text-sub)] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
              @click="removeNotification(item._id || item.id)" 
              title="删除"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 000-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
        </div>
      </template>
    </AnimatedList>

    <div v-else class="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 border-dashed">
      <div class="w-16 h-16 bg-slate-50 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-slate-300 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </div>
      <p class="text-slate-500 dark:text-slate-400 font-medium">暂无公告</p>
      <button class="btn-ghost btn-sm mt-2 text-[var(--primary)]" @click="openModal()">立即添加</button>
    </div>

    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity" @click="closeModal">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" @click.stop>
        <div class="px-6 py-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h3 class="text-lg font-bold text-slate-800 dark:text-white">{{ editingId ? '编辑公告' : '新增公告' }}</h3>
          <button class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" @click="closeModal">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div class="p-6 space-y-5">
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-slate-700 dark:text-slate-300">公告标题</label>
            <input v-model="form.title" class="input w-full" placeholder="输入公告标题" />
          </div>

          <!-- 封面图上传 -->
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-slate-700 dark:text-slate-300">封面图 <span class="text-xs text-slate-400">（可选，列表展示用）</span></label>
            <div class="flex items-center gap-3">
              <div v-if="coverImagePreview" class="relative w-32 h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-gray-600">
                <img :src="coverImagePreview" class="w-full h-full object-cover" />
                <button class="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/80" @click="removeCoverImage">×</button>
              </div>
              <label v-else class="w-32 h-20 rounded-lg border-2 border-dashed border-slate-300 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:border-[var(--primary)] transition-colors">
                <span class="text-xs text-slate-400">点击上传</span>
                <input type="file" accept="image/*" class="hidden" @change="handleCoverUpload" />
              </label>
              <span v-if="uploadingCover" class="text-xs text-slate-400">上传中...</span>
            </div>
          </div>

          <!-- 二维码上传（加群/客服等，详情页底部展示，支持长按识别） -->
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-slate-700 dark:text-slate-300">二维码图片 <span class="text-xs text-slate-400">（可选，详情页底部展示，支持长按识别加群/加客服）</span></label>
            <div class="flex items-center gap-3">
              <div v-if="qrImagePreview" class="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200 dark:border-gray-600">
                <img :src="qrImagePreview" class="w-full h-full object-cover" />
                <button class="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/80" @click="removeQrImage">×</button>
              </div>
              <label v-else class="w-24 h-24 rounded-lg border-2 border-dashed border-slate-300 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:border-[var(--primary)] transition-colors">
                <span class="text-xs text-slate-400">点击上传</span>
                <input type="file" accept="image/*" class="hidden" @change="handleQrUpload" />
              </label>
              <span v-if="uploadingQr" class="text-xs text-slate-400">上传中...</span>
            </div>
          </div>

          <!-- 摘要 -->
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-slate-700 dark:text-slate-300">摘要 <span class="text-xs text-slate-400">（可选，列表/弹窗预览用，不填则自动截取）</span></label>
            <textarea v-model="form.summary" class="input input-bordered w-full h-16 resize-none" placeholder="一句话概述公告内容"></textarea>
          </div>

          <!-- 富文本编辑器 -->
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-slate-700 dark:text-slate-300">公告内容 <span class="text-xs text-slate-400">（支持图文混排）</span></label>
            <div class="border border-slate-200 dark:border-gray-600 rounded-lg overflow-hidden">
              <Toolbar :editor="editorRef" :defaultConfig="toolbarConfig" mode="simple" style="border-bottom: 1px solid #e2e8f0;" />
              <Editor
                v-model="valueHtml"
                :defaultConfig="editorConfig"
                mode="simple"
                style="height: 400px; overflow-y: hidden;"
                @onCreated="handleEditorCreated"
                @onChange="handleEditorChange"
              />
            </div>
          </div>

          <!-- 纯文本内容（兼容旧版，自动从富文本提取） -->
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-slate-700 dark:text-slate-300">纯文本内容 <span class="text-xs text-slate-400">（可选，兼容不支持富文本的场景）</span></label>
            <textarea v-model="form.content" class="input w-full h-16 resize-none" placeholder="留空则自动从富文本提取纯文本"></textarea>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-slate-700 dark:text-slate-300">公告类型</label>
              <select v-model="form.type" class="select select-bordered w-full">
                <option value="announcement">公告</option>
                <option value="activity">活动</option>
                <option value="system">系统</option>
                <option value="update">更新</option>
              </select>
            </div>
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-slate-700 dark:text-slate-300">优先级</label>
              <select v-model="form.priority" class="input w-full">
                <option value="low">低</option>
                <option value="normal">普通</option>
                <option value="high">高</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-slate-700 dark:text-slate-300">排序</label>
              <input v-model.number="form.sort" type="number" class="input input-bordered w-full" placeholder="0" />
            </div>
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-slate-700 dark:text-slate-300">状态</label>
              <select v-model="form.status" class="select select-bordered w-full">
                <option value="active">启用</option>
                <option value="inactive">停用</option>
              </select>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" v-model="form.showPopup" class="w-4 h-4 rounded border-[var(--border-color)] text-[var(--primary)]" />
              <span class="text-sm text-slate-700 dark:text-slate-300">弹窗显示</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" v-model="form.popupOnce" class="w-4 h-4 rounded border-[var(--border-color)] text-[var(--primary)]" />
              <span class="text-sm text-slate-700 dark:text-slate-300">仅显示一次</span>
            </label>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-slate-700 dark:text-slate-300">生效时间</label>
              <input v-model="form.validFrom" type="datetime-local" class="input w-full" />
            </div>
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-slate-700 dark:text-slate-300">到期时间</label>
              <input v-model="form.validTo" type="datetime-local" class="input input-bordered w-full" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-slate-700 dark:text-slate-300">跳转类型</label>
              <select v-model="form.linkType" class="select select-bordered w-full">
                <option value="none">不跳转</option>
                <option value="page">内部页面</option>
                <option value="webview">网页链接</option>
              </select>
            </div>
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-slate-700 dark:text-slate-300">跳转目标</label>
              <input v-model="form.linkValue" class="input w-full" :placeholder="linkPlaceholder" :disabled="form.linkType === 'none'" />
            </div>
          </div>
        </div>

        <div class="px-6 py-4 border-t border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/50 flex justify-end gap-3 rounded-b-2xl">
          <button class="btn-ghost" @click="closeModal">取消</button>
          <button class="btn-primary px-8" @click="saveNotification" :disabled="!form.title">
            {{ editingId ? '保存更改' : '立即创建' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, reactive, ref, shallowRef, computed } from "vue";
import { app, callFunctionWithAuth } from "../utils/cloudbase";
import { useMessage, useDialog } from 'naive-ui'
import { useCache } from "../composables/useCache";
import AnimatedList from "../components/animations/AnimatedList.vue";
import { Editor, Toolbar } from "@wangeditor/editor-for-vue";
import "@wangeditor/editor/dist/css/style.css";

const message = useMessage()
const dialog = useDialog()

const { get: getCache, set: setCache, clear: clearCache } = useCache<any[]>('notifications_cache');

const notifications = ref<any[]>([]);
const loading = ref(false);
const selectedNotifications = ref<string[]>([]);
const editingId = ref<string | null>(null);
const showModal = ref(false);

// ===== 富文本编辑器 =====
const editorRef = shallowRef<any>(null);
const valueHtml = ref<string>("");
const coverImagePreview = ref<string>("");
const uploadingCover = ref(false);
const qrImagePreview = ref<string>("");
const uploadingQr = ref(false);

const toolbarConfig = {
  excludeKeys: [
    'group-video',   // 排除视频上传
    'fullScreen',
  ]
};

const editorConfig = {
  placeholder: "请输入公告内容，支持插入图片...",
  MENU_CONF: {
    uploadImage: {
      // 自定义上传：上传到云存储
      async customUpload(file: File, insertFn: (url: string, alt: string, href: string) => void) {
        try {
          const cloudPath = `notifications/${Date.now()}-${file.name}`;
          const uploadRes = await app.uploadFile({
            cloudPath,
            filePath: file as unknown as string,
          });
          // 获取临时访问 URL
          const urlRes = await app.getTempFileURL({
            fileList: [uploadRes.fileID],
          });
          const tempUrl = urlRes.fileList?.[0]?.tempFileURL || '';
          if (tempUrl) {
            // 插入编辑器：url + alt + href
            insertFn(tempUrl, file.name, tempUrl);
          }
        } catch (err) {
          console.error("图片上传失败:", err);
          message.error("图片上传失败");
        }
      }
    }
  }
};

const handleEditorCreated = (editor: any) => {
  editorRef.value = editor;
};

const handleEditorChange = (editor: any) => {
  // 内容变化时自动提取纯文本到 content（如果用户未手动填写）
  if (!form.content || form.content === lastAutoContent) {
    const text = editor.getText().trim();
    form.content = text;
    lastAutoContent = text;
  }
};

let lastAutoContent = "";

onBeforeUnmount(() => {
  const editor = editorRef.value;
  if (editor) {
    editor.destroy();
    editorRef.value = null;
  }
});

// 封面图上传
const handleCoverUpload = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const files = target.files;
  if (!files || files.length === 0) return;
  const file = files[0];
  uploadingCover.value = true;
  try {
    const cloudPath = `notifications/covers/${Date.now()}-${file.name}`;
    const res = await app.uploadFile({
      cloudPath,
      filePath: file as unknown as string,
    });
    form.coverImage = res.fileID;
    const urlRes = await app.getTempFileURL({ fileList: [res.fileID] });
    coverImagePreview.value = urlRes.fileList?.[0]?.tempFileURL || "";
  } catch (err) {
    console.error("封面上传失败:", err);
    message.error("封面上传失败");
  } finally {
    uploadingCover.value = false;
    target.value = "";
  }
};

const removeCoverImage = () => {
  form.coverImage = "";
  coverImagePreview.value = "";
};

// ===== 二维码上传（加群/客服等） =====
const handleQrUpload = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const files = target.files;
  if (!files || files.length === 0) return;
  const file = files[0];
  uploadingQr.value = true;
  try {
    const cloudPath = `notifications/qr/${Date.now()}-${file.name}`;
    const res = await app.uploadFile({
      cloudPath,
      filePath: file as unknown as string,
    });
    form.qrImage = res.fileID;
    const urlRes = await app.getTempFileURL({ fileList: [res.fileID] });
    qrImagePreview.value = urlRes.fileList?.[0]?.tempFileURL || "";
  } catch (err) {
    console.error("二维码上传失败:", err);
    message.error("二维码上传失败");
  } finally {
    uploadingQr.value = false;
    target.value = "";
  }
};

const removeQrImage = () => {
  form.qrImage = "";
  qrImagePreview.value = "";
};

const hasActiveSelected = computed(() => {
  return selectedNotifications.value.some(id => {
    const notification = notifications.value.find(n => (n._id || n.id) === id);
    return notification?.status === 'active';
  });
});

const form = reactive({
  title: "",
  content: "",        // 纯文本（兼容旧版/自动提取）
  contentHtml: "",    // 富文本 HTML
  coverImage: "",     // 封面图 cloud:// fileID
  qrImage: "",        // 二维码 cloud:// fileID（详情页底部展示，长按识别）
  summary: "",        // 摘要
  type: "announcement",
  priority: "normal",
  showPopup: true,
  popupOnce: true,
  linkType: "none",
  linkValue: "",
  validFrom: "",
  validTo: "",
  sort: 0,
  status: "active",
});

const linkPlaceholder = computed(() => {
  switch (form.linkType) {
    case 'page': return '例如: /pages/wallpaper/wallpaper';
    case 'webview': return '例如: https://example.com';
    default: return '跳转目标';
  }
});

const getPriorityIcon = (priority: string) => {
  const map: Record<string, string> = {
    high: '🔴',
    normal: '📢',
    low: 'ℹ️'
  };
  return map[priority] || '📢';
};

const getTypeText = (type: string) => {
  const map: Record<string, string> = {
    announcement: '公告',
    activity: '活动',
    system: '系统',
    update: '更新'
  };
  return map[type] || type;
};

const formatDate = (dateStr: any) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
};

const openModal = () => {
  showModal.value = true;
  if (!editingId.value) {
    resetFormState();
  }
};

const closeModal = () => {
  showModal.value = false;
  setTimeout(() => {
    resetFormState();
    editingId.value = null;
  }, 300);
};

const resetFormState = () => {
  form.title = "";
  form.content = "";
  form.contentHtml = "";
  form.coverImage = "";
  form.qrImage = "";
  form.summary = "";
  form.type = "announcement";
  form.priority = "normal";
  form.showPopup = true;
  form.popupOnce = true;
  form.linkType = "none";
  form.linkValue = "";
  form.validFrom = "";
  form.validTo = "";
  form.sort = 0;
  form.status = "active";
  valueHtml.value = "";
  coverImagePreview.value = "";
  qrImagePreview.value = "";
  lastAutoContent = "";
};

const fetchNotifications = async () => {
  loading.value = true;

  const cached = getCache();
  if (cached) {
    notifications.value = cached;
    loading.value = false;
  }

  try {
    const res = await callFunctionWithAuth("adminNotifications", {
      action: "getAll"
    });

    if (res.result && res.result.success) {
      const data = res.result.data || [];
      notifications.value = data;
      setCache(data);
      // 批量获取封面图临时 URL
      fetchCoverUrls(data);
    } else {
      console.error("获取公告失败:", res.result?.message);
      notifications.value = [];
    }
  } catch (error) {
    console.error("Fetch notifications error:", error);
    notifications.value = [];
  } finally {
    loading.value = false;
  }
};

// 封面图 URL 缓存：fileID -> tempURL
const coverUrlMap = ref<Record<string, string>>({});

const fetchCoverUrls = async (list: any[]) => {
  const fileIDs = list
    .map(item => item.coverImage)
    .filter(url => url && url.startsWith('cloud://'));

  if (fileIDs.length === 0) return;

  // 去重
  const uniqueFileIDs = [...new Set(fileIDs)];
  try {
    const urlRes = await app.getTempFileURL({ fileList: uniqueFileIDs });
    if (urlRes.fileList) {
      const map: Record<string, string> = {};
      urlRes.fileList.forEach((item: any) => {
        if (item.tempFileURL) {
          map[item.fileID] = item.tempFileURL;
        }
      });
      coverUrlMap.value = { ...coverUrlMap.value, ...map };
    }
  } catch (err) {
    console.warn("获取封面 URL 失败:", err);
  }
};

const getCoverUrl = (item: any) => {
  if (!item.coverImage) return "";
  if (item.coverImage.startsWith('cloud://')) {
    return coverUrlMap.value[item.coverImage] || "";
  }
  return item.coverImage;
};

const batchToggleStatus = async () => {
  if (selectedNotifications.value.length === 0) return;
  
  const newStatus = hasActiveSelected.value ? 'inactive' : 'active';
  const confirmed = await dialog.warning({
    title: '提示',
    content: `确定要将选中的 ${selectedNotifications.value.length} 个公告${newStatus === 'active' ? '启用' : '停用'}吗？`,
    positiveText: '确定',
    negativeText: '取消',
  })
  if (!confirmed) return

  try {
    const res = await callFunctionWithAuth("adminNotifications", {
      action: "batchToggleStatus",
      data: {
        ids: selectedNotifications.value,
        status: newStatus
      }
    });
    
    if (res.result && res.result.success) {
      message.success(res.result.message);
      selectedNotifications.value = [];
      clearCache();
      await fetchNotifications();
    } else {
      message.error('操作失败: ' + (res.result?.message || '未知错误'));
    }
  } catch (err: any) {
    message.error('操作失败: ' + err.message);
  }
};

const batchDelete = async () => {
  if (selectedNotifications.value.length === 0) return;
  
  const confirmed = await dialog.warning({
    title: '提示',
    content: `确定要删除选中的 ${selectedNotifications.value.length} 个公告吗？此操作不可恢复。`,
    positiveText: '确定',
    negativeText: '取消',
  })
  if (!confirmed) return

  try {
    const res = await callFunctionWithAuth("adminNotifications", {
      action: "batchDelete",
      data: {
        ids: selectedNotifications.value
      }
    });
    
    if (res.result && res.result.success) {
      message.success(res.result.message);
      selectedNotifications.value = [];
      clearCache();
      await fetchNotifications();
    } else {
      message.error('删除失败: ' + (res.result?.message || '未知错误'));
    }
  } catch (err: any) {
    message.error('删除失败: ' + err.message);
  }
};

const editNotification = (item: any) => {
  editingId.value = item._id || item.id;
  form.title = item.title || '';
  form.content = item.content || '';
  form.contentHtml = item.contentHtml || '';
  form.coverImage = item.coverImage || '';
  form.qrImage = item.qrImage || '';
  form.summary = item.summary || '';
  form.type = item.type || 'announcement';
  form.priority = item.priority || 'normal';
  form.showPopup = item.showPopup !== false;
  form.popupOnce = item.popupOnce !== false;
  form.linkType = item.linkType || 'none';
  form.linkValue = item.linkValue || '';

  // 加载富文本到编辑器
  valueHtml.value = item.contentHtml || '';
  lastAutoContent = form.content;

  // 加载封面图预览
  if (item.coverImage) {
    form.coverImage = item.coverImage;
    // cloud:// fileID 需要转临时 URL 预览
    if (item.coverImage.startsWith('cloud://')) {
      app.getTempFileURL({ fileList: [item.coverImage] }).then((urlRes: any) => {
        coverImagePreview.value = urlRes.fileList?.[0]?.tempFileURL || "";
      }).catch(() => {
        coverImagePreview.value = "";
      });
    } else {
      coverImagePreview.value = item.coverImage;
    }
  } else {
    coverImagePreview.value = "";
  }

  // 加载二维码预览
  if (item.qrImage) {
    form.qrImage = item.qrImage;
    if (item.qrImage.startsWith('cloud://')) {
      app.getTempFileURL({ fileList: [item.qrImage] }).then((urlRes: any) => {
        qrImagePreview.value = urlRes.fileList?.[0]?.tempFileURL || "";
      }).catch(() => {
        qrImagePreview.value = "";
      });
    } else {
      qrImagePreview.value = item.qrImage;
    }
  } else {
    qrImagePreview.value = "";
  }

  if (item.validFrom) {
    try {
      const d = new Date(item.validFrom);
      if (!isNaN(d.getTime())) {
        form.validFrom = d.toISOString().slice(0, 16);
      } else {
        form.validFrom = '';
      }
    } catch {
      form.validFrom = '';
    }
  } else {
    form.validFrom = '';
  }

  if (item.validTo) {
    try {
      const d = new Date(item.validTo);
      if (!isNaN(d.getTime())) {
        form.validTo = d.toISOString().slice(0, 16);
      } else {
        form.validTo = '';
      }
    } catch {
      form.validTo = '';
    }
  } else {
    form.validTo = '';
  }

  form.sort = item.sort !== undefined ? item.sort : 0;
  form.status = item.status || 'active';
  showModal.value = true;
};

const saveNotification = async () => {
  if (!form.title) {
    message.error("请填写标题");
    return;
  }

  try {
    // 同步富文本内容
    form.contentHtml = valueHtml.value;

    const data = {
      title: form.title,
      content: form.content,
      contentHtml: form.contentHtml,
      coverImage: form.coverImage,
      qrImage: form.qrImage,
      summary: form.summary,
      type: form.type,
      priority: form.priority,
      showPopup: form.showPopup,
      popupOnce: form.popupOnce,
      linkType: form.linkType,
      linkValue: form.linkValue,
      validFrom: form.validFrom || null,
      validTo: form.validTo || null,
      sort: form.sort,
      status: form.status
    };

    let res;
    if (editingId.value) {
      res = await callFunctionWithAuth("adminNotifications", {
        action: "update",
        id: editingId.value,
        data: data
      });
    } else {
      res = await callFunctionWithAuth("adminNotifications", {
        action: "add",
        data: data
      });
    }

    if (res.result && res.result.success) {
      message.success(res.result.message || (editingId.value ? "更新成功" : "创建成功"));
      closeModal();
      clearCache();
      await fetchNotifications();
    } else {
      message.error("保存失败: " + (res.result?.message || "未知错误"));
    }
  } catch (error: any) {
    console.error("Save notification error:", error);
    message.error("保存失败: " + (error.message || JSON.stringify(error)));
  }
};

const removeNotification = async (id: string) => {
  const confirmed = await dialog.warning({
    title: '提示',
    content: "确定要删除这个公告吗？",
    positiveText: '确定',
    negativeText: '取消',
  })
  if (!confirmed) return
  
  try {
    const res = await callFunctionWithAuth("adminNotifications", {
      action: "delete",
      id: id
    });
    
    if (res.result && res.result.success) {
      message.success(res.result.message || "删除成功");
      clearCache();
      await fetchNotifications();
    } else {
      message.error("删除失败: " + (res.result?.message || "未知错误"));
    }
  } catch (error: any) {
    console.error("Remove notification error:", error);
    message.error("删除失败: " + error.message);
  }
};

onMounted(() => {
  fetchNotifications();
});
</script>

<style scoped>
/* No custom styles needed, using Tailwind */
</style>
