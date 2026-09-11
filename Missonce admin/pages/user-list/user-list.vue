<template>
  <view class="page-container user-list-page">
    <!-- Hero 会员总览卡 -->
    <view class="hero-card" v-if="stats">
      <view class="hero-top">
        <view class="hero-total-wrap">
          <view class="hero-total">{{ stats.totalMembers || 0 }}</view>
          <view class="hero-total-label">总会员数</view>
        </view>
        <view class="hero-trend" v-if="stats.levelStats && stats.levelStats.weekly > 0">
          <text class="hero-trend__arrow">↗</text>
          <text>周卡 {{ stats.levelStats.weekly }}</text>
        </view>
      </view>

      <!-- 等级分布条形图 -->
      <view class="level-bars" v-if="levelBars.length > 0">
        <view class="level-bar" v-for="item in levelBars" :key="item.level">
          <text class="level-bar__label">{{ item.label }}</text>
          <view class="level-bar__track">
            <view class="level-bar__fill" :style="{ width: item.percent + '%' }"></view>
          </view>
          <text class="level-bar__count">{{ item.count }}</text>
        </view>
      </view>
    </view>

    <!-- Hero 骨架 -->
    <view class="hero-card hero-card--skeleton" v-if="loading && !stats">
      <view class="hero-top">
        <view class="hero-total-wrap">
          <mc-skeleton height="56rpx" width="200rpx" radius="12rpx" />
          <mc-skeleton height="24rpx" width="140rpx" radius="8rpx" style="margin-top: 12rpx;" />
        </view>
      </view>
      <view class="level-bars">
        <view class="level-bar" v-for="n in 5" :key="n">
          <mc-skeleton height="20rpx" width="72rpx" radius="8rpx" />
          <mc-skeleton height="12rpx" :style="{ width: (40 + n * 10) + '%' }" radius="100rpx" />
          <mc-skeleton height="20rpx" width="48rpx" radius="8rpx" />
        </view>
      </view>
    </view>

    <!-- 搜索区 -->
    <view class="search-card">
      <view class="search-input-wrap">
        <mc-icon name="search" color="#8C8CA1" :size="32" />
        <input
          class="search-input"
          type="text"
          placeholder="搜索用户 ID 后六位 (如 EWUM8)"
          :value="keyword"
          confirm-type="search"
          @input="onSearchInput"
          @confirm="onSearch"
        />
      </view>
    </view>

    <!-- 快捷筛选 -->
    <scroll-view class="filter-row" scroll-x enhanced :show-scrollbar="false">
      <view
        class="chip"
        :class="getChipClass(item)"
        v-for="item in filterChips"
        :key="item.key"
        @tap="onFilterTap(item.key)"
      >
        <view class="chip__dot" v-if="item.dot"></view>
        <text>{{ item.label }}</text>
      </view>
    </scroll-view>

    <!-- 列表加载骨架 -->
    <block v-if="showList && loading">
      <view class="user-card" v-for="n in 3" :key="n">
        <view class="user-card__main">
          <mc-skeleton height="88rpx" width="88rpx" radius="50%" />
          <view class="user-card__info">
            <mc-skeleton height="30rpx" width="40%" radius="12rpx" style="margin-bottom: 12rpx;" />
            <mc-skeleton height="22rpx" width="60%" radius="12rpx" />
          </view>
          <mc-skeleton height="32rpx" width="100rpx" radius="100rpx" />
        </view>
      </view>
    </block>

    <!-- 错误状态 -->
    <mc-error
      v-else-if="showList && loadError && !list.length"
      :text="errorMsg || '加载失败，请稍后重试'"
    >
      <mc-btn type="ghost" size="sm" @click="retryLoad">重试</mc-btn>
    </mc-error>

    <!-- 用户列表 -->
    <block v-else-if="showList && filteredList.length > 0">
      <!-- 列表头 -->
      <view class="list-header">
        <text class="list-header__title">用户列表</text>
        <text class="list-header__count" v-if="activeFilter === 'all'">共 {{ total }} 条 · 第 {{ page }}/{{ totalPages }} 页</text>
        <text class="list-header__count" v-else>筛选 {{ filteredList.length }} / {{ list.length }} 条</text>
      </view>

      <!-- 用户卡片 -->
      <view
        class="user-card"
        v-for="item in filteredList"
        :key="item._openid"
        @tap="onManageUser(item._openid)"
      >
        <!-- 状态色条 -->
        <view class="user-card__accent" :class="'user-card__accent--' + item.expireStatus"></view>

        <view class="user-card__main">
          <!-- 头像 + 等级色环 + 角标 -->
          <view class="avatar-wrap">
            <image v-if="item.avatarUrl" class="avatar" :src="item.avatarUrl" mode="aspectFill" />
            <view v-else class="avatar" :style="{ background: item.avatarColor }">{{ item.initial }}</view>
            <view class="avatar-ring" :class="'avatar-ring--' + item.memberLevel"></view>
            <view class="avatar-badge" :class="'avatar-badge--' + item.memberLevel" v-if="item.memberLevel !== 'none'">{{ item.memberLevelAbbr }}</view>
          </view>

          <view class="user-card__info">
            <view class="user-card__name-row">
              <text class="user-card__name">{{ item.nickName }}</text>
              <text class="user-card__id">...{{ item.shortId }}</text>
            </view>
            <view class="user-card__meta">
              <text>注册 {{ item.registeredAtText }}</text>
              <text class="user-card__meta-dot"></text>
              <text>{{ item.lastActiveText }}</text>
            </view>
          </view>

          <view class="user-card__right">
            <text class="user-card__level-tag" :class="'level-tag--' + item.memberLevel">{{ item.memberLevelLabel }}</text>
            <text class="user-card__expire" :class="'user-card__expire--' + item.expireStatus">{{ item.expireText }}</text>
          </view>
        </view>

        <!-- 次要信息三宫格 -->
        <view class="user-card__stats">
          <view class="stat-pill">
            <mc-icon name="zap" :color="statPillColor" :size="24" class="stat-pill__icon" />
            <text class="stat-pill__label">积分</text>
            <text class="stat-pill__value">{{ item.points }}</text>
          </view>
          <view class="stat-pill">
            <mc-icon name="calendar" :color="statPillColor" :size="24" class="stat-pill__icon" />
            <text class="stat-pill__label">签到</text>
            <text class="stat-pill__value">{{ item.checkInDays }}天</text>
          </view>
          <view class="stat-pill">
            <mc-icon name="download" :color="statPillColor" :size="24" class="stat-pill__icon" />
            <text class="stat-pill__label">下载</text>
            <text class="stat-pill__value" :class="{ 'stat-pill__value--green': item.hasDownloads, 'stat-pill__value--warn': !item.hasDownloads }">{{ item.downloadsRemaining }}</text>
          </view>
        </view>
      </view>

      <!-- 分页 -->
      <view class="pagination" v-if="activeFilter === 'all'">
        <mc-btn type="default" size="sm" class="pagination-btn" :disabled="page <= 1 || loading" @click="onPrevPage">上一页</mc-btn>
        <view class="pagination-info">第 {{ page }} 页 / 共 {{ totalPages }} 页</view>
        <mc-btn type="default" size="sm" class="pagination-btn" :disabled="!hasMore || loading" @click="onNextPage">下一页</mc-btn>
      </view>
      <view class="pagination pagination--hint" v-else>
        <text class="pagination-hint">筛选仅作用于已加载列表，加载更多可扩大范围</text>
      </view>
    </block>

    <!-- 空状态 -->
    <mc-empty v-else-if="showList && !loading" :text="activeFilter !== 'all' ? '当前筛选无匹配用户' : '暂无用户数据'" />

    <!-- 查看全部用户按钮 -->
    <view class="view-all-section" v-if="!showList">
      <mc-btn class="view-all-btn" type="ghost" block @click="onViewAll">
        <mc-icon name="bar-chart" color="#07C160" :size="32" />
        <text>查看全部用户</text>
      </mc-btn>
    </view>
  </view>
