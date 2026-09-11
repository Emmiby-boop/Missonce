<template>
  <view class="page">
    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <mc-icon class="search-icon" :path="icons.search" color="#8C8CA1" :size="32" />
        <input class="search-input" :value="keyword" placeholder="搜索文案内容或标签" @input="onSearchInput" @confirm="onSearchConfirm" confirm-type="search" />
        <view class="search-clear" v-if="keyword" @tap.stop="onClearSearch">
          <mc-icon class="search-clear-icon" :path="icons.x" color="#8C8CA1" :size="28" />
        </view>
      </view>
    </view>

    <!-- 分类筛选 -->
    <scroll-view class="filter-bar" scroll-x enhanced :show-scrollbar="false">
      <view class="filter-chip" :class="{ 'filter-chip--active': activeCategory === '' }" @tap="onCategoryTap('')">全部</view>
      <view
        class="filter-chip"
        :class="{ 'filter-chip--active': activeCategory === item }"
        v-for="item in categories"
        :key="item"
        @tap="onCategoryTap(item)"
      >{{ item }}</view>
    </scroll-view>

    <!-- AI 生成区域 -->
    <view class="gen-section">
      <view class="gen-header">
        <text class="gen-title">AI 批量生成</text>
        <view class="gen-config-link" @tap.stop="onGoConfig">
          <text>文案模型配置</text>
          <text class="gen-config-arrow">›</text>
        </view>
      </view>
      <view class="gen-controls">
        <picker mode="selector" :range="categories" :value="genCategoryIndex" @change="onGenCategoryChange">
          <view class="gen-category-display">
            <text>{{ categories[genCategoryIndex] }}</text>
            <text class="picker-arrow">▾</text>
          </view>
        </picker>
        <mc-btn type="primary" size="sm" :loading="generating" :disabled="generating" @click="onGenerate">{{ generating ? '生成中…' : '开始生成' }}</mc-btn>
      </view>
      <view class="gen-preview" v-if="generatedQuotes.length > 0">
        <view class="gen-preview-head">
          <text class="gen-preview-title">已生成 {{ generatedQuotes.length }} 条</text>
          <view class="gen-preview-actions">
            <mc-btn type="ghost" size="xs" @click="onClearGenerated">清空</mc-btn>
            <mc-btn type="primary" size="xs" :loading="savingGen" :disabled="savingGen" @click="onSaveGenerated">{{ savingGen ? '保存中…' : '全部保存' }}</mc-btn>
          </view>
        </view>
        <view class="gen-preview-list">
          <view class="gen-preview-item" v-for="(q, index) in generatedQuotes" :key="index">
            <text class="gen-preview-num">{{ index + 1 }}</text>
            <text class="gen-preview-text">{{ q }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 添加文案 -->
    <view class="add-section">
      <view class="add-header" @tap.stop="onToggleAdd">
        <text class="add-title">手动添加文案</text>
        <text class="add-arrow">{{ showAddForm ? '收起' : '展开' }}</text>
      </view>
      <block v-if="showAddForm">
        <view class="add-form">
          <view class="input-group">
            <text class="input-label">分类</text>
            <picker mode="selector" :range="categories" :value="formCategoryIndex" @change="onFormCategoryChange">
              <view class="picker-display">
                <text>{{ categories[formCategoryIndex] }}</text>
                <text class="picker-arrow">▾</text>
              </view>
            </picker>
          </view>
          <view class="input-group">
            <text class="input-label">内容</text>
            <textarea class="input textarea" :value="formContent" placeholder="输入文案内容..." @input="onFormContentInput" :adjust-position="true" cursor-spacing="80" maxlength="-1" auto-height />
          </view>
          <view class="input-group">
            <text class="input-label">标签（逗号分隔）</text>
            <input class="input" :value="formTags" placeholder="如：治愈,简约" @input="onFormTagsInput" :adjust-position="true" cursor-spacing="80" />
          </view>
          <mc-btn type="primary" :loading="saving" :disabled="saving" @click="onAddQuote">{{ saving ? '保存中…' : '保存文案' }}</mc-btn>
        </view>
      </block>
    </view>

    <!-- 文案列表 -->
    <view class="list-section">
      <view class="list-header">
        <text class="list-title">文案列表 · {{ total }} 条</text>
        <view class="list-filter">
          <text class="filter-btn" :class="{ 'filter-btn--active': activeStatus === 'all' }" @tap="onStatusTap('all')">全部</text>
          <text class="filter-btn" :class="{ 'filter-btn--active': activeStatus === 'published' }" @tap="onStatusTap('published')">已发布</text>
          <text class="filter-btn" :class="{ 'filter-btn--active': activeStatus === 'draft' }" @tap="onStatusTap('draft')">草稿</text>
        </view>
      </view>

      <block v-if="list.length > 0">
        <view class="quote-card" v-for="item in list" :key="item._id">
          <view class="quote-card__body">
            <text class="quote-card__content">{{ item.content }}</text>
            <view class="quote-card__meta">
              <text class="quote-card__cat" v-if="item.category">{{ item.category }}</text>
              <text class="quote-card__tag" v-for="(tag, ti) in (item.tags || [])" :key="ti">{{ tag }}</text>
              <text class="quote-card__status" :class="'quote-card__status--' + item.status">{{ item.status === 'published' ? '已发布' : '草稿' }}</text>
            </view>
          </view>
          <view class="quote-card__actions">
            <view class="icon-btn" @tap="onToggleStatus(item)">
              <text class="icon-btn__text">{{ item.status === 'published' ? '撤回' : '发布' }}</text>
            </view>
            <view class="icon-btn icon-btn--danger" @tap="onDelete(item)">
              <mc-icon class="icon-btn__img" :path="icons.trash" color="#FF3B30" :size="32" />
            </view>
          </view>
        </view>
      </block>

      <mc-empty v-else-if="!loading" text="暂无文案，可使用 AI 批量生成或手动添加" />

      <view class="load-more" v-if="hasMore && list.length > 0">
        <text class="load-more__text">{{ loadingMore ? '加载中…' : '上拉加载更多' }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import api from '../../utils/api'
import { showLoading, hideLoading, toast, confirm } from '../../utils/format'
import logger from '../../utils/logger'

const CATEGORIES = ['朋友圈', '个性签名', '表白文案', '励志文案', '治愈文案', '伤感文案', '生日文案', '节日文案']

export default {
  data() {
    return {
      loading: true,
      list: [],
      total: 0,
      hasMore: false,
      loadingMore: false,
      keyword: '',
      activeCategory: '',
      activeStatus: 'all',
      page: 1,
      pageSize: 20,
      categories: CATEGORIES,
      icons: {
        search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
        x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
        trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
      },
      generating: false,
      genCountIndex: 2,
      genCounts: [3, 5, 8, 10],
      genCategoryIndex: 0,
      generatedQuotes: [],
      savingGen: false,
      showAddForm: false,
      formCategoryIndex: 0,
      formContent: '',
      formTags: '',
      saving: false,
    }
  },

  onLoad() {
    this.loadList(true)
  },

  onGoConfig() {
    uni.navigateTo({ url: '/pages/ai-config/ai-config?tab=writer' })
  },

  onPullDownRefresh() {
    this.loadList(true).then(() => uni.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.hasMore && !this.loadingMore) this.loadMore()
  },

  methods: {
    async loadList(reset) {
      const page = reset ? 1 : this.page
      if (reset) { this.page = 1; this.loading = true }
      try {
        const res = await api.getQuotes({
          page: page,
          pageSize: this.pageSize,
          category: this.activeCategory,
          keyword: this.keyword,
          status: this.activeStatus === 'all' ? '' : this.activeStatus,
        })
        const newList = res.data || []
        const list = reset ? newList : this.list.concat(newList)
        this.list = list
        this.total = res.total || 0
        this.hasMore = list.length < (res.total || 0)
        this.loading = false
      } catch (err) {
        logger.error('[quotes-manage] 加载失败', err)
        this.loading = false
        toast('加载失败')
      }
    },

    loadMore() {
      this.loadingMore = true
      this.page = this.page + 1
      this.loadList(false).then(() => { this.loadingMore = false })
    },

    onSearchInput(e) { this.keyword = e.detail.value },
    onSearchConfirm() { this.loadList(true) },
    onClearSearch() { this.keyword = ''; this.loadList(true) },

    onCategoryTap(cat) {
      this.activeCategory = cat
      this.loadList(true)
    },

    onStatusTap(status) {
      this.activeStatus = status
      this.loadList(true)
    },

    onGenCountChange(e) { this.genCountIndex = Number(e.detail.value) },
    onGenCategoryChange(e) { this.genCategoryIndex = Number(e.detail.value) },

    async onGenerate() {
      if (this.generating) return
      const count = this.genCounts[this.genCountIndex]
      const category = this.categories[this.genCategoryIndex]
      this.generating = true
      this.generatedQuotes = []
      showLoading('AI 生成中…')
      try {
        const res = await api.generateText({ action: 'generate', category: category, count: count })
        const quotes = (res && res.quotes) || []
        if (quotes.length > 0) {
          this.generatedQuotes = quotes
          hideLoading()
          toast('已生成 ' + quotes.length + ' 条', 'success')
        } else {
          hideLoading()
          toast((res && res.message) || 'AI 未返回内容，请检查配置')
        }
      } catch (err) {
        logger.error('[quotes-manage] AI生成失败', err)
        hideLoading()
        toast(err.message || 'AI 调用失败')
      } finally {
        this.generating = false
      }
    },

    async onSaveGenerated() {
      if (this.savingGen || this.generatedQuotes.length === 0) return
      this.savingGen = true
      showLoading('保存中…')
      try {
        const category = this.categories[this.genCategoryIndex]
        for (let i = 0; i < this.generatedQuotes.length; i++) {
          await api.saveQuote({
            content: this.generatedQuotes[i],
            category: category,
            tags: [],
            status: 'published',
          })
        }
        hideLoading()
        toast('已保存 ' + this.generatedQuotes.length + ' 条', 'success')
        this.generatedQuotes = []
        this.savingGen = false
        this.loadList(true)
      } catch (err) {
        logger.error('[quotes-manage] 保存生成文案失败', err)
        hideLoading()
        toast('保存失败')
        this.savingGen = false
      }
    },

    onClearGenerated() { this.generatedQuotes = [] },

    onToggleAdd() { this.showAddForm = !this.showAddForm },
    onFormCategoryChange(e) { this.formCategoryIndex = Number(e.detail.value) },
    onFormContentInput(e) { this.formContent = e.detail.value },
    onFormTagsInput(e) { this.formTags = e.detail.value },

    async onAddQuote() {
      const content = this.formContent.trim()
      if (!content) { toast('请输入文案内容'); return }
      this.saving = true
      try {
        const tags = this.formTags.split(/[,，]/).map(function (t) { return t.trim() }).filter(Boolean)
        await api.saveQuote({
          content: content,
          category: this.categories[this.formCategoryIndex],
          tags: tags,
          status: 'published',
        })
        toast('保存成功', 'success')
        this.formContent = ''
        this.formTags = ''
        this.saving = false
        this.showAddForm = false
        this.loadList(true)
      } catch (err) {
        logger.error('[quotes-manage] 添加失败', err)
        toast('保存失败')
        this.saving = false
      }
    },

    async onToggleStatus(item) {
      const status = item.status === 'published' ? 'draft' : 'published'
      try {
        await api.updateQuote(item._id, { status: status })
        toast(status === 'published' ? '已发布' : '已撤回', 'success')
        this.loadList(true)
      } catch (err) {
        logger.error('[quotes-manage] 切换状态失败', err)
        toast('操作失败')
      }
    },

    async onDelete(item) {
      const ok = await confirm('确定删除这条文案？')
      if (!ok) return
      try {
        await api.deleteQuote(item._id)
        toast('已删除', 'success')
        this.loadList(true)
      } catch (err) {
        logger.error('[quotes-manage] 删除失败', err)
        toast('删除失败')
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: var(--bg-page); padding-bottom: 40rpx; }

.search-bar { padding: 16rpx 32rpx; background: var(--bg-card); position: sticky; top: 0; z-index: 10; }
.search-input-wrap { display: flex; align-items: center; background: var(--bg-page); border-radius: var(--r-md); padding: 0 24rpx; height: 72rpx; }
.search-icon { width: 32rpx; height: 32rpx; flex-shrink: 0; opacity: 0.4; }
.search-input { flex: 1; min-width: 0; font-size: 28rpx; margin-left: 16rpx; }
.search-clear { padding: 8rpx; }
.search-clear-icon { width: 28rpx; height: 28rpx; opacity: 0.4; }

.filter-bar { white-space: nowrap; padding: 16rpx 32rpx; background: var(--bg-card); }
.filter-chip { display: inline-block; padding: 12rpx 28rpx; margin-right: 16rpx; border-radius: 40rpx; font-size: 26rpx; color: var(--text-secondary); background: var(--bg-page); border: 1rpx solid var(--border); }
.filter-chip--active { background: var(--pri); color: #fff; border-color: var(--pri); }

.gen-section { margin: 24rpx 32rpx; background: var(--bg-card); border-radius: var(--r-lg); padding: 28rpx; box-shadow: var(--shadow-card); }
.gen-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20rpx; }
.gen-title { font-size: 30rpx; font-weight: 600; color: var(--text-primary); }
.gen-config-link { display: flex; align-items: center; gap: 4rpx; font-size: 26rpx; color: var(--pri); }
.gen-config-arrow { font-size: 30rpx; }
.gen-controls { display: flex; align-items: center; gap: 20rpx; }
.gen-category-display { display: flex; align-items: center; gap: 8rpx; padding: 16rpx 28rpx; background: var(--bg-page); border-radius: var(--r-sm); font-size: 28rpx; flex: 1; }
.picker-arrow { color: var(--text-tertiary); font-size: 24rpx; }
.gen-preview { margin-top: 24rpx; border-top: 1rpx solid var(--divider); padding-top: 20rpx; }
.gen-preview-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16rpx; gap: 16rpx; }
.gen-preview-title { font-size: 28rpx; font-weight: 600; color: var(--text-primary); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gen-preview-actions { display: flex; gap: 16rpx; flex-shrink: 0; }
.gen-preview-list { max-height: 500rpx; overflow-y: auto; }
.gen-preview-item { display: flex; gap: 16rpx; padding: 16rpx 0; border-bottom: 1rpx solid var(--divider); width: 100%; box-sizing: border-box; }
.gen-preview-num { font-size: 24rpx; color: var(--text-tertiary); flex-shrink: 0; width: 40rpx; }
.gen-preview-text { flex: 1; min-width: 0; font-size: 28rpx; color: var(--text-primary); line-height: 1.6; word-break: break-all; }

.add-section { margin: 24rpx 32rpx; background: var(--bg-card); border-radius: var(--r-lg); padding: 28rpx; box-shadow: var(--shadow-card); }
.add-header { display: flex; align-items: center; justify-content: space-between; }
.add-title { font-size: 30rpx; font-weight: 600; color: var(--text-primary); }
.add-arrow { font-size: 26rpx; color: var(--pri); }
.add-form { margin-top: 24rpx; }
.input-group { margin-bottom: 24rpx; }
.input-label { display: block; font-size: 26rpx; color: var(--text-secondary); margin-bottom: 12rpx; }
.input { width: 100%; box-sizing: border-box; padding: 20rpx 24rpx; background: var(--bg-page); border-radius: var(--r-sm); font-size: 28rpx; }
.textarea { min-height: 120rpx; line-height: 1.6; }
.picker-display { display: flex; align-items: center; gap: 8rpx; padding: 20rpx 24rpx; background: var(--bg-page); border-radius: var(--r-sm); font-size: 28rpx; }

.list-section { padding: 0 32rpx; }
.list-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20rpx; }
.list-title { font-size: 30rpx; font-weight: 600; color: var(--text-primary); }
.list-filter { display: flex; gap: 16rpx; }
.filter-btn { font-size: 26rpx; color: var(--text-tertiary); padding: 8rpx 16rpx; border-radius: 8rpx; }
.filter-btn--active { color: var(--pri); background: var(--pri-l); }

.quote-card { background: var(--bg-card); border-radius: var(--r-lg); padding: 28rpx; margin-bottom: 20rpx; box-shadow: var(--shadow-card); }
.quote-card__body { margin-bottom: 16rpx; }
.quote-card__content { font-size: 30rpx; color: var(--text-primary); line-height: 1.6; }
.quote-card__meta { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 16rpx; align-items: center; }
.quote-card__cat { font-size: 22rpx; color: var(--pri); background: var(--pri-l); padding: 4rpx 16rpx; border-radius: 6rpx; }
.quote-card__tag { font-size: 22rpx; color: var(--text-secondary); background: var(--bg-page); padding: 4rpx 16rpx; border-radius: 6rpx; }
.quote-card__status { font-size: 22rpx; padding: 4rpx 16rpx; border-radius: 6rpx; margin-left: auto; }
.quote-card__status--published { color: #07C160; background: rgba(7,193,96,0.1); }
.quote-card__status--draft { color: var(--text-tertiary); background: var(--bg-page); }
.quote-card__actions { display: flex; justify-content: flex-end; gap: 16rpx; border-top: 1rpx solid var(--divider); padding-top: 16rpx; }
.icon-btn { padding: 12rpx 24rpx; border-radius: var(--r-sm); background: var(--bg-page); display: flex; align-items: center; justify-content: center; }
.icon-btn__text { font-size: 26rpx; color: var(--pri); }
.icon-btn--danger { padding: 12rpx; }
.icon-btn__img { width: 32rpx; height: 32rpx; }

.load-more { text-align: center; padding: 32rpx; }
.load-more__text { font-size: 26rpx; color: var(--text-tertiary); }
</style>
