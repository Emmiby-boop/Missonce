<template>
  <div v-if="loading" class="flex justify-center py-12">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
  </div>

  <!-- Writer Configuration Tab -->
  <section v-else-if="activeTab === 'writer'" class="space-y-6">
    <div class="card p-6 space-y-6">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 class="text-lg font-bold text-[var(--text-main)]">文案生成配置</h3>
          <p class="text-sm text-[var(--text-sub)] mt-1">配置灵感文案功能的AI参数和场景预设</p>
        </div>
      </div>

      <div class="space-y-2">
        <div class="flex justify-between items-center">
          <label class="text-sm font-medium text-[var(--text-main)]">文案系统提示词</label>
          <button @click="resetWriterPrompt" class="text-xs text-[var(--primary)] hover:underline">恢复默认</button>
        </div>
        <textarea
          v-model="writerConfig.SYSTEM_PROMPT"
          class="input w-full h-64 font-mono text-sm leading-relaxed"
          placeholder="# 文案生成任务..."
        ></textarea>
        <p class="text-xs text-[var(--text-sub)]">定义AI文案生成的角色、风格和输出要求</p>
      </div>

      <div class="h-px bg-[var(--border-color)] my-2"></div>

      <div class="space-y-4">
        <h4 class="font-semibold text-[var(--text-main)]">文案模型配置</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="text-sm font-medium text-[var(--text-main)]">AI 服务商</label>
            <select
              v-model="writerSelectedProvider"
              @change="onWriterProviderChange"
              class="input"
            >
              <optgroup label="内置厂商">
                <option value="volcengine">火山方舟（豆包）</option>
                <option value="aliyun">阿里云百炼</option>
                <option value="zhipu">智谱AI</option>
                <option value="lingyi">零一万物</option>
                <option value="xiaomi">小米（MiMo）</option>
              </optgroup>
              <optgroup v-if="customProvidersList.length > 0" label="自定义厂商">
                <option v-for="p in customProvidersList" :key="p.id" :value="p.id">{{ p.name }}</option>
              </optgroup>
            </select>
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-[var(--text-main)]">模型</label>
            <select v-if="filteredTextModels.length > 0" v-model="writerConfig.MODEL" class="input">
              <option value="">请选择模型</option>
              <option v-for="m in filteredTextModels" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>
            <input
              v-else
              v-model="writerConfig.MODEL"
              class="input font-mono text-sm"
              placeholder="输入模型 ID（如 gpt-4o）"
            />
            <p v-if="filteredTextModels.length === 0" class="text-xs text-[var(--text-sub)]">
              此厂商没有预置模型，请手动输入模型 ID
            </p>
          </div>
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-[var(--text-main)]">API Key</label>
          <input v-model="writerConfig.API_KEY" type="password" class="input" placeholder="输入 API Key（如果与视觉模型共用，可不填）" />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-[var(--text-main)]">API URL（可选）</label>
          <input v-model="writerConfig.API_URL" class="input" placeholder="留空使用默认地址" />
        </div>
      </div>

      <div class="h-px bg-[var(--border-color)] my-2"></div>

      <div class="space-y-4">
        <div class="flex justify-between items-center">
          <div>
            <h4 class="font-semibold text-[var(--text-main)]">热门场景预设</h4>
            <p class="text-xs text-[var(--text-sub)]">用户点击即可使用的快捷场景</p>
          </div>
          <button @click="addScene" class="btn-soft text-sm px-3 py-1.5">
            + 添加场景
          </button>
        </div>

        <div v-if="writerScenes.length === 0" class="text-center py-8 text-[var(--text-sub)]">
          暂无场景预设
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="(scene, index) in writerScenes"
            :key="index"
            class="p-4 rounded-xl bg-[var(--bg-body)] border border-[var(--border-color)]"
          >
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div class="flex-1 space-y-2">
                <input v-model="scene.name" class="input text-sm" placeholder="场景名称，如：朋友圈" />
                <input v-model="scene.prompt" class="input text-sm" placeholder="提示词，如：帮我写一段适合发朋友圈的文案" />
                <div class="flex items-center gap-2">
                  <input v-model="scene.emoji" class="input text-sm" style="width: 80px;" placeholder="emoji" />
                  <span class="text-xs text-[var(--text-sub)]">图标</span>
                </div>
              </div>
              <button
                @click="removeScene(index)"
                class="btn-soft text-red-500 hover:bg-red-50 text-sm px-3 py-1.5 shrink-0"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-4 pt-4 border-t border-[var(--border-color)]">
        <button
          @click="saveWriterConfig"
          class="btn-primary px-8 py-2.5"
          :disabled="saving"
        >
          {{ saving ? '保存中...' : '保存配置' }}
        </button>
        <button
          @click="testWriterConnection"
          class="btn-soft px-4 py-2 text-sm flex items-center gap-1.5"
          :disabled="testingWriter || !writerConfig.MODEL || !writerConfig.API_KEY"
        >
          <svg v-if="testingWriter" class="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          {{ testingWriter ? '测试中...' : '测试连接' }}
        </button>
        <p v-if="message" :class="messageType === 'success' ? 'text-green-500' : 'text-red-500'" class="text-sm">
          {{ message }}
        </p>
      </div>
      <p v-if="writerTestResult" :class="writerTestResult.success ? 'text-green-500' : 'text-red-500'" class="text-sm">
        {{ writerTestResult.message }}
      </p>
    </div>

    <!-- 精选文案库 -->
    <div class="card p-6 space-y-6">
      <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h3 class="text-lg font-bold text-[var(--text-main)]">精选文案库</h3>
          <p class="text-xs text-[var(--text-sub)] mt-1">手动添加优质文案供用户直接使用</p>
        </div>
        <button @click="addFeaturedQuote" class="btn-soft text-sm px-3 py-1.5 shrink-0">
          + 添加文案
        </button>
      </div>

      <div v-if="featuredQuotes.length === 0" class="text-center py-8 text-[var(--text-sub)]">
        暂无精选文案
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="(quote, index) in featuredQuotes"
          :key="index"
          class="p-4 rounded-xl bg-[var(--bg-body)] border border-[var(--border-color)]"
        >
          <div class="flex flex-col gap-3">
            <textarea v-model="quote.content" class="input text-sm h-24" placeholder="文案内容"></textarea>
            <div class="flex flex-wrap items-center gap-2">
              <input v-model="quote.tags" class="input text-sm" style="flex: 1;" placeholder="标签，多个用逗号分隔" />
              <button
                @click="removeFeaturedQuote(index)"
                class="btn-soft text-red-500 hover:bg-red-50 text-sm px-3 py-1.5"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-4 pt-4 border-t border-[var(--border-color)]">
        <button
          @click="saveFeaturedQuotes"
          class="btn-primary px-6 py-2"
          :disabled="saving"
        >
          {{ saving ? '保存中...' : '保存文案库' }}
        </button>
      </div>
    </div>
  </section>

  <!-- 海报语录 Tab -->
  <section v-else-if="activeTab === 'poster'" class="space-y-6">
    <div class="card p-6 space-y-6">
      <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h3 class="text-lg font-bold text-[var(--text-main)]">海报语录</h3>
          <p class="text-xs text-[var(--text-sub)] mt-1">
            管理海报生成时展示的语录 · 共 {{ posterQuotes.length }} 条 ·
            使用 <span class="text-[var(--primary)]">{{ writerConfig.PROVIDER }}/{{ writerConfig.MODEL }}</span>
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button
            @click="aiGenerateQuotes"
            class="btn-soft text-sm px-3 py-1.5 flex items-center gap-1"
            :disabled="generatingQuotes"
          >
            <span v-if="generatingQuotes" class="inline-block w-3.5 h-3.5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></span>
            {{ generatingQuotes ? 'AI 生成中...' : '🤖 AI 生成语录' }}
          </button>
          <button @click="addPosterQuote" class="btn-soft text-sm px-3 py-1.5">
            + 添加语录
          </button>
        </div>
      </div>

      <div v-if="generatedQuotes.length > 0" class="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
        <div class="flex items-center justify-between mb-3">
          <span class="text-sm font-medium text-green-700 dark:text-green-400">AI 已生成 {{ generatedQuotes.length }} 条语录</span>
          <button @click="saveGeneratedQuotes" class="btn-primary text-xs px-3 py-1.5" :disabled="savingPoster">
            {{ savingPoster ? '保存中...' : '全部保存到库' }}
          </button>
        </div>
        <div class="space-y-2 max-h-60 overflow-y-auto">
          <div v-for="(q, i) in generatedQuotes" :key="i"
            class="flex items-start gap-2 text-sm text-[var(--text-main)] bg-white dark:bg-gray-800 rounded-lg px-3 py-2">
            <span class="text-[var(--primary)] shrink-0 mt-0.5">{{ i + 1 }}.</span>
            <span class="flex-1">{{ q }}</span>
          </div>
        </div>
      </div>

      <div v-if="posterQuotes.length === 0 && generatedQuotes.length === 0" class="text-center py-8 text-[var(--text-sub)]">
        暂无海报语录，点击「AI 生成语录」或手动添加
      </div>

      <div v-else-if="posterQuotes.length > 0" class="space-y-2">
        <div
          v-for="(q, index) in posterQuotes"
          :key="q._id || index"
          class="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-body)] border border-[var(--border-color)] group"
        >
          <span class="text-xs text-[var(--text-sub)] shrink-0 w-5">{{ index + 1 }}</span>
          <input
            v-model="q.text"
            class="input text-sm flex-1 bg-transparent border-0 !p-1 focus:outline-none"
            placeholder="输入语录..."
          />
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button @click="savePosterQuote(q)" class="text-xs text-[var(--primary)] hover:underline px-2">保存</button>
            <button @click="deletePosterQuote(q._id, index)" class="text-xs text-red-500 hover:underline px-2">删除</button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { callCloudFunction, callFunctionWithAuth } from '../utils/cloudbase';
