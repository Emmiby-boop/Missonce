/**
 * 域名白名单工具
 * 统一管理代理下载和音频提取的域名白名单
 */

// 代理下载允许的域名白名单
const PROXY_ALLOWED_DOMAINS = new Set([
  'douyincdn.com', 'douyinvod.com', 'douyin.com', 'ixigua.com', 'snssdk.com', 'byteimg.com',
  'bilivideo.com', 'biliapi.com', 'bilibili.com', 'upos-sz-static.bilivideo.com',
  'kuaishou.com', 'yximgs.com', 'kwimgs.com',
  'xhscdn.com', 'xiaohongshu.com', 'sns-img-bd.xhscdn.com', 'sns-webpic-qc.xhscdn.com',
  'hwaxgscdn.com',
  'qq.com', 'vd.l.qq.com', 'v.sycdn.kuwo.cn', 'ippzone.com', 'pipix.com',
  'pearvideo.com', 'acgvideo.com',
  'instagram.com', 'fbcdn.net',
  'tiktokcdn.com', 'tiktok.com', 'tiktokv.com',
  'twitter.com', 'twimg.com', 'pbs.twimg.com',
  'youtube.com', 'ytimg.com', 'googlevideo.com',
  'weibo.com', 'sinaimg.cn', 'video.weibo.com',
  'huya.com',
  'meipai.com', 'xhscdn.net', 'bdstatic.com',
]);

// 音频提取允许的域名白名单
const AUDIO_ALLOWED_DOMAINS = new Set([
  'bilivideo.com', 'biliapi.com', 'bilibili.com',
  'upos-sz-static.bilivideo.com', 'upos-sz-mirrorbilivideo.com',
]);

/**
 * 检查 URL 是否在指定域名白名单内
 * @param {string} urlStr - 要检查的 URL
 * @param {Set<string>} allowedDomains - 允许的域名集合
 * @returns {boolean}
 */
function isAllowedDomain(urlStr, allowedDomains) {
  try {
    const hostname = new URL(urlStr).hostname;
    const parts = hostname.split('.');
    for (let i = 0; i < parts.length - 1; i++) {
      const candidate = parts.slice(i).join('.');
      if (allowedDomains.has(candidate)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 检查 URL 是否在代理下载白名单内
 */
function isAllowedProxyDomain(urlStr) {
  return isAllowedDomain(urlStr, PROXY_ALLOWED_DOMAINS);
}

/**
 * 检查 URL 是否在音频提取白名单内
 */
function isAllowedAudioDomain(urlStr) {
  return isAllowedDomain(urlStr, AUDIO_ALLOWED_DOMAINS);
}

module.exports = {
  PROXY_ALLOWED_DOMAINS,
  AUDIO_ALLOWED_DOMAINS,
  isAllowedDomain,
  isAllowedProxyDomain,
  isAllowedAudioDomain
};
