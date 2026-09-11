<template>
  <view class="page-container cat-tag-page">
    <!-- 顶部 Tab 切换 -->
    <view class="top-tabs">
      <view
        class="top-tab"
        :class="activeTab === item.key ? 'top-tab--active' : ''"
        v-for="item in tabs"
        :key="item.key"
        :data-key="item.key"
        @tap="onTabChange(item.key)"
      >{{ item.label }}</view>
    </view>

    <!-- 类型筛选 -->
    <scroll-view class="filter-bar" scroll-x="true">
      <view
        class="filter-chip"
        :class="activeType === item.key ? 'filter-chip--active' : ''"
        v-for="item in typeFilters"
        :key="item.key"
        :data-key="item.key"
        @tap="onTypeFilterTap(item.key)"
      >{{ item.label }}</view>
    </scroll-view>

    <!-- 加载骨架 -->
    <view v-if="loading" class="list-card">
      <view class="skeleton-row" v-for="n in 4" :key="n">
        <view class="skeleton" style="width: 48rpx; height: 48rpx; border-radius: 50%; flex-shrink: 0;"></view>
        <view class="skeleton" style="height: 32rpx; flex: 1; max-width: 280rpx;"></view>
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

    <!-- 列表 -->
    <view v-else-if="list.length > 0" class="list-card">
      <view
        class="list-item"
        v-for="item in list"
        :key="item._id"
        :data-id="item._id"
        @tap="onTapItem(item._id)"
        @longpress="onLongPressItem(item._id)"
        hover-class="list-item--active"
      >
        <view class="list-item-icon" :class="item.type === 'avatar' ? 'list-item-icon--purple' : 'list-item-icon--blue'">
          <mc-icon name="tag" :size="38" color="#B8B8C8" class="ct-icon" />
        </view>
        <view class="list-item-text">
          <view class="list-item-title">{{ item.name }}</view>
          <view class="list-item-desc">排序 {{ item.sort }}</view>
        </view>
        <view class="list-item-right">
          <view class="badge" :class="item.type === 'avatar' ? 'badge--purple' : 'badge--blue'">{{ item.type === 'avatar' ? '头像' : '壁纸' }}</view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view class="empty-state" v-else>
      <text class="empty-state__text">暂无{{ activeTab === 'category' ? '分类' : '标签' }}</text>
      <view class="empty-state__action">
        <button class="btn btn--ghost btn--sm" @tap="onAdd">新建</button>
      </view>
    </view>

    <!-- FAB -->
    <view class="fab" @tap="onAdd">
      <mc-icon name="plus" :size="44" color="#FFFFFF" class="fab-icon" />
    </view>

    <!-- 编辑弹层 -->
    <view class="modal-mask" v-if="modalVisible" @tap="closeModal" @touchmove.stop>
      <view class="modal-sheet" @tap.stop @touchmove.stop>
        <view class="modal-header">
          <text class="modal-title">{{ editing ? '编辑' : '新建' }}{{ activeTab === 'category' ? '分类' : '标签' }}</text>
          <view class="modal-close" @tap.stop="closeModal">
            <mc-icon name="x" :size="32" color="#8C8CA1" class="modal-close-icon" />
          </view>
        </view>

        <scroll-view class="modal-body" scroll-y="true">
          <view class="input-group">
            <text class="input-label">名称</text>
            <input class="input" :value="form.name" placeholder="请输入名称" @input="onFormNameInput" :adjust-position="true" cursor-spacing="20" />
          </view>

          <view class="input-group">
            <text class="input-label">类型</text>
            <view class="segment">
              <view
                class="segment-item"
                :class="form.type === item.value ? 'segment-item--active' : ''"
                v-for="item in typeOptions"
                :key="item.value"
                :data-type="item.value"
                @tap.stop="onFormTypeChange(item.value)"
              >{{ item.label }}</view>
            </view>
          </view>

          <view class="input-group">
            <text class="input-label">排序</text>
            <input class="input" type="number" :value="form.sort" placeholder="数字越小越靠前" @input="onFormSortInput" :adjust-position="true" cursor-spacing="20" />
          </view>
        </scroll-view>

        <view class="modal-footer">
          <button class="btn btn--danger" v-if="editing" @tap.stop="onDeleteCurrent" :disabled="saving">删除</button>
          <button class="btn btn--default" @tap.stop="closeModal">取消</button>
          <button class="btn btn--primary" @tap.stop="onSave" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import api from '../../utils/api'
