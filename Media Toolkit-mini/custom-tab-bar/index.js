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
      // 优先读 app.js 已缓存的配置（启动时已拉取）
      var app = getApp();
      var pageConfig = (app && app.globalData && app.globalData.pageConfig) || {};
      if (Object.keys(pageConfig).length > 0) {
        this._filterTabs(pageConfig);
      } else {
        // 没有缓存才请求服务器
        this._loadTabs();
      }
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
          } else {
            // 服务器无数据，显示全部 tab
            self.setData({ tabs: allTabs, selected: self.data.selected || 0 });
          }
        },
        fail: function() {
          // 请求失败，显示全部 tab
          self.setData({ tabs: allTabs, selected: self.data.selected || 0 });
        }
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
