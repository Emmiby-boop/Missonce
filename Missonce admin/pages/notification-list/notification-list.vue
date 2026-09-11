<template>
  <view class="page-container notif-list-page">
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
      <mc-card v-for="n in 3" :key="n">
        <view class="list-item">
          <view class="skeleton list-item-icon" />
          <view class="list-item-text">
            <view class="skeleton" style="height: 30rpx; width: 50%; margin-bottom: 12rpx;" />
            <view class="skeleton" style="height: 22rpx; width: 80%;" />
          </view>
        </view>
      </mc-card>
    </block>

    <!-- 列表 -->
    <block v-else-if="list.length > 0">
      <mc-card>
        <view
          class="list-item"
          v-for="n in list"
          :key="n._id"
          @tap="onTapItem(n)"
          @longpress="onLongPressItem(n)"
          hover-class="list-item--active"
        >
          <view class="list-item-icon" :class="n.type === 'announcement' ? 'list-item-icon--blue' : (n.type === 'update' ? 'list-item-icon--green' : 'list-item-icon--orange')">
            <mc-icon :path="n.type === 'announcement' ? icons.announcement : (n.type === 'update' ? icons.update : icons.activity)" :color="n.type === 'announcement' ? '#10AEFF' : (n.type === 'update' ? '#07C160' : '#FF9500')" :size="40" />
          </view>
          <view class="list-item-text">
            <view class="list-item-title">{{ n.title }}</view>
            <view class="list-item-desc text-ellipsis">{{ n.summary }}</view>
            <view class="list-item-time">{{ n.time }}</view>
          </view>
          <view class="notif-badges">
            <view class="badge" :class="n.typeBadge">{{ n.typeLabel }}</view>
            <view class="badge" :class="n.isActive ? 'badge--green' : 'badge--gray'">{{ n.isActive ? '生效' : '停用' }}</view>
          </view>
        </view>
      </mc-card>

      <!-- 加载更多 -->
      <view class="load-more" v-if="loadingMore">加载中…</view>
      <view class="load-more" v-else-if="!hasMore">没有更多了</view>
    </block>

    <!-- 空状态 -->
    <mc-empty v-else text="暂无通知">
      <mc-btn type="ghost" size="sm" @click="onAdd">新建通知</mc-btn>
    </mc-empty>

    <!-- FAB -->
    <view class="fab" @tap="onAdd">
      <mc-icon class="fab-icon" :path="icons.plus" color="#FFFFFF" :size="44" />
    </view>
  </view>
</template>

<script>
import api from '../../utils/api'
import logger from '../../utils/logger'
import { formatTime, NOTIFICATION_TYPE, toast, showLoading, hideLoading, confirm } from '../../utils/format'
import cache from '../../utils/cache'

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'announcement', label: '公告' },
  { key: 'update', label: '更新' },
  { key: 'activity', label: '活动' },
]

function cacheKey(filter) {
  return 'cache_notif_' + (filter || 'all')
}

