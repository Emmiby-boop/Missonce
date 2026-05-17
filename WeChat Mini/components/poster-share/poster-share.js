import { getWindowInfo } from '../../utils/storageManager.js'

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false,
      observer(newVal) {
        if (newVal) {
          this.initPoster()
        }
      }
    },
    imageUrl: {
      type: String,
      value: ''
    },
    type: {
      type: String,
      value: 'wallpaper' // 'wallpaper' (9:16) or 'avatar' (1:1)
    }
  },

  data: {
    width: 300,
    height: 533, // 默认 9:16
    generating: true, // 控制加载动画
    saving: false,
    posterPath: '', 
    qrCodeUrl: '',
    canShowShareMenu: false
  },

  lifetimes: {
    attached() {
      if (wx.showShareImageMenu) {
        this.setData({ canShowShareMenu: true })
      }
    }
  },

  methods: {
    noop() {}, 

    onClose() {
      this.setData({ visible: false }) // 直接关闭
      this.triggerEvent('close')
    },

    async initPoster() {
      // 1. 计算尺寸
      const sysInfo = getWindowInfo()
      const screenWidth = sysInfo.windowWidth
      const maxPosterWidth = screenWidth * 0.8 // 屏幕宽度的 80%
      
      let posterWidth = maxPosterWidth
      let posterHeight
      
      if (this.data.type === 'avatar') {
        // 头像模式：正方形海报 (主图 1:1 + 底部信息)
        // 设计：整体宽高比约为 3:4 比较合适，或者直接正方形主图下方加一点白边
        // 这里采用：主图正方形，下方留 120px 放信息
        posterHeight = posterWidth + 120
      } else {
        // 壁纸模式：9:16 海报
        posterHeight = (posterWidth * 16) / 9
      }
      
      this.setData({ 
        width: posterWidth,
        height: posterHeight,
        generating: true
      })

      // 如果有缓存且图片未变，直接显示
      if (this.data.posterPath && this.data.lastImageUrl === this.data.imageUrl && this.data.lastType === this.data.type) {
        this.setData({ generating: false })
        return
      }

      // wx.showLoading({ title: '生成中...' }) // 去除文字提示，用动画
      
      try {
        // 强制延时一点点，确保 DOM 已经渲染 (尤其是二次打开时)
        await new Promise(resolve => setTimeout(resolve, 100))

        const query = this.createSelectorQuery()
        query.select('#posterCanvas')
          .fields({ node: true, size: true })
          .exec(async (res) => {
            if (!res[0] || !res[0].node) {
              // 如果获取不到节点，尝试重试一次
              console.warn('Canvas node not found, retrying...')
              setTimeout(() => this.initPoster(), 200)
              return
            }
            const canvas = res[0].node
            const ctx = canvas.getContext('2d')
            const dpr = sysInfo.pixelRatio
            
            // 重置画布状态 (解决二次打开白屏关键)
            canvas.width = 0
            canvas.height = 0
            
            // 设置画布物理尺寸
            canvas.width = posterWidth * dpr
            canvas.height = posterHeight * dpr
            ctx.scale(dpr, dpr)
            
            // 1. 绘制背景
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, posterWidth, posterHeight)
            
            // 2. 绘制主图
            let mainImgUrl = this.data.imageUrl
            if (mainImgUrl.startsWith('cloud://')) {
              try {
                const tempRes = await wx.cloud.getTempFileURL({ fileList: [mainImgUrl] })
                if (tempRes.fileList && tempRes.fileList[0].tempFileURL) {
                  mainImgUrl = tempRes.fileList[0].tempFileURL
                }
              } catch (e) { console.error(e) }
            }

            const mainImg = await this.loadImage(canvas, mainImgUrl)
            
            // 根据类型绘制主图
            if (this.data.type === 'avatar') {
               // 头像模式：主图正方形，居中显示
               // 绘制区域：(0, 0, posterWidth, posterWidth)
               const drawSize = posterWidth
               
               // 保持图片比例居中裁剪 (Aspect Fill)
               const imgRatio = mainImg.width / mainImg.height
               let sx, sy, sWidth, sHeight
               if (imgRatio > 1) {
                  sHeight = mainImg.height
                  sWidth = sHeight
                  sx = (mainImg.width - sWidth) / 2
                  sy = 0
               } else {
                  sWidth = mainImg.width
                  sHeight = sWidth
                  sx = 0
                  sy = (mainImg.height - sHeight) / 2
               }
               
               ctx.drawImage(mainImg, sx, sy, sWidth, sHeight, 0, 0, drawSize, drawSize)
               
            } else {
               // 壁纸模式：主图占大部分高度，留底部
               const mainImgHeight = posterHeight - 120 // 底部留 120px
               
               // Aspect Fill
               const imgRatio = mainImg.width / mainImg.height
               const canvasRatio = posterWidth / mainImgHeight
               
               let drawW, drawH, dx, dy
               if (imgRatio > canvasRatio) {
                  drawH = mainImgHeight
                  drawW = drawH * imgRatio
                  dx = (posterWidth - drawW) / 2
                  dy = 0
               } else {
                  drawW = posterWidth
                  drawH = drawW / imgRatio
                  dx = 0
                  dy = (mainImgHeight - drawH) / 2
               }
               
               ctx.save()
               ctx.beginPath()
               ctx.rect(0, 0, posterWidth, mainImgHeight)
               ctx.clip()
               ctx.drawImage(mainImg, dx, dy, drawW, drawH)
               ctx.restore()
            }
            
            // 3. 绘制底部信息区 (共用)
            const footerY = posterHeight - 100 // 信息区起始 Y 坐标
            
            // 日期 (左侧)
            const now = new Date()
            const dateStr = `${now.getMonth() + 1}.${now.getDate()}`
            const yearStr = `${now.getFullYear()}`
            
            ctx.fillStyle = '#333'
            ctx.font = 'bold 36px sans-serif'
            ctx.fillText(dateStr, 20, footerY + 40)
            
            ctx.fillStyle = '#999'
            ctx.font = '14px sans-serif'
            ctx.fillText(yearStr, 20, footerY + 65)

            // 语录 (日期上方)
            const quotes = [
              "保持热爱，奔赴山海",
              "生活明朗，万物可爱",
              "这一刻的温柔属于你",
              "今日份的好心情",
              "未来可期，人间值得",
              "愿你眼中有光，心中有爱",
              "所有的运气都藏在努力里",
              "你是自己的光，不需要别人照亮",
              "别慌，月亮也正在大海某处迷茫",
              "万物皆有裂痕，那是光照进来的地方",
              "我在贩卖日落，你像神明一样慷慨将光洒向我",
              "星光不问赶路人，时光不负有心人",
              "这世界很酷，你也要有骨气",
              "你若盛开，清风自来",
              "愿你遍历山河，觉得人间值得",
              "慢慢来，谁不是翻山越岭去爱",
              "满怀希望，就会所向披靡",
              "且将新火试新茶，诗酒趁年华",
              "你当像鸟飞往你的山",
              "知足且上进，温柔且坚定",
              "日子常新，未来不远",
              "山海自有归期，风雨自有相逢",
              "要有最朴素的生活，与最遥远的梦想",
              "愿你此生尽兴，赤诚善良",
              "热爱可抵岁月漫长",
              "心之所向，素履以往",
              "生如夏花之绚烂，死如秋叶之静美",
              "不乱于心，不困于情，不畏将来，不念过往",
              "愿你有软肋，也有盔甲",
              "凡是过去，皆为序章"
            ]
            // 使用 lastImageUrl 生成伪随机索引，保证同一张图语录不变
            // 使用更复杂的 hash 算法避免索引过于集中
            let hash = 0
            for (let i = 0; i < mainImgUrl.length; i++) {
              hash = (hash << 5) - hash + mainImgUrl.charCodeAt(i)
              hash |= 0 // Convert to 32bit integer
            }
            const quoteIndex = Math.abs(hash) % quotes.length
            const quote = quotes[quoteIndex]
            
            ctx.fillStyle = '#666'
            ctx.font = '13px sans-serif'
            // 头像模式语录放上面一点，壁纸模式放图片上或者日期上
            // 这里统一放在日期上方
            ctx.fillText(quote, 20, footerY + 0)
            
            // 4. 绘制小程序码 (右侧)
            try {
              let qrUrl = this.data.qrCodeUrl
              if (!qrUrl) {
                const res = await wx.cloud.callFunction({
                  name: 'getQRCode',
                  data: { path: 'pages/index/index', scene: 's=p' }
                })
                if (res.result && res.result.url) {
                  qrUrl = res.result.url
                  this.data.qrCodeUrl = qrUrl
                }
              }
              
              if (qrUrl) {
                const qrImg = await this.loadImage(canvas, qrUrl)
                const qrSize = 70
                const qrX = posterWidth - qrSize - 20
                const qrY = posterHeight - qrSize - 20
                
                ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)
                
                ctx.fillStyle = '#999'
                ctx.font = '10px sans-serif'
                ctx.textAlign = 'center'
                ctx.fillText('长按识别', qrX + qrSize/2, qrY + qrSize + 12)
              }
            } catch (e) { console.error(e) }
            
            // 生成图片
            wx.canvasToTempFilePath({
              canvas,
              destWidth: posterWidth * 2, // 导出 2 倍图更清晰
              destHeight: posterHeight * 2,
              success: (res) => {
                this.setData({ 
                  posterPath: res.tempFilePath,
                  lastImageUrl: this.data.imageUrl,
                  lastType: this.data.type,
                  generating: false
                })
              },
              fail: () => {
                this.setData({ generating: false })
              }
            })
          })
      } catch (e) {
        this.setData({ generating: false })
        console.error(e)
      }
    },

    loadImage(canvas, url) {
      return new Promise((resolve, reject) => {
        const img = canvas.createImage()
        img.onload = () => resolve(img)
        img.onerror = (e) => {
          console.error('图片加载失败', url, e)
          reject(e)
        }
        // 处理跨域图片
        img.crossOrigin = 'anonymous' 
        img.src = url
      })
    },

    shareToFriend() {
      if (!this.data.posterPath) {
        wx.showToast({ title: '海报生成中...', icon: 'none' })
        return
      }
      
      wx.showShareImageMenu({
        path: this.data.posterPath,
        success: () => {
          console.log('调用分享菜单成功')
        },
        fail: (err) => {
          console.error('调用分享菜单失败', err)
          if (err.errMsg.includes('deny') || err.errMsg.includes('cancel')) return
          wx.showToast({ title: '分享失败', icon: 'none' })
        }
      })
    },

    savePoster() {
      if (!this.data.posterPath) {
        wx.showToast({ title: '海报生成中...', icon: 'none' })
        return
      }

      wx.saveImageToPhotosAlbum({
        filePath: this.data.posterPath,
        success: () => {
          wx.showToast({ title: '已保存到相册', icon: 'success' })
          this.triggerEvent('close')
        },
        fail: (err) => {
          if (err.errMsg.includes('auth')) {
            wx.showModal({
              title: '提示',
              content: '需要授权保存图片到相册',
              success: (r) => {
                if (r.confirm) wx.openSetting()
              }
            })
          }
        }
      })
    }
  }
})
