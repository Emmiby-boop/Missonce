<template>
  <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click="close">
    <div class="bg-[var(--bg-card)] rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-auto m-4" @click.stop>
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-xl font-bold text-[var(--text-main)]">需要优化的内容</h3>
            <p class="text-sm text-[var(--text-sub)] mt-1">共 {{ qualityCheck?.lowQualityResources?.length || 0 }} 项</p>
          </div>
          <button @click="close" class="p-2 rounded-lg hover:bg-[var(--bg-body)] transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--text-sub)]"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
          </button>
        </div>

        <div class="flex flex-wrap gap-2 mb-4">
          <button
            @click="toggleSelectAll"
            class="px-3 py-1.5 text-xs rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
          >
            {{ isAllSelected ? '取消全选' : '全选' }}
          </button>
          <button
            @click="batchAIAnalyze"
            :disabled="(qualityCheck?.aiPendingCount === 0 && selectedResources.length === 0) || aiAnalyzing"
            class="px-3 py-1.5 text-xs rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <svg v-if="aiAnalyzing" class="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            {{ aiAnalyzing ? '分析中...' : '批量AI识别' }}
          </button>
          <button
            @click="batchUnpublish"
            :disabled="(qualityCheck?.lowQualityCount === 0 && selectedResources.length === 0) || batchOperating"
            class="px-3 py-1.5 text-xs rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {{ batchOperating ? '处理中...' : '批量下架' }}
          </button>
          <button
            @click="batchDelete"
            :disabled="(qualityCheck?.lowQualityCount === 0 && selectedResources.length === 0) || batchOperating"
            class="px-3 py-1.5 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {{ batchOperating ? '删除中...' : '批量删除' }}
          </button>
          <button
            @click="jumpToResourceManage"
            class="px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-body)] text-[var(--text-main)] hover:bg-[var(--border-color)] flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
            资源管理
          </button>
        </div>

        <div v-if="qualityCheck?.lowQualityResources?.length === 0" class="text-center py-12">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 text-[var(--text-sub)]"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
          <p class="text-[var(--text-sub)]">暂无需要优化的内容</p>
        </div>

        <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          <div
            v-for="item in qualityCheck?.lowQualityResources"
            :key="item._id"
            class="bg-[var(--bg-body)] rounded-xl border border-[var(--border-color)] overflow-hidden hover:shadow-lg hover:border-[var(--primary)] transition-all duration-300 flex flex-col"
          >
            <div class="p-2">
              <div class="flex items-start gap-2 mb-2">
                <input
                  type="checkbox"
                  :checked="selectedResources.includes(item._id)"
                  @click.stop="toggleResourceSelection(item._id)"
                  class="w-3.5 h-3.5 rounded accent-[var(--primary)] mt-0.5 flex-shrink-0"
                />
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-medium text-[var(--text-main)] truncate">{{ item.title || '未命名' }}</div>
                  <div class="text-[10px] text-[var(--text-sub)] mt-0.5">
                    <span class="px-1.5 py-0.5 rounded-full" :class="{
                      'bg-pink-500/20 text-pink-500': item.type === 'avatar',
                      'bg-indigo-500/20 text-indigo-500': item.type === 'wallpaper'
                    }">
                      {{ item.type === 'avatar' ? '头像' : '壁纸' }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="rounded-lg overflow-hidden bg-[var(--border-color)] mb-2">
                <img v-if="resolveImageUrl(item)" :src="resolveImageUrl(item)" class="w-full h-32 object-cover" @error="imageErrorHandler($event)" />
                <div v-else class="w-full h-32 flex items-center justify-center text-[var(--text-sub)]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
                </div>
              </div>
              <button
                @click="emit('edit', item)"
                class="w-full px-2 py-1.5 text-xs rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity font-medium"
              >
                编辑
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useMessage } from 'naive-ui';
import { db, callFunctionWithAuth } from '../utils/cloudbase';
import type { ImageUrlSource } from './OpsImageLoader.vue';
import { confirmDialog, confirmDeleteDialog } from '../composables/useDialog';

