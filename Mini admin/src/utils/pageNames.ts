export const PAGE_NAMES: Record<string, string> = {
  '/pages/index/index': '首页',
  '/pages/wallpaper/wallpaper': '壁纸页',
  '/pages/profile/profile': '个人中心',
  '/subpackages/daily-picks/daily-picks': '每日精选',
  '/subpackages/search/search': '搜索',
  '/subpackages/preview/preview': '头像预览',
  '/subpackages/wallpaper-preview/wallpaper-preview': '壁纸预览',
  '/subpackages/resource-list/resource-list': '资源列表',
  '/subpackages/inspiration-writer/inspiration-writer': '灵感文案',
  '/subpackages/points/points': '积分',
  // 被 deny 的页面也保留映射（批量添加弹窗可能显示）
  '/subpackages/profile-edit/profile-edit': '编辑资料',
  '/subpackages/favorites/favorites': '收藏',
  '/subpackages/login/login': '登录',
  '/subpackages/webview/webview': '网页',
  '/subpackages/notifications/notifications': '消息',
}

export function getPageName(path: string): string {
  return PAGE_NAMES[path] || path.split('/').pop() || path
}
