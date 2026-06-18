import STORAGE_KEYS from "../../utils/storageKeys";
import { isLoggedIn, getUserInfo, logout, silentLogin } from '../../utils/auth';

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    historyCount: 0,
    cacheSize: '',
    showAbout: false,
    appVersion: 'v2.6.0',
    aboutDesc: '小辣椒去水印精灵是一款免费的视频无水印提取工具，支持抖音、快手、B站等50+主流平台。\n\n提供高清视频下载、音频提取、封面保存等功能。'
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar()._updateSelected();
    }
    var info = getUserInfo();
    var idShort = '';
    if (info && info._id) {
      idShort = info._id.length > 8 ? info._id.substring(0, 8) + '...' : info._id;
    }
    this.setData({
      isLoggedIn: isLoggedIn(),
      userInfo: info,
      idShort: idShort
    });
    
    // 统计历史记录
    const history = wx.getStorageSync(STORAGE_KEYS.PARSE_HISTORY) || [];
    this.setData({ historyCount: history.length });
    this.calcCache();
  },

  calcCache() {
    try {
      const info = wx.getStorageInfoSync();
      const kb = info.currentSize || 0;
      this.setData({
        cacheSize: kb < 1024 ? kb + ' KB' : (kb / 1024).toFixed(1) + ' MB'
      });
    } catch (e) {
      this.setData({ cacheSize: '未知' });
    }
  },

  // 点击头像 - 选择新头像
  onChooseAvatar(e) {
    var avatarUrl = e.detail && e.detail.avatarUrl;
    if (!avatarUrl) return;
    if (!this.data.isLoggedIn) {
      this._doLogin();
      return;
    }
    // 从本地存储读最新数据，避免覆盖 _id 等字段
    var userInfo = getUserInfo() || {};
    userInfo.avatarUrl = avatarUrl;
    wx.setStorageSync(STORAGE_KEYS.USER_INFO, userInfo);
    this.setData({ userInfo: userInfo });
    this._syncProfile(userInfo);
    wx.showToast({ title: '头像已更新', icon: 'success' });
  },

  // 昵称输入框失焦 - 保存昵称
  onNicknameInput(e) {
    var nickName = e.detail.value;
    if (!nickName || !this.data.isLoggedIn) return;
    var userInfo = getUserInfo() || {};
    userInfo.nickName = nickName;
    wx.setStorageSync(STORAGE_KEYS.USER_INFO, userInfo);
    this.setData({ userInfo: userInfo });
  },

  onNicknameBlur(e) {
    var nickName = e.detail.value;
    if (!nickName || !this.data.isLoggedIn) return;
    var userInfo = getUserInfo() || {};
    if (userInfo.nickName !== nickName) {
      userInfo.nickName = nickName;
      wx.setStorageSync(STORAGE_KEYS.USER_INFO, userInfo);
      this.setData({ userInfo: userInfo });
      this._syncProfile(userInfo);
      wx.showToast({ title: '昵称已更新', icon: 'success' });
    }
  },

  // 同步用户资料到云端
  _syncProfile(userInfo) {
    if (!isLoggedIn()) return;
    try {
      if (!wx.cloud) {
        console.warn('[Mine] 云开发不可用，跳过同步');
        return;
      }
      wx.cloud.callFunction({
        name: 'updateProfile',
        data: {
          nickName: userInfo.nickName || '',
          avatarUrl: userInfo.avatarUrl || ''
        }
      }).then(function(res) {
        console.log('[Mine] 资料同步成功:', res.result);
      }).catch(function(err) {
        console.error('[Mine] 资料同步失败:', err);
      });
    } catch (e) {
      console.error('[Mine] 云函数调用异常:', e);
    }
  },

  // 执行登录
  async _doLogin() {
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
                userInfo: userInfo
              });
              wx.showToast({ title: '登录成功', icon: 'success' });
            } else {
              wx.showToast({ title: '登录失败', icon: 'none' });
            }
          } catch (e) {
            wx.hideLoading();
            console.error('[Mine] 登录失败:', e);
            wx.showToast({ title: '登录失败', icon: 'none' });
          }
        }
      }
    });
  },

  goHistory() {
    wx.switchTab({ url: '/pages/history/history' });
  },

  goFavorites() {
    wx.showToast({ title: '收藏功能即将上线', icon: 'none' });
  },

  goHelp() {
    wx.navigateTo({ url: '/pages/questions/questions' });
  },

  goSettings() {
    var app = getApp();
    if (app.isPageEnabled && !app.isPageEnabled('pages/settings/settings')) {
      wx.showToast({ title: '该功能即将上线', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/settings/settings' });
  },

  goHelp() {
    var app = getApp();
    if (app.isPageEnabled && !app.isPageEnabled('pages/questions/questions')) {
      wx.showToast({ title: '该功能即将上线', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/questions/questions' });
  },

  onAbout() {
    try {
      var info = wx.getAccountInfoSync();
      var version = info && info.miniProgram ? info.miniProgram.version : '';
      this.setData({ appVersion: version || '开发版' });
    } catch (e) {
      this.setData({ appVersion: '开发版' });
    }
    this._fetchAboutDesc();
    this.setData({ showAbout: true });
  },

  closeAbout() {
    this.setData({ showAbout: false });
  },

  _fetchAboutDesc() {
    var self = this;
    wx.request({
      url: (typeof config !== 'undefined' ? config.baseURL : 'https://api.missonce.cc') + '/api/announcement',
      success: function(res) {
        if (res.data && res.data.success && res.data.data && res.data.data.content) {
          self.setData({ aboutDesc: res.data.data.content });
        }
      },
      fail: function() {}
    });
  },

  onClearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '将清除临时数据（历史记录保留）',
      confirmColor: '#07c160',
      success: (res) => {
        if (res.confirm) {
          const history = wx.getStorageSync(STORAGE_KEYS.PARSE_HISTORY);
          const privacy = wx.getStorageSync(STORAGE_KEYS.PRIVACY_AGREED);
          const theme = wx.getStorageSync(STORAGE_KEYS.THEME_MODE);
          wx.clearStorageSync();
          if (history) wx.setStorageSync(STORAGE_KEYS.PARSE_HISTORY, history);
          if (privacy) wx.setStorageSync(STORAGE_KEYS.PRIVACY_AGREED, privacy);
          if (theme) wx.setStorageSync(STORAGE_KEYS.THEME_MODE, theme);
          this.calcCache();
          wx.showToast({ title: '已清除', icon: 'success' });
        }
      }
    });
  },

  onLogout() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '已是游客模式', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '退出登录',
      content: '退出后本地数据将保留，云端数据需重新登录后同步',
      confirmText: '确定退出',
      cancelText: '取消',
      confirmColor: '#ba1a1a',
      success: (res) => {
        if (res.confirm) {
          logout();
          this.setData({
            isLoggedIn: false,
            userInfo: null
          });
          wx.showToast({ title: '已退出', icon: 'success' });
        }
      }
    });
  },

  handleContact(e) {
    // 客服消息回调
  },

  onShareAppMessage() {
    return {
      title: '小辣椒去水印精灵 — 免费无水印视频提取工具',
      path: '/pages/index/index',
      imageUrl: '/images/share-cover.png'
    };
  },
});
