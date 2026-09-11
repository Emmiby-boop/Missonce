<template>
  <span ref="el" class="counter">{{ displayValue }}</span>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { animate, useInView } from 'motion-v'

defineOptions({ name: 'AnimatedCounter' })

interface Props {
  value: number
  duration?: number
  format?: boolean
  prefix?: string
  suffix?: string
}

const props = withDefaults(defineProps<Props>(), {
  duration: 1.5,
  format: true,
  prefix: '',
  suffix: ''
})

const el = ref<HTMLElement | null>(null)
const current = ref(0)

const displayValue = computed(() => {
  const num = Math.round(current.value)
  const formatted = props.format ? num.toLocaleString() : String(num)
  return `${props.prefix}${formatted}${props.suffix}`
})

onMounted(() => {
  if (!el.value) return

  const inView = useInView(el, { once: true })

  watch(inView, (isInView) => {
    if (isInView) {
      const controls = animate(0, props.value, {
        duration: props.duration,
        ease: [0.25, 0.1, 0.25, 1],
        onUpdate: (v) => {
          current.value = v
        }
      })
      return () => controls.stop()
    }
  }, { immediate: true })
})
</script>
