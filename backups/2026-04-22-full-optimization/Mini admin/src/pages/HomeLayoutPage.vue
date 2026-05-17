<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 class="text-xl font-bold text-[var(--text-main)]">首页布局管理</h2>
        <p class="text-sm text-[var(--text-sub)] mt-1">动态配置首页展示板块、推荐策略及视觉样式</p>
      </div>
      <button class="btn-primary flex items-center gap-2" @click="openModal()">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
        </svg>
        新增板块
      </button>
    </div>

    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="card p-5">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-[var(--bg-body)] animate-pulse"></div>
          <div class="w-12 h-12 rounded-xl bg-[var(--bg-body)] animate-pulse"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 w-1/3 bg-[var(--bg-body)] rounded animate-pulse"></div>
            <div class="h-3 w-1/2 bg-[var(--bg-body)] rounded animate-pulse"></div>
          </div>
          <div class="flex gap-2">
            <div class="h-8 w-16 bg-[var(--bg-body)] rounded-lg animate-pulse"></div>
            <div class="h-8 w-16 bg-[var(--bg-body)] rounded-lg animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="sections.length > 0" class="space-y-4">
      <div 
        v-for="item in sections" 
        :key="item._id" 
        class="card p-5 group"
      >
        <div class="flex flex-col md:flex-row md:items-center gap-5">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-[var(--bg-body)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-sub)] font-bold text-lg shadow-inner">
              {{ item.sort }}
            </div>
            <div class="w-12 h-12 rounded-xl flex items-center justify-center text-white"
              :style="getIconColor(item.type)"
            >
              <svg v-if="item.type === 'avatar_row'" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <svg v-else-if="item.type === 'waterfall'" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h2a2 2 0 01-2-2v-2z" />
              </svg>
              <svg v-else-if="item.type === 'card'" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h2a2 2 0 01-2-2V6z" />
              </svg>
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3 mb-1">
              <h3 class="text-lg font-bold text-[var(--text-main)] truncate">{{ item.title }}</h3>
              <span v-if="item.subtitle" class="text-xs text-[var(--text-sub)] truncate border-l border-[var(--border-color)] pl-2 ml-2">{{ item.subtitle }}</span>
              <span 
                class="px-2 py-0.5 rounded-full text-xs font-medium border ml-auto md:ml-2"
                :class="item.enable 
                  ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                  : 'bg-[var(--bg-body)] text-[var(--text-sub)] border-[var(--border-color)]'"
              >
                {{ item.enable ? '已启用' : '已停用' }}
              </span>
            </div>
            
            <div class="flex flex-wrap items-center gap-2 mt-2">
              <span class="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
                {{ getTypeName(item.type) }}
              </span>
              
              <span class="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-500 border border-purple-500/20">
                {{ getSourceTypeName(item.dataSource?.type) }}
              </span>

              <template v-if="item.dataSource?.type === 'automatic'">
                <span class="px-2 py-0.5 rounded text-xs font-medium bg-orange-500/10 text-orange-500 border border-orange-500/20">
                  {{ getResourceTypeName(item.dataSource?.resourceType) }}
                </span>
                <span v-if="item.dataSource?.category" class="px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                  分类: {{ item.dataSource.category }}
                </span>
              </template>
              
              <template v-if="item.dataSource?.type === 'recommendation'">
                <span class="px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  规则: {{ getRecRuleName(item.dataSource?.recommendationRule) }}
                </span>
              </template>
              
              <template v-if="item.dataSource?.type === 'ai_personalized'">
                <span class="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-500 border border-purple-500/20">
                  {{ getResourceTypeName(item.dataSource?.resourceType) }}
                </span>
              </template>
            </div>
          </div>

          <div class="flex items-center gap-2 border-t border-[var(--border-color)] pt-3 md:border-t-0 md:pt-0 md:pl-4 md:border-l">
            <button 
              class="btn-soft text-sm px-3 py-1.5"
              @click="editSection(item)"
            >
              编辑
            </button>
            <button 
              class="btn-soft text-sm px-3 py-1.5 text-red-500 hover:bg-red-50"
              @click="removeSection(item._id)"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="card text-center py-12">
      <div class="w-16 h-16 bg-[var(--bg-body)] rounded-full flex items-center justify-center mx-auto mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-[var(--text-sub)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <p class="text-[var(--text-sub)] font-medium">暂无首页板块</p>
      <button class="btn-primary mt-4" @click="openModal()">立即添加</button>
    </div>

    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div class="card w-full max-w-2xl max-h-[90vh] flex flex-col" @click.stop>
        <div class="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
          <div>
            <h3 class="text-lg font-bold text-[var(--text-main)]">{{ editingId ? '编辑板块' : '新增板块' }}</h3>
            <p class="text-xs text-[var(--text-sub)] mt-0.5">配置首页内容展示方式和数据来源</p>
          </div>
          <button class="text-[var(--text-sub)] hover:text-[var(--text-main)]" @click="closeModal">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div class="flex border-b border-[var(--border-color)] px-6 shrink-0">
          <button 
            v-for="tab in ['basic', 'source', 'style']" 
            :key="tab"
            class="px-4 py-3 text-sm font-medium border-b-2 transition-colors relative"
            :class="activeTab === tab ? 'text-[var(--primary)] border-[var(--primary)]' : 'text-[var(--text-sub)] border-transparent hover:text-[var(--text-main)]'"
            @click="activeTab = tab"
          >
            {{ getTabName(tab) }}
          </button>
        </div>

        <div class="p-6 overflow-y-auto grow">
          <div v-if="activeTab === 'basic'" class="space-y-5">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <label class="text-sm font-medium text-[var(--text-main)]">板块标题 <span class="text-red-500">*</span></label>
                <input v-model="form.title" class="input w-full" placeholder="例如: 热门头像" />
              </div>
              <div class="space-y-1.5">
                <label class="text-sm font-medium text-[var(--text-main)]">副标题 (可选)</label>
                <input v-model="form.subtitle" class="input w-full" placeholder="例如: 每日更新" />
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <label class="text-sm font-medium text-[var(--text-main)]">展示布局类型</label>
                <div class="grid grid-cols-2 gap-2">
                  <button 
                    v-for="t in ['avatar_row', 'wallpaper_grid', 'waterfall', 'card']" 
                    :key="t"
                    class="px-4 py-2 rounded-lg text-sm text-left transition-colors"
                    :class="form.type === t ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg-body)] text-[var(--text-sub)] border border-[var(--border-color)]'"
                    @click="form.type = t"
                  >
                    {{ getTypeName(t) }}
                  </button>
                </div>
              </div>
              <div class="space-y-1.5">
                <label class="text-sm font-medium text-[var(--text-main)]">状态 & 排序</label>
                <div class="flex gap-2">
                  <select v-model="form.enable" class="input flex-1">
                    <option :value="true">✅ 已启用</option>
                    <option :value="false">🚫 已停用</option>
                  </select>
                  <input v-model.number="form.sort" type="number" class="input w-20" placeholder="排序" title="数字越小越靠前" />
                </div>
              </div>
            </div>
            
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-[var(--text-main)]">更多跳转链接 (可选)</label>
              <input v-model="form.moreLink" class="input w-full" placeholder="例如: /pages/avatar/avatar" />
            </div>
          </div>

          <div v-if="activeTab === 'source'" class="space-y-5">
            <div class="flex p-1 bg-[var(--bg-body)] rounded-lg">
              <button 
                v-for="st in ['automatic', 'manual', 'recommendation', 'ai_personalized']" 
                :key="st"
                class="flex-1 py-1.5 text-sm font-medium rounded-md transition-all"
                :class="form.dataSource.type === st ? 'bg-[var(--bg-card)] shadow text-[var(--primary)]' : 'text-[var(--text-sub)] hover:text-[var(--text-main)]'"
                @click="form.dataSource.type = st"
              >
                {{ getSourceTypeName(st) }}
              </button>
            </div>

            <div v-if="form.dataSource.type === 'manual'" class="space-y-4">
              <div class="bg-[var(--bg-body)] p-4 rounded-lg border border-[var(--border-color)]">
                <div class="flex justify-between items-center mb-3">
                  <h4 class="text-sm font-bold text-[var(--text-main)]">手动选择资源</h4>
                  <button class="btn-soft text-sm px-3 py-1" @click="openResourcePicker">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    添加资源
                  </button>
                </div>
                
                <div v-if="form.dataSource.manualItems.length === 0" class="text-center py-6 text-[var(--text-sub)]">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-2 text-[var(--text-sub)]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>暂无选择的资源</p>
                  <p class="text-xs mt-1">点击上方按钮添加资源</p>
                </div>
                
                <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  <div 
                    v-for="(id, index) in form.dataSource.manualItems" 
                    :key="index"
                    class="relative group"
                  >
                    <div class="aspect-square bg-[var(--bg-body)] rounded-lg overflow-hidden border border-[var(--border-color)]">
                      <img 
                        v-if="manualItemsDetails[id]?.previewUrl" 
                        :src="manualItemsDetails[id].previewUrl" 
                        :alt="manualItemsDetails[id].title"
                        class="w-full h-full object-cover"
                      />
                      <img 
                        v-else 
                        src="https://via.placeholder.com/150"
                        alt="Default"
                        class="w-full h-full object-cover opacity-50"
                      />
                    </div>
                    <button 
                      class="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      @click="removeManualItem(index)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="form.dataSource.type === 'automatic'" class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <label class="text-xs font-medium text-[var(--text-sub)]">资源类型</label>
                  <select v-model="form.dataSource.resourceType" class="input w-full">
                    <option value="all">全部</option>
                    <option value="avatar">头像</option>
                    <option value="wallpaper">壁纸</option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-medium text-[var(--text-sub)]">显示数量</label>
                  <input v-model.number="form.dataSource.limit" type="number" class="input w-full" />
                </div>
              </div>
              
              <div class="space-y-1.5">
                <label class="text-xs font-medium text-[var(--text-sub)]">指定分类</label>
                <input v-model="form.dataSource.category" class="input w-full" placeholder="例如: 动漫" />
              </div>
              <div class="space-y-1.5">
                <label class="text-xs font-medium text-[var(--text-sub)]">指定标签 (逗号分隔)</label>
                <input v-model="tagsInput" class="input w-full" placeholder="例如: 可爱,唯美" />
              </div>
              <div class="space-y-1.5">
                <label class="text-xs font-medium text-[var(--text-sub)]">排序规则</label>
                <select v-model="form.dataSource.sortField" class="input w-full">
                  <option value="createTime">最新发布</option>
                  <option value="hotScore">最热</option>
                  <option value="viewCount">最多浏览</option>
                  <option value="likeCount">最多收藏</option>
                  <option value="downloadCount">最多下载</option>
                </select>
              </div>
            </div>

            <div v-if="form.dataSource.type === 'recommendation'" class="space-y-4">
              <div class="bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-lg p-3 flex items-center gap-2 text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                系统将根据用户行为自动计算推荐内容
              </div>
              <div class="space-y-1.5">
                <label class="text-xs font-medium text-[var(--text-sub)]">资源类型</label>
                <select v-model="form.dataSource.resourceType" class="input w-full">
                  <option value="all">全部 (随机)</option>
                  <option value="avatar">头像</option>
                  <option value="wallpaper">壁纸</option>
                </select>
              </div>
              <div class="space-y-1.5">
                <label class="text-xs font-medium text-[var(--text-sub)]">推荐算法策略</label>
                <select v-model="form.dataSource.recommendationRule" class="input w-full">
                  <option value="user_preference">基于用户喜好</option>
                  <option value="collaborative_filtering">协同过滤</option>
                  <option value="trending_now">当下流行</option>
                  <option value="random_discovery">随机发现</option>
                </select>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <label class="text-xs font-medium text-[var(--text-sub)]">更新频率</label>
                  <select v-model="form.dataSource.updateFrequency" class="input w-full">
                    <option value="realtime">实时</option>
                    <option value="hourly">每小时</option>
                    <option value="daily">每天</option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-medium text-[var(--text-sub)]">显示数量</label>
                  <input v-model.number="form.dataSource.limit" type="number" class="input w-full" />
                </div>
              </div>
            </div>

            <div v-if="form.dataSource.type === 'ai_personalized'" class="space-y-4">
              <div class="bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-purple-500 border border-purple-500/20 rounded-lg p-3 flex items-center gap-2 text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI 将基于用户浏览、收藏行为智能推荐个性化内容
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <label class="text-xs font-medium text-[var(--text-sub)]">资源类型</label>
                  <select v-model="form.dataSource.resourceType" class="input w-full">
                    <option value="all">全部</option>
                    <option value="avatar">仅头像</option>
                    <option value="wallpaper">仅壁纸</option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-medium text-[var(--text-sub)]">显示数量</label>
                  <input v-model.number="form.dataSource.limit" type="number" class="input w-full" />
                </div>
              </div>
              <div class="bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 rounded-lg p-3 text-xs">
                💡 提示：新用户或行为数据不足时，会自动降级为热门推荐
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'style'" class="space-y-5">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <label class="text-xs font-medium text-[var(--text-sub)]">展示列数: {{ form.styleConfig.columns }}</label>
                <input type="range" min="1" max="6" v-model.number="form.styleConfig.columns" class="w-full" />
                <div class="flex justify-between text-xs px-1 text-[var(--text-sub)]">
                  <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span>
                </div>
              </div>
              <div class="space-y-1.5">
                <label class="text-xs font-medium text-[var(--text-sub)]">加载方式</label>
                <select v-model="form.interactionConfig.loadingType" class="input w-full">
                  <option value="none">一次性加载</option>
                  <option value="more">点击加载更多</option>
                  <option value="pagination">分页</option>
                  <option value="infinite">无限滚动</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <label class="text-xs font-medium text-[var(--text-sub)]">间距: {{form.styleConfig.gap}}px</label>
                <input v-model.number="form.styleConfig.gap" type="number" class="input w-full" />
              </div>
              <div class="space-y-1.5">
                <label class="text-xs font-medium text-[var(--text-sub)]">圆角: {{form.styleConfig.radius}}px</label>
                <input v-model.number="form.styleConfig.radius" type="number" class="input w-full" />
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-medium text-[var(--text-sub)]">自定义 CSS (可选)</label>
              <textarea v-model="form.styleConfig.customCss" class="input w-full h-24 font-mono text-xs" placeholder='{"backgroundColor": "#f5f5f5"}'></textarea>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-body)] flex justify-end gap-3 shrink-0">
          <button class="btn-soft" @click="closeModal">取消</button>
          <button class="btn-primary px-8" @click="saveSection" :disabled="submitting || !form.title">
            {{ editingId ? '保存更改' : '立即创建' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Resource Picker Modal -->
    <ResourcePicker 
      v-if="showPicker" 
      :initial-selected="[]" 
      :limit="0"
      @close="showPicker = false" 
      @select="handleResourceSelect" 
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, computed } from "vue";
import { callCloudFunction } from "../utils/cloudbase";
import ResourcePicker from "../components/ResourcePicker.vue";

const CACHE_KEY = 'home_layout_cache';
const CACHE_TTL = 5 * 60 * 1000;

const sections = ref<any[]>([]);
const loading = ref(true);
const editingId = ref<string | null>(null);
const submitting = ref(false);
const showModal = ref(false);
const activeTab = ref('basic');
const showPicker = ref(false);

const form = reactive({
  title: "",
  subtitle: "",
  type: "avatar_row",
  sort: 10,
  enable: true,
  moreLink: "",
  dataSource: {
    type: "automatic",
    resourceType: "all",
    autoSplit: false,
    category: "",
    tags: [] as string[],
    sortField: "createTime",
    limit: 6,
    updateFrequency: "realtime",
    recommendationRule: "user_preference",
    manualItems: []
  },
  styleConfig: {
    columns: 4,
    gap: 10,
    radius: 8,
    customCss: ""
  },
  interactionConfig: {
    loadingType: "none",
    clickAction: "preview"
  }
});

// 存储手动选择资源的详细信息
const manualItemsDetails = ref({});

// 根据 ID 获取资源详细信息
const fetchResourceDetails = async (ids) => {
  if (!ids || ids.length === 0) return;
  
  try {
    const res = await callCloudFunction('adminResource', {
      action: 'batchGet',
      ids: ids
    });
    
    if (res.success && res.data) {
      res.data.forEach(item => {
        manualItemsDetails.value[item._id] = item;
      });
    }
  } catch (error) {
    console.error('获取资源详细信息失败:', error);
  }
};

const tagsInput = computed({
  get: () => form.dataSource.tags?.join(',') || '',
  set: (val) => {
    form.dataSource.tags = val ? val.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];
  }
});

