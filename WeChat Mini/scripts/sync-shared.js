/**
 * 同步 shared/ 公共模块到各云函数目录
 *
 * 微信云函数部署时每个函数独立上传，无法跨目录 require。
 * 本脚本将 cloudfunctions/shared/ 下的公共模块同步到各云函数目录，
 * 确保 shared/ 是唯一数据源，各副本内容一致。
 *
 * 用法：node scripts/sync-shared.js
 */
const fs = require('fs')
const path = require('path')

const cloudfunctionsDir = path.join(__dirname, '..', 'cloudfunctions')
const sharedDir = path.join(cloudfunctionsDir, 'shared')

// 需要同步的公共模块文件（shared/ 目录下）
const SHARED_MODULES = ['withAdmin.js']

// 引用了 withAdmin.js 的云函数目录名（通过 Grep 扫描得出）
// 如新增云函数也用 withAdmin，只需在此列表追加
const TARGET_FUNCTIONS = [
  'adminNotifications',
  'adminUserManager',
  'manageAvatarFrames',
  'manageHomeTabs',
  'manageTopicLayout',
  'manageTopics',
  'updateResource',
  'uploadResource',
]

function syncFile(fileName) {
  const sourcePath = path.join(sharedDir, fileName)
  if (!fs.existsSync(sourcePath)) {
    console.error(`[sync-shared] 源文件不存在: ${sourcePath}`)
    return 0
  }

  const sourceContent = fs.readFileSync(sourcePath, 'utf8')
  let syncedCount = 0

  for (const funcName of TARGET_FUNCTIONS) {
    const targetPath = path.join(cloudfunctionsDir, funcName, fileName)
    if (!fs.existsSync(path.dirname(targetPath))) {
      console.warn(`[sync-shared] 跳过：云函数目录不存在 ${funcName}`)
      continue
    }

    const targetContent = fs.existsSync(targetPath)
      ? fs.readFileSync(targetPath, 'utf8')
      : null

    if (targetContent === sourceContent) {
      console.log(`[sync-shared] ✓ 已是最新: ${funcName}/${fileName}`)
      continue
    }

    fs.writeFileSync(targetPath, sourceContent, 'utf8')
    console.log(`[sync-shared] → 已同步: ${funcName}/${fileName}`)
    syncedCount++
  }

  return syncedCount
}

console.log('===== 同步 shared 公共模块 =====\n')
let totalSynced = 0
for (const mod of SHARED_MODULES) {
  console.log(`\n--- 同步 ${mod} ---`)
  totalSynced += syncFile(mod)
}

console.log(`\n===== 完成：同步 ${totalSynced} 个文件 =====`)
if (totalSynced === 0) {
  console.log('所有副本已是最新，无需同步。')
}
