<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 class="text-xl font-bold text-[var(--text-main)]">AI 智能配置</h2>
        <p class="text-sm text-[var(--text-sub)] mt-1">管理 AI 模型参数、API Key 及自动分类标签体系</p>
      </div>
      <div class="flex gap-2 overflow-x-auto pb-2">
        <button 
          @click="activeTab = 'model'"
          class="px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          :class="activeTab === 'model' ? 'bg-[var(--primary)] text-white shadow-sm' : 'bg-[var(--bg-card)] text-[var(--text-sub)] hover:text-[var(--text-main)] border border-[var(--border-color)]'"
        >
          模型配置
        </button>
        <button 
          @click="activeTab = 'keys'"
          class="px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          :class="activeTab === 'keys' ? 'bg-[var(--primary)] text-white shadow-sm' : 'bg-[var(--bg-card)] text-[var(--text-sub)] hover:text-[var(--text-main)] border border-[var(--border-color)]'"
        >
          Key 管理
        </button>
        <button 
          @click="activeTab = 'whitelist'"
          class="px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          :class="activeTab === 'whitelist' ? 'bg-[var(--primary)] text-white shadow-sm' : 'bg-[var(--bg-card)] text-[var(--text-sub)] hover:text-[var(--text-main)] border border-[var(--border-color)]'"
        >
          标签白名单
        </button>
        <button 
          @click="activeTab = 'writer'"
          class="px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          :class="activeTab === 'writer' ? 'bg-[var(--primary)] text-white shadow-sm' : 'bg-[var(--bg-card)] text-[var(--text-sub)] hover:text-[var(--text-main)] border border-[var(--border-color)]'"
        >
          文案配置
        </button>
      </div>
    </div>

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
            <option v-for="provider in providers" :key="provider.id" :value="provider.id">
              {{ provider.name }}
            </option>
          </select>
        </div>

        <div class="space-y-2 md:col-span-2">
          <label class="text-sm font-medium text-[var(--text-main)]">模型名称</label>
          <select v-model="config.MODEL" class="input w-full" :disabled="!selectedProvider">
            <option value="">请选择模型</option>
            <option v-for="model in filteredModels" :key="model.id" :value="model.id">
              {{ model.name }}
            </option>
          </select>
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
        <p v-if="message" :class="messageType === 'success' ? 'text-green-500' : 'text-red-500'" class="text-sm">
          {{ message }}
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
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-lineround="round" class="mx-auto mb-4 text-[var(--text-sub)]"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3zm-3.5 4.5L15.5 7.5"/></svg>
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

    <!-- Whitelist Configuration Tab -->
    <section v-else-if="activeTab === 'whitelist'" class="space-y-6">
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
    </section>

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
                <option value="volcengine">火山方舟（豆包）</option>
                <option value="aliyun">阿里云百炼</option>
                <option value="zhipu">智谱AI</option>
                <option value="lingyi">零一万物</option>
              </select>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-[var(--text-main)]">模型</label>
              <select v-model="writerConfig.MODEL" class="input">
                <option value="">请选择模型</option>
                <option v-for="m in filteredTextModels" :key="m.id" :value="m.id">{{ m.name }}</option>
              </select>
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
          <p v-if="message" :class="messageType === 'success' ? 'text-green-500' : 'text-red-500'" class="text-sm">
            {{ message }}
          </p>
        </div>
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
              <option value="火山方舟">火山方舟（豆包）</option>
              <option value="阿里云百炼">阿里云百炼</option>
              <option value="智谱AI">智谱AI</option>
              <option value="零一万物">零一万物</option>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { db, serverDate } from '../utils/cloudbase';

const activeTab = ref<'model' | 'keys' | 'whitelist' | 'writer'>('model');
const loading = ref(true);
const saving = ref(false);
const showKey = ref(false);
const showKeyModal = ref(false);
const message = ref('');
const messageType = ref<'success' | 'error'>('success');
const selectedKeyId = ref('');
const selectedProvider = ref('');
const showAddKeyModal = ref(false);
const editingKey = ref<any>(null);