const getTabName = (tab: string) => {
  const map: Record<string, string> = {
    basic: '基础信息',
    source: '数据来源',
    style: '样式 & 交互'
  };
  return map[tab] || tab;
};

const getTypeName = (type: string) => {
  const map: Record<string, string> = {
    avatar_row: '头像横向列表',
    wallpaper_grid: '壁纸网格列表',
    waterfall: '瀑布流',
    card: '卡片视图',
    list: '普通列表'
  };
  return map[type] || type;
};

const getSourceTypeName = (type: string) => {
  const map: Record<string, string> = {
    automatic: '手动筛选',
    recommendation: '智能推荐',
    ai_personalized: 'AI个性化',
    manual: '手动精选'
  };
  return map[type] || type;
};

const getResourceTypeName = (type: string) => {
  const map: Record<string, string> = { all: '全部资源', avatar: '头像', wallpaper: '壁纸' };
  return map[type] || type;
};

const getRecRuleName = (rule: string) => {
  const map: Record<string, string> = {
    user_preference: '猜你喜欢',
    collaborative_filtering: '看过的人也看过',
    trending_now: '当下流行',
    random_discovery: '随机发现'
  };
  return map[rule] || rule;
};

const getIconColor = (type: string) => {
  const map: Record<string, string> = {
    avatar_row: 'background: linear-gradient(135deg, #3b82f6, #2563eb)',
    wallpaper_grid: 'background: linear-gradient(135deg, #8b5cf6, #7c3aed)',
    waterfall: 'background: linear-gradient(135deg, #ec4899, #db2777)',
    card: 'background: linear-gradient(135deg, #f97316, #ea580c)'
  };
  return map[type] || 'background: linear-gradient(135deg, #6b7280, #4b5563)';
};

