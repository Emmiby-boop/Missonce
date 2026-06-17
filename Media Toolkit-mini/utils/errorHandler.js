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

export { getUserMessage, ERROR_MAP };