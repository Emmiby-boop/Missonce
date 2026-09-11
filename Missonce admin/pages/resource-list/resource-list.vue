<template>
  <view class="page-container resource-list-page">
    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <mc-icon name="search" color="#8C8CA1" :size="32" class="search-icon" />
        <input
          class="search-input"
          type="text"
          placeholder="搜索资源标题"
          v-model="keyword"
          confirm-type="search"
          @confirm="onSearchConfirm"
        />
        <view class="search-clear" v-if="keyword" @tap="onClearKeyword">×</view>
      </view>
    </view>

    <!-- 状态筛选栏 -->
    <scroll-view class="filter-bar" scroll-x :enhanced="true" :show-scrollbar="false">
      <view
        class="filter-chip"
        :class="{ 'filter-chip--active': activeStatus === item.key }"
        v-for="item in statusFilters"
        :key="item.key"
        @tap.stop="onStatusFilter(item.key)"
      >{{ item.label }}</view>
    </scroll-view>

    <!-- 类型筛选栏 -->
    <scroll-view class="filter-bar filter-bar--second" scroll-x :enhanced="true" :show-scrollbar="false">
      <view
        class="filter-chip"
        :class="{ 'filter-chip--active': activeType === item.key }"
        v-for="item in typeFilters"
        :key="item.key"
        @tap.stop="onTypeFilter(item.key)"
      >{{ item.label }}</view>
    </scroll-view>

    <!-- 提示栏 -->
    <view class="hint-bar" v-if="!loading && list.length > 0">
      <text class="hint-text">{{ multiSelect ? '已选 ' + selectedIds.length + ' / ' + list.length + ' 项' : reviewMode ? '待审核队列 · 点击卡片可编辑' : '点击卡片编辑 · 进入批量可多选' }}</text>
      <view class="hint-actions" v-if="multiSelect">
        <view class="hint-action" @tap="onSelectAll">{{ allSelected ? '取消全选' : '全选' }}</view>
        <view class="hint-action hint-action--primary" @tap="onExitMulti">完成</view>
      </view>
      <view class="hint-actions" v-else-if="reviewMode">
        <view class="hint-action hint-action--approve" @tap="quickReviewAll('published')">全部通过</view>
        <view class="hint-action hint-action--reject" @tap="quickReviewAll('offline')">全部驳回</view>
        <view class="hint-action" @tap="onEnterMulti">批量管理</view>
      </view>
      <view class="hint-action" v-else @tap="onEnterMulti">批量管理</view>
    </view>

    <!-- 加载骨架 -->
    <view class="rgrid" v-if="loading">
      <view class="rcard skeleton-card" v-for="n in 4" :key="n">
        <view class="rcover">
          <view class="skeleton rcover-skeleton" />
        </view>
      </view>
    </view>

    <!-- 错误状态 -->
    <view class="error-state" v-else-if="loadError && !list.length">
      <mc-icon name="alert-circle" color="#FA5151" :size="100" class="error-state__icon" />
      <view class="error-state__text">{{ errorMsg || '加载失败，请稍后重试' }}</view>
      <view class="error-state__action">
        <button class="btn btn--ghost btn--sm" @tap="retryLoad">重试</button>
      </view>
    </view>

    <!-- 网格列表 -->
    <view class="rgrid" v-else-if="list.length > 0">
      <view
        class="rcard"
        :class="{ 'rcard--selected': item.selected }"
        v-for="item in list"
        :key="item._id"
        hover-class="rcard--active"
        @tap="onTapItem(item._id)"
      >
        <view class="rcover">
          <image v-if="item.cover" class="rcover-img" :src="item.cover" mode="aspectFill" />
          <view v-else class="rcover-ph">
            <mc-icon name="image" color="#B8B8C8" :size="72" class="rcover-ph-icon" />
          </view>

          <!-- 状态(左上) -->
          <view class="spill" :class="item.statusCls">{{ item.statusLabel }}</view>

          <!-- AI 识别(右上 · 非批量态且有 AI 状态时显示) -->
          <view v-if="!multiSelect && item.aiStatus" class="aibadge" :class="item.aiCls">
            <mc-icon v-if="item.aiStatus === 'success'" name="check" color="#fff" :size="18" class="aibadge-icon" />
            <mc-icon v-else-if="item.aiStatus === 'pending'" name="clock" color="#fff" :size="18" class="aibadge-icon" />
            <mc-icon v-else name="x" color="#fff" :size="18" class="aibadge-icon" />
            <text class="aibadge-text">AI</text>
          </view>

          <!-- 勾选框(右上 · 批量态显示) -->
          <view
            v-if="multiSelect"
            class="check-btn"
            :class="{ 'check-btn--on': item.selected }"
            @tap.stop="onToggleSelect(item._id)"
          >
            <mc-icon v-if="item.selected" name="check" color="#fff" :size="24" class="check-icon" />
          </view>

          <!-- 底部标题 + 统计 -->
          <view class="rcov-b">
            <view class="rtitle">{{ item.title }}</view>
            <view class="rstat">
              <view class="rstat-item">
                <mc-icon name="download" color="#fff" :size="20" class="rstat-icon" />
                <text>{{ item.downloads }}</text>
              </view>
              <view class="rstat-item">
                <mc-icon name="eye" color="#fff" :size="20" class="rstat-icon" />
                <text>{{ item.views }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view class="empty-state" v-else>
      <mc-icon name="image" color="#B8B8C8" :size="140" class="empty-state__icon empty-state__icon--lg" />
      <text class="empty-state__text">暂无资源</text>
      <text class="empty-state__sub">点击下方按钮上传你的第一个素材</text>
      <view class="empty-state__action">
        <button class="btn btn--primary btn--sm" @tap="onAdd">上传素材</button>
      </view>
    </view>

    <!-- 加载更多 -->
    <view class="load-more" v-if="!loading && !loadError && list.length > 0 && loadingMore">加载中…</view>
    <view class="load-more" v-else-if="!loading && !loadError && list.length > 0 && !hasMore">没有更多了</view>

    <!-- FAB 上传 -->
    <view class="fab" v-if="!loading && !loadError && !multiSelect" @tap="onAdd">
      <mc-icon name="plus" color="#ffffff" :size="44" class="fab-icon" />
    </view>

    <!-- 批量操作栏 -->
    <view class="batch-bar" v-if="selectedIds.length > 0">
      <view class="batch-left">
        <view class="card-checkbox" :class="{ 'card-checkbox--on': allSelected }" @tap.stop="onSelectAll">
          <mc-icon v-if="allSelected" name="check" color="#fff" :size="24" class="checkbox-icon" />
        </view>
        <text class="batch-count">已选 {{ selectedIds.length }} 项</text>
      </view>
      <view class="batch-act-main" @tap.stop="onShowBatchSheet">
        <mc-icon name="edit" color="#fff" :size="30" class="batch-act-icon" />
        <text>批量操作</text>
      </view>
    </view>

    <!-- 批量操作面板（Action Sheet） -->
    <view class="as-mask" v-if="showBatchSheet" @tap="onCloseBatchSheet" @touchmove.stop />
    <view class="as-sheet" v-if="showBatchSheet" @touchmove.stop>
      <view class="as-head">
        <text class="as-title">批量操作</text>
        <text class="as-sub">已选 {{ selectedIds.length }} 项资源</text>
      </view>
      <view class="as-item" @tap.stop="onBatchAI">
        <view class="as-ico as-ico--ai">
          <mc-icon :path="AI_SCAN_PATH" color="#fff" :size="40" class="as-ico-icon" />
        </view>
        <view class="as-tx">
          <text class="as-t">批量 AI 识别</text>
          <text class="as-d">对选中封面批量调用视觉模型</text>
        </view>
      </view>
      <view class="as-item" @tap.stop="onBatchStatus">
        <view class="as-ico as-ico--status">
          <mc-icon name="check" color="#fff" :size="40" class="as-ico-icon" />
        </view>
        <view class="as-tx">
          <text class="as-t">批量改状态</text>
          <text class="as-d">发布 / 下架 / 待审 一键切换</text>
        </view>
      </view>
      <view class="as-item" @tap.stop="onBatchDelete">
        <view class="as-ico as-ico--del">
          <mc-icon name="x" color="#fff" :size="40" class="as-ico-icon" />
        </view>
        <view class="as-tx">
          <text class="as-t">批量删除</text>
          <text class="as-d">删除前需二次确认</text>
        </view>
      </view>
      <view class="as-cancel" @tap.stop="onCloseBatchSheet">取消</view>
    </view>

    <!-- 批量改状态弹窗 -->
    <view class="modal-mask" v-if="showBatchStatusModal" @tap="closeBatchStatusModal" @touchmove.stop>
      <view class="modal-sheet" @tap.stop @touchmove.stop>
        <view class="modal-header">
          <text class="modal-title">批量改状态</text>
          <view class="modal-close" @tap.stop="closeBatchStatusModal">
            <mc-icon name="x" color="#8C8CA1" :size="28" class="modal-close-icon" />
          </view>
        </view>
        <view class="modal-body">
          <view class="batch-tip">将为 <text class="batch-tip-num">{{ selectedIds.length }}</text> 项资源统一设置状态</view>
          <view class="batch-status-list">
            <view
              class="batch-status-item"
              :class="{ 'batch-status-item--on': batchStatusTarget === item.value }"
              v-for="item in statusOptions"
              :key="item.value"
              @tap.stop="onBatchStatusSelect(item.value)"
            >{{ item.label }}</view>
          </view>
        </view>
        <view class="modal-footer">
          <button class="btn btn--default" @tap.stop="closeBatchStatusModal">取消</button>
          <button class="btn btn--primary" @tap.stop="onApplyBatchStatus" :disabled="!batchStatusTarget">应用到 {{ selectedIds.length }} 项</button>
        </view>
      </view>
    </view>

    <!-- 编辑/新增弹层（资源管理为编辑已有资源，封面不可改） -->
    <view class="modal-mask" v-if="modalVisible" @tap="closeModal" @touchmove.stop>
      <view class="modal-sheet" @tap.stop @touchmove.stop>
        <view class="modal-header">
          <text class="modal-title">{{ editing ? '编辑资源' : '编辑资源' }}</text>
          <view class="modal-close" @tap.stop="closeModal">
            <mc-icon name="x" color="#8C8CA1" :size="28" class="modal-close-icon" />
          </view>
        </view>

        <scroll-view class="modal-body" scroll-y :enhanced="true" :show-scrollbar="false">
          <!-- 封面预览（只读） -->
          <view class="cover-preview">
            <image v-if="editing && editing.cover" class="cp-bg-img" :src="editing.cover" mode="aspectFill" />
            <view v-else class="cp-bg-ph">
              <mc-icon name="image" color="#B8B8C8" :size="72" class="cp-ph-icon" />
            </view>
            <view class="cp-tag" :class="{ 'cp-tag--ai': aiState === 'pending' || aiState === 'done' }">
              {{ form.type === 'avatar' ? '头像' : '壁纸' }} · {{ aiState === 'pending' ? '识别中' : aiState === 'done' ? 'AI 已识别' : aiLabel }}
            </view>
          </view>

          <!-- AI 智能识别按钮（识别前） -->
          <view v-if="aiState === 'idle'" class="ai-recog" @tap.stop="onAIRecognize">
            <mc-icon :path="AI_SCAN_PATH" color="#fff" :size="36" class="ai-recog-icon" />
            <text>AI 智能识别</text>
          </view>
          <view v-if="aiState === 'idle'" class="ai-tip">点击「AI 智能识别」后，后台视觉模型自动识别<text class="ai-tip-bold">标题 / 类型 / 分类 / 标签</text>并<text class="ai-tip-bold">直接写入数据库</text>，小程序自动同步获取，无需手动应用。</view>

          <!-- AI 识别中 -->
          <view v-if="aiState === 'pending'" class="ai-recog ai-recog--pending">
            <mc-icon :path="AI_SCAN_PATH" color="#fff" :size="36" class="ai-recog-icon" />
            <text>识别中…</text>
          </view>
          <view v-if="aiState === 'pending'" class="ai-tip">后台视觉模型识别中，识别完成将<text class="ai-tip-bold">自动写入数据库</text>并回显到表单，请稍候。</view>

          <!-- AI 识别完成提示 -->
          <view v-if="aiState === 'done'" class="ai-done">
            <mc-icon name="check" color="#06AD56" :size="32" class="ai-done-icon" />
            <text>AI 识别完成 · 已自动保存到数据库，表单已同步</text>
          </view>

          <!-- 标题 -->
          <view class="input-group">
            <text class="input-label">标题 <text class="required">*</text></text>
            <input class="input" v-model="form.title" placeholder="例如:少女感头像" :adjust-position="false" cursor-spacing="80" />
          </view>

          <!-- 资源类型 -->
          <view class="input-group">
            <text class="input-label">资源类型</text>
            <view class="chip-list">
              <view
                class="chip"
                :class="{ 'chip--active': form.type === item.value }"
                v-for="item in typeOptions"
                :key="item.value"
                @tap.stop="onFormTypeChange(item.value)"
              >{{ item.label }}</view>
            </view>
          </view>

          <!-- 状态 -->
          <view class="input-group">
            <text class="input-label">状态</text>
            <view class="chip-list">
              <view
                class="chip"
                :class="{ 'chip--active': form.status === item.value }"
                v-for="item in statusOptions"
                :key="item.value"
                @tap.stop="onFormStatusChange(item.value)"
              >{{ item.label }}</view>
            </view>
          </view>

          <!-- 分类（逗号分隔） -->
          <view class="input-group">
            <text class="input-label">分类 <text class="input-hint-inline">逗号分隔</text></text>
            <input class="input" v-model="form.categories" placeholder="例如:少女, 可爱" :adjust-position="false" cursor-spacing="80" />
          </view>

          <!-- 标签（逗号分隔） -->
          <view class="input-group">
            <text class="input-label">标签 <text class="input-hint-inline">逗号分隔</text></text>
            <input class="input" v-model="form.tags" placeholder="例如:少女感, 粉色" :adjust-position="false" cursor-spacing="80" />
          </view>

          <!-- 热度值 -->
          <view class="input-group">
            <text class="input-label">热度值</text>
            <input class="input" type="number" v-model="form.hotScore" placeholder="0" :adjust-position="false" cursor-spacing="80" />
          </view>

          <!-- 下载量 / 浏览量 -->
          <view class="input-group">
            <text class="input-label">下载量 / 浏览量</text>
            <view class="dual-input">
              <input class="input" type="number" v-model="form.downloadCount" placeholder="下载量" :adjust-position="false" cursor-spacing="80" />
              <input class="input" type="number" v-model="form.viewCount" placeholder="浏览量" :adjust-position="false" cursor-spacing="80" />
            </view>
          </view>

          <!-- 删除此资源 -->
          <view class="del-row" v-if="editing" @tap="onDelete(editing._id)">删除此资源</view>
        </scroll-view>

        <view class="modal-footer">
          <button class="btn btn--default" @tap.stop="closeModal">取消</button>
          <button class="btn btn--primary" @tap.stop="onSave" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import api from '../../utils/api'
import logger from '../../utils/logger'
import { toast, confirm, showLoading, hideLoading } from '../../utils/format'
import { getCloud } from '../../utils/cloud'
import cache from '../../utils/cache'

/* 资源状态（字符串优先，兼容旧数字数据） */
const RESOURCE_STATUS_STR = {
  draft: { label: '草稿', cls: 'spill--draft' },
  review: { label: '待审', cls: 'spill--rev' },
  published: { label: '已发布', cls: 'spill--pub' },
  offline: { label: '已下线', cls: 'spill--off' },
  0: { label: '待审', cls: 'spill--rev' },
  1: { label: '已发布', cls: 'spill--pub' },
  2: { label: '已下线', cls: 'spill--off' },
  3: { label: '草稿', cls: 'spill--draft' },
}

/* AI 识别状态 */
const AI_STATUS = {
  success: { label: 'AI 已识别', cls: 'aibadge--ok' },
  pending: { label: 'AI 处理中', cls: 'aibadge--pro' },
  failed: { label: 'AI 识别失败', cls: 'aibadge--fail' },
}

const TYPE_MAP = {
  wallpaper: { label: '壁纸' },
  avatar: { label: '头像' },
}

const AI_SCAN_PATH = '<path d="M12 2a4 4 0 00-4 4c0 1.5.5 2.5 1 3.5l-2 3h10l-2-3c.5-1 1-2 1-3.5a4 4 0 00-4-4z"/><path d="M9 17v2M15 17v2M7 21h10"/>'

function firstPageCacheKey(activeStatus, activeType, keyword) {
  return 'cache:resource-list:first:' + (activeStatus || 'all') + ':' + (activeType || 'all') + ':' + (keyword || '')
}

function splitList(str) {
  if (!str) return []
  return String(str)
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export default {
  data() {
    return {
      loading: true,
      loadError: false,
      errorMsg: '',
      list: [],
      keyword: '',

      statusFilters: [
        { key: 'all', label: '全部', status: 'all' },
        { key: 'published', label: '已发布', status: 'published' },
        { key: 'review', label: '待审', status: 'review' },
        { key: 'offline', label: '已下线', status: 'offline' },
        { key: 'draft', label: '草稿', status: 'draft' },
      ],
      typeFilters: [
        { key: 'all', label: '全部类型', type: 'all' },
        { key: 'avatar', label: '头像', type: 'avatar' },
        { key: 'wallpaper', label: '壁纸', type: 'wallpaper' },
      ],
      activeStatus: 'all',
      activeType: 'all',

      page: 1,
      pageSize: 20,
      hasMore: true,
      loadingMore: false,

      multiSelect: false,
      selectedIds: [],
      allSelected: false,

      modalVisible: false,
      editing: null,
      saving: false,
      aiState: 'idle',
      aiRecognized: false,
      form: {
        _id: '',
        title: '',
        type: 'avatar',
        status: 'draft',
        categories: '',
        tags: '',
        hotScore: '0',
        downloadCount: '0',
        viewCount: '0',
      },
      aiLabel: 'AI 未识别',

      showBatchSheet: false,
      showBatchStatusModal: false,
      batchStatusTarget: '',
      typeOptions: [
        { value: 'avatar', label: '头像' },
        { value: 'wallpaper', label: '壁纸' },
      ],
      statusOptions: [
        { value: 'draft', label: '草稿' },
        { value: 'review', label: '待审' },
        { value: 'published', label: '已发布' },
        { value: 'offline', label: '已下线' },
      ],
    }
  },

  computed: {
    reviewMode() {
      return this.activeStatus === 'review'
    },
  },

  async onLoad(options) {
    // 支持从管理首页「待审核」直达审核队列：?status=review
    if (options && options.status && this.statusFilters.some((f) => f.key === options.status)) {
      this.activeStatus = options.status
    }
    const key = firstPageCacheKey(this.activeStatus, this.activeType, this.keyword)
    const cached = cache.getCachedStale(key)
    if (cached && cached.list) {
      this.list = cached.list
      this.hasMore = cached.hasMore
      this.page = 1
      this.loading = false
    }
    await getCloud()
    if (cache.isStale(key)) this.loadList(true)
  },

  onPullDownRefresh() {
    this.loadList(true).finally(() => uni.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.hasMore && !this.loadingMore && !this.multiSelect) {
      this.loadList(false)
    }
  },

  methods: {
    buildParams() {
      const status = this.statusFilters.find((f) => f.key === this.activeStatus) || this.statusFilters[0]
      const type = this.typeFilters.find((f) => f.key === this.activeType) || this.typeFilters[0]
      const params = { page: this.page, pageSize: this.pageSize }
      params.type = type.type && type.type !== 'all' ? type.type : 'all'
      if (status.status && status.status !== 'all') params.status = status.status
      if (this.keyword) params.keyword = this.keyword
      return params
    },

    async loadList(reset) {
      const hasCache = this.list.length > 0
      const silentRefresh = reset && hasCache

      if (reset) {
        this.loadError = false
        if (!silentRefresh) {
          this.page = 1
          this.hasMore = true
          this.loading = true
          this.list = []
        }
      } else {
        this.loadingMore = true
      }

      try {
        const params = this.buildParams()
        const res = await api.getResources(params)
        const items = this.normalizeList(res)
        const newList = items.map((r) => this.formatResource(r))

        if (reset) {
          const key = firstPageCacheKey(this.activeStatus, this.activeType, this.keyword)
          cache.setCached(key, { list: newList, hasMore: newList.length >= this.pageSize })

          if (silentRefresh) {
            this.list = newList
            this.hasMore = newList.length >= this.pageSize
            this.page = 1
          } else {
            this.list = newList
            this.loading = false
            this.hasMore = newList.length >= this.pageSize
          }
        } else {
          this.list = this.list.concat(newList)
          this.loadingMore = false
          this.hasMore = newList.length >= this.pageSize
          this.page = this.page + 1
        }
      } catch (err) {
        logger.error('[resource-list] 加载失败', err)
        if (!silentRefresh) {
          this.loading = false
          this.loadingMore = false
          this.loadError = !hasCache
          this.errorMsg = '加载失败，请稍后重试'
        } else {
          this.loadingMore = false
        }
        if (!hasCache) toast('加载失败，下拉重试')
      }
    },

    retryLoad() {
      this.loadList(true)
    },

    normalizeList(res) {
      if (!res) return []
      if (Array.isArray(res)) return res
      if (Array.isArray(res.list)) return res.list
      if (res.data && Array.isArray(res.data)) return res.data
      return []
    },

    formatResource(r) {
      const typeInfo = TYPE_MAP[r.type] || { label: r.type || '未知' }
      const statusInfo = RESOURCE_STATUS_STR[r.status] || { label: r.status || '草稿', cls: 'spill--draft' }
      const aiInfo = r.aiStatus ? (AI_STATUS[r.aiStatus] || AI_STATUS.failed) : null
      const cover = r.coverUrl || r.originUrl || r.thumbnail || r.cover || r.fileID || r.url || r.imageUrl || ''
      const categories = Array.isArray(r.categories)
        ? r.categories.map((c) => (typeof c === 'object' ? c.name || c.title || '' : c)).filter(Boolean)
        : []
      const tags = Array.isArray(r.tags)
        ? r.tags.map((t) => (typeof t === 'object' ? t.name || t.title || '' : t)).filter(Boolean)
        : []
      return {
        _id: r._id || r.id,
        title: r.title || r.name || '未命名',
        type: r.type,
        typeLabel: typeInfo.label,
        status: r.status,
        statusLabel: statusInfo.label,
        statusCls: statusInfo.cls,
        aiStatus: r.aiStatus || '',
        aiCls: aiInfo ? aiInfo.cls : '',
        aiLabel: aiInfo ? aiInfo.label : 'AI 未识别',
        cover,
        categories,
        tags,
        hotScore: r.hotScore || 0,
        downloadCount: r.downloadCount || r.downloads || 0,
        viewCount: r.viewCount || r.views || 0,
        likes: r.likeCount || r.likes || 0,
        views: formatNumberSafe(r.viewCount || r.views || 0),
        downloads: formatNumberSafe(r.downloadCount || r.downloads || 0),
        selected: false,
      }
    },

    /* ── 筛选 ── */
    onStatusFilter(key) {
      if (key === this.activeStatus) return
      this.activeStatus = key
      this.reloadWithCache()
    },

    onTypeFilter(key) {
      if (key === this.activeType) return
      this.activeType = key
      this.reloadWithCache()
    },

    reloadWithCache() {
      const key = firstPageCacheKey(this.activeStatus, this.activeType, this.keyword)
      const cached = cache.getCachedStale(key)
      if (cached && cached.list) {
        this.list = cached.list
        this.hasMore = cached.hasMore
        this.page = 1
        this.loading = false
        this.loadError = false
      }
      this.loadList(!cached)
    },

    /* ── 搜索 ── */
    onSearchConfirm() {
      this.reloadWithCache()
    },

    onClearKeyword() {
      this.keyword = ''
      this.reloadWithCache()
    },

    /* ── 点击卡片 ── */
    onTapItem(id) {
      if (this.multiSelect) {
        this.toggleSelect(id)
        return
      }
      const item = this.list.find((it) => it._id === id)
      if (item) this.openEdit(item)
    },

    onAdd() {
      uni.navigateTo({ url: '/pages/resource-upload/resource-upload' })
    },

    /* ── 批量管理 ── */
    onEnterMulti() {
      this.multiSelect = true
      this.selectedIds = []
      this.allSelected = false
      this.list = this.list.map((it) => ({ ...it, selected: false }))
    },

    onExitMulti() {
      this.multiSelect = false
      this.selectedIds = []
      this.allSelected = false
      this.list = this.list.map((it) => ({ ...it, selected: false }))
    },

    onToggleSelect(id) {
      this.toggleSelect(id)
    },

    toggleSelect(id) {
      const selectedIds = this.selectedIds.slice()
      const idx = selectedIds.indexOf(id)
      const willSelect = idx < 0
      if (willSelect) selectedIds.push(id)
      else selectedIds.splice(idx, 1)
      const listIdx = this.list.findIndex((it) => it._id === id)
      const allSelected = listIdx >= 0 && selectedIds.length === this.list.length
      if (listIdx >= 0) this.list[listIdx].selected = willSelect
      this.selectedIds = selectedIds
      this.allSelected = allSelected
    },

    onSelectAll() {
      const all = !this.allSelected
      this.selectedIds = all ? this.list.map((it) => it._id) : []
      this.list = this.list.map((it) => ({ ...it, selected: all }))
      this.allSelected = all
    },

    onShowBatchSheet() {
      this.showBatchSheet = true
    },

    onCloseBatchSheet() {
      this.showBatchSheet = false
    },

    async runBatch(fn) {
      const ids = this.selectedIds.slice()
      let successCount = 0
      let failCount = 0
      for (let i = 0; i < ids.length; i += 5) {
        const batch = ids.slice(i, i + 5)
        const results = await Promise.all(batch.map((id) => fn(id).then(() => true).catch(() => false)))
        results.forEach((ok) => { if (ok) successCount++; else failCount++ })
      }
      return { successCount, failCount }
    },

    async onBatchAI() {
      if (this.selectedIds.length === 0) return
      this.showBatchSheet = false
      showLoading('提交 AI 识别…')
      try {
        const { successCount, failCount } = await this.runBatch((id) => api.analyzeResource(id))
        hideLoading()
        if (failCount === 0) {
          toast('已提交 ' + successCount + ' 项 AI 识别', 'success')
        } else {
          toast('成功 ' + successCount + ' 项，失败 ' + failCount + ' 项')
        }
        this.onExitMulti()
        this.invalidateAndReload()
      } catch (err) {
        logger.error('[resource-list] 批量 AI 失败', err)
        hideLoading()
        toast('AI 识别失败')
      }
    },

    onBatchStatus() {
      if (this.selectedIds.length === 0) return
      this.showBatchSheet = false
      this.showBatchStatusModal = true
      this.batchStatusTarget = ''
    },

    onBatchStatusSelect(value) {
      if (value) this.batchStatusTarget = value
    },

    async onApplyBatchStatus() {
      const target = this.batchStatusTarget
      if (!target) { toast('请选择状态'); return }
      showLoading('更新状态…')
      try {
        const { successCount, failCount } = await this.runBatch((id) => api.updateResource(id, { status: target }))
        hideLoading()
        if (failCount === 0) {
          toast('状态已更新 ' + successCount + ' 项', 'success')
        } else {
          toast('成功 ' + successCount + ' 项，失败 ' + failCount + ' 项')
        }
        this.showBatchStatusModal = false
        this.onExitMulti()
        this.invalidateAndReload()
      } catch (err) {
        logger.error('[resource-list] 批量状态失败', err)
        hideLoading()
        toast('状态更新失败')
      }
    },

    closeBatchStatusModal() {
      this.showBatchStatusModal = false
      this.batchStatusTarget = ''
    },

    /* ── 审核流：待审队列一键过审/驳回 ── */
    async quickReviewAll(target) {
      const ids = this.list.map((it) => it._id)
      if (ids.length === 0) return
      const label = target === 'published' ? '通过' : '驳回'
      const ok = await confirm(`确认将当前列表中的 ${ids.length} 条待审核资源全部「${label}」？`)
      if (!ok) return
      await this.runReview(ids, target)
    },

    async quickReview(id, target) {
      await this.runReview([id], target)
    },

    async runReview(ids, target) {
      showLoading('审核处理中…')
      try {
        const { successCount, failCount } = await this.runBatch((rid) => api.updateResource(rid, { status: target }))
        hideLoading()
        if (failCount === 0) {
          toast(`已${target === 'published' ? '通过' : '驳回'} ${successCount} 项`, 'success')
        } else {
          toast(`成功 ${successCount} 项，失败 ${failCount} 项`)
        }
        this.invalidateAndReload()
      } catch (err) {
        logger.error('[resource-list] 审核失败', err)
        hideLoading()
        toast('操作失败')
      }
    },

    async onBatchDelete() {
      if (this.selectedIds.length === 0) return
      this.showBatchSheet = false
      const ok = await confirm(`确定移入回收站选中的 ${this.selectedIds.length} 项资源？30 天内可在回收站恢复。`)
      if (!ok) return
      showLoading('删除中…')
      try {
        await api.deleteResources(this.selectedIds.slice())
        hideLoading()
        toast('已移入回收站', 'success')
        this.onExitMulti()
        this.invalidateAndReload()
      } catch (err) {
        logger.error('[resource-list] 批量删除失败', err)
        hideLoading()
        toast('删除失败')
      }
    },

    /* ── 编辑弹窗 ── */
    openEdit(item) {
      const alreadyRecognized = item.aiStatus === 'success'
      this.modalVisible = true
      this.editing = item
      this.aiState = alreadyRecognized ? 'done' : 'idle'
      this.aiRecognized = alreadyRecognized
      this.aiLabel = item.aiLabel || 'AI 未识别'
      this.form = {
        _id: item._id,
        title: item.title || '',
        type: item.type === 'wallpaper' ? 'wallpaper' : 'avatar',
        status: item.status || 'draft',
        categories: (item.categories || []).join(', '),
        tags: (item.tags || []).join(', '),
        hotScore: String(item.hotScore || 0),
        downloadCount: String(item.downloadCount || 0),
        viewCount: String(item.viewCount || 0),
      }
    },

    closeModal() {
      this.modalVisible = false
      this.editing = null
      this.aiState = 'idle'
      this.aiRecognized = false
    },

    /* AI 智能识别 */
    async onAIRecognize() {
      if (this.aiState === 'pending') return
      this.aiState = 'pending'
      try {
        const res = await api.analyzeResource(this.form._id)
        const result = res.result || res
        if (result && result.success !== false) {
          const data = result.data || result
          if (data.title) this.form.title = data.title
          if (data.type) this.form.type = data.type
          if (Array.isArray(data.categories)) this.form.categories = data.categories.join(', ')
          if (Array.isArray(data.tags)) this.form.tags = data.tags.join(', ')
          this.aiState = 'done'
          this.aiRecognized = true
          this.aiLabel = 'AI 已识别'
          toast('AI 识别完成', 'success')
        } else {
          this.aiState = 'done'
          this.aiRecognized = true
          this.aiLabel = 'AI 已识别'
          toast('AI 识别完成', 'success')
        }
      } catch (err) {
        logger.error('[resource-list] AI 识别失败', err)
        this.aiState = 'idle'
        toast('AI 识别失败')
      }
    },

    onFormTypeChange(value) {
      if (value) this.form.type = value
    },

    onFormStatusChange(value) {
      if (value) this.form.status = value
    },

    async onSave() {
      const form = this.form
      if (!form.title.trim()) {
        toast('请输入标题')
        return
      }
      this.saving = true
      try {
        const updateData = {
          title: form.title.trim(),
          type: form.type,
          status: form.status,
          categories: splitList(form.categories),
          tags: splitList(form.tags),
          hotScore: Number(form.hotScore) || 0,
          downloadCount: Number(form.downloadCount) || 0,
          viewCount: Number(form.viewCount) || 0,
        }
        await api.updateResource(form._id, updateData)
        toast('保存成功', 'success')
        this.saving = false
        this.modalVisible = false
        this.editing = null
        this.invalidateAndReload()
      } catch (err) {
        logger.error('[resource-list] 保存失败', err)
        this.saving = false
        toast('保存失败')
      }
    },

    async onDelete(id) {
      const ok = await confirm('确定移入回收站？30 天内可在回收站恢复。')
      if (!ok) return
      showLoading('删除中…')
      try {
        await api.deleteResources([id])
        hideLoading()
        toast('已移入回收站', 'success')
        this.modalVisible = false
        this.editing = null
        this.invalidateAndReload()
      } catch (err) {
        logger.error('[resource-list] 删除失败', err)
        hideLoading()
        toast('删除失败')
      }
    },

    /* 变更后清缓存并刷新 */
    invalidateAndReload() {
      cache.clearByPrefix('cache:resource-list:first:')
      this.loadList(true)
    },
  },
}

/* formatNumber 本地安全版（避免未引入时抛错） */
function formatNumberSafe(num) {
  const n = Number(num)
  if (isNaN(n)) return '0'
  if (n < 1000) return String(n)
  if (n < 1000000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
}
</script>

<style lang="scss" scoped>
.resource-list-page {
  padding-bottom: 180rpx;
}

/* ── 搜索栏 ── */
.search-bar {
  padding: 16rpx 0 20rpx;
}

.search-input-wrap {
  display: flex;
  align-items: center;
  background: var(--bg-card);
  border-radius: var(--r-pill);
  padding: 0 28rpx;
  height: 72rpx;
  gap: 16rpx;
  border: 1rpx solid var(--border);
}

.search-icon {
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: var(--text-primary);
  height: 72rpx;
}

.search-clear {
  width: 40rpx;
  height: 40rpx;
  line-height: 38rpx;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 32rpx;
  flex-shrink: 0;
}

/* ── 双筛选栏 ── */
.filter-bar {
  white-space: nowrap;
  padding-bottom: 16rpx;
}

.filter-bar--second {
  padding-bottom: 20rpx;
}

.filter-bar .filter-chip {
  display: inline-block;
  margin-right: 16rpx;
}

.filter-bar .filter-chip:last-child {
  margin-right: 0;
}

/* ── 提示栏 ── */
.hint-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4rpx 4rpx 20rpx;
}

.hint-text {
  font-size: 22rpx;
  color: var(--text-secondary);
  flex: 1;
  min-width: 0;
}

.hint-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-shrink: 0;
}

.hint-action {
  font-size: 24rpx;
  font-weight: 500;
  color: var(--pri);
  background: var(--pri-l);
  padding: 8rpx 22rpx;
  border-radius: var(--r-pill);
  flex-shrink: 0;
}

.hint-action--primary {
  color: #fff;
  background: var(--pri);
}

.hint-action--approve {
  color: #fff;
  background: var(--pri);
}

.hint-action--reject {
  color: #fff;
  background: var(--danger);
}

.hint-action:active {
  opacity: 0.7;
}

/* ── 网格 ── */
.rgrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
}

