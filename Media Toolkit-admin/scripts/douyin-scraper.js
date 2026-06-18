#!/usr/bin/env node
/**
 * 抖音分享链接采集脚本
 * 使用 Puppeteer 模拟真实用户浏览 Douyin，通过 feed API 采集视频分享链接
 * 定时运行（每 30 分钟），结果存入 data/trending.json
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const sleep = ms => new Promise(r => setTimeout(r, ms));

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'trending.json');
const LOG_FILE = path.join(DATA_DIR, 'scraper.log');

function log(msg) {
  const line = '[' + new Date().toISOString() + '] ' + msg;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch (e) {}
}

function genId() {
  return 'tr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch (e) {}
  return [];
}

function saveData(items) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8');
}

function getCookieString() {
  try {
    var cookies = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cookies.json'), 'utf-8'));
    return cookies.douyin ? cookies.douyin.cookie : '';
  } catch (e) { return ''; }
}

async function scrapeDouyin() {
  log('=== 开始采集抖音分享链接 ===');
  var cookieString = getCookieString();
  if (!cookieString) { log('抖音 Cookie 未配置，跳过'); return []; }

  var browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu', '--no-first-run', '--no-zygote', '--single-process',
      '--disable-blink-features=AutomationControlled', '--lang=zh-CN'],
  });

  try {
    var page = await browser.newPage();
    await page.evaluateOnNewDocument(function() {
      Object.defineProperty(navigator, 'webdriver', { get: function() { return false; } });
    });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    var cookieArr = cookieString.split(';').map(function(c) {
      var parts = c.trim().split('=');
      return { name: parts[0].trim(), value: parts.slice(1).join('=').trim(), domain: '.douyin.com', path: '/' };
    }).filter(function(c) { return c.name && c.value; });
    await page.setCookie.apply(page, cookieArr);

    log('访问抖音推荐页...');
    await page.goto('https://www.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(5000);

    // 多次调用 feed API 获取推荐视频
    log('调用 feed API 获取推荐视频...');
    var seen = {};
    var apiItems = [];
    for (var i = 0; i < 8; i++) {
      var feedData = await page.evaluate(async function() {
        try {
          var msToken = Math.random().toString(36).slice(2) + '='.repeat(85);
          var url = 'https://www.douyin.com/aweme/v1/web/tab/feed/?device_platform=webapp&aid=6383&channel=channel_pc_web&count=20&msToken=' + msToken;
          var resp = await fetch(url, { credentials: 'include' });
          return await resp.json();
        } catch (e) { return { error: e.message }; }
      });

      if (feedData.aweme_list && feedData.aweme_list.length > 0) {
        var newCount = 0;
        for (var j = 0; j < feedData.aweme_list.length; j++) {
          var aweme = feedData.aweme_list[j].aweme_info || feedData.aweme_list[j];
          if (aweme.aweme_id && aweme.share_url && !seen[aweme.aweme_id]) {
            seen[aweme.aweme_id] = true;
            apiItems.push({
              id: aweme.aweme_id,
              url: aweme.share_url,
              desc: (aweme.desc || '').slice(0, 100),
              cover: (aweme.video && aweme.video.dynamic_cover && aweme.video.dynamic_cover.url_list && aweme.video.dynamic_cover.url_list[0]) || '',
              author: aweme.author ? aweme.author.nickname : '',
            });
            newCount++;
          }
        }
        log('Feed API 第' + (i + 1) + '轮: ' + feedData.aweme_list.length + '条, 新增' + newCount + '条');
      } else {
        log('Feed API 第' + (i + 1) + '轮: 无数据');
      }
      if (i < 7) await sleep(1000);
    }

    log('Feed API 共获取 ' + apiItems.length + ' 条视频');

    // 构造结果
    var results = apiItems.map(function(item) {
      return {
        id: genId(),
        source: 'douyin',
        title: (item.desc || '').slice(0, 100),
        cover: item.cover,
        platform: '抖音',
        author: item.author,
        heat: 0,
        url: item.url,
        videoUrl: '',
        awemeId: item.id,
        desc: (item.desc || '').slice(0, 100),
        syncedAt: Date.now(),
      };
    });

    log('采集完成: ' + results.length + ' 条分享链接');
    return results;

  } catch (e) {
    log('采集失败: ' + e.message);
    return [];
  } finally {
    await browser.close();
  }
}

async function main() {
  var newItems = await scrapeDouyin();
  if (newItems.length === 0) {
    log('未采集到数据，保留现有数据');
    return;
  }

  var existing = loadData();
  var existingIds = {};
  existing.forEach(function(i) { if (i.awemeId) existingIds[i.awemeId] = true; });
  var added = newItems.filter(function(i) { return !existingIds[i.awemeId]; });
  var merged = added.concat(existing);
  saveData(merged);
  log('已保存: 新增 ' + added.length + ' 条, 总计 ' + merged.length + ' 条');
}

main().catch(function(e) { log('脚本异常: ' + e.message); });
