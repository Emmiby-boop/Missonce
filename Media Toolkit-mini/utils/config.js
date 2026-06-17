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
};

export default config;

