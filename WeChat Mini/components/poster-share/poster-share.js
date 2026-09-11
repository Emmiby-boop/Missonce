import { getWindowInfo } from '../../utils/storageManager.js'
import { getStorageAsync, setStorage } from '../../utils/storageManager.js'
import { BRAND, UI_TEXT } from '../../config/posterText.js'

// ============================================================
//  DESIGN TOKENS
// ============================================================
const T = {
  padding: 16,
  outerRadius: 16,
  cardRadius: 14,
  qrRadius: 8,
  imageRadius: 10,
  imgMargin: 6,
  bgStart: '#F8F5F2',
  bgEnd:   '#F0ECE6',
  accent:  '#07C160',
  textDark:   '#1A1A2E',
  textLight:  '#9CA3AF',
  fontQuote:  '600 17px PingFang SC, sans-serif',
  fontSmall:  '12px PingFang SC, sans-serif',
  fontTiny:   '10px PingFang SC, sans-serif',
  fontDateBig:'bold 32px PingFang SC, sans-serif',
}

// 本地降级语录（云函数失败时使用，仅保留 5 条）
const FALLBACK_QUOTES = [
  '保持热爱，奔赴山海',
  '生活明朗，万物可爱',
  '未来可期，人间值得',
  '愿你眼中有光，心中有爱',
  '星光不问赶路人，时光不负有心人',
]

// 小程序码缓存 key（按 scene 缓存，7天有效）
const QR_CACHE_KEY = 'poster_qr_cache'
const QR_CACHE_TTL = 7 * 24 * 60 * 60 * 1000

// ============================================================
//  Canvas 工具函数
// ============================================================

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

function drawImageFill(ctx, img, dx, dy, dw, dh, radius) {
  const imgRatio = img.width / img.height
  const canvasRatio = dw / dh
  let sx, sy, sw, sh
  if (imgRatio > canvasRatio) {
    sh = img.height; sw = sh * canvasRatio; sx = (img.width - sw) / 2; sy = 0
  } else {
    sw = img.width; sh = sw / canvasRatio; sx = 0; sy = (img.height - sh) / 2
  }
  ctx.save()
  roundRect(ctx, dx, dy, dw, dh, radius)
  ctx.clip()
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
  ctx.restore()
}

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

function getDateInfo() {
  const now = new Date()
  return {
    month: now.getMonth() + 1,
    day: now.getDate(),
    year: now.getFullYear(),
    weekday: ['日', '一', '二', '三', '四', '五', '六'][now.getDay()]
  }
}

const _ratioCache = new Map()    // 图片宽高比缓存，避免重复 wx.getImageInfo 网络请求

function getImageRatio(url) {
  if (_ratioCache.has(url)) return Promise.resolve(_ratioCache.get(url))
  return new Promise((resolve) => {
    wx.getImageInfo({
      src: url,
      success: (res) => {
        const ratio = res.width / res.height
        _ratioCache.set(url, ratio)
        resolve(ratio)
      },
      fail: () => resolve(9 / 16)
    })
  })
}

// ============================================================
//  语录加载（云数据库 → 降级）
// ============================================================
let cachedQuotes = null  // 会话级缓存
let quotesFetching = null // 防重复请求

async function fetchQuotes() {
  if (cachedQuotes) return cachedQuotes
  if (quotesFetching) return quotesFetching
  quotesFetching = (async () => {
    try {
      const res = await wx.cloud.callFunction({ name: 'getPosterQuotes' })
      if (res.result && res.result.quotes && res.result.quotes.length > 0) {
        cachedQuotes = res.result.quotes
        return cachedQuotes
      }
    } catch (e) {
      console.warn('语录云函数调用失败，使用降级数据:', e)
    }
    cachedQuotes = FALLBACK_QUOTES
    return cachedQuotes
  })()
  return quotesFetching
}

function pickQuote(quotes, seed) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  return quotes[Math.abs(hash) % quotes.length]
}

// ============================================================
//  小程序码缓存（按 scene 缓存到 storage，7天有效）
// ============================================================
async function getCachedQR(scene) {
  try {
    const cache = await getStorageAsync(QR_CACHE_KEY) || {}
    const entry = cache[scene]
    if (entry && Date.now() - entry.time < QR_CACHE_TTL) {
      return entry.url
    }
  } catch (e) {}
  return null
}

