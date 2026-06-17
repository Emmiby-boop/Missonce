import { request, config } from './request.js';

const adConfigCache = new Map();
const CACHE_EXPIRE_TIME = 5 * 60 * 1000;

export const fetchPageAds = async (pagePath) => {
  try {
    const cacheKey = pagePath;
    const cached = adConfigCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRE_TIME) {
      return cached.data;
    }

    const res = await request('/api/ad-config', {
      method: 'GET',
      data: { pagePath, appId: config.appId }
    });

    if (res && res.succ && Array.isArray(res.data)) {
      adConfigCache.set(cacheKey, {
        data: res.data,
        timestamp: Date.now()
      });
      return res.data;
    }
  } catch (e) {
    console.error('获取广告配置失败:', e);
  }
  return [];
};

export const pickByType = (list, type) => {
  return (list || []).filter(i => i && i.type === type && i.isEnable)
    .sort((a, b) => (b.weight || 0) - (a.weight || 0));
};

export default { fetchPageAds, pickByType };
