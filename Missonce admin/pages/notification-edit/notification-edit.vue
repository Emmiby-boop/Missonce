<template>
  <view class="page-container edit-page">
    <!-- 加载骨架 -->
    <block v-if="loading">
      <mc-card padded>
        <view class="skeleton" style="height: 88rpx; margin-bottom: 24rpx;" />
        <view class="skeleton" style="height: 88rpx; margin-bottom: 24rpx;" />
        <view class="skeleton" style="height: 200rpx;" />
      </mc-card>
    </block>

    <block v-else>
      <!-- 表单 -->
      <mc-card padded class="form-card">
        <view class="input-group">
          <text class="input-label">标题</text>
          <input class="input" :value="title" placeholder="请输入通知标题" @input="onTitleInput" />
        </view>

        <view class="input-group">
          <text class="input-label">类型</text>
          <picker mode="selector" :range="typeOptions" :value="typeIndex" @change="onTypeChange">
            <view class="picker-row">
              <text class="picker-value">{{ typeLabel }}</text>
              <mc-icon class="picker-arrow" :path="icons.chevronDown" color="#B8B8C8" :size="28" />
            </view>
          </picker>
        </view>

        <view class="input-group">
          <text class="input-label">摘要</text>
          <input class="input" :value="summary" placeholder="一句话概括通知内容" @input="onSummaryInput" />
        </view>

        <view class="input-group">
          <text class="input-label">正文</text>
          <textarea
            class="input textarea"
            :value="content"
            placeholder="请输入通知正文"
            maxlength="-1"
            auto-height
            @input="onContentInput"
          />
        </view>

        <view class="input-group">
          <text class="input-label">封面图（可选）</text>
          <view class="cover-picker" @tap="onChooseCover">
            <image class="cover-preview" v-if="cover" :src="cover" mode="aspectFill" @tap.stop="onPreviewCover" />
            <view class="cover-placeholder" v-else>
              <mc-icon class="cover-placeholder-icon" :path="icons.image" color="#B8B8C8" :size="60" />
              <text>选择封面</text>
            </view>
            <view class="cover-remove" v-if="cover" @tap.stop="onRemoveCover">×</view>
          </view>
        </view>

        <view class="input-group input-group--row">
          <text class="input-label">是否启用</text>
          <view class="toggle" :class="{ 'toggle--on': isActive }" @tap="onToggleActive">
            <view class="toggle__knob" />
          </view>
        </view>
      </mc-card>
    </block>

    <!-- 底部操作栏 -->
    <mc-bottom-bar v-if="!loading">
      <mc-btn type="default" @click="onCancel">取消</mc-btn>
      <mc-btn type="primary" block :loading="saving" :disabled="saving" @click="onSave">
        <mc-icon class="bar-icon" :path="icons.save" color="#FFFFFF" :size="32" />
        <text>{{ saving ? '保存中…' : '保存' }}</text>
      </mc-btn>
    </mc-bottom-bar>
  </view>
</template>

<script>
import api from '../../utils/api'
import logger from '../../utils/logger'
import { toast, showLoading, hideLoading } from '../../utils/format'
import { uploadFile } from '../../utils/cloud'

const TYPE_OPTIONS = ['公告', '更新', '活动']
const TYPE_LABEL_TO_VALUE = { '公告': 'announcement', '更新': 'update', '活动': 'activity' }
const TYPE_VALUE_TO_LABEL = { announcement: '公告', update: '更新', activity: '活动' }

