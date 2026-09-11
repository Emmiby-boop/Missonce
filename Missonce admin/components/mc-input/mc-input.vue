<template>
  <view class="mc-input">
    <view v-if="label" class="mc-input__label">{{ label }}</view>
    <view class="mc-input__wrapper" :class="{ 'mc-input__wrapper--code': code }">
      <input
        class="mc-input__field"
        :type="type"
        :password="password"
        :placeholder="placeholder"
        placeholder-class="mc-input__placeholder"
        :value="innerVal"
        :maxlength="maxlength"
        :confirm-type="confirmType"
        :auto-capitalize="autoCapitalize"
        :auto-correct="autoCorrect"
        :spellcheck="spellcheck"
        @input="onInput"
        @confirm="onConfirm"
      />
      <view v-if="$slots.suffix" class="mc-input__suffix">
        <slot name="suffix" />
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'McInput',
  props: {
    label: { type: String, default: '' },
    value: { type: [String, Number], default: '' },
    modelValue: { type: [String, Number], default: '' },
    type: { type: String, default: 'text' },
    password: { type: Boolean, default: false },
    placeholder: { type: String, default: '' },
    maxlength: { type: Number, default: 140 },
    confirmType: { type: String, default: 'done' },
    code: { type: Boolean, default: false },
    // iOS 自动大写 / 自动纠错 / 拼写检查控制（默认全部关闭，避免用户名/密码被自动改写）
    autoCapitalize: { type: String, default: 'off' },
    autoCorrect: { type: Boolean, default: false },
    spellcheck: { type: Boolean, default: false }
  },
  computed: {
    innerVal() {
      return this.modelValue !== '' && this.modelValue !== undefined ? this.modelValue : this.value
    }
  },
  methods: {
    onInput(e) {
      const v = e.detail.value
      this.$emit('input', v)
      this.$emit('update:modelValue', v)
    },
    onConfirm(e) {
      this.$emit('confirm', e.detail.value)
    }
  }
}
</script>

<style lang="scss" scoped>
.mc-input { margin-bottom: 36rpx; }
.mc-input__label {
  font-size: 26rpx;
  color: var(--text-secondary);
  margin-bottom: 16rpx;
  font-weight: 500;
}
.mc-input__wrapper {
  display: flex;
  align-items: center;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: 16rpx;
  padding: 0 28rpx;
  height: 96rpx;
  transition: border-color 0.2s;
}
.mc-input__wrapper:focus-within { border-color: var(--pri); }
.mc-input__wrapper--code { padding-right: 12rpx; }
.mc-input__field {
  flex: 1;
  height: 96rpx;
  font-size: 30rpx;
  color: var(--text-primary);
}
.mc-input__placeholder { color: var(--text-tertiary); font-size: 28rpx; }
.mc-input__suffix { padding: 16rpx; display: flex; align-items: center; }
@media (prefers-color-scheme: dark) {
  .mc-input__wrapper { background: #1A1D28; border-color: #2A2E3A; }
  .mc-input__field { color: #E8E8ED; }
}
</style>
