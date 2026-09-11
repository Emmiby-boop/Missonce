<template>
  <view class="page">
    <!-- AI 生成区域 -->
    <view class="gen-section">
      <view class="gen-header">
        <text class="gen-title">AI 批量生成</text>
        <view class="gen-config-link" @tap="onGoConfig">
          <text>文案模型配置</text>
          <text class="gen-config-arrow">›</text>
        </view>
      </view>
      <mc-btn type="primary" block :loading="generating" :disabled="generating" @click="onGenerate">{{ generating ? '生成中…' : '生成语录' }}</mc-btn>
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

    <!-- 添加语录 -->
    <view class="add-section">
      <view class="add-header" @tap.stop="onToggleAdd">
        <text class="add-title">手动添加</text>
        <text class="add-arrow">{{ showAddForm ? '收起' : '展开' }}</text>
      </view>
      <block v-if="showAddForm">
        <view class="add-form">
          <textarea class="input textarea" :value="formText" placeholder="输入语录内容..." @input="onFormInput" :adjust-position="true" cursor-spacing="80" maxlength="-1" auto-height />
          <mc-btn type="primary" :loading="saving" :disabled="saving" @click="onAddQuote">{{ saving ? '保存中…' : '添加语录' }}</mc-btn>
        </view>
      </block>
    </view>

    <!-- 语录列表 -->
    <view class="list-section">
      <view class="list-header">
        <text class="list-title">语录列表 · {{ list.length }} 条</text>
      </view>

      <block v-if="list.length > 0">
        <view class="quote-card" v-for="item in list" :key="item._id">
          <view class="quote-card__body">
            <text class="quote-card__text">{{ item.text }}</text>
            <text class="quote-card__time" v-if="item.createdAtText">{{ item.createdAtText }}</text>
          </view>
          <view class="icon-btn icon-btn--danger" @tap="onDelete(item)">
            <mc-icon class="icon-btn__img" :path="icons.trash" color="#FF3B30" :size="32" />
          </view>
        </view>
      </block>

      <mc-empty v-else-if="!loading" text="暂无海报语录，可手动添加或使用 AI 批量生成" />
    </view>
  </view>
</template>

<script>
import api from '../../utils/api'
import { showLoading, hideLoading, toast, confirm } from '../../utils/format'
import logger from '../../utils/logger'
import { formatTime } from '../../utils/format'

