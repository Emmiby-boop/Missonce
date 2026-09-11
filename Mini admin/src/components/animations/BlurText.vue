<template>
  <Motion
    tag="div"
    :initial="{ opacity: 0, filter: 'blur(10px)' }"
    :in-view="{ opacity: 1, filter: 'blur(0px)' }"
    :in-view-options="{ once: true }"
    :transition="{ duration: 0.6, delay: delay, ease: 'easeOut' }"
    :class="className"
  >
    <slot />
  </Motion>
</template>

<script setup lang="ts">
import { Motion } from 'motion-v'

withDefaults(defineProps<{
  delay?: number
  className?: string
}>(), {
  delay: 0,
  className: ''
})
</script>