.rcard {
  background: var(--bg-card);
  border-radius: var(--r-md);
  overflow: hidden;
  position: relative;
  box-shadow: var(--shadow-card);
}

.rcard--active {
  opacity: 0.88;
}

.rcard--selected {
  box-shadow: 0 0 0 4rpx var(--pri);
}

.rcover {
  position: relative;
  width: 100%;
  padding-bottom: 125%;
  overflow: hidden;
  background: var(--divider);
}

.rcover-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.rcover-ph {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--divider);
}

.rcover-ph-icon {
  opacity: 0.5;
}

.skeleton-card .rcover {
  background: transparent;
}

.rcover-skeleton {
  position: absolute;
  inset: 0;
}

/* 状态角标（左上） */
.spill {
  position: absolute;
  top: 12rpx;
  left: 12rpx;
  z-index: 3;
  padding: 4rpx 16rpx;
  border-radius: var(--r-pill);
  font-size: 18rpx;
  font-weight: 600;
  color: #fff;
  line-height: 1.6;
}

.spill--pub { background: rgba(7, 193, 96, 0.9); }
.spill--rev { background: rgba(255, 149, 0, 0.92); }
.spill--off { background: rgba(148, 163, 184, 0.9); }
.spill--draft { background: rgba(148, 163, 184, 0.75); }

