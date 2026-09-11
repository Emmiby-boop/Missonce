<template>
  <div class="flex-1 bg-[var(--border-color)]/30 flex justify-center items-center p-8 overflow-hidden relative">
    <div class="absolute top-4 left-4 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-md shadow-sm" :style="{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.25)' }">实时预览模式</div>

    <div class="scale-[0.65] xl:scale-[0.8] origin-center transition-transform">
      <div class="mockup-phone border-[var(--primary)]" style="border-radius: 40px; overflow: hidden;">
        <div class="camera" style="width: 100px; height: 30px; border-radius: 20px; background: black; top: 12px;"></div>
        <div class="display" style="border-radius: 35px; overflow: hidden;">
          <div
            class="artboard overflow-y-auto relative no-scrollbar bg-[var(--bg-card)]"
            :style="{
              backgroundColor: backgroundColor,
              width: '393px',
              height: '852px'
            }"
          >
          <!-- Simulated WeChat Nav Bar -->
          <div class="sticky top-0 z-[100] h-[88px] w-full pointer-events-none transition-all duration-300"
               :style="{ background: 'transparent' }">
            <!-- Status Bar (44px) -->
            <div class="h-[44px] w-full"></div>
            <!-- Nav Bar (44px) -->
            <div class="h-[44px] w-full flex items-center px-4">
                <div class="w-8 h-8 flex items-center justify-center text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </div>
            </div>
            <!-- Simulated Capsule -->
            <div class="absolute right-4 top-[50px] w-[87px] h-[32px] bg-white/20 border border-white/20 rounded-full flex items-center justify-between px-3 backdrop-blur-md">
                <div class="w-1 h-1 bg-white rounded-full"></div>
                <div class="w-1 h-1 bg-white rounded-full"></div>
                <div class="w-1 h-1 bg-white rounded-full"></div>
            </div>
          </div>

          <!-- Draggable Area -->
          <draggable
            v-model="modulesModel"
            item-key="id"
            class="w-full min-h-[500px]"
            ghost-class="opacity-50"
            :animation="200"
          >
            <template #item="{ element }">
              <div
                class="relative group border-2 border-transparent hover:border-blue-300 transition-all cursor-move"
                :class="{ '!border-blue-500': selectedModule?.id === element.id }"
                :style="{
                    marginBottom: element.marginBottom + 'px',
                    marginTop: element.type === 'resource-grid' ? '-33%' : '0',
                    padding: element.type === 'resource-grid' ? padding + 'px' : '0',
                    position: 'relative',
                    zIndex: element.type === 'resource-grid' ? 10 : 0
                }"
                @click.stop="emit('select-module', element)"
              >

                <!-- Header Preview -->
                <div v-if="element.type === 'header'" class="w-full relative overflow-hidden bg-gray-900"
                     :style="{ height: element.config.height + 'rpx', marginTop: '-88px' }">
                  <!-- Blurred Background -->
                  <img v-if="topicConfig.cover" :src="topicConfig.cover" class="w-full h-full object-cover absolute inset-0 blur-xl opacity-80 scale-110" />
                  <div v-else class="w-full h-full flex items-center justify-center text-gray-400 absolute inset-0"></div>

                  <!-- Overlay Gradient -->
                  <div class="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60"></div>

                  <!-- Content -->
                  <div class="relative z-10 h-full flex flex-col justify-end p-6 pb-20 text-white text-shadow">
                     <div class="flex gap-4 items-end">
                        <div class="w-24 h-24 rounded-lg overflow-hidden shadow-2xl border-2 border-white/20 shrink-0">
                            <img v-if="topicConfig.cover" :src="topicConfig.cover" class="w-full h-full object-cover" />
                            <div v-else class="w-full h-full bg-white/10 flex items-center justify-center text-xs">封面</div>
                        </div>
                        <div class="flex-1 min-w-0 mb-1">
                            <div v-if="element.config.showTitle" class="font-bold text-xl leading-tight truncate">{{ topicConfig.title || '专题标题' }}</div>
                            <div v-if="element.config.showDescription" class="text-xs opacity-80 mt-1 line-clamp-2">{{ topicConfig.description || '专题描述...' }}</div>
                        </div>
                     </div>
                  </div>
                </div>

                <!-- Resource Grid Preview -->
                <div v-else-if="element.type === 'resource-grid'" class="w-full">
                   <div v-if="element.config.sourceType === 'manual' && (!element.config.manualIds || element.config.manualIds.length === 0)" class="p-4 text-center bg-gray-100 rounded text-xs text-gray-400 border border-dashed">
                     请点击右侧配置选择资源
                   </div>
                   <div
                     class="grid"
                     :style="{
                       gridTemplateColumns: `repeat(${element.config.columns}, 1fr)`,
                       gap: element.config.gap + 'px'
                     }"
                   >
                     <div
                       v-for="i in Math.min(element.config.count, element.config.sourceType === 'manual' ? (element.config.manualIds?.length || 0) : 8)"
                       :key="i"
                       class="bg-gray-200 relative overflow-hidden group"
                       :style="{
                         borderRadius: element.config.radius + 'px',
                         aspectRatio: getAspectRatio(topicConfig.resourceType)
                       }"
                     >
                       <img v-if="element.config.sourceType === 'manual' && element.config.manualIds && resourceMap[element.config.manualIds[i-1]]" :src="resourceMap[element.config.manualIds[i-1]]" class="w-full h-full object-cover" />
                       <div v-else class="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">
                         {{ element.config.sourceType === 'manual' ? '选' : '资源' }}{{i}}
                       </div>
                       <!-- Hover Actions -->
                      <div v-if="element.config.sourceType === 'manual'" class="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center gap-1">
                         <button class="w-7 h-7 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors" @click.stop="emit('open-picker', { type: 'grid-replace', index: i - 1 })">
                           <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                         </button>
                         <button class="w-7 h-7 rounded-full flex items-center justify-center text-red-400 hover:bg-white/20 transition-colors" @click.stop="emit('clear-grid-item', i - 1)">
                           <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                         </button>
                      </div>
                     </div>
                   </div>
                   <div v-if="element.config.sourceType !== 'manual' && element.config.count > 8" class="text-center text-xs text-gray-400 mt-2">...共 {{ element.config.count }} 项</div>
                </div>

              </div>
            </template>
          </draggable>

          <div v-if="modulesModel.length === 0" class="absolute inset-0 flex items-center justify-center text-gray-400 pointer-events-none">
            <div class="text-center">
              <p>拖拽或点击左侧按钮添加组件</p>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import draggable from "vuedraggable";
import type { LayoutModule, TopicConfig, ResourceMap, ResourceType } from "../types";

defineProps<{
  backgroundColor: string;
  padding: number;
  selectedModule: LayoutModule | null;
  topicConfig: TopicConfig;
  resourceMap: ResourceMap;
}>();

const modulesModel = defineModel<LayoutModule[]>({ required: true });

const emit = defineEmits<{
  (e: 'select-module', module: LayoutModule): void;
  (e: 'open-picker', payload: { type: string; index?: number }): void;
  (e: 'clear-grid-item', index: number): void;
}>();

const getAspectRatio = (type: ResourceType) => {
  if (type === 'avatar') return '1 / 1';
  if (type === 'wallpaper') return '9 / 16';
  return '3 / 4'; // Default/Mixed
};
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
