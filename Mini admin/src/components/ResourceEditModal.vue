<template>
  <div v-if="visible && localForm" class="fixed inset-0 z-[999] flex items-center justify-center bg-black/60" @click.self="close">
    <div class="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden m-4" @click.stop>
      <!-- Header -->
      <div class="px-6 py-4 border-b border-[var(--border-color)] flex justify-between items-center">
        <h3 class="text-xl font-bold text-[var(--text-main)]">编辑资源</h3>
        <button @click="close" class="p-2 rounded-lg hover:bg-[var(--bg-body)] transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--text-sub)]"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
        </button>
      </div>

      <!-- Body -->
      <div class="p-6 max-h-[70vh] overflow-y-auto">
        <div class="grid gap-5">
          <!-- Image Preview -->
          <div v-if="resolveImageUrl" class="rounded-xl overflow-hidden bg-[var(--bg-body)]">
            <img v-if="imageUrl" :src="imageUrl" class="w-full h-64 object-cover" @error="$emit('imageError', $event)" />
            <div v-else class="w-full h-64 flex items-center justify-center text-[var(--text-sub)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
            </div>
          </div>

          <!-- Title -->
          <label class="block">
            <span class="text-sm font-medium text-[var(--text-main)] mb-1.5 block">标题</span>
            <input v-model="localForm.title" class="w-full px-4 py-2 rounded-lg bg-[var(--bg-body)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] transition-colors" placeholder="素材名称" />
          </label>

          <!-- Type & Status -->
          <div class="grid grid-cols-2 gap-4">
            <label class="block">
              <span class="text-sm font-medium text-[var(--text-main)] mb-1.5 block">类型</span>
              <select v-model="localForm.type" class="w-full px-4 py-2 rounded-lg bg-[var(--bg-body)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] transition-colors">
                <option value="avatar">头像</option>
                <option value="wallpaper">壁纸</option>
              </select>
            </label>
            <label class="block">
              <span class="text-sm font-medium text-[var(--text-main)] mb-1.5 block">状态</span>
              <select v-model="localForm.status" class="w-full px-4 py-2 rounded-lg bg-[var(--bg-body)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] transition-colors">
                <option value="draft">草稿</option>
                <option value="review">待审</option>
                <option value="published">已发布</option>
                <option value="offline">已下线</option>
              </select>
            </label>
          </div>

          <!-- Categories -->
          <label class="block">
            <span class="text-sm font-medium text-[var(--text-main)] mb-1.5 block">
              分类
              <span class="text-xs text-[var(--text-sub)] font-normal ml-1">(点击下方标签添加)</span>
            </span>
            <input v-model="localForm.categoriesStr" class="w-full px-4 py-2 rounded-lg bg-[var(--bg-body)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] transition-colors" placeholder="例如：动态头像,女生" />

            <!-- Quick category selection (only when categories list is provided) -->
            <div v-if="categories && categories.length" class="mt-3 p-3 bg-[var(--bg-body)] rounded-lg border border-[var(--border-color)]">
              <div class="text-xs text-[var(--text-sub)] mb-2">快速选择：</div>
              <div class="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                <span
                  v-for="cat in categories"
                  :key="cat._id"
                  class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] cursor-pointer hover:border-green-500 hover:text-green-600 transition-all shadow-sm select-none"
                  @click="addCategory(cat.name)"
                >
                  + {{ cat.name }}
                </span>
              </div>
            </div>
          </label>

          <!-- Tags -->
          <label class="block">
            <span class="text-sm font-medium text-[var(--text-main)] mb-1.5 block">标签（逗号分隔）</span>
            <textarea v-model="localForm.tags" class="w-full px-4 py-2 rounded-lg bg-[var(--bg-body)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] transition-colors min-h-[80px]" placeholder="例如：治愈,简约,几何"></textarea>
          </label>

          <!-- Hot Data (optional, for ResourcesPage) -->
          <div v-if="showHotData" class="border-t border-[var(--border-color)] pt-5 mt-2">
            <p class="text-sm font-medium text-[var(--text-sub)] mb-3">热门数据（手动调整）</p>
            <div class="grid grid-cols-3 gap-4">
              <label class="block">
                <span class="text-xs font-medium text-[var(--text-main)] mb-1 block">热度值</span>
                <input
                  v-model.number="localForm.hotScore"
                  type="number"
                  min="0"
                  class="w-full px-4 py-2 rounded-lg bg-[var(--bg-body)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                  placeholder="如：5000"
                />
              </label>
              <label class="block">
                <span class="text-xs font-medium text-[var(--text-main)] mb-1 block">下载量</span>
                <input
                  v-model.number="localForm.downloads"
                  type="number"
                  min="0"
                  class="w-full px-4 py-2 rounded-lg bg-[var(--bg-body)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                  placeholder="如：1000"
                />
              </label>
              <label class="block">
                <span class="text-xs font-medium text-[var(--text-main)] mb-1 block">浏览量</span>
                <input
                  v-model.number="localForm.views"
                  type="number"
                  min="0"
                  class="w-full px-4 py-2 rounded-lg bg-[var(--bg-body)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                  placeholder="如：500"
                />
              </label>
            </div>
            <p class="text-xs text-[var(--text-sub)] mt-2">调整后会直接影响首页热门排行榜数据</p>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 bg-[var(--bg-body)] border-t border-[var(--border-color)] flex justify-end gap-3">
        <button class="px-4 py-2 text-sm font-medium text-[var(--text-main)] hover:bg-[var(--border-color)] rounded-lg transition-colors" @click="close">取消</button>
        <button class="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-2" @click="handleSave">
          <span>保存更改</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

