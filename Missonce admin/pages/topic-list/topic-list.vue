<template>
  <view class="page-container topic-list-page">
    <!-- 提示栏 -->
    <view class="hint-bar" v-if="!loading && list.length > 0">
      <text class="hint-text">点击卡片编辑 · 长按拖动排序</text>
      <view class="hint-action" @tap="onToggleMultiMode">{{ multiSelect ? '完成' : '批量管理' }}</view>
    </view>

    <!-- 加载骨架 -->
    <view class="topic-grid" v-if="loading">
      <view class="topic-card skeleton-card" v-for="n in 4" :key="n">
        <view class="skeleton skeleton-cover"></view>
        <view class="skeleton-footer">
          <view class="skeleton" style="height: 24rpx; width: 60%;"></view>
          <view class="skeleton" style="height: 20rpx; width: 40%; margin-top: 12rpx;"></view>
        </view>
      </view>
    </view>

    <!-- 错误状态 -->
    <view class="error-state" v-else-if="loadError && !list.length">
      <mc-icon name="alert-circle" :size="80" color="#B8B8C8" />
      <view class="error-state__text">{{ errorMsg || '加载失败，请稍后重试' }}</view>
      <view class="error-state__action">
        <button class="btn btn--ghost btn--sm" @tap="retryLoad">重试</button>
      </view>
    </view>

    <!-- 网格列表 -->
    <view class="topic-grid" :class="multiSelect ? '' : 'nomulti'" v-else-if="list.length > 0">
      <view
        class="topic-card"
        :class="[item.selected ? 'topic-card--selected' : '', item._dragging ? 'topic-card--dragging' : '']"
        v-for="(item, index) in list"
        :key="item._id"
        :data-id="item._id"
        @tap="onTapItem(item)"
        hover-class="topic-card--active"
        :style="{ transform: item._transform }"
      >
        <!-- 封面区域 -->
        <view class="card-cover">
          <image v-if="item.cover" class="cover-img" :src="item.cover" mode="aspectFill" />
          <view v-else class="cover-placeholder">
            <mc-icon name="image" :size="56" color="#B8B8C8" class="cover-placeholder-icon" />
            <text class="cover-placeholder-text">无封面</text>
          </view>
          <view class="cover-overlay"></view>

          <!-- 状态(左上角 · 显示态) + 精选星标 -->
          <view class="card-status-row">
            <view class="card-status" :class="item.status === 'active' ? 'card-status--on' : 'card-status--off'">
              <view class="status-dot"></view>
              <text class="status-text">{{ item.status === 'active' ? '已启用' : '已停用' }}</text>
            </view>
            <mc-icon v-if="item.isFeatured" name="star" :size="36" color="#FFC107" class="featured-star-icon" />
          </view>

          <!-- 角标(顶部居中 · 仅设置了角标才显示) -->
          <view class="card-badge-wrap" v-if="item.badge && item.badge !== 'none'">
            <view class="card-badge" :class="'card-badge--' + item.badge">{{ item.badgeLabel }}</view>
          </view>

          <!-- 推荐图标(显示态) + 勾选框(批量) -->
          <view class="card-top-right">
            <view v-if="item.isRecommended" class="recommend-badge">
              <mc-icon :path="RECOMMEND_PATH" color="#FFFFFF" :size="36" class="recommend-icon" />
            </view>
            <view
              class="card-checkbox"
              :class="item.selected ? 'card-checkbox--on' : ''"
              :data-id="item._id"
              @tap.stop="onToggleSelect(item._id)"
            >
              <mc-icon v-if="item.selected" name="check" :size="24" color="#FFFFFF" class="checkbox-icon" />
            </view>
          </view>

          <!-- 标题 + 标签(底部覆盖) -->
          <view class="cover-bottom">
            <view class="cover-title-row">
              <text class="cover-title">{{ item.title }}</text>
            </view>
            <view class="cover-tags">
              <view class="link-tag" :class="'link-tag--' + item.linkType">{{ item.linkTypeLabel }}</view>
              <view class="filter-tag" v-if="item.linkType === 'resource'">{{ item.filterTypeLabel }}: {{ item.filterValue }}</view>
              <view class="filter-tag text-ellipsis" v-else>{{ item.linkUrl }}</view>
            </view>
          </view>
        </view>

        <!-- 底部信息 + 排序 -->
        <view class="card-footer">
          <view class="footer-meta">
            <view class="sort-chip">排序 {{ item.sort }}</view>
            <text class="footer-desc text-ellipsis">{{ item.description || '暂无描述' }}</text>
          </view>
          <view class="footer-actions">
            <view class="sort-chip">No.{{ item.sort }}</view>
            <view
              class="drag-handle"
              :data-index="index"
              @touchstart.stop="onHandleTouchStart"
              @touchmove.stop="onHandleTouchMove"
              @touchend.stop="onHandleTouchEnd"
            >
              <mc-icon name="drag" :size="32" color="#8C8CA1" class="drag-icon" />
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view class="empty-state" v-else>
      <mc-icon name="image" :size="140" color="#B8B8C8" class="empty-state__icon empty-state__icon--lg" />
      <text class="empty-state__text">暂无专题</text>
      <text class="empty-state__sub">点击下方按钮创建第一个专题</text>
      <view class="empty-state__action">
        <button class="btn btn--primary btn--sm" @tap="onAdd">立即创建</button>
      </view>
    </view>

    <!-- 拖拽全屏遮罩 -->
    <view class="drag-overlay" v-if="dragging" @touchmove.stop="onHandleTouchMove" @touchend.stop="onHandleTouchEnd"></view>

    <!-- FAB 新增按钮 -->
    <view
      class="fab"
      v-if="!loading && list.length > 0 && selectedIds.length === 0 && !multiSelect"
      @tap="onAdd"
    >
      <mc-icon name="plus" :size="44" color="#FFFFFF" class="fab-icon" />
    </view>

    <!-- 批量操作栏 -->
    <view class="batch-bar" v-if="selectedIds.length > 0">
      <view class="batch-left">
        <view class="card-checkbox" :class="allSelected ? 'card-checkbox--on' : ''" @tap.stop="onSelectAll">
          <mc-icon v-if="allSelected" name="check" :size="24" color="#FFFFFF" class="checkbox-icon" />
        </view>
        <text class="batch-count">已选 {{ selectedIds.length }} 项</text>
      </view>
      <view class="batch-right">
        <button class="batch-btn batch-btn--enable" data-status="active" @tap.stop="onBatchStatus('active')">启用</button>
        <button class="batch-btn batch-btn--disable" data-status="inactive" @tap.stop="onBatchStatus('inactive')">停用</button>
        <button class="batch-btn batch-btn--delete" @tap.stop="onBatchDelete">删除</button>
      </view>
    </view>

    <!-- 编辑/新增弹层 -->
    <view class="modal-mask" v-if="modalVisible" @tap="closeModal" @touchmove.stop>
      <view class="modal-sheet" @tap.stop @touchmove.stop>
        <view class="modal-header">
          <text class="modal-title">{{ editing ? '编辑专题' : '新增专题' }}</text>
          <view class="modal-close" @tap.stop="closeModal">
            <mc-icon name="x" :size="32" color="#8C8CA1" class="modal-close-icon" />
          </view>
        </view>

        <scroll-view class="modal-body" scroll-y="true">
          <!-- 标题 -->
          <view class="input-group">
            <text class="input-label">标题 <text class="required">*</text></text>
            <input class="input" :value="form.title" placeholder="例如:二次元专场" @input="onFormTitleInput" :adjust-position="true" cursor-spacing="20" />
          </view>

          <!-- 描述 -->
          <view class="input-group">
            <text class="input-label">描述</text>
            <input class="input" :value="form.description" placeholder="一句话描述（可选）" @input="onFormDescInput" :adjust-position="true" cursor-spacing="20" />
          </view>

          <!-- 封面上传 -->
          <view class="input-group">
            <text class="input-label">封面图</text>
            <view class="cover-picker" @tap.stop="onChooseCover">
              <image v-if="form.coverPreview" class="cover-preview-img" :src="form.coverPreview" mode="aspectFill" />
              <view v-else class="cover-picker-placeholder">
                <mc-icon name="image" :size="52" color="#B8B8C8" class="cover-picker-icon" />
                <text class="cover-picker-text">选择封面</text>
              </view>
            </view>
            <text class="input-hint">建议 16:9 横图</text>
          </view>

          <!-- 跳转类型 -->
          <view class="input-group">
            <text class="input-label">跳转类型</text>
            <view class="chip-list">
              <view
                class="chip"
                :class="form.linkType === item.value ? 'chip--active' : ''"
                v-for="item in linkTypes"
                :key="item.value"
                :data-value="item.value"
                @tap.stop="onFormLinkTypeChange(item.value)"
              >{{ item.label }}</view>
            </view>
          </view>

          <!-- 资源筛选模式 -->
          <block v-if="form.linkType === 'resource'">
            <!-- 素材展示方式 -->
            <view class="input-group">
              <text class="input-label">素材展示方式</text>
              <view class="chip-list">
                <view
                  class="chip"
                  :class="form.sourceType === item.value ? 'chip--active' : ''"
                  v-for="item in sourceTypes"
                  :key="item.value"
                  :data-value="item.value"
                  @tap.stop="onFormSourceTypeChange(item.value)"
                >{{ item.label }}</view>
              </view>
            </view>

            <!-- 自动筛选模式 -->
            <block v-if="form.sourceType === 'filter'">
              <view class="input-group">
                <text class="input-label">筛选类型</text>
                <view class="chip-list">
                  <view
                    class="chip"
                    :class="form.filterType === item.value ? 'chip--active' : ''"
                    v-for="item in filterTypes"
                    :key="item.value"
                    :data-value="item.value"
                    @tap.stop="onFormFilterTypeChange(item.value)"
                  >{{ item.label }}</view>
                </view>
              </view>
              <view class="input-group">
                <text class="input-label">筛选值 <text class="required">*</text></text>
                <picker
                  v-if="filterValueOptions.length > 0"
                  mode="selector"
                  :range="filterValueOptions"
                  :value="filterValueIndex"
                  @change="onFormFilterValueChange"
                >
                  <view class="picker-row">
                    <text class="picker-value" :class="form.filterValue ? '' : 'picker-value--placeholder'">{{ form.filterValue || '请选择' }}</text>
                    <text class="picker-arrow">▾</text>
                  </view>
                </picker>
                <view class="picker-row" v-else>
                  <text class="picker-value picker-value--placeholder">暂无可选项</text>
                </view>
              </view>
            </block>

            <!-- 手动选择模式 -->
            <block v-else>
              <view class="input-group">
                <text class="input-label">资源数量</text>
                <input class="input" type="number" :value="form.resourceCount" placeholder="输入展示数量" @blur="onResourceCountInput" :adjust-position="true" cursor-spacing="20" />
                <text class="input-hint">设置网格展示的资源数量，点击添加素材选择具体资源</text>
              </view>
              <view class="input-group">
                <text class="input-label">已选素材 ({{ form.manualIds.length }})</text>
                <scroll-view class="material-scroll" scroll-x="true">
                  <view class="material-scroll-inner">
                    <block v-for="(id, index) in form.manualIds" :key="index">
                      <view v-if="id && manualResourceMap[id]" class="material-thumb">
                        <image class="material-thumb-img" :src="manualResourceMap[id].cover" mode="aspectFill" />
                        <view class="material-remove" :data-index="index" @tap.stop="onRemoveMaterial(index)">
                          <mc-icon name="x" :size="20" color="#FFFFFF" class="material-remove-icon" />
                        </view>
                      </view>
                    </block>
                    <view class="material-add" @tap.stop="onAddMaterial">
                      <view class="material-add-inner">
                        <mc-icon name="plus" :size="40" color="#B8B8C8" class="material-add-icon" />
                        <text class="material-add-text">添加</text>
                      </view>
                    </view>
                  </view>
                </scroll-view>
              </view>
            </block>

            <!-- 显示列数 -->
            <view class="input-group">
              <text class="input-label">显示列数</text>
              <view class="seg-control">
                <view
                  class="seg-control__btn"
                  :class="form.gridColumns === item ? 'seg-control__btn--active' : ''"
                  v-for="item in gridColumnOptions"
                  :key="item"
                  :data-value="item"
                  @tap.stop="onFormGridColumnsChange(item)"
                >{{ item }}列</view>
              </view>
            </view>
          </block>

          <!-- 小程序页面模式 -->
          <block v-else-if="form.linkType === 'page'">
            <view class="input-group">
              <text class="input-label">常用页面快捷选择</text>
              <view class="chip-list chip-list--wrap">
                <view
                  class="chip chip--sm"
                  :class="form.linkUrl === item.path ? 'chip--active' : ''"
                  v-for="item in pagePresets"
                  :key="item.path"
                  :data-value="item.path"
                  @tap.stop="onFormLinkUrlPreset(item.path)"
                >{{ item.label }}</view>
              </view>
            </view>
            <view class="input-group">
              <text class="input-label">页面路径 <text class="required">*</text></text>
              <input class="input" :value="form.linkUrl" placeholder="例如:/subpackages/daily-picks/daily-picks" @input="onFormLinkUrlInput" :adjust-position="true" cursor-spacing="20" />
              <text class="input-hint">以 / 开头的小程序页面路径</text>
            </view>
          </block>

          <!-- 外部网页模式 -->
          <block v-else>
            <view class="input-group">
              <text class="input-label">网页链接 <text class="required">*</text></text>
              <input class="input" :value="form.linkUrl" placeholder="例如:https://example.com" @input="onFormLinkUrlInput" :adjust-position="true" cursor-spacing="20" />
              <text class="input-hint">以 https:// 开头的外部链接，将在 webview 中打开</text>
            </view>
          </block>

          <!-- 启用状态 -->
          <view class="input-group">
            <text class="input-label">启用状态</text>
            <view class="toggle-row" @tap.stop="onFormStatusToggle">
              <view class="toggle" :class="form.status === 'active' ? 'toggle--on' : ''">
                <view class="toggle__knob"></view>
              </view>
              <text class="toggle-text">{{ form.status === 'active' ? '已启用' : '已停用' }}</text>
            </view>
          </view>

          <!-- 精选 + 推荐 + 角标 -->
          <view class="form-row">
            <view class="input-group form-col">
              <text class="input-label">精选</text>
              <view class="toggle-row" @tap.stop="onFormFeaturedToggle">
                <view class="toggle" :class="form.isFeatured ? 'toggle--on' : ''">
                  <view class="toggle__knob"></view>
                </view>
                <text class="toggle-text">{{ form.isFeatured ? '置顶显示' : '不置顶' }}</text>
              </view>
            </view>
            <view class="input-group form-col">
              <text class="input-label">推荐</text>
              <view class="toggle-row" @tap.stop="onFormRecommendToggle">
                <view class="toggle" :class="form.isRecommended ? 'toggle--on' : ''">
                  <view class="toggle__knob"></view>
                </view>
                <text class="toggle-text">{{ form.isRecommended ? '已推荐' : '不推荐' }}</text>
              </view>
            </view>
          </view>
          <view class="input-group">
            <text class="input-label">角标</text>
            <picker mode="selector" :range="badgeLabels" :value="formBadgeIndex" @change="onFormBadgeChange">
              <view class="picker-row">
                <text class="picker-value">{{ badgeLabels[formBadgeIndex] }}</text>
                <text class="picker-arrow">▾</text>
              </view>
            </picker>
          </view>
          <!-- 删除此专题 -->
          <view class="del-row" v-if="editing" :data-id="editing._id" @tap="onDelete(editing._id)">删除此专题</view>
        </scroll-view>

        <view class="modal-footer">
          <button class="btn btn--default" @tap.stop="closeModal">取消</button>
          <button class="btn btn--primary" @tap.stop="onSave" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
        </view>
      </view>
    </view>

    <!-- 资源选择弹层 -->
    <view class="modal-mask picker-mask" v-if="pickerVisible" @tap="onPickerClose" @touchmove.stop>
      <view class="picker-sheet" @tap.stop @touchmove.stop>
        <view class="picker-header">
          <text class="picker-title">选择素材</text>
          <view class="picker-close" @tap.stop="onPickerClose">
            <mc-icon name="x" :size="32" color="#8C8CA1" class="modal-close-icon" />
          </view>
        </view>
        <view class="picker-search-bar">
          <mc-icon name="search" :size="32" color="#8C8CA1" class="picker-search-icon" />
          <input class="picker-search-input" :value="pickerSearchKey" placeholder="搜索资源标题" confirm-type="search" @input="onPickerSearch" :adjust-position="true" cursor-spacing="20" />
        </view>
        <scroll-view class="picker-body" scroll-y="true" @scrolltolower="onPickerReachBottom">
          <view class="picker-grid" v-if="pickerResources.length > 0">
            <view
              class="picker-item"
              :class="pickerSelected[item._id] ? 'picker-item--selected' : ''"
              v-for="item in pickerResources"
              :key="item._id"
              :data-id="item._id"
              @tap.stop="onPickerToggleItem(item._id)"
            >
              <view class="picker-item-img-wrap">
                <image class="picker-item-img" :src="item.cover" mode="aspectFill" />
                <view v-if="pickerSelected[item._id]" class="picker-item-check">
                  <mc-icon name="check" :size="24" color="#FFFFFF" class="picker-check-icon" />
                </view>
              </view>
              <text class="picker-item-title text-ellipsis">{{ item.title }}</text>
            </view>
          </view>
          <view class="picker-empty" v-else-if="!pickerLoading">
            <text class="picker-empty-text">暂无资源</text>
          </view>
          <view class="picker-loading" v-if="pickerLoading">
            <text class="picker-loading-text">加载中…</text>
          </view>
        </scroll-view>
        <view class="picker-footer">
          <button class="btn btn--default" @tap.stop="onPickerClose">取消</button>
          <button class="btn btn--primary" @tap.stop="onPickerConfirm">确认选择</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import api from '../../utils/api'
