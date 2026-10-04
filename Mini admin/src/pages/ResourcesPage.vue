<template>
  <div class="space-y-8">
    <section class="glass-panel">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="panel-title">素材资源</h2>
          <p class="panel-sub">上传、审核与上架管理</p>
        </div>
        <div class="flex gap-2">
          <ClickSpark spark-color="#10b981" :spark-count="6" :spark-size="8" :spark-radius="20">
            <button class="btn-primary" @click="approveAllPending">
              一键通过待审
            </button>
          </ClickSpark>
          <button class="btn-soft" @click="toggleUploader">
            {{ showUploader ? "收起上传" : "上传素材" }}
          </button>
        </div>
      </div>

      <ResourceUploader v-if="showUploader" :categories="categories" @uploaded="fetchList" />
    </section>


    <section class="glass-panel">
      <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <label class="field">
          <span>关键词</span>
          <input v-model="filters.keyword" class="input" placeholder="标题关键词" />
        </label>
        <label class="field">
          <span>类型</span>
          <select v-model="filters.type" class="input">
            <option value="">全部</option>
            <option value="avatar">头像</option>
            <option value="wallpaper">壁纸</option>
          </select>
        </label>
        <label class="field">
          <span>状态</span>
          <select v-model="filters.status" class="input">
            <option value="">全部</option>
            <option value="draft">草稿</option>
            <option value="review">待审</option>
            <option value="published">已发布</option>
            <option value="offline">已下线</option>
          </select>
        </label>
        <label class="field">
          <span>分类</span>
          <select v-model="filters.category" class="input">
            <option value="">全部</option>
            <option v-for="item in categories" :key="item._id" :value="item.name">
              {{ item.name }}
            </option>
          </select>
        </label>
        <label class="field sm:col-span-2 lg:col-span-2">
          <span>标签（逗号分隔）</span>
          <input v-model="filters.tags" class="input" placeholder="例如：治愈,简约,几何" />
        </label>
        <div class="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
