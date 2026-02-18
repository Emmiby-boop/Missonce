<template>
  <div class="space-y-6">
    <!-- Header & Form Section -->
    <section class="glass-panel p-4 dark:bg-gray-800">
      <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-4">
        <div>
          <h2 class="text-lg font-bold text-slate-800 dark:text-white">分类管理</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">维护分类名称、排序与启用状态</p>
        </div>
        <div class="flex gap-2">
          <button class="btn-ghost text-xs dark:text-slate-300" @click="cleanDuplicates" :disabled="loading">
            清理重复
          </button>
        </div>
      </div>

      <!-- Inline Form -->
      <div class="flex flex-wrap items-end gap-3 bg-[var(--bg-card)] dark:bg-gray-700 p-3 rounded-lg border border-[var(--border-color)] dark:border-gray-600">
        <div class="flex flex-col gap-1">
          <span class="text-[10px] font-medium text-[var(--text-sub)] dark:text-slate-400">名称</span>
          <input v-model="form.name" class="input text-sm py-1.5 h-9 w-40 dark:bg-gray-600 dark:text-white dark:border-gray-500" placeholder="分类名称" @keyup.enter="saveCategory" />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-[10px] font-medium text-[var(--text-sub)] dark:text-slate-400">类型</span>
          <select v-model="form.type" class="input text-sm py-1.5 h-9 w-28 dark:bg-gray-600 dark:text-white dark:border-gray-500">
            <option value="avatar">头像</option>
            <option value="wallpaper">壁纸</option>
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-[10px] font-medium text-[var(--text-sub)] dark:text-slate-400">排序</span>
          <input v-model.number="form.order" type="number" class="input text-sm py-1.5 h-9 w-20 dark:bg-gray-600 dark:text-white dark:border-gray-500" @keyup.enter="saveCategory" />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-[10px] font-medium text-[var(--text-sub)] dark:text-slate-400">状态</span>
          <select v-model="form.enabled" class="input text-sm py-1.5 h-9 w-24 dark:bg-gray-600 dark:text-white dark:border-gray-500">
            <option :value="true">启用</option>
            <option :value="false">停用</option>
          </select>
        </div>
        <div class="flex gap-2 h-9">
          <button class="btn-soft text-sm px-4 dark:bg-blue-600 dark:hover:bg-blue-700" @click="saveCategory" :disabled="saving">
            {{ saving ? '保存中...' : (editingId ? "保存修改" : "新增分类") }}
          </button>
          <button v-if="editingId" class="btn-ghost text-sm px-3 dark:text-slate-300" @click="resetForm">
            取消编辑
          </button>
        </div>
      </div>
    </section>

    <!-- Filter & Search Section -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <!-- Type Filter Tabs -->
      <div class="flex gap-1 bg-slate-100 dark:bg-gray-700 p-1 rounded-lg">
        <button
          v-for="t in filterOptions"
          :key="t.value"
          class="px-3 py-1.5 text-xs rounded-md transition-all font-medium"
          :class="filterType === t.value 
            ? 'bg-white dark:bg-gray-600 text-slate-800 dark:text-white shadow-sm' 
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
          @click="filterType = t.value"
        >
          {{ t.label }}
        </button>
      </div>

      <!-- Search -->
      <div class="relative">
        <input
          v-model="searchQuery"
          class="input text-sm py-1.5 h-9 w-48 pl-8 dark:bg-gray-700 dark:text-white dark:border-gray-600"
          placeholder="搜索分类..."
        />
        <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      <div 
        v-for="i in 6" 
        :key="i" 
        class="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-4 animate-pulse"
      >
        <div class="flex justify-between items-start mb-3">
          <div class="space-y-2 flex-1">
            <div class="h-5 bg-slate-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div class="h-3 bg-slate-100 dark:bg-gray-600 rounded w-1/2"></div>
          </div>
        </div>
        <div class="h-4 bg-slate-100 dark:bg-gray-600 rounded w-1/3 mb-3"></div>
        <div class="flex gap-2 pt-3 border-t border-slate-100 dark:border-gray-700">
          <div class="flex-1 h-7 bg-slate-100 dark:bg-gray-600 rounded"></div>
          <div class="flex-1 h-7 bg-slate-100 dark:bg-gray-600 rounded"></div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredCategories.length === 0" class="text-center py-12">
      <div class="text-4xl mb-3">📂</div>
      <p class="text-slate-500 dark:text-slate-400 text-sm">
        {{ searchQuery || filterType !== 'all' ? '没有找到匹配的分类' : '暂无分类，点击上方表单添加' }}
      </p>
    </div>

    <!-- List Section -->
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      <div 
        v-for="item in filteredCategories" 
        :key="item._id" 
        class="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-4 hover:shadow-lg dark:hover:shadow-gray-900/30 hover:scale-[1.02] transition-all flex flex-col group relative overflow-hidden"
        :class="{'ring-2 ring-blue-500': editingId === item._id}"
      >
        <!-- Type Indicator Strip -->
        <div 
          class="absolute top-0 left-0 w-1 h-full transition-transform origin-left group-hover:scale-y-110"
          :class="item.type === 'avatar' ? 'bg-blue-500' : 'bg-green-500'"
        ></div>

        <!-- Card Header -->
        <div class="pl-2">
          <div class="flex justify-between items-start mb-2">
             <div class="flex flex-col min-w-0 flex-1">
                <span class="font-bold text-slate-800 dark:text-white text-base truncate" :title="item.name">{{ item.name }}</span>
                <span class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">排序: {{ item.order }}</span>
             </div>
             <span 
                class="px-1.5 py-0.5 text-[10px] rounded border flex-shrink-0 ml-2"
                :class="item.enabled 
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' 
                  : 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20'"
              >
                {{ item.enabled ? "启用" : "停用" }}
             </span>
          </div>
          
          <!-- Type Badge -->
          <div class="flex items-center gap-2 mb-3">
             <span 
               class="text-[10px] px-2 py-0.5 rounded-full font-medium"
               :class="item.type === 'avatar' 
                 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                 : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'"
             >
               {{ item.type === 'avatar' ? '👤 头像' : '🖼️ 壁纸' }}
             </span>
          </div>

          <!-- Actions -->
          <div class="mt-auto pt-3 border-t border-slate-100 dark:border-gray-700 flex gap-2">
            <button 
              class="flex-1 text-xs py-1.5 rounded bg-slate-50 dark:bg-gray-700 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-gray-600 hover:border-blue-200 dark:hover:border-blue-700 transition-all"
              @click="editCategory(item)"
            >
              编辑
            </button>
            <button 
              class="flex-1 text-xs py-1.5 rounded bg-slate-50 dark:bg-gray-700 text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-gray-600 hover:border-red-200 dark:hover:border-red-700 transition-all"
              @click="removeCategory(item._id)"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { db, serverDate } from "../utils/cloudbase";