export default {
  data() {
    return {
      loading: true,
      list: [],
      filters: FILTERS,
      activeFilter: 'all',
      page: 1,
      pageSize: 20,
      hasMore: true,
      loadingMore: false,
      icons: {
        plus: '<path d="M12 5v14M5 12h14"/>',
        announcement: '<path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
        update: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
        activity: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
      },
    }
  },

  onLoad() {
    const key = cacheKey(this.activeFilter)
    const cached = cache.getCachedStale(key)
    if (cached && cached.list) {
      this.list = cached.list
      this.hasMore = cached.hasMore
      this.page = 1
      this.loading = false
    }
    if (cache.isStale(key)) this.loadList(true)
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
    buildParams() {
      const params = { page: this.page, pageSize: this.pageSize }
      if (this.activeFilter !== 'all') params.type = this.activeFilter
      return params
    },

    async loadList(reset) {
      const key = cacheKey(this.activeFilter)
      const cached = cache.getCachedStale(key)
      const hasCache = !!(cached && cached.list)
      const silentRefresh = reset && hasCache

      if (reset) {
        this.loadError = false
        if (!silentRefresh) {
          this.page = 1
          this.hasMore = true
          this.loading = true
          this.list = []
        }
      } else {
        this.loadingMore = true
      }
      try {
        const params = this.buildParams()
        const res = await api.getNotifications(params)
        const items = this.normalizeList(res)
        const newList = items.map((n) => this.formatNotification(n))
        if (reset) {
          cache.setCached(key, { list: newList, hasMore: newList.length >= this.pageSize })
          if (silentRefresh) {
            this.list = newList
            this.hasMore = newList.length >= this.pageSize
            this.page = 1
          } else {
            this.list = newList
            this.loading = false
            this.hasMore = newList.length >= this.pageSize
          }
        } else {
          this.list = this.list.concat(newList)
          this.loadingMore = false
          this.hasMore = newList.length >= this.pageSize
          this.page = this.page + 1
        }
      } catch (err) {
        logger.error('[notification-list] 加载失败', err)
        if (!silentRefresh) {
          this.loading = false
          this.loadingMore = false
          if (!hasCache) toast('加载失败，下拉重试')
        } else {
          this.loadingMore = false
        }
      }
    },

    normalizeList(res) {
      if (!res) return []
      if (Array.isArray(res)) return res
      if (Array.isArray(res.list)) return res.list
      if (res.data && Array.isArray(res.data)) return res.data
      return []
    },

    formatNotification(n) {
      const type = n.type || 'announcement'
      const typeInfo = NOTIFICATION_TYPE[type] || NOTIFICATION_TYPE.announcement
      return {
        _id: n._id || n.id,
        title: n.title || '',
        summary: n.summary || '',
        type,
        typeLabel: typeInfo.label,
        typeBadge: typeInfo.badge,
        isActive: n.isActive !== false,
        time: formatTime(n.createdAt || n.createTime || n.ts),
      }
    },

    onFilterTap(key) {
      if (key === this.activeFilter) return
      this.activeFilter = key
      this.page = 1
      const cacheK = cacheKey(key)
      const cached = cache.getCachedStale(cacheK)
      if (cached && cached.list) {
        this.list = cached.list
        this.hasMore = cached.hasMore
        this.loading = false
      } else {
        this.list = []
        this.hasMore = true
        this.loading = true
      }
      if (cache.isStale(cacheK)) this.loadList(true)
    },

    onTapItem(n) {
      uni.navigateTo({ url: '/pages/notification-edit/notification-edit?id=' + n._id })
    },

    onLongPressItem(n) {
      uni.showActionSheet({
        itemList: ['编辑', '删除'],
        itemColor: '#1A1A2E',
        success: (res) => {
          if (res.tapIndex === 0) {
            uni.navigateTo({ url: '/pages/notification-edit/notification-edit?id=' + n._id })
          } else if (res.tapIndex === 1) {
            this.onDelete(n)
          }
        },
      })
    },

    async onDelete(item) {
      const ok = await confirm('确定删除该通知？')
      if (!ok) return
      showLoading('删除中…')
      try {
        await api.manageNotification('delete', { id: item._id })
        hideLoading()
        toast('删除成功', 'success')
        this.loadList(true)
      } catch (err) {
        logger.error('[notification-list] 删除失败', err)
        hideLoading()
        toast('删除失败')
      }
    },

    onAdd() {
      uni.navigateTo({ url: '/pages/notification-edit/notification-edit' })
    },
  },
}
</script>

<style lang="scss" scoped>
.notif-list-page {
  padding-bottom: 160rpx;
}

.filter-bar {
  white-space: nowrap;
  padding: 16rpx 0 20rpx;
}

.filter-bar .filter-chip {
  display: inline-block;
  margin-right: 16rpx;
}

.filter-bar .filter-chip:last-child {
  margin-right: 0;
}

.list-item-icon {
  width: 76rpx;
  height: 76rpx;
  border-radius: var(--r-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.list-item-icon--blue { background: var(--info-l); color: var(--info); }
.list-item-icon--green { background: var(--pri-l); color: var(--pri); }
.list-item-icon--orange { background: var(--warning-l); color: var(--warning); }

.list-item-time {
  font-size: 20rpx;
  color: var(--text-tertiary);
  margin-top: 6rpx;
}

.notif-badges {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
  flex-shrink: 0;
}

.load-more {
  text-align: center;
  font-size: 24rpx;
  color: var(--text-tertiary);
  padding: 24rpx 0;
}

.fab-icon {
  width: 44rpx;
  height: 44rpx;
}

.empty-state .btn {
  margin: 0 auto;
}
</style>
