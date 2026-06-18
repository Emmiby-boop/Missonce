var config = require('../utils/config');

var allTabs = [
  { pagePath: 'pages/index/index', text: '首页', iconPath: '/images/home.png', selectedIconPath: '/images/home-active.png' },
  { pagePath: 'pages/trending/trending', text: '热门', iconPath: '/images/trending.png', selectedIconPath: '/images/trending-active.png' },
  { pagePath: 'pages/history/history', text: '历史', iconPath: '/images/history.png', selectedIconPath: '/images/history-active.png' },
  { pagePath: 'pages/mine/mine', text: '我的', iconPath: '/images/profile.png', selectedIconPath: '/images/profile-active.png' },
];

Component({
  data: {
    selected: 0,
    tabs: [],
  },

  lifetimes: {
    attached: function() {
      // 先用本地缓存立即渲染（无闪烁）
      var cached = wx.getStorageSync('page_config') || {};
      this._filterTabs(cached);
      // 再从服务器拉最新配置更新
      this._loadTabs();
    },
  },

  methods: {
    _loadTabs: function() {
      var self = this;
      wx.request({
        url: config.baseURL + '/api/page-config',
        success: function(res) {
          if (res.data && res.data.success && res.data.data && res.data.data.pages) {
            wx.setStorageSync('page_config', res.data.data.pages);
            self._filterTabs(res.data.data.pages);
          }
        },
        fail: function() {}
      });
    },

    _filterTabs: function(pageConfig) {
      var filtered = allTabs.filter(function(tab) {
        var page = pageConfig[tab.pagePath];
        return !page || page.enabled !== false;
      });
      var selected = this.data.selected;
      if (selected >= filtered.length) selected = 0;
      this.setData({ tabs: filtered, selected: selected });
    },

    _updateSelected: function() {
      var pages = getCurrentPages();
      var current = pages[pages.length - 1];
      var route = current ? current.route : '';
      var tabs = this.data.tabs;
      for (var i = 0; i < tabs.length; i++) {
        if (tabs[i].pagePath === route) {
          if (this.data.selected !== i) {
            this.setData({ selected: i });
          }
          return;
        }
      }
    },

    switchTab: function(e) {
      var index = e.currentTarget.dataset.index;
      var path = e.currentTarget.dataset.path;
      this.setData({ selected: index });
      wx.switchTab({ url: '/' + path });
    },
  },
});
