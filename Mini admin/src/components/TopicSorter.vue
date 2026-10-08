<template>
  <!-- Topics Grid (拖拽排序) -->
  <draggable
    v-if="!loading && topics.length > 0"
    v-model="topics"
    item-key="_id"
    :animation="200"
    ghost-class="opacity-50"
    drag-class="!cursor-grabbing"
    class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
    @end="onDragEnd"
  >
    <template #item="{ element: item }">
      <div
        class="group relative bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-grab active:cursor-grabbing"
        :class="{'ring-2 ring-[var(--primary)]': selectedTopics.includes(item._id)}"
      >
        <!-- 顶部操作栏：勾选 + 精选星标 + 拖拽指示 -->
        <div class="absolute top-3 right-3 z-10 flex items-center gap-2">
          <button
            class="w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md shadow-sm transition-all"
            :style="item.isFeatured
              ? { background: 'rgba(251, 191, 36, 0.95)', color: '#fff' }
              : { background: 'rgba(255,255,255,0.7)', color: '#9ca3af', border: '1px solid rgba(0,0,0,0.1)' }"
            @click.stop="toggleFeatured(item)"
            :title="item.isFeatured ? '取消精选' : '设为精选'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" :fill="item.isFeatured ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.539 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
          <input
            type="checkbox"
            :value="item._id"
            v-model="selectedTopics"
            class="w-5 h-5 rounded border-[var(--border-color)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
          />
        </div>

        <!-- Cover Image -->
        <div class="aspect-video w-full bg-[var(--bg-body)] relative overflow-hidden cursor-pointer" @click="emit('manage', item)">
          <img v-if="item.cover" :src="item.cover" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
          <div v-else class="w-full h-full flex items-center justify-center text-[var(--text-sub)] bg-[var(--bg-body)]">
            <div class="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 mx-auto mb-1 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span class="text-xs">无封面</span>
            </div>
          </div>
          <div class="absolute inset-0 bg-gradient-to-t from-[var(--text-main)]/70 via-[var(--text-main)]/20 to-transparent"></div>

          <!-- Status Toggle -->
          <div class="absolute top-3 left-3 cursor-pointer group/status" @click.stop="toggleStatus(item)">
            <span class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-md shadow-sm border transition-all duration-200"
              :style="item.status === 'active'
                ? { background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)' }
                : { background: 'rgba(100, 116, 139, 0.2)', color: '#64748b', border: '1px solid rgba(100, 116, 139, 0.3)' }">
              <span class="w-1.5 h-1.5 rounded-full" :style="{ background: item.status === 'active' ? '#22c55e' : '#64748b' }"></span>
              {{ item.status === 'active' ? '已启用' : '已停用' }}
            </span>
          </div>

          <!-- Badge 角标选择 -->
          <div class="absolute top-3 left-1/2 -translate-x-1/2" @click.stop>
            <select
              v-model="item.badge"
              class="text-xs px-2 py-1 rounded-full backdrop-blur-md border-0 cursor-pointer font-medium"
              :style="badgeStyle(item.badge)"
              @change="setBadge(item)"
              title="设置角标"
            >
              <option value="">无角标</option>
              <option value="hot">热门</option>
              <option value="new">新品</option>
              <option value="limited">限时</option>
            </select>
          </div>

          <!-- Title Overlay -->
          <div class="absolute bottom-0 left-0 right-0 p-3 text-white">
            <h3 class="font-bold text-base truncate drop-shadow-lg flex items-center gap-1.5">
              <svg v-if="item.isFeatured" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.539 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {{ item.title }}
            </h3>
            <div class="flex flex-wrap gap-1.5 mt-1.5">
              <span class="backdrop-blur-sm px-1.5 py-0.5 rounded text-xs"
                :style="item.linkType === 'resource'
                  ? { background: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.9)' }
                  : item.linkType === 'page'
                    ? { background: 'rgba(59, 130, 246, 0.5)', color: '#fff' }
                    : { background: 'rgba(168, 85, 247, 0.5)', color: '#fff' }">
                {{ linkTypeLabel(item.linkType || 'resource') }}
              </span>
              <span v-if="item.linkType === 'resource'" class="bg-white/20 backdrop-blur-sm px-1.5 py-0.5 rounded text-xs text-white/90">
                {{ item.filterType === 'tag' ? '标签' : '分类' }}: {{ item.filterValue }}
              </span>
              <span v-else class="bg-white/20 backdrop-blur-sm px-1.5 py-0.5 rounded text-xs text-white/90 max-w-[140px] truncate">
                {{ item.linkUrl }}
              </span>
            </div>
          </div>
        </div>

        <!-- Info Footer -->
        <div class="px-4 py-3 bg-[var(--bg-card)] flex items-center justify-between gap-3 border-t border-[var(--border-color)]/50">
          <div class="flex flex-col gap-1 text-xs text-[var(--text-sub)] flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-medium bg-[var(--bg-body)] px-2 py-0.5 rounded text-[var(--text-main)] whitespace-nowrap">排序 {{ item.sort }}</span>
              <span class="truncate" :title="item.description">{{ item.description || '暂无描述' }}</span>
            </div>
            <div class="flex items-center gap-1 text-[var(--text-sub)] hover:text-[var(--primary)] cursor-pointer transition-colors group/id" @click.stop="copyId(item._id)" title="点击复制ID">
              <span class="font-mono text-[10px] truncate max-w-[140px]">{{ item._id }}</span>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 opacity-0 group-hover/id:opacity-100 transition-opacity" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
              </svg>
            </div>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <button class="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-colors" @click="emit('manage', item)" :title="(item.linkType || 'resource') === 'resource' ? '设计与管理' : '编辑'">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              {{ (item.linkType || 'resource') === 'resource' ? '管理' : '编辑' }}
            </button>
            <button class="p-1.5 text-[var(--text-sub)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors" @click="deleteTopic(item._id)" title="删除">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 000-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </template>
  </draggable>

  <!-- 拖拽提示 -->
  <div v-if="!loading && topics.length > 0" class="flex items-center gap-2 text-xs text-[var(--text-sub)] bg-[var(--bg-card)] rounded-lg px-4 py-2.5 border border-[var(--border-color)]/50">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span>拖拽卡片可调整专题排序，松开后自动保存 · 点击星标设为精选（显示在小程序专题页顶部）· 下拉框设置角标</span>
  </div>
