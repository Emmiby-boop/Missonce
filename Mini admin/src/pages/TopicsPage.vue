<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="glass-panel">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="panel-title">专题管理</h2>
          <p class="panel-sub">创建和管理精选专题页面 · 拖拽卡片可调整排序</p>
        </div>
        <div class="flex gap-2">
          <button v-if="selectedTopics.length > 0" class="btn-soft" :style="{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }" @click="batchDelete">
            批量删除 ({{ selectedTopics.length }})
          </button>
          <button v-if="selectedTopics.length > 0" class="btn-soft" @click="batchToggleStatus">
            批量{{ hasActiveSelected ? '停用' : '启用' }}
          </button>
          <button class="btn-soft gap-2" @click="openCreateModal()">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
            </svg>
            新增专题
          </button>
        </div>
      </div>
    </div>

    <!-- 专题列表：列数配置 + 拖拽排序 + 提示 -->
    <TopicSorter
      v-model:topics="topics"
      v-model:selectedTopics="selectedTopics"
      :loading="loading"
      @changed="loadTopics"
      @manage="handleManage"
    />

    <!-- Loading Skeleton -->
    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div v-for="i in 8" :key="i" class="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden animate-pulse">
        <div class="aspect-video bg-[var(--border-color)]"></div>
        <div class="p-4 space-y-3">
          <div class="h-4 bg-[var(--border-color)] rounded w-3/4"></div>
          <div class="h-3 bg-[var(--border-color)] rounded w-1/2"></div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!loading && topics.length === 0" class="flex flex-col items-center justify-center py-20 bg-[var(--bg-card)] rounded-2xl border-2 border-dashed border-[var(--border-color)]">
      <div class="w-20 h-20 bg-[var(--bg-body)] rounded-full flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-[var(--text-sub)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <p class="text-[var(--text-sub)] font-medium text-lg">暂无专题</p>
      <p class="text-[var(--text-sub)] text-sm mt-1">点击下方按钮创建第一个专题</p>
      <button class="btn-soft mt-4" @click="openCreateModal()">立即创建</button>
    </div>

    <!-- 创建/编辑弹窗 -->
    <TopicEditor
      v-model:showCreate="showModal"
      v-model:showEdit="showEditModal"
      :edit-item="editItem"
      :topic-count="topics.length"
      @created="onCreated"
      @updated="loadTopics"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { callCloudFunction } from "../utils/cloudbase";
import { useMessage, useDialog } from 'naive-ui';
import { useCache } from '../composables/useCache';
import type { TopicItem, TopicLinkType } from '../types';
import TopicEditor from '../components/TopicEditor.vue';
import TopicSorter from '../components/TopicSorter.vue';

const message = useMessage();
const dialog = useDialog();

const { set: setCache, clear: clearCache } = useCache<TopicItem[]>('topics_cache');

const router = useRouter();
const topics = ref<TopicItem[]>([]);
const loading = ref(false);
const selectedTopics = ref<string[]>([]);

// 弹窗状态
const showModal = ref(false);
const showEditModal = ref(false);
const editItem = ref<TopicItem | null>(null);

const hasActiveSelected = computed(() => {
  return selectedTopics.value.some(id => {
    const topic = topics.value.find(t => t._id === id);
    return topic?.status === 'active';
  });
});

onMounted(() => {
  loadTopics();
});

const loadTopics = async () => {
  loading.value = true;
  try {
    // 后台管理需要查看所有状态专题，并跳过云函数缓存
    const res = await callCloudFunction("getTopics", { status: 'all' });
    const data = (res.data || []) as TopicItem[];
    topics.value = data;
    setCache(data);
  } catch (err) {
    console.error("加载专题失败", err);
    message.error('加载失败，请刷新重试');
  } finally {
    loading.value = false;
  }
};

const openCreateModal = () => {
  showModal.value = true;
};

const openEditModal = (item: TopicItem) => {
  editItem.value = item;
  showEditModal.value = true;
};

// 卡片"管理"按钮路由：resource 进设计器，page/webview 进编辑弹窗
const handleManage = (item: TopicItem) => {
  if ((item.linkType || 'resource') === 'resource') {
    navigateToDesigner(item._id);
  } else {
    openEditModal(item);
  }
};

const navigateToDesigner = (id: string) => {
  router.push(`/topic-layout/${id}`);
};

// 专题创建成功回调：刷新列表，resource 类型进入布局设计器
const onCreated = (payload: { id: string; linkType: TopicLinkType }) => {
  loadTopics();
  if (payload.id && payload.linkType === 'resource') {
    navigateToDesigner(payload.id);
  }
};

const batchToggleStatus = async () => {
  if (selectedTopics.value.length === 0) return;

  const newStatus = hasActiveSelected.value ? 'inactive' : 'active';
  const confirmed = await dialog.warning({
    title: '提示',
    content: `确定要将选中的 ${selectedTopics.value.length} 个专题${newStatus === 'active' ? '启用' : '停用'}吗？`,
    positiveText: '确定',
    negativeText: '取消',
  });
  if (!confirmed) return;

  try {
    await callCloudFunction('manageTopics', {
      action: 'batchUpdateStatus',
      ids: [...selectedTopics.value],
      data: { status: newStatus }
    });

    message.success(`已成功${newStatus === 'active' ? '启用' : '停用'} ${selectedTopics.value.length} 个专题`);
    selectedTopics.value = [];
    clearCache();
    await loadTopics();
  } catch (err) {
    message.error('操作失败: ' + (err instanceof Error ? err.message : String(err)));
  }
};

const batchDelete = async () => {
  if (selectedTopics.value.length === 0) return;

  const confirmed = await dialog.warning({
    title: '提示',
    content: `确定要删除选中的 ${selectedTopics.value.length} 个专题吗？此操作不可恢复。`,
    positiveText: '确定',
    negativeText: '取消',
  });
  if (!confirmed) return;

  const removedIds = [...selectedTopics.value];
  try {
    await callCloudFunction('manageTopics', {
      action: 'batchDelete',
      ids: removedIds
    });

    message.success(`已成功删除 ${removedIds.length} 个专题`);
    selectedTopics.value = [];
    clearCache();
    topics.value = topics.value.filter(t => !removedIds.includes(t._id));
    await loadTopics();
  } catch (err) {
    message.error('删除失败: ' + (err instanceof Error ? err.message : String(err)));
  }
};
</script>

<style scoped>
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