import { type ProviderId as WriterProviderId, textModels } from '../constants/aiProviders';
import { useCustomProvidersStore } from '../stores/customProviders';
import { aiConfigService } from '../services/aiConfigService';
import { confirmDialog, confirmDeleteDialog } from '../composables/useDialog';

const customProvidersStore = useCustomProvidersStore();

// ======== Types ========
type TabId = 'model' | 'keys' | 'whitelist' | 'writer' | 'quotes' | 'poster';
type MessageType = 'success' | 'error';

interface WriterConfig {
  SYSTEM_PROMPT: string;
  ENABLED: boolean;
  PROVIDER: string;
  MODEL: string;
  API_URL: string;
  API_KEY: string;
}

interface WriterScene {
  name: string;
  prompt: string;
  emoji: string;
}

interface FeaturedQuote {
  content: string;
  tags: string;
}

interface PosterQuote {
  _id?: string;
  text: string;
  createdAt?: number;
}

interface GenerateQuotesResult {
  success: boolean;
  quotes?: string[];
  message?: string;
}

// ======== Props & Emits ========
defineProps<{
  activeTab: TabId;
}>();

const emit = defineEmits<{
  notify: [payload: { msg: string; type: MessageType }];
}>();

const writerDocExists = ref(false);

// ======== State ========
const loading = ref(true);
const saving = ref(false);
const message = ref('');
const messageType = ref<MessageType>('success');
const savingPoster = ref(false);
const generatingQuotes = ref(false);

