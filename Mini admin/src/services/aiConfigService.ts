/**
 * AI 配置读写服务
 *
 * ⚠️ 为什么必须走云函数而不是前端直连数据库：
 * sys_config / api_keys / poster_quotes 这三个集合的文档由管理端创建、没有 _openid，
 * 而数据库安全规则是「仅创建者可读写」。前端 Web SDK 直连时：
 *   - doc().set()    → 服务端按 upsert-insert 处理，报 E11000 duplicate key（文档已存在）
 *   - doc().update() → 规则过滤后匹配 0 条，返回 { updated: 0 }，**且不抛异常**
 *   两者都表现为「界面提示保存成功，实际没写入」。
 * 云函数是管理端权限，不受安全规则限制，因此统一收口到 manageAiConfig。
 *
 * 附带好处：API Key 等敏感配置不再依赖「前端可读」的宽松权限。
 */
import { callCloudFunction } from '../utils/cloudbase'

type AnyRecord = Record<string, unknown>

interface ServiceResult<T> {
  success?: boolean
  data?: T
  message?: string
}

function call<T = unknown>(action: string, data: AnyRecord = {}): Promise<ServiceResult<T>> {
  return callCloudFunction('manageAiConfig', { action, data }) as Promise<ServiceResult<T>>
}

/** sys_config 文档类型 */
export type SysConfigDoc = AnyRecord | null

export const aiConfigService = {
  /** 读取单个配置文档，不存在返回 null */
  async getConfig(docId: string): Promise<SysConfigDoc> {
    const res = await call<SysConfigDoc>('getConfig', { docId })
    return res?.data ?? null
  },

  /** 批量读取配置文档：{ docId: doc | null } */
  async getConfigs(docIds: string[]): Promise<Record<string, SysConfigDoc>> {
    const res = await call<Record<string, SysConfigDoc>>('getConfigs', { docIds })
    return res?.data ?? {}
  },

  /** 新增或更新配置文档 */
  setConfig(docId: string, doc: AnyRecord): Promise<ServiceResult<{ upserted: boolean; created: boolean }>> {
    return call('setConfig', { docId, doc })
  },

  // ---------- API Keys ----------
  async listApiKeys(): Promise<AnyRecord[]> {
    const res = await call<AnyRecord[]>('listApiKeys')
    return res?.data ?? []
  },

  saveApiKey(doc: AnyRecord, id?: string): Promise<ServiceResult<{ id?: string }>> {
    return call('saveApiKey', { id: id || '', doc })
  },

  deleteApiKey(id: string): Promise<ServiceResult<unknown>> {
    return call('deleteApiKey', { id })
  },

  // ---------- 海报语录 ----------
  async listPosterQuotes(): Promise<AnyRecord[]> {
    const res = await call<AnyRecord[]>('listPosterQuotes')
    return res?.data ?? []
  },

  async countPosterQuotes(): Promise<number> {
    const res = await call<{ total: number }>('countPosterQuotes')
    return res?.data?.total ?? 0
  },

  savePosterQuote(text: string, id?: string): Promise<ServiceResult<{ id?: string }>> {
    return call('savePosterQuote', { id: id || '', text })
  },

  /** 批量保存 AI 生成的语录 */
  addPosterQuotes(texts: string[]): Promise<ServiceResult<{ added: number }>> {
    return call('addPosterQuotes', { texts })
  },

  deletePosterQuote(id: string): Promise<ServiceResult<unknown>> {
    return call('deletePosterQuote', { id })
  },
}

export default aiConfigService
