<template>
  <div class="h-screen flex flex-col bg-[var(--bg-card)] text-[var(--text-main)]">
    <!-- Top Bar -->
    <div class="h-16 border-b border-[var(--border-color)] flex items-center justify-between px-6 bg-[var(--bg-card)]">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            <path fill-rule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2H4zm0 2h12v8H4V7z" clip-rule="evenodd" />
          </svg>
        </div>
        <div>
          <h1 class="font-bold text-lg flex items-center gap-2 text-[var(--text-main)]">
            专题设计
            <span v-if="topicConfig.title" class="text-[var(--text-sub)] font-normal">· {{ topicConfig.title }}</span>
          </h1>
          <p class="text-xs text-[var(--text-sub)]">配置封面、布局与展示资源</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="relative group">
          <button class="btn gap-1.5 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
            </svg>
            快速模板
          </button>
          <div class="absolute right-0 top-full mt-2 hidden group-hover:block group-focus-within:block z-20 min-w-[180px] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-lg py-1.5 overflow-hidden">
            <button class="w-full text-left px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--bg-body)] transition-colors" @click="applyTemplate('default')">默认模板</button>
            <button class="w-full text-left px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--bg-body)] transition-colors" @click="applyTemplate('couple')">情侣专题 (Couple)</button>
            <button class="w-full text-left px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--bg-body)] transition-colors" @click="applyTemplate('avatar')">头像合集</button>
          </div>
        </div>
        <button class="btn gap-1.5 text-sm" @click="goBack">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
          </svg>
          返回
        </button>
        <button class="btn-primary gap-1.5 text-sm" @click="saveLayout" :disabled="saving">
          <svg v-if="!saving" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
          <span v-if="saving" class="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          保存发布
        </button>
      </div>
    </div>

    <div class="flex-1 flex overflow-hidden">
      <!-- Left: Config Panel -->
      <div class="w-80 border-r border-[var(--border-color)] bg-[var(--bg-body)] flex flex-col overflow-y-auto">
        
        <!-- Tab Switcher -->
        <div class="p-4">
          <div class="flex gap-1 p-1.5 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)]">
            <button class="flex-1 px-3 py-2 text-sm rounded-lg transition-colors font-medium" :class="activeTab === 'meta' ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-[var(--bg-body)]'" @click="activeTab = 'meta'">基础设置</button>
            <button class="flex-1 px-3 py-2 text-sm rounded-lg transition-colors font-medium" :class="activeTab === 'layout' ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-[var(--bg-body)]'" @click="activeTab = 'layout'">布局组件</button>
          </div>
        </div>

        <!-- Tab 1: Metadata Config -->
        <div v-show="activeTab === 'meta'" class="px-4 pb-4 space-y-4">
          <div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 space-y-4 shadow-sm">
            <div class="field">
              <span>专题标题</span>
              <input v-model="topicConfig.title" type="text" class="input" placeholder="输入专题名称" />
            </div>

            <div class="field">
              <span>专题描述</span>
              <textarea v-model="topicConfig.description" class="textarea" placeholder="输入专题描述，显示在封面下方"></textarea>
            </div>

            <!-- 封面设置：从布局组件 tab 提升到基础设置，避免用户找不到 -->
            <div class="field">
              <span>专题封面</span>
              <div class="flex gap-3 items-center">
                <div class="w-24 h-24 bg-[var(--bg-body)] rounded-xl border border-[var(--border-color)] overflow-hidden flex-shrink-0">
                  <img v-if="topicConfig.cover" :src="topicConfig.cover" class="w-full h-full object-cover" />
                  <div v-else class="w-full h-full flex items-center justify-center text-xs text-[var(--text-sub)] text-center px-1">点击右侧<br/>选择图片</div>
                </div>
                <div class="flex flex-col gap-2 flex-1">
                  <button class="btn-primary text-sm px-4 py-2" @click="openResourcePicker('header')">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" /></svg>
                    {{ topicConfig.cover ? '修改封面' : '选择封面' }}
                  </button>
                  <button v-if="topicConfig.cover" class="btn text-xs px-3 py-1.5" :style="{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }" @click="clearCover">
                    移除封面
                  </button>
                </div>
              </div>
              <p class="text-xs text-[var(--text-sub)] mt-1.5">从资源库选择图片后会进入裁剪，裁剪后自动上传。封面同时用于小程序专题列表展示。</p>
            </div>

            <div class="field">
              <span>资源类型</span>
              <select v-model="topicConfig.resourceType" class="select">
                <option value="all">全部 (All)</option>
                <option value="wallpaper">壁纸 (Wallpaper)</option>
                <option value="avatar">头像 (Avatar)</option>
              </select>
            </div>
          </div>

          <!-- 筛选规则 -->
          <div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 space-y-4 shadow-sm">
            <div class="text-sm font-semibold flex items-center gap-2 pb-2 border-b border-[var(--border-color)]">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[var(--primary)]" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
              </svg>
              筛选规则
              <span v-if="conflictMsg" class="text-amber-500 cursor-help" :title="conflictMsg">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
              </span>
            </div>
            <div class="field">
              <span class="text-[var(--text-sub)]">筛选类型</span>
              <select v-model="topicConfig.filterType" class="select">
                <option value="tag">标签 (Tag)</option>
                <option value="category">分类 (Category)</option>
              </select>
            </div>
            <div class="field">
              <span class="text-[var(--text-sub)]">筛选值</span>
              <input v-model="topicConfig.filterValue" type="text" class="input" :class="{'border-amber-400 focus:border-amber-400 focus:shadow-amber-100': hasConflict}" placeholder="例如：情侣、可爱" />
              <p class="text-xs text-amber-500 mt-1" v-if="hasConflict">{{ conflictMsg }}</p>
            </div>
            <button v-if="hasConflict" class="btn gap-2 text-xs w-full" :style="{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }" @click="fixConflict">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.532 1.532 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.532 1.532 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" /></svg>
              自动修复 (改为全部类型)
            </button>
          </div>

          <div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 space-y-4 shadow-sm">
            <div class="field">
              <span>默认排序</span>
              <select v-model="topicConfig.defaultSort" class="select">
                <option value="latest">最新发布</option>
                <option value="hot">最热</option>
                <option value="random">随机</option>
              </select>
            </div>

            <div class="field">
              <span>详情页列数 <span class="text-xs text-[var(--text-sub)] font-normal">（小程序专题详情资源列表每行显示几个）</span></span>
              <div class="flex gap-1.5">
                <button
                  v-for="n in [2, 3, 4]"
                  :key="n"
                  type="button"
                  class="flex-1 py-2 text-sm rounded-lg font-medium transition-all"
                  :class="topicConfig.gridColumns === n
                    ? 'bg-[var(--primary)] text-white shadow-sm'
                    : 'bg-[var(--bg-body)] text-[var(--text-sub)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)]'"
                  @click="topicConfig.gridColumns = n"
                >{{ n }} 列</button>
              </div>
            </div>

            <div class="field">
              <span>排序权重 (越小越前)</span>
              <input v-model.number="topicConfig.sort" type="number" class="input" />
            </div>

            <div class="field">
              <span>状态</span>
              <select v-model="topicConfig.status" class="select">
                <option value="active">启用</option>
                <option value="inactive">停用</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Tab 2: Layout Config -->
        <div v-show="activeTab === 'layout'" class="px-4 pb-4 space-y-4">
          <!-- Global Styles -->
          <div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 space-y-4 shadow-sm">
            <h3 class="font-semibold text-sm flex items-center gap-2 text-[var(--text-main)]">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[var(--primary)]" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clip-rule="evenodd" />
              </svg>
              页面样式
            </h3>
            <div class="flex items-center justify-between">
              <span class="text-sm text-[var(--text-sub)]">背景色</span>
              <div class="flex items-center gap-2">
                <input type="color" v-model="layout.backgroundColor" class="w-7 h-7 rounded cursor-pointer border-none p-0 bg-transparent" />
                <span class="text-xs font-mono px-2 py-1 rounded bg-[var(--bg-body)] border border-[var(--border-color)]">{{ layout.backgroundColor }}</span>
              </div>
            </div>
            <div class="field">
              <span class="text-[var(--text-sub)]">内边距 ({{ layout.padding }}px)</span>
              <input type="range" v-model.number="layout.padding" min="0" max="30" class="w-full h-1.5 bg-[var(--border-color)] rounded-lg appearance-none cursor-pointer accent-[var(--primary)]" />
            </div>
          </div>

          <!-- 添加模块：模块库面板 -->
          <div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 space-y-3 shadow-sm">
            <h3 class="font-semibold text-sm flex items-center gap-2 text-[var(--text-main)] pb-2 border-b border-[var(--border-color)]">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[var(--primary)]" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
              </svg>
              添加模块
            </h3>
            <p class="text-xs text-[var(--text-sub)]">点击下方模块添加到画布，然后在画布中拖拽排序、点击编辑</p>
            <div class="grid grid-cols-2 gap-2">
              <button class="btn text-xs px-3 py-2.5 flex flex-col items-center gap-1" @click="addModule('header')">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--primary)]" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" /></svg>
                <span>封面头图</span>
              </button>
              <button class="btn text-xs px-3 py-2.5 flex flex-col items-center gap-1" @click="addModule('resource-grid')">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--primary)]" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zm8-8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z" /></svg>
                <span>资源网格</span>
              </button>
            </div>
            <p class="text-xs text-[var(--text-sub)] mt-2 pt-2 border-t border-[var(--border-color)]">
              提示：资源网格选"手动选择"模式后，可自由挑选图片在网格中展示；选"自动筛选"则按专题的标签/分类自动展示列表
            </p>
          </div>

          <!-- Selected Module Config -->
          <div v-if="selectedModule" class="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 space-y-4 shadow-sm">
            <div class="flex items-center gap-2 pb-3 border-b border-[var(--border-color)]">
              <div class="w-7 h-7 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </div>
              <h3 class="font-semibold text-sm text-[var(--text-main)] flex-1">编辑: {{ getModuleName(selectedModule.type) }}</h3>
              <button class="px-2.5 py-1 text-xs rounded-lg text-red-500 hover:bg-red-500/10 transition-colors border border-red-500/20" @click="removeModule(selectedModule.id)" title="删除该模块">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 inline -mt-0.5 mr-0.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 000-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                删除
              </button>
            </div>

             <!-- Common Config -->
             <div class="field">
               <span class="text-[var(--text-sub)]">下边距 ({{ selectedModule.marginBottom }}px)</span>
               <input type="range" v-model.number="selectedModule.marginBottom" min="0" max="50" class="w-full h-1.5 bg-[var(--border-color)] rounded-lg appearance-none cursor-pointer accent-[var(--primary)]" />
             </div>

             <!-- Header Specific -->
             <div v-if="selectedModule.type === 'header'" class="space-y-4">
               <div class="field">
                 <span class="text-[var(--text-sub)]">封面图片</span>
                 <div class="flex gap-3 items-center">
                   <div class="w-20 h-20 bg-[var(--bg-body)] rounded-xl border border-[var(--border-color)] overflow-hidden flex-shrink-0">
                     <img v-if="topicConfig.cover" :src="topicConfig.cover" class="w-full h-full object-cover" />
                     <div v-else class="w-full h-full flex items-center justify-center text-xs text-[var(--text-sub)]">无图</div>
                   </div>
                   <button class="btn-primary text-sm px-4 py-2" @click="openResourcePicker('header')">
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" /></svg>
                     修改图片
                   </button>
                 </div>
               </div>
               <label class="flex items-center gap-2.5 py-1 cursor-pointer">
                 <input type="checkbox" v-model="selectedModule.config.showTitle" class="w-4 h-4 rounded border-[var(--border-color)] text-[var(--primary)]" />
                 <span class="text-sm text-[var(--text-main)]">显示标题</span>
               </label>
               <label class="flex items-center gap-2.5 py-1 cursor-pointer">
                 <input type="checkbox" v-model="selectedModule.config.showDescription" class="w-4 h-4 rounded border-[var(--border-color)] text-[var(--primary)]" />
                 <span class="text-sm text-[var(--text-main)]">显示描述</span>
               </label>
               <div class="field">
                 <span class="text-[var(--text-sub)]">高度 ({{ selectedModule.config.height }}rpx)</span>
                 <input type="range" v-model.number="selectedModule.config.height" min="100" max="600" step="10" class="w-full h-1.5 bg-[var(--border-color)] rounded-lg appearance-none cursor-pointer accent-[var(--primary)]" />
               </div>
             </div>

             <!-- Grid Specific -->
             <div v-if="selectedModule.type === 'resource-grid'" class="space-y-4">
                <div class="field">
                 <span class="text-[var(--text-sub)]">数据来源</span>
                 <select v-model="selectedModule.config.sourceType" class="select">
                   <option value="filter">自动筛选 (Dynamic)</option>
                   <option value="manual">手动选择 (Manual)</option>
                 </select>
               </div>

                <LayoutResourcePicker
                  v-if="selectedModule.config.sourceType === 'manual'"
                  v-model="selectedModule.config.manualIds"
                  :resource-map="resourceMap"
                  @add="openResourcePicker('grid-add')"
                  @replace="(idx) => openResourcePicker('grid-replace', idx)"
                />

                <div class="field">
                 <span class="text-[var(--text-sub)]">资源网格数量 ({{ selectedModule.config.count }})</span>
                 <input type="number" v-model.number="selectedModule.config.count" min="1" max="100" class="input input-sm" @input="handleCountChange" />
               </div>

               <div class="field">
                 <span class="text-[var(--text-sub)]">列数 ({{ selectedModule.config.columns }})</span>
                 <div class="flex w-full border border-[var(--border-color)] rounded-xl overflow-hidden bg-[var(--bg-body)]">
                   <button class="flex-1 px-2 py-1.5 text-xs transition-colors font-medium" :class="{ 'bg-[var(--primary)] text-white': selectedModule.config.columns === 2 }" @click="selectedModule.config.columns = 2">2</button>
                   <button class="flex-1 px-2 py-1.5 text-xs transition-colors font-medium" :class="{ 'bg-[var(--primary)] text-white': selectedModule.config.columns === 3 }" @click="selectedModule.config.columns = 3">3</button>
                   <button class="flex-1 px-2 py-1.5 text-xs transition-colors font-medium" :class="{ 'bg-[var(--primary)] text-white': selectedModule.config.columns === 4 }" @click="selectedModule.config.columns = 4">4</button>
                 </div>
               </div>

                <div class="field">
                 <span class="text-[var(--text-sub)]">间距 ({{ selectedModule.config.gap }}px)</span>
                 <input type="range" v-model.number="selectedModule.config.gap" min="0" max="30" class="w-full h-1.5 bg-[var(--border-color)] rounded-lg appearance-none cursor-pointer accent-[var(--primary)]" />
               </div>
                <div class="field">
                 <span class="text-[var(--text-sub)]">圆角 ({{ selectedModule.config.radius }}px)</span>
                 <input type="range" v-model.number="selectedModule.config.radius" min="0" max="30" class="w-full h-1.5 bg-[var(--border-color)] rounded-lg appearance-none cursor-pointer accent-[var(--primary)]" />
               </div>
             </div>
          </div>

          <div v-else class="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-8 text-center text-[var(--text-sub)] shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
            <p class="text-sm">点击预览区中的组件进行编辑</p>
          </div>
        </div>
        
        <!-- History -->
        <div class="p-4 border-t border-[var(--border-color)] mt-auto bg-[var(--bg-card)]">
           <div class="flex justify-between items-center mb-3">
             <h3 class="font-semibold text-xs uppercase text-[var(--text-sub)] flex items-center gap-1.5">
               <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" /></svg>
               历史版本
             </h3>
             <button class="btn text-xs px-2.5 py-1" @click="loadHistory">
               <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" /></svg>
               刷新
             </button>
           </div>
           <div class="max-h-32 overflow-y-auto text-xs space-y-1.5">
             <div v-for="v in history" :key="v._id" class="flex justify-between items-center p-2.5 hover:bg-[var(--bg-body)] rounded-lg transition-colors cursor-pointer border border-transparent hover:border-[var(--border-color)]">
               <div>
                 <div class="font-medium text-[var(--text-main)]">{{ formatDate(v.createdAt) }}</div>
                 <div class="text-[10px] text-[var(--text-sub)]">by {{ v.createdBy }}</div>
               </div>
               <button class="btn text-xs px-2.5 py-1" :style="{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }" @click="rollback(v)">回滚</button>
             </div>
             <div v-if="history.length === 0" class="text-center text-[var(--text-sub)] py-3">暂无历史记录</div>
           </div>
        </div>
      </div>

      <!-- Center: Canvas -->
      <LayoutCanvas
        v-model="layout.modules"
        :background-color="layout.backgroundColor"
        :padding="layout.padding"
        :selected-module="selectedModule"
        :topic-config="topicConfig"
        :resource-map="resourceMap"
        @select-module="selectModule"
        @open-picker="(payload) => openResourcePicker(payload.type, payload.index)"
        @clear-grid-item="clearGridItem"
      />
    </div>

    <!-- Resource Picker Modal -->
    <ResourcePicker
      v-if="showPicker"
      :initial-selected="pickerInitialSelected"
      :limit="pickerLimit"
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
import { useMessage, useDialog } from "naive-ui";
import { db, app, callCloudFunction, callFunctionWithAuth } from "../utils/cloudbase";
import ResourcePicker from "../components/ResourcePicker.vue";
import ImageCropper from "../components/ImageCropper.vue";
import LayoutCanvas from "../components/LayoutCanvas.vue";
import LayoutResourcePicker from "../components/LayoutResourcePicker.vue";
import type { LayoutModule, GridModule, LayoutData, TopicConfig, ModuleType, ResourceMap, ResourceItem, LayoutVersion, TempFileUrlItem } from "../types";

