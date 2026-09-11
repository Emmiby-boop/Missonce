import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock import.meta.env.DEV
beforeEach(() => {
  vi.restoreAllMocks()
})

describe('logger', () => {
  it('calls console.error for error method', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { logger } = await import('../logger')
    logger.error('test error')
    expect(spy).toHaveBeenCalledWith('test error')
  })

  it('calls console.warn for warn method', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { logger } = await import('../logger')
    logger.warn('test warning')
    expect(spy).toHaveBeenCalledWith('test warning')
  })
})
