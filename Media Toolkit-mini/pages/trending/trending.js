import { request } from '../../utils/request';
import { showToast } from '../../utils/ui';
import { track } from '../../utils/stats';
import { isLoggedIn, syncHistoryToCloud } from '../../utils/auth';
import { buildProxiedUrl } from '../../utils/file';

const PLATFORM_COLORS = {
  '抖音': '#161823', '快手': '#FF4906', 'B站': '#00A1D6', '哔哩哔哩': '#00A1D6',
  '小红书': '#FE2C55', '微博': '#FF8200',
};

Page({
  data: {
    tabs: [
      { key: 'all', name: '全部' },
      { key: 'video', name: '视频' },
      { key: 'image', name: '图集' },
      { key: 'music', name: '音乐' },
      { key: 'selected', name: '精选' },
    ],
    activeTab: 'all',
    list: [],
    allItems: [],
    loading: false,
    hasMore: true,
    keyword: '',
  },

  onLoad() {
    track('page_view', { page: 'trending' });
    // 优先读缓存（app.js 启动时已预拉取）
    var cached = wx.getStorageSync('trending_cache');
    if (cached && cached.length > 0) {
      this._processItems(cached);
    }
    // 后台刷新最新数据
    this.loadData();
  },

  onShow() {
    if (!this._hasLoaded) {
      this._hasLoaded = true;
      var cached = wx.getStorageSync('trending_cache');
      if (cached && cached.length > 0) {
        this._processItems(cached);
      }
      this.loadData();
    }
  },

  onPullDownRefresh() {
    this.loadData().then(() => wx.stopPullDownRefresh());
  },

  onTabChange(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.activeTab) return;
    this.setData({ activeTab: key });
    this.filterList();
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value || '' });
    this.filterList();
  },

  async loadData() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const res = await request('/api/trending/merged');
      if (res.retcode === 200) {
        // 更新缓存
        wx.setStorageSync('trending_cache', res.data.list || []);
        wx.setStorageSync('trending_cache_time', Date.now());
        this._processItems(res.data.list || []);
        // 后台预缓存前 5 条热门视频的解析结果
        this._precacheTopItems(this.data.allItems);
      }
    } catch (e) {
      showToast('加载失败', 'none');
    } finally {
      this.setData({ loading: false });
    }
  },

  // 后台预缓存热门视频（不阻塞 UI）
  _precacheTopItems(items) {
    var self = this;
    var cache = wx.getStorageSync('trending_parse_cache') || {};
    var toCache = items.filter(function(i) { return i.url && !cache[i.url]; }).slice(0, 5);
    if (!toCache.length) return;
    var chain = Promise.resolve();
    toCache.forEach(function(item) {
      chain = chain.then(function() {
        return request('/api/parse', { method: 'POST', data: { text: item.url } }).then(function(res) {
          if (res.retcode === 200 && res.data) {
            self._cacheParseResult(item.url, res.data);
          }
        }).catch(function() {});
      });
    });
  },

  // 处理热门列表数据（缓存和网络共用）
  _processItems(list) {
    var now = Date.now();
    var allItems = list.map(function(item, idx) {
      var age = now - (item.cachedAt || item.syncedAt || 0);
      var minutes = Math.floor(age / 60000);
      var timeLabel = '刚刚';
      if (minutes > 60) timeLabel = Math.floor(minutes / 60) + '小时前';
      else if (minutes > 0) timeLabel = minutes + '分钟前';

      var type = 'video';
      var typeLabel = '视频';
      if (item.image_list && item.image_list.length > 0 && !item.video_url) {
        type = 'image';
        typeLabel = '图集';
      } else if (item.title && (item.title.indexOf('音乐') >= 0 || item.title.indexOf('#音乐') >= 0)) {
        type = 'music';
        typeLabel = '音乐';
      }

      return {
        id: item.id,
        url: item.url || '',
        title: item.title || '',
        cover: item.cover || '',
        platform: item.platform || '',
        platformColor: PLATFORM_COLORS[item.platform] || '#07c160',
        heat: item.heat || 0,
        source: item.source || '',
        timeLabel: timeLabel,
        type: type,
        typeLabel: typeLabel,
        isNew: age < 3600000,
        isTop: idx < 3,
      };
    });
    this.setData({ allItems: allItems });
    this.filterList();
  },

  filterList() {
    const { activeTab, allItems, keyword } = this.data;
    let filtered = allItems;

    if (activeTab === 'selected') {
      filtered = allItems.filter(i => i.isTop || i.isNew);
    } else if (activeTab === 'video') {
      filtered = allItems.filter(i => i.type === 'video');
    } else if (activeTab === 'image') {
      filtered = allItems.filter(i => i.type === 'image');
    } else if (activeTab === 'music') {
      filtered = allItems.filter(i => i.type === 'music');
    }

    // 搜索
    if (keyword) {
      const kw = keyword.toLowerCase();
      filtered = filtered.filter(i =>
        (i.title || '').toLowerCase().includes(kw) ||
        (i.platform || '').toLowerCase().includes(kw)
      );
    }

    this.setData({ list: filtered });
  },

  onLoadMore() {
    // 暂无分页，所有数据一次加载
  },

  onItemTap(e) {
    const item = e.currentTarget.dataset.item;
    if (!item || !item.url) return;
    track('trending_view_detail', { platform: item.platform });

    // 检查缓存
    const cache = wx.getStorageSync('trending_parse_cache') || {};
    const cached = cache[item.url];
    if (cached && cached.video_url) {
      this._goToPlayer(cached);
      return;
    }

    // 服务器解析
    this._parseAndGo(item);
  },

  _goToPlayer(parsed) {
    wx.setStorageSync('current_result', { ...parsed, timestamp: Date.now() });
    this._saveHistory(parsed);
    // 存储热门列表供播放页使用
    wx.setStorageSync('trending_playlist', this.data.allItems.map(function(item) {
      return { url: item.url, title: item.title || '', cover: item.cover || '', platform: item.platform || '' };
    }));
    wx.navigateTo({
      url: '/pages/videoPlayer/videoPlayer?url=' + encodeURIComponent(parsed.video_url || '') +
        '&cover=' + encodeURIComponent(parsed.cover_url || '') +
        '&title=' + encodeURIComponent(parsed.title || '') +
        '&videoid=' + encodeURIComponent(parsed.video_id || '') +
        '&source=trending'
    });
  },

  async _parseAndGo(item) {
    wx.showLoading({ title: '加载中...' });
    try {
      const res = await request('/api/parse', { method: 'POST', data: { text: item.url } });
      wx.hideLoading();
      if (res.retcode === 200 && res.data) {
        const parsed = res.data;
        this._cacheParseResult(item.url, parsed);
        this._saveHistory(parsed);
        // 统一跳转到播放页（视频或图集都支持）
        wx.setStorageSync('current_result', { ...parsed, timestamp: Date.now() });
        wx.navigateTo({
          url: '/pages/videoPlayer/videoPlayer?url=' + encodeURIComponent(parsed.video_url || '') +
            '&cover=' + encodeURIComponent(parsed.cover_url || '') +
            '&title=' + encodeURIComponent(parsed.title || '') +
            '&videoid=' + encodeURIComponent(parsed.video_id || '') +
            '&source=trending'
        });
        track('parse_success', { platform: parsed.platform });
      } else {
        wx.showToast({ title: res.retdesc || '解析失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  _cacheParseResult(url, data) {
    try {
      const cache = wx.getStorageSync('trending_parse_cache') || {};
      cache[url] = {
        video_url: data.video_url || '', title: data.title || '',
        cover_url: data.cover_url || '', video_id: data.video_id || '',
        platform: data.platform || '', image_list: data.image_list || [],
        audio_url: data.audio_url || '', quality_options: data.quality_options || [],
        duration: data.duration || '', timestamp: Date.now(),
      };
      wx.setStorageSync('trending_parse_cache', cache);
    } catch (e) {}
  },

  onCopyLink(e) {
    const item = e.currentTarget.dataset.item;
    if (!item || !item.url) return;
    wx.setClipboardData({
      data: item.url,
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    });
  },

  onShareAppMessage() {
    return {
      title: '小辣椒去水印精灵 — 最新素材榜',
      path: '/pages/trending/trending',
      imageUrl: '/images/share-cover.png'
    };
  },

  _saveHistory(data) {
    try {
      let list = wx.getStorageSync('parse_history') || [];
      const vid = data.video_id;
      if (vid) list = list.filter(item => item.video_id !== vid);
      if (list.length >= 100) list = list.slice(-99);
      list.push({
        video_id: data.video_id || '', title: data.title || '',
        cover_url: data.cover_url || '', video_url: data.video_url || '',
        platform: data.platform || '', image_list: data.image_list || [],
        timestamp: Date.now()
      });
      wx.setStorageSync('parse_history', list);
      // 同步到云端
      if (isLoggedIn()) {
        syncHistoryToCloud(list).catch(() => {});
      }
    } catch (e) {}
  },

  onRefresh() {
    this.setData({ allItems: [] });
    this.loadData();
  },

  onClearSearch() {
    this.setData({ keyword: '' });
    this.filterList();
  },
});