</template>

<script setup lang="ts">
import draggable from 'vuedraggable';
import { callCloudFunction } from '../utils/cloudbase';
import { useMessage } from 'naive-ui';
import { useCache } from '../composables/useCache';
import { logger } from '../utils/logger';
import type { TopicItem } from '../types';
import { confirmDeleteDialog } from '../composables/useDialog';

const message = useMessage();

defineProps<{
  loading: boolean;
}>();

const emit = defineEmits<{
  changed: [];
  manage: [item: TopicItem];
}>();

const topics = defineModel<TopicItem[]>('topics', { required: true });
const selectedTopics = defineModel<string[]>('selectedTopics', { required: true });

const { clear: clearCache } = useCache<unknown[]>('topics_cache');

const linkTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    resource: '资源列表',
    page: '内部页面',
    webview: '网页链接'
  };
  return map[type] || type;
};

const badgeText = (badge: string) => {
  const map: Record<string, string> = { hot: '热门', new: '新品', limited: '限时' };
  return map[badge] || '';
};

const badgeStyle = (badge: string) => {
  if (!badge) return { background: 'rgba(255,255,255,0.7)', color: '#64748b', border: '1px solid rgba(0,0,0,0.1)' };
  const map: Record<string, { background: string; color: string; border: string }> = {
    hot: { background: 'rgba(239, 68, 68, 0.9)', color: '#fff', border: '1px solid rgba(239, 68, 68, 1)' },
    new: { background: 'rgba(59, 130, 246, 0.9)', color: '#fff', border: '1px solid rgba(59, 130, 246, 1)' },
    limited: { background: 'rgba(245, 158, 11, 0.9)', color: '#fff', border: '1px solid rgba(245, 158, 11, 1)' }
  };
  return map[badge];
};

// 拖拽结束：批量更新 sort
const onDragEnd = async () => {
  try {
    const sortMap = topics.value.map((item, index) => ({ id: item._id, sort: index }));
    await callCloudFunction('manageTopics', {
      action: 'updateSort',
      data: { sortMap }
    });
    message.success('排序已更新');
    clearCache();
  } catch (err) {
    logger.error('排序更新失败', err);
    message.error('排序保存失败，请重试');
    emit('changed');  // 失败时通知父组件重新加载以回滚
  }
};

const toggleStatus = async (item: TopicItem) => {
  const newStatus = item.status === 'active' ? 'inactive' : 'active';
  try {
    await callCloudFunction('manageTopics', {
      action: 'updateStatus',
      id: item._id,
      data: { status: newStatus }
    });
    message.success(newStatus === 'active' ? '已启用' : '已停用');
    clearCache();
    emit('changed');
  } catch (err) {
    logger.error('状态更新失败', err);
    message.error('状态更新失败');
  }
};

// 切换精选
const toggleFeatured = async (item: TopicItem) => {
  const newValue = !item.isFeatured;
  try {
    await callCloudFunction('manageTopics', {
      action: 'updateFeatured',
      id: item._id,
      data: { isFeatured: newValue }
    });
    item.isFeatured = newValue;
    message.success(newValue ? '已设为精选' : '已取消精选');
    clearCache();
  } catch (err) {
    logger.error('精选设置失败', err);
    message.error('操作失败');
  }
};

// 设置角标
const setBadge = async (item: TopicItem) => {
  try {
    await callCloudFunction('manageTopics', {
      action: 'updateBadge',
      id: item._id,
      data: { badge: item.badge || '' }
    });
    message.success(item.badge ? `已设置${badgeText(item.badge)}角标` : '已移除角标');
    clearCache();
  } catch (err) {
    logger.error('角标设置失败', err);
    message.error('操作失败');
  }
};

const deleteTopic = async (id: string) => {
  const confirmed = await confirmDeleteDialog('确定要删除这个专题吗？此操作不可恢复。');
  if (!confirmed) return;

  try {
    await callCloudFunction('manageTopics', { action: 'delete', id });
    message.success('删除成功');
    clearCache();
    selectedTopics.value = selectedTopics.value.filter(x => x !== id);
    topics.value = topics.value.filter(t => t._id !== id);
    emit('changed');
  } catch (err) {
    logger.error('删除失败', err);
    message.error('删除失败，请重试');
  }
};

const copyId = (id: string) => {
  navigator.clipboard.writeText(id).then(() => {
    message.success('ID已复制');
  }).catch(err => {
    logger.error('复制失败', err);
    message.error('复制失败');
  });
};
</script>
