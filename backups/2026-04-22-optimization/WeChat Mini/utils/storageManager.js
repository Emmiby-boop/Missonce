/**
 * 统一的storage管理工具
 * 优化storage访问模式，减少重复获取相同key的storage信息
 */
import { STORAGE_KEYS } from '../config/constants'

const storageCache = {}

/**
 * 初始化缓存
 */
export const initStorageCache = () => {
  try {
    const keys = [STORAGE_KEYS.TOKEN, STORAGE_KEYS.USER, STORAGE_KEYS.OPENID]
    keys.forEach(key => {
      storageCache[key] = wx.getStorageSync(key)
    })
  } catch (e) {
    console.error('storage初始化失败', e)
  }
}

/**
 * 获取缓存数据（优先从内存获取）
 * @param {String} key 键名
 * @returns {Any|null} 缓存数据或null
 */
export const getStorage = (key) => {
  if (storageCache.hasOwnProperty(key)) {
    return storageCache[key]
  }
  
  try {
    const data = wx.getStorageSync(key)
    storageCache[key] = data
    return data
  } catch (e) {
    console.error(`获取缓存${key}失败`, e)
    return null
  }
}

/**
 * 设置缓存数据（同时更新内存和storage）
 * @param {String} key 键名
 * @param {Any} data 数据
 */
export const setStorage = (key, data) => {
  try {
    storageCache[key] = data
    wx.setStorageSync(key, data)
  } catch (e) {
    console.error(`设置缓存${key}失败`, e)
  }
}

/**
 * 移除缓存数据
 * @param {String} key 键名
 */
export const removeStorage = (key) => {
  try {
    delete storageCache[key]
    wx.removeStorageSync(key)
  } catch (e) {
    console.error(`移除缓存${key}失败`, e)
  }
}

/**
 * 清除所有缓存数据
 */
export const clearStorage = () => {
  try {
    Object.keys(storageCache).forEach(key => {
      delete storageCache[key]
    })
    wx.clearStorageSync()
  } catch (e) {
    console.error('清除缓存失败', e)
  }
}