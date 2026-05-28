<template>
  <div class="space-y-6">
    <!-- Header & Form Section -->
    <section class="glass-panel p-4 dark:bg-gray-800">
      <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-4">
        <div>
          <h2 class="text-lg font-bold text-slate-800 dark:text-white">分类与标签管理</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">维护分类和标签体系</p>
        </div>
        <div class="flex gap-2">
          <button class="btn-ghost text-xs dark:text-slate-300" @click="activeTab === 'categories' ? cleanCategoryDuplicates() : cleanTagDuplicates()" :disabled="loading">
            清理重复
          </button>
        </div>
      </div>

      <!-- Tab Switcher -->
      <div class="flex gap-1 bg-slate-100 dark:bg-gray-700 p-1 rounded-lg mb-4">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          class="px-4 py-2 text-sm rounded-md transition-all font-medium"
          :class="activeTab === tab.value 
            ? 'bg-white dark:bg-gray-600 text-slate-800 dark:text-white shadow-sm' 
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
          @click="switchTab(tab.value)"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Inline Form - Categories -->
      <div v-if="activeTab === 'categories'" class="flex flex-wrap items-end gap-3 bg-[var(--bg-card)] dark:bg-gray-700 p-3 rounded-lg border border-[var(--border-color)] dark:border-gray-600">
        <div class="flex flex-col gap-1">
          <span class="text-[10px] font-medium text-[var(--text-sub)] dark:text-slate-400">名称</span>
          <input v-model="categoryForm.name" class="input text-sm py-1.5 h-9 w-40 dark:bg-gray-600 dark:text-white dark:border-gray-500" placeholder="分类名称" @keyup.enter="saveCategory" />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-[10px] font-medium text-[var(--text-sub)] dark:text-slate-400">类型</span>
          <select v-model="categoryForm.type" class="input text-sm py-1.5 h-9 w-28 dark:bg-gray-600 dark:text-white dark:border-gray-500">
            <option value="avatar">头像</option>
            <option value="wallpaper">壁纸</option>
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-[10px] font-medium text-[var(--text-sub)] dark:text-slate-400">排序</span>
          <input v-model.number="categoryForm.order" type="number" class="input text-sm py-1.5 h-9 w-20 dark:bg-gray-600 dark:text-white dark:border-gray-500" @keyup.enter="saveCategory" />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-[10px] font-medium text-[var(--text-sub)] dark:text-slate-400">状态</span>
          <select v-model="categoryForm.enabled" class="input text-sm py-1.5 h-9 w-24 dark:bg-gray-600 dark:text-white dark:border-gray-500">
            <option :value="true">启用</option>
            <option :value="false">停用</option>
          </select>
        </div>
        <div class="flex gap-2 h-9">
          <button class="btn-soft text-sm px-4 dark:bg-blue-600 dark:hover:bg-blue-700" @click="saveCategory" :disabled="saving">
            {{ saving ? '保存中...' : (categoryEditingId ? "保存修改" : "新增分类") }}
          </button>
          <button v-if="categoryEditingId" class="btn-ghost text-sm px-3 dark:text-slate-300" @click="resetCategoryForm">
            取消编辑
          </button>
        </div>
      </div>

      <!-- Inline Form - Tags -->
      <div v-else class="flex flex-wrap items-end gap-3 bg-[var(--bg-card)] dark:bg-gray-700 p-3 rounded-lg border border-[var(--border-color)] dark:border-gray-600">
        <div class="flex flex-col gap-1">
          <span class="text-[10px] font-medium text-[var(--text-sub)] dark:text-slate-400">名称</span>
          <input v-model="tagForm.name" class="input text-sm py-1.5 h-9 w-40 dark:bg-gray-600 dark:text-white dark:border-gray-500" placeholder="标签名称" @keyup.enter="saveTag" />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-[10px] font-medium text-[var(--text-sub)] dark:text-slate-400">类型</span>
          <select v-model="tagForm.type" class="input text-sm py-1.5 h-9 w-28 dark:bg-gray-600 dark:text-white dark:border-gray-500">
            <option value="avatar">头像</option>
            <option value="wallpaper">壁纸</option>
            <option value="both">通用</option>
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-[10px] font-medium text-[var(--text-sub)] dark:text-slate-400">排序</span>
          <input v-model.number="tagForm.order" type="number" class="input text-sm py-1.5 h-9 w-20 dark:bg-gray-600 dark:text-white dark:border-gray-500" @keyup.enter="saveTag" />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-[10px] font-medium text-[var(--text-sub)] dark:text-slate-400">状态</span>
          <select v-model="tagForm.enabled" class="input text-sm py-1.5 h-9 w-24 dark:bg-gray-600 dark:text-white dark:border-gray-500">
            <option :value="true">启用</option>
            <option :value="false">停用</option>
          </select>
        </div>
        <div class="flex gap-2 h-9">
          <button class="btn-soft text-sm px-4 dark:bg-blue-600 dark:hover:bg-blue-700" @click="saveTag" :disabled="saving">
            {{ saving ? '保存中...' : (tagEditingId ? "保存修改" : "确认添加") }}
          </button>
          <button v-if="tagEditingId" class="btn-ghost text-sm px-3 dark:text-slate-300" @click="resetTagForm">
            重置
          </button>
        </div>
      </div>
    </section>

    <!-- Filter & Search Section - Categories -->
    <div v-if="activeTab === 'categories'" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <!-- Type Filter Tabs -->
      <div class="flex gap-1 bg-slate-100 dark:bg-gray-700 p-1 rounded-lg">
        <button
          v-for="t in categoryFilterOptions"
          :key="t.value"
          class="px-3 py-1.5 text-xs rounded-md transition-all font-medium"
          :class="categoryFilterType === t.value 
            ? 'bg-white dark:bg-gray-600 text-slate-800 dark:text-white shadow-sm' 
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
          @click="categoryFilterType = t.value"
        >
          {{ t.label }}
        </button>
      </div>

      <!-- Search -->
      <div class="relative">
        <input
          v-model="categorySearchQuery"
          class="input text-sm py-1.5 h-9 w-48 pl-8 dark:bg-gray-700 dark:text-white dark:border-gray-600"
          placeholder="搜索分类..."
        />
        <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
      </div>
    </div>

    <!-- Filter & Search Section - Tags -->
    <div v-else class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <!-- Left: Filter Tabs + Batch Actions -->
      <div class="flex items-center gap-2">
        <!-- Type Filter Tabs -->
        <div class="flex gap-1 bg-slate-100 dark:bg-gray-700 p-1 rounded-lg">
          <button
            v-for="t in tagFilterOptions"
            :key="t.value"
            class="px-3 py-1.5 text-xs rounded-md transition-all font-medium"
            :class="tagFilterType === t.value 
              ? 'bg-white dark:bg-gray-600 text-slate-800 dark:text-white shadow-sm' 
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
            @click="tagFilterType = t.value"
          >
            {{ t.label }}
          </button>
        </div>

        <!-- Batch Enable Button -->
        <button 
          v-if="selectedTags.length > 0"
          class="text-xs px-2 py-1.5 rounded-md bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
          @click="batchEnable"
        >
          启用选中 ({{ selectedTags.length }})
        </button>
        <button 
          v-if="selectedTags.length > 0"
          class="text-xs px-2 py-1.5 rounded-md bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors"
          @click="selectedTags = []"
        >
          取消选择
        </button>
      </div>

      <!-- Right: Search + Select All -->
      <div class="flex items-center gap-2">
        <!-- Checkbox for selecting all -->
        <label v-if="filteredTags.length > 0" class="flex items-center gap-1.5 cursor-pointer text-xs text-slate-500 dark:text-slate-400">
          <input 
            type="checkbox" 
            :checked="isAllSelected"
            :indeterminate="isIndeterminate"
            @change="toggleSelectAll"
            class="rounded border-slate-300 dark:border-gray-600 text-green-600 focus:ring-green-500 w-4 h-4"
          />
          全选
        </label>

        <!-- Search -->
        <div class="relative">
          <input
            v-model="tagSearchQuery"
            class="input text-sm py-1.5 h-9 w-40 pl-8 pr-2 dark:bg-gray-700 dark:text-white dark:border-gray-600 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            placeholder="搜索标签..."
          />
          <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
        </div>
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

    <!-- Empty State - Categories -->
    <div v-else-if="activeTab === 'categories' && filteredCategories.length === 0" class="text-center py-12">
      <div class="text-4xl mb-3">📂</div>
      <p class="text-slate-500 dark:text-slate-400 text-sm">
        {{ categorySearchQuery || categoryFilterType !== 'all' ? '没有找到匹配的分类' : '暂无分类，点击上方表单添加' }}
      </p>
    </div>

    <!-- Empty State - Tags -->
    <div v-else-if="activeTab === 'tags' && filteredTags.length === 0" class="text-center py-12">
      <div class="text-4xl mb-3">🏷️</div>
      <p class="text-slate-500 dark:text-slate-400 text-sm">
        {{ tagSearchQuery || tagFilterType !== 'all' ? '没有找到匹配的标签' : '暂无标签，点击上方表单添加' }}
      </p>
    </div>

    <!-- List Section - Categories -->
    <div v-else-if="activeTab === 'categories'" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      <div 
        v-for="item in filteredCategories" 
        :key="item._id" 
        class="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-4 hover:shadow-lg dark:hover:shadow-gray-900/30 hover:scale-[1.02] transition-all flex flex-col group relative overflow-hidden"
        :class="{'ring-2 ring-blue-500': categoryEditingId === item._id}"
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

    <!-- List Section - Tags -->
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      <div 
        v-for="item in filteredTags" 
        :key="item._id" 
        class="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-4 hover:shadow-lg dark:hover:shadow-gray-900/30 hover:scale-[1.02] transition-all flex flex-col group relative overflow-hidden"
        :class="{'ring-2 ring-blue-500': tagEditingId === item._id}"
      >
        <!-- Top Gradient Indicator -->
        <div 
          class="absolute top-0 left-0 right-0 h-1 transition-transform origin-top group-hover:scale-y-110"
          :class="[
            item.type === 'avatar' ? 'bg-gradient-to-r from-blue-400 to-blue-600' : 
            item.type === 'wallpaper' ? 'bg-gradient-to-r from-green-400 to-green-600' : 
            'bg-gradient-to-r from-purple-400 to-purple-600'
          ]"
        ></div>

        <!-- Checkbox -->
        <div class="absolute top-2 right-2 z-10">
          <input
            type="checkbox"
            :value="item._id"
            v-model="selectedTags"
            class="rounded border-slate-300 dark:border-gray-600 text-green-600 focus:ring-green-500 w-4 h-4 shadow-sm cursor-pointer"
          />
        </div>

        <!-- Card Content -->
        <div class="pt-2">
          <div class="flex justify-between items-start mb-2">
             <div class="flex flex-col min-w-0 flex-1">
                <span class="font-bold text-slate-800 dark:text-white text-base truncate flex items-center gap-1.5" :title="item.name">
                  <span v-if="item.type === 'avatar'">🎭</span>
                  <span v-else-if="item.type === 'wallpaper'">🖼️</span>
                  <span v-else>🏷️</span>
                  {{ item.name }}
                </span>
                <span class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">排序: {{ item.order }}</span>
             </div>
             <!-- Status Badge -->
             <span 
                class="px-2 py-0.5 text-[10px] rounded-full font-medium flex-shrink-0 ml-2 cursor-pointer transition-all hover:scale-110"
                :class="item.enabled 
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' 
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'"
                @click="toggleTagStatus(item)"
                :title="item.enabled ? '点击停用' : '点击启用'"
              >
                {{ item.enabled ? "🟢 启用" : "⚪ 停用" }}
             </span>
          </div>
          
          <!-- Type Badge -->
          <div class="flex items-center gap-2 mb-3">
             <span 
               class="text-[10px] px-2 py-0.5 rounded-full font-medium"
               :class="[
                 item.type === 'avatar' 
                   ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 
                 item.type === 'wallpaper' 
                   ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 
                   'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
               ]"
             >
               {{ item.type === 'avatar' ? '👤 头像' : item.type === 'wallpaper' ? '🖼️ 壁纸' : '🔗 通用' }}
             </span>
          </div>

          <!-- Actions -->
          <div class="mt-auto pt-3 border-t border-slate-100 dark:border-gray-700 flex gap-2">
            <button 
              class="flex-1 text-xs py-1.5 rounded bg-slate-50 dark:bg-gray-700 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-gray-600 hover:border-blue-200 dark:hover:border-blue-700 transition-all flex items-center justify-center gap-1"
              @click="editTag(item)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              编辑
            </button>
            <button 
              class="flex-1 text-xs py-1.5 rounded bg-slate-50 dark:bg-gray-700 text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-gray-600 hover:border-red-200 dark:hover:border-red-700 transition-all flex items-center justify-center gap-1"
              @click="removeTag(item._id)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
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

