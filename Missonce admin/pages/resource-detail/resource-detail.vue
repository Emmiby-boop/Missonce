<template>
  <view class="page-container detail-page">
    <!-- 加载骨架 -->
    <block v-if="loading">
      <view class="skeleton skeleton-preview" />
      <view class="card card--padded">
        <view class="skeleton" style="height: 40rpx; width: 50%; margin-bottom: 24rpx;" />
        <view class="skeleton" style="height: 88rpx;" />
      </view>
    </block>

    <block v-else>
      <!-- 图片预览 -->
      <view class="preview-wrap" v-if="thumbnail" @tap="onPreviewImage">
        <image class="preview-img" :src="thumbnail" mode="aspectFit" />
      </view>

      <!-- 基础信息 -->
      <view class="info-bar">
        <view class="badge badge--blue">{{ type === 'wallpaper' ? '壁纸' : '头像' }}</view>
        <view class="badge" :class="statusBadge">{{ statusLabel }}</view>
      </view>

      <!-- 编辑表单 -->
      <view class="card card--padded form-card">
        <view class="input-group">
          <view class="label-row">
            <text class="input-label">标题</text>
            <button
              class="btn btn--ai btn--sm"
              :class="{ 'btn--loading': analyzing }"
              @tap="onAnalyze"
              :disabled="analyzing"
            >
              <mc-icon name="zap" color="#07C160" :size="28" class="ai-icon" v-if="!analyzing" />
              <text>{{ analyzing ? '识别中…' : 'AI 智能识别' }}</text>
            </button>
          </view>
          <input class="input" v-model="title" placeholder="请输入资源标题" />
        </view>

        <view class="input-group">
          <text class="input-label">类型</text>
          <view class="segment">
            <view
              class="segment-item"
              :class="{ 'segment-item--active': type === item.value }"
              v-for="item in typeOptions"
              :key="item.value"
              @tap="onTypeChange(item.value)"
            >{{ item.label }}</view>
          </view>
        </view>

        <view class="input-group">
          <text class="input-label">分类</text>
          <view class="chip-list" v-if="categories.length > 0">
            <view
              class="chip"
              :class="{ 'chip--active': item.selected }"
              v-for="item in categories"
              :key="item._id"
              @tap="onToggleCat(item._id)"
            >{{ item.name }}</view>
          </view>
          <view class="empty-hint" v-else>暂无分类</view>
        </view>

        <view class="input-group">
          <text class="input-label">标签</text>
          <view class="chip-list" v-if="tags.length > 0">
            <view
              class="chip"
              :class="{ 'chip--active': item.selected }"
              v-for="item in tags"
              :key="item._id"
              @tap="onToggleTag(item._id)"
            >{{ item.name }}</view>
          </view>
          <view class="empty-hint" v-else>暂无标签</view>
        </view>
      </view>

      <!-- 状态操作 -->
      <view class="action-row">
        <button class="btn btn--ghost btn--sm" v-if="status !== 1" @tap="onPublish">发布</button>
        <button class="btn btn--default btn--sm" v-if="status === 1" @tap="onUnpublish">下架</button>
        <button class="btn btn--danger btn--sm" @tap="onDelete">删除</button>
      </view>

      <view class="action-tip" v-if="analyzing">AI 正在分析图片，自动补全类型 / 分类 / 标签…</view>
    </block>

    <!-- 底部保存栏 -->
    <view class="bottom-bar" v-if="!loading">
      <button class="btn btn--primary btn--block" @tap="onSave" :disabled="saving">
        <mc-icon name="save" color="#fff" :size="32" class="bar-icon" />
        <text>{{ saving ? '保存中…' : '保存' }}</text>
      </button>
    </view>
  </view>
</template>

<script>
import api from '../../utils/api'
import logger from '../../utils/logger'
import { getStatusLabel, RESOURCE_STATUS, toast, showLoading, hideLoading, confirm } from '../../utils/format'
import { getCloud } from '../../utils/cloud'

const TYPE_OPTIONS = [
  { value: 'wallpaper', label: '壁纸' },
  { value: 'avatar', label: '头像' },
]

