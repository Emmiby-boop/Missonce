const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const imagesDir = path.join(__dirname, '..', 'images')
const files = [
  'quick-topics',
  'quick-inspiration',
  'quick-daily',
  'quick-watermark'
]

async function convert() {
  for (const name of files) {
    const svgPath = path.join(imagesDir, `${name}.svg`)
    const pngPath = path.join(imagesDir, `${name}.png`)

    if (!fs.existsSync(svgPath)) {
      console.error(`[跳过] 文件不存在: ${svgPath}`)
      continue
    }

    const svgBuffer = fs.readFileSync(svgPath)

    await sharp(svgBuffer)
      .resize(192, 192)
      .png()
      .toFile(pngPath)

    console.log(`[完成] ${name}.svg → ${name}.png (192x192)`)
  }
  console.log('\n全部转换完成！')
}

convert().catch(err => {
  console.error('转换失败:', err)
  process.exit(1)
})