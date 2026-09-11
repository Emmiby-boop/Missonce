const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const PICKS_COUNT = 50
const AVATAR_RATIO = 0.3

// 🔥 获取北京时间日期字符串（云函数运行在 UTC 时区，必须手动转北京时间）
function getBeijingDateStr() {
  const now = new Date()
  // UTC+8 北京时间
  const beijing = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const y = beijing.getUTCFullYear()
  const m = String(beijing.getUTCMonth() + 1).padStart(2, '0')
  const d = String(beijing.getUTCDate()).padStart(2, '0')
  return y + '-' + m + '-' + d
}

// 🔥 日期种子：将日期字符串转为确定性数字
// 同一天种子一致（偏移稳定，数据不抖动），跨天种子变化（偏移变化，内容更新）
function getDateSeed(dateStr) {
  const digits = dateStr.replace(/-/g, '').split('').map(Number)
  return digits.reduce((sum, d, i) => sum + d * (i + 1) * 7, 0)
}

// 🔥 获取随机资源：60% 热门 + 40% 最新，用日期种子偏移确保跨天内容变化
async function getRandomResources(type, count, dateSeed) {
  try {
    const queryConditions = { status: 'published', deletedAt: null }
    if (type !== 'all') {
      queryConditions.type = type
    }

    const hotCount = Math.ceil(count * 0.6)   // 60% 热门
    const freshCount = count - hotCount        // 40% 最新

    // 热门资源：日期种子偏移（0-30），跨天偏移变化
    const hotOffset = dateSeed % 30
    const hotRes = await db.collection('resources')
      .where(queryConditions)
      .orderBy('hotScore', 'desc')
      .skip(hotOffset)
      .limit(hotCount * 2)
      .get()

    // 最新资源：日期种子偏移（0-20），让新资源也能被推荐
    const freshOffset = dateSeed % 20
    const freshRes = await db.collection('resources')
      .where(queryConditions)
      .orderBy('createdAt', 'desc')
      .skip(freshOffset)
      .limit(freshCount * 2)
      .get()

    // 合并去重：先加热门，再补最新
    const seenIds = new Set()
    const result = []

    hotRes.data.forEach(item => {
      if (!seenIds.has(item._id) && result.length < hotCount) {
        seenIds.add(item._id)
        result.push(item)
      }
    })

    freshRes.data.forEach(item => {
      if (!seenIds.has(item._id) && result.length < count) {
        seenIds.add(item._id)
        result.push(item)
      }
    })

    console.log('[prebuildDailyPicks] ' + type + ' 获取:', result.length, '条（热门', hotCount, '+ 最新', freshCount, '，偏移', hotOffset, '/', freshOffset, '）')
    return result
  } catch (error) {
    console.error('[prebuildDailyPicks] 获取' + type + '资源失败:', error)
    return []
  }
}

// 生成每日推荐（60% 热门 + 40% 最新，用日期种子偏移确保跨天内容变化）
async function generatePicksByAlgorithm(dateStr) {
  const dateSeed = getDateSeed(dateStr)
  const avatarCount = Math.round(PICKS_COUNT * AVATAR_RATIO)
  const wallpaperCount = PICKS_COUNT - avatarCount

  const [avatarItems, wallpaperItems] = await Promise.all([
    getRandomResources('avatar', avatarCount, dateSeed),
    getRandomResources('wallpaper', wallpaperCount, dateSeed)
  ])

  let finalItems = []

  if (avatarItems.length === 0 && wallpaperItems.length === 0) {
    // fallback：查任意类型资源
    finalItems = await getRandomResources('all', PICKS_COUNT, dateSeed)
  } else {
    // 随机打乱
    const shuffledAvatars = shuffleArray([...avatarItems])
    const shuffledWallpapers = shuffleArray([...wallpaperItems])

    const mixedItems = []
    let avatarIdx = 0
    let wallpaperIdx = 0

    for (let i = 0; i < PICKS_COUNT; i++) {
      if (i % Math.round(1 / AVATAR_RATIO) === 0 && avatarIdx < shuffledAvatars.length) {
        mixedItems.push(shuffledAvatars[avatarIdx++])
      } else if (wallpaperIdx < shuffledWallpapers.length) {
        mixedItems.push(shuffledWallpapers[wallpaperIdx++])
      } else if (avatarIdx < shuffledAvatars.length) {
        mixedItems.push(shuffledAvatars[avatarIdx++])
      }
    }
    finalItems = mixedItems
  }

  return finalItems.map((item, index) => ({
    ...item,
    position: index + 1,
    resourceType: item.type || 'wallpaper'
  }))
}

// Fisher-Yates 洗牌
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

exports.main = async (event) => {
  const dateStr = event.date || getBeijingDateStr()
  console.log('[prebuildDailyPicks] 预构建日期:', dateStr, '触发源:', event.TriggerName || 'manual')

  try {
    // 1. 生成当天推荐
    const items = await generatePicksByAlgorithm(dateStr)

    if (items.length === 0) {
      console.warn('[prebuildDailyPicks] 生成数据为空，跳过写入')
      return { success: false, error: '生成数据为空', date: dateStr }
    }

    // 2. upsert 写入：先删除当天旧数据（防止重复），再添加新数据
    try {
      const existing = await db.collection('daily_picks').where({ date: dateStr }).get()
      if (existing.data && existing.data.length > 0) {
        for (const doc of existing.data) {
          await db.collection('daily_picks').doc(doc._id).remove()
        }
        console.log('[prebuildDailyPicks] 已删除旧文档:', existing.data.length, '条')
      }
    } catch (e) {
      console.warn('[prebuildDailyPicks] 删除旧数据失败（可能不存在）:', e.message)
    }

    // 3. 写入新数据（仅存 resourceId 列表，前端 L2 直读时关联 resources 集合查完整数据）
    await db.collection('daily_picks').add({
      data: {
        date: dateStr,
        items: items.map(item => ({
          _id: item._id,
          resourceId: item._id,
          position: item.position,
          resourceType: item.resourceType || item.type || 'wallpaper'
        })),
        createdAt: db.serverDate(),
        prebuilt: true
      }
    })

    console.log('[prebuildDailyPicks] 预构建完成，date:', dateStr, 'count:', items.length)
    return {
      success: true,
      date: dateStr,
      count: items.length,
      items: items.map(i => ({ id: i._id, type: i.type, position: i.position }))
    }
  } catch (e) {
    console.error('[prebuildDailyPicks] 预构建失败:', e)
    return { success: false, error: e.message, date: dateStr }
  }
}
