// 集合名称
export const COLLECTIONS = {
  USERS: 'users',
  RESOURCES: 'resources',
  FAVORITES: 'favorites',
  LIKES: 'likes',
  DOWNLOADS: 'downloads',
  BROWSE_HISTORY: 'browse_history',
  BANNERS: 'banners',
  POSTER_QUOTES: 'poster_quotes'
}

// 存储键名
export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER: 'user',
  USER_INFO: 'userInfo',
  OPENID: 'openid',
  CHECK_IN_DAYS: 'checkInDays',
  LAST_CHECK_IN_DATE: 'lastCheckInDate',
  HOME_DATA_CACHE: 'home_data_cache',
  WALLPAPER_LIST_CACHE: 'wallpaper_list_cache',
  AVATAR_LIST_CACHE: 'avatar_list_cache',
  WALLPAPER_SECTIONS_CACHE: 'wallpaper_sections_cache',
  AVATAR_SECTIONS_CACHE: 'avatar_sections_cache',
  TOPIC_DETAIL_CACHE: 'topic_detail_cache',
  TOPIC_LIST_CACHE: 'topic_list_cache',
  HOME_FEED_CACHE: 'home_feed_cache',
  HOME_TABS_CACHE: 'home_tabs_cache'
}

// 资源类型
export const RESOURCE_TYPE = {
  WALLPAPER: 'wallpaper',
  AVATAR: 'avatar',
  ALL: 'all'
}

// 缓存过期时间 (毫秒)
export const CACHE_EXPIRE = {
  SHORT: 60 * 1000,        // 1分钟 - 频繁变化的数据
  MEDIUM: 10 * 60 * 1000,  // 10分钟 - 一般数据
  LONG: 30 * 60 * 1000     // 30分钟 - 稳定数据（轮播图、板块配置等）
}

// 云开发环境 ID
export const ENV_ID = 'missonce-99-1gfaff6n002f6ac1'

// 微信小店 AppID（不是小程序 AppID）
// 获取方式：登录 https://store.weixin.qq.com -> 店铺管理 -> 基础信息 -> 账号信息 -> 微信小店ID
// 格式：wx... 开头的小店专属 AppID
export const STORE_APPID = 'wx509e07a8587f1906'

// 微信小店商品 ID 列表（用于 store-product 组件展示商品卡片）
// 获取方式：登录 https://store.weixin.qq.com -> 商品管理 -> 找到对应商品 -> 复制「商品ID」
// 每个商品 ID 对应一个商品卡片，会在小店页面依次展示
export const STORE_PRODUCT_IDS = [
  // '商品ID1',
  // '商品ID2',
]