const apiKeys = ref<any[]>([]);

const config = ref({
  API_KEY: '',
  MODEL: '',
  API_URL: '',
  SYSTEM_PROMPT: ''
});

const categoriesStr = ref('');
const tagsStr = ref('');

const keyForm = ref({
  name: '',
  provider: '火山方舟',
  key: '',
  notes: ''
});

const writerConfig = ref({
  SYSTEM_PROMPT: '',
  ENABLED: true,
  PROVIDER: 'aliyun',
  MODEL: 'qwen-turbo',
  API_URL: '',
  API_KEY: ''
});

const writerSelectedProvider = ref('aliyun');

const writerScenes = ref<any[]>([]);
const featuredQuotes = ref<any[]>([]);

const DEFAULT_WRITER_PROMPT = `# 文案生成任务
你是一位温暖且懂生活的文案助手，擅长撰写各种社交媒体文案。

## 要求：
1. 语言风格：温暖、治愈、有温度
2. 字数：适中，适合手机阅读
3. 可以适当使用表情符号，但不要过度
4. 内容积极向上，有感染力

请直接输出文案内容，无需任何解释。`;

const DEFAULT_WRITER_SCENES = [
  { name: '朋友圈', prompt: '帮我写一段适合发朋友圈的文案', emoji: '✨' },
  { name: 'Emo时刻', prompt: '最近心情不好，帮我写一段emo文案', emoji: '🌙' },
  { name: '表白', prompt: '帮我写一段表白文案', emoji: '💌' },
  { name: '毕业季', prompt: '帮我写一段毕业文案', emoji: '🎓' }
];

const providers = [
  { id: 'volcengine', name: '火山方舟（豆包）' },
  { id: 'aliyun', name: '阿里云百炼' },
  { id: 'zhipu', name: '智谱AI' },
  { id: 'lingyi', name: '零一万物' }
];

const allModels = {
  volcengine: [
    { id: 'doubao-seed-2-0-pro-260215', name: 'Doubao-Seed-2.0-Pro' },
    { id: 'doubao-seed-2-0-lite-260215', name: 'Doubao-Seed-2.0-Lite' },
    { id: 'doubao-seed-2-0-mini-260215', name: 'Doubao-Seed-2.0-Mini' },
    { id: 'doubao-seed-2-0-code-preview-260215', name: 'Doubao-Seed-2.0-Code-Preview' },
    { id: 'doubao-seed-1-8-251228', name: 'Doubao-Seed-1.8' },
    { id: 'doubao-seed-1-6-251015', name: 'Doubao-Seed-1.6' },
    { id: 'doubao-seed-1-6-flash-250828', name: 'Doubao-Seed-1.6-Flash' },
    { id: 'doubao-seed-1-6-thinking-250715', name: 'Doubao-Seed-1.6-Thinking' },
    { id: 'doubao-seed-1-6-vision-250815', name: 'Doubao-Seed-1.6-Vision' },
    { id: 'doubao-1-5-thinking-vision-pro-250428', name: '豆包·1.5-Think-Vision-Pro' },
    { id: 'doubao-1.5-vision-pro-250328', name: '豆包·1.5-Vision-Pro' },
    { id: 'doubao-1.5-vision-lite-250315', name: '豆包·1.5-Vision-Lite' },
    { id: 'doubao-1-5-vision-pro-32k-250115', name: '豆包·1.5-Vision-Pro-32K' }
  ],
  aliyun: [
    { id: 'qwen3.5-vl-max', name: 'Qwen3.5-VL-Max' },
    { id: 'qwen3.5-vl-plus', name: 'Qwen3.5-VL-Plus' },
    { id: 'qwen3.5-vl', name: 'Qwen3.5-VL' },
    { id: 'qwen3-vl-max', name: 'Qwen3-VL-Max' },
    { id: 'qwen3-vl-plus', name: 'Qwen3-VL-Plus' },
    { id: 'qwen-vl-max', name: 'Qwen-VL-Max' },
    { id: 'qwen-vl-plus', name: 'Qwen-VL-Plus' },
    { id: 'qwen-vl', name: 'Qwen-VL' }
  ],
  zhipu: [
    { id: 'glm-4v', name: 'GLM-4V' },
    { id: 'glm-4v-plus', name: 'GLM-4V-Plus' },
    { id: 'glm-4v-flash', name: 'GLM-4V-Flash' },
    { id: 'cogvlm-3', name: 'CogVLM-3' }
  ],
  lingyi: [
    { id: 'yi-vision', name: 'Yi-Vision' },
    { id: 'yi-vision-plus', name: 'Yi-Vision-Plus' },
    { id: 'yi-vision-turbo', name: 'Yi-Vision-Turbo' }
  ]
};

