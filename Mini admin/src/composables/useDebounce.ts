/**
 * useDebounce composable
 * Returns a debounced version of the given callback.
 */
export function useDebounce<T extends (...args: any[]) => any>(
  cb: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timer !== null) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      cb(...args)
      timer = null
    }, delay)
  }
}