<button class="btn-soft" @click="applyFilters">筛选</button>
<button class="btn-soft" @click="resetFilters">重置</button>
        </div>
      </div>
    </section>

    <section class="glass-panel">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div class="flex items-center gap-4">
          <h3 class="panel-title">资源列表</h3>
          <ResourceBatchOps v-model="selectedResources" :list="list" @refresh="fetchList" />
        </div>
        <p class="text-xs text-[var(--text-sub)]">共 {{ total }} 条</p>
      </div>

      <!-- 骨架屏 -->
      <div v-if="listLoading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        <div v-for="i in 12" :key="i" class="bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] overflow-hidden">
          <div class="aspect-[3/4] bg-[var(--border-color)] animate-pulse"></div>
          <div class="p-2 space-y-2">
            <div class="h-3 bg-[var(--border-color)] rounded animate-pulse w-3/4"></div>
            <div class="h-2 bg-[var(--border-color)] rounded animate-pulse w-1/2"></div>
            <div class="flex gap-1">
              <div class="h-4 w-8 bg-[var(--border-color)] rounded animate-pulse"></div>
              <div class="h-4 w-8 bg-[var(--border-color)] rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 资源列表 -->
      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        <div
          v-for="item in list"
          :key="item._id"
          class="group relative bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] overflow-hidden hover:shadow-lg hover:border-[var(--primary)] hover:-translate-y-1 transition-all duration-300 flex flex-col cursor-pointer"
          :class="{'ring-2 ring-green-500': selectedResources.includes(item._id)}"
          @click="toggleSelect(item._id)"
        >
          <!-- Thumbnail & Overlay - 头像正方形/壁纸9:16 -->
          <div 
            class="bg-[var(--bg-body)] relative flex-shrink-0 overflow-hidden"
            :class="item.type === 'avatar' ? 'aspect-square' : 'aspect-[9/16]'"
          >
            <img
              v-if="item.previewUrl"
              :src="item.previewUrl"
              class="w-full h-full object-cover"
              alt=""
            />
            <div v-else class="w-full h-full flex items-center justify-center text-[var(--text-sub)] bg-[var(--bg-body)] text-xs">
              暂无
            </div>

            <!-- Checkbox -->
            <div class="absolute bottom-1 left-1 z-10" @click.stop>
              <input
                type="checkbox"
                :checked="selectedResources.includes(item._id)"
                @change="toggleSelect(item._id)"
                class="rounded border-slate-300 text-green-600 focus:ring-green-500 w-4 h-4 shadow-sm cursor-pointer"
              />
            </div>

            <!-- Type Badge (头像/壁纸) -->
            <div class="absolute top-1 left-1 z-10">
              <span
                class="px-1.5 py-0.5 text-[10px] rounded-full font-medium border shadow-sm backdrop-blur-md block"
                :class="{
                  'bg-pink-100/90 text-pink-700 border-pink-200': item.type === 'avatar',
                  'bg-indigo-100/90 text-indigo-700 border-indigo-200': item.type === 'wallpaper'
                }"
              >
                {{ item.type === 'avatar' ? '头像' : '壁纸' }}
              </span>
            </div>

            <!-- Status Badge -->
            <div class="absolute top-1 right-1 z-10 flex flex-col items-end gap-1">
               <span
                 class="px-1.5 py-0.5 text-[10px] rounded-full font-medium border shadow-sm backdrop-blur-md scale-90 origin-top-right block"
                 :class="{
                   'bg-green-100/90 text-green-700 border-green-200': item.status === 'published',
                   'bg-yellow-100/90 text-yellow-700 border-yellow-200': item.status === 'review',
                   'bg-slate-100/90 text-slate-600 border-slate-200': item.status === 'draft' || item.status === 'offline'
                 }"
               >
                 {{
                   item.status === 'published' ? '已发布' :
                   item.status === 'review' ? '待审' :
                   item.status === 'offline' ? '已下线' : '草稿'
                 }}
               </span>

               <!-- AI Status Badge -->
               <span
                 v-if="item.aiStatus"
                 class="px-1.5 py-0.5 text-[10px] rounded-full font-medium border shadow-sm backdrop-blur-md scale-90 origin-top-right block"
                 :class="{
                   'bg-green-100/90 text-green-700 border-green-200': item.aiStatus === 'success',
                   'bg-blue-100/90 text-blue-700 border-blue-200': item.aiStatus === 'pending' || item.aiStatus === 'processing',
                   'bg-red-100/90 text-red-700 border-red-200': item.aiStatus === 'failed'
                 }"
                 :title="item.aiStatus === 'success' ? 'AI 识别成功' : item.aiStatus === 'failed' ? 'AI 识别失败' : 'AI 识别中'"
               >
                 {{ item.aiStatus === 'success' ? 'AI✅' : item.aiStatus === 'failed' ? 'AI❌' : 'AI⏳' }}
               </span>
            </div>
          </div>

          <!-- Content -->
          <div class="p-2 flex flex-col flex-1 min-h-0">
            <div class="mb-1 flex-shrink-0">
               <h4 class="font-medium text-[var(--text-main)] text-xs truncate" :title="item.title">
                 {{ item.title || "未命名" }}
               </h4>
               <p class="text-xs text-[var(--text-sub)] mt-0.5 truncate">
                 {{ (item.categories && item.categories.join("/")) || item.category || "未分类" }}
               </p>
               <!-- Tags Display -->
               <div class="mt-1 flex flex-wrap gap-1 h-auto overflow-hidden">
                 <span
                   v-for="tag in (item.tags || []).slice(0, 2)"
                   :key="tag"
                   class="text-xs px-1.5 py-0.5 bg-[var(--bg-body)] text-[var(--text-sub)] rounded"
                 >
                   {{ tag }}
                 </span>
                 <span v-if="(item.tags || []).length > 3" class="text-[9px] text-[var(--text-sub)] self-center">...</span>
               </div>
            </div>

            <!-- Actions - 固定高度操作栏 -->
            <div class="mt-auto pt-2 px-2 -mx-2 -mb-2 bg-[var(--bg-body)] border-t border-[var(--border-color)] grid grid-cols-3 gap-1 flex-shrink-0 h-[32px]">
                <!-- AI 识别 -->
                <button
                  class="text-xs py-1 rounded hover:bg-[var(--bg-card)] text-indigo-600 transition-colors"
                  @click.stop="triggerAIAnalysis(item)"
                >
                  AI
                </button>

                <!-- 编辑 -->
                <button
                  class="text-xs py-1 rounded hover:bg-[var(--bg-card)] text-blue-600 transition-colors"
                  @click.stop="editResource(item)"
                >
                  编辑
                </button>

                <!-- 删除 -->
                <button
                  class="text-xs py-1 rounded hover:bg-[var(--bg-card)] text-red-600 transition-colors"
                  @click.stop="removeResource(item._id)"
                >
                  删除
                </button>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          class="btn-soft w-full sm:w-auto"
          :disabled="page === 1 || listLoading"
          @click="prevPage"
        >
          上一页
        </button>
        <div class="flex items-center gap-2">
          <p class="text-xs text-[var(--text-sub)]">第 {{ page }} 页</p>
          <span class="text-xs text-[var(--text-sub)]">/</span>
          <p class="text-xs text-[var(--text-sub)]">共 {{ Math.ceil(total / pageSize) || 1 }} 页</p>
        </div>
        <button
          class="btn-soft w-full sm:w-auto"
          :disabled="page * pageSize >= total || listLoading"
          @click="nextPage"
        >
          下一页
        </button>
      </div>
    </section>
  </div>
  
  <!-- 编辑资源模态框 -->
  <ResourceEditModal
    v-model:visible="showEditModal"
    :resource="editingResource"
    :show-hot-data="true"
    :categories="categories"
    @save="handleResourceSaved"
  />
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { app, db, _, ensureAuthUser, callCloudFunction, callFunctionWithAuth } from "../utils/cloudbase";
import { useMessage, useDialog } from "naive-ui";
const message = useMessage();
const dialog = useDialog();
import ResourceUploader from "../components/ResourceUploader.vue";
import ResourceBatchOps from "../components/ResourceBatchOps.vue";
import ResourceEditModal from "../components/ResourceEditModal.vue";
import ClickSpark from "../components/animations/ClickSpark.vue";
import { logger } from "../utils/logger";
import { resourceService, categoryService, tagService } from "../services/cloudBaseService";

