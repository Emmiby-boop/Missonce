import { downloadCoverToPhotosAlbum, downloadVideoToPhotosAlbum, buildProxiedUrl } from '../../utils/file';
import { copyToClipboard } from '../../utils/clipboard';
import { truncateString } from '../../utils/util';
import { config } from '../../utils/request';

// 播放时需要代理的域名（CDN 有 referer/CORS/域名白名单 限制）
const PLAY_PROXY_DOMAINS = [
  'bilivideo.com', 'bilibili.com',
  'douyinvod.com', 'idouyinvod.com', 'byteimg.com', 'ixigua.com', 'snssdk.com',
  'douyin.com', 'iesdouyin.com',
  'kuaishou.com', 'yximgs.com', 'kwimgs.com',
  'xhscdn.com', 'xiaohongshu.com',
  'googlevideo.com', 'ytimg.com',
  'twimg.com', 'fbcdn.net',
];
// 可直接下载的白名单（无需代理）
const DIRECT_DOMAINS = ['missonce.cc', 'missonce-99', 'tcloudbaseapp.com', 'wx.qlogo.cn', 'cloudbase.net'];
// 播放用：只代理已知受限域名
function needsProxy(url) {
  if (!url) return false;
  try { return PLAY_PROXY_DOMAINS.some(d => new URL(url).hostname.includes(d)); }
  catch (e) { return false; }
}
// 下载用：第三方域名一律走代理，避免微信域名白名单报错
function needsDownloadProxy(url) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    if (DIRECT_DOMAINS.some(d => host.includes(d))) return false;
    return true;
  } catch (e) { return true; }
}