const props = withDefaults(defineProps<{
  visible: boolean;
  resource: any;
  resolveImageUrl?: ((item: any) => string) | null;
  showHotData?: boolean;
  categories?: any[];
}>(), {
  resolveImageUrl: null,
  showHotData: false,
  categories: () => [],
});

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'save', data: any): void;
  (e: 'imageError', event: Event): void;
}>();

const localForm = ref<any>(null);

const imageUrl = computed(() => {
  if (!props.resource || !props.resolveImageUrl) return '';
  return props.resolveImageUrl(props.resource);
});

watch(() => props.visible, (val) => {
  if (val && props.resource) {
    initForm();
  }
});

const initForm = () => {
  try {
    const copy = JSON.parse(JSON.stringify(props.resource));

    // Ensure type has a valid default
    if (!copy.type || (copy.type !== 'avatar' && copy.type !== 'wallpaper')) {
      copy.type = 'wallpaper';
    }

    localForm.value = {
      ...copy,
      tags: Array.isArray(copy.tags) ? copy.tags.join(',') : copy.tags || '',
      categoriesStr: Array.isArray(copy.categories) ? copy.categories.join(',') : (copy.category || ''),
    };
  } catch (_err) {
    localForm.value = null;
  }
};

const close = () => {
  emit('update:visible', false);
};

const addCategory = (catName: string) => {
  if (!localForm.value) return;
  const currentStr = String(localForm.value.categoriesStr || '');
  const current = currentStr.split(/[,，]/).map((t: string) => t.trim()).filter(Boolean);
  if (!current.includes(catName)) {
    current.push(catName);
    localForm.value.categoriesStr = current.join(',');
  }
};

const handleSave = () => {
  if (!localForm.value) return;

  const tagsStr = String(localForm.value.tags || '');
  const parsedTags = tagsStr
    .split(/[,，]/)
    .map((t: string) => t.trim())
    .filter(Boolean);

  const categoriesStr = String(localForm.value.categoriesStr || '');
  const parsedCategories = categoriesStr
    .split(/[,，]/)
    .map((t: string) => t.trim())
    .filter(Boolean);

  const mainCategory = parsedCategories.length > 0 ? parsedCategories[0] : '';

  // Ensure type is valid
  let saveType = localForm.value.type;
  if (!saveType || (saveType !== 'avatar' && saveType !== 'wallpaper')) {
    saveType = 'wallpaper';
  }

  const updateData: Record<string, any> = {
    _id: localForm.value._id,
    title: localForm.value.title,
    type: saveType,
    status: localForm.value.status,
    category: mainCategory,
    categories: parsedCategories,
    tags: parsedTags,
  };

  if (props.showHotData) {
    updateData.hotScore = Number(localForm.value.hotScore) || 0;
    updateData.downloads = Number(localForm.value.downloads) || 0;
    updateData.views = Number(localForm.value.views) || 0;
  }

  emit('save', updateData);
};
</script>