const textModels = {
  volcengine: [
    { id: 'doubao-seed-2-0-pro-260215', name: 'Doubao-Seed-2.0-Pro' },
    { id: 'doubao-seed-2-0-lite-260215', name: 'Doubao-Seed-2.0-Lite' },
    { id: 'doubao-seed-2-0-mini-260215', name: 'Doubao-Seed-2.0-Mini' },
    { id: 'doubao-seed-1-8-251228', name: 'Doubao-Seed-1.8' },
    { id: 'doubao-seed-1-6-251015', name: 'Doubao-Seed-1.6' },
    { id: 'doubao-seed-1-6-flash-250828', name: 'Doubao-Seed-1.6-Flash' }
  ],
  aliyun: [
    { id: 'qwen-turbo', name: 'Qwen-Turbo (推荐)' },
    { id: 'qwen-plus', name: 'Qwen-Plus' },
    { id: 'qwen-max', name: 'Qwen-Max' },
    { id: 'qwen3-turbo', name: 'Qwen3-Turbo' },
    { id: 'qwen3-plus', name: 'Qwen3-Plus' },
    { id: 'qwen3-max', name: 'Qwen3-Max' }
  ],
  zhipu: [
    { id: 'glm-4-flash', name: 'GLM-4-Flash' },
    { id: 'glm-4-plus', name: 'GLM-4-Plus' },
    { id: 'glm-4', name: 'GLM-4' }
  ],
  lingyi: [
    { id: 'yi-turbo', name: 'Yi-Turbo' },
    { id: 'yi-plus', name: 'Yi-Plus' },
    { id: 'yi-large', name: 'Yi-Large' }
  ]
};

const filteredModels = computed(() => {
  if (!selectedProvider.value) return [];
  return allModels[selectedProvider.value as keyof typeof allModels] || [];
});

const filteredTextModels = computed(() => {
  if (!writerSelectedProvider.value) return [];
  return textModels[writerSelectedProvider.value as keyof typeof textModels] || [];
});

const previewCategories = computed(() => {
  return categoriesStr.value.split(/[,，\n]/).map(s => s.trim()).filter(s => s);
});

const previewTags = computed(() => {
  return tagsStr.value.split(/[,，\n]/).map(s => s.trim()).filter(s => s);
});

const providerInfo = computed(() => {
  const url = config.value.API_URL || '';

  if (selectedProvider.value === 'volcengine' || url.includes('volces.com')) {
    return {
      text: '点击前往火山方舟控制台',
      url: 'https://console.volcengine.com/ark/region:ark+cn-beijing/endpoint'
    };
  }
  
  if (selectedProvider.value === 'zhipu' || url.includes('bigmodel.cn')) {
    return {
      text: '点击前往智谱 AI 控制台',
      url: 'https://bigmodel.cn/usercenter/apikeys'
    };
  }

  if (selectedProvider.value === 'lingyi' || url.includes('lingyiwanwu.com')) {
    return {
      text: '点击前往零一万物控制台',
      url: 'https://platform.lingyiwanwu.com/apikeys'
    };
  }

  if (selectedProvider.value === 'aliyun' || url.includes('dashscope.aliyuncs.com')) {
    return {
      text: '点击前往阿里云百炼控制台',
      url: 'https://bailian.console.aliyun.com/?apiKey=1'
    };
  }

  return null;
});

