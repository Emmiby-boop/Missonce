const sharp = require('sharp');
const path = require('path');

const imgDir = 'D:\\Missonce\\1022\\media-parser-mp-starter\\images';

async function convertSVGtoPNG() {
  try {
    // 读取SVG文件
    const svgBuffer = require('fs').readFileSync(path.join(imgDir, 'share-cover.svg'));
    
    // 转换为PNG - 5:4比例 (500x400) 用于好友分享
    await sharp(svgBuffer)
      .png()
      .toFile(path.join(imgDir, 'share-cover-friend.png'));
    
    console.log('Created share-cover-friend.png');
    
    // 创建1:1比例 (500x500) 用于朋友圈分享
    const svgBufferSquare = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0d9488;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#06b6d4;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#f97316;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#fb923c;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.2"/>
    </filter>
  </defs>
  
  <rect width="500" height="500" fill="url(#bgGrad)"/>
  
  <circle cx="400" cy="100" r="120" fill="#ffffff" opacity="0.08"/>
  <circle cx="100" cy="400" r="80" fill="#ffffff" opacity="0.05"/>
  
  <g transform="translate(250, 200)">
    <rect x="-50" y="-70" width="100" height="140" rx="16" fill="#ffffff" opacity="0.95" filter="url(#shadow)"/>
    <rect x="-42" y="-62" width="84" height="105" rx="8" fill="#f0fdfa"/>
    
    <line x1="-30" y1="-20" x2="30" y2="-20" stroke="#f97316" stroke-width="2" opacity="0.6"/>
    <line x1="-30" y1="0" x2="30" y2="0" stroke="#f97316" stroke-width="2" opacity="0.6"/>
    <line x1="-30" y1="20" x2="30" y2="20" stroke="#f97316" stroke-width="2" opacity="0.6"/>
    
    <circle cx="15" cy="-30" r="12" fill="#f97316"/>
    <line x1="10" y1="-30" x2="20" y2="-30" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
    
    <circle cx="0" cy="50" r="18" fill="url(#accentGrad)"/>
    <polygon points="-6,40 -6,60 10,50" fill="#ffffff"/>
    <rect x="-15" y="55" width="30" height="3" rx="1.5" fill="#0d9488" opacity="0.3"/>
  </g>
  
  <text x="250" y="340" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="36" font-weight="700" fill="#ffffff" text-anchor="middle" filter="url(#shadow)">小辣椒去水印精灵</text>
  
  <text x="250" y="375" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="16" font-weight="400" fill="#ffffff" opacity="0.9" text-anchor="middle">免费 · 快速 · 高清无水印</text>
  
  <rect x="180" y="400" width="140" height="3" rx="1.5" fill="#ffffff" opacity="0.3"/>
</svg>`);
    
    await sharp(svgBufferSquare)
      .png()
      .toFile(path.join(imgDir, 'share-cover-timeline.png'));
    
    console.log('Created share-cover-timeline.png');
    
    // 检查文件大小
    const friendStat = require('fs').statSync(path.join(imgDir, 'share-cover-friend.png'));
    const timelineStat = require('fs').statSync(path.join(imgDir, 'share-cover-timeline.png'));
    
    console.log(`Friend cover: ${friendStat.size} bytes`);
    console.log(`Timeline cover: ${timelineStat.size} bytes`);
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

convertSVGtoPNG();