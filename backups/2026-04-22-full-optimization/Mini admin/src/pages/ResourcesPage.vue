<template>
  <div class="space-y-8">
    <section class="glass-panel">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="panel-title">素材资源</h2>
          <p class="panel-sub">上传、审核与上架管理</p>
        </div>
        <div class="flex gap-2">
          <button class="btn-primary" @click="approveAllPending">
            一键通过待审
          </button>
          <button class="btn-soft" @click="toggleUploader">
            {{ showUploader ? "收起上传" : "上传素材" }}
          </button>
          <button class="btn-soft" :disabled="backingUp" @click="handleBackup">
            <span v-if="backingUp" class="inline-block animate-spin mr-2">⟳</span>
            {{ backingUp ? `备份中 ${backupProgress}%` : "备份所有素材" }}
          </button>
        </div>
      </div>

      <div v-if="showUploader" class="upload-card">
        <div class="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <label class="field">
            <span>标题</span>
            <input v-model="uploadForm.title" class="input" placeholder="素材名称" />
          </label>
          <label class="field">
            <span>类型</span>
            <select v-model="uploadForm.type" class="input">
              <option value="auto">自动识别 (AI)</option>
              <option value="avatar">头像</option>
              <option value="wallpaper">壁纸</option>
            </select>
          </label>
          <label class="field">
            <span>分类</span>
            <select v-model="uploadForm.category" class="input">
              <option value="">自动识别 (AI)</option>
              <option v-for="item in categories" :key="item._id" :value="item.name">
                {{ item.name }}
              </option>
            </select>
          </label>
          <label class="field">
            <span>状态</span>
            <select v-model="uploadForm.status" class="input">
              <option value="draft">草稿</option>
              <option value="review">待审</option>
              <option value="published">已发布</option>
              <option value="offline">已下线</option>
            </select>
          </label>
          <label class="field md:col-span-2">
            <span>标签（逗号分隔）</span>
            <input v-model="uploadForm.tags" class="input" placeholder="例如：治愈,简约,几何" />
          </label>
          <label class="field md:col-span-2">
            <span>素材文件（可多选）</span>
            <input
              ref="fileInput"
              type="file"
              class="input"
              accept="image/*"
              multiple
              @change="handleFileChange"
            />
            <span class="text-xs text-[var(--text-sub)]">
              已选择：{{ selectedFiles.length }} 个文件
            </span>
          </label>
        </div>
        <div class="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <button class="btn-soft" :disabled="uploading || selectedFiles.length === 0" @click="handleUpload">
            <span v-if="uploading" class="inline-block animate-spin mr-2">⟳</span>
            {{ uploading ? (aiTotal > 0 ? `AI 识别中: ${aiCompleted}/${aiTotal}` : "上传中...") : "确认上传" }}
          </button>
          <span class="text-xs text-[var(--text-sub)]">上传后会写入 resources 集合</span>
        </div>
      </div>
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
          <el-dropdown v-if="selectedResources.length > 0" trigger="click" @command="batchUpdateStatus">
            <button class="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded font-medium hover:bg-green-100 transition-colors border border-green-200">
              批量修改状态 <span class="ml-1">▼</span>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="published">发布</el-dropdown-item>
                <el-dropdown-item command="offline">下线</el-dropdown-item>
                <el-dropdown-item command="draft">设为草稿</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <button
            v-if="selectedResources.length > 0"
            class="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded font-medium hover:bg-red-100 transition-colors border border-red-200"
            @click="batchDelete"
          >
             批量删除 ({{ selectedResources.length }})
          </button>
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
  <Teleport to="body">
    <div v-if="showEditModal && editingResource" class="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm" @click.self="showEditModal = false">
      <div class="bg-[var(--bg-card)] rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
        <div class="px-6 py-4 border-b border-[var(--border-color)] flex justify-between items-center">
          <h3 class="text-lg font-bold text-[var(--text-main)]">编辑资源</h3>
          <button @click="showEditModal = false" class="text-[var(--text-sub)] hover:text-[var(--text-main)] transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a 1 1 0 011.414 0L10 8.586l4.293-4.293a 1 1 0 111.414 1.414L11.414 10l4.293 4.293a 1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a 1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a 1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
        
        <div class="p-6 max-h-[70vh] overflow-y-auto">
          <div class="grid gap-5">
            <label class="block">
              <span class="text-sm font-medium text-[var(--text-main)] mb-1.5 block">标题</span>
              <input v-model="editingResource.title" class="input-base" placeholder="素材名称" />
            </label>
            
            <div class="grid grid-cols-2 gap-4">
              <label class="block">
                <span class="text-sm font-medium text-[var(--text-main)] mb-1.5 block">类型</span>
                <select v-model="editingResource.type" class="input-base appearance-none">
                  <option value="avatar">头像</option>
                  <option value="wallpaper">壁纸</option>
                </select>
              </label>
              <label class="block">
                <span class="text-sm font-medium text-[var(--text-main)] mb-1.5 block">状态</span>
                <select v-model="editingResource.status" class="input-base appearance-none">
                  <option value="draft">草稿</option>
                  <option value="review">待审</option>
                  <option value="published">已发布</option>
                  <option value="offline">已下线</option>
                </select>
              </label>
            </div>

            <label class="block">
              <span class="text-sm font-medium text-[var(--text-main)] mb-1.5 block">
                分类 
                <span class="text-xs text-[var(--text-sub)] font-normal ml-1">(点击下方标签添加)</span>
              </span>
              <input v-model="editingResource.categoriesStr" class="input-base" placeholder="例如：动态头像,女生" />
              
              <div class="mt-3 p-3 bg-[var(--bg-body)] rounded-lg border border-[var(--border-color)]">
                <div class="text-xs text-[var(--text-sub)] mb-2">快速选择：</div>
                <div class="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                    <span 
                        v-for="item in categories" 
                        :key="item._id" 
                        class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] cursor-pointer hover:border-green-500 hover:text-green-600 transition-all shadow-sm select-none"
                        @click="addCategoryToEdit(item.name)"
                    >
                        + {{ item.name }}
                    </span>
                </div>
              </div>
            </label>
            
            <label class="block">
              <span class="text-sm font-medium text-[var(--text-main)] mb-1.5 block">标签（逗号分隔）</span>
              <textarea v-model="editingResource.tags" class="input-base min-h-[80px]" placeholder="例如：治愈,简约,几何"></textarea>
            </label>
          </div>
        </div>
        
        <div class="px-6 py-4 bg-[var(--bg-body)] border-t border-[var(--border-color)] flex justify-end gap-3">
          <button class="px-4 py-2 text-sm font-medium text-[var(--text-main)] hover:bg-[var(--border-color)] rounded-lg transition-colors" @click="showEditModal = false">取消</button>
          <button class="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm shadow-green-200 transition-colors flex items-center gap-2" @click="saveResource">
            <span>保存更改</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, computed } from "vue";
