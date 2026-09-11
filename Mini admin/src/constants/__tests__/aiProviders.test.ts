import { describe, it, expect } from 'vitest'
import { getDefaultApiUrl, getProviderName, getProviderConsoleUrl, providers, visionModels, textModels } from '../aiProviders'

describe('getDefaultApiUrl', () => {
  it('returns correct URL for each provider', () => {
    expect(getDefaultApiUrl('volcengine')).toContain('volces.com')
    expect(getDefaultApiUrl('aliyun')).toContain('dashscope')
    expect(getDefaultApiUrl('zhipu')).toContain('bigmodel.cn')
    expect(getDefaultApiUrl('lingyi')).toContain('lingyiwanwu.com')
    expect(getDefaultApiUrl('xiaomi')).toContain('xiaomimimo.com')
  })

  it('returns empty string for unknown provider', () => {
    expect(getDefaultApiUrl('unknown')).toBe('')
  })
})

describe('getProviderName', () => {
  it('returns display name for known providers', () => {
    expect(getProviderName('volcengine')).toBe('火山方舟')
    expect(getProviderName('aliyun')).toBe('阿里云百炼')
    expect(getProviderName('zhipu')).toBe('智谱AI')
    expect(getProviderName('lingyi')).toBe('零一万物')
    expect(getProviderName('xiaomi')).toBe('小米（MiMo）')
  })

  it('returns empty string for unknown provider', () => {
    expect(getProviderName('nonexistent')).toBe('')
  })
})

describe('getProviderConsoleUrl', () => {
  it('returns console URL for known provider', () => {
    const result = getProviderConsoleUrl('volcengine', '')
    expect(result).not.toBeNull()
    expect(result!.text).toContain('火山方舟')
    expect(result!.url).toContain('volcengine.com')
  })

  it('falls back to URL domain matching', () => {
    const result = getProviderConsoleUrl('unknown', 'https://dashscope.aliyuncs.com/v1/chat')
    expect(result).not.toBeNull()
    expect(result!.text).toContain('百炼')
  })

  it('returns null when no match found', () => {
    const result = getProviderConsoleUrl('unknown', 'https://some-random-api.com/v1')
    expect(result).toBeNull()
  })
})

describe('providers list', () => {
  it('contains 5 providers', () => {
    expect(providers).toHaveLength(5)
  })

  it('each provider has id and name', () => {
    providers.forEach(p => {
      expect(p.id).toBeTruthy()
      expect(p.name).toBeTruthy()
    })
  })
})

describe('visionModels', () => {
  it('has entries for all providers', () => {
    providers.forEach(p => {
      expect(visionModels[p.id]).toBeDefined()
      expect(visionModels[p.id].length).toBeGreaterThan(0)
    })
  })
})

describe('textModels', () => {
  it('has entries for all providers', () => {
    providers.forEach(p => {
      expect(textModels[p.id]).toBeDefined()
      expect(textModels[p.id].length).toBeGreaterThan(0)
    })
  })
})
