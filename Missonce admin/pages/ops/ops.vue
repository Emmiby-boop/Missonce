<template>
  <view class="page-container ops-page" style="padding-bottom: calc(130rpx + env(safe-area-inset-bottom));">
    <!-- 加载骨架 -->
    <block v-if="loading">
      <view class="metric-grid metric-grid--3">
        <mc-skeleton v-for="n in 3" :key="n" style="height: 140rpx; border-radius: 20rpx;" />
      </view>
      <view class="section">
        <mc-skeleton style="height: 36rpx; width: 200rpx; margin-bottom: 20rpx;" />
        <mc-card>
          <view class="skeleton-row" v-for="n in 3" :key="n">
            <view class="skeleton skeleton-icon" />
            <view class="skeleton skeleton-line" />
          </view>
        </mc-card>
      </view>
    </block>

    <block v-else>
      <!-- 顶部数据 -->
      <view class="metric-grid metric-grid--3">
        <view class="metric-card metric-card--sm">
          <view class="metric-value metric-value--sm">{{ metrics.totalUsers }}</view>
          <view class="metric-label metric-label--center">总用户</view>
        </view>
        <view class="metric-card metric-card--sm">
          <view class="metric-value metric-value--sm">{{ metrics.todayActive }}</view>
          <view class="metric-label metric-label--center">今日活跃</view>
        </view>
        <view class="metric-card metric-card--sm">
          <view class="metric-value metric-value--sm">{{ metrics.members }}</view>
          <view class="metric-label metric-label--center">会员数</view>
        </view>
      </view>

      <!-- 运营模块 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">运营模块</text>
        </view>
        <view class="list-card">
          <view
            class="list-item"
            v-for="m in modules"
            :key="m.key"
            @tap="onNavigate(m.url)"
            hover-class="list-item--active"
          >
            <view class="list-item-icon" :class="`list-item-icon--${m.color}`">
              <mc-icon :path="m.iconPath" :color="m.iconColor" :size="40" />
            </view>
            <view class="list-item-text">
              <view class="list-item-title">{{ m.title }}</view>
              <view class="list-item-desc">{{ m.desc }}</view>
            </view>
            <view class="list-item-right">
              <view class="badge badge--green" v-if="m.key === 'notification' && m.activeCount > 0">{{ m.activeCount }} 有效</view>
              <mc-icon class="arrow-icon" :path="icons.chevronRight" color="#B8B8C8" :size="28" />
            </view>
          </view>
        </view>
      </view>

      <!-- 下载记录 + 收藏记录 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">行为记录</text>
        </view>

        <!-- 下载记录 -->
        <view class="record-block">
          <view class="record-block-header">
            <view class="record-block-title">
              <mc-icon class="record-block-icon" :path="icons.download" color="#10AEFF" :size="32" />
              <text>下载记录</text>
            </view>
            <view class="record-block-count">{{ behaviorMetrics.totalDownloads }} 次</view>
          </view>
          <mc-card v-if="downloadRecords.length > 0">
            <view class="record-item" v-for="r in downloadRecords.slice(0, 5)" :key="r._id">
              <image class="record-cover" v-if="r.cover" :src="r.cover" mode="aspectFill" />
              <view class="record-cover record-cover--placeholder" v-else>
                <mc-icon class="record-cover-icon" :path="icons.download" color="#B8B8C8" :size="36" />
              </view>
              <view class="record-info">
                <view class="record-title text-ellipsis">{{ r.title }}</view>
                <view class="record-meta">
                  <view class="badge badge--gray" v-if="r.typeLabel">{{ r.typeLabel }}</view>
                  <text class="record-user">{{ r.user }}</text>
                </view>
              </view>
              <text class="record-time">{{ r.time }}</text>
            </view>
            <view class="record-view-all" @tap="onViewAllRecords('download')" v-if="downloadRecords.length > 5">
              查看全部 {{ behaviorMetrics.totalDownloads }} 条 →
            </view>
          </mc-card>
          <view class="empty-state empty-state--inline" v-else>
            <text class="empty-state__text">暂无下载记录</text>
          </view>
        </view>

        <!-- 收藏记录 -->
        <view class="record-block">
          <view class="record-block-header">
            <view class="record-block-title">
              <mc-icon class="record-block-icon" :path="icons.star" color="#FF9500" :size="32" />
              <text>收藏记录</text>
            </view>
            <view class="record-block-count">{{ behaviorMetrics.totalFavorites }} 次</view>
          </view>
          <mc-card v-if="favoriteRecords.length > 0">
            <view class="record-item" v-for="r in favoriteRecords.slice(0, 5)" :key="r._id">
              <image class="record-cover" v-if="r.cover" :src="r.cover" mode="aspectFill" />
              <view class="record-cover record-cover--placeholder" v-else>
                <mc-icon class="record-cover-icon" :path="icons.star" color="#B8B8C8" :size="36" />
              </view>
              <view class="record-info">
                <view class="record-title text-ellipsis">{{ r.title }}</view>
                <view class="record-meta">
                  <view class="badge badge--gray" v-if="r.typeLabel">{{ r.typeLabel }}</view>
                  <text class="record-user">{{ r.user }}</text>
                </view>
              </view>
              <text class="record-time">{{ r.time }}</text>
            </view>
            <view class="record-view-all" @tap="onViewAllRecords('favorite')" v-if="favoriteRecords.length > 5">
              查看全部 {{ behaviorMetrics.totalFavorites }} 条 →
            </view>
          </mc-card>
          <view class="empty-state empty-state--inline" v-else>
            <text class="empty-state__text">暂无收藏记录</text>
          </view>
        </view>
      </view>

      <!-- 活跃通知 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">活跃通知</text>
          <text class="section-more" @tap="onViewAllNotifications">查看全部 ›</text>
        </view>
        <mc-card v-if="activeNotifications.length > 0">
          <view
            class="list-item"
            v-for="n in activeNotifications"
            :key="n._id"
            @tap="onTapNotification(n)"
            hover-class="list-item--active"
          >
            <view class="list-item-icon" :class="`list-item-icon--${n.iconColor}`">
              <mc-icon :path="n.iconPath" :color="n.iconColor" :size="40" />
            </view>
            <view class="list-item-text">
              <view class="list-item-title">{{ n.title }}</view>
              <view class="list-item-desc text-ellipsis">{{ n.summary }}</view>
            </view>
            <view class="list-item-right">
              <view class="badge" :class="n.typeBadge">{{ n.typeLabel }}</view>
            </view>
          </view>
        </mc-card>
        <view class="empty-state empty-state--inline" v-else>
          <text class="empty-state__text">暂无活跃通知</text>
        </view>
      </view>
    </block>
    <mc-tabbar :current="2" />
  </view>
