import { config, request, getNetworkStatus } from './request';

// 代理下载签名缓存（减少请求次数）
let _signCache = null;
let _signCacheTime = 0;
const SIGN_CACHE_TTL = 4 * 60 * 1000; // 签名有效期 4 分钟（服务端 5 分钟，留 1 分钟余量）

// 获取 proxyDownload 签名
async function getProxySign(targetUrl) {
  const now = Date.now();
  if (_signCache && _signCache.url === targetUrl && (now - _signCacheTime) < SIGN_CACHE_TTL) {
    return _signCache;
  }
  try {
    const res = await request('/api/getProxySign', {
      method: 'POST',
      data: { url: targetUrl }
    });
    const signData = res.data || res;
    _signCache = { url: targetUrl, ts: signData.ts, sign: signData.sign };
    _signCacheTime = now;
    return _signCache;
  } catch (e) {
    console.error('[proxySign] 获取签名失败:', e);
    return null;
  }
}

// 构建带签名的代理下载 URL
async function buildProxiedUrl(originalUrl, filename) {
  const signData = await getProxySign(originalUrl);
  if (!signData) return null;
  return `${config.baseURL}/api/proxyDownload?url=${encodeURIComponent(originalUrl)}&filename=${encodeURIComponent(filename)}&ts=${signData.ts}&sign=${signData.sign}`;
}


function ensureWritePhotosAlbumPermission() {
  return new Promise((resolve, reject) => {
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.writePhotosAlbum']) {
          resolve();
        } else {
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success: () => {
              resolve();
            },
            fail: () => {
              wx.showModal({
                title: '权限提示',
                content: '需要您授权保存到相册才能下载',
                confirmText: '去设置',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.openSetting();
                  }
                }
              });
              reject('auth_denied');
            }
          });
        }
      },
      fail: () => {
        reject('get_setting_failed');
      }
    });
  });
}


function downloadCoverToPhotosAlbum(url, showLoading = false, errorCallback = () => {}) {
  let downloadTask = null;

  const promise = ensureWritePhotosAlbumPermission().then(() => {
    return _doDownloadCover(url, showLoading, errorCallback);
  }).then((task) => {
    downloadTask = task;
  }).catch((err) => {
    if (showLoading) wx.hideLoading();
    errorCallback(err);
    throw err; // 重新抛出，让调用方可以捕获
  });

  return {
    promise,
    abort: () => { if (downloadTask) downloadTask.abort(); }
  };
}

function _doDownloadCover(url, showLoading, errorCallback) {
  const t0 = Date.now();
  console.log(`[download][cover] 开始下载: ${url?.substring(0, 80)}...`);
  if (showLoading) {
    wx.showLoading({ title: '下载中...', mask: true });
  }
  let done = false;
  const isOwnDomain = url && url.indexOf(config.baseURL) === 0;

  // 异步构建带签名的代理 URL（file.js 现在是 async 模式）
  // 注意：调用方需确保先 await 签名就绪再发起下载
  return buildProxiedUrl(url, 'cover.jpg').then(downloadUrl => {
    if (!downloadUrl) {
      if (showLoading) wx.hideLoading();
      errorCallback(new Error('获取下载签名失败'));
      return;
    }
    const finalUrl = isOwnDomain ? url : downloadUrl;
    return _doDownloadCoverExecute(finalUrl, showLoading, errorCallback, t0);
  });
}

function _doDownloadCoverExecute(downloadUrl, showLoading, errorCallback, t0) {
  let done = false;
  const downloadTask = wx.downloadFile({
    url: downloadUrl,
    timeout: 30000,
    success: (res) => {
      if (done) return;
      done = true;
      console.log(`[download][cover] 下载完成: ${Date.now() - t0}ms, statusCode=${res.statusCode}`);
      const filePath = res.tempFilePath;
      wx.saveImageToPhotosAlbum({
        filePath: filePath,
        success: () => {
          if (showLoading) wx.hideLoading();
          console.log(`[download][cover] 保存到相册成功, 总耗时: ${Date.now() - t0}ms`);
          wx.showToast({ title: '封面保存成功', icon: 'success' });
        },
        fail: (err) => {
          if (showLoading) wx.hideLoading();
          console.log(`[download][cover] 保存到相册失败: ${err.errMsg}, 耗时: ${Date.now() - t0}ms`);
          console.error('保存封面失败:', err);
          if (err.errMsg && err.errMsg.includes('auth deny')) {
            wx.showModal({
              title: '保存失败',
              content: '您拒绝了保存到相册的权限，请在设置中开启',
              confirmText: '去设置',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  wx.openSetting();
                }
              }
            });
            return;
          }
          errorCallback(err);
        }
      });
    },
    fail: (err) => {
      if (done) return;
      done = true;
      if (showLoading) wx.hideLoading();
      console.log(`[download][cover] 下载失败: ${err.errMsg}, 耗时: ${Date.now() - t0}ms`);
      console.error('下载封面失败:', err);
      errorCallback(err);
    }
  });
  return downloadTask;
}

// 支持直连下载的 CDN 域名（不需要代理）
const DIRECT_DOWNLOAD_DOMAINS = [
  'douyinvod.com', 'douyin.com', 'ixigua.com', 'snssdk.com', 'byteimg.com',
  'yximgs.com', 'kwimgs.com', 'kuaishou.com',
  'xhscdn.com', 'xiaohongshu.com',
  'bilivideo.com', 'biliapi.com', 'bilibili.com',
  'ytimg.com', 'googlevideo.com',
  'twimg.com',
  'fbcdn.net',
];

function isDirectDownloadDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    return DIRECT_DOWNLOAD_DOMAINS.some(d => hostname.includes(d));
  } catch {
    return false;
  }
}

// 执行单次下载尝试
function executeDownload(url, timeout) {
  return new Promise((resolve, reject) => {
    const task = wx.downloadFile({
      url: url,
      timeout: timeout || 600000,
      success: (res) => {
        if (res.statusCode === 200) {
          resolve({ tempFilePath: res.tempFilePath, task });
        } else {
          reject(new Error('状态码: ' + res.statusCode));
        }
      },
      fail: (err) => {
        reject(new Error(err.errMsg || '下载失败'));
      }
    });
    task.onProgressUpdate = task.onProgressUpdate || function() {};
  });
}

// 下载视频到相册
async function downloadVideoToPhotosAlbum(videoUrl, videoId) {
  let downloadTask = null;
  let aborted = false;

  const { isConnected } = getNetworkStatus();
  if (!isConnected) {
    return { promise: Promise.reject(new Error('网络连接已断开')), abort: () => {} };
  }

  const isOwnDomain = videoUrl && videoUrl.indexOf(config.baseURL) === 0;
  const canDirectDownload = !isOwnDomain && isDirectDownloadDomain(videoUrl);

  let downloadUrl;
  if (isOwnDomain) {
    downloadUrl = videoUrl;
  } else if (canDirectDownload) {
    downloadUrl = videoUrl;
  } else {
    downloadUrl = await buildProxiedUrl(videoUrl, `${videoId || 'video'}.mp4`);
  }

  const promise = ensureWritePhotosAlbumPermission().then(() => {
    if (aborted) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      console.log(`[download][video] 开始下载: ${downloadUrl?.substring(0, 80)}...`);
      console.log(`[download][video] 模式: ${isOwnDomain ? '直连' : canDirectDownload ? 'CDN直连' : '代理'}`);
      wx.showLoading({ title: '正在准备下载...', mask: false });

      let done = false;
      let progressShown = false;

      const startDownload = (url, attempt) => {
        downloadTask = wx.downloadFile({
          url: url,
          timeout: 600000,
          success: (res) => {
            if (done) return;
            done = true;
            console.log(`[download][video] 下载完成: ${Date.now() - t0}ms, statusCode=${res.statusCode}`);
            wx.hideLoading();
            if (res.statusCode === 200) {
              wx.showLoading({ title: '正在保存到相册...' });
              wx.saveVideoToPhotosAlbum({
                filePath: res.tempFilePath,
                success: () => {
                  wx.hideLoading();
                  console.log(`[download][video] 保存到相册成功, 总耗时: ${Date.now() - t0}ms`);
                  wx.showToast({ title: '视频保存成功', icon: 'success', duration: 2000 });
                  resolve('视频保存成功');
                },
                fail: (err) => {
                  wx.hideLoading();
                  if (err.errMsg && err.errMsg.includes('auth deny')) {
                    wx.showModal({
                      title: '保存失败',
                      content: '请在设置中开启相册权限',
                      confirmText: '去设置',
                      success: (r) => { if (r.confirm) wx.openSetting(); }
                    });
                  }
                  reject(new Error('保存到相册失败: ' + err.errMsg));
                }
              });
            } else if (attempt === 0 && canDirectDownload) {
              console.log(`[download][video] 直连失败(${res.statusCode})，回退代理`);
              done = false;
              buildProxiedUrl(videoUrl, `${videoId || 'video'}.mp4`).then(proxyUrl => {
                if (!proxyUrl) return reject(new Error('获取代理链接失败'));
                startDownload(proxyUrl, 1);
              });
            } else {
              reject(new Error('下载失败，状态码: ' + res.statusCode));
            }
          },
          fail: (err) => {
            if (done) return;
            if (attempt === 0 && canDirectDownload) {
              console.log(`[download][video] 直连失败，回退代理`);
              buildProxiedUrl(videoUrl, `${videoId || 'video'}.mp4`).then(proxyUrl => {
                if (!proxyUrl) return reject(new Error('获取代理链接失败'));
                startDownload(proxyUrl, 1);
              });
              return;
            }
            done = true;
            wx.hideLoading();
            console.log(`[download][video] 下载失败: ${err.errMsg}, 耗时: ${Date.now() - t0}ms`);
            reject(new Error('下载失败: ' + err.errMsg));
          }
        });

        downloadTask.onProgressUpdate((res) => {
          if (done) return;
          progressShown = true;
          if (!res.totalBytesExpectedToWrite || res.totalBytesExpectedToWrite <= 0) {
            const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
            wx.showLoading({ title: '下载中... ' + elapsed + 's', mask: false });
            return;
          }
          const downloaded = (res.totalBytesWritten / (1024 * 1024)).toFixed(1);
          const total = (res.totalBytesExpectedToWrite / (1024 * 1024)).toFixed(1);
          wx.showLoading({ title: '下载中 ' + res.progress + '% (' + downloaded + '/' + total + 'MB)', mask: false });
        });

        // 保底：如果 500ms 内没有进度回调，显示下载中
        setTimeout(function() {
          if (!done && !progressShown) {
            wx.showLoading({ title: '下载中...', mask: false });
          }
        }, 500);
      };

      startDownload(downloadUrl, 0);
    });
  });

  return {
    promise,
    abort: function() { aborted = true; if (downloadTask) downloadTask.abort(); }
  };
}

export { downloadCoverToPhotosAlbum, downloadVideoToPhotosAlbum, ensureWritePhotosAlbumPermission, buildProxiedUrl, getProxySign };
