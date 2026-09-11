<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 class="text-xl font-bold text-[var(--text-main)]">AI 智能配置</h2>
        <p class="text-sm text-[var(--text-sub)] mt-1">管理 AI 模型参数、API Key 及自动分类标签体系</p>
      </div>
      <div class="flex gap-2 overflow-x-auto pb-2">
        <button
          v-for="tab in tabList"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-2"
          :class="activeTab === tab.id ? 'bg-[var(--primary)] text-white shadow-sm' : 'bg-[var(--bg-card)] text-[var(--text-sub)] hover:text-[var(--text-main)] border border-[var(--border-color)]'"
        >
          <span
            v-if="tabStatusMap[tab.id] !== undefined"
            class="w-2 h-2 rounded-full shrink-0"
            :class="tabStatusMap[tab.id] ? 'bg-green-400' : 'bg-gray-400'"
          ></span>
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- 当前 tab 状态指示器 -->
    <div v-if="currentTabStatus" class="card px-4 py-2.5 flex items-center gap-3">
      <span
        class="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
        :class="currentTabStatus.configured
          ? 'bg-green-500/10 text-green-500'
          : 'bg-gray-500/10 text-[var(--text-sub)]'"
      >
        <span class="w-1.5 h-1.5 rounded-full" :class="currentTabStatus.configured ? 'bg-green-500' : 'bg-gray-400'"></span>
        {{ currentTabStatus.configured ? '已配置' : '未配置' }}
      </span>
      <span class="text-sm text-[var(--text-main)] font-mono truncate">{{ currentTabStatus.detail }}</span>
      <span v-if="currentTabStatus.hint" class="text-xs text-yellow-500 flex items-center gap-1 shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
        {{ currentTabStatus.hint }}
      </span>
      <div class="flex-1"></div>
      <button
        @click="fetchStatusData"
        class="btn-soft text-xs px-3 py-1 flex items-center gap-1 shrink-0"
        :disabled="statusLoading"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{ 'animate-spin': statusLoading }"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
        刷新
      </button>
    </div>

    <!-- 模型配置 / Key 管理 → AIKeyManager 子组件 -->
    <AIKeyManager
      v-if="activeTab === 'model' || activeTab === 'keys'"
      :activeTab="activeTab"
      @notify="onChildNotify"
    />

    <!-- 标签白名单 Tab（父组件直接管理） -->
    <section v-if="activeTab === 'whitelist'" class="space-y-6">
      <div v-if="loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
      </div>

      <template v-else>
        <div class="card p-6 space-y-4">
          <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h3 class="text-lg font-bold text-[var(--text-main)]">主分类白名单</h3>
              <p class="text-xs text-[var(--text-sub)] mt-1">AI 识别结果必须包含在此列表中</p>
            </div>
            <button @click="saveCategories" :disabled="saving" class="btn-soft text-sm px-4 py-1.5 shrink-0">
              {{ saving ? '保存中...' : '保存分类' }}
            </button>
          </div>
          <textarea
            v-model="categoriesStr"
            class="input w-full h-32 font-mono text-sm"
            placeholder="分类1, 分类2, 分类3..."
          ></textarea>
          <div class="flex flex-wrap gap-2 mt-2">
            <span v-for="cat in previewCategories" :key="cat" class="px-2 py-1 bg-blue-500/10 text-blue-500 text-xs rounded-md">
              {{ cat }}
            </span>
            <span class="text-xs text-[var(--text-sub)] flex items-center">共 {{ previewCategories.length }} 个</span>
          </div>
        </div>

        <div class="card p-6 space-y-4">
          <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h3 class="text-lg font-bold text-[var(--text-main)]">标签白名单</h3>
              <p class="text-xs text-[var(--text-sub)] mt-1">用于规范 AI 输出的标签</p>
            </div>
            <button @click="saveTags" :disabled="saving" class="btn-soft text-sm px-4 py-1.5 shrink-0">
              {{ saving ? '保存中...' : '保存标签' }}
            </button>
          </div>
          <textarea
            v-model="tagsStr"
            class="input w-full h-64 font-mono text-sm"
            placeholder="标签1, 标签2, 标签3..."
          ></textarea>
          <div class="flex flex-wrap gap-2 mt-2 max-h-40 overflow-y-auto">
            <span v-for="tag in previewTags" :key="tag" class="px-2 py-1 bg-[var(--bg-body)] text-[var(--text-main)] text-xs rounded-md border border-[var(--border-color)]">
              {{ tag }}
            </span>
            <span class="text-xs text-[var(--text-sub)] flex items-center">共 {{ previewTags.length }} 个</span>
          </div>
        </div>

        <p v-if="message" :class="messageType === 'success' ? 'text-green-500' : 'text-red-500'" class="text-sm">
          {{ message }}
        </p>
      </template>
    </section>

    <!-- 自定义厂商 Tab → CustomProviderManager 子组件 -->
    <CustomProviderManager
      v-if="activeTab === 'providers'"
      @notify="onChildNotify"
    />

    <!-- 文案配置 / 海报语录 → AIQuotesConfig 子组件 -->
    <AIQuotesConfig
      v-if="activeTab === 'writer' || activeTab === 'poster'"
      :activeTab="activeTab"
      @notify="onChildNotify"
    />

    <!-- 灵感文案 Tab（小程序灵感文案，quotes 集合） -->
    <section v-if="activeTab === 'quotes'">
      <QuotesPage />
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { db } from '../utils/cloudbase';
import QuotesPage from './QuotesPage.vue';
import AIKeyManager from '../components/AIKeyManager.vue';
import AIQuotesConfig from '../components/AIQuotesConfig.vue';
import CustomProviderManager from '../components/CustomProviderManager.vue';

