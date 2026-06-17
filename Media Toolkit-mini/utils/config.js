/**
 * 小程序全局配置文件
 * 
 * 部署说明：
 * 1. 修改 baseURL 为您的后端服务地址
 * 2. 确保后端服务已配置正确的 CORS 白名单
 */

const config = {
  // 后端服务器基础域名
  baseURL: 'https://api.missonce.cc',
  
  // 请求超时时间（毫秒）
  timeout: 15000,
  
  // 最大重试次数
  maxRetries: 1,

  // 广告单元 AppID（对应微信流量主广告）
  appId: 'wx7fb5f1fa0daab97d',
};

export default config;