export default {
  data() {
    return {
      id: '',
      isEdit: false,
      loading: false,
      saving: false,
      title: '',
      typeLabel: '公告',
      typeIndex: 0,
      typeOptions: TYPE_OPTIONS,
      summary: '',
      content: '',
      cover: '',
      coverFile: '',
      isActive: true,
      icons: {
        save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
        image: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
        chevronDown: '<polyline points="6 9 12 15 18 9"/>',
      },
    }
  },

  onLoad(options) {
    const id = options.id || ''
    if (id) {
      this.id = id
      this.isEdit = true
      this.loadDetail(id)
    }
  },

  methods: {
    async loadDetail(id) {
      this.loading = true
      try {
        let notif = this.getFromPrevPages(id)
        if (!notif) {
          const res = await api.getNotifications({ page: 1, pageSize: 100 })
          const list = this.normalizeList(res)
          notif = list.find((n) => (n._id || n.id) === id) || null
        }
        if (!notif) {
          this.loading = false
          toast('未找到通知')
          return
        }
        const type = notif.type || 'announcement'
        const typeLabel = TYPE_VALUE_TO_LABEL[type] || '公告'
        this.loading = false
        this.title = notif.title || ''
        this.typeLabel = typeLabel
        this.typeIndex = TYPE_OPTIONS.indexOf(typeLabel)
        this.summary = notif.summary || ''
        this.content = notif.content || ''
        this.cover = notif.cover || notif.coverUrl || ''
        this.isActive = notif.isActive !== false
      } catch (err) {
        logger.error('[notification-edit] 加载失败', err)
        this.loading = false
        toast('加载失败')
      }
    },

    getFromPrevPages(id) {
      const pages = getCurrentPages()
      for (let i = pages.length - 2; i >= 0; i--) {
        const page = pages[i]
        if (!page || !page.data) continue
        const list = page.data.list
        if (Array.isArray(list)) {
          const found = list.find((n) => n._id === id)
          if (found) return found
        }
        const recent = page.data.activeNotifications
        if (Array.isArray(recent)) {
          const found = recent.find((n) => n._id === id)
          if (found) return found
        }
      }
      return null
    },

    normalizeList(res) {
      if (!res) return []
      if (Array.isArray(res)) return res
      if (Array.isArray(res.list)) return res.list
      if (res.data && Array.isArray(res.data)) return res.data
      return []
    },

    onTitleInput(e) {
      this.title = e.detail.value
    },

    onSummaryInput(e) {
      this.summary = e.detail.value
    },

    onContentInput(e) {
      this.content = e.detail.value
    },

    onTypeChange(e) {
      const idx = Number(e.detail.value)
      const label = this.typeOptions[idx]
      this.typeIndex = idx
      this.typeLabel = label
    },

    onToggleActive() {
      this.isActive = !this.isActive
    },

    onChooseCover() {
      uni.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const file = res.tempFiles && res.tempFiles[0]
          if (!file) return
          this.coverFile = file.tempFilePath
          this.cover = file.tempFilePath
        },
      })
    },

    onPreviewCover() {
      if (this.cover) uni.previewImage({ urls: [this.cover] })
    },

    onRemoveCover() {
      this.cover = ''
      this.coverFile = ''
    },

    onCancel() {
      uni.navigateBack()
    },

    async onSave() {
      const { title, summary, content, typeLabel, isActive } = this
      if (!title.trim()) {
        toast('请输入标题')
        return
      }
      if (!summary.trim()) {
        toast('请输入摘要')
        return
      }
      this.saving = true
      showLoading('保存中…')
      try {
        let cover = this.cover
        if (this.coverFile) {
          const cloudPath = 'notifications/cover_' + Date.now() + '.jpg'
          cover = await uploadFile(cloudPath, this.coverFile)
        }
        const type = TYPE_LABEL_TO_VALUE[typeLabel]
        const payload = {
          title: title.trim(),
          type,
          summary: summary.trim(),
          content: content.trim(),
          cover,
          isActive,
        }
        if (this.isEdit) {
          await api.manageNotification('update', { id: this.id, data: payload })
        } else {
          await api.manageNotification('add', { data: payload })
        }
        hideLoading()
        toast('保存成功', 'success')
        setTimeout(() => uni.navigateBack(), 600)
      } catch (err) {
        logger.error('[notification-edit] 保存失败', err)
        hideLoading()
        this.saving = false
        toast('保存失败')
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.edit-page {
  padding-bottom: 180rpx;
}

.form-card {
  margin-bottom: 24rpx;
}

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

.picker-arrow {
  width: 28rpx;
  height: 28rpx;
}

.textarea {
  height: 200rpx;
  padding: 24rpx 28rpx;
  line-height: 1.6;
  text-align: left;
}

.input-group--row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0;
}

.input-group--row .input-label {
  margin-bottom: 0;
}

.cover-picker {
  position: relative;
  width: 100%;
  height: 280rpx;
  border-radius: var(--r-sm);
  overflow: hidden;
  background: var(--divider);
  border: 2rpx dashed var(--border);
}

.cover-preview {
  width: 100%;
  height: 100%;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  color: var(--text-tertiary);
  font-size: 24rpx;
}

.cover-placeholder-icon {
  width: 60rpx;
  height: 60rpx;
}

.cover-remove {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  width: 56rpx;
  height: 56rpx;
  line-height: 52rpx;
  text-align: center;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  border-radius: 50%;
  font-size: 36rpx;
}

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
