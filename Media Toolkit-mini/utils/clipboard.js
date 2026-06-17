// clipboard.js

/**
 * 获取剪贴板数据
 * @returns {Promise<string>} 剪贴板内容
 */
function getClipboardData() {
  return new Promise((resolve, reject) => {
    wx.getClipboardData({
      success: function(res) {
        if (res.data) {
          resolve(res.data);
        } else {
          wx.showToast({
            title: '剪切板无内容',
            icon: 'none',
            duration: 2000
          });
          reject(new Error('剪切板无内容'));
        }
      },
      fail: function(err) {
        wx.showToast({
          title: '无法获取剪切板数据',
          icon: 'none',
          duration: 2000
        });
        reject(err);
      }
    });
  });
}

/**
 * 复制文本到剪贴板
 * @param {string} data 要复制的文本内容
 * @param {object} options 可选参数
 * @param {string} options.title 复制成功后的提示文字，不传则不显示自定义提示
 * @param {string} options.icon 提示图标，默认'success'
 * @param {number} options.duration 提示时长，默认2000ms
 * @returns {Promise<void>}
 */
function copyToClipboard(data, options = {}) {
  return new Promise((resolve, reject) => {
    wx.setClipboardData({
      data: data,
      success: () => {
        if (options.title) {
          wx.showToast({
            title: options.title,
            icon: options.icon || 'none',
            duration: options.duration || 2000
          });
        }
        resolve();
      },
      fail: (err) => {
        console.error('复制失败:', err);
        reject(err);
      }
    });
  });
}

export { getClipboardData, copyToClipboard };
