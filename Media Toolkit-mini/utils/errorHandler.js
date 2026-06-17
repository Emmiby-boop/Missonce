// 错误码映射：服务端返回的 retcode → 用户可读提示
const ERROR_MAP = {
  500:  '服务器繁忙，请稍后重试',
  429:  '请求太频繁了，休息一下再来吧',
  1001: '请输入正确的分享链接',
  1002: '该平台暂不支持，我们会尽快适配',
  1003: '链接已失效，请复制最新链接',
  1004: '链接中没有找到视频内容',
  2001: '解析失败，请确认链接是否正确',
  2002: '正在努力解析中...',
  2003: '解析超时，请稍后再试',
  2004: '未能获取视频信息，请检查链接',
  3001: '暂不支持下载该视频',
  3002: '下载验证失败，请重试',
  3003: '该平台视频需要登录后才能下载',
  4001: '需要登录平台账号才能获取',
  4002: '平台接口维护中，请稍后',
  4003: '检测到平台限制，请稍后再试',
};

// 获取用户可读的错误信息
function getUserMessage(response) {
  const code = response?.retcode;
  if (code && ERROR_MAP[code]) return ERROR_MAP[code];
  if (response?.retdesc) return response.retdesc;
  return '网络异常，请检查网络后重试';
}

/**
 * 统一错误提示
 * @param {Error|string|object} err - 错误对象 / 字符串 / API 响应
 * @param {string} fallback - 默认提示（如果没有可读信息）
 */
function toastError(err, fallback) {
  let msg = fallback || '操作失败，请重试';

  if (typeof err === 'string') {
    msg = err;
  } else if (err?.retcode) {
    msg = getUserMessage(err);
  } else if (err?.errMsg) {
    msg = err.errMsg;
  } else if (err?.message) {
    // 过滤技术性错误信息
    if (err.message.includes('timeout') || err.message.includes('超时')) {
      msg = '请求超时，请检查网络';
    } else if (err.message.includes('fail') && !err.message.includes('abort')) {
      msg = '网络连接失败，请重试';
    } else if (err.message.includes('abort')) {
      return; // 用户主动取消，不提示
    } else {
      msg = err.message.length > 30 ? fallback || '操作失败' : err.message;
    }
  }

  wx.showToast({ title: msg, icon: 'none', duration: 2000 });
}

/**
 * 包装异步请求，自动处理 loading 状态和错误提示
 * @param {Object} opts
 * @param {string} opts.loadingTitle - loading 提示文字，不传则不显示
 * @param {string} opts.errorFallback - 错误兜底提示
 * @param {Function} opts.fn - 异步函数，返回 API 响应 { retcode, retdesc, data }
 * @returns {Promise<object|null>} 成功返回 data，失败 toast 后返回 null
 */
async function safeRequest(opts) {
  const { loadingTitle, errorFallback, fn } = opts;
  if (loadingTitle) wx.showLoading({ title: loadingTitle, mask: true });

  try {
    const res = await fn();
    wx.hideLoading();
    if (res?.retcode === 200) return res.data ?? res;
    toastError(res, errorFallback);
    return null;
  } catch (err) {
    wx.hideLoading();
    toastError(err, errorFallback);
    return null;
  }
}

export { getUserMessage, toastError, safeRequest, ERROR_MAP };