const getDefaultApiUrl = (provider: string) => {
  switch (provider) {
    case 'volcengine':
      return 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
    case 'aliyun':
      return 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    case 'zhipu':
      return 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
    case 'lingyi':
      return 'https://api.lingyiwanwu.com/v1/chat/completions';
    default:
      return '';
  }
};

const onProviderChange = () => {
  config.value.MODEL = '';
  config.value.API_URL = getDefaultApiUrl(selectedProvider.value);
  autoSelectKeyByProvider(getProviderName(selectedProvider.value));
};

const getProviderName = (providerId: string) => {
  const providerMap: Record<string, string> = {
    'volcengine': '火山方舟',
    'aliyun': '阿里云百炼',
    'zhipu': '智谱AI',
    'lingyi': '零一万物'
  };
  return providerMap[providerId] || '';
};

const autoSelectKeyByProvider = (provider: string) => {
  const matchingKey = apiKeys.value.find(k => k.provider === provider);
  if (matchingKey) {
    selectedKeyId.value = matchingKey._id;
    config.value.API_KEY = matchingKey.key;
  }
};

const applySelectedKey = () => {
  if (!selectedKeyId.value) return;
  const key = apiKeys.value.find(k => k._id === selectedKeyId.value);
  if (key) {
    config.value.API_KEY = key.key;
  }
};

const resetPrompt = () => {
  if (confirm('确定要恢复默认的系统提示词吗？')) {
    config.value.SYSTEM_PROMPT = `
# 图片识别与分类任务

## 任务目标
请你作为专业的图片内容分析引擎，对用户上传的图片进行自动分类并生成描述性标签。

## 核心处理流程
1. 判断图片用途类型（壁纸 or 头像）
2. 根据类型进行主分类与打标
3. 输出 JSON 格式结果
`.trim();
  }
};

const maskKey = (key: string) => {
  if (!key) return '';
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
};

const fetchData = async () => {
  loading.value = true;
  try {
    console.log('[AIConfig] 开始获取数据...');
    const [aiRes, catRes, tagRes, keysRes] = await Promise.all([
      db.collection('sys_config').doc('ai_config').get().catch(() => null),
      db.collection('sys_config').doc('categories_whitelist').get().catch(() => null),
      db.collection('sys_config').doc('tags_whitelist').get().catch(() => null),
      db.collection('api_keys').orderBy('createdAt', 'desc').get().catch((err) => {
        console.warn('[AIConfig] api_keys 集合可能不存在，这是正常的:', err);
        return { data: [] };
      })
    ]);

    console.log('[AIConfig] aiRes:', aiRes);
    console.log('[AIConfig] keysRes:', keysRes);

    if (aiRes && aiRes.data) {
      const data = (Array.isArray(aiRes.data) ? aiRes.data[0] : aiRes.data) as any;
      config.value = {
        API_KEY: data.API_KEY || '',
        MODEL: data.MODEL || '',
        API_URL: data.API_URL || '',
        SYSTEM_PROMPT: data.SYSTEM_PROMPT || config.value.SYSTEM_PROMPT
      };
      if (!config.value.SYSTEM_PROMPT) resetPrompt();
    } else {
      resetPrompt();
    }

    if (catRes && catRes.data) {
      const data = (Array.isArray(catRes.data) ? catRes.data[0] : catRes.data) as any;
      if (Array.isArray(data.categories)) {
        categoriesStr.value = data.categories.join(', ');
      }
    }

    if (tagRes && tagRes.data) {
      const data = (Array.isArray(tagRes.data) ? tagRes.data[0] : tagRes.data) as any;
      if (Array.isArray(data.tags)) {
        tagsStr.value = data.tags.join(', ');
      }
    }

    if (keysRes && keysRes.data) {
      const keysData = Array.isArray(keysRes.data) ? keysRes.data : [keysRes.data];
      console.log('[AIConfig] 原始 keys 数据:', keysData);
      apiKeys.value = keysData.filter(Boolean).map((k: any) => ({
        ...k,
        _id: k._id || k.id,
        maskedKey: maskKey(k.key)
      }));
      console.log('[AIConfig] 处理后的 keys:', apiKeys.value);
    }

    try {
      const writerDoc = await db.collection('sys_config').doc('ai_writer_config').get().catch(() => null);
      if (writerDoc && writerDoc.data) {
        const data = (Array.isArray(writerDoc.data) ? writerDoc.data[0] : writerDoc.data) as any;
        writerConfig.value.SYSTEM_PROMPT = data.SYSTEM_PROMPT || DEFAULT_WRITER_PROMPT;
        writerConfig.value.PROVIDER = data.PROVIDER || 'aliyun';
        writerConfig.value.MODEL = data.MODEL || 'qwen-turbo';
        writerConfig.value.API_URL = data.API_URL || '';
        writerConfig.value.API_KEY = data.API_KEY || '';
        writerSelectedProvider.value = writerConfig.value.PROVIDER;
        if (Array.isArray(data.scenes)) writerScenes.value = data.scenes;
        if (Array.isArray(data.featuredQuotes)) featuredQuotes.value = data.featuredQuotes;
      } else {
        writerConfig.value.SYSTEM_PROMPT = DEFAULT_WRITER_PROMPT;
        writerConfig.value.MODEL = 'qwen-turbo';
        writerScenes.value = [...DEFAULT_WRITER_SCENES];
      }
    } catch (e) {
      writerConfig.value.SYSTEM_PROMPT = DEFAULT_WRITER_PROMPT;
      writerConfig.value.MODEL = 'qwen-turbo';
      writerScenes.value = [...DEFAULT_WRITER_SCENES];
    }

  } catch (error) {
    console.error('[AIConfig] Fetch data failed', error);
  } finally {
    loading.value = false;
  }
};

