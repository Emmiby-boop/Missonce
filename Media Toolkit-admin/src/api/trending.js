const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { success, error, badRequest, serverError, notFound } = require('../../utils/response');
const CommonUtils = require('../../utils/douyin_utils/commonUtils');
const { requireAdmin } = require('../../utils/adminAuth');

// 数据持久化路径
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'trending.json');

// 确保 data 目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 读取持久化数据
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('[Trending] 读取数据文件失败:', e.message);
  }
  return [];
}

// 保存数据
function saveData(items) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Trending] 保存数据文件失败:', e.message);
  }
}

// 生成唯一 ID
function genId() {
  return 'tr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ==================== 抖音推荐流获取 ====================

const commonUtils = new CommonUtils();
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 全局 ttwid 缓存
let cachedTtwid = '';
let ttwidExpireAt = 0;

async function getTtwid() {
  if (cachedTtwid && Date.now() < ttwidExpireAt) return cachedTtwid;
  try {
    const cookies = loadCookies();
    const dyCookie = cookies.douyin?.cookie || '';
    const resp = await axios.get('https://www.douyin.com/', {
      headers: {
        'User-Agent': commonUtils.userAgent,
        ...(dyCookie ? { 'Cookie': dyCookie } : {}),
      },
      timeout: 8000,
    });
    const setCookie = resp.headers['set-cookie'];
    if (setCookie) {
      const cookieArr = Array.isArray(setCookie) ? setCookie : [setCookie];
      for (const c of cookieArr) {
        const match = c.match(/ttwid=([^;]+)/);
        if (match) { cachedTtwid = match[1]; ttwidExpireAt = Date.now() + 600000; return cachedTtwid; }
      }
    }
  } catch (e) {
    console.warn('[Trending] 获取 ttwid 失败:', e.message);
  }
  return cachedTtwid || '';
}

async function fetchFeedOnce(ttwid, dyCookie) {
  const msToken = commonUtils.getMsToken();
  const cookieParts = [];
  if (ttwid) cookieParts.push(`ttwid=${ttwid}`);
  if (dyCookie) cookieParts.push(dyCookie);

  const feedUrl = `https://www.douyin.com/aweme/v1/web/tab/feed/?device_platform=webapp&aid=6383&channel=channel_pc_web&count=20&msToken=${msToken}`;
  let aBogus = '';
  try { aBogus = commonUtils.getABogus(feedUrl, commonUtils.userAgent); } catch (e) {}
  const url = aBogus ? `${feedUrl}&a_bogus=${aBogus}` : feedUrl;

  const resp = await axios.get(url, {
    headers: {
      'User-Agent': commonUtils.userAgent,
      'Referer': 'https://www.douyin.com/',
      'Cookie': cookieParts.join('; '),
    },
    timeout: 15000,
  });
  return resp.data?.aweme_list || [];
}

async function fetchDouyinHot() {
  try {
    const cookies = loadCookies();
    const dyCookie = cookies.douyin?.cookie || '';
    if (!dyCookie) {
      console.warn('[Trending] 抖音 Cookie 未配置，无法获取推荐流');
      return [];
    }

    const ttwid = await getTtwid();
    const seen = {};
    const items = [];
    const rounds = 6;

    for (let i = 0; i < rounds; i++) {
      try {
        const awemeList = await fetchFeedOnce(ttwid, dyCookie);
        for (const item of awemeList) {
          const aweme = item.aweme_info || item;
          const id = aweme.aweme_id;
          if (!id || seen[id]) continue;
          seen[id] = true;

          const shareUrl = aweme.share_url || '';
          if (!shareUrl) continue;

          const video = aweme.video || {};
          const playAddr = video.play_addr?.url_list || [];

          items.push({
            id: genId(),
            source: 'douyin',
            title: aweme.desc || '',
            cover: video.dynamic_cover?.url_list?.[0] || video.cover?.url_list?.[0] || '',
            platform: '抖音',
            author: aweme.author?.nickname || '',
            heat: aweme.statistics?.digg_count || 0,
            url: shareUrl,
            videoUrl: playAddr[playAddr.length - 1] || playAddr[0] || '',
            awemeId: id,
            desc: aweme.desc || '',
            duration: video.duration || 0,
            syncedAt: Date.now(),
          });
        }
        if (awemeList.length === 0) break;
        if (i < rounds - 1) await sleep(800);
      } catch (e) {
        console.warn(`[Trending] 抖音推荐流第${i + 1}轮失败:`, e.message);
      }
    }

    console.log(`[Trending] 抖音推荐流: ${rounds}轮, 有效${items.length}条`);
    return items;
  } catch (e) {
    console.error('[Trending] 抖音推荐流获取失败:', e.message);
    return [];
  }
}

// ==================== 快手热搜获取（占位 - 待实现） ====================
async function fetchKuaishouHot() {
  console.warn('[Trending] 快手热搜同步暂未实现');
  return [];
}

// Cookie 持久化路径
const COOKIE_FILE = path.join(DATA_DIR, 'cookies.json');

function loadCookies() {
  try {
    if (fs.existsSync(COOKIE_FILE)) {
      return JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[Trending] 读取 Cookie 文件失败:', e.message);
  }
  return {};
}

function saveCookies(data) {
  try {
    fs.writeFileSync(COOKIE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Trending] 保存 Cookie 文件失败:', e.message);
  }
}

// ==================== Cookie 管理 API ====================
// GET /api/cookies - 查询所有 Cookie 状态（不返回实际值）
router.get('/cookies', (req, res) => {
  try {
    const cookies = loadCookies();
    const status = {};
    for (const [platform, data] of Object.entries(cookies)) {
      status[platform] = {
        hasCookie: !!data.cookie,
        updatedAt: data.updatedAt || 0,
        expiresAt: data.expiresAt || 0,
        status: data.expiresAt && Date.now() > data.expiresAt ? 'expired' : 'active',
      };
    }
    return res.json(success(status));
  } catch (e) {
    return res.status(500).json(serverError('获取 Cookie 状态失败'));
  }
});

// POST /api/cookies/:platform - 保存 Cookie
router.post('/cookies/:platform', requireAdmin, (req, res) => {
  const { platform } = req.params;
  const { cookie, expiresAt } = req.body || {};
  if (!cookie) return res.status(400).json(badRequest('Cookie 不能为空'));

  try {
    const cookies = loadCookies();
    cookies[platform] = { cookie: cookie.trim(), expiresAt: expiresAt || 0, updatedAt: Date.now() };
    saveCookies(cookies);
    return res.json(success(null, `${platform} Cookie 已保存`));
  } catch (e) {
    return res.status(500).json(serverError('保存失败'));
  }
});

// DELETE /api/cookies/:platform - 删除 Cookie
router.delete('/cookies/:platform', requireAdmin, (req, res) => {
  const { platform } = req.params;
  try {
    const cookies = loadCookies();
    delete cookies[platform];
    saveCookies(cookies);
    return res.json(success(null, `${platform} Cookie 已删除`));
  } catch (e) {
    return res.status(500).json(serverError('删除失败'));
  }
});

// ==================== 小红书热搜获取 ====================
function extractXsrf(cookieStr) {
  const match = cookieStr.match(/a1=([^;]+)/);
  if (!match) return '';
  // xsrf 是 a1 的 URL-encoded 版本
  return encodeURIComponent(match[1]).replace(/%2F/g, '/');
}

function randomTraceId() {
  const hex = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < 32; i++) id += hex[Math.floor(Math.random() * 16)];
  return id;
}

async function fetchXiaohongshuHot() {
  try {
    const resp = await axios.get('https://www.xiaohongshu.com/explore', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 15000,
    });

    const html = resp.data || '';
    
    // 从 SSR HTML 中提取笔记数据：{"id":"...","displayTitle":"..."...}
    const notePattern = /"id":"([0-9a-f]{24})".*?"displayTitle":"([^"]*?)(?<!\\)"/g;
    const coverPattern = /"urlDefault":"(https?:\\?\/\\?\/[^"]*?(?:xhscdn|xiaohongshu)[^"]*)"/g;
    
    const notes = [];
    const htmlWithoutNewlines = html.replace(/\n/g, '');
    
    // 找所有 displayTitle
    let titleMatch;
    const titleRegex = /"displayTitle":"((?:[^"\\]|\\.)*)"/g;
    const titles = [];
    while ((titleMatch = titleRegex.exec(htmlWithoutNewlines)) !== null) {
      titles.push(titleMatch[1].replace(/\\"/g, '"'));
    }

    // 找所有 id (24位hex)
    const idRegex = /"id":"([0-9a-f]{24})"/g;
    const ids = [];
    let idMatch;
    while ((idMatch = idRegex.exec(htmlWithoutNewlines)) !== null) {
      ids.push(idMatch[1]);
    }

    // 找所有封面 urlDefault
    const coverRegex = /"urlDefault":"((?:https?:)?\\?\/\\?\/[^"]*?(?:xhscdn|xiaohongshu)[^"]*)"/g;
    const covers = [];
    let coverMatch;
    while ((coverMatch = coverRegex.exec(htmlWithoutNewlines)) !== null) {
      covers.push(coverMatch[1].replace(/\\\//g, '/'));
    }

    // 合并匹配结果（按出现顺序对齐）
    const count = Math.min(ids.length, titles.length, 30);
    for (let i = 0; i < count; i++) {
      // 跳过太短的标题（可能是装饰文本）
      if (titles[i].length < 2) continue;
      notes.push({
        id: genId(),
        source: 'xiaohongshu',
        title: titles[i] || '',
        cover: covers[i] || '',
        platform: '小红书',
        author: '小红书推荐',
        heat: 0,
        url: ids[i] ? `https://www.xiaohongshu.com/explore/${ids[i]}` : '',
        syncedAt: Date.now(),
      });
    }

    console.log(`[Trending] 小红书 SSR: 提取到 ${notes.length} 条笔记`);
    return notes;
  } catch (e) {
    console.error('[Trending] 小红书 SSR 抓取失败:', e.message);
    return [];
  }
}
    if (e.message.includes('未配置')) throw e;
    console.error('[Trending] 小红书接口失败:', e.message);
    throw new Error('小红书接口调用失败: ' + e.message);
  }
}

