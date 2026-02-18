<template>
  <div class="h-screen flex flex-col bg-base-100 text-base-content">
    <!-- Top Bar -->
    <div class="h-14 border-b border-base-300 flex items-center justify-between px-4 bg-base-100">
      <div>
        <h1 class="font-bold text-lg flex items-center gap-2">
          专题设计: {{ topicConfig.title || '未命名专题' }}
          <span v-if="hasConflict" class="badge badge-warning badge-sm" title="存在配置冲突">⚠️</span>
        </h1>
      </div>
      <div class="flex gap-2">
        <div class="dropdown dropdown-end">
          <label tabindex="0" class="btn btn-sm btn-outline">快速模板</label>
          <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
            <li><a @click="applyTemplate('default')">默认模板</a></li>
            <li><a @click="applyTemplate('couple')">情侣专题 (Couple)</a></li>
            <li><a @click="applyTemplate('avatar')">头像合集</a></li>
          </ul>
        </div>
        <button class="btn btn-sm btn-ghost" @click="goBack">返回</button>
        <button class="btn btn-sm text-white bg-[#07c160] hover:bg-[#06ad56] border-none" @click="saveLayout" :disabled="saving">
          <span v-if="saving" class="loading loading-spinner loading-xs"></span>
          保存发布
        </button>
      </div>
    </div>

    <div class="flex-1 flex overflow-hidden">
      <!-- Left: Config Panel -->
      <div class="w-80 border-r border-base-300 bg-base-200 flex flex-col overflow-y-auto">
        
        <!-- Tab Switcher -->
        <div class="tabs tabs-boxed m-2 bg-base-100">
          <a class="tab" :class="{ 'tab-active': activeTab === 'meta' }" @click="activeTab = 'meta'">基础设置</a>
          <a class="tab" :class="{ 'tab-active': activeTab === 'layout' }" @click="activeTab = 'layout'">布局组件</a>
        </div>

        <!-- Tab 1: Metadata Config -->
        <div v-show="activeTab === 'meta'" class="p-4 space-y-4">
          <div class="form-control w-full">
            <label class="label"><span class="label-text">专题标题</span></label>
            <input v-model="topicConfig.title" type="text" class="input input-bordered input-sm text-base-content" />
          </div>
          
          <div class="form-control w-full">
            <label class="label"><span class="label-text">专题描述</span></label>
            <textarea v-model="topicConfig.description" class="textarea textarea-bordered textarea-sm h-20 text-base-content"></textarea>
          </div>

          <div class="form-control w-full">
            <label class="label"><span class="label-text">资源类型</span></label>
            <select v-model="topicConfig.resourceType" class="select select-bordered w-full text-base-content" style="opacity: 1;">
              <option value="all">全部 (All)</option>
              <option value="wallpaper">壁纸 (Wallpaper)</option>
              <option value="avatar">头像 (Avatar)</option>
            </select>
          </div>

          <div class="bg-base-100 p-3 rounded-lg border border-base-300 space-y-2">
            <div class="text-xs font-bold flex items-center gap-1">
              筛选规则 
              <span v-if="conflictMsg" class="tooltip tooltip-bottom text-warning cursor-help" :data-tip="conflictMsg">⚠️</span>
            </div>
            <div class="form-control w-full">
            <label class="label py-1"><span class="label-text-alt">筛选类型</span></label>
            <select v-model="topicConfig.filterType" class="select select-bordered w-full text-base-content" style="opacity: 1;">
              <option value="tag">标签 (Tag)</option>
              <option value="category">分类 (Category)</option>
            </select>
          </div>
            <div class="form-control w-full">
              <label class="label py-1"><span class="label-text-alt">筛选值</span></label>
              <input v-model="topicConfig.filterValue" type="text" class="input input-bordered input-xs text-base-content" :class="{'input-warning': hasConflict}" />
              <label class="label py-0" v-if="hasConflict">
                <span class="label-text-alt text-warning">{{ conflictMsg }}</span>
              </label>
            </div>
            <button v-if="hasConflict" class="btn btn-xs btn-warning w-full mt-2" @click="fixConflict">自动修复 (改为全部类型)</button>
          </div>

          <div class="form-control w-full">
            <label class="label"><span class="label-text">默认排序</span></label>
            <select v-model="topicConfig.defaultSort" class="select select-bordered w-full text-base-content" style="opacity: 1;">
              <option value="latest">最新发布</option>
              <option value="hot">最热</option>
              <option value="random">随机</option>
            </select>
          </div>
          
          <div class="form-control w-full">
            <label class="label"><span class="label-text">排序权重 (越小越前)</span></label>
            <input v-model.number="topicConfig.sort" type="number" class="input input-bordered input-sm text-base-content" />
          </div>

          <div class="form-control w-full">
            <label class="label"><span class="label-text">状态</span></label>
            <select v-model="topicConfig.status" class="select select-bordered w-full text-base-content" style="opacity: 1;">
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
          </div>
        </div>

        <!-- Tab 2: Layout Config -->
        <div v-show="activeTab === 'layout'">
          <!-- Global Styles -->
          <div class="p-4 border-b border-base-300">
            <h3 class="font-bold mb-2 text-xs uppercase text-base-content/50">页面样式</h3>
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm">背景色</span>
              <div class="flex items-center gap-2">
                <input type="color" v-model="layout.backgroundColor" class="w-6 h-6 rounded cursor-pointer border-none p-0" />
                <span class="text-xs font-mono">{{ layout.backgroundColor }}</span>
              </div>
            </div>
            <div class="form-control w-full">
              <label class="label py-1"><span class="label-text-alt">内边距 ({{ layout.padding }}px)</span></label>
              <input type="range" v-model.number="layout.padding" min="0" max="30" class="range range-xs range-primary" />
            </div>
          </div>

          <!-- Selected Module Config -->
          <div v-if="selectedModule" class="p-4 border-b border-base-300 bg-base-100">
            <div class="flex justify-between items-center mb-2">
              <h3 class="font-bold text-primary text-sm">编辑: {{ getModuleName(selectedModule.type) }}</h3>
            </div>
             
             <!-- Common Config -->
             <div class="form-control w-full">
               <label class="label py-1"><span class="label-text-alt">下边距 ({{ selectedModule.marginBottom }}px)</span></label>
               <input type="range" v-model.number="selectedModule.marginBottom" min="0" max="50" class="range range-xs" />
             </div>

             <!-- Header Specific -->
             <div v-if="selectedModule.type === 'header'" class="space-y-2 mt-2">
               <div class="form-control w-full">
                 <label class="label py-1"><span class="label-text-alt">封面图片</span></label>
                 <div class="flex gap-2 items-center">
                   <div class="w-16 h-16 bg-base-200 rounded border overflow-hidden flex-shrink-0">
                     <img v-if="topicConfig.cover" :src="topicConfig.cover" class="w-full h-full object-cover" />
                     <div v-else class="w-full h-full flex items-center justify-center text-xs text-base-content/30">无图</div>
                   </div>
                   <button class="btn btn-sm btn-outline" @click="openResourcePicker('header')">修改图片</button>
                 </div>
               </div>
               <div class="form-control">
                 <label class="label cursor-pointer justify-start gap-2 py-1">
                   <input type="checkbox" v-model="selectedModule.config.showTitle" class="checkbox checkbox-xs checkbox-primary" />
                   <span class="label-text text-sm">显示标题</span>
                 </label>
               </div>
               <div class="form-control">
                 <label class="label cursor-pointer justify-start gap-2 py-1">
                   <input type="checkbox" v-model="selectedModule.config.showDescription" class="checkbox checkbox-xs checkbox-primary" />
                   <span class="label-text text-sm">显示描述</span>
                 </label>
               </div>
                <div class="form-control w-full">
                 <label class="label py-1"><span class="label-text-alt">高度 ({{ selectedModule.config.height }}rpx)</span></label>
                 <input type="range" v-model.number="selectedModule.config.height" min="100" max="600" step="10" class="range range-xs" />
               </div>
             </div>

             <!-- Grid Specific -->
             <div v-if="selectedModule.type === 'resource-grid'" class="space-y-3 mt-2">
                <div class="form-control w-full">
                 <label class="label py-1"><span class="label-text-alt">数据来源</span></label>
                 <select v-model="selectedModule.config.sourceType" class="select select-bordered w-full text-base-content" style="opacity: 1;">
                   <option value="filter">自动筛选 (Dynamic)</option>
                   <option value="manual">手动选择 (Manual)</option>
                 </select>
               </div>

                <div v-if="selectedModule.config.sourceType === 'manual'" class="bg-base-200 p-2 rounded space-y-2">
                  <div class="flex justify-between items-center">
                    <span class="text-xs font-bold">已选资源 ({{ (selectedModule.config.manualIds || []).length }})</span>
                    <button class="btn btn-xs btn-primary btn-outline" @click="openResourcePicker('grid-add')">+ 添加</button>
                  </div>
                  
                  <div class="space-y-2 max-h-60 overflow-y-auto pr-1">
                    <div v-for="(id, idx) in (selectedModule.config.manualIds || [])" :key="idx" class="flex items-center gap-2 bg-base-100 p-1 rounded border border-base-300">
                      <div class="w-10 h-10 bg-base-200 flex-shrink-0 rounded overflow-hidden">
                        <img v-if="resourceMap[id]" :src="resourceMap[id]" class="w-full h-full object-cover" />
                        <div v-else class="w-full h-full flex items-center justify-center text-[10px] text-base-content/30">...</div>
                      </div>
                      <div class="flex-1 min-w-0 text-xs truncate opacity-50">{{ id }}</div>
                      <button class="btn btn-xs btn-ghost btn-square text-info" title="替换" @click="openResourcePicker('grid-replace', idx)">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                      </button>
                      <button class="btn btn-xs btn-ghost btn-square text-error" title="移除" @click="selectedModule.config.manualIds.splice(idx, 1)">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                      </button>
                    </div>
                  </div>
                  <div class="text-[10px] text-base-content/50 text-center" v-if="(!selectedModule.config.manualIds || selectedModule.config.manualIds.length === 0)">暂无资源</div>
                </div>

                <div class="form-control w-full">
                 <label class="label py-1"><span class="label-text-alt">资源网格数量 ({{ selectedModule.config.count }})</span></label>
                 <input type="number" v-model.number="selectedModule.config.count" min="1" max="100" class="input input-bordered input-xs w-full text-base-content" @input="handleCountChange" />
               </div>
               
               <div class="form-control w-full">
                 <label class="label py-1"><span class="label-text-alt">列数 ({{ selectedModule.config.columns }})</span></label>
                 <div class="join w-full">
                   <button class="join-item btn btn-xs flex-1" :class="{ 'btn-active btn-primary': selectedModule.config.columns === 2 }" @click="selectedModule.config.columns = 2">2</button>
                   <button class="join-item btn btn-xs flex-1" :class="{ 'btn-active btn-primary': selectedModule.config.columns === 3 }" @click="selectedModule.config.columns = 3">3</button>
                   <button class="join-item btn btn-xs flex-1" :class="{ 'btn-active btn-primary': selectedModule.config.columns === 4 }" @click="selectedModule.config.columns = 4">4</button>
                 </div>
               </div>
               
                <div class="form-control w-full">
                 <label class="label py-1"><span class="label-text-alt">间距 ({{ selectedModule.config.gap }}px)</span></label>
                 <input type="range" v-model.number="selectedModule.config.gap" min="0" max="30" class="range range-xs" />
               </div>
                <div class="form-control w-full">
                 <label class="label py-1"><span class="label-text-alt">圆角 ({{ selectedModule.config.radius }}px)</span></label>
                 <input type="range" v-model.number="selectedModule.config.radius" min="0" max="30" class="range range-xs" />
               </div>
             </div>
          </div>

          <!-- Add Modules (Removed as per requirement) -->
          <div class="p-4 hidden">
          </div>
        </div>
        
        <!-- History -->
        <div class="p-4 border-t border-base-300 mt-auto bg-base-100">
           <div class="flex justify-between items-center mb-2">
             <h3 class="font-bold text-xs uppercase text-base-content/50">历史版本</h3>
             <button class="btn btn-xs btn-ghost" @click="loadHistory">刷新</button>
           </div>
           <div class="max-h-32 overflow-y-auto text-xs space-y-1">
             <div v-for="v in history" :key="v._id" class="flex justify-between items-center p-2 hover:bg-base-200 rounded transition-colors cursor-pointer border border-transparent hover:border-base-300">
               <div>
                 <div class="font-medium">{{ formatDate(v.createdAt) }}</div>
                 <div class="text-xs text-base-content/50">by {{ v.createdBy }}</div>
               </div>
               <button class="btn btn-xs btn-warning btn-outline" @click="rollback(v)">回滚</button>
             </div>
             <div v-if="history.length === 0" class="text-center text-base-content/50 py-2">暂无历史记录</div>
           </div>
        </div>
      </div>

      <!-- Center: Canvas -->
      <div class="flex-1 bg-base-300 flex justify-center items-center p-8 overflow-hidden relative">
        <div class="absolute top-4 left-4 badge badge-info">实时预览模式</div>
        
        <div class="scale-[0.65] xl:scale-[0.8] origin-center transition-transform">
          <div class="mockup-phone border-primary" style="border-radius: 40px; overflow: hidden;">
            <div class="camera" style="width: 100px; height: 30px; border-radius: 20px; background: black; top: 12px;"></div> 
            <div class="display" style="border-radius: 35px; overflow: hidden;">
              <div 
                class="artboard overflow-y-auto relative no-scrollbar bg-base-100" 
                :style="{ 
                  backgroundColor: layout.backgroundColor, 
                  width: '393px',
                  height: '852px'
                }"
              >
              <!-- Simulated WeChat Nav Bar -->
              <div class="sticky top-0 z-[100] h-[88px] w-full pointer-events-none transition-all duration-300" 
                   :style="{ background: 'transparent' }">
                <!-- Status Bar (44px) -->
                <div class="h-[44px] w-full"></div>
                <!-- Nav Bar (44px) -->
                <div class="h-[44px] w-full flex items-center px-4">
                    <div class="w-8 h-8 flex items-center justify-center text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </div>
                </div>
                <!-- Simulated Capsule -->
                <div class="absolute right-4 top-[50px] w-[87px] h-[32px] bg-white/20 border border-white/20 rounded-full flex items-center justify-between px-3 backdrop-blur-md">
                    <div class="w-1 h-1 bg-white rounded-full"></div>
                    <div class="w-1 h-1 bg-white rounded-full"></div>
                    <div class="w-1 h-1 bg-white rounded-full"></div>
                </div>
              </div>

              <!-- Draggable Area -->
              <draggable 
                v-model="layout.modules" 
                item-key="id"
                class="w-full min-h-[500px]"
                ghost-class="opacity-50"
                :animation="200"
              >
                <template #item="{ element }">
                  <div 
                    class="relative group border-2 border-transparent hover:border-blue-300 transition-all cursor-move"
                    :class="{ '!border-blue-500': selectedModule?.id === element.id }"
                    :style="{ 
                        marginBottom: element.marginBottom + 'px',
                        marginTop: element.type === 'resource-grid' ? '-33%' : '0',
                        padding: element.type === 'resource-grid' ? layout.padding + 'px' : '0',
                        position: 'relative',
                        zIndex: element.type === 'resource-grid' ? 10 : 0
                    }"
                    @click.stop="selectModule(element)"
                  >
                    
                    <!-- Header Preview -->
                    <div v-if="element.type === 'header'" class="w-full relative overflow-hidden bg-gray-900" 
                         :style="{ height: element.config.height + 'rpx', marginTop: '-88px' }">
                      <!-- Blurred Background -->
                      <img v-if="topicConfig.cover" :src="topicConfig.cover" class="w-full h-full object-cover absolute inset-0 blur-xl opacity-80 scale-110" />
                      <div v-else class="w-full h-full flex items-center justify-center text-gray-400 absolute inset-0"></div>
                      
                      <!-- Overlay Gradient -->
                      <div class="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60"></div>

                      <!-- Content -->
                      <div class="relative z-10 h-full flex flex-col justify-end p-6 pb-20 text-white text-shadow">
                         <div class="flex gap-4 items-end">
                            <div class="w-24 h-24 rounded-lg overflow-hidden shadow-2xl border-2 border-white/20 shrink-0">
                                <img v-if="topicConfig.cover" :src="topicConfig.cover" class="w-full h-full object-cover" />
                                <div v-else class="w-full h-full bg-white/10 flex items-center justify-center text-xs">封面</div>
                            </div>
                            <div class="flex-1 min-w-0 mb-1">
                                <div v-if="element.config.showTitle" class="font-bold text-xl leading-tight truncate">{{ topicConfig.title || '专题标题' }}</div>
                                <div v-if="element.config.showDescription" class="text-xs opacity-80 mt-1 line-clamp-2">{{ topicConfig.description || '专题描述...' }}</div>
                            </div>
                         </div>
                      </div>
                    </div>

                    <!-- Resource Grid Preview -->
                    <div v-else-if="element.type === 'resource-grid'" class="w-full">
                       <div v-if="element.config.sourceType === 'manual' && (!element.config.manualIds || element.config.manualIds.length === 0)" class="p-4 text-center bg-gray-100 rounded text-xs text-gray-400 border border-dashed">
                         请点击右侧配置选择资源
                       </div>
                       <div 
                         class="grid" 
                         :style="{ 
                           gridTemplateColumns: `repeat(${element.config.columns}, 1fr)`,
                           gap: element.config.gap + 'px'
                         }"
                       >
                         <div 
                           v-for="i in Math.min(element.config.count, element.config.sourceType === 'manual' ? (element.config.manualIds?.length || 0) : 8)" 
                           :key="i"
                           class="bg-gray-200 relative overflow-hidden group"
                           :style="{ 
                             borderRadius: element.config.radius + 'px',
                             aspectRatio: getAspectRatio(topicConfig.resourceType) 
                           }"
                         >
                           <img v-if="element.config.sourceType === 'manual' && element.config.manualIds && resourceMap[element.config.manualIds[i-1]]" :src="resourceMap[element.config.manualIds[i-1]]" class="w-full h-full object-cover" />
                           <div v-else class="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">
                             {{ element.config.sourceType === 'manual' ? '选' : '资源' }}{{i}}
                           </div>
                           <!-- Hover Actions -->
                           <div v-if="element.config.sourceType === 'manual'" class="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center gap-1">
                              <button class="btn btn-xs btn-circle btn-ghost text-white" @click.stop="openResourcePicker('grid-replace', i-1)">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                              </button>
                              <button class="btn btn-xs btn-circle btn-ghost text-error" @click.stop="clearGridItem(i-1)">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                              </button>
                           </div>
                         </div>
                       </div>
                       <div v-if="element.config.sourceType !== 'manual' && element.config.count > 8" class="text-center text-xs text-gray-400 mt-2">...共 {{ element.config.count }} 项</div>
                    </div>

                  </div>
                </template>
              </draggable>
              
              <div v-if="layout.modules.length === 0" class="absolute inset-0 flex items-center justify-center text-gray-400 pointer-events-none">
                <div class="text-center">
                  <p>拖拽或点击左侧按钮添加组件</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>

    <!-- Resource Picker Modal -->
    <ResourcePicker 
      v-if="showPicker" 
      :initial-selected="pickerContext.type === 'grid-add' ? [] : (pickerContext.type === 'grid-replace' && selectedModule?.config?.manualIds && typeof pickerContext.index === 'number' ? [selectedModule.config.manualIds[pickerContext.index]].filter(Boolean) : [])" 
      :limit="pickerContext.type === 'header' ? 1 : (pickerContext.type === 'grid-replace' ? (selectedModule.config.count - (pickerContext.index || 0)) : 0)"
      @close="showPicker = false" 
      @select="handleResourceSelect" 
    />

    <!-- Image Cropper Modal -->
    <ImageCropper
      v-if="showCropper"
      :image-url="croppingImageUrl"
      @close="showCropper = false"
      @confirm="onCropConfirm"
    />

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import draggable from "vuedraggable";
import { db, app } from "../utils/cloudbase";
import ResourcePicker from "../components/ResourcePicker.vue";
import ImageCropper from "../components/ImageCropper.vue";

