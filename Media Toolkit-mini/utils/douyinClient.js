/**
 * 抖音视频解析器（客户端直连版）
 * 从小程序直接请求抖音，绕过服务器IP封锁
 */

const BASE_URL = 'https://www.douyin.com';

/**
 * 从小程序端解析抖音视频
 * @param {string} shareUrl - 抖音分享链接或视频链接
 * @returns {Promise<object>} { video_url, title, cover_url, platform }
 */
async function parseDouyinClient(shareUrl) {
  let awemeId = '';

  // 提取 aweme_id — 直接视频链接
  const fullMatch = shareUrl.match(/\/video\/(\d+)/);
  if (fullMatch) {
    awemeId = fullMatch[1];
  }

  // 搜索页链接 — 请求页面提取第一条视频
  if (!awemeId && shareUrl.includes('/search/')) {
    try {
      console.log('[Douyin] 搜索页，尝试提取视频...');
      const html = await fetchPage(shareUrl);
      // 从页面中提取第一个视频 ID
      const videoMatch = html.match(/\/video\/(\d{15,})/);
      if (videoMatch) {
        awemeId = videoMatch[1];
        console.log('[Douyin] 搜索页提取到视频ID:', awemeId);
      }
    } catch (e) {
      console.error('[Douyin] 搜索页请求失败:', e);
    }
  }

  // 短链接
  if (!awemeId && shareUrl.includes('v.douyin.com')) {
    try {
      const html = await fetchPage(shareUrl);
      const m = html.match(/\/video\/(\d{15,})/);
      if (m) awemeId = m[1];
    } catch (e) {
      console.error('[Douyin] 短链失败:', e);
    }
  }

  // 热榜页链接 — 提取视频
  if (!awemeId && shareUrl.includes('/hot/')) {
    try {
      console.log('[Douyin] 热榜页，尝试提取视频...');
      const html = await fetchPage(shareUrl);
      const videoMatch = html.match(/\/video\/(\d{15,})/);
      if (videoMatch) {
        awemeId = videoMatch[1];
        console.log('[Douyin] 热榜页提取到视频ID:', awemeId);
      }
    } catch (e) {
      console.error('[Douyin] 热榜页失败:', e);
    }
  }

  if (!awemeId) {
    return { retcode: 400, retdesc: '无法解析视频ID' };
  }

  // 请求视频详情 API
  const detailUrl = `${BASE_URL}/aweme/v1/web/aweme/detail/`
    + `?device_platform=webapp&aid=6383&channel=channel_pc_web`
    + `&aweme_id=${awemeId}`;

  try {
    const res = await wxRequest(detailUrl, {
      header: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Referer': 'https://www.douyin.com/',
        'Accept': 'application/json',
      }
    });

    if (!res || !res.data) {
      return { retcode: 500, retdesc: '请求失败' };
    }

    const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;

    if (data.aweme_detail) {
      const detail = data.aweme_detail;
      const video = detail.video || {};

      // 提取视频 URL
      let videoUrl = null;
      const playAddr = video.play_addr?.url_list || [];
      if (playAddr.length > 0) {
        videoUrl = playAddr[playAddr.length - 1] || playAddr[0];
      } else {
        const bitRate = video.bit_rate || [];
        if (bitRate.length > 0) {
          videoUrl = bitRate[0]?.play_addr?.url_list?.[2] || bitRate[0]?.play_addr?.url_list?.[0];
        }
      }

      const coverUrl = video.cover?.url_list?.[0] || video.origin_cover?.url_list?.[0] || '';
      const author = detail.author || {};

      return {
        retcode: 200,
        data: {
          video_url: videoUrl,
          title: detail.desc || '',
          cover_url: coverUrl,
          author: author.nickname || '',
          platform: '抖音',
          image_list: [],
          audio_url: null,
        }
      };
    }

    // 被过滤或无数据
    if (data.filter_detail) {
      return { retcode: 403, retdesc: '该视频暂不可用' };
    }

    return { retcode: 404, retdesc: '未找到视频' };
  } catch (e) {
    console.error('[Douyin] 解析失败:', e);
    return { retcode: 500, retdesc: '解析失败: ' + e.message };
  }
}

/**
 * 跟随重定向获取最终URL
 */
function followRedirect(url) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: url,
      method: 'GET',
      timeout: 10000,
      success: (res) => {
        // wx.request 会自动跟随重定向，最终 URL 在 filePath 中
        resolve(res.data ? url : url);
      },
      fail: (err) => reject(new Error(err.errMsg))
    });
  });
}

/**
 * 请求页面 HTML
 */
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: url,
      method: 'GET',
      header: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 15000,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve(typeof res.data === 'string' ? res.data : JSON.stringify(res.data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      },
      fail: (err) => reject(new Error(err.errMsg || '请求失败'))
    });
  });
}

/**
 * 封装 wx.request
 */
function wxRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: url,
      method: options.method || 'GET',
      header: options.header || {},
      timeout: 15000,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve(res);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      },
      fail: (err) => reject(new Error(err.errMsg || '请求失败'))
    });
  });
}

module.exports = { parseDouyinClient };
