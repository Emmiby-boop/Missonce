// 设备性能分级：识别低端机，用于降级重渲染效果（毛玻璃 blur / 装饰动画 / 长列表无限累积）
// 分级依据微信官方 benchmarkLevel（0~50+，数值越低性能越弱，-1 表示未知/无法获取）
// iOS 设备通常无 benchmarkLevel（返回 -1/undefined），默认不降级

let _lowEnd = null

export const isLowEndDevice = () => {
  if (_lowEnd !== null) return _lowEnd

  _lowEnd = false
  try {
    const info = wx.getDeviceInfo ? wx.getDeviceInfo() : wx.getSystemInfoSync()
    const level = info && info.benchmarkLevel
    if (typeof level === 'number' && level > 0 && level <= 10) {
      _lowEnd = true
    }
  } catch (e) {
    // 检测失败按中端处理，不降级
  }
  return _lowEnd
}

export default {
  isLowEndDevice
}
