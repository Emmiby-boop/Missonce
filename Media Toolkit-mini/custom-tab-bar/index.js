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
      var cached = wx.getStorageSync('page_config');
      if (cached && Object.keys(cached).length > 0) {
        this._filterTabs(cached);
      } else {
        this._filterTabs({
          'pages/index/index': { enabled: true },
          'pages/trending/trending': { enabled: false },
          'pages/history/history': { enabled: true },
          'pages/mine/mine': { enabled: true },
        });
      }
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
            var oldLen = self.data.tabs.length;
            self._filterTabs(res.data.data.pages);
            // 如果 tab 数量变了，重新匹配选中状态
            if (self.data.tabs.length !== oldLen) {
              self._matchSelected();
            }
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
      this.setData({ tabs: filtered });
    },

    // 根据当前页面路径匹配选中状态
    _matchSelected: function() {
      var pages = getCurrentPages();
      var current = pages[pages.length - 1];
      if (!current) return;
      var route = current.route || '';
      var tabs = this.data.tabs;
      for (var i = 0; i < tabs.length; i++) {
        if (tabs[i].pagePath === route) {
          this.setData({ selected: i });
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
