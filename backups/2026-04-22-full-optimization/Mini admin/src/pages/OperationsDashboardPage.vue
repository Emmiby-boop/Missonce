<template>
  <div class="page-wrapper">
    <div class="page-header mb-6">
      <h1 class="text-2xl font-bold text-[var(--text-main)]">智能运营助手</h1>
      <p class="text-[var(--text-sub)] text-sm mt-1">数据概览、趋势分析、内容质量监控、用户行为记录</p>
      <div class="flex items-center gap-3 mt-4">
        <button @click="refreshAll" class="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity">
          刷新数据
        </button>
      </div>
    </div>

    <div v-if="loading" class="space-y-4">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="card p-4 animate-pulse">
          <div class="h-8 w-20 bg-[var(--border-color)] rounded mb-2"></div>
          <div class="h-4 w-24 bg-[var(--border-color)] rounded"></div>
        </div>
      </div>
      <div class="card p-6 animate-pulse">
        <div class="h-6 w-32 bg-[var(--border-color)] rounded mb-4"></div>
        <div class="h-64 bg-[var(--border-color)] rounded"></div>
      </div>
    </div>

    <template v-else>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="card p-4">
          <div class="text-2xl font-bold text-[var(--text-main)]">{{ dashboard.overview?.totalUsers || 0 }}</div>
          <div class="text-sm text-[var(--text-sub)]">总用户数</div>
        </div>
        <div class="card p-4">
          <div class="text-2xl font-bold text-[var(--primary)]">{{ dashboard.overview?.activeUsers || 0 }}</div>
          <div class="text-sm text-[var(--text-sub)]">活跃用户</div>
        </div>
        <div class="card p-4">
          <div class="text-2xl font-bold text-green-500">{{ dashboard.overview?.totalResources || 0 }}</div>
          <div class="text-sm text-[var(--text-sub)]">资源总数</div>
        </div>
        <div class="card p-4">
          <div class="text-2xl font-bold text-orange-500">{{ dashboard.overview?.totalViews || 0 }}</div>
          <div class="text-sm text-[var(--text-sub)]">总浏览量</div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <section class="card">
          <h3 class="text-base font-semibold text-[var(--text-main)] mb-4">📈 7天趋势</h3>
          <div class="space-y-3">
            <div v-if="dashboard.trends?.length === 0" class="text-center py-8 text-[var(--text-sub)]">
              暂无数据
            </div>
            <div v-else class="space-y-2">
              <div v-for="trend in dashboard.trends" :key="trend.date" class="flex items-center gap-4">
                <span class="w-20 text-sm text-[var(--text-sub)]">{{ trend.date.slice(5) }}</span>
                <div class="flex-1 flex gap-2">
                  <div 
                    class="h-4 bg-[var(--primary)] rounded"
                    :style="{ width: `${(trend.views / maxTrendValue) * 100}%`, minWidth: '4px' }"
                  ></div>
                </div>
                <span class="text-sm text-[var(--text-sub)] w-16 text-right">{{ trend.views }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="card">
          <h3 class="text-base font-semibold text-[var(--text-main)] mb-4">🔥 热门资源</h3>
          <div class="space-y-4">
            <div v-if="hotResourcesLoading && paginatedHotResources.length === 0" class="space-y-3">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div v-for="i in 6" :key="i" class="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden">
                  <div class="aspect-video bg-[var(--border-color)] animate-pulse"></div>
                  <div class="p-4 space-y-3">
                    <div class="h-4 bg-[var(--border-color)] rounded animate-pulse w-3/4"></div>
                    <div class="h-2 bg-[var(--border-color)] rounded animate-pulse"></div>
                    <div class="h-2 bg-[var(--border-color)] rounded animate-pulse w-1/2"></div>
                  </div>
                </div>
              </div>
            </div>
            <div v-else-if="paginatedHotResources.length === 0" class="text-center py-8 text-[var(--text-sub)]">
              暂无数据
            </div>
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div v-for="item in paginatedHotResources" :key="item.id || item._id" 
                   class="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden hover:shadow-lg hover:border-[var(--primary)] transition-all duration-300">
                <div class="relative">
                  <div class="aspect-video overflow-hidden bg-[var(--bg-body)]">
                    <img v-if="getImageUrl(item)" :src="getImageUrl(item)" class="w-full h-full object-cover" :alt="item.title" @error="handleImageError($event)" />
                    <div v-else class="w-full h-full flex items-center justify-center text-[var(--text-sub)]">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
                    </div>
                  </div>
                  
                  <div class="absolute top-2 left-2 z-10">
                    <span class="px-2 py-1 text-[11px] rounded-full font-medium shadow-sm" :class="{
                      'bg-pink-500 text-white': item.type === 'avatar',
                      'bg-indigo-500 text-white': item.type === 'wallpaper'
                    }">
                      {{ item.type === 'avatar' ? '头像' : '壁纸' }}
                    </span>
                  </div>
                </div>
                
                <div class="p-4 space-y-3">
                  <div>
                    <h4 class="text-sm font-semibold text-[var(--text-main)] truncate" :title="item.title">
                      {{ item.title || '未命名' }}
                    </h4>
                    <p class="text-xs text-[var(--text-sub)] mt-1">
                      分类: {{ item.categories?.[0] || item.category || '未分类' }}
                    </p>
                  </div>
                  
                  <div class="space-y-2">
                    <div class="flex items-center justify-between text-xs">
                      <span class="text-[var(--text-sub)] flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
                        热度
                      </span>
                      <span class="font-semibold text-orange-500">{{ item.hotScore || 0 }}</span>
                    </div>
                    <div class="w-full h-2 bg-[var(--bg-body)] rounded-full overflow-hidden">
                      <div 
                        class="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-500"
                        :style="{ width: `${Math.min(100, ((item.hotScore || 0) / Math.max(...(dashboard.hotResources || []).map((r: any) => r.hotScore || 0), 1)) * 100)}%` }"
                      ></div>
                    </div>
                  </div>
                  
                  <div class="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-color)]">
                    <div class="text-center">
                      <div class="text-sm font-semibold text-[var(--text-main)]">{{ item.downloads || 0 }}</div>
                      <div class="text-[10px] text-[var(--text-sub)] flex items-center justify-center gap-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        下载
                      </div>
                    </div>
                    <div class="text-center">
                      <div class="text-sm font-semibold text-[var(--text-main)]">{{ item.viewCount || 0 }}</div>
                      <div class="text-[10px] text-[var(--text-sub)] flex items-center justify-center gap-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        浏览
                      </div>
                    </div>
                    <div class="text-center">
                      <div class="text-sm font-semibold text-[var(--text-main)]">{{ item.favorites || 0 }}</div>
                      <div class="text-[10px] text-[var(--text-sub)] flex items-center justify-center gap-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                        收藏
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div v-if="totalHotPages > 1" class="flex items-center justify-center gap-2 pt-2">
              <button 
                @click="prevHotPage" 
                :disabled="hotCurrentPage === 1"
                class="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-main)] hover:bg-[var(--bg-body)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <div class="flex items-center gap-1">
                <button 
                  v-for="page in displayHotPages" 
                  :key="page"
                  @click="goToHotPage(page)"
                  :class="['px-3 py-1.5 rounded-lg text-sm transition-colors', page === hotCurrentPage ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-main)] hover:bg-[var(--bg-body)]']"
                >
                  {{ page }}
                </button>
              </div>
              <button 
                @click="nextHotPage" 
                :disabled="hotCurrentPage === totalHotPages"
                class="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-main)] hover:bg-[var(--bg-body)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
              <span class="text-sm text-[var(--text-sub)] ml-2">共 {{ totalHotPages }} 页</span>
            </div>
          </div>
        </section>
      </div>

      <section class="card mb-6">
        <h3 class="text-base font-semibold text-[var(--text-main)] mb-4">🗂️ 分类分布</h3>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div v-if="dashboard.categoryDistribution?.length === 0" class="col-span-full text-center py-8 text-[var(--text-sub)]">
            暂无数据
          </div>
          <div v-else v-for="cat in dashboard.categoryDistribution?.slice(0, 10)" :key="cat.name" class="p-3 rounded-lg bg-[var(--bg-body)] border border-[var(--border-color)]">
            <div class="text-lg font-bold text-[var(--text-main)]">{{ cat.count }}</div>
            <div class="text-xs text-[var(--text-sub)] truncate">{{ cat.name }}</div>
          </div>
        </div>
      </section>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <section class="card">
          <h3 class="text-base font-semibold text-[var(--text-main)] mb-4">🔮 趋势预测</h3>
          <div v-if="!trendPrediction" class="text-center py-4 text-[var(--text-sub)]">加载中...</div>
          <div v-else class="space-y-4">
            <div class="p-4 bg-[var(--primary)]/10 rounded-lg border border-[var(--primary)]/20">
              <p class="text-sm text-[var(--text-main)]">{{ trendPrediction.prediction }}</p>
            </div>
            <div v-if="trendPrediction.risingCategories?.length > 0">
              <h4 class="text-sm font-medium text-[var(--text-sub)] mb-2">热门分类</h4>
              <div class="flex flex-wrap gap-2">
                <span v-for="cat in trendPrediction.risingCategories" :key="cat.name" class="px-3 py-1 text-sm rounded-full bg-[var(--bg-body)] border border-[var(--border-color)] text-[var(--text-main)]">
                  {{ cat.name }}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section class="card cursor-pointer hover:shadow-lg transition-shadow" @click="openQualityDetail">
          <h3 class="text-base font-semibold text-[var(--text-main)] mb-4">✅ 内容质量检查</h3>
          <div v-if="qualityLoading" class="text-center py-4 text-[var(--text-sub)]">检查中...</div>
          <div v-else class="space-y-4">
            <div class="grid grid-cols-3 gap-4 text-center">
              <div class="p-3 bg-[var(--bg-body)] rounded-lg">
                <div class="text-xl font-bold text-[var(--text-main)]">{{ qualityCheck.recentCount || 0 }}</div>
                <div class="text-xs text-[var(--text-sub)]">近7天新增</div>
              </div>
              <div class="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <div class="text-xl font-bold text-orange-500">{{ qualityCheck.lowQualityCount || 0 }}</div>
                <div class="text-xs text-orange-500">需要优化</div>
              </div>
              <div class="p-3 bg-[var(--bg-body)] rounded-lg">
                <div class="text-xl font-bold text-blue-500">{{ qualityCheck.aiPendingCount || 0 }}</div>
                <div class="text-xs text-[var(--text-sub)]">待AI分析</div>
              </div>
            </div>

            <div v-if="qualityCheck.suggestions?.length > 0" class="p-3 bg-[var(--bg-body)] rounded-lg">
              <ul class="text-sm text-[var(--text-sub)] space-y-1">
                <li v-for="(s, i) in qualityCheck.suggestions" :key="i">• {{ s }}</li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div class="function-card card cursor-pointer" @click="openFunctionDetail('favorite')">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--primary)]"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </div>
            <div>
              <div class="text-2xl font-bold text-[var(--primary)]">{{ behaviorStats.favorites }}</div>
              <div class="text-sm text-[var(--text-sub)]">收藏总数</div>
            </div>
          </div>
          <div class="mt-4 text-xs text-[var(--text-sub)]">点击查看详情 →</div>
        </div>

        <div class="function-card card cursor-pointer" @click="openFunctionDetail('download')">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-500"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            </div>
            <div>
              <div class="text-2xl font-bold text-green-500">{{ behaviorStats.downloads }}</div>
              <div class="text-sm text-[var(--text-sub)]">下载总数</div>
            </div>
          </div>
          <div class="mt-4 text-xs text-[var(--text-sub)]">点击查看详情 →</div>
        </div>
      </div>
    </template>

    <div v-if="previewImageUrl" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80" @click="previewImageUrl = null">
      <div class="max-w-[90vw] max-h-[90vh]">
        <img :src="previewImageUrl" class="max-w-full max-h-full object-contain" @click.stop />
      </div>
    </div>

    <div v-if="showResourceDetail" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click="showResourceDetail = false">
      <div class="bg-[var(--bg-card)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto m-4" @click.stop>
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-bold text-[var(--text-main)]">资源详情</h3>
            <button @click="showResourceDetail = false" class="p-2 rounded-lg hover:bg-[var(--bg-body)] transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--text-sub)]"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
            </button>
          </div>
          
          <div v-if="selectedResource" class="space-y-4">
            <div class="aspect-video rounded-xl overflow-hidden bg-[var(--bg-body)]">
              <img v-if="getImageUrl(selectedResource)" :src="getImageUrl(selectedResource)" class="w-full h-full object-cover" :alt="selectedResource.title" @error="handleImageError($event)" />
              <div v-else class="w-full h-full flex items-center justify-center text-[var(--text-sub)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
              </div>
            </div>
            
            <div>
              <h4 class="text-lg font-semibold text-[var(--text-main)]">{{ selectedResource.title }}</h4>
              <p class="text-sm text-[var(--text-sub)] mt-1">类型: {{ selectedResource.type }}</p>
            </div>
            
            <div class="grid grid-cols-3 gap-4">
              <div class="p-3 bg-[var(--bg-body)] rounded-lg text-center">
                <div class="text-lg font-bold text-[var(--primary)]">{{ selectedResource.hotScore || 0 }}</div>
                <div class="text-xs text-[var(--text-sub)]">热度</div>
              </div>
              <div class="p-3 bg-[var(--bg-body)] rounded-lg text-center">
                <div class="text-lg font-bold text-green-500">{{ selectedResource.downloadCount || 0 }}</div>
                <div class="text-xs text-[var(--text-sub)]">下载</div>
              </div>
              <div class="p-3 bg-[var(--bg-body)] rounded-lg text-center">
                <div class="text-lg font-bold text-blue-500">{{ selectedResource.viewCount || 0 }}</div>
                <div class="text-xs text-[var(--text-sub)]">浏览</div>
              </div>
            </div>

            <div v-if="selectedResource.categories?.length" class="flex flex-wrap gap-2">
              <span v-for="cat in selectedResource.categories" :key="cat" class="px-3 py-1 text-xs rounded-full bg-[var(--bg-body)] border border-[var(--border-color)] text-[var(--text-main)]">
                {{ cat }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showFunctionDetail" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click="showFunctionDetail = false">
      <div class="bg-[var(--bg-card)] rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-auto m-4" @click.stop>
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-bold text-[var(--text-main)]">{{ selectedFunctionType === 'favorite' ? '收藏记录' : '下载记录' }}</h3>
            <button @click="showFunctionDetail = false" class="p-2 rounded-lg hover:bg-[var(--bg-body)] transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--text-sub)]"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
            </button>
          </div>
          
          <div class="space-y-4">
            <div v-if="functionRecordsLoading" class="space-y-3">
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div v-for="i in 8" :key="i" class="aspect-square rounded-lg bg-[var(--border-color)] animate-pulse"></div>
              </div>
            </div>
            <div v-else-if="functionRecords.length === 0" class="text-center py-12">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 text-[var(--text-sub)]"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="9" x2="15" y1="9" y2="15"/><line x1="15" x2="15" y1="9" y2="9"/></svg>
              <p class="text-[var(--text-sub)]">暂无记录</p>
            </div>
            <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              <div 
                v-for="item in paginatedFunctionRecords" 
                :key="item.id || item._id" 
                class="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden hover:shadow-lg hover:border-[var(--primary)] transition-all duration-300"
              >
                <div class="relative">
                  <div class="aspect-square overflow-hidden bg-[var(--bg-body)]">
                    <img v-if="getImageUrl(item)" :src="getImageUrl(item)" class="w-full h-full object-cover" :alt="item.resourceTitle || item.title" @error="handleImageError($event)" />
                    <div v-else class="w-full h-full flex items-center justify-center text-[var(--text-sub)]">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
                    </div>
                  </div>
                  
                  <div class="absolute top-2 left-2 z-10">
                    <span class="px-2 py-1 text-[10px] rounded-full font-medium shadow-sm" :class="{
                      'bg-pink-500/90 text-white': (item.type || item.resource?.type) === 'avatar',
                      'bg-indigo-500/90 text-white': (item.type || item.resource?.type) === 'wallpaper'
                    }">
                      {{ (item.type || item.resource?.type) === 'avatar' ? '头像' : '壁纸' }}
                    </span>
                  </div>
                </div>
                
                <div class="p-3 space-y-2">
                  <div class="flex items-center justify-between gap-2">
                    <h4 class="text-sm font-medium text-[var(--text-main)] truncate flex-1" :title="item.resourceTitle || item.resource?.title || item.title">
                      {{ item.resourceTitle || item.resource?.title || item.title || '未命名' }}
                    </h4>
                    <span v-if="item.resource?.categories?.[0] || item.categories?.[0]" class="text-[10px] px-1.5 py-0.5 bg-[var(--bg-body)] text-[var(--text-sub)] rounded whitespace-nowrap">
                      {{ item.resource?.categories?.[0] || item.categories?.[0] }}
                    </span>
                  </div>
                  
                  <div class="text-xs text-[var(--text-sub)] flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <span class="truncate">{{ item._openid ? `用户 ${item._openid.slice(-6)}` : '未知用户' }}</span>
                  </div>
                  
                  <div class="text-xs text-[var(--text-sub)] flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                    <span>{{ formatTime(item.createTime || item.create_time || item.createdAt) }}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div v-if="totalFunctionPages > 1" class="flex items-center justify-center gap-2 pt-2">
              <button 
                @click="prevFunctionPage" 
                :disabled="functionCurrentPage === 1"
                class="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-main)] hover:bg-[var(--bg-body)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <div class="flex items-center gap-1">
                <button 
                  v-for="page in displayFunctionPages" 
                  :key="page"
                  @click="goToFunctionPage(page)"
                  :class="['px-3 py-1.5 rounded-lg text-sm transition-colors', page === functionCurrentPage ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-main)] hover:bg-[var(--bg-body)]']"
                >
                  {{ page }}
                </button>
              </div>
              <button 
                @click="nextFunctionPage" 
                :disabled="functionCurrentPage === totalFunctionPages"
                class="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-main)] hover:bg-[var(--bg-body)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
              <span class="text-sm text-[var(--text-sub)] ml-2">共 {{ totalFunctionPages }} 页</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showQualityDetail" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click="showQualityDetail = false">
      <div class="bg-[var(--bg-card)] rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-auto m-4" @click.stop>
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="text-xl font-bold text-[var(--text-main)]">需要优化的内容</h3>
              <p class="text-sm text-[var(--text-sub)] mt-1">共 {{ qualityCheck.lowQualityResources?.length || 0 }} 项</p>
            </div>
            <button @click="showQualityDetail = false" class="p-2 rounded-lg hover:bg-[var(--bg-body)] transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--text-sub)]"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
            </button>
          </div>

          <div class="flex flex-wrap gap-2 mb-4">
            <button 
              @click="toggleSelectAll" 
              class="px-3 py-1.5 text-xs rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
            >
              {{ isAllSelected ? '取消全选' : '全选' }}
            </button>
            <button 
              @click="batchAIAnalyze" 
              :disabled="(qualityCheck.aiPendingCount === 0 && selectedResources.length === 0) || aiAnalyzing"
              class="px-3 py-1.5 text-xs rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <svg v-if="aiAnalyzing" class="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              {{ aiAnalyzing ? '分析中...' : '批量AI识别' }}
            </button>
            <button 
              @click="batchUnpublish" 
              :disabled="(qualityCheck.lowQualityCount === 0 && selectedResources.length === 0) || batchOperating"
              class="px-3 py-1.5 text-xs rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {{ batchOperating ? '处理中...' : '批量下架' }}
            </button>
            <button 
              @click="batchDelete" 
              :disabled="(qualityCheck.lowQualityCount === 0 && selectedResources.length === 0) || batchOperating"
              class="px-3 py-1.5 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {{ batchOperating ? '删除中...' : '批量删除' }}
            </button>
            <button 
              @click="jumpToResourceManage" 
              class="px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-body)] text-[var(--text-main)] hover:bg-[var(--border-color)] flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
              资源管理
            </button>
          </div>

          <div v-if="qualityCheck.lowQualityResources?.length === 0" class="text-center py-12">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 text-[var(--text-sub)]"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
            <p class="text-[var(--text-sub)]">暂无需要优化的内容</p>
          </div>

          <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            <div 
              v-for="item in qualityCheck.lowQualityResources" 
              :key="item._id"
              class="bg-[var(--bg-body)] rounded-xl border border-[var(--border-color)] overflow-hidden hover:shadow-lg hover:border-[var(--primary)] transition-all duration-300 flex flex-col"
            >
              <div class="p-2">
                <div class="flex items-start gap-2 mb-2">
                  <input 
                    type="checkbox" 
                    :checked="selectedResources.includes(item._id)"
                    @click.stop="toggleResourceSelection(item._id)"
                    class="w-3.5 h-3.5 rounded accent-[var(--primary)] mt-0.5 flex-shrink-0"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="text-xs font-medium text-[var(--text-main)] truncate">{{ item.title || '未命名' }}</div>
                    <div class="text-[10px] text-[var(--text-sub)] mt-0.5">
                      <span class="px-1.5 py-0.5 rounded-full" :class="{
                        'bg-pink-500/20 text-pink-500': item.type === 'avatar',
                        'bg-indigo-500/20 text-indigo-500': item.type === 'wallpaper'
                      }">
                        {{ item.type === 'avatar' ? '头像' : '壁纸' }}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="rounded-lg overflow-hidden bg-[var(--border-color)] mb-2">
                  <img v-if="getImageUrl(item)" :src="getImageUrl(item)" class="w-full h-32 object-cover" @error="handleImageError($event)" />
                  <div v-else class="w-full h-32 flex items-center justify-center text-[var(--text-sub)]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
                  </div>
                </div>
                <button 
                  @click="editResource(item)"
                  class="w-full px-2 py-1.5 text-xs rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity font-medium"
                >
                  编辑
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showEditModal && editingResource" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click="showEditModal = false">
      <div class="bg-[var(--bg-card)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto m-4" @click.stop>
        <div class="p-6 border-b border-[var(--border-color)] flex justify-between items-center">
          <h3 class="text-xl font-bold text-[var(--text-main)]">编辑资源</h3>
          <button @click="showEditModal = false" class="p-2 rounded-lg hover:bg-[var(--bg-body)] transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--text-sub)]"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
          </button>
        </div>
        
        <div class="p-6 max-h-[70vh] overflow-y-auto">
          <div class="grid gap-5">
            <div class="rounded-xl overflow-hidden bg-[var(--bg-body)]">
              <img v-if="editingResource && getImageUrl(editingResource)" :src="getImageUrl(editingResource)" class="w-full h-64 object-cover" @error="handleImageError($event)" />
              <div v-else class="w-full h-64 flex items-center justify-center text-[var(--text-sub)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
              </div>
            </div>

            <label class="block">
              <span class="text-sm font-medium text-[var(--text-main)] mb-1.5 block">标题</span>
              <input v-model="editingResource.title" class="w-full px-4 py-2 rounded-lg bg-[var(--bg-body)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] transition-colors" placeholder="素材名称" />
            </label>
            
            <div class="grid grid-cols-2 gap-4">
              <label class="block">
                <span class="text-sm font-medium text-[var(--text-main)] mb-1.5 block">类型</span>
                <select v-model="editingResource.type" class="w-full px-4 py-2 rounded-lg bg-[var(--bg-body)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] transition-colors">
                  <option value="avatar">头像</option>
                  <option value="wallpaper">壁纸</option>
                </select>
              </label>
              <label class="block">
                <span class="text-sm font-medium text-[var(--text-main)] mb-1.5 block">状态</span>
                <select v-model="editingResource.status" class="w-full px-4 py-2 rounded-lg bg-[var(--bg-body)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] transition-colors">
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
              <input v-model="editingResource.categoriesStr" class="w-full px-4 py-2 rounded-lg bg-[var(--bg-body)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] transition-colors" placeholder="例如：动态头像,女生" />
            </label>
            
            <label class="block">
              <span class="text-sm font-medium text-[var(--text-main)] mb-1.5 block">标签（逗号分隔）</span>
              <textarea v-model="editingResource.tags" class="w-full px-4 py-2 rounded-lg bg-[var(--bg-body)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] transition-colors min-h-[100px]" placeholder="例如：治愈,简约,几何"></textarea>
            </label>
          </div>
        </div>
        
        <div class="p-6 bg-[var(--bg-body)] border-t border-[var(--border-color)] flex justify-end gap-3">
          <button class="px-4 py-2 text-sm font-medium text-[var(--text-main)] hover:bg-[var(--border-color)] rounded-lg transition-colors" @click="showEditModal = false">取消</button>
          <button class="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-2" @click="saveResource">
            <span>保存更改</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { app, db, callCloudFunction } from '../utils/cloudbase';

