const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const imgDir = 'D:\\Missonce\\1022\\media-parser-mp-starter\\images';

async function convert() {
  try {
    // 读取已创建的SVG文件
    const svgBuffer = fs.readFileSync(path.join(imgDir, 'share-cover.svg'));
    
    // 转换为PNG - 500x400 (5:4比例) 用于好友分享
    await sharp(svgBuffer)
      .png()
      .toFile(path.join(imgDir, 'share-cover-friend.png'));
    
    console.log('✓ Created share-cover-friend.png');
    
    // 创建500x500 (1:1比例) 用于朋友圈分享
    // 修改SVG的viewBox和尺寸
    let svgContent = svgBuffer.toString();
    svgContent = svgContent.replace('height="400" viewBox="0 0 500 400"', 'height="500" viewBox="0 0 500 500"');
    svgContent = svgContent.replace('<text x="250" y="325"', '<text x="250" y="375"');
    svgContent = svgContent.replace('<rect x="180" y="350"', '<rect x="180" y="400"');
    
    await sharp(Buffer.from(svgContent))
      .png()
      .toFile(path.join(imgDir, 'share-cover-timeline.png'));
    
    console.log('✓ Created share-cover-timeline.png');
    
    // 检查文件大小
    const friendStat = fs.statSync(path.join(imgDir, 'share-cover-friend.png'));
    const timelineStat = fs.statSync(path.join(imgDir, 'share-cover-timeline.png'));
    
    console.log(`\n文件大小:`);
    console.log(`  好友分享封面: ${(friendStat.size/1024).toFixed(1)} KB`);
    console.log(`  朋友圈分享封面: ${(timelineStat.size/1024).toFixed(1)} KB`);
    
  } catch (err) {
    console.error('错误:', err.message);
  }
}

convert();