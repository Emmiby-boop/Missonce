/**
 * 域名白名单工具
 * 统一管理代理下载和音频提取的域名白名单
 * 支持从 JSON 文件动态加载，运行时可增删
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const WHITELIST_FILE = path.join(DATA_DIR, 'domain_whitelist.json');

// 默认白名单（首次无文件时使用）
const DEFAULT_PROXY_DOMAINS = [
  'douyincdn.com', 'douyinvod.com', 'idouyinvod.com', 'douyin.com', 'ixigua.com', 'snssdk.com', 'byteimg.com',
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
];

const DEFAULT_AUDIO_DOMAINS = [
  'bilivideo.com', 'biliapi.com', 'bilibili.com',
  'upos-sz-static.bilivideo.com', 'upos-sz-mirrorbilivideo.com',
];

// 运行时白名单（从文件加载）
let _proxyDomains = new Set(DEFAULT_PROXY_DOMAINS);
let _audioDomains = new Set(DEFAULT_AUDIO_DOMAINS);

// 从文件加载
function loadWhitelist() {
  try {
    if (fs.existsSync(WHITELIST_FILE)) {
      const data = JSON.parse(fs.readFileSync(WHITELIST_FILE, 'utf-8'));
      if (Array.isArray(data.proxy)) _proxyDomains = new Set(data.proxy);
      if (Array.isArray(data.audio)) _audioDomains = new Set(data.audio);
      console.log(`[Whitelist] 已加载: ${_proxyDomains.size} 代理域名, ${_audioDomains.size} 音频域名`);
    }
  } catch (e) {
    console.error('[Whitelist] 加载失败，使用默认白名单:', e.message);
  }
}

// 保存到文件
function saveWhitelist() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(WHITELIST_FILE, JSON.stringify({
      proxy: [..._proxyDomains],
      audio: [..._audioDomains],
    }, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Whitelist] 保存失败:', e.message);
  }
}

// 启动时加载
loadWhitelist();

// 代理下载允许的域名白名单
const PROXY_ALLOWED_DOMAINS = _proxyDomains;

// 音频提取允许的域名白名单
const AUDIO_ALLOWED_DOMAINS = _audioDomains;

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

// ==================== 动态管理 ====================

function getProxyDomains() { return [...PROXY_ALLOWED_DOMAINS].sort(); }
function getAudioDomains() { return [...AUDIO_ALLOWED_DOMAINS].sort(); }

function addProxyDomain(domain) {
  if (!domain || PROXY_ALLOWED_DOMAINS.has(domain)) return false;
  PROXY_ALLOWED_DOMAINS.add(domain);
  saveWhitelist();
  console.log(`[Whitelist] 新增代理域名: ${domain}`);
  return true;
}

function removeProxyDomain(domain) {
  if (!PROXY_ALLOWED_DOMAINS.has(domain)) return false;
  PROXY_ALLOWED_DOMAINS.delete(domain);
  saveWhitelist();
  console.log(`[Whitelist] 移除代理域名: ${domain}`);
  return true;
}

function addAudioDomain(domain) {
  if (!domain || AUDIO_ALLOWED_DOMAINS.has(domain)) return false;
  AUDIO_ALLOWED_DOMAINS.add(domain);
  saveWhitelist();
  return true;
}

function removeAudioDomain(domain) {
  if (!AUDIO_ALLOWED_DOMAINS.has(domain)) return false;
  AUDIO_ALLOWED_DOMAINS.delete(domain);
  saveWhitelist();
  return true;
}

function resetToDefaults() {
  _proxyDomains = new Set(DEFAULT_PROXY_DOMAINS);
  _audioDomains = new Set(DEFAULT_AUDIO_DOMAINS);
  saveWhitelist();
  console.log('[Whitelist] 已恢复默认白名单');
}

module.exports = {
  PROXY_ALLOWED_DOMAINS,
  AUDIO_ALLOWED_DOMAINS,
  isAllowedDomain,
  isAllowedProxyDomain,
  isAllowedAudioDomain,
  getProxyDomains,
  getAudioDomains,
  addProxyDomain,
  removeProxyDomain,
  addAudioDomain,
  removeAudioDomain,
  resetToDefaults,
  loadWhitelist,
};
