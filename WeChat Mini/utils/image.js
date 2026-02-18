
/**
 * 图片优化工具
 */

const CLOUD_FILE_PREFIX = 'cloud://'

/**
 * 获取最佳缩略图宽度
 * 基于屏幕宽度动态计算，适用于2列瀑布流布局
 */
export const getOptimalThumbnailSize = () => {
  try {
    const info = wx.getWindowInfo()
    const screenWidth = info.windowWidth || 375
    // 2列布局：屏幕宽度一半减去间距 (假设间距约 20px)
    // 加上设备像素比 (dpr) 考虑，通常 2x 屏，所以实际像素宽 * 2
    // 但 imageMogr2 的 thumbnail 参数通常指逻辑像素或物理像素，视服务商而定
    // 腾讯云通常指物理像素，所以乘上 dpr 更清晰
    const dpr = info.pixelRatio || 2
    const columnWidth = (screenWidth - 20) / 2
    return Math.floor(columnWidth * dpr)
  } catch (e) {
    return 350 // 降级默认值
  }
}

/**
 * 批量优化图片链接 (核心优化函数)
 * 1. Cloud ID (cloud://) -> 直接返回，不换取临时链接 (由组件原生处理，速度最快)
 * 2. HTTP 链接 -> 添加 WebP 和缩放参数
 * 
 * @param {Array} items - 包含 url/coverUrl 的对象数组
 * @param {String} urlKey - 图片字段名，默认 'coverUrl'，如不存在则尝试 'url'
 * @param {Number} width - 目标宽度，默认自动计算
 */
export const optimizeImageUrls = (items, urlKey = 'coverUrl', width) => {
  if (!items || items.length === 0) return []

  // 如果未指定宽度，自动计算
  const targetWidth = width || getOptimalThumbnailSize()
  
  // 直接同步处理，不使用 await，避免阻塞渲染
  return items.map(item => {
    const originalUrl = item[urlKey] || item.url || ''
    let optimizedUrl = originalUrl

    // 1. 如果是 Cloud ID，直接使用，不进行任何处理
    // 微信小程序 image 组件对 cloud:// 有原生缓存优化，手动换取临时链接反而慢且消耗额度
    if (originalUrl.startsWith('cloud://')) {
      optimizedUrl = originalUrl
    } 
    // 2. 如果是 HTTP 链接，添加处理参数
    else if (originalUrl.startsWith('http')) {
      optimizedUrl = processUrl(originalUrl, targetWidth)
    }

    // 务必返回新对象，不要修改原对象
    return {
      ...item,
      optimizedUrl
    }
  })
}

/**
 * 单个 URL 处理 (同步)
 */
const processUrl = (url, width) => {
  if (!url || !url.startsWith('http')) return url

  // 已经包含处理参数，跳过
  if (url.includes('imageMogr2')) return url

  // 🚨 重要：GIF 图片不转换为 WebP，保持动画特性
  const isGif = url.toLowerCase().endsWith('.gif') || url.includes('.gif?') || url.includes('&gif=') || url.includes('?gif=')
  if (isGif) {
    // GIF 只需要缩放，不转格式
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}imageMogr2/thumbnail/${width}x/interlace/1/quality/80`
  }

  // 静态图片转换为 WebP
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}imageMogr2/thumbnail/${width}x/format/webp/interlace/1/quality/80`
}

export default {
  optimizeImageUrls
}