export default {
  data() {
    return {
      id: '',
      loading: true,
      saving: false,
      analyzing: false,
      resource: null,
      title: '',
      type: 'wallpaper',
      status: 0,
      statusLabel: '',
      statusBadge: '',
      thumbnail: '',
      typeOptions: TYPE_OPTIONS,
      categories: [],
      tags: [],
      _prevCats: [],
      _prevTags: [],
    }
  },

  async onLoad(options) {
    const id = (options && options.id) || ''
    this.id = id
    await getCloud()
    this.loadDetail(id)
  },

  methods: {
    getResFromPrevPages(id) {
      const pages = getCurrentPages()
      for (let i = pages.length - 2; i >= 0; i--) {
        const page = pages[i]
        const list = (page && page.data && page.data.list) || (page && page.$vm && page.$vm.list) || null
        if (Array.isArray(list)) {
          const found = list.find((r) => r._id === id)
          if (found) return found
        }
      }
      return null
    },

    async loadDetail(id) {
      if (!id) {
        this.loading = false
        toast('资源 ID 缺失')
        return
      }
      this.loading = true
      // 优先从上一页列表获取基础信息
      const cached = this.getResFromPrevPages(id)
      let resource = cached

      // 尝试通过列表接口补全
      if (!resource) {
        try {
          const res = await api.getResources({ page: 1, pageSize: 100 })
          const list = this.normalizeList(res)
          resource = list.find((r) => (r._id || r.id) === id) || null
        } catch (err) {
          logger.warn('[resource-detail] 列表补全失败', err)
        }
      }

      if (!resource) {
        this.loading = false
        toast('未找到资源')
        return
      }

      const type = resource.type || 'wallpaper'
      const status = resource.status !== undefined ? resource.status : 0
      const statusInfo = getStatusLabel(RESOURCE_STATUS, status)
      this.resource = resource
      this.title = resource.title || resource.name || ''
      this.type = type
      this.status = status
      this.statusLabel = statusInfo.label
      this.statusBadge = statusInfo.badge
      this.thumbnail = resource.coverUrl || resource.originUrl || resource.thumbnail || resource.cover || resource.fileID || resource.url || resource.imageUrl || ''

      // 记录已选分类/标签（若列表项携带），供 loadOptions 标记选中
      this._prevCats = Array.isArray(resource.categories)
        ? resource.categories.map((c) => (typeof c === 'object' ? (c._id || c.id) : c))
        : []
      this._prevTags = Array.isArray(resource.tags)
        ? resource.tags.map((t) => (typeof t === 'object' ? (t._id || t.id) : t))
        : []

      // 加载分类与标签选项
      this.loadOptions(type)
      this.loading = false
    },

    normalizeList(res) {
      if (!res) return []
      if (Array.isArray(res)) return res
      if (Array.isArray(res.list)) return res.list
      if (res.data && Array.isArray(res.data)) return res.data
      return []
    },

    async loadOptions(type) {
      try {
        const [catRes, tagRes] = await Promise.allSettled([
          api.getCategories(type),
          api.getTags(type),
        ])
        const cats = catRes.status === 'fulfilled' ? this.normalizeList(catRes.value) : []
        const tags = tagRes.status === 'fulfilled' ? this.normalizeList(tagRes.value) : []
        const prevCats = this._prevCats || []
        const prevTags = this._prevTags || []
        this.categories = cats.map((c) => {
          const cid = c._id || c.id
          return { _id: cid, name: c.name || c.title || '', selected: prevCats.indexOf(cid) >= 0 }
        })
        this.tags = tags.map((t) => {
          const tid = t._id || t.id
          return { _id: tid, name: t.name || t.title || '', selected: prevTags.indexOf(tid) >= 0 }
        })
      } catch (err) {
        logger.warn('[resource-detail] 加载分类标签失败', err)
      }
    },

    /**
     * AI 智能识别：调用云函数 analyzeResource(id) 后台分析图片并写库
     * 云函数只返回 success 不回传结果，因此必须 reload 详情 + 重新加载分类标签选项回填表单。
     */
    async onAnalyze() {
      if (!this.id) {
        toast('资源 ID 缺失')
        return
      }
      this.analyzing = true
      showLoading('AI 识别中…')
      try {
        await api.analyzeResource(this.id)
        await this.loadDetail(this.id)
        if (this.type) {
          this.loadOptions(this.type)
        }
        hideLoading()
        toast('AI 识别完成', 'success')
      } catch (err) {
        logger.error('[resource-detail] AI 识别失败', err)
        hideLoading()
        toast('AI 识别失败')
      } finally {
        this.analyzing = false
      }
    },

    onTypeChange(type) {
      if (type === this.type) return
      this._prevCats = []
      this._prevTags = []
      this.type = type
      this.loadOptions(type)
    },

    onToggleCat(id) {
      const idx = this.categories.findIndex((c) => c._id === id)
      if (idx < 0) return
      this.categories[idx].selected = !this.categories[idx].selected
    },

    onToggleTag(id) {
      const idx = this.tags.findIndex((t) => t._id === id)
      if (idx < 0) return
      this.tags[idx].selected = !this.tags[idx].selected
    },

    onPreviewImage() {
      if (!this.thumbnail) return
      uni.previewImage({ urls: [this.thumbnail] })
    },

    async onSave() {
      if (!this.title.trim()) {
        toast('请输入标题')
        return
      }
      this.saving = true
      try {
        await api.updateResource(this.id, {
          title: this.title.trim(),
          type: this.type,
          categories: this.categories.filter((c) => c.selected).map((c) => c._id),
          tags: this.tags.filter((t) => t.selected).map((t) => t._id),
        })
        toast('保存成功', 'success')
        setTimeout(() => uni.navigateBack(), 600)
      } catch (err) {
        logger.error('[resource-detail] 保存失败', err)
        toast('保存失败')
      } finally {
        this.saving = false
      }
    },

    onPublish() {
      this.changeStatus(1, '发布')
    },

    onUnpublish() {
      this.changeStatus(0, '下架')
    },

    async changeStatus(status, label) {
      showLoading(`${label}中…`)
      try {
        await api.updateResource(this.id, { status })
        const statusInfo = getStatusLabel(RESOURCE_STATUS, status)
        this.status = status
        this.statusLabel = statusInfo.label
        this.statusBadge = statusInfo.badge
        hideLoading()
        toast(`${label}成功`, 'success')
      } catch (err) {
        logger.error('[resource-detail] 状态更新失败', err)
        hideLoading()
        toast(`${label}失败`)
      }
    },

    async onDelete() {
      const ok = await confirm('确定删除该资源？删除后不可恢复')
      if (!ok) return
      showLoading('删除中…')
      try {
        await api.deleteResources([this.id])
        hideLoading()
        toast('删除成功', 'success')
        setTimeout(() => uni.navigateBack(), 600)
      } catch (err) {
        logger.error('[resource-detail] 删除失败', err)
        hideLoading()
        toast('删除失败')
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.detail-page {
  padding-bottom: 180rpx;
}

/* 图片预览 */
.preview-wrap {
  width: 100%;
  height: 480rpx;
  background: var(--bg-card);
  border-radius: var(--r-lg);
  overflow: hidden;
  margin-bottom: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-card);
}

.preview-img {
  width: 100%;
  height: 100%;
}

.skeleton-preview {
  width: 100%;
  height: 480rpx;
  border-radius: var(--r-lg);
  margin-bottom: 24rpx;
}

/* 信息栏 */
.info-bar {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
  padding: 0 4rpx;
}

/* 表单卡片 */
.form-card {
  margin-bottom: 24rpx;
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
  padding: 18rpx 0;
  font-size: 26rpx;
  color: var(--text-secondary);
  border-radius: 10rpx;
  transition: all 0.2s;
}

.segment-item--active {
  background: var(--bg-card);
  color: var(--pri);
  font-weight: 600;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
}

/* 标签芯片列表 */
.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.chip {
  padding: 12rpx 24rpx;
  border-radius: var(--r-pill);
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

.empty-hint {
  font-size: 24rpx;
  color: var(--text-tertiary);
  padding: 12rpx 0;
}

/* 标题行：label + AI 按钮 同行 */
.label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.btn--ai {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 10rpx 20rpx;
  background: var(--pri-l);
  color: var(--pri);
  border: 1rpx solid var(--pri);
  border-radius: var(--r-pill);
  font-size: 24rpx;
  line-height: 1.2;
}

.btn--ai.btn--loading {
  opacity: 0.7;
}

.ai-icon {
  width: 28rpx;
  height: 28rpx;
}

/* 状态操作行 */
.action-row {
  display: flex;
  gap: 20rpx;
  justify-content: center;
  margin-top: 24rpx;
  margin-bottom: 24rpx;
}

.action-row .btn {
  flex: 1;
  max-width: 240rpx;
}

/* AI 识别提示 */
.action-tip {
  font-size: 22rpx;
  color: var(--pri);
  text-align: center;
  margin-bottom: 16rpx;
}

/* 底部栏按钮 */
.bottom-bar .btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
}

.bar-icon {
  width: 32rpx;
  height: 32rpx;
}
</style>