const writerConfig = ref<WriterConfig>({
  SYSTEM_PROMPT: '',
  ENABLED: true,
  PROVIDER: 'aliyun',
  MODEL: 'qwen-turbo',
  API_URL: '',
  API_KEY: ''
});

const writerSelectedProvider = ref<WriterProviderId>('aliyun');

const writerScenes = ref<WriterScene[]>([]);
const featuredQuotes = ref<FeaturedQuote[]>([]);
const posterQuotes = ref<PosterQuote[]>([]);
const generatedQuotes = ref<string[]>([]);
const testingWriter = ref(false);
const writerTestResult = ref<{ success: boolean; message: string } | null>(null);

// ======== Constants ========
const DEFAULT_WRITER_PROMPT = `# 文案生成任务
你是一位温暖且懂生活的文案助手，擅长撰写各种社交媒体文案。

## 要求：
1. 语言风格：温暖、治愈、有温度
2. 字数：适中，适合手机阅读
3. 可以适当使用表情符号，但不要过度
4. 内容积极向上，有感染力

请直接输出文案内容，无需任何解释。`;

const DEFAULT_WRITER_SCENES: WriterScene[] = [
  { name: '朋友圈', prompt: '帮我写一段适合发朋友圈的文案', emoji: '✨' },
  { name: 'Emo时刻', prompt: '最近心情不好，帮我写一段emo文案', emoji: '🌙' },
  { name: '表白', prompt: '帮我写一段表白文案', emoji: '💌' },
  { name: '毕业季', prompt: '帮我写一段毕业文案', emoji: '🎓' }
];

// ======== Computed ========
const customProvidersList = computed(() => customProvidersStore.allProviders.filter(p => p.custom));

const filteredTextModels = computed(() => {
  if (!writerSelectedProvider.value) return [];
  const builtin = textModels[writerSelectedProvider.value as keyof typeof textModels];
  if (builtin) return builtin;
  return customProvidersStore.getModels(writerSelectedProvider.value, 'text');
});

// ======== Methods ========
const showMessage = (msg: string, type: MessageType): void => {
  message.value = msg;
  messageType.value = type;
  emit('notify', { msg, type });
  setTimeout(() => { message.value = ''; }, 3000);
};