const message = useMessage();

interface LowQualityResource extends ImageUrlSource {
  _id: string;
  type?: string;
  status?: string;
  hotScore?: number;
  downloads?: number;
  viewCount?: number;
  favorites?: number;
  categories?: string[];
  category?: string;
  tags?: string[] | string;
}

interface QualityCheckData {
  recentCount?: number;
  lowQualityCount?: number;
  aiPendingCount?: number;
  suggestions?: string[];
  lowQualityResources?: LowQualityResource[];
}

const props = defineProps<{
  visible: boolean;
  qualityCheck: QualityCheckData | null;
  resolveImageUrl: (item: LowQualityResource) => string;
  imageErrorHandler: (event: Event) => void;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  refresh: [];
  edit: [item: LowQualityResource];
}>();

const selectedResources = ref<string[]>([]);
const aiAnalyzing = ref(false);
const batchOperating = ref(false);
const isAllSelected = ref(false);

const close = () => {
  emit('update:visible', false);
};

const getTargetIds = (): string[] => {
  if (selectedResources.value.length > 0) return selectedResources.value;
  return props.qualityCheck?.lowQualityResources?.map((r) => r._id) || [];
};

const toggleResourceSelection = (id: string) => {
  const index = selectedResources.value.indexOf(id);
  if (index === -1) {
    selectedResources.value.push(id);
  } else {
    selectedResources.value.splice(index, 1);
  }

  const total = props.qualityCheck?.lowQualityResources?.length || 0;
  isAllSelected.value = selectedResources.value.length === total && total > 0;
};

const toggleSelectAll = () => {
  if (!props.qualityCheck?.lowQualityResources?.length) return;

  if (isAllSelected.value) {
    selectedResources.value = [];
  } else {
    selectedResources.value = props.qualityCheck.lowQualityResources.map((r) => r._id);
  }
  isAllSelected.value = !isAllSelected.value;
};

const batchAIAnalyze = async () => {
  const targetIds = getTargetIds();
  if (targetIds.length === 0) return;

  aiAnalyzing.value = true;
  let successCount = 0;
  let failCount = 0;

  for (const id of targetIds) {
    try {
      await callFunctionWithAuth('analyzeResource', { id });
      successCount++;
    } catch (err) {
      console.error(`AI分析失败: ${id}`, err);
      failCount++;
    }
  }

  aiAnalyzing.value = false;
  message.success(`批量AI识别完成！成功: ${successCount}, 失败: ${failCount}`);
  selectedResources.value = [];
  emit('refresh');
};

const batchUnpublish = async () => {
  const targetIds = getTargetIds();
  if (targetIds.length === 0) return;

  const confirmed = await confirmDialog(`确定要下架选中的 ${targetIds.length} 个资源吗？`);
  if (!confirmed) return;

  batchOperating.value = true;
  let successCount = 0;

  for (const id of targetIds) {
    try {
      await db.collection('resources').doc(id).update({
        data: { status: 'unpublished', updatedAt: db.serverDate() }
      });
      successCount++;
    } catch (err) {
      console.error(`下架失败: ${id}`, err);
    }
  }

  batchOperating.value = false;
  message.success(`批量下架完成！成功: ${successCount}`);
  selectedResources.value = [];
  emit('refresh');
};

const batchDelete = async () => {
  const targetIds = getTargetIds();
  if (targetIds.length === 0) return;

  const confirmed = await confirmDeleteDialog(`确定要删除选中的 ${targetIds.length} 个资源吗？此操作不可恢复！`);
  if (!confirmed) return;

  batchOperating.value = true;
  let successCount = 0;

  for (const id of targetIds) {
    try {
      await db.collection('resources').doc(id).remove();
      successCount++;
    } catch (err) {
      console.error(`删除失败: ${id}`, err);
    }
  }

  batchOperating.value = false;
  message.success(`批量删除完成！成功: ${successCount}`);
  selectedResources.value = [];
  emit('refresh');
};

const jumpToResourceManage = () => {
  window.location.hash = '#/resources';
};
</script>
