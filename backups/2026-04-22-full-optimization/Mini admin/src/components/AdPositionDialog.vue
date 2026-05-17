<template>
  <div v-if="visible" class="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
    <div class="glass-panel w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-[var(--border-color)]">
        <h3 class="font-semibold text-lg">
          {{ form._id ? '编辑广告位' : '新增广告位' }}
        </h3>
        <button class="btn-soft" @click="handleClose">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto py-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- 页面路径 -->
          <div class="form-group">
            <label class="form-label">
              页面路径
              <span class="text-xs text-[var(--text-sub)] ml-1">选择小程序页面</span>
            </label>
            <select class="form-input" v-model="form.pagePath">
              <option value="">请选择页面路径</option>
              <option v-for="p in pages" :key="p" :value="p">{{ getPageName(p) }}</option>
            </select>
            <p class="text-xs text-[var(--text-sub)] mt-1">{{ form.pagePath ? getPageName(form.pagePath) : '选择要展示广告的小程序页面' }}</p>
          </div>

          <!-- 广告位ID -->
          <div class="form-group">
            <label class="form-label">
              广告位唯一ID
              <span class="text-xs text-[var(--text-sub)] ml-1">创建后不可修改</span>
            </label>
            <input 
              class="form-input" 
              v-model="form.adId" 
              :disabled="Boolean(form._id)" 
              placeholder="例如: home_banner"
            />
            <p class="text-xs text-[var(--text-sub)] mt-1">唯一标识符</p>
          </div>

          <!-- 广告类型 -->
          <div class="form-group">
            <label class="form-label">
              广告类型
              <span class="text-xs text-[var(--text-sub)] ml-1">选择广告展示形式</span>
            </label>
            <select class="form-input" v-model="form.type">
              <option value="">请选择广告类型</option>
              <option value="native_top">原生顶部广告</option>
              <option value="native_bottom">原生底部广告</option>
              <option value="native_video">原生视频广告</option>
              <option value="video">视频广告</option>
              <option value="interstitial">插屏广告</option>
              <option value="rewarded">激励视频广告</option>
            </select>
            <p class="text-xs text-[var(--text-sub)] mt-1">{{ getAdTypeLabel(form.type) || '选择广告形式' }}</p>
          </div>

          <!-- 广告位置 -->
          <div class="form-group">
            <label class="form-label">
              位置
              <span class="text-xs text-[var(--text-sub)] ml-1">页面内位置</span>
            </label>
            <select class="form-input" v-model="form.position">
              <option value="">自动</option>
              <option value="top">顶部</option>
              <option value="middle">中部</option>
              <option value="bottom">底部</option>
            </select>
            <p class="text-xs text-[var(--text-sub)] mt-1">
              {{ form.position === 'top' ? '顶部' : form.position === 'middle' ? '中部' : form.position === 'bottom' ? '底部' : '自动选择' }}
            </p>
          </div>

          <!-- 滚动阈值 -->
          <div class="form-group" v-if="form.type === 'native_top'">
            <label class="form-label">
              滚动阈值
              <span class="text-xs text-[var(--text-sub)] ml-1">触发显示的像素</span>
            </label>
            <input 
              class="form-input" 
              type="number" 
              v-model.number="form.scrollThreshold" 
              placeholder="默认 200"
            />
            <p class="text-xs text-[var(--text-sub)] mt-1">滚动多少像素后显示</p>
          </div>

          <!-- 状态 -->
          <div class="form-group">
            <label class="form-label">
              状态
              <span class="text-xs text-[var(--text-sub)] ml-1">是否生效</span>
            </label>
            <select class="form-input" v-model="form.isEnable">
              <option :value="true">开启</option>
              <option :value="false">关闭</option>
            </select>
            <p class="text-xs text-[var(--text-sub)] mt-1">控制广告位是否生效</p>
          </div>

          <!-- 广告单元ID -->
          <div class="form-group md:col-span-2">
            <label class="form-label">
              广告单元ID (adUnitId)
              <span class="text-xs text-[var(--text-sub)] ml-1">从已配置列表选择或手动输入</span>
            </label>
            <div class="flex gap-2">
              <select class="form-input flex-1" v-model="selectedAdUnitId" @change="applySelectedAdUnit">
                <option value="">从配置中选择</option>
                <option v-for="u in adUnits" :key="u._id" :value="u.adUnitId">
                  {{ u.name }}（{{ u.adUnitId }}）
                </option>
              </select>
              <button class="btn-soft" @click="openAdUnitDialog">管理广告ID</button>
            </div>
            <input 
              class="form-input mt-2" 
              v-model="form.adUnitId" 
              placeholder="或直接输入 adunit-xxxxxxxxxxxxxxxx"
            />
            <p class="text-xs mt-1" :class="validAdUnitId ? 'text-green-500' : 'text-[var(--text-sub)]'">
              {{ validAdUnitId ? '✓ 格式正确' : '需匹配 adunit-16位十六进制' }}
            </p>
          </div>
        </div>

        <!-- 提示 -->
        <div class="mt-6 p-4 bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-xl">
          <h4 class="text-sm font-medium mb-2">💡 配置说明</h4>
          <ul class="text-xs text-[var(--text-sub)] space-y-1">
            <li>• 广告位ID：唯一标识，创建后不可修改</li>
            <li>• adUnitId：从微信公众平台广告管理后台获取</li>
            <li>• 建议先在"管理广告ID"中添加配置</li>
          </ul>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
        <button class="btn-soft" @click="handleClose">取消</button>
        <button class="btn-primary" @click="handleSave" :disabled="!isFormValid">
          {{ form._id ? '更新' : '创建' }}
        </button>
      </div>
    </div>
  </div>

  <!-- 嵌套的广告单元配置弹窗 -->
  <AdUnitConfigDialog :visible="showAdUnitDialog" @close="showAdUnitDialog=false" @pick="handlePickAdUnit" />
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { callCloudFunction } from '../utils/cloudbase'
import AdUnitConfigDialog from './AdUnitConfigDialog.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  pages: { type: Array, default: () => [] },
  editItem: { type: Object, default: null }
})

