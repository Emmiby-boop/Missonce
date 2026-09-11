
import { getWindowInfo } from './storageManager.js'
import logger from './logger'

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
    const info = getWindowInfo()
    const screenWidth = info.windowWidth || 375
    // 2列布局：屏幕宽度一半减去间距 (假设间距约 20px)
    // 加上设备像素比 (dpr) 考虑，通常 2x 屏，所以实际像素宽 * 2
    // 但 imageMogr2 的 thumbnail 参数通常指逻辑像素或物理像素，视服务商而定
    // 腾讯云通常指物理像素，所以乘上 dpr 更清晰
    const dpr = info.pixelRatio || 2
    const columnWidth = (screenWidth - 20) / 2
    return Math.floor(columnWidth * dpr)
  } catch (e) {
    logger.warn('getOptimalThumbnailSize 降级返回 350', e)
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

/**
 * 获取 GIF 缩略图宽度
 * GIF 图片使用更小的尺寸以提升加载速度
 */
export const getGifThumbnailSize = () => {
  try {
    const info = getWindowInfo()
    const screenWidth = info.windowWidth || 375
    const dpr = info.pixelRatio || 2
    const columnWidth = (screenWidth - 20) / 2
    // GIF 使用更小的尺寸，提高加载速度
    return Math.floor(columnWidth * dpr * 0.8)
  } catch (e) {
    logger.warn('getGifThumbnailSize 降级返回 280', e)
    return 280 // 降级默认值
  }
}

/**
 * 🔥 [预览页优化] 预览页主图（当前帧）的目标宽度
 * 主预览区域宽度 ≈ 屏幕宽度 - 40rpx 边距，预留 1.5x DPR 余量兼顾清晰度
 * 不超过 1080（移动端实际不需要更大）
 * GIF 不转 WebP 走原通道，静态图自动转 WebP
 */
export const getPreviewMainSize = () => {
  try {
    const info = getWindowInfo()
    const screenWidth = info.windowWidth || 375
    const dpr = info.pixelRatio || 2
    // 主图渲染宽度：屏幕宽 × 1.5（适配 2x/3x 屏）
    const target = Math.floor(screenWidth * 1.5 * dpr)
    return Math.min(Math.max(target, 480), 1080)
  } catch (e) {
    logger.warn('getPreviewMainSize 降级返回 720', e)
    return 720
  }
}

/**
 * 🔥 [预览页优化] swiper 邻居图（上下各 1 张）的目标宽度
 * 比主图略小，仅作为预览用，用户切到才升级为主图
 * 配合 wx:if 控制离屏图不渲染，进一步减少下载
 */
export const getPreviewNeighborSize = () => {
  try {
    const info = getWindowInfo()
    const screenWidth = info.windowWidth || 375
    const dpr = info.pixelRatio || 2
    // 邻居图渲染宽度：屏幕宽 × 1.0
    const target = Math.floor(screenWidth * 1.0 * dpr)
    return Math.min(Math.max(target, 360), 750)
  } catch (e) {
    logger.warn('getPreviewNeighborSize 降级返回 540', e)
    return 540
  }
}

/**
 * 🔥 [预览页优化] 单个 URL 处理 - 公开版本
 * 与内部 processUrl 逻辑一致，但可外部调用处理预览图 URL
 * - HTTP + 静态图：imageMogr2/thumbnail/{w}x/format/webp
 * - HTTP + GIF：imageMogr2/thumbnail/{w}x（不转 WebP，保留动画）
 * - cloud:// 原样返回（小程序 image 组件原生缓存最优）
 * - 已处理过的 URL 跳过（包含 imageMogr2）
 */
export const processPreviewUrl = (url, width) => {
  if (!url) return url
  if (url.startsWith('cloud://')) return url
  return processUrl(url, width)
}

export default {
  optimizeImageUrls,
  processPreviewUrl,
  getPreviewMainSize,
  getPreviewNeighborSize,
  getOptimalThumbnailSize,
  getGifThumbnailSize
}
