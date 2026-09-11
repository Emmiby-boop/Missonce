<template>
  <view
    class="mc-icon"
    :style="{ backgroundImage: bg, width: sizePx, height: sizePx }"
  />
</template>

<script>
import { icons, makeIcon } from '../../utils/icons'

export default {
  name: 'McIcon',
  props: {
    name: { type: String, default: '' },          // 预定义图标名（icons map）
    path: { type: String, default: '' },          // 原始 svg 路径内容 / 已生成的 data URI
    color: { type: String, default: '#1A1A2E' },
    size: { type: [Number, String], default: 32 } // rpx
  },
  computed: {
    sizePx() {
      return this.size + 'rpx'
    },
    // 微信小程序 <image> 不支持 SVG data URI，改用 background-image（WXSS 支持）
    bg() {
      const raw = this.path || (this.name && icons[this.name]) || ''
      if (!raw) return ''
      return `url('${makeIcon(raw, this.color)}')`
    }
  }
}
</script>

<style lang="scss" scoped>
.mc-icon {
  display: block;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
}
</style>