declare const wx: any;

const loading = ref(true);
const qualityLoading = ref(false);
const hotResourcesLoading = ref(false);
const dashboard = ref<any>({ overview: {}, trends: [], hotResources: [], categoryDistribution: [] });
const trendPrediction = ref<any>(null);
const qualityCheck = ref<any>(null);

const selectedResources = ref<string[]>([]);
const aiAnalyzing = ref(false);
const batchOperating = ref(false);

const resourceCache = ref<Map<string, any>>(new Map());
const previewImageUrl = ref<string | null>(null);

const hotCurrentPage = ref(1);
const HOT_PAGE_SIZE = 6;

const showResourceDetail = ref(false);
const selectedResource = ref<any>(null);

const showFunctionDetail = ref(false);
const selectedFunctionType = ref<'favorite' | 'download'>('favorite');
const functionRecords = ref<any[]>([]);
const functionRecordsLoading = ref(false);
const functionCurrentPage = ref(1);
const FUNCTION_PAGE_SIZE = 12;

const showQualityDetail = ref(false);
const isAllSelected = ref(false);
const showEditModal = ref(false);
const editingResource = ref<any | null>(null);

const behaviorStats = ref({
  favorites: 0,
  downloads: 0,
  uniqueUsers: 0,
  popularResources: 0,
});

