import { getWindowInfo } from '../../utils/storageManager.js'

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    previewSize: 300,
    imageUrl: '',
    currentTab: 'select',
    // 边框分类：preset | static | dynamic
    borderCategory: 'preset',
    currentBorder: 'none',
    borderWidth: 8,
    // 预设头像框（canvas 绘制的 13 种静态框样式）
    currentPreset: 'none',    // none|white|black|pink|purple|polaroid|vintage|neon|double|dots|rainbow|petal|gold
    // 用户上传的头像框（后台管理，按 format 自动分类）
    staticFrames: [],         // PNG 静态框列表（含 displayUrl）
    dynamicFrames: [],        // GIF 动态框列表（含 displayUrl）
    // 当前选中的用户上传头像框（image overlay，可拖动+缩放）
    currentFrame: null,       // 头像框对象
    frameUrl: '',             // 头像框临时 URL
    frameFormat: 'png',       // png | gif
    frameX: 0.5,              // 位置 X（0~1 比例）
    frameY: 0.5,              // 位置 Y（0~1 比例）
    frameScale: 1,            // 缩放比例（0.5~2）
    // 文字
    overlayText: '',
    textColor: '#fff',
    textX: 0.5,
    textY: 0.85,
    textSize: 24,
    // 滤镜
    currentFilter: 'none',
    filterOptions: [
      { key: 'none', name: '原图', cssFilter: 'none' },
      { key: 'gray', name: '黑白', cssFilter: 'grayscale(1)' },
      { key: 'sepia', name: '复古', cssFilter: 'sepia(1)' },
      { key: 'bright', name: '明亮', cssFilter: 'brightness(1.3)' },
      { key: 'warm', name: '暖色', cssFilter: 'sepia(0.4) saturate(1.3) hue-rotate(-10deg)' },
      { key: 'cool', name: '冷色', cssFilter: 'hue-rotate(180deg) saturate(0.8)' }
    ],
    // 生成状态
    isGenerating: false,
    // GIF 底图编辑
    isGifBase: false,
    outputSize: 320,
    maxFrames: 30,
    gifFrameDelay: 100,
    // 变换
    rotation: 0,
    flipH: false
  },

  _canvas: null,
  _ctx: null,
  _img: null,
  _dpr: 1,
  _decoCanvas: null,
  _decoCtx: null,

  onLoad() {
    try {
      const info = getWindowInfo()
      const screenWidth = info.windowWidth || 375
      const statusBarHeight = info.statusBarHeight || 20
      const previewSize = Math.floor(screenWidth * 0.6)
      this.setData({ statusBarHeight, navBarHeight: 44, previewSize })
    } catch (e) {
      console.error('[avatar-diy] 初始化预览尺寸失败:', e)
    }

    this._dpr = wx.getWindowInfo().pixelRatio || 2
    this.loadCustomFrames()
  },

  // 用户主动点击"重新选择"
  onRechooseImage() {
    this._userTriggeredChoose = true
    this.chooseImage()
  },

  // ===== 选择图片 =====
  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        const isGifBase = tempFilePath.toLowerCase().endsWith('.gif')
        this.setData({
          imageUrl: tempFilePath,
          isGifBase,
          currentTab: 'border',
          rotation: 0,
          flipH: false
        })
        if (isGifBase) {
          this.initDecoCanvas()
        } else {
          this.initCanvasAndDraw()
        }
      },
      fail: (err) => {
        if (err.errMsg.indexOf('cancel') === -1) {
          wx.showToast({ title: '选择图片失败', icon: 'none' })
        }
      }
    })
  },

  // ===== Canvas 初始化 + 绘制 =====
  initCanvasAndDraw() {
    const query = wx.createSelectorQuery()
    query.select('#avatarCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0]) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = this._dpr
        const size = this.data.previewSize

        canvas.width = size * dpr
        canvas.height = size * dpr
        ctx.scale(dpr, dpr)

        this._canvas = canvas
        this._ctx = ctx

        const img = canvas.createImage()
        img.onload = () => {
          this._img = img
          this.draw()
        }
        img.onerror = () => {
          wx.showToast({ title: '图片加载失败', icon: 'none' })
        }
        img.src = this.data.imageUrl
      })

    // 同时初始化装饰层 canvas（GIF 合成时需要）
    this.initDecoCanvas()
  },

  // ===== 核心绘制（仅绘制底图+滤镜+边框+文字，头像框由 image overlay 显示） =====
  draw() {
    if (this.data.isGifBase) return
    if (!this._ctx || !this._img) return

    const ctx = this._ctx
    const size = this.data.previewSize
    const img = this._img

    ctx.clearRect(0, 0, size, size)

    ctx.save()
    ctx.translate(size / 2, size / 2)
    if (this.data.rotation) ctx.rotate(this.data.rotation * Math.PI / 180)
    if (this.data.flipH) ctx.scale(-1, 1)
    ctx.translate(-size / 2, -size / 2)

    // 图片裁切（cover 模式）
    const imgRatio = img.width / img.height
    let sx = 0, sy = 0, sw = img.width, sh = img.height
    if (imgRatio > 1) {
      sw = img.height
      sx = (img.width - sw) / 2
    } else {
      sh = img.width
      sy = (img.height - sh) / 2
    }

    // 预设头像框模式：图片缩小留 padding，再绘制头像框
    const isPresetMode = this.data.currentPreset !== 'none'

    if (isPresetMode) {
      const padding = this.getFramePadding(this.data.currentPreset)
      const drawSize = size - padding * 2
      // 应用滤镜到图片本身（带裁切和缩放）
      this.applyFilterToImage(ctx, img, sx, sy, sw, sh, padding, padding, drawSize, drawSize)
      // 绘制预设头像框
      this.drawPresetFrame(ctx, size, padding, drawSize)
    } else {
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size)
      // 滤镜
      this.applyFilter(ctx, size)
      // 边框
      this.drawBorder(ctx, size)
    }

    // 文字
    if (this.data.overlayText) {
      this.drawText(ctx, size)
    }

    ctx.restore()
  },

  // ===== 滤镜（像素级处理，兼容手机端） =====
  // 注意：getImageData/putImageData 使用物理像素，不受 ctx.scale 影响
  applyFilter(ctx, size) {
    const filter = this.data.currentFilter
    if (filter === 'none') return
    const dpr = this._dpr
    const physSize = size * dpr
    try {
      const imageData = ctx.getImageData(0, 0, physSize, physSize)
      this._applyFilterToPixels(imageData.data, filter)
      ctx.putImageData(imageData, 0, 0)
    } catch (e) {
      console.warn('滤镜应用失败:', e)
    }
  },

  // 预设头像框模式下：把滤镜应用到目标区域的像素（带裁切和缩放）
  applyFilterToImage(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh) {
    // 先绘制原图
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)

    const filter = this.data.currentFilter
    if (filter === 'none') return

    const dpr = this._dpr
    try {
      // 取目标区域的像素数据（转换为物理像素坐标）
      const imageData = ctx.getImageData(dx * dpr, dy * dpr, dw * dpr, dh * dpr)
      this._applyFilterToPixels(imageData.data, filter)
      ctx.putImageData(imageData, dx * dpr, dy * dpr)
    } catch (e) {
      console.warn('滤镜应用失败:', e)
    }
  },

  // 像素级滤镜实现（避免使用 ctx.filter，兼容手机端）
  _applyFilterToPixels(data, filter) {
    const len = data.length
    for (let i = 0; i < len; i += 4) {
      let r = data[i], g = data[i + 1], b = data[i + 2]
      switch (filter) {
        case 'gray': {
          const v = 0.299 * r + 0.587 * g + 0.114 * b
          data[i] = data[i + 1] = data[i + 2] = v
          break
        }
        case 'sepia': {
          const nr = r * 0.393 + g * 0.769 + b * 0.189
          const ng = r * 0.349 + g * 0.686 + b * 0.168
          const nb = r * 0.272 + g * 0.534 + b * 0.131
          data[i] = nr > 255 ? 255 : nr
          data[i + 1] = ng > 255 ? 255 : ng
          data[i + 2] = nb > 255 ? 255 : nb
          break
        }
        case 'bright': {
          const nr = r * 1.3, ng = g * 1.3, nb = b * 1.3
          data[i] = nr > 255 ? 255 : nr
          data[i + 1] = ng > 255 ? 255 : ng
          data[i + 2] = nb > 255 ? 255 : nb
          break
        }
        case 'warm': {
          const nr = r * 1.2, ng = g * 1.05, nb = b * 0.85
          data[i] = nr > 255 ? 255 : nr
          data[i + 1] = ng > 255 ? 255 : ng
          data[i + 2] = nb
          break
        }
        case 'cool': {
          const nr = r * 0.85, ng = g * 1.05, nb = b * 1.2
          data[i] = nr
          data[i + 1] = ng > 255 ? 255 : ng
          data[i + 2] = nb > 255 ? 255 : nb
          break
        }
      }
    }
  },

  // ===== 预设头像框（canvas 绘制） =====
  getFramePadding(frame) {
    switch (frame) {
      case 'none': return 0
      case 'polaroid': return 12
      case 'neon': return 16
      case 'dots': return 14
      case 'petal': return 16
      case 'double': return 12
      default: return 10
    }
  },

  drawPresetFrame(ctx, size, padding, drawSize) {
    const frame = this.data.currentPreset
    if (frame === 'none') return

    switch (frame) {
      case 'white':
        this.drawSimpleBorder(ctx, size, padding, drawSize, '#ffffff', 8)
        break
      case 'black':
        this.drawSimpleBorder(ctx, size, padding, drawSize, '#000000', 8)
        break
      case 'pink':
        this.drawGradientBorder(ctx, size, padding, drawSize, ['#ff9a9e', '#fad0c4', '#ff4d9d'])
        break
      case 'purple':
        this.drawGradientBorder(ctx, size, padding, drawSize, ['#667eea', '#764ba2', '#a855f7'])
        break
      case 'polaroid':
        this.drawPolaroid(ctx, size, padding, drawSize)
        break
      case 'vintage':
        this.drawVintage(ctx, size, padding, drawSize)
        break
      case 'neon':
        this.drawNeon(ctx, size, padding, drawSize)
        break
      case 'double':
        this.drawDoubleLine(ctx, size, padding, drawSize)
        break
      case 'dots':
        this.drawDotsDecor(ctx, size, padding, drawSize)
        break
      case 'rainbow':
        this.drawRainbow(ctx, size, padding, drawSize)
        break
      case 'petal':
        this.drawPetal(ctx, size, padding, drawSize)
        break
      case 'gold':
        this.drawGradientBorder(ctx, size, padding, drawSize, ['#fde68a', '#d4af37', '#fde68a'])
        break
    }
  },

  drawSimpleBorder(ctx, size, padding, drawSize, color, width) {
    ctx.lineWidth = width
    ctx.strokeStyle = color
    ctx.strokeRect(padding + width / 2, padding + width / 2, drawSize - width, drawSize - width)
  },

  drawGradientBorder(ctx, size, padding, drawSize, colors) {
    const width = 10
    const gradient = ctx.createLinearGradient(0, 0, size, size)
    colors.forEach((c, i) => {
      gradient.addColorStop(i / (colors.length - 1), c)
    })
    ctx.lineWidth = width
    ctx.strokeStyle = gradient
    ctx.strokeRect(padding + width / 2, padding + width / 2, drawSize - width, drawSize - width)
  },

  drawPolaroid(ctx, size, padding, drawSize) {
    const borderWidth = 8
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(padding, padding, drawSize, borderWidth)
    ctx.fillRect(padding, padding, borderWidth, drawSize)
    ctx.fillRect(padding + drawSize - borderWidth, padding, borderWidth, drawSize)
    const bottomHeight = 50
    ctx.fillRect(padding, padding + drawSize - borderWidth, drawSize, bottomHeight)
    ctx.fillStyle = '#94a3b8'
    ctx.font = '500 14px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Avatar', padding + drawSize / 2, padding + drawSize + 12)
  },

  drawVintage(ctx, size, padding, drawSize) {
    const width = 12
    ctx.lineWidth = width
    ctx.strokeStyle = '#8b5e3c'
    ctx.strokeRect(padding + width / 2, padding + width / 2, drawSize - width, drawSize - width)
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(255, 220, 180, 0.6)'
    ctx.strokeRect(padding + width + 4, padding + width + 4, drawSize - width * 2 - 8, drawSize - width * 2 - 8)
    ctx.fillStyle = '#d4a574'
    const cornerSize = 8
    const corners = [
      [padding, padding],
      [padding + drawSize - cornerSize, padding],
      [padding, padding + drawSize - cornerSize],
      [padding + drawSize - cornerSize, padding + drawSize - cornerSize]
    ]
    corners.forEach(([x, y]) => ctx.fillRect(x, y, cornerSize, cornerSize))
  },

  drawNeon(ctx, size, padding, drawSize) {
    const width = 6
    ctx.shadowColor = '#22d3ee'
    ctx.shadowBlur = 20
    ctx.lineWidth = width
    ctx.strokeStyle = '#22d3ee'
    ctx.strokeRect(padding + width / 2, padding + width / 2, drawSize - width, drawSize - width)
    ctx.shadowBlur = 12
    ctx.strokeRect(padding + width / 2, padding + width / 2, drawSize - width, drawSize - width)
    ctx.shadowBlur = 0
    ctx.lineWidth = 2
    ctx.strokeStyle = '#ffffff'
    ctx.strokeRect(padding + width / 2 + 2, padding + width / 2 + 2, drawSize - width - 4, drawSize - width - 4)
  },

  drawDoubleLine(ctx, size, padding, drawSize) {
    const width = 8
    ctx.lineWidth = 3
    ctx.strokeStyle = '#475569'
    ctx.strokeRect(padding + 2, padding + 2, drawSize - 4, drawSize - 4)
    ctx.strokeRect(padding + width, padding + width, drawSize - width * 2, drawSize - width * 2)
  },

  drawDotsDecor(ctx, size, padding, drawSize) {
    const width = 4
    ctx.lineWidth = width
    ctx.strokeStyle = '#f59e0b'
    ctx.strokeRect(padding + width / 2, padding + width / 2, drawSize - width, drawSize - width)
    ctx.fillStyle = '#f59e0b'
    const dotRadius = 6
    const offset = padding - 2
    const corners = [
      [offset, offset],
      [size - offset, offset],
      [offset, size - offset],
      [size - offset, size - offset]
    ]
    corners.forEach(([x, y]) => {
      ctx.beginPath()
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2)
      ctx.fill()
    })
    const midOffset = padding + drawSize / 2
    const midCorners = [
      [midOffset, offset],
      [midOffset, size - offset],
      [offset, midOffset],
      [size - offset, midOffset]
    ]
    midCorners.forEach(([x, y]) => {
      ctx.beginPath()
      ctx.arc(x, y, dotRadius - 2, 0, Math.PI * 2)
      ctx.fill()
    })
  },

  drawRainbow(ctx, size, padding, drawSize) {
    const width = 10
    const gradient = ctx.createLinearGradient(0, 0, size, size)
    gradient.addColorStop(0, '#fef3c7')
    gradient.addColorStop(0.25, '#fbcfe8')
    gradient.addColorStop(0.5, '#bfdbfe')
    gradient.addColorStop(0.75, '#bbf7d0')
    gradient.addColorStop(1, '#fde68a')
    ctx.lineWidth = width
    ctx.strokeStyle = gradient
    ctx.strokeRect(padding + width / 2, padding + width / 2, drawSize - width, drawSize - width)
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.strokeRect(padding + width + 2, padding + width + 2, drawSize - width * 2 - 4, drawSize - width * 2 - 4)
  },

  drawPetal(ctx, size, padding, drawSize) {
    const width = 6
    ctx.lineWidth = width
    ctx.strokeStyle = '#ec4899'
    ctx.strokeRect(padding + width / 2, padding + width / 2, drawSize - width, drawSize - width)
    ctx.fillStyle = '#ec4899'
    const petalRadius = 10
    const offset = padding
    const corners = [
      [offset, offset],
      [size - offset, offset],
      [offset, size - offset],
      [size - offset, size - offset]
    ]
    corners.forEach(([x, y]) => {
      ctx.beginPath()
      ctx.arc(x, y, petalRadius, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(x, y, petalRadius - 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ec4899'
    })
  },

  // ===== 边框（基础几何边框，由 canvas 绘制） =====
  drawBorder(ctx, size) {
    const border = this.data.currentBorder
    if (border === 'none') return

    const width = this.data.borderWidth
    ctx.lineWidth = width

    switch (border) {
      case 'white':
        ctx.strokeStyle = '#ffffff'
        ctx.strokeRect(width / 2, width / 2, size - width, size - width)
        break
      case 'black':
        ctx.strokeStyle = '#000000'
        ctx.strokeRect(width / 2, width / 2, size - width, size - width)
        break
      case 'pink':
        ctx.strokeStyle = '#ff4d9d'
        ctx.strokeRect(width / 2, width / 2, size - width, size - width)
        break
      case 'gradient':
        const gradient = ctx.createLinearGradient(0, 0, size, size)
        gradient.addColorStop(0, '#fa709a')
        gradient.addColorStop(1, '#fee140')
        ctx.strokeStyle = gradient
        ctx.strokeRect(width / 2, width / 2, size - width, size - width)
        break
      case 'dashed':
        ctx.strokeStyle = '#64748b'
        ctx.setLineDash([8, 4])
        ctx.strokeRect(width / 2, width / 2, size - width, size - width)
        ctx.setLineDash([])
        break
    }
  },

  // ===== 文字 =====
  drawText(ctx, size) {
    const text = this.data.overlayText
    if (!text) return

    ctx.fillStyle = this.data.textColor
    ctx.font = `500 ${this.data.textSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const x = this.data.textX * size
    const y = this.data.textY * size

    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
    ctx.shadowBlur = 4
    ctx.fillText(text, x, y)
    ctx.shadowBlur = 0
  },

  // ===== 保存图片 =====
  saveImage() {
    if (!this.data.imageUrl) {
      wx.showToast({ title: '请先选择图片', icon: 'none' })
      return
    }

    // 有头像框 / GIF 底图 → 走云函数合成
    if (this.data.currentFrame || this.data.isGifBase) {
      this.generateDynamicAvatar()
      return
    }

    // 普通静态图：canvas 直接保存
    if (!this._canvas) {
      wx.showToast({ title: '请先选择图片', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.writePhotosAlbum'] === false) {
          wx.hideLoading()
          wx.showModal({
            title: '提示',
            content: '需要相册权限才能保存图片',
            confirmText: '去设置',
            success: (modalRes) => {
              if (modalRes.confirm) wx.openSetting()
            }
          })
          return
        }
        this.doSave()
      }
    })
  },

  doSave() {
    wx.canvasToTempFilePath({
      canvas: this._canvas,
      destWidth: this.data.previewSize * this._dpr,
      destHeight: this.data.previewSize * this._dpr,
      fileType: 'png',
      quality: 1,
      success: (res) => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            wx.hideLoading()
            wx.showToast({ title: '已保存到相册', icon: 'success' })
          },
          fail: (err) => {
            wx.hideLoading()
            if (err.errMsg.indexOf('auth') > -1 || err.errMsg.indexOf('deny') > -1) {
              wx.showModal({
                title: '提示',
                content: '需要相册权限才能保存图片',
                confirmText: '去设置',
                success: (modalRes) => {
                  if (modalRes.confirm) wx.openSetting()
                }
              })
            } else {
              wx.showToast({ title: '保存失败', icon: 'none' })
            }
          }
        })
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '生成图片失败', icon: 'none' })
      }
    })
  },

  // ===== 交互：tab / 分类 =====
  switchTab(e) {
    this.setData({ currentTab: e.currentTarget.dataset.tab })
  },

  switchBorderCategory(e) {
    this.setData({ borderCategory: e.currentTarget.dataset.cat })
  },

  selectBorder(e) {
    // 选基础边框时清除预设框和用户头像框
    this.setData({
      currentBorder: e.currentTarget.dataset.border,
      currentPreset: 'none',
      currentFrame: null,
      frameUrl: '',
      frameFormat: 'png'
    })
    if (!this.data.isGifBase) this.draw()
  },

  // 选预设头像框（canvas 绘制的 13 种样式）
  selectPresetFrame(e) {
    const preset = e.currentTarget.dataset.preset
    // 再次点击同一个：取消
    if (this.data.currentPreset === preset) {
      this.setData({ currentPreset: 'none' })
    } else {
      this.setData({
        currentPreset: preset,
        currentBorder: 'none',
        currentFrame: null,
        frameUrl: '',
        frameFormat: 'png'
      })
    }
    if (!this.data.isGifBase) this.draw()
  },

  // 旋转 / 翻转
  rotateImage() {
    this.setData({ rotation: (this.data.rotation + 90) % 360 })
    this.draw()
  },

  flipImage() {
    this.setData({ flipH: !this.data.flipH })
    this.draw()
  },

  onBorderWidthChange(e) {
    this.setData({ borderWidth: e.detail.value })
    this.draw()
  },

  // ===== 文字 =====
  onTextInput(e) {
    this.setData({ overlayText: e.detail.value })
    this.draw()
  },

  clearText() {
    this.setData({ overlayText: '' })
    this.draw()
  },

  selectTextColor(e) {
    this.setData({ textColor: e.currentTarget.dataset.color })
    this.draw()
  },

  onTextSizeChange(e) {
    this.setData({ textSize: e.detail.value })
    this.draw()
  },

  // 文字拖动
  onTextDragStart(e) {
    if (!this.data.overlayText) return
    this._textDragging = true
    this._updateTextPos(e)
  },

  onTextDragMove(e) {
    if (!this._textDragging) return
    this._updateTextPos(e)
  },

  onTextDragEnd() {
    this._textDragging = false
  },

  _updateTextPos(e) {
    const touch = e.touches && e.touches[0]
    if (!touch) return
    const query = wx.createSelectorQuery()
    query.select('#avatarCanvas').boundingClientRect((rect) => {
      if (!rect) return
      let x = (touch.clientX - rect.left) / rect.width
      let y = (touch.clientY - rect.top) / rect.height
      x = Math.max(0, Math.min(1, x))
      y = Math.max(0, Math.min(1, y))
      this.setData({ textX: x, textY: y })
      this.draw()
    }).exec()
  },

  // ===== 滤镜 =====
  selectFilter(e) {
    this.setData({ currentFilter: e.currentTarget.dataset.filter })
    this.draw()
  },

  // ===== 头像框（image overlay，可拖动+缩放） =====
  // 从云函数加载 PNG / GIF 头像框列表
  async loadCustomFrames() {
    try {
      const [pngRes, gifRes] = await Promise.all([
        wx.cloud.callFunction({
          name: 'manageAvatarFrames',
          data: { action: 'list', data: { format: 'png' } }
        }),
        wx.cloud.callFunction({
          name: 'manageAvatarFrames',
          data: { action: 'list', data: { format: 'gif' } }
        })
      ])

      const pngList = (pngRes.result && pngRes.result.data) || []
      const gifList = (gifRes.result && gifRes.result.data) || []

      // 批量获取临时 URL
      const all = [...pngList, ...gifList]
      const fileIDs = all.map(f => f.fileID).filter(Boolean)
      const urlMap = {}
      if (fileIDs.length > 0) {
        const chunks = []
        for (let i = 0; i < fileIDs.length; i += 50) {
          chunks.push(fileIDs.slice(i, i + 50))
        }
        for (const chunk of chunks) {
          const urlRes = await wx.cloud.getTempFileURL({ fileList: chunk })
          urlRes.fileList.forEach(f => {
            if (f.tempFileURL) urlMap[f.fileID] = f.tempFileURL
          })
        }
      }

      const withUrl = (list) => list.map(f => ({
        ...f,
        displayUrl: urlMap[f.fileID] || ''
      }))

      this.setData({
        staticFrames: withUrl(pngList),
        dynamicFrames: withUrl(gifList)
      })
    } catch (e) {
      console.error('加载头像框失败:', e)
    }
  },

  // 选中头像框（点击缩略图）
  selectCustomFrame(e) {
    const id = e.currentTarget.dataset.id
    const format = e.currentTarget.dataset.format
    const list = format === 'gif' ? this.data.dynamicFrames : this.data.staticFrames
    const frame = list.find(f => f._id === id)
    if (!frame) return

    // 再次点击同一个：取消
    if (this.data.currentFrame && this.data.currentFrame._id === id) {
      this.clearCustomFrame()
      return
    }

    this.setData({
      currentFrame: frame,
      frameUrl: frame.displayUrl || '',
      frameFormat: format,
      frameX: 0.5,
      frameY: 0.5,
      frameScale: 1,
      currentBorder: 'none',
      currentPreset: 'none'
    })
    if (!this.data.isGifBase) this.draw()
  },

  clearCustomFrame() {
    this.setData({
      currentFrame: null,
      frameUrl: '',
      frameFormat: 'png',
      frameX: 0.5,
      frameY: 0.5,
      frameScale: 1
    })
    if (!this.data.isGifBase) this.draw()
  },

  // 头像框拖动 + 双指缩放
  onFrameDragStart(e) {
    if (!this.data.currentFrame) return
    const touches = e.touches || []
    if (touches.length === 1) {
      // 单指：拖动
      this._frameDragging = true
      this._framePinching = false
    } else if (touches.length === 2) {
      // 双指：缩放
      this._frameDragging = false
      this._framePinching = true
      this._pinchStartScale = this.data.frameScale
      this._pinchStartDist = this._getTouchDistance(touches)
    }
  },

  onFrameDragMove(e) {
    if (!this.data.currentFrame) return
    const touches = e.touches || []

    // 双指缩放
    if (this._framePinching && touches.length === 2) {
      const dist = this._getTouchDistance(touches)
      if (this._pinchStartDist > 0) {
        let scale = this._pinchStartScale * (dist / this._pinchStartDist)
        scale = Math.max(0.3, Math.min(3, scale))
        this.setData({ frameScale: scale })
      }
      return
    }

    // 单指拖动
    if (!this._frameDragging || touches.length !== 1) return
    const touch = touches[0]
    if (!touch) return

    const query = wx.createSelectorQuery()
    query.select('#avatarCanvas').boundingClientRect((rect) => {
      if (!rect) return
      let x = (touch.clientX - rect.left) / rect.width
      let y = (touch.clientY - rect.top) / rect.height
      x = Math.max(0, Math.min(1, x))
      y = Math.max(0, Math.min(1, y))
      this.setData({ frameX: x, frameY: y })
    }).exec()
  },

  onFrameDragEnd() {
    this._frameDragging = false
    this._framePinching = false
  },

  // 计算两指距离
  _getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  },

  // 头像框缩放（滑块，实时预览）
  onFrameScaleChange(e) {
    this.setData({ frameScale: e.detail.value })
  },

  onFrameScaleChanging(e) {
    this.setData({ frameScale: e.detail.value })
  },

  // ===== 重置 =====
  resetAll() {
    this.setData({
      currentBorder: 'none',
      borderWidth: 8,
      currentPreset: 'none',
      currentFrame: null,
      frameUrl: '',
      frameFormat: 'png',
      frameX: 0.5,
      frameY: 0.5,
      frameScale: 1,
      overlayText: '',
      textColor: '#fff',
      textX: 0.5,
      textY: 0.85,
      textSize: 24,
      currentFilter: 'none',
      currentTab: 'select',
      gifFrameDelay: 100,
      rotation: 0,
      flipH: false,
      borderCategory: 'preset'
    })
    if (!this.data.isGifBase) this.draw()
  },

  // ===== 装饰层（用于云函数合成：边框+预设框+文字） =====
  initDecoCanvas() {
    const query = wx.createSelectorQuery()
    query.select('#decoCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0]) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = this._dpr
        const size = this.data.outputSize
        canvas.width = size * dpr
        canvas.height = size * dpr
        ctx.scale(dpr, dpr)
        this._decoCanvas = canvas
        this._decoCtx = ctx
      })
  },

  // 是否有装饰元素（基础边框/预设框/文字）
  hasDecoration() {
    return this.data.currentBorder !== 'none' ||
           this.data.currentPreset !== 'none' ||
           (this.data.overlayText && this.data.overlayText.length > 0)
  },

  // 渲染装饰层到隐藏 canvas（透明背景 + 边框/预设框 + 文字）
  drawDecoration() {
    if (!this._decoCtx) return
    const ctx = this._decoCtx
    const size = this.data.outputSize
    ctx.clearRect(0, 0, size, size)

    // 预设框模式和基础边框模式互斥（与 draw() 逻辑一致）
    if (this.data.currentPreset !== 'none') {
      const padding = this.getFramePadding(this.data.currentPreset)
      const drawSize = size - padding * 2
      this.drawPresetFrame(ctx, size, padding, drawSize)
    } else {
      this.drawBorder(ctx, size)
    }

    // 文字
    if (this.data.overlayText) {
      this.drawText(ctx, size)
    }
  },

  // ===== 云函数合成（GIF 底图 / 有头像框 / GIF 输出） =====
  async generateDynamicAvatar() {
    if (this.data.isGenerating) return

    this.setData({ isGenerating: true })
    wx.showLoading({ title: '生成中...', mask: true })

    try {
      // 1. 渲染装饰层并上传（如有边框/文字）
      let decorationFileID = ''
      if (this.hasDecoration() && this._decoCanvas) {
        this.drawDecoration()
        const decoTempPath = await new Promise((resolve, reject) => {
          wx.canvasToTempFilePath({
            canvas: this._decoCanvas,
            destWidth: this.data.outputSize * this._dpr,
            destHeight: this.data.outputSize * this._dpr,
            fileType: 'png',
            quality: 1,
            success: (res) => resolve(res.tempFilePath),
            fail: reject
          })
        })
        const decoUploadRes = await wx.cloud.uploadFile({
          cloudPath: `dynamic_avatars/deco_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.png`,
          filePath: decoTempPath
        })
        decorationFileID = decoUploadRes.fileID
      }

      // 2. 上传底图
      const baseExt = this.data.isGifBase ? 'gif' : 'png'
      const baseUploadRes = await wx.cloud.uploadFile({
        cloudPath: `dynamic_avatars/base_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${baseExt}`,
        filePath: this.data.imageUrl
      })

      // 3. 调用云函数合成
      const callData = {
        baseImageFileID: baseUploadRes.fileID,
        isGifBase: this.data.isGifBase,
        decorationFileID,
        filterType: this.data.currentFilter,
        outputSize: this.data.outputSize,
        maxFrames: this.data.maxFrames,
        frameDelay: this.data.gifFrameDelay
      }

      // 头像框参数（单个 fileID + 位置/缩放）
      if (this.data.currentFrame) {
        callData.frameFileID = this.data.currentFrame.fileID
        callData.frameFormat = this.data.frameFormat
        callData.frameX = this.data.frameX
        callData.frameY = this.data.frameY
        callData.frameScale = this.data.frameScale
      }

      const res = await wx.cloud.callFunction({
        name: 'generateDynamicAvatar',
        data: callData
      })

      wx.hideLoading()

      if (res.result && res.result.success) {
        const gifUrl = res.result.tempURL
        wx.downloadFile({
          url: gifUrl,
          success: (dlRes) => {
            wx.saveImageToPhotosAlbum({
              filePath: dlRes.tempFilePath,
              success: () => {
                wx.showToast({
                  title: `已保存(${res.result.frameCount || 0}帧)`,
                  icon: 'success'
                })
              },
              fail: (err) => {
                if (err.errMsg.indexOf('auth') > -1 || err.errMsg.indexOf('deny') > -1) {
                  wx.showModal({
                    title: '提示',
                    content: '需要相册权限才能保存图片',
                    confirmText: '去设置',
                    success: (m) => { if (m.confirm) wx.openSetting() }
                  })
                } else {
                  wx.showToast({ title: '保存失败', icon: 'none' })
                }
              }
            })
          },
          fail: () => {
            wx.showToast({ title: '下载失败', icon: 'none' })
          }
        })
      } else {
        wx.showToast({ title: res.result?.message || '生成失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      console.error('生成动态头像失败:', e)
      wx.showToast({ title: e.message || '生成失败', icon: 'none' })
    } finally {
      this.setData({ isGenerating: false })
    }
  },

  // GIF 帧延迟 / 最大帧数
  onGifFrameDelayChange(e) {
    this.setData({ gifFrameDelay: e.detail.value })
  },

  onMaxFramesChange(e) {
    this.setData({ maxFrames: e.detail.value })
  },

  navigateBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/tools/tools' }) })
  },

  onUnload() {}
})
