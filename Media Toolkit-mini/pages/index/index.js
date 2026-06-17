import { request } from '../../utils/request';
import { getClipboardData } from '../../utils/clipboard';
import { extractUrl } from '../../utils/util';
import { showToast } from '../../utils/ui';
import { getUserMessage } from '../../utils/errorHandler';
import { track } from '../../utils/stats';
import { isLoggedIn, getUserInfo, syncHistoryToCloud, fetchHistoryFromCloud, mergeHistory, silentLogin } from '../../utils/auth';

Page({
  data: {
    inputValue: '',
    isLoading: false,
    parseStepText: '',
    showGuide: false,
    userInfo: null,
    isLoggedIn: false,
    platforms: [
      { key: 'douyin', name: '抖音', bg: '#000000', icon: 'https://cdn.simpleicons.org/tiktok/ffffff' },
      { key: 'kuaishou', name: '快手', bg: '#FF4906', icon: 'https://cdn.simpleicons.org/kuaishou/ffffff' },
      { key: 'xiaohongshu', name: '小红书', bg: '#FE2C55', icon: 'https://cdn.simpleicons.org/xiaohongshu/ffffff' },
      { key: 'bilibili', name: '哔哩哔哩', bg: '#FB7299', icon: 'https://cdn.simpleicons.org/bilibili/ffffff' },
      { key: 'weixin', name: '视频号', bg: '#07C160', icon: 'https://cdn.simpleicons.org/wechat/ffffff' },
      { key: 'youtube', name: 'YouTube', bg: '#FF0000', icon: 'https://cdn.simpleicons.org/youtube/ffffff' },
      { key: 'instagram', name: 'Instagram', bg: '#E4405F', icon: 'https://cdn.simpleicons.org/instagram/ffffff' },
      { key: 'twitter', name: 'Twitter', bg: '#000000', icon: 'https://cdn.simpleicons.org/x/ffffff' },
    ],
  },

  onShow() {
    const trendingUrl = wx.getStorageSync('trending_url');
    if (trendingUrl) {
      wx.removeStorageSync('trending_url');
      this.setData({ inputValue: trendingUrl });
      setTimeout(() => this.onSubmit(), 300);
    }
    
    // 同步登录状态
    this._syncLoginState();

    // 每次进入首页时后台同步历史记录
    this._bgSyncHistory();

    // 获取滚动公告
    this._fetchNotice();

    // 后台预缓存热门视频解析结果（不阻塞 UI）
    this._bgPrecacheTrending();
  },

  _fetchNotice() {
    // 优先走API读后台数据库，失败则尝试本地CloudBase
    wx.request({
      url: 'https://api.missonce.cc/api/announcement',
      success: (res) => {
        if (res.data?.success && res.data?.data) {
          this.setData({ noticeText: res.data.data.content, noticeUrl: res.data.data.url || '' });
        }
      },
      fail: () => {
        // API不可用时尝试本地CloudBase
        try {
          const db = wx.cloud.database();
          db.collection('notifications').where({ status: 'active' }).limit(1).get()
            .then(r => { if (r.data?.[0]) this.setData({ noticeText: r.data[0].content || '' }); })
            .catch(() => {});
        } catch (e) {}
      }
    });
  },

  onNoticeTap() {
    if (this.data.noticeUrl) {
      wx.navigateTo({ url: this.data.noticeUrl, fail: () => {} });
    }
  },

  _syncLoginState() {
    const loggedIn = isLoggedIn();
    const userInfo = getUserInfo();
    this.setData({
      isLoggedIn: loggedIn,
      userInfo: userInfo,
    });
  },

  _bgSyncHistory() {
    if (!isLoggedIn()) return;
    fetchHistoryFromCloud().then(cloudList => {
      const raw = wx.getStorageSync('parse_history') || [];
      // 本地有数据时以本地为准（含删除操作），不再从云端合并
      if (raw.length > 0) {
        // 只上传本地到云端，不下载合并
        syncHistoryToCloud(raw).catch(() => {});
      } else if (cloudList && cloudList.length > 0) {
        // 本地为空时从云端恢复（新设备首次同步）
        const merged = mergeHistory(raw, cloudList);
        wx.setStorageSync('parse_history', merged);
        syncHistoryToCloud(merged).catch(() => {});
      }
    }).catch(() => {});
  },

  // 后台预缓存热门视频解析结果（不阻塞 UI，静默执行）
  _bgPrecacheTrending() {
    var self = this;
    try {
      var cache = wx.getStorageSync('trending_parse_cache') || {};
      var cacheKeys = Object.keys(cache);
      if (cacheKeys.length >= 5) return;
      if (self._precacheRunning) return;
      self._precacheRunning = true;

      var doPrecache = function(list) {
        var items = list.filter(function(i) { return i.url && !cache[i.url]; }).slice(0, 5);
        if (!items.length) { self._precacheRunning = false; return; }
        var chain = Promise.resolve();
        items.forEach(function(item) {
          chain = chain.then(function() {
            return request('/api/parse', { method: 'POST', data: { text: item.url } }).then(function(r) {
              if (r.retcode === 200 && r.data) {
                var c = wx.getStorageSync('trending_parse_cache') || {};
                c[item.url] = {
                  video_url: r.data.video_url || '', title: r.data.title || '',
                  cover_url: r.data.cover_url || '', video_id: r.data.video_id || '',
                  platform: r.data.platform || '', image_list: r.data.image_list || [],
                  audio_url: r.data.audio_url || '', quality_options: r.data.quality_options || [],
                  duration: r.data.duration || '', timestamp: Date.now(),
                };
                wx.setStorageSync('trending_parse_cache', c);
              }
            }).catch(function() {});
          });
        });
        return chain;
      };

      // 优先用 app.js 预拉取的缓存
      var trendingList = wx.getStorageSync('trending_cache') || [];
      if (trendingList.length > 0) {
        doPrecache(trendingList).then(function() { self._precacheRunning = false; }).catch(function() { self._precacheRunning = false; });
      } else {
        // 缓存为空时从 API 拉取
        request('/api/trending/merged').then(function(res) {
          if (res.retcode === 200 && res.data && res.data.list) {
            wx.setStorageSync('trending_cache', res.data.list);
            wx.setStorageSync('trending_cache_time', Date.now());
            return doPrecache(res.data.list);
          }
          self._precacheRunning = false;
        }).then(function() { self._precacheRunning = false; }).catch(function() { self._precacheRunning = false; });
      }
    } catch (e) { self._precacheRunning = false; }
  },

  onAvatarTap() {
    if (this.data.isLoggedIn) {
      // 已登录，显示用户信息
      wx.showModal({
        title: '用户信息',
        content: `昵称：${this.data.userInfo?.nickName || '未设置'}\n已登录可同步解析历史`,
        showCancel: false,
        confirmText: '好的',
        confirmColor: '#07c160',
      });
    } else {
      // 未登录，引导登录
      wx.showModal({
        title: '登录',
        content: '登录后可同步解析历史记录到云端，换设备也不丢失',
        confirmText: '一键登录',
        cancelText: '暂不登录',
        confirmColor: '#07c160',
        success: async (res) => {
          if (res.confirm) {
            try {
              wx.showLoading({ title: '登录中...' });
              const userInfo = await silentLogin();
              wx.hideLoading();
              if (userInfo) {
                this.setData({
                  isLoggedIn: true,
                  userInfo: userInfo,
                });
                wx.showToast({ title: '登录成功', icon: 'success' });
              } else {
                wx.showToast({ title: '登录失败', icon: 'none' });
              }
            } catch (e) {
              wx.hideLoading();
              wx.showToast({ title: '登录失败', icon: 'none' });
            }
          }
        }
      });
    }
  },

  onLoad() {
    track('page_view', { page: 'index' });
  },

  onPlatformTap(e) {
    const key = e.currentTarget.dataset.key;
    const samples = {
      douyin: 'https://v.douyin.com/xxxxx/',
      kuaishou: 'https://v.kuaishou.com/xxxxx/',
      bilibili: 'https://www.bilibili.com/video/BVxxxxxx/',
      xiaohongshu: 'https://www.xiaohongshu.com/xxxxx/',
      tiktok: 'https://www.tiktok.com/@xxx/video/xxxxx/',
      youtube: 'https://youtube.com/shorts/xxxxx/',
      instagram: 'https://www.instagram.com/reel/xxxxx/',
      twitter: 'https://twitter.com/xxx/status/xxxxx/',
    };
    if (samples[key]) {
      this.setData({ inputValue: samples[key] });
    } else if (key === 'weixin') {
      showToast('请从视频号复制链接后粘贴', 'none', 1500);
    } else {
      showToast('更多平台持续接入中', 'none', 1500);
    }
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value });
  },

  doPaste: async function() {
    try {
      const data = await getClipboardData();
      if (data) {
        this.setData({ inputValue: data });
        showToast('已粘贴', 'success', 1000);
      } else {
        showToast('剪贴板无内容', 'none', 1500);
      }
    } catch (error) {
      showToast('请在设置中开启剪切板权限', 'none', 1500);
    }
  },

  onPasteAction() {
    this.doPaste();
  },

  onClearInput() {
    this.setData({ inputValue: '' });
  },

  async onSubmit() {
    if (this.data.isLoading) return;
    const { inputValue } = this.data;

    if (!inputValue || !inputValue.trim()) {
      showToast('请粘贴视频分享链接', 'none', 2000);
      return;
    }

    const url = extractUrl(inputValue);
    if (!url) {
      showToast('未识别到有效链接', 'none', 2000);
      return;
    }

    this.setData({ isLoading: true, parseStepText: '正在识别链接...' });

    try {
      const response = await request('/api/parse', {
        method: 'POST',
        data: { text: url }
      });

      if (response.retcode !== 200) {
        const msg = getUserMessage(response);
        showToast(msg, 'none', 2500);
        track('parse_fail', { error: response.retcode });
        this.setData({ isLoading: false, parseStepText: '' });
        return;
      }

      const data = response.data;
      this.setData({ parseStepText: '提取完成' });

      if (!data.video_url && (!data.image_list || data.image_list.length === 0)) {
        showToast('未找到可下载的媒体内容', 'none', 2000);
        track('parse_empty', { platform: data.platform });
        this.setData({ isLoading: false, parseStepText: '' });
        return;
      }

      // 有数据了再跳转
      wx.setStorageSync('current_result', {
        video_url: data.video_url || '',
        title: data.title || '',
        cover_url: data.cover_url || '',
        video_id: data.video_id || '',
        platform: data.platform || '',
        image_list: data.image_list || [],
        audio_url: data.audio_url || '',
        quality_options: data.quality_options || [],
        real_url: data.real_url || '',
        fileSizeBytes: data.fileSizeBytes || 0,
        resolution: data.resolution || '',
        duration: data.duration || '',
        timestamp: Date.now(),
      });

      track('parse_success', { platform: data.platform });
      this.saveHistory(data);
      wx.navigateTo({ url: '/pages/result/result' });

    } catch (error) {
      const msg = error.message || error.errMsg || '网络异常，请重试';
      showToast(msg, 'none', 2000);
      track('network_error', { error: msg });
    } finally {
      this.setData({ isLoading: false, parseStepText: '' });
    }
  },

  saveHistory(data) {
    try {
      let list = wx.getStorageSync('parse_history') || [];
      // 去重：仅当 video_id 有效时才剔除旧记录
      const vid = data.video_id;
      if (vid) {
        list = list.filter(item => item.video_id !== vid);
      }
      if (list.length >= 100) list = list.slice(-99);
      list.push({
        video_id: data.video_id || '',
        title: data.title || '',
        cover_url: data.cover_url || '',
        video_url: data.video_url || '',
        platform: data.platform || '',
        image_list: data.image_list || [],
        audio_url: data.audio_url || '',
        author: data.author || {},
        timestamp: Date.now()
      });
      wx.setStorageSync('parse_history', list);
      // 同步到云端
      if (isLoggedIn()) {
        syncHistoryToCloud(list).catch(() => {});
      }
    } catch (e) {}
  },

  onShowGuide() {
    this.setData({ showGuide: true });
    track('guide_view', {});
  },

  onHideGuide() {
    this.setData({ showGuide: false });
  },

  onHelpTap() {
    wx.navigateTo({ url: '/pages/questions/questions' });
  },

  onShareTap() {
    track('share', { from: 'index' });
  },

  noop() {},

  onShareAppMessage() {
    track('share', { from: 'index' });
    return {
      title: '小辣椒去水印精灵 — 免费无水印视频提取工具',
      path: '/pages/index/index',
      imageUrl: '/images/share-cover.png'
    };
  },
});
