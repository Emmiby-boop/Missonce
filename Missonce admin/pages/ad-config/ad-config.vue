<template>
  <view class="page-container ad-config-page">
    <!-- Tab 切换 -->
    <view class="tab-bar">
      <view class="tab-item" :class="{ 'tab-item--active': activeTab === 'unit' }" @tap="onTabChange('unit')">广告单元</view>
      <view class="tab-item" :class="{ 'tab-item--active': activeTab === 'position' }" @tap="onTabChange('position')">广告位</view>
    </view>

    <!-- ==================== 广告单元 Tab ==================== -->
    <block v-if="activeTab === 'unit'">
      <!-- 搜索 + 类型筛选 -->
      <view class="toolbar">
        <view class="search-box">
          <mc-icon class="search-icon" :path="icons.search" color="#8C8CA1" :size="32" />
          <input class="search-input" :value="keyword" placeholder="搜索名称" @input="onUnitSearch" confirm-type="search" />
        </view>
        <picker class="filter-picker" mode="selector" :range="unitTypeFilterOptions" range-key="label" :value="unitTypeFilterIndex" @change="onUnitTypeFilterChange">
          <view class="picker-display">{{ unitTypeFilterOptions[unitTypeFilterIndex].label }}</view>
        </picker>
      </view>

      <!-- 加载骨架 -->
      <block v-if="loading">
        <view class="card unit-card" v-for="n in 3" :key="n">
          <view class="skeleton" style="height: 36rpx; width: 50%; margin-bottom: 16rpx;" />
          <view class="skeleton" style="height: 24rpx; width: 70%; margin-bottom: 12rpx;" />
          <view class="skeleton" style="height: 24rpx; width: 40%;" />
        </view>
      </block>

      <!-- 错误状态 -->
      <mc-error v-else-if="unitLoadError && !unitList.length" :text="unitErrorMsg || '加载失败，请稍后重试'">
        <mc-btn type="ghost" size="sm" @click="retryLoadUnits">重试</mc-btn>
      </mc-error>

      <!-- 广告单元列表 -->
      <block v-else-if="unitList.length > 0">
        <view class="card unit-card" v-for="u in unitList" :key="u._id">
          <view class="unit-card__head">
            <text class="unit-card__name text-ellipsis">{{ u.name }}</text>
            <view class="badge badge--purple">{{ u.typeLabel }}</view>
          </view>
          <view class="unit-card__id text-ellipsis">{{ u.adUnitId }}</view>
          <view class="unit-card__notes text-ellipsis" v-if="u.notes">{{ u.notes }}</view>
          <view class="unit-card__footer">
            <view class="edit-btn" @tap="onEditUnit(u)">
              <mc-icon class="edit-btn__icon" :path="icons.editGreen" color="#06AD56" :size="30" />
              <text class="edit-btn__text">编辑</text>
            </view>
          </view>
        </view>
      </block>

      <!-- 空状态 -->
      <mc-empty v-else text="暂无广告单元，点击下方按钮添加">
        <mc-btn type="primary" size="sm" pill @click="onAddUnit">添加广告单元</mc-btn>
      </mc-empty>
    </block>

    <!-- ==================== 广告位 Tab ==================== -->
    <block v-else>
      <!-- 页面选择（横向按钮组，按页面管理广告位） -->
      <scroll-view class="page-chips" scroll-x enhanced :show-scrollbar="false">
        <view
          v-for="(p, idx) in pagePaths"
          :key="p.path"
          class="page-chip"
          :class="{ 'page-chip--active': selectedPagePath === p.path }"
          @tap="onPageChipTap(p.path, idx)"
        >{{ p.label }}</view>
      </scroll-view>

      <!-- 加载骨架 -->
      <block v-if="loading">
        <view class="card pos-card" v-for="n in 2" :key="n">
          <view class="skeleton" style="height: 36rpx; width: 60%; margin-bottom: 16rpx;" />
          <view class="skeleton" style="height: 24rpx; width: 80%; margin-bottom: 12rpx;" />
          <view class="skeleton" style="height: 24rpx; width: 50%;" />
        </view>
      </block>

      <!-- 错误状态 -->
      <mc-error v-else-if="positionLoadError && !positionList.length" :text="positionErrorMsg || '加载失败，请稍后重试'">
        <mc-btn type="ghost" size="sm" @click="retryLoadPositions">重试</mc-btn>
      </mc-error>

      <!-- 广告位列表 -->
      <block v-else-if="positionList.length > 0">
        <view class="card pos-card" v-for="p in positionList" :key="p._id">
          <view class="pos-card__head">
            <view class="pos-card__head-left">
              <view class="badge badge--blue">{{ p.pageLabel }}</view>
              <text class="pos-card__adid text-ellipsis">{{ p.adId }}</text>
            </view>
            <view class="toggle" :class="{ 'toggle--on': p.isEnable }" @tap="onTogglePosition(p)">
              <view class="toggle__knob" />
            </view>
          </view>

          <view class="pos-card__info">
            <view class="pos-info-row">
              <text class="pos-info-label">类型</text>
              <view class="badge badge--purple">{{ p.typeLabel }}</view>
            </view>
            <view class="pos-info-row">
              <text class="pos-info-label">位置</text>
              <text class="pos-info-value">{{ p.positionLabel }}</text>
            </view>
            <view class="pos-info-row">
              <text class="pos-info-label">单元ID</text>
              <text class="pos-info-value pos-info-value--mono text-ellipsis">{{ p.adUnitId }}</text>
            </view>
          </view>

          <view class="pos-card__footer">
            <view class="edit-btn" @tap="onEditPosition(p)">
              <mc-icon class="edit-btn__icon" :path="icons.editGreen" color="#06AD56" :size="30" />
              <text class="edit-btn__text">编辑</text>
            </view>
          </view>
        </view>
      </block>

      <!-- 空状态 -->
      <mc-empty v-else :text="selectedPagePath ? '该页面暂无广告位' : '请选择页面'">
        <mc-btn v-if="selectedPagePath" type="primary" size="sm" pill @click="onAddPosition">添加广告位</mc-btn>
      </mc-empty>
    </block>

    <!-- FAB -->
    <view class="fab" @tap="onFabTap">
      <mc-icon class="fab-icon" :path="icons.plus" color="#FFFFFF" :size="44" />
    </view>

    <!-- ==================== 广告单元弹层 ==================== -->
    <view class="modal-mask" v-if="unitModalVisible" @tap="closeModal" @touchmove.stop>
      <view class="modal-sheet" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">{{ editing ? '编辑广告单元' : '新建广告单元' }}</text>
          <view class="modal-close" @tap="closeModal">
            <mc-icon class="modal-close-icon" :path="icons.x" color="#8C8CA1" :size="36" />
          </view>
        </view>

        <scroll-view class="modal-body" scroll-y enhanced :show-scrollbar="false">
          <view class="input-group">
            <text class="input-label">名称<text class="req-star">*</text></text>
            <input class="input" :value="unitForm.name" placeholder="例如：首页顶部原生广告" @input="onUnitFormNameInput" :adjust-position="true" cursor-spacing="20" />
          </view>

          <view class="input-group">
            <text class="input-label">adUnitId<text class="req-star">*</text></text>
            <input class="input" :value="unitForm.adUnitId" placeholder="adunit-xxxxxxxxxxxxxxxx" @input="onUnitFormAdUnitIdInput" :adjust-position="true" cursor-spacing="20" />
            <text class="form-hint" :class="{ 'form-hint--ok': unitAdUnitIdValid }">{{ unitAdUnitIdValid ? '✓ 格式正确' : '需匹配 adunit-16位十六进制' }}</text>
          </view>

          <view class="input-group">
            <text class="input-label">类型</text>
            <picker mode="selector" :range="adUnitTypes" range-key="label" :value="unitFormTypeIndex" @change="onUnitFormTypeChange">
              <view class="picker-display">{{ adUnitTypes[unitFormTypeIndex].label }}</view>
            </picker>
          </view>

          <view class="input-group">
            <text class="input-label">备注</text>
            <textarea class="input textarea" :value="unitForm.notes" placeholder="用途说明、页面等" @input="onUnitFormNotesInput" :adjust-position="true" cursor-spacing="20" />
          </view>

          <view class="del-btn" v-if="editing" @tap="onDeleteUnit(editing)">
            <mc-icon class="del-btn__icon" :path="icons.trash" color="#FA5151" :size="32" />
            <text>删除此广告单元</text>
          </view>
        </scroll-view>

        <view class="modal-footer">
          <mc-btn type="default" @click="closeModal">取消</mc-btn>
          <mc-btn type="primary" :loading="saving" :disabled="saving" @click="onSaveUnit">{{ saving ? '保存中…' : '保存' }}</mc-btn>
        </view>
      </view>
    </view>

    <!-- ==================== 广告位弹层 ==================== -->
    <view class="modal-mask" v-if="positionModalVisible" @tap="closeModal" @touchmove.stop>
      <view class="modal-sheet" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">{{ editingPosition ? '编辑广告位' : '新建广告位' }}</text>
          <view class="modal-close" @tap="closeModal">
            <mc-icon class="modal-close-icon" :path="icons.x" color="#8C8CA1" :size="36" />
          </view>
        </view>

        <scroll-view class="modal-body" scroll-y enhanced :show-scrollbar="false">
          <!-- 页面路径 -->
          <view class="input-group">
            <text class="input-label">页面路径<text class="req-star">*</text></text>
            <picker mode="selector" :range="pagePaths" range-key="label" :value="positionFormPagePathIndex" @change="onPositionFormPagePathChange">
              <view class="picker-display">{{ pagePaths[positionFormPagePathIndex].label }}</view>
            </picker>
          </view>

          <!-- 广告位ID -->
          <view class="input-group">
            <text class="input-label">广告位ID<text class="req-star">*</text></text>
            <input class="input" :value="positionForm.adId" placeholder="例如: home_banner" @input="onPositionFormAdIdInput" :adjust-position="true" cursor-spacing="20" :disabled="editingPosition ? true : false" />
          </view>

          <!-- 广告类型 -->
          <view class="input-group">
            <text class="input-label">广告类型<text class="req-star">*</text></text>
            <picker mode="selector" :range="positionTypeOptions" range-key="label" :value="positionFormTypeIndex" @change="onPositionFormTypeChange">
              <view class="picker-display">{{ positionTypeOptions[positionFormTypeIndex].label }}</view>
            </picker>
          </view>

          <!-- 广告位置 -->
          <view class="input-group">
            <text class="input-label">位置</text>
            <picker mode="selector" :range="adPositions" range-key="label" :value="positionFormPositionIndex" @change="onPositionFormPositionChange">
              <view class="picker-display">{{ adPositions[positionFormPositionIndex].label }}</view>
            </picker>
          </view>

          <!-- 滚动阈值（仅 native_top） -->
          <view class="input-group" v-if="positionForm.type === 'native_top'">
            <text class="input-label">滚动阈值</text>
            <input class="input" type="number" :value="positionForm.scrollThreshold" placeholder="默认 200" @input="onPositionFormScrollThresholdInput" :adjust-position="true" cursor-spacing="20" />
          </view>

          <!-- 广告单元ID -->
          <view class="input-group">
            <text class="input-label">广告单元ID<text class="req-star">*</text></text>
            <picker mode="selector" :range="adUnitOptions" range-key="name" :value="positionFormAdUnitIndex" @change="onPositionFormAdUnitChange">
              <view class="picker-display">{{ adUnitOptions[positionFormAdUnitIndex].name }}</view>
            </picker>
            <input class="input input--mt" :value="positionForm.adUnitId" placeholder="或直接输入 adunit-xxxxxxxxxxxxxxxx" @input="onPositionFormAdUnitIdInput" :adjust-position="true" cursor-spacing="20" />
            <text class="form-hint" :class="{ 'form-hint--ok': positionAdUnitIdValid }">{{ positionAdUnitIdValid ? '✓ 格式正确' : '需匹配 adunit-16位十六进制' }}</text>
          </view>

          <!-- 状态 -->
          <view class="input-group">
            <text class="input-label">状态</text>
            <view class="toggle-row">
              <text class="toggle-label">{{ positionForm.isEnable ? '开启' : '关闭' }}</text>
              <view class="toggle" :class="{ 'toggle--on': positionForm.isEnable }" @tap="onPositionFormEnableToggle">
                <view class="toggle__knob" />
              </view>
            </view>
          </view>

          <!-- 权重 -->
          <view class="input-group">
            <text class="input-label">权重</text>
            <input class="input" type="number" :value="positionForm.weight" placeholder="0" @input="onPositionFormWeightInput" :adjust-position="true" cursor-spacing="20" />
          </view>

          <!-- 开始时间 -->
          <view class="input-group">
            <text class="input-label">开始时间（可选）</text>
            <input class="input" :value="positionForm.startTime" placeholder="YYYY-MM-DD HH:mm" @input="onPositionFormStartTimeInput" :adjust-position="true" cursor-spacing="20" />
          </view>

          <!-- 结束时间 -->
          <view class="input-group">
            <text class="input-label">结束时间（可选）</text>
            <input class="input" :value="positionForm.endTime" placeholder="YYYY-MM-DD HH:mm" @input="onPositionFormEndTimeInput" :adjust-position="true" cursor-spacing="20" />
          </view>

          <!-- 素材URL -->
          <view class="input-group">
            <text class="input-label">素材URL（可选）</text>
            <input class="input" :value="positionForm.materialUrl" placeholder="meta.materialUrl" @input="onPositionFormMaterialUrlInput" :adjust-position="true" cursor-spacing="20" />
          </view>

          <!-- 配置说明 -->
          <view class="config-tip">
            <text class="config-tip__title">配置说明</text>
            <text class="config-tip__item">• 广告位ID：唯一标识，创建后不可修改</text>
            <text class="config-tip__item">• adUnitId：从微信公众平台广告管理后台获取</text>
            <text class="config-tip__item">• 建议先在"广告单元"Tab中添加配置</text>
          </view>

          <view class="del-btn" v-if="editingPosition" @tap="onDeletePosition(editingPosition)">
            <mc-icon class="del-btn__icon" :path="icons.trash" color="#FA5151" :size="32" />
            <text>删除此广告位</text>
          </view>
        </scroll-view>

        <view class="modal-footer">
          <mc-btn type="default" @click="closeModal">取消</mc-btn>
          <mc-btn type="primary" :loading="saving" :disabled="saving" @click="onSavePosition">{{ saving ? '保存中…' : '保存' }}</mc-btn>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import api from '../../utils/api'
