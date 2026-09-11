<template>
  <view class="section">
    <view class="section-header">
      <text class="section-title">{{ title }}</text>
      <text v-if="more || $slots.more" class="section-more" @tap="onMore">
        <slot name="more">{{ more }}</slot>
      </text>
    </view>
    <slot />
  </view>
</template>

<script>
export default {
  name: 'McSection',
  props: {
    title: { type: String, default: '' },
    more: { type: String, default: '' }
  },
  methods: {
    onMore() {
      this.$emit('more')
    }
  }
}
</script>
