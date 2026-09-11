import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useDebounce } from '../useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('delays callback execution', () => {
    const cb = vi.fn()
    const debounced = useDebounce(cb, 300)

    debounced()
    expect(cb).not.toHaveBeenCalled()

    vi.advanceTimersByTime(300)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('resets timer on subsequent calls', () => {
    const cb = vi.fn()
    const debounced = useDebounce(cb, 300)

    debounced()
    vi.advanceTimersByTime(200)
    debounced()
    vi.advanceTimersByTime(200)
    expect(cb).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('passes arguments to callback', () => {
    const cb = vi.fn()
    const debounced = useDebounce(cb, 300)

    debounced('hello', 42)
    vi.advanceTimersByTime(300)
    expect(cb).toHaveBeenCalledWith('hello', 42)
  })
})