import { error as logError, warn as logWarn } from '../../utils/logger'
import { toast, showLoading, hideLoading, confirm } from '../../utils/format'
import { uploadFile, db, cmd } from '../../utils/cloud'
import cache from '../../utils/cache'

const CACHE_KEY_LIST = 'cache:topic-list:list'
const CACHE_KEY_FILTERS = 'cache:topic-list:filters'

const BADGE_OPTIONS = [
  { value: '', label: '无角标' },
  { value: 'hot', label: '热门' },
  { value: 'new', label: '新' },
  { value: 'limited', label: '限时' },
]
const BADGE_LABELS = BADGE_OPTIONS.map((b) => b.label)

const LINK_TYPES = [
  { value: 'resource', label: '资源筛选' },
  { value: 'page', label: '小程序页面' },
  { value: 'webview', label: '外部网页' },
]
const LINK_TYPE_LABELS = {
  resource: '资源筛选',
  page: '小程序页面',
  webview: '外部网页',
}

const FILTER_TYPES = [
  { value: 'tag', label: '按标签' },
  { value: 'category', label: '按分类' },
]
const FILTER_TYPE_LABELS = { tag: '标签', category: '分类' }

const SOURCE_TYPES = [
  { value: 'filter', label: '自动筛选' },
  { value: 'manual', label: '手动选择' },
]