const getCachedData = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL) {
        return data;
      }
    }
  } catch (e) {
    console.error('Cache read error:', e);
  }
  return null;
};

const setCachedData = (data: any[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.error('Cache write error:', e);
  }
};

const openModal = () => {
  showModal.value = true;
  activeTab.value = 'basic';
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
  form.subtitle = "";
  form.type = "avatar_row";
  form.sort = (sections.value.length + 1) * 10;
  form.enable = true;
  form.moreLink = "";
  form.dataSource = {
    type: "automatic",
    resourceType: "all",
    autoSplit: false,
    category: "",
    tags: [],
    sortField: "createTime",
    limit: 6,
    updateFrequency: "realtime",
    recommendationRule: "user_preference",
    manualItems: []
  };
  form.styleConfig = {
    columns: 4,
    gap: 10,
    radius: 8,
    customCss: ""
  };
  form.interactionConfig = {
    loadingType: "none",
    clickAction: "preview"
  };
};

const fetchSections = async () => {
  const cached = getCachedData();
  if (cached) {
    sections.value = cached;
    loading.value = false;
  }

  try {
    const res = await callCloudFunction('adminHome', { action: 'get' });
    if (res.success) {
      const data = (res.data || []).sort((a: any, b: any) => a.sort - b.sort);
      sections.value = data;
      setCachedData(data);
    } else {
      console.error("Fetch sections failed:", res.message);
    }
  } catch (error) {
    console.error("Fetch sections error:", error);
  } finally {
    loading.value = false;
  }
};