// 平台同步器映射
const syncMap = {
  douyin: { fn: fetchDouyinHot, label: '抖音' },
  kuaishou: { fn: fetchKuaishouHot, label: '快手' },
  xiaohongshu: { fn: fetchXiaohongshuHot, label: '小红书' },
};

// ==================== GET /api/trending ====================
// 从本地持久化数据中返回热门列表
router.get('/trending', (req, res) => {
  const { page = 1, pageSize = 30 } = req.query;

  try {
    const allItems = loadData();
    allItems.sort((a, b) => (b.heat || 0) - (a.heat || 0));
    const pageNum = Math.max(1, parseInt(page) || 1);
    const sizeNum = Math.min(50, Math.max(1, parseInt(pageSize) || 30));
    const start = (pageNum - 1) * sizeNum;
    const paged = allItems.slice(start, start + sizeNum);

    return res.json(success({ list: paged, total: allItems.length, page: pageNum, pageSize: sizeNum }));
  } catch (e) {
    console.error('[Trending] error:', e.message);
    return res.status(500).json(serverError('获取热门失败'));
  }
});

// ==================== GET /api/trending/merged ====================
// 合并所有来源的热门数据（手动 + 各平台同步的）
router.get('/trending/merged', (req, res) => {
  try {
    const allItems = loadData();
    allItems.sort((a, b) => (b.heat || 0) - (a.heat || 0));
    return res.json(success({ list: allItems, total: allItems.length }));
  } catch (e) {
    console.error('[Trending] merged error:', e.message);
    return res.status(500).json(serverError('获取合并列表失败'));
  }
});

