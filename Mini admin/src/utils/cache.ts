/**
 * 缓存管理工具 - 管理后台版本
 * 支持过期时间、自动清理
 */

/**
 * 缓存数据接口
 */
interface CacheData<T = any> {
  data: T
  _timestamp: number
  _expire?: number
}

/**
 * 缓存管理器
 */
export const cacheManager = {
  /**
   * 设置缓存
   */
  set<T = any>(key: string, data: T, expire?: number): void {
    const cacheData: CacheData<T> = {
      data,
      _timestamp: Date.now(),
      _expire: expire
    }
    localStorage.setItem(key, JSON.stringify(cacheData))
  },

  /**
   * 获取缓存
   */
  get<T = any>(key: string): T | null {
    const cachedStr = localStorage.getItem(key)
    if (!cachedStr) return null

    try {
      const cached: CacheData<T> = JSON.parse(cachedStr)
      
      // 检查过期
      if (cached._expire) {
        const isExpired = Date.now() - cached._timestamp > cached._expire
        if (isExpired) {
          localStorage.removeItem(key)
          return null
        }
      }
      
      return cached.data
    } catch {
      return null
    }
  },

  /**
   * 移除缓存
   */
  remove(key: string): void {
    localStorage.removeItem(key)
  },

  /**
   * 清除多个缓存
   */
  clear(keys: string[]): void {
    keys.forEach(key => localStorage.removeItem(key))
  },

  /**
   * 清除所有缓存
   */
  clearAll(): void {
    localStorage.clear()
  }
}

// 常用缓存 key 前缀
export const CACHE_PREFIX = {
  USER: 'admin_user_',
  DATA: 'admin_data_',
  CONFIG: 'admin_config_'
}

// 缓存过期时间（毫秒）
export const CACHE_EXPIRE = {
  SHORT: 60 * 1000,        // 1分钟
  MEDIUM: 5 * 60 * 1000,   // 5分钟
  LONG: 30 * 60 * 1000,    // 30分钟
  DAY: 24 * 60 * 60 * 1000 // 1天
}

export default cacheManager
