var config = require('../utils/config');

var allTabs = [
  { pagePath: 'pages/index/index', text: '首页', iconPath: '/images/home.png', selectedIconPath: '/images/home-active.png' },
  { pagePath: 'pages/trending/trending', text: '发现', iconPath: '/images/trending.png', selectedIconPath: '/images/trending-active.png' },
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
      // 首次启动：用默认配置（发现页关闭），不依赖本地存储
      var cached = wx.getStorageSync('page_config');
      if (cached && Object.keys(cached).length > 0) {
        // 有缓存直接用
        this._filterTabs(cached);
      } else {
        // 无缓存：用默认配置（发现页关闭）
        this._filterTabs({
          'pages/index/index': { enabled: true },
          'pages/trending/trending': { enabled: false },
          'pages/history/history': { enabled: true },
          'pages/mine/mine': { enabled: true },
        });
      }
      // 后台拉最新配置覆盖
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
        fail: function() {
          // 请求失败，保持当前 tabs 不变（用默认或缓存的配置）
        }
      });
    },

    _filterTabs: function(pageConfig) {
      var filtered = allTabs.filter(function(tab) {
        var page = pageConfig[tab.pagePath];
        return !page || page.enabled !== false;
      });
      this.setData({ tabs: filtered }, function() {
        this._updateSelected();
      });
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
