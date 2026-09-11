/**
 * AI Provider / Model 配置常量
 * 消除 AIKeyManager.vue 与 AIQuotesConfig.vue 之间的重复定义
 * 支持内置厂商 + 自定义厂商（从数据库动态加载）
 */

// ─── Type definitions ───────────────────────────────────────────────

export interface ModelOption {
  id: string;
  name: string;
}

export interface Provider {
  id: string;
  name: string;
  custom?: boolean;
  baseUrl?: string;
  models?: ModelOption[];
}

export type ProviderId = string;

// ─── Built-in providers list ────────────────────────────────────────

export const BUILTIN_PROVIDERS: Provider[] = [
  { id: 'volcengine', name: '火山方舟（豆包）' },
  { id: 'aliyun', name: '阿里云百炼' },
  { id: 'zhipu', name: '智谱AI' },
  { id: 'lingyi', name: '零一万物' },
  { id: 'xiaomi', name: '小米（MiMo）' }
];

/** @deprecated 保留兼容，新代码请用 getAllProviders() 动态获取 */
export const providers = BUILTIN_PROVIDERS;

// ─── Vision models map (built-in) ───────────────────────────────────

export const visionModels: Record<string, ModelOption[]> = {
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
  ],
  xiaomi: [
    { id: 'mimo-v2.5-pro', name: 'MiMo-V2.5-Pro' },
    { id: 'mimo-v2.5', name: 'MiMo-V2.5' }
  ]
};

// ─── Text models map (built-in) ─────────────────────────────────────

export const textModels: Record<string, ModelOption[]> = {
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
  ],
  xiaomi: [
    { id: 'mimo-v2.5-pro', name: 'MiMo-V2.5-Pro' },
    { id: 'mimo-v2.5', name: 'MiMo-V2.5' }
  ]
};

// ─── Helper functions ────────────────────────────────────────────────

export const getDefaultApiUrl = (provider: string, customProviders?: CustomProvider[]): string => {
  switch (provider) {
    case 'volcengine': return 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
    case 'aliyun': return 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    case 'zhipu': return 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
    case 'lingyi': return 'https://api.lingyiwanwu.com/v1/chat/completions';
    case 'xiaomi': return 'https://api.xiaomimimo.com/v1/chat/completions';
    default: {
      if (customProviders) {
        const custom = customProviders.find(p => p.id === provider);
        if (custom) return custom.baseUrl;
      }
      return '';
    }
  }
};

export const getProviderName = (providerId: string, customProviders?: CustomProvider[]): string => {
  const builtinMap: Record<string, string> = {
    'volcengine': '火山方舟',
    'aliyun': '阿里云百炼',
    'zhipu': '智谱AI',
    'lingyi': '零一万物',
    'xiaomi': '小米（MiMo）'
  };
  if (builtinMap[providerId]) return builtinMap[providerId];
  if (customProviders) {
    const custom = customProviders.find(p => p.id === providerId);
    if (custom) return custom.name;
  }
  return '';
};

export const getProviderConsoleUrl = (providerId: string, apiUrl: string): { text: string; url: string } | null => {
  const configs: Record<string, { text: string; url: string; domain: string }> = {
    volcengine: { text: '点击前往火山方舟控制台', url: 'https://console.volcengine.com/ark/region:ark+cn-beijing/endpoint', domain: 'volces.com' },
    zhipu: { text: '点击前往智谱 AI 控制台', url: 'https://bigmodel.cn/usercenter/apikeys', domain: 'bigmodel.cn' },
    lingyi: { text: '点击前往零一万物控制台', url: 'https://platform.lingyiwanwu.com/apikeys', domain: 'lingyiwanwu.com' },
    aliyun: { text: '点击前往阿里云百炼控制台', url: 'https://bailian.console.aliyun.com/?apiKey=1', domain: 'dashscope.aliyuncs.com' },
    xiaomi: { text: '点击前往小米 MiMo 控制台', url: 'https://xiaomimimo.com', domain: 'xiaomimimo.com' }
  };

  const config = configs[providerId];
  if (!config) {
    for (const [_pid, cfg] of Object.entries(configs)) {
      if (apiUrl.includes(cfg.domain)) return { text: cfg.text, url: cfg.url };
    }
    return null;
  }
  return { text: config.text, url: config.url };
};

// ─── 自定义厂商相关类型与工具 ───────────────────────────────────────

export interface CustomProvider {
  _id?: string;
  id: string;
  name: string;
  baseUrl: string;
  models: ModelOption[];
  apiType: 'openai' | 'custom';
  notes?: string;
  createdAt?: number;
  updatedAt?: number;
}

/** 数据库集合名 */
export const CUSTOM_PROVIDERS_COLLECTION = 'ai_custom_providers';

/** sys_config 文档 ID */
export const CUSTOM_PROVIDERS_DOC_ID = 'ai_custom_providers';

/** 获取内置 + 自定义的完整厂商列表 */
export const getAllProviders = (customProviders: CustomProvider[] = []): Provider[] => {
  const builtin = BUILTIN_PROVIDERS.map(p => ({ ...p, custom: false }));
  const custom = customProviders.map(p => ({
    id: p.id,
    name: p.name + '（自定义）',
    custom: true,
    baseUrl: p.baseUrl,
    models: p.models
  }));
  return [...builtin, ...custom];
};

/** 获取某个厂商的模型列表（视觉 + 文本统一） */
export const getProviderModels = (
  providerId: string,
  type: 'vision' | 'text',
  customProviders: CustomProvider[] = []
): ModelOption[] => {
  const builtin = type === 'vision' ? visionModels[providerId] : textModels[providerId];
  if (builtin) return builtin;
  const custom = customProviders.find(p => p.id === providerId);
  return custom?.models || [];
};

/** 判断是否为内置厂商 */
export const isBuiltinProvider = (providerId: string): boolean => {
  return BUILTIN_PROVIDERS.some(p => p.id === providerId);
};

/** 生成自定义厂商 ID */
export const generateCustomProviderId = (name: string): string => {
  const ts = Date.now().toString(36);
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0).toString(36);
  return `custom_${ts}_${hash}`;
};