// ==================== POST /api/trending/sync/:platform ====================
router.post('/trending/sync/:platform', requireAdmin, async (req, res) => {
  const { platform } = req.params;
  const syncer = syncMap[platform];

  if (!syncer) {
    return res.status(400).json(badRequest(`不支持的平台: ${platform}`));
  }

  try {
    const newItems = await syncer.fn();
    if (newItems.length === 0) {
      return res.json(success({ count: 0, message: `${syncer.label}未返回数据（可能接口暂不可用）` }));
    }

    // 清除旧数据 + 写入新数据
    const existing = loadData();
    const filtered = existing.filter(item => item.source !== platform);
    const merged = [...filtered, ...newItems];
    saveData(merged);

    return res.json(success({ count: newItems.length, message: `${syncer.label}同步成功` }));
  } catch (e) {
    console.error(`[Trending] sync ${platform} error:`, e.message);
    return res.status(500).json(serverError(`${syncer.label}同步失败: ${e.message}`));
  }
});

// ==================== POST /api/trending/manual ====================
// 手动添加热门
router.post('/trending/manual', requireAdmin, (req, res) => {
  const { url, title, platform, cover, desc } = req.body || {};

  if (!url) {
    return res.status(400).json(badRequest('链接不能为空'));
  }

  try {
    const items = loadData();
    const newItem = {
      id: genId(),
      source: 'manual',
      url,
      title: title || '未命名',
      platform: platform || '未知',
      cover: cover || '',
      desc: desc || '',
      heat: 0,
      createdAt: Date.now(),
    };
    items.unshift(newItem);
    saveData(items);

    return res.json(success(newItem, '添加成功'));
  } catch (e) {
    return res.status(500).json(serverError('添加失败'));
  }
});

