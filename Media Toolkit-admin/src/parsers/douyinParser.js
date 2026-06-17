const BaseParser = require('./baseParser');
const UrlParser = require('../../utils/urlParser');
const CommonUtils = require('../../utils/douyin_utils/commonUtils');
// path / DOMAIN / SAVE_VIDEO_PATH 已随 downloadAndSave 移除而不再需要

class DouyinParser extends BaseParser {
  static ttwidCache = null;

  constructor(realUrl) {
    super(realUrl);
    this.commonUtils = new CommonUtils();
    this.headers = {
      'sec-ch-ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
      Accept: 'application/json, text/plain, */*',
      'sec-ch-ua-mobile': '?0',
      'User-Agent': this.commonUtils.userAgent,
      'sec-ch-ua-platform': '"Windows"',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    };
    this.msToken = this.commonUtils.getMsToken();
    this.awemeId = UrlParser.getVideoId(this.realUrl);
    this.data = null;
    this.readyPromise = null;
  }

  async _init() {
    if (this.readyPromise) {
      return this.readyPromise;
    }

    // 抖音通过 API 获取数据，不需要 fetchHtmlContent()（省 1-2s 无用的 HTML 下载+重定向）
    this.readyPromise = (async () => {
      this.data = await this.fetchHtmlData();
      return this.data;
    })();

    return this.readyPromise;
  }