const editSection = (item: any) => {
  editingId.value = item._id;
  form.title = item.title;
  form.subtitle = item.subtitle || "";
  form.type = item.type;
  form.sort = item.sort;
  form.enable = item.enable;
  form.moreLink = item.moreLink || "";
  
  const oldQuery = item.queryConfig || {};
  const oldSource = item.dataSource || {};
  
  form.dataSource = {
    type: oldSource.type || "automatic",
    resourceType: oldSource.resourceType || oldQuery.resourceType || "all",
    autoSplit: oldSource.autoSplit || false,
    category: oldSource.category || oldQuery.category || "",
    tags: oldSource.tags || oldQuery.tags || [],
    sortField: oldSource.sortField || oldQuery.sortField || "createTime",
    limit: oldSource.limit || oldQuery.limit || 6,
    updateFrequency: oldSource.updateFrequency || "realtime",
    recommendationRule: oldSource.recommendationRule || "user_preference",
    manualItems: oldSource.manualItems ? oldSource.manualItems.map((item: any) => typeof item === 'string' ? item : item.id).filter((id: any) => id) : []
  };
  
  form.styleConfig = {
    columns: item.styleConfig?.columns || (item.type === 'avatar_row' ? 4 : 2),
    gap: item.styleConfig?.gap || 10,
    radius: item.styleConfig?.radius || 8,
    customCss: item.styleConfig?.customCss || ""
  };
  
  form.interactionConfig = {
    loadingType: item.interactionConfig?.loadingType || "none",
    clickAction: item.interactionConfig?.clickAction || "preview"
  };
  
  showModal.value = true;
};

