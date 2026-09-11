/**
 * 通用请求封装
 * 统一 loading / error / data 状态管理
 */
import { ref, type Ref } from 'vue'

interface UseApiOptions {
  /** 失败时是否自动 toast 提示 */
  autoErrorToast?: boolean
  /** 默认值 */
  defaultData?: any
}

interface UseApiReturn<T> {
  loading: Ref<boolean>
  error: Ref<Error | null>
  data: Ref<T | null>
  /** 执行请求 */
  run: (fn: () => Promise<T>) => Promise<T | null>
  /** 重置状态 */
  reset: () => void
}

export function useApi<T = any>(options: UseApiOptions = {}): UseApiReturn<T> {
  const { autoErrorToast = true, defaultData = null } = options

  const loading = ref(false)
  const error = ref<Error | null>(null)
  const data = ref<T | null>(defaultData)

  const run = async (fn: () => Promise<T>): Promise<T | null> => {
    loading.value = true
    error.value = null
    try {
      const result = await fn()
      data.value = result
      return result
    } catch (err: any) {
      error.value = err
      if (autoErrorToast) {
        console.error('[useApi]', err)
      }
      return null
    } finally {
      loading.value = false
    }
  }

  const reset = () => {
    loading.value = false
    error.value = null
    data.value = defaultData
  }

  return { loading, error, data, run, reset }
}