/* AI 角标（右上） */
.aibadge {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 3rpx;
  padding: 4rpx 12rpx;
  border-radius: var(--r-pill);
  font-size: 16rpx;
  font-weight: 700;
  color: #fff;
}

.aibadge--ok { background: rgba(7, 193, 96, 0.92); }
.aibadge--pro { background: rgba(16, 174, 255, 0.94); }
.aibadge--fail { background: rgba(250, 81, 81, 0.94); }

.aibadge-icon {
  width: 18rpx;
  height: 18rpx;
}

.aibadge-text {
  font-size: 16rpx;
  line-height: 1;
}

/* 勾选框（右上 · 批量态） */
.check-btn {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  z-index: 4;
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  border: 3rpx solid rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
}

.check-btn--on {
  background: var(--pri);
  border-color: var(--pri);
}

.check-icon {
  width: 24rpx;
  height: 24rpx;
}

/* 底部标题 + 统计 */
.rcov-b {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  padding: 40rpx 14rpx 12rpx;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.62), transparent);
}

.rtitle {
  font-size: 24rpx;
  font-weight: 600;
  color: #fff;
  line-height: 1.3;
  text-shadow: 0 1rpx 3rpx rgba(0, 0, 0, 0.4);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rstat {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 6rpx;
}

.rstat-item {
  display: flex;
  align-items: center;
  gap: 4rpx;
  font-size: 18rpx;
  color: rgba(255, 255, 255, 0.85);
  font-variant-numeric: tabular-nums;
}

.rstat-icon {
  width: 20rpx;
  height: 20rpx;
}

/* ── 加载更多 ── */
.load-more {
  text-align: center;
  font-size: 24rpx;
  color: var(--text-tertiary);
  padding: 28rpx 0;
}

/* ── 空/错误补充 ── */
.empty-state__icon--lg {
  width: 140rpx;
  height: 140rpx;
}

.empty-state__sub {
  font-size: 24rpx;
  color: var(--text-tertiary);
  text-align: center;
}

/* ── FAB ── */
.fab-icon {
  width: 44rpx;
  height: 44rpx;
}

/* ── 批量操作栏 ── */
.batch-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 60;
  background: var(--bg-card);
  border-top: 1rpx solid var(--border);
  padding: 18rpx 28rpx;
  padding-bottom: calc(18rpx + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  gap: 20rpx;
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.06);
}

