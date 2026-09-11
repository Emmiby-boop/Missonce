<template>
  <div class="page-header">
    <div class="page-header-left">
      <AnimatedContent :delay="0">
        <h1 class="page-header-title">{{ title }}</h1>
      </AnimatedContent>
      <AnimatedContent :delay="0.08">
        <p v-if="subtitle" class="page-header-subtitle">{{ subtitle }}</p>
      </AnimatedContent>
    </div>
    <div v-if="$slots.actions" class="page-header-actions">
      <AnimatedContent :delay="0.12">
        <slot name="actions" />
      </AnimatedContent>
    </div>
  </div>
</template>

<script setup lang="ts">
import AnimatedContent from '../components/animations/AnimatedContent.vue'

defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 28px;
  flex-wrap: wrap;
}

.page-header-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 600;
  color: var(--text-main);
  line-height: 1.15;
  letter-spacing: -0.025em;
}

.page-header-subtitle {
  margin: 6px 0 0;
  font-size: 14px;
  color: var(--text-sub);
  line-height: 1.5;
}

.page-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .page-header-title {
    font-size: 24px;
  }
  .page-header {
    margin-bottom: 20px;
  }
}
</style>
