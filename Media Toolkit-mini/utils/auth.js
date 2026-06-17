/**
 * 用户登录与会话管理
 * 支持本地存储和云开发（可选）
 */

const STORAGE_KEYS = {
  USER_INFO: 'user_info',
  OPENID: 'openid',
  LOGIN_TIME: 'login_time',
};

// session 有效期 7 天
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

// 检查云开发是否可用
function isCloudAvailable() {
  return typeof wx.cloud !== 'undefined';
}

/**
 * 检查登录状态
 */
function isLoggedIn() {
  const openid = wx.getStorageSync(STORAGE_KEYS.OPENID);
  const loginTime = wx.getStorageSync(STORAGE_KEYS.LOGIN_TIME);
  
  if (!openid || !loginTime) return false;
  
  // 检查是否过期
  if (Date.now() - loginTime > SESSION_TTL) {
    clearLoginState();
    return false;
  }
  
  return true;
}

/**
 * 获取用户信息
 */
function getUserInfo() {
  if (!isLoggedIn()) return null;
  return wx.getStorageSync(STORAGE_KEYS.USER_INFO) || null;
}

/**
 * 获取用户 openid
 */
function getOpenid() {
  return wx.getStorageSync(STORAGE_KEYS.OPENID) || '';
}

/**
 * 静默登录
 * 优先使用云函数，如果云开发不可用则使用本地存储
 */
function silentLogin() {
  return new Promise((resolve, reject) => {
    // 先检查本地 session
    if (isLoggedIn()) {
      const userInfo = getUserInfo();
      resolve(userInfo);
      return;
    }

    if (isCloudAvailable()) {
      // 使用云函数登录
      wx.cloud.callFunction({
        name: 'login',
        data: {}
      }).then((res) => {
        if (res.result && res.result.success) {
          const { openid, userInfo } = res.result.data;
          
          // 保存登录状态
          wx.setStorageSync(STORAGE_KEYS.OPENID, openid);
          wx.setStorageSync(STORAGE_KEYS.USER_INFO, userInfo || {});
          wx.setStorageSync(STORAGE_KEYS.LOGIN_TIME, Date.now());
          
          console.log('[Login] 云函数登录成功');
          resolve(userInfo || {});
        } else {
          console.warn('[Login] 云函数登录失败:', res.result?.error);
          // 降级到本地登录
          resolve(_localLogin());
        }
      }).catch((err) => {
        console.error('[Login] 云函数调用失败:', err);
        // 降级到本地登录
        resolve(_localLogin());
      });
    } else {
      // 云开发不可用，使用本地登录
      resolve(_localLogin());
    }
  });
}

/**
 * 本地登录（无需云开发）
 * 生成临时 openid 并保存用户信息
 */
function _localLogin() {
  // 生成临时 openid
  const tempOpenid = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  
  // 保存登录状态
  wx.setStorageSync(STORAGE_KEYS.OPENID, tempOpenid);
  wx.setStorageSync(STORAGE_KEYS.USER_INFO, {
    _id: tempOpenid,
    nickName: '本地用户',
    avatarUrl: ''
  });
  wx.setStorageSync(STORAGE_KEYS.LOGIN_TIME, Date.now());
  
  console.log('[Login] 本地登录成功');
  return getUserInfo();
}

/**
 * 用户授权登录（获取头像昵称）
 */
function authorizeLogin() {
  return new Promise((resolve, reject) => {
    if (!isLoggedIn()) {
      reject(new Error('请先进行静默登录'));
      return;
    }

    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (profileRes) => {
        if (profileRes.userInfo) {
          const userInfo = profileRes.userInfo;
          
          // 更新本地存储
          wx.setStorageSync(STORAGE_KEYS.USER_INFO, userInfo);
          
          // 如果云开发可用，同步到云端
          if (isCloudAvailable()) {
            wx.cloud.callFunction({
              name: 'updateProfile',
              data: {
                nickName: userInfo.nickName,
                avatarUrl: userInfo.avatarUrl
              }
            }).catch((err) => {
              console.warn('[Login] 更新用户资料失败:', err);
            });
          }
          
          resolve(userInfo);
        } else {
          reject(new Error('用户拒绝授权'));
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
}

/**
 * 更新用户资料
 */
function updateUserProfile(nickName, avatarUrl) {
  return new Promise((resolve, reject) => {
    if (!isLoggedIn()) {
      reject(new Error('请先登录'));
      return;
    }

    const userInfo = {
      nickName: nickName || '',
      avatarUrl: avatarUrl || ''
    };

    // 更新本地存储
    wx.setStorageSync(STORAGE_KEYS.USER_INFO, userInfo);

    // 如果云开发可用，同步到云端
    if (isCloudAvailable()) {
      wx.cloud.callFunction({
        name: 'updateProfile',
        data: userInfo
      }).then((res) => {
        if (res.result && res.result.success) {
          resolve(userInfo);
        } else {
          resolve(userInfo); // 本地已更新，忽略云端错误
        }
      }).catch(() => {
        resolve(userInfo); // 本地已更新，忽略云端错误
      });
    } else {
      resolve(userInfo);
    }
  });
}

/**
 * 退出登录
 */
function logout() {
  clearLoginState();
}

/**
 * 清除本地登录状态
 */
function clearLoginState() {
  wx.removeStorageSync(STORAGE_KEYS.USER_INFO);
  wx.removeStorageSync(STORAGE_KEYS.OPENID);
  wx.removeStorageSync(STORAGE_KEYS.LOGIN_TIME);
}

/**
 * 同步历史记录到云端
 */
function syncHistoryToCloud(historyList) {
  if (!isLoggedIn()) {
    return Promise.resolve();
  }

  if (!isCloudAvailable()) {
    return Promise.resolve();
  }

  // 空列表也需要同步（用于清空云端数据）
  return wx.cloud.callFunction({
    name: 'syncHistory',
    data: {
      action: 'upload',
      history: historyList || []
    }
  }).then((res) => {
    if (res.result && res.result.success) {
      console.log('[SyncHistory] 上传成功');
    }
    return res.result;
  }).catch(() => {});
}

/**
 * 从云端拉取历史记录
 */
function fetchHistoryFromCloud() {
  if (!isLoggedIn()) {
    return Promise.resolve(null);
  }

  if (!isCloudAvailable()) {
    return Promise.resolve(null);
  }

  return wx.cloud.callFunction({
    name: 'syncHistory',
    data: {
      action: 'download'
    }
  }).then((res) => {
    if (res.result && res.result.success) {
      return res.result.data?.history || [];
    }
    return null;
  }).catch(() => null);
}

/**
 * 合并本地和云端历史记录（去重）
 */
function mergeHistory(localList, cloudList) {
  if (!cloudList || cloudList.length === 0) return localList;
  if (!localList || localList.length === 0) return cloudList;
  
  const merged = new Map();
  
  localList.forEach(item => {
    const key = item.video_id || item.url || '';
    if (key) merged.set(key, item);
  });
  
  cloudList.forEach(item => {
    const key = item.video_id || item.url || '';
    if (key) {
      const existing = merged.get(key);
      if (!existing || (item.timestamp || 0) > (existing.timestamp || 0)) {
        merged.set(key, item);
      }
    }
  });
  
  return Array.from(merged.values())
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

export {
  isLoggedIn,
  getUserInfo,
  getOpenid,
  silentLogin,
  authorizeLogin,
  updateUserProfile,
  logout,
  clearLoginState,
  syncHistoryToCloud,
  fetchHistoryFromCloud,
  mergeHistory,
};

