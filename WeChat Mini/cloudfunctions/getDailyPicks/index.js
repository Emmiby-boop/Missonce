const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 全局内存缓存，减少冷启动后重复查询
const _memCache = {}
const CACHE_DURATION = 30 * 60 * 1000  // 30分钟

// 🔥 日期种子：将日期字符串转为确定性数字
// 同一天种子一致（偏移稳定，数据不抖动），跨天种子变化（偏移变化，内容更新）
function getDateSeed(dateStr) {
  const digits = dateStr.replace(/-/g, '').split('').map(Number)
  return digits.reduce((sum, d, i) => sum + d * (i + 1) * 7, 0)
}

class DailyPicksService {
  constructor() {
    this.PICKS_COUNT = 50
    this.AVATAR_RATIO = 0.3
    this.CACHE_KEY_PREFIX = 'daily_picks_'
  }

  async getTodayPicks(dateStr) {
    try {
      const dailyPicks = await db.collection('daily_picks')
        .where({ date: dateStr })
        .limit(1)
        .get()

      if (dailyPicks.data && dailyPicks.data.length > 0) {
        return dailyPicks.data[0]
      }

      return null
    } catch (error) {
      console.log('[DailyPicks] daily_picks 集合不存在或查询失败，跳过:', error.message)
      return null
    }
  }

  async getRandomResources(type, count, dateSeed) {
    try {
      console.log('[DailyPicks] 查询' + type + '，数量:', count)

      const queryConditions = { status: 'published', deletedAt: null }
      if (type !== 'all') {
        queryConditions.type = type
      }

      // 🔥 60% 热门 + 40% 最新，用日期种子偏移确保跨天内容变化
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
      const uniqueItems = []

      hotRes.data.forEach(item => {
        if (!seenIds.has(item._id) && uniqueItems.length < hotCount) {
          seenIds.add(item._id)
          uniqueItems.push(item)
        }
      })

      freshRes.data.forEach(item => {
        if (!seenIds.has(item._id) && uniqueItems.length < count) {
          seenIds.add(item._id)
          uniqueItems.push(item)
        }
      })

      console.log('[DailyPicks] ' + type + '查询结果:', uniqueItems.length + '条（热门偏移', hotOffset, '，最新偏移', freshOffset, '）')
      return uniqueItems
    } catch (error) {
      console.error('获取' + type + '资源失败:', error)
      return []
    }
  }

  async generatePicksByAlgorithm(dateStr) {
    const dateSeed = getDateSeed(dateStr)
    const avatarCount = Math.round(this.PICKS_COUNT * this.AVATAR_RATIO)
    const wallpaperCount = this.PICKS_COUNT - avatarCount

    console.log('[DailyPicks] 需要头像:', avatarCount, '张，壁纸:', wallpaperCount, '张，日期种子:', dateSeed)

    const [avatarItems, wallpaperItems] = await Promise.all([
      this.getRandomResources('avatar', avatarCount, dateSeed),
      this.getRandomResources('wallpaper', wallpaperCount, dateSeed)
    ])

    console.log('[DailyPicks] 获取到头像:', avatarItems.length, '张，壁纸:', wallpaperItems.length, '张')

    // 确保至少有一些数据
    let finalItems = []
    
    if (avatarItems.length === 0 && wallpaperItems.length === 0) {
      console.log('[DailyPicks] 无数据可用，尝试获取任意类型的资源')
      const fallbackItems = await this.getRandomResources('all', this.PICKS_COUNT, dateSeed)
      console.log('[DailyPicks] 获取到 fallback 资源:', fallbackItems.length, '张')
      
      if (fallbackItems.length > 0) {
        finalItems = fallbackItems
      }
    } else {
      // 随机打乱顺序
      const shuffledAvatars = this.shuffleArray([...avatarItems])
      const shuffledWallpapers = this.shuffleArray([...wallpaperItems])

      const mixedItems = []
      let avatarIdx = 0
      let wallpaperIdx = 0

      for (let i = 0; i < this.PICKS_COUNT; i++) {
        if (i % Math.round(1 / this.AVATAR_RATIO) === 0 && avatarIdx < shuffledAvatars.length) {
          mixedItems.push(shuffledAvatars[avatarIdx++])
        } else if (wallpaperIdx < shuffledWallpapers.length) {
          mixedItems.push(shuffledWallpapers[wallpaperIdx++])
        } else if (avatarIdx < shuffledAvatars.length) {
          mixedItems.push(shuffledAvatars[avatarIdx++])
        }
      }

      finalItems = mixedItems
    }

    console.log('[DailyPicks] 最终混合:', finalItems.length, '张')

    return finalItems.map((item, index) => ({
      ...item,
      position: index + 1,
      resourceType: item.type || 'wallpaper'
    }))
  }