</template>

<script>
import api from '../../utils/api'
import logger from '../../utils/logger'
import { getInitial, getAvatarColor, toast } from '../../utils/format'
import cache from '../../utils/cache'

const CACHE_KEY_STATS = 'cache:user-list:stats'

const MEMBER_LEVELS = [
  { value: 'none', label: '非会员', abbr: '', badge: 'badge--gray', days: 0 },
  { value: 'weekly', label: '周卡', abbr: '周', badge: 'badge--yellow', days: 7 },
  { value: 'monthly', label: '月卡', abbr: '月', badge: 'badge--green', days: 30 },
  { value: 'quarterly', label: '季卡', abbr: '季', badge: 'badge--cyan', days: 90 },
  { value: 'yearly', label: '年卡', abbr: '年', badge: 'badge--blue', days: 365 },
  { value: 'lifetime', label: '终身', abbr: '终', badge: 'badge--purple', days: -1 },
]

const MEMBER_LEVEL_MAP = {}
MEMBER_LEVELS.forEach((m) => { MEMBER_LEVEL_MAP[m.value] = m })

const STATS_LEVELS = ['weekly', 'monthly', 'quarterly', 'yearly', 'lifetime']

// 筛选 chips 定义
const FILTER_CHIPS = [
  { key: 'all', label: '全部' },
  { key: 'weekly', label: '周卡' },
  { key: 'monthly', label: '月卡' },
  { key: 'quarterly', label: '季卡' },
  { key: 'yearly', label: '年卡' },
  { key: 'lifetime', label: '终身' },
  { key: 'expiring', label: '即将到期', dot: true, tone: 'warn' },
  { key: 'expired', label: '已过期', dot: true, tone: 'danger' },
]

