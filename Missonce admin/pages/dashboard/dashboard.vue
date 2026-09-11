<template>
  <view class="page-container" style="padding-bottom: calc(130rpx + env(safe-area-inset-bottom));">
    <!-- 加载骨架 -->
    <block v-if="loading">
      <view class="metric-grid">
        <mc-skeleton
          v-for="n in 4"
          :key="n"
          style="height: 160rpx; border-radius: 20rpx;"
        />
      </view>
      <mc-skeleton style="height: 200rpx; border-radius: 20rpx; margin-top: 24rpx;" />
    </block>

    <!-- 内容 -->
    <block v-else>
      <!-- KPI 卡片 -->
      <view class="metric-grid">
        <view class="metric-card metric-card--highlight">
          <view class="metric-value">{{ metrics.totalResources }}</view>
          <view class="metric-label">
            <mc-icon class="metric-label__icon" :path="icons.gridPath" color="#fff" :size="26" />
            <text>总资源</text>
          </view>
          <view v-if="trends.resourceTrend" class="metric-trend metric-trend--up">{{ trends.resourceTrend }}</view>
        </view>

        <view class="metric-card">
          <view class="metric-value">{{ metrics.todayViews }}</view>
          <view class="metric-label">
            <mc-icon class="metric-label__icon" :path="icons.eyePath" :size="26" />
            <text>今日浏览</text>
          </view>
          <view v-if="trends.viewTrend" class="metric-trend metric-trend--up">{{ trends.viewTrend }}</view>
        </view>

        <view class="metric-card">
          <view class="metric-value">{{ metrics.activeUsers }}</view>
          <view class="metric-label">
            <mc-icon class="metric-label__icon" :path="icons.usersPath" :size="26" />
            <text>活跃用户</text>
          </view>
          <view v-if="trends.userTrend" class="metric-trend metric-trend--up">{{ trends.userTrend }}</view>
        </view>

        <view class="metric-card">
          <view class="metric-value">{{ metrics.memberUsers }}</view>
          <view class="metric-label">
            <mc-icon class="metric-label__icon" :path="icons.starPath" :size="26" />
            <text>会员用户</text>
          </view>
          <view v-if="trends.memberTrend" class="metric-trend metric-trend--warn">{{ trends.memberTrend }}</view>
        </view>
      </view>

      <!-- 快捷操作 -->
      <mc-section title="快捷操作">
        <view class="quick-grid">
          <view class="quick-item" @tap="onQuickAction('addResource')">
            <view class="quick-item__icon list-item-icon--green">
              <mc-icon :path="icons.plusPath" color="#07C160" :size="36" />
            </view>
            <text class="quick-item__label">添加资源</text>
          </view>
          <view class="quick-item" @tap="onQuickAction('sendNotification')">
            <view class="quick-item__icon list-item-icon--blue">
              <mc-icon :path="icons.bellPath" color="#10AEFF" :size="36" />
            </view>
            <text class="quick-item__label">发通知</text>
          </view>
          <view class="quick-item" @tap="onQuickAction('checkUser')">
            <view class="quick-item__icon list-item-icon--purple">
              <mc-icon :path="icons.userSearchPath" color="#7C5CFC" :size="36" />
            </view>
            <text class="quick-item__label">查用户</text>
          </view>
          <view class="quick-item" @tap="onQuickAction('adManage')">
            <view class="quick-item__icon list-item-icon--orange">
              <mc-icon :path="icons.monitorPath" color="#FF9500" :size="36" />
            </view>
            <text class="quick-item__label">广告管理</text>
          </view>
        </view>
      </mc-section>

      <!-- 7 日流量趋势 -->
      <mc-section title="7 日流量趋势">
        <view class="section-more-fix">PV / UV · 今日 UV {{ todayUv }}</view>
        <view class="chart-card">
          <view class="chart-bars">
            <view v-for="(item, idx) in chartData" :key="idx" class="chart-bar-wrap">
              <view
                class="chart-bar"
                :class="{ 'chart-bar--today': item.isToday }"
                :style="{ height: item.value + '%' }"
              >
                <view v-if="item.isToday" class="chart-bar__tip">PV {{ item.pv }} · UV {{ item.uv }}</view>
                <view class="chart-bar__dot" />
              </view>
              <text class="chart-bar__label">{{ item.label }}</text>
            </view>
          </view>
        </view>
      </mc-section>

      <!-- 最近动态 -->
      <mc-section title="最近动态" more="查看全部 ›" @more="onViewAllActivities">
        <mc-card v-if="recentActivities.length > 0">
          <mc-list-item
            v-for="(a, idx) in recentActivities"
            :key="idx"
            :icon-color="a.color"
            @click="onViewAllActivities"
          >
            <template #icon>
              <mc-icon :path="iconPath(a.icon)" :color="colorOf(a.color)" :size="38" />
            </template>
            <template #title>{{ a.title }}</template>
            <template #desc>{{ a.desc }}</template>
            <template #right>
              <text class="list-item-count">{{ a.time }}</text>
            </template>
          </mc-list-item>
        </mc-card>
        <mc-empty v-else text="暂无最近动态" />
      </mc-section>
    </block>
    <mc-tabbar :current="0" />
  </view>
