import { formatTime } from '../../utils/time';
import { isLoggedIn, syncHistoryToCloud } from '../../utils/auth';

const PLATFORM_COLORS = {
  '抖音': '#161823', '快手': '#FF4906', 'B站': '#00A1D6', '哔哩哔哩': '#00A1D6',
  '小红书': '#FE2C55', '微博': '#FF8200', 'YouTube': '#FF0000',
};

Page({
  data: {
    allList: [],
    groupedList: [],
    keyword: '',
    isLoggedIn: false,
    editMode: false,
    selectedMap: {},
    selectedCount: 0,
  },

  onShow() {
    this.setData({ isLoggedIn: isLoggedIn() });
    this.load();
  },

  async load() {
    try {
      // 直接从本地读取（同步已在 app.js 和首页完成）
      const raw = wx.getStorageSync('parse_history') || [];
      const list = [...raw]
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .map(item => ({
          ...item,
          timeStr: item.timestamp ? this.formatSmartTime(item.timestamp) : '',
          platformColor: PLATFORM_COLORS[item.platform] || '#07c160',
        }));
      this.setData({ allList: list });
      this.applyGrouping(list, this.data.keyword);
    } catch (e) {
      console.error('[History] load error:', e);
    }
  },

  formatSmartTime(ts) {
    const now = new Date();
    const date = new Date(ts);
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    const time = h + ':' + m;

    if (diffDays === 0) return time;
    if (diffDays === 1) return '昨天 ' + time;
    if (diffDays < 7) return diffDays + '天前';
    return formatTime(date);
  },

  getDateLabel(ts) {
    const now = new Date();
    const date = new Date(ts);
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    return '更早';
  },

  applyGrouping(list, keyword) {
    let filtered = list;
    if (keyword && keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      filtered = list.filter(item =>
        (item.title || '').toLowerCase().includes(kw) ||
        (item.platform || '').toLowerCase().includes(kw)
      );
    }

    // 按日期分组
    const groups = {};
    filtered.forEach(item => {
      const label = this.getDateLabel(item.timestamp);
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    });

    // 保持顺序：今天 > 昨天 > 更早
    const order = ['今天', '昨天', '更早'];
    const groupedList = order
      .filter(label => groups[label] && groups[label].length > 0)
      .map(label => ({
        date: label,
        dateLabel: label,
        items: groups[label]
      }));

    this.setData({ groupedList });
  },

  onSearch(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });
    this.applyGrouping(this.data.allList, keyword);
  },

  onTap(e) {
    const item = e.currentTarget.dataset.item;

    wx.setStorageSync('current_result', {
      video_url: item.video_url || '',
      title: item.title || '',
      cover_url: item.cover_url || '',
      video_id: item.video_id || '',
      platform: item.platform || '',
      image_list: item.image_list || [],
      audio_url: item.audio_url || '',
      author: item.author || {},
      timestamp: Date.now()
    });

    wx.navigateTo({
      url: '/pages/videoPlayer/videoPlayer?url=' + encodeURIComponent(item.video_url || '') +
        '&cover=' + encodeURIComponent(item.cover_url || '') +
        '&title=' + encodeURIComponent(item.title || '') +
        '&videoid=' + encodeURIComponent(item.video_id || '')
    });
  },

  onLongPress(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;
    wx.showModal({
      title: '删除记录',
      content: '确定删除该条解析记录？',
      confirmText: '删除',
      confirmColor: '#ba1a1a',
      success: (res) => {
        if (res.confirm) {
          const allList = this.data.allList.filter(i => i.video_id !== item.video_id);
          wx.setStorageSync('parse_history', allList);
          const list = [...allList].map(i => ({
            ...i,
            timeStr: i.timestamp ? this.formatSmartTime(i.timestamp) : '',
          }));
          this.setData({ allList: list });
          this.applyGrouping(list, this.data.keyword);
          wx.showToast({ title: '已删除', icon: 'success' });
          if (isLoggedIn()) syncHistoryToCloud(allList).catch(() => {});
        }
      }
    });
  },

  onClear() {
    if (!this.data.allList.length) return;
    wx.showModal({
      title: '清空历史',
      content: '确定清空所有解析记录？',
      confirmColor: '#ba1a1a',
      success: async (res) => {
        if (res.confirm) {
          wx.removeStorageSync('parse_history');
          this.setData({ allList: [], groupedList: [], keyword: '' });
          // 同步清空到云端，等待完成避免竞态
          if (isLoggedIn()) await syncHistoryToCloud([]).catch(() => {});
          wx.showToast({ title: '已清空', icon: 'success' });
        }
      }
    });
  },

  onClearSearch() {
    this.setData({ keyword: '' });
    this.applyGrouping(this.data.allList, '');
  },

  toggleEditMode() {
    this.setData({ editMode: !this.data.editMode, selectedMap: {} });
  },

  onSelectItem(e) {
    if (!this.data.editMode) return;
    const vid = e.currentTarget.dataset.vid;
    if (!vid) return;
    const map = { ...this.data.selectedMap };
    if (map[vid]) { delete map[vid]; }
    else { map[vid] = true; }
    const count = Object.keys(map).length;
    this.setData({ selectedMap: map, selectedCount: count });
  },

  onDeleteSelected() {
    const vids = Object.keys(this.data.selectedMap);
    const count = vids.length;
    if (!count) return;
    wx.showModal({
      title: `删除${count}条记录`,
      content: '删除后不可恢复',
      confirmText: '删除',
      confirmColor: '#ba1a1a',
      success: (res) => {
        if (!res.confirm) return;
        const ids = new Set(vids);
        const allList = this.data.allList.filter(i => !ids.has(i.video_id));
        wx.setStorageSync('parse_history', allList);
        const list = allList.map(i => ({ ...i, timeStr: i.timestamp ? this.formatSmartTime(i.timestamp) : '' }));
        this.setData({ allList: list, selectedMap: {}, editMode: false });
        this.applyGrouping(list, this.data.keyword);
        wx.showToast({ title: '已删除', icon: 'success' });
        if (isLoggedIn()) syncHistoryToCloud(allList).catch(() => {});
      }
    });
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