const ONE_DAY = 24 * 60 * 60 * 1000

export default {
  data() {
    return {
      loading: true,
      searching: false,
      keyword: '',
      stats: null,
      levelBars: [],
      list: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
      hasMore: false,
      showList: false,
      loadError: false,
      errorMsg: '',
      activeFilter: 'all',
      filterChips: FILTER_CHIPS,
      statPillColor: '#9A9AAB',
    }
  },

  computed: {
    // 前端筛选：等级 / 即将到期 / 已过期
    filteredList() {
      if (this.activeFilter === 'all') return this.list
      if (this.activeFilter === 'expiring') {
        return this.list.filter((u) => u.expireStatus === 'expiring')
      }
      if (this.activeFilter === 'expired') {
        return this.list.filter((u) => u.expireStatus === 'expired')
      }
      // 等级筛选
      return this.list.filter((u) => u.memberLevel === this.activeFilter)
    },
  },

  onLoad() {
    const cachedStats = cache.getCachedStale(CACHE_KEY_STATS)
    if (cachedStats) {
      this.stats = cachedStats
      this.levelBars = this.buildLevelBars(cachedStats)
      this.loading = false
    }
    if (cache.isStale(CACHE_KEY_STATS)) this.loadStats(!cachedStats)
  },

  onPullDownRefresh() {
    if (this.showList) {
      this.page = 1
      this.loadList().finally(() => uni.stopPullDownRefresh())
    } else {
      this.loadStats(true).finally(() => uni.stopPullDownRefresh())
    }
  },

  methods: {
    getChipClass(item) {
      if (this.activeFilter === item.key) return 'chip--active'
      if (item.tone === 'warn') return 'chip--warn'
      if (item.tone === 'danger') return 'chip--danger'
      return ''
    },

    onFilterTap(key) {
      if (key === this.activeFilter) return
      this.activeFilter = key
    },

    async loadStats(showLoading) {
      if (showLoading !== false) this.loading = true
      try {
        const stats = await api.getMemberStats()
        cache.setCached(CACHE_KEY_STATS, stats)
        this.stats = stats
        this.levelBars = this.buildLevelBars(stats)
        this.loading = false
      } catch (err) {
        logger.error('[user-list] 加载统计失败', err)
        if (showLoading !== false) this.loading = false
      }
    },

    buildLevelBars(stats) {
      if (!stats) return []
      const levelStats = stats.levelStats || stats
      const maxCount = Math.max(1, ...STATS_LEVELS.map((l) => levelStats[l] || 0))
      return STATS_LEVELS.map((level) => {
        const info = MEMBER_LEVEL_MAP[level] || { label: level }
        const count = levelStats[level] !== undefined ? levelStats[level] : 0
        return {
          level,
          label: info.label,
          count,
          percent: Math.round((count / maxCount) * 100),
        }
      })
    },

    onSearchInput(e) {
      this.keyword = e.detail.value
    },

    async onSearch() {
      const keyword = (this.keyword || '').trim()
      if (!keyword) {
        toast('请输入用户 ID 后六位')
        return
      }
      this.searching = true
      try {
        const user = await api.searchUser(keyword)
        if (!user) {
          toast('未找到匹配的用户')
          return
        }
        const userId = user._openid || user._id || ''
        if (!userId) {
          toast('用户数据异常')
          return
        }
        uni.navigateTo({ url: '/pages/user-detail/user-detail?id=' + encodeURIComponent(userId) })
      } catch (err) {
        logger.error('[user-list] 搜索失败', err)
        toast('搜索失败')
      } finally {
        this.searching = false
      }
    },

    onViewAll() {
      this.showList = true
      this.page = 1
      this.loadList()
    },

    async loadList() {
      this.loading = true
      this.loadError = false
      try {
        const res = await api.getUsers({ page: this.page, pageSize: this.pageSize })
        const items = (res && res.list) || []
        const total = (res && res.total) || 0
        this.list = items.map((u) => this.formatUser(u))
        this.total = total
        this.totalPages = Math.max(1, Math.ceil(total / this.pageSize))
        this.hasMore = this.page * this.pageSize < total
        this.loading = false
      } catch (err) {
        logger.error('[user-list] 加载列表失败', err)
        this.list = []
        this.loadError = true
        this.errorMsg = err.message || '加载失败，请稍后重试'
        this.loading = false
        toast('加载失败')
      }
    },

    retryLoad() {
      this.loadList()
    },

    // 计算到期状态与文案
    calcExpireInfo(user) {
      const level = user.memberLevel || 'none'
      if (level === 'lifetime') {
        return { status: 'normal', text: '永久有效' }
      }
      if (level === 'none') {
        return { status: 'normal', text: '—' }
      }
      const expireDate = user.memberExpireDate
      if (!expireDate) return { status: 'normal', text: '—' }
      const d = new Date(expireDate)
      if (isNaN(d.getTime())) return { status: 'normal', text: '—' }
      const now = Date.now()
      const diff = d.getTime() - now
      if (diff < 0) {
        return { status: 'expired', text: '已过期' }
      }
      const days = Math.floor(diff / ONE_DAY)
      if (days <= 7) {
        return { status: 'expiring', text: '还剩 ' + (days + 1) + ' 天' }
      }
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return { status: 'normal', text: y + '-' + m + '-' + day }
    },

    // 计算"最近活跃"文案
    calcLastActiveText(user) {
      const ts = user.lastLoginAt || user.lastActiveAt
      if (!ts) return '暂无活跃'
      const diff = Date.now() - new Date(ts).getTime()
      if (isNaN(diff) || diff < 0) return '今日活跃'
      const day = Math.floor(diff / ONE_DAY)
      if (day === 0) return '今日活跃'
      if (day === 1) return '昨日活跃'
      if (day < 7) return day + ' 天前'
      if (day < 30) return Math.floor(day / 7) + ' 周前'
      return Math.floor(day / 30) + ' 月前'
    },

    formatUser(u) {
      const openid = u._openid || u._id || ''
      const level = u.memberLevel || 'none'
      const levelInfo = MEMBER_LEVEL_MAP[level] || MEMBER_LEVEL_MAP.none
      const name = u.nickName || '匿名用户'
      const expireInfo = this.calcExpireInfo(u)
      return {
        _openid: openid,
        shortId: openid ? openid.slice(-6) : '',
        nickName: name,
        avatarUrl: u.avatarUrl || '',
        initial: getInitial(name),
        avatarColor: getAvatarColor(name),
        registeredAtText: this.formatDateOnly(u.registeredAt),
        lastActiveText: this.calcLastActiveText(u),
        points: u.points || 0,
        memberLevel: level,
        memberLevelLabel: levelInfo.label,
        memberLevelAbbr: levelInfo.abbr,
        expireStatus: expireInfo.status,
        expireText: expireInfo.text,
        checkInDays: u.checkInDays || 0,
        downloadsRemaining: u.downloadsRemaining || 0,
        hasDownloads: (u.downloadsRemaining || 0) > 0,
      }
    },

    formatDateOnly(ts) {
      if (!ts) return '-'
      const date = new Date(ts)
      if (isNaN(date.getTime())) return '-'
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return y + '-' + m + '-' + d
    },

    onManageUser(openid) {
      if (!openid) return
      uni.navigateTo({ url: '/pages/user-detail/user-detail?id=' + encodeURIComponent(openid) })
    },

    onPrevPage() {
      if (this.page <= 1 || this.loading) return
      this.page = this.page - 1
      this.loadList()
    },

    onNextPage() {
      if (!this.hasMore || this.loading) return
      this.page = this.page + 1
      this.loadList()
    },
  },
}
</script>

