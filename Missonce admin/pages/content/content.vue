<template>
  <view class="page-container content-page" style="padding-bottom: calc(130rpx + env(safe-area-inset-bottom));">
    <!-- 加载骨架 -->
    <block v-if="loading">
      <view class="list-card">
        <view class="skeleton-row" v-for="n in 5" :key="n">
          <view class="skeleton skeleton-icon" />
          <view class="skeleton skeleton-line" />
        </view>
      </view>
      <view class="section">
        <view class="skeleton skeleton-title" />
        <view class="skeleton skeleton-block" />
      </view>
    </block>

    <block v-else>
      <!-- 内容管理模块 -->
      <view class="list-card">
        <view
          class="list-item"
          v-for="m in modules"
          :key="m.key"
          hover-class="list-item--active"
          @tap="onNavigate(m.url)"
        >
          <view class="list-item-icon list-item-icon--{{ m.color }}">
            <mc-icon :name="m.iconName" :color="colorOf(m.color)" :size="40" />
          </view>
          <view class="list-item-text">
            <view class="list-item-title">{{ m.title }}</view>
          </view>
          <view class="list-item-right">
            <text class="list-item-count" :class="{ 'list-item-count--warn': m.review }">{{ m.count }}</text>
            <mc-icon name="chevron-right" color="#B8B8C8" :size="28" />
          </view>
        </view>
      </view>

      <!-- 首页 Tab 配置 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">首页 Tab 配置</text>
          <text class="section-more" @tap="onNavigate('/pages/home-tabs/home-tabs')">管理 ›</text>
        </view>
        <view class="list-card" v-if="homeTabs.length > 0">
          <view class="list-item tab-row" v-for="t in homeTabs" :key="t._id">
            <mc-icon name="drag" color="#B8B8C8" :size="32" class="drag-icon" />
            <view class="list-item-text">
              <view class="list-item-title">{{ t.name }}</view>
            </view>
            <view
              class="toggle"
              :class="{ 'toggle--on': t.enabled }"
              @tap.stop="onToggleTab(t._id)"
            >
              <view class="toggle__knob" />
            </view>
          </view>
        </view>
        <view class="empty-state empty-state--inline" v-else>
          <text class="empty-state__text">暂无 Tab 配置</text>
        </view>
      </view>

      <!-- 广告配置概览 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">广告配置概览</text>
          <text class="section-more" @tap="onNavigate('/pages/ad-config/ad-config')">管理 ›</text>
        </view>
        <block v-if="adConfigs.length > 0">
          <view
            class="ad-card card"
            v-for="a in adConfigs"
            :key="a._id"
            hover-class="card-hover"
            @tap="onTapAd(a._id)"
          >
            <view class="ad-card__head">
              <text class="ad-card__title text-ellipsis">{{ a.title }}</text>
              <view class="badge" :class="a.status === 'active' ? 'badge--green' : 'badge--gray'">
                {{ a.status === 'active' ? '运行中' : '已暂停' }}
              </view>
            </view>
            <view class="ad-card__detail">{{ a.detail }}</view>
            <view class="ad-card__stats">
              <view class="ad-stat">
                <text class="ad-stat__value">{{ a.impressions }}</text>
                <text class="ad-stat__label">曝光</text>
              </view>
              <view class="ad-stat">
                <text class="ad-stat__value">{{ a.clicks }}</text>
                <text class="ad-stat__label">点击</text>
              </view>
              <view class="ad-stat">
                <text class="ad-stat__value">{{ a.ecpm }}</text>
                <text class="ad-stat__label">eCPM</text>
              </view>
            </view>
          </view>
        </block>
        <view class="empty-state empty-state--inline" v-else>
          <text class="empty-state__text">暂无广告配置</text>
        </view>
      </view>
    </block>

    <!-- 快捷添加 FAB -->
    <view class="fab fab--tab" hover-class="fab--active" @tap="onQuickAdd">
      <mc-icon name="plus" color="#ffffff" :size="44" />
    </view>
    <mc-tabbar :current="1" />
  </view>
</template>

<script>
import api from '../../utils/api'
import logger from '../../utils/logger'
import { toast, formatNumber } from '../../utils/format'
import { getCloud } from '../../utils/cloud'
import cache from '../../utils/cache'

const CACHE_KEY = 'cache_content'

const COLORS = {
  green: '#07C160',
  blue: '#10AEFF',
  purple: '#7C5CFC',
  orange: '#FF9500',
  red: '#FA5151',
  cyan: '#00B894',
  pink: '#E84393',
}

