<template>
  <div v-if="loading" class="flex justify-center py-12">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
  </div>

  <!-- Model Configuration Tab -->
  <section v-else-if="activeTab === 'model'" class="card p-6 space-y-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <h3 class="text-lg font-bold text-[var(--text-main)]">模型参数</h3>
      <div class="flex flex-wrap items-center gap-3">
        <select v-model="selectedKeyId" @change="applySelectedKey" class="px-3 py-2 text-sm rounded-lg bg-[var(--bg-body)] border border-[var(--border-color)] text-[var(--text-main)]">
          <option value="">选择 Key...</option>
          <option v-for="key in apiKeys" :key="key._id" :value="key._id">
            {{ key.name }} ({{ key.provider }})
          </option>
        </select>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div class="space-y-2">
        <label class="text-sm font-medium text-[var(--text-main)]">API 厂商</label>
        <select v-model="selectedProvider" @change="onProviderChange" class="input w-full">
          <option value="">请选择厂商</option>
          <optgroup label="内置厂商">
            <option v-for="provider in builtinProvidersList" :key="provider.id" :value="provider.id">
              {{ provider.name }}
            </option>
          </optgroup>
          <optgroup v-if="customProvidersList.length > 0" label="自定义厂商">
            <option v-for="provider in customProvidersList" :key="provider.id" :value="provider.id">
              {{ provider.name }}
            </option>
          </optgroup>
        </select>
      </div>

      <div class="space-y-2 md:col-span-2">
        <label class="text-sm font-medium text-[var(--text-main)]">模型名称</label>
        <select v-if="filteredModels.length > 0" v-model="config.MODEL" class="input w-full" :disabled="!selectedProvider">
          <option value="">请选择模型</option>
          <option v-for="model in filteredModels" :key="model.id" :value="model.id">
            {{ model.name }}
          </option>
        </select>
        <input
          v-else
          v-model="config.MODEL"
          class="input w-full font-mono text-sm"
          placeholder="输入模型 ID（如 gpt-4o）"
          :disabled="!selectedProvider"
        />
        <p v-if="selectedProvider && filteredModels.length === 0" class="text-xs text-[var(--text-sub)]">
          此厂商没有预置模型，请手动输入模型 ID
        </p>
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium text-[var(--text-main)]">API Key</label>
        <div class="relative">
          <input
            v-model="config.API_KEY"
            :type="showKey ? 'text' : 'password'"
            class="input w-full"
            placeholder="sk-..."
          />
          <button
            @click="showKey = !showKey"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-sub)] hover:text-[var(--text-main)]"
          >
            <span v-if="showKey" class="text-sm">隐藏</span>
            <span v-else class="text-sm">显示</span>
          </button>
        </div>
        <p class="text-xs text-[var(--text-sub)]">对应服务商的 API Key</p>
      </div>

      <div class="space-y-2 md:col-span-2">
        <label class="text-sm font-medium text-[var(--text-main)]">API Endpoint URL</label>
        <input
          v-model="config.API_URL"
          class="input w-full font-mono text-sm"
          placeholder="https://..."
        />
        <div v-if="providerInfo" class="text-xs text-blue-500 flex items-center gap-1 mt-1">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
          <a :href="providerInfo.url" target="_blank" class="hover:underline">
            {{ providerInfo.text }}
          </a>
        </div>
      </div>
    </div>

    <div class="h-px bg-[var(--border-color)] my-2"></div>

    <div class="space-y-2">
      <div class="flex justify-between items-center">
        <label class="text-sm font-medium text-[var(--text-main)]">系统提示词</label>
        <button @click="resetPrompt" class="text-xs text-[var(--primary)] hover:underline">恢复默认</button>
      </div>
      <textarea
        v-model="config.SYSTEM_PROMPT"
        class="input w-full h-80 font-mono text-sm leading-relaxed"
        placeholder="# 图片识别与分类任务..."
      ></textarea>
      <p class="text-xs text-[var(--text-sub)]">定义 AI 的角色、任务目标、分类体系及输出格式规则</p>
    </div>

    <div class="flex items-center gap-4 pt-4 border-t border-[var(--border-color)]">
      <button
        @click="saveAIConfig"
        class="btn-primary px-8 py-2.5"
        :disabled="saving"
      >
        {{ saving ? '保存中...' : '保存配置' }}
      </button>
      <button
        @click="testConnection"
        class="btn-soft px-6 py-2.5 flex items-center gap-2"
        :disabled="testing || !config.MODEL || !config.API_KEY || !config.API_URL"
      >
        <svg v-if="testing" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        {{ testing ? '测试中...' : '测试连接' }}
      </button>
      <p v-if="message" :class="messageType === 'success' ? 'text-green-500' : 'text-red-500'" class="text-sm">
        {{ message }}
      </p>
      <p v-if="testResult" :class="testResult.success ? 'text-green-500' : 'text-red-500'" class="text-sm mt-2">
        {{ testResult.message }}
      </p>
    </div>
  </section>

  <!-- API Keys Management Tab -->
  <section v-else-if="activeTab === 'keys'" class="space-y-6">
    <div class="card p-6">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 class="text-lg font-bold text-[var(--text-main)]">API Key 管理</h3>
          <p class="text-sm text-[var(--text-sub)] mt-1">管理多个 API Key，每个 Key 可关联不同服务商</p>
        </div>
        <button @click="showAddKeyModal = true" class="btn-primary px-4 py-2">
          + 添加 Key
        </button>
      </div>

      <div v-if="apiKeys.length === 0" class="text-center py-12">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 text-[var(--text-sub)]"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3zm-3.5 4.5L15.5 7.5"/></svg>
        <p class="text-[var(--text-sub)] mb-4">暂无 API Key</p>
        <button @click="showAddKeyModal = true" class="btn-primary px-4 py-2">
          添加第一个 Key
        </button>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="key in apiKeys"
          :key="key._id"
          class="p-4 rounded-xl bg-[var(--bg-body)] border border-[var(--border-color)] hover:border-[var(--primary)]/30 transition-colors"
        >
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3">
                <h4 class="font-semibold text-[var(--text-main)] truncate">{{ key.name }}</h4>
                <span class="px-2 py-0.5 text-xs rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">{{ key.provider }}</span>
              </div>
              <p class="text-sm text-[var(--text-sub)] mt-1">
                Key: {{ key.maskedKey }}
              </p>
              <p v-if="key.notes" class="text-xs text-[var(--text-sub)] mt-1 truncate">{{ key.notes }}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                @click="copyKey(key)"
                class="btn-soft text-sm px-3 py-1.5"
                title="复制 Key"
              >
                复制
              </button>
              <button
                @click="editKey(key)"
                class="btn-soft text-sm px-3 py-1.5"
                title="编辑"
              >
                编辑
              </button>
              <button
                @click="deleteKey(key._id)"
                class="btn-soft text-sm px-3 py-1.5 text-red-500 hover:bg-red-50"
                title="删除"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Add/Edit Key Modal -->
  <div v-if="showAddKeyModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="card w-full max-w-md">
      <div class="p-6 border-b border-[var(--border-color)]">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold text-[var(--text-main)]">{{ editingKey ? '编辑 Key' : '添加 API Key' }}</h3>
          <button @click="closeModal" class="text-[var(--text-sub)] hover:text-[var(--text-main)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </div>
      <div class="p-6 space-y-4">
        <div class="space-y-2">
          <label class="text-sm font-medium text-[var(--text-main)]">Key 名称</label>
          <input v-model="keyForm.name" class="input w-full" placeholder="例如：通义千问-生产环境" />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-[var(--text-main)]">服务商</label>
          <select v-model="keyForm.provider" class="input w-full">
            <optgroup label="内置厂商">
              <option value="火山方舟">火山方舟（豆包）</option>
              <option value="阿里云百炼">阿里云百炼</option>
              <option value="智谱AI">智谱AI</option>
              <option value="零一万物">零一万物</option>
              <option value="小米（MiMo）">小米（MiMo）</option>
            </optgroup>
            <optgroup v-if="customProvidersList.length > 0" label="自定义厂商">
              <option v-for="provider in customProvidersList" :key="provider.id" :value="provider.name.replace('（自定义）', '')">
                {{ provider.name }}
              </option>
            </optgroup>
            <option value="其他">其他</option>
          </select>
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-[var(--text-main)]">API Key</label>
          <input v-model="keyForm.key" :type="showKeyModal ? 'text' : 'password'" class="input w-full" placeholder="sk-..." />
          <div class="flex items-center gap-2 mt-1">
            <input type="checkbox" id="showKeyModal" v-model="showKeyModal" class="rounded" />
            <label for="showKeyModal" class="text-xs text-[var(--text-sub)]">显示 Key</label>
          </div>
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-[var(--text-main)]">备注（可选）</label>
          <textarea v-model="keyForm.notes" class="input w-full h-20" placeholder="添加备注信息..."></textarea>
        </div>
      </div>
      <div class="p-6 border-t border-[var(--border-color)] flex gap-3 justify-end">
        <button @click="closeModal" class="btn-soft px-4 py-2">取消</button>
        <button @click="saveKey" class="btn-primary px-4 py-2" :disabled="saving">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useDialog } from 'naive-ui';