.batch-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex-shrink: 0;
}

.card-checkbox {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  border: 3rpx solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-checkbox--on {
  background: var(--pri);
  border-color: var(--pri);
}

.checkbox-icon {
  width: 24rpx;
  height: 24rpx;
}

.batch-count {
  font-size: 26rpx;
  font-weight: 500;
  color: var(--text-primary);
}

/* ── 编辑弹窗 ── */
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.45);
}

.modal-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--bg-card);
  border-radius: 28rpx 28rpx 0 0;
  height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: sheetUp 0.26s ease-out;
}

@keyframes sheetUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx 20rpx;
  border-bottom: 1rpx solid var(--divider);
  flex-shrink: 0;
}

.modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: var(--divider);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close-icon {
  width: 28rpx;
  height: 28rpx;
}

.modal-body {
  height: 1px;
  flex: 1;
  min-height: 0;
  padding: 24rpx 32rpx;
  box-sizing: border-box;
}

.modal-footer {
  flex-shrink: 0;
  display: flex;
  gap: 20rpx;
  padding: 20rpx 32rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid var(--divider);
}

.modal-footer .btn {
  flex: 1;
}

/* 封面预览（只读） */
.cover-preview {
  position: relative;
  width: 100%;
  padding-bottom: 56.25%;
  border-radius: var(--r-sm);
  overflow: hidden;
  margin-bottom: 24rpx;
  background: var(--divider);
}

