/**
 * 腾讯云 COS 工具
 * 用于将视频下载到 COS 后生成临时 URL 供用户高速下载
 */
const COS = require('cos-nodejs-sdk-v5');
const crypto = require('crypto');

const cos = new COS({
  SecretId: process.env.COS_SECRET_ID || process.env.TCB_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY || process.env.TCB_SECRET_KEY,
  Region: process.env.COS_REGION || 'ap-hongkong',
});

const BUCKET = process.env.COS_BUCKET || 'missoncehk-1318542519';

/**
 * 生成 COS 临时下载 URL（有效期 10 分钟）
 */
function generateTempUrl(cosKey) {
  return new Promise(function(resolve, reject) {
    cos.getObjectUrl({
      Bucket: BUCKET,
      Region: 'ap-hongkong',
      Key: cosKey,
      Sign: true,
      Expires: 600,
    }, function(err, data) {
      if (err) {
        reject(err);
      } else {
        resolve(data.Url);
      }
    });
  });
}

/**
 * 流式上传到 COS
 * @param {Stream} readStream - 数据流
 * @param {string} cosKey - COS 对象键
 * @param {number} contentLength - 文件大小
 * @returns {Promise<string>} COS 临时 URL
 */
function uploadStream(readStream, cosKey, contentLength) {
  return new Promise(function(resolve, reject) {
    cos.putObject({
      Bucket: BUCKET,
      Region: cos.getRegion ? cos.getRegion() : 'ap-hongkong',
      Key: cosKey,
      Body: readStream,
      ContentLength: contentLength,
      ContentType: 'video/mp4',
    }, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(generateTempUrl(cosKey));
      }
    });
  });
}

module.exports = { generateTempUrl, uploadStream, BUCKET };