export default {
  data() {
    return {
      loading: true,
      list: [],
      generating: false,
      generatedQuotes: [],
      savingGen: false,
      showAddForm: false,
      formText: '',
      saving: false,
      icons: {
        message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
        trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
      },
    }
  },

  onLoad() { this.loadList() },

  onGoConfig() {
    uni.navigateTo({
      url: '/pages/ai-config/ai-config?tab=writer',
      fail: function (err) {
        console.error('[poster-quotes] navigateTo ai-config 失败', err)
        // 页面栈过深时降级用 redirectTo
        if (err && err.errMsg && err.errMsg.indexOf('navigateTo:fail') > -1) {
          uni.redirectTo({ url: '/pages/ai-config/ai-config?tab=writer' })
        }
      },
    })
  },

  onPullDownRefresh() { this.loadList().then(() => uni.stopPullDownRefresh()) },

  methods: {
    async loadList() {
      this.loading = true
      try {
        let list = await api.getPosterQuotes()
        list = (list || []).map(function (item) {
          return Object.assign({}, item, { createdAtText: item.createdAt ? formatTime(item.createdAt) : '' })
        })
        this.list = list
        this.loading = false
      } catch (err) {
        logger.error('[poster-quotes] 加载失败', err)
        this.loading = false
      }
    },

    async onGenerate() {
      if (this.generating) return
      this.generating = true
      this.generatedQuotes = []
      showLoading('AI 生成中…')
      try {
        const res = await api.generatePosterQuotes(5)
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
        logger.error('[poster-quotes] AI生成失败', err)
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
        for (let i = 0; i < this.generatedQuotes.length; i++) {
          await api.savePosterQuote(this.generatedQuotes[i])
        }
        hideLoading()
        toast('已保存 ' + this.generatedQuotes.length + ' 条', 'success')
        this.generatedQuotes = []
        this.savingGen = false
        this.loadList()
      } catch (err) {
        logger.error('[poster-quotes] 保存失败', err)
        hideLoading()
        toast('保存失败')
        this.savingGen = false
      }
    },

    onClearGenerated() { this.generatedQuotes = [] },

    onToggleAdd() { this.showAddForm = !this.showAddForm },
    onFormInput(e) { this.formText = e.detail.value },

    async onAddQuote() {
      const text = this.formText.trim()
      if (!text) { toast('请输入语录内容'); return }
      this.saving = true
      try {
        await api.savePosterQuote(text)
        toast('添加成功', 'success')
        this.formText = ''
        this.saving = false
        this.showAddForm = false
        this.loadList()
      } catch (err) {
        logger.error('[poster-quotes] 添加失败', err)
        toast('添加失败')
        this.saving = false
      }
    },

    async onDelete(item) {
      const ok = await confirm('确定删除这条语录？')
      if (!ok) return
      try {
        await api.deletePosterQuote(item._id)
        toast('已删除', 'success')
        this.loadList()
      } catch (err) {
        logger.error('[poster-quotes] 删除失败', err)
        toast('删除失败')
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: var(--bg-page); padding-bottom: 40rpx; overflow-x: hidden; }

.gen-section { margin: 24rpx 32rpx; background: var(--bg-card); border-radius: var(--r-lg); padding: 28rpx; box-shadow: var(--shadow-card); box-sizing: border-box; max-width: 100%; }
.gen-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20rpx; min-width: 0; }
.gen-title { font-size: 30rpx; font-weight: 600; color: var(--text-primary); flex-shrink: 0; }
.gen-config-link { display: flex; align-items: center; gap: 4rpx; font-size: 26rpx; color: var(--pri); flex-shrink: 0; }
.gen-config-arrow { font-size: 30rpx; }
.gen-section .btn { width: 100%; margin-bottom: 0; }
.gen-preview { margin-top: 24rpx; border-top: 1rpx solid var(--divider); padding-top: 20rpx; min-width: 0; }
.gen-preview-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16rpx; gap: 16rpx; min-width: 0; }
.gen-preview-title { font-size: 28rpx; font-weight: 600; color: var(--text-primary); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gen-preview-actions { display: flex; gap: 16rpx; flex-shrink: 0; }
.gen-preview-list { max-height: 500rpx; overflow-y: auto; }
.gen-preview-item { display: flex; gap: 16rpx; padding: 16rpx 0; border-bottom: 1rpx solid var(--divider); width: 100%; box-sizing: border-box; min-width: 0; }
.gen-preview-num { font-size: 24rpx; color: var(--text-tertiary); flex-shrink: 0; width: 40rpx; }
.gen-preview-text { flex: 1; min-width: 0; font-size: 28rpx; color: var(--text-primary); line-height: 1.6; word-break: break-all; }

.add-section { margin: 24rpx 32rpx; background: var(--bg-card); border-radius: var(--r-lg); padding: 28rpx; box-shadow: var(--shadow-card); box-sizing: border-box; max-width: 100%; }
.add-header { display: flex; align-items: center; justify-content: space-between; min-width: 0; }
.add-title { font-size: 30rpx; font-weight: 600; color: var(--text-primary); flex-shrink: 0; }
.add-arrow { font-size: 26rpx; color: var(--pri); flex-shrink: 0; }
.add-form { margin-top: 24rpx; }
.input { width: 100%; box-sizing: border-box; padding: 20rpx 24rpx; background: var(--bg-page); border-radius: var(--r-sm); font-size: 28rpx; }
.textarea { min-height: 120rpx; line-height: 1.6; }

.list-section { padding: 0 32rpx; box-sizing: border-box; }
.list-header { margin-bottom: 20rpx; }
.list-title { font-size: 30rpx; font-weight: 600; color: var(--text-primary); }

.quote-card { background: var(--bg-card); border-radius: var(--r-lg); padding: 28rpx; margin-bottom: 20rpx; box-shadow: var(--shadow-card); display: flex; align-items: flex-start; justify-content: space-between; gap: 20rpx; box-sizing: border-box; }
.quote-card__body { flex: 1; min-width: 0; }
.quote-card__text { font-size: 30rpx; color: var(--text-primary); line-height: 1.6; word-break: break-all; }
.quote-card__time { display: block; font-size: 24rpx; color: var(--text-tertiary); margin-top: 12rpx; }
.icon-btn { padding: 12rpx; border-radius: var(--r-sm); background: var(--bg-page); flex-shrink: 0; }
.icon-btn__img { width: 32rpx; height: 32rpx; }
</style>
