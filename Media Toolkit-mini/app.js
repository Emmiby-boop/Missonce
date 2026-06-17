import { silentLogin, isLoggedIn, syncHistoryToCloud, fetchHistoryFromCloud, mergeHistory } from './utils/auth';
import { request } from './utils/request';

App({
  onLaunch() {
    console.log('App launched');
    
    // 初始化云开发环境（可选）
    if (wx.cloud) {
      try {
        wx.cloud.init({
          env: 'missonce-gif-d1gbetd1qd1646e8d',
          traceUser: true,
        });
        console.log('[App] 云开发初始化完成');
      } catch (e) {
        console.warn('[App] 云开发初始化失败，将使用本地存储:', e);
      }
    } else {
      console.log('[App] 云开发不可用，使用本地存储模式');
    }
    
    this._initDarkMode();
    setTimeout(() => {
      this.checkPrivacyAuthorization();
    }, 500);
    this._initThemePreference();
    
    // 静默登录
    this._doLogin();

    // 启动时立即预拉取热门列表（不阻塞）
    this._precacheTrending();
  },

  globalData: {
    userInfo: null,
    isLoggedIn: false,
    privacyAgreed: false,
    _privacyPromptShowing: false,
    darkMode: false,
    themeMode: 'none',
  },

  // 启动时预拉取热门列表并缓存
  _precacheTrending() {
    // 检查缓存是否新鲜（10分钟内）
    var cacheTime = wx.getStorageSync('trending_cache_time') || 0;
    if (Date.now() - cacheTime < 10 * 60 * 1000) return;

    request('/api/trending/merged').then(function(res) {
      if (res.retcode === 200 && res.data && res.data.list) {
        wx.setStorageSync('trending_cache', res.data.list);
        wx.setStorageSync('trending_cache_time', Date.now());
        console.log('[App] 热门列表已缓存, 共', res.data.list.length, '条');
      }
    }).catch(function(e) {
      console.warn('[App] 预拉取热门列表失败:', e);
    });
  },

  async _doLogin() {
    try {
      const userInfo = await silentLogin();
      if (userInfo) {
        this.globalData.userInfo = userInfo;
        this.globalData.isLoggedIn = true;
        console.log('[App] 用户已登录');
        // 登录成功后同步历史
        this._syncHistory();
      }
    } catch (e) {
      console.warn('[App] 登录失败:', e);
    }
  },

  async _syncHistory() {
    if (!isLoggedIn()) return;
    try {
      let raw = wx.getStorageSync('parse_history') || [];
      const cloudList = await fetchHistoryFromCloud();

      if (cloudList && cloudList.length > 0) {
        if (raw.length === 0) {
          // 本地为空、云端有数据 → 从云端恢复到本地
          wx.setStorageSync('parse_history', cloudList);
          console.log('[App] 本地为空，从云端恢复', cloudList.length, '条记录');
        } else {
          // 本地有数据（含删除操作），以本地为准，上传覆盖云端
          syncHistoryToCloud(raw).catch(() => {});
          console.log('[App] 上传本地记录到云端, 共', raw.length, '条');
        }
      } else if (raw.length > 0) {
        // 云端为空，上传本地
        syncHistoryToCloud(raw).catch(() => {});
        console.log('[App] 上传本地记录到云端, 共', raw.length, '条');
      }
    } catch (e) {
      console.warn('[App] 历史记录同步失败:', e);
    }
  },

  _initThemePreference() {
    const saved = wx.getStorageSync('theme_mode');
    if (saved) this.globalData.themeMode = saved;
  },

  _initDarkMode() {
    try {
      const sysInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this.globalData.darkMode = sysInfo.theme === 'dark';
    } catch (e) {
      this.globalData.darkMode = false;
    }
    wx.onThemeChange((res) => {
      this.globalData.darkMode = res.theme === 'dark';
    });
  },

  setThemeMode(mode) {
    this.globalData.themeMode = mode;
    wx.setStorageSync('theme_mode', mode);
  },

  checkPrivacyAuthorization() {
    const privacyAgreed = wx.getStorageSync('privacy_agreed');
    if (privacyAgreed) {
      this.globalData.privacyAgreed = true;
      return;
    }
    if (this.globalData._privacyPromptShowing) return;
    this.globalData._privacyPromptShowing = true;

    wx.showModal({
      title: '隐私政策',
      content: '尊敬的用户，感谢您使用去水印精灵！\n\n为了提供服务，我们需要获取以下权限：\n\n📋 剪贴板权限：用于快速粘贴视频链接\n📷 相册权限：用于保存去水印后的视频和图片\n\n您的隐私信息仅存储在本地设备，不会上传至服务器。\n\n请您阅读并同意隐私政策后继续使用。',
      confirmText: '同意并继续',
      cancelText: '暂不同意',
      confirmColor: '#00c853',
      showCancel: true,
      success: (res) => {
        this.globalData._privacyPromptShowing = false;
        if (res.confirm) {
          wx.setStorageSync('privacy_agreed', true);
          this.globalData.privacyAgreed = true;
          wx.showToast({ title: '感谢您的信任', icon: 'success', duration: 1500 });
        }
      }
    });
  },

  checkAndRequestPrivacy() {
    return new Promise((resolve) => {
      if (this.globalData.privacyAgreed) { resolve(true); return; }
      const privacyAgreed = wx.getStorageSync('privacy_agreed');
      if (privacyAgreed) { this.globalData.privacyAgreed = true; resolve(true); return; }

      wx.showModal({
        title: '隐私政策',
        content: '为了使用此功能，需要您同意隐私政策',
        confirmText: '同意',
        cancelText: '取消',
        confirmColor: '#00c853',
        success: (res) => {
          if (res.confirm) {
            wx.setStorageSync('privacy_agreed', true);
            this.globalData.privacyAgreed = true;
            resolve(true);
          } else {
            resolve(false);
          }
        }
      });
    });
  }
});