import logger from '../../utils/logger'
import { toast, showLoading, hideLoading, confirm, debounce } from '../../utils/format'
import cache from '../../utils/cache'

const CACHE_KEY_UNITS = 'cache:ad-config:units'
const CACHE_KEY_POSITIONS = 'cache:ad-config:positions'

function unitsCacheKey(keyword, typeFilter) {
  return CACHE_KEY_UNITS + ':' + (keyword || '') + ':' + (typeFilter || 'all')
}
function positionsCacheKey(pagePath) {
  return CACHE_KEY_POSITIONS + ':' + (pagePath || 'all')
}

const AD_UNIT_TYPES = [
  { value: '', label: '未指定' },
  { value: 'native_top', label: '原生顶部广告' },
  { value: 'native_bottom', label: '原生底部广告' },
  { value: 'native_video', label: '原生视频广告' },
  { value: 'video', label: '视频广告' },
  { value: 'interstitial', label: '插屏广告' },
  { value: 'rewarded', label: '激励视频广告' },
]

const AD_POSITIONS = [
  { value: '', label: '自动' },
  { value: 'top', label: '顶部' },
  { value: 'middle', label: '中部' },
  { value: 'bottom', label: '底部' },
]

const PAGE_PATHS = [
  { path: '/pages/index/index', label: '首页' },
  { path: '/pages/wallpaper/wallpaper', label: '壁纸页' },
  { path: '/pages/profile/profile', label: '个人中心' },
  { path: '/subpackages/daily-picks/daily-picks', label: '每日精选' },
  { path: '/subpackages/search/search', label: '搜索' },
  { path: '/subpackages/preview/preview', label: '头像预览' },
  { path: '/subpackages/wallpaper-preview/wallpaper-preview', label: '壁纸预览' },
  { path: '/subpackages/resource-list/resource-list', label: '资源列表' },
  { path: '/subpackages/inspiration-writer/inspiration-writer', label: '灵感文案' },
  { path: '/subpackages/points/points', label: '积分' },
  { path: '/subpackages/profile-edit/profile-edit', label: '资料编辑' },
  { path: '/subpackages/favorites/favorites', label: '收藏' },
]