export default {
  data() {
    return {
      loading: true,
      reviewCount: 0,
      modules: [
        { key: 'resource', title: '资源管理', color: 'green', count: '0', url: '/pages/resource-list/resource-list', iconName: 'image' },
        { key: 'topic', title: '专题管理', color: 'blue', count: '0', url: '/pages/topic-list/topic-list', iconName: 'book' },
        { key: 'category', title: '分类标签', color: 'purple', count: '0', url: '/pages/category-tags/category-tags', iconName: 'tag' },
        { key: 'homeTab', title: '首页Tab管理', color: 'orange', count: '0', url: '/pages/home-tabs/home-tabs', iconName: 'layout' },
        { key: 'ad', title: '广告配置', color: 'red', count: '0', url: '/pages/ad-config/ad-config', iconName: 'monitor-ad' },
        { key: 'quotes', title: '灵感文案', color: 'cyan', count: '0', url: '/pages/quotes-manage/quotes-manage', iconName: 'message' },
        { key: 'poster', title: '海报语录', color: 'pink', count: '0', url: '/pages/poster-quotes/poster-quotes', iconName: 'layers' },
      ],
      homeTabs: [],
      adConfigs: [],
    }
  },

  async onShow() {
    // 同步自定义 tabBar 选中态（content 为索引 1）
    try {
      const tabBar = this.$mp && this.$mp.page && this.$mp.page.getTabBar && this.$mp.page.getTabBar()
      if (tabBar) tabBar.selected = 1
    } catch (e) {}

    // TTL 内直接用缓存，不再触发网络请求
    const cached = cache.getCached(CACHE_KEY)
    if (cached) {
      this.modules = cached.modules || this.modules
      this.homeTabs = cached.homeTabs || []
      this.adConfigs = cached.adConfigs || []
      this.loading = false
      return
    }

    // 缓存过期或无缓存，先用 stale 兜底再刷新
    const stale = cache.getCachedStale(CACHE_KEY)
    if (stale) {
      this.modules = stale.modules || this.modules
      this.homeTabs = stale.homeTabs || []
      this.adConfigs = stale.adConfigs || []
      this.loading = false
    }
    await getCloud()
    this.loadData(!stale)
  },

  methods: {
    colorOf(color) {
      return COLORS[color] || '#07C160'
    },

    async loadData(showLoading) {
      if (showLoading !== false) this.loading = true
      try {
        const [resRes, topicRes, catRes, tagRes, tabRes, adRes, quotesRes, posterRes, reviewRes] = await Promise.allSettled([
          api.getResources({ page: 1, pageSize: 1 }),
          api.getTopics({ status: 'all' }),
          api.getCategories('all'),
          api.getTags('all'),
          api.getHomeTabs(),
          api.getAdUnits(),
          api.getQuotes({ page: 1, pageSize: 1 }),
          api.getPosterQuotes(),
          api.getResources({ status: 'review', page: 1, pageSize: 1 }),
        ])

        const resourceCount = this.extractTotal(resRes)
        const reviewCount = this.extractTotal(reviewRes)
        this.reviewCount = reviewCount
        const topicCount = this.extractTotal(topicRes)
        const catCount = this.extractList(catRes).length
        const tagCount = this.extractList(tagRes).length
        const tabList = this.extractList(tabRes)
        const adList = this.extractList(adRes)
        const quotesCount = this.extractTotal(quotesRes)
        const posterCount = this.extractList(posterRes).length

        const modules = this.modules.map((m) => {
          let count = 0
          let review = false
          if (m.key === 'resource') {
            if (reviewCount > 0) {
              count = '待审 ' + reviewCount
              review = true
            } else {
              count = resourceCount
            }
          }
          else if (m.key === 'topic') count = topicCount
          else if (m.key === 'category') count = catCount + tagCount
          else if (m.key === 'homeTab') count = tabList.length
          else if (m.key === 'ad') count = adList.length
          else if (m.key === 'quotes') count = quotesCount
          else if (m.key === 'poster') count = posterCount
          const url = (m.key === 'resource' && reviewCount > 0) ? (m.url + '?status=review') : m.url
          return { ...m, count: review ? count : formatNumber(count), review, url }
        })

        const homeTabs = tabList.slice(0, 3).map((t) => ({
          _id: t._id || t.id,
          name: t.name || t.title || '',
          enabled: t.enabled !== false && t.status !== 'inactive',
        }))

        const adConfigs = adList.slice(0, 2).map((a) => ({
          _id: a._id || a.id,
          title: a.title || a.name || '广告位',
          status: a.status || (a.enabled === false ? 'paused' : 'active'),
          detail: this.buildAdDetail(a),
          impressions: formatNumber(a.impressions || a.exposure || 0),
          clicks: formatNumber(a.clicks || 0),
          ecpm: this.calcEcpm(a),
        }))

        const data = { modules, homeTabs, adConfigs }
        cache.setCached(CACHE_KEY, data)
        this.modules = data.modules
        this.homeTabs = data.homeTabs
        this.adConfigs = data.adConfigs
        this.loading = false
      } catch (err) {
        logger.error('[content] 加载失败', err)
        if (showLoading !== false) this.loading = false
      }
    },

    extractTotal(res) {
      if (res.status !== 'fulfilled') return 0
      const v = res.value
      if (!v) return 0
      if (typeof v.total === 'number') return v.total
      if (Array.isArray(v)) return v.length
      if (typeof v === 'number') return v
      if (v.list && Array.isArray(v.list)) return v.list.length
      if (v.data && Array.isArray(v.data)) return v.data.length
      return 0
    },

    extractList(res) {
      if (res.status !== 'fulfilled') return []
      const v = res.value
      if (!v) return []
      if (Array.isArray(v)) return v
      if (Array.isArray(v.list)) return v.list
      if (Array.isArray(v.data)) return v.data
      return []
    },

    buildAdDetail(a) {
      const parts = []
      if (a.frequency) parts.push('频次 ' + a.frequency)
      if (a.adType) parts.push(a.adType)
      if (a.adUnitId) parts.push('ID ' + String(a.adUnitId).slice(0, 8))
      return parts.join(' · ') || '广告位配置'
    },

    calcEcpm(a) {
      const imp = a.impressions || a.exposure || 0
      const clicks = a.clicks || 0
      if (!imp) return '0'
      return ((clicks / imp) * 1000).toFixed(1)
    },

    onNavigate(url) {
      if (url) uni.navigateTo({ url })
    },

    async onToggleTab(id) {
      const idx = this.homeTabs.findIndex((t) => t._id === id)
      if (idx < 0) return
      const tab = this.homeTabs[idx]
      const newEnabled = !tab.enabled
      this.homeTabs[idx].enabled = newEnabled
      try {
        const res = await api.manageHomeTabs('toggleVisible', { id })
        const visible = res && res.data ? res.data.visible : newEnabled
        this.homeTabs[idx].enabled = visible
        toast(visible ? '已启用' : '已停用', 'success')
      } catch (e) {
        this.homeTabs[idx].enabled = tab.enabled
        toast('操作失败')
      }
    },

    onTapAd(id) {
      uni.navigateTo({ url: `/pages/ad-config/ad-config?id=${id}` })
    },

    onQuickAdd() {
      uni.navigateTo({ url: '/pages/resource-upload/resource-upload' })
    },
  },
}
</script>