Page({
  data: {
    hasParams: false, playlist: [], currentIdx: 0, readyIdx: -1, currentItem: {},
    isPlaying: false, hasRetried: false, fromShare: false,
    isImageMode: false, imageList: [], coverVisible: true,
    iconDownload: '/images/icon-download.png',
    iconCover: '/images/icon-cover.png',
    iconShare: '/images/icon-share.png',
  },

  _videoCtx: null,
  _downloadTasks: [],

  onLoad: async function (options) {
    const { url, cover, title, videoid, fromShare, source } = options;
    const cachedResult = wx.getStorageSync('current_result');
    const isImageMode = !url && cachedResult && cachedResult.image_list && cachedResult.image_list.length > 0;

    if (isImageMode) {
      const rawImages = cachedResult.image_list.map(img => ({
        url: typeof img === 'object' ? (img.url || img) : img,
        live_photo_url: typeof img === 'object' ? (img.live_photo_url || '') : '',
      }));
      const imageList = await Promise.all(rawImages.map(async (img) => {
        const proxyUrl = needsDownloadProxy(img.url) ? (await buildProxiedUrl(img.url, 'img.jpg').catch(() => '')) : img.url;
        const proxyLive = img.live_photo_url && needsDownloadProxy(img.live_photo_url)
          ? (await buildProxiedUrl(img.live_photo_url, 'live.mp4').catch(() => '')) : img.live_photo_url;
        return { url: proxyUrl || img.url, live_photo_url: proxyLive || img.live_photo_url };
      }));
      this.setData({
        hasParams: true, isImageMode: true, imageList, currentIdx: 0,
        currentItem: { title: cachedResult.title || '', platform: cachedResult.platform || '', image_list: imageList, cover_url: cachedResult.cover_url || '' },
        fromShare: fromShare === 'true',
      });
      return;
    }
    if (!url) { this.setData({ hasParams: false }); return; }

    const du = decodeURIComponent(url), dc = decodeURIComponent(cover || ''), dt = decodeURIComponent(title || ''), dv = videoid ? decodeURIComponent(videoid) : '';
    let playlist = [], ci = 0;

    // 根据来源构建播放列表
    if (source === 'trending') {
      // 热门来源：从缓存的热门列表构建（只有已解析的才有 video_url）
      const trendingList = wx.getStorageSync('trending_playlist') || [];
      const cache = wx.getStorageSync('trending_parse_cache') || {};
      var parsed = [];
      for (var t = 0; t < trendingList.length; t++) {
        var ti = trendingList[t];
        var cached = cache[ti.url];
        if (cached && cached.video_url) {
          parsed.push({
            video_url: cached.video_url, cover_url: cached.cover_url || ti.cover || '',
            title: cached.title || ti.title || '', video_id: cached.video_id || '',
            platform: cached.platform || ti.platform || '', author: cached.author || {},
            audio_url: cached.audio_url || '', idx: parsed.length,
          });
        }
      }
      if (parsed.length > 0) {
        playlist = parsed;
        ci = parsed.findIndex(function(p) { return p.video_url === du || p.video_id === dv; });
        ci = ci >= 0 ? ci : 0;
      } else {
        playlist = [{ video_url: du, cover_url: dc, title: dt, video_id: dv, platform: '', author: cachedResult?.author || {}, audio_url: cachedResult?.audio_url || '', idx: 0 }];
      }
    } else {
      // 默认：从历史记录构建
      try {
        const history = wx.getStorageSync('parse_history') || [];
        const recent = [...history].reverse().filter(h => h.video_url);
        if (recent.length > 0) {
          playlist = recent.map((h, i) => ({ video_url: h.video_url, cover_url: h.cover_url || '', title: h.title || '', video_id: h.video_id || '', platform: h.platform || '', author: h.author || {}, audio_url: h.audio_url || '', idx: i }));
          const f = playlist.findIndex(p => p.video_url === du || p.video_id === dv);
          ci = f >= 0 ? f : 0;
        } else {
          playlist = [{ video_url: du, cover_url: dc, title: dt, video_id: dv, platform: '', author: cachedResult?.author || {}, audio_url: cachedResult?.audio_url || '', idx: 0 }];
        }
      } catch (e) {
        playlist = [{ video_url: du, cover_url: dc, title: dt, video_id: dv, platform: '', author: cachedResult?.author || {}, audio_url: cachedResult?.audio_url || '', idx: 0 }];
      }
    }

    const cur = playlist[ci] || playlist[0];
    if (cur) {
      if ((!cur.author || !cur.author.nickname) && cachedResult?.author) cur.author = cachedResult.author;
      if (!cur.audio_url && cachedResult?.audio_url) cur.audio_url = cachedResult.audio_url;
      if (!cur.platform && cachedResult?.platform) cur.platform = cachedResult.platform;
    }

    // 先渲染，后台预代理所有视频
    this.setData({ hasParams: true, playlist, currentIdx: ci, readyIdx: -1, currentItem: cur, fromShare: fromShare === 'true', coverVisible: true });
    // 并行预代理所有视频，代理完成后设 readyIdx 播放当前视频
    this._proxyAllAndPlay(playlist, ci);
  },

  onReady() {},

  onUnload() { this._cleanupOnLeave(); this._stopAll(); },
  onHide() { this._cleanupOnLeave(); },
  _cleanupOnLeave() {
    if (this._left) return;
    this._left = true;
    wx.hideLoading();
    this._downloadTasks.forEach(t => { try { t.abort(); } catch (e) {} });
    this._downloadTasks = [];
  },
  _abortAllDownloads() { this._cleanupOnLeave(); },

  _stopAll() {
    var readyIdx = this.data.readyIdx;
    if (readyIdx >= 0) {
      try { var ctx = wx.createVideoContext('vid_' + readyIdx, this); if (ctx) ctx.stop(); } catch (e) {}
    }
    this._videoCtx = null; this.setData({ isPlaying: false });
  },
  _playIdx(idx) {
    this._stopAll();
    try { this._videoCtx = wx.createVideoContext('vid_' + idx, this); if (this._videoCtx) { this._videoCtx.play(); this.setData({ isPlaying: true }); } } catch (e) {}
  },

  onSwiperChange(e) {
    var idx = e.detail.current;
    if (idx === this.data.currentIdx) return;
    if (!this.data.isImageMode) {
      this._stopAll();
      var item = Object.assign({}, this.data.playlist[idx] || {});
      this.setData({ currentIdx: idx, currentItem: item, hasRetried: false, coverVisible: true });
      // 如果该视频已预代理完成（_proxied），直接播放
      if (item._proxied || !needsProxy(item.video_url) || item.video_url.indexOf(config.baseURL) === 0) {
        this.setData({ readyIdx: idx });
        this._playIdx(idx);
      }
      // 否则等代理完成后自动播放（由 _proxyAllAndPlay 处理）
    } else {
      this.setData({ currentIdx: idx });
    }
  },

  onTapVideo() {
    if (!this._videoCtx) return;
    if (this.data.isPlaying) this._videoCtx.pause(); else this._videoCtx.play();
  },

  onPlay() { this.setData({ isPlaying: true, coverVisible: false }); },
  onPause() { this.setData({ isPlaying: false }); },

  onVideoError() {
    var item = this.data.currentItem;
    if (!item || !item.video_url) return;
    var self = this;
    var playlist = self.data.playlist;
    var idx = self.data.currentIdx;

    if (!item._proxied && needsProxy(item.video_url)) {
      buildProxiedUrl(item.video_url, (item.video_id || 'video') + '.mp4').then(function(proxyUrl) {
        if (!proxyUrl) { wx.showToast({ title: '视频加载失败', icon: 'none' }); return; }
        playlist[idx] = Object.assign({}, playlist[idx], { video_url: proxyUrl, _proxied: true });
        self.setData({ playlist: playlist, currentItem: Object.assign({}, playlist[idx]), readyIdx: -1 });
        wx.nextTick(function() { self.setData({ readyIdx: idx }); self._playIdx(idx); });
      }).catch(function() {
        wx.showToast({ title: '视频加载失败', icon: 'none' });
      });
    } else if (item._proxied && needsProxy(item.video_url) && item.video_id) {
      // 代理后仍 403 → douyin CDN 链接过期，重新解析获取新链接
      console.log('[VideoPlayer] douyin URL 过期，尝试重新解析 video_id:', item.video_id);
      wx.showLoading({ title: '重新获取视频...' });
      var douyinUrl = 'https://www.douyin.com/video/' + item.video_id;
      wx.request({
        url: config.baseURL + '/api/parse',
        method: 'POST',
        data: { text: douyinUrl },
        success: function(res) {
          wx.hideLoading();
          if (res.statusCode === 200 && res.data && res.data.succ && res.data.data && res.data.data.video_url) {
            var newUrl = res.data.data.video_url;
            playlist[idx] = Object.assign({}, playlist[idx], { video_url: newUrl, _proxied: false });
            self.setData({ playlist: playlist, currentItem: Object.assign({}, playlist[idx]), readyIdx: -1 });
            wx.nextTick(function() { self.setData({ readyIdx: idx }); self._playIdx(idx); });
          } else {
            wx.showToast({ title: '视频已失效', icon: 'none' });
          }
        },
        fail: function() {
          wx.hideLoading();
          wx.showToast({ title: '视频已失效', icon: 'none' });
        }
      });
    } else if (!self.data.hasRetried) {
      var url = item.video_url;
      var r = url.indexOf('?') >= 0 ? url + '&_t=' + Date.now() : url + '?_t=' + Date.now();
      playlist[idx] = Object.assign({}, playlist[idx], { video_url: r });
      self.setData({ hasRetried: true, playlist: playlist, readyIdx: -1 });
      wx.nextTick(function() { self.setData({ readyIdx: idx }); self._playIdx(idx); });
    } else {
      wx.showToast({ title: '视频加载失败', icon: 'none' });
    }
  },

  onPreviewImage(e) {
    const idx = e.currentTarget.dataset.index;
    const urls = this.data.imageList.map(img => img.url || img);
    wx.previewImage({ current: urls[idx] || urls[0], urls: urls });
  },

  onSaveCover() {
    const cover = this.data.currentItem.cover_url;
    if (!cover) { wx.showToast({ title: '无封面', icon: 'none' }); return; }
    const r = downloadCoverToPhotosAlbum(cover, true, () => { if (!this._left) wx.showToast({ title: '保存失败', icon: 'none' }); });
    this._downloadTasks.push(r); r.promise.catch(() => {});
  },
  onDownload() {
    if (this.data.isImageMode) { this._saveCurrentImage(); return; }
    const { video_url, video_id } = this.data.currentItem;
    if (!video_url) { wx.showToast({ title: '无视频可下载', icon: 'none' }); return; }
    const r = downloadVideoToPhotosAlbum(video_url, video_id);
    this._downloadTasks.push(r);
    r.promise
      .then(msg => { if (!this._left) wx.showToast({ title: msg, icon: 'success' }); })
      .catch(() => { if (!this._left) wx.showToast({ title: '下载失败', icon: 'none' }); });
  },

  _saveCurrentImage() {
    const images = this.data.imageList;
    const idx = this.data.currentIdx;
    const img = images[idx];
    if (!img) { wx.showToast({ title: '无图片可保存', icon: 'none' }); return; }

    // 实况图：live_photo_url 是视频文件，用视频下载逻辑
    const liveUrl = img.live_photo_url;
    const staticUrl = typeof img === 'object' ? (img.url || img) : img;

    if (liveUrl) {
      const r = downloadVideoToPhotosAlbum(liveUrl, 'live_photo');
      this._downloadTasks.push(r);
      r.promise
        .then(msg => { if (!this._left) wx.showToast({ title: '实况图已保存', icon: 'success' }); })
        .catch(() => { if (!this._left) wx.showToast({ title: '保存失败', icon: 'none' }); });
    } else if (staticUrl) {
      this._downloadImage(staticUrl);
    } else {
      wx.showToast({ title: '图片地址无效', icon: 'none' });
    }
  },

  _downloadImage(rawUrl) {
    wx.showLoading({ title: '保存中...' });
    const doDownload = (url) => {
      const task = wx.downloadFile({
        url, timeout: 60000,
        success: (res) => {
          if (this._left) return;
          wx.hideLoading();
          if (res.statusCode === 200) {
            wx.saveImageToPhotosAlbum({
              filePath: res.tempFilePath,
              success: () => { if (!this._left) wx.showToast({ title: '已保存', icon: 'success' }); },
              fail: () => { if (!this._left) wx.showToast({ title: '保存失败', icon: 'none' }); }
            });
          } else {
            if (!this._left) wx.showToast({ title: '下载失败', icon: 'none' });
          }
        },
        fail: () => {
          wx.hideLoading();
          if (!this._left) wx.showToast({ title: '下载失败', icon: 'none' });
        }
      });
      this._downloadTasks.push(task);
    };

    // 需要代理的域名直接走代理，避免 wx 域名白名单报错
    if (needsDownloadProxy(rawUrl)) {
      buildProxiedUrl(rawUrl, 'image.jpg').then(proxyUrl => {
        if (proxyUrl) doDownload(proxyUrl);
        else { wx.hideLoading(); if (!this._left) wx.showToast({ title: '下载失败', icon: 'none' }); }
      });
    } else {
      doDownload(rawUrl);
    }
  },

  onSaveAllImages() { this._saveAllImages(); },
  onAvatarTap() { const n = (this.data.currentItem.author || {}).nickname; if (n) wx.showToast({ title: '@' + n, icon: 'none' }); },
  onCopyTitle() {
    const title = this.data.currentItem.title;
    if (title) copyToClipboard(title, { title: '文案已复制' });
  },
  async _saveAllImages() {
    const images = this.data.imageList; if (!images.length) return;
    wx.showLoading({ title: '下载中...' }); let count = 0;
    for (const img of images) {
      if (this._left) break;

      // 实况图优先用 live_photo_url（视频）
      const liveUrl = img.live_photo_url;
      const staticUrl = typeof img === 'object' ? (img.url || img) : img;
      const rawUrl = liveUrl || staticUrl;
      if (!rawUrl) continue;

      const isLivePhoto = !!liveUrl;
      const downloadUrl = needsDownloadProxy(rawUrl) ? (await buildProxiedUrl(rawUrl, isLivePhoto ? 'live.mp4' : 'image.jpg')) : rawUrl;
      if (!downloadUrl) continue;

      try {
        await new Promise((resolve) => {
          const task = wx.downloadFile({ url: downloadUrl, timeout: 60000,
            success: (res) => {
              if (res.statusCode === 200) {
                const saveFn = isLivePhoto ? wx.saveVideoToPhotosAlbum : wx.saveImageToPhotosAlbum;
                saveFn({ filePath: res.tempFilePath, success: () => { count++; resolve(); }, fail: () => resolve() });
              } else { resolve(); }
            },
            fail: () => resolve()
          });
          this._downloadTasks.push(task);
        });
      } catch (e) {}
    }
    wx.hideLoading(); if (!this._left && count > 0) wx.showToast({ title: `已保存${count}张`, icon: 'success' });
  },

  onShareAppMessage() {
    const { video_url, cover_url, title, video_id } = this.data.currentItem;
    return { title: truncateString(title, 35) || '这个视频太赞了！', path: `/pages/videoPlayer/videoPlayer?url=${encodeURIComponent(video_url || '')}&cover=${encodeURIComponent(cover_url || '')}&videoid=${encodeURIComponent(video_id || '')}&title=${encodeURIComponent(title || '')}&fromShare=true`, imageUrl: cover_url || '/images/share-cover.png' };
  },
  onShareTimeline() {
    const { video_url, cover_url, title, video_id } = this.data.currentItem;
    return { title: '分享一个去水印神器', query: `url=${encodeURIComponent(video_url || '')}&cover=${encodeURIComponent(cover_url || '')}&videoid=${encodeURIComponent(video_id || '')}&title=${encodeURIComponent(title || '')}&fromShare=true`, imageUrl: cover_url || '/images/share-cover.png' };
  },

  // 预代理当前+后续2个视频，当前视频代理完成后立即播放
  _proxyAllAndPlay(playlist, currentIdx) {
    var self = this;
    var tasks = [];
    var end = Math.min(currentIdx + 3, playlist.length);

    for (var i = currentIdx; i < end; i++) {
      (function(idx) {
        var item = playlist[idx];
        if (!item || !item.video_url) return;
        if (item._proxied || !needsProxy(item.video_url) || item.video_url.indexOf(config.baseURL) === 0) {
          playlist[idx] = Object.assign({}, playlist[idx], { _proxied: true });
          return;
        }
        if (item._proxyPending) return;
        item._proxyPending = true;
        var task = buildProxiedUrl(item.video_url, (item.video_id || 'video') + '.mp4').then(function(proxyUrl) {
          if (proxyUrl && playlist[idx]) {
            playlist[idx] = Object.assign({}, playlist[idx], { video_url: proxyUrl, _proxied: true, _proxyPending: false });
            // 如果代理完成的是当前视频，立即播放
            if (idx === self.data.currentIdx && self.data.readyIdx === -1) {
              self.setData({ playlist: playlist, currentItem: Object.assign({}, playlist[idx]), readyIdx: idx });
              self._playIdx(idx);
            }
          }
        }).catch(function() {
          if (playlist[idx]) playlist[idx]._proxyPending = false;
        });
        tasks.push(task);
      })(i);
    }

    // 如果当前视频不需要代理，直接播放
    var cur = playlist[currentIdx];
    if (cur && (cur._proxied || !needsProxy(cur.video_url) || cur.video_url.indexOf(config.baseURL) === 0)) {
      playlist[currentIdx] = Object.assign({}, playlist[currentIdx], { _proxied: true });
      this.setData({ playlist: playlist, readyIdx: currentIdx });
      this._playIdx(currentIdx);
    }

    Promise.allSettled(tasks);
  },
});