// ======== Types ========
type TabId = 'model' | 'keys' | 'providers' | 'whitelist' | 'writer' | 'quotes' | 'poster';
type MessageType = 'success' | 'error';

interface WhitelistDoc {
  categories?: string[];
  tags?: string[];
}

interface ConfigStatusItem {
  label: string;
  detail: string;
  configured: boolean;
  hint?: string;
  tab: TabId;
}

// ======== State ========
const activeTab = ref<TabId>('model');
const loading = ref(true);
const saving = ref(false);
const message = ref('');
const messageType = ref<MessageType>('success');

const categoriesStr = ref('');
const tagsStr = ref('');

// ======== Computed ========
const previewCategories = computed(() => {
  return categoriesStr.value.split(/[,，\n]/).map(s => s.trim()).filter(s => s);
});

const previewTags = computed(() => {
  return tagsStr.value.split(/[,，\n]/).map(s => s.trim()).filter(s => s);
});

// ======== Status Overview ========
const statusLoading = ref(false);
const statusItems = ref<ConfigStatusItem[]>([]);

// Tab 定义（不含 status tab）
const tabList: { id: TabId; label: string }[] = [
  { id: 'model', label: '模型配置' },
  { id: 'keys', label: 'Key 管理' },
  { id: 'providers', label: '自定义厂商' },
  { id: 'whitelist', label: '标签白名单' },
  { id: 'writer', label: '文案配置' },
  { id: 'quotes', label: '灵感文案' },
  { id: 'poster', label: '海报语录' },
];

// 各 tab 的配置状态映射（true=已配置, false=未配置, undefined=无状态数据）
const tabStatusMap = computed<Record<string, boolean | undefined>>(() => {
  const map: Record<string, boolean | undefined> = {};
  for (const item of statusItems.value) {
    map[item.tab] = item.configured;
  }
  return map;
});

// 当前 tab 对应的状态项
const currentTabStatus = computed(() => {
  return statusItems.value.find(item => item.tab === activeTab.value) || null;
});

