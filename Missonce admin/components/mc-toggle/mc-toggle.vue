<template>
  <view class="toggle" :class="{ 'toggle--on': current }" @tap="onToggle">
    <view class="toggle__knob" />
  </view>
</template>

<script>
export default {
  name: 'McToggle',
  props: {
    modelValue: { type: Boolean, default: false },
    value: { type: Boolean, default: false }
  },
  computed: {
    current() {
      return this.modelValue !== undefined ? this.modelValue : this.value
    }
  },
  methods: {
    onToggle() {
      const next = !this.current
      this.$emit('update:modelValue', next)
      this.$emit('input', next)
      this.$emit('change', next)
    }
  }
}
</script>
