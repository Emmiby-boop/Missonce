<template>
  <view class="page-container home-tabs-page">
    <!-- 加载骨架 -->
    <view v-if="loading" class="list-card">
      <view class="skeleton-tab" v-for="n in skeletonRows" :key="n">
        <view class="skeleton skeleton-block" style="width: 56rpx; height: 56rpx; border-radius: 12rpx;"></view>
        <view class="skeleton-flex">
          <view class="skeleton" style="height: 28rpx; width: 50%;"></view>
          <view class="skeleton" style="height: 22rpx; width: 70%; margin-top: 16rpx;"></view>
        </view>
        <view class="skeleton" style="width: 96rpx; height: 48rpx; border-radius: 12rpx;"></view>
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
    <view v-else-if="list.length > 0">
      <view class="hint-bar">长按左侧手柄拖动排序 · 固定 Tab 不可拖动</view>
      <view class="list-card">
        <view
          class="tab-item"
          :class="[!item.visible ? 'tab-item--hidden' : '', item._dragging ? 'tab-item--dragging' : '']"
          v-for="(item, index) in list"
          :key="item._id"
          :data-id="item._id"
          @tap="onTapItem(item._id)"
          hover-class="tab-item--active"
          :style="{ transform: item._transform }"
        >
          <!-- 拖拽手柄：长按拖动排序（固定 Tab 禁用置灰） -->
          <view
            class="drag-handle"
            :class="item.type === 'fixed' ? 'drag-handle--disabled' : ''"
            :data-index="index"
            @touchstart.stop="onHandleTouchStart"
            @touchmove.stop="onHandleTouchMove"
            @touchend.stop="onHandleTouchEnd"
          >
            <mc-icon name="drag" :size="36" color="#B8B8C8" class="drag-icon" />
          </view>

          <!-- 类型色块图标（装饰） -->
          <view class="tab-icon" :class="item.type === 'fixed' ? 'tab-icon--blue' : 'tab-icon--green'">
            <mc-icon
              :name="item.type === 'fixed' ? 'trending-up' : 'tag'"
              :size="32"
              :color="item.type === 'fixed' ? '#10AEFF' : '#07C160'"
              class="tab-icon__img"
            />
          </view>

          <!-- 标题 + 副标题 -->
          <view class="tab-main">
            <view class="tab-title-wrap">
              <text class="tab-title">{{ item.title }}</text>
              <text class="tab-fixed-tag" v-if="item.type === 'fixed'">({{ item.fixedLabel }})</text>
            </view>
            <view class="tab-sub">
              <text v-if="item.type === 'fixed'">{{ item.fixedLabel }}精选</text>
              <block v-else>标签：{{ item.tag || '未设置' }} · {{ item.resourceTypeLabel }}</block>
            </view>
          </view>

          <!-- 显示/隐藏切换 -->
          <view
            class="toggle-btn"
            :class="item.visible ? 'toggle-btn--on' : 'toggle-btn--off'"
            :data-id="item._id"
            @tap.stop="onToggle(item._id)"
          >{{ item.visible ? '显示中' : '已隐藏' }}</view>
        </view>
      </view>

      <!-- 拖拽全屏遮罩 -->
      <view class="drag-overlay" v-if="dragging" @touchmove.stop="onHandleTouchMove" @touchend.stop="onHandleTouchEnd"></view>
    </view>

    <!-- 空状态 -->
    <view class="empty-state" v-else>
      <mc-icon name="layout" :size="120" color="#B8B8C8" class="empty-state__icon" />
      <text class="empty-state__text">暂无 Tab 配置</text>
      <text class="empty-state__sub">初始化默认配置或手动新增标签 Tab</text>
      <view class="empty-actions">
        <button class="btn btn--ghost btn--sm" @tap="onInitDefault">初始化默认配置</button>
        <button class="btn btn--primary btn--sm" @tap="onAdd">手动新增</button>
      </view>
    </view>

    <!-- 新增按钮(列表非空时) -->
    <view class="fab" v-if="!loading && list.length > 0" @tap="onAdd">
      <mc-icon name="plus" :size="48" color="#FFFFFF" class="fab-icon" />
    </view>

    <!-- 编辑/新增弹层 -->
    <view class="modal-mask" v-if="modalVisible" @tap="closeModal" @touchmove.stop>
      <view class="modal-sheet" @tap.stop @touchmove.stop>
        <view class="modal-header">
          <text class="modal-title">{{ editing ? '编辑 Tab' : '新增标签 Tab' }}</text>
          <view class="modal-close" @tap.stop="closeModal">
            <mc-icon name="x" :size="32" color="#8C8CA1" class="modal-close-icon" />
          </view>
        </view>

        <scroll-view class="modal-body" scroll-y="true">
          <!-- Tab 名称 -->
          <view class="input-group">
            <text class="input-label">Tab 名称</text>
            <input class="input" :value="form.title" placeholder="例如:少女感" @input="onFormTitleInput" :adjust-position="true" cursor-spacing="20" />
          </view>

          <!-- 筛选标签(仅 tag 类型) -->
          <view class="input-group" v-if="!isFixedType">
            <text class="input-label">筛选标签</text>
            <picker v-if="tagOptions.length > 0" mode="selector" :range="tagOptions" :value="tagIndex" @change="onFormTagChange">
              <view class="picker-row">
                <text class="picker-value" :class="form.tag ? '' : 'picker-value--placeholder'">{{ form.tag || '请选择标签' }}</text>
                <text class="picker-arrow-text">▾</text>
              </view>
            </picker>
            <view class="picker-row" v-else>
              <text class="picker-value picker-value--placeholder">暂无可用标签</text>
            </view>
            <text class="input-hint">标签来自标签管理,需先在标签管理中创建</text>
          </view>

          <!-- 资源类型 -->
          <view class="input-group">
            <text class="input-label">资源类型</text>
            <view class="chip-list">
              <view
                class="chip"
                :class="form.resourceType === item.value ? 'chip--active' : ''"
                v-for="item in resourceTypes"
                :key="item.value"
                :data-value="item.value"
                @tap.stop="onFormResourceTypeChange(item.value)"
              >{{ item.label }}</view>
            </view>
          </view>

          <!-- 排序方式 -->
          <view class="input-group">
            <text class="input-label">内容排序</text>
            <view class="chip-list" :class="isFixedType ? 'chip-list--disabled' : ''">
              <view
                class="chip"
                :class="form.sortBy === item.value ? 'chip--active' : ''"
                v-for="item in sortBys"
                :key="item.value"
                :data-value="item.value"
                @tap.stop="onFormSortByChange(item.value)"
              >{{ item.label }}</view>
            </view>
            <text class="input-hint" v-if="isFixedType">固定 Tab 排序方式由类型决定,不可修改</text>
          </view>

          <!-- 显示/隐藏 -->
          <view class="input-group">
            <text class="input-label">显示状态</text>
            <view class="visible-row" @tap.stop="onFormVisibleChange">
              <view class="toggle" :class="form.visible ? 'toggle--on' : ''">
                <view class="toggle__knob"></view>
              </view>
              <text class="visible-text">{{ form.visible ? '显示在首页' : '已隐藏' }}</text>
            </view>
          </view>

          <!-- 删除（仅标签 Tab 编辑时显示） -->
          <view class="del-row" v-if="editing && !isFixedType" :data-id="editing._id" @tap="onDelete(editing._id)">删除此 Tab</view>
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
import { error as logError, warn as logWarn } from '../../utils/logger'
import { toast, showLoading, hideLoading, confirm } from '../../utils/format'
import cache from '../../utils/cache'