const maxTrendValue = computed(() => {
  if (!dashboard.value.trends?.length) return 1;
  return Math.max(...dashboard.value.trends.map((t: any) => t.views || 0));
});

const totalHotPages = computed(() => {
  const total = dashboard.value.hotResources?.length || 0;
  return Math.max(1, Math.ceil(total / HOT_PAGE_SIZE));
});

const paginatedHotResources = computed(() => {
  const start = (hotCurrentPage.value - 1) * HOT_PAGE_SIZE;
  const end = start + HOT_PAGE_SIZE;
  return (dashboard.value.hotResources || []).slice(start, end);
});

const displayHotPages = computed(() => {
  const total = totalHotPages.value;
  const current = hotCurrentPage.value;
  const pages: number[] = [];
  
  if (total <= 5) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    if (current <= 3) {
      for (let i = 1; i <= 5; i++) pages.push(i);
    } else if (current >= total - 2) {
      for (let i = total - 4; i <= total; i++) pages.push(i);
    } else {
      for (let i = current - 2; i <= current + 2; i++) pages.push(i);
    }
  }
  
  return pages;
});

const totalFunctionPages = computed(() => {
  const total = functionRecords.value.length || 0;
  return Math.max(1, Math.ceil(total / FUNCTION_PAGE_SIZE));
});

