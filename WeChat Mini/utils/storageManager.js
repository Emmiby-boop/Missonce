import { STORAGE_KEYS } from '../config/constants'

const storageCache = {}
const storagePending = {}

let _windowInfo = null
let _appBaseInfo = null
let _deviceInfo = null

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

const getCriticalStorageKeys = () => [
  STORAGE_KEYS.TOKEN,
  STORAGE_KEYS.USER_INFO,
  STORAGE_KEYS.OPENID
]

const getDeferredStorageKeys = () => [
  STORAGE_KEYS.USER,
  STORAGE_KEYS.CHECK_IN_DAYS,
  STORAGE_KEYS.LAST_CHECK_IN_DATE,
  'favorites',
  'local_read_notification_ids'
]

const getDefaultStorageKeys = () => [
  ...getCriticalStorageKeys(),
  ...getDeferredStorageKeys()
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

export const initStorageCache = () => {
  // 🔥 异步预热关键 key（不阻塞主线程）
  preloadStorageCache(getCriticalStorageKeys())
  // 🔥 非关键 key 延迟加载
  setTimeout(() => {
    preloadStorageCache(getDeferredStorageKeys())
  }, 1000)
}

export const preloadStorageCache = (keys = []) => {
  keys.forEach(key => {
    readStorageAsync(key).catch(() => {})
  })
}

export const getStorageAsync = (key) => {
  return readStorageAsync(key)
}

export const getWindowInfo = () => {
  if (_windowInfo) return _windowInfo

  try {
    if (typeof wx.getWindowInfo === 'function') {
      _windowInfo = wx.getWindowInfo()
    } else {
      const sysInfo = wx.getSystemInfoSync()
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
      const sysInfo = wx.getSystemInfoSync()
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
      const sysInfo = wx.getSystemInfoSync()
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
  // 内存缓存命中 → 直接返回（O(1)）
  if (storageCache.hasOwnProperty(key)) {
    return storageCache[key]
  }

  // 缓存未命中 → 触发异步读取并缓存，返回 null
  // 下次调用时缓存已就绪，即可命中
  readStorageAsync(key).catch(() => {})
  return null
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
