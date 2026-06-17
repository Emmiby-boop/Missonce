// 使用统计埋点：本地存储 + 定期上报
import config from './config';
const STORAGE_KEY = '_stats_buffer';

let buffer = [];

// 加载本地缓冲
try {
  buffer = wx.getStorageSync(STORAGE_KEY) || [];
} catch (e) {
  buffer = [];
}

function track(event, data = {}) {
  const entry = {
    event,
    data,
    timestamp: Date.now(),
    platform: data.platform || '',
  };
  buffer.push(entry);

  // 缓冲超过 20 条或定时（5 分钟）上报一次
  if (buffer.length >= 20) {
    flush();
  }

  // 持久化到本地
  try {
    wx.setStorageSync(STORAGE_KEY, buffer.slice(-100));
  } catch (e) {/* ignore */}
}

function flush() {
  if (buffer.length === 0) return;

  const batch = buffer.splice(0);
  try {
    wx.setStorageSync(STORAGE_KEY, buffer);
  } catch (e) {/* ignore */}

  // 异步上报到服务端（静默，不影响主流程）
  wx.request({
    url: config.baseURL + '/api/stats',
    method: 'POST',
    data: { events: batch },
    header: { 'content-type': 'application/json' },
    timeout: 5000,
    success: () => {},
    fail: () => {
      // 上报失败，写回缓冲
      buffer = batch.concat(buffer);
      try { wx.setStorageSync(STORAGE_KEY, buffer.slice(-200)); } catch (e) {}
    }
  });
}

// 页面隐藏/卸载时上报
function onPageHide() { flush(); }

export { track, onPageHide, flush };