const saveSection = async () => {
  if (!form.title) return;
  
  submitting.value = true;
  try {
    const data = {
      title: form.title,
      subtitle: form.subtitle,
      type: form.type,
      sort: form.sort,
      enable: form.enable,
      moreLink: form.moreLink,
      dataSource: { ...form.dataSource },
      styleConfig: { ...form.styleConfig },
      interactionConfig: { ...form.interactionConfig },
      queryConfig: {
         resourceType: form.dataSource.resourceType,
         category: form.dataSource.category,
         tags: form.dataSource.tags,
         sortField: form.dataSource.sortField,
         limit: form.dataSource.limit
      }
    };

    let res;
    if (editingId.value) {
      res = await callCloudFunction('adminHome', { 
        action: 'update', 
        id: editingId.value, 
        data 
      });
    } else {
      res = await callCloudFunction('adminHome', { 
        action: 'add', 
        data 
      });
    }
    
    if (res.success) {
      closeModal();
      localStorage.removeItem(CACHE_KEY);
      await fetchSections();
    } else {
      throw new Error(res.message);
    }
  } catch (error) {
    console.error("Save section error:", error);
    alert("保存失败");
  } finally {
    submitting.value = false;
  }
};

const removeSection = async (id: string) => {
  if (!confirm("确定要删除这个板块吗？")) return;
  
  try {
    const res = await callCloudFunction('adminHome', { action: 'delete', id });
    if (res.success) {
      localStorage.removeItem(CACHE_KEY);
      await fetchSections();
    } else {
      throw new Error(res.message);
    }
  } catch (error) {
    console.error("Delete section error:", error);
    alert("删除失败");
  }
};

