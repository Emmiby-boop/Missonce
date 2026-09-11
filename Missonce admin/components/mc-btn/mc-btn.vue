<template>
  <button
    class="btn"
    :class="classes"
    :disabled="disabled || loading"
    :open-type="openType"
    @tap="onClick"
    @getuserinfo="onGetUserInfo"
  >
    <view v-if="loading" class="mc-btn__spinner" />
    <slot />
  </button>
</template>

<script>
export default {
  name: 'McBtn',
  props: {
    type: { type: String, default: 'primary' }, // primary | ghost | default | danger
    size: { type: String, default: '' },          // sm
    block: { type: Boolean, default: false },
    pill: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    openType: { type: String, default: '' }
  },
  computed: {
    classes() {
      return [
        `btn--${this.type}`,
        this.size ? `btn--${this.size}` : '',
        this.block ? 'btn--block' : '',
        this.pill ? 'btn--pill' : '',
        this.loading ? 'btn--loading' : ''
      ]
    }
  },
  methods: {
    onClick(e) {
      if (this.disabled || this.loading) return
      this.$emit('click', e)
    },
    onGetUserInfo(e) {
      this.$emit('getuserinfo', e)
    }
  }
}
</script>

<style lang="scss" scoped>
.mc-btn__spinner {
  width: 30rpx;
  height: 30rpx;
  margin-right: 12rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.5);
  border-top-color: #fff;
  border-radius: 50%;
  animation: mc-spin 0.7s linear infinite;
}
.btn--default .mc-btn__spinner,
.btn--ghost .mc-btn__spinner {
  border-color: rgba(0, 0, 0, 0.15);
  border-top-color: var(--text-secondary);
}
@keyframes mc-spin {
  to { transform: rotate(360deg); }
}
</style>