const GRID_COLUMN_OPTIONS = [2, 3, 4]

const PAGE_PRESETS = [
  { path: '/subpackages/daily-picks/daily-picks', label: '每日推荐' },
  { path: '/subpackages/inspiration-writer/inspiration-writer', label: '灵感文案' },
  { path: '/pages/store/store', label: '小辣椒小店' },
  { path: '/subpackages/search/search', label: '搜索' },
  { path: '/subpackages/favorites/favorites', label: '我的收藏' },
  { path: '/subpackages/points/points', label: '积分中心' },
  { path: '/subpackages/avatar-diy/avatar-diy', label: '头像DIY' },
  { path: '/subpackages/notifications/notifications', label: '通知中心' },
]

const RECOMMEND_PATH = '<path d="M7 22V11M2 13v7a2 2 0 0 0 2 2h12.5a2 2 0 0 0 2-1.6l1.4-7A2 2 0 0 0 17.9 11H14a1 1 0 0 1-1-1V5a2 2 0 0 0-4 0M7 11l3-7a1.5 1.5 0 0 0-2.6-1.5L7 6"/>'

function badgeIndexOf(value) {
  const idx = BADGE_OPTIONS.findIndex((b) => b.value === (value || ''))
  return idx >= 0 ? idx : 0
}

function badgeLabelOf(value) {
  const found = BADGE_OPTIONS.find((b) => b.value === (value || ''))
  return found ? found.label : '无角标'
}

