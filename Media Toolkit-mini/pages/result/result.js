import { downloadCoverToPhotosAlbum, downloadVideoToPhotosAlbum, buildProxiedUrl, needsProxy } from '../../utils/file';
import { copyToClipboard } from '../../utils/clipboard';
import { track } from '../../utils/stats';

Page({
  data: {
    video_url: '',
    title: '',
    cover_url: '',
    video_id: '',
    platform: '',
    platformColor: '',
    image_list: [],
    isDownloading: false,
    hasDownloaded: false,
    downloadBtnText: '下载视频',
    audio_url: '',
    quality_options: [],
    selectedQn: 0,
    fileSize: '',
    fileSizeBytes: 0,
    resolution: '',
    resolutionDesc: '',
    duration: '',
    titleExpanded: false,
    titleNeedExpand: false,
  },

  // 跟踪进行中的下载任务，页面销毁时取消
  _downloadAbort: null,
  _audioDownloadTask: null,
  _isDestroyed: false,

  onLoad: async function() {
    this._isDestroyed = false;

    const result = wx.getStorageSync('current_result');
    if (!result) {
      wx.showToast({ title: '解析结果已过期', icon: 'none' });
      setTimeout(() => {
        wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) });
      }, 1500);
      return;
    }

    this._loadResult(result);
  },

  async _loadResult(result) {
    const platformColors = {
      '抖音': '#000000', '快手': '#FF4906', '小红书': '#FE2C55',
      '哔哩哔哩': '#FB7299', 'YouTube': '#FF0000', 'TikTok': '#000000',
      'Instagram': '#E4405F', 'Twitter': '#000000',
    };

    const fileSize = this.formatFileSize(result.fileSizeBytes || result.fileSize || 0);
    const resolution = this.parseResolution(result.resolution || '');

    const imageList = result.image_list || [];
    const livePhotos = imageList.filter(img => img && typeof img === 'object' && img.live_photo_url);
    const hasLivePhoto = livePhotos.length > 0;

    let downloadBtnText = '下载视频';
    if (hasLivePhoto && !result.video_url) {
      downloadBtnText = livePhotos.length > 1 ? '下载图片' : '下载实况';
    } else if (imageList.length > 0 && !result.video_url) {
      downloadBtnText = '下载图片';
    }

    // CDN需要代理，避免403
    let videoUrl = result.video_url || '';
    if (videoUrl && needsProxy(videoUrl)) {
      try {
        const proxied = await buildProxiedUrl(videoUrl, `${result.video_id || 'video'}.mp4`);
        if (proxied) videoUrl = proxied;
      } catch (e) {}
    }

    this.setData({
      video_url: videoUrl,
      title: result.title || '',
      cover_url: result.cover_url || '',
      video_id: result.video_id || '',
      platform: result.platform || '',
      platformColor: platformColors[result.platform] || '#07c160',
      image_list: imageList,
      audio_url: result.audio_url || '',
      fileSize: fileSize,
      fileSizeBytes: result.fileSizeBytes || 0,
      resolution: resolution.tag,
      resolutionDesc: resolution.desc,
      duration: result.duration || '',
      quality_options: (result.quality_options || []).map(function(q) { return { ...q, qnClass: '' }; }),
      titleNeedExpand: (result.title || '').length > 30,
      hasLivePhoto: hasLivePhoto,
      livePhotos: livePhotos,
      currentImageIndex: 0,
      downloadBtnText: downloadBtnText,
    });

    // 标记第一个画质为选中
    if (this.data.quality_options.length > 0) {
      var opts = this.data.quality_options;
      if (opts.length > 0) opts[0].qnClass = 'on';
      this.setData({ quality_options: opts, selectedQn: opts.length > 0 ? opts[0].qn : 0 });
    }
    track('result_view', { platform: this.data.platform });
  },

  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '未知';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  },

  parseResolution(resolution) {
    if (!resolution) return { tag: 'HD', desc: '高清' };
    const res = resolution.toLowerCase();
    if (res.includes('2160') || res.includes('4k')) return { tag: '4K', desc: '2160P' };
    if (res.includes('1440')) return { tag: '2K', desc: '1440P' };
    if (res.includes('1080')) return { tag: 'FHD', desc: '1080P' };
    if (res.includes('720')) return { tag: 'HD', desc: '720P' };
    if (res.includes('480')) return { tag: 'SD', desc: '480P' };
    if (res.includes('360')) return { tag: 'LD', desc: '360P' };
    return { tag: 'HD', desc: resolution };
  },

  onToggleTitle() {
    this.setData({ titleExpanded: !this.data.titleExpanded });
  },

  onShareTap() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  onUnload: function() {
    this._isDestroyed = true;
    this._stopVideo();
    this._cancelAllDownloads();
  },

  onHide: function() {
    // 页面隐藏时停止视频播放
    this._stopVideo();
  },

  _stopVideo() {
    // 停止视频播放，防止悬浮
    if (this._videoContext) {
      this._videoContext.stop();
      this._videoContext = null;
    }
  },

  onVideoInit(e) {
    this._videoContext = e.detail;
  },

  _cancelAllDownloads() {
    if (this._downloadAbort) {
      this._downloadAbort();
      this._downloadAbort = null;
    }
    if (this._audioDownloadTask) {
      this._audioDownloadTask.abort();
      this._audioDownloadTask = null;
    }
    if (this.data.isDownloading) {
      this.setData({ isDownloading: false, downloadBtnText: '下载视频' });
    }
  },

  // 图片预览
  onPreviewImage(e) {
    const src = e.currentTarget.dataset.src;
    const urls = this.data.image_list.map(function(item) { return item.url || item; });
    wx.previewImage({
      current: src,
      urls: urls
    });
  },

  // 下载按钮点击
  onDownloadTap() {
    // 实况照片：直接下载所有实况视频
    if (this.data.hasLivePhoto && !this.data.video_url) {
      this._downloadLivePhotos();
      return;
    }
    // 普通图集：下载所有图片
    if (this.data.image_list.length > 0 && !this.data.video_url) {
      this.onSaveAllImages();
      return;
    }
    // 视频
    if (!this.data.video_url) {
      wx.showToast({ title: '没有可下载的内容', icon: 'none' });
      return;
    }
    if (this.data.isDownloading) {
      this._showCancelConfirm();
    } else {
      this._startDownload();
    }
  },

  // 下载实况照片
  async _downloadLivePhotos() {
    const photos = this.data.livePhotos;
    if (!photos.length) return;

    this.setData({ isDownloading: true, downloadBtnText: '下载中...' });
    let successCount = 0;

    for (let i = 0; i < photos.length; i++) {
      const url = photos[i].live_photo_url;
      if (!url) continue;
      try {
        await new Promise((resolve) => {
          wx.downloadFile({
            url: url, timeout: 120000,
            success: (res) => {
              if (res.statusCode === 200) {
                wx.saveVideoToPhotosAlbum({
                  filePath: res.tempFilePath,
                  success: () => { successCount++; resolve(); },
                  fail: () => resolve()
                });
              } else { resolve(); }
            },
            fail: () => resolve()
          });
        });
      } catch (e) {}
    }

    this.setData({ isDownloading: false, downloadBtnText: successCount > 0 ? '已保存 ✓' : '下载实况' });
    if (successCount > 0) {
      wx.showToast({ title: `已保存${successCount}个实况`, icon: 'success' });
    }
  },

  // 保存图集
  async onSaveAllImages() {
    const images = this.data.image_list;
    if (!images.length) return;

    wx.showModal({
      title: '下载图集',
      content: `确定下载全部 ${images.length} 张图片？`,
      confirmText: '下载',
      confirmColor: '#07c160',
      success: async (res) => {
        if (!res.confirm) return;

        this.setData({ isDownloading: true, downloadBtnText: '下载中...' });
        let successCount = 0;

        for (let i = 0; i < images.length; i++) {
          const rawUrl = images[i].url || images[i];
          if (!rawUrl) continue;
          // 第三方域名走代理，避免微信白名单报错
          const url = needsProxy(rawUrl) ? (await buildProxiedUrl(rawUrl, 'image.jpg').catch(() => rawUrl)) : rawUrl;
          try {
            await new Promise((resolve) => {
              wx.downloadFile({
                url: url, timeout: 60000,
                success: (res) => {
                  if (res.statusCode === 200) {
                    wx.saveImageToPhotosAlbum({
                      filePath: res.tempFilePath,
                      success: () => { successCount++; resolve(); },
                      fail: () => resolve()
                    });
                  } else { resolve(); }
                },
                fail: () => resolve()
              });
            });
          } catch (e) {}
        }

        this.setData({ isDownloading: false, downloadBtnText: successCount > 0 ? '已保存 ✓' : '下载图集' });
        if (successCount > 0) {
          wx.showToast({ title: `已保存${successCount}张图片`, icon: 'success' });
        }
      }
    });
  },

  // 开始下载
  async _startDownload() {
    if (!this.data.video_url) {
      wx.showToast({ title: '没有可下载的视频', icon: 'none' });
      return;
    }

    this.setData({ isDownloading: true, downloadBtnText: '点击取消下载' });
    track('download_start', { platform: this.data.platform, type: 'video' });

    try {
      const task = await downloadVideoToPhotosAlbum(this.data.video_url, this.data.video_id);
      this._downloadAbort = function() { task.abort(); };
      await task.promise;
      this._downloadAbort = null;

      if (this._isDestroyed) return;

      this.setData({ hasDownloaded: true, downloadBtnText: '已保存 ✓', isDownloading: false });
      track('download_success', { platform: this.data.platform, type: 'video' });

      wx.showModal({
        title: '下载完成',
        content: '视频已保存到相册！',
        showCancel: false,
        confirmText: '好的',
        confirmColor: '#07c160',
      });
    } catch (err) {
      this._downloadAbort = null;
      if (this._isDestroyed) return;
      
      if (err && err.errMsg && err.errMsg.includes('cancel')) {
        this.setData({ isDownloading: false, downloadBtnText: '下载视频' });
        return;
      }
      
      const msg = typeof err === 'string' ? err : (err.message || '下载失败');
      wx.showToast({ title: msg, icon: 'none', duration: 3000 });
      track('download_fail', { platform: this.data.platform, type: 'video', error: msg });
      if (!this._isDestroyed) {
        this.setData({ isDownloading: false, downloadBtnText: '下载视频' });
      }
    }
  },

  // 显示取消确认弹窗
  _showCancelConfirm() {
    wx.showModal({
      title: '取消下载',
      content: '确定要取消当前下载吗？',
      confirmText: '确定取消',
      cancelText: '继续下载',
      confirmColor: '#ba1a1a',
      success: (res) => {
        if (res.confirm) {
          this._cancelDownload();
        }
      }
    });
  },

  // 取消下载
  _cancelDownload() {
    if (this._downloadAbort) {
      this._downloadAbort();
      this._downloadAbort = null;
    }
    if (this._audioDownloadTask) {
      this._audioDownloadTask.abort();
      this._audioDownloadTask = null;
    }
    this.setData({ isDownloading: false, downloadBtnText: '下载视频' });
    wx.showToast({ title: '下载已取消', icon: 'none' });
    track('download_cancel', { platform: this.data.platform });
  },

  // 下载封面
  onDownloadCover: async function() {
    if (!this.data.cover_url) {
      wx.showToast({ title: '没有封面可下载', icon: 'none' });
      return;
    }
    track('download_start', { platform: this.data.platform, type: 'cover' });

    try {
      const result = downloadCoverToPhotosAlbum(this.data.cover_url, true, (err) => {
        wx.showToast({ title: '封面下载失败', icon: 'none' });
      });
      this._downloadAbort = result.abort;
      await result.promise;
    } catch (err) {
      // handled by callback
    }
  },

  // 提取音频
  async onExtractAudio() {
    const audioUrl = this.data.audio_url;
    if (!audioUrl) {
      wx.showToast({ title: '暂无音频可提取', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '准备下载...' });

    try {
      // 通过代理下载（处理外链签名）
      const videoId = this.data.video_id || 'audio';
      const proxyUrl = await buildProxiedUrl(audioUrl, videoId + '.m4a');

      if (!proxyUrl) {
        wx.hideLoading();
        wx.showToast({ title: '获取下载链接失败', icon: 'none' });
        return;
      }

      wx.showLoading({ title: '下载中 0%' });

      this._audioDownloadTask = wx.downloadFile({
        url: proxyUrl,
        timeout: 120000,
        success: (res) => {
          this._audioDownloadTask = null;
          wx.hideLoading();
          if (this._isDestroyed) return;
          if (res.statusCode !== 200) {
            wx.showToast({ title: '下载失败(' + res.statusCode + ')', icon: 'none' });
            return;
          }
          // 保存到本地永久文件
          wx.saveFile({
            tempFilePath: res.tempFilePath,
            success: (saveRes) => {
              if (this._isDestroyed) return;
              const savedPath = saveRes.savedFilePath;
              wx.showModal({
                title: '音频已保存',
                content: '音频文件已保存到本地，你可以分享给朋友或导出使用。',
                confirmText: '分享文件',
                cancelText: '好的',
                confirmColor: '#00c853',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.shareFileMessage({
                      filePath: savedPath,
                      fileName: (this.data.title || '音频') + '.m4a',
                      fail: () => {
                        wx.showToast({ title: '分享失败', icon: 'none' });
                      }
                    });
                  }
                }
              });
            },
            fail: () => {
              if (this._isDestroyed) return;
              wx.showToast({ title: '保存失败，请重试', icon: 'none' });
            }
          });
        },
        fail: (err) => {
          this._audioDownloadTask = null;
          wx.hideLoading();
          if (this._isDestroyed) return;
          console.error('[audio] 下载失败:', err);
          wx.showToast({ title: '下载失败，请检查网络', icon: 'none' });
        }
      });

      this._audioDownloadTask.onProgressUpdate((res) => {
        if (!this._isDestroyed) {
          wx.showLoading({ title: '下载中 ' + res.progress + '%' });
        }
      });

    } catch (e) {
      wx.hideLoading();
      if (this._isDestroyed) return;
      console.error('[audio] 异常:', e);
      wx.showToast({ title: '提取失败，请重试', icon: 'none' });
    }
  },

  // 图集滑动切换
  onImageSwiperChange(e) {
    this.setData({ currentImageIndex: e.detail.current });
  },

  // 点击缩略图切换
  onTapThumb(e) {
    const idx = e.currentTarget.dataset.index;
    this.setData({ currentImageIndex: idx });
  },

  // 预览所有图片（全屏左右滑动）
  onPreviewAllImages() {
    const urls = this.data.image_list.map(function(item) { return item.url || item; });
    const current = urls[this.data.currentImageIndex] || urls[0];
    if (urls.length > 0) {
      wx.previewImage({ current: current, urls: urls });
    }
  },

  // 复制文案
  onCopyText() {
    const title = this.data.title;
    if (!title) {
      wx.showToast({ title: '暂无可复制的文案', icon: 'none' });
      return;
    }
    copyToClipboard(title, { title: '文案已复制' });
  },

  onShareAppMessage: function () {
    track('share', { from: 'result', platform: this.data.platform });
    const titleText = (this.data.title || '未知视频').substring(0, 15);
    return {
      title: '我在小辣椒去水印精灵解析了「' + titleText + '...」，超好用！',
      path: '/pages/index/index',
      imageUrl: this.data.cover_url || '/images/share-cover.png'
    };
  },

  onShareTimeline: function () {
    return {
      title: '小辣椒去水印精灵 — ' + this.data.platform + '视频一键下载',
      query: '',
      imageUrl: this.data.cover_url || '/images/share-cover.png'
    };
  },
});