import { callFunctionWithAuth } from '../utils/cloudbase';
import { type ProviderId, BUILTIN_PROVIDERS, visionModels, getProviderConsoleUrl } from '../constants/aiProviders';
import { useCustomProvidersStore } from '../stores/customProviders';
import { aiConfigService } from '../services/aiConfigService';

const dialog = useDialog();
const customProvidersStore = useCustomProvidersStore();

// ======== Types ========
type TabId = 'model' | 'keys' | 'whitelist' | 'writer' | 'quotes' | 'poster';
type MessageType = 'success' | 'error';

interface ApiKey {
  _id: string;
  name: string;
  provider: string;
  key: string;
  maskedKey: string;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

interface AIConfig {
  API_KEY: string;
  MODEL: string;
  API_URL: string;
  SYSTEM_PROMPT: string;
  PROVIDER?: string;
}

interface KeyForm {
  name: string;
  provider: string;
  key: string;
  notes: string;
}

interface KeyDoc {
  name: string;
  provider: string;
  key: string;
  notes?: string;
  updatedAt?: unknown;
  createdAt?: unknown;
}

interface DbAddResult {
  _id?: string;
  id?: string;
  code?: number;
  message?: string;
}

interface AiConfigDoc {
  API_KEY?: string;
  MODEL?: string;
  API_URL?: string;
  SYSTEM_PROMPT?: string;
  PROVIDER?: string;
}

// ======== Props & Emits ========
defineProps<{
  activeTab: TabId;
}>();

const emit = defineEmits<{
  notify: [payload: { msg: string; type: MessageType }];
}>();

// ======== State ========
const loading = ref(true);
const saving = ref(false);
const showKey = ref(false);
const showKeyModal = ref(false);
const message = ref('');
const messageType = ref<MessageType>('success');
const selectedKeyId = ref('');
const selectedProvider = ref<ProviderId | ''>('');
const showAddKeyModal = ref(false);
const editingKey = ref<ApiKey | null>(null);
const testing = ref(false);
const testResult = ref<{ success: boolean; message: string } | null>(null);

const apiKeys = ref<ApiKey[]>([]);

const config = ref<AIConfig>({
  API_KEY: '',
  MODEL: '',
  API_URL: '',
  SYSTEM_PROMPT: ''
});

const keyForm = ref<KeyForm>({
  name: '',
  provider: '火山方舟',
  key: '',
  notes: ''
});

// ======== Computed ========
const builtinProvidersList = computed(() => BUILTIN_PROVIDERS);

const customProvidersList = computed(() => customProvidersStore.allProviders.filter(p => p.custom));

const filteredModels = computed(() => {
  if (!selectedProvider.value) return [];
  // 内置厂商走 visionModels
  const builtin = visionModels[selectedProvider.value];
  if (builtin) return builtin;
  // 自定义厂商走 store
  return customProvidersStore.getModels(selectedProvider.value, 'vision');
});

const providerInfo = computed(() => {
  if (!selectedProvider.value) return null;
  // 仅内置厂商有控制台链接
  if (!customProvidersStore.isBuiltin(selectedProvider.value)) return null;
  return getProviderConsoleUrl(selectedProvider.value, config.value.API_URL || '');
});

// ======== Methods ========
const onProviderChange = (): void => {
  config.value.MODEL = '';
  // 内置厂商走默认 URL，自定义厂商从 store 取
  config.value.API_URL = customProvidersStore.getApiUrl(selectedProvider.value);
  const providerName = customProvidersStore.getDisplayName(selectedProvider.value);
  autoSelectKeyByProvider(providerName);
};

const autoSelectKeyByProvider = (provider: string): void => {
  const matchingKey = apiKeys.value.find(k => k.provider === provider);
  if (matchingKey) {
    selectedKeyId.value = matchingKey._id;
    config.value.API_KEY = matchingKey.key;
  }
};

const applySelectedKey = (): void => {
  if (!selectedKeyId.value) return;
  const key = apiKeys.value.find(k => k._id === selectedKeyId.value);
  if (key) {
    config.value.API_KEY = key.key;
  }
};

const resetPrompt = async (): Promise<void> => {
  const confirmed = await dialog.warning({
    title: '提示',
    content: '确定要恢复默认的系统提示词吗？',
    positiveText: '确定',
    negativeText: '取消',
  });
  if (!confirmed) return;
  config.value.SYSTEM_PROMPT = `
# 图片识别与分类任务

## 任务目标
请你作为专业的图片内容分析引擎，对用户上传的图片进行识别，生成中文标题、分类与描述性标签。

## 核心处理流程
1. 判断图片用途类型（壁纸 or 头像）
2. 生成简洁有吸引力的中文标题
3. 根据类型进行主分类与打标
4. 输出 JSON 格式结果

## 输出格式（严格 JSON 对象，不要输出解释文字）
{
  "title": "中文标题，6-16 字，体现画面主体与氛围",
  "detected_type": "avatar | wallpaper | dynamic_avatar",
  "categories": ["主分类，1 个"],
  "tags": ["3-6 个中文描述标签"],
  "colors": ["主色调，1-3 个"]
}

## 规则
1. title 必须为中文、6-16 字，突出画面主体（如「赛博晚霞」「雾屿蓝调」「几何奶油白」），不含扩展名，不要写「一张图片」这类空泛描述。
2. 严格区分【头像】与【壁纸】：主体居中、留白多的多为头像；场景宏大、适合铺满屏幕的多为壁纸。
3. 静态图片(jpg/png) 绝对不要标记为「动态头像」，只有 GIF 动图才是动态头像。
4. 只输出 JSON 对象，不要附加任何解释文字。
`.trim();
};

const maskKey = (key: string): string => {
  if (!key) return '';
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
};

const showMessage = (msg: string, type: MessageType): void => {
  message.value = msg;
  messageType.value = type;
  emit('notify', { msg, type });
  setTimeout(() => { message.value = ''; }, 3000);
};

const fetchData = async (): Promise<void> => {
  loading.value = true;
  try {
    // 并行加载：AI 配置、API Keys（走 manageAiConfig 云函数，前端直连受安全规则限制无法写入）
    const [aiConfig, keysData] = await Promise.all([
      aiConfigService.getConfig('ai_config'),
      aiConfigService.listApiKeys(),
    ]);
    // 确保自定义厂商已加载（必须 await 完成，否则反向匹配会失败）
    await customProvidersStore.load().catch(() => {});

    if (aiConfig) {
      const cfg = aiConfig as AiConfigDoc;
      config.value = {
        API_KEY: cfg.API_KEY || '',
        MODEL: cfg.MODEL || '',
        API_URL: cfg.API_URL || '',
        SYSTEM_PROMPT: cfg.SYSTEM_PROMPT || config.value.SYSTEM_PROMPT,
        PROVIDER: cfg.PROVIDER || ''
      };
      // 优先用数据库里的 PROVIDER 字段直接匹配
      if (cfg.PROVIDER) {
        selectedProvider.value = cfg.PROVIDER;
      } else {
        // 兼容旧数据：通过 URL 反向匹配
        const allProviders = customProvidersStore.allProviders;
        for (const p of allProviders) {
          const url = customProvidersStore.getApiUrl(p.id);
          if (url && url === cfg.API_URL) {
            selectedProvider.value = p.id;
            break;
          }
        }
      }
      if (!config.value.SYSTEM_PROMPT) resetPrompt();
    } else {
      resetPrompt();
    }

    if (Array.isArray(keysData) && keysData.length > 0) {
      apiKeys.value = keysData.filter(Boolean).map((k): ApiKey => ({
        _id: String(k._id ?? k.id ?? ''),
        name: String(k.name ?? ''),
        provider: String(k.provider ?? ''),
        key: String(k.key ?? ''),
        notes: k.notes ? String(k.notes) : '',
        maskedKey: maskKey(String(k.key ?? ''))
      }));
    }
  } catch (error) {
    console.error('[AIKeyManager] Fetch data failed', error);
  } finally {
    loading.value = false;
  }
};

const saveAIConfig = async (): Promise<void> => {
  // --- Validation ---
  if (!config.value.API_KEY.trim()) {
    showMessage('请填写 API Key 后再保存', 'error');
    return;
  }
  if (config.value.API_KEY.trim() && !config.value.API_URL.trim()) {
    showMessage('已配置 API Key 时，API Endpoint URL 不能为空', 'error');
    return;
  }

  saving.value = true;
  message.value = '';
  try {
    await aiConfigService.setConfig('ai_config', {
      API_KEY: config.value.API_KEY || '',
      MODEL: config.value.MODEL || '',
      API_URL: config.value.API_URL || '',
      SYSTEM_PROMPT: config.value.SYSTEM_PROMPT || '',
      PROVIDER: selectedProvider.value || ''
    });
    showMessage('保存成功！', 'success');
    // 保存成功后重新拉取数据，确保状态同步
    await fetchData();
  } catch (error) {
    showMessage('保存失败: ' + (error as Error).message, 'error');
  } finally {
    saving.value = false;
  }
};

const testConnection = async (): Promise<void> => {
  testing.value = true;
  testResult.value = null;

  try {
    // 通过云函数代理调用，绕过浏览器 CORS 限制
    const result = await callFunctionWithAuth('testAiConnection', {
      API_URL: config.value.API_URL,
      API_KEY: config.value.API_KEY,
      MODEL: config.value.MODEL,
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 5
    }) as { success: boolean; message: string };

    testResult.value = {
      success: result.success,
      message: result.message
    };
  } catch (error) {
    testResult.value = {
      success: false,
      message: `调用失败: ${(error as Error).message}`
    };
  } finally {
    testing.value = false;
  }
};

const copyKey = async (key: ApiKey): Promise<void> => {
  try {
    await navigator.clipboard.writeText(key.key);
    showMessage('已复制到剪贴板', 'success');
  } catch {
    showMessage('复制失败', 'error');
  }
};

const editKey = (key: ApiKey): void => {
  editingKey.value = key;
  keyForm.value = {
    name: key.name,
    provider: key.provider,
    key: key.key,
    notes: key.notes || ''
  };
  showAddKeyModal.value = true;
};

const deleteKey = async (id: string): Promise<void> => {
  const confirmed = await dialog.warning({
    title: '提示',
    content: '确定要删除这个 Key 吗？',
    positiveText: '确定',
    negativeText: '取消',
  });
  if (!confirmed) return;
  try {
    await aiConfigService.deleteApiKey(id);
    apiKeys.value = apiKeys.value.filter(k => k._id !== id);
    showMessage('删除成功', 'success');
  } catch (error) {
    showMessage('删除失败: ' + (error as Error).message, 'error');
  }
};

const closeModal = (): void => {
  showAddKeyModal.value = false;
  editingKey.value = null;
  keyForm.value = {
    name: '',
    provider: '火山方舟',
    key: '',
    notes: ''
  };
};

const saveKey = async (): Promise<void> => {
  if (!keyForm.value.name || !keyForm.value.key) {
    showMessage('请填写 Key 名称和 API Key', 'error');
    return;
  }

  saving.value = true;
  try {
    const keyData: KeyDoc = {
      name: keyForm.value.name,
      provider: keyForm.value.provider,
      key: keyForm.value.key,
      notes: keyForm.value.notes,
      updatedAt: new Date()
    };

    if (editingKey.value) {
      const editId = editingKey.value._id;
      await aiConfigService.saveApiKey(keyData as unknown as Record<string, unknown>, editId);
      const idx = apiKeys.value.findIndex(k => k._id === editId);
      if (idx !== -1) {
        apiKeys.value[idx] = {
          ...keyData,
          _id: editId,
          maskedKey: maskKey(keyForm.value.key)
        };
      }
      showMessage('更新成功', 'success');
    } else {
      const res = await aiConfigService.saveApiKey(keyData as unknown as Record<string, unknown>);
      const newId = String(res?.data?.id || '');
      apiKeys.value.unshift({
        ...keyData,
        _id: newId,
        maskedKey: maskKey(keyForm.value.key)
      });
      showMessage('添加成功', 'success');
    }

    closeModal();
  } catch (error) {
    showMessage('保存失败: ' + (error as Error).message, 'error');
  } finally {
    saving.value = false;
  }
};

// ======== Lifecycle ========
onMounted(() => {
  fetchData();
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

.btn-primary {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  background: var(--primary);
  color: white;
  font-weight: 500;
  transition: opacity 300ms;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:disabled {
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