// ==================== POST /api/trending/manual/batch ====================
// 批量导入：每行一个链接，可选带标题（用 | 或 tab 分隔），异步补封面
router.post('/trending/manual/batch', requireAdmin, (req, res) => {
  const { text, platform } = req.body || {};

  if (!text || !text.trim()) {
    return res.status(400).json(badRequest('导入内容不能为空'));
  }

  try {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) {
      return res.status(400).json(badRequest('未找到有效链接'));
    }

    const items = loadData();
    const newItems = [];

    for (const line of lines) {
      const parts = line.includes('\t') ? line.split('\t') : line.split('|');
      const url = parts[0]?.trim();
      const title = parts[1]?.trim() || '';

      if (!url || !/^https?:\/\//i.test(url)) continue;

      newItems.push({
        id: genId(),
        source: 'manual',
        url,
        title: title || '未命名',
        platform: platform || '未知',
        cover: '',
        desc: '',
        heat: 0,
        createdAt: Date.now(),
      });
    }

    if (!newItems.length) {
      return res.status(400).json(badRequest('未找到有效链接（需以 http 开头）'));
    }

    items.unshift(...newItems);
    saveData(items);

    // 异步补封面（不阻塞响应）
    enrichCovers(newItems).catch(() => {});

    return res.json(success({ count: newItems.length }, `成功导入 ${newItems.length} 条`));
  } catch (e) {
    return res.status(500).json(serverError('批量导入失败'));
  }
});

// 异步为手动导入的条目补封面和标题
async function enrichCovers(items) {
  for (const item of items) {
    try {
      const resp = await axios.post(
        `http://localhost:${process.env.PORT || 3001}/api/parse`,
        { text: item.url },
        { timeout: 20000 }
      );
      const data = resp.data?.data;
      if (!data) continue;

      const allItems = loadData();
      const target = allItems.find(i => i.id === item.id);
      if (!target) continue;

      if (!target.cover && data.cover_url) target.cover = data.cover_url;
      if (target.title === '未命名' && data.title) target.title = data.title;
      if (!target.desc && data.desc) target.desc = data.desc;
      if (data.platform && target.platform === '未知') target.platform = data.platform;

      saveData(allItems);
      console.log(`[Trending] 补封面: ${target.title?.substring(0, 30) || item.url}`);
    } catch (e) {
      console.warn(`[Trending] 补封面失败: ${item.url?.substring(0, 50)}`, e.message);
    }
  }
}

// ==================== PUT /api/trending/manual/:id ====================
router.put('/trending/manual/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { url, title, platform, cover, desc } = req.body || {};

  try {
    const items = loadData();
    const idx = items.findIndex(item => item.id === id);
    if (idx === -1) {
      return res.status(404).json(notFound('内容不存在'));
    }

    // 更新字段
    if (url !== undefined) items[idx].url = url;
    if (title !== undefined) items[idx].title = title;
    if (platform !== undefined) items[idx].platform = platform;
    if (cover !== undefined) items[idx].cover = cover;
    if (desc !== undefined) items[idx].desc = desc;
    items[idx].updatedAt = Date.now();

    saveData(items);
    return res.json(success(items[idx], '更新成功'));
  } catch (e) {
    return res.status(500).json(serverError('更新失败'));
  }
});

// ==================== DELETE /api/trending/manual/:id ====================
router.delete('/trending/manual/:id', requireAdmin, (req, res) => {
  const { id } = req.params;

  try {
    const items = loadData();
    const idx = items.findIndex(item => item.id === id);
    if (idx === -1) {
      return res.status(404).json(notFound('内容不存在'));
    }

    items.splice(idx, 1);
    saveData(items);
    return res.json(success(null, '删除成功'));
  } catch (e) {
    return res.status(500).json(serverError('删除失败'));
  }
});

// ==================== DELETE /api/trending/clear/:source ====================
router.delete('/trending/clear/:source', requireAdmin, (req, res) => {
  const { source } = req.params;

  try {
    const items = loadData();
    const before = items.length;
    const filtered = items.filter(item => item.source !== source);
    const removed = before - filtered.length;

    if (removed === 0) {
      return res.json(success({ removed: 0 }, `来源 ${source} 无数据`));
    }

    saveData(filtered);
    return res.json(success({ removed }, `已清空 ${source} 的 ${removed} 条数据`));
  } catch (e) {
    return res.status(500).json(serverError('清空失败'));
  }
});

// ==================== DELETE /api/trending/clear/all ====================
router.delete('/trending/clear/all', requireAdmin, (req, res) => {
  try {
    const items = loadData();
    const count = items.length;
    saveData([]);
    return res.json(success({ removed: count }, `已清空全部 ${count} 条数据`));
  } catch (e) {
    return res.status(500).json(serverError('清空失败'));
  }
});

module.exports = router;