const openResourcePicker = () => {
  showPicker.value = true;
};

const handleResourceSelect = (ids: string[], items: any[]) => {
  // Add selected items to manualItems - only store IDs
  form.dataSource.manualItems.push(...ids);
  
  // Store resource details for display
  items.forEach(item => {
    if (item._id) {
      manualItemsDetails.value[item._id] = item;
    }
  });
};

const removeManualItem = (index: number) => {
  const id = form.dataSource.manualItems[index];
  form.dataSource.manualItems.splice(index, 1);
  
  // Remove resource details from store
  if (id) {
    delete manualItemsDetails.value[id];
  }
};

onMounted(() => {
  fetchSections();
});
</script>

<style scoped>
.card {
  background: var(--bg-card);
  border-radius: 0.75rem;
  border: 1px solid var(--border-color);
  overflow: hidden;
  transition: all 300ms;
}

.input {
  width: 100%;
  padding: 0.625rem 1rem;
  border-radius: 0.5rem;
  background: var(--bg-body);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  transition: all 300ms;
}

.input::placeholder {
  color: var(--text-sub);
}

.input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.2);
}

.btn-primary {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  background: var(--primary);
  color: white;
  font-weight: 500;
  transition: opacity 300ms;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-soft {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  background: var(--bg-body);
  color: var(--text-main);
  border: 1px solid var(--border-color);
  transition: all 300ms;
}

.btn-soft:hover:not(:disabled) {
  background: var(--bg-card);
}

.btn-soft:disabled {
  opacity: 0.5;
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