const message = useMessage();
const dialog = useDialog();

const route = useRoute();
const router = useRouter();
const topicId = route.params.id as string;

const saving = ref(false);
const history = ref<LayoutVersion[]>([]);
const activeTab = ref('meta');
const showPicker = ref(false);
const showCropper = ref(false);
const croppingImageUrl = ref("");
const pickerContext = reactive<{ type: string, index?: number }>({ type: '' });
const resourceMap = reactive<ResourceMap>({});

// Topic Metadata
const topicConfig = reactive<TopicConfig>({
  title: "",
  description: "",
  cover: "",
  coverFileID: "",
  resourceType: "all",
  defaultSort: "latest",
  filterType: "tag",
  filterValue: "",
  status: "active",
  sort: 0,
  gridColumns: 3
});

// Layout Data
const layout = reactive<LayoutData>({
  type: 'custom',
  backgroundColor: '#ffffff',
  padding: 12,
  modules: []
});

const selectedModule = ref<LayoutModule | null>(null);

// Picker computed props (extracted from template for proper type narrowing)
const pickerInitialSelected = computed<string[]>(() => {
  if (pickerContext.type === 'grid-add') return [];
  if (pickerContext.type === 'grid-replace'
      && selectedModule.value
      && selectedModule.value.type === 'resource-grid'
      && selectedModule.value.config.manualIds
      && typeof pickerContext.index === 'number') {
    const id = selectedModule.value.config.manualIds[pickerContext.index];
    return id ? [id] : [];
  }
  return [];
});

