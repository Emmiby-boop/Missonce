<template>
  <view class="list-item" @tap="$emit('click')">
    <view v-if="$slots.icon" class="list-item-icon" :class="`list-item-icon--${iconColor}`">
      <slot name="icon" />
    </view>
    <view class="list-item-text">
      <view class="list-item-title">
        <slot name="title">{{ title }}</slot>
      </view>
      <view v-if="desc || $slots.desc" class="list-item-desc">
        <slot name="desc">{{ desc }}</slot>
      </view>
    </view>
    <view class="list-item-right">
      <slot name="right" />
    </view>
    <text v-if="arrow" class="list-item-arrow">›</text>
  </view>
</template>

<script>
export default {
  name: 'McListItem',
  props: {
    title: { type: String, default: '' },
    desc: { type: String, default: '' },
    iconColor: { type: String, default: 'green' },
    arrow: { type: Boolean, default: false }
  }
}
</script>
