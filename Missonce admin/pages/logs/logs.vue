<template>
  <view class="page-container logs-page">
    <!-- 筛选栏 -->
    <scroll-view class="filter-bar" scroll-x enhanced :show-scrollbar="false">
      <view
        class="filter-chip"
        :class="{ 'filter-chip--active': activeFilter === item.key }"
        v-for="item in filters"
        :key="item.key"
        @tap="onFilterTap(item.key)"
      >{{ item.label }}</view>
    </scroll-view>

    <!-- 加载骨架 -->
    <block v-if="loading">
      <view class="log-card" v-for="n in 4" :key="n">
        <view class="log-item">
          <view class="skeleton log-icon-skeleton" />
          <view class="log-content">
            <view class="skeleton" style="height: 28rpx; width: 50%; border-radius: 12rpx; margin-bottom: 16rpx;" />
            <view class="skeleton" style="height: 22rpx; width: 70%; border-radius: 12rpx;" />
          </view>
        </view>
      </view>
    </block>

    <!-- 错误状态 -->
    <view class="error-state" v-else-if="loadError">
      <mc-icon name="alert-circle" color="#FA5151" :size="100" class="error-state__icon" />
      <view class="error-state__text">日志加载失败</view>
      <view class="error-state__action">
        <button class="btn btn--ghost btn--sm" @tap="loadList(true)">重试</button>
      </view>
    </view>

    <!-- 日志列表 -->
    <block v-else-if="list.length > 0">
      <view class="log-card">
        <view
          class="log-item"
          :class="{ 'log-item--expanded': item.expanded }"
          v-for="item in list"
          :key="item._id"
          @tap="onToggleExpand(item._id)"
        >
          <view class="log-icon" :class="'list-item-icon--' + item.typeColor">
            <mc-icon :name="item.iconName" :color="logIconColor(item.typeColor)" :size="40" />
          </view>

          <view class="log-content">
            <view class="log-row">
              <text class="log-action">{{ item.action }}</text>
              <view class="badge" :class="item.badge">{{ item.typeLabel }}</view>
            </view>
            <view class="log-meta">
              <text class="log-operator" v-if="item.operator">操作人: {{ item.operator }}</text>
              <text class="log-dot" v-if="item.operator && item.targetId">·</text>
              <text class="log-target" v-if="item.targetId">目标: {{ item.targetId }}</text>
            </view>
            <view class="log-time">{{ item.time }}</view>

            <!-- 展开详情 -->
            <view class="log-detail" v-if="item.expanded && item.extText">
              <view class="log-detail-label">操作详情</view>
              <view class="log-detail-content">{{ item.extText }}</view>
            </view>
            <view class="log-detail log-detail--empty" v-else-if="item.expanded">
              <text>暂无详情</text>
            </view>
          </view>

          <mc-icon class="log-arrow" :class="{ 'log-arrow--down': item.expanded }" name="chevron-right" color="#B8B8C8" :size="28" />
        </view>
      </view>

      <!-- 加载更多 -->
      <view class="load-more" v-if="loadingMore">加载中…</view>
      <view class="load-more" v-else-if="!hasMore">没有更多了</view>
    </block>

    <!-- 空状态 -->
    <view class="empty-state" v-else>
      <mc-icon name="file-text" color="#B8B8C8" :size="140" class="empty-state__icon" />
      <text class="empty-state__text">暂无操作日志</text>
      <text class="empty-state__sub">管理员的操作记录会显示在这里</text>
    </view>
  </view>
</template>

<script>
import api from '../../utils/api'
import logger from '../../utils/logger'
import { formatDateTime, toast } from '../../utils/format'

// 筛选项：按 action 前缀分类
const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'ad', label: '广告', iconName: 'monitor-ad', color: 'orange' },
  { key: 'update_topic', label: '专题', iconName: 'layout', color: 'blue' },
  { key: 'error', label: '错误', iconName: 'alert-circle', color: 'red' },
]

// 操作类型元数据：根据 action 关键词推断
const ACTION_META = {
  ad: { label: '广告操作', color: 'orange', badge: 'badge--orange', iconName: 'monitor-ad' },
  topic: { label: '专题操作', color: 'blue', badge: 'badge--blue', iconName: 'layout' },
  resource: { label: '资源操作', color: 'green', badge: 'badge--green', iconName: 'image' },
  config: { label: '配置操作', color: 'purple', badge: 'badge--purple', iconName: 'cpu' },
  user: { label: '用户操作', color: 'blue', badge: 'badge--blue', iconName: 'user' },
  system: { label: '系统操作', color: 'green', badge: 'badge--green', iconName: 'cpu' },
  error: { label: '错误日志', color: 'red', badge: 'badge--red', iconName: 'alert-circle' },
}

