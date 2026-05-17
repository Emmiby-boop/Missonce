/**
 * 缓存管理工具
 */
export const cacheManager = {
  /**
   * 设置缓存
   * @param {String} key 键名
   * @param {Any} data 数据
   * @param {Number} expire 过期时间(毫秒)
   */
  set(key, data, expire) {
    const cacheData = {
      data,
      _timestamp: Date.now(),
      _expire: expire
    }
    wx.setStorageSync(key, cacheData)
  },

  /**
   * 获取缓存
   * @param {String} key 键名
   * @returns {Any|null} 缓存数据或null
   */
  get(key) {
    const cached = wx.getStorageSync(key)
    if (!cached) return null

    // 如果设置了过期时间，检查是否过期
    if (cached._expire) {
      const isExpired = Date.now() - cached._timestamp > cached._expire
      if (isExpired) {
        wx.removeStorageSync(key)
        return null
      }
    }
    
    return cached.data
  },

  /**
   * 移除缓存
   * @param {String} key 键名
   */
  remove(key) {
    wx.removeStorageSync(key)
  },

  /**
   * 清除指定前缀的缓存或所有相关缓存
   * @param {Array} keys 要清除的键名列表
   */
  clear(keys = []) {
    keys.forEach(key => wx.removeStorageSync(key))
  }
}

export default cacheManager
