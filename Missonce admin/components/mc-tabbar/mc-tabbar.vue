<template>
  <view class="mc-tabbar">
    <view
      v-for="(item, index) in list"
      :key="index"
      class="mc-tabbar__item"
      :class="{ 'is-active': index === current }"
      @tap="onTap(index)"
    >
      <view
        class="mc-tabbar__icon"
        :style="{ backgroundImage: iconBg(index) }"
      />
      <text
        class="mc-tabbar__text"
        :style="{ color: index === current ? '#07C160' : '#8C8CA1' }"
      >{{ item.text }}</text>
    </view>
  </view>
</template>

<script>
import { makeIcon } from '@/utils/icons'

const TAB_ICONS = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  'bar-chart': '<path d="M18 20V10M12 20V4M6 20v-6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
}

export default {
  name: 'McTabbar',
  props: {
    current: { type: Number, default: 0 }
  },
  data() {
    return {
      list: [
        { text: '概览', page: '/pages/dashboard/dashboard', icon: TAB_ICONS.home },
        { text: '内容', page: '/pages/content/content', icon: TAB_ICONS.grid },
        { text: '运营', page: '/pages/ops/ops', icon: TAB_ICONS['bar-chart'] },
        { text: '设置', page: '/pages/settings/settings', icon: TAB_ICONS.settings }
      ]
    }
  },
  methods: {
    iconBg(index) {
      const color = index === this.current ? '#07C160' : '#8C8CA1'
      return `url('${makeIcon(this.list[index].icon, color)}')`
    },
    onTap(index) {
      if (index === this.current) return
      uni.reLaunch({ url: this.list[index].page })
    }
  }
}
</script>

<style lang="scss" scoped>
.mc-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-around;
  height: 100rpx;
  background: #FFFFFF;
  border-top: 1rpx solid #EBEBF0;
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 999;
}

.mc-tabbar__item {
  flex: 1;
  height: 100rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
}

.mc-tabbar__icon {
  width: 44rpx;
  height: 44rpx;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
}

.mc-tabbar__text {
  font-size: 20rpx;
  font-weight: 500;
  line-height: 1;
}

@media (prefers-color-scheme: dark) {
  .mc-tabbar {
    background: #1A1D28;
    border-top-color: #2A2E3A;
  }
}
</style>