  // 随机打乱数组
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
    }
    return array
  }

  formatResponse(picks, dateStr) {
    const targetDate = new Date(dateStr)
    const month = targetDate.getMonth() + 1
    const day = targetDate.getDate()
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const weekDay = weekDays[targetDate.getDay()]

    const title = month + '月' + day + '日 · 每日推荐'
    const subtitle = '为你推荐' + picks.length + '张壁纸头像'

    const leftColumn = []
    const rightColumn = []

    picks.forEach((item, index) => {
      const processedItem = {
        id: item._id,
        _id: item._id,
        url: item.optimizedUrl || item.coverUrl || item.url,
        originalUrl: item.originUrl || item.originalUrl || item.url,
        rawUrl: item.coverUrl || item.url,
        rawOriginalUrl: item.originUrl || item.originalUrl || item.url,
        resourceType: item.resourceType || item.type || 'wallpaper',
        categories: item.categories || [],
        tags: item.tags || [],
        width: item.width || 1080,
        height: item.height || 1920
      }

      if (index % 2 === 0) {
        leftColumn.push(processedItem)
      } else {
        rightColumn.push(processedItem)
      }
    })

    return {
      date: dateStr,
      title,
      subtitle,
      weekDay,
      items: picks,
      leftColumn,
      rightColumn,
      totalCount: picks.length
    }
  }
}

exports.main = async (event) => {
  const { date } = event
  const service = new DailyPicksService()

  // 🔥 使用北京时间（UTC+8），与 prebuildDailyPicks 保持一致，避免 UTC 16:00 后日期错位
  const now = new Date()
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const dateStr = date || beijingTime.getUTCFullYear() + '-' + String(beijingTime.getUTCMonth() + 1).padStart(2, '0') + '-' + String(beijingTime.getUTCDate()).padStart(2, '0')
  const cacheKey = service.CACHE_KEY_PREFIX + dateStr

  console.log('[DailyPicks] 请求日期:', dateStr)

  try {
    // 尝试从内存缓存获取
    const now = Date.now()
    const cached = _memCache[cacheKey]
    if (cached && now - cached.time < CACHE_DURATION) {
      console.log('[DailyPicks] 从内存缓存获取数据')
      return {
        success: true,
        data: cached.data
      }
    }

    let picks = await service.getTodayPicks(dateStr)

    if (!picks || !picks.items || picks.items.length === 0) {
      console.log('[DailyPicks] 当日无数据，生成算法推荐')
      const items = await service.generatePicksByAlgorithm(dateStr)
      picks = { items }

      // 🔥 L2 直读支持：算法生成后写入 daily_picks 集合，下次进入可直接读取（跳 callFunction）
      try {
        await db.collection('daily_picks').add({
          data: {
            date: dateStr,
            items: items.map(item => ({
              _id: item._id,
              resourceId: item._id,
              position: item.position,
              resourceType: item.resourceType || item.type || 'wallpaper'
            })),
            createdAt: db.serverDate()
          }
        })
        console.log('[DailyPicks] 已写入 daily_picks 集合，date:', dateStr)
      } catch (e) {
        console.warn('[DailyPicks] 写入 daily_picks 集合失败（可能已存在）:', e.message)
      }
    } else if (picks.items && picks.items.length > 0) {
      // 处理从数据库获取的数据，确保每个项都有完整的资源信息
      const resourceIds = picks.items
        .map(item => item.resourceId || item._id)
        .filter(id => id)
      
      if (resourceIds.length > 0) {
        try {
          const resourcesRes = await db.collection('resources')
            .where({ _id: _.in(resourceIds), deletedAt: null })
            .get()
          
          const resourceMap = new Map()
          resourcesRes.data.forEach(r => resourceMap.set(r._id, r))
          
          picks.items = picks.items.map(item => {
            const resource = resourceMap.get(item.resourceId || item._id)
            return resource ? { ...resource, position: item.position } : null
          }).filter(Boolean)
        } catch (error) {
          console.error('[DailyPicks] 查询资源详情失败:', error)
          // 如果查询失败，使用原始数据
        }
      }
    }

    console.log('[DailyPicks] 最终返回数据条数:', picks.items ? picks.items.length : 0)

    const response = service.formatResponse(picks.items || [], dateStr)
    
    // 写入内存缓存
    _memCache[cacheKey] = { data: response, time: Date.now() }

    return {
      success: true,
      data: response
    }
  } catch (error) {
    console.error('[DailyPicks] 获取每日精选失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
