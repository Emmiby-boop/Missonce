/**
 * 云开发初始化与封装（双模式适配 · uni-app 版）
 *
 * 模式1 - 小程序模式: wx.cloud.Cloud 跨账号环境共享
 *   复用 WeChat Mini 的云环境 missonce-99-1gfaff6n002f6ac1
 *
 * 模式2 - 多端/App模式: @cloudbase/js-sdk 直连
 *   匿名登录 + callFunction + database
 *
 * 与原 miniprogramadmin/utils/cloud.js 一致；globalData 改为 app-global 单例，
 * wx.reLaunch 改为 uni.reLaunch，两端通用。
 */

import storage from './storage'
import appGlobal from './app-global'

// #ifdef APP-PLUS || H5
// 浏览器版云开发 SDK（@cloudbase/js-sdk）。静态导入在 App/H5 编译期内联，避免动态 import 触发 iife 分包冲突。
// 严禁用 @cloudbase/node-sdk（服务端 SDK）：其 UMD 整包在 WebView 会引用 Node 内置模块，启动即崩 → 白屏。
import cloudbaseModule from '@cloudbase/js-sdk'
// #endif

var ENV_ID = 'missonce-99-1gfaff6n002f6ac1'
var RESOURCE_APPID = 'wx78c0b02bd2db5462'
var TOKEN_KEY = 'admin_session_token'
var ADMIN_CACHE_KEY = 'admin_cache_profile'

var AUTH_FAIL_REASONS = [
  'TOKEN_EMPTY', 'TOKEN_FORMAT_INVALID', 'TOKEN_SIGNATURE_MISMATCH',
  'TOKEN_TIMESTAMP_INVALID', 'TOKEN_EXPIRED', 'TOKEN_REVOKED',
  'TOKEN_MISSING', 'ADMIN_NOT_FOUND', 'ADMIN_DISABLED',
]

var isRedirectingToLogin = false

/* ════════════════════════════════════════════
 * 环境检测
 * ══════════════════════════════════════════ */

function isWxCloudEnv() {
  return typeof wx !== 'undefined' && wx.cloud && typeof wx.cloud.Cloud === 'function'
}

function isWxEnv() {
  return typeof wx !== 'undefined' && typeof wx.getStorageSync === 'function'
}

function navigateToLogin() {
  if (isRedirectingToLogin) return
  isRedirectingToLogin = true
  if (typeof uni !== 'undefined' && uni.reLaunch) {
    uni.reLaunch({
      url: '/pages/login/login',
      complete: function () { isRedirectingToLogin = false },
    })
  } else if (typeof window !== 'undefined') {
    isRedirectingToLogin = false
    window.location.hash = '#/pages/login/login'
    window.location.reload()
  } else {
    isRedirectingToLogin = false
  }
}

function handleAuthFailure(reason, message) {
  if (isRedirectingToLogin) return
  console.warn('[cloud] 登录态失效:', reason, message)
  storage.remove(TOKEN_KEY)
  storage.remove(ADMIN_CACHE_KEY)
  appGlobal.clearSession()
  navigateToLogin()
}

/* ════════════════════════════════════════════
 * 模式1: wx.cloud 跨账号环境共享
 * ══════════════════════════════════════════ */

var cloudInstance = null
var initPromise = null
var wxCloudInited = false

/** 取当前运行的小程序 appid（用于判断是否真正跨账号） */
function getCurrentAppId() {
  try {
    var info = wx.getAccountInfoSync && wx.getAccountInfoSync()
    return (info && info.miniProgram && info.miniProgram.appId) || ''
  } catch (e) {
    return ''
  }
}

/**
 * 是否真正跨账号：调用方 appid 与资源 appid 不一致才算跨账号。
 * 取不到 appid（DevTools 测试号 / 未配置）时按同源处理，
 * 避免 wx.cloud.Cloud 跨账号 init 报 "appid missing"。
 */
function isCrossAccount() {
  var cur = getCurrentAppId()
  return !!cur && cur !== RESOURCE_APPID
}

if (isWxCloudEnv() && !isCrossAccount()) {
  try {
    wx.cloud.init({ env: ENV_ID, traceUser: true })
    wxCloudInited = true
    console.log('[cloud] wx.cloud.init() 同源模式已同步调用')
  } catch (e) {
    console.warn('[cloud] wx.cloud.init 失败:', e.message || e)
  }
}

function initWxCloud() {
  if (initPromise) return initPromise
  if (!isWxCloudEnv()) {
    return Promise.reject(new Error('wx.cloud 不可用'))
  }
  initPromise = new Promise(function (resolve, reject) {
    try {
      // 同源（调用方 appid === 资源 appid，或取不到 appid）：直接用 wx.cloud，不走跨账号 wx.cloud.Cloud
      if (!isCrossAccount()) {
        if (!wxCloudInited) {
          wx.cloud.init({ env: ENV_ID, traceUser: true })
          wxCloudInited = true
        }
        cloudInstance = wx.cloud
        appGlobal.setCloudReady(true)
        console.log('[cloud] 同源模式，直接使用 wx.cloud，env=' + ENV_ID)
        resolve(cloudInstance)
        return
      }
      // 跨账号：复用资源方云环境
      var instance = new wx.cloud.Cloud({
        resourceAppid: RESOURCE_APPID,
        resourceEnv: ENV_ID,
        traceUser: true,
      })
      instance.init().then(function () {
        cloudInstance = instance
        appGlobal.setCloudReady(true)
        console.log('[cloud] wx.cloud 跨账号初始化成功')
        resolve(cloudInstance)
      }).catch(function (err) {
        console.error('[cloud] wx.cloud.Cloud.init 失败:', err)
        reject(err)
      })
    } catch (e) {
      reject(e)
    }
  })
  return initPromise
}