</template>

<script>
import api from '../../utils/api'
import logger from '../../utils/logger'
import { formatTime } from '../../utils/format'
import { getCloud } from '../../utils/cloud'
import cache from '../../utils/cache'

const CACHE_KEY = 'cache_dashboard'

const ICON_PATHS = {
  grid: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 3v18"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  userSearch: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>'
}

const COLOR_MAP = {
  green: '#07C160',
  blue: '#10AEFF',
  purple: '#7C5CFC',
  orange: '#FF9500',
  red: '#FA5151',
  cyan: '#00B894',
  pink: '#E84393',
  gray: '#8C8CA1'
}

export default {
  data() {
    return {
      loading: true,
      metrics: { totalResources: 0, todayViews: 0, activeUsers: 0, memberUsers: 0 },
      trends: { resourceTrend: '', viewTrend: '', userTrend: '', memberTrend: '' },
      todayUv: 0,
      chartData: [],
      recentActivities: [],
      icons: {
        gridPath: ICON_PATHS.grid,
        eyePath: ICON_PATHS.eye,
        usersPath: ICON_PATHS.users,
        starPath: ICON_PATHS.star,
        plusPath: ICON_PATHS.plus,
        bellPath: ICON_PATHS.bell,
        userSearchPath: ICON_PATHS.userSearch,
        monitorPath: ICON_PATHS.monitor
      }
    }
  },

  onLoad() {
    const cached = cache.getCachedStale(CACHE_KEY)
    if (cached) this.applyDashboardData(cached)
  },

  async onShow() {
    // 同步自定义 tabBar 选中态
    try {
      const tabBar = this.$mp && this.$mp.page && this.$mp.page.getTabBar()
      if (tabBar) tabBar.selected = 0
    } catch (e) {}

    // TTL 内直接用缓存，不再触发网络请求
    const cached = cache.getCached(CACHE_KEY)
    if (cached) {
      this.applyDashboardData(cached)
      return
    }

    // 缓存过期或无缓存，先用 stale 兜底再刷新
    const stale = cache.getCachedStale(CACHE_KEY)
    if (stale) this.applyDashboardData(stale)
    await getCloud()
    this.loadData(!stale)
  },

  onPullDownRefresh() {
    this.loadData(true).finally(() => uni.stopPullDownRefresh())
  },

  methods: {
    iconPath(name) {
      return ICON_PATHS[name] || ICON_PATHS.plus
    },
    colorOf(colorName) {
      return COLOR_MAP[colorName] || '#07C160'
    },

    applyDashboardData(dashboard) {
      const trend = dashboard.trends || []
      this.metrics = {
        totalResources: dashboard.totalResources || dashboard.resourceCount || 0,
        todayViews: dashboard.todayViews || dashboard.totalViews || dashboard.todayPV || 0,
        activeUsers: dashboard.activeUsers || dashboard.todayActiveUsers || 0,
        memberUsers: dashboard.memberUsers || dashboard.vipCount || 0
      }
      this.trends = {
        resourceTrend: dashboard.resourceTrend || `本周 +${dashboard.weekNewResources || 0}`,
        viewTrend: dashboard.viewTrend || '',
        userTrend: dashboard.userTrend || '',
        memberTrend: dashboard.memberTrend || ''
      }
      this.chartData = this.processChartData(trend)
      this.todayUv = (trend && trend.length > 0) ? (trend[trend.length - 1].uv || 0) : 0
      this.recentActivities = this.processActivities(dashboard.recentActivities || dashboard.activities || [])
      this.loading = false
    },

    async loadData(showLoading) {
      if (showLoading !== false) this.loading = true
      try {
        const dashboardRes = await api.getDashboardData()
        const dashboard = dashboardRes || {}
        cache.setCached(CACHE_KEY, dashboard)
        this.applyDashboardData(dashboard)
      }       catch (err) {
        logger.error('[dashboard] 加载失败', err)
        if (showLoading !== false) {
          this.loading = false
          this.loadMockData()
        }
      }
    },

    processChartData(trend) {
      if (!trend || trend.length === 0) {
        const days = ['01', '02', '03', '04', '05', '06', '07']
        const values = [0, 0, 0, 0, 0, 0, 0]
        return days.map((d, i) => ({ label: d, value: values[i], uv: 0, isToday: i === 6 }))
      }
      const list = trend.slice(-7)
      const maxPv = Math.max(1, ...list.map(t => t.pv || 0))
      return list.map((item, idx) => ({
        label: (item.date || '').slice(5) || String(idx + 1).padStart(2, '0'),
        value: Math.round(((item.pv || 0) / maxPv) * 100),
        pv: item.pv || 0,
        uv: item.uv || 0,
        isToday: idx === list.length - 1
      }))
    },

    processActivities(activities) {
      if (!activities || activities.length === 0) {
        return [{ icon: 'plus', color: 'green', title: '暂无最近动态', desc: '数据加载后显示', time: '' }]
      }
      return activities.slice(0, 5).map((a) => ({
        icon: a.icon || 'plus',
        color: a.color || 'green',
        title: a.title || a.text || '',
        desc: a.desc || a.description || '',
        time: formatTime(a.time || a.createdAt || a.ts)
      }))
    },

    loadMockData() {
      this.metrics = { totalResources: 0, todayViews: 0, activeUsers: 0, memberUsers: 0 }
      this.chartData = this.processChartData([])
      this.recentActivities = []
    },

    onQuickAction(action) {
      const routes = {
        addResource: '/pages/resource-upload/resource-upload',
        sendNotification: '/pages/notification-edit/notification-edit',
        checkUser: '/pages/user-list/user-list',
        adManage: '/pages/ad-config/ad-config'
      }
      const url = routes[action]
      if (url) uni.navigateTo({ url })
    },

    onViewAllActivities() {
      uni.navigateTo({ url: '/pages/logs/logs' })
    }
  }
}
</script>

