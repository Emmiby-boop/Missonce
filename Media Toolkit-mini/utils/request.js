import config from './config.js';

// 网络状态缓存
let _networkType = 'wifi';
let _isConnected = true;

// 监听网络状态变化
wx.onNetworkStatusChange((res) => {
  _isConnected = res.isConnected;
  _networkType = res.networkType;
  console.log(`[Network] 状态变化: ${res.isConnected ? '连接' : '断开'}, 类型: ${res.networkType}`);
});

// 获取当前网络状态
function getNetworkStatus() {
  return {
    isConnected: _isConnected,
    networkType: _networkType
  };
}

// 检查网络是否可用
function checkNetwork() {
  return new Promise((resolve) => {
    wx.getNetworkType({
      success: (res) => {
        _networkType = res.networkType;
        _isConnected = res.networkType !== 'none';
        resolve(_isConnected);
      },
      fail: () => {
        resolve(false);
      }
    });
  });
}

function request(url, options = {}, retryCount = 0) {
  return new Promise((resolve, reject) => {
    _doRequest(resolve, reject, url, options, retryCount);
  });
}

async function _doRequest(resolve, reject, url, options, retryCount) {
  // 检查网络状态
  const isConnected = await checkNetwork();
  if (!isConnected) {
    reject(new Error('网络连接已断开，请检查网络设置'));
    return;
  }

  const fullUrl = url.startsWith('http') ? url : `${config.baseURL}${url}`;

  let settled = false;
  const done = (fn) => (...args) => {
    if (!settled) {
      settled = true;
      clearTimeout(timeoutId);
      fn(...args);
    }
  };

  const timeoutId = setTimeout(() => {
    if (!settled) {
      settled = true;
      reject(new Error('请求超时'));
    }
  }, options.timeout || config.timeout);

  wx.request({
    ...options,
    url: fullUrl,    // url 放最后，防止 options 中意外覆盖
    success(res) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (res.data && res.data.retcode === 200) {
          done(resolve)(res.data);
        } else {
          const errorMsg = res.data?.retdesc || res.data?.msg || '请求失败';
          done(reject)(new Error(errorMsg));
        }
      } else {
        done(reject)(new Error(`HTTP错误: ${res.statusCode}`));
      }
    },
    fail(err) {
      clearTimeout(timeoutId);
      if (retryCount < config.maxRetries) {
        console.log(`请求失败，正在重试... (${retryCount + 1}/${config.maxRetries})`);
        _doRequest(resolve, reject, url, options, retryCount + 1);
      } else {
        done(reject)(new Error(`请求失败: ${err.errMsg || '未知错误'}`));
      }
    },
  });
}

export { request, config, getNetworkStatus, checkNetwork };