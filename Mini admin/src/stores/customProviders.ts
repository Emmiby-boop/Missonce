/**
 * 自定义 AI 厂商状态管理
 * 从 sys_config/ai_custom_providers 加载，提供给前端组件动态渲染厂商下拉
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useConfigStore } from './config'
import {
  type CustomProvider,
  type Provider,
  type ModelOption,
  CUSTOM_PROVIDERS_DOC_ID,
  getAllProviders,
  getProviderModels,
  getDefaultApiUrl,
  getProviderName,
  isBuiltinProvider,
  generateCustomProviderId
} from '../constants/aiProviders'
import { logger } from '../utils/logger'

export const useCustomProvidersStore = defineStore('customProviders', () => {
  const configStore = useConfigStore()

  const customProviders = ref<CustomProvider[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  const allProviders = computed<Provider[]>(() => getAllProviders(customProviders.value))

  async function load(force = false): Promise<void> {
    if (loaded.value && !force) return
    loading.value = true
    try {
      const data = await configStore.get<CustomProvider[]>(CUSTOM_PROVIDERS_DOC_ID)
      customProviders.value = Array.isArray(data) ? data : []
      loaded.value = true
    } catch (e) {
      logger.warn('[customProviders store] 加载自定义厂商失败', e)
      customProviders.value = []
    } finally {
      loading.value = false
    }
  }

  async function save(): Promise<boolean> {
    const now = Date.now()
    const list = customProviders.value.map(p => ({
      ...p,
      updatedAt: now,
      createdAt: p.createdAt || now
    }))
    const ok = await configStore.set(CUSTOM_PROVIDERS_DOC_ID, list)
    if (ok) customProviders.value = list
    return ok
  }

  async function add(provider: Omit<CustomProvider, 'id' | 'createdAt' | 'updatedAt'>): Promise<boolean> {
    await load()
    const id = generateCustomProviderId(provider.name)
    if (customProviders.value.some(p => p.id === id || p.name === provider.name)) {
      throw new Error('厂商名称已存在')
    }
    customProviders.value.push({
      ...provider,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now()
    })
    return save()
  }

  async function update(id: string, patch: Partial<CustomProvider>): Promise<boolean> {
    await load()
    const idx = customProviders.value.findIndex(p => p.id === id)
    if (idx < 0) throw new Error('厂商不存在')
    customProviders.value[idx] = { ...customProviders.value[idx], ...patch, updatedAt: Date.now() }
    return save()
  }

  async function remove(id: string): Promise<boolean> {
    await load()
    customProviders.value = customProviders.value.filter(p => p.id !== id)
    return save()
  }

  function getProvider(id: string): Provider | undefined {
    return allProviders.value.find(p => p.id === id)
  }

  function getModels(providerId: string, type: 'vision' | 'text'): ModelOption[] {
    return getProviderModels(providerId, type, customProviders.value)
  }

  function getApiUrl(providerId: string): string {
    return getDefaultApiUrl(providerId, customProviders.value)
  }

  function getDisplayName(providerId: string): string {
    return getProviderName(providerId, customProviders.value)
  }

  function isBuiltin(id: string): boolean {
    return isBuiltinProvider(id)
  }

  return {
    customProviders,
    allProviders,
    loading,
    loaded,
    load,
    save,
    add,
    update,
    remove,
    getProvider,
    getModels,
    getApiUrl,
    getDisplayName,
    isBuiltin
  }
})