export default {
  data() {
    return {
      loading: true,
      list: [],
      loadError: false,
      errorMsg: '',
      modalVisible: false,
      editing: null,
      saving: false,
      multiSelect: false,
      selectedIds: [],
      allSelected: false,
      dragging: false,
      dragIndex: -1,
      dragCurrent: -1,
      categoryOptions: [],
      tagOptions: [],
      filterValueOptions: [],
      filterValueIndex: 0,
      pagePresets: PAGE_PRESETS,
      badgeOptions: BADGE_OPTIONS,
      badgeLabels: BADGE_LABELS,
      linkTypes: LINK_TYPES,
      filterTypes: FILTER_TYPES,
      sourceTypes: SOURCE_TYPES,
      gridColumnOptions: GRID_COLUMN_OPTIONS,
      formBadgeIndex: 0,
      manualResourceMap: {},
      pickerVisible: false,
      pickerResources: [],
      pickerSelected: {},
      pickerSearchKey: '',
      pickerPage: 1,
      pickerHasMore: true,
      pickerLoading: false,
      form: {
        title: '',
        description: '',
        coverFileID: '',
        coverPreview: '',
        linkType: 'resource',
        filterType: 'tag',
        filterValue: '',
        linkUrl: '',
        isFeatured: false,
        isRecommended: false,
        badge: '',
        status: 'active',
        gridColumns: 3,
        sourceType: 'filter',
        manualIds: [],
        resourceCount: 6,
      },
    }
  },

  onLoad() {
    const cachedList = cache.getCachedStale(CACHE_KEY_LIST)
    const cachedFilters = cache.getCachedStale(CACHE_KEY_FILTERS)
    if (cachedList) {
      this.list = cachedList
      this.loading = false
      this.selectedIds = []
      this.allSelected = false
    }
    if (cachedFilters) {
      this.categoryOptions = cachedFilters.categoryOptions || []
      this.tagOptions = cachedFilters.tagOptions || []
      this.updateFilterValueOptions(this.form.filterType, this.form.filterValue)
    }
    const listStale = cache.isStale(CACHE_KEY_LIST)
    const filtersStale = cache.isStale(CACHE_KEY_FILTERS)
    if (listStale) this.loadList(!cachedList)
    if (filtersStale) this.loadFilterOptions()
  },

  onUnload() {
    if (this._pickerSearchTimer) {
      clearTimeout(this._pickerSearchTimer)
      this._pickerSearchTimer = null
    }
  },

  onPullDownRefresh() {
    this.loadList(true).finally(() => uni.stopPullDownRefresh())
  },

  methods: {
    normalizeList(res) {
      if (!res) return []
      if (Array.isArray(res)) return res
      if (Array.isArray(res.list)) return res.list
      if (res.data && Array.isArray(res.data)) return res.data
      return []
    },

    async loadList(showLoading) {
      const hasCache = !!this.list && this.list.length > 0
      const shouldShowLoading = showLoading !== undefined ? showLoading : !hasCache
      if (shouldShowLoading) {
        this.loading = true
        this.loadError = false
      }
      try {
        const res = await api.getTopics({ status: 'all' })
        const items = this.normalizeList(res)
        const list = items.map((t) => {
          const badge = t.badge || ''
          const linkType = t.linkType || 'resource'
          const filterType = t.filterType || 'tag'
          const manualIds = t.resourceIds || t.manualIds || []
          return {
            _id: t._id || t.id,
            title: t.title || '',
            description: t.description || '',
            cover: t.cover || t.coverFileID || '',
            coverFileID: t.coverFileID || '',
            status: t.status || 'active',
            sort: t.sort !== undefined ? t.sort : 0,
            isFeatured: !!t.isFeatured,
            isRecommended: !!t.isRecommended,
            badge,
            badgeIndex: badgeIndexOf(badge),
            badgeLabel: badgeLabelOf(badge),
            linkType,
            linkTypeLabel: LINK_TYPE_LABELS[linkType] || linkType,
            filterType,
            filterTypeLabel: FILTER_TYPE_LABELS[filterType] || filterType,
            filterValue: t.filterValue || '',
            linkUrl: t.linkUrl || '',
            gridColumns: Math.min(4, Math.max(2, t.gridColumns || 3)),
            sourceType: t.sourceType || (t.contentType === 'manual' ? 'manual' : 'filter'),
            manualIds: manualIds.slice(),
            resourceCount: manualIds.length || 6,
            selected: false,
          }
        })
        list.sort((a, b) => a.sort - b.sort)
        cache.setCached(CACHE_KEY_LIST, list)
        this.list = list
        this.loading = false
        this.selectedIds = []
        this.allSelected = false
      } catch (err) {
        logError('[topic-list] 加载失败', err)
        if (shouldShowLoading) {
          this.loading = false
          this.list = []
          this.selectedIds = []
          this.allSelected = false
          this.loadError = true
          this.errorMsg = err.message || '加载失败，请稍后重试'
          toast('加载失败，下拉重试')
        } else if (!hasCache) {
          this.loading = false
          this.loadError = true
          this.errorMsg = err.message || '加载失败，请稍后重试'
        }
      }
    },

    retryLoad() {
      this.loadList(true)
    },

    async loadFilterOptions() {
      try {
        const [categories, tags] = await Promise.all([
          api.getCategories('all'),
          api.getTags('all'),
        ])
        const categoryOptions = (categories || []).map((c) => c.name).filter(Boolean)
        const tagOptions = (tags || []).map((t) => t.name).filter(Boolean)
        cache.setCached(CACHE_KEY_FILTERS, { categoryOptions, tagOptions })
        this.categoryOptions = categoryOptions
        this.tagOptions = tagOptions
        this.updateFilterValueOptions(this.form.filterType, this.form.filterValue)
      } catch (err) {
        logError('[topic-list] 加载筛选选项失败', err)
      }
    },

    async ensureFilterOptions() {
      if (this.categoryOptions.length === 0 && this.tagOptions.length === 0) {
        await this.loadFilterOptions()
      }
    },

    updateFilterValueOptions(filterType, currentValue) {
      const options = filterType === 'tag' ? this.tagOptions : this.categoryOptions
      const idx = options.indexOf(currentValue)
      this.filterValueOptions = options
      this.filterValueIndex = idx >= 0 ? idx : 0
    },

    async onToggleStatus(item) {
      const id = item._id
      const newStatus = item.status === 'active' ? 'inactive' : 'active'
      try {
        await api.manageTopics('updateStatus', { id, data: { status: newStatus } })
        const idx = this.list.findIndex((t) => t._id === id)
        if (idx >= 0) this.list[idx].status = newStatus
        toast(newStatus === 'active' ? '已启用' : '已停用', 'success')
      } catch (err) {
        logError('[topic-list] 状态更新失败', err)
        toast('操作失败')
      }
    },

    async onToggleFeatured(item) {
      const id = item._id
      const newValue = !item.isFeatured
      try {
        await api.manageTopics('updateFeatured', { id, data: { isFeatured: newValue } })
        const idx = this.list.findIndex((t) => t._id === id)
        if (idx >= 0) this.list[idx].isFeatured = newValue
        toast(newValue ? '已设为精选' : '已取消精选', 'success')
      } catch (err) {
        logError('[topic-list] 精选设置失败', err)
        toast('操作失败')
      }
    },

    async onBadgeChange(item, e) {
      const id = item._id
      const idx = Number(e.detail.value)
      const badge = BADGE_OPTIONS[idx].value
      const listIdx = this.list.findIndex((t) => t._id === id)
      if (listIdx < 0) return
      try {
        await api.manageTopics('updateBadge', { id, data: { badge } })
        this.list[listIdx].badge = badge
        this.list[listIdx].badgeIndex = idx
        this.list[listIdx].badgeLabel = BADGE_OPTIONS[idx].label
        toast(badge ? `已设置${BADGE_OPTIONS[idx].label}角标` : '已移除角标', 'success')
      } catch (err) {
        logError('[topic-list] 角标设置失败', err)
        toast('操作失败')
      }
    },

    onToggleSelect(id) {
      const idx = this.list.findIndex((t) => t._id === id)
      if (idx < 0) return
      const newSelected = !this.list[idx].selected
      let selectedIds
      if (newSelected) {
        selectedIds = this.selectedIds.indexOf(id) >= 0
          ? this.selectedIds
          : this.selectedIds.concat([id])
      } else {
        selectedIds = this.selectedIds.filter((sid) => sid !== id)
      }
      this.list[idx].selected = newSelected
      this.selectedIds = selectedIds
      this.allSelected = selectedIds.length === this.list.length && selectedIds.length > 0
    },

    onSelectAll() {
      if (this.allSelected) {
        this.list = this.list.map((item) => Object.assign({}, item, { selected: false }))
        this.selectedIds = []
        this.allSelected = false
      } else {
        this.list = this.list.map((item) => Object.assign({}, item, { selected: true }))
        this.selectedIds = this.list.map((item) => item._id)
        this.allSelected = true
      }
    },

    async onBatchStatus(status) {
      const ids = this.selectedIds
      if (ids.length === 0) return
      const label = status === 'active' ? '启用' : '停用'
      const ok = await confirm(`确定要${label}选中的 ${ids.length} 个专题吗？`)
      if (!ok) return
      showLoading('处理中…')
      try {
        await api.manageTopics('batchUpdateStatus', { ids, data: { status } })
        hideLoading()
        toast(`已${label} ${ids.length} 个专题`, 'success')
        this.loadList(false)
      } catch (err) {
        logError('[topic-list] 批量状态更新失败', err)
        hideLoading()
        toast('操作失败')
      }
    },

    async onBatchDelete() {
      const ids = this.selectedIds
      if (ids.length === 0) return
      const ok = await confirm(`确定要删除选中的 ${ids.length} 个专题吗？此操作不可恢复。`)
      if (!ok) return
      showLoading('删除中…')
      try {
        await api.manageTopics('batchDelete', { ids })
        hideLoading()
        toast(`已删除 ${ids.length} 个专题`, 'success')
        this.loadList(false)
      } catch (err) {
        logError('[topic-list] 批量删除失败', err)
        hideLoading()
        toast('删除失败')
      }
    },

    onToggleMultiMode() {
      if (this.multiSelect) this.onExitMulti()
      else this.onEnterMulti()
    },

    // ====== 长按拖拽排序 ======
    onHandleTouchStart(e) {
      const idx = Number(e.currentTarget.dataset.index)
      const item = this.list[idx]
      if (!item) return
      const t = e.touches[0]
      this._drag = { startX: t.clientX, startY: t.clientY, idx }
      this._armed = false
      this._timer = setTimeout(() => {
        this._armed = true
        this.beginDrag(idx, this._drag.startX, this._drag.startY)
      }, 400)
    },

    onHandleTouchMove(e) {
      if (!this._drag) return
      const t = e.touches[0]
      if (!this._armed) {
        const dx = Math.abs(t.clientX - this._drag.startX)
        const dy = Math.abs(t.clientY - this._drag.startY)
        if (dx > 10 || dy > 10) {
          clearTimeout(this._timer)
          this._drag = null
        }
        return
      }
      if (!this.dragging) return
      this.applyDrag(t.clientX, t.clientY)
    },

    onHandleTouchEnd() {
      clearTimeout(this._timer)
      if (this._armed && this.dragging) this.endDrag()
      this._drag = null
      this._armed = false
    },

    beginDrag(idx, startX, startY) {
      const query = uni.createSelectorQuery()
      query.selectAll('.topic-card').boundingClientRect()
      query.exec((res) => {
        const rects = (res && res[0]) || []
        if (!rects.length || !rects[idx]) { this._armed = false; return }
        this._rects = rects
        uni.vibrateShort({ type: 'light' })
        this.dragging = true
        this.dragIndex = idx
        this.dragCurrent = idx
        this.list = this.list.map((it, i) => Object.assign({}, it, {
          _transform: '',
          _dragging: i === idx,
        }))
        this.applyDrag(startX, startY)
      })
    },

    applyDrag(pointerX, pointerY) {
      const rects = this._rects
      if (!rects || !rects.length) return
      const idx = this.dragIndex
      if (idx < 0) return
      let newCurrent = idx
      let minDist = Infinity
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i]
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const dist = (pointerX - cx) * (pointerX - cx) + (pointerY - cy) * (pointerY - cy)
        if (dist < minDist) { minDist = dist; newCurrent = i }
      }
      const list = this.list.map((it, i) => {
        if (i === idx) {
          const followX = pointerX - (rects[idx].left + rects[idx].width / 2)
          const followY = pointerY - (rects[idx].top + rects[idx].height / 2)
          return Object.assign({}, it, { _dragging: true, _transform: 'translate(' + followX + 'px,' + followY + 'px) scale(1.05)' })
        }
        let newIndex = i
        if (idx < newCurrent) {
          if (i > idx && i <= newCurrent) newIndex = i - 1
        } else if (idx > newCurrent) {
          if (i >= newCurrent && i < idx) newIndex = i + 1
        }
        const dx = rects[newIndex].left - rects[i].left
        const dy = rects[newIndex].top - rects[i].top
        const transform = (dx || dy) ? 'translate(' + dx + 'px,' + dy + 'px)' : ''
        return Object.assign({}, it, { _dragging: false, _transform: transform })
      })
      this.dragCurrent = newCurrent
      this.list = list
    },

    endDrag() {
      const { dragIndex, dragCurrent } = this
      let clean = this.list.map((it) => Object.assign({}, it, { _transform: '', _dragging: false }))
      if (dragIndex !== dragCurrent && dragIndex >= 0 && dragCurrent >= 0) {
        const moved = clean.splice(dragIndex, 1)[0]
        clean.splice(dragCurrent, 0, moved)
        clean = clean.map((it, i) => Object.assign({}, it, { sort: i }))
      }
      this.dragging = false
      this.dragIndex = -1
      this.dragCurrent = -1
      this.list = clean
      const sortMap = clean.map((item) => ({ id: item._id, sort: item.sort }))
      this.persistSort(sortMap)
    },

    async persistSort(sortMap) {
      try {
        await api.manageTopics('updateSort', { data: { sortMap } })
      } catch (err) {
        logError('[topic-list] 排序保存失败', err)
        toast('排序保存失败')
        this.loadList(false)
      }
    },

    onTapItem(item) {
      if (!item) return
      if (this.multiSelect) {
        this.onToggleSelect(item._id)
        return
      }
      this.openEdit(item)
    },

    onEnterMulti() {
      this.multiSelect = true
      this.selectedIds = []
      this.allSelected = false
    },

    onExitMulti() {
      this.multiSelect = false
      this.selectedIds = []
      this.allSelected = false
      this.list = this.list.map((item) => Object.assign({}, item, { selected: false }))
    },

    onFormStatusToggle() {
      this.form.status = this.form.status === 'active' ? 'inactive' : 'active'
      this.formDirty = true
    },

    async onAdd() {
      await this.ensureFilterOptions()
      this.modalVisible = true
      this.editing = null
      this.formDirty = false
      this.formBadgeIndex = 0
      this.manualResourceMap = {}
      this.form = {
        title: '',
        description: '',
        coverFileID: '',
        coverPreview: '',
        linkType: 'resource',
        filterType: 'tag',
        filterValue: '',
        linkUrl: '',
        isFeatured: false,
        isRecommended: false,
        badge: '',
        status: 'active',
        gridColumns: 3,
        sourceType: 'filter',
        manualIds: [],
        resourceCount: 6,
      }
      this.updateFilterValueOptions('tag', '')
    },

    async openEdit(topic) {
      await this.ensureFilterOptions()
      const linkType = topic.linkType || 'resource'
      const filterType = topic.filterType || 'tag'
      const badge = topic.badge || ''
      const coverFileID = topic.coverFileID || (topic.cover && topic.cover.indexOf('cloud://') === 0 ? topic.cover : '')
      const coverPreview = topic.coverFileID || topic.cover || ''
      const manualIds = (topic.manualIds || []).slice()
      this.modalVisible = true
      this.editing = topic
      this.formDirty = false
      this.formBadgeIndex = badgeIndexOf(badge)
      this.manualResourceMap = {}
      this.form = {
        title: topic.title || '',
        description: topic.description || '',
        coverFileID,
        coverPreview,
        linkType,
        filterType,
        filterValue: topic.filterValue || '',
        linkUrl: topic.linkUrl || '',
        isFeatured: !!topic.isFeatured,
        isRecommended: !!topic.isRecommended,
        badge,
        status: topic.status || 'active',
        gridColumns: topic.gridColumns || 3,
        sourceType: topic.sourceType || 'filter',
        manualIds,
        resourceCount: topic.resourceCount || manualIds.length || 6,
      }
      this.updateFilterValueOptions(filterType, topic.filterValue || '')
      if (manualIds.filter((id) => id).length > 0) {
        this.fetchManualResources(manualIds)
      }
    },

    closeModal(force) {
      if (!force && this.formDirty) {
        uni.showModal({
          title: '提示',
          content: '有未保存的修改，确定要关闭吗？',
          confirmText: '放弃',
          confirmColor: '#FA5151',
          success: (res) => {
            if (res.confirm) {
              this.modalVisible = false
              this.editing = null
              this.formDirty = false
            }
          },
        })
      } else {
        this.modalVisible = false
        this.editing = null
        this.formDirty = false
      }
    },

    onFormTitleInput(e) {
      this.form.title = e.detail.value
      this.formDirty = true
    },

    onFormDescInput(e) {
      this.form.description = e.detail.value
      this.formDirty = true
    },

    onFormLinkTypeChange(value) {
      this.form.linkType = value
      this.formDirty = true
    },

    onFormFilterTypeChange(value) {
      this.form.filterType = value
      this.form.filterValue = ''
      this.formDirty = true
      this.updateFilterValueOptions(value, '')
    },

    onFormFilterValueChange(e) {
      const idx = Number(e.detail.value)
      const value = this.filterValueOptions[idx] || ''
      this.filterValueIndex = idx
      this.form.filterValue = value
      this.formDirty = true
    },

    onFormLinkUrlInput(e) {
      this.form.linkUrl = e.detail.value
      this.formDirty = true
    },

    onFormLinkUrlPreset(value) {
      this.form.linkUrl = value
      this.formDirty = true
    },

    onFormFeaturedToggle() {
      this.form.isFeatured = !this.form.isFeatured
      this.formDirty = true
    },

    onFormRecommendToggle() {
      this.form.isRecommended = !this.form.isRecommended
      this.formDirty = true
    },

    onFormBadgeChange(e) {
      const idx = Number(e.detail.value)
      const badge = BADGE_OPTIONS[idx].value
      this.formBadgeIndex = idx
      this.form.badge = badge
      this.formDirty = true
    },

    async onChooseCover() {
      const prevPreview = this.form.coverPreview
      const prevFileID = this.form.coverFileID
      try {
        // 用 chooseImage 替代 chooseMedia，App 端对本地路径预览兼容性更好
        const res = await new Promise((resolve, reject) => {
          uni.chooseImage({
            count: 1,
            sizeType: ['original'],
            sourceType: ['album', 'camera'],
            extension: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'],
            success: resolve,
            fail: reject,
          })
        })
        const tempPath = (res.tempFilePaths && res.tempFilePaths[0]) || ''
        if (!tempPath) return
        this.form.coverPreview = tempPath
        this.form.coverFileID = ''
        this.formDirty = true
        showLoading('上传中…')
        try {
          // 按原始扩展名生成 cloudPath，避免 GIF 被错误存为 jpg
          const seg = String(tempPath).split('.').pop().toLowerCase()
          const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
          const ext = ALLOWED_EXTS.indexOf(seg) >= 0 ? seg : 'jpg'
          const random6 = Math.random().toString(36).slice(2, 8)
          const cloudPath = 'topics/covers/' + Date.now() + '_' + random6 + '.' + ext
          const fileID = await uploadFile(cloudPath, tempPath)
          this.form.coverFileID = fileID
          hideLoading()
          toast('上传成功', 'success')
        } catch (err) {
          logError('[topic-list] 封面上传失败', err)
          hideLoading()
          toast('封面上传失败')
          this.form.coverPreview = prevPreview
          this.form.coverFileID = prevFileID
        }
      } catch (err) {
        // 用户取消选择
      }
    },

    async onSave() {
      const form = this.form
      const editing = this.editing

      if (!form.title.trim()) {
        toast('请输入专题标题')
        return
      }
      if (form.linkType === 'resource' && form.sourceType === 'filter' && !form.filterValue) {
        toast('请选择筛选值')
        return
      }
      if (form.linkType === 'resource' && form.sourceType === 'manual') {
        const hasResources = (form.manualIds || []).some((id) => id)
        if (!hasResources) {
          toast('请至少选择一个素材')
          return
        }
      }
      if (form.linkType === 'page') {
        if (!form.linkUrl) {
          toast('请输入页面路径')
          return
        }
        if (form.linkUrl.indexOf('/') !== 0) {
          toast('页面路径需以 / 开头')
          return
        }
      }
      if (form.linkType === 'webview') {
        if (!form.linkUrl) {
          toast('请输入网页链接')
          return
        }
        if (form.linkUrl.indexOf('https://') !== 0) {
          toast('网页链接需以 https:// 开头')
          return
        }
      }
      if (!form.coverFileID && form.coverPreview && form.coverPreview.indexOf('http') !== 0 && form.coverPreview.indexOf('cloud://') !== 0) {
        toast('封面正在上传，请稍候')
        return
      }

      this.saving = true
      showLoading('保存中…')

      try {
        const cover = form.coverFileID || form.coverPreview || ''
        const coverFileID = form.coverFileID || ''
        const contentType = form.sourceType === 'manual' ? 'manual' : 'auto'
        const resourceIds = form.sourceType === 'manual' ? (form.manualIds || []).filter((id) => id) : []

        if (editing) {
          await api.manageTopics('update', {
            id: editing._id,
            data: {
              title: form.title.trim(),
              description: form.description.trim(),
              cover,
              coverFileID,
              linkType: form.linkType,
              linkUrl: form.linkType !== 'resource' ? form.linkUrl : '',
              filterType: form.filterType,
              filterValue: form.linkType === 'resource' ? form.filterValue : '',
              isFeatured: form.isFeatured,
              isRecommended: form.isRecommended,
              badge: form.badge,
              status: form.status,
              gridColumns: form.gridColumns,
              contentType,
              resourceIds,
            },
          })
        } else {
          await api.manageTopics('create', {
            data: {
              title: form.title.trim(),
              description: form.description.trim(),
              cover,
              coverFileID,
              filterType: form.filterType,
              filterValue: form.linkType === 'resource' ? form.filterValue : '',
              status: 'active',
              sort: this.list.length,
              resourceType: 'all',
              defaultSort: 'latest',
              isFeatured: form.isFeatured,
              isRecommended: form.isRecommended,
              badge: form.badge,
              linkType: form.linkType,
              linkUrl: form.linkType !== 'resource' ? form.linkUrl : '',
              gridColumns: form.gridColumns,
              contentType,
              resourceIds,
            },
          })
        }

        hideLoading()
        toast(editing ? '保存成功' : '创建成功', 'success')
        this.modalVisible = false
        this.editing = null
        this.saving = false
        this.formDirty = false
        this.loadList(false)
      } catch (err) {
        logError('[topic-list] 保存失败', err)
        hideLoading()
        this.saving = false
        toast('保存失败')
      }
    },

    onFormGridColumnsChange(value) {
      this.form.gridColumns = Number(value)
      this.formDirty = true
    },

    onFormSourceTypeChange(value) {
      this.form.sourceType = value
      this.formDirty = true
    },

    onResourceCountInput(e) {
      const raw = e.detail.value
      const count = Number(raw)
      if (!count || count < 1) return
      const clampedCount = Math.min(100, count)
      const currentIds = (this.form.manualIds || []).slice()
      let newIds
      if (clampedCount > currentIds.length) {
        const fill = Array(clampedCount - currentIds.length).fill('')
        newIds = currentIds.concat(fill)
      } else if (clampedCount < currentIds.length) {
        newIds = currentIds.slice(0, clampedCount)
      } else {
        newIds = currentIds
      }
      this.form.manualIds = newIds
      this.form.resourceCount = clampedCount
      this.formDirty = true
    },

    onRemoveMaterial(index) {
      const ids = (this.form.manualIds || []).slice()
      if (index < 0 || index >= ids.length) return
      ids[index] = ''
      this.form.manualIds = ids
      this.formDirty = true
    },

    async fetchManualResources(ids) {
      const validIds = (ids || []).filter((id) => id)
      if (validIds.length === 0) return
      const existing = this.manualResourceMap || {}
      const missingIds = validIds.filter((id) => !existing[id])
      if (missingIds.length === 0) return
      try {
        const database = await db()
        const _ = await cmd()
        const map = Object.assign({}, existing)
        const batchSize = 20
        for (let i = 0; i < missingIds.length; i += batchSize) {
          const batch = missingIds.slice(i, i + batchSize)
          const res = await database.collection('resources').where({ _id: _.in(batch) }).get()
          const items = res.data || []
          // App 端不能直接渲染 cloud://，批量转换为 HTTP URL
          await api.resolveCloudCovers(items)
          items.forEach((r) => {
            const cover = r.coverUrl || r.originUrl || r.thumbnail || r.cover || r.fileID || r.url || r.imageUrl || ''
            map[r._id] = { _id: r._id, title: r.title || '', cover }
          })
        }
        this.manualResourceMap = map
      } catch (err) {
        logError('[topic-list] 加载素材详情失败', err)
      }
    },

    onAddMaterial() {
      this.pickerVisible = true
      this.pickerSelected = {}
      this.pickerSearchKey = ''
      this.pickerPage = 1
      this.pickerHasMore = true
      this.loadResourcePickerData(true)
    },

    async loadResourcePickerData(reset) {
      if (this.pickerLoading) return
      const page = reset ? 1 : this.pickerPage
      const pageSize = 20
      this.pickerLoading = true
      try {
        const res = await api.getResources({
          page,
          pageSize,
          status: 'published',
          keyword: this.pickerSearchKey || '',
        })
        const items = this.normalizeList(res)
        const formatted = items.map((r) => {
          const cover = r.coverUrl || r.originUrl || r.thumbnail || r.cover || r.fileID || r.url || r.imageUrl || ''
          return { _id: r._id || r.id, title: r.title || '未命名', cover }
        })
        const list = reset ? formatted : this.pickerResources.concat(formatted)
        const total = (res && res.total) || 0
        const hasMore = total > 0 ? list.length < total : formatted.length >= pageSize
        this.pickerResources = list
        this.pickerPage = page + 1
        this.pickerHasMore = hasMore
        this.pickerLoading = false
      } catch (err) {
        logError('[topic-list] 加载资源列表失败', err)
        this.pickerLoading = false
        toast('加载资源失败')
      }
    },

    onPickerSearch(e) {
      const keyword = e.detail.value
      this.pickerSearchKey = keyword
      if (this._pickerSearchTimer) clearTimeout(this._pickerSearchTimer)
      const self = this
      this._pickerSearchTimer = setTimeout(() => {
        self.loadResourcePickerData(true)
      }, 400)
    },

    onPickerToggleItem(id) {
      const selected = Object.assign({}, this.pickerSelected)
      if (selected[id]) {
        delete selected[id]
      } else {
        selected[id] = true
      }
      this.pickerSelected = selected
    },

    onPickerConfirm() {
      const selectedMap = this.pickerSelected
      const selectedIds = Object.keys(selectedMap).filter((id) => selectedMap[id])
      if (selectedIds.length === 0) {
        this.onPickerClose()
        return
      }
      const currentIds = (this.form.manualIds || []).slice()
      const merged = currentIds.slice()
      selectedIds.forEach((id) => {
        if (merged.indexOf(id) < 0) merged.push(id)
      })
      const map = Object.assign({}, this.manualResourceMap)
      this.pickerResources.forEach((r) => {
        if (selectedIds.indexOf(r._id) >= 0) {
          map[r._id] = { _id: r._id, title: r.title, cover: r.cover }
        }
      })
      this.form.manualIds = merged
      this.form.resourceCount = merged.length
      this.manualResourceMap = map
      this.pickerVisible = false
      this.pickerSelected = {}
      this.pickerSearchKey = ''
      this.pickerResources = []
      this.pickerPage = 1
      this.pickerHasMore = true
      this.formDirty = true
    },

    onPickerClose() {
      this.pickerVisible = false
      this.pickerSelected = {}
      this.pickerSearchKey = ''
      this.pickerResources = []
      this.pickerPage = 1
      this.pickerHasMore = true
      this.pickerLoading = false
    },

    onPickerReachBottom() {
      if (this.pickerHasMore && !this.pickerLoading) {
        this.loadResourcePickerData(false)
      }
    },

    async onDelete(id) {
      const topic = this.list.find((t) => t._id === id)
      if (!topic) return
      const ok = await confirm('确定删除「' + topic.title + '」吗？')
      if (!ok) return
      showLoading('删除中…')
      try {
        await api.manageTopics('delete', { id })
        hideLoading()
        toast('删除成功', 'success')
        if (this.selectedIds.indexOf(id) >= 0) {
          this.selectedIds = this.selectedIds.filter((sid) => sid !== id)
        }
        this.loadList(false)
      } catch (err) {
        logError('[topic-list] 删除失败', err)
        hideLoading()
        toast('删除失败')
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.topic-list-page {
  padding-bottom: 200rpx;
}

/* 提示栏 */
.hint-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  font-size: 22rpx;
  color: var(--text-tertiary);
  margin-bottom: 16rpx;
  padding: 0 4rpx;
  line-height: 1.5;
}

.hint-action {
  flex-shrink: 0;
  font-size: 24rpx;
  font-weight: 500;
  color: var(--pri);
  padding: 6rpx 20rpx;
  border-radius: 100rpx;
  background: var(--pri-l);
}

.hint-action:active {
  background: var(--pri);
  color: #fff;
}

/* ============================================
 * 网格布局
 * ============================================ */
.topic-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
}

