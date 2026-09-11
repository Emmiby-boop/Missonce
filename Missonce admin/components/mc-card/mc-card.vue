<template>
  <view class="card" :class="{ 'card--padded': padded }">
    <slot />
  </view>
</template>

<script>
export default {
  name: 'McCard',
  props: {
    padded: { type: Boolean, default: false }
  }
}
</script>
