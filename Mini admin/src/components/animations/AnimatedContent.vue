<template>
  <Motion
    tag="div"
    :initial="{ opacity: 0, y: 20 }"
    :in-view="{ opacity: 1, y: 0 }"
    :in-view-options="{ once: true, margin: '0px 0px -50px 0px' }"
    :transition="{ duration: 0.5, delay: delay, ease: [0.25, 0.1, 0.25, 1] }"
  >
    <slot />
  </Motion>
</template>

<script setup lang="ts">
import { Motion } from 'motion-v'

withDefaults(defineProps<{
  delay?: number
}>(), {
  delay: 0
})
</script>