const route = useRoute();
const router = useRouter();
const topicId = route.params.id as string;

const saving = ref(false);
const history = ref<any[]>([]);
const activeTab = ref('layout');
const showPicker = ref(false);
const showCropper = ref(false);
const croppingImageUrl = ref("");
const pickerContext = reactive<{ type: string, index?: number }>({ type: '' });
const resourceMap = reactive<Record<string, string>>({});

// Topic Metadata
const topicConfig = reactive({
  title: "",
  description: "",
  cover: "",
  resourceType: "all",
  defaultSort: "latest",
  filterType: "tag", 
  filterValue: "",
  status: "active",
  sort: 0
});

// Layout Data
const layout = reactive({
  type: 'custom',
  backgroundColor: '#ffffff',
  padding: 12,
  modules: [] as any[]
});

const selectedModule = ref<any>(null);

// Conflict Detection
const hasConflict = computed(() => {
  if (topicConfig.resourceType === 'all') return false;
  // Simple heuristic: if type is 'avatar' but filter is 'wallpaper' tag? 
  // Difficult to know without querying tags. 
  // But we can check for "Couple" scenario:
  // If filterValue contains '情侣' (Couple) and resourceType is specific, it might be limiting.
  // Actually, usually 'Couple' implies mixed types.
  if (topicConfig.filterValue.includes('情侣') && topicConfig.resourceType !== 'all') {
    return true;
  }
  return false;
});