.topic-grid.nomulti .card-checkbox {
  display: none;
}

/* ============================================
 * 专题卡片
 * ============================================ */
.topic-card {
  background: var(--bg-card);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  transition: transform 0.28s cubic-bezier(0.18, 0.89, 0.32, 1.28), opacity 0.2s, background 0.2s, box-shadow 0.2s;
  will-change: transform;
}

.topic-card--active {
  background: var(--divider);
}

.topic-card--selected {
  box-shadow: 0 0 0 4rpx var(--pri);
}

.topic-card--dragging {
  position: relative;
  z-index: 5;
  box-shadow: 0 16rpx 50rpx rgba(0, 0, 0, 0.22);
  opacity: 0.95;
  transition: box-shadow 0.2s, background 0.2s, opacity 0.2s;
}

.drag-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
  background: transparent;
}

.drag-handle {
  width: 64rpx;
  height: 64rpx;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
}

.drag-handle:active {
  opacity: 0.6;
}

.drag-icon {
  width: 32rpx;
  height: 32rpx;
}

.skeleton-card {
  pointer-events: none;
}

.skeleton-cover {
  width: 100%;
  padding-bottom: 56.25%;
  height: 0;
  border-radius: 0;
}

.skeleton-footer {
  padding: 20rpx;
}