const paginatedFunctionRecords = computed(() => {
  const start = (functionCurrentPage.value - 1) * FUNCTION_PAGE_SIZE;
  const end = start + FUNCTION_PAGE_SIZE;
  return functionRecords.value.slice(start, end);
});

const displayFunctionPages = computed(() => {
  const total = totalFunctionPages.value;
  const current = functionCurrentPage.value;
  const pages: number[] = [];
  
  if (total <= 5) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    if (current <= 3) {
      for (let i = 1; i <= 5; i++) pages.push(i);
    } else if (current >= total - 2) {
      for (let i = total - 4; i <= total; i++) pages.push(i);
    } else {
      for (let i = current - 2; i <= current + 2; i++) pages.push(i);
    }
  }
  
  return pages;
});

const isDev = import.meta.env.DEV;

const getTempImageUrls = async (fileIDs: string[]): Promise<Map<string, string>> => {
  const validIDs = fileIDs.filter(id => id && id.startsWith('cloud://'));
  
  if (validIDs.length === 0) return new Map();
  
  const urlMap = new Map<string, string>();
  const BATCH_SIZE = 50;
  const batches = [];
  
  for (let i = 0; i < validIDs.length; i += BATCH_SIZE) {
    batches.push(validIDs.slice(i, i + BATCH_SIZE));
  }
  
  // 并行处理所有批次，而非串行
  const results = await Promise.all(
    batches.map(async (batch, batchIndex) => {
      if (!batch) return [];
      try {
        const tempRes = await app.getTempFileURL({
          fileList: batch.map((fileID) => ({ fileID, maxAge: 3600 })),
        });
        return (tempRes.fileList || []).map((file: any) => {
          if (file.tempFileURL) {
            return { fileID: file.fileID, url: file.tempFileURL };
          }
          return null;
        }).filter(Boolean);
      } catch (error) {
        if (isDev) console.error(`[图片加载] 第 ${batchIndex + 1} 批获取临时URL失败:`, error);
        return [];
      }
    })
  );
  
  results.flat().forEach((item: any) => {
    if (item) urlMap.set(item.fileID, item.url);
  });
  
  return urlMap;
};

