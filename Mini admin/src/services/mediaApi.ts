/**
 * Media API 封装
 * 统一管理所有对 api.missonce.cc 的请求
 * 自动携带 admin token 鉴权
 */
import { useAuthStore } from '../stores/auth'

const API_BASE = 'https://api.missonce.cc'

/** 获取 admin token（从 CloudBase 登录态） */
async function getAdminToken(): Promise<string | null> {
  try {
    const authStore = useAuthStore()
    // authStore 中缓存的 sessionToken
    if (authStore.sessionToken) return authStore.sessionToken

    // 如果没有缓存，尝试刷新
    await authStore.fetchProfile()
    if (authStore.sessionToken) {
      return authStore.sessionToken
    }

    // 兜底：使用 CloudBase 自定义登录的 ticket
    const { app } = await import('../utils/cloudbase')
    const auth = app.auth({ persistence: 'local' })
    const loginState = await auth.getLoginState()
    if (loginState?.user?.uid) {
      // 用 uid 作为 fallback token（后端会校验）
      return `cb_${loginState.user.uid}`
    }
    return null
  } catch (e) {
    console.error('[mediaApi] 获取 admin token 失败:', e)
    return null
  }
}

/** 通用请求 */
async function request<T = any>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: any
    params?: Record<string, any>
  } = {}
): Promise<T> {
  const { method = 'GET', body, params } = options

  let url = `${API_BASE}${path}`
  if (params) {
    const search = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)
    ).toString()
    if (search) url += `?${search}`
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // 自动携带 admin token
  const token = await getAdminToken()
  if (token) {
    headers['X-Admin-Token'] = token
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.retdesc || data.message || `HTTP ${res.status}`)
  }

  // 后端统一返回 { retcode, retdesc, data, succ }
  if (data.retcode && data.retcode !== 200 && !data.succ) {
    throw new Error(data.retdesc || '请求失败')
  }

  return data
}

/* ============================================================
 * 解析相关 API
 * ============================================================ */

/** 解析链接 */
export function parseUrl(text: string) {
  return request<{ succ: boolean; data: any; retdesc: string }>('/api/parse', {
    method: 'POST',
    body: { text },
  })
}

/** 获取代理签名 */
export function getProxySign(url: string) {
  return request<{ retcode: number; data: { ts: number; sign: string } }>('/api/getProxySign', {
    method: 'POST',
    body: { url },
  })
}

/** 构建代理下载 URL */
export async function buildProxyUrl(url: string): Promise<string> {
  if (!url) return ''
  try {
    const res = await getProxySign(url)
    if (res.retcode === 200 && res.data) {
      return `${API_BASE}/api/proxyDownload?url=${encodeURIComponent(url)}&ts=${res.data.ts}&sign=${res.data.sign}`
    }
  } catch (e) {
    console.error('[mediaApi] getProxySign failed:', e)
  }
  return `${API_BASE}/api/proxyDownload?url=${encodeURIComponent(url)}`
}

/* ============================================================
 * 热门榜单 API
 * ============================================================ */

export function getTrending(platform?: string, page = 1, size = 20) {
  return request('/api/trending', { params: { platform, page, size } })
}

export function syncTrending(platform: string) {
  return request('/api/admin/trending/sync', { method: 'POST', body: { platform } })
}

export function saveTrending(data: any) {
  return request('/api/admin/trending/save', { method: 'POST', body: data })
}

export function batchImportTrending(items: any[]) {
  return request('/api/admin/trending/batchImport', { method: 'POST', body: { items } })
}

export function deleteTrending(id: string) {
  return request(`/api/admin/trending/${id}`, { method: 'DELETE' })
}

/* ============================================================
 * Cookie 配置 API
 * ============================================================ */

export function getCookies() {
  return request('/api/admin/cookies')
}

export function saveCookie(platform: string, cookie: string, expireAt?: string) {
  return request('/api/admin/cookies', {
    method: 'POST',
    body: { platform, cookie, expireAt },
  })
}

/* ============================================================
 * 域名白名单 API
 * ============================================================ */

export function getWhitelist() {
  return request('/api/admin/whitelist')
}

export function addProxyDomain(domain: string) {
  return request('/api/admin/whitelist/proxy', { method: 'POST', body: { domain } })
}

export function removeProxyDomain(domain: string) {
  return request('/api/admin/whitelist/proxy', { method: 'DELETE', body: { domain } })
}

export function addAudioDomain(domain: string) {
  return request('/api/admin/whitelist/audio', { method: 'POST', body: { domain } })
}

export function removeAudioDomain(domain: string) {
  return request('/api/admin/whitelist/audio', { method: 'DELETE', body: { domain } })
}

/* ============================================================
 * 平台监控 API
 * ============================================================ */

export function getPlatforms() {
  return request('/api/admin/platforms')
}

/* ============================================================
 * 运维工具 API
 * ============================================================ */

export function getScheduler() {
  return request('/api/admin/scheduler')
}

export function saveScheduler(interval: number) {
  return request('/api/admin/scheduler', { method: 'POST', body: { interval } })
}

export function getProxyConfig() {
  return request('/api/admin/proxy')
}

export function saveProxyConfig(config: any) {
  return request('/api/admin/proxy', { method: 'POST', body: config })
}

/* ============================================================
 * 页面配置 API
 * ============================================================ */

export function getPageConfig() {
  return request('/api/admin/pageConfig')
}

export function savePageConfig(config: any) {
  return request('/api/admin/pageConfig', { method: 'POST', body: config })
}

/* ============================================================
 * 公告 API
 * ============================================================ */

export function getAnnouncement() {
  return request('/api/admin/announcement')
}

export function saveAnnouncement(data: any) {
  return request('/api/admin/announcement', { method: 'POST', body: data })
}

export default {
  request,
  parseUrl,
  getProxySign,
  buildProxyUrl,
  getTrending,
  syncTrending,
  saveTrending,
  batchImportTrending,
  deleteTrending,
  getCookies,
  saveCookie,
  getWhitelist,
  addProxyDomain,
  removeProxyDomain,
  addAudioDomain,
  removeAudioDomain,
  getPlatforms,
  getScheduler,
  saveScheduler,
  getProxyConfig,
  saveProxyConfig,
  getPageConfig,
  savePageConfig,
  getAnnouncement,
  saveAnnouncement,
}