// Tabs
const activeTab = ref('categories');
const tabs = [
  { label: '分类管理', value: 'categories' },
  { label: '标签管理', value: 'tags' }
];

// Categories
const categories = ref<any[]>([]);
const categoryEditingId = ref<string | null>(null);
const categorySearchQuery = ref("");
const categoryFilterType = ref("all");
const categoryFilterOptions = [
  { label: "全部", value: "all" },
  { label: "👤 头像", value: "avatar" },
  { label: "🖼️ 壁纸", value: "wallpaper" },
];

const categoryForm = reactive({
  name: "",
  type: "wallpaper" as "avatar" | "wallpaper",
  order: 0,
  enabled: true,
});

// Tags
const tags = ref<any[]>([]);
const tagEditingId = ref<string | null>(null);
const tagSearchQuery = ref("");
const tagFilterType = ref("all");
const selectedTags = ref<string[]>([]);
const tagFilterOptions = [
  { label: "全部", value: "all" },
  { label: "👤 头像", value: "avatar" },
  { label: "🖼️ 壁纸", value: "wallpaper" },
  { label: "🔗 通用", value: "both" },
];

const tagForm = reactive({
  name: "",
  type: "both" as "avatar" | "wallpaper" | "both",
  order: 0,
  enabled: true,
});

