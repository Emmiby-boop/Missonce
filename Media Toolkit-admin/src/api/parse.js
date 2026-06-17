const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DOMAIN_TO_NAME } = require('../../configs/general_constants');
const WebFetcher = require('../../utils/webFetcher');
const UrlParser = require('../../utils/urlParser');
const ParserFactory = require('../parserFactory');
const { SimpleParser } = require('../parsers');
const parseCache = require('../../utils/parseCache');
const { makeResponse, badRequest, serverError, forbidden, tooManyRequests, notFound } = require('../../utils/response');
const { isAllowedProxyDomain } = require('../../utils/domainWhitelist');
const { PlatformRateLimiter } = require('../../utils/rateLimiter');
const performanceMonitor = require('../../utils/monitor');

// 初始化限流器
const rateLimiter = new PlatformRateLimiter();

// ========== proxyDownload 安全防护 ==========

// 签名密钥
const PROXY_SECRET = process.env.PROXY_SECRET;
// 不存在时生成随机密钥（仅警告不阻塞，但重启后签名全部失效）
const EFFECTIVE_SECRET = PROXY_SECRET || crypto.randomBytes(32).toString('hex');
if (!PROXY_SECRET) {
  console.error('⚠️⚠️⚠️  PROXY_SECRET 未设置！使用临时随机密钥（重启后全部签名失效）。请立即在环境变量中设置 PROXY_SECRET。');
  console.error('当前临时密钥: ' + EFFECTIVE_SECRET);
}

// 生成请求签名：HMAC-SHA256(secret, url + timestamp)
function generateProxySign(url, timestamp) {
  return crypto.createHmac('sha256', EFFECTIVE_SECRET)
    .update(`${url}|${timestamp}`)
    .digest('hex');
}

// 验证签名：签名有效期 5 分钟
function verifyProxySign(url, timestamp, signature) {
  try {
    const now = Date.now();
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts) || Math.abs(now - ts) > 5 * 60 * 1000) {
      return false;
    }
    const expected = generateProxySign(url, timestamp);
    // 比较签名
    if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch (e) {
    console.error('[verifyProxySign] 验证失败:', e.message);
    return false;
  }
}

function safeExecute(fn, defaultValue = null) {
  try {
    const result = fn();
    return result instanceof Promise ? result.catch(() => defaultValue) : result;
  } catch (e) {
    return defaultValue;
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(parser, platform) {
  const maxAttempts = 3;  // 所有平台统一3次重试
  const backoff = [0, 600, 1500];  // 指数退避ms
  let lastRes = null;

  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) await sleep(backoff[i]);
    const iterStart = Date.now();
    const [title, video_url, cover_url, author, image_list_raw, audio_url, metadata] = await Promise.all([
      Promise.resolve(parser.getTitleContent()).catch(() => ''),
      parser.getRealVideoUrl().catch(() => null),
      Promise.resolve(parser.getCoverPhotoUrl()).catch(() => ''),
      safeExecute(() => parser.getAuthorInfo()),
      safeExecute(() => parser.getImageList(), []),
      safeExecute(() => parser.getAudioUrl()),
      safeExecute(() => parser.getVideoMetadata(), {}),
    ]);

    const iterDuration = Date.now() - iterStart;
    const success = !!(title || video_url);
    performanceMonitor.record(platform, iterDuration, success);

    const res = {
      title,
      video_url,
      cover_url,
      author,
      image_list: image_list_raw || [],
      audio_url,
      resolution: metadata?.resolution || '',
      fileSizeBytes: metadata?.fileSizeBytes || 0,
      duration: metadata?.duration || '',
    };

    lastRes = res;

    if (res.video_url || (res.image_list && res.image_list.length > 0)) {
      return res;
    }

    if (i < maxAttempts - 1) {
      console.log(`[${platform}] Attempt ${i + 1} failed, retrying in ${backoff[i+1]}ms...`);
      parser.readyPromise = null;
      if ('noteData' in parser) parser.noteData = {};
      if ('postData' in parser) parser.postData = null;
      if ('data' in parser) parser.data = null;
      if ('htmlContent' in parser) parser.htmlContent = null;
      if ('videoInfo' in parser) parser.videoInfo = null;
      if ('playInfo' in parser) parser.playInfo = null;
      if (typeof parser._init === 'function') {
        parser.readyPromise = parser._init(); // 重新赋值，避免 doParse 再次调用
        await parser.readyPromise;
      }
    }
  }

  return lastRes || { title: '', video_url: null, cover_url: '', author: {}, image_list: [], audio_url: null };
}

