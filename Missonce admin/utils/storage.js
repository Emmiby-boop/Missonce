/**
 * 存储抽象层
 * 优先级: uni.* > wx.* > localStorage
 * 说明: App 端必须用 uni.* 才能与 uni.request 等共用同一存储作用域
 */

function isUniEnv() {
  return typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function'
}

function isWxEnv() {
  return typeof wx !== 'undefined' && typeof wx.getStorageSync === 'function'
}

function getStorage(key) {
  // 优先 uni（App 端）
  if (isUniEnv()) {
    try { return uni.getStorageSync(key) } catch (e) { return '' }
  }
  // 兼容小程序
  if (isWxEnv()) {
    return wx.getStorageSync(key)
  }
  // Web 兜底
  if (typeof localStorage !== 'undefined') {
    var v = localStorage.getItem(key)
    if (v === null) return ''
    try { return JSON.parse(v) } catch (e) { return v }
  }
  return ''
}

function setStorage(key, value) {
  if (isUniEnv()) {
    try { uni.setStorageSync(key, value) } catch (e) {}
    return
  }
  if (isWxEnv()) {
    wx.setStorageSync(key, value)
    return
  }
  if (typeof localStorage !== 'undefined') {
    if (typeof value === 'string') {
      localStorage.setItem(key, value)
    } else {
      localStorage.setItem(key, JSON.stringify(value))
    }
  }
}

function removeStorage(key) {
  if (isUniEnv()) {
    try { uni.removeStorageSync(key) } catch (e) {}
    return
  }
  if (isWxEnv()) {
    wx.removeStorageSync(key)
    return
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(key)
  }
}

export default {
  get: getStorage,
  set: setStorage,
  remove: removeStorage,
  isUniEnv: isUniEnv,
  isWxEnv: isWxEnv,
}
