const SORT_FIELD_MAP = {
  'latest': 'createdAt',
  'createTime': 'createdAt',
  'createdAt': 'createdAt',
  'hot': 'hotScore',
  'hotScore': 'hotScore',
  'todayHot': 'dailyHotScore',
  'dailyHot': 'dailyHotScore',
  'dailyHotScore': 'dailyHotScore',
  'viewCount': 'hotScore',
  'likeCount': 'favorites',
  'favorites': 'favorites',
  'downloadCount': 'downloads',
  'downloads': 'downloads'
}

const RESOURCE_TYPE = {
  WALLPAPER: 'wallpaper',
  AVATAR: 'avatar',
  ALL: 'all'
}

const CACHE_EXPIRE = {
  SHORT: 60 * 1000,
  MEDIUM: 10 * 60 * 1000,
  LONG: 30 * 60 * 1000
}

module.exports = {
  SORT_FIELD_MAP,
  RESOURCE_TYPE,
  CACHE_EXPIRE
}
