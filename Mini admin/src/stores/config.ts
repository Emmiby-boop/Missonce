/**
 * 全局配置状态管理
 * 统一封装 getConfig / manageConfig 云函数调用，提供内存缓存避免重复请求
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { callCloudFunction } from '../utils/cloudbase'
import { CACHE_EXPIRE } from '../constants'
import { logger } from '../utils/logger'

export const useConfigStore = defineStore('config', () => {
  // ─── State ──────────────────────────────────────
  /** 配置缓存：key -> { value, expireAt } */
  const cache = ref<Map<string, { value: unknown; expireAt: number }>>(new Map())
  const loading = ref(false)

  // ─── Actions ────────────────────────────────────

  /**
   * 读取配置（优先走内存缓存，过期或无缓存时走云函数）
   * @param key 配置键
   * @param ttl 缓存有效期（毫秒），默认 5 分钟
   */
  async function get<T = unknown>(key: string, ttl: number = CACHE_EXPIRE.MEDIUM): Promise<T | null> {
    // 命中缓存
    const cached = cache.value.get(key)
    if (cached && cached.expireAt > Date.now()) {
      return cached.value as T
    }

    loading.value = true
    try {
      const res = await callCloudFunction('getConfig', { key })
      const value = (res as { data?: { value?: T } })?.data?.value ?? null
      cache.value.set(key, { value, expireAt: Date.now() + ttl })
      return value
    } catch (e) {
      logger.warn(`[config store] 读取配置 ${key} 失败`, e)
      return null
    } finally {
      loading.value = false
    }
  }

  /** 写入配置并更新缓存 */
  async function set(key: string, value: unknown): Promise<boolean> {
    loading.value = true
    try {
      await callCloudFunction('manageConfig', { action: 'set', key, value })
      cache.value.set(key, { value, expireAt: Date.now() + CACHE_EXPIRE.MEDIUM })
      return true
    } catch (e) {
      logger.error(`[config store] 写入配置 ${key} 失败`, e)
      return false
    } finally {
      loading.value = false
    }
  }

  /** 使指定 key 的缓存失效（下次 get 会重新拉取） */
  function invalidate(key?: string) {
    if (key) {
      cache.value.delete(key)
    } else {
      cache.value.clear()
    }
  }

  return {
    cache,
    loading,
    get,
    set,
    invalidate,
  }
})