import { ElMessage } from "element-plus";

const categories = ref<any[]>([]);
const editingId = ref<string | null>(null);
const loading = ref(false);
const saving = ref(false);

// Filter & Search
const searchQuery = ref("");
const filterType = ref("all");

const filterOptions = [
  { label: "全部", value: "all" },
  { label: "👤 头像", value: "avatar" },
  { label: "🖼️ 壁纸", value: "wallpaper" },
];

const filteredCategories = computed(() => {
  return categories.value.filter(c => {
    const matchSearch = !searchQuery.value || 
      c.name.toLowerCase().includes(searchQuery.value.toLowerCase());
    const matchType = filterType.value === "all" || c.type === filterType.value;
    return matchSearch && matchType;
  });
});

const form = reactive({
  name: "",
  type: "wallpaper" as "avatar" | "wallpaper",
  order: 0,
  enabled: true,
});

const fetchCategories = async () => {
  loading.value = true;
  try {
    const res = await db.collection("categories").orderBy("order", "asc").get();
    categories.value = res.data || [];
  } catch (err: any) {
    ElMessage.error("加载分类失败: " + err.message);
  } finally {
    loading.value = false;
  }
};

const resetForm = () => {
  editingId.value = null;
  form.name = "";
  form.type = "wallpaper";
  form.order = 0;
  form.enabled = true;
};

const editCategory = (item: any) => {
  editingId.value = item._id;
  form.name = item.name;
  form.type = item.type;
  form.order = item.order || 0;
  form.enabled = item.enabled ?? true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const saveCategory = async () => {
  if (!form.name.trim()) {
    ElMessage.warning("请输入分类名称");
    return;
  }
  
  // Check duplicate name
  const exists = categories.value.find(c => 
    c.name.toLowerCase() === form.name.trim().toLowerCase() && 
    c._id !== editingId.value
  );
  if (exists) {
    ElMessage.warning("分类名称已存在");
    return;
  }

  saving.value = true;
  try {
    if (editingId.value) {
      await db.collection("categories").doc(editingId.value).update({
        name: form.name.trim(),
        type: form.type,
        order: form.order,
        enabled: form.enabled,
        updatedAt: serverDate(),
      });
      ElMessage.success("分类已更新");
    } else {
      await db.collection("categories").add({
        name: form.name.trim(),
        type: form.type,
        order: form.order,
        enabled: form.enabled,
        createdAt: serverDate(),
        updatedAt: serverDate(),
      });
      ElMessage.success("分类已创建");
    }
    resetForm();
    await fetchCategories();
  } catch (err: any) {
    ElMessage.error("操作失败: " + err.message);
  } finally {
    saving.value = false;
  }
};

const removeCategory = async (id: string) => {
  try {
    await db.collection("categories").doc(id).remove();
    ElMessage.success("分类已删除");
    await fetchCategories();
  } catch (err: any) {
    ElMessage.error("删除失败: " + err.message);
  }
};

const cleanDuplicates = async () => {
  try {
    loading.value = true;
    const res = await db.collection("categories").limit(1000).get();
    const allItems = res.data || [];
    
    const nameMap = new Map();
    const toDelete: string[] = [];
    
    for (const item of allItems) {
      const name = (item.name || '').trim();
      if (!name) continue;

      if (nameMap.has(name)) {
        toDelete.push(item._id);
      } else {
        nameMap.set(name, item._id);
      }
    }
    
    if (toDelete.length === 0) {
      ElMessage.info(`检查了 ${allItems.length} 个分类，没有发现重复项`);
      return;
    }

    // Batch delete
    const promises = toDelete.map(id => db.collection("categories").doc(id).remove());
    await Promise.all(promises);
    
    ElMessage.success(`已清理 ${toDelete.length} 个重复分类`);
    await fetchCategories();
  } catch (err: any) {
    ElMessage.error("清理失败: " + err.message);
  } finally {
    loading.value = false;
  }
};

onMounted(fetchCategories);
</script>

<style scoped>
/* No specific scoped styles needed as we use Tailwind classes */
</style>