const conflictMsg = computed(() => {
  if (hasConflict.value) {
    return `检测到"情侣"专题通常包含多种资源类型，当前仅选择了"${topicConfig.resourceType}"，可能导致内容显示不全。`;
  }
  return "";
});

const fixConflict = () => {
  topicConfig.resourceType = 'all';
};

const getAspectRatio = (type: string) => {
  if (type === 'avatar') return '1 / 1';
  if (type === 'wallpaper') return '9 / 16';
  return '3 / 4'; // Default/Mixed
};

onMounted(async () => {
  if (!topicId) {
    alert("缺少参数");
    router.back();
    return;
  }
  await loadTopic();
  await loadHistory();
});

const loadTopic = async () => {
  try {
    const res = await db.collection("topics").doc(topicId).get();
    
    // Fix: Handle different SDK response structures
    let topicData: any = null;
    if (res.data) {
      if (Array.isArray(res.data)) {
        topicData = res.data[0];
      } else {
        topicData = res.data;
      }
    }
    
    if (topicData) {
      // Load metadata with type safety checks
      topicConfig.title = topicData.title || "";
      topicConfig.description = topicData.description || "";
      topicConfig.cover = topicData.cover || "";
      
      // Validate enum values to ensure select options match
      const validResourceTypes = ["all", "wallpaper", "avatar"];
      topicConfig.resourceType = validResourceTypes.includes(topicData.resourceType) ? topicData.resourceType : "all";
      
      const validSorts = ["latest", "hot", "random"];
      topicConfig.defaultSort = validSorts.includes(topicData.defaultSort) ? topicData.defaultSort : "latest";
      
      const validFilterTypes = ["tag", "category"];
      topicConfig.filterType = validFilterTypes.includes(topicData.filterType) ? topicData.filterType : "tag";
      
      topicConfig.filterValue = topicData.filterValue || "";
      
      const validStatus = ["active", "inactive"];
      topicConfig.status = validStatus.includes(topicData.status) ? topicData.status : "active";
      
      topicConfig.sort = typeof topicData.sort === 'number' ? topicData.sort : 0;
      
      // Load layout
      if (topicData.layout && Array.isArray(topicData.layout.modules)) {
        Object.assign(layout, topicData.layout);
        
        // Ensure default modules exist if empty (legacy data)
        if (layout.modules.length === 0) {
           initDefaultModules();
        }

        // Fetch resources for all manual grids
        const allManualIds: string[] = [];
        layout.modules.forEach(m => {
          if (m.type === 'resource-grid' && m.config.sourceType === 'manual' && m.config.manualIds) {
            allManualIds.push(...m.config.manualIds);
          }
        });
        if (allManualIds.length > 0) {
          fetchResourcesDetails(allManualIds);
        }
      } else {
        // Default layout init
        initDefaultModules();
      }
    }
  } catch (err) {
    console.error(err);
    alert("加载失败");
  }
};

