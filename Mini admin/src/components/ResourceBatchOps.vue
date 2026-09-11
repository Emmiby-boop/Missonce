<template>
  <label class="flex items-center gap-2 text-sm text-[var(--text-sub)] cursor-pointer select-none">
    <input
      type="checkbox"
      :checked="isAllSelected"
      @change="toggleSelectAll"
      class="rounded border-slate-300 text-green-600 focus:ring-green-500"
    />
    全选本页
  </label>
  <!-- 批量操作按钮 -->
  <button
    v-if="selectedResources.length > 0"
    class="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded font-medium hover:bg-indigo-100 transition-colors border border-indigo-200"
    @click="batchAnalyzeAI"
  >
     批量 AI 识别
  </button>
  <button
    v-if="selectedResources.length > 0"
    class="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded font-medium hover:bg-blue-100 transition-colors border border-blue-200"
    @click="batchAddTags"
  >
     批量添加标签
  </button>
  <!-- 批量状态修改下拉 -->
  <NDropdown
    v-if="selectedResources.length > 0"
    trigger="click"
    :options="statusOptions"
    @select="batchUpdateStatus"
  >
    <button class="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded font-medium hover:bg-green-100 transition-colors border border-green-200">
      批量修改状态 <span class="ml-1">▼</span>
    </button>
  </NDropdown>
  <button
    v-if="selectedResources.length > 0"
    class="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded font-medium hover:bg-red-100 transition-colors border border-red-200"
    @click="batchDelete"
  >
     批量删除 ({{ selectedResources.length }})
  </button>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { NDropdown } from "naive-ui";
import { db, serverDate, callFunctionWithAuth } from "../utils/cloudbase";
import { useMessage, useDialog } from 'naive-ui';
import { logger } from '../utils/logger';

const message = useMessage();
const dialog = useDialog();

interface ResourceItem {
  _id: string;
  title?: string;
  type?: string;
  status?: string;
  category?: string;
  categories?: string[];
  tags?: string[];
  aiStatus?: string;
}

const props = defineProps<{
  list: ResourceItem[];
}>();

const emit = defineEmits<{
  refresh: [];
}>();

const selectedResources = defineModel<string[]>({ required: true });

const loading = ref(false);

const statusOptions = [
  { label: '发布', key: 'published' },
  { label: '下线', key: 'offline' },
  { label: '设为草稿', key: 'draft' },
];

const isAllSelected = computed(() => {
  return props.list.length > 0 && selectedResources.value.length === props.list.length;
});

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedResources.value = [];
  } else {
    selectedResources.value = props.list.map((item) => item._id);
  }
};

// 批量修改状态
const batchUpdateStatus = async (status: string) => {
  if (selectedResources.value.length === 0) return;

  const statusLabel = status === 'published' ? '已发布' : status === 'offline' ? '已下线' : '草稿';
  const confirmed = await dialog.warning({
    title: '提示',
    content: `确定要将选中的 ${selectedResources.value.length} 个资源设置为「${statusLabel}」吗？`,
    positiveText: '确定',
    negativeText: '取消',
  });
  if (!confirmed) return;

  try {
    loading.value = true;
    const updatePromises = selectedResources.value.map(id =>
      db.collection("resources").doc(id).update({
        status,
        updatedAt: serverDate()
      })
    );
    await Promise.all(updatePromises);

    message.success(`已成功修改 ${selectedResources.value.length} 个资源`);
    selectedResources.value = [];
    emit('refresh');
  } catch (err: any) {
    logger.error('批量修改失败', err);
    message.error('批量修改失败: ' + err.message);
  } finally {
    loading.value = false;
  }
};

// 批量添加标签
const batchAddTags = async () => {
  if (selectedResources.value.length === 0) return;

  const tags = window.prompt('请输入要添加的标签（多个用逗号分隔）：');
  if (!tags) return;

  const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
  if (tagList.length === 0) return;

  try {
    loading.value = true;
    const updatePromises = selectedResources.value.map(id => {
      const item = props.list.find(i => i._id === id);
      const existingTags = item?.tags || [];
      const newTags = [...new Set([...existingTags, ...tagList])];
      return db.collection("resources").doc(id).update({
        tags: newTags,
        updatedAt: serverDate()
      });
    });
    await Promise.all(updatePromises);

    message.success(`已成功添加标签`);
    selectedResources.value = [];
    emit('refresh');
  } catch (err: any) {
    logger.error('批量添加标签失败', err);
    message.error('批量添加标签失败: ' + err.message);
  } finally {
    loading.value = false;
  }
};

const batchDelete = async () => {
  if (selectedResources.value.length === 0) return;

  const confirmed = await dialog.warning({
    title: '提示',
    content: `确定要删除选中的 ${selectedResources.value.length} 个资源吗？\n\n此操作不可恢复！`,
    positiveText: '确定',
    negativeText: '取消',
  });
  if (!confirmed) return;

  try {
    logger.log('准备批量删除资源:', selectedResources.value);

    const result = await callFunctionWithAuth('deleteResources', {
      action: 'delete',
      resourceIds: selectedResources.value
    });

    logger.log('云函数批量删除结果:', result);

    if (result.result && result.result.success) {
      message.success(result.result.message || '批量删除成功');
      selectedResources.value = [];
      emit('refresh');
    } else {
      message.error('批量删除失败: ' + (result.result?.message || '未知错误'));
    }
  } catch (err: any) {
    logger.error("批量删除失败", err);
    message.error('批量删除失败: ' + err.message);
  } finally {
    loading.value = false;
  }
};

const batchAnalyzeAI = async () => {
  if (selectedResources.value.length === 0) return;
  const confirmed = await dialog.warning({
    title: '提示',
    content: `确定要对选中的 ${selectedResources.value.length} 个资源重新进行 AI 识别吗？`,
    positiveText: '确定',
    negativeText: '取消',
  });
  if (!confirmed) return;

  try {
    selectedResources.value.forEach(id => {
        const item = props.list.find(i => i._id === id);
        if (item) item.aiStatus = 'pending';

        callFunctionWithAuth('analyzeResource', { id }).catch(err => {
             if (err.message && (err.message.includes('TIMEOUT') || err.message.includes('TIME_LIMIT'))) {
                logger.log('批量触发请求已发送 (前端超时忽略)', id);
             } else {
                logger.error(err);
             }
        });
    });

    message.success(`已触发 ${selectedResources.value.length} 个任务，请稍后刷新查看结果。`);
    selectedResources.value = [];

    setTimeout(() => emit('refresh'), 3000);

  } catch (err: any) {
    logger.error("批量触发流程错误", err);
  }
};
</script>
