<template>
  <view class="mc-seg">
    <view
      v-for="opt in options"
      :key="opt.value"
      class="mc-seg__item"
      :class="{ on: opt.value === current }"
      @tap="onSelect(opt)"
    >{{ opt.label }}</view>
  </view>
</template>

<script>
export default {
  name: 'McSeg',
  props: {
    options: { type: Array, default: () => [] }, // [{ label, value }]
    modelValue: { type: [String, Number], default: '' },
    value: { type: [String, Number], default: '' }
  },
  computed: {
    current() {
      return this.modelValue !== '' && this.modelValue !== undefined ? this.modelValue : this.value
    }
  },
  methods: {
    onSelect(opt) {
      if (opt.value === this.current) return
      this.$emit('update:modelValue', opt.value)
      this.$emit('input', opt.value)
      this.$emit('change', opt.value)
    }
  }
}
</script>

<style lang="scss" scoped>
.mc-seg {
  display: flex;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: 14rpx;
  padding: 6rpx;
}
.mc-seg__item {
  flex: 1;
  text-align: center;
  padding: 18rpx 0;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-secondary);
  border-radius: 10rpx;
  transition: all 0.2s;
}
.mc-seg__item.on {
  background: var(--pri);
  color: #fff;
  box-shadow: 0 4rpx 12rpx rgba(7, 193, 96, 0.25);
}
@media (prefers-color-scheme: dark) {
  .mc-seg {
    background: #1A1D28;
    border-color: #2A2E3A;
  }
}
</style>