/** CloudBase DB command 带有 in 方法（SDK 类型声明不完整） */
const cmd = _ as unknown as { in: (values: unknown[]) => unknown; gte: (v: unknown) => unknown; lte: (v: unknown) => unknown; and: (...args: unknown[]) => unknown };

const list = ref<any[]>([]);
const loading = ref(false);
const listLoading = ref(false);

const total = ref(0);
const page = ref(1);
const pageSize = ref(24);
const showUploader = ref(false);
const selectedResources = ref<string[]>([]);

const toggleSelect = (id: string) => {
  const index = selectedResources.value.indexOf(id);
  if (index > -1) {
    selectedResources.value.splice(index, 1);
  } else {
    selectedResources.value.push(id);
  }
};

const triggerAIAnalysis = async (item: any) => {
  const confirmed = await dialog.warning({
    title: '提示',
    content: `确定要对 "${item.title}" 重新进行 AI 识别吗？`,
    positiveText: '确定',
    negativeText: '取消',
  });
  if (!confirmed) return;

  try {
    // 乐观更新 UI
    item.aiStatus = 'pending';
    
    // 异步触发，忽略超时错误
    callFunctionWithAuth('analyzeResource', { id: item._id }).catch(err => {
        // 忽略超时错误，因为云函数仍在后台运行
        if (err.message && (err.message.includes('TIMEOUT') || err.message.includes('TIME_LIMIT'))) {
            logger.log('触发请求已发送 (前端超时忽略)', item._id);
        } else {
            logger.error(err);
            // 只有非超时错误才提示
            // item.aiStatus = 'failed'; 
        }
    });
    
    // 稍后刷新
    setTimeout(() => fetchList(), 2000);
    
  } catch (err: any) {
    logger.error("触发流程错误", err);
  }
};

