import { checkLoginStatus } from '../utils/auth.js'
import { getStorage, setStorage } from '../utils/storageManager.js'
import { getFavorites as apiGetFavorites, getFavoritesCount as apiGetFavoritesCount } from './api.js'
import { cacheManager } from '../utils/cache.js'
import { STORAGE_KEYS } from '../config/constants.js'

let cachedFavorites = null
let cachedCount = null

export const favoritesService = {
  async getFavoritesCount() {
    if (!checkLoginStatus()) {
      return 0
    }

    try {
      const res = await apiGetFavoritesCount()
      cachedCount = res.total
      return res.total
    } catch (err) {
      console.error('获取收藏数量失败:', err)
      return cachedCount || 0
    }
  },

  async getFavorites(type = 'all', page = 1, pageSize = 20) {
    if (!checkLoginStatus()) {
      return { data: [], total: 0 }
    }

    try {
      const res = await apiGetFavorites(type, page, pageSize)
      if (page === 1) {
        cachedFavorites = res.data || []
      }
      return res
    } catch (err) {
      console.error('获取收藏列表失败:', err)
      return { data: cachedFavorites || [], total: cachedCount || 0 }
    }
  },

  getLocalFavorites() {
    try {
      return getStorage('favorites') || []
    } catch (e) {
      return []
    }
  },

  updateLocalFavorites(favorites) {
    try {
      setStorage('favorites', favorites)
    } catch (e) {
      console.error('更新本地收藏失败:', e)
    }
  },

  clearCache() {
    cachedFavorites = null
    cachedCount = null
  }
}

export default favoritesService