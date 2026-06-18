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
            var pageConfig = res.data.data.pages;
            wx.setStorageSync('page_config', pageConfig);
            self._filterTabs(pageConfig);
          } else {
            self._filterTabs({});
          }
        },
        fail: function() {
          var pageConfig = wx.getStorageSync('page_config') || {};
          self._filterTabs(pageConfig);
        }
      });
    },

    _filterTabs: function(pageConfig) {
      var filtered = allTabs.filter(function(tab) {
        var page = pageConfig[tab.pagePath];
        return !page || page.enabled !== false;
      });
      this.setData({ tabs: filtered });
    },

    switchTab: function(e) {
      var index = e.currentTarget.dataset.index;
      var path = e.currentTarget.dataset.path;
      wx.switchTab({ url: '/' + path });
    },
  },
});
