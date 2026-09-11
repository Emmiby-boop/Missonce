/**
 * 日志工具（uni-app 适配版）
 * 生产环境默认只输出 error（真实异常），warn/info/debug 仅在 debug 模式开启。
 * debug 模式由 app-global.state.debug 控制（替代原 app.js 的 globalData.debug）。
 */
import appGlobal from './app-global'

function isDebug() {
  return !!appGlobal.state.debug
}

function error() {
  // 真实异常始终保留，便于生产排查
  console.error.apply(console, arguments)
}

function warn() {
  if (isDebug()) console.warn.apply(console, arguments)
}

function info() {
  if (isDebug()) console.log.apply(console, arguments)
}

function debug() {
  if (isDebug()) console.log.apply(console, arguments)
}

export { error, warn, info, debug, isDebug }

export default { error, warn, info, debug, isDebug }
