/**
 * 轻量缓存工具 - SWR (Stale-While-Revalidate) 策略（uni-app 适配版）
 *
 * 设计目标：避免列表页每次进入都重新加载，提升切换流畅度。
 * 与原 miniprogramadmin/utils/cache.js 一致，仅将 wx.* 存储 API 替换为 uni.*。
 */

import storage from './storage'

var DEFAULT_TTL = 10 * 60 * 1000

var memoryCache = new Map()

function getCached(key, ttl) {
  ttl = ttl || DEFAULT_TTL
  var mem = memoryCache.get(key)
  if (mem && Date.now() - mem.ts < ttl) return mem.data
  try {
    var stored = storage.get(key)
    if (stored && stored.ts && Date.now() - stored.ts < ttl) {
      memoryCache.set(key, stored)
      return stored.data
    }
  } catch (e) {}
  return null
}

function getCachedStale(key) {
  var mem = memoryCache.get(key)
  if (mem) return mem.data
  try {
    var stored = storage.get(key)
    if (stored && stored.data !== undefined) {
      memoryCache.set(key, stored)
      return stored.data
    }
  } catch (e) {}
  return null
}

function isStale(key, ttl) {
  ttl = ttl || DEFAULT_TTL
  var mem = memoryCache.get(key)
  var ts = mem ? mem.ts : 0
  if (!ts) {
    try { var s = storage.get(key); ts = (s && s.ts) || 0 } catch (e) { ts = 0 }
  }
  return !ts || Date.now() - ts >= ttl
}

function setCached(key, data) {
  var entry = { data: data, ts: Date.now() }
  memoryCache.set(key, entry)
  try {
    storage.set(key, entry)
  } catch (e) {
    console.warn('[cache] 写入失败', key, e && e.message)
  }
}

function clearCached(key) {
  memoryCache.delete(key)
  try { storage.remove(key) } catch (e) {}
}

function clearByPrefix(prefix) {
  memoryCache.forEach(function (_, k) {
    if (k.indexOf(prefix) === 0) memoryCache.delete(k)
  })
  if (typeof uni !== 'undefined' && uni.getStorageInfoSync) {
    try {
      var info = uni.getStorageInfoSync()
      ;(info.keys || []).forEach(function (k) {
        if (k.indexOf(prefix) === 0) uni.removeStorageSync(k)
      })
    } catch (e) {}
  } else if (typeof localStorage !== 'undefined') {
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i)
        if (k && k.indexOf(prefix) === 0) localStorage.removeItem(k)
      }
    } catch (e) {}
  }
}

export default {
  DEFAULT_TTL: DEFAULT_TTL,
  getCached: getCached,
  getCachedStale: getCachedStale,
  isStale: isStale,
  setCached: setCached,
  clearCached: clearCached,
  clearByPrefix: clearByPrefix,
}
