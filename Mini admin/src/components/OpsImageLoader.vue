<template>
  <div v-if="previewImageUrl" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80" @click="previewImageUrl = null">
    <div class="max-w-[90vw] max-h-[90vh]">
      <img :src="previewImageUrl" class="max-w-full max-h-full object-contain" @click.stop />
    </div>
  </div>
</template>

<script lang="ts">
export interface ImageUrlSource {
  tempImageUrl?: string;
  resourceCover?: string;
  previewUrl?: string;
  url?: string;
  coverUrl?: string;
  cover?: string;
  originUrl?: string;
  fileUrl?: string;
  title?: string;
  resource?: {
    tempImageUrl?: string;
    previewUrl?: string;
    url?: string;
    coverUrl?: string;
    cover?: string;
    title?: string;
    categories?: string[];
  };
}
</script>

<script setup lang="ts">
import { ref } from 'vue';
import { app } from '../utils/cloudbase';
import { logger } from '../utils/logger';

interface TempFileResult {
  fileID: string;
  url: string;
}

const previewImageUrl = ref<string | null>(null);
const isDev = import.meta.env.DEV;

const getTempImageUrls = async (fileIDs: string[]): Promise<Map<string, string>> => {
  const validIDs = fileIDs.filter(id => id && id.startsWith('cloud://'));

  if (validIDs.length === 0) return new Map();

  const urlMap = new Map<string, string>();
  const BATCH_SIZE = 50;
  const batches: string[][] = [];

  for (let i = 0; i < validIDs.length; i += BATCH_SIZE) {
    batches.push(validIDs.slice(i, i + BATCH_SIZE));
  }

  // 并行处理所有批次，而非串行
  const results = await Promise.all(
    batches.map(async (batch, batchIndex): Promise<(TempFileResult | null)[]> => {
      if (!batch) return [];
      try {
        const tempRes = await app.getTempFileURL({
          fileList: batch.map((fileID) => ({ fileID, maxAge: 3600 })),
        });
        const fileList = (tempRes.fileList || []) as Array<{ fileID: string; tempFileURL?: string }>;
        return fileList.map((file) => {
          if (file.tempFileURL) {
            return { fileID: file.fileID, url: file.tempFileURL };
          }
          return null;
        });
      } catch (error) {
        if (isDev) logger.error(`[图片加载] 第 ${batchIndex + 1} 批获取临时URL失败:`, error);
        return [];
      }
    })
  );

  results.flat().forEach((item) => {
    if (item) urlMap.set(item.fileID, item.url);
  });

  return urlMap;
};

const getImageUrl = (item: ImageUrlSource | null | undefined): string => {
  if (!item) {
    console.warn('[图片加载] item 为空');
    return '';
  }

  const allCandidates: (string | undefined)[] = [
    item.tempImageUrl,
    item.resourceCover,
    item.previewUrl,
    item.url,
    item.coverUrl,
    item.cover,
    item.resource?.tempImageUrl,
    item.resource?.previewUrl,
    item.resource?.url,
    item.resource?.coverUrl,
    item.resource?.cover
  ].filter(Boolean);

  for (const url of allCandidates) {
    if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
      logger.log('[图片加载] 找到直接可用的HTTP URL:', url);
      return url;
    }
  }

  for (const url of allCandidates) {
    if (url && !url.startsWith('cloud://')) {
      logger.log('[图片加载] 找到有效URL:', url);
      return url;
    }
  }

  logger.log('[图片加载] 未找到有效的URL，原始URL:', {
    itemUrl: item.url,
    itemCoverUrl: item.coverUrl,
    resourceUrl: item.resource?.url,
    resourceCoverUrl: item.resource?.coverUrl
  });

  return '';
};

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement | null;
  logger.error('[图片加载] 图片加载失败:', img?.src);

  if (img) {
    img.style.display = 'none';
    const parent = img.parentElement;
    if (parent) {
      const existingPlaceholder = parent.querySelector('.image-placeholder');
      if (existingPlaceholder) return;

      const placeholder = document.createElement('div');
      placeholder.className = 'image-placeholder w-full h-full flex items-center justify-center text-[var(--text-sub)]';
      placeholder.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>';
      parent.appendChild(placeholder);
    }
  }
};

defineExpose({ getImageUrl, handleImageError, getTempImageUrls, previewImageUrl });
</script>
