<template>
  <div class="space-y-6">
    <!-- Header -->
    <section class="glass-panel">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="panel-title">轮播图管理</h2>
          <p class="panel-sub">管理首页轮播展示内容</p>
        </div>
        <div class="flex gap-2">
          <button v-if="selectedBanners.length > 0" class="btn-soft bg-red-500/10 text-red-500 border border-red-200 hover:bg-red-500/20" @click="batchDelete">
            批量删除 ({{ selectedBanners.length }})
          </button>
          <button v-if="selectedBanners.length > 0" class="btn-soft" @click="batchToggleStatus">
            批量{{ hasActiveSelected ? '停用' : '启用' }}
          </button>
          <button class="btn-soft" @click="openModal()">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
            </svg>
            新增轮播
          </button>
        </div>
      </div>
    </section>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="i in 6" :key="i" class="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden animate-pulse">
        <div class="aspect-video bg-[var(--border-color)]"></div>
        <div class="p-4 space-y-3">
          <div class="h-5 bg-[var(--border-color)] rounded w-3/4"></div>
          <div class="h-3 bg-[var(--border-color)] rounded w-1/2"></div>
        </div>
      </div>
    </div>

    <!-- Banner Grid -->
    <div v-else-if="banners.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div 
        v-for="item in banners" 
        :key="item._id" 
        class="group relative bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] overflow-hidden hover:shadow-md transition-all duration-300"
        :class="{'ring-2 ring-[var(--primary)]': selectedBanners.includes(item._id)}"
      >
        <!-- Checkbox -->
        <div class="absolute top-3 left-3 z-10">
          <input
            type="checkbox"
            :value="item._id"
            v-model="selectedBanners"
            class="w-5 h-5 rounded border-[var(--border-color)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
          />
        </div>
        
        <!-- Image Cover -->
        <div class="aspect-video w-full bg-[var(--bg-body)] relative overflow-hidden">
          <img :src="item.image" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60"></div>
          
          <!-- Status Badge -->
          <div class="absolute top-3 right-3">
            <span 
              class="px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-md shadow-sm border"
              :class="item.status === 'active' 
                ? 'bg-green-500/10 text-white border-white/20' 
                : 'bg-slate-500/10 text-white border-white/20'"
            >
              {{ item.status === 'active' ? '已启用' : '已停用' }}
            </span>
          </div>

          <!-- Title Overlay -->
          <div class="absolute bottom-3 left-3 right-3 text-white">
            <h3 class="font-bold text-lg truncate shadow-black drop-shadow-sm">{{ item.title }}</h3>
            <p class="text-xs text-white/80 flex items-center gap-2 mt-1">
              <span class="bg-white/20 px-1.5 py-0.5 rounded backdrop-blur-sm">
                {{ getTypeName(item.type) }}
              </span>
              <span class="truncate opacity-80">{{ item.target }}</span>
            </p>
          </div>
        </div>

        <!-- Action Footer -->
        <div class="px-4 py-3 bg-[var(--bg-card)] flex items-center justify-between gap-4">
          <div class="flex items-center gap-2 text-sm text-[var(--text-sub)]">
            <span class="text-xs font-medium bg-[var(--bg-body)] px-2 py-1 rounded text-[var(--text-main)]">排序: {{ item.sort }}</span>
          </div>
          
          <div class="flex items-center gap-1">
            <button 
              class="p-2 text-[var(--text-sub)] hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
              @click="editBanner(item)" 
              title="编辑"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
            <button 
              class="p-2 text-[var(--text-sub)] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
              @click="removeBanner(item._id)" 
              title="删除"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 000-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 border-dashed">
      <div class="w-16 h-16 bg-slate-50 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-slate-300 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <p class="text-slate-500 dark:text-slate-400 font-medium">暂无轮播图</p>
      <button class="btn btn-ghost btn-sm mt-2 text-[#07c160]" @click="openModal()">立即添加</button>
    </div>

    <!-- Edit/Create Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" @click.stop>
        <div class="px-6 py-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h3 class="text-lg font-bold text-slate-800 dark:text-white">{{ editingId ? '编辑轮播' : '新增轮播' }}</h3>
          <button class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" @click="closeModal">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div class="p-6 space-y-5">
          <!-- Image Upload -->
          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700 dark:text-slate-300">封面图片</label>
            <div class="w-full aspect-video bg-slate-50 dark:bg-gray-700 rounded-xl border-2 border-dashed border-slate-300 dark:border-gray-600 flex flex-col items-center justify-center relative overflow-hidden group hover:border-primary/50 transition-colors">
              <img v-if="form.image" :src="form.image" class="w-full h-full object-cover" />
              <div v-else class="text-center p-4">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 mx-auto text-slate-300 dark:text-slate-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p class="text-sm text-slate-500 dark:text-slate-400">点击上传或拖拽图片</p>
              </div>
              
              <!-- Hover Overlay for Replace/Delete -->
              <div v-if="form.image" class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-2">
                <button class="btn btn-sm btn-ghost text-white border-white/30 hover:bg-white/20" @click="triggerFileInput">更换</button>
                <button class="btn btn-sm btn-ghost text-white border-white/30 hover:bg-red-500/50 hover:border-red-500/50" @click="form.image = ''">删除</button>
              </div>
              
              <input 
                ref="fileInputRef"
                type="file" 
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                :class="{'pointer-events-none': form.image}"
                accept="image/*"
                @change="handleFileChange"
              />
            </div>
            <p v-if="uploading" class="text-sm text-primary animate-pulse">正在上传图片...</p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-slate-700 dark:text-slate-300">标题</label>
              <input v-model="form.title" class="input input-bordered w-full" placeholder="输入轮播标题" />
            </div>
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-slate-700 dark:text-slate-300">排序</label>
              <input v-model.number="form.sort" type="number" class="input input-bordered w-full" placeholder="0" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-slate-700 dark:text-slate-300">跳转类型</label>
              <select v-model="form.type" class="select select-bordered w-full">
                <option value="page">内部页面</option>
                <option value="webview">网页链接</option>
                <option value="resource">资源详情</option>
              </select>
            </div>
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-slate-700 dark:text-slate-300">状态</label>
              <select v-model="form.status" class="select select-bordered w-full">
                <option value="active">启用</option>
                <option value="inactive">停用</option>
              </select>
            </div>
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium text-slate-700 dark:text-slate-300">跳转目标</label>
            <input 
              v-model="form.target" 
              class="input input-bordered w-full" 
              :placeholder="targetPlaceholder" 
            />
            <p class="text-xs text-slate-400 dark:text-slate-500">
              {{ form.type === 'page' ? '小程序内部页面路径' : form.type === 'webview' ? '以 https:// 开头的外部链接' : '填写资源的 ID' }}
            </p>
          </div>
        </div>

        <div class="px-6 py-4 border-t border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/50 flex justify-end gap-3 rounded-b-2xl">
          <button class="btn btn-ghost" @click="closeModal">取消</button>
          <button class="btn bg-[#07c160] hover:bg-[#06ad56] text-white border-none px-8" @click="saveBanner" :disabled="uploading || !form.title || !form.image">
            {{ editingId ? '保存更改' : '立即创建' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, computed } from "vue";
import { app, serverDate } from "../utils/cloudbase";
import { useToast } from "../composables/useToast";
import { useCache } from "../composables/useCache";

const { success, error, confirm } = useToast();
const { get: getCache, set: setCache, clear: clearCache } = useCache<any[]>('banners_cache');

const banners = ref<any[]>([]);
const loading = ref(false);
const selectedBanners = ref<string[]>([]);
const editingId = ref<string | null>(null);
const uploading = ref(false);
const showModal = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

const hasActiveSelected = computed(() => {
  return selectedBanners.value.some(id => {
    const banner = banners.value.find(b => b._id === id);
    return banner?.status === 'active';
  });
});

const form = reactive({
  title: "",
  image: "",
  type: "page",
  target: "",
  sort: 0,
  status: "active",
});

const targetPlaceholder = computed(() => {
  switch (form.type) {
    case 'page': return '例如: /pages/wallpaper/wallpaper';
    case 'webview': return '例如: https://example.com';
    case 'resource': return '输入资源ID';
    default: return '跳转目标';
  }
});

const getTypeName = (type: string) => {
  const map: Record<string, string> = {
    page: '内部页面',
    webview: '网页链接',
    resource: '资源详情'
  };
  return map[type] || type;
};

const triggerFileInput = () => {
  fileInputRef.value?.click();
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
  form.image = "";
  form.type = "page";
  form.target = "";
  form.sort = 0;
  form.status = "active";
};

const fetchBanners = async () => {
  loading.value = true;
  
  const cached = getCache();
  if (cached) {
    banners.value = cached;
    loading.value = false;
  }

  try {
    const res = await app.callFunction({
      name: "adminBanners",
      data: {
        action: "getAll"
      }
    });
    
    if (res.result && res.result.success) {
      const data = res.result.data || [];
      banners.value = data;
      setCache(data);
    } else {
      console.error("获取轮播图失败:", res.result?.message);
      banners.value = [];
    }
  } catch (error) {
    console.error("Fetch banners error:", error);
    banners.value = [];
  } finally {
    loading.value = false;
  }
};

const batchToggleStatus = async () => {
  if (selectedBanners.value.length === 0) return;
  
  const newStatus = hasActiveSelected.value ? 'inactive' : 'active';
  const confirmed = await confirm(`确定要将选中的 ${selectedBanners.value.length} 个轮播图${newStatus === 'active' ? '启用' : '停用'}吗？`);
  if (!confirmed) return;

  try {
    const res = await app.callFunction({
      name: "adminBanners",
      data: {
        action: "batchToggleStatus",
        data: {
          ids: selectedBanners.value,
          status: newStatus
        }
      }
    });
    
    if (res.result && res.result.success) {
      success(res.result.message);
      selectedBanners.value = [];
      clearCache();
      await fetchBanners();
    } else {
      error('操作失败: ' + (res.result?.message || '未知错误'));
    }
  } catch (err: any) {
    error('操作失败: ' + err.message);
  }
};

const batchDelete = async () => {
  if (selectedBanners.value.length === 0) return;
  
  const confirmed = await confirm(`确定要删除选中的 ${selectedBanners.value.length} 个轮播图吗？此操作不可恢复。`);
  if (!confirmed) return;

  try {
    const res = await app.callFunction({
      name: "adminBanners",
      data: {
        action: "batchDelete",
        data: {
          ids: selectedBanners.value
        }
      }
    });
    
    if (res.result && res.result.success) {
      success(res.result.message);
      selectedBanners.value = [];
      clearCache();
      await fetchBanners();
    } else {
      error('删除失败: ' + (res.result?.message || '未知错误'));
    }
  } catch (err: any) {
    error('删除失败: ' + err.message);
  }
};

const editBanner = (item: any) => {
  editingId.value = item._id;
  form.title = item.title;
  form.image = item.image;
  form.type = item.type;
  form.target = item.target;
  form.sort = item.sort;
  form.status = item.status;
  showModal.value = true;
};

const handleFileChange = async (e: Event) => {
  const files = (e.target as HTMLInputElement).files;
  if (!files || files.length === 0) return;

  const file = files[0];
  if (!file) return;

  uploading.value = true;
  
  try {
    const cloudPath = `banners/${Date.now()}-${file.name}`;
    const res = await app.uploadFile({
      cloudPath,
      filePath: file as any,
    });
    
    // Get temp URL for preview
    const urlRes = await app.getTempFileURL({
      fileList: [res.fileID]
    });
    
    if (urlRes.fileList && urlRes.fileList[0]) {
      form.image = urlRes.fileList[0].tempFileURL;
    }
  } catch (error) {
    console.error("Upload failed:", error);
    ElMessage.error("上传失败");
  } finally {
    uploading.value = false;
  }
};

const saveBanner = async () => {
  if (!form.title || !form.image) {
    error("请填写标题并上传图片");
    return;
  }

  try {
    const data = {
      title: form.title,
      image: form.image,
      type: form.type,
      target: form.target,
      sort: form.sort,
      status: form.status
    };

    let res;
    if (editingId.value) {
      res = await app.callFunction({
        name: "adminBanners",
        data: {
          action: "update",
          id: editingId.value,
          data: data
        }
      });
    } else {
      res = await app.callFunction({
        name: "adminBanners",
        data: {
          action: "add",
          data: data
        }
      });
    }

    if (res.result && res.result.success) {
      success(res.result.message || (editingId.value ? "更新成功" : "创建成功"));
      closeModal();
      clearCache();
      await fetchBanners();
    } else {
      error("保存失败: " + (res.result?.message || "未知错误"));
    }
  } catch (error: any) {
    console.error("Save banner error:", error);
    error("保存失败: " + (error.message || JSON.stringify(error)));
  }
};

const removeBanner = async (id: string) => {
  const confirmed = await confirm("确定要删除这个轮播图吗？");
  if (!confirmed) return;
  
  try {
    const res = await app.callFunction({
      name: "adminBanners",
      data: {
        action: "delete",
        id: id
      }
    });
    
    if (res.result && res.result.success) {
      success(res.result.message || "删除成功");
      clearCache();
      await fetchBanners();
    } else {
      error("删除失败: " + (res.result?.message || "未知错误"));
    }
  } catch (error: any) {
    console.error("Remove banner error:", error);
    error("删除失败: " + error.message);
  }
};

onMounted(() => {
  fetchBanners();
});
</script>

<style scoped>
/* No custom styles needed, using Tailwind */
</style>