/* ============================================
 * 封面区域
 * ============================================ */
.card-cover {
  position: relative;
  width: 100%;
  padding-bottom: 56.25%;
  height: 0;
  overflow: hidden;
  background: var(--divider);
}

.cover-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.cover-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.cover-placeholder-icon {
  width: 56rpx;
  height: 56rpx;
  opacity: 0.4;
}

.cover-placeholder-text {
  font-size: 20rpx;
  color: var(--text-tertiary);
}

.cover-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.15) 50%, rgba(0, 0, 0, 0.05) 100%);
  pointer-events: none;
}

/* ============================================
 * 状态切换(左上角) + 精选星标
 * ============================================ */
.card-status-row {
  position: absolute;
  top: 16rpx;
  left: 16rpx;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.card-status {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 6rpx 16rpx;
  border-radius: var(--r-pill);
}

.card-status--on {
  background: rgba(7, 193, 96, 0.9);
  border: 1rpx solid rgba(7, 193, 96, 0.5);
}

.card-status--off {
  background: rgba(100, 116, 139, 0.85);
  border: 1rpx solid rgba(100, 116, 139, 0.4);
}

@supports (backdrop-filter: blur(8rpx)) {
  .card-status {
    backdrop-filter: blur(8rpx);
  }
  .card-status--on {
    background: rgba(7, 193, 96, 0.85);
  }
  .card-status--off {
    background: rgba(100, 116, 139, 0.25);
  }
}

.status-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
}