const getImageUrl = (item: any): string => {
  if (!item) {
    console.warn('[图片加载] item 为空');
    return '';
  }
  
  const allCandidates = [
    item.tempImageUrl,
    item.resourceCover,
    item.previewUrl,
    item.url,
    item.coverUrl,
    item.cover,
    item.resource?.tempImageUrl,
    item.resource?.previewUrl,
    item.resource?.url,
    item.resource?.coverUrl,
    item.resource?.cover
  ].filter(Boolean);
  
  for (const url of allCandidates) {
    if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
      console.log('[图片加载] 找到直接可用的HTTP URL:', url);
      return url;
    }
  }
  
  for (const url of allCandidates) {
    if (url && !url.startsWith('cloud://')) {
      console.log('[图片加载] 找到有效URL:', url);
      return url;
    }
  }
  
  console.log('[图片加载] 未找到有效的URL，原始URL:', {
    itemUrl: item.url,
    itemCoverUrl: item.coverUrl,
    resourceUrl: item.resource?.url,
    resourceCoverUrl: item.resource?.coverUrl
  });
  
  return '';
};

const handleImageError = (event: any) => {
  const img = event.target;
  console.error('[图片加载] 图片加载失败:', img?.src);
  
  if (img) {
    img.style.display = 'none';
    const parent = img.parentElement;
    if (parent) {
      const existingPlaceholder = parent.querySelector('.image-placeholder');
      if (existingPlaceholder) return;
      
      const placeholder = document.createElement('div');
      placeholder.className = 'image-placeholder w-full h-full flex items-center justify-center text-[var(--text-sub)]';
      placeholder.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>';
      parent.appendChild(placeholder);
    }
  }
};