const fetchData = async (): Promise<void> => {
  loading.value = true;
  try {
    // 确保自定义厂商已加载（必须 await，否则下拉列表不完整）
    await customProvidersStore.load().catch(() => {});
    const writerData = await aiConfigService.getConfig('ai_writer_config');

    if (!writerData) {
      writerDocExists.value = false;
      writerConfig.value.SYSTEM_PROMPT = DEFAULT_WRITER_PROMPT;
      writerConfig.value.MODEL = 'qwen-turbo';
      writerScenes.value = [...DEFAULT_WRITER_SCENES];
    } else {
      writerDocExists.value = true;
      // 回填已有配置
      writerConfig.value.SYSTEM_PROMPT = writerData.SYSTEM_PROMPT || DEFAULT_WRITER_PROMPT;
      writerConfig.value.PROVIDER = writerData.PROVIDER || 'aliyun';
      writerConfig.value.MODEL = writerData.MODEL || 'qwen-turbo';
      writerConfig.value.API_URL = writerData.API_URL || '';
      writerConfig.value.API_KEY = writerData.API_KEY || '';
      writerConfig.value.ENABLED = writerData.ENABLED !== false;

      // 同步 provider 选择器（内置厂商 + 自定义厂商均可）
      const provider = writerData.PROVIDER as WriterProviderId;
      if (provider) {
        writerSelectedProvider.value = provider;
      }

      // 回填场景预设
      if (Array.isArray(writerData.scenes) && writerData.scenes.length > 0) {
        writerScenes.value = writerData.scenes;
      } else {
        writerScenes.value = [...DEFAULT_WRITER_SCENES];
      }

      // 回填精选文案库
      if (Array.isArray(writerData.featuredQuotes)) {
        featuredQuotes.value = writerData.featuredQuotes;
      }
    }
  } catch (error) {
    console.error('[AIQuotesConfig] Fetch data failed', error);
  } finally {
    loading.value = false;
  }

  // 单独加载海报语录（独立集合）
  try {
    const list = await aiConfigService.listPosterQuotes();
    posterQuotes.value = list as PosterQuote[];
  } catch (e) {
    console.error('[AIQuotesConfig] 海报语录加载失败:', e);
  }
};

const resetWriterPrompt = async (): Promise<void> => {
  const confirmed = await confirmDialog('确定要恢复默认的文案系统提示词吗？');
  if (!confirmed) return;
  writerConfig.value.SYSTEM_PROMPT = DEFAULT_WRITER_PROMPT;
};

const addScene = (): void => {
  writerScenes.value.push({ name: '', prompt: '', emoji: '' });
};

const removeScene = (index: number): void => {
  writerScenes.value.splice(index, 1);
};

const addFeaturedQuote = (): void => {
  featuredQuotes.value.push({ content: '', tags: '' });
};

const removeFeaturedQuote = (index: number): void => {
  featuredQuotes.value.splice(index, 1);
};

const onWriterProviderChange = (): void => {
  writerConfig.value.MODEL = '';
  // 内置厂商走默认 URL，自定义厂商从 store 取 baseUrl
  writerConfig.value.API_URL = customProvidersStore.getApiUrl(writerSelectedProvider.value);
};

const saveWriterConfig = async (): Promise<void> => {
  // --- Validation ---
  if (!writerConfig.value.MODEL.trim()) {
    showMessage('请选择一个模型后再保存', 'error');
    return;
  }
  if (!writerConfig.value.SYSTEM_PROMPT.trim() || writerConfig.value.SYSTEM_PROMPT.trim().length < 10) {
    showMessage('系统提示词至少需要 10 个字符', 'error');
    return;
  }

  saving.value = true;
  message.value = '';
  try {
    const docData = {
      SYSTEM_PROMPT: writerConfig.value.SYSTEM_PROMPT || '',
      PROVIDER: writerSelectedProvider.value,
      MODEL: writerConfig.value.MODEL || '',
      API_URL: writerConfig.value.API_URL || '',
      API_KEY: writerConfig.value.API_KEY || '',
      scenes: writerScenes.value || []
    };

    // upsert：云函数内部按「存在则 update、不存在则创建」处理
    await aiConfigService.setConfig('ai_writer_config', docData);
    writerDocExists.value = true;
    showMessage('文案配置保存成功！', 'success');
    // 保存成功后重新拉取数据，确保状态同步
    await fetchData();
  } catch (error) {
    showMessage('保存失败: ' + (error as Error).message, 'error');
  } finally {
    saving.value = false;
  }
};