async function setCachedQR(scene, url) {
  try {
    const cache = await getStorageAsync(QR_CACHE_KEY) || {}
    cache[scene] = { url, time: Date.now() }
    // 清理过期条目，避免无限增长
    const now = Date.now()
    Object.keys(cache).forEach(k => {
      if (now - cache[k].time > QR_CACHE_TTL) delete cache[k]
    })
    setStorage(QR_CACHE_KEY, cache)
  } catch (e) {}
}

// ============================================================
//  组件
// ============================================================
Component({
  properties: {
    visible: {
      type: Boolean, value: false,
      observer(newVal) { if (newVal) this.initPoster() }
    },
    imageUrl: { type: String, value: '' },
    type: { type: String, value: 'wallpaper' },
    resourceId: { type: String, value: '' }
  },

  data: {
    width: 300, height: 480,
    generating: true, saving: false,
    posterPath: '',
    canShowShareMenu: false
  },

  lifetimes: {
    attached() {
      if (wx.showShareImageMenu) this.setData({ canShowShareMenu: true })
      // 🔥 预热：组件挂载时提前拉取语录和小程序码，首次打开海报弹窗时秒开
      fetchQuotes().catch(() => {})
      this._prefetchQRCode()
    }
  },

  methods: {
    // 🔥 暴露给父页面：进入预览页时即可调用，提前预热云函数
    preload() {
      fetchQuotes().catch(() => {})
      this._prefetchQRCode()
    },

    _prefetchQRCode() {
      const rid = this.data.resourceId || ''
      const scene = rid && (`id=${rid}`).length <= 32 ? `id=${rid}` : 's=p'
      this._fetchQRCode(scene)
    },

    async _fetchQRCode(sceneStr) {
      const scene = sceneStr || 's=p'
      // 1. 先查 storage 缓存
      const cached = await getCachedQR(scene)
      if (cached) {
        this.data.qrCodeUrl = cached
        this.data._cachedQRScene = scene
        return cached
      }
      // 2. 缓存未命中：调用云函数
      try {
        const res = await wx.cloud.callFunction({
          name: 'getQRCode',
          data: { path: 'pages/index/index', scene }
        })
        if (res.result?.url) {
          this.data.qrCodeUrl = res.result.url
          this.data._cachedQRScene = scene
          // 写入 storage 缓存
          setCachedQR(scene, res.result.url)
          return res.result.url
        }
      } catch (e) {
        console.warn('[poster-share] getQRCode failed:', e)
      }
      return null
    },

    /**
     * 根据 resourceId 长度决定二维码 scene
     */
    async _resolveQRScene() {
      const rid = this.data.resourceId || ''
      if (!rid) return { scene: 's=p', needFetch: this.data._cachedQRScene !== 's=p' }

      const idScene = `id=${rid}`
      if (idScene.length <= 32) {
        return { scene: idScene, needFetch: this.data._cachedQRScene !== idScene }
      }

      // 超长 id，使用短分享码
      if (this.data._cachedQRScene && this.data._cachedQRScene.startsWith('c=') && this.data._cachedResourceId === rid) {
        return { scene: this.data._cachedQRScene, needFetch: false }
      }

      try {
        const res = await wx.cloud.callFunction({
          name: 'shareCode',
          data: { action: 'encode', resourceId: rid, type: this.data.type }
        })
        if (res.result?.success) {
          const scene = `c=${res.result.code}`
          this.data._cachedResourceId = rid
          return { scene, needFetch: true }
        }
      } catch (e) {
        console.error('[poster-share] shareCode encode failed:', e)
      }

      return { scene: 's=p', needFetch: this.data._cachedQRScene !== 's=p' }
    },

    noop() {},

    onClose() {
      this.setData({ visible: false })
      this.triggerEvent('close')
    },

    // ============================================================
    //  主流程
    // ============================================================
    async initPoster() {
      const sysInfo = getWindowInfo()
      const maxW = sysInfo.windowWidth * 0.82
      const isAvatar = this.data.type === 'avatar'

      // ---- 固定尺寸计算（不依赖 imgRatio，避免动态跳变） ----
      const W = Math.min(maxW, 300)
      const cardW = W - T.padding * 2
      const cardY = T.padding
      let cardH, H
      if (isAvatar) {
        cardH = cardW
        H = cardY + cardH + 28 + 24 + 26 + 72 + 24 + T.padding
      } else {
        cardH = 360  // 固定高度，图片用 cover 裁剪
        H = cardY + cardH + 184
      }

      // 缓存命中：同图同类型直接复用
      if (this.data.posterPath && this.data.lastImageUrl === this.data.imageUrl && this.data.lastType === this.data.type) {
        this.setData({ generating: false })
        return
      }

      // 一次性设置尺寸 + 状态，避免多次 setData 导致跳变
      this.setData({ width: W, height: H, generating: true, posterPath: '' })

      try {
        // ---- 提前并行：语录 + 小程序码 URL ----
        let mainImgUrl = this.data.imageUrl
        // cloud:// 转 tempURL
        const tempUrlP = mainImgUrl.startsWith('cloud://')
          ? wx.cloud.getTempFileURL({ fileList: [mainImgUrl] }).then(r => {
              if (r.fileList?.[0]?.tempFileURL) mainImgUrl = r.fileList[0].tempFileURL
            }).catch(() => {})
          : Promise.resolve()

        const { scene: qrScene, needFetch: needNewQR } = await this._resolveQRScene()
        const qrUrlPromise = (this.data.qrCodeUrl && !needNewQR)
          ? Promise.resolve(this.data.qrCodeUrl)
          : this._fetchQRCode(qrScene)

        await tempUrlP

        // 不再需要 getImageRatio，cardH 已固定，省一次网络请求
        const [quotes] = await Promise.all([fetchQuotes()])

        // 等待 Canvas 节点渲染
        await new Promise(r => setTimeout(r, 50))

        // ---- Canvas ----
        const canvasRes = await new Promise(resolve => {
          this.createSelectorQuery().select('#posterCanvas')
            .fields({ node: true, size: true }).exec(resolve)
        })
        if (!canvasRes[0]?.node) { setTimeout(() => this.initPoster(), 200); return }

        const canvas = canvasRes[0].node
        const ctx = canvas.getContext('2d')
        const dpr = sysInfo.pixelRatio
        // 设置 canvas 内部分辨率（实际像素）
        canvas.width = W * dpr
        canvas.height = H * dpr
        ctx.scale(dpr, dpr)

        // === 外边圆角裁剪 ===
        ctx.save()
        roundRect(ctx, 0, 0, W, H, T.outerRadius)
        ctx.clip()

        // === 1. 背景 ===
        const bgGrad = ctx.createLinearGradient(0, 0, 0, H)
        bgGrad.addColorStop(0, T.bgStart)
        bgGrad.addColorStop(1, T.bgEnd)
        ctx.fillStyle = bgGrad
        ctx.fillRect(0, 0, W, H)

        // === 2. 主图卡片 ===
        const cardX = T.padding
        drawCard(ctx, cardX, cardY, cardW, cardH, T.cardRadius)
        const imgX = cardX + T.imgMargin
        const imgY = cardY + T.imgMargin
        const imgW = cardW - T.imgMargin * 2
        const imgH = cardH - T.imgMargin * 2

        // ---- Canvas 就绪后：主图 + 小程序码并行加载 ----
        const mainImgP = this.loadImage(canvas, mainImgUrl)
        const qrResultP = qrUrlPromise.then(async (url) => {
          if (!url) return null
          try { return { url, img: await this.loadImage(canvas, url) } }
          catch { return null }
        })

        const [mainImg, qrResult] = await Promise.all([mainImgP, qrResultP])
        drawImageFill(ctx, mainImg, imgX, imgY, imgW, imgH, T.imageRadius)
        drawGradientOverlay(ctx, imgX, imgY, imgW, imgH)

        // 品牌文字（遮罩上）
        ctx.save()
        roundRect(ctx, imgX, imgY, imgW, imgH, T.imageRadius)
        ctx.clip()
        ctx.font = T.fontSmall
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(BRAND.appName, W / 2, imgY + imgH - 22)
        ctx.restore()

        // === 3. 语录 ===
        const quoteY = cardY + cardH + 28
        const quote = pickQuote(quotes, this.data.imageUrl)

        ctx.save()
        ctx.font = '18px serif'
        ctx.fillStyle = T.accent
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('「', W / 2 - 80, quoteY)
        ctx.fillText('」', W / 2 + 80, quoteY)
        ctx.restore()

        ctx.save()
        ctx.font = T.fontQuote
        ctx.fillStyle = T.textDark
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(quote, W / 2, quoteY)
        ctx.restore()

        // === 4. 分隔线 ===
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

        // === 5. 日期 + 小程序码 ===
        const bottomY = lineY + 24
        const date = getDateInfo()
        const dateX = T.padding + 8
        const dateCY = bottomY + 28

        ctx.save()
        ctx.font = T.fontDateBig
        ctx.fillStyle = T.textDark
        ctx.textAlign = 'left'
        ctx.textBaseline = 'bottom'
        ctx.fillText(`${date.month} / ${date.day}`, dateX, dateCY + 4)
        ctx.restore()

        ctx.save()
        ctx.font = T.fontSmall
        ctx.fillStyle = T.textLight
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(`${date.year}  ·  星期${date.weekday}`, dateX, dateCY + 6)
        ctx.restore()

        // 小程序码（已在前面并行加载完成，直接绘制）
        if (qrResult) {
          const qrSz = 64
          const qrX = W - T.padding - qrSz - 4
          const qrY = bottomY + 2
          drawCard(ctx, qrX, qrY, qrSz, qrSz, T.qrRadius, {
            shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.06)', shadowOffsetY: 1
          })
          const qp = 5
          ctx.save()
          roundRect(ctx, qrX + qp, qrY + qp, qrSz - qp * 2, qrSz - qp * 2, T.qrRadius - 2)
          ctx.clip()
          ctx.drawImage(qrResult.img, qrX + qp, qrY + qp, qrSz - qp * 2, qrSz - qp * 2)
          ctx.restore()
          ctx.save()
          ctx.font = T.fontTiny
          ctx.fillStyle = T.textLight
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillText(UI_TEXT.scanHint, qrX + qrSz / 2, qrY + qrSz + 10)
          ctx.restore()
        }

        // === 恢复裁剪 + 导出 ===
        ctx.restore()

        wx.canvasToTempFilePath({
          canvas,
          destWidth: W * 2, destHeight: H * 2,
          success: (res) => {
            this.setData({
              posterPath: res.tempFilePath,
              lastImageUrl: this.data.imageUrl,
              lastType: this.data.type,
              generating: false
            })
          },
          fail: () => this.setData({ generating: false })
        })
      } catch (e) {
        this.setData({ generating: false })
        console.error('海报生成失败:', e)
      }
    },

    loadImage(canvas, url) {
      return new Promise((resolve, reject) => {
        const img = canvas.createImage()
        img.onload = () => resolve(img)
        img.onerror = (e) => { console.error('图片加载失败:', url, e); reject(e) }
        img.crossOrigin = 'anonymous'
        img.src = url
      })
    },

    // ============================================================
    //  操作
    // ============================================================
    shareToFriend() {
      if (!this.data.posterPath) {
        wx.showToast({ title: UI_TEXT.generatingToast, icon: 'none' })
        return
      }
      wx.showShareImageMenu({
        path: this.data.posterPath,
        fail: (err) => {
          if (err.errMsg.includes('deny') || err.errMsg.includes('cancel')) return
          wx.showToast({ title: UI_TEXT.shareFailed, icon: 'none' })
        }
      })
    },

    savePoster() {
      if (!this.data.posterPath) {
        wx.showToast({ title: UI_TEXT.generatingToast, icon: 'none' })
        return
      }
      wx.saveImageToPhotosAlbum({
        filePath: this.data.posterPath,
        success: () => {
          wx.showToast({ title: UI_TEXT.savedToast, icon: 'success' })
          this.triggerEvent('close')
        },
        fail: (err) => {
          if (err.errMsg.includes('auth')) {
            wx.showModal({
              title: '提示',
              content: UI_TEXT.authRequired,
              success: (r) => { if (r.confirm) wx.openSetting() }
            })
          }
        }
      })
    }
  }
})