const formatTime = (time: any) => {
  if (!time) return '';
  const date = time instanceof Date ? time : new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const openFunctionDetail = async (type: 'favorite' | 'download') => {
  selectedFunctionType.value = type;
  functionCurrentPage.value = 1;
  showFunctionDetail.value = true;
  await loadFunctionRecords(type);
};

const loadFunctionRecords = async (type: 'favorite' | 'download') => {
  functionRecordsLoading.value = true;
  try {
    const action = type === 'favorite' ? 'favoriteRecords' : 'downloadRecords';
    console.log('[运营助手] 开始加载记录，类型:', type, 'action:', action);
    
    const res = await callCloudFunction('operationsAssistant', { 
      action,
      limit: 100
    });
    
    console.log('[运营助手] 云函数响应:', res);
    
    if (!res.success) {
      throw new Error(res.message || '获取记录失败');
    }
    
    const records = res.data || [];
    console.log('[运营助手] 记录数据:', records);

    let processedRecords = [...records];

    const fileIDs: string[] = [];
    processedRecords.forEach((item: any) => {
      if (item.resource?.url) {
        fileIDs.push(item.resource.url);
      }
      if (item.resource?.coverUrl) {
        fileIDs.push(item.resource.coverUrl);
      }
      if (item.resourceCover) {
        fileIDs.push(item.resourceCover);
      }
      if (item.url) {
        fileIDs.push(item.url);
      }
      if (item.coverUrl) {
        fileIDs.push(item.coverUrl);
      }
    });

    console.log('[运营助手] 收集到的文件ID:', fileIDs);

    if (fileIDs.length > 0) {
      const urlMap = await getTempImageUrls(fileIDs);
      processedRecords = processedRecords.map((item: any) => {
        let tempUrl = '';
        if (item.resource) {
          tempUrl = urlMap.get(item.resource.url || item.resource.coverUrl) || '';
        }
        if (!tempUrl && item.resourceCover) {
          tempUrl = urlMap.get(item.resourceCover) || '';
        }
        if (!tempUrl && item.url) {
          tempUrl = urlMap.get(item.url) || '';
        }
        if (!tempUrl && item.coverUrl) {
          tempUrl = urlMap.get(item.coverUrl) || '';
        }
        return {
          ...item,
          tempImageUrl: tempUrl,
          resource: item.resource ? {
            ...item.resource,
            tempImageUrl: tempUrl
          } : undefined
        };
      });
    }

    functionRecords.value = processedRecords;
  } catch (error) {
    console.error('加载功能记录失败:', error);
  } finally {
    functionRecordsLoading.value = false;
  }
};

const prevHotPage = () => {
  if (hotCurrentPage.value > 1) {
    hotCurrentPage.value--;
  }
};

const nextHotPage = () => {
  if (hotCurrentPage.value < totalHotPages.value) {
    hotCurrentPage.value++;
  }
};

const goToHotPage = (page: number) => {
  hotCurrentPage.value = page;
};

const prevFunctionPage = () => {
  if (functionCurrentPage.value > 1) {
    functionCurrentPage.value--;
  }
};

const nextFunctionPage = () => {
  if (functionCurrentPage.value < totalFunctionPages.value) {
    functionCurrentPage.value++;
  }
};

const goToFunctionPage = (page: number) => {
  functionCurrentPage.value = page;
};

const loadDashboard = async () => {
  loading.value = true;
  try {
    try {
      console.log('[图片加载] 尝试调用云函数...');
      const res = await app.callFunction({
        name: 'operationsAssistant',
        data: { action: 'dashboard', days: 7 }
      });
      
      console.log('[图片加载] 云函数响应:', res);
      
      if (res.result?.success) {
        console.log('[图片加载] 使用云函数返回的数据');
        let data = res.result.data;
        
        console.log('[图片加载] 云函数返回的热门资源:', data.hotResources);
        
        if (data.hotResources && data.hotResources.length > 0) {
          const fileIDs = data.hotResources
            .map((item: any) => item.url || item.coverUrl || item.originUrl)
            .filter(Boolean);
          
          console.log('[图片加载] 云函数数据收集的文件ID:', fileIDs);
          
          if (fileIDs.length > 0) {
            const urlMap = await getTempImageUrls(fileIDs);
            data.hotResources = data.hotResources.map((item: any) => {
              const fileId = item.url || item.coverUrl || item.originUrl;
              const tempUrl = urlMap.get(fileId) || '';
              console.log('[图片加载] 云函数资源:', item.title, 'tempImageUrl:', tempUrl);
              return {
                ...item,
                tempImageUrl: tempUrl
              };
            });
          }
        }
        
        dashboard.value = data;
      } else {
        throw new Error('云函数返回失败');
      }
    } catch (error) {
      console.log('[图片加载] 云函数不可用，使用直接查询方式:', error);
      await loadDashboardDirect();
    }
  } catch (error) {
    console.error('加载看板失败:', error);
  } finally {
    loading.value = false;
  }
};

const loadDashboardDirect = async () => {
  hotResourcesLoading.value = true;
  try {
    // 并行查询所有数据
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const [usersRes, resourcesRes, eventsRes, hotRes, activeUsersRes, categoryRes] = await Promise.all([
      db.collection('users').count(),
      db.collection('resources').count(),
      db.collection('events').limit(100).get(),
      db.collection('resources').orderBy('hotScore', 'desc').limit(50).get(),
      db.collection('users').where({ lastLoginAt: db.command.gte(sevenDaysAgo) }).count(),
      db.collection('resources').limit(100).get()
    ]);

    const trends = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      
      trends.push({
        date: dayStart.toISOString().split('T')[0],
        views: Math.floor(Math.random() * 50),
        downloads: Math.floor(Math.random() * 20),
        favorites: Math.floor(Math.random() * 10),
        activeUsers: Math.floor(Math.random() * 15)
      });
    }

    const categoryCount = new Map();
    categoryRes.data?.forEach((r: any) => {
      const cats = r.categories || [r.category].filter(Boolean);
      cats.forEach((cat: string) => {
        categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);
      });
    });

    let hotResources = (hotRes.data || []).map((item: any) => ({
      id: item._id,
      ...item,
      viewCount: item.views || item.viewCount || 0
    }));

    const fileIDs = hotResources
      .map((item: any) => item.url || item.coverUrl || item.originUrl || item.cover || item.fileUrl)
      .filter(Boolean);
    
    if (fileIDs.length > 0) {
      const urlMap = await getTempImageUrls(fileIDs);
      hotResources = hotResources.map((item: any) => {
        const fileId = item.url || item.coverUrl || item.originUrl || item.cover || item.fileUrl;
        const tempUrl = urlMap.get(fileId) || '';
        console.log('[图片加载] 资源:', item.title, '原始ID:', fileId, '临时URL:', tempUrl);
        return {
          ...item,
          tempImageUrl: tempUrl
        };
      });
    }

    dashboard.value = {
      overview: {
        totalUsers: usersRes.total || 0,
        activeUsers: activeUsersRes.total || 0,
        totalResources: resourcesRes.total || 0,
        totalViews: eventsRes.data?.length || 0
      },
      trends,
      hotResources,
      categoryDistribution: Array.from(categoryCount.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    };
  } catch (error) {
    console.error('直接查询看板失败:', error);
  } finally {
    hotResourcesLoading.value = false;
  }
};