const testWriterConnection = async (): Promise<void> => {
  testingWriter.value = true;
  writerTestResult.value = null;

  try {
    const apiUrl = writerConfig.value.API_URL || customProvidersStore.getApiUrl(writerSelectedProvider.value);

    if (!apiUrl || !writerConfig.value.API_KEY) {
      writerTestResult.value = { success: false, message: '请先配置 API URL 和 API Key' };
      return;
    }

    // 通过云函数代理调用，绕过浏览器 CORS 限制
    const result = await callFunctionWithAuth('testAiConnection', {
      API_URL: apiUrl,
      API_KEY: writerConfig.value.API_KEY,
      MODEL: writerConfig.value.MODEL,
      messages: [{ role: 'user', content: '你好' }],
      max_tokens: 10
    }) as { success: boolean; message: string };

    writerTestResult.value = {
      success: result.success,
      message: result.success ? `文案模型${result.message}` : `文案模型${result.message}`
    };
  } catch (error) {
    writerTestResult.value = {
      success: false,
      message: `调用失败: ${(error as Error).message}`
    };
  } finally {
    testingWriter.value = false;
  }
};

const saveFeaturedQuotes = async (): Promise<void> => {
  // --- Validation ---
  if (featuredQuotes.value.length === 0) {
    showMessage('精选文案库为空，请先添加文案', 'error');
    return;
  }
  const emptyIndex = featuredQuotes.value.findIndex(q => !q.content.trim());
  if (emptyIndex !== -1) {
    showMessage(`第 ${emptyIndex + 1} 条文内容为空，请补充或删除`, 'error');
    return;
  }

  saving.value = true;
  message.value = '';
  try {
    await aiConfigService.setConfig('ai_writer_config', {
      featuredQuotes: featuredQuotes.value
    });
    showMessage('文案库保存成功！', 'success');
  } catch (error) {
    showMessage('保存失败: ' + (error as Error).message, 'error');
  } finally {
    saving.value = false;
  }
};

// ======== 海报语录管理 ========
const addPosterQuote = (): void => {
  posterQuotes.value.push({ text: '' });
};

const savePosterQuote = async (q: PosterQuote): Promise<void> => {
  if (!q.text.trim()) return;
  savingPoster.value = true;
  try {
    // ⚠️ 旧代码这里误用了小程序端的 update({ data }) 写法，Web SDK 会把 data 当字段名写进去；
    //    并且 add({ data }) 同理 —— 创建的文档结构是 { data: { text } } 而非 { text }。
    //    现在统一走云函数。
    const res = await aiConfigService.savePosterQuote(q.text.trim(), q._id);
    if (!q._id && res?.data?.id) q._id = String(res.data.id);
    showMessage('语录已保存', 'success');
  } catch (e) {
    showMessage('保存失败: ' + (e as Error).message, 'error');
  } finally {
    savingPoster.value = false;
  }
};

const deletePosterQuote = async (id: string | undefined, index: number): Promise<void> => {
  const confirmed = await confirmDeleteDialog('确定删除这条语录？');
  if (!confirmed) return;
  try {
    if (id) await aiConfigService.deletePosterQuote(id);
    posterQuotes.value.splice(index, 1);
    showMessage('已删除', 'success');
  } catch (e) {
    showMessage('删除失败: ' + (e as Error).message, 'error');
  }
};

const aiGenerateQuotes = async (): Promise<void> => {
  generatingQuotes.value = true;
  generatedQuotes.value = [];
  try {
    const res = await callCloudFunction('generatePosterQuotes', { action: 'generate', count: 5 }) as GenerateQuotesResult;
    if (res && res.success && res.quotes) {
      generatedQuotes.value = res.quotes;
      showMessage(`AI 已生成 ${res.quotes.length} 条文案`, 'success');
    } else {
      showMessage(res?.message || 'AI 生成失败，请检查模型配置', 'error');
    }
  } catch (e) {
    showMessage('AI 调用失败: ' + (e as Error).message, 'error');
  } finally {
    generatingQuotes.value = false;
  }
};

const saveGeneratedQuotes = async (): Promise<void> => {
  if (generatedQuotes.value.length === 0) return;
  savingPoster.value = true;
  try {
    await aiConfigService.addPosterQuotes(generatedQuotes.value);
    // 重新加载
    posterQuotes.value = (await aiConfigService.listPosterQuotes()) as PosterQuote[];
    generatedQuotes.value = [];
    showMessage('全部保存成功！', 'success');
  } catch (e) {
    showMessage('保存失败: ' + (e as Error).message, 'error');
  } finally {
    savingPoster.value = false;
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
