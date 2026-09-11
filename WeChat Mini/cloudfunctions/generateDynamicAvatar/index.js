/**
 * generateDynamicAvatar 云函数
 * 合成动态头像 GIF
 *
 * 支持模式：
 * 1. 静态底图 + 用户上传头像框（PNG/GIF） → GIF
 * 2. GIF 底图 + 装饰(边框/文字/滤镜/头像框) → GIF
 *
 * 输入：
 *   baseImageFileID    - 底图 fileID（静态图或 GIF）
 *   isGifBase          - 底图是否为 GIF（默认 false）
 *   decorationFileID   - 装饰层 PNG fileID（透明背景，含边框+文字，由小程序端 canvas 渲染）
 *   filterType         - 滤镜类型：none|gray|sepia|bright|warm|cool
 *   frameFileID        - 用户上传头像框 fileID（PNG 或 GIF，可选）
 *   frameFormat        - 头像框格式：png | gif
 *   frameX             - 头像框位置 X（0~1 比例，默认 0.5 居中）
 *   frameY             - 头像框位置 Y（0~1 比例，默认 0.5 居中）
 *   frameScale         - 头像框缩放（默认 1，相对 outputSize）
 *   frameDelay         - 每帧延迟(ms)，默认 100
 *   outputSize         - 输出尺寸(px)，默认 320
 *   maxFrames          - GIF 底图最大帧数，默认 30
 *
 * 流程：
 *   1. 下载底图，GIF 用 sharp animated 解码为序列帧，静态图单帧
 *   2. 帧数超限均匀采样
 *   3. 下载装饰层 PNG（如有）
 *   4. 下载用户上传头像框（如有），PNG 单帧，GIF 解码为序列帧
 *   5. 逐帧：resize→滤镜→composite装饰层→composite头像框帧（按位置/缩放）
 *   6. gifencoder 编码为 GIF
 *   7. 上传 GIF 到云存储，返回 fileID 和临时 URL
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const path = require('path')
const fs = require('fs')
const os = require('os')

let sharp = null
let GIFEncoder = null
try { sharp = require('sharp') } catch (e) { console.warn('[generateDynamicAvatar] 加载 sharp 失败，降级处理:', e) }
try { GIFEncoder = require('gifencoder') } catch (e) { console.warn('[generateDynamicAvatar] 加载 gifencoder 失败，降级处理:', e) }

exports.main = async (event, context) => {
  const tmpDir = os.tmpdir()
  const tmpFiles = []

  try {
    const {
      baseImageFileID,
      isGifBase = false,
      decorationFileID = '',
      filterType = 'none',
      frameFileID = '',
      frameFormat = 'png',
      frameX = 0.5,
      frameY = 0.5,
      frameScale = 1,
      frameDelay = 100,
      outputSize = 320,
      maxFrames = 30
    } = event

    if (!baseImageFileID) {
      return { success: false, message: '缺少 baseImageFileID' }
    }
    if (!sharp) {
      return { success: false, message: 'sharp 未安装，请联系管理员安装依赖' }
    }
    if (!GIFEncoder) {
      return { success: false, message: 'gifencoder 未安装，请联系管理员安装依赖' }
    }

    // 1. 下载底图
    const baseExt = isGifBase ? 'gif' : 'png'
    const baseLocalPath = path.join(tmpDir, `base_${Date.now()}.${baseExt}`)
    tmpFiles.push(baseLocalPath)
    await downloadFile(baseImageFileID, baseLocalPath)

    // 2. 解码底图为序列帧（raw RGBA Buffer 数组）
    const baseFrames = []
    if (isGifBase) {
      const baseBuffer = fs.readFileSync(baseLocalPath)
      const metadata = await sharp(baseBuffer).metadata()
      const pageCount = metadata.pages || 1

      // 帧数限制（均匀采样）
      let selectedIndices = Array.from({ length: pageCount }, (_, i) => i)
      if (pageCount > maxFrames) {
        const step = pageCount / maxFrames
        selectedIndices = Array.from({ length: maxFrames }, (_, i) =>
          Math.min(Math.floor(i * step), pageCount - 1)
        )
      }

      const { data, info } = await sharp(baseBuffer, { animated: true })
        .resize(outputSize, outputSize, { fit: 'cover', position: 'center' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })

      const channels = info.channels || 4
      const frameSize = outputSize * outputSize * channels
      for (const idx of selectedIndices) {
        const start = idx * frameSize
        const end = start + frameSize
        if (end > data.length) break
        baseFrames.push(Buffer.from(data.slice(start, end)))
      }

      if (baseFrames.length === 0) {
        const single = await sharp(baseBuffer)
          .resize(outputSize, outputSize, { fit: 'cover', position: 'center' })
          .ensureAlpha()
          .raw()
          .toBuffer()
        baseFrames.push(single)
      }
    } else {
      const baseBuffer = await sharp(baseLocalPath)
        .resize(outputSize, outputSize, { fit: 'cover', position: 'center' })
        .ensureAlpha()
        .raw()
        .toBuffer()
      baseFrames.push(baseBuffer)
    }

    // 3. 下载装饰层 PNG（如有），统一尺寸为 outputSize
    let decorationBuffer = null
    if (decorationFileID) {
      const decoPath = path.join(tmpDir, `deco_${Date.now()}.png`)
      tmpFiles.push(decoPath)
      await downloadFile(decorationFileID, decoPath)
      decorationBuffer = await sharp(decoPath)
        .resize(outputSize, outputSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    }

    // 4. 下载用户上传头像框（如有），解码为序列帧 Buffer 数组
    //    PNG → 单帧；GIF → 多帧
    //    每帧按 frameScale 缩放到 frameSize = outputSize * frameScale
    //    并放在透明 outputSize 画布的 (frameX, frameY) 位置
    const frameBuffers = []  // 每帧是 outputSize×outputSize 的 PNG（透明背景 + 头像框）
    if (frameFileID) {
      const frameExt = frameFormat === 'gif' ? 'gif' : 'png'
      const frameLocalPath = path.join(tmpDir, `frame_${Date.now()}.${frameExt}`)
      tmpFiles.push(frameLocalPath)
      await downloadFile(frameFileID, frameLocalPath)
      const frameBuffer = fs.readFileSync(frameLocalPath)

      // 头像框目标尺寸（相对 outputSize 缩放）
      const frameSize = Math.max(1, Math.round(outputSize * frameScale))
      // 头像框在 outputSize 画布中的左上角位置
      const left = Math.max(0, Math.round(frameX * outputSize - frameSize / 2))
      const top = Math.max(0, Math.round(frameY * outputSize - frameSize / 2))

      let frameRawList = []  // 头像框每帧的 raw RGBA Buffer（尺寸为 frameSize）
      if (frameFormat === 'gif') {
        // GIF：用 sharp animated 解码所有帧
        const meta = await sharp(frameBuffer).metadata()
        const pageCount = meta.pages || 1

        // 帧数对齐底图（采样到与底图相同帧数）
        let selectedIndices = Array.from({ length: pageCount }, (_, i) => i)
        if (pageCount > baseFrames.length && baseFrames.length > 0) {
          const step = pageCount / baseFrames.length
          selectedIndices = Array.from({ length: baseFrames.length }, (_, i) =>
            Math.min(Math.floor(i * step), pageCount - 1)
          )
        }

        const { data, info } = await sharp(frameBuffer, { animated: true })
          .resize(frameSize, frameSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })

        const channels = info.channels || 4
        const singleFrameSize = frameSize * frameSize * channels
        for (const idx of selectedIndices) {
          const start = idx * singleFrameSize
          const end = start + singleFrameSize
          if (end > data.length) break
          frameRawList.push(Buffer.from(data.slice(start, end)))
        }

        if (frameRawList.length === 0) {
          const single = await sharp(frameBuffer)
            .resize(frameSize, frameSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .ensureAlpha()
            .raw()
            .toBuffer()
          frameRawList.push(single)
        }
      } else {
        // PNG：单帧
        const single = await sharp(frameBuffer)
          .resize(frameSize, frameSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .ensureAlpha()
          .raw()
          .toBuffer()
        frameRawList.push(single)
      }

      // 将每帧头像框放到 outputSize 透明画布的 (left, top) 位置
      for (const rawBuf of frameRawList) {
        const frameSharp = sharp({
          create: {
            width: outputSize,
            height: outputSize,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          }
        }).composite([{
          input: rawBuf,
          raw: { width: frameSize, height: frameSize, channels: 4 },
          left,
          top,
          blend: 'over'
        }])
        const pngBuf = await frameSharp.png().toBuffer()
        frameBuffers.push(pngBuf)
      }
    }

    // 5. 逐帧处理
    const composedFrames = []
    for (let i = 0; i < baseFrames.length; i++) {
      let frameSharp = sharp(baseFrames[i], {
        raw: { width: outputSize, height: outputSize, channels: 4 }
      })

      // 应用滤镜
      frameSharp = applySharpFilter(frameSharp, filterType)

      // composite 装饰层和头像框
      const composites = []
      if (decorationBuffer) {
        composites.push({ input: decorationBuffer, blend: 'over' })
      }
      if (frameBuffers.length > 0) {
        // 帧对齐：以底图帧数为准，头像框循环
        const frameIdx = i % frameBuffers.length
        composites.push({ input: frameBuffers[frameIdx], blend: 'over' })
      }
      if (composites.length > 0) {
        frameSharp = frameSharp.composite(composites)
      }

      const composedBuffer = await frameSharp.png().toBuffer()
      composedFrames.push(composedBuffer)
    }

    // 6. 用 gifencoder 编码 GIF
    const gifPath = path.join(tmpDir, `avatar_${Date.now()}.gif`)
    tmpFiles.push(gifPath)

    const encoder = new GIFEncoder(outputSize, outputSize)
    const stream = fs.createWriteStream(gifPath)
    encoder.createWriteStream = () => stream
    encoder.start()
    encoder.setRepeat(0) // 0=循环
    encoder.setDelay(frameDelay)
    encoder.setQuality(10)

    for (const buf of composedFrames) {
      const { data, info } = await sharp(buf)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      encoder.addFrame(data, info.width, info.height)
    }
    encoder.finish()

    // 7. 上传 GIF 到云存储
    const cloudPath = `dynamic_avatars/avatar_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.gif`
    const uploadRes = await cloud.uploadFile({
      cloudPath,
      fileContent: fs.createReadStream(gifPath)
    })

    // 8. 获取临时 URL
    const urlRes = await cloud.getTempFileURL({
      fileList: [uploadRes.fileID]
    })
    const tempURL = urlRes.fileList[0] && urlRes.fileList[0].tempFileURL

    return {
      success: true,
      fileID: uploadRes.fileID,
      tempURL,
      frameCount: composedFrames.length,
      message: '动态头像生成成功'
    }
  } catch (err) {
    console.error('generateDynamicAvatar error:', err)
    return { success: false, message: err.message || 'GIF 合成失败' }
  } finally {
    // 清理临时文件
    tmpFiles.forEach(p => {
      try { fs.unlinkSync(p) } catch (e) { console.error('[generateDynamicAvatar] 清理临时文件失败:', e) }
    })
  }
}

/**
 * sharp 滤镜应用
 */
function applySharpFilter(frameSharp, filterType) {
  switch (filterType) {
    case 'gray':
      return frameSharp.modulate({ saturation: 0 })
    case 'sepia':
      return frameSharp.modulate({ saturation: 0.5 }).tint({ r: 255, g: 220, b: 180 })
    case 'bright':
      return frameSharp.modulate({ brightness: 1.3 })
    case 'warm':
      return frameSharp.modulate({ brightness: 1.1, saturation: 1.2 }).tint({ r: 255, g: 200, b: 150 })
    case 'cool':
      return frameSharp.modulate({ brightness: 0.95, saturation: 0.9 }).tint({ r: 150, g: 200, b: 255 })
    default:
      return frameSharp
  }
}

// 下载云存储文件到本地
async function downloadFile(fileID, localPath) {
  const res = await cloud.downloadFile({ fileID })
  fs.writeFileSync(localPath, res.fileContent)
}