const fetchStatusData = async (): Promise<void> => {
  statusLoading.value = true;
  try {
    const [aiRes, keysRes, catRes, tagRes, writerRes, posterRes] = await Promise.all([
      db.collection('sys_config').doc('ai_config').get().catch(() => null),
      db.collection('api_keys').limit(100).get().catch(() => null),
      db.collection('sys_config').doc('categories_whitelist').get().catch(() => null),
      db.collection('sys_config').doc('tags_whitelist').get().catch(() => null),
      db.collection('sys_config').doc('ai_writer_config').get().catch(() => null),
      db.collection('poster_quotes').limit(1).count().catch(() => null),
    ]);

    // 1. 模型配置
    const aiData = aiRes?.data;
    const aiCfg = aiData ? (Array.isArray(aiData) ? aiData[0] : aiData) : null;
    const hasModel = !!(aiCfg && (aiCfg as any).MODEL);
    const hasKey = !!(aiCfg && (aiCfg as any).API_KEY);
    const aiProvider = (aiCfg && (aiCfg as any).PROVIDER) || '';
    const providerLabel = aiProvider === 'volcengine' ? '火山方舟'
      : aiProvider === 'aliyun' ? '阿里云百炼'
      : aiProvider === 'zhipu' ? '智谱AI'
      : aiProvider === 'lingyi' ? '零一万物'
      : aiProvider === 'xiaomi' ? '小米'
      : aiProvider ? aiProvider
      : '';
    statusItems.value = [
      {
        label: '视觉模型配置',
        detail: hasModel ? `${providerLabel ? providerLabel + ' / ' : ''}${(aiCfg as any).MODEL}` : '未配置',
        configured: hasModel && hasKey,
        hint: !hasModel ? '请选择 AI 厂商和模型' : !hasKey ? '缺少 API Key' : undefined,
        tab: 'model',
      },
    ];

    // 2. API Key
    const keysData = (keysRes?.data ?? []) as any[];
    const keyCount = Array.isArray(keysData) ? keysData.length : 0;
    statusItems.value.push({
      label: 'API Key 管理',
      detail: keyCount > 0 ? `已配置 ${keyCount} 个 Key` : '暂无 Key',
      configured: keyCount > 0,
      hint: keyCount === 0 ? '至少需要一个 API Key' : undefined,
      tab: 'keys',
    });

    // 3. 标签白名单
    const catData = catRes?.data;
    const catDoc = catData ? (Array.isArray(catData) ? catData[0] : catData) : null;
    const catCount = catDoc && Array.isArray((catDoc as WhitelistDoc).categories) ? (catDoc as WhitelistDoc).categories!.length : 0;

    const tagData = tagRes?.data;
    const tagDoc = tagData ? (Array.isArray(tagData) ? tagData[0] : tagData) : null;
    const tagCount = tagDoc && Array.isArray((tagDoc as WhitelistDoc).tags) ? (tagDoc as WhitelistDoc).tags!.length : 0;

    statusItems.value.push({
      label: '标签白名单',
      detail: (catCount > 0 || tagCount > 0) ? `${catCount} 个分类 · ${tagCount} 个标签` : '未配置',
      configured: catCount > 0 && tagCount > 0,
      hint: catCount === 0 && tagCount === 0 ? '分类和标签均未配置' : catCount === 0 ? '缺少分类配置' : tagCount === 0 ? '缺少标签配置' : undefined,
      tab: 'whitelist',
    });

    // 4. 文案配置
    const writerData = writerRes?.data;
    const writerCfg = writerData ? (Array.isArray(writerData) ? writerData[0] : writerData) : null;
    const hasWriterModel = !!(writerCfg && (writerCfg as any).MODEL);
    const writerProvider = (writerCfg && (writerCfg as any).PROVIDER) || '';
    const writerProviderLabel = writerProvider === 'volcengine' ? '火山方舟'
      : writerProvider === 'aliyun' ? '阿里云百炼'
      : writerProvider === 'zhipu' ? '智谱AI'
      : writerProvider === 'lingyi' ? '零一万物'
      : writerProvider === 'xiaomi' ? '小米'
      : writerProvider ? writerProvider
      : '';
    statusItems.value.push({
      label: '文案生成配置',
      detail: hasWriterModel ? `${writerProviderLabel ? writerProviderLabel + ' / ' : ''}${(writerCfg as any).MODEL}` : '未配置',
      configured: hasWriterModel,
      hint: !hasWriterModel ? '请配置文案 AI 模型' : undefined,
      tab: 'writer',
    });

    // 5. 海报语录
    const posterTotal = posterRes?.total ?? 0;
    statusItems.value.push({
      label: '海报语录',
      detail: posterTotal > 0 ? `${posterTotal} 条语录` : '暂无语录',
      configured: posterTotal > 0,
      hint: posterTotal === 0 ? '可用 AI 批量生成' : undefined,
      tab: 'poster',
    });
  } catch (error) {
    console.error('[AIConfigPage] Fetch status failed', error);
  } finally {
    statusLoading.value = false;
  }
};

