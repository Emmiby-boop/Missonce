import { STORAGE_KEYS } from '../config/constants'

const storageCache = {}
const storagePending = {}
// 启动阶段标记：启动后 5 秒内禁用同步回退（wx.getStorageSync），避免阻塞渲染线程
let _isStartupPhase = true

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

const getDefaultStorageKeys = () => [
  STORAGE_KEYS.TOKEN,
  STORAGE_KEYS.USER,
  STORAGE_KEYS.OPENID,
  STORAGE_KEYS.USER_INFO,
  STORAGE_KEYS.CHECK_IN_DAYS,
  STORAGE_KEYS.LAST_CHECK_IN_DATE,
  'favorites',
  'local_read_notification_ids'
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
  _isStartupPhase = false
}, 5000)

export const initStorageCache = () => {
  preloadStorageCache(getDefaultStorageKeys())
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
  if (storageCache.hasOwnProperty(key)) {
    return storageCache[key]
  }

  readStorageAsync(key).catch(() => {})

  if (_isStartupPhase) {
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
