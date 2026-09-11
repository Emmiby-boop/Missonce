<template>
  <view class="skeleton" :style="style">
    <slot />
  </view>
</template>

<script>
export default {
  name: 'McSkeleton',
  props: {
    height: { type: [String, Number], default: '40rpx' },
    width: { type: [String, Number], default: '100%' },
    radius: { type: [String, Number], default: '12rpx' }
  },
  computed: {
    style() {
      return `height:${this.height};width:${this.width};border-radius:${this.radius};`
    }
  }
}
</script>