// 获取视频元数据（分辨率、文件大小、时长）
async function fetchVideoMetadata(videoUrl) {
  if (!videoUrl) return {};
  
  try {
    const response = await axios({
      method: 'head',
      url: videoUrl,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const metadata = {};
    
    // 文件大小
    const contentLength = response.headers['content-length'];
    if (contentLength) {
      metadata.fileSizeBytes = parseInt(contentLength, 10);
    }

    // 尝试从 URL 或响应头推断分辨率
    const contentType = response.headers['content-type'] || '';
    
    return metadata;
  } catch (e) {
    console.error(`[fetchVideoMetadata] 获取视频元数据失败: ${e.message}`);
    return {};
  }
}

// 公共解析流程：接收文本/链接，返回 { dataDict, platform }
// 供 /api/parse 和 /api/ (自定义插件适配) 共用
async function doParse(text) {
  const url = UrlParser.getUrl(text);

  if (!url) {
    throw Object.assign(new Error('未找到有效链接'), { status: 400 });
  }

  // 快手：分享短链必须保留完整 URL，不用 WebFetcher
  let realUrl, platform;
  if (/kuaishou\.com/i.test(url) || /v\.kuaishou\.com/i.test(url) || /chenzhongtech\.com/i.test(url)) {
    platform = '快手';
    realUrl = url;
    console.log(`[Kuaishou] 使用原始分享链接，不走 WebFetcher: ${realUrl}`);
  } else {
    const redirectUrl = await WebFetcher.fetchRedirectUrl(url);
    if (!redirectUrl) {
      throw Object.assign(new Error('该链接尚未支持提取'), { status: 400 });
    }
    const domain = UrlParser.getDomain(redirectUrl);
    platform = DOMAIN_TO_NAME[domain];
    realUrl = UrlParser.extractVideoAddress(redirectUrl);
  }

  console.log(`real_url ${realUrl}`);

  if (!platform) {
    console.error(`This link is not supported for extraction: ${realUrl}`);
    throw Object.assign(new Error('该链接尚未支持提取'), { status: 400 });
  }

  // 缓存检查（用解析后的 realUrl 做 key，不同短链指向同一视频时能命中）
  const cached = parseCache.get(realUrl);
  if (cached) {
    console.log(`[perf] Cache hit, returning immediately`);
    return { dataDict: cached, platform: cached.platform };
  }

  const parser = ParserFactory.createParser(platform, realUrl);

  if (parser.readyPromise) {
    await parser.readyPromise;
  } else if (typeof parser._init === 'function') {
    await parser._init();
  }

  const contentData = await fetchWithRetry(parser, platform);

  if (!contentData.video_url && (!contentData.image_list || contentData.image_list.length === 0)) {
    console.error(`[${platform}] 未能获取媒体内容`);
    // 诊断日志
    if (platform === '哔哩哔哩') {
      console.error(`[Bilibili诊断] bvid=${parser.bvid} videoInfoKeys=${Object.keys(parser.videoInfo || {}).join(',')} playInfoKeys=${Object.keys(parser.playInfo || {}).join(',')} cid=${parser._getCid?.()}`);
    } else if (platform === '小红书') {
      console.error(`[XHS诊断] noteDataKeys=${Object.keys(parser.noteData || {}).join(',')} initialState=${!!parser.initialStateData}`);
    } else if (platform === '快手') {
      console.error(`[Kuaishou诊断] pageType=${parser.pageType} htmlLen=${parser.htmlContent?.length} hasCookie=${!!parser.headers?.cookie}`);
    }
  }

  const processedImageList = [];
  if (Array.isArray(contentData.image_list) && contentData.image_list.length > 0) {
    for (const img of contentData.image_list) {
      if (typeof img === 'object' && img !== null) {
        processedImageList.push({
          url: UrlParser.convertToHttps(img.url),
          live_photo_url: UrlParser.convertToHttps(img.live_photo_url)
        });
      } else {
        processedImageList.push(UrlParser.convertToHttps(img));
      }
    }
  }

  const dataDict = {
    video_id: UrlParser.getVideoId(realUrl),
    platform: platform,
    real_url: realUrl,
    title: contentData.title,
    video_url: UrlParser.convertToHttps(contentData.video_url),
    audio_url: UrlParser.convertToHttps(contentData.audio_url),
    cover_url: UrlParser.convertToHttps(contentData.cover_url),
    author: contentData.author,
    image_list: processedImageList,
    quality_options: safeExecute(() => parser.getQualityOptions(), []),
    resolution: contentData.resolution || '',
    fileSizeBytes: contentData.fileSizeBytes || 0,
    duration: contentData.duration || '',
    video_width: contentData.video_width || 0,
    video_height: contentData.video_height || 0,
  };

  console.log(`[debug] dataDict.resolution: ${dataDict.resolution}, fileSizeBytes: ${dataDict.fileSizeBytes}, duration: ${dataDict.duration}`);

  // 如果没有获取到分辨率和文件大小，尝试从视频URL获取
  if (dataDict.video_url && (!dataDict.fileSizeBytes || !dataDict.resolution)) {
    const metadata = await safeExecute(() => fetchVideoMetadata(dataDict.video_url), {});
    if (metadata.resolution && !dataDict.resolution) {
      dataDict.resolution = metadata.resolution;
    }
    if (metadata.fileSizeBytes && !dataDict.fileSizeBytes) {
      dataDict.fileSizeBytes = metadata.fileSizeBytes;
    }
    if (metadata.duration && !dataDict.duration) {
      dataDict.duration = metadata.duration;
    }
  }

  parseCache.set(realUrl, dataDict);

  return { dataDict, platform };
}

router.post('/download', async (req, res) => {
  const t0 = Date.now();
  try {
    const { platform, video_id, video_url, real_url } = req.body;

    console.log(`[perf][download] 请求: platform=${platform}, video_id=${video_id}, has_video_url=${!!video_url}, has_real_url=${!!real_url}`);

    if (!platform) {
      console.log(`[perf][download] 缺少平台参数, ${Date.now() - t0}ms`);
      return res.status(400).json(makeResponse(400, '缺少平台参数', null, false));
    }

    let download_url = video_url || null;

    // 直接使用解析时已获取的 video_url，保证下载的是预览时看到的同一个视频
    // 不再重新调用 Douyin API（每次 API 返回的 CDN 地址可能不同，导致下载的视频和预览不一致）
    if (!download_url) {
      console.log(`[perf][download] 无 video_url，返回空, ${Date.now() - t0}ms`);
    }

    const urlPreview = download_url ? download_url.substring(0, 100) : 'null';
    console.log(`[perf][download] 响应: ${Date.now() - t0}ms, platform=${platform}, video_id=${video_id}, url=${urlPreview}...`);

    if (!download_url) {
      return res.status(404).json(makeResponse(404, '视频地址不可用，请重新解析', null, false));
    }

    return res.json(makeResponse(200, '成功', { download_url, video_id }, true));
  } catch (e) {
    console.error(`[perf][download] 失败: ${Date.now() - t0}ms, error=${e.message}`);
    return res.status(500).json(makeResponse(500, '下载失败', null, false));
  }
});

router.get('/proxyDownload', async (req, res) => {
  const t0 = Date.now();
  try {
    const { url, filename, ts, sign } = req.query;

    if (!url) {
      return res.status(400).json(makeResponse(400, '缺少URL参数', null, false));
    }

    // ===== 安全验证 =====
    // 1. 签名验证（防直接调用）
    if (!ts || !sign || !verifyProxySign(url, ts, sign)) {
      console.warn(`[proxyDownload] 签名验证失败, ip=${req.ip}, url=${url?.substring(0, 80)}`);
      return res.status(403).json(makeResponse(403, '请求验证失败', null, false));
    }

    // 2. 域名白名单（防开放代理被滥用）
    if (!isAllowedProxyDomain(url)) {
      try {
        console.warn(`[proxyDownload] 域名不在白名单内, ip=${req.ip}, domain=${new URL(url).hostname}`);
      } catch { /* URL 格式异常，跳过日志 */ }
      return res.status(403).json(forbidden('该域名暂不支持代理下载，请在后台白名单中添加'));
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    const urlShort = url?.substring(0, 80);
    console.log(`[perf][proxyDownload] 请求: ${urlShort}..., filename=${filename}`);

    // 检查是否是本地静态文件
    const localMatch = url.match(/^https?:\/\/[^/]+\/static\/videos\/([^/]+)$/);
    if (localMatch) {
      const videoFilename = localMatch[1];
      const filePath = path.join(__dirname, '../..', 'static', 'videos', videoFilename);
      console.log(`[proxyDownload] Local file check - __dirname: ${__dirname}`);
      console.log(`[proxyDownload] Local file check - filePath: ${filePath}`);
      console.log(`[proxyDownload] Local file check - file exists: ${fs.existsSync(filePath)}`);
      
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        const contentType = videoFilename.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream';
        
        console.log(`[perf][proxyDownload] 本地文件命中: ${Date.now() - t0}ms, size=${(stat.size / 1024 / 1024).toFixed(1)}MB`);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', stat.size);
        if (filename) {
          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        }
        
        const stream = fs.createReadStream(filePath);
        let localBytesSent = 0;
        stream.on('data', (chunk) => { localBytesSent += chunk.length; });
        stream.on('end', () => {
          console.log(`[perf][proxyDownload] 本地文件流完成: ${Date.now() - t0}ms, ${(localBytesSent / 1024 / 1024).toFixed(1)}MB`);
        });
        stream.on('error', (err) => {
          console.error(`[proxyDownload] 本地文件流错误: ${err.message}`);
          if (!res.headersSent) {
            res.status(500).json(serverError('文件读取失败'));
          }
        });
        // 下载完成后删除服务器上的临时文件，避免占用磁盘空间
        res.on('finish', () => {
          fs.unlink(filePath, (err) => {
            if (err) {
              console.error(`[proxyDownload] 删除临时文件失败: ${filePath}, ${err.message}`);
            } else {
              console.log(`[proxyDownload] 临时文件已删除: ${filePath}`);
            }
          });
        });
        stream.pipe(res);
        return;
      } else {
        console.error(`Local file not found: ${filePath}`);
        return res.status(404).json(notFound('文件不存在'));
      }
    }

    let referer = 'https://www.douyin.com/';
    try {
      const urlObj = new URL(url);
      const host = urlObj.hostname;
      if (host.includes('bilivideo.com') || host.includes('bilibili.com')) {
        referer = 'https://www.bilibili.com/';
      } else if (host.includes('douyin.com') || host.includes('douyinvod.com') || host.includes('ixigua.com') || host.includes('snssdk.com') || host.includes('byteimg.com')) {
        referer = 'https://www.douyin.com/';
      } else if (host.includes('kuaishou.com') || host.includes('yximgs.com')) {
        referer = 'https://www.kuaishou.com/';
      } else if (host.includes('xhscdn.com') || host.includes('xiaohongshu.com')) {
        referer = 'https://www.xiaohongshu.com/';
      } else {
        referer = `https://${host}/`;
      }
    } catch (e) {
      referer = 'https://www.douyin.com/';
    }

    const tReferer = Date.now();
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
      timeout: 600000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': referer
      }
    });

    const contentType = response.headers['content-type'] || 'application/octet-stream';

    console.log(`[perf][proxyDownload] 源站响应(TTFB): ${Date.now() - tReferer}ms, type=${contentType}`);

    // 拒绝非媒体类型的响应（如 HTML 页面），避免 chunked encoding 错误
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
      console.error(`[proxyDownload] 拒绝非媒体类型: ${contentType}, url=${url?.substring(0, 80)}`);
      response.data.destroy();
      return res.status(400).json(badRequest('该链接不是有效的媒体文件，可能视频地址已过期'));
    }

    res.setHeader('Content-Type', contentType);
    if (filename) {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    }
    // 不设置 Content-Length，使用 chunked 传输避免 ERR_CONTENT_LENGTH_MISMATCH

    // 跟踪流传输进度
    let bytesTransferred = 0;

    response.data.on('data', (chunk) => {
      bytesTransferred += chunk.length;
    });

    response.data.on('end', () => {
      const elapsed = Date.now() - t0;
      const sizeMB = (bytesTransferred / 1024 / 1024).toFixed(1);
      console.log(`[perf][proxyDownload] 流传输完成: ${elapsed}ms, ${sizeMB}MB, speed=${(bytesTransferred / 1024 / (elapsed / 1000)).toFixed(1)}KB/s`);
    });

    response.data.on('error', (err) => {
      const elapsed = Date.now() - t0;
      console.error(`[perf][proxyDownload] 流错误: ${err.message}, ${elapsed}ms, 已传${(bytesTransferred / 1024 / 1024).toFixed(1)}MB`);
      // 确保响应流被正确销毁，释放连接池资源
      if (response.data && typeof response.data.destroy === 'function') {
        response.data.destroy();
      }
      if (!res.headersSent) {
        res.status(500).json(serverError('流传输失败'));
      }
    });

    // 监听客户端断开，清理源站连接
    res.on('close', () => {
      if (response.data && typeof response.data.destroy === 'function') {
        response.data.destroy();
      }
    });

    // pipe 缓冲调至 1MB，减少读写暂停/恢复次数，提升吞吐
    response.data.pipe(res, { end: true });
  } catch (e) {
    console.error(`[proxyDownload] 代理下载失败: ${e.message}, code=${e.code}, status=${e.response?.status}, url=${url?.substring(0, 80)}`);
    if (!res.headersSent) {
      return res.status(502).json(serverError('代理下载失败: ' + e.message));
    }
  }
});

