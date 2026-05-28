/**
 * 🔧 WeChat Mini Program wx:key 重复错误诊断工具
 * 
 * 使用方法：
 * 1. 在 avatar.js 的 loadAvatars 方法中添加以下代码
 * 2. 打开微信开发者工具的控制台
 * 3. 查看诊断结果
 */

// ============ 诊断函数 ============

/**
 * 检查数据中是否有重复的 id
 */
function checkDuplicateIds(data, fieldName = 'id') {
  const ids = data.map(item => item[fieldName])
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
  const uniqueDuplicates = [...new Set(duplicates)]
  
  if (uniqueDuplicates.length > 0) {
    console.error(`❌ 发现 ${uniqueDuplicates.length} 个重复的 ${fieldName}:`, uniqueDuplicates)
    return false
  } else {
    console.log(`✅ 所有 ${fieldName} 都是唯一的`)
    return true
  }
}

/**
 * 检查数据中是否有 null/undefined 的 id
 */
function checkMissingIds(data, fieldName = 'id') {
  const missingCount = data.filter(item => !item[fieldName]).length
  
  if (missingCount > 0) {
    console.error(`❌ 发现 ${missingCount} 个缺少 ${fieldName} 的项目`)
    return false
  } else {
    console.log(`✅ 所有项目都有 ${fieldName}`)
    return true
  }
}

/**
 * 完整诊断
 */
function diagnoseData(data, name = 'Data') {
  console.group(`📊 诊断: ${name}`)
  console.log(`总数: ${data.length}`)
  
  // 检查 id 字段
  const hasIdField = data.every(item => 'id' in item)
  console.log(`有 id 字段: ${hasIdField ? '✅' : '❌'}`)
  
  // 检查 _id 字段
  const has_IdField = data.every(item => '_id' in item)
  console.log(`有 _id 字段: ${has_IdField ? '✅' : '❌'}`)
  
  // 检查重复
  const idOk = checkDuplicateIds(data, 'id')
  const _idOk = checkDuplicateIds(data, '_id')
  
  // 检查缺失
  const idMissingOk = checkMissingIds(data, 'id')
  const _idMissingOk = checkMissingIds(data, '_id')
  
  // 显示样本数据
  console.log('样本数据 (前3条):')
  data.slice(0, 3).forEach((item, index) => {
    console.log(`  [${index}] id=${item.id}, _id=${item._id}, title=${item.title}`)
  })
  
  console.groupEnd()
  
  return idOk && _idOk && idMissingOk && _idMissingOk
}

// ============ 在 loadAvatars 中使用 ============

/*
在 loadAvatars 方法中，修改为：

getResources(params).then(async (res) => {
  if (!res.result || !res.result.success) {
    // ... 错误处理
    return
  }
  
  const newAvatars = res.result.data || []
  
  // 🔧 诊断原始数据
  console.log('=== 原始数据诊断 ===')
  diagnoseData(newAvatars, '原始数据')
  
  const gifThumbSize = getGifThumbnailSize()
  const optimizedAvatars = optimizeImageUrls(newAvatars, 'coverUrl', gifThumbSize)
  
  const processedAvatars = optimizedAvatars.map((item, index) => {
    const uniqueId = item.id || item._id || `avatar_${Date.now()}_${index}`
    return {
      ...item,
      id: uniqueId,
      _id: item._id || item.id,
      url: item.optimizedUrl || item.coverUrl,
      originalUrl: item.originUrl,
      rawUrl: item.coverUrl,
      rawOriginalUrl: item.originUrl
    }
  })
  
  // 🔧 诊断处理后的数据
  console.log('=== 处理后数据诊断 ===')
  const isValid = diagnoseData(processedAvatars, '处理后的数据')
  
  if (!isValid) {
    console.error('⚠️ 数据验证失败，可能导致 wx:key 错误')
  } else {
    console.log('✅ 数据验证通过')
  }
  
  // ... 继续原有逻辑
})
*/

// ============ 快速测试 ============

/**
 * 快速测试函数 - 在控制台直接运行
 */
function quickTest() {
  // 模拟有问题的数据
  const badData = [
    { id: 'avatar_1', title: '头像1' },
    { id: 'avatar_1', title: '头像2' },  // 重复的 id
    { id: null, title: '头像3' },         // 缺少 id
    { title: '头像4' }                    // 没有 id 字段
  ]
  
  console.log('=== 测试有问题的数据 ===')
  diagnoseData(badData, '有问题的数据')
  
  // 模拟修复后的数据
  const goodData = [
    { id: 'avatar_1', _id: 'abc123', title: '头像1' },
    { id: 'avatar_2', _id: 'abc124', title: '头像2' },
    { id: 'avatar_3', _id: 'abc125', title: '头像3' },
    { id: 'avatar_4', _id: 'abc126', title: '头像4' }
  ]
  
  console.log('=== 测试修复后的数据 ===')
  diagnoseData(goodData, '修复后的数据')
}

export {
  checkDuplicateIds,
  checkMissingIds,
  diagnoseData,
  quickTest
}