<style lang="scss" scoped>
.user-list-page {
  padding-bottom: 60rpx;
}

/* ============== Hero 会员总览卡 ============== */
.hero-card {
  background: linear-gradient(135deg, #07C160 0%, #06AD56 100%);
  border-radius: var(--r-lg);
  padding: 40rpx 32rpx 32rpx;
  color: #fff;
  position: relative;
  overflow: hidden;
  margin-bottom: 24rpx;
  box-shadow: 0 16rpx 48rpx rgba(7, 193, 96, 0.25);
}

.hero-card--skeleton {
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
  color: var(--text-primary);
}

.hero-card::before {
  content: '';
  position: absolute;
  top: -80rpx;
  right: -80rpx;
  width: 320rpx;
  height: 320rpx;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.hero-card::after {
  content: '';
  position: absolute;
  bottom: -120rpx;
  left: -40rpx;
  width: 240rpx;
  height: 240rpx;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.08) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.hero-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  position: relative;
  z-index: 1;
  margin-bottom: 32rpx;
}

.hero-total {
  font-size: 84rpx;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -2rpx;
  font-variant-numeric: tabular-nums;
}

.hero-total-label {
  font-size: 24rpx;
  opacity: 0.85;
  margin-top: 12rpx;
  letter-spacing: 1rpx;
}

.hero-trend {
  background: rgba(255, 255, 255, 0.2);
  padding: 12rpx 20rpx;
  border-radius: var(--r-pill);
  font-size: 22rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.hero-trend__arrow {
  font-size: 20rpx;
}

/* 等级分布条形图 */
.level-bars {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.level-bar {
  display: flex;
  align-items: center;
  gap: 20rpx;
  font-size: 22rpx;
}

.level-bar__label {
  width: 72rpx;
  opacity: 0.9;
  flex-shrink: 0;
}

.level-bar__track {
  flex: 1;
  height: 12rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: var(--r-pill);
  overflow: hidden;
}

.level-bar__fill {
  height: 100%;
  background: rgba(255, 255, 255, 0.95);
  border-radius: var(--r-pill);
  transition: width 0.6s ease;
}

.level-bar__count {
  width: 56rpx;
  text-align: right;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* ============== 搜索区 ============== */
.search-card {
  background: var(--bg-card);
  border-radius: var(--r-md);
  padding: 20rpx;
  margin-bottom: 20rpx;
  box-shadow: var(--shadow-card);
}

.search-input-wrap {
  display: flex;
  align-items: center;
  background: var(--bg-page);
  border-radius: var(--r-pill);
  padding: 0 28rpx;
  height: 72rpx;
  gap: 16rpx;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: var(--text-primary);
  height: 72rpx;
}

/* ============== 快捷筛选 ============== */
.filter-row {
  white-space: nowrap;
  padding: 0 0 24rpx;
  margin: 0 -32rpx;
  padding-left: 32rpx;
  padding-right: 32rpx;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 24rpx;
  border-radius: var(--r-pill);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 24rpx;
  font-weight: 500;
  border: 1rpx solid var(--border);
  margin-right: 16rpx;
  flex-shrink: 0;
  transition: all 0.2s;
}

.chip:last-child {
  margin-right: 0;
}

.chip--active {
  background: var(--pri);
  color: #fff;
  border-color: var(--pri);
}

.chip--warn {
  background: var(--warning-l);
  color: var(--warning-d);
  border-color: transparent;
}

.chip--danger {
  background: var(--danger-l);
  color: var(--danger);
  border-color: transparent;
}

.chip__dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.6;
}

/* ============== 列表头 ============== */
.list-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 20rpx;
  padding: 0 8rpx;
}

.list-header__title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.list-header__count {
  font-size: 22rpx;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

/* ============== 用户卡片 ============== */
.user-card {
  background: var(--bg-card);
  border-radius: var(--r-md);
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: var(--shadow-card);
  position: relative;
  overflow: hidden;
  transition: transform 0.15s;
}

.user-card:active {
  transform: scale(0.99);
  background: var(--divider);
}

/* 状态色条 */
.user-card__accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 6rpx;
}

.user-card__accent--normal {
  background: transparent;
}

.user-card__accent--expiring {
  background: var(--warning);
}

.user-card__accent--expired {
  background: var(--danger);
}

.user-card__main {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding-left: 8rpx;
}

/* 头像 + 等级色环 */
.avatar-wrap {
  position: relative;
  flex-shrink: 0;
  width: 88rpx;
  height: 88rpx;
}

.avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 36rpx;
  font-weight: 600;
}

.avatar-ring {
  position: absolute;
  inset: -6rpx;
  border-radius: 50%;
  border: 4rpx solid transparent;
  pointer-events: none;
}

.avatar-ring--weekly {
  border-color: var(--warning);
}

.avatar-ring--monthly {
  border-color: var(--pri);
}

.avatar-ring--quarterly {
  border-color: var(--info);
}

.avatar-ring--yearly {
  border-color: var(--info);
}

.avatar-ring--lifetime {
  border-color: var(--purple);
  box-shadow: 0 0 0 2rpx rgba(124, 92, 252, 0.2);
}

.avatar-ring--none {
  display: none;
}

.avatar-badge {
  position: absolute;
  top: -4rpx;
  right: -4rpx;
  background: #fff;
  border-radius: var(--r-pill);
  padding: 4rpx 10rpx;
  font-size: 18rpx;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.15);
}