  async getTtwid() {
    if (DouyinParser.ttwidCache) {
      return DouyinParser.ttwidCache;
    }

    try {
      const response = await this.session.post(
        'https://ttwid.bytedance.com/ttwid/union/register/',
        {
          region: 'cn',
          aid: 6383,
          need_t: 1,
          service: 'www.douyin.com',
          migrate_priority: 0,
          cb_url_protocol: 'https',
          domain: '.douyin.com',
        },
        {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const cookieHeaders = response.headers['set-cookie'] || [];
      for (const cookie of cookieHeaders) {
        const match = cookie.match(/ttwid=([^;]+)/);
        if (match) {
          DouyinParser.ttwidCache = match[1];
          return match[1];
        }
      }
    } catch (error) {
      console.warn(`Failed to get dynamic ttwid: ${error.message}`);
    }

    return null;
  }

  async fetchHtmlData() {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let ttwid = await this.getTtwid();
      if (!ttwid) {
        ttwid =
          '1%7CvDWCB8tYdKPbdOlqwNTkDPhizBaV9i91KjYLKJbqurg%7C1723536402%7C314e63000decb79f46b8ff255560b29f4d8c57352dad465b41977db4830b4c7e';
      }

      const refererUrl = `https://www.douyin.com/video/${this.awemeId}?previous_page=web_code_link`;
      const playUrl =
        `https://www.douyin.com/aweme/v1/web/aweme/detail/?device_platform=webapp&aid=6383` +
        `&channel=channel_pc_web&aweme_id=${this.awemeId}&msToken=${this.msToken}`;

      const headers = {
        ...this.headers,
        Referer: refererUrl,
        Cookie: `ttwid=${ttwid}`,
      };

      let aBogus = '';
      try {
        aBogus = this.commonUtils.getABogus(playUrl, this.commonUtils.userAgent);
      } catch (error) {
        console.warn(`Failed to generate a_bogus: ${error.message}`);
      }

      const requestUrl = aBogus ? `${playUrl}&a_bogus=${aBogus}` : playUrl;

      try {
        const response = await this.session.get(requestUrl, {
          headers,
          timeout: 8000,
        });
        const data = response.data;

        // 有 filter_detail 说明视频被过滤，不需要重试
        if (data?.filter_detail) {
          console.warn(`[Douyin] 视频被过滤: ${data.filter_detail.filter_reason || 'unknown'}`);
          return data;
        }

        if (data?.aweme_detail || attempt === 1) {
          return data;
        }

        DouyinParser.ttwidCache = null;
      } catch (error) {
        console.error(`请求抖音详情接口异常: ${error.message}`);
        if (attempt === 0) {
          DouyinParser.ttwidCache = null;
          continue;
        }
      }
    }

    return null;
  }

  /**
   * 返回原始 CDN 视频链接（不再下载到服务器，proxyDownload 代理请求即可绕过防盗链）。
   * 原实现每次解析都下载完整视频到服务器导致 parse 接口耗时 30-300s，已移除。
   */
  async getRealVideoUrl() {
    const detail = this.data?.aweme_detail || {};
    const video = detail.video || {};

    // 优先使用 play_addr（douyin 网页播放器实际使用的地址），这是用户在预览里看到的视频
    const playAddr = video.play_addr?.url_list || [];
    if (playAddr.length > 0) {
      const url = playAddr[playAddr.length - 1] || playAddr[0];
      console.log(`[Douyin] getRealVideoUrl using play_addr: ok`);
      return url;
    }

    // 降级到 bit_rate（不同清晰度的备选地址，bit_rate[0] 是最高清但可能和播放器不同）
    const bitRate = video.bit_rate || [];
    if (bitRate.length > 0) {
      const playAddrList = bitRate[0]?.play_addr?.url_list || [];
      const url = playAddrList[2] || playAddrList[0] || null;
      console.log(`[Douyin] getRealVideoUrl using bit_rate[0]: ${url ? 'ok' : 'null'}`);
      return url;
    }

    console.log(`[Douyin] getRealVideoUrl: no video url found`);
    return null;
  }

  getTitleContent() {
    return this.data?.aweme_detail?.desc || '';
  }

  getCoverPhotoUrl() {
    const detail = this.data?.aweme_detail || {};
    const videoCover = detail.video?.dynamic_cover?.url_list?.[0] || null;
    const imagesCover = detail.images?.[0]?.url_list?.[0] || null;
    return videoCover || imagesCover;
  }

  async getAudioUrl() {
    return this.data?.aweme_detail?.music?.play_url?.url_list?.[0] || null;
  }

  getAuthorInfo() {
    const author = this.data?.aweme_detail?.author || {};
    const avatar = author.avatar_thumb?.url_list?.[0] || null;

    if (Object.keys(author).length === 0) {
      return null;
    }

    return {
      nickname: author.nickname || '',
      author_id: author.unique_id || author.short_id || '',
      avatar,
    };
  }

  getImageList() {
    const images = this.data?.aweme_detail?.images || this.data?.aweme_detail?.image_list || [];
    const result = [];

    for (const image of images) {
      if (!image) {
        continue;
      }

      const urls = image.url_list;
      if (!Array.isArray(urls) || urls.length === 0) {
        continue;
      }

      const imageData = urls[urls.length - 1];

      // 实况图视频 URL：优先 play_addr，降级到 bit_rate
      let livePhotoUrl = image.video?.play_addr?.url_list?.[0] || '';
      if (!livePhotoUrl && image.video?.bit_rate) {
        const bitRateList = image.video.bit_rate;
        for (let i = 0; i < bitRateList.length; i++) {
          const brUrls = bitRateList[i]?.play_addr?.url_list || [];
          if (brUrls.length > 0) {
            livePhotoUrl = brUrls[brUrls.length - 1] || brUrls[0] || '';
            break;
          }
        }
      }

      if (livePhotoUrl) {
        result.push({
          url: imageData,
          live_photo_url: livePhotoUrl,
        });
      } else {
        result.push(imageData);
      }
    }

    return result;
  }

  // 视频元数据（分辨率、时长）
  getVideoMetadata() {
    const detail = this.data?.aweme_detail || {};
    const video = detail.video || {};
    
    // 时长（秒）
    const duration = video.duration || 0;
    let durationStr = '';
    if (duration > 0) {
      const secs = Math.floor(duration / 1000);
      const mins = Math.floor(secs / 60);
      const remainingSecs = secs % 60;
      durationStr = `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
    }

    // 分辨率
    let resolution = '';
    const width = video.width || 0;
    const height = video.height || 0;
    if (height >= 2160) resolution = '2160';
    else if (height >= 1440) resolution = '1440';
    else if (height >= 1080) resolution = '1080';
    else if (height >= 720) resolution = '720';
    else if (height >= 480) resolution = '480';
    else if (height >= 360) resolution = '360';

    return {
      resolution,
      duration: durationStr,
      fileSizeBytes: 0,
    };
  }
}

module.exports = DouyinParser;
