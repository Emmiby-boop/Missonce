<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
    <div class="bg-[var(--bg-card)] rounded-2xl shadow-xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-[var(--border-color)]">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-card)] shrink-0">
        <h3 class="text-lg font-bold text-[var(--text-main)]">选择资源</h3>
        <button class="p-1.5 rounded-lg text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-[var(--bg-body)] transition-colors" @click="$emit('close')">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Toolbar -->
      <div class="px-6 py-3 border-b border-[var(--border-color)] bg-[var(--bg-body)] flex flex-wrap gap-3 shrink-0">
        <!-- Upload Button -->
        <label class="btn-soft text-sm gap-2 cursor-pointer">
          <input type="file" multiple accept="image/*" class="hidden" @change="handleUpload" :disabled="uploading" />
          <svg v-if="!uploading" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span v-else class="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          {{ uploading ? '上传中...' : '上传新素材' }}
        </label>

        <!-- Filters -->
        <select v-model="filters.type" class="select w-40">
          <option value="">所有类型</option>
          <option value="wallpaper">壁纸</option>
          <option value="avatar">头像</option>
        </select>

        <input v-model="filters.keyword" class="input input-sm w-48" placeholder="搜索标题..." @keyup.enter="applyFilters" />

        <button class="btn" @click="applyFilters">搜索</button>

        <div class="ml-auto flex items-center gap-2">
          <span class="text-xs text-[var(--text-sub)]">已选: {{ selectedIds.length }}</span>
          <button class="btn-soft" @click="confirmSelection" :disabled="selectedIds.length === 0">
            确认选择
          </button>
        </div>
      </div>

      <!-- Grid -->
      <div
        class="flex-1 overflow-y-auto p-6 bg-[var(--bg-body)] relative"
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop.prevent="handleDrop"
      >
        <!-- Drag Overlay -->
        <div v-if="dragOver" class="absolute inset-0 z-10 bg-[var(--primary)]/10 backdrop-blur-sm border-4 border-[var(--primary)] border-dashed border-opacity-40 flex items-center justify-center">
          <div class="text-[var(--primary)] font-bold text-xl pointer-events-none">释放以上传文件</div>
        </div>

        <div v-if="loading" class="flex justify-center py-10">
          <span class="inline-block w-8 h-8 border-2 border-[var(--border-color)] border-t-[var(--primary)] rounded-full animate-spin"></span>
        </div>

        <div v-else-if="list.length === 0" class="flex flex-col items-center justify-center py-20 text-[var(--text-sub)]">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p>暂无资源</p>
        </div>

        <div v-else class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
          <div
            v-for="item in list"
            :key="item._id"
            class="group relative bg-[var(--bg-card)] rounded-lg overflow-hidden border-2 transition-all cursor-pointer shadow-sm hover:shadow-md"
            :class="selectedIds.includes(item._id) ? 'border-[var(--primary)]' : 'border-transparent hover:border-[var(--border-color)]'"
            @click="toggleSelection(item)"
          >
            <!-- Image -->
            <div class="aspect-[3/4] bg-[var(--bg-body)] relative">
              <img
                v-if="item.previewUrl"
                :src="item.previewUrl"
                class="w-full h-full object-cover"
                loading="lazy"
              />
              <div v-else class="w-full h-full flex items-center justify-center text-xs text-[var(--text-sub)]">无图</div>

              <!-- Selected Badge -->
              <div v-if="selectedIds.includes(item._id)" class="absolute top-2 right-2 bg-[var(--primary)] text-white rounded-full p-1 shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
              </div>
            </div>

            <!-- Info -->
            <div class="p-2 text-xs">
              <div class="font-medium truncate text-[var(--text-main)]">{{ item.title || '未命名' }}</div>
              <div class="flex items-center gap-1 mt-1 text-[var(--text-sub)]">
                <span class="px-1 py-0.5 bg-[var(--bg-body)] rounded text-[10px]">{{ item.type === 'avatar' ? '头像' : '壁纸' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div class="px-6 py-3 border-t border-[var(--border-color)] bg-[var(--bg-card)] flex justify-between items-center shrink-0">
        <span class="text-xs text-[var(--text-sub)]">共 {{ total }} 条</span>
        <div class="flex items-center gap-1">
          <button class="btn text-sm" :disabled="page === 1" @click="changePage(-1)">上一页</button>
          <span class="px-3 py-1.5 text-sm text-[var(--text-sub)]">第 {{ page }} 页</span>
          <button class="btn text-sm" :disabled="page * pageSize >= total" @click="changePage(1)">下一页</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { useMessage } from 'naive-ui';
import { db, app, callFunctionWithAuth } from '../utils/cloudbase';

const message = useMessage();

const emit = defineEmits(['close', 'select']);
const props = defineProps<{
  initialSelected?: string[],
  limit?: number // 0 for unlimited
}>();

const list = ref<any[]>([]);
const loading = ref(false);
const uploading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = 24;
const selectedIds = ref<string[]>(props.initialSelected || []);
const selectedItems = ref<any[]>([]); // To pass back full objects if needed

const filters = reactive({
  keyword: '',
  type: ''
});

onMounted(() => {
  fetchList();
});

const fetchList = async () => {
  loading.value = true;
  try {
    const where: any = {};
    if (filters.type) where.type = filters.type;
    if (filters.keyword) where.title = db.RegExp({ regexp: filters.keyword, options: 'i' });

    const [countRes, listRes] = await Promise.all([
      db.collection('resources').where(where).count(),
      db.collection('resources')
        .where(where)
        .orderBy('createdAt', 'desc')
        .skip((page.value - 1) * pageSize)
        .limit(pageSize)
        .get()
    ]);

    total.value = countRes.total;
    const items = listRes.data || [];

    // Get temp URLs
    const fileList = items.map((i: any) => i.coverUrl || i.originUrl).filter(Boolean);
    if (fileList.length > 0) {
      const urlRes = await app.getTempFileURL({ fileList: fileList.map((f: string) => ({ fileID: f, maxAge: 3600 })) });
      const urlMap = new Map((urlRes.fileList || []).map((f: any) => [f.fileID, f.tempFileURL]));
      items.forEach((i: any) => {
        i.previewUrl = urlMap.get(i.coverUrl || i.originUrl) || '';
      });
    }

    list.value = items;
  } catch (err) {
    console.error(err);
    message.error('加载失败');
  } finally {
    loading.value = false;
  }
};

const applyFilters = () => {
  page.value = 1;
  fetchList();
};

const changePage = (delta: number) => {
  page.value += delta;
  fetchList();
};

const toggleSelection = (item: any) => {
  const idx = selectedIds.value.indexOf(item._id);
  if (idx > -1) {
    selectedIds.value.splice(idx, 1);
    const itemIdx = selectedItems.value.findIndex(i => i._id === item._id);
    if (itemIdx > -1) selectedItems.value.splice(itemIdx, 1);
  } else {
    // Check limit
    if (props.limit === 1) {
      selectedIds.value = [item._id];
      selectedItems.value = [item];
    } else {
      if (props.limit && selectedIds.value.length >= props.limit) {
        message.warning(`最多选择 ${props.limit} 项`);
        return;
      }
      selectedIds.value.push(item._id);
      selectedItems.value.push(item);
    }
  }
};

const dragOver = ref(false);

const handleDrop = (e: DragEvent) => {
  dragOver.value = false;
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    handleUploadFiles(files);
  }
};

const handleUpload = async (e: Event) => {
  const files = (e.target as HTMLInputElement).files;
  if (files && files.length > 0) {
    handleUploadFiles(files);
  }
};

const handleUploadFiles = async (files: FileList) => {
  uploading.value = true;
  try {
    for (const file of Array.from(files)) {
      const cloudPath = `resources/${Date.now()}-${file.name}`;
      const uploadRes = await app.uploadFile({
        cloudPath,
        filePath: file as unknown as string
      });

      await callFunctionWithAuth('uploadResource', {
        title: file.name.split('.')[0],
        type: 'auto', // Auto detect in cloud function if possible, or default
        status: 'published',
        coverUrl: uploadRes.fileID,
        originUrl: uploadRes.fileID,
        skipAI: true
      });
    }
    await fetchList();
    message.success('上传成功');
  } catch (err) {
    console.error(err);
    message.error('上传失败');
  } finally {
    uploading.value = false;
  }
};

const confirmSelection = () => {
  emit('select', selectedIds.value, selectedItems.value);
  emit('close');
};
</script>

<style scoped>
.input, .select {
  padding: 0.625rem 0.875rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  color: var(--text-main);
  font-size: 0.875rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.input:focus, .select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(7, 193, 96, 0.1);
}

.input-sm {
  padding: 0.375rem 0.625rem;
  font-size: 0.8125rem;
}

.select {
  cursor: pointer;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s;
  background-color: var(--bg-body);
  color: var(--text-main);
  border: 1px solid var(--border-color);
  cursor: pointer;
}

.btn:hover:not(:disabled) {
  background-color: var(--bg-card);
  border-color: var(--primary);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