// 保存操作后刷新状态
const refreshStatusAfterSave = (): void => {
  fetchStatusData();
};

// ======== Methods ========
const showMessage = (msg: string, type: MessageType): void => {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => { message.value = ''; }, 3000);
};

const onChildNotify = (payload: { msg: string; type: MessageType }): void => {
  showMessage(payload.msg, payload.type);
  if (payload.type === 'success') {
    refreshStatusAfterSave();
  }
};

const fetchData = async (): Promise<void> => {
  loading.value = true;
  try {
    const [catRes, tagRes] = await Promise.all([
      db.collection('sys_config').doc('categories_whitelist').get().catch(() => null),
      db.collection('sys_config').doc('tags_whitelist').get().catch(() => null),
    ]);

    const catData = catRes?.data;
    const catDoc = catData ? (Array.isArray(catData) ? catData[0] : catData) : null;
    if (catDoc) {
      const doc = catDoc as WhitelistDoc;
      if (Array.isArray(doc.categories)) {
        categoriesStr.value = doc.categories.join(', ');
      }
    }

    const tagData = tagRes?.data;
    const tagDoc = tagData ? (Array.isArray(tagData) ? tagData[0] : tagData) : null;
    if (tagDoc) {
      const doc = tagDoc as WhitelistDoc;
      if (Array.isArray(doc.tags)) {
        tagsStr.value = doc.tags.join(', ');
      }
    }
  } catch (error) {
    console.error('[AIConfigPage] Fetch whitelist data failed', error);
  } finally {
    loading.value = false;
  }
};

const saveCategories = async (): Promise<void> => {
  saving.value = true;
  try {
    await db.collection('sys_config').doc('categories_whitelist').set({
      categories: previewCategories.value
    });
    showMessage('分类保存成功！', 'success');
    refreshStatusAfterSave();
  } catch (error) {
    showMessage('保存失败: ' + (error as Error).message, 'error');
  } finally {
    saving.value = false;
  }
};

const saveTags = async (): Promise<void> => {
  saving.value = true;
  try {
    await db.collection('sys_config').doc('tags_whitelist').set({
      tags: previewTags.value
    });
    showMessage('标签保存成功！', 'success');
    refreshStatusAfterSave();
  } catch (error) {
    showMessage('保存失败: ' + (error as Error).message, 'error');
  } finally {
    saving.value = false;
  }
};

// ======== Lifecycle ========
onMounted(() => {
  fetchData();
  fetchStatusData();
});
</script>

<style scoped>
.card {
  background: var(--bg-card);
  border-radius: 0.75rem;
  border: 1px solid var(--border-color);
  overflow: hidden;
  transition: all 300ms;
}

.input {
  width: 100%;
  padding: 0.625rem 1rem;
  border-radius: 0.5rem;
  background: var(--bg-body);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  transition: all 300ms;
}

.input::placeholder {
  color: var(--text-sub);
}

.input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.2);
}

.input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-soft {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  background: var(--bg-body);
  color: var(--text-main);
  border: 1px solid var(--border-color);
  transition: all 300ms;
}

.btn-soft:hover:not(:disabled) {
  background: var(--bg-card);
}

.btn-soft:disabled {
  opacity: 0.5;
}
</style>
