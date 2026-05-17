/**
 * 常量定义 - 管理后台
 */

// 集合名称
export const COLLECTIONS = {
  RESOURCES: 'resources',
  CATEGORIES: 'categories',
  TAGS: 'tags',
  BANNERS: 'banners',
  TOPICS: 'topics',
  ADMINS: 'admins',
  USERS: 'users',
  FAVORITES: 'favorites',
  DOWNLOADS: 'downloads',
  EVENTS: 'events',
  SYS_CONFIG: 'sys_config'
}

// 资源类型
export const RESOURCE_TYPE = {
  WALLPAPER: 'wallpaper',
  AVATAR: 'avatar',
  ALL: 'all'
}

// 资源状态
export const RESOURCE_STATUS = {
  PENDING: 0,    // 待审核
  ACTIVE: 1,     // 已发布
  REJECTED: 2,   // 已拒绝
  DELETED: 3    // 已删除
}

// 排序方式
export const SORT_TYPE = {
  LATEST: 'latest',
  HOT: 'hot',
  RANDOM: 'random'
}

// 缓存过期时间（毫秒）
export const CACHE_EXPIRE = {
  SHORT: 60 * 1000,        // 1分钟
  MEDIUM: 5 * 60 * 1000,  // 5分钟
  LONG: 30 * 60 * 1000,   // 30分钟
  DAY: 24 * 60 * 60 * 1000 // 1天
}

// 分页配置
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZES: [10, 20, 50, 100]
}

// 事件类型
export const EVENT_TYPE = {
  PAGE_VIEW: 'page_view',
  CLICK: 'click',
  DOWNLOAD: 'download',
  FAVORITE: 'favorite',
  SHARE: 'share',
  ERROR: 'error'
}

export default {
  COLLECTIONS,
  RESOURCE_TYPE,
  RESOURCE_STATUS,
  SORT_TYPE,
  CACHE_EXPIRE,
  PAGINATION,
  EVENT_TYPE
}