// Loading states
const loading = ref(false);
const saving = ref(false);

// Computed properties
const filteredCategories = computed(() => {
  return categories.value.filter(c => {
    const matchSearch = !categorySearchQuery.value || 
      c.name.toLowerCase().includes(categorySearchQuery.value.toLowerCase());
    const matchType = categoryFilterType.value === "all" || c.type === categoryFilterType.value;
    return matchSearch && matchType;
  });
});

const filteredTags = computed(() => {
  return tags.value.filter(t => {
    const matchSearch = !tagSearchQuery.value || 
      t.name.toLowerCase().includes(tagSearchQuery.value.toLowerCase());
    const matchType = tagFilterType.value === "all" || t.type === tagFilterType.value;
    return matchSearch && matchType;
  });
});

const isAllSelected = computed(() => {
  return filteredTags.value.length > 0 && selectedTags.value.length === filteredTags.value.length;
});

const isIndeterminate = computed(() => {
  return selectedTags.value.length > 0 && selectedTags.value.length < filteredTags.value.length;
});

// Methods
const switchTab = (tab: string) => {
  activeTab.value = tab;
  if (tab === 'categories') {
    fetchCategories();
  } else {
    fetchTags();
  }
};

// Categories methods
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

const resetCategoryForm = () => {
  categoryEditingId.value = null;
  categoryForm.name = "";
  categoryForm.type = "wallpaper";
  categoryForm.order = 0;
  categoryForm.enabled = true;
};