.card-status--on .status-dot {
  background: #fff;
}

.card-status--off .status-dot {
  background: #94a3b8;
}

.status-text {
  font-size: 20rpx;
  font-weight: 500;
}

.card-status--on .status-text {
  color: #fff;
}

.card-status--off .status-text {
  color: #cbd5e1;
}

/* ============================================
 * 角标选择(顶部居中)
 * ============================================ */
.card-badge-wrap {
  position: absolute;
  top: 16rpx;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
}

.card-badge {
  padding: 6rpx 18rpx;
  border-radius: var(--r-pill);
  font-size: 20rpx;
  font-weight: 600;
  text-align: center;
}

.card-badge--none {
  background: rgba(255, 255, 255, 0.92);
  color: #64748b;
  border: 1rpx solid rgba(0, 0, 0, 0.1);
}

@supports (backdrop-filter: blur(8rpx)) {
  .card-badge {
    backdrop-filter: blur(8rpx);
  }
  .card-badge--none {
    background: rgba(255, 255, 255, 0.75);
  }
}

.card-badge--hot {
  background: rgba(239, 68, 68, 0.92);
  color: #fff;
}

.card-badge--new {
  background: rgba(59, 130, 246, 0.92);
  color: #fff;
}

.card-badge--limited {
  background: rgba(245, 158, 11, 0.92);
  color: #fff;
}

/* ============================================
 * 精选星标 + 勾选框(右上角)
 * ============================================ */
.card-top-right {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.featured-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.92);
  border: 1rpx solid rgba(0, 0, 0, 0.1);
}

.featured-btn--on {
  background: rgba(251, 191, 36, 0.95);
  border: 1rpx solid rgba(251, 191, 36, 1);
}

.featured-star-icon {
  width: 36rpx;
  height: 36rpx;
  filter: drop-shadow(0 2rpx 4rpx rgba(0, 0, 0, 0.3));
}

.recommend-badge {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(7, 193, 96, 0.95);
  border: 1rpx solid rgba(7, 193, 96, 1);
}

.recommend-icon {
  width: 36rpx;
  height: 36rpx;
}

@supports (backdrop-filter: blur(8rpx)) {
  .featured-btn {
    backdrop-filter: blur(8rpx);
    background: rgba(255, 255, 255, 0.75);
  }
}

.featured-icon {
  width: 36rpx;
  height: 36rpx;
}

.card-checkbox {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}

@supports (backdrop-filter: blur(8rpx)) {
  .card-checkbox {
    backdrop-filter: blur(8rpx);
    background: rgba(255, 255, 255, 0.3);
  }
}

.card-checkbox--on {
  background: var(--pri);
  border-color: var(--pri);
}

.checkbox-icon {
  width: 24rpx;
  height: 24rpx;
}

/* ============================================
 * 标题 + 标签(底部覆盖)
 * ============================================ */
.cover-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16rpx;
  z-index: 4;
}

.cover-title-row {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.title-star {
  width: 24rpx;
  height: 24rpx;
  flex-shrink: 0;
}

.cover-title {
  font-size: 26rpx;
  font-weight: 700;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.4);
}

.cover-tags {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 8rpx;
  flex-wrap: wrap;
}

.link-tag {
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  font-size: 18rpx;
  font-weight: 500;
}

.link-tag--resource {
  background: rgba(255, 255, 255, 0.45);
  color: rgba(255, 255, 255, 0.95);
}

@supports (backdrop-filter: blur(4rpx)) {
  .link-tag {
    backdrop-filter: blur(4rpx);
  }
  .link-tag--resource {
    background: rgba(255, 255, 255, 0.25);
  }
}

.link-tag--page {
  background: rgba(59, 130, 246, 0.55);
  color: #fff;
}

.link-tag--webview {
  background: rgba(168, 85, 247, 0.55);
  color: #fff;
}

.filter-tag {
  font-size: 18rpx;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.4);
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@supports (backdrop-filter: blur(4rpx)) {
  .filter-tag {
    backdrop-filter: blur(4rpx);
    background: rgba(255, 255, 255, 0.2);
  }
}

/* ============================================
 * 卡片底部信息 + 操作
 * ============================================ */
.card-footer {
  padding: 16rpx;
}

.footer-meta {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-bottom: 12rpx;
}

.sort-chip {
  font-size: 20rpx;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--divider);
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
  flex-shrink: 0;
}

.footer-desc {
  font-size: 20rpx;
  color: var(--text-secondary);
  flex: 1;
  min-width: 0;
}

.footer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.action-btns {
  display: flex;
  align-items: center;
  gap: 4rpx;
}

