/**
 * API 统一入口 — re-export 所有领域模块
 * 实际实现分散在 ./api/ 子目录中
 */
import {
  getResources,
  getCategories,
  getTags,
  downloadFile,
  getResourceList,
  getSimilarResources,
  findResourceByUrl,
  uploadResource
} from './api/resources.js'

import {
  addFavorite,
  removeFavorite,
  checkFavorite,
  getFavorites,
  getFavoritesCount
} from './api/favorites.js'

import {
  getHomeData,
  onHomeDataRefresh,
  getPageSections,
  getBanners,
  getDailyPicks
} from './api/home.js'

import {
  toggleLike,
  checkIsLiked,
  recordBrowseHistory,
  recordDownload,
  getUserDownloads
} from './api/interactions.js'

import {
  getPersonalizedRecommendations,
  getRelatedRecommendations
} from './api/recommendations.js'

// Named exports
export {
  getResources,
  getCategories,
  getTags,
  downloadFile,
  getResourceList,
  getSimilarResources,
  findResourceByUrl,
  uploadResource,
  addFavorite,
  removeFavorite,
  checkFavorite,
  getFavorites,
  getFavoritesCount,
  getHomeData,
  onHomeDataRefresh,
  getPageSections,
  getBanners,
  getDailyPicks,
  toggleLike,
  checkIsLiked,
  recordBrowseHistory,
  recordDownload,
  getUserDownloads,
  getPersonalizedRecommendations,
  getRelatedRecommendations
}

// Default export for CommonJS compatibility
export default {
  getResources,
  getCategories,
  getTags,
  downloadFile,
  addFavorite,
  removeFavorite,
  checkFavorite,
  getFavorites,
  getFavoritesCount,
  toggleLike,
  checkIsLiked,
  getUserDownloads,
  recordDownload,
  uploadResource,
  getHomeData,
  onHomeDataRefresh,
  getPageSections,
  getResourceList,
  getBanners,
  findResourceByUrl,
  getPersonalizedRecommendations,
  getRelatedRecommendations,
  getDailyPicks
}