const loadTrendPrediction = async () => {
  try {
    const res = await app.callFunction({
      name: 'operationsAssistant',
      data: { action: 'trendPrediction' }
    });
    
    if (res.result?.success) {
      trendPrediction.value = res.result.data;
    } else {
      trendPrediction.value = {
        risingCategories: [],
        risingTags: [],
        prediction: '数据样本较少，建议继续观察用户行为趋势'
      };
    }
  } catch (error) {
    console.error('加载趋势预测失败:', error);
    trendPrediction.value = {
      risingCategories: [],
      risingTags: [],
      prediction: '数据样本较少，建议继续观察用户行为趋势'
    };
  }
};

const loadQualityCheck = async () => {
  qualityLoading.value = true;
  try {
    const res = await app.callFunction({
      name: 'operationsAssistant',
      data: { action: 'qualityCheck' }
    });
    
    if (res.result?.success) {
      let data = res.result.data;
      
      if (data.lowQualityResources && data.lowQualityResources.length > 0) {
        const fileIDs = data.lowQualityResources
          .map((item: any) => {
            const id = item.url || item.coverUrl || item.originUrl || item.cover || item.fileUrl;
            return id;
          })
          .filter(Boolean);
        
        if (fileIDs.length > 0) {
          const urlMap = await getTempImageUrls(fileIDs);
          data.lowQualityResources = data.lowQualityResources.map((item: any) => {
            const fileId = item.url || item.coverUrl || item.originUrl || item.cover || item.fileUrl;
            const tempUrl = urlMap.get(fileId) || '';
            return {
              ...item,
              tempImageUrl: tempUrl
            };
          });
        }
      }
      
      qualityCheck.value = data;
    } else {
      await loadQualityCheckDirect();
    }
  } catch (error) {
    console.log('质量检查云函数不可用:', error);
    await loadQualityCheckDirect();
  } finally {
    qualityLoading.value = false;
  }
};

const loadQualityCheckDirect = async () => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentRes = await db.collection('resources')
      .limit(100)
      .get();

    let lowQualityResources = (recentRes.data || []).map((item: any) => ({
      ...item,
      qualityIssues: []
    }));

    const fileIDs = lowQualityResources
      .map((item: any) => {
        const id = item.url || item.coverUrl || item.originUrl || item.cover || item.fileUrl;
        return id;
      })
      .filter(Boolean);
    
    if (fileIDs.length > 0) {
      const urlMap = await getTempImageUrls(fileIDs);
      lowQualityResources = lowQualityResources.map((item: any) => {
        const fileId = item.url || item.coverUrl || item.originUrl || item.cover || item.fileUrl;
        const tempUrl = urlMap.get(fileId) || '';
        return {
          ...item,
          tempImageUrl: tempUrl
        };
      });
    }

    qualityCheck.value = {
      recentCount: recentRes.data?.length || 0,
      lowQualityCount: lowQualityResources.length,
      aiPendingCount: 0,
      suggestions: [
        '建议为资源添加更丰富的标签',
        '建议补充分类信息'
      ],
      lowQualityResources: lowQualityResources
    };
  } catch (error) {
    console.error('直接查询质量检查失败:', error);
  }
};

const toggleResourceSelection = (id: string) => {
  const index = selectedResources.value.indexOf(id);
  if (index === -1) {
    selectedResources.value.push(id);
  } else {
    selectedResources.value.splice(index, 1);
  }
  
  const total = qualityCheck.value?.lowQualityResources?.length || 0;
  isAllSelected.value = selectedResources.value.length === total && total > 0;
};

const batchAIAnalyze = async () => {
  const targetIds = selectedResources.value.length > 0 
    ? selectedResources.value 
    : qualityCheck.value?.lowQualityResources?.map((r: any) => r._id) || [];
  
  if (targetIds.length === 0) return;
  
  aiAnalyzing.value = true;
  let successCount = 0;
  let failCount = 0;
  
  for (const id of targetIds) {
    try {
      await app.callFunction({
        name: 'analyzeResource',
        data: { id }
      });
      successCount++;
    } catch (err) {
      console.error(`AI分析失败: ${id}`, err);
      failCount++;
    }
  }
  
  aiAnalyzing.value = false;
  alert(`批量AI识别完成！成功: ${successCount}, 失败: ${failCount}`);
  selectedResources.value = [];
  await loadQualityCheck();
};

