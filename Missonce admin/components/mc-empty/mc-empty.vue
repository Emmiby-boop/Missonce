<template>
  <view class="empty-state">
    <view v-if="iconBg" class="empty-state__icon" :style="{ backgroundImage: iconBg }" />
    <text class="empty-state__text">{{ text }}</text>
    <view v-if="$slots.default" class="empty-state__action">
      <slot />
    </view>
  </view>
</template>

<script>
import { makeIcon } from '../../utils/icons'

export default {
  name: 'McEmpty',
  props: {
    text: { type: String, default: '暂无数据' },
    icon: { type: String, default: '' }
  },
  data() {
    return {
      defaultIcon: makeIcon(
        '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
        '#B8B8C8'
      )
    }
  },
  computed: {
    iconSrc() {
      return this.icon || this.defaultIcon
    },
    // 微信小程序 <image> 不支持 SVG data URI，改用 background-image（WXSS 支持）
    iconBg() {
      return this.iconSrc ? `url('${this.iconSrc}')` : ''
    }
  }
}
</script>

<style lang="scss" scoped>
.empty-state__icon {
  width: 160rpx;
  height: 160rpx;
  margin-bottom: 24rpx;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
}
</style>