const ADUNIT_RE = /^adunit-[0-9a-fA-F]{16}$/

const UNIT_TYPE_FILTER_OPTIONS = [{ value: '', label: '全部类型' }].concat(AD_UNIT_TYPES.slice(1))
const POSITION_TYPE_OPTIONS = [{ value: '', label: '请选择广告类型' }].concat(AD_UNIT_TYPES.slice(1))

function typeLabel(type) {
  const t = AD_UNIT_TYPES.find(function (o) { return o.value === type })
  return t ? t.label : (type || '—')
}

function positionLabel(pos) {
  const p = AD_POSITIONS.find(function (o) { return o.value === pos })
  return p ? p.label : '自动'
}

function pageLabel(path) {
  const p = PAGE_PATHS.find(function (o) { return o.path === path })
  return p ? p.label : (path || '—')
}

export default {
  data() {
    return {
      loading: true,
      activeTab: 'unit',

      unitList: [],
      keyword: '',
      typeFilter: '',
      unitTypeFilterIndex: 0,
      unitTypeFilterOptions: UNIT_TYPE_FILTER_OPTIONS,
      unitLoadError: false,
      unitErrorMsg: '',

      positionList: [],
      positionLoadError: false,
      positionErrorMsg: '',
      selectedPagePath: '',
      selectedPagePathIndex: 0,
      pagePaths: PAGE_PATHS,

      unitModalVisible: false,
      editing: null,
      unitForm: { name: '', adUnitId: '', type: '', notes: '' },
      unitFormTypeIndex: 0,
      unitAdUnitIdValid: false,

      positionModalVisible: false,
      editingPosition: null,
      positionForm: {
        pagePath: '',
        adId: '',
        type: '',
        position: '',
        adUnitId: '',
        isEnable: true,
        weight: 0,
        scrollThreshold: 200,
        startTime: '',
        endTime: '',
        materialUrl: '',
      },
      positionFormTypeIndex: 0,
      positionFormPositionIndex: 0,
      positionFormPagePathIndex: 0,
      positionFormAdUnitIndex: 0,
      positionAdUnitIdValid: false,

      saving: false,
      adUnitTypes: AD_UNIT_TYPES,
      adPositions: AD_POSITIONS,
      positionTypeOptions: POSITION_TYPE_OPTIONS,
      adUnitOptions: [{ _id: '', name: '从配置中选择', adUnitId: '' }],

      icons: {
        plus: '<path d="M12 5v14M5 12h14"/>',
        x: '<path d="M18 6 6 18M6 6l12 12"/>',
        editGreen: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
        trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
        search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
        alertCircle: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
      },
    }
  },

  onLoad() {
    this._debouncedLoadUnits = debounce(() => this.loadUnits(false), 300)
    const defaultPath = PAGE_PATHS[0] ? PAGE_PATHS[0].path : ''
    this.selectedPagePath = defaultPath
    this.selectedPagePathIndex = 0

    const unitKey = unitsCacheKey(this.keyword, this.typeFilter)
    const cachedUnits = cache.getCachedStale(unitKey)
    if (cachedUnits) {
      this.unitList = cachedUnits.list || []
      this.adUnitOptions = cachedUnits.adUnitOptions || [{ _id: '', name: '从配置中选择', adUnitId: '' }]
      this.loading = false
      this.unitLoadError = false
    }
    const positionKey = positionsCacheKey(defaultPath)
    const cachedPositions = cache.getCachedStale(positionKey)
    if (cachedPositions) {
      this.positionList = cachedPositions.list || []
      this.loading = false
      this.positionLoadError = false
    }
    if (cache.isStale(unitKey)) this.loadUnits(!cachedUnits)
    if (cache.isStale(positionKey)) this.loadPositions(!cachedPositions)
  },

  onPullDownRefresh() {
    const p = this.activeTab === 'unit' ? this.loadUnits() : this.loadPositions()
    if (p && typeof p.finally === 'function') {
      p.finally(() => uni.stopPullDownRefresh())
    } else {
      uni.stopPullDownRefresh()
    }
  },

  methods: {
    noop() {},

    onTabChange(tab) {
      this.activeTab = tab
      this.loading = false
    },

    onFabTap() {
      if (this.activeTab === 'unit') this.onAddUnit()
      else this.onAddPosition()
    },

    normalizeList(res) {
      if (!res) return []
      if (Array.isArray(res)) return res
      if (Array.isArray(res.list)) return res.list
      if (res.data && Array.isArray(res.data)) return res.data
      return []
    },

    // ====== 广告单元 ======
    async loadUnits(showSkeleton) {
      const hasCache = !!this.unitList && this.unitList.length > 0
      const shouldShowSkeleton = showSkeleton !== false
      if (shouldShowSkeleton) { this.loading = true; this.unitLoadError = false }
      try {
        const res = await api.getAdUnits({ keyword: this.keyword, type: this.typeFilter })
        const items = this.normalizeList(res)
        const list = items.map((u) => this.formatUnit(u))
        const adUnitOptions = this.buildAdUnitOptions(items)
        cache.setCached(unitsCacheKey(this.keyword, this.typeFilter), { list, adUnitOptions })
        this.unitList = list
        this.adUnitOptions = adUnitOptions
        this.loading = false
      } catch (err) {
        logger.error('[ad-config] 加载广告单元失败', err)
        if (shouldShowSkeleton) {
          this.loading = false
          this.unitList = []
          this.unitLoadError = true
          this.unitErrorMsg = err.message || '加载失败，请稍后重试'
          toast('加载失败')
        } else if (!hasCache) {
          this.loading = false
          this.unitLoadError = true
          this.unitErrorMsg = err.message || '加载失败，请稍后重试'
        }
      }
    },

    retryLoadUnits() {
      this.loadUnits()
    },

    formatUnit(u) {
      const type = u.type || ''
      return {
        _id: u._id || u.id,
        name: u.name || '未命名',
        adUnitId: u.adUnitId || '',
        type,
        typeLabel: typeLabel(type),
        notes: u.notes || '',
      }
    },

    buildAdUnitOptions(items) {
      const base = [{ _id: '', name: '从配置中选择', adUnitId: '' }]
      const opts = items.map((u) => ({
        _id: u._id || u.id,
        name: (u.name || '未命名') + '（' + (u.adUnitId || '') + '）',
        adUnitId: u.adUnitId || '',
      }))
      return base.concat(opts)
    },

    onUnitSearch(e) {
      this.keyword = e.detail.value
      this._debouncedLoadUnits()
    },

    onUnitTypeFilterChange(e) {
      const idx = Number(e.detail.value)
      const item = this.unitTypeFilterOptions[idx]
      this.unitTypeFilterIndex = idx
      this.typeFilter = item.value
      this.loadUnits(false)
    },

    onAddUnit() {
      this.unitModalVisible = true
      this.editing = null
      this.unitFormDirty = false
      this.unitForm = { name: '', adUnitId: '', type: '', notes: '' }
      this.unitFormTypeIndex = 0
      this.unitAdUnitIdValid = false
    },

    onEditUnit(u) {
      const typeIdx = AD_UNIT_TYPES.findIndex((o) => o.value === (u.type || ''))
      this.unitModalVisible = true
      this.editing = u
      this.unitFormDirty = false
      this.unitForm = {
        name: u.name,
        adUnitId: u.adUnitId,
        type: u.type || '',
        notes: u.notes || '',
      }
      this.unitFormTypeIndex = typeIdx >= 0 ? typeIdx : 0
      this.unitAdUnitIdValid = ADUNIT_RE.test(u.adUnitId || '')
    },

    async onDeleteUnit(u) {
      const ok = await confirm('确定删除「' + u.name + '」广告单元？')
      if (!ok) return
      showLoading('删除中…')
      try {
        await api.manageAd('adUnit:delete', { id: u._id })
        hideLoading()
        toast('删除成功', 'success')
        this.unitModalVisible = false
        this.editing = null
        this.unitFormDirty = false
        this.loadUnits(false)
      } catch (err) {
        logger.error('[ad-config] 删除广告单元失败', err)
        hideLoading()
        toast('删除失败')
      }
    },

    onUnitFormNameInput(e) {
      this.unitForm.name = e.detail.value
      this.unitFormDirty = true
    },

    onUnitFormAdUnitIdInput(e) {
      const val = e.detail.value
      this.unitForm.adUnitId = val
      this.unitAdUnitIdValid = ADUNIT_RE.test(val)
      this.unitFormDirty = true
    },

    onUnitFormTypeChange(e) {
      const idx = Number(e.detail.value)
      const item = AD_UNIT_TYPES[idx]
      this.unitFormTypeIndex = idx
      this.unitForm.type = item.value
      this.unitFormDirty = true
    },

    onUnitFormNotesInput(e) {
      this.unitForm.notes = e.detail.value
      this.unitFormDirty = true
    },

    async onSaveUnit() {
      const { name, adUnitId, type, notes } = this.unitForm
      if (!name.trim()) { toast('请输入名称'); return }
      if (!adUnitId.trim()) { toast('请输入广告单元ID'); return }
      if (!ADUNIT_RE.test(adUnitId.trim())) { toast('adUnitId 格式不正确'); return }
      this.saving = true
      showLoading('保存中…')
      try {
        const payload = { name: name.trim(), adUnitId: adUnitId.trim(), type, notes: notes || '' }
        if (this.editing) {
          await api.manageAd('adUnit:update', { id: this.editing._id, updates: payload })
        } else {
          await api.manageAd('adUnit:add', payload)
        }
        hideLoading()
        toast('保存成功', 'success')
        this.unitModalVisible = false
        this.editing = null
        this.saving = false
        this.unitFormDirty = false
        this.loadUnits(false)
      } catch (err) {
        logger.error('[ad-config] 保存广告单元失败', err)
        hideLoading()
        this.saving = false
        toast('保存失败')
      }
    },

    // ====== 广告位 ======
    async loadPositions(showSkeleton) {
      const pagePath = this.selectedPagePath
      if (!pagePath) {
        this.positionList = []
        return
      }
      const hasCache = !!this.positionList && this.positionList.length > 0
      const shouldShowSkeleton = showSkeleton !== false
      if (shouldShowSkeleton) { this.loading = true; this.positionLoadError = false }
      try {
        const res = await api.getAdConfigs({ pagePath })
        const items = this.normalizeList(res)
        const list = items.map((p) => this.formatPosition(p))
        cache.setCached(positionsCacheKey(pagePath), { list })
        this.positionList = list
        this.loading = false
      } catch (err) {
        logger.error('[ad-config] 加载广告位失败', err)
        if (shouldShowSkeleton) {
          this.loading = false
          this.positionList = []
          this.positionLoadError = true
          this.positionErrorMsg = err.message || '加载失败，请稍后重试'
          toast('加载失败')
        } else if (!hasCache) {
          this.loading = false
          this.positionLoadError = true
          this.positionErrorMsg = err.message || '加载失败，请稍后重试'
        }
      }
    },

    retryLoadPositions() {
      this.loadPositions()
    },

    formatPosition(p) {
      const type = p.type || ''
      const position = p.position || ''
      return {
        _id: p._id || p.id,
        pagePath: p.pagePath || '',
        pageLabel: pageLabel(p.pagePath || ''),
        adId: p.adId || '',
        type,
        typeLabel: typeLabel(type),
        position,
        positionLabel: positionLabel(position),
        adUnitId: p.adUnitId || '',
        isEnable: p.isEnable !== false,
        weight: p.weight || 0,
        scrollThreshold: p.scrollThreshold || 0,
        startTime: p.startTime || '',
        endTime: p.endTime || '',
        materialUrl: (p.meta && p.meta.materialUrl) || '',
      }
    },

    onPageChipTap(path, idx) {
      if (path === this.selectedPagePath) return
      this.selectedPagePathIndex = idx
      this.selectedPagePath = path
      this.loadPositions()
    },

    onAddPosition() {
      const defaultPage = this.selectedPagePath || (PAGE_PATHS[0] && PAGE_PATHS[0].path) || ''
      const defaultPageIdx = Math.max(0, PAGE_PATHS.findIndex((p) => p.path === defaultPage))
      this.positionModalVisible = true
      this.editingPosition = null
      this.positionFormDirty = false
      this.positionForm = {
        pagePath: defaultPage,
        adId: '',
        type: '',
        position: '',
        adUnitId: '',
        isEnable: true,
        weight: 0,
        scrollThreshold: 200,
        startTime: '',
        endTime: '',
        materialUrl: '',
      }
      this.positionFormTypeIndex = 0
      this.positionFormPositionIndex = 0
      this.positionFormPagePathIndex = defaultPageIdx
      this.positionFormAdUnitIndex = 0
      this.positionAdUnitIdValid = false
    },

    onEditPosition(p) {
      const typeIdx = Math.max(0, POSITION_TYPE_OPTIONS.findIndex((o) => o.value === (p.type || '')))
      const posIdx = Math.max(0, AD_POSITIONS.findIndex((o) => o.value === (p.position || '')))
      const pageIdx = Math.max(0, PAGE_PATHS.findIndex((pp) => pp.path === p.pagePath))
      const adUnitIdx = Math.max(0, this.adUnitOptions.findIndex((o) => o.adUnitId === p.adUnitId))
      this.positionModalVisible = true
      this.editingPosition = p
      this.positionFormDirty = false
      this.positionForm = {
        pagePath: p.pagePath,
        adId: p.adId,
        type: p.type || '',
        position: p.position || '',
        adUnitId: p.adUnitId,
        isEnable: p.isEnable,
        weight: p.weight,
        scrollThreshold: p.scrollThreshold || 200,
        startTime: p.startTime,
        endTime: p.endTime,
        materialUrl: p.materialUrl,
      }
      this.positionFormTypeIndex = typeIdx
      this.positionFormPositionIndex = posIdx
      this.positionFormPagePathIndex = pageIdx
      this.positionFormAdUnitIndex = adUnitIdx
      this.positionAdUnitIdValid = ADUNIT_RE.test(p.adUnitId || '')
    },

    async onDeletePosition(p) {
      const ok = await confirm('确定删除广告位「' + p.adId + '」？')
      if (!ok) return
      showLoading('删除中…')
      try {
        await api.manageAd('delete', { id: p._id })
        hideLoading()
        toast('删除成功', 'success')
        this.positionModalVisible = false
        this.editingPosition = null
        this.positionFormDirty = false
        this.loadPositions(false)
      } catch (err) {
        logger.error('[ad-config] 删除广告位失败', err)
        hideLoading()
        toast('删除失败')
      }
    },

    async onTogglePosition(p) {
      const newState = !p.isEnable
      try {
        await api.manageAd('update', { id: p._id, updates: { isEnable: newState } })
        toast(newState ? '已开启' : '已关闭', 'success')
        this.loadPositions()
      } catch (err) {
        logger.error('[ad-config] 切换广告位状态失败', err)
        toast('操作失败')
      }
    },

    onPositionFormPagePathChange(e) {
      const idx = Number(e.detail.value)
      const item = PAGE_PATHS[idx]
      this.positionFormPagePathIndex = idx
      this.positionForm.pagePath = item.path
      this.positionFormDirty = true
    },

    onPositionFormAdIdInput(e) {
      this.positionForm.adId = e.detail.value
      this.positionFormDirty = true
    },

    onPositionFormTypeChange(e) {
      const idx = Number(e.detail.value)
      const item = POSITION_TYPE_OPTIONS[idx]
      this.positionFormTypeIndex = idx
      this.positionForm.type = item.value
      this.positionFormDirty = true
    },

    onPositionFormPositionChange(e) {
      const idx = Number(e.detail.value)
      const item = AD_POSITIONS[idx]
      this.positionFormPositionIndex = idx
      this.positionForm.position = item.value
      this.positionFormDirty = true
    },

    onPositionFormAdUnitChange(e) {
      const idx = Number(e.detail.value)
      const item = this.adUnitOptions[idx]
      if (item && item.adUnitId) {
        this.positionFormAdUnitIndex = idx
        this.positionForm.adUnitId = item.adUnitId
        this.positionAdUnitIdValid = ADUNIT_RE.test(item.adUnitId)
        this.positionFormDirty = true
      } else {
        this.positionFormAdUnitIndex = idx
        this.positionFormDirty = true
      }
    },

    onPositionFormAdUnitIdInput(e) {
      const val = e.detail.value
      this.positionForm.adUnitId = val
      this.positionAdUnitIdValid = ADUNIT_RE.test(val)
      this.positionFormDirty = true
    },

    onPositionFormWeightInput(e) {
      this.positionForm.weight = Number(e.detail.value) || 0
      this.positionFormDirty = true
    },

    onPositionFormScrollThresholdInput(e) {
      this.positionForm.scrollThreshold = Number(e.detail.value) || 0
      this.positionFormDirty = true
    },

    onPositionFormStartTimeInput(e) {
      this.positionForm.startTime = e.detail.value
      this.positionFormDirty = true
    },

    onPositionFormEndTimeInput(e) {
      this.positionForm.endTime = e.detail.value
      this.positionFormDirty = true
    },

    onPositionFormMaterialUrlInput(e) {
      this.positionForm.materialUrl = e.detail.value
      this.positionFormDirty = true
    },

    onPositionFormEnableToggle() {
      this.positionForm.isEnable = !this.positionForm.isEnable
      this.positionFormDirty = true
    },

    async onSavePosition() {
      const f = this.positionForm
      if (!f.pagePath) { toast('请选择页面路径'); return }
      if (!f.adId.trim()) { toast('请输入广告位ID'); return }
      if (!f.type) { toast('请选择广告类型'); return }
      if (!f.adUnitId.trim()) { toast('请输入广告单元ID'); return }
      if (!ADUNIT_RE.test(f.adUnitId.trim())) { toast('adUnitId 格式不正确'); return }
      this.saving = true
      showLoading('保存中…')
      try {
        const payload = {
          pagePath: f.pagePath,
          adId: f.adId.trim(),
          type: f.type,
          position: f.position,
          adUnitId: f.adUnitId.trim(),
          isEnable: f.isEnable,
          weight: Number(f.weight) || 0,
          scrollThreshold: Number(f.scrollThreshold) || 0,
          startTime: f.startTime || '',
          endTime: f.endTime || '',
          meta: { materialUrl: f.materialUrl || '' },
        }
        if (this.editingPosition) {
          await api.manageAd('update', { id: this.editingPosition._id, updates: payload })
        } else {
          await api.manageAd('create', payload)
        }
        hideLoading()
        toast('保存成功', 'success')
        this.positionModalVisible = false
        this.editingPosition = null
        this.saving = false
        this.positionFormDirty = false
        this.loadPositions(false)
      } catch (err) {
        logger.error('[ad-config] 保存广告位失败', err)
        hideLoading()
        this.saving = false
        toast('保存失败')
      }
    },

    preventBgScroll() {},

    closeModal(force) {
      const dirty = this.unitModalVisible
        ? this.unitFormDirty
        : this.positionFormDirty
      if (!force && dirty) {
        uni.showModal({
          title: '提示',
          content: '有未保存的修改，确定要关闭吗？',
          confirmText: '放弃',
          confirmColor: '#FA5151',
          success: (res) => {
            if (res.confirm) {
              this.unitModalVisible = false
              this.positionModalVisible = false
              this.editing = null
              this.editingPosition = null
              this.saving = false
              this.unitFormDirty = false
              this.positionFormDirty = false
            }
          },
        })
      } else {
        this.unitModalVisible = false
        this.positionModalVisible = false
        this.editing = null
        this.editingPosition = null
        this.saving = false
        this.unitFormDirty = false
        this.positionFormDirty = false
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.ad-config-page {
  padding-bottom: 200rpx;
}

.tab-bar {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  background: var(--bg-card);
  border-radius: var(--r-md);
  padding: 6rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--shadow-card);
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  font-size: 28rpx;
  font-weight: 500;
  color: var(--text-secondary);
  border-radius: var(--r-sm);
  transition: all 0.2s;
}

.tab-item--active {
  background: var(--pri);
  color: #fff;
  font-weight: 600;
}

.toolbar {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
  align-items: center;
}

.search-box {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  background: var(--bg-card);
  border-radius: var(--r-sm);
  padding: 0 24rpx;
  height: 72rpx;
  border: 1rpx solid var(--border);
}

.search-icon {
  width: 32rpx;
  height: 32rpx;
  margin-right: 16rpx;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: var(--text-primary);
}

.filter-picker {
  flex-shrink: 0;
}

.page-chips {
  white-space: nowrap;
  display: block;
  margin-bottom: 24rpx;
  width: 100%;
}

.page-chip {
  display: inline-block;
  vertical-align: middle;
  padding: 0 28rpx;
  height: 68rpx;
  line-height: 68rpx;
  margin-right: 16rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--r-pill);
  font-size: 26rpx;
  color: var(--text-secondary);
  transition: all 0.15s ease;
}

.page-chip--active {
  background: var(--pri);
  border-color: var(--pri);
  color: #fff;
  font-weight: 500;
}

.unit-card {
  padding: 28rpx 32rpx;
  margin-bottom: 20rpx;
}

.unit-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.unit-card__name {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
}

.unit-card__id {
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-top: 12rpx;
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
}

.unit-card__notes {
  font-size: 24rpx;
  color: var(--text-tertiary);
  margin-top: 8rpx;
}

.unit-card__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid var(--divider);
}

.pos-card {
  padding: 28rpx 32rpx;
  margin-bottom: 20rpx;
}

.pos-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.pos-card__head-left {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.pos-card__adid {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--text-primary);
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  flex: 1;
  min-width: 0;
}

.pos-card__info {
  margin-top: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.pos-info-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.pos-info-label {
  font-size: 24rpx;
  color: var(--text-secondary);
  width: 96rpx;
  flex-shrink: 0;
}

.pos-info-value {
  font-size: 24rpx;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
}

.pos-info-value--mono {
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  color: var(--text-secondary);
}

.pos-card__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid var(--divider);
}

.edit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  height: 64rpx;
  padding: 0 36rpx;
  border-radius: 32rpx;
  background: var(--pri-l);
  color: var(--pri-d);
  font-size: 26rpx;
  font-weight: 600;
  box-shadow: 0 2rpx 8rpx rgba(7, 193, 96, 0.14);
  transition: transform 0.15s ease;
}

