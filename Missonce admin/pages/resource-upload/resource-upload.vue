<template>
  <view class="page-container upload-page">
    <!-- 顶部说明卡片 -->
    <view class="info-card">
      <mc-icon name="info" color="#10AEFF" :size="40" class="info-icon" />
      <view class="info-content">
        <text class="info-title">批量上传</text>
        <text class="info-desc">支持批量上传，AI 自动识别标签和分类</text>
      </view>
    </view>

    <!-- 上传表单 -->
    <view class="card card--padded form-card">
      <view class="input-group">
        <text class="input-label">标题（可选）</text>
        <input class="input" v-model="form.title" placeholder="留空则使用文件名" />
      </view>

      <view class="input-group">
        <text class="input-label">类型</text>
        <view class="type-chips">
          <view
            class="type-chip"
            :class="{ 'type-chip--active': form.type === item.value }"
            v-for="item in resourceTypes"
            :key="item.value"
            @tap="onFormTypeChange(item.value)"
          >{{ item.label }}</view>
        </view>
      </view>

      <view class="input-group">
        <text class="input-label">分类（可选）</text>
        <block v-if="!categoryLoadError">
          <picker mode="selector" :range="categoryOptions" range-key="name" :value="categoryIndex" @change="onFormCategoryChange">
            <view class="picker-display">
              <text class="picker-text">{{ categoryOptions[categoryIndex].name }}</text>
              <mc-icon name="chevron-down" color="#B8B8C8" :size="28" class="picker-arrow" />
            </view>
          </picker>
        </block>
        <view class="error-state" v-else>
          <mc-icon name="alert-circle" color="#B8B8C8" :size="72" class="error-state__icon" />
          <view class="error-state__text">{{ categoryErrorMsg || '分类加载失败' }}</view>
          <view class="error-state__action">
            <button class="btn btn--ghost btn--sm" @tap="retryLoadCategories">重试</button>
          </view>
        </view>
      </view>

      <view class="input-group">
        <text class="input-label">状态</text>
        <picker mode="selector" :range="statusOptions" range-key="label" :value="statusIndex" @change="onFormStatusChange">
          <view class="picker-display">
            <text class="picker-text">{{ statusOptions[statusIndex].label }}</text>
            <mc-icon name="chevron-down" color="#B8B8C8" :size="28" class="picker-arrow" />
          </view>
        </picker>
      </view>

      <view class="input-group">
        <text class="input-label">标签（可选，逗号分隔）</text>
        <input class="input" v-model="form.tags" placeholder="例如：治愈,简约,几何" />
      </view>
    </view>

    <!-- 文件选择区 -->
    <view class="card card--padded file-card">
      <view class="file-header">
        <text class="file-title">素材文件</text>
        <view class="file-actions">
          <text class="file-count">已选 {{ fileList.length }} 个</text>
          <text class="file-clear" v-if="fileList.length > 0" @tap="onClearFiles">清空</text>
        </view>
      </view>

      <view class="file-picker-btn" :class="{ 'file-picker-btn--disabled': uploading }" @tap="onChooseFiles">
        <mc-icon name="image" color="#B8B8C8" :size="64" class="file-picker-icon" />
        <text class="file-picker-text">选择图片</text>
        <text class="file-picker-hint">最多 9 张，可多次选择</text>
      </view>

      <view class="file-list" v-if="fileList.length > 0">
        <view class="file-item" v-for="item in fileList" :key="item.id">
          <view class="file-thumb-wrap">
            <image class="file-thumb" :src="item.path" mode="aspectFill" @tap="onPreviewFile(item.path)" />
            <view class="file-remove" @tap.stop="onRemoveFile(item.id)">×</view>
          </view>
          <text class="file-name text-ellipsis">{{ item.name }}</text>
        </view>
      </view>
    </view>

    <!-- 上传进度 -->
    <view class="card card--padded progress-card" v-if="uploading">
      <view class="progress-header">
        <text class="progress-text">{{ uploadProgress.text }}</text>
        <text class="progress-percent">{{ uploadProgress.percent }}%</text>
      </view>
      <progress :percent="uploadProgress.percent" stroke-width="6" activeColor="#07C160" backgroundColor="#EBEBF0" />
    </view>

    <!-- 上传结果 -->
    <view class="card card--padded result-card" v-if="uploadResults.length > 0">
      <view class="result-header">
        <text class="result-title">上传结果</text>
      </view>
      <view class="result-list">
        <view class="result-item" v-for="item in uploadResults" :key="item.fileName">
          <mc-icon :name="item.success ? 'check' : 'x'" :color="item.success ? '#07C160' : '#FA5151'" :size="32" class="result-icon" />
          <text class="result-name text-ellipsis">{{ item.fileName }}</text>
          <text class="result-status" :class="item.success ? 'result-status--success' : 'result-status--fail'">{{ item.success ? '成功' : (item.skipped ? '跳过' : '失败') }}</text>
        </view>
      </view>
    </view>

    <!-- 底部上传按钮 -->
    <view class="bottom-bar" :style="keyboardHeight ? 'transform: translateY(-' + keyboardHeight + 'px)' : ''">
      <button class="btn btn--primary btn--block" @tap="onUpload" :disabled="uploading || fileList.length === 0">
        <mc-icon name="upload" color="#fff" :size="32" class="bar-icon" />
        <text v-if="uploading">上传中…</text>
        <text v-else>开始上传 ({{ fileList.length }} 个文件)</text>
      </button>
    </view>
  </view>