import { app, db, _, ensureAuthUser, serverDate } from "../utils/cloudbase";
import { ElMessageBox, ElMessage } from "element-plus";

const _Any = _ as any;

const list = ref<any[]>([]);
const loading = ref(false);
const listLoading = ref(false);

const total = ref(0);
const page = ref(1);
const pageSize = ref(24);
const showUploader = ref(false);
const uploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const selectedFiles = ref<File[]>([]);
const selectedResources = ref<string[]>([]);

const isAllSelected = computed(() => {
  return list.value.length > 0 && selectedResources.value.length === list.value.length;
});

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedResources.value = [];
  } else {
    selectedResources.value = list.value.map((item) => item._id);
  }
};

const toggleSelect = (id: string) => {
  const index = selectedResources.value.indexOf(id);
  if (index > -1) {
    selectedResources.value.splice(index, 1);
  } else {
    selectedResources.value.push(id);
  }
};

// 处理卡片内更多操作菜单
// 处理批量操作菜单命令


// 批量修改状态
const batchUpdateStatus = async (status: string) => {
  if (selectedResources.value.length === 0) return;

  if (!confirm(`确定要将选中的 ${selectedResources.value.length} 个资源设置为「${status === 'published' ? '已发布' : status === 'offline' ? '已下线' : '草稿'}」吗？`)) return;

  try {
    loading.value = true;
    const updatePromises = selectedResources.value.map(id =>
      db.collection("resources").doc(id).update({
        status,
        updatedAt: serverDate()
      })
    );
    await Promise.all(updatePromises);

    ElMessage.success(`已成功修改 ${selectedResources.value.length} 个资源`);
    selectedResources.value = [];
    await fetchList();
  } catch (err: any) {
    console.error('批量修改失败', err);
    ElMessage.error('批量修改失败: ' + err.message);
  } finally {
    loading.value = false;
  }
};

