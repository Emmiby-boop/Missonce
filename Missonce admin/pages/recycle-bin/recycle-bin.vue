<template>
  <view class="page-container recycle-bin-page">
    <!-- 顶部提示 -->
    <view class="tip-bar">
      <mc-icon name="alert-circle" color="#FF9500" :size="28" class="tip-icon" />
      <text class="tip-text">回收站资源保留 30 天，超期自动彻底清理。恢复后即刻在小程序可见。</text>
    </view>

    <!-- 加载骨架 -->
    <view class="rgrid" v-if="loading">
      <view class="rcard skeleton-card" v-for="n in 4" :key="n">
        <view class="rcover"><view class="skeleton rcover-skeleton" /></view>
      </view>
    </view>

    <!-- 空状态 -->
    <view class="empty-state" v-else-if="list.length === 0">
      <mc-icon name="trash-2" color="#B8B8C8" :size="140" class="empty-state__icon" />
      <text class="empty-state__text">回收站为空</text>
      <text class="empty-state__sub">删除的资源会暂存在这里 30 天</text>
    </view>

    <!-- 列表 -->
    <view class="rgrid" v-else>
      <view class="rcard" v-for="item in list" :key="item._id">
        <view class="rcover">
          <image v-if="item.cover" class="rcover-img" :src="item.cover" mode="aspectFill" />
          <view v-else class="rcover-ph">
            <mc-icon name="image" color="#B8B8C8" :size="72" class="rcover-ph-icon" />
          </view>
          <!-- 剩余天数角标 -->
          <view class="days-badge" :class="{ 'days-badge--danger': item.daysLeft <= 3 }">
            剩 {{ item.daysLeft }} 天
          </view>
        </view>
        <view class="rcov-b">
          <view class="rtitle">{{ item.title || '未命名' }}</view>
          <view class="raction-row">
            <view class="raction raction--restore" @tap.stop="onRestore(item)">恢复</view>
            <view class="raction raction--purge" @tap.stop="onPurge(item)">彻底删除</view>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部一键清空 -->
    <view class="purge-all" v-if="!loading && list.length > 0">
      <button class="btn btn--default" @tap="onPurgeAll">清空回收站</button>
    </view>
  </view>
</template>

<script>
import api from '../../utils/api'
import logger from '../../utils/logger'
import { toast, confirm } from '../../utils/format'

// 保留天数
const RETAIN_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

export default {
  data() {
    return {
      loading: true,
      list: [],
    }
  },

  onLoad() {
    this.loadList()
  },

  onPullDownRefresh() {
    this.loadList().then(() => uni.stopPullDownRefresh())
  },

  methods: {
    async loadList() {
      this.loading = true
      try {
        const res = await api.getRecycleBin()
        const items = (res && res.list) || []
        const now = Date.now()
        this.list = items.map((item) => {
          const deletedAt = item.deletedAt ? new Date(item.deletedAt).getTime() : 0
          const elapsed = deletedAt > 0 ? Math.floor((now - deletedAt) / DAY_MS) : 0
          const daysLeft = Math.max(0, RETAIN_DAYS - elapsed)
          return Object.assign({}, item, { daysLeft })
        })
        this.loading = false
      } catch (err) {
        logger.error('[recycle-bin] 加载失败', err)
        toast('加载失败')
        this.loading = false
      }
    },

    async onRestore(item) {
      const ok = await confirm(`恢复「${item.title || '未命名'}」？恢复后即刻在小程序可见。`)
      if (!ok) return
      try {
        await api.restoreResource(item._id)
        toast('已恢复', 'success')
        this.loadList()
      } catch (err) {
        logger.error('[recycle-bin] 恢复失败', err)
        toast(err.message || '恢复失败')
      }
    },

    async onPurge(item) {
      const ok = await confirm(`彻底删除「${item.title || '未命名'}」？此操作不可撤销，将同时删除云存储文件。`)
      if (!ok) return
      try {
        await api.purgeResource(item._id)
        toast('已彻底删除', 'success')
        this.loadList()
      } catch (err) {
        logger.error('[recycle-bin] 彻底删除失败', err)
        toast(err.message || '删除失败')
      }
    },

    async onPurgeAll() {
      if (this.list.length === 0) return
      const ok = await confirm(`清空回收站全部 ${this.list.length} 项？此操作不可撤销。`)
      if (!ok) return
      try {
        const ids = this.list.map((i) => i._id)
        await api.purgeResources(ids)
        toast('已清空', 'success')
        this.loadList()
      } catch (err) {
        logger.error('[recycle-bin] 清空失败', err)
        toast(err.message || '清空失败')
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.recycle-bin-page {
  padding: 24rpx 32rpx calc(80rpx + env(safe-area-inset-bottom));
}

.tip-bar {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  background: rgba(255, 149, 0, 0.08);
  border-radius: var(--r-md);
  padding: 20rpx 24rpx;
  margin-bottom: 24rpx;
}
.tip-icon { flex-shrink: 0; margin-top: 2rpx; }
.tip-text { font-size: 24rpx; color: #FF9500; line-height: 1.5; flex: 1; }

.rgrid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
}
.rcard {
  background: var(--bg-card);
  border-radius: var(--r-lg);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}
.skeleton-card { pointer-events: none; }
.rcover {
  position: relative;
  width: 100%;
  padding-bottom: 133.33%;
  background: var(--bg-page);
}
.rcover-img {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  width: 100%;
  height: 100%;
}
.rcover-ph {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rcover-skeleton {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  width: 100%;
  height: 100%;
}
.days-badge {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
}
.days-badge--danger {
  background: rgba(250, 81, 81, 0.9);
}
.rcov-b {
  padding: 16rpx 20rpx 20rpx;
}
.rtitle {
  font-size: 26rpx;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 12rpx;
}
.raction-row {
  display: flex;
  gap: 16rpx;
}
.raction {
  flex: 1;
  text-align: center;
  font-size: 24rpx;
  padding: 10rpx 0;
  border-radius: var(--r-sm);
}
.raction--restore {
  background: rgba(7, 193, 96, 0.1);
  color: #07C160;
}
.raction--purge {
  background: rgba(250, 81, 81, 0.1);
  color: #FA5151;
}

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

.purge-all {
  margin-top: 40rpx;
}
.purge-all .btn { width: 100%; }
</style>