<style lang="scss" scoped>
.metric-label__icon {
  width: 26rpx;
  height: 26rpx;
}

.metric-card--highlight .metric-label__icon {
  filter: brightness(0) invert(1);
  opacity: 0.7;
}

/* 快捷操作网格 */
.quick-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 16rpx;
}

.quick-item {
  background: var(--bg-card);
  border-radius: var(--r-lg);
  padding: 28rpx 12rpx 20rpx;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  box-shadow: var(--shadow-card);
}

.quick-item:active {
  opacity: 0.7;
  transform: scale(0.96);
}

.quick-item__icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: var(--r-sm);
  display: flex;
  align-items: center;
  justify-content: center;
}

.quick-item__label {
  font-size: 22rpx;
  color: var(--text-primary);
  font-weight: 500;
}

/* 图表卡片 */
.chart-card {
  background: var(--bg-card);
  border-radius: var(--r-lg);
  padding: 28rpx;
  box-shadow: var(--shadow-card);
}

.chart-bars {
  display: flex;
  align-items: flex-end;
  gap: 12rpx;
  height: 200rpx;
  padding-bottom: 40rpx;
  position: relative;
}

.chart-bars::after {
  content: '';
  position: absolute;
  bottom: 40rpx;
  left: 0;
  right: 0;
  height: 1rpx;
  background: var(--divider);
}

.chart-bar-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
}

.chart-bar {
  width: 100%;
  border-radius: 8rpx 8rpx 0 0;
  background: var(--pri-l);
  position: relative;
  transition: height 0.3s ease-out;
}

.chart-bar--today {
  background: var(--pri);
}

.chart-bar__dot {
  position: absolute;
  top: -6rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: var(--pri);
}

.chart-bar__tip {
  position: absolute;
  top: -52rpx;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  background: #1A1A2E;
  color: #fff;
  font-size: 18rpx;
  line-height: 1;
  padding: 8rpx 12rpx;
  border-radius: var(--r-sm);
  opacity: 0.92;
}

.chart-bar__label {
  position: absolute;
  bottom: -30rpx;
  left: 50%;
  transform: translateX(-50%);
  font-size: 18rpx;
  color: var(--text-tertiary);
}

.section-more-fix {
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-bottom: 20rpx;
}

.list-item__activity-icon {
  width: 38rpx;
  height: 38rpx;
}
</style>
