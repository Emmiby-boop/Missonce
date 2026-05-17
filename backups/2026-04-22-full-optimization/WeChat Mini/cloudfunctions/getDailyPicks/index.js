const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 全局内存缓存，减少冷启动后重复查询
const _memCache = {}
const CACHE_DURATION = 30 * 60 * 1000  // 30分钟

class DailyPicksService {
  constructor() {
    this.PICKS_COUNT = 20
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

  async getRandomResources(type, count) {
    try {
      console.log('[DailyPicks] 查询' + type + '，数量:', count)
      
      // 增加随机因子，避免每天内容重复
      const randomOffset = Math.floor(Math.random() * 10)
      
      const queryConditions = { status: 'published' }
      if (type !== 'all') {
        queryConditions.type = type
      }
      
      const res = await db.collection('resources')
        .where(queryConditions)
        .orderBy('hotScore', 'desc')
        .orderBy('createdAt', 'desc')
        .skip(randomOffset)
        .limit(count * 2) // 多获取一些，用于去重
        .get()
      
      console.log('[DailyPicks] ' + type + '查询结果:', res.data.length + '条')
      
      // 去重处理
      const uniqueItems = []
      const seenIds = new Set()
      
      res.data.forEach(item => {
        if (!seenIds.has(item._id) && uniqueItems.length < count) {
          seenIds.add(item._id)
          uniqueItems.push(item)
        }
      })
      
      return uniqueItems
    } catch (error) {
      console.error('获取' + type + '资源失败:', error)
      return []
    }
  }

  async generatePicksByAlgorithm() {
    const avatarCount = Math.round(this.PICKS_COUNT * this.AVATAR_RATIO)
    const wallpaperCount = this.PICKS_COUNT - avatarCount

    console.log('[DailyPicks] 需要头像:', avatarCount, '张，壁纸:', wallpaperCount, '张')

    const [avatarItems, wallpaperItems] = await Promise.all([
      this.getRandomResources('avatar', avatarCount),
      this.getRandomResources('wallpaper', wallpaperCount)
    ])

    console.log('[DailyPicks] 获取到头像:', avatarItems.length, '张，壁纸:', wallpaperItems.length, '张')

    // 确保至少有一些数据
    let finalItems = []
    
    if (avatarItems.length === 0 && wallpaperItems.length === 0) {
      console.log('[DailyPicks] 无数据可用，尝试获取任意类型的资源')
      const fallbackItems = await this.getRandomResources('all', this.PICKS_COUNT)
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

  const today = new Date()
  const dateStr = date || today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')
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
      const items = await service.generatePicksByAlgorithm()
      picks = { items }
    } else if (picks.items && picks.items.length > 0) {
      // 处理从数据库获取的数据，确保每个项都有完整的资源信息
      const resourceIds = picks.items
        .map(item => item.resourceId || item._id)
        .filter(id => id)
      
      if (resourceIds.length > 0) {
        try {
          const resourcesRes = await db.collection('resources')
            .where({ _id: _.in(resourceIds) })
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
