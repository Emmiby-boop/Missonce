<template>
  <view class="page-container records-page">
    <!-- 顶部 Tab 切换 -->
    <view class="seg-bar">
      <view
        class="seg-item"
        :class="{ 'seg-item--active': activeTab === 'download' }"
        @tap="onSwitchTab('download')"
      >
        <mc-icon :path="icons.download" :size="32" :color="activeTab === 'download' ? '#fff' : '#8C8CA1'" class="seg-icon" />
        <text class="seg-text">下载记录</text>
        <text class="seg-count">{{ activeTab === 'download' ? list.length : '' }}</text>
      </view>
      <view
        class="seg-item"
        :class="{ 'seg-item--active': activeTab === 'favorite' }"
        @tap="onSwitchTab('favorite')"
      >
        <mc-icon :path="icons.star" :size="32" :color="activeTab === 'favorite' ? '#fff' : '#8C8CA1'" class="seg-icon" />
        <text class="seg-text">收藏记录</text>
        <text class="seg-count">{{ activeTab === 'favorite' ? list.length : '' }}</text>
      </view>
    </view>

    <!-- 统计概览 -->
    <view class="stats-card">
      <view class="stats-item">
        <view class="stats-num">{{ stats.total }}</view>
        <view class="stats-label">最近 100 次</view>
      </view>
      <view class="stats-divider" />
      <view class="stats-item">
        <view class="stats-num">{{ stats.uniqueUsers }}</view>
        <view class="stats-label">独立用户</view>
      </view>
      <view class="stats-divider" />
      <view class="stats-item">
        <view class="stats-num">{{ stats.uniqueResources }}</view>
        <view class="stats-label">涉及资源</view>
      </view>
    </view>

    <!-- 加载骨架 -->
    <view v-if="loading" class="skeleton-list">
      <view class="skeleton-row" v-for="n in 8" :key="n">
        <view class="skeleton skeleton-cover" />
        <view class="skeleton-info">
          <view class="skeleton skeleton-title" />
          <view class="skeleton skeleton-sub" />
        </view>
      </view>
    </view>

    <!-- 列表 -->
    <view v-else-if="list.length > 0" class="record-list">
      <view class="record-row" v-for="(item, idx) in list" :key="item._id || idx" @tap="onTapRecord(item)">
        <view class="record-cover-wrap">
          <image v-if="item.cover" class="record-cover" :src="item.cover" mode="aspectFill" />
          <view v-else class="record-cover record-cover--placeholder">
            <mc-icon :path="activeTab === 'download' ? icons.download : icons.star" color="#B8B8C8" :size="36" />
          </view>
        </view>
        <view class="record-info">
          <view class="record-title">{{ item.title }}</view>
          <view class="record-meta">
            <text class="meta-user">{{ item.user }}</text>
            <text class="meta-type" v-if="item.typeLabel">· {{ item.typeLabel }}</text>
          </view>
          <view class="record-time">{{ item.time }}</view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else class="empty-state">
      <mc-icon :path="activeTab === 'download' ? icons.download : icons.star" color="#B8B8C8" :size="140" class="empty-icon" />
      <text class="empty-text">暂无{{ activeTab === 'download' ? '下载' : '收藏' }}记录</text>
    </view>

    <!-- 底部说明 -->
    <view class="footer-tip" v-if="!loading && list.length > 0">
      仅显示最近 100 条{{ activeTab === 'download' ? '下载' : '收藏' }}记录
    </view>
  </view>
</template>

<script>
import api from '../../utils/api'
import logger from '../../utils/logger'
import { toast, formatTime } from '../../utils/format'
import cache from '../../utils/cache'

const ICONS = {
  download: '<path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
}

