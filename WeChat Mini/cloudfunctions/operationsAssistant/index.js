const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate

class OperationsAssistant {
  constructor() {}

  async getDashboardStats(days = 7) {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const [
        userStats,
        resourceStats,
        eventStats,
        hotResources
      ] = await Promise.all([
        this.getUserStats(startDate),
        this.getResourceStats(),
        this.getEventStats(startDate),
        this.getHotResources(50)
      ])

      return {
        success: true,
        data: {
          overview: {
            totalUsers: userStats.total,
            activeUsers: userStats.active,
            newUsers: userStats.new,
            totalResources: resourceStats.total,
            totalViews: eventStats.totalViews,
            totalDownloads: eventStats.totalDownloads,
            totalFavorites: eventStats.totalFavorites
          },
          trends: await this.getTrendData(startDate),
          categoryDistribution: await this.getCategoryDistribution(),
          hotResources,
          topCategories: await this.getTopCategories(),
          topTags: await this.getTopTags()
        }
      }
    } catch (error) {
      console.error('获取看板数据失败:', error)
      return { success: false, message: error.message }
    }
  }

  async getUserStats(startDate) {
    try {
      const [allUsersRes, activeUsersRes, newUsersRes] = await Promise.all([
        db.collection('sys_user').count(),
        db.collection('events')
          .where({ createTime: _.gte(startDate) })
          .aggregate()
          .group({ _id: '$_openid' })
          .count('count')
          .end(),
        db.collection('sys_user')
          .where({ createdAt: _.gte(startDate) })
          .count()
      ])

      return {
        total: allUsersRes.total || 0,
        active: activeUsersRes.list[0]?.count || 0,
        new: newUsersRes.total || 0
      }
    } catch (error) {
      console.error('用户统计失败:', error)
      return { total: 0, active: 0, new: 0 }
    }
  }

  async getResourceStats() {
    try {
      const [totalRes, avatarRes, wallpaperRes] = await Promise.all([
        db.collection('resources').count(),
        db.collection('resources').where({ type: 'avatar' }).count(),
        db.collection('resources').where({ type: 'wallpaper' }).count()
      ])

      return {
        total: totalRes.total || 0,
        avatar: avatarRes.total || 0,
        wallpaper: wallpaperRes.total || 0
      }
    } catch (error) {
      console.error('资源统计失败:', error)
      return { total: 0, avatar: 0, wallpaper: 0 }
    }
  }

  async getEventStats(startDate) {
    try {
      const eventsRes = await db.collection('events')
        .where({ createTime: _.gte(startDate) })
        .get()

      let totalViews = 0, totalDownloads = 0, totalFavorites = 0

      eventsRes.data.forEach(event => {
        if (event.type === 'pv') totalViews++
        else if (event.type === 'download') totalDownloads++
        else if (event.type === 'favorite') totalFavorites++
      })

      return { totalViews, totalDownloads, totalFavorites }
    } catch (error) {
      console.error('事件统计失败:', error)
      return { totalViews: 0, totalDownloads: 0, totalFavorites: 0 }
    }
  }

  async getTrendData(startDate) {
    try {
      const days = 7
      const trends = []

      for (let i = days - 1; i >= 0; i--) {
        const dayStart = new Date()
        dayStart.setDate(dayStart.getDate() - i)
        dayStart.setHours(0, 0, 0, 0)

        const dayEnd = new Date(dayStart)
        dayEnd.setHours(23, 59, 59, 999)

        const eventsRes = await db.collection('events')
          .where({
            createTime: _.gte(dayStart).and(_.lte(dayEnd))
          })
          .get()

        let views = 0, downloads = 0, favorites = 0, users = new Set()

        eventsRes.data.forEach(event => {
          if (event._openid) users.add(event._openid)
          if (event.type === 'pv') views++
          else if (event.type === 'download') downloads++
          else if (event.type === 'favorite') favorites++
        })

        trends.push({
          date: dayStart.toISOString().split('T')[0],
          views,
          downloads,
          favorites,
          activeUsers: users.size
        })
      }

      return trends
    } catch (error) {
      console.error('趋势数据失败:', error)
      return []
    }
  }

  async getCategoryDistribution() {
    try {
      const resourcesRes = await db.collection('resources')
        .field({ categories: 1, category: 1, type: 1 })
        .limit(1000)
        .get()

      const categoryCount = new Map()

      resourcesRes.data.forEach(resource => {
        const categories = resource.categories || [resource.category].filter(Boolean)
        categories.forEach(cat => {
          categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1)
        })
      })

      return Array.from(categoryCount.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15)
    } catch (error) {
      console.error('分类分布失败:', error)
      return []
    }
  }

  async getHotResources(limit = 10) {
    try {
      const res = await db.collection('resources')
        .orderBy('hotScore', 'desc')
        .limit(limit)
        .get()

      return res.data.map(item => ({
        id: item._id,
        title: item.title,
        type: item.type,
        coverUrl: item.coverUrl,
        hotScore: item.hotScore || 0,
        viewCount: item.views || 0,
        downloads: item.downloads || 0,
        favorites: item.favorites || 0,
        categories: item.categories || [item.category].filter(Boolean)
      }))
    } catch (error) {
      console.error('热门资源失败:', error)
      return []
    }
  }

  async getTopCategories() {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const eventsRes = await db.collection('events')
        .where({
          createTime: _.gte(thirtyDaysAgo),
          type: _.in(['pv', 'download', 'favorite'])
        })
        .limit(500)
        .get()

      const resourceIds = [...new Set(eventsRes.data.map(e => e.resourceId).filter(Boolean))]

      if (resourceIds.length === 0) return []

      const resourcesRes = await db.collection('resources')
        .where({ _id: _.in(resourceIds) })
        .field({ categories: 1, category: 1 })
        .limit(200)
        .get()

      const categoryScore = new Map()

      resourcesRes.data.forEach(resource => {
        const categories = resource.categories || [resource.category].filter(Boolean)
        categories.forEach(cat => {
          categoryScore.set(cat, (categoryScore.get(cat) || 0) + 1)
        })
      })

      return Array.from(categoryScore.entries())
        .map(([name, score]) => ({ name, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
    } catch (error) {
      console.error('热门分类失败:', error)
      return []
    }
  }

  async getTopTags() {
    try {
      const resourcesRes = await db.collection('resources')
        .field({ tags: 1, hotScore: 1 })
        .orderBy('hotScore', 'desc')
        .limit(500)
        .get()

      const tagScore = new Map()

      resourcesRes.data.forEach(resource => {
        const tags = resource.tags || []
        const weight = Math.max(1, Math.min((resource.hotScore || 0) / 10, 5))
        tags.forEach(tag => {
          tagScore.set(tag, (tagScore.get(tag) || 0) + weight)
        })
      })

      return Array.from(tagScore.entries())
        .map(([name, score]) => ({ name, score: Math.round(score) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
    } catch (error) {
      console.error('热门标签失败:', error)
      return []
    }
  }

  async getContentQualityCheck() {
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const recentRes = await db.collection('resources')
        .where({ createdAt: _.gte(sevenDaysAgo) })
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get()

      const lowQuality = recentRes.data.filter(r => {
        const hasNoTags = !r.tags || r.tags.length === 0
        const hasNoCategory = !r.category && (!r.categories || r.categories.length === 0)
        const lowHot = (r.hotScore || 0) < 5
        return hasNoTags || hasNoCategory || lowHot
      })

      const aiPending = recentRes.data.filter(r => r.aiStatus === 'failed' || !r.aiStatus)

      return {
        success: true,
        data: {
          recentCount: recentRes.data.length,
          lowQualityCount: lowQuality.length,
          aiPendingCount: aiPending.length,
          suggestions: [
            ...(lowQuality.length > 0 ? [`有 ${lowQuality.length} 个资源需要优化标签和分类`] : []),
            ...(aiPending.length > 0 ? [`有 ${aiPending.length} 个资源需要重新AI分析`] : [])
          ],
          lowQualityResources: lowQuality.slice(0, 20).map(r => ({
            id: r._id,
            title: r.title,
            type: r.type,
            coverUrl: r.coverUrl,
            issues: [
              ...(!r.tags || r.tags.length === 0 ? ['缺少标签'] : []),
              ...(!r.category && (!r.categories || r.categories.length === 0) ? ['缺少分类'] : []),
              ...((r.hotScore || 0) < 5 ? ['热度较低'] : [])
            ]
          }))
        }
      }
    } catch (error) {
      console.error('内容质量检查失败:', error)
      return { success: false, message: error.message }
    }
  }

  async getTrendPrediction() {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const eventsRes = await db.collection('events')
        .where({ createTime: _.gte(thirtyDaysAgo) })
        .limit(1000)
        .get()

      const last7Days = new Date()
      last7Days.setDate(last7Days.getDate() - 7)

      const recentEvents = eventsRes.data.filter(e => 
        e.createTime && new Date(e.createTime) >= last7Days
      )

      const resourceIds = [...new Set(recentEvents.map(e => e.resourceId).filter(Boolean))]

      if (resourceIds.length === 0) {
        return {
          success: true,
          data: {
            risingCategories: [],
            risingTags: [],
            prediction: '数据不足，无法预测'
          }
        }
      }

      const resourcesRes = await db.collection('resources')
        .where({ _id: _.in(resourceIds) })
        .field({ categories: 1, category: 1, tags: 1, createdAt: 1 })
        .get()

      const categoryTrend = new Map()
      const tagTrend = new Map()

      resourcesRes.data.forEach(resource => {
        const ageDays = Math.max(1, 
          (Date.now() - new Date(resource.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24)
        )
        const recencyWeight = Math.max(0.5, 3 / ageDays)

        const categories = resource.categories || [resource.category].filter(Boolean)
        categories.forEach(cat => {
          categoryTrend.set(cat, (categoryTrend.get(cat) || 0) + recencyWeight)
        })

        const tags = resource.tags || []
        tags.forEach(tag => {
          tagTrend.set(tag, (tagTrend.get(tag) || 0) + recencyWeight * 0.7)
        })
      })

      return {
        success: true,
        data: {
          risingCategories: Array.from(categoryTrend.entries())
            .map(([name, score]) => ({ name, score: Math.round(score * 10) / 10 }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 8),
          risingTags: Array.from(tagTrend.entries())
            .map(([name, score]) => ({ name, score: Math.round(score * 10) / 10 }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 15),
          prediction: this.generatePrediction(categoryTrend, tagTrend)
        }
      }
    } catch (error) {
      console.error('趋势预测失败:', error)
      return { success: false, message: error.message }
    }
  }

  generatePrediction(categoryTrend, tagTrend) {
    const topCategories = Array.from(categoryTrend.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name)

    const topTags = Array.from(tagTrend.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name)

    if (topCategories.length === 0) {
      return '数据样本较少，建议继续观察用户行为趋势'
    }

    return `近期${topCategories.join('、')}类型内容关注度上升明显，建议重点补充${topTags.slice(0, 3).join('、')}相关资源`
  }

  async getUserBehavior(startDate, endDate, type = 'all', limit = 50, skip = 0) {
    try {
      let query = db.collection('events')

      if (startDate) {
        query = query.where({
          createTime: _.gte(startDate).and(endDate ? _.lte(endDate) : _.gt(0))
        })
      }

      if (type !== 'all') {
        query = query.where({ type })
      }

      const [countRes, eventsRes] = await Promise.all([
        query.count(),
        query.orderBy('createTime', 'desc').skip(skip).limit(limit).get()
      ])

      const resourceIds = [...new Set(eventsRes.data.map(e => e.resourceId).filter(Boolean))]
      const userOpenids = [...new Set(eventsRes.data.map(e => e._openid).filter(Boolean))]

      const [resourcesRes, usersRes] = await Promise.all([
        resourceIds.length > 0 
          ? db.collection('resources').where({ _id: _.in(resourceIds) }).field({ _id: 1, title: 1, type: 1, coverUrl: 1 }).get()
          : { data: [] },
        userOpenids.length > 0 
          ? db.collection('sys_user').where({ _openid: _.in(userOpenids) }).field({ _id: 1, _openid: 1, nickname: 1, avatarUrl: 1 }).get()
          : { data: [] }
      ])

      const resourceMap = new Map(resourcesRes.data.map(r => [r._id, r]))
      const userMap = new Map(usersRes.data.map(u => [u._openid, u]))

      const records = eventsRes.data.map(event => ({
        id: event._id,
        type: event.type,
        resourceId: event.resourceId,
        resourceTitle: resourceMap.get(event.resourceId)?.title || '未知资源',
        resourceType: resourceMap.get(event.resourceId)?.type,
        resourceCover: resourceMap.get(event.resourceId)?.coverUrl,
        userId: event._openid,
        userNickname: userMap.get(event._openid)?.nickname || '匿名用户',
        userAvatar: userMap.get(event._openid)?.avatarUrl,
        createTime: event.createTime
      }))

      return {
        success: true,
        data: {
          total: countRes.total || 0,
          records
        }
      }
    } catch (error) {
      console.error('获取用户行为失败:', error)
      return { success: false, message: error.message }
    }
  }

  async getBehaviorStats(startDate) {
    try {
      const [favoritesRes, downloadsRes] = await Promise.all([
        db.collection('events').where({ type: 'favorite', createTime: _.gte(startDate) }).count(),
        db.collection('events').where({ type: 'download', createTime: _.gte(startDate) }).count()
      ])

      return {
        success: true,
        data: {
          totalFavorites: favoritesRes.total || 0,
          totalDownloads: downloadsRes.total || 0
        }
      }
    } catch (error) {
      console.error('获取行为统计失败:', error)
      return { success: false, message: error.message }
    }
  }
}

const assistant = new OperationsAssistant()

exports.main = async (event, context) => {
  const { action, days = 7, startDate, endDate, type = 'all', limit = 50, skip = 0 } = event

  try {
    if (action === 'dashboard') {
      return await assistant.getDashboardStats(days)
    }

    if (action === 'qualityCheck') {
      return await assistant.getContentQualityCheck()
    }

    if (action === 'trendPrediction') {
      return await assistant.getTrendPrediction()
    }

    if (action === 'userBehavior') {
      const start = startDate ? new Date(startDate) : undefined
      const end = endDate ? new Date(endDate) : undefined
      return await assistant.getUserBehavior(start, end, type, limit, skip)
    }

    if (action === 'behaviorStats') {
      const start = startDate ? new Date(startDate) : (() => {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        return d
      })()
      return await assistant.getBehaviorStats(start)
    }

    return {
      success: false,
      message: '无效的操作'
    }
  } catch (error) {
    console.error('运营助手错误:', error)
    return {
      success: false,
      message: error.message || '服务异常'
    }
  }
}