import { error as logError, warn as logWarn } from '../../utils/logger'
import { toast, showLoading, hideLoading, confirm } from '../../utils/format'
import cache from '../../utils/cache'

function cacheKeyOf(tab, type) {
  return 'cache:category-tags:' + tab + ':' + type
}

const TABS = [
  { key: 'category', label: '分类' },
  { key: 'tag', label: '标签' },
]

const TYPE_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'wallpaper', label: '壁纸' },
  { key: 'avatar', label: '头像' },
]

const TYPE_OPTIONS = [
  { value: 'wallpaper', label: '壁纸' },
  { value: 'avatar', label: '头像' },
]

export default {
  data() {
    return {
      loading: true,
      tabs: TABS,
      activeTab: 'category',
      typeFilters: TYPE_FILTERS,
      typeOptions: TYPE_OPTIONS,
      activeType: 'all',
      list: [],
      loadError: false,
      errorMsg: '',
      modalVisible: false,
      editing: null,
      form: { name: '', type: 'wallpaper', sort: 0 },
      saving: false,
    }
  },

  onLoad() {
    this._loadWithCache()
  },

  methods: {
    _loadWithCache() {
      const key = cacheKeyOf(this.activeTab, this.activeType)
      const cached = cache.getCachedStale(key)
      if (cached) {
        this.list = cached
        this.loading = false
      }
      if (cache.isStale(key)) this.loadList(!cached)
    },

    normalizeList(res) {
      if (!res) return []
      if (Array.isArray(res)) return res
      if (Array.isArray(res.list)) return res.list
      return []
    },

    async loadList(showLoading) {
      const key = cacheKeyOf(this.activeTab, this.activeType)
      const hasCache = !!this.list && this.list.length > 0
      const shouldShowLoading = showLoading !== undefined ? showLoading : !hasCache
      if (shouldShowLoading) {
        this.loading = true
        this.loadError = false
      }
      try {
        const type = this.activeType
        const isCat = this.activeTab === 'category'
        const fetcher = isCat ? api.getCategories : api.getTags
        const res = await fetcher(type)
        const items = this.normalizeList(res)
        const list = items.map((c) => ({
          _id: c._id || c.id,
          name: c.name || c.title || '',
          type: c.type || 'wallpaper',
          sort: c.sort !== undefined ? c.sort : (c.sortNumber || c.order || 0),
        }))
        list.sort((a, b) => a.sort - b.sort)
        cache.setCached(key, list)
        this.list = list
        this.loading = false
      } catch (err) {
        logError('[category-tags] 加载失败', err)
        if (shouldShowLoading) {
          this.loading = false
          this.list = []
          this.loadError = true
          this.errorMsg = err.message || '加载失败，请稍后重试'
          toast('加载失败，下拉重试')
        }
      }
    },

    retryLoad() {
      this.loadList(true)
    },

    onTabChange(key) {
      if (key === this.activeTab) return
      this.activeTab = key
      this._loadWithCache()
    },

    onTypeFilterTap(key) {
      if (key === this.activeType) return
      this.activeType = key
      this._loadWithCache()
    },

    onTapItem(id) {
      const item = this.list.find((t) => t._id === id)
      if (!item) return
      this.openEdit(item)
    },

    onLongPressItem(id) {
      const item = this.list.find((t) => t._id === id)
      if (!item) return
      uni.showActionSheet({
        itemList: ['编辑', '删除'],
        itemColor: '#1A1A2E',
        success: (res) => {
          if (res.tapIndex === 0) this.openEdit(item)
          else if (res.tapIndex === 1) this.onDelete(item)
        },
      })
    },

    async onDeleteCurrent() {
      if (!this.editing) return
      await this.onDelete(this.editing)
    },

    async onDelete(item) {
      const ok = await confirm('确定删除「' + item.name + '」？')
      if (!ok) return
      showLoading('删除中…')
      try {
        const collection = this.activeTab === 'category' ? 'categories' : 'tags'
        await api.manageCategories('delete', { collection, id: item._id })
        hideLoading()
        toast('删除成功', 'success')
        this.modalVisible = false
        this.editing = null
        this.formDirty = false
        this.loadList(false)
      } catch (err) {
        logError('[category-tags] 删除失败', err)
        hideLoading()
        toast('删除失败')
      }
    },

    openEdit(item) {
      this.modalVisible = true
      this.editing = item || null
      this.formDirty = false
      this.form = {
        name: item ? item.name : '',
        type: item ? item.type : 'wallpaper',
        sort: item ? item.sort : 0,
      }
    },

    onAdd() {
      const presetType = this.activeType === 'avatar' ? 'avatar' : 'wallpaper'
      this.modalVisible = true
      this.editing = null
      this.formDirty = false
      this.form = { name: '', type: presetType, sort: 0 }
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

    onFormNameInput(e) {
      this.form.name = e.detail.value
      this.formDirty = true
    },

    onFormSortInput(e) {
      this.form.sort = Number(e.detail.value) || 0
      this.formDirty = true
    },

    onFormTypeChange(value) {
      this.form.type = value
      this.formDirty = true
    },

    async onSave() {
      const { name, type, sort } = this.form
      if (!name.trim()) {
        toast('请输入名称')
        return
      }
      this.saving = true
      showLoading('保存中…')
      try {
        const collection = this.activeTab === 'category' ? 'categories' : 'tags'
        const item = { name: name.trim(), type, order: sort }
        if (this.editing) {
          await api.manageCategories('update', {
            collection,
            id: this.editing._id,
            item,
          })
        } else {
          await api.manageCategories('create', {
            collection,
            item,
          })
        }
        hideLoading()
        toast('保存成功', 'success')
        this.modalVisible = false
        this.editing = null
        this.saving = false
        this.formDirty = false
        this.loadList(false)
      } catch (err) {
        logError('[category-tags] 保存失败', err)
        hideLoading()
        this.saving = false
        toast('保存失败')
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.cat-tag-page {
  padding-bottom: 160rpx;
}

/* 顶部 Tab */
.top-tabs {
  display: flex;
  background: var(--bg-card);
  border-radius: var(--r-sm);
  padding: 6rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--shadow-card);
}

.top-tab {
  flex: 1;
  text-align: center;
  padding: 18rpx 0;
  font-size: 28rpx;
  color: var(--text-secondary);
  border-radius: 10rpx;
  transition: all 0.2s;
}

.top-tab--active {
  background: var(--pri);
  color: #fff;
  font-weight: 600;
}

/* 类型筛选 */
.filter-bar {
  white-space: nowrap;
  padding-bottom: 20rpx;
}

.filter-bar .filter-chip {
  display: inline-block;
  margin-right: 16rpx;
}

.filter-bar .filter-chip:last-child {
  margin-right: 0;
}

/* 列表项图标 */
.ct-icon {
  width: 38rpx;
  height: 38rpx;
}

/* 骨架行 */
.skeleton-row {
  display: flex;
  align-items: center;
  padding: 26rpx 32rpx;
  gap: 24rpx;
  border-bottom: 1rpx solid var(--divider);
}

.skeleton-row:last-child {
  border-bottom: none;
}

/* FAB */
.fab-icon {
  width: 44rpx;
  height: 44rpx;
}

/* 弹层 */
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
  height: 0;
  min-height: 0;
}

/* 分段选择器 */
.segment {
  display: flex;
  background: var(--divider);
  border-radius: var(--r-sm);
  padding: 4rpx;
  gap: 4rpx;
}

.segment-item {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  font-size: 26rpx;
  color: var(--text-secondary);
  border-radius: 10rpx;
  transition: all 0.2s;
  min-height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.segment-item--active {
  background: var(--bg-card);
  color: var(--pri);
  font-weight: 600;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
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

.empty-state .btn {
  margin: 0 auto;
}
</style>