const categories = ref<any[]>([]);
const tags = ref<any[]>([]);


const filters = reactive({
  keyword: "",
  type: "",
  status: "",
  category: "",
  tags: "",
});

const approveAllPending = async () => {
  const confirmed = await dialog.warning({
    title: '提示',
    content: "确定要将所有【待审】状态的资源更改为【已发布】吗？",
    positiveText: '确定',
    negativeText: '取消',
  });
  if (!confirmed) return;

  try {
    loading.value = true;
    let totalApproved = 0;
    let hasMore = true;

    // 循环处理，每次最多处理 100 条，直到全部完成
    while (hasMore) {
      const { data: pendingItems } = await resourceService.list<any>({
        where: { status: "review" },
        limit: 100,
      });

      if (pendingItems.length === 0) {
        hasMore = false;
        break;
      }

      const ids = pendingItems.map(item => item._id);
      await resourceService.batchUpdateWithTimestamp(ids, { status: "published" });

      totalApproved += pendingItems.length;
      hasMore = pendingItems.length === 100; // 如果正好100条，可能还有更多
    }

    if (totalApproved === 0) {
      message.info("暂无待审资源");
    } else {
      message.success(`已成功通过 ${totalApproved} 个资源`);
      await fetchList();
    }
  } catch (err: any) {
    logger.error("一键通过失败", err);
    message.error("操作失败: " + err.message);
  } finally {
    loading.value = false;
  }
};

const toggleUploader = () => {
  showUploader.value = !showUploader.value;
};

const fetchOptions = async () => {
  const [categoryData, tagData] = await Promise.all([
    categoryService.getAllSorted(),
    tagService.getAllSorted()
  ]);
  categories.value = categoryData as any[];
  tags.value = tagData as any[];
};

const buildWhere = () => {
  const where: Record<string, any> = {};
  // 排除已进回收站的资源（软删除会写入 deletedAt 时间戳）
  // 不加这条的话，删除成功后列表照样把它查出来，看起来像「删不掉」
  where.deletedAt = cmd.exists(false);
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.category) where.categories = cmd.in([filters.category]);
  
  // 标签筛选：支持多个标签（逗号分隔）
  if (filters.tags) {
    const tagList = filters.tags
      .split(/[,，]/)
      .map((t: string) => t.trim())
      .filter(Boolean);
    if (tagList.length > 0) {
      // 使用 or 条件，只要包含任一标签即可
      where.tags = cmd.in(tagList);
    }
  }

  if (filters.keyword) {
    where.title = db.RegExp({ regexp: filters.keyword, options: "i" });
  }
  return where;
};

const fetchList = async () => {
  listLoading.value = true;
  await ensureAuthUser();
  selectedResources.value = []; // Clear selection on refresh
  const where = buildWhere();
  try {
    const { data: listData, total: count } = await resourceService.list<any>({
      where,
      orderBy: "createdAt",
      orderDir: "desc",
      skip: (page.value - 1) * pageSize.value,
      limit: pageSize.value,
    });
    total.value = count;
    list.value = listData;
  } finally {
    listLoading.value = false;
  }

  const fileIDs = list.value
    .map((item) => item.coverUrl || item.originUrl)
    .filter(Boolean);
  if (fileIDs.length) {
    const tempRes = await app.getTempFileURL({
      fileList: fileIDs.map((fileID) => ({ fileID, maxAge: 3600 })),
    });
    const fileList = tempRes?.fileList || [];
    const urlMap = new Map(
      fileList.map((file: any) => [file.fileID, file.tempFileURL])
    );
    list.value = list.value.map((item) => ({
      ...item,
      previewUrl: urlMap.get(item.coverUrl || item.originUrl) || "",
    }));
  }

};

