import { getWindowInfo } from '../../utils/storageManager.js'

// ============================================================
//  DESIGN TOKENS — 轻奢极简 · 诗意留白
// ============================================================
const T = {
  padding: 16,
  outerRadius: 16,   // 海报外边圆角
  cardRadius: 14,
  qrRadius: 8,
  imageRadius: 10,
  imgMargin: 6,      // 图片在卡片内缩进
  // 配色
  bgStart: '#F8F5F2',
  bgEnd:   '#F0ECE6',
  cardBg:  '#FFFFFF',
  accent:  '#07C160',
  textDark:   '#1A1A2E',
  textMid:    '#5B6270',
  textLight:  '#9CA3AF',
  textWhite:  '#FFFFFF',
  // 字体栈
  fontQuote:  '600 17px PingFang SC, sans-serif',
  fontSmall:  '12px PingFang SC, sans-serif',
  fontTiny:   '10px PingFang SC, sans-serif',
  fontDateBig:'bold 32px PingFang SC, sans-serif',
}

// 语录库（30条精选）
const QUOTES = [
  '保持热爱，奔赴山海',
  '生活明朗，万物可爱',
  '这一刻的温柔属于你',
  '今日份的好心情',
  '未来可期，人间值得',
  '愿你眼中有光，心中有爱',
  '所有的运气都藏在努力里',
  '你是自己的光，不需要别人照亮',
  '别慌，月亮也正在大海某处迷茫',
  '万物皆有裂痕，那是光照进来的地方',
  '星光不问赶路人，时光不负有心人',
  '这世界很酷，你也要有骨气',
  '你若盛开，清风自来',
  '愿你遍历山河，觉得人间值得',
  '满怀希望，就会所向披靡',
  '你当像鸟飞往你的山',
  '知足且上进，温柔且坚定',
  '日子常新，未来不远',
  '山海自有归期，风雨自有相逢',
  '热爱可抵岁月漫长',
  '心之所向，素履以往',
  '凡是过去，皆为序章',
  '慢慢来，谁不是翻山越岭去爱',
  '且将新火试新茶，诗酒趁年华',
  '要有最朴素的生活，与最遥远的梦想',
  '愿你此生尽兴，赤诚善良',
  '生如夏花之绚烂',
  '不乱于心，不困于情',
  '愿你有软肋，也有盔甲',
  '不畏将来，不念过往',
]

// ============================================================
//  Canvas 绘制工具函数
// ============================================================

