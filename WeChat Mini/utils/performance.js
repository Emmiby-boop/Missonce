// 性能监控工具
const pageLoadTimes = {}

export const performanceMonitor = {
  startPageLoad(pageName) {
    pageLoadTimes[pageName] = {
      startTime: Date.now(),
      milestones: {}
    }
    console.log(`[Performance] 🚀 ${pageName} 页面加载开始`)
  },

  markMilestone(pageName, milestoneName) {
    if (pageLoadTimes[pageName]) {
      const elapsed = Date.now() - pageLoadTimes[pageName].startTime
      pageLoadTimes[pageName].milestones[milestoneName] = elapsed
      console.log(`[Performance] ⏱️  ${pageName} - ${milestoneName}: ${elapsed}ms`)
    }
  },

  endPageLoad(pageName, extraInfo = {}) {
    if (pageLoadTimes[pageName]) {
      const totalTime = Date.now() - pageLoadTimes[pageName].startTime
      pageLoadTimes[pageName].endTime = Date.now()
      pageLoadTimes[pageName].totalTime = totalTime
      
      console.group(`[Performance] ✅ ${pageName} 页面加载完成`)
      console.log(`总耗时: ${totalTime}ms`)
      console.log('里程碑:', pageLoadTimes[pageName].milestones)
      if (Object.keys(extraInfo).length > 0) {
        console.log('额外信息:', extraInfo)
      }
      console.groupEnd()
      
      return {
        totalTime,
        milestones: pageLoadTimes[pageName].milestones,
        ...extraInfo
      }
    }
    return null
  },

  getPageLoadTime(pageName) {
    const stats = pageLoadTimes[pageName]
    if (!stats) return null
    const endTime = stats.endTime || Date.now()
    return endTime - stats.startTime
  },

  getPageStats(pageName) {
    return pageLoadTimes[pageName] || null
  },

  getAllStats() {
    return { ...pageLoadTimes }
  }
}

export default performanceMonitor