// 批量添加标签
const batchAddTags = async () => {
  if (selectedResources.value.length === 0) return;

  const tags = prompt('请输入要添加的标签（多个用逗号分隔）：');
  if (!tags) return;

  const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
  if (tagList.length === 0) return;

  try {
    loading.value = true;
    const updatePromises = selectedResources.value.map(id => {
      const item = list.value.find(i => i._id === id);
      const existingTags = item?.tags || [];
      const newTags = [...new Set([...existingTags, ...tagList])];
      return db.collection("resources").doc(id).update({
        tags: newTags,
        updatedAt: serverDate()
      });
    });
    await Promise.all(updatePromises);

    ElMessage.success(`已成功添加标签`);
    selectedResources.value = [];
    await fetchList();
  } catch (err: any) {
    console.error('批量添加标签失败', err);
    ElMessage.error('批量添加标签失败: ' + err.message);
  } finally {
    loading.value = false;
  }
};

const batchDelete = async () => {
  if (selectedResources.value.length === 0) return;

  if (!confirm(`确定要删除选中的 ${selectedResources.value.length} 个资源吗？\n\n此操作不可恢复！`)) return;

  try {
    console.log('准备批量删除资源:', selectedResources.value);
    
    const result = await app.callFunction({
      name: 'batchDeleteResources',
      data: {
        resourceIds: selectedResources.value
      }
    });
    
    console.log('云函数批量删除结果:', result);
    
    if (result.result && result.result.success) {
      ElMessage.success(result.result.message || '批量删除成功');
      selectedResources.value = [];
      await fetchList();
    } else {
      ElMessage.error('批量删除失败: ' + (result.result?.message || '未知错误'));
    }
  } catch (err: any) {
    console.error("批量删除失败", err);
    ElMessage.error('批量删除失败: ' + err.message);
  } finally {
    loading.value = false;
  }
};

const triggerAIAnalysis = async (item: any) => {
  if (!confirm(`确定要对 "${item.title}" 重新进行 AI 识别吗？`)) return;
  
  try {
    // 乐观更新 UI
    item.aiStatus = 'pending';
    
    // 异步触发，忽略超时错误
    app.callFunction({
        name: 'analyzeResource',
        data: { id: item._id },
        // @ts-ignore
        timeout: 60000 
    }).catch(err => {
        // 忽略超时错误，因为云函数仍在后台运行
        if (err.message && (err.message.includes('TIMEOUT') || err.message.includes('TIME_LIMIT'))) {
            console.log('触发请求已发送 (前端超时忽略)', item._id);
        } else {
            console.error(err);
            // 只有非超时错误才提示
            // item.aiStatus = 'failed'; 
        }
    });
    
    // 稍后刷新
    setTimeout(() => fetchList(), 2000);
    
  } catch (err: any) {
    console.error("触发流程错误", err);
  }
};