</template>

<script>
import api from '../../utils/api'
import logger from '../../utils/logger'
import { toast, confirm } from '../../utils/format'
import { getCloud, uploadFile } from '../../utils/cloud'

const RESOURCE_TYPES = [
  { value: 'auto', label: '自动识别' },
  { value: 'avatar', label: '头像' },
  { value: 'wallpaper', label: '壁纸' },
]

const RESOURCE_STATUSES = [
  { value: 'published', label: '已发布' },
  { value: 'review', label: '待审' },
  { value: 'draft', label: '草稿' },
  { value: 'offline', label: '已下线' },
]

export default {
  data() {
    return {
      form: {
        title: '',
        type: 'auto',
        category: '',
        status: 'published',
        tags: '',
      },
      fileList: [],
      uploading: false,
      uploadProgress: { current: 0, total: 0, percent: 0, text: '' },
      uploadResults: [],
      categoryOptions: [{ name: '自动识别 (AI)', value: '' }],
      categoryIndex: 0,
      categoryLoadError: false,
      categoryErrorMsg: '',
      statusOptions: RESOURCE_STATUSES,
      statusIndex: 0,
      resourceTypes: RESOURCE_TYPES,
      resourceStatuses: RESOURCE_STATUSES,
      keyboardHeight: 0,
      _kbHandler: null,
    }
  },

  async onLoad() {
    await getCloud()
    this.loadCategories()
    this._kbHandler = (res) => { this.keyboardHeight = (res && res.height) || 0 }
    uni.onKeyboardHeightChange(this._kbHandler)
  },

  onUnload() {
    if (this._kbHandler) uni.offKeyboardHeightChange(this._kbHandler)
  },

  methods: {
    normalizeList(res) {
      if (!res) return []
      if (Array.isArray(res)) return res
      if (Array.isArray(res.list)) return res.list
      return []
    },

    async loadCategories() {
      this.categoryLoadError = false
      try {
        const res = await api.getCategories('all')
        const cats = this.normalizeList(res)
        const options = [{ name: '自动识别 (AI)', value: '' }].concat(
          cats.map((c) => ({ name: c.name || c.title || '', value: c.name || c.title || '' }))
        )
        this.categoryOptions = options
        this.categoryIndex = 0
        this.form.category = ''
      } catch (err) {
        logger.warn('[resource-upload] 加载分类失败', err)
        this.categoryLoadError = true
        this.categoryErrorMsg = (err && err.message) || '加载失败，请稍后重试'
      }
    },

    retryLoadCategories() {
      this.loadCategories()
    },

    onFormTypeChange(type) {
      if (!type || type === this.form.type) return
      this.form.type = type
    },

    onFormCategoryChange(e) {
      const idx = Number(e.detail.value)
      const option = this.categoryOptions[idx]
      this.categoryIndex = idx
      this.form.category = option ? option.value : ''
    },

    onFormStatusChange(e) {
      const idx = Number(e.detail.value)
      const option = this.statusOptions[idx]
      this.statusIndex = idx
      this.form.status = option ? option.value : 'published'
    },

    onChooseFiles() {
      if (this.uploading) return
      // 用 chooseImage + extension，App 端对 GIF 兼容性更好（chooseMedia 会把 GIF 转为静态 jpg）
      uni.chooseImage({
        count: 9,
        sizeType: ['original'],
        sourceType: ['album', 'camera'],
        extension: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'],
        success: (res) => {
          const now = Date.now()
          const tempFilePaths = res.tempFilePaths || []
          const tempFiles = res.tempFiles || []
          const files = tempFilePaths.map((path, idx) => {
            const fileObj = tempFiles[idx] || {}
            const ext = this.extractExt(path)
            const name = `image_${now}_${idx}.${ext}`
            return {
              id: `${now}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
              path: path,
              name,
              size: fileObj.size || 0,
            }
          })
          this.fileList = this.fileList.concat(files)
        },
      })
    },

    extractExt(path) {
      const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
      if (!path) return 'jpg'
      const seg = String(path).split('.').pop().toLowerCase()
      return ALLOWED_EXTS.indexOf(seg) >= 0 ? seg : 'jpg'
    },

    onRemoveFile(id) {
      this.fileList = this.fileList.filter((f) => f.id !== id)
    },

    onClearFiles() {
      if (this.uploading) return
      if (this.fileList.length === 0) return
      uni.showModal({
        title: '提示',
        content: '确定清空所有已选文件吗？',
        success: (res) => {
          if (res.confirm) this.fileList = []
        },
      })
    },

    onPreviewFile(url) {
      const urls = this.fileList.map((f) => f.path)
      uni.previewImage({ current: url, urls })
    },

    generateCloudPath(file, type) {
      const now = new Date()
      const y = String(now.getFullYear())
      const m = String(now.getMonth() + 1).padStart(2, '0')
      const d = String(now.getDate()).padStart(2, '0')
      const h = String(now.getHours()).padStart(2, '0')
      const min = String(now.getMinutes()).padStart(2, '0')
      const s = String(now.getSeconds()).padStart(2, '0')
      const random6 = Math.random().toString(36).substring(2, 8)
      const folder = type === 'avatar' ? 'avatar' : 'wallpaper'
      const ext = this.extractExt(file.name || file.path || '')
      return `resources/${folder}/${y}${m}${d}-${h}${min}${s}-${random6}.${ext}`
    },

    async checkDuplicate(fileName) {
      try {
        const res = await api.getResources({ keyword: fileName, pageSize: 1 })
        const total = res && res.total ? res.total : 0
        return total > 0
      } catch (err) {
        logger.warn('[resource-upload] 查重失败', err)
        return false
      }
    },

    async uploadSingleFile(file, form) {
      const isDup = await this.checkDuplicate(file.name)
      if (isDup) {
        const ok = await confirm(`文件「${file.name}」已存在，是否继续上传？`)
        if (!ok) {
          return { fileName: file.name, success: false, skipped: true }
        }
      }

      const folderType = form.type === 'avatar' ? 'avatar' : 'wallpaper'
      const cloudPath = this.generateCloudPath(file, folderType)

      const fileID = await uploadFile(cloudPath, file.path)

      const tags = (form.tags || '').split(',').map((t) => t.trim()).filter(Boolean)

      await api.uploadResource({
        title: (form.title || '').trim() || file.name,
        originalFileName: file.name,
        type: form.type,
        status: form.status,
        category: form.category,
        categories: form.category ? [form.category] : [],
        tags,
        coverUrl: fileID,
        originUrl: fileID,
        skipAI: false,
      })

      return { fileName: file.name, success: true }
    },

    async onUpload() {
      if (this.uploading) return
      const { fileList } = this
      if (fileList.length === 0) {
        toast('请先选择图片')
        return
      }

      const form = {
        title: this.form.title,
        type: this.form.type,
        category: this.form.category,
        status: this.form.status,
        tags: this.form.tags,
      }
      const total = fileList.length

      this.uploading = true
      this.uploadResults = []
      this.uploadProgress = { current: 0, total, percent: 0, text: `正在上传 0/${total}...` }

      const results = []
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i]
        const current = i + 1
        const percent = Math.round((current / total) * 100)
        this.uploadProgress = { current, total, percent, text: `正在上传 ${current}/${total}...` }
        try {
          const result = await this.uploadSingleFile(file, form)
          results.push(result)
        } catch (err) {
          logger.error('[resource-upload] 上传失败', file.name, err)
          results.push({ fileName: file.name, success: false, error: (err && err.message) || '上传失败' })
        }
        this.uploadResults = results.slice()
      }

      const successCount = results.filter((r) => r.success).length

      this.uploading = false
      this.fileList = []
      this.form = { title: '', type: 'auto', category: '', status: 'published', tags: '' }
      this.categoryIndex = 0
      this.statusIndex = 0

      if (successCount > 0) {
        toast(`批量上传任务已提交！共 ${total} 个文件，AI 识别将在后台自动进行。`, 'none', 2500)
        setTimeout(() => uni.navigateBack(), 1000)
      } else {
        toast('上传失败，请重试', 'none', 2000)
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.upload-page {
  padding-bottom: 180rpx;
}

/* 顶部说明卡片 */
.info-card {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
  background: var(--info-l);
  border-radius: var(--r-lg);
  padding: 28rpx 32rpx;
  margin-bottom: 24rpx;
}

.info-icon {
  flex-shrink: 0;
  margin-top: 4rpx;
}

.info-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.info-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--info);
}

.info-desc {
  font-size: 24rpx;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* 表单卡片 */
.form-card {
  margin-bottom: 24rpx;
}

/* 类型 chip 单选 */
.type-chips {
  display: flex;
  gap: 16rpx;
}

.type-chip {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  font-size: 26rpx;
  color: var(--text-secondary);
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--r-sm);
  transition: all 0.2s;
}

.type-chip--active {
  background: var(--pri-l);
  color: var(--pri);
  border-color: var(--pri);
  font-weight: 600;
}

/* picker 显示 */
.picker-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 28rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--r-sm);
  box-sizing: border-box;
}

.picker-text {
  font-size: 28rpx;
  color: var(--text-primary);
}

.picker-arrow {
  flex-shrink: 0;
}

/* 文件选择区 */
.file-card {
  margin-bottom: 24rpx;
}

.file-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.file-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.file-actions {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.file-count {
  font-size: 24rpx;
  color: var(--text-secondary);
}

.file-clear {
  font-size: 24rpx;
  color: var(--danger);
}

.file-picker-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  width: 100%;
  box-sizing: border-box;
  height: 240rpx;
  background: var(--bg-card);
  border: 2rpx dashed var(--border);
  border-radius: var(--r-lg);
  transition: all 0.2s;
}

.file-picker-btn--disabled {
  opacity: 0.5;
}

.file-picker-btn:active:not(.file-picker-btn--disabled) {
  background: var(--divider);
  border-color: var(--pri);
}

.file-picker-icon {
  width: 64rpx;
  height: 64rpx;
}

.file-picker-text {
  font-size: 28rpx;
  color: var(--text-primary);
  font-weight: 500;
}

.file-picker-hint {
  font-size: 22rpx;
  color: var(--text-tertiary);
}

/* 已选文件列表（缩略图网格） */
.file-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  margin-top: 24rpx;
  overflow: hidden;
}

.file-item {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
  overflow: hidden;
}

.file-thumb-wrap {
  position: relative;
  width: 100%;
  padding-bottom: 100%;
  border-radius: var(--r-sm);
  overflow: hidden;
  background: var(--divider);
}

.file-thumb {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.file-remove {
  position: absolute;
  top: 0;
  right: 0;
  width: 72rpx;
  height: 72rpx;
  line-height: 72rpx;
  text-align: center;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  border-radius: 50%;
  font-size: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-name {
  font-size: 22rpx;
  color: var(--text-secondary);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 上传进度 */
.progress-card {
  margin-bottom: 24rpx;
}

.progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.progress-text {
  font-size: 26rpx;
  color: var(--text-primary);
  font-weight: 500;
}

.progress-percent {
  font-size: 26rpx;
  color: var(--pri);
  font-weight: 600;
}

/* 上传结果 */
.result-card {
  margin-bottom: 24rpx;
}

.result-header {
  margin-bottom: 16rpx;
}

.result-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.result-icon {
  flex-shrink: 0;
}

.result-name {
  flex: 1;
  font-size: 26rpx;
  color: var(--text-primary);
}

.result-status {
  font-size: 24rpx;
  flex-shrink: 0;
}

.result-status--success {
  color: var(--pri);
}

.result-status--fail {
  color: var(--danger);
}

/* 底部栏按钮 */
.bottom-bar .btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  flex: 1;
}

.bar-icon {
  width: 32rpx;
  height: 32rpx;
}
</style>