.icon-btn {
  width: 88rpx;
  height: 88rpx;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn:active {
  background: var(--divider);
}

.action-icon {
  width: 32rpx;
  height: 32rpx;
}

/* ============================================
 * 空状态
 * ============================================ */
.empty-state__icon--lg {
  width: 140rpx;
  height: 140rpx;
  opacity: 0.25;
}

.empty-state__sub {
  font-size: 24rpx;
  color: var(--text-tertiary);
  margin-top: -8rpx;
}

.empty-state .btn {
  margin: 0 auto;
}

/* ============================================
 * FAB
 * ============================================ */
.fab-icon {
  width: 44rpx;
  height: 44rpx;
}

/* ============================================
 * 批量操作栏
 * ============================================ */
.batch-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-card);
  padding: 20rpx 32rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  z-index: 100;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.batch-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex-shrink: 0;
}

.batch-left .card-checkbox {
  border: 2rpx solid var(--border);
  background: var(--bg-card);
}

.batch-left .card-checkbox--on {
  background: var(--pri);
  border-color: var(--pri);
}

.batch-count {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.batch-right {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.batch-btn {
  height: 64rpx;
  padding: 0 24rpx;
  border-radius: 10rpx;
  font-size: 24rpx;
  font-weight: 500;
  line-height: 64rpx;
  border: none;
}

.batch-btn::after {
  border: none;
}

.batch-btn--enable {
  background: var(--pri-l);
  color: var(--pri);
}

.batch-btn--disable {
  background: var(--warning-l);
  color: var(--warning-d);
}

.batch-btn--delete {
  background: var(--danger-l);
  color: var(--danger);
}

/* ============================================
 * 弹层
 * ============================================ */
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
  width: 32rpx;
  height: 32rpx;
}

.modal-body {
  flex: 1;
  min-height: 0;
  max-height: 62vh;
}

/* ============================================
 * 表单元素
 * ============================================ */
.required {
  color: var(--danger);
}

.input-hint {
  display: block;
  font-size: 22rpx;
  color: var(--text-tertiary);
  margin-top: 10rpx;
}

/* 封面选择器 */
.cover-picker {
  width: 100%;
  height: 240rpx;
  border-radius: var(--r-md);
  overflow: hidden;
  background: var(--divider);
  border: 2rpx dashed var(--border);
}

.cover-preview-img {
  width: 100%;
  height: 100%;
}

.cover-picker-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  color: var(--text-tertiary);
}

.cover-picker-icon {
  width: 52rpx;
  height: 52rpx;
  opacity: 0.5;
}

.cover-picker-text {
  font-size: 24rpx;
}

/* chip 列表 */
.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.chip-list--wrap {
  gap: 12rpx;
}

.chip {
  padding: 12rpx 24rpx;
  border-radius: var(--r-pill);
  font-size: 24rpx;
  background: var(--bg-card);
  color: var(--text-secondary);
  border: 1rpx solid var(--border);
  transition: all 0.2s;
}

.chip--sm {
  padding: 8rpx 18rpx;
  font-size: 22rpx;
}

.chip--active {
  background: var(--pri-l);
  color: var(--pri);
  border-color: var(--pri);
}

/* picker 行 */
.picker-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--r-sm);
  padding: 0 28rpx;
}

.picker-value {
  font-size: 28rpx;
  color: var(--text-primary);
}

.picker-value--placeholder {
  color: var(--text-tertiary);
}

.picker-arrow {
  font-size: 24rpx;
  color: var(--text-tertiary);
}

/* 表单双列 */
.form-row {
  display: flex;
  gap: 24rpx;
}

.form-col {
  flex: 1;
  min-width: 0;
}

/* 开关行 */
.toggle-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  height: 88rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--r-sm);
  padding: 0 28rpx;
}

.toggle-text {
  font-size: 26rpx;
  color: var(--text-secondary);
}

/* 删除此专题（编辑弹窗内） */
.del-row {
  margin-top: 8rpx;
  padding: 28rpx;
  text-align: center;
  border-radius: 12rpx;
  background: var(--danger-l);
  color: var(--danger);
  font-size: 28rpx;
  font-weight: 500;
}

.del-row:active {
  background: #ffd6d6;
}

/* 弹层底部 */
.modal-footer {
  display: flex;
  gap: 20rpx;
  margin-top: 24rpx;
  flex-shrink: 0;
}

.modal-footer .btn {
  flex: 1;
}

/* ============================================
 * 连体分段控件（显示列数）
 * ============================================ */
.seg-control {
  display: flex;
  border: 1rpx solid var(--border);
  border-radius: var(--r-sm);
  overflow: hidden;
  background: var(--bg-card);
}

.seg-control__btn {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  font-size: 26rpx;
  color: var(--text-secondary);
  border-right: 1rpx solid var(--border);
  transition: all 0.2s;
}

.seg-control__btn:last-child {
  border-right: none;
}

.seg-control__btn--active {
  background: var(--pri);
  color: #fff;
  font-weight: 600;
}

/* ============================================
 * 手动素材缩略图（横向滚动）
 * ============================================ */
.material-scroll {
  white-space: nowrap;
  width: 100%;
}

.material-scroll-inner {
  display: inline-flex;
  gap: 16rpx;
  padding: 4rpx 0 8rpx;
}

.material-thumb {
  position: relative;
  width: 140rpx;
  height: 140rpx;
  flex-shrink: 0;
  border-radius: var(--r-sm);
  overflow: hidden;
  background: var(--divider);
}

.material-thumb-img {
  width: 100%;
  height: 100%;
}

.material-remove {
  position: absolute;
  top: 4rpx;
  right: 4rpx;
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.material-remove-icon {
  width: 20rpx;
  height: 20rpx;
}

.material-add {
  position: relative;
  width: 140rpx;
  height: 140rpx;
  flex-shrink: 0;
  border: 2rpx dashed var(--border);
  border-radius: var(--r-sm);
  background: var(--bg-card);
}

.material-add-inner {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.material-add-icon {
  width: 40rpx;
  height: 40rpx;
}

.material-add-text {
  font-size: 20rpx;
  color: var(--text-tertiary);
  white-space: nowrap;
}

/* ============================================
 * 资源选择弹层
 * ============================================ */
.picker-mask {
  z-index: 300;
}

.picker-sheet {
  width: 100%;
  height: 85vh;
  background: var(--bg-card);
  border-radius: 28rpx 28rpx 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.25s ease-out;
  box-sizing: border-box;
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx 16rpx;
  flex-shrink: 0;
}

.picker-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.picker-close {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.picker-search-bar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin: 0 32rpx 16rpx;
  height: 72rpx;
  background: var(--divider);
  border-radius: var(--r-sm);
  padding: 0 24rpx;
  flex-shrink: 0;
}

.picker-search-icon {
  width: 32rpx;
  height: 32rpx;
  flex-shrink: 0;
}

.picker-search-input {
  flex: 1;
  font-size: 26rpx;
  color: var(--text-primary);
}

.picker-body {
  flex: 1;
  min-height: 0;
  padding: 0 32rpx;
  box-sizing: border-box;
  width: 100%;
}

.picker-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  padding-bottom: 24rpx;
  overflow: hidden;
}

.picker-item {
  border-radius: var(--r-sm);
  overflow: hidden;
  background: var(--divider);
  border: 3rpx solid transparent;
  transition: border-color 0.2s;
  min-width: 0;
}

.picker-item--selected {
  border-color: var(--pri);
}

.picker-item-img-wrap {
  position: relative;
  width: 100%;
  padding-bottom: 100%;
  height: 0;
}

.picker-item-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.picker-item-title {
  display: block;
  font-size: 22rpx;
  color: var(--text-secondary);
  padding: 8rpx 10rpx;
  text-align: center;
  background: var(--bg-card);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-item-check {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: var(--pri);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.picker-check-icon {
  width: 24rpx;
  height: 24rpx;
}

.picker-empty,
.picker-loading {
  padding: 80rpx 0;
  text-align: center;
}

.picker-empty-text,
.picker-loading-text {
  font-size: 26rpx;
  color: var(--text-tertiary);
}

.picker-footer {
  display: flex;
  gap: 20rpx;
  padding: 20rpx 32rpx calc(20rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid var(--border);
  flex-shrink: 0;
}

.picker-footer .btn {
  flex: 1;
}
</style>
