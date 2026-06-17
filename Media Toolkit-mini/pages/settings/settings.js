import STORAGE_KEYS from "../../utils/storageKeys";
const app = getApp();

Page({
  data: {
    themeMode: 'auto',
    cacheSize: '计算中...',
    historyCount: 0,
    themeOptions: [
      { value: 'auto', label: '跟随系统', desc: '自动切换浅色/深色', icon: 'auto' },
      { value: 'light', label: '浅色模式', desc: '始终使用浅色主题', icon: 'light' },
      { value: 'dark', label: '深色模式', desc: '始终使用深色主题', icon: 'dark' },
    ],
  },

  onShow() {
    this.loadState();
  },

  loadState() {
    const themeMode = app.globalData.themeMode || wx.getStorageSync(STORAGE_KEYS.THEME_MODE) || 'auto';
    const history = wx.getStorageSync(STORAGE_KEYS.PARSE_HISTORY) || [];
    this.setData({
      themeMode: themeMode,
      historyCount: history.length,
    });
    this.calcCacheSize();
  },

  // 计算缓存大小
  calcCacheSize() {
    try {
      const res = wx.getStorageInfoSync();
      const sizeKB = res.currentSize || 0;
      let sizeStr;
      if (sizeKB < 1024) {
        sizeStr = sizeKB + ' KB';
      } else {
        sizeStr = (sizeKB / 1024).toFixed(1) + ' MB';
      }
      this.setData({ cacheSize: sizeStr });
    } catch (e) {
      this.setData({ cacheSize: '未知' });
    }
  },

  // 切换主题
  onThemeChange(e) {
    const mode = e.currentTarget.dataset.value;
    this.setData({ themeMode: mode });
    app.setThemeMode(mode);
    wx.showToast({ title: '主题设置已保存', icon: 'success' });

    // 提示用户重启生效
    if (mode !== 'auto') {
      setTimeout(() => {
        wx.showToast({ title: '重启小程序后生效', icon: 'none', duration: 2000 });
      }, 1500);
    }
  },

  // 清除缓存
  onClearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '将清除所有本地缓存数据（不含历史记录），确定继续吗？',
      confirmColor: '#0d9488',
      success: (res) => {
        if (res.confirm) {
          // 保留关键数据
          const history = wx.getStorageSync(STORAGE_KEYS.PARSE_HISTORY);
          const privacy = wx.getStorageSync(STORAGE_KEYS.PRIVACY_AGREED);
          const theme = wx.getStorageSync(STORAGE_KEYS.THEME_MODE);

          wx.clearStorageSync();

          // 恢复关键数据
          if (history) wx.setStorageSync(STORAGE_KEYS.PARSE_HISTORY, history);
          if (privacy) wx.setStorageSync(STORAGE_KEYS.PRIVACY_AGREED, privacy);
          if (theme) wx.setStorageSync(STORAGE_KEYS.THEME_MODE, theme);

          this.calcCacheSize();
          wx.showToast({ title: '缓存已清除', icon: 'success' });
        }
      }
    });
  },

  // 清空历史
  onClearHistory() {
    if (this.data.historyCount === 0) {
      wx.showToast({ title: '暂无历史记录', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '清空历史',
      content: '将删除所有 ' + this.data.historyCount + ' 条解析历史，此操作不可恢复。',
      confirmColor: '#EF4444',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync(STORAGE_KEYS.PARSE_HISTORY);
          this.setData({ historyCount: 0 });
          wx.showToast({ title: '已清空', icon: 'success' });
        }
      }
    });
  },

  // 免责声明
  onViewDisclaimer() {
    wx.showModal({
      title: '免责声明',
      content: '去水印精灵作为中立的技术服务提供者，旨在协助用户进行个人学习与素材赏析。\n\n我们郑重提醒：\n• 下载内容版权归原平台及作者所有\n• 请遵守各平台规则及相关法律法规\n• 任何因滥用导致的侵权行为，责任由用户自行承担\n\n本程序不存储任何数字影像数据。',
      confirmText: '我知道了',
      confirmColor: '#0d9488',
      showCancel: false,
    });
  },

  // 意见反馈
  onFeedback() {
    wx.showModal({
      title: '意见反馈',
      content: '感谢您的反馈！您可以通过客服会话告诉我们您的建议和遇到的问题。',
      confirmText: '联系客服',
      cancelText: '取消',
      confirmColor: '#0d9488',
      success: (res) => {
        if (res.confirm) {
          // 在 WXML 中使用 <button open-type="contact"> 触发客服会话
          wx.showToast({ title: '请通过客服按钮联系我们', icon: 'none' });
        }
      }
    });
  },
});
