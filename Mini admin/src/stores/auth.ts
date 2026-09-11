/**
 * 认证状态管理
 * 替代各页面直接操作 localStorage 和调用 fetchAdminProfile 的散乱模式
 *
 * 安全加固：
 * - localStorage 仅存储服务端签发的 sessionToken，admin profile 不落盘
 * - admin profile 通过 fetchAdminProfile() 从服务端实时获取，仅存内存
 * - Token 校验失败时必须清除登录态，不允许降级使用本地缓存
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loginByAccount, logout as cloudbaseLogout, fetchAdminProfile } from '../utils/cloudbase'
import type { AdminUser } from '../types'

const TOKEN_STORAGE_KEY = 'admin_session_token'

export const useAuthStore = defineStore('auth', () => {
  // ─── State ──────────────────────────────────────
  // admin profile 仅存内存，不从 localStorage 读取（安全加固）
  const admin = ref<AdminUser | null>(null)
  const sessionToken = ref<string | null>(localStorage.getItem(TOKEN_STORAGE_KEY))
  const loading = ref(false)

  // ─── Computed ───────────────────────────────────
  const isAuthenticated = computed(() => !!admin.value)
  const username = computed(() => admin.value?.username || '')
  const role = computed(() => admin.value?.role || '')

  // ─── Helpers ────────────────────────────────────
  function persistToken(token: string | null) {
    try {
      if (token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token)
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY)
      }
    } catch (e) {
      console.warn('[auth store] localStorage 写入失败', e)
    }
  }

  // ─── Actions ────────────────────────────────────

  /** 账号密码登录 */
  async function login(account: string, password: string): Promise<{ success: boolean; message?: string }> {
    loading.value = true
    try {
      const res = await loginByAccount(account, password)
      if (res.success && res.admin) {
        // admin profile 仅存内存，token 持久化到 localStorage
        admin.value = res.admin as AdminUser
        sessionToken.value = res.token || null
        persistToken(res.token || null)
        return { success: true }
      }
      return { success: false, message: res.message || '登录失败' }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '登录失败'
      return { success: false, message: msg }
    } finally {
      loading.value = false
    }
  }

  /** 退出登录 */
  async function logout(): Promise<void> {
    try {
      await cloudbaseLogout()
    } catch (e) {
      console.warn('[auth store] cloudbase logout 失败', e)
    } finally {
      admin.value = null
      sessionToken.value = null
      persistToken(null)
    }
  }

  /** 从服务端拉取最新管理员信息（路由守卫/页面初始化时调用） */
  async function fetchProfile(): Promise<AdminUser | null> {
    const profile = await fetchAdminProfile()
    if (profile) {
      // admin profile 仅存内存，不落盘 localStorage
      admin.value = profile as AdminUser
    } else {
      // Token 校验失败或无 Token，清除登录态
      admin.value = null
      sessionToken.value = null
      persistToken(null)
    }
    return profile as AdminUser | null
  }

  /** 清除本地状态（token 失效时） */
  function clear() {
    admin.value = null
    sessionToken.value = null
    persistToken(null)
  }

  return {
    admin,
    sessionToken,
    loading,
    isAuthenticated,
    username,
    role,
    login,
    logout,
    fetchProfile,
    clear,
  }
})