/* ════════════════════════════════════════════
 * 模式2: @cloudbase/js-sdk 直连
 * ══════════════════════════════════════════ */

var tcbApp = null
var tcbInitPromise = null

/**
 * 兜底注入浏览器式全局变量（window / localStorage / URL / URLSearchParams /
 * fetch / Headers / Response / Request / AbortController / AbortSignal）。
 *
 * @cloudbase/js-sdk v3.x 在浏览器环境运行时假定上述全局存在；App(iOS/Android)
 * WebView / JSCore 可能缺失部分全局，导致 SDK 启动即崩（fetch is not a function、
 * Can't find variable: URL / AbortController 等），进而拿不到 cloudbase 登录凭证，
 * 后续 callFunction 全部被云端以 unauthenticated 拒回。
 *
 * 各 ensure* 子函数只补缺失项，不覆盖原生实现。
 */
function ensureBrowserGlobals() {
  try {
    if (typeof globalThis === 'undefined') return
    var w = (typeof window !== 'undefined' && window) || globalThis
    if (typeof window === 'undefined') {
      try { globalThis.window = globalThis } catch (e) {}
    }
    ensureLocalStorage(w)
    ensureURL()
    ensureFetch()
    ensureAbortController()
  } catch (e) {
    console.warn('[cloud] ensureBrowserGlobals 兜底失败（忽略）:', e && (e.message || e))
  }
}

/* ── localStorage 兜底 ─────────────────────────────
 * SDK 内部 CloudbaseCache 构造时读取 window.localStorage 作为缓存根对象；
 * App(iOS) 调试基座 WebView 私有/受限模式下可能为空 → 抛 "tcbCacheObject" 错误。
 */
function ensureLocalStorage(w) {
  if (w.localStorage !== undefined && w.localStorage !== null) {
    // 裸 localStorage 全局兜底
    if ((typeof localStorage === 'undefined' || localStorage === null) && w.localStorage) {
      try { globalThis.localStorage = w.localStorage } catch (e) {}
    }
    return
  }
  var mem = {}
  var ls = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null },
    setItem: function (k, v) { mem[k] = String(v) },
    removeItem: function (k) { delete mem[k] },
    clear: function () { for (var k in mem) delete mem[k] },
    key: function (i) { var ks = Object.keys(mem); return i >= 0 && i < ks.length ? ks[i] : null },
  }
  Object.defineProperty(ls, 'length', { get: function () { return Object.keys(mem).length } })
  try { Object.defineProperty(w, 'localStorage', { value: ls, configurable: true, writable: true }) }
  catch (e) { try { w.localStorage = ls } catch (e2) {} }
  // 让裸 localStorage 全局也指向同一对象（genAdapter 用裸 localStorage 取值）
  if (typeof localStorage === 'undefined' || localStorage === null) {
    try { globalThis.localStorage = w.localStorage } catch (e) {}
  }
}

/* ── URL / URLSearchParams 兜底 ────────────────────
 * SDK 认证回跳解析大量使用 new URL(...).searchParams.get(...) 与 origin/.pathname，
 * 缺失会让 signInAnonymously 直接抛 "Can't find variable: URL"。
 * 纯正则解析，不依赖 document / window，任何 JS 引擎都可用。
 */