.avatar-badge--weekly {
  color: var(--warning-d);
}

.avatar-badge--monthly {
  color: var(--pri-d);
}

.avatar-badge--quarterly {
  color: var(--info);
}

.avatar-badge--yearly {
  color: var(--info);
}

.avatar-badge--lifetime {
  color: var(--purple);
}

.user-card__info {
  flex: 1;
  min-width: 0;
}

.user-card__name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}

.user-card__name {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 240rpx;
}

.user-card__id {
  font-size: 20rpx;
  color: var(--text-tertiary);
  font-family: monospace;
  background: var(--divider);
  padding: 4rpx 10rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
}

.user-card__meta {
  display: flex;
  align-items: center;
  gap: 16rpx;
  font-size: 22rpx;
  color: var(--text-secondary);
}

.user-card__meta-dot {
  width: 4rpx;
  height: 4rpx;
  border-radius: 50%;
  background: var(--text-tertiary);
}

/* 右侧状态区 */
.user-card__right {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
}

.user-card__level-tag {
  padding: 6rpx 16rpx;
  border-radius: var(--r-pill);
  font-size: 20rpx;
  font-weight: 600;
  line-height: 1.2;
}

.level-tag--none {
  background: var(--divider);
  color: var(--text-secondary);
}

.level-tag--weekly {
  background: var(--warning-l);
  color: var(--warning-d);
}

