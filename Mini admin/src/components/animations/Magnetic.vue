<template>
  <div
    ref="el"
    class="magnetic"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { animate } from 'motion-v'

defineOptions({ name: 'MagneticButton' })

const props = withDefaults(defineProps<{
  strength?: number
}>(), {
  strength: 0.3
})

const el = ref<HTMLElement | null>(null)

function handleMouseMove(e: MouseEvent) {
  if (!el.value) return
  const rect = el.value.getBoundingClientRect()
  const x = e.clientX - rect.left - rect.width / 2
  const y = e.clientY - rect.top - rect.height / 2
  animate(el.value, {
    x: x * props.strength,
    y: y * props.strength,
  }, { duration: 0.2 })
}

function handleMouseLeave() {
  if (!el.value) return
  animate(el.value, {
    x: 0,
    y: 0,
  }, { duration: 0.4, ease: 'elastic' })
}
</script>

<style scoped>
.magnetic {
  display: inline-block;
  will-change: transform;
}
</style>
