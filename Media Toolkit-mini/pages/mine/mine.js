import { isLoggedIn, getUserInfo, logout, silentLogin } from '../../utils/auth';

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    historyCount: 0,
    cacheSize: ''
  },

  onShow() {
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
    const history = wx.getStorageSync('parse_history') || [];
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
    // 更新本地存储
    var userInfo = this.data.userInfo || {};
    userInfo.avatarUrl = avatarUrl;
    wx.setStorageSync('userInfo', userInfo);
    this.setData({ userInfo: userInfo });
    // 同步到云端
    this._syncProfile(userInfo);
    wx.showToast({ title: '头像已更新', icon: 'success' });
  },

  // 昵称输入框失焦 - 保存昵称
  onNicknameInput(e) {
    var nickName = e.detail.value;
    if (!nickName || !this.data.isLoggedIn) return;
    var userInfo = this.data.userInfo || {};
    userInfo.nickName = nickName;
    wx.setStorageSync('userInfo', userInfo);
    this.setData({ userInfo: userInfo });
  },

  onNicknameBlur(e) {
    var nickName = e.detail.value;
    if (!nickName || !this.data.isLoggedIn) return;
    var userInfo = this.data.userInfo || {};
    if (userInfo.nickName !== nickName) {
      userInfo.nickName = nickName;
      wx.setStorageSync('userInfo', userInfo);
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
    wx.navigateTo({ url: '/pages/settings/settings' });
  },

  onAbout() {
    const accountInfo = wx.getAccountInfoSync ? wx.getAccountInfoSync() : null;
    const version = accountInfo?.miniProgram?.version || 'v2.5.3';
    wx.showModal({
      title: '关于小辣椒去水印精灵',
      content: `小辣椒去水印精灵是一款免费的视频无水印提取工具，支持抖音、快手、B站等50+主流平台。\n\n提供高清视频下载、音频提取、封面保存等功能。\n\n版本：${version}`,
      showCancel: false,
      confirmText: '我知道了',
      confirmColor: '#07c160',
    });
  },

  onClearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '将清除临时数据（历史记录保留）',
      confirmColor: '#07c160',
      success: (res) => {
        if (res.confirm) {
          const history = wx.getStorageSync('parse_history');
          const privacy = wx.getStorageSync('privacy_agreed');
          const theme = wx.getStorageSync('theme_mode');
          wx.clearStorageSync();
          if (history) wx.setStorageSync('parse_history', history);
          if (privacy) wx.setStorageSync('privacy_agreed', privacy);
          if (theme) wx.setStorageSync('theme_mode', theme);
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