function ensureURL() {
  if (typeof globalThis.URL !== 'undefined') return

  var parseUrlParts = function (url, base) {
    var full = url == null ? '' : String(url)
    if (base) {
      if (/^[a-z]+:\/\//i.test(full) || /^\/\//.test(full)) {
        // 绝对或协议相对，保持不变
      } else if (full.charAt(0) === '/') {
        var bm = /^([a-z]+:\/\/[^/]+)/i.exec(base)
        full = bm ? bm[1] + full : full
      } else {
        var bm2 = /^([a-z]+:\/\/[^/]+)(\/.*?\/)?/.exec(base)
        full = bm2 ? bm2[1] + (bm2[2] || '/') + full : full
      }
    }
    var m = /^([a-z]+:)?\/\/([^\/?#:]*)(?::(\d+))?([^?#]*?)(\?[^#]*)?(#.*)?$/i.exec(full)
    if (!m) { m = ['', '', '', '', '/', '', ''] }
    return {
      protocol: m[1] || 'http:',
      hostname: m[2] || '',
      port: m[3] || '',
      pathname: m[4] || '/',
      search: m[5] || '',
      hash: m[6] || '',
    }
  }
  var AnchorSearchParams = function (search) {
    this._s = (search == null ? '' : String(search))
    if (this._s.charAt(0) === '?') this._s = this._s.slice(1)
  }
  AnchorSearchParams.prototype.get = function (name) {
    var pairs = this._s.split('&')
    for (var i = 0; i < pairs.length; i++) {
      if (!pairs[i]) continue
      var kv = pairs[i].split('=')
      if (decodeURIComponent(kv[0].replace(/\+/g, ' ')) === name) {
        return decodeURIComponent((kv[1] || '').replace(/\+/g, ' '))
      }
    }
    return null
  }
  AnchorSearchParams.prototype.has = function (name) { return this.get(name) !== null }
  AnchorSearchParams.prototype.toString = function () { return this._s }
  var AnchorURL = function (url, base) {
    this._p = parseUrlParts(url, base)
    this._sp = null
  }
  AnchorURL.prototype = {
    get href() { return this._p.protocol + '//' + this._p.hostname + (this._p.port ? ':' + this._p.port : '') + this._p.pathname + this._p.search + this._p.hash },
    set href(v) { this._p = parseUrlParts(v) },
    get protocol() { return this._p.protocol },
    get host() { return this._p.hostname + (this._p.port ? ':' + this._p.port : '') },
    get hostname() { return this._p.hostname },
    get port() { return this._p.port },
    get pathname() { return this._p.pathname },
    get search() { return this._p.search },
    set search(v) { this._p.search = v },
    get hash() { return this._p.hash },
    set hash(v) { this._p.hash = v },
    get origin() { return this._p.protocol + '//' + this._p.hostname + (this._p.port ? ':' + this._p.port : '') },
    get searchParams() { if (!this._sp) this._sp = new AnchorSearchParams(this._p.search); return this._sp },
    toString: function () { return this.href },
  }
  // 下载类 API 可能用到，留空实现防止另崩
  AnchorURL.createObjectURL = function () { return '' }
  AnchorURL.revokeObjectURL = function () {}
  try { Object.defineProperty(globalThis, 'URL', { value: AnchorURL, configurable: true, writable: true }) } catch (e) {}
  if (typeof globalThis.URLSearchParams === 'undefined') {
    try { Object.defineProperty(globalThis, 'URLSearchParams', { value: AnchorSearchParams, configurable: true, writable: true }) } catch (e) {}
  }
  if (typeof window !== 'undefined' && window !== globalThis) {
    try { window.URL = globalThis.URL } catch (e) {}
    try { if (typeof window.URLSearchParams === 'undefined') window.URLSearchParams = globalThis.URLSearchParams } catch (e) {}
  }
}

/* ── fetch / Headers / Response / Request 兜底 ─────
 * SDK v3.x 的 signInAnonymously / callFunction(transport=http) / 文件上传全部走标准 fetch。
 * App WebView 无原生 fetch → "fetch is not a function" → 匿名登录失败 → 无凭证。
 * 基于 uni.request 实现完整 fetch 兼容层，并消费 AbortSignal 防止悬挂 Promise。
 */
function ensureFetch() {
  if (typeof globalThis.fetch === 'function') return
  if (typeof uni === 'undefined' || !uni.request) return

  // Headers 兼容对象：支持 .get / .has / .forEach / .entries / .keys / .values / .append / .set / .delete
  var HeadersLike = function (init) {
    this._map = {}
    if (!init) return
    if (typeof init.forEach === 'function') {
      var self1 = this
      init.forEach(function (v, k) { self1._map[String(k).toLowerCase()] = String(v) })
    } else if (typeof init.entries === 'function') {
      var iter = init.entries()
      while (true) {
        var n = iter.next()
        if (n.done) break
        this._map[String(n.value[0]).toLowerCase()] = String(n.value[1])
      }
    } else if (typeof init === 'object') {
      var self2 = this
      Object.keys(init).forEach(function (k) { self2._map[String(k).toLowerCase()] = String(init[k]) })
    }
  }
  // 修复 #1: 用 hasOwnProperty 判断，避免空字符串值被误判为 null
  HeadersLike.prototype.get = function (name) {
    var k = String(name).toLowerCase()
    return Object.prototype.hasOwnProperty.call(this._map, k) ? this._map[k] : null
  }
  HeadersLike.prototype.has = function (name) { return Object.prototype.hasOwnProperty.call(this._map, String(name).toLowerCase()) }
  HeadersLike.prototype.set = function (name, value) { this._map[String(name).toLowerCase()] = String(value) }
  HeadersLike.prototype.append = function (name, value) {
    var k = String(name).toLowerCase()
    if (this._map[k]) this._map[k] = this._map[k] + ', ' + value
    else this._map[k] = String(value)
  }
  HeadersLike.prototype.delete = function (name) { delete this._map[String(name).toLowerCase()] }
  HeadersLike.prototype.forEach = function (cb, thisArg) {
    var ctx = thisArg || this
    var self = this
    Object.keys(this._map).forEach(function (k) { cb.call(ctx, self._map[k], k, self) })
  }
  HeadersLike.prototype.entries = function () {
    var self = this
    var keys = Object.keys(self._map)
    var i = 0
    return {
      next: function () {
        if (i < keys.length) {
          var k = keys[i++]
          return { value: [k, self._map[k]], done: false }
        }
        return { value: undefined, done: true }
      }
    }
  }
  HeadersLike.prototype.keys = function () {
    var self = this
    var keys = Object.keys(self._map)
    var i = 0
    return { next: function () { return i < keys.length ? { value: keys[i++], done: false } : { value: undefined, done: true } } }
  }
  HeadersLike.prototype.values = function () {
    var self = this
    var keys = Object.keys(self._map)
    var i = 0
    return { next: function () { return i < keys.length ? { value: self._map[keys[i++]], done: false } : { value: undefined, done: true } } }
  }

  // 修复 #6: 完善常见状态码的 statusText
  var STATUS_TEXTS = {
    200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content',
    301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
    408: 'Request Timeout', 409: 'Conflict', 413: 'Payload Too Large',
    500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout',
  }

  var FetchResponse = function (opts) {
    this.status = opts.statusCode || 0
    this.ok = this.status >= 200 && this.status < 300
    this.statusText = STATUS_TEXTS[this.status] || ''
    // headers 必须是 Headers-like 对象（支持 .get），SDK 内部大量使用 response.headers.get('content-type')
    this.headers = new HeadersLike(opts.header || {})
    // 保留原始数据用于 json/text/arrayBuffer
    this._raw = opts.data
  }
  FetchResponse.prototype.json = function () {
    try {
      if (typeof this._raw === 'string') return Promise.resolve(JSON.parse(this._raw))
      if (this._raw && typeof this._raw === 'object') return Promise.resolve(this._raw)
      return Promise.resolve(JSON.parse(String(this._raw == null ? '' : this._raw)))
    } catch (e) { return Promise.reject(new SyntaxError('Unexpected token in JSON')) }
  }
  FetchResponse.prototype.text = function () {
    if (typeof this._raw === 'string') return Promise.resolve(this._raw)
    if (this._raw == null) return Promise.resolve('')
    try { return Promise.resolve(typeof this._raw === 'object' ? JSON.stringify(this._raw) : String(this._raw)) }
    catch (e) { return Promise.resolve('') }
  }
  FetchResponse.prototype.arrayBuffer = function () {
    if (this._raw instanceof ArrayBuffer) return Promise.resolve(this._raw)
    var s = typeof this._raw === 'string' ? this._raw : String(this._raw == null ? '' : this._raw)
    var buf = new ArrayBuffer(s.length)
    var view = new Uint8Array(buf)
    for (var i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xff
    return Promise.resolve(buf)
  }
  FetchResponse.prototype.blob = function () { return this.arrayBuffer() }
  FetchResponse.prototype.clone = function () { return new FetchResponse({ statusCode: this.status, header: this.headers, data: this._raw }) }

  var RequestLike = function (input, init) {
    this.url = (typeof input === 'string') ? input : (input && input.url) || ''
    this.method = (init && init.method) || (input && input.method) || 'GET'
    this.headers = new HeadersLike((init && init.headers) || (input && input.headers) || {})
    this.body = (init && init.body !== undefined) ? init.body : (input && input.body)
    this.credentials = (init && init.credentials) || 'same-origin'
    this.cache = (init && init.cache) || 'default'
    this.mode = (init && init.mode) || 'cors'
  }

  var fetchPolyfill = function (input, init) {
    init = init || {}
    var url = (typeof input === 'string') ? input : (input && input.url)
    if (!url) return Promise.reject(new TypeError('Failed to execute "fetch": 1 argument required, but only 0 present.'))
    // Request 对象优先取其 method / headers / body
    if (input && typeof input === 'object') {
      if (!init.method && input.method) init.method = input.method
      if (!init.headers && input.headers) init.headers = input.headers
      if (init.body === undefined && input.body !== undefined) init.body = input.body
    }
    var method = (init.method || 'GET').toUpperCase()
    // 修复 #8: 统一用 HeadersLike 处理 headers，避免重复展开逻辑
    var headersObj = new HeadersLike(init.headers || {})
    var headers = {}
    headersObj.forEach(function (v, k) { headers[k] = v })

    var body = init.body
    var data
    var responseType = 'text'
    var ct = (headers['Content-Type'] || headers['content-type'] || '').toLowerCase()
    if (body === undefined || body === null) {
      data = undefined
    } else if (typeof body === 'string') {
      data = body
      if (!ct) headers['Content-Type'] = 'text/plain;charset=UTF-8'
    } else if (body instanceof ArrayBuffer) {
      data = body
      responseType = 'arraybuffer'
    } else if (typeof body === 'object') {
      // JSON 序列化（覆盖 99% 的 SDK 场景）
      data = JSON.stringify(body)
      if (!ct) headers['Content-Type'] = 'application/json;charset=UTF-8'
    } else {
      data = String(body)
    }

    // 修复 #2: 消费 init.signal，SDK abort 后立即 reject，避免悬挂 Promise
    var signal = init.signal
    if (signal && signal.aborted) {
      return Promise.reject(signal.reason || new Error('Aborted'))
    }

    return new Promise(function (resolve, reject) {
      var aborted = false
      var onAbort = null
      if (signal) {
        onAbort = function () {
          if (aborted) return
          aborted = true
          reject(signal.reason || new Error('Aborted'))
        }
        signal.addEventListener('abort', onAbort)
      }

      uni.request({
        url: url,
        method: method,
        data: data,
        header: headers,
        dataType: 'json', // 让 uni.request 自动尝试 JSON 解析，失败回退为字符串
        responseType: responseType,
        timeout: init.timeout || 60000,
        success: function (res) {
          if (aborted) return  // 已被 abort，丢弃迟到响应
          if (onAbort) signal.removeEventListener('abort', onAbort)
          resolve(new FetchResponse({
            statusCode: res.statusCode,
            header: res.header,
            data: res.data,
          }))
        },
        fail: function (err) {
          if (aborted) return
          if (onAbort) signal.removeEventListener('abort', onAbort)
          var e = new Error((err && (err.errMsg || err.message)) || 'Network request failed')
          e.errMsg = err && err.errMsg
          reject(e)
        },
      })
    })
  }

  try { Object.defineProperty(globalThis, 'fetch', { value: fetchPolyfill, configurable: true, writable: true }) } catch (e) { globalThis.fetch = fetchPolyfill }
  // 把 Headers / Response / Request 暴露为全局，SDK 可能直接 new Headers() 等
  if (typeof globalThis.Headers !== 'function') {
    try { Object.defineProperty(globalThis, 'Headers', { value: HeadersLike, configurable: true, writable: true }) } catch (e) { globalThis.Headers = HeadersLike }
  }
  if (typeof globalThis.Response !== 'function') {
    try { Object.defineProperty(globalThis, 'Response', { value: FetchResponse, configurable: true, writable: true }) } catch (e) { globalThis.Response = FetchResponse }
  }
  if (typeof globalThis.Request !== 'function') {
    try { Object.defineProperty(globalThis, 'Request', { value: RequestLike, configurable: true, writable: true }) } catch (e) { globalThis.Request = RequestLike }
  }
  if (typeof window !== 'undefined' && window !== globalThis) {
    try { if (typeof window.fetch !== 'function') window.fetch = fetchPolyfill } catch (e) {}
    try { if (typeof window.Headers !== 'function') window.Headers = globalThis.Headers } catch (e) {}
    try { if (typeof window.Response !== 'function') window.Response = globalThis.Response } catch (e) {}
    try { if (typeof window.Request !== 'function') window.Request = globalThis.Request } catch (e) {}
  }
}

/* ── AbortController / AbortSignal 兜底 ────────────
 * SDK v3.x 的 fetch 请求层 new AbortController() 实现超时/取消，
 * App WebView 无原生实现 → "Can't find variable: AbortController"。
 * 最小可用实现：signal.aborted + abort 事件 + throwIfAborted + 静态方法。
 */
function ensureAbortController() {
  if (typeof globalThis.AbortController === 'function' && typeof globalThis.AbortSignal === 'function') return

  var AbortSignalShim = function () {
    this.aborted = false
    this.reason = undefined
    this._listeners = []
  }
  AbortSignalShim.prototype.addEventListener = function (type, fn) {
    if (type === 'abort' && typeof fn === 'function') this._listeners.push(fn)
  }
  AbortSignalShim.prototype.removeEventListener = function (type, fn) {
    if (type !== 'abort') return
    var i = this._listeners.indexOf(fn)
    if (i >= 0) this._listeners.splice(i, 1)
  }
  AbortSignalShim.prototype.dispatchEvent = function (ev) {
    if (ev && ev.type === 'abort') {
      this.aborted = true
      this.reason = ev.reason || new Error('Aborted')
      var listeners = this._listeners.slice()
      for (var i = 0; i < listeners.length; i++) {
        try { listeners[i](ev) } catch (e) {}
      }
    }
    return true
  }
  AbortSignalShim.prototype.throwIfAborted = function () {
    if (this.aborted) throw (this.reason || new Error('Aborted'))
  }

  var AbortControllerShim = function () {
    this.signal = new AbortSignalShim()
  }
  AbortControllerShim.prototype.abort = function (reason) {
    if (this.signal.aborted) return
    try {
      this.signal.dispatchEvent({ type: 'abort', reason: reason })
    } catch (e) {}
  }

  // AbortSignal 静态方法（SDK 可能用到）
  AbortSignalShim.abort = function (reason) {
    var s = new AbortSignalShim()
    s.aborted = true
    s.reason = reason || new Error('Aborted')
    return s
  }
  AbortSignalShim.timeout = function (ms) {
    var s = new AbortSignalShim()
    setTimeout(function () {
      try { s.dispatchEvent({ type: 'abort', reason: new Error('Timeout') }) } catch (e) {}
    }, ms)
    return s
  }

  if (typeof globalThis.AbortController !== 'function') {
    try { Object.defineProperty(globalThis, 'AbortController', { value: AbortControllerShim, configurable: true, writable: true }) } catch (e) { globalThis.AbortController = AbortControllerShim }
  }
  if (typeof globalThis.AbortSignal !== 'function') {
    try { Object.defineProperty(globalThis, 'AbortSignal', { value: AbortSignalShim, configurable: true, writable: true }) } catch (e) { globalThis.AbortSignal = AbortSignalShim }
  }
  if (typeof window !== 'undefined' && window !== globalThis) {
    try { if (typeof window.AbortController !== 'function') window.AbortController = AbortControllerShim } catch (e) {}
    try { if (typeof window.AbortSignal !== 'function') window.AbortSignal = AbortSignalShim } catch (e) {}
  }
}

// 匿名登录状态：null=未尝试，true=成功，false=失败
var anonymousAuthState = null

function initTcbCloud() {
  if (tcbInitPromise) return tcbInitPromise
  tcbInitPromise = new Promise(function (resolve, reject) {
    // 纯小程序模式下 js-sdk 不可用，直接 reject（不会走这条分支）
    // #ifndef APP-PLUS || H5
    reject(new Error('js-sdk 初始化仅在 App/H5 可用'))
    return
    // #endif
    // #ifdef APP-PLUS || H5
    ;(async function () {
      try {
        var tcb = null
        // 浏览器版 SDK 已在编译期静态导入（cloudbaseModule），直接引用，避免动态 import 触发 iife 分包冲突
        tcb = cloudbaseModule
        if (!tcb || !tcb.init) {
          tcb = (cloudbaseModule && (cloudbaseModule.default || cloudbaseModule.cloudbase)) || null
        }
        if (!tcb || !tcb.init) { reject(new Error('js-sdk 加载失败')); return }

        // App(iOS) 调试基座 WebView 下 window/localStorage 可能为空（私有/受限模式），
        // 导致 @cloudbase/js-sdk 内部存储缓存构造时 root 为 undefined → 抛 "tcbCacheObject" 错误。
        // 这里兜底注入浏览器式全局，确保 genAdapter() 能拿到可用的存储后端。
        ensureBrowserGlobals()

        var app = tcb.init({ env: ENV_ID })
        tcbApp = app
        appGlobal.setCloudReady(true)
        console.log('[cloud] @cloudbase/js-sdk 初始化成功，env=' + ENV_ID)

        // 尝试匿名登录（App 端 callFunction 依赖此步骤）
        await ensureAnonymousAuth()

        resolve(tcbApp)
      } catch (e) {
        console.error('[cloud] 加载 @cloudbase/js-sdk 失败:', e.message || e)
        reject(e)
      }
    })()
    // #endif
  })
  return tcbInitPromise
}

// 确保匿名登录完成，失败时记录详细错误
async function ensureAnonymousAuth() {
  if (!tcbApp) return false
  try {
    var auth = tcbApp.auth && tcbApp.auth()
    if (!auth || !auth.signInAnonymously) {
      console.warn('[cloud] auth.signInAnonymously 不可用，跳过匿名登录')
      anonymousAuthState = null
      return false
    }
    await auth.signInAnonymously()
    anonymousAuthState = true
    console.log('[cloud] 匿名登录成功')
    return true
  } catch (err) {
    anonymousAuthState = false
    console.error('[cloud] 匿名登录失败:', err && (err.message || err.errMsg || err))
    console.error('[cloud] 匿名登录失败详情:', JSON.stringify(err))
    // 匿名登录失败不阻断初始化，但 callFunction 可能会被云端拒绝
    // 后续 callFunction 遇到 unauthenticated 时会尝试重新匿名登录
    return false
  }
}

/* ════════════════════════════════════════════
 * 统一初始化入口
 * 多端模式下 wx.cloud 跨账号可能初始化成功但调用时 permission denied
 * 需要 fallback 到 js-sdk
 * ══════════════════════════════════════════ */

var wxCloudBroken = false
var FALLBACK_ERR_CODES = [-501023, -502003, -601002, -501001]

function isPermissionDeniedErr(err) {
  if (!err) return false
  // 检查 errCode 数字字段
  var code = err.errCode != null ? err.errCode : err.code
  if (code != null) {
    code = Number(code)
    for (var i = 0; i < FALLBACK_ERR_CODES.length; i++) {
      if (code === FALLBACK_ERR_CODES[i]) return true
    }
  }
  // 检查 message 字符串
  var msg = ((err.message || '') + ' ' + (err.errMsg || '') + ' ' + (err + '')) + ''
  for (var j = 0; j < FALLBACK_ERR_CODES.length; j++) {
    if (msg.indexOf(String(FALLBACK_ERR_CODES[j])) >= 0) return true
  }
  return false
}

// 云端未携带/未授予登录凭证：匿名登录未开启 或 Web 访问未授权时，js-sdk 的请求会被服务端以 unauthenticated 拒回
function isUnauthenticatedErr(err) {
  if (!err) return false
  var msg = ((err.error || '') + ' ' + (err.error_description || '') + ' ' + (err.message || '') + ' ' + (err + '')).toLowerCase()
  if (msg.indexOf('unauthenticated') >= 0) return true
  if (msg.indexOf('credentials not found') >= 0) return true
  return false
}

var unauthHintLogged = false
function logUnauthHint() {
  if (unauthHintLogged) return
  unauthHintLogged = true
  console.warn('[cloud] 调用被云端以「未认证」拒绝：请求未携带登录凭证。请到云开发控制台开启「匿名登录」与「Web 端访问/安全域名」，否则 App 端无法登录（loginByAccount 也拿不到凭证）。')
}

function initCloud() {
  if (isWxCloudEnv() && !wxCloudBroken) {
    return initWxCloud().catch(function (err) {
      if (isPermissionDeniedErr(err)) {
        console.warn('[cloud] wx.cloud 跨账号无权限，降级到 js-sdk')
        wxCloudBroken = true
        return initTcbCloud()
      }
      throw err
    })
  }
  return initTcbCloud()
}

var wxCloudTested = false

async function getCloud() {
  if (isWxCloudEnv() && !wxCloudBroken && cloudInstance) {
    // 首次使用 wx.cloud 时做一次探活，多端模式下跨账号可能无权限
    if (!wxCloudTested) {
      wxCloudTested = true
      try {
        await cloudInstance.callFunction({ name: 'adminAuth', data: { action: 'ping' } })
      } catch (err) {
        if (isPermissionDeniedErr(err)) {
          console.warn('[cloud] wx.cloud 探活失败(无权限)，降级到 js-sdk')
          wxCloudBroken = true
          try { await initTcbCloud() } catch (e) {}
          if (tcbApp) return tcbApp
        }
      }
    }
    return cloudInstance
  }
  if ((!isWxCloudEnv() || wxCloudBroken) && tcbApp) {
    // 确保匿名登录已完成，否则后续 callFunction 和 DB 查询都会被云端拒绝
    if (anonymousAuthState !== true) {
      await ensureAnonymousAuth()
    }
    return tcbApp
  }

  var readyPromise = appGlobal.state.cloudReadyPromise
  if (readyPromise) {
    try { await readyPromise } catch (e) {}
  }

  if (isWxCloudEnv() && !wxCloudBroken && cloudInstance) return cloudInstance
  if ((!isWxCloudEnv() || wxCloudBroken) && tcbApp) {
    if (anonymousAuthState !== true) {
      await ensureAnonymousAuth()
    }
    return tcbApp
  }

  try { await initCloud() } catch (e) { console.error('[cloud] initCloud 失败:', e.message || e) }

  if (isWxCloudEnv() && !wxCloudBroken && cloudInstance) return cloudInstance
  if ((!isWxCloudEnv() || wxCloudBroken) && tcbApp) {
    if (anonymousAuthState !== true) {
      await ensureAnonymousAuth()
    }
    return tcbApp
  }

  throw new Error('云开发初始化失败，请检查网络或重启')
}

function getCloudSync() {
  if (isWxCloudEnv() && !wxCloudBroken && cloudInstance) return cloudInstance
  if ((!isWxCloudEnv() || wxCloudBroken) && tcbApp) return tcbApp
  if (isWxCloudEnv() && !wxCloudBroken && wxCloudInited) {
    console.warn('[cloud] 使用未初始化的 wx.cloud')
    return wx.cloud
  }
  throw new Error('云开发未初始化')
}

/* ════════════════════════════════════════════
 * 数据库 / 命令 / 服务端时间
 * ══════════════════════════════════════════ */

async function db() {
  var cloud = await getCloud()
  var database = cloud.database()
  // js-sdk 兼容：database.RegExp 可能不存在，补一个快捷方法
  if (!database.RegExp && typeof cloud.RegExp === 'function') {
    database.RegExp = function (opt) { return cloud.RegExp(opt) }
  }
  return database
}

async function cmd() {
  var database = await db()
  return database.command
}

async function serverDate() {
  var database = await db()
  return database.serverDate()
}

/* ════════════════════════════════════════════
 * 云函数调用
 * ══════════════════════════════════════════ */

async function callFunction(name, data) {
  data = data || {}
  var token = storage.get(TOKEN_KEY)
  var enriched = token ? Object.assign({}, data, { adminToken: token }) : data

  try {
    var cloud = await getCloud()
    var res = await cloud.callFunction({ name: name, data: enriched })

    if (res.result === null || res.result === undefined) {
      throw new Error('云函数 ' + name + ' 不存在或调用失败')
    }
    if (res.result.success === false) {
      if (res.result.reason && AUTH_FAIL_REASONS.indexOf(res.result.reason) > -1) {
        handleAuthFailure(res.result.reason, res.result.message)
      }
      var err = new Error(res.result.message || '操作失败')
      if (res.result._debug) err.debug = res.result._debug
      throw err
    }
    return res.result
  } catch (err) {
    // 运行时降级：wx.cloud 跨账号 permission denied -> 切换 js-sdk 重试
    if (isWxCloudEnv() && !wxCloudBroken && isPermissionDeniedErr(err)) {
      console.warn('[cloud] callFunction permission denied，降级到 js-sdk 重试')
      wxCloudBroken = true
      try { await initTcbCloud() } catch (e) {}
      if (tcbApp) {
        var res2 = await tcbApp.callFunction({ name: name, data: enriched })
        if (res2.result && res2.result.success === false) {
          if (res2.result.reason && AUTH_FAIL_REASONS.indexOf(res2.result.reason) > -1) {
            handleAuthFailure(res2.result.reason, res2.result.message)
          }
          var err2 = new Error(res2.result.message || '操作失败')
          if (res2.result._debug) err2.debug = res2.result._debug
          throw err2
        }
        return res2.result
      }
    }
    // 未认证：匿名登录可能失败或过期，尝试重新匿名登录后重试一次
    if (isUnauthenticatedErr(err)) {
      console.warn('[cloud] callFunction 遇到未认证错误，尝试重新匿名登录:', err.message || err.errMsg || err)
      var reauthed = await ensureAnonymousAuth()
      if (reauthed) {
        // 重新匿名登录成功，重试 callFunction
        try {
          var res3 = await cloud.callFunction({ name: name, data: enriched })
          if (res3.result === null || res3.result === undefined) {
            throw new Error('云函数 ' + name + ' 不存在或调用失败')
          }
          if (res3.result.success === false) {
            if (res3.result.reason && AUTH_FAIL_REASONS.indexOf(res3.result.reason) > -1) {
              handleAuthFailure(res3.result.reason, res3.result.message)
            }
            var err3 = new Error(res3.result.message || '操作失败')
            if (res3.result._debug) err3.debug = res3.result._debug
            throw err3
          }
          console.log('[cloud] 重新匿名登录后 callFunction 成功:', name)
          return res3.result
        } catch (retryErr) {
          console.error('[cloud] 重新匿名登录后 callFunction 仍失败:', retryErr.message || retryErr)
          // 重新登录后仍然失败，走标准错误处理
          if (name !== 'adminAuth') {
            handleAuthFailure('UNAUTHENTICATED', '云端认证失败，请检查云开发控制台是否开启匿名登录和Web访问')
          }
          throw retryErr
        }
      } else {
        // 重新匿名登录失败
        logUnauthHint()
        if (name !== 'adminAuth') {
          handleAuthFailure('UNAUTHENTICATED', '云端未开启匿名登录/Web访问，请先在云开发控制台开启')
        }
      }
    }
    console.warn('[cloud] 调用 ' + name + ' 失败:', err.message || err.errMsg || err)
    // 标准化错误：SDK 可能返回 { errCode, errMsg } 而非 Error 实例，确保上层能读到 message
    if (err && !err.message) {
      var _errMsg = err.errMsg || err.msg || (typeof err === 'string' ? err : '')
      var _errCode = err.errCode != null ? err.errCode : err.code
      if (!_errMsg && _errCode != null) _errMsg = '操作失败（错误码 ' + _errCode + '）'
      if (!_errMsg) _errMsg = '操作失败'
      var normalizedErr = new Error(_errMsg)
      if (_errCode != null) normalizedErr.errCode = _errCode
      if (err.errMsg) normalizedErr.errMsg = err.errMsg
      if (err.result) normalizedErr.result = err.result
      throw normalizedErr
    }
    throw err
  }
}

async function callFunctionRaw(name, data) {
  data = data || {}
  var token = storage.get(TOKEN_KEY)
  var enriched = token ? Object.assign({}, data, { adminToken: token }) : data
  var res

  try {
    var cloud = await getCloud()
    res = await cloud.callFunction({ name: name, data: enriched })
  } catch (err) {
    if (isWxCloudEnv() && !wxCloudBroken && isPermissionDeniedErr(err)) {
      console.warn('[cloud] callFunctionRaw permission denied，降级到 js-sdk 重试')
      wxCloudBroken = true
      try { await initTcbCloud() } catch (e) {}
      if (tcbApp) {
        res = await tcbApp.callFunction({ name: name, data: enriched })
      } else {
        throw err
      }
    } else {
      throw err
    }
  }

  if (res.result && res.result.success === false) {
    if (res.result.reason && AUTH_FAIL_REASONS.indexOf(res.result.reason) > -1) {
      handleAuthFailure(res.result.reason, res.result.message)
    }
  }
  return res
}

/* ════════════════════════════════════════════
 * 会话管理（globalData → app-global 单例）
 * ══════════════════════════════════════════ */

function restoreSession() {
  var token = storage.get(TOKEN_KEY)
  if (!token) return null

  if (!appGlobal.state.admin) {
    var cached = storage.get(ADMIN_CACHE_KEY)
    if (cached) appGlobal.setAdmin(cached)
  }
  appGlobal.setToken(token)
  return appGlobal.state.admin
}

async function checkAuth() {
  var token = storage.get(TOKEN_KEY)
  if (!token) return null

  try {
    var res = await callFunction('adminAuth', { action: 'verifyToken', token: token })
    if (res.success && res.data && res.data.admin) {
      appGlobal.setAdmin(res.data.admin)
      appGlobal.setToken(token)
      storage.set(ADMIN_CACHE_KEY, res.data.admin)
      return res.data.admin
    }
    storage.remove(TOKEN_KEY)
    storage.remove(ADMIN_CACHE_KEY)
    return null
  } catch (err) {
    console.warn('[cloud] Token 校验网络异常，保留现有登录态:', err.message || err)
    if (appGlobal.state.admin) return appGlobal.state.admin
    var cached = storage.get(ADMIN_CACHE_KEY)
    if (cached) appGlobal.setAdmin(cached)
    return cached || null
  }
}

function saveSession(res) {
  storage.set(TOKEN_KEY, res.token)
  storage.set(ADMIN_CACHE_KEY, res.admin)
  appGlobal.setAdmin(res.admin)
  appGlobal.setToken(res.token)
}

async function loginByAccount(username, password) {
  var res = await callFunction('adminAuth', { action: 'loginByAccount', username: username, password: password })
  if (res.success && res.token) { saveSession(res); return res }
  throw new Error(res.message || '登录失败')
}

async function sendPhoneCode(phone) {
  return await callFunction('adminAuth', { action: 'sendPhoneCode', phone: phone })
}

async function loginByPhone(phone, code) {
  var res = await callFunction('adminAuth', { action: 'loginByPhone', phone: phone, code: code })
  if (res.success && res.token) { saveSession(res); return res }
  throw new Error(res.message || '手机号登录失败')
}

async function loginByWechatPhone(wechatCode) {
  var res = await callFunction('adminAuth', { action: 'loginByWechatPhone', wechatCode: wechatCode })
  if (res.success && res.token) { saveSession(res); return res }
  throw new Error(res.message || '微信一键登录失败')
}

async function logout() {
  var token = storage.get(TOKEN_KEY)
  if (token) {
    try { await callFunctionRaw('adminAuth', { action: 'logout', token: token }) }
    catch (e) { console.warn('[cloud] 服务端登出失败（忽略）:', e.message) }
  }
  storage.remove(TOKEN_KEY)
  storage.remove(ADMIN_CACHE_KEY)
  appGlobal.clearSession()
}

function getAdmin() {
  return appGlobal.state.admin
}

function getToken() {
  return storage.get(TOKEN_KEY)
}

/* ════════════════════════════════════════════
 * 文件存储
 * ══════════════════════════════════════════ */

async function uploadFile(cloudPath, filePath) {
  var cloud = await getCloud()
  var res = await cloud.uploadFile({ cloudPath: cloudPath, filePath: filePath })
  return res.fileID
}

async function getTempFileURL(fileID) {
  if (!fileID) return ''
  if (fileID.indexOf('http') === 0) return fileID
  var cloud = await getCloud()
  var res = await cloud.getTempFileURL({ fileList: [fileID] })
  return (res.fileList[0] && res.fileList[0].tempFileURL) || ''
}

async function getTempFileURLs(fileIDs) {
  if (!fileIDs || fileIDs.length === 0) return []
  var cloud = await getCloud()
  var cloudIDs = fileIDs.filter(function (id) { return id && id.indexOf('http') !== 0 })
  var httpIDs = fileIDs.filter(function (id) { return id && id.indexOf('http') === 0 })
  if (cloudIDs.length === 0) return httpIDs

  var res = await cloud.getTempFileURL({ fileList: cloudIDs })
  var urlMap = {}
  res.fileList.forEach(function (item) { urlMap[item.fileID] = item.tempFileURL })
  return fileIDs.map(function (id) { return urlMap[id] || id })
}

/* ════════════════════════════════════════════
 * 邮箱登录
 * ══════════════════════════════════════════ */

async function sendEmailCode(email) {
  return await callFunction('adminAuth', { action: 'sendEmailCode', email: email })
}

async function loginByEmail(email, code) {
  var res = await callFunction('adminAuth', { action: 'loginByEmail', email: email, code: code })
  if (res.success && res.token) { saveSession(res); return res }
  var err = new Error(res.message || '邮箱登录失败')
  if (res._debug) err.debug = res._debug
  throw err
}

/* ════════════════════════════════════════════
 * 导出
 * ══════════════════════════════════════════ */

export {
  ENV_ID,
  RESOURCE_APPID,
  TOKEN_KEY,
  initCloud,
  getCloud,
  getCloudSync,
  db,
  cmd,
  serverDate,
  callFunction,
  callFunctionRaw,
  ensureAnonymousAuth,
  restoreSession,
  checkAuth,
  loginByAccount,
  sendPhoneCode,
  loginByPhone,
  loginByWechatPhone,
  sendEmailCode,
  loginByEmail,
  logout,
  getAdmin,
  getToken,
  uploadFile,
  getTempFileURL,
  getTempFileURLs,
  isWxCloudEnv,
}

export default {
  ENV_ID,
  RESOURCE_APPID,
  TOKEN_KEY,
  initCloud,
  getCloud,
  getCloudSync,
  db,
  cmd,
  serverDate,
  callFunction,
  callFunctionRaw,
  ensureAnonymousAuth,
  restoreSession,
  checkAuth,
  loginByAccount,
  sendPhoneCode,
  loginByPhone,
  loginByWechatPhone,
  sendEmailCode,
  loginByEmail,
  logout,
  getAdmin,
  getToken,
  uploadFile,
  getTempFileURL,
  getTempFileURLs,
  isWxCloudEnv,
}