const loadHistory = async () => {
  try {
    const res = await app.callFunction({
      name: "manageTopicLayout",
      data: { action: "getHistory", topicId }
    });
    if (res.result.success) {
      history.value = res.result.data;
    }
  } catch (err) {
    console.error(err);
  }
};

const initDefaultModules = () => {
  layout.modules = [];
  
  // 1. Header
  const headerId = `header-${Date.now()}`;
  layout.modules.push({
    id: headerId,
    type: 'header',
    marginBottom: 10,
    config: { height: 400, showTitle: true, showDescription: true }
  });

  // 2. Resource Grid
  const gridId = `resource-grid-${Date.now()}`;
  layout.modules.push({
    id: gridId,
    type: 'resource-grid',
    marginBottom: 10,
    config: { 
      count: 4, 
      columns: 2, 
      gap: 10, 
      radius: 8,
      sourceType: 'filter', // filter | manual
      manualIds: ['', '', '', ''] // Init with empty strings for count=4
    }
  });
  
  // Select Header by default
  selectedModule.value = layout.modules[0];
};

// Deprecated: Layout is fixed, but keeping function to avoid unused var error if referenced in template (though template also removed usage)
// Actually, template references are removed, so we can remove these functions or comment them out.
// But wait, the error says 'is declared but its value is never read'.
// So I should just remove them or use them.
// Let's remove them and their usages.


