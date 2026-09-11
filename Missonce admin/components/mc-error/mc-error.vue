<template>
  <view class="error-state">
    <view v-if="iconBg" class="error-state__icon" :style="{ backgroundImage: iconBg }" />
    <text class="error-state__text">{{ text }}</text>
    <view v-if="$slots.default" class="error-state__action">
      <slot />
    </view>
  </view>
</template>

<script>
import { makeIcon } from '../../utils/icons'

export default {
  name: 'McError',
  props: {
    text: { type: String, default: '加载失败' },
    icon: { type: String, default: '' }
  },
  data() {
    return {
      defaultIcon: makeIcon(
        '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
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
.error-state__icon {
  width: 160rpx;
  height: 160rpx;
  margin-bottom: 24rpx;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
}
</style>