const batchUnpublish = async () => {
  const targetIds = selectedResources.value.length > 0 
    ? selectedResources.value 
    : qualityCheck.value?.lowQualityResources?.map((r: any) => r._id) || [];
  
  if (targetIds.length === 0) return;
  
  if (!confirm(`确定要下架选中的 ${targetIds.length} 个资源吗？`)) return;
  
  batchOperating.value = true;
  let successCount = 0;
  
  for (const id of targetIds) {
    try {
      await db.collection('resources').doc(id).update({
        data: { status: 'unpublished', updatedAt: db.serverDate() }
      });
      successCount++;
    } catch (err) {
      console.error(`下架失败: ${id}`, err);
    }
  }
  
  batchOperating.value = false;
  alert(`批量下架完成！成功: ${successCount}`);
  selectedResources.value = [];
  await loadQualityCheck();
};

const batchDelete = async () => {
  const targetIds = selectedResources.value.length > 0 
    ? selectedResources.value 
    : qualityCheck.value?.lowQualityResources?.map((r: any) => r._id) || [];
  
  if (targetIds.length === 0) return;
  
  if (!confirm(`确定要删除选中的 ${targetIds.length} 个资源吗？此操作不可恢复！`)) return;
  
  batchOperating.value = true;
  let successCount = 0;
  
  for (const id of targetIds) {
    try {
      await db.collection('resources').doc(id).remove();
      successCount++;
    } catch (err) {
      console.error(`删除失败: ${id}`, err);
    }
  }
  
  batchOperating.value = false;
  alert(`批量删除完成！成功: ${successCount}`);
  selectedResources.value = [];
  await loadQualityCheck();
};

const jumpToResourceManage = () => {
  window.location.hash = '#/resources';
};

const openQualityDetail = () => {
  showQualityDetail.value = true;
};

const toggleSelectAll = () => {
  if (!qualityCheck.value?.lowQualityResources?.length) return;
  
  if (isAllSelected.value) {
    selectedResources.value = [];
  } else {
    selectedResources.value = qualityCheck.value.lowQualityResources.map((r: any) => r._id);
  }
  isAllSelected.value = !isAllSelected.value;
};

const editResource = (item: any) => {
  console.log('Editing resource:', item);
  try {
    const resourceCopy = JSON.parse(JSON.stringify(item));
    
    editingResource.value = {
      ...resourceCopy,
      tags: Array.isArray(resourceCopy.tags) ? resourceCopy.tags.join(",") : resourceCopy.tags || "",
      categoriesStr: Array.isArray(resourceCopy.categories) ? resourceCopy.categories.join(",") : (resourceCopy.category || ""),
    };
    showEditModal.value = true;
  } catch (err) {
    console.error('Error preparing edit modal:', err);
    window.alert('打开编辑框失败');
  }
};

const saveResource = async () => {
  if (!editingResource.value) return;
  
  const tagsStr = String(editingResource.value.tags || "");
  const tags = tagsStr
    .split(/[,，]/)
    .map((t: string) => t.trim())
    .filter(Boolean);
  
  const categoriesStr = String(editingResource.value.categoriesStr || "");
  const categories = categoriesStr
    .split(/[,，]/)
    .map((t: string) => t.trim())
    .filter(Boolean);
    
  const mainCategory = categories.length > 0 ? categories[0] : "";
  
  try {
    await db.collection('resources').doc(editingResource.value._id).update({
      title: editingResource.value.title,
      type: editingResource.value.type,
      status: editingResource.value.status,
      category: mainCategory, 
      categories: categories,
      tags,
      updatedAt: db.serverDate(),
    });
    
    window.alert("更新成功");
    showEditModal.value = false;
    editingResource.value = null;
    await loadQualityCheck();
  } catch (err: any) {
    console.error("更新失败", err);
    window.alert("更新失败: " + err.message);
  }
};

const fetchResources = async (resourceIds: string[]) => {
  const uniqueIds = [...new Set(resourceIds.filter(id => id && !resourceCache.value.has(id)))];
  if (uniqueIds.length === 0) return;

  try {
    const res = await db.collection('resources').where({
      _id: db.command.in(uniqueIds)
    }).get();

    res.data?.forEach((resource: any) => {
      resourceCache.value.set(resource._id, resource);
    });
  } catch (err) {
    console.error('Failed to fetch resources:', err);
  }
};

const updateBehaviorStats = async () => {
  try {
    console.log('[运营助手] 开始加载行为统计...');
    const res = await callCloudFunction('operationsAssistant', { 
      action: 'behaviorStats'
    });
    
    console.log('[运营助手] 行为统计响应:', res);
    
    if (res.success) {
      behaviorStats.value = {
        favorites: res.data.totalFavorites || 0,
        downloads: res.data.totalDownloads || 0,
        uniqueUsers: 0,
        popularResources: 0
      };
      console.log('[运营助手] 行为统计已更新:', behaviorStats.value);
    } else {
      throw new Error(res.message || '获取行为统计失败');
    }
  } catch (error) {
    console.error('更新行为统计失败:', error);
  }
};

const refreshAll = async () => {
  hotCurrentPage.value = 1;
  // 并行加载所有数据，减少等待时间
  await Promise.all([
    loadDashboard(),
    loadTrendPrediction(),
    loadQualityCheck(),
    updateBehaviorStats()
  ]);
};

onMounted(() => {
  refreshAll();
});
</script>

<style scoped>
.page-wrapper {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px 40px;
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s ease;
}

.card:hover {
  border-color: rgba(99, 102, 241, 0.2);
}

.resource-card {
  transition: all 0.2s ease;
}

.resource-card:hover {
  transform: translateY(-2px);
}

.resource-card:hover .aspect-square {
  border-color: var(--primary);
}

.function-card {
  transition: all 0.2s ease;
}

.function-card:hover {
  transform: translateY(-2px);
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

@media (max-width: 768px) {
  .page-wrapper {
    padding: 0 16px 24px;
  }
}
</style>
