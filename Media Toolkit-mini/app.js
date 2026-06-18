import { silentLogin, isLoggedIn, syncHistoryToCloud, fetchHistoryFromCloud } from './utils/auth';
import { request } from './utils/request';
import STORAGE_KEYS from './utils/storageKeys';

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

    // 拉取页面开关配置
    this._fetchPageConfig();
  },

  globalData: {
    userInfo: null,
    isLoggedIn: false,
    privacyAgreed: false,
    _privacyPromptShowing: false,
    darkMode: false,
    themeMode: 'none',
    pageConfig: {},
  },

  // 启动时预拉取热门列表并缓存
  _precacheTrending() {
    // 检查缓存是否新鲜（10分钟内）
    var cacheTime = wx.getStorageSync(STORAGE_KEYS.TRENDING_CACHE_TIME) || 0;
    if (Date.now() - cacheTime < 10 * 60 * 1000) return;

    request('/api/trending/merged').then(function(res) {
      if (res.retcode === 200 && res.data && res.data.list) {
        wx.setStorageSync(STORAGE_KEYS.TRENDING_CACHE, res.data.list);
        wx.setStorageSync(STORAGE_KEYS.TRENDING_CACHE_TIME, Date.now());
        console.log('[App] 热门列表已缓存, 共', res.data.list.length, '条');
      }
    }).catch(function(e) {
      console.warn('[App] 预拉取热门列表失败:', e);
    });
  },

  // 拉取页面开关配置（每次启动都拉取最新）
  _fetchPageConfig() {
    var self = this;
    wx.request({
      url: (typeof config !== 'undefined' ? config.baseURL : 'https://api.missonce.cc') + '/api/page-config',
      success: function(res) {
        if (res.data && res.data.success && res.data.data && res.data.data.pages) {
          wx.setStorageSync('page_config', res.data.data.pages);
          self.globalData.pageConfig = res.data.data.pages;
          console.log('[App] 页面配置已更新');
        }
      },
      fail: function() {}
    });
  },

  // 检查页面是否启用
  isPageEnabled(pagePath) {
    var pages = this.globalData.pageConfig || wx.getStorageSync('page_config') || {};
    var page = pages[pagePath];
    return page ? page.enabled !== false : true; // 默认启用
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
      let raw = wx.getStorageSync(STORAGE_KEYS.PARSE_HISTORY) || [];
      const cloudList = await fetchHistoryFromCloud();

      if (cloudList && cloudList.length > 0) {
        if (raw.length === 0) {
          // 本地为空、云端有数据 → 从云端恢复到本地
          wx.setStorageSync(STORAGE_KEYS.PARSE_HISTORY, cloudList);
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
    const saved = wx.getStorageSync(STORAGE_KEYS.THEME_MODE);
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
    wx.setStorageSync(STORAGE_KEYS.THEME_MODE, mode);
  },

  checkPrivacyAuthorization() {
    const privacyAgreed = wx.getStorageSync(STORAGE_KEYS.PRIVACY_AGREED);
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
          wx.setStorageSync(STORAGE_KEYS.PRIVACY_AGREED, true);
          this.globalData.privacyAgreed = true;
          wx.showToast({ title: '感谢您的信任', icon: 'success', duration: 1500 });
        }
      }
    });
  },

  checkAndRequestPrivacy() {
    return new Promise((resolve) => {
      if (this.globalData.privacyAgreed) { resolve(true); return; }
      const privacyAgreed = wx.getStorageSync(STORAGE_KEYS.PRIVACY_AGREED);
      if (privacyAgreed) { this.globalData.privacyAgreed = true; resolve(true); return; }

      wx.showModal({
        title: '隐私政策',
        content: '为了使用此功能，需要您同意隐私政策',
        confirmText: '同意',
        cancelText: '取消',
        confirmColor: '#00c853',
        success: (res) => {
          if (res.confirm) {
            wx.setStorageSync(STORAGE_KEYS.PRIVACY_AGREED, true);
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
