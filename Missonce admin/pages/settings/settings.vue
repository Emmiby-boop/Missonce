<template>
  <view class="page-container settings-page" style="padding-bottom: calc(130rpx + env(safe-area-inset-bottom));">
    <!-- 个人资料卡 -->
    <view class="profile-card">
      <view class="profile-card__avatar">
        <image v-if="admin && admin.avatarUrl" class="profile-card__avatar-img" :src="admin.avatarUrl" mode="aspectFill" />
        <text v-else>{{ initial }}</text>
      </view>
      <view class="profile-card__name">{{ (admin && admin.username) || 'Admin' }}</view>
      <view class="profile-card__role">
        <text>{{ admin && admin.role === 'super' ? '超级管理员' : '管理员' }}</text>
        <text v-if="admin && admin.username"> · {{ admin.username }}</text>
      </view>
    </view>

    <!-- 设置组 1：系统配置 -->
    <view class="setting-group">
      <view class="setting-item" @tap="onTapItem('aiConfig')">
        <view class="setting-icon list-item-icon--green">
          <mc-icon :path="icons.cpu" color="#07C160" :size="32" />
        </view>
        <text class="setting-text">AI 服务配置</text>
        <text class="setting-value" :class="aiStatusOk ? 'text-success' : 'text-danger'">{{ aiStatus }}</text>
        <mc-icon :path="icons['chevron-right']" color="#B8B8C8" :size="32" />
      </view>

      <view class="setting-item" @tap="onTapItem('adminList')">
        <view class="setting-icon list-item-icon--blue">
          <mc-icon :path="icons.shield" color="#10AEFF" :size="32" />
        </view>
        <text class="setting-text">管理员管理</text>
        <text class="setting-value">{{ adminCount }} 人</text>
        <mc-icon :path="icons['chevron-right']" color="#B8B8C8" :size="32" />
      </view>

      <view class="setting-item" @tap="onTapItem('logs')">
        <view class="setting-icon list-item-icon--orange">
          <mc-icon :path="icons['file-text']" color="#FF9500" :size="32" />
        </view>
        <text class="setting-text">操作日志</text>
        <text class="setting-value">查看</text>
        <mc-icon :path="icons['chevron-right']" color="#B8B8C8" :size="32" />
      </view>

      <view class="setting-item" @tap="onTapItem('pointsConfig')">
        <view class="setting-icon list-item-icon--green">
          <mc-icon :path="icons.gift" color="#07C160" :size="32" />
        </view>
        <text class="setting-text">积分 / 辣度值配置</text>
        <mc-icon :path="icons['chevron-right']" color="#B8B8C8" :size="32" />
      </view>

      <view class="setting-item" @tap="onTapItem('dailyPicks')">
        <view class="setting-icon list-item-icon--purple">
          <mc-icon :path="icons.calendar" color="#7C5CFC" :size="32" />
        </view>
        <text class="setting-text">每日精选管理</text>
        <mc-icon :path="icons['chevron-right']" color="#B8B8C8" :size="32" />
      </view>

      <view class="setting-item" @tap="onTapItem('appConfig')">
        <view class="setting-icon list-item-icon--blue">
          <mc-icon :path="icons.sliders" color="#10AEFF" :size="32" />
        </view>
        <text class="setting-text">应用配置</text>
        <mc-icon :path="icons['chevron-right']" color="#B8B8C8" :size="32" />
      </view>

      <view class="setting-item" @tap="onTapItem('recycleBin')">
        <view class="setting-icon list-item-icon--orange">
          <mc-icon :path="icons.trash" color="#FF9500" :size="32" />
        </view>
        <text class="setting-text">资源回收站</text>
        <mc-icon :path="icons['chevron-right']" color="#B8B8C8" :size="32" />
      </view>
    </view>

    <!-- 设置组 2：账号安全 -->
    <view class="setting-group">
      <view class="setting-item" @tap="onTapItem('password')">
        <view class="setting-icon list-item-icon--purple">
          <mc-icon :path="icons.lock" color="#7C5CFC" :size="32" />
        </view>
        <text class="setting-text">修改密码</text>
        <mc-icon :path="icons['chevron-right']" color="#B8B8C8" :size="32" />
      </view>

      <view class="setting-item" @tap="onTapItem('phone')">
        <view class="setting-icon list-item-icon--gray">
          <mc-icon :path="icons.phone" color="#8C8CA1" :size="32" />
        </view>
        <text class="setting-text">绑定手机</text>
        <text class="setting-value">{{ phoneMask }}</text>
        <mc-icon :path="icons['chevron-right']" color="#B8B8C8" :size="32" />
      </view>
    </view>

    <!-- 设置组 3：系统信息 -->
    <view class="setting-group">
      <view class="setting-item" @tap="onTapItem('about')">
        <view class="setting-icon list-item-icon--gray">
          <mc-icon :path="icons.info" color="#8C8CA1" :size="32" />
        </view>
        <text class="setting-text">关于系统</text>
        <text class="setting-value">{{ version }}</text>
        <mc-icon :path="icons['chevron-right']" color="#B8B8C8" :size="32" />
      </view>

    </view>

    <!-- 退出登录 -->
    <view class="logout-card" @tap="onLogout">
      <mc-icon :path="icons['log-out']" color="#FA5151" :size="32" />
      <text>退出登录</text>
    </view>
    <mc-tabbar :current="3" />
  </view>