.cp-bg-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.cp-bg-ph {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cp-ph-icon {
  opacity: 0.5;
}

.cp-tag {
  position: absolute;
  left: 14rpx;
  bottom: 14rpx;
  font-size: 18rpx;
  color: #fff;
  background: rgba(0, 0, 0, 0.45);
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
}

/* 表单内联提示 */
.required {
  color: var(--danger);
}

.input-hint-inline {
  font-size: 20rpx;
  color: var(--text-tertiary);
  font-weight: 400;
  margin-left: 8rpx;
}

/* 选项 chips */
.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.chip {
  padding: 12rpx 28rpx;
  border-radius: var(--r-pill);
  font-size: 24rpx;
  font-weight: 500;
  background: var(--bg-card);
  color: var(--text-secondary);
  border: 1rpx solid var(--divider);
}

.chip--active {
  background: var(--pri-l);
  color: var(--pri);
  border-color: var(--pri);
}

/* 双列输入 */
.dual-input {
  display: flex;
  gap: 16rpx;
}

.dual-input .input {
  flex: 1;
}

/* 删除行 */
.del-row {
  margin-top: 8rpx;
  padding: 26rpx;
  text-align: center;
  border-radius: var(--r-sm);
  background: var(--danger-l);
  color: var(--danger);
  font-size: 28rpx;
  font-weight: 500;
  border: 1rpx solid rgba(250, 81, 81, 0.2);
}

.del-row:active {
  background: #ffd6d6;
}

/* ════════════════════════════════════════════
 * AI 智能识别（编辑弹窗内）
 * ════════════════════════════════════════════ */
.ai-recog {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14rpx;
  height: 92rpx;
  border-radius: 22rpx;
  background: linear-gradient(135deg, #10AEFF, #0C8FD6);
  color: #fff;
  font-size: 28rpx;
  font-weight: 600;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 28rpx rgba(16, 174, 255, 0.3);
}

.ai-recog:active {
  opacity: 0.88;
}

.ai-recog--pending {
  opacity: 0.55;
  pointer-events: none;
}

.ai-recog-icon {
  width: 36rpx;
  height: 36rpx;
}

.ai-tip {
  font-size: 22rpx;
  color: var(--text-secondary);
  background: var(--pri-l);
  padding: 16rpx 24rpx;
  border-radius: 16rpx;
  line-height: 1.6;
  margin-bottom: 28rpx;
}

.ai-tip-bold {
  color: var(--pri-d);
  font-weight: 600;
}

.ai-done {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 22rpx 26rpx;
  border-radius: 20rpx;
  background: var(--pri-l);
  color: var(--pri-d);
  font-size: 24rpx;
  font-weight: 600;
  margin-bottom: 28rpx;
  line-height: 1.5;
}

.ai-done-icon {
  width: 32rpx;
  height: 32rpx;
  flex-shrink: 0;
}

.cp-tag--ai {
  background: var(--info);
}

/* ════════════════════════════════════════════
 * 批量操作聚合主按钮
 * ════════════════════════════════════════════ */
.batch-act-main {
  margin-left: auto;
  height: 76rpx;
  padding: 0 40rpx;
  border-radius: 20rpx;
  background: var(--pri);
  color: #fff;
  font-size: 26rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.batch-act-main:active {
  opacity: 0.88;
}

.batch-act-icon {
  width: 30rpx;
  height: 30rpx;
}

/* ════════════════════════════════════════════
 * 批量操作面板（Action Sheet）
 * ════════════════════════════════════════════ */
.as-mask {
  position: fixed;
  inset: 0;
  z-index: 210;
  background: rgba(0, 0, 0, 0.45);
}

.as-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 211;
  background: var(--bg-card);
  border-radius: 40rpx 40rpx 0 0;
  padding: 16rpx 0 calc(16rpx + env(safe-area-inset-bottom));
  animation: sheetUp 0.25s ease-out;
}

.as-head {
  padding: 28rpx 36rpx 20rpx;
  text-align: center;
  border-bottom: 1rpx solid var(--divider);
}

.as-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.as-sub {
  font-size: 22rpx;
  color: var(--text-secondary);
  margin-top: 4rpx;
}

.as-item {
  display: flex;
  align-items: center;
  gap: 28rpx;
  padding: 30rpx 36rpx;
  border-bottom: 1rpx solid var(--divider);
}

.as-item:active {
  background: #f2f3f5;
}

.as-ico {
  width: 80rpx;
  height: 80rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.as-ico-icon {
  width: 40rpx;
  height: 40rpx;
}

.as-ico--ai { background: var(--info); }
.as-ico--status { background: var(--pri); }
.as-ico--del { background: var(--danger); }

.as-tx {
  display: flex;
  flex-direction: column;
  gap: 2rpx;
}

.as-t {
  font-size: 28rpx;
  font-weight: 500;
  color: var(--text-primary);
}

.as-d {
  font-size: 22rpx;
  color: var(--text-secondary);
}

.as-cancel {
  padding: 28rpx 36rpx;
  text-align: center;
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-secondary);
}

/* ════════════════════════════════════════════
 * 批量改状态弹窗
 * ════════════════════════════════════════════ */
.batch-tip {
  font-size: 24rpx;
  color: var(--text-secondary);
  background: var(--pri-l);
  padding: 16rpx 24rpx;
  border-radius: 16rpx;
  line-height: 1.5;
  margin-bottom: 28rpx;
}

.batch-tip-num {
  color: var(--pri-d);
  font-weight: 700;
}

.batch-status-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.batch-status-item {
  text-align: center;
  padding: 28rpx;
  border-radius: 20rpx;
  font-size: 28rpx;
  font-weight: 500;
  background: var(--bg-card);
  color: var(--text-secondary);
  border: 1rpx solid var(--divider);
}

.batch-status-item--on {
  background: var(--pri-l);
  color: var(--pri);
  border-color: var(--pri);
}
</style>