</template>

<script>
import api from '../../utils/api'
import logger from '../../utils/logger'
import { formatTime, NOTIFICATION_TYPE, toast } from '../../utils/format'
import cache from '../../utils/cache'
import { getCloud } from '../../utils/cloud'

const CACHE_KEY = 'cache_ops'

const SVG = {
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  chart: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
  chevron: '<polyline points="9 18 15 12 9 6"/>',
  announcement: '<path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z"/>',
}

const NOTIF_ICONS = {
  announcement: { path: SVG.announcement, color: '#10AEFF' },
  update: { path: SVG.bell, color: '#07C160' },
  activity: { path: SVG.chart, color: '#FF9500' },
}

export default {
  data() {
    return {
      loading: true,
      metrics: { totalUsers: 0, todayActive: 0, members: 0 },
      behaviorMetrics: { totalDownloads: 0, totalFavorites: 0 },
      modules: [
        {
          key: 'user',
          title: '用户管理',
          desc: '用户列表 · 会员等级 · 权限',
          color: 'blue',
          url: '/pages/user-list/user-list',
          iconPath: SVG.users,
          iconColor: '#10AEFF',
        },
        {
          key: 'notification',
          title: '通知管理',
          desc: '公告 · 更新 · 活动',
          color: 'green',
          url: '/pages/notification-list/notification-list',
          iconPath: SVG.bell,
          iconColor: '#07C160',
          activeCount: 0,
        },
        {
          key: 'report',
          title: '数据报表',
          desc: '流量 · 下载 · 收藏趋势',
          color: 'orange',
          url: '/pages/dashboard/dashboard',
          iconPath: SVG.chart,
          iconColor: '#FF9500',
        },
      ],
      downloadRecords: [],
      favoriteRecords: [],
      activeNotifications: [],
      icons: {
        chevronRight: SVG.chevron,
        download: SVG.download,
        star: SVG.star,
      },
    }
  },

  async onShow() {
    // 同步自定义 tabBar 选中态（索引 2 = 运营）
    try {
      const tabBar = this.$mp && this.$mp.page && this.$mp.page.getTabBar && this.$mp.page.getTabBar()
      if (tabBar) tabBar.selected = 2
    } catch (e) {}

    // TTL 内直接用缓存，不再触发网络请求
    const cached = cache.getCached(CACHE_KEY)
    if (cached) {
      this.applyOpsData(cached)
      return
    }

    // 缓存过期或无缓存，先用 stale 兜底再刷新
    const stale = cache.getCachedStale(CACHE_KEY)
    if (stale) this.applyOpsData(stale)
    await getCloud()
    this.loadData(!stale)
  },

  onPullDownRefresh() {
    this.loadData(true).finally(() => uni.stopPullDownRefresh())
  },

  methods: {
    applyOpsData(d) {
      this.metrics = d.metrics || this.metrics
      this.behaviorMetrics = d.behaviorMetrics || this.behaviorMetrics
      this.modules = d.modules || this.modules
      this.downloadRecords = d.downloadRecords || []
      this.favoriteRecords = d.favoriteRecords || []
      this.activeNotifications = d.activeNotifications || []
      this.loading = false
    },

    async loadData(showLoading) {
      if (showLoading !== false) this.loading = true
      try {
        const [
          notifRes,
          memberRes,
          todayRes,
          totalRes,
          behaviorRes,
          downloadRes,
          favoriteRes,
        ] = await Promise.allSettled([
          api.getNotifications({ isActive: true, page: 1, pageSize: 5 }),
          api.getUsers({ page: 1, pageSize: 1, filter: 'member' }),
          api.getUsers({ page: 1, pageSize: 1, filter: 'today' }),
          api.getTotalUsers(),
          api.getBehaviorStats(),
          api.getDownloadRecords(100),
          api.getFavoriteRecords(100),
        ])

        const notifList = this.extractList(notifRes)
        const memberCount = this.extractTotal(memberRes)
        const todayCount = this.extractTotal(todayRes)
        const totalUsers = totalRes.status === 'fulfilled' ? (totalRes.value || 0) : 0
        const activeNotifCount = this.extractTotal(notifRes)
        const behavior = behaviorRes.status === 'fulfilled' ? behaviorRes.value : {}

        const modules = this.modules.map((m) => {
          if (m.key === 'notification') return { ...m, activeCount: activeNotifCount }
          return m
        })

        const downloadList = downloadRes.status === 'fulfilled' ? downloadRes.value : []
        const favoriteList = favoriteRes.status === 'fulfilled' ? favoriteRes.value : []

        const data = {
          metrics: {
            totalUsers,
            todayActive: todayCount,
            members: memberCount,
          },
          behaviorMetrics: {
            totalDownloads: behavior.totalDownloads || 0,
            totalFavorites: behavior.totalFavorites || 0,
          },
          modules,
          downloadRecords: downloadList.map((r) => this.formatRecord(r)),
          favoriteRecords: favoriteList.map((r) => this.formatRecord(r)),
          activeNotifications: notifList.map((n) => this.formatNotification(n)),
        }
        cache.setCached(CACHE_KEY, data)
        this.loading = false
        this.metrics = data.metrics
        this.behaviorMetrics = data.behaviorMetrics
        this.modules = data.modules
        this.downloadRecords = data.downloadRecords
        this.favoriteRecords = data.favoriteRecords
        this.activeNotifications = data.activeNotifications
      } catch (err) {
        logger.error('[ops] 加载失败', err)
        if (showLoading !== false) {
          this.loading = false
          toast('加载失败，下拉重试')
        }
      }
    },

    extractList(res) {
      if (res.status !== 'fulfilled') return []
      const v = res.value
      if (!v) return []
      if (Array.isArray(v)) return v
      if (Array.isArray(v.list)) return v.list
      if (v.data && Array.isArray(v.data)) return v.data
      return []
    },

    extractTotal(res) {
      if (res.status !== 'fulfilled') return 0
      const v = res.value
      if (!v) return 0
      if (typeof v.total === 'number') return v.total
      if (Array.isArray(v)) return v.length
      if (v.list && Array.isArray(v.list)) return v.list.length
      return 0
    },

    formatRecord(r) {
      const title = r.resourceTitle || (r.resource && r.resource.title) || r.title || '未命名资源'
      const type = r.resourceType || (r.resource && r.resource.type) || r.type || ''
      const cover = r.resourceCover || (r.resource && (r.resource.coverUrl || r.resource.url)) || r.coverUrl || r.url || ''
      const userOpenid = r._openid || ''
      return {
        _id: r._id || r.id,
        title,
        type,
        typeLabel: type === 'avatar' ? '头像' : (type === 'wallpaper' ? '壁纸' : ''),
        cover,
        user: userOpenid ? '用户 ' + userOpenid.slice(-6) : '未知用户',
        time: formatTime(r.createTime || r.create_time || r.createdAt),
      }
    },

    formatNotification(n) {
      const type = n.type || 'announcement'
      const typeInfo = NOTIFICATION_TYPE[type] || NOTIFICATION_TYPE.announcement
      const icon = NOTIF_ICONS[type] || NOTIF_ICONS.announcement
      return {
        _id: n._id || n.id,
        title: n.title || '',
        summary: n.summary || n.content || '',
        type,
        typeLabel: typeInfo.label,
        typeBadge: typeInfo.badge,
        iconPath: icon.path,
        iconColor: icon.color,
        isActive: n.isActive !== false,
        time: formatTime(n.createdAt || n.createTime || n.ts),
      }
    },

    onNavigate(url) {
      if (!url) return
      if (url.indexOf('dashboard') > -1) {
        uni.reLaunch({ url })
      } else {
        uni.navigateTo({ url })
      }
    },

    onTapNotification(n) {
      uni.navigateTo({ url: '/pages/notification-edit/notification-edit?id=' + n._id })
    },

    onViewAllNotifications() {
      uni.navigateTo({ url: '/pages/notification-list/notification-list' })
    },

    onViewAllRecords(tab) {
      uni.navigateTo({ url: '/pages/records/records?tab=' + (tab || 'download') })
    },
  },
}
</script>

