var config = require('../utils/config');

// tabBar 配置
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
      this._loadTabs();
    },
  },

  pageLifetimes: {
    show: function() {
      this._loadTabs();
      this._updateSelected();
    },
  },

  methods: {
    _loadTabs: function() {
      var self = this;
      // 每次都从服务器拉取最新配置
      wx.request({
        url: config.baseURL + '/api/page-config',
        success: function(res) {
          if (res.data && res.data.success && res.data.data && res.data.data.pages) {
            var pageConfig = res.data.data.pages;
            wx.setStorageSync('page_config', pageConfig);
            self._filterTabs(pageConfig);
          } else {
            self._filterTabs({});
          }
        },
        fail: function() {
          // 失败时用本地缓存
          var pageConfig = wx.getStorageSync('page_config') || {};
          self._filterTabs(pageConfig);
        }
      });
    },

    _filterTabs: function(pageConfig) {
      var filtered = allTabs.filter(function(tab) {
        var page = pageConfig[tab.pagePath];
        // 默认启用，除非明确禁用
        return !page || page.enabled !== false;
      });
      this.setData({ tabs: filtered });
      this._updateSelected();
    },

    _updateSelected: function() {
      var pages = getCurrentPages();
      var current = pages[pages.length - 1];
      var currentPath = current ? current.route : '';
      var tabs = this.data.tabs;
      for (var i = 0; i < tabs.length; i++) {
        if (tabs[i].pagePath === currentPath) {
          this.setData({ selected: i });
          return;
        }
      }
    },

    switchTab: function(e) {
      var index = e.currentTarget.dataset.index;
      var path = e.currentTarget.dataset.path;
      if (index === this.data.selected) return;
      wx.switchTab({ url: '/' + path });
    },
  },
});