const selectModule = (module: any) => {
  selectedModule.value = module;
  // If selecting grid, switch to layout tab? Not necessarily.
};

const getModuleName = (type: string) => {
  const map: any = {
    'header': '封面头图',
    'resource-grid': '资源网格'
  };
  return map[type] || type;
};

const openResourcePicker = (type: string, index?: any) => {
  pickerContext.type = type;
  pickerContext.index = typeof index === 'number' ? index : undefined;
  showPicker.value = true;
};

const handleResourceSelect = (ids: string[], items: any[]) => {
  // Update resource map with new items
  items.forEach(item => {
    if (item.previewUrl) {
      resourceMap[item._id] = item.previewUrl;
    }
  });

  if (pickerContext.type === 'header') {
    if (items.length > 0) {
      // Open Cropper with the selected image
      croppingImageUrl.value = items[0].previewUrl || items[0].originUrl;
      showCropper.value = true;
    }
  } else if (pickerContext.type === 'grid-add') {
    if (selectedModule.value && selectedModule.value.type === 'resource-grid') {
      const currentIds = selectedModule.value.config.manualIds || [];
      const newIds = [...currentIds, ...ids];
      // Deduplicate
      selectedModule.value.config.manualIds = [...new Set(newIds)];
      selectedModule.value.config.count = selectedModule.value.config.manualIds.length;
    }
  } else if (pickerContext.type === 'grid-replace') {
    if (selectedModule.value && selectedModule.value.type === 'resource-grid' && typeof pickerContext.index === 'number') {
       const startIndex = pickerContext.index;
       const manualIds = selectedModule.value.config.manualIds;
       // Fill starting from startIndex, ensuring we don't exceed array bounds
       ids.forEach((id, i) => {
         if (startIndex + i < manualIds.length) {
           manualIds[startIndex + i] = id;
         }
       });
    }
  }
};