</template>

<script>
import api from '../../utils/api'
import { getAdmin, logout } from '../../utils/cloud'
import { maskPhone, getInitial, toast, confirm } from '../../utils/format'

const APP_VERSION = 'v2.1.0'

// 原始 SVG 路径（统一通过 mc-icon :path + :color 渲染）
const SVG = {
  cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  'chevron-right': '<polyline points="9 18 15 12 9 6"/>',
  gift: '<path d="M20 12v8H4v-8"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
}

export default {
  data() {
    return {
      admin: null,
      initial: 'A',
      adminCount: 0,
      aiStatus: '正常',
      aiStatusOk: true,
      phoneMask: '未绑定',
      version: APP_VERSION,
      icons: SVG,
    }
  },

  onShow() {
    const tabbar = this.$mp && this.$mp.page && this.$mp.page.getTabBar && this.$mp.page.getTabBar()
    if (tabbar) tabbar.selected = 3
    this.refreshAdmin()
    this.loadCounts()
  },

  methods: {
    refreshAdmin() {
      const admin = getAdmin()
      if (!admin) return
      const username = admin.username || 'Admin'
      const phone = admin.phone || ''
      this.admin = admin
      this.initial = getInitial(username)
      this.phoneMask = phone ? maskPhone(phone) : '未绑定'
    },

    async loadCounts() {
      try {
        const [adminsRes, aiRes] = await Promise.allSettled([
          api.getAdmins(),
          api.getAIConfig(),
        ])
        if (adminsRes.status === 'fulfilled') {
          const list = adminsRes.value || []
          this.adminCount = Array.isArray(list) ? list.length : 0
        }
        if (aiRes.status === 'fulfilled') {
          const cfg = aiRes.value || {}
          const ok = cfg.status !== 'error' && cfg.enabled !== false
          this.aiStatus = ok ? '正常' : '异常'
          this.aiStatusOk = ok
        }
      } catch (err) {
        console.error('[settings] 加载状态失败', err)
      }
    },

    onTapItem(key) {
      const routes = {
        aiConfig: '/pages/ai-config/ai-config',
        adminList: '/pages/admin-list/admin-list',
        logs: '/pages/logs/logs',
        pointsConfig: '/pages/points-config/points-config',
        dailyPicks: '/pages/daily-picks/daily-picks',
        appConfig: '/pages/app-config/app-config',
        recycleBin: '/pages/recycle-bin/recycle-bin',
        password: '/pages/profile/profile?type=password',
        phone: '/pages/profile/profile?type=phone',
      }
      if (key === 'about') {
        this.showAbout()
        return
      }
      const url = routes[key]
      if (url) uni.navigateTo({ url })
    },

    showAbout() {
      uni.showModal({
        title: '关于系统',
        content: 'Missonce Admin\n版本：' + APP_VERSION + '\n小程序运营管理后台\n高效管理内容、用户与运营配置。',
        showCancel: false,
        confirmText: '知道了',
      })
    },

    async onLogout() {
      const ok = await confirm('确定退出登录吗？')
      if (!ok) return
      await logout()
      toast('已退出登录', 'success')
      setTimeout(() => {
        uni.reLaunch({ url: '/pages/login/login' })
      }, 500)
    },
  },
}
</script>

<style lang="scss" scoped>
.settings-page {
  padding-bottom: calc(160rpx + env(safe-area-inset-bottom));
}

.profile-card__avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.setting-icon {
  width: 60rpx;
  height: 60rpx;
}

.logout-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  background: var(--bg-card);
  border-radius: var(--r-lg);
  padding: 28rpx;
  margin-top: 40rpx;
  color: var(--danger);
  font-size: 28rpx;
  font-weight: 500;
  box-shadow: var(--shadow-card);
}

.logout-card:active {
  opacity: 0.7;
}
</style>