router.post('/parse', async (req, res) => {
  const parseStart = Date.now();
  try {
    const { text } = req.body;
    console.log(`[perf] parse start: ${text?.substring(0, 50)}`);

    // 测试模式：输入「测试」或「test」返回 SimpleParser 演示数据
    if (!text || /^(测试|test)\s*$/i.test(text.trim())) {
      const parser = new SimpleParser('测试模式');
      const contentData = await fetchWithRetry(parser, '测试');
      return res.json(makeResponse(200, '成功', {
        video_id: 'test_001',
        platform: '测试模式',
        title: contentData.title,
        video_url: UrlParser.convertToHttps(contentData.video_url),
        audio_url: UrlParser.convertToHttps(contentData.audio_url),
        cover_url: UrlParser.convertToHttps(contentData.cover_url),
        author: contentData.author,
        image_list: (contentData.image_list || []).map(img =>
          typeof img === 'object' ? {
            url: UrlParser.convertToHttps(img.url),
            live_photo_url: UrlParser.convertToHttps(img.live_photo_url)
          } : UrlParser.convertToHttps(img)
        ),
        resolution: contentData.resolution || '720',
        fileSizeBytes: contentData.fileSizeBytes || 5242880,
        duration: contentData.duration || '00:30',
      }, true));
    }

    const { dataDict, platform } = await doParse(text);
    console.log(`Parse Success for platform ${platform}, total: ${Date.now() - parseStart}ms`);
    return res.json(makeResponse(200, '成功', dataDict, true));
  } catch (e) {
    const status = e.status || 500;
    const message = status === 400 ? e.message : '功能太火爆啦，请稍后再试';
    console.error('Parse Error', e);
    return res.status(status).json(makeResponse(status, message, null, false));
  }
});