.edit-btn:active {
  transform: scale(0.95);
}

.edit-btn__icon {
  width: 30rpx;
  height: 30rpx;
}

.edit-btn__text {
  line-height: 1;
}

.del-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  width: 100%;
  margin-top: 40rpx;
  padding: 26rpx 0;
  border-radius: var(--r-sm);
  background: #FFE8E8;
  color: var(--danger);
  font-size: 28rpx;
  font-weight: 600;
  transition: opacity 0.15s ease;
}

.del-btn:active {
  opacity: 0.65;
}

.del-btn__icon {
  width: 32rpx;
  height: 32rpx;
}

.fab-icon {
  width: 44rpx;
  height: 44rpx;
}

.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}

.modal-sheet {
  width: 100%;
  background: var(--bg-card);
  border-radius: 28rpx 28rpx 0 0;
  padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
  animation: slideUp 0.25s ease-out;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
  flex-shrink: 0;
}

.modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  width: 88rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  z-index: 2;
}

.modal-close-icon {
  width: 36rpx;
  height: 36rpx;
}

.modal-body {
  flex: 1;
  min-height: 0;
  max-height: 62vh;
}

.modal-footer {
  display: flex;
  gap: 20rpx;
  margin-top: 24rpx;
  flex-shrink: 0;
}

.modal-footer .btn {
  flex: 1;
}

.req-star {
  color: var(--danger);
  margin-left: 4rpx;
}

.input--mt {
  margin-top: 16rpx;
}

.textarea {
  height: 140rpx;
  padding: 20rpx 28rpx;
  line-height: 1.5;
  box-sizing: border-box;
}

.form-hint {
  font-size: 22rpx;
  color: var(--text-secondary);
  margin-top: 10rpx;
  display: block;
}

.form-hint--ok {
  color: var(--pri);
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
}

.toggle-label {
  font-size: 28rpx;
  color: var(--text-primary);
}

.config-tip {
  background: var(--pri-l);
  border-radius: var(--r-sm);
  padding: 24rpx;
  margin-top: 8rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.config-tip__title {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--pri);
}

.config-tip__item {
  font-size: 22rpx;
  color: var(--text-secondary);
  line-height: 1.6;
}

.empty-state .btn {
  margin: 0 auto;
}
</style>
