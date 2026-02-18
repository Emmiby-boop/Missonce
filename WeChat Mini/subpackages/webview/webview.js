/**
 * WebView 内嵌网页容器
 * 支持从 H5 跳转到小程序预览页面
 * 
 * H5 调用方式：
 * 1. 直接跳转（推荐）：
 *    wx.miniProgram.navigateTo({
 *      url: '/subpackages/preview/preview?url=...'
 *    })
 * 
 * 2. 通过 postMessage（需触发返回/分享）：
 *    wx.miniProgram.postMessage({
 *      data: { action: 'previewImage', type: 'avatar', url: '...' }
 *    })
 *    wx.miniProgram.navigateBack()
 */
Page({
  data: {
    url: ''
  },

  onLoad(options) {
    if (options.url) {
      this.setData({
        url: decodeURIComponent(options.url)
      })
    }
  },

  /**
   * 监听 H5 发送的消息
   * 注意：postMessage 只在以下时机触发：
   * - 小程序后退（navigateBack）
   * - 组件销毁
   * - 分享时机
   * - 复制链接
   */
  onMessage(e) {
    console.log('WebView received message:', e.detail)
    
    // 获取最新的消息数据
    const data = e.detail.data
    if (!data || data.length === 0) return
    
    // data 是数组，取最后一条消息
    const message = data[data.length - 1]
    
    if (!message || !message.action) return
    
    switch (message.action) {
      case 'previewImage':
        this.handlePreviewImage(message)
        break
      case 'navigateTo':
        this.handleNavigateTo(message)
        break
      default:
        console.warn('Unknown action:', message.action)
    }
  },

  /**
   * 处理图片预览请求
   */
  handlePreviewImage(message) {
    const { type, url, urls, currentIndex, imageData } = message
    
    // 构建图片列表
    const imageList = urls || (url ? [url] : [])
    if (imageList.length === 0) {
      wx.showToast({ title: '图片地址缺失', icon: 'none' })
      return
    }
    
    const currentUrl = url || imageList[0]
    const index = currentIndex || 0
    const metadata = imageData || {}
    
    // 根据类型跳转到不同预览页面
    if (type === 'avatar') {
      this.navigateToAvatarPreview(currentUrl, imageList, index, metadata)
    } else if (type === 'wallpaper') {
      this.navigateToWallpaperPreview(currentUrl, imageList, index, metadata)
    } else {
      // 默认使用原生预览
      wx.previewImage({
        current: currentUrl,
        urls: imageList
      })
    }
  },

  /**
   * 跳转到头像预览页面
   */
  navigateToAvatarPreview(url, imageList, currentIndex, avatarData) {
    const params = new URLSearchParams({
      url: url,
      imageList: JSON.stringify(imageList),
      currentIndex: String(currentIndex),
      avatarData: JSON.stringify(avatarData),
      isAvatar: 'true'
    })
    
    wx.navigateTo({
      url: `/subpackages/preview/preview?${params.toString()}`,
      fail: (err) => {
        console.error('跳转头像预览失败:', err)
        // 降级使用原生预览
        wx.previewImage({ current: url, urls: imageList })
      }
    })
  },

  /**
   * 跳转到壁纸预览页面
   */
  navigateToWallpaperPreview(url, imageList, currentIndex, wallpaperData) {
    const params = new URLSearchParams({
      url: url,
      imageList: JSON.stringify(imageList),
      currentIndex: String(currentIndex),
      wallpaperData: JSON.stringify(wallpaperData)
    })
    
    wx.navigateTo({
      url: `/subpackages/wallpaper-preview/wallpaper-preview?${params.toString()}`,
      fail: (err) => {
        console.error('跳转壁纸预览失败:', err)
        // 降级使用原生预览
        wx.previewImage({ current: url, urls: imageList })
      }
    })
  },

  /**
   * 处理通用页面跳转
   */
  handleNavigateTo(message) {
    const { url } = message
    if (!url) return
    
    wx.navigateTo({
      url: url,
      fail: (err) => {
        console.error('跳转失败:', err)
      }
    })
  }
})