const applyFilters = async () => {
  page.value = 1;
  await fetchList();
};

const resetFilters = async () => {
  filters.keyword = "";
  filters.type = "";
  filters.status = "";
  filters.category = "";
  filters.tags = "";
  await applyFilters();
};

const editingResource = ref<any | null>(null);
const showEditModal = ref(false);

const editResource = (item: any) => {
  logger.log('Editing resource:', item);
  try {
    // Ensure deep copy to avoid reactivity issues with original list item
    const resourceCopy = JSON.parse(JSON.stringify(item));
    
    // 确保 type 字段有默认值
    let resourceType = resourceCopy.type;
    if (!resourceType || (resourceType !== 'avatar' && resourceType !== 'wallpaper')) {
      resourceType = 'wallpaper';
    }
    
    editingResource.value = {
      ...resourceCopy,
      type: resourceType,
      tags: Array.isArray(resourceCopy.tags) ? resourceCopy.tags.join(",") : resourceCopy.tags || "",
      categoriesStr: Array.isArray(resourceCopy.categories) ? resourceCopy.categories.join(",") : (resourceCopy.category || ""),
    };
    logger.log('编辑表单数据:', editingResource.value);
    showEditModal.value = true;
  } catch (err) {
    logger.error('Error preparing edit modal:', err);
    message.error('打开编辑框失败');
  }
};

const removeResource = async (id: string) => {
  const confirmed = await dialog.warning({
    title: '提示',
    content: '确定要删除这个资源吗？\n\n这将同时删除云存储中的文件！',
    positiveText: '确定',
    negativeText: '取消',
  });
  if (!confirmed) return;

  try {
    const res = await callFunctionWithAuth('deleteResources', {
      action: 'delete',
      resourceId: id
    });
    
    logger.log('删除结果:', res.result);
    
    if (res.result && res.result.success) {
      await fetchList();
    } else {
      message.error('删除失败: ' + (res.result?.message || '未知错误'));
    }
  } catch (err: any) {
    logger.error("删除失败", err);
    message.error("删除失败: " + err.message);
  }
};

const handleResourceSaved = async (data: any) => {
  logger.log('保存前的数据:', data);

  const updateData = {
    title: data.title,
    type: data.type,
    status: data.status,
    category: data.category,
    categories: data.categories,
    tags: data.tags,
    hotScore: data.hotScore || 0,
    downloads: data.downloads || 0,
    favorites: data.favorites || 0,
  };

  try {
    const res = await callCloudFunction('updateResource', {
      resourceId: data._id,
      updateData: updateData
    });

    logger.log('云函数更新结果:', res);

    if (res && res.success) {
      message.success("更新成功");
      showEditModal.value = false;
      editingResource.value = null;
      await fetchList();
    } else {
      message.error("更新失败: " + (res?.message || '未知错误'));
    }
  } catch (err: any) {
    logger.error("更新失败", err);
    message.error("更新失败: " + err.message);
  }
};

const nextPage = async () => {
  page.value += 1;
  await fetchList();
};

const prevPage = async () => {
  page.value -= 1;
  await fetchList();
};

onMounted(async () => {
  await fetchOptions();
  await fetchList();
});
</script>

<style scoped>
.input-base {
  @apply w-full px-4 py-2 rounded-lg bg-[var(--bg-body)] border border-[var(--border-color)] text-[var(--text-main)] outline-none focus:border-[var(--primary)] transition-colors;
}
</style>