export default {
  data() {
    return {
      activeTab: 'download',
      loading: true,
      list: [],
      stats: { total: 0, uniqueUsers: 0, uniqueResources: 0 },
      icons: ICONS,
    }
  },

  onLoad(options) {
    if (options && options.tab === 'favorite') this.activeTab = 'favorite'
    this.loadData()
  },

  onPullDownRefresh() {
    this.loadData(true).finally(() => uni.stopPullDownRefresh())
  },

  methods: {
    onSwitchTab(tab) {
      if (tab === this.activeTab) return
      this.activeTab = tab
      this.loadData()
    },

    async loadData(force) {
      const cacheKey = 'cache:records:' + this.activeTab
      if (!force) {
        const cached = cache.getCachedStale(cacheKey)
        if (cached) {
          this.list = cached.list
          this.stats = cached.stats
          this.loading = false
        }
      }

      this.loading = true
      try {
        const raw = this.activeTab === 'download'
          ? await api.getDownloadRecords(100)
          : await api.getFavoriteRecords(100)
        const list = raw.map(r => this.formatRecord(r))
        const stats = this.computeStats(raw)
        this.list = list
        this.stats = stats
        cache.setCached(cacheKey, { list, stats })
      } catch (err) {
        logger.error('[records] 加载失败', err)
        toast('加载失败，下拉重试')
      } finally {
        this.loading = false
      }
    },

    formatRecord(r) {
      const title = r.resourceTitle || (r.resource && r.resource.title) || r.title || '未命名资源'
      const type = r.resourceType || (r.resource && r.resource.type) || r.type || ''
      const cover = r.resourceCover || (r.resource && (r.resource.coverUrl || r.resource.url)) || r.coverUrl || r.url || r.cover || ''
      const userOpenid = r._openid || r.userId || ''
      const userNickname = r.userNickname || (userOpenid ? '用户 ' + userOpenid.slice(-6) : '匿名用户')
      return {
        _id: r._id || r.id,
        title,
        type,
        typeLabel: type === 'avatar' ? '头像' : (type === 'wallpaper' ? '壁纸' : ''),
        cover,
        user: userNickname,
        time: formatTime(r.createTime || r.create_time || r.createdAt),
        resourceId: r.resourceId,
      }
    },

    computeStats(list) {
      const users = new Set()
      const resources = new Set()
      list.forEach(r => {
        if (r._openid) users.add(r._openid)
        else if (r.userId) users.add(r.userId)
        if (r.resourceId) resources.add(r.resourceId)
      })
      return {
        total: list.length,
        uniqueUsers: users.size,
        uniqueResources: resources.size,
      }
    },

    onTapRecord(item) {
      if (item.resourceId) {
        uni.navigateTo({ url: '/pages/resource-detail/resource-detail?id=' + item.resourceId })
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.records-page {
  padding-bottom: 60rpx;
}

/* 顶部 Tab */
.seg-bar {
  display: flex;
  background: var(--bg-card);
  border-radius: var(--r-md);
  padding: 8rpx;
  margin-bottom: 24rpx;
  gap: 8rpx;
}

.seg-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 22rpx 0;
  border-radius: 16rpx;
  background: transparent;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.seg-item--active {
  background: var(--pri);
  color: #fff;
}

.seg-icon {
  width: 32rpx;
  height: 32rpx;
}

.seg-text {
  font-size: 28rpx;
  font-weight: 500;
}

.seg-count {
  font-size: 22rpx;
  opacity: 0.8;
}

/* 统计概览 */
.stats-card {
  display: flex;
  align-items: center;
  background: var(--bg-card);
  border-radius: var(--r-md);
  padding: 28rpx 0;
  margin-bottom: 24rpx;
  box-shadow: var(--shadow-card);
}

.stats-item {
  flex: 1;
  text-align: center;
}

.stats-num {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.stats-label {
  font-size: 22rpx;
  color: var(--text-tertiary);
  margin-top: 6rpx;
}

.stats-divider {
  width: 1rpx;
  height: 60rpx;
  background: var(--divider);
}

/* 列表 */
.record-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.record-row {
  display: flex;
  align-items: center;
  background: var(--bg-card);
  border-radius: var(--r-md);
  padding: 20rpx;
  gap: 20rpx;
  box-shadow: var(--shadow-card);
}

.record-row:active {
  opacity: 0.88;
}

.record-cover-wrap {
  flex-shrink: 0;
  width: 100rpx;
  height: 100rpx;
  border-radius: 12rpx;
  overflow: hidden;
  background: var(--divider);
}

.record-cover {
  width: 100%;
  height: 100%;
}

.record-cover--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.record-info {
  flex: 1;
  min-width: 0;
}

.record-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-meta {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: var(--text-secondary);
}

.meta-user {
  margin-right: 6rpx;
}

.record-time {
  margin-top: 4rpx;
  font-size: 20rpx;
  color: var(--text-tertiary);
}

/* 骨架 */
.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.skeleton-row {
  display: flex;
  background: var(--bg-card);
  border-radius: var(--r-md);
  padding: 20rpx;
  gap: 20rpx;
}

.skeleton-cover {
  width: 100rpx;
  height: 100rpx;
  border-radius: 12rpx;
  flex-shrink: 0;
}

.skeleton-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 12rpx;
}

.skeleton-title {
  height: 28rpx;
  width: 60%;
}

.skeleton-sub {
  height: 22rpx;
  width: 40%;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}

.empty-icon {
  width: 140rpx;
  height: 140rpx;
  opacity: 0.5;
}

.empty-text {
  margin-top: 24rpx;
  font-size: 26rpx;
  color: var(--text-tertiary);
}

/* 底部说明 */
.footer-tip {
  text-align: center;
  font-size: 22rpx;
  color: var(--text-tertiary);
  padding: 32rpx 0 16rpx;
}
</style>