const CACHE_KEY_LIST = 'cache:home-tabs:list'
const CACHE_KEY_TAGS = 'cache:home-tabs:tags'

const RESOURCE_TYPES = [
  { value: 'all', label: '全部' },
  { value: 'avatar', label: '头像' },
  { value: 'wallpaper', label: '壁纸' },
]
const SORT_BY = [
  { value: 'hot', label: '热门' },
  { value: 'latest', label: '最新' },
  { value: 'random', label: '随机' },
]

export default {
  data() {
    return {
      loading: true,
      list: [],
      dragging: false,
      dragIndex: -1,
      dragCurrent: -1,
      loadError: false,
      errorMsg: '',
      modalVisible: false,
      editing: null,
      isFixedType: false,
      tagIndex: 0,
      form: { title: '', tag: '', resourceType: 'all', sortBy: 'hot', visible: true },
      saving: false,
      tagOptions: [],
      resourceTypes: RESOURCE_TYPES,
      sortBys: SORT_BY,
      skeletonRows: [1, 2, 3],
    }
  },

  onLoad() {
    const cachedList = cache.getCachedStale(CACHE_KEY_LIST)
    const cachedTags = cache.getCachedStale(CACHE_KEY_TAGS)
    if (cachedList) {
      this.list = cachedList.map((t) => Object.assign({}, t, { _transform: t._transform || '', _dragging: !!t._dragging }))
      this.loading = false
    }
    if (cachedTags) this.tagOptions = cachedTags
    if (cache.isStale(CACHE_KEY_LIST)) this.loadList(!cachedList)
    if (cache.isStale(CACHE_KEY_TAGS)) this.loadTags()
  },

  onPullDownRefresh() {
    this.loadList(true).finally(() => uni.stopPullDownRefresh())
  },

  methods: {
    labelOf(arr, value) {
      const found = arr.find((i) => i.value === value)
      return found ? found.label : ''
    },

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
        const res = await api.getHomeTabs()
        const items = this.normalizeList(res)
        const list = items.map((t, idx) => {
          const type = t.type || 'tag'
          const fixedId = t.fixedId || ''
          const sortBy = type === 'fixed'
            ? (fixedId === 'recommend' ? 'hot' : 'latest')
            : (t.sortBy || 'hot')
          return {
            _id: t._id || t.id,
            title: t.title || '',
            type,
            fixedId,
            tag: t.tag || '',
            resourceType: t.resourceType || 'all',
            sortBy,
            visible: t.visible !== false,
            sort: t.sort !== undefined ? t.sort : idx,
            typeLabel: type === 'fixed' ? '固定' : '标签',
            fixedLabel: fixedId === 'recommend' ? '热门' : '最新',
            resourceTypeLabel: this.labelOf(RESOURCE_TYPES, t.resourceType),
            sortByLabel: this.labelOf(SORT_BY, sortBy),
            _transform: '',
            _dragging: false,
          }
        })
        list.sort((a, b) => a.sort - b.sort)
        cache.setCached(CACHE_KEY_LIST, list)
        this.list = list
        this.loading = false
      } catch (err) {
        logError('[home-tabs] 加载失败', err)
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

    async loadTags() {
      try {
        const res = await api.getTags('all')
        const tags = (res || []).map((t) => t.name).filter(Boolean)
        cache.setCached(CACHE_KEY_TAGS, tags)
        this.tagOptions = tags
      } catch (err) {
        logError('[home-tabs] 加载标签失败', err)
      }
    },

    async onToggle(id) {
      const idx = this.list.findIndex((t) => t._id === id)
      if (idx < 0) return
      const tab = this.list[idx]
      try {
        const res = await api.manageHomeTabs('toggleVisible', { id })
        const visible = res && res.data ? res.data.visible : !tab.visible
        this.list[idx].visible = visible
        toast(visible ? '已显示' : '已隐藏', 'success')
      } catch (err) {
        logError('[home-tabs] 切换失败', err)
        toast('操作失败')
      }
    },

    onMoveUp(index) {
      if (index <= 0) return
      this.swap(index, index - 1)
    },

    onMoveDown(index) {
      if (index >= this.list.length - 1) return
      this.swap(index, index + 1)
    },

    swap(i, j) {
      const list = this.list.slice()
      const tmp = list[i]
      list[i] = list[j]
      list[j] = tmp
      list.forEach((t, idx) => { t.sort = idx })
      this.list = list
      this.persistOrder(list)
    },

    async persistOrder(list) {
      try {
        const tabsData = list
          .filter((item) => item._id)
          .map((item, index) => ({ id: item._id, sort: index }))
        if (tabsData.length === 0) {
          toast('Tab 数据异常，缺少 ID')
          return
        }
        await api.manageHomeTabs('sort', { data: { tabs: tabsData } })
      } catch (err) {
        logError('[home-tabs] 排序保存失败', err)
        toast('排序保存失败')
        this.loadList(false)
      }
    },

    // ====== 长按拖拽排序 ======
    onHandleTouchStart(e) {
      const idx = Number(e.currentTarget.dataset.index)
      const item = this.list[idx]
      if (!item || item.type === 'fixed') return
      const t = e.touches[0]
      this._drag = { startX: t.clientX, startY: t.clientY, idx }
      this._armed = false
      this._timer = setTimeout(() => {
        this._armed = true
        this.beginDrag(idx, this._drag.startY)
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
      this.applyDrag(t.clientY)
    },

    onHandleTouchEnd() {
      clearTimeout(this._timer)
      if (this._armed && this.dragging) this.endDrag()
      this._drag = null
      this._armed = false
    },

    beginDrag(idx, startY) {
      const query = uni.createSelectorQuery()
      query.selectAll('.tab-item').boundingClientRect()
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
        this.applyDrag(startY)
      })
    },

    applyDrag(pointerY) {
      const rects = this._rects
      if (!rects || !rects.length) return
      const idx = this.dragIndex
      if (idx < 0) return
      let newCurrent = idx
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i]
        if (pointerY >= r.top && pointerY <= r.top + r.height) { newCurrent = i; break }
      }
      if (pointerY < rects[0].top) newCurrent = 0
      const last = rects.length - 1
      if (pointerY > rects[last].top + rects[last].height) newCurrent = last
      const draggedH = rects[idx].height
      const list = this.list.map((it, i) => {
        if (i === idx) {
          const follow = pointerY - (rects[idx].top + rects[idx].height / 2)
          return Object.assign({}, it, { _dragging: true, _transform: 'translateY(' + follow + 'px) scale(1.05)' })
        }
        let shift = 0
        if (idx < newCurrent) {
          if (i > idx && i <= newCurrent) shift = -draggedH
        } else if (idx > newCurrent) {
          if (i >= newCurrent && i < idx) shift = draggedH
        }
        return Object.assign({}, it, { _dragging: false, _transform: shift ? 'translateY(' + shift + 'px)' : '' })
      })
      this.dragCurrent = newCurrent
      this.list = list
    },

    endDrag() {
      const idx = this.dragIndex
      const to = this.dragCurrent
      const clean = this.list.map((it) => Object.assign({}, it, { _transform: '', _dragging: false }))
      if (idx >= 0 && to >= 0 && idx !== to) {
        const moved = clean.splice(idx, 1)[0]
        clean.splice(to, 0, moved)
        clean.forEach((t, i) => { t.sort = i })
        this.dragging = false
        this.dragIndex = -1
        this.dragCurrent = -1
        this.list = clean
        this.persistOrder(clean)
      } else {
        this.dragging = false
        this.dragIndex = -1
        this.dragCurrent = -1
        this.list = clean
      }
      this._rects = null
    },

    onTapItem(id) {
      const tab = this.list.find((t) => t._id === id)
      if (!tab) return
      this.openEdit(tab)
    },

    openEdit(tab) {
      const isFixed = !!(tab && tab.type === 'fixed')
      const sortBy = isFixed
        ? (tab.fixedId === 'recommend' ? 'hot' : 'latest')
        : (tab ? tab.sortBy || 'hot' : 'hot')
      const tag = tab ? (tab.tag || '') : ''
      const tagIndex = Math.max(0, this.tagOptions.indexOf(tag))
      this.modalVisible = true
      this.editing = tab || null
      this.formDirty = false
      this.isFixedType = isFixed
      this.tagIndex = tagIndex
      this.form = {
        title: tab ? tab.title : '',
        tag,
        resourceType: tab ? (tab.resourceType || 'all') : 'all',
        sortBy,
        visible: tab ? tab.visible !== false : true,
      }
    },

    onAdd() {
      this.modalVisible = true
      this.editing = null
      this.formDirty = false
      this.isFixedType = false
      this.tagIndex = 0
      this.form = {
        title: '',
        tag: '',
        resourceType: 'all',
        sortBy: 'hot',
        visible: true,
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

    onFormTagChange(e) {
      const idx = Number(e.detail.value)
      const tag = this.tagOptions[idx] || ''
      this.tagIndex = idx
      this.form.tag = tag
      this.formDirty = true
    },

    onFormResourceTypeChange(value) {
      this.form.resourceType = value
      this.formDirty = true
    },

    onFormSortByChange(value) {
      if (this.isFixedType) return
      this.form.sortBy = value
      this.formDirty = true
    },

    onFormVisibleChange() {
      this.form.visible = !this.form.visible
      this.formDirty = true
    },

    async onSave() {
      const { title, tag, resourceType, sortBy, visible } = this.form
      const editing = this.editing
      if (!title || !title.trim()) {
        toast('请输入 Tab 名称')
        return
      }
      if (!editing || editing.type === 'tag') {
        if (!tag) {
          toast('请选择筛选标签')
          return
        }
      }
      this.saving = true
      showLoading('保存中…')
      try {
        if (editing) {
          const finalSortBy = editing.type === 'fixed'
            ? (editing.fixedId === 'recommend' ? 'hot' : 'latest')
            : sortBy
          await api.manageHomeTabs('update', {
            id: editing._id,
            data: {
              title: title.trim(),
              tag,
              resourceType,
              sortBy: finalSortBy,
              visible,
            },
          })
          toast('保存成功', 'success')
        } else {
          await api.manageHomeTabs('add', {
            data: {
              type: 'tag',
              title: title.trim(),
              tag,
              resourceType,
              sortBy,
              visible,
              sort: this.list.length,
            },
          })
          toast('创建成功', 'success')
        }
        hideLoading()
        this.modalVisible = false
        this.editing = null
        this.saving = false
        this.formDirty = false
        this.loadList(false)
      } catch (err) {
        logError('[home-tabs] 保存失败', err)
        hideLoading()
        this.saving = false
        toast('保存失败')
      }
    },

    async onDelete(id) {
      const tab = this.list.find((t) => t._id === id)
      if (!tab) return
      const confirmed = await confirm(`确定删除「${tab.title}」Tab 吗？`)
      if (!confirmed) return
      showLoading('删除中…')
      try {
        await api.manageHomeTabs('delete', { id })
        hideLoading()
        toast('已删除', 'success')
        this.loadList(false)
      } catch (err) {
        logError('[home-tabs] 删除失败', err)
        hideLoading()
        toast('删除失败')
      }
    },

    async onInitDefault() {
      const confirmed = await confirm('将创建「推荐」和「最新」两个固定 Tab')
      if (!confirmed) return
      showLoading('初始化中…')
      try {
        const res = await api.manageHomeTabs('initDefault', {})
        hideLoading()
        if (res && res.success === false) {
          toast((res && res.message) || '初始化失败')
        } else {
          toast('初始化成功', 'success')
        }
        this.loadList(false)
      } catch (err) {
        logError('[home-tabs] 初始化失败', err)
        hideLoading()
        toast('初始化失败')
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.home-tabs-page {
  padding-bottom: 160rpx;
}

/* 提示条 */
.hint-bar {
  font-size: 22rpx;
  color: var(--text-tertiary);
  margin-bottom: 16rpx;
  padding: 0 4rpx;
  line-height: 1.5;
}

/* 骨架行 */
.skeleton-tab {
  display: flex;
  align-items: center;
  padding: 32rpx;
  gap: 24rpx;
  border-bottom: 1rpx solid var(--divider);
}

.skeleton-tab:last-child {
  border-bottom: none;
}

.skeleton-flex {
  flex: 1;
  min-width: 0;
}

/* Tab 卡片 */
.tab-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid var(--divider);
  transition: transform 0.28s cubic-bezier(0.18, 0.89, 0.32, 1.28), opacity 0.2s, box-shadow 0.2s, background 0.2s;
  will-change: transform;
}

.tab-item--dragging {
  position: relative;
  z-index: 5;
  box-shadow: 0 16rpx 50rpx rgba(0, 0, 0, 0.22);
  background: var(--bg-card);
  transition: box-shadow 0.2s, background 0.2s, opacity 0.2s;
  opacity: 0.95;
}

.tab-item:last-child {
  border-bottom: none;
}

.tab-item--active {
  background: var(--divider);
}

.tab-item--hidden {
  opacity: 0.5;
}

/* 顶部行 */
.tab-head {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.tab-index {
  width: 48rpx;
  height: 48rpx;
  border-radius: 12rpx;
  background: var(--divider);
  color: var(--text-secondary);
  font-size: 24rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* 类型标识 */
.type-badge {
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  font-size: 20rpx;
  font-weight: 500;
  flex-shrink: 0;
}

.type-badge--blue {
  background: var(--info-l);
  color: var(--info);
}

.type-badge--green {
  background: var(--pri-l);
  color: var(--pri);
}

/* 标题 */
.tab-title-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}

.tab-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-fixed-tag {
  font-size: 22rpx;
  color: var(--text-secondary);
  flex-shrink: 0;
}

/* 配置摘要 */
.config-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 18rpx;
}

.summary-chip {
  font-size: 22rpx;
  color: var(--text-secondary);
  background: var(--divider);
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
}

/* 拖拽手柄：长按拖动排序 */
.drag-handle {
  width: 64rpx;
  height: 88rpx;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
  cursor: grab;
}

.drag-icon {
  width: 36rpx;
  height: 36rpx;
}

.drag-handle--disabled {
  opacity: 0.3;
  cursor: default;
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

/* 类型色块图标（装饰） */
.tab-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 14rpx;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-icon--blue {
  background: var(--info-l);
}

.tab-icon--green {
  background: var(--pri-l);
}

.tab-icon__img {
  width: 32rpx;
  height: 32rpx;
}

/* 主内容 */
.tab-main {
  flex: 1;
  min-width: 0;
}

.tab-sub {
  font-size: 22rpx;
  color: var(--text-secondary);
  margin-top: 6rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 显示/隐藏切换按钮 */
.toggle-btn {
  padding: 12rpx 22rpx;
  border-radius: 10rpx;
  font-size: 22rpx;
  font-weight: 500;
  flex-shrink: 0;
}

.toggle-btn--on {
  background: var(--pri-l);
  color: var(--pri);
}

.toggle-btn--off {
  background: var(--divider);
  color: var(--text-secondary);
}

/* 删除此 Tab（编辑弹窗内） */
.del-row {
  margin-top: 12rpx;
  padding: 26rpx;
  text-align: center;
  border-radius: 12rpx;
  background: var(--red-l);
  color: var(--red);
  font-size: 28rpx;
  font-weight: 500;
}

.del-row:active {
  background: #ffd6d6;
}

/* 空状态 */
.empty-state__sub {
  font-size: 24rpx;
  color: var(--text-tertiary);
  margin-top: -8rpx;
}

.empty-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 16rpx;
}

/* 浮动新增按钮 */
.fab-icon {
  width: 48rpx;
  height: 48rpx;
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
  width: 32rpx;
  height: 32rpx;
}

.modal-body {
  flex: 1;
  min-height: 0;
  max-height: 62vh;
}

/* picker 行 */
.picker-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: 12rpx;
  padding: 0 28rpx;
}

.picker-value {
  font-size: 28rpx;
  color: var(--text-primary);
}

.picker-value--placeholder {
  color: var(--text-tertiary);
}

.picker-arrow-text {
  font-size: 24rpx;
  color: var(--text-tertiary);
}

/* chip 列表(单选) */
.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.chip {
  padding: 14rpx 28rpx;
  border-radius: 100rpx;
  font-size: 24rpx;
  background: var(--bg-card);
  color: var(--text-secondary);
  border: 1rpx solid var(--border);
}

.chip--active {
  background: var(--pri-l);
  color: var(--pri);
  border-color: var(--pri);
}

.chip-list--disabled {
  opacity: 0.5;
  pointer-events: none;
}

/* 输入提示 */
.input-hint {
  display: block;
  font-size: 22rpx;
  color: var(--text-tertiary);
  margin-top: 10rpx;
}

/* 显示状态行 */
.visible-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  height: 88rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: 12rpx;
  padding: 0 28rpx;
}

.visible-text {
  font-size: 26rpx;
  color: var(--text-secondary);
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
</style>
