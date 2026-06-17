const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const DATA_FILE = path.join(__dirname, '../../data/trending_manual.json');

// 确保数据文件存在
function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
}

// 读取手动添加的热门
function readManualItems() {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

// 写入手动热门
function writeManualItems(items) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8');
}

// 生成ID
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

// ========== 手动管理 CRUD ==========

// 获取手动列表
router.get('/trending/manual', (req, res) => {
  const items = readManualItems();
  res.json({ retcode: 200, data: { list: items } });
});

// 添加
router.post('/trending/manual', async (req, res) => {
  try {
    const { url, title, platform, cover, desc } = req.body;
    if (!url) return res.status(400).json({ retcode: 400, retdesc: '链接不能为空' });

    // 自动解析标题和封面（如果没提供）
    let autoTitle = title;
    let autoCover = cover;
    let autoPlatform = platform;

    if (!autoTitle || !autoCover) {
      try {
        const parseRes = await axios.post('http://127.0.0.1:3001/api/parse', { text: url }, { timeout: 15000 });
        if (parseRes.data?.retcode === 200 && parseRes.data.data) {
          const d = parseRes.data.data;
          if (!autoTitle) autoTitle = d.title || '';
          if (!autoCover) autoCover = d.cover_url || '';
          if (!autoPlatform) autoPlatform = d.platform || '';
        }
      } catch (e) {
        console.error('[Trending] 自动解析失败:', e.message);
      }
    }

    const item = {
      id: genId(),
      url,
      title: autoTitle || '',
      platform: autoPlatform || '',
      cover: autoCover || '',
      desc: desc || '',
      source: 'manual',
      createdAt: Date.now(),
    };

    const items = readManualItems();
    items.unshift(item);
    writeManualItems(items);

    res.json({ retcode: 200, data: item });
  } catch (e) {
    res.status(500).json({ retcode: 500, retdesc: e.message });
  }
});

// 更新
router.put('/trending/manual/:id', (req, res) => {
  const { id } = req.params;
  const { url, title, platform, cover, desc } = req.body;
  const items = readManualItems();
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ retcode: 404, retdesc: '未找到' });

  items[idx] = { ...items[idx], url, title, platform, cover, desc, updatedAt: Date.now() };
  writeManualItems(items);

  res.json({ retcode: 200, data: items[idx] });
});

// 删除
router.delete('/trending/manual/:id', (req, res) => {
  const { id } = req.params;
  let items = readManualItems();
  items = items.filter(i => i.id !== id);
  writeManualItems(items);
  res.json({ retcode: 200 });
});

// ========== B站同步 ==========

router.post('/trending/sync/bilibili', async (req, res) => {
  try {
    const resp = await axios.get('https://api.bilibili.com/x/web-interface/popular', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 10000,
    });

    if (resp.data?.code === 0 && resp.data?.data?.list) {
      const items = resp.data.data.list.map(item => ({
        id: 'bili_' + item.aid,
        title: item.title || '',
        platform: '哔哩哔哩',
        cover: item.pic || '',
        url: `https://www.bilibili.com/video/${item.bvid}`,
        views: item.stat?.view || 0,
        likes: item.stat?.like || 0,
        source: 'bilibili',
        author: item.owner?.name || '',
        desc: item.desc || '',
        syncedAt: Date.now(),
      }));

      // 保存到缓存文件
      const cacheFile = path.join(__dirname, '../../data/trending_bilibili.json');
      const dir = path.dirname(cacheFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify(items, null, 2), 'utf-8');

      res.json({ retcode: 200, data: { count: items.length } });
    } else {
      res.status(500).json({ retcode: 500, retdesc: 'B站API返回异常' });
    }
  } catch (e) {
    res.status(500).json({ retcode: 500, retdesc: '同步失败: ' + e.message });
  }
});

// ========== 合并热门列表（小程序调用） ==========

// 修改原有的 /trending 接口，合并手动+B站数据
const originalTrending = require('./trending');

// 保留原有的 bilibili 数据获取
const fetchBilibiliHot = originalTrending.fetchBilibiliHot;

module.exports = router;
module.exports.readManualItems = readManualItems;