const fetchResourcesDetails = async (ids: string[]) => {
  if (!ids || ids.length === 0) return;
  // Filter out already cached
  const missingIds = ids.filter(id => !resourceMap[id]);
  if (missingIds.length === 0) return;

  try {
    const res = await db.collection('resources').where({
      _id: db.command.in(missingIds)
    }).get();
    
    const items = res.data;
    const fileList = items.map((i: any) => i.coverUrl || i.originUrl).filter(Boolean);
    
    if (fileList.length > 0) {
      const urlRes = await app.getTempFileURL({ fileList: fileList.map((f: string) => ({ fileID: f, maxAge: 3600 })) });
      const urlMap = new Map((urlRes.fileList || []).map((f: any) => [f.fileID, f.tempFileURL]));
      
      items.forEach((i: any) => {
        const url = urlMap.get(i.coverUrl || i.originUrl);
        if (url) {
          resourceMap[i._id] = url;
        }
      });
    }
  } catch (e) {
    console.error("Failed to fetch resource details", e);
  }
};

const handleCountChange = () => {
  if (selectedModule.value && selectedModule.value.type === 'resource-grid' && selectedModule.value.config.sourceType === 'manual') {
     const newCount = selectedModule.value.config.count;
     const currentIds = selectedModule.value.config.manualIds || [];
     if (newCount > currentIds.length) {
       // Fill with empty strings
       const fill = Array(newCount - currentIds.length).fill('');
       selectedModule.value.config.manualIds = [...currentIds, ...fill];
     } else if (newCount < currentIds.length) {
       // Truncate
       selectedModule.value.config.manualIds = currentIds.slice(0, newCount);
     }
  }
};