// 签名接口：小程序调用获取 proxyDownload 签名
// 验证 URL 来自已知平台，防止被滥用为开放代理签名工具
router.post('/getProxySign', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json(makeResponse(400, '缺少URL参数', null, false));
  }
  // 验证 URL 域名在白名单内（防止给任意 URL 签名）
  if (!isAllowedProxyDomain(url)) {
    return res.status(403).json(makeResponse(403, '该域名不在代理白名单内', null, false));
  }
  const ts = Date.now().toString();
  const sign = generateProxySign(url, ts);
  return res.json(makeResponse(200, '成功', { ts, sign }, true));
});

// 按指定清晰度重新获取视频地址
router.post('/parse-quality', async (req, res) => {
  try {
    const { text, qn, platform } = req.body;
    if (!text || qn === undefined) {
      return res.status(400).json(makeResponse(400, '缺少参数', null, false));
    }

    const url = UrlParser.getUrl(text);
    if (!url) return res.status(400).json(makeResponse(400, '链接无效', null, false));

    const redirectUrl = await WebFetcher.fetchRedirectUrl(url);
    if (!redirectUrl) return res.status(400).json(makeResponse(400, '无法识别平台', null, false));

    const domain = UrlParser.getDomain(redirectUrl);
    const plat = platform || DOMAIN_TO_NAME[domain];
    const realUrl = UrlParser.extractVideoAddress(redirectUrl);

    const parser = ParserFactory.createParser(plat, realUrl);
    if (parser.readyPromise) await parser.readyPromise;
    else if (typeof parser._init === 'function') await parser._init();

    const videoUrl = await parser.getRealVideoUrlByQuality(qn);
    if (!videoUrl) {
      return res.status(400).json(makeResponse(400, '该清晰度不可用', null, false));
    }

    return res.json(makeResponse(200, '成功', {
      video_url: UrlParser.convertToHttps(videoUrl),
      qn
    }, true));
  } catch (e) {
    console.error('ParseQuality Error:', e);
    return res.status(500).json(makeResponse(500, '切换清晰度失败', null, false));
  }
});