.level-tag--monthly {
  background: var(--pri-l);
  color: var(--pri-d);
}

.level-tag--quarterly {
  background: var(--info-l);
  color: var(--info);
}

.level-tag--yearly {
  background: var(--info-l);
  color: var(--info);
}

.level-tag--lifetime {
  background: linear-gradient(135deg, var(--purple-l), var(--pink-l));
  color: var(--purple);
}

.user-card__expire {
  font-size: 20rpx;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.user-card__expire--warn {
  color: var(--warning-d);
  font-weight: 600;
}

.user-card__expire--danger {
  color: var(--danger);
  font-weight: 600;
}

/* 次要信息三宫格 */
.user-card__stats {
  display: flex;
  gap: 32rpx;
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid var(--divider);
  padding-left: 8rpx;
}

.stat-pill {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 22rpx;
  color: var(--text-secondary);
}

.stat-pill__icon {
  flex-shrink: 0;
}

.stat-pill__label {
  color: var(--text-secondary);
}

.stat-pill__value {
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.stat-pill__value--green {
  color: var(--pri);
}

.stat-pill__value--warn {
  color: var(--warning-d);
}

/* ============== 查看全部用户 ============== */
.view-all-section {
  margin-top: 24rpx;
}

.view-all-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
}

/* ============== 分页 ============== */
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 32rpx 0;
  margin-top: 8rpx;
}

.pagination--hint {
  justify-content: center;
}

.pagination-btn {
  min-width: 140rpx;
  text-align: center;
}

.pagination-info {
  font-size: 24rpx;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.pagination-hint {
  font-size: 22rpx;
  color: var(--text-tertiary);
  text-align: center;
}

/* ============== Badge 颜色补充 ============== */
.badge--yellow {
  background: var(--warning-l);
  color: var(--warning-d);
}

.badge--cyan {
  background: var(--info-l);
  color: var(--info);
}
</style>