const saveAIConfig = async () => {
  saving.value = true;
  message.value = '';
  try {
    await db.collection('sys_config').doc('ai_config').set({
      ...config.value,
      updatedAt: serverDate()
    });
    showMessage('保存成功！', 'success');
  } catch (error) {
    showMessage('保存失败: ' + (error as Error).message, 'error');
  } finally {
    saving.value = false;
  }
};

const saveCategories = async () => {
  saving.value = true;
  try {
    const categories = previewCategories.value;
    await db.collection('sys_config').doc('categories_whitelist').set({
      categories,
      updatedAt: serverDate()
    });
    showMessage('分类保存成功！', 'success');
  } catch (error) {
    showMessage('保存失败: ' + (error as Error).message, 'error');
  } finally {
    saving.value = false;
  }
};

const saveTags = async () => {
  saving.value = true;
  try {
    const tags = previewTags.value;
    await db.collection('sys_config').doc('tags_whitelist').set({
      tags,
      updatedAt: serverDate()
    });
    showMessage('标签保存成功！', 'success');
  } catch (error) {
    showMessage('保存失败: ' + (error as Error).message, 'error');
  } finally {
    saving.value = false;
  }
};

const copyKey = async (key: any) => {
  try {
    await navigator.clipboard.writeText(key.key);
    showMessage('已复制到剪贴板', 'success');
  } catch (error) {
    showMessage('复制失败', 'error');
  }
};

const editKey = (key: any) => {
  editingKey.value = key;
  keyForm.value = {
    name: key.name,
    provider: key.provider,
    key: key.key,
    notes: key.notes || ''
  };
  showAddKeyModal.value = true;
};

const deleteKey = async (id: string) => {
  if (!confirm('确定要删除这个 Key 吗？')) return;
  try {
    console.log('[AIConfig] 删除 Key, ID:', id);
    await db.collection('api_keys').doc(id).remove();
    apiKeys.value = apiKeys.value.filter(k => k._id !== id);
    showMessage('删除成功', 'success');
  } catch (error) {
    console.error('[AIConfig] 删除 Key 失败:', error);
    showMessage('删除失败: ' + (error as Error).message, 'error');
  }
};

