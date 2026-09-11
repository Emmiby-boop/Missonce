<template>
  <div class="bg-[var(--bg-body)] rounded-xl p-3 space-y-3 border border-[var(--border-color)]">
    <div class="flex justify-between items-center">
      <span class="text-sm font-semibold text-[var(--text-main)] flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[var(--primary)]" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd" /></svg>
        已选资源 ({{ manualIds.length }})
      </span>
      <button class="btn-primary text-xs px-2.5 py-1.5" @click="emit('add')">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>
        添加
      </button>
    </div>

    <div class="space-y-2 max-h-60 overflow-y-auto pr-1">
      <div v-for="(id, idx) in manualIds" :key="idx" class="flex items-center gap-2 bg-[var(--bg-card)] p-2 rounded-lg border border-[var(--border-color)]">
        <div class="w-10 h-10 bg-[var(--bg-body)] flex-shrink-0 rounded-lg overflow-hidden">
          <img v-if="resourceMap[id]" :src="resourceMap[id]" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full flex items-center justify-center text-[10px] text-[var(--text-sub)]">...</div>
        </div>
        <div class="flex-1 min-w-0 text-xs truncate text-[var(--text-sub)]">{{ id }}</div>
        <button class="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors" title="替换" @click="emit('replace', idx)">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
        </button>
        <button class="w-7 h-7 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10 transition-colors" title="移除" @click="removeItem(idx)">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
        </button>
      </div>
    </div>
    <div class="text-xs text-[var(--text-sub)] text-center py-2" v-if="manualIds.length === 0">暂无资源，点击上方按钮添加</div>
  </div>
</template>

<script setup lang="ts">
import type { ResourceMap } from "../types";

defineProps<{
  resourceMap: ResourceMap;
}>();

const manualIds = defineModel<string[]>({ default: () => [] });

const emit = defineEmits<{
  (e: 'add'): void;
  (e: 'replace', index: number): void;
}>();

const removeItem = (idx: number) => {
  const newArr = [...manualIds.value];
  newArr.splice(idx, 1);
  manualIds.value = newArr;
};
</script>
