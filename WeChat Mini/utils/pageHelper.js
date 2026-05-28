/**
 * 页面公共辅助函数
 * 用于提取多个页面重复的代码
 */

/**
 * 初始化导航栏高度
 * @returns {Object} { statusBarHeight, navBarHeight }
 */
export function initNavBar() {
  try {
    const info = wx.getWindowInfo()
    const statusBarHeight = info.statusBarHeight || 20
    const navBarHeight = 44
    return { statusBarHeight, navBarHeight }
  } catch (e) {
    console.error('获取系统信息失败:', e)
    return { statusBarHeight: 20, navBarHeight: 44 }
  }
}

/**
 * 返回上一页或首页
 */
export function navigateBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    wx.navigateBack()
  } else {
    wx.switchTab({ url: '/pages/index/index' })
  }
}

/**
 * 格式化日期
 * @param {Date} date 
 * @returns {Object} { dateStr, dayNum, monthText, weekDay }
 */
export function formatDate(date = new Date()) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  
  return {
    dateStr: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    dayNum: String(day).padStart(2, '0'),
    monthText: `${month}月`,
    weekDay: weekDays[date.getDay()]
  }
}

/**
 * 创建页面基础配置
 * 包含导航栏初始化、返回按钮等通用逻辑
 * @param {Object} pageConfig 页面特定配置
 * @returns {Object} 完整页面配置
 */
export function createPage(pageConfig = {}) {
  return {
    data: {
      statusBarHeight: 20,
      navBarHeight: 44,
      ...pageConfig.data
    },
    
    initNavBar() {
      const { statusBarHeight, navBarHeight } = initNavBar()
      this.setData({ statusBarHeight, navBarHeight })
    },
    
    navigateBack() {
      navigateBack()
    },
    
    onLoad(options) {
      this.initNavBar()
      if (pageConfig.onLoad) {
        pageConfig.onLoad.call(this, options)
      }
    },
    
    ...pageConfig
  }
}

export default {
  initNavBar,
  navigateBack,
  formatDate,
  createPage
}
