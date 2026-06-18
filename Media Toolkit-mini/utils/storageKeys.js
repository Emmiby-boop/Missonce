/**
 * 统一 Storage Key 常量
 * 所有 wx.setStorageSync / getStorageSync / removeStorageSync 必须引用此文件，
 * 禁止手写字符串 key，防止 key 不一致导致的数据丢失 bug。
 */
const STORAGE_KEYS = {
  // ── 解析 & 历史 ──
  PARSE_HISTORY: 'parse_history',         // 解析历史记录列表
  CURRENT_RESULT: 'current_result',        // 当前解析结果（流转到播放页）

  // ── 热门榜单 ──
  TRENDING_CACHE: 'trending_cache',        // 热门数据缓存
  TRENDING_CACHE_TIME: 'trending_cache_time', // 热门缓存时间戳
  TRENDING_URL: 'trending_url',            // 暂存的热门链接
  TRENDING_PARSE_CACHE: 'trending_parse_cache', // 热门解析结果缓存
  TRENDING_PLAYLIST: 'trending_playlist',  // 热门播放列表

  // ── 用户 ──
  USER_INFO: 'user_info',                  // 用户资料（昵称、头像等）
  OPENID: 'openid',                        // 用户 openid
  LOGIN_TIME: 'login_time',                // 最后登录时间

  // ── 系统 ──
  THEME_MODE: 'theme_mode',                // 主题模式（light/dark/auto）
  PRIVACY_AGREED: 'privacy_agreed',        // 隐私协议同意标识
  PAGE_CONFIG: 'page_config',              // 页面开关配置
  PAGE_CONFIG_TIME: 'page_config_time',    // 页面配置缓存时间
};

export default STORAGE_KEYS;
