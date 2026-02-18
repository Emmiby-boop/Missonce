<template>
  <header class="border-b border-[var(--border-color)] bg-[var(--bg-card)] transition-colors duration-300">
    <nav class="container mx-auto px-4 py-4">
      <RouterLink to="/" class="text-xl font-semibold text-[var(--text-main)] hover:text-[var(--primary)] transition-colors">
        CloudBase + Vue
      </RouterLink>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>