const TYPE_ICON_COLOR = {
  blue: '#10AEFF',
  orange: '#FF9500',
  green: '#07C160',
  red: '#FA5151',
  purple: '#7C5CFC',
}

const PAGE_SIZE = 20

export default {
  data() {
    return {
      loading: true,
      loadError: false,
      list: [],
      filters: FILTERS,
      activeFilter: 'all',
      page: 1,
      hasMore: true,
      loadingMore: false,
    }
  },

  onLoad() {
    this.loadList(true)
  },

  onPullDownRefresh() {
    this.loadList(true).finally(() => uni.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.hasMore && !this.loadingMore) {
      this.loadList(false)
    }
  },

  methods: {
    onFilterTap(key) {
      if (key === this.activeFilter) return
      this.activeFilter = key
      this.loadList(true)
    },

    async loadList(reset) {
      if (reset) {
        this.page = 1
        this.hasMore = true
        this.loading = true
        this.loadError = false
        this.list = []
      } else {
        this.loadingMore = true
      }
      try {
        const { activeFilter, page } = this
        const params = { page, pageSize: PAGE_SIZE }
        let raw = []
        let total = 0

        if (activeFilter === 'error') {
          const res = await api.getErrorLogs(params)
          raw = res.list || []
          total = res.total || 0
        } else {
          if (activeFilter !== 'all') params.type = activeFilter
          const res = await api.getLogs(params)
          raw = res.list || []
          total = res.total || 0
        }

        const items = raw.map((log) => this.formatLog(log, activeFilter))
        if (reset) {
          this.list = items
          this.loading = false
          this.hasMore = items.length >= PAGE_SIZE && items.length < total
        } else {
          this.list = this.list.concat(items)
          this.loadingMore = false
          this.hasMore = items.length >= PAGE_SIZE && this.list.length < total
          this.page = page + 1
        }
      } catch (err) {
        logger.error('[logs] 加载失败', err)
        this.loading = false
        this.loadingMore = false
        this.loadError = reset
        if (!reset) toast('加载失败，请下拉重试')
      }
    },

    // 根据 action 推断操作类型
    inferType(action) {
      if (!action) return 'system'
      const a = action.toLowerCase()
      if (a.indexOf('ad') >= 0 || a.indexOf('banner') >= 0) return 'ad'
      if (a.indexOf('topic') >= 0) return 'topic'
      if (a.indexOf('resource') >= 0 || a.indexOf('upload') >= 0 || a.indexOf('delete') >= 0) return 'resource'
      if (a.indexOf('config') >= 0 || a.indexOf('setting') >= 0) return 'config'
      if (a.indexOf('user') >= 0) return 'user'
      return 'system'
    },

    formatLog(log, filter) {
      // 错误日志走原结构
      if (filter === 'error') {
        const ts = log.createdAt || log.ts || Date.now()
        let extText = ''
        const ext = log.detail || log.stack || log.message || log.error
        if (ext) {
          try {
            extText = typeof ext === 'string' ? ext : JSON.stringify(ext, null, 2)
          } catch (e) {
            extText = String(ext)
          }
        }
        return {
          _id: log._id || (ts + '_' + Math.random()),
          type: 'error',
          typeLabel: '错误日志',
          typeColor: 'red',
          badge: 'badge--red',
          iconName: 'alert-circle',
          action: log.message || log.type || '错误',
          operator: '',
          targetId: log.page || '',
          time: formatDateTime(ts),
          extText,
          expanded: false,
        }
      }

      // 管理员操作日志
      const action = log.action || '未知操作'
      const type = this.inferType(action)
      const meta = ACTION_META[type] || ACTION_META.system

      // 时间字段兼容：createdAt / timestamp / createdAtText
      const ts = log.createdAt || log.timestamp || log.ts || Date.now()

      // 操作人：operator 可能是对象或字符串
      let operator = ''
      if (log.operator) {
        if (typeof log.operator === 'string') {
          operator = log.operator.substring(0, 12) + '...'
        } else if (log.operator.openid) {
          operator = log.operator.openid.substring(0, 12) + '...'
        } else if (log.operator.uid) {
          operator = log.operator.uid
        }
      }

      // 目标 ID
      let targetId = ''
      if (log.targetId) {
        targetId = typeof log.targetId === 'string' ? log.targetId.substring(0, 16) : String(log.targetId)
      }

      // 详情：detail / details / data
      let extText = ''
      const ext = log.detail || log.details || log.data || null
      if (ext) {
        try {
          extText = typeof ext === 'string' ? ext : JSON.stringify(ext, null, 2)
        } catch (e) {
          extText = String(ext)
        }
      }

      return {
        _id: log._id || (ts + '_' + Math.random()),
        type,
        typeLabel: meta.label,
        typeColor: meta.color,
        badge: meta.badge,
        iconName: meta.iconName,
        action: this.formatActionLabel(action),
        operator,
        targetId,
        time: formatDateTime(ts),
        extText,
        expanded: false,
      }
    },

    // 美化 action 显示
    formatActionLabel(action) {
      const map = {
        'update_topic_layout': '更新专题布局',
        'update_topic_content': '更新专题内容',
        'create_topic': '创建专题',
        'delete_topic': '删除专题',
        'ad_config_update': '更新广告配置',
        'ad_config_create': '创建广告配置',
        'ad_config_delete': '删除广告配置',
        'resource_upload': '上传资源',
        'resource_delete': '删除资源',
        'resource_update': '更新资源',
      }
      return map[action] || action
    },

    logIconColor(color) {
      return TYPE_ICON_COLOR[color] || '#8C8CA1'
    },

    onToggleExpand(id) {
      this.list = this.list.map((item) => {
        item.expanded = item._id === id && !item.expanded
        return item
      })
    },
  },
}
</script>

