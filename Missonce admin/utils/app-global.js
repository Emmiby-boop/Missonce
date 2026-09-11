/**
 * 全局状态单例 —— 替代小程序 app.globalData
 * uni-app 没有 globalData 概念，用模块级单例保存登录态/云就绪状态等。
 */

var state = {
  admin: null,
  sessionToken: null,
  cloudReady: false,
  cloudReadyPromise: null,
  statusBarHeight: 20,
  navBarHeight: 44,
  debug: false,
}

export default {
  state: state,
  setAdmin: function (a) { state.admin = a },
  getAdmin: function () { return state.admin },
  setToken: function (t) { state.sessionToken = t },
  getToken: function () { return state.sessionToken },
  setCloudReady: function (v) { state.cloudReady = v },
  setCloudReadyPromise: function (p) { state.cloudReadyPromise = p },
  setStatusBarHeight: function (h) { state.statusBarHeight = h },
  setNavBarHeight: function (h) { state.navBarHeight = h },
  setDebug: function (v) { state.debug = v },
  clearSession: function () { state.admin = null; state.sessionToken = null },
}