const editCategory = (item: any) => {
  categoryEditingId.value = item._id;
  categoryForm.name = item.name;
  categoryForm.type = item.type;
  categoryForm.order = item.order || 0;
  categoryForm.enabled = item.enabled ?? true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const saveCategory = async () => {
  if (!categoryForm.name.trim()) {
    ElMessage.warning("请输入分类名称");
    return;
  }
  
  // Check duplicate name
  const exists = categories.value.find(c => 
    c.name.toLowerCase() === categoryForm.name.trim().toLowerCase() && 
    c._id !== categoryEditingId.value
  );
  if (exists) {
    ElMessage.warning("分类名称已存在");
    return;
  }

  saving.value = true;
  try {
    if (categoryEditingId.value) {
      await db.collection("categories").doc(categoryEditingId.value).update({
        name: categoryForm.name.trim(),
        type: categoryForm.type,
        order: categoryForm.order,
        enabled: categoryForm.enabled,
        updatedAt: serverDate(),
      });
      ElMessage.success("分类已更新");
    } else {
      await db.collection("categories").add({
        name: categoryForm.name.trim(),
        type: categoryForm.type,
        order: categoryForm.order,
        enabled: categoryForm.enabled,
        createdAt: serverDate(),
        updatedAt: serverDate(),
      });
      ElMessage.success("分类已创建");
    }
    resetCategoryForm();
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

const cleanCategoryDuplicates = async () => {
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

// Tags methods
const fetchTags = async () => {
  loading.value = true;
  try {
    const res = await db.collection("tags").orderBy("order", "asc").get();
    tags.value = res.data || [];
  } catch (err: any) {
    ElMessage.error("加载标签失败: " + err.message);
  } finally {
    loading.value = false;
  }
};

const resetTagForm = () => {
  tagEditingId.value = null;
  tagForm.name = "";
  tagForm.type = "both";
  tagForm.order = 0;
  tagForm.enabled = true;
};

const editTag = (item: any) => {
  tagEditingId.value = item._id;
  tagForm.name = item.name;
  tagForm.type = item.type;
  tagForm.order = item.order || 0;
  tagForm.enabled = item.enabled ?? true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const saveTag = async () => {
  if (!tagForm.name.trim()) {
    ElMessage.warning("请输入标签名称");
    return;
  }
  
  // Check duplicate name
  const exists = tags.value.find(t => 
    t.name.toLowerCase() === tagForm.name.trim().toLowerCase() && 
    t._id !== tagEditingId.value
  );
  if (exists) {
    ElMessage.warning("标签名称已存在");
    return;
  }

  saving.value = true;
  try {
    if (tagEditingId.value) {
      await db.collection("tags").doc(tagEditingId.value).update({
        name: tagForm.name.trim(),
        type: tagForm.type,
        order: tagForm.order,
        enabled: tagForm.enabled,
        updatedAt: serverDate(),
      });
      ElMessage.success("标签已更新");
    } else {
      await db.collection("tags").add({
        name: tagForm.name.trim(),
        type: tagForm.type,
        order: tagForm.order,
        enabled: tagForm.enabled,
        createdAt: serverDate(),
        updatedAt: serverDate(),
      });
      ElMessage.success("标签已创建");
    }
    resetTagForm();
    await fetchTags();
  } catch (err: any) {
    ElMessage.error("操作失败: " + err.message);
  } finally {
    saving.value = false;
  }
};

const removeTag = async (id: string) => {
  try {
    await db.collection("tags").doc(id).remove();
    ElMessage.success("标签已删除");
    await fetchTags();
  } catch (err: any) {
    ElMessage.error("删除失败: " + err.message);
  }
};

const toggleTagStatus = async (item: any) => {
  const newStatus = !item.enabled;
  try {
    await db.collection("tags").doc(item._id).update({
      enabled: newStatus,
      updatedAt: serverDate(),
    });
    item.enabled = newStatus;
    ElMessage.success(newStatus ? "已启用" : "已停用");
  } catch (err: any) {
    ElMessage.error("状态切换失败: " + err.message);
    await fetchTags();
  }
};

const batchEnable = async () => {
  if (selectedTags.value.length === 0) return;
  
  try {
    const promises = selectedTags.value.map(id => 
      db.collection("tags").doc(id).update({
        enabled: true,
        updatedAt: serverDate(),
      })
    );
    await Promise.all(promises);
    ElMessage.success(`已启用 ${selectedTags.value.length} 个标签`);
    selectedTags.value = [];
    await fetchTags();
  } catch (err: any) {
    ElMessage.error("批量启用失败: " + err.message);
  }
};

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedTags.value = [];
  } else {
    selectedTags.value = filteredTags.value.map(t => t._id);
  }
};

const cleanTagDuplicates = async () => {
  try {
    loading.value = true;
    const res = await db.collection("tags").limit(1000).get();
    const allTags = res.data || [];
    
    const nameMap = new Map();
    const toDelete: string[] = [];
    
    for (const tag of allTags) {
      const name = (tag.name || '').trim();
      if (!name) continue;

      if (nameMap.has(name)) {
        toDelete.push(tag._id);
      } else {
        nameMap.set(name, tag._id);
      }
    }
    
    if (toDelete.length === 0) {
      ElMessage.info(`检查了 ${allTags.length} 个标签，没有发现重复项`);
      return;
    }

    // Batch delete
    const promises = toDelete.map(id => db.collection("tags").doc(id).remove());
    await Promise.all(promises);
    
    ElMessage.success(`已清理 ${toDelete.length} 个重复标签`);
    await fetchTags();
  } catch (err: any) {
    ElMessage.error("清理失败: " + err.message);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchCategories();
});
</script>

<style scoped>
/* No specific scoped styles needed as we use Tailwind classes */
</style>