/** 绘制圆角矩形路径 */
function roundRect(ctx, x, y, w, h, r) {
  if (r <= 0) { ctx.rect(x, y, w, h); return }
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

/** 带阴影的圆角卡片 */
function drawCard(ctx, x, y, w, h, r, opts = {}) {
  const { fill = '#FFFFFF', shadowBlur = 12, shadowColor = 'rgba(0,0,0,0.06)', shadowOffsetY = 2 } = opts
  ctx.save()
  ctx.shadowBlur = shadowBlur
  ctx.shadowColor = shadowColor
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = shadowOffsetY
  ctx.fillStyle = fill
  roundRect(ctx, x, y, w, h, r)
  ctx.fill()
  ctx.restore()
}

/** 图片 Aspect Fill 裁剪 + 圆角 */
function drawImageFill(ctx, img, dx, dy, dw, dh, radius) {
  const imgRatio = img.width / img.height
  const canvasRatio = dw / dh

  let sx, sy, sw, sh
  if (imgRatio > canvasRatio) {
    sh = img.height
    sw = sh * canvasRatio
    sx = (img.width - sw) / 2
    sy = 0
  } else {
    sw = img.width
    sh = sw / canvasRatio
    sx = 0
    sy = (img.height - sh) / 2
  }

  ctx.save()
  roundRect(ctx, dx, dy, dw, dh, radius)
  ctx.clip()
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
  ctx.restore()
}

/** 绘制图片底部渐变遮罩 */
function drawGradientOverlay(ctx, x, y, w, h) {
  const grad = ctx.createLinearGradient(x, y + h * 0.55, x, y + h)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(0.5, 'rgba(0,0,0,0.05)')
  grad.addColorStop(1, 'rgba(0,0,0,0.35)')
  ctx.save()
  roundRect(ctx, x, y, w, h, T.imageRadius)
  ctx.clip()
  ctx.fillStyle = grad
  ctx.fillRect(x, y, w, h)
  ctx.restore()
}

/** 获取伪随机语录索引（同一张图保持一致） */
function getQuoteIndex(url) {
  let hash = 0
  for (let i = 0; i < url.length; i++) {
    hash = (hash << 5) - hash + url.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % QUOTES.length
}

/** 获取今天的日期信息 */
function getDateInfo() {
  const now = new Date()
  return {
    month: now.getMonth() + 1,
    day: now.getDate(),
    year: now.getFullYear(),
    weekday: ['日', '一', '二', '三', '四', '五', '六'][now.getDay()]
  }
}

/** 获取图片宽高比（壁纸模式用于自适应卡片尺寸） */
function getImageRatio(url) {
  return new Promise((resolve) => {
    wx.getImageInfo({
      src: url,
      success: (res) => resolve(res.width / res.height),
      fail: () => resolve(9 / 16)  // 降级：默认 9:16
    })
  })
}

// ============================================================
//  组件
// ============================================================
Component({
  properties: {
    visible: {
      type: Boolean,
      value: false,
      observer(newVal) {
        if (newVal) this.initPoster()
      }
    },
    imageUrl: { type: String, value: '' },
    type: { type: String, value: 'wallpaper' } // 'wallpaper' | 'avatar'
  },

  data: {
    width: 300,
    height: 533,
    generating: true,
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
      this.setData({ visible: false })
      this.triggerEvent('close')
    },

    // ============================================================
    //  海报生成主流程
    // ============================================================
    async initPoster() {
      const sysInfo = getWindowInfo()
      const screenW = sysInfo.windowWidth
      const maxW = screenW * 0.82
      const isAvatar = this.data.type === 'avatar'

      // 缓存命中
      if (this.data.posterPath && this.data.lastImageUrl === this.data.imageUrl && this.data.lastType === this.data.type) {
        this.setData({ generating: false })
        return
      }

      this.setData({ generating: true })

      try {
        // ---- 解析图片 URL ----
        let mainImgUrl = this.data.imageUrl
        if (mainImgUrl.startsWith('cloud://')) {
          try {
            const tempRes = await wx.cloud.getTempFileURL({ fileList: [mainImgUrl] })
            if (tempRes.fileList && tempRes.fileList[0].tempFileURL) {
              mainImgUrl = tempRes.fileList[0].tempFileURL
            }
          } catch (e) { console.error('cloud url 转换失败:', e) }
        }

        // ---- 获取图片尺寸（壁纸模式自适应卡片比例）----
        let imgRatio = 9 / 16
        if (!isAvatar) {
          imgRatio = await getImageRatio(mainImgUrl)
        }

        // ---- 计算海报尺寸 ----
        const W = maxW
        let H, cardH
        const cardW = W - T.padding * 2
        const cardX = T.padding
        const cardY = T.padding

        // 底部信息区固定高度：语录(24) + 间距(22) + 分隔线(26) + 日期QR(72) + 品牌(24) + 底padding(16) = 184
        const infoSectionH = 184

        if (isAvatar) {
          cardH = cardW  // 正方形
          H = cardY + cardH + 28 + 24 + 26 + 72 + 24 + T.padding
        } else {
          cardH = cardW / imgRatio
          // 限制卡片最小/最大高度
          const maxCardH = sysInfo.windowHeight * 0.52
          const minCardH = 100
          if (cardH > maxCardH) cardH = maxCardH
          if (cardH < minCardH) cardH = minCardH
          H = cardY + cardH + infoSectionH
        }

        this.setData({ width: W, height: H })

        // ---- 等待 DOM 渲染 ----
        await new Promise(resolve => setTimeout(resolve, 150))

        // ---- 获取 Canvas 节点 ----
        const canvasRes = await new Promise((resolve) => {
          this.createSelectorQuery()
            .select('#posterCanvas')
            .fields({ node: true, size: true })
            .exec((res) => resolve(res))
        })

        if (!canvasRes[0] || !canvasRes[0].node) {
          setTimeout(() => this.initPoster(), 200)
          return
        }

        const canvas = canvasRes[0].node
        const ctx = canvas.getContext('2d')
        const dpr = sysInfo.pixelRatio

        // 重置 + 设物理尺寸
        canvas.width = 0
        canvas.height = 0
        canvas.width = W * dpr
        canvas.height = H * dpr
        ctx.scale(dpr, dpr)

        // ==================== 外边圆角裁剪 ====================
        ctx.save()
        roundRect(ctx, 0, 0, W, H, T.outerRadius)
        ctx.clip()

        // ==================== DRAWING ====================

        // --- 1. 整体背景渐变 ---
        const bgGrad = ctx.createLinearGradient(0, 0, 0, H)
        bgGrad.addColorStop(0, T.bgStart)
        bgGrad.addColorStop(1, T.bgEnd)
        ctx.fillStyle = bgGrad
        ctx.fillRect(0, 0, W, H)

        // --- 2. 主图卡片区域 ---
        drawCard(ctx, cardX, cardY, cardW, cardH, T.cardRadius)

        // 图片区域（卡片内缩进 imgMargin）
        const imgX = cardX + T.imgMargin
        const imgY = cardY + T.imgMargin
        const imgW = cardW - T.imgMargin * 2
        const imgH = cardH - T.imgMargin * 2

        // 加载并绘制主图
        const mainImg = await this.loadImage(canvas, mainImgUrl)

        // 绘制图片（圆角 + Aspect Fill，由于卡片比例匹配图片比例，裁剪极小）
        drawImageFill(ctx, mainImg, imgX, imgY, imgW, imgH, T.imageRadius)

        // 图片底部渐变遮罩
        drawGradientOverlay(ctx, imgX, imgY, imgW, imgH)

        // 品牌文字（在图片遮罩上）
        ctx.save()
        roundRect(ctx, imgX, imgY, imgW, imgH, T.imageRadius)
        ctx.clip()
        const brandY = imgY + imgH - 22
        ctx.font = T.fontSmall
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('小辣椒 · 动态壁纸', W / 2, brandY)
        ctx.restore()

        // --- 3. 语录区域 ---
        const quoteY = cardY + cardH + 28
        const quote = QUOTES[getQuoteIndex(this.data.imageUrl)]

        // 装饰性引导符
        ctx.save()
        ctx.font = '18px serif'
        ctx.fillStyle = T.accent
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('「', W / 2 - 80, quoteY)
        ctx.fillText('」', W / 2 + 80, quoteY)
        ctx.restore()

        // 语录正文
        ctx.save()
        ctx.font = T.fontQuote
        ctx.fillStyle = T.textDark
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(quote, W / 2, quoteY)
        ctx.restore()

        // --- 4. 装饰分隔线 ---
        const lineY = quoteY + 26
        ctx.save()
        ctx.strokeStyle = T.accent
        ctx.lineWidth = 0.8
        ctx.globalAlpha = 0.3
        ctx.beginPath()
        ctx.moveTo(W / 2 - 60, lineY)
        ctx.lineTo(W / 2 + 60, lineY)
        ctx.stroke()
        ctx.globalAlpha = 0.7
        ctx.fillStyle = T.accent
        ctx.beginPath()
        ctx.arc(W / 2, lineY, 2.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()

        // --- 5. 底部：日期 + 小程序码 ---
        const bottomY = lineY + 24
        const date = getDateInfo()

        // 日期 - 左侧
        const dateX = T.padding + 8
        const dateCenterY = bottomY + 28

        ctx.save()
        ctx.font = T.fontDateBig
        ctx.fillStyle = T.textDark
        ctx.textAlign = 'left'
        ctx.textBaseline = 'bottom'
        ctx.fillText(`${date.month} / ${date.day}`, dateX, dateCenterY + 4)
        ctx.restore()

        ctx.save()
        ctx.font = T.fontSmall
        ctx.fillStyle = T.textLight
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(`${date.year}  ·  星期${date.weekday}`, dateX, dateCenterY + 6)
        ctx.restore()

        // 小程序码 - 右侧
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
            const qrBoxSize = 64
            const qrBoxX = W - T.padding - qrBoxSize - 4
            const qrBoxY = bottomY + 2

            // 小程序码白色底盒
            drawCard(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, T.qrRadius, {
              shadowBlur: 8,
              shadowColor: 'rgba(0,0,0,0.06)',
              shadowOffsetY: 1
            })

            // 加载并绘制小程序码图片
            const qrImg = await this.loadImage(canvas, qrUrl)
            const qrPad = 5
            ctx.save()
            roundRect(ctx, qrBoxX + qrPad, qrBoxY + qrPad, qrBoxSize - qrPad * 2, qrBoxSize - qrPad * 2, T.qrRadius - 2)
            ctx.clip()
            ctx.drawImage(qrImg, qrBoxX + qrPad, qrBoxY + qrPad, qrBoxSize - qrPad * 2, qrBoxSize - qrPad * 2)
            ctx.restore()

            // "扫码体验" 文字
            const scanTextY = qrBoxY + qrBoxSize + 10
            ctx.save()
            ctx.font = T.fontTiny
            ctx.fillStyle = T.textLight
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'
            ctx.fillText('扫码体验', qrBoxX + qrBoxSize / 2, scanTextY)
            ctx.restore()
          }
        } catch (e) { console.error('小程序码加载失败:', e) }

        // --- 6. 底部品牌水印 ---
        const footerY = H - 16
        ctx.save()
        ctx.font = T.fontTiny
        ctx.fillStyle = T.textLight
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillText('小辣椒动态头像壁纸', W / 2, footerY)
        ctx.restore()

        // ==================== 恢复圆角裁剪 ====================
        ctx.restore()

        // ==================== 导出图片 ====================
        wx.canvasToTempFilePath({
          canvas,
          destWidth: W * 2,
          destHeight: H * 2,
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
      } catch (e) {
        this.setData({ generating: false })
        console.error('海报生成失败:', e)
      }
    },

    // ============================================================
    //  图片加载
    // ============================================================
    loadImage(canvas, url) {
      return new Promise((resolve, reject) => {
        const img = canvas.createImage()
        img.onload = () => resolve(img)
        img.onerror = (e) => {
          console.error('图片加载失败:', url, e)
          reject(e)
        }
        img.crossOrigin = 'anonymous'
        img.src = url
      })
    },

    // ============================================================
    //  操作按钮
    // ============================================================
    shareToFriend() {
      if (!this.data.posterPath) {
        wx.showToast({ title: '海报生成中...', icon: 'none' })
        return
      }
      wx.showShareImageMenu({
        path: this.data.posterPath,
        success: () => console.log('分享菜单调用成功'),
        fail: (err) => {
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