<style lang="scss" scoped>
.ops-page {
  padding-bottom: 220rpx;
}

.metric-card--sm {
  padding: 24rpx 16rpx;
  text-align: center;
}

.metric-value--sm {
  font-size: 40rpx;
}

.metric-label--center {
  justify-content: center;
}

.arrow-icon {
  width: 28rpx;
  height: 28rpx;
}

/* 行为记录区块 */
.record-block {
  margin-bottom: 24rpx;
}

.record-block:last-child {
  margin-bottom: 0;
}

.record-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4rpx 16rpx;
}

.record-block-title {
  display: flex;
  align-items: center;
  gap: 10rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.record-block-icon {
  width: 32rpx;
  height: 32rpx;
}

.record-block-count {
  font-size: 24rpx;
  color: var(--text-secondary);
  font-weight: 500;
}

.record-item {
  display: flex;
  align-items: center;
  padding: 20rpx 32rpx;
  gap: 20rpx;
  border-bottom: 1rpx solid var(--divider);
}

.record-item:last-child {
  border-bottom: none;
}

.record-cover {
  width: 80rpx;
  height: 80rpx;
  border-radius: var(--r-sm);
  flex-shrink: 0;
  background: var(--divider);
}

.record-cover--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.record-cover-icon {
  width: 36rpx;
  height: 36rpx;
  opacity: 0.35;
}

.record-info {
  flex: 1;
  min-width: 0;
}

.record-title {
  font-size: 28rpx;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.4;
}

.record-meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 8rpx;
}

.record-user {
  font-size: 22rpx;
  color: var(--text-tertiary);
}

.record-time {
  font-size: 22rpx;
  color: var(--text-tertiary);
  flex-shrink: 0;
  white-space: nowrap;
}

.empty-state--inline {
  padding: 48rpx 32rpx;
  background: var(--bg-card);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-card);
}

.record-view-all {
  text-align: center;
  padding: 24rpx 0 12rpx;
  font-size: 24rpx;
  color: var(--pri);
  font-weight: 500;
}

.record-view-all:active {
  opacity: 0.7;
}

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

.skeleton-icon {
  width: 76rpx;
  height: 76rpx;
  border-radius: var(--r-sm);
  flex-shrink: 0;
}

.skeleton-line {
  height: 32rpx;
  flex: 1;
  max-width: 320rpx;
}
</style>
