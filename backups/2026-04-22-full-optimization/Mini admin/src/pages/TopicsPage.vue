<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="glass-panel">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="panel-title">专题管理</h2>
          <p class="panel-sub">创建和管理精选专题页面</p>
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

    <!-- Topics Grid -->
    <div v-else-if="topics.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div 
        v-for="item in topics" 
        :key="item._id" 
        class="group relative bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
        :class="{'ring-2 ring-[var(--primary)]': selectedTopics.includes(item._id)}"
      >
        <!-- Checkbox -->
        <div class="absolute top-3 right-3 z-10">
          <input
            type="checkbox"
            :value="item._id"
            v-model="selectedTopics"
            class="w-5 h-5 rounded border-[var(--border-color)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
          />
        </div>
        
        <!-- Cover Image -->
        <div class="aspect-video w-full bg-[var(--bg-body)] relative overflow-hidden cursor-pointer" @click="navigateToDesigner(item._id)">
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
          <div 
            class="absolute top-3 left-3 cursor-pointer group/status"
            @click.stop="toggleStatus(item)"
          >
            <span 
              class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-md shadow-sm border transition-all duration-200"
              :style="item.status === 'active' 
                ? { background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)' } 
                : { background: 'rgba(100, 116, 139, 0.2)', color: '#64748b', border: '1px solid rgba(100, 116, 139, 0.3)' }"
            >
              <span class="w-1.5 h-1.5 rounded-full" :style="{ background: item.status === 'active' ? '#22c55e' : '#64748b' }"></span>
              {{ item.status === 'active' ? '已启用' : '已停用' }}
            </span>
          </div>

          <!-- Resource Type Badge -->
          <div class="absolute top-3 right-12" v-if="item.resourceType && item.resourceType !== 'all'">
            <span 
              class="px-2 py-0.5 rounded text-xs font-medium backdrop-blur-sm border"
              :style="item.resourceType === 'avatar' 
                ? { background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', border: '1px solid rgba(139, 92, 246, 0.3)' }
                : { background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }"
            >
              {{ item.resourceType === 'avatar' ? '头像' : '壁纸' }}
            </span>
          </div>

          <!-- Title Overlay -->
          <div class="absolute bottom-0 left-0 right-0 p-3 text-white">
            <h3 class="font-bold text-base truncate drop-shadow-lg">{{ item.title }}</h3>
            <div class="flex flex-wrap gap-1.5 mt-1.5">
              <span class="bg-white/20 backdrop-blur-sm px-1.5 py-0.5 rounded text-xs text-white/90">
                {{ item.filterType === 'tag' ? '标签' : '分类' }}: {{ item.filterValue }}
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
            <button 
              class="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-colors" 
              @click="navigateToDesigner(item._id)" 
              title="设计与管理"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              管理
            </button>
            <button 
              class="p-1.5 text-[var(--text-sub)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors" 
              @click="deleteTopic(item._id)" 
              title="删除"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 000-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="flex flex-col items-center justify-center py-20 bg-[var(--bg-card)] rounded-2xl border-2 border-dashed border-[var(--border-color)]">
      <div class="w-20 h-20 bg-[var(--bg-body)] rounded-full flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-[var(--text-sub)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <p class="text-[var(--text-sub)] font-medium text-lg">暂无专题</p>
      <p class="text-[var(--text-sub)] text-sm mt-1">点击下方按钮创建第一个专题</p>
      <button class="btn-soft mt-4" @click="openCreateModal()">立即创建</button>
    </div>

    <!-- Create Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--text-main)]/60 backdrop-blur-sm" @click="closeModal">
      <div class="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto transform transition-all border border-[var(--border-color)]" @click.stop>
        <div class="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between sticky top-0 bg-[var(--bg-card)] z-10">
          <h3 class="text-lg font-bold text-[var(--text-main)]">新增专题</h3>
          <button class="text-[var(--text-sub)] hover:text-[var(--text-main)] p-1 rounded-lg hover:bg-[var(--bg-body)] transition-colors" @click="closeModal">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
        
        <div class="p-6 space-y-5">
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-[var(--text-main)]">专题标题</label>
            <input 
              v-model="form.title" 
              class="input w-full" 
              placeholder="例如：二次元专场"
              @keyup.enter="createTopic"
            />
          </div>

          <div class="bg-[var(--bg-body)] rounded-xl p-4 border border-[var(--border-color)] space-y-4">
             <div class="flex items-center gap-2 text-[var(--text-main)] font-medium pb-2 border-b border-[var(--border-color)]/50">
               <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[var(--primary)]" viewBox="0 0 20 20" fill="currentColor">
                 <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
               </svg>
               筛选规则 (必填)
             </div>
             
             <div class="grid grid-cols-3 gap-4">
               <div class="col-span-1 space-y-1.5">
                 <label class="text-sm font-medium text-[var(--text-sub)]">筛选类型</label>
                 <select v-model="form.filterType" class="select w-full">
                   <option value="tag">标签</option>
                   <option value="category">分类</option>
                 </select>
               </div>
               <div class="col-span-2 space-y-1.5">
                 <label class="text-sm font-medium text-[var(--text-sub)]">筛选值</label>
                 <input v-model="form.filterValue" class="input w-full" placeholder="例如：可爱" />
               </div>
             </div>
          </div>
          
          <div class="flex items-start gap-2 text-xs text-[var(--text-sub)] bg-[var(--bg-body)] p-3 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>创建后可进入详细设计页面配置封面、描述、布局等更多选项</span>
          </div>
        </div>

        <div class="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-body)] flex justify-end gap-3 rounded-b-2xl">
          <button class="px-4 py-2 text-sm font-medium text-[var(--text-sub)] hover:bg-[var(--bg-card)] rounded-lg transition-colors" @click="closeModal">取消</button>
          <button 
            class="btn-soft px-6" 
            @click="createTopic" 
            :disabled="!form.title || !form.filterValue || creating"
          >
            <svg v-if="creating" class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ creating ? '创建中...' : '创建并设计' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, computed } from "vue";
