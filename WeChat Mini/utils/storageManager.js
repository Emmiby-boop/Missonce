import { STORAGE_KEYS } from '../config/constants'

const storageCache = {}
const storagePending = {}
let startupSyncFallbackDisabled = true

let _windowInfo = null
let _appBaseInfo = null
let _deviceInfo = null
// 🔥 优化：缓存 wx.getSystemInfoSync() 结果，避免多次同步调用阻塞线程
let _cachedSystemInfo = null

const DEFAULT_WINDOW_INFO = {
  statusBarHeight: 20,
  screenWidth: 375,
  screenHeight: 812,
  windowWidth: 375,
  windowHeight: 812,
  pixelRatio: 2
}

const DEFAULT_APP_BASE_INFO = {
  SDKVersion: '',
  version: '',
  theme: 'light'
}

const DEFAULT_DEVICE_INFO = {
  model: '',
  system: '',
  platform: ''
}

const getDefaultStorageKeys = () => [
  STORAGE_KEYS.TOKEN,
  STORAGE_KEYS.USER,
  STORAGE_KEYS.OPENID,
  STORAGE_KEYS.USER_INFO,
  STORAGE_KEYS.CHECK_IN_DAYS,
  STORAGE_KEYS.LAST_CHECK_IN_DATE,
  'favorites',
  'local_read_notification_ids',
  'home_data_api_cache'
]

const readStorageAsync = (key) => {
  if (storageCache.hasOwnProperty(key)) {
    return Promise.resolve(storageCache[key])
  }

  if (storagePending[key]) {
    return storagePending[key]
  }

  storagePending[key] = new Promise(resolve => {
    wx.getStorage({
      key,
      success: res => {
        storageCache[key] = res.data
        resolve(res.data)
      },
      fail: () => {
        storageCache[key] = null
        resolve(null)
      },
      complete: () => {
        delete storagePending[key]
      }
    })
  })

  return storagePending[key]
}

setTimeout(() => {
  startupSyncFallbackDisabled = false
}, 5000)

// 🔥 优化：使用 wx.batchGetStorage 批量预加载（1次 API 调用 vs N次）
// 首次调用时同步创建 Promise 的开销从 7 个降到 1 个
const _batchPreloadStorage = (keys) => {
  // wx.batchGetStorage 在基础库 2.21.0 以上可用
  if (typeof wx.batchGetStorage === 'function') {
    wx.batchGetStorage({
      keyList: keys,
      success: (res) => {
        (res.dataList || []).forEach((item, i) => {
          if (item !== undefined && item !== null) {
            storageCache[keys[i]] = item
          }
        })
      },
      fail: () => {
        // 降级：逐个读取
        preloadStorageCache(keys)
      }
    })
  } else {
    preloadStorageCache(keys)
  }
}

export const initStorageCache = () => {
  _batchPreloadStorage(getDefaultStorageKeys())
  // 首页缓存同步预加载：确保页面 onLoad 时 getStorage 能立即命中
  // 避免 startupSyncFallbackDisabled 期间漏掉缓存
  try {
    const homeCache = wx.getStorageSync('home_data_api_cache')
    if (homeCache) storageCache['home_data_api_cache'] = homeCache
  } catch (e) {}
}

export const preloadStorageCache = (keys = []) => {
  keys.forEach(key => {
    readStorageAsync(key).catch(() => {})
  })
}

export const getStorageAsync = (key) => {
  return readStorageAsync(key)
}

const _getSystemInfoCached = () => {
  if (_cachedSystemInfo) return _cachedSystemInfo
  try {
    _cachedSystemInfo = wx.getSystemInfoSync()
  } catch (e) {
    _cachedSystemInfo = {}
  }
  return _cachedSystemInfo
}

export const getWindowInfo = () => {
  if (_windowInfo) return _windowInfo

  try {
    if (typeof wx.getWindowInfo === 'function') {
      _windowInfo = wx.getWindowInfo()
    } else {
      const sysInfo = _getSystemInfoCached()
      _windowInfo = {
        statusBarHeight: sysInfo.statusBarHeight,
        screenWidth: sysInfo.screenWidth,
        screenHeight: sysInfo.screenHeight,
        windowWidth: sysInfo.windowWidth,
        windowHeight: sysInfo.windowHeight,
        pixelRatio: sysInfo.pixelRatio
      }
    }
  } catch (e) {
    _windowInfo = DEFAULT_WINDOW_INFO
  }

  return _windowInfo
}

export const getAppBaseInfo = () => {
  if (_appBaseInfo) return _appBaseInfo

  try {
    if (typeof wx.getAppBaseInfo === 'function') {
      _appBaseInfo = wx.getAppBaseInfo()
    } else {
      const sysInfo = _getSystemInfoCached()
      _appBaseInfo = {
        SDKVersion: sysInfo.SDKVersion || '',
        version: sysInfo.version || '',
        theme: sysInfo.theme || 'light'
      }
    }
  } catch (e) {
    _appBaseInfo = DEFAULT_APP_BASE_INFO
  }

  return _appBaseInfo
}

export const getDeviceInfo = () => {
  if (_deviceInfo) return _deviceInfo

  try {
    if (typeof wx.getDeviceInfo === 'function') {
      _deviceInfo = wx.getDeviceInfo()
    } else {
      const sysInfo = _getSystemInfoCached()
      _deviceInfo = {
        model: sysInfo.model || '',
        system: sysInfo.system || '',
        platform: sysInfo.platform || ''
      }
    }
  } catch (e) {
    _deviceInfo = DEFAULT_DEVICE_INFO
  }

  return _deviceInfo
}

export const getTheme = () => {
  return getAppBaseInfo().theme || 'light'
}

export const getStorage = (key) => {
  if (storageCache.hasOwnProperty(key)) {
    return storageCache[key]
  }

  readStorageAsync(key).catch(() => {})

  if (startupSyncFallbackDisabled) {
    return null
  }

  try {
    const data = wx.getStorageSync(key)
    storageCache[key] = data
    return data
  } catch (e) {
    console.error(`get storage ${key} failed`, e)
    return null
  }
}

export const setStorage = (key, data) => {
  storageCache[key] = data

  try {
    wx.setStorage({
      key,
      data,
      fail: () => {
        try { wx.setStorageSync(key, data) } catch (e) {}
      }
    })
  } catch (e) {
    try {
      wx.setStorageSync(key, data)
    } catch (err) {
      console.error(`set storage ${key} failed`, err)
    }
  }
}

export const removeStorage = (key) => {
  delete storageCache[key]

  try {
    wx.removeStorage({
      key,
      fail: () => {
        try { wx.removeStorageSync(key) } catch (e) {}
      }
    })
  } catch (e) {
    try {
      wx.removeStorageSync(key)
    } catch (err) {
      console.error(`remove storage ${key} failed`, err)
    }
  }
}

export const clearStorage = () => {
  Object.keys(storageCache).forEach(key => {
    delete storageCache[key]
  })

  try {
    wx.clearStorage({
      fail: () => {
        try { wx.clearStorageSync() } catch (e) {}
      }
    })
  } catch (e) {
    try {
      wx.clearStorageSync()
    } catch (err) {
      console.error('clear storage failed', err)
    }
  }
}
