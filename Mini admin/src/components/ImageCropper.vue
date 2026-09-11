<template>
  <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
    <div class="bg-[var(--bg-card)] rounded-2xl shadow-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden border border-[var(--border-color)]">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-card)] shrink-0">
        <h3 class="text-lg font-bold text-[var(--text-main)]">裁剪图片</h3>
        <button class="p-1.5 rounded-lg text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-[var(--bg-body)] transition-colors" @click="$emit('close')">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Cropper Area -->
      <div class="flex-1 bg-black relative overflow-hidden flex items-center justify-center">
        <img ref="imageRef" :src="imageUrl" class="max-w-full max-h-full block" />
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-card)] flex justify-end gap-3 shrink-0">
        <button class="btn" @click="$emit('close')">取消</button>
        <button class="btn-soft" @click="confirmCrop" :disabled="processing">
          <span v-if="processing" class="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></span>
          确认裁剪
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useMessage } from 'naive-ui';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';

const message = useMessage();

const props = defineProps<{
  imageUrl: string,
  aspectRatio?: number
}>();

const emit = defineEmits(['close', 'confirm']);

const imageRef = ref<HTMLImageElement | null>(null);
const cropper = ref<Cropper | null>(null);
const processing = ref(false);

onMounted(() => {
  initCropper();
});

onUnmounted(() => {
  if (cropper.value) {
    cropper.value.destroy();
  }
});

const initCropper = () => {
  if (imageRef.value) {
    cropper.value = new Cropper(imageRef.value, {
      aspectRatio: props.aspectRatio || NaN,
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 1,
      responsive: true,
      restore: false,
      guides: true,
      center: true,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
    } as Cropper.Options);
  }
};

const confirmCrop = () => {
  if (!cropper.value) return;
  processing.value = true;
  
  const canvas = cropper.value.getCroppedCanvas({
    // Optional: limit max size if needed
    // maxWidth: 2048,
    // maxHeight: 2048,
  });

  canvas.toBlob((blob: Blob | null) => {
    processing.value = false;
    if (blob) {
      emit('confirm', blob);
    } else {
      message.error('裁剪失败');
    }
  }, 'image/jpeg', 0.9);
};
</script>

<style>
/* Override cropper css for dark mode if needed, usually generic css is fine */
.cropper-bg {
  background-repeat: repeat;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s;
  background-color: var(--bg-body);
  color: var(--text-main);
  border: 1px solid var(--border-color);
  cursor: pointer;
}

.btn:hover:not(:disabled) {
  background-color: var(--bg-card);
  border-color: var(--primary);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