const pickerLimit = computed<number>(() => {
  if (pickerContext.type === 'header') return 1;
  if (pickerContext.type === 'grid-replace'
      && selectedModule.value
      && selectedModule.value.type === 'resource-grid') {
    return selectedModule.value.config.count - (pickerContext.index || 0);
  }
  return 0;
});

// Conflict Detection
const hasConflict = computed(() => {
  if (topicConfig.resourceType === 'all') return false;
  // Simple heuristic: if type is 'avatar' but filter is 'wallpaper' tag? 
  // Difficult to know without querying tags. 
  // But we can check for "Couple" scenario:
  // If filterValue contains '情侣' (Couple) and resourceType is specific, it might be limiting.
  // Actually, usually 'Couple' implies mixed types.
  if (topicConfig.filterValue.includes('情侣')) {
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

onMounted(async () => {
  if (!topicId) {
    message.warning("缺少参数");
    router.back();
    return;
  }
  await loadTopic();
  await loadHistory();
});

const loadTopic = async () => {
  try {
    // 通过云函数读取专题详情，避免客户端直接读 DB 受安全规则限制
    // topics 集合未配置 read: true，客户端 db.collection().doc().get() 在非创建者读取时会返回空
    const cfRes = await callCloudFunction('getTopics', { id: topicId });
    const topicData = cfRes?.success && cfRes.data ? cfRes.data : null;

    if (topicData) {
      // Load metadata with type safety checks
      topicConfig.title = topicData.title || "";
      topicConfig.description = topicData.description || "";
      topicConfig.coverFileID = topicData.coverFileID || "";

      // Resolve cover display URL: prefer existing HTTP URL, otherwise derive from fileID
      const rawCover = topicData.cover || "";
      if (rawCover && rawCover.startsWith("cloud://")) {
        try {
          const urlRes = await app.getTempFileURL({ fileList: [{ fileID: rawCover, maxAge: 3600 * 24 }] });
          const fileItem = urlRes.fileList?.[0];
          topicConfig.cover = fileItem?.tempFileURL || rawCover;
        } catch (e) {
          console.warn("Failed to resolve cover temp URL", e);
          topicConfig.cover = rawCover;
        }
      } else {
        topicConfig.cover = rawCover;
      }

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

      // 详情页资源列表列数（2~4，默认 3）
      const gcols = typeof topicData.gridColumns === 'number' ? topicData.gridColumns : 3;
      topicConfig.gridColumns = Math.min(4, Math.max(2, gcols));

      // Load layout
      if (topicData.layout && Array.isArray(topicData.layout.modules)) {
        Object.assign(layout, topicData.layout);

        // Ensure default modules exist if empty (legacy data)
        if (layout.modules.length === 0) {
           initDefaultModules();
        } else {
          // 已有模块时默认选中 header（优先），否则选中第一个
          // 修复：之前未设置 selectedModule，导致用户进来看到"点击预览区组件"提示，找不到封面/布局选项
          const header = layout.modules.find(m => m.type === 'header');
          selectedModule.value = header || layout.modules[0] || null;
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
    message.error("加载失败");
  }
};

const loadHistory = async () => {
  try {
    const res = await callFunctionWithAuth("manageTopicLayout", { action: "getHistory", topicId });
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
  selectedModule.value = layout.modules[0] || null;
};

// Deprecated: Layout is fixed, but keeping function to avoid unused var error if referenced in template (though template also removed usage)
// Actually, template references are removed, so we can remove these functions or comment them out.
// But wait, the error says 'is declared but its value is never read'.
// So I should just remove them or use them.
// Let's remove them and their usages.


const selectModule = (module: LayoutModule) => {
  selectedModule.value = module;
};

const getModuleName = (type: ModuleType) => {
  const map: Record<ModuleType, string> = {
    'header': '封面头图',
    'resource-grid': '资源网格'
  };
  return map[type] || type;
};

// 添加模块到画布
const addModule = (type: ModuleType) => {
  const id = `${type}-${Date.now()}`;
  const marginBottom = 10;
  let newModule: LayoutModule;
  switch (type) {
    case 'header':
      newModule = { id, type: 'header', marginBottom, config: { height: 400, showTitle: true, showDescription: true } };
      break;
    case 'resource-grid':
      newModule = { id, type: 'resource-grid', marginBottom, config: { count: 4, columns: 2, gap: 10, radius: 8, sourceType: 'filter', manualIds: [] } };
      break;
    default:
      return;
  }
  layout.modules.push(newModule);
  selectedModule.value = newModule;
  // 自动切换到布局 tab 让用户看到新模块
  activeTab.value = 'layout';
};

// 删除模块
const removeModule = (id: string) => {
  const idx = layout.modules.findIndex(m => m.id === id);
  if (idx === -1) return;
  layout.modules.splice(idx, 1);
  if (selectedModule.value && selectedModule.value.id === id) {
    selectedModule.value = layout.modules[0] || null;
  }
};

const openResourcePicker = (type: string, index?: number) => {
  pickerContext.type = type;
  pickerContext.index = typeof index === 'number' ? index : undefined;
  showPicker.value = true;
};

const handleResourceSelect = (ids: string[], items: ResourceItem[]) => {
  // Update resource map with new items
  items.forEach(item => {
    if (item.previewUrl) {
      resourceMap[item._id] = item.previewUrl;
    }
  });

  if (pickerContext.type === 'header') {
    const selectedItem = items[0];
    if (selectedItem) {
      // Open Cropper with the selected image
      croppingImageUrl.value = selectedItem.previewUrl || selectedItem.originUrl || '';
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
    if (selectedModule.value && selectedModule.value.type === 'resource-grid' && selectedModule.value.config.manualIds && typeof pickerContext.index === 'number') {
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
    
    const items = res.data as ResourceItem[];
    const fileList = items.map(i => i.coverUrl || i.originUrl).filter((f): f is string => Boolean(f));

    if (fileList.length > 0) {
      const urlRes = await app.getTempFileURL({ fileList: fileList.map((f: string) => ({ fileID: f, maxAge: 3600 })) });
      const urlMap = new Map<string, string>((urlRes.fileList || [] as TempFileUrlItem[]).map((f: TempFileUrlItem) => [f.fileID, f.tempFileURL]));

      items.forEach(i => {
        const url = urlMap.get(i.coverUrl || i.originUrl || '');
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
  if (selectedModule.value && selectedModule.value.type === 'resource-grid' && selectedModule.value.config.manualIds) {
    selectedModule.value.config.manualIds[index] = '';
  }
};

const onCropConfirm = async (blob: Blob) => {
  try {
    const cloudPath = `topics/covers/crop-${Date.now()}.jpg`;
    const res = await app.uploadFile({
      cloudPath,
      filePath: blob as unknown as string
    });

    if (res.fileID) {
      topicConfig.coverFileID = res.fileID;
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
    message.error("图片上传失败");
  } finally {
    showCropper.value = false;
  }
};

// 移除封面
const clearCover = () => {
  topicConfig.cover = '';
  topicConfig.coverFileID = '';
};

const applyTemplate = async (tpl: string) => {
  const confirmed = await dialog.warning({
    title: '提示',
    content: "应用模板将覆盖当前配置，确定吗？",
    positiveText: '确定',
    negativeText: '取消',
  });
  if (!confirmed) return;

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
    const layoutToSave = JSON.parse(JSON.stringify(layout)) as LayoutData;

    // Derive contentType and resourceIds from layout modules for mini program compatibility
    const gridModules = (layoutToSave.modules || []).filter((m): m is GridModule => m.type === 'resource-grid');
    const hasAutoGrid = gridModules.some(m => m.config.sourceType === 'filter');
    const manualIds = gridModules
      .filter(m => m.config.sourceType === 'manual')
      .flatMap(m => (m.config.manualIds || []).filter(Boolean));
    const contentType = hasAutoGrid ? 'auto' : 'manual';
    const resourceIds = contentType === 'manual' ? [...new Set(manualIds)] : [];

    // 1. Update Topic Metadata via cloud function (avoids client DB permission issues)
    // Save cover as fileID (cloud://) so getTopics can resolve fresh temp URLs each time
    const coverToSave = topicConfig.coverFileID || topicConfig.cover || '';
    await callCloudFunction('manageTopics', {
      action: 'update',
      id: topicId,
      data: {
        title: topicConfig.title,
        description: topicConfig.description,
        cover: coverToSave,
        coverFileID: topicConfig.coverFileID || '',
        resourceType: topicConfig.resourceType,
        defaultSort: topicConfig.defaultSort,
        filterType: topicConfig.filterType,
        filterValue: topicConfig.filterValue,
        status: topicConfig.status,
        sort: topicConfig.sort,
        contentType,
        resourceIds,
        gridColumns: topicConfig.gridColumns
      }
    });

    // 2. Save Layout via Cloud Function (creates history)
    const res = await callFunctionWithAuth("manageTopicLayout", {
      action: "save",
      topicId,
      layout: layoutToSave
    });
    
    if (res.result.success) {
      message.success("保存发布成功");
      loadHistory();
    } else {
      message.error("保存失败: " + res.result.error);
    }
  } catch (err) {
    console.error(err);
    message.error("保存出错");
  } finally {
    saving.value = false;
  }
};

const rollback = async (version: LayoutVersion) => {
  const confirmed = await dialog.warning({
    title: '提示',
    content: `确定回滚到 ${formatDate(version.createdAt)} 的版本吗？`,
    positiveText: '确定',
    negativeText: '取消',
  });
  if (!confirmed) return;

  try {
    const res = await callFunctionWithAuth("manageTopicLayout", {
      action: "rollback",
      topicId,
      versionId: version._id
    });
    
    if (res.result.success) {
      message.success("回滚成功");
      await loadTopic();
      await loadHistory();
    } else {
      message.error("回滚失败");
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

.input, .select, .textarea {
  width: 100%;
  padding: 0.625rem 1rem;
  border-radius: 0.5rem;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  font-size: 0.875rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.input:focus, .select:focus, .textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(7, 193, 96, 0.1);
}

.input-sm {
  padding: 0.375rem 0.625rem;
  font-size: 0.8125rem;
}

.textarea {
  min-height: 5rem;
  resize: vertical;
}

.select {
  cursor: pointer;
}
</style>