const batchAnalyzeAI = async () => {
  if (selectedResources.value.length === 0) return;
  if (!confirm(`确定要对选中的 ${selectedResources.value.length} 个资源重新进行 AI 识别吗？`)) return;

  try {
    // 批量触发
    selectedResources.value.forEach(id => {
        // 更新本地状态
        const item = list.value.find(i => i._id === id);
        if (item) item.aiStatus = 'pending';
        
        app.callFunction({
            name: 'analyzeResource',
            data: { id },
             // @ts-ignore
            timeout: 60000
        }).catch(err => {
             // 忽略超时错误
             if (err.message && (err.message.includes('TIMEOUT') || err.message.includes('TIME_LIMIT'))) {
                console.log('批量触发请求已发送 (前端超时忽略)', id);
             } else {
                console.error(err);
             }
        });
    });
    
    // 不等待所有完成，直接提示
    window.alert(`已触发 ${selectedResources.value.length} 个任务，请稍后刷新查看结果。`);
    selectedResources.value = [];
    
    // 稍后自动刷新一次
    setTimeout(() => fetchList(), 3000);
    
  } catch (err: any) {
    console.error("批量触发流程错误", err);
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

const uploadForm = reactive({
  title: "",
  type: "auto",
  status: "published",
  category: "",
  tags: "",
});

const approveAllPending = async () => {
  if (!confirm("确定要将所有【待审】状态的资源更改为【已发布】吗？")) return;

  try {
    // 1. 查询所有待审资源 (一次最多 100 条，如果更多建议使用云函数)
    const res = await db.collection("resources")
      .where({ status: "review" })
      .limit(100)
      .get();
    
    const pendingItems = res.data || [];
    if (pendingItems.length === 0) {
      window.alert("暂无待审资源");
      return;
    }

    // 2. 批量更新 (客户端 SDK 只能逐条更新或使用云函数，这里使用 Promise.all 并发更新)
    // 注意：大量并发可能会受限，这里分批处理
    const updatePromises = pendingItems.map(item => 
      db.collection("resources").doc(item._id).update({
        status: "published",
        updatedAt: serverDate()
      })
    );

    await Promise.all(updatePromises);
    
    window.alert(`已成功通过 ${pendingItems.length} 个资源`);
    await fetchList();
  } catch (err: any) {
    console.error("一键通过失败", err);
    window.alert("操作失败: " + err.message);
  }
};

const toggleUploader = () => {
  showUploader.value = !showUploader.value;
};

const fetchOptions = async () => {
  const [categoryRes, tagRes] = await Promise.all([
    db.collection("categories").orderBy("order", "asc").get(),
    db.collection("tags").orderBy("order", "asc").get(),
  ]);
  categories.value = categoryRes.data || [];
  tags.value = tagRes.data || [];
};

const buildWhere = () => {
  const where: Record<string, any> = {};
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.category) where.categories = _Any.in([filters.category]);
  
  // 标签筛选：支持多个标签（逗号分隔）
  if (filters.tags) {
    const tagList = filters.tags
      .split(/[,，]/)
      .map((t: string) => t.trim())
      .filter(Boolean);
    if (tagList.length > 0) {
      // 使用 or 条件，只要包含任一标签即可
      where.tags = _Any.in(tagList);
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
    const [countRes, listRes] = await Promise.all([
      db.collection("resources").where(where).count(),
      db
        .collection("resources")
        .where(where)
        .orderBy("createdAt", "desc")
        .skip((page.value - 1) * pageSize.value)
        .limit(pageSize.value)
        .get(),
    ]);
    total.value = countRes.total || 0;
    list.value = listRes.data || [];
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
  console.log('Editing resource:', item);
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
    console.log('编辑表单数据:', editingResource.value);
    showEditModal.value = true;
  } catch (err) {
    console.error('Error preparing edit modal:', err);
    window.alert('打开编辑框失败');
  }
};

const addCategoryToEdit = (catName: string) => {
  if (!editingResource.value) return;
  
  const currentStr = String(editingResource.value.categoriesStr || "");
  const current = currentStr.split(/[,，]/).map((t: string) => t.trim()).filter(Boolean);
  
  if (!current.includes(catName)) {
    current.push(catName);
    editingResource.value.categoriesStr = current.join(',');
  }
};

const removeResource = async (id: string) => {
  if (!confirm('确定要删除这个资源吗？\n\n这将同时删除云存储中的文件！')) return;
  
  try {
    const res = await app.callFunction({
      name: 'deleteResource',
      data: {
        resourceId: id
      }
    });
    
    console.log('删除结果:', res.result);
    
    if (res.result && res.result.success) {
      await fetchList();
    } else {
      alert('删除失败: ' + (res.result?.message || '未知错误'));
    }
  } catch (err: any) {
    console.error("删除失败", err);
    alert("删除失败: " + err.message);
  }
};

const saveResource = async () => {
  if (!editingResource.value) return;
  
  console.log('保存前的数据:', editingResource.value);
  
  const tagsStr = String(editingResource.value.tags || "");
  const tags = tagsStr
    .split(/[,，]/) // 支持中英文逗号
    .map((t: string) => t.trim())
    .filter(Boolean);
  
  const categoriesStr = String(editingResource.value.categoriesStr || "");
  const categories = categoriesStr
    .split(/[,，]/)
    .map((t: string) => t.trim())
    .filter(Boolean);
    
  const mainCategory = categories.length > 0 ? categories[0] : "";
  
  // 确保 type 字段有效
  let saveType = editingResource.value.type;
  if (!saveType || (saveType !== 'avatar' && saveType !== 'wallpaper')) {
    saveType = 'wallpaper';
  }
  
  const updateData = {
    title: editingResource.value.title,
    type: saveType,
    status: editingResource.value.status,
    category: mainCategory, 
    categories: categories,
    tags,
  };
  
  console.log('准备更新的数据:', updateData);
  
  try {
    const res = await app.callFunction({
      name: 'updateResource',
      data: {
        resourceId: editingResource.value._id,
        updateData: updateData
      }
    });
    
    console.log('云函数更新结果:', res.result);
    
    if (res.result && res.result.success) {
      window.alert("更新成功");
      showEditModal.value = false;
      editingResource.value = null;
      await fetchList();
    } else {
      window.alert("更新失败: " + (res.result?.message || '未知错误'));
    }
  } catch (err: any) {
    console.error("更新失败", err);
    window.alert("更新失败: " + err.message);
  }
};

const handleFileChange = () => {
  if (!fileInput.value?.files) return;
  selectedFiles.value = Array.from(fileInput.value.files);
};



const aiTotal = ref(0);
const aiCompleted = ref(0);
const migrating = ref(false);
const backingUp = ref(false);
const backupProgress = ref(0);

const handleBackup = async () => {
  if (!confirm('确定要备份所有素材吗？\n\n这会下载所有素材到本地，按头像/壁纸分类。\n\n注意：浏览器会逐个下载文件，请允许下载！')) return;
  
  backingUp.value = true;
  backupProgress.value = 0;
  
  try {
    console.log('开始获取所有资源...');
    
    let allResources = [];
    let currentPage = 1;
    let hasMore = true;
    
    while (hasMore) {
      console.log('获取第 ' + currentPage + ' 页...');
      const res = await db.collection('resources')
        .orderBy('createdAt', 'desc')
        .skip((currentPage - 1) * pageSize.value)
        .limit(pageSize.value)
        .get();
      
      if (res.data.length > 0) {
        allResources = allResources.concat(res.data);
        currentPage++;
        hasMore = res.data.length === pageSize.value;
      } else {
        hasMore = false;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    
    console.log('共获取 ' + allResources.length + ' 个资源');
    
    const avatarResources = allResources.filter(function(r) { return r.type === 'avatar'; });
    const wallpaperResources = allResources.filter(function(r) { return r.type !== 'avatar'; });
    
    console.log('头像: ' + avatarResources.length + ' 个, 壁纸: ' + wallpaperResources.length + ' 个');
    
    const allToDownload = avatarResources.concat(wallpaperResources);
    let downloaded = 0;
    const failed = [];
    
    for (let i = 0; i < allToDownload.length; i++) {
      const resource = allToDownload[i];
      try {
        const fileUrl = resource.coverUrl || resource.originUrl;
        if (!fileUrl) {
          console.log('资源没有文件URL，跳过:', resource._id, resource.title);
          failed.push({ id: resource._id, title: resource.title, reason: '无文件URL' });
          continue;
        }
        
        const tempUrlRes = await app.getTempFileURL({
          fileList: [fileUrl]
        });
        
        if (tempUrlRes.fileList && tempUrlRes.fileList[0] && tempUrlRes.fileList[0].tempFileURL) {
          const tempUrl = tempUrlRes.fileList[0].tempFileURL;
          
          const folder = resource.type === 'avatar' ? 'avatar' : 'wallpaper';
          const fileName = resource.title || 'resource_' + resource._id;
          const extParts = fileUrl.split('.');
          const ext = extParts[extParts.length - 1] || 'jpg';
          const downloadFileName = folder + '_' + fileName + '.' + ext;
          
          const link = document.createElement('a');
          link.href = tempUrl;
          link.download = downloadFileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          downloaded++;
          console.log('下载成功: ' + folder + '/' + fileName);
        } else {
          failed.push({ id: resource._id, title: resource.title, reason: '获取临时URL失败' });
        }
      } catch (downloadErr) {
        console.error('下载失败:', resource._id, resource.title, downloadErr);
        failed.push({ id: resource._id, title: resource.title, reason: downloadErr.message || '未知错误' });
      }
      
      backupProgress.value = Math.round((downloaded / allToDownload.length) * 100);
      
      await new Promise(r => setTimeout(r, 500));
    }
    
    let message = '备份完成！\n\n';
    message += '成功: ' + downloaded + ' 个\n';
    message += '失败: ' + failed.length + ' 个\n';
    message += '头像: ' + avatarResources.length + ' 个\n';
    message += '壁纸: ' + wallpaperResources.length + ' 个';
    
    if (failed.length > 0) {
      message += '\n\n失败详情:\n';
      const showFailed = failed.slice(0, 10);
      for (let j = 0; j < showFailed.length; j++) {
        message += '- ' + showFailed[j].title + ': ' + showFailed[j].reason + '\n';
      }
      if (failed.length > 10) {
        message += '...还有 ' + (failed.length - 10) + ' 个';
      }
    }
    
    alert(message);
    if (failed.length > 0) {
      console.log('失败详情:', failed);
    }
  } catch (err) {
    console.error('备份出错:', err);
    alert('备份出错: ' + err.message);
  } finally {
    backingUp.value = false;
    backupProgress.value = 0;
  }
};

const generateRandomFileName = (file: File, type: string) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  const randomStr = Math.random().toString(36).substring(2, 8);
  
  const ext = file.name.split('.').pop() || '';
  const folder = type === 'avatar' ? 'avatar' : 'wallpaper';
  
  return `resources/${folder}/${year}${month}${day}-${hours}${minutes}${seconds}-${randomStr}.${ext}`;
};

const handleUpload = async () => {
  console.log('Starting Async Upload v2...'); // Force file hash change
  const files = selectedFiles.value;
  if (!files.length) return;
  
  uploading.value = true;
  aiTotal.value = 0;
  aiCompleted.value = 0;
  
  try {
    const tags = uploadForm.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    // 计算总共需要 AI 分析的任务数 (简单起见，假设所有上传成功的文件都需要)
    // 实际是在循环中动态增加，这里先初始化
    
    for (const file of files) {
      // 检查文件名是否已存在
      const checkRes = await db.collection('resources')
        .where({ 
          originalFileName: file.name 
        })
        .count();
        
      if (checkRes.total > 0) {
        console.warn(`文件已存在，跳过上传: ${file.name}`);
        const continueUpload = confirm(`文件 "${file.name}" 已存在。\n是否继续上传？\n(取消则跳过此文件)`);
        if (!continueUpload) continue;
      }

      let fileType = uploadForm.type;
      
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      
      let folderType = fileType;
      if (fileType === 'auto') {
        folderType = 'wallpaper';
      }
      
      const cloudPath = generateRandomFileName(file, folderType);
      
      try {
          const uploadRes = await app.uploadFile({
            cloudPath,
            filePath: file as any,
          });

          const callRes = await app.callFunction({
            name: "uploadResource",
            data: {
              title: uploadForm.title || file.name,
              originalFileName: file.name,
              type: fileType,
              status: uploadForm.status,
              category: uploadForm.category,
              categories: uploadForm.category ? [uploadForm.category] : [],
              tags,
              coverUrl: uploadRes.fileID,
              originUrl: uploadRes.fileID,
              skipAI: false // 开启异步 AI 分析
            },
            // @ts-ignore
            timeout: 15000 
          });

          console.log('Upload Result:', callRes.result);
          
          if (callRes.result && callRes.result.success) {
             // 仅计数，不再前端触发 AI
             aiCompleted.value++;
          }
          
          if (callRes.result && callRes.result.debugLogs) {
            console.table(callRes.result.debugLogs);
          }
      } catch (e) {
          console.error(`上传文件 ${file.name} 失败:`, e);
          alert(`上传文件 ${file.name} 失败`);
      }
    }

    uploadForm.title = "";
    uploadForm.tags = "";
    uploadForm.category = "";
    uploadForm.type = "auto";
    selectedFiles.value = [];
    if (fileInput.value) fileInput.value.value = "";
    
    // 延迟一下刷新，让部分数据写入完成
    setTimeout(() => fetchList(), 1000);
    window.alert(`批量上传任务已提交！共 ${files.length} 个文件。\nAI 识别将在后台自动进行，稍后刷新列表即可查看标签。`);
    
  } finally {
    uploading.value = false;
    aiTotal.value = 0;
    aiCompleted.value = 0;
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