<style lang="scss" scoped>
.content-page {
  padding-bottom: 220rpx;
}

.drag-icon {
  flex-shrink: 0;
}

/* 广告卡片 */
.ad-card {
  padding: 28rpx 32rpx;
  margin-bottom: 20rpx;
}

.card-hover {
  opacity: 0.85;
}

.ad-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.ad-card__title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
}

.ad-card__detail {
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-top: 12rpx;
}

.ad-card__stats {
  display: flex;
  gap: 24rpx;
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid var(--divider);
}

.ad-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.ad-stat__value {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.ad-stat__label {
  font-size: 22rpx;
  color: var(--text-secondary);
}

/* Tab 页 FAB 上移避开自定义 tabbar */
.fab--tab {
  bottom: calc(180rpx + env(safe-area-inset-bottom));
}

.fab--active {
  transform: scale(0.92);
}

/* 空状态内联 */
.empty-state--inline {
  padding: 48rpx 32rpx;
  background: var(--bg-card);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-card);
}

/* 骨架屏 */
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

.skeleton-title {
  height: 36rpx;
  width: 240rpx;
  margin-bottom: 20rpx;
}

.skeleton-block {
  height: 200rpx;
  border-radius: var(--r-lg);
}

/* 待审核告警计数 */
.list-item-count--warn {
  color: #FF9500;
  font-weight: 700;
}
</style>