import { useRouter } from "vue-router";
import { db, serverDate, callCloudFunction } from "../utils/cloudbase";
import { useToast } from '../composables/useToast';
import { useCache } from '../composables/useCache';

const { success, error: toastError, confirm } = useToast();
const { get: getCache, set: setCache, clear: clearCache } = useCache<any[]>('topics_cache');

const router = useRouter();
const topics = ref<any[]>([]);
const loading = ref(false);
const showModal = ref(false);
const creating = ref(false);
const selectedTopics = ref<string[]>([]);

const hasActiveSelected = computed(() => {
  return selectedTopics.value.some(id => {
    const topic = topics.value.find(t => t._id === id);
    return topic?.status === 'active';
  });
});

const form = reactive({
  title: "",
  filterType: "tag", 
  filterValue: "",
  status: "active",
  sort: 0,
  resourceType: "all",
  defaultSort: "latest"
});

onMounted(() => {
  loadTopics();
});

const loadTopics = async () => {
  loading.value = true;
  
  console.log('开始加载专题数据...');
  
  try {
    const res = await callCloudFunction("getTopics", {});
    console.log('云函数查询结果:', res);
    const data = res.data || [];
    console.log('专题数据:', data);
    topics.value = data;
    setCache(data);
  } catch (err) {
    console.error("加载专题失败", err);
    toastError('加载失败，请刷新重试');
  } finally {
    loading.value = false;
  }
};

const openCreateModal = () => {
  form.title = "";
  form.filterType = "tag";
  form.filterValue = "";
  form.status = "active";
  form.sort = topics.value.length;
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
};

const createTopic = async () => {
  if (!form.title || !form.filterValue || creating.value) return;
  
  creating.value = true;
  try {
    const res = await db.collection("topics").add({
      ...form,
      createTime: serverDate(),
      description: "",
      cover: ""
    });
    
    closeModal();
    success('专题创建成功');
    clearCache();
    loadTopics();
    navigateToDesigner((res as any).id);
  } catch (err) {
    console.error("创建失败", err);
    toastError('创建失败，请重试');
  } finally {
    creating.value = false;
  }
};

const navigateToDesigner = (id: string) => {
  router.push(`/topic-layout/${id}`);
};

const toggleStatus = async (item: any) => {
  const newStatus = item.status === 'active' ? 'inactive' : 'active';
  try {
    await db.collection("topics").doc(item._id).update({ status: newStatus });
    item.status = newStatus;
    success(newStatus === 'active' ? '已启用' : '已停用');
    clearCache();
  } catch (err) {
    console.error("状态更新失败", err);
    toastError('状态更新失败');
  }
};

const batchToggleStatus = async () => {
  if (selectedTopics.value.length === 0) return;
  
  const newStatus = hasActiveSelected.value ? 'inactive' : 'active';
  const confirmed = await confirm(`确定要将选中的 ${selectedTopics.value.length} 个专题${newStatus === 'active' ? '启用' : '停用'}吗？`);
  if (!confirmed) return;

  try {
    const promises = selectedTopics.value.map(id => 
      db.collection("topics").doc(id).update({ status: newStatus })
    );
    await Promise.all(promises);
    
    success(`已成功${newStatus === 'active' ? '启用' : '停用'} ${selectedTopics.value.length} 个专题`);
    selectedTopics.value = [];
    clearCache();
    await loadTopics();
  } catch (err: any) {
    toastError('操作失败: ' + err.message);
  }
};

const deleteTopic = async (id: string) => {
  const confirmed = await confirm("确定要删除这个专题吗？此操作不可恢复。");
  if (!confirmed) return;
  
  try {
    await db.collection("topics").doc(id).remove();
    success('删除成功');
    clearCache();
    loadTopics();
  } catch (err) {
    console.error("删除失败", err);
    toastError('删除失败，请重试');
  }
};

const batchDelete = async () => {
  if (selectedTopics.value.length === 0) return;
  
  const confirmed = await confirm(`确定要删除选中的 ${selectedTopics.value.length} 个专题吗？此操作不可恢复。`);
  if (!confirmed) return;

  try {
    const promises = selectedTopics.value.map(id => 
      db.collection("topics").doc(id).remove()
    );
    await Promise.all(promises);
    
    success(`已成功删除 ${selectedTopics.value.length} 个专题`);
    selectedTopics.value = [];
    clearCache();
    await loadTopics();
  } catch (err: any) {
    toastError('删除失败: ' + err.message);
  }
};

const copyId = (id: string) => {
  navigator.clipboard.writeText(id).then(() => {
    success('ID已复制');
  }).catch(err => {
    console.error('复制失败', err);
    toastError('复制失败');
  });
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

.input {
  width: 100%;
  padding: 0.625rem 1rem;
  border-radius: 0.5rem;
  background: var(--bg-body);
  border: 1px solid var(--border-color);
  color: var(--text-main);
}

.input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.2);
}

.select {
  width: 100%;
  padding: 0.625rem 1rem;
  border-radius: 0.5rem;
  background: var(--bg-body);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  cursor: pointer;
}

.select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.2);
}
</style>