const emit = defineEmits(['close', 'save'])

const showAdUnitDialog = ref(false)
const adUnits = ref([])
const selectedAdUnitId = ref('')

const form = ref({
  _id: '',
  pagePath: '',
  adId: '',
  type: '',
  position: '',
  adUnitId: '',
  isEnable: true,
  weight: 0,
  scrollThreshold: 0,
  startTime: '',
  endTime: '',
  meta: { materialUrl: '' }
})

const ADUNIT_RE = /^adunit-[0-9a-fA-F]{16}$/

const validAdUnitId = computed(() => ADUNIT_RE.test(form.value.adUnitId || ''))

const isFormValid = computed(() => {
  return form.value.pagePath && form.value.adId && form.value.type && validAdUnitId.value
})

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

function getAdTypeLabel(type) {
  const labels = {
    'native_top': '原生顶部广告',
    'native_bottom': '原生底部广告',
    'native_video': '原生视频广告',
    'video': '视频广告',
    'interstitial': '插屏广告',
    'rewarded': '激励视频广告'
  }
  return labels[type] || ''
}

watch(() => props.visible, async (val) => {
  if (val) {
    if (props.editItem) {
      form.value = { ...props.editItem }
    } else {
      resetForm()
    }
    await loadAdUnits()
  }
})

function resetForm() {
  form.value = {
    _id: '',
    pagePath: props.pages[0] || '',
    adId: '',
    type: '',
    position: '',
    adUnitId: '',
    isEnable: true,
    weight: 0,
    scrollThreshold: 0,
    startTime: '',
    endTime: '',
    meta: { materialUrl: '' }
  }
  selectedAdUnitId.value = ''
}

async function loadAdUnits() {
  try {
    const res = await callCloudFunction('adConfigManager', { action: 'adUnit:list' })
    adUnits.value = Array.isArray(res?.data) ? res.data : []
  } catch (err) {
    console.error('加载广告单元失败', err)
  }
}

function applySelectedAdUnit() {
  if (selectedAdUnitId.value) {
    form.value.adUnitId = selectedAdUnitId.value
  }
}

function openAdUnitDialog() {
  showAdUnitDialog.value = true
}

function handlePickAdUnit(unit) {
  form.value.adUnitId = unit.adUnitId
  selectedAdUnitId.value = unit.adUnitId
  showAdUnitDialog.value = false
}

function handleClose() {
  emit('close')
}

function handleSave() {
  if (!isFormValid.value) return
  emit('save', { ...form.value })
}
</script>