const clearGridItem = (index: number) => {
  if (selectedModule.value && selectedModule.value.config.manualIds) {
    selectedModule.value.config.manualIds[index] = '';
  }
};

const onCropConfirm = async (blob: Blob) => {
  try {
    const cloudPath = `topics/covers/crop-${Date.now()}.jpg`;
    const res = await app.uploadFile({
      cloudPath,
      filePath: blob as any
    });
    
    if (res.fileID) {
      const urlRes = await app.getTempFileURL({ fileList: [{ fileID: res.fileID, maxAge: 3600 * 24 }] });
      if (urlRes.fileList && urlRes.fileList.length > 0) {
         const fileItem = urlRes.fileList[0];
         if (fileItem) {
           topicConfig.cover = fileItem.tempFileURL;
         }
      }
    }
  } catch (e) {
    console.error("Crop upload failed", e);
    alert("图片上传失败");
  } finally {
    showCropper.value = false;
  }
};

const applyTemplate = (tpl: string) => {
  if (!confirm("应用模板将覆盖当前配置，确定吗？")) return;
  
  // Clear current modules
  layout.modules = [];
  
  if (tpl === 'couple') {
    topicConfig.resourceType = 'all';
    topicConfig.filterType = 'tag';
    topicConfig.filterValue = '情侣';
    
    // Header
    const headerId = `header-${Date.now()}`;
    layout.modules.push({
        id: headerId,
        type: 'header',
        marginBottom: 10,
        config: { height: 400, showTitle: true, showDescription: true }
    });

    // Grid
    const gridId = `resource-grid-${Date.now()}`;
    layout.modules.push({
      id: gridId,
      type: 'resource-grid',
      marginBottom: 10,
      config: { count: 20, columns: 2, gap: 10, radius: 12, sourceType: 'filter' }
    });
    
    activeTab.value = 'meta'; // Focus on meta to show conflict fix if any
  } else if (tpl === 'avatar') {
    topicConfig.resourceType = 'avatar';
    
    // Header
    const headerId = `header-${Date.now()}`;
    layout.modules.push({
        id: headerId,
        type: 'header',
        marginBottom: 10,
        config: { height: 400, showTitle: true, showDescription: true }
    });

    // Grid
    const gridId = `resource-grid-${Date.now()}`;
    layout.modules.push({
      id: gridId,
      type: 'resource-grid',
      marginBottom: 10,
      config: { count: 30, columns: 4, gap: 5, radius: 0, sourceType: 'filter' } // 4 cols for avatars
    });
  } else {
    // Default
    initDefaultModules();
  }
};

