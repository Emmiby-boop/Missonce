<template>
  <view class="badge" :class="`badge--${type}`">
    <slot>{{ text }}</slot>
  </view>
</template>

<script>
export default {
  name: 'McBadge',
  props: {
    type: { type: String, default: 'gray' }, // green | orange | red | blue | gray | purple
    text: { type: String, default: '' }
  }
}
</script>