const closeModal = () => {
  showAddKeyModal.value = false;
  editingKey.value = null;
  keyForm.value = {
    name: '',
    provider: '火山方舟',
    key: '',
    notes: ''
  };
};

const saveKey = async () => {
  if (!keyForm.value.name || !keyForm.value.key) {
    showMessage('请填写 Key 名称和 API Key', 'error');
    return;
  }

  saving.value = true;
  try {
    console.log('[AIConfig] 准备保存 Key:', { editingKey: editingKey.value, keyForm: keyForm.value });
    
    const keyData = {
      ...keyForm.value,
      updatedAt: serverDate()
    };

    if (editingKey.value) {
      console.log('[AIConfig] 更新 Key, ID:', editingKey.value._id);
      await db.collection('api_keys').doc(editingKey.value._id).set(keyData);
      const idx = apiKeys.value.findIndex(k => k._id === editingKey.value._id);
      if (idx !== -1) {
        apiKeys.value[idx] = { ...keyData, _id: editingKey.value._id, maskedKey: maskKey(keyForm.value.key) };
      }
    } else {
      console.log('[AIConfig] 添加新 Key');
      const res = await db.collection('api_keys').add({
        ...keyData,
        createdAt: serverDate()
      }) as any;
      console.log('[AIConfig] 添加结果:', res);
      const newId = res.id || res._id;
      console.log('[AIConfig] 新 Key ID:', newId);
      apiKeys.value.unshift({ ...keyData, _id: newId, maskedKey: maskKey(keyForm.value.key) });
    }

    showMessage(editingKey.value ? '更新成功' : '添加成功', 'success');
    closeModal();
  } catch (error) {
    console.error('[AIConfig] 保存 Key 失败:', error);
    showMessage('保存失败: ' + (error as Error).message, 'error');
  } finally {
    saving.value = false;
  }
};

const showMessage = (msg: string, type: 'success' | 'error') => {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => { message.value = '' }, 3000);
};

const resetWriterPrompt = () => {
  if (confirm('确定要恢复默认的文案系统提示词吗？')) {
    writerConfig.value.SYSTEM_PROMPT = DEFAULT_WRITER_PROMPT;
  }
};

const addScene = () => {
  writerScenes.value.push({ name: '', prompt: '', emoji: '' });
};

const removeScene = (index: number) => {
  writerScenes.value.splice(index, 1);
};

const addFeaturedQuote = () => {
  featuredQuotes.value.push({ content: '', tags: '' });
};

const removeFeaturedQuote = (index: number) => {
  featuredQuotes.value.splice(index, 1);
};

const saveWriterConfig = async () => {
  saving.value = true;
  message.value = '';
  try {
    await db.collection('sys_config').doc('ai_writer_config').set({
      SYSTEM_PROMPT: writerConfig.value.SYSTEM_PROMPT,
      PROVIDER: writerSelectedProvider.value,
      MODEL: writerConfig.value.MODEL,
      API_URL: writerConfig.value.API_URL,
      API_KEY: writerConfig.value.API_KEY,
      scenes: writerScenes.value,
      updatedAt: serverDate()
    });
    showMessage('文案配置保存成功！', 'success');
  } catch (error) {
    showMessage('保存失败: ' + (error as Error).message, 'error');
  } finally {
    saving.value = false;
  }
};

const onWriterProviderChange = () => {
  writerConfig.value.MODEL = '';
  writerConfig.value.API_URL = getDefaultApiUrl(writerSelectedProvider.value);
};

const saveFeaturedQuotes = async () => {
  saving.value = true;
  message.value = '';
  try {
    await db.collection('sys_config').doc('ai_writer_config').update({
      featuredQuotes: featuredQuotes.value,
      updatedAt: serverDate()
    });
    showMessage('文案库保存成功！', 'success');
  } catch (error) {
    showMessage('保存失败: ' + (error as Error).message, 'error');
  } finally {
    saving.value = false;
  }
};

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
