<template>
  <div class="space-y-6">
    <!-- Header -->
    <section class="glass-panel">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h2 class="panel-title">页面广告管理</h2>
          <p class="panel-sub">管理小程序各页面的广告位配置</p>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button class="btn-soft" @click="openAdUnitManager">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
            </svg>
            管理广告ID
          </button>
          <button class="btn-soft" @click="openBatchAdd">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" />
            </svg>
            批量添加
          </button>
          <button class="btn-primary" @click="openCreate">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
            </svg>
            新增广告位
          </button>
        </div>
      </div>
    </section>

    <!-- 激励广告配置 -->
    <section class="glass-panel">
      <div class="flex items-center justify-between p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)]">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
            </svg>
          </div>
          <div>
            <h4 class="font-semibold text-lg">激励广告开关</h4>
            <p class="text-sm text-[var(--text-sub)] mt-0.5">
              控制用户下载时是否需要观看激励广告
              <span class="text-warning ml-1">（审核期间建议关闭）</span>
            </p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm text-[var(--text-sub)]">
            {{ rewardAdEnabled ? '已启用' : '已禁用' }}
          </span>
          <input
            type="checkbox"
            class="toggle toggle-success toggle-lg"
            :checked="rewardAdEnabled"
            @change="handleRewardAdToggle"
            :disabled="rewardAdSaving"
          />
        </div>
      </div>
    </section>

    <!-- 页面选择 -->
    <section class="glass-panel">
      <div class="flex items-center gap-4 mb-4">
        <h3 class="font-semibold">选择页面</h3>
        <div class="flex-1"></div>
        <div class="flex gap-2">
          <button 
            v-if="selectedPage" 
            class="btn-soft text-xs" 
            @click="batchToggle(true)"
          >
            批量开启
          </button>
          <button 
            v-if="selectedPage" 
            class="btn-soft text-xs" 
            @click="batchToggle(false)"
          >
            批量关闭
          </button>
        </div>
      </div>
      
      <div class="flex flex-wrap gap-2">
        <button
          v-for="p in pages"
          :key="p"
          class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
          :class="selectedPage === p 
            ? 'bg-[var(--primary)] text-white shadow-md' 
            : 'bg-[var(--bg-body)] text-[var(--text-sub)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)]'"
          @click="selectedPage = p; loadList()"
        >
          {{ getPageName(p) }}
        </button>
      </div>
    </section>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="i in 6" :key="i" class="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 animate-pulse">
        <div class="h-4 bg-[var(--border-color)] rounded w-1/3 mb-3"></div>
        <div class="h-3 bg-[var(--border-color)] rounded w-2/3 mb-2"></div>
        <div class="h-3 bg-[var(--border-color)] rounded w-1/2"></div>
      </div>
    </div>

    <!-- 广告位列表 -->
    <section v-else-if="list.length > 0" class="glass-panel">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold">
          广告位列表
          <span class="ml-2 text-sm font-normal text-[var(--text-sub)]">共 {{ list.length }} 个</span>
        </h3>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div 
          v-for="item in list" 
          :key="item._id"
          class="group bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 hover:shadow-md transition-all duration-200"
        >
          <!-- Header -->
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium">
                {{ getPageName(item.pagePath) }}
              </span>
            </div>
            <!-- 快速开关 -->
            <div class="flex items-center gap-2">
              <span class="text-xs" :class="item.isEnable ? 'text-green-500' : 'text-[var(--text-sub)]'">
                {{ item.isEnable ? '开启' : '关闭' }}
              </span>
              <input
                type="checkbox"
                class="toggle toggle-sm"
                :class="item.isEnable ? 'toggle-success' : ''"
                :checked="item.isEnable"
                @change.stop="toggleEnable(item)"
                :disabled="togglingId === item._id"
              />
            </div>
          </div>

          <!-- Info -->
          <div class="space-y-2 mb-4">
            <div class="flex items-center gap-2 text-sm">
              <span class="text-[var(--text-sub)]">广告ID:</span>
              <span class="font-mono bg-[var(--bg-body)] px-2 py-0.5 rounded text-xs">
                {{ item.adId }}
              </span>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <span class="text-[var(--text-sub)]">类型:</span>
              <span class="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-xs">
                {{ getAdTypeLabel(item.type) }}
              </span>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <span class="text-[var(--text-sub)]">单元ID:</span>
              <span class="font-mono text-xs text-[var(--text-sub)] bg-[var(--bg-body)] px-2 py-0.5 rounded truncate max-w-[180px]">
                {{ item.adUnitId || '-' }}
              </span>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-between pt-3 border-t border-[var(--border-color)]">
            <span class="text-xs text-[var(--text-sub)]">
              更新: {{ formatTime(item.updateTime) }}
            </span>
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                class="p-2 text-[var(--text-sub)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-colors" 
                @click="openEdit(item)"
                title="编辑"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
              <button 
                class="p-2 text-[var(--text-sub)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" 
                @click="remove(item)"
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
    </section>

    <!-- Empty State -->
    <section v-else class="glass-panel">
      <div class="flex flex-col items-center justify-center py-16">
        <div class="w-20 h-20 bg-[var(--bg-body)] rounded-full flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-[var(--text-sub)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 class="text-lg font-semibold mb-2">暂无广告位</h3>
        <p class="text-sm text-[var(--text-sub)] mb-4">选择一个页面后点击"新增广告位"创建</p>
        <button class="btn-primary" @click="openCreate" :disabled="!selectedPage">
          新增广告位
        </button>
      </div>
    </section>

    <!-- 广告位弹窗 -->
    <AdPositionDialog
      :visible="showDialog"
      :pages="pages"
      :edit-item="currentEditItem"
      @close="handleDialogClose"
      @save="handleDialogSave"
    />

    <!-- 广告单元管理弹窗 -->
    <AdUnitConfigDialog
      :visible="showAdUnitDialog"
      @close="showAdUnitDialog = false"
    />
    
    <!-- 批量添加弹窗 -->
    <div v-if="showBatchDialog" class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="glass-panel w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        <div class="flex items-center justify-between pb-4 border-b border-[var(--border-color)]">
          <div>
            <h3 class="font-semibold text-lg">批量添加广告</h3>
            <p class="text-xs text-[var(--text-sub)] mt-0.5">Step {{ batchStep }} / 3</p>
          </div>
          <button class="btn-soft" @click="closeBatchDialog">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Steps -->
        <div class="py-3 bg-[var(--bg-body)] border-b border-[var(--border-color)]">
          <div class="flex items-center gap-3 text-sm">
            <div :class="stepClass(1)" class="flex items-center gap-1">
              <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium" :class="batchStep >= 1 ? 'bg-[var(--primary)] text-white' : 'bg-[var(--border-color)] text-[var(--text-sub)]'">1</span>
              <span>选择页面</span>
            </div>
            <div class="flex-1 h-px bg-[var(--border-color)]"></div>
            <div :class="stepClass(2)" class="flex items-center gap-1">
              <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium" :class="batchStep >= 2 ? 'bg-[var(--primary)] text-white' : 'bg-[var(--border-color)] text-[var(--text-sub)]'">2</span>
              <span>配置广告</span>
            </div>
            <div class="flex-1 h-px bg-[var(--border-color)]"></div>
            <div :class="stepClass(3)" class="flex items-center gap-1">
              <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium" :class="batchStep >= 3 ? 'bg-[var(--primary)] text-white' : 'bg-[var(--border-color)] text-[var(--text-sub)]'">3</span>
              <span>确认提交</span>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-6 space-y-4">
          <div v-if="batchStep === 1" class="space-y-3">
            <div class="flex items-center gap-2">
              <input class="form-input flex-1" v-model="pageKeyword" placeholder="搜索页面（中文名或路径）" />
              <button class="btn-soft text-sm" @click="selectedPages = [...pages]">全选</button>
              <button class="btn-soft text-sm" @click="selectedPages = []">清空</button>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-72 overflow-auto border border-[var(--border-color)] rounded-lg p-3">
              <label v-for="p in filteredPages" :key="'sel-'+p" class="inline-flex items-center gap-2 text-sm cursor-pointer select-none px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
                <input type="checkbox" class="w-4 h-4 rounded border-[var(--border-color)] text-[var(--primary)]" :value="p" v-model="selectedPages">
                <span class="truncate text-sm">{{ getPageName(p) }}</span>
              </label>
            </div>
            <p class="text-sm text-[var(--text-sub)]">已选择 {{ selectedPages.length }} 个页面</p>
          </div>

          <div v-if="batchStep === 2" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="form-group">
                <label class="form-label">广告类型</label>
                <select class="form-input" v-model="batchForm.type">
                  <option value="native_top">原生顶部广告</option>
                  <option value="native_bottom">原生底部广告</option>
                  <option value="native_video">原生视频广告</option>
                  <option value="interstitial">插屏广告</option>
                  <option value="rewarded">激励视频广告</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">位置</label>
                <select class="form-input" v-model="batchForm.position">
                  <option value="">自动</option>
                  <option value="top">顶部</option>
                  <option value="middle">中间</option>
                  <option value="bottom">底部</option>
                </select>
              </div>
              <div class="form-group md:col-span-2">
                <label class="form-label">广告单元ID</label>
                <div class="flex gap-2">
                  <select class="form-input flex-1" v-model="selectedBatchAdUnitId" @change="applySelectedBatchAdUnit">
                    <option value="">从配置中选择</option>
                    <option v-for="u in adUnits" :key="u._id" :value="u.adUnitId">
                      {{ u.name }}（{{ u.adUnitId }}）
                    </option>
                  </select>
                  <button class="btn-soft" @click="openAdUnitManager">管理</button>
                </div>
                <input class="form-input mt-2" v-model="batchForm.adUnitId" placeholder="或直接输入 adunit-xxxxxxxxxxxxxxxx" />
              </div>
              <div class="form-group">
                <label class="form-label">权重</label>
                <input type="number" class="form-input" v-model.number="batchForm.weight" min="0" />
              </div>
            </div>
          </div>

          <div v-if="batchStep === 3" class="space-y-4">
            <div class="bg-[var(--bg-body)] rounded-xl p-4 space-y-3">
              <h4 class="font-medium">确认信息</h4>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span class="text-[var(--text-sub)]">页面数量:</span>
                  <span class="ml-2 font-medium">{{ selectedPages.length }} 个</span>
                </div>
                <div>
                  <span class="text-[var(--text-sub)]">广告类型:</span>
                  <span class="ml-2 font-medium">{{ getAdTypeLabel(batchForm.type) }}</span>
                </div>
                <div>
                  <span class="text-[var(--text-sub)]">广告位置:</span>
                  <span class="ml-2 font-medium">{{ getPositionLabel(batchForm.position) || '自动' }}</span>
                </div>
                <div>
                  <span class="text-[var(--text-sub)]">广告单元ID:</span>
                  <span class="ml-2 font-mono text-xs">{{ batchForm.adUnitId || '未设置' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
          <button v-if="batchStep > 1" class="btn" @click="prevStep">上一步</button>
          <button v-if="batchStep < 3" class="btn-primary" :disabled="!canGoNext" @click="nextStep">下一步</button>
          <button v-if="batchStep === 3" class="btn-primary" :disabled="!canSubmit" @click="confirmBatchAdd">
            确认提交
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { callCloudFunction } from '../utils/cloudbase'
import { ElMessage } from 'element-plus'
import AdPositionDialog from '../components/AdPositionDialog.vue'
import AdUnitConfigDialog from '../components/AdUnitConfigDialog.vue'

const pages = ref([])
const selectedPage = ref('')
const selectedPages = ref([])
const pageKeyword = ref('')
const list = ref([])
const loading = ref(false)
const togglingId = ref('')
const showDialog = ref(false)
const currentEditItem = ref(null)
const showAdUnitDialog = ref(false)
const showBatchDialog = ref(false)
const batchStep = ref(1)
const batchLoading = ref(false)
const batchResult = ref(null)
const adUnits = ref([])
const selectedBatchAdUnitId = ref('')
const rewardAdEnabled = ref(true)
const rewardAdSaving = ref(false)
const batchForm = ref({
  type: 'native_top',
  adUnitId: '',
  position: '',
  weight: 0,
  startTime: '',
  endTime: '',
  isEnable: true,
  scrollThreshold: 0,
  meta: { materialUrl: '' }
})

const fallbackPages = [
  '/pages/index/index',
  '/pages/wallpaper/wallpaper',
  '/pages/avatar/avatar',
  '/pages/profile/profile',
  '/subpackages/daily-picks/daily-picks',
  '/subpackages/search/search',
  '/subpackages/profile-edit/profile-edit',
  '/subpackages/favorites/favorites',
  '/subpackages/preview/preview',
  '/subpackages/wallpaper-preview/wallpaper-preview',
  '/subpackages/topic/topic',
  '/subpackages/topic-list/topic-list',
  '/subpackages/login/login',
  '/subpackages/webview/webview',
  '/subpackages/wallpaper-list/wallpaper-list',
  '/subpackages/resource-list/resource-list',
  '/subpackages/inspiration-writer/inspiration-writer',
  '/subpackages/points/points',
  '/subpackages/notifications/notifications'
]

onMounted(async () => {
  await loadPages()
  await loadRewardAdConfig()
  await loadAdUnits()
})

async function loadAdUnits() {
  try {
    const res = await callCloudFunction('adConfigManager', { action: 'adUnit:list' })
    adUnits.value = Array.isArray(res?.data) ? res.data : []
  } catch (err) {
    console.error('加载广告单元失败', err)
    ElMessage.error('获取已配置的广告ID失败：' + (err.message || '未知错误'))
  }
}

const filteredPages = computed(() => {
  const kw = (pageKeyword.value || '').trim().toLowerCase()
  if (!kw) return pages.value
  return pages.value.filter(p => {
    const name = getPageName(p) || ''
    return p.toLowerCase().includes(kw) || name.toLowerCase().includes(kw)
  })
})

function stepClass(step) {
  return batchStep.value >= step ? 'text-[var(--primary)] font-medium' : 'text-[var(--text-sub)]'
}

function formatTime(t) {
  try {
    if (!t) return '-'
    const d = new Date(t)
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return '-' }
}

function getAdTypeLabel(type) {
  const labels = {
    'native_top': '原生顶部',
    'native_bottom': '原生底部',
    'native_video': '原生视频',
    'video': '视频',
    'interstitial': '插屏',
    'rewarded': '激励视频'
  }
  return labels[type] || type || '-'
}

function getPositionLabel(pos) {
  const labels = { 'top': '顶部', 'middle': '中间', 'bottom': '底部' }
  return labels[pos] || ''
}

function getPageName(p) {
  const names = {
    '/pages/index/index': '首页',
    '/pages/wallpaper/wallpaper': '壁纸页',
    '/pages/avatar/avatar': '头像页',
    '/pages/profile/profile': '个人中心',
    '/subpackages/daily-picks/daily-picks': '每日推荐',
    '/subpackages/search/search': '搜索',
    '/subpackages/profile-edit/profile-edit': '编辑资料',
    '/subpackages/favorites/favorites': '收藏',
    '/subpackages/preview/preview': '头像预览',
    '/subpackages/wallpaper-preview/wallpaper-preview': '壁纸预览',
    '/subpackages/topic/topic': '专题',
    '/subpackages/topic-list/topic-list': '专题列表',
    '/subpackages/login/login': '登录',
    '/subpackages/webview/webview': '网页',
    '/subpackages/wallpaper-list/wallpaper-list': '壁纸列表',
    '/subpackages/resource-list/resource-list': '资源列表',
    '/subpackages/inspiration-writer/inspiration-writer': '灵感文案',
    '/subpackages/points/points': '积分',
    '/subpackages/notifications/notifications': '消息'
  }
  return names[p] || p.split('/').pop()
}

async function loadPages() {
  const deny = new Set([
    '/subpackages/profile-edit/profile-edit',
    '/subpackages/favorites/favorites',
    '/subpackages/login/login',
    '/subpackages/webview/webview',
    '/subpackages/notifications/notifications'
  ])
  pages.value = fallbackPages.filter(p => !deny.has(p))
  selectedPage.value = pages.value[0] || ''
  if (selectedPage.value) await loadList()
}

async function loadList() {
  if (!selectedPage.value) {
    list.value = []
    return
  }
  loading.value = true
  try {
    const res = await callCloudFunction('adConfigManager', {
      action: 'listByPage',
      pagePath: selectedPage.value
    })
    list.value = res?.data || []
  } catch (err) {
    console.error('加载广告位列表失败:', err)
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

async function loadRewardAdConfig() {
  try {
    const res = await callCloudFunction('getConfig', { key: 'rewardAdEnabled' })
    console.log('getConfig result:', res)
    if (res?.success && res?.data) {
      rewardAdEnabled.value = res.data.value !== false
    } else {
      console.log('getConfig returned no data, using default true')
      rewardAdEnabled.value = true
    }
  } catch (err) {
    console.error('加载激励广告配置失败:', err)
    rewardAdEnabled.value = true
  }
}

async function handleRewardAdToggle(e) {
  const target = e.target
  const newValue = target.checked
  rewardAdSaving.value = true
  try {
    const res = await callCloudFunction('manageConfig', {
      action: 'set',
      key: 'rewardAdEnabled',
      value: newValue,
      description: '激励广告开关'
    })
    console.log('manageConfig result:', res)
    if (res?.success) {
      rewardAdEnabled.value = newValue
      ElMessage.success(newValue ? '激励广告已启用' : '激励广告已禁用')
    } else {
      target.checked = !newValue
      ElMessage.error('保存失败')
    }
  } catch (err) {
    console.error('保存激励广告配置失败:', err)
    target.checked = !newValue
    ElMessage.error('保存失败')
  } finally {
    rewardAdSaving.value = false
  }
}

function openCreate() {
  currentEditItem.value = null
  showDialog.value = true
}

function openEdit(item) {
  currentEditItem.value = item
  showDialog.value = true
}

function handleDialogClose() {
  showDialog.value = false
  currentEditItem.value = null
}

async function handleDialogSave(formData) {
  try {
    const isEdit = Boolean(formData._id)
    const action = isEdit ? 'update' : 'create'
    const payload = isEdit
      ? { id: formData._id, updates: formData }
      : formData

    const res = await callCloudFunction('adConfigManager', {
      action,
      ...payload
    })

    if (res?.success) {
      ElMessage.success(isEdit ? '更新成功' : '创建成功')
    } else {
      ElMessage.error(res?.msg || (isEdit ? '更新失败' : '创建失败'))
    }
  } catch (err) {
    console.error('保存广告位失败:', err)
    ElMessage.error('保存失败')
  } finally {
    showDialog.value = false
    currentEditItem.value = null
    await loadList()
  }
}

function openAdUnitManager() {
  showAdUnitDialog.value = true
}

function openBatchAdd() {
  selectedPages.value = []
  batchStep.value = 1
  batchForm.value = {
    type: 'native_top',
    adUnitId: '',
    position: '',
    weight: 0,
    startTime: '',
    endTime: '',
    isEnable: true,
    scrollThreshold: 0,
    meta: { materialUrl: '' }
  }
  showBatchDialog.value = true
}

function closeBatchDialog() {
  showBatchDialog.value = false
}

function prevStep() {
  if (batchStep.value > 1) batchStep.value--
}

function nextStep() {
  if (batchStep.value < 3) batchStep.value++
}

const canGoNext = computed(() => {
  if (batchStep.value === 1) return selectedPages.value.length > 0
  if (batchStep.value === 2) return batchForm.value.type
  return true
})

const canSubmit = computed(() => {
  return batchStep.value === 3 && selectedPages.value.length > 0
})

function applySelectedBatchAdUnit() {
  if (selectedBatchAdUnitId.value) {
    batchForm.value.adUnitId = selectedBatchAdUnitId.value
  }
}

async function confirmBatchAdd() {
  batchLoading.value = true
  try {
    const ad = { ...batchForm.value }
    const res = await callCloudFunction('adConfigManager', {
      action: 'batchCreate',
      pages: selectedPages.value,
      ad
    })
    if (res?.success) {
      ElMessage.success(`成功创建 ${selectedPages.value.length} 个广告位`)
      closeBatchDialog()
      await loadList()
    } else {
      ElMessage.error(res?.message || '创建失败')
    }
  } catch (err) {
    ElMessage.error('创建失败')
  } finally {
    batchLoading.value = false
  }
}

async function batchToggle(enable) {
  if (!selectedPage.value) return
  try {
    const res = await callCloudFunction('adConfigManager', {
      action: 'batchEnable',
      pagePath: selectedPage.value,
      isEnable: enable
    })
    if (res?.success) {
      ElMessage.success(enable ? '已批量开启' : '已批量关闭')
      await loadList()
    } else {
      ElMessage.error(res?.message || '操作失败')
    }
  } catch (err) {
    ElMessage.error('操作失败')
  }
}

async function remove(item) {
  if (!confirm('确定删除这个广告位吗？')) return
  try {
    const res = await callCloudFunction('adConfigManager', {
      action: 'delete',
      id: item._id
    })
    if (res?.success) {
      ElMessage.success('删除成功')
      await loadList()
    } else {
      ElMessage.error(res?.message || '删除失败')
    }
  } catch (err) {
    ElMessage.error('删除失败')
  }
}

async function toggleEnable(item) {
  togglingId.value = item._id
  const newState = !item.isEnable
  try {
    const res = await callCloudFunction('adConfigManager', {
      action: 'update',
      id: item._id,
      updates: { isEnable: newState }
    })
    if (res?.success) {
      item.isEnable = newState
      ElMessage.success(newState ? '已开启' : '已关闭')
    } else {
      ElMessage.error(res?.msg || '操作失败')
    }
  } catch (err) {
    console.error('切换广告位状态失败:', err)
    ElMessage.error('操作失败')
  } finally {
    togglingId.value = ''
  }
}
</script>
