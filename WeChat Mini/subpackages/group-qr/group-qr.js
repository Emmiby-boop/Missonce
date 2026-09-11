const { getWindowInfo } = require('../../utils/storageManager.js')

// 默认配置（后台未配置时使用）
const DEFAULT_CONFIG = {
  qrImage: '',
  eyebrow: '社群公告',
  title1: '小辣椒',
  title2: '动态头像交流群',
  subtitle: '欢迎加入，一起玩转动效头像、分享创意素材，让每一次聊天都更有趣。',
  stats: [
    { value: '24h', label: '活跃交流' },
    { value: '素材', label: '免费共享' },
    { value: '反馈', label: '在线答疑' }
  ],
  features: [
    { title: '趣味头像', desc: '精选动态头像资源，让你的头像更吸睛。' },
    { title: '互助答疑', desc: '遇到问题随时提问，热心群友一起解决。' },
    { title: '素材投稿', desc: '好的素材，可以一起分享。' }
  ]
}

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    config: DEFAULT_CONFIG,
    qrUrl: '',
    saving: false
  },

  onLoad() {
    const sysInfo = getWindowInfo()
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 20,
      navBarHeight: 44
    })
    this.loadConfig()
  },

  async loadConfig() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getConfig', data: { key: 'groupQr' } })
      const configData = res.result?.data?.value
      if (configData) {
        const config = {
          ...DEFAULT_CONFIG,
          ...configData,
          stats: configData.stats?.length === 3 ? configData.stats : DEFAULT_CONFIG.stats,
          features: configData.features?.length === 3 ? configData.features : DEFAULT_CONFIG.features
        }
        this.setData({ config })

        // 转换二维码 cloud:// URL
        if (config.qrImage) {
          if (config.qrImage.startsWith('cloud://')) {
            try {
              const urlRes = await wx.cloud.getTempFileURL({ fileList: [config.qrImage] })
              const tempUrl = urlRes.fileList?.[0]?.tempFileURL
              if (tempUrl) this.setData({ qrUrl: tempUrl })
            } catch (e) {
              console.warn('[加群页] 二维码 URL 转换失败:', e)
            }
          } else {
            this.setData({ qrUrl: config.qrImage })
          }
        }
      }
    } catch (e) {
      console.warn('[加群页] 加载配置失败，使用默认配置:', e)
    }
  },

  onBack() {
    wx.navigateBack()
  },

  async saveQrToAlbum() {
    if (!this.data.qrUrl) {
      wx.showToast({ title: '二维码未加载', icon: 'none' })
      return
    }
    if (this.data.saving) return
    this.setData({ saving: true })

    try {
      // 检查相册权限
      const hasPermission = await this.ensureAlbumPermission()
      if (!hasPermission) {
        wx.showToast({ title: '需要相册权限', icon: 'none' })
        return
      }

      // 下载图片到临时路径
      const dlRes = await wx.cloud.downloadFile({ fileID: this.data.config.qrImage })
      await wx.saveImageToPhotosAlbum({
        filePath: dlRes.tempFilePath,
        success: () => {
          wx.showToast({ title: '已保存到相册', icon: 'success' })
        },
        fail: () => {
          wx.showToast({ title: '保存失败', icon: 'none' })
        }
      })
    } catch (e) {
      console.error('[加群页] 保存二维码失败:', e)
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  ensureAlbumPermission() {
    return new Promise((resolve) => {
      wx.getSetting({
        success: (res) => {
          const has = res.authSetting && res.authSetting['scope.writePhotosAlbum']
          if (has) { resolve(true); return }
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success: () => resolve(true),
            fail: () => {
              wx.showModal({
                title: '提示',
                content: '需要您授权保存图片到相册',
                confirmText: '去授权',
                cancelText: '取消',
                success: (r) => {
                  if (r.confirm) {
                    wx.openSetting({
                      success: (s) => resolve(!!(s.authSetting && s.authSetting['scope.writePhotosAlbum'])),
                      fail: () => resolve(false)
                    })
                  } else {
                    resolve(false)
                  }
                }
              })
            }
          })
        },
        fail: () => resolve(false)
      })
    })
  }
})