<style lang="scss" scoped>
.logs-page {
  padding-bottom: 60rpx;
}

/* 筛选栏 */
.filter-bar {
  white-space: nowrap;
  padding: 16rpx 0 24rpx;
}

.filter-bar .filter-chip {
  display: inline-block;
  margin-right: 16rpx;
}

.filter-bar .filter-chip:last-child {
  margin-right: 0;
}

/* 日志卡片 */
.log-card {
  background: var(--bg-card);
  border-radius: var(--r-lg);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

/* 日志项 */
.log-item {
  display: flex;
  align-items: flex-start;
  padding: 26rpx 32rpx;
  gap: 24rpx;
  border-bottom: 1rpx solid var(--divider);
}

.log-item:last-child {
  border-bottom: none;
}

.log-item--hover {
  background: var(--divider);
}

/* 图标 */
.log-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: var(--r-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.log-icon-skeleton {
  border-radius: var(--r-sm);
  flex-shrink: 0;
}

/* 内容区 */
.log-content {
  flex: 1;
  min-width: 0;
}

.log-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.log-action {
  font-size: 28rpx;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.log-meta {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: var(--text-secondary);
}

.log-operator {
  font-family: monospace;
}

.log-target {
  font-family: monospace;
}

.log-dot {
  color: var(--text-tertiary);
}

.log-time {
  font-size: 22rpx;
  color: var(--text-tertiary);
  margin-top: 6rpx;
}

/* 展开详情 */
.log-detail {
  margin-top: 16rpx;
  padding: 20rpx;
  background: var(--divider);
  border-radius: var(--r-sm);
}

.log-detail-label {
  font-size: 22rpx;
  color: var(--text-secondary);
  margin-bottom: 8rpx;
}

.log-detail-content {
  font-size: 24rpx;
  color: var(--text-primary);
  word-break: break-all;
  line-height: 1.6;
  font-family: monospace;
}

.log-detail--empty {
  text-align: center;
  font-size: 22rpx;
  color: var(--text-tertiary);
}

/* 箭头 */
.log-arrow {
  width: 28rpx;
  height: 28rpx;
  flex-shrink: 0;
  transform: rotate(90deg);
  transition: transform 0.2s;
  margin-top: 6rpx;
}

.log-arrow--down {
  transform: rotate(-90deg);
}

/* 加载更多 */
.load-more {
  text-align: center;
  font-size: 24rpx;
  color: var(--text-tertiary);
  padding: 24rpx 0;
}

/* 错误状态 */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 160rpx 0;
}
.error-state__icon { margin-bottom: 24rpx; }
.error-state__text { font-size: 30rpx; color: var(--text-primary); margin-bottom: 24rpx; }

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 160rpx 0;
}
.empty-state__icon { margin-bottom: 24rpx; }
.empty-state__text { font-size: 30rpx; color: var(--text-primary); margin-bottom: 8rpx; }
.empty-state__sub { font-size: 24rpx; color: var(--text-tertiary); }
</style>
