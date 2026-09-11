/**
 * API 统一入口 — re-export 所有领域模块
 * 实际实现分散在 ./api/ 子目录中
 */
import {
  getResources,
  getCategories,
  findResourceByUrl,
  findResourceById
} from './api/resources.js'

import {
  addFavorite,
  removeFavorite,
  checkFavorite,
  getFavorites,
  getFavoritesCount
} from './api/favorites.js'

import { getDailyPicks } from './api/home.js'

import {
  recordBrowseHistory,
  recordDownload,
  getUserDownloads
} from './api/interactions.js'

// Named exports
export {
  getResources,
  getCategories,
  findResourceByUrl,
  findResourceById,
  addFavorite,
  removeFavorite,
  checkFavorite,
  getFavorites,
  getFavoritesCount,
  getDailyPicks,
  recordBrowseHistory,
  recordDownload,
  getUserDownloads
}

// Default export for CommonJS compatibility
export default {
  getResources,
  getCategories,
  addFavorite,
  removeFavorite,
  checkFavorite,
  getFavorites,
  getFavoritesCount,
  recordDownload,
  findResourceByUrl,
  findResourceById,
  getDailyPicks
}