const saveLayout = async () => {
  saving.value = true;
  try {
    // 1. Update Topic Metadata directly
    await db.collection("topics").doc(topicId).update({
      ...topicConfig,
      // updateTime handled by manageTopicLayout too, but good to have here
    });

    // 2. Save Layout via Cloud Function (creates history)
    const res = await app.callFunction({
      name: "manageTopicLayout",
      data: {
        action: "save",
        topicId,
        layout: JSON.parse(JSON.stringify(layout)) // clean proxy
      }
    });
    
    if (res.result.success) {
      alert("保存发布成功");
      loadHistory();
    } else {
      alert("保存失败: " + res.result.error);
    }
  } catch (err) {
    console.error(err);
    alert("保存出错");
  } finally {
    saving.value = false;
  }
};

const rollback = async (version: any) => {
  if (!confirm(`确定回滚到 ${formatDate(version.createdAt)} 的版本吗？`)) return;
  
  try {
    const res = await app.callFunction({
      name: "manageTopicLayout",
      data: {
        action: "rollback",
        topicId,
        versionId: version._id
      }
    });
    
    if (res.result.success) {
      alert("回滚成功");
      await loadTopic();
      await loadHistory();
    } else {
      alert("回滚失败");
    }
  } catch (err) {
    console.error(err);
  }
};

const goBack = () => {
  router.back();
};

const formatDate = (ts: number) => {
  return new Date(ts).toLocaleString();
};
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