// 自定义解析接口：适配浏览器插件 POST /api/
// 插件发送 POST 请求，参数 url=视频链接&wxid=用户微信id
// 返回格式须为 {"data": {"url": "解析出的视频链接"}}，否则插件闪退
router.post('/', async (req, res) => {
  try {
    // 兼容 form-encoded (url=xxx&wxid=xxx) 和 JSON ({"url":"xxx"})
    const videoInput = req.body.url || req.body.text || '';
    console.log(`[custom-parse] request: url=${videoInput?.substring(0, 80)}, wxid=${req.body.wxid}`);

    if (!videoInput) {
      return res.json({ data: { url: '' } });
    }

    const { dataDict } = await doParse(videoInput);
    const videoUrl = dataDict.video_url || '';
    console.log(`[custom-parse] success: videoUrl=${videoUrl?.substring(0, 80)}`);
    return res.json({ data: { url: videoUrl } });
  } catch (e) {
    console.error('[custom-parse] error:', e.message);
    return res.json({ data: { url: '' } });
  }
});

// ==================== 公告接口（动态配置） ====================

const ANNOUNCEMENT_FILE = path.join(__dirname, '..', '..', 'data', 'announcement.json');

function loadAnnouncement() {
  try {
    if (fs.existsSync(ANNOUNCEMENT_FILE)) {
      return JSON.parse(fs.readFileSync(ANNOUNCEMENT_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[Announcement] 读取配置文件失败:', e.message);
  }
  // 默认公告
  return { content: '小辣椒全新升级！抖音风格播放器上线，上下滑动切视频，长按复制文案，批量管理历史记录，快去试试吧～', url: '', showPopup: false, priority: 'normal' };
}

function saveAnnouncement(data) {
  const dir = path.dirname(ANNOUNCEMENT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ANNOUNCEMENT_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// 公开读取：小程序端调用，无需认证
router.get('/announcement', (req, res) => {
  try {
    const ann = loadAnnouncement();
    res.json({ success: true, data: ann });
  } catch (e) {
    res.json({ success: true, data: { content: '', url: '' } });
  }
});

// 管理端写入：需要 API Key 认证（使用共享中间件）
const { requireAdmin: requireAuth } = require('../../utils/adminAuth');

router.put('/announcement', requireAuth, (req, res) => {
  try {
    const { content, url, showPopup, priority } = req.body || {};
    if (!content) return res.status(400).json({ retcode: 400, retdesc: '公告内容不能为空', data: null, succ: false });

    const ann = { content, url: url || '', showPopup: !!showPopup, priority: priority || 'normal', updatedAt: Date.now() };
    saveAnnouncement(ann);
    res.json({ success: true, data: ann });
  } catch (e) {
    res.status(500).json({ retcode: 500, retdesc: '保存失败', data: null, succ: false });
  }
});

module.exports = router;
