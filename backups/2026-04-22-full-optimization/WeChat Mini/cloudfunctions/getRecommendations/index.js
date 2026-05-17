const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const CACHE_TTL = 10 * 60 * 1000
const globalUserCache = {}

class RecommendationEngine {
  constructor() {
    this.MAX_RECOMMENDATIONS = 20
    this.MIN_INTERACTIONS = 3
  }

  async getUserProfile(openid) {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const [eventsRes, favoritesRes] = await Promise.all([
        db.collection('events')
          .where({
            _openid: openid,
            createTime: _.gte(thirtyDaysAgo)
          })
          .orderBy('createTime', 'desc')
          .limit(100)
          .get(),
        db.collection('favorites')
          .where({ _openid: openid })
          .limit(50)
          .get()
      ])

      const profile = {
        openid,
        viewedResources: new Set(),
        favoriteResources: new Set(),
        typePreferences: { avatar: 0, wallpaper: 0 },
        categoryScores: new Map(),
        tagScores: new Map(),
        recentActivity: []
      }

      eventsRes.data.forEach(event => {
        if (event.resourceId) {
          profile.viewedResources.add(event.resourceId)
          profile.recentActivity.push({
            resourceId: event.resourceId,
            type: event.type,
            time: event.createTime
          })
        }
      })

      favoritesRes.data.forEach(fav => {
        if (fav.resourceId) {
          profile.favoriteResources.add(fav.resourceId)
          profile.viewedResources.add(fav.resourceId)
        }
      })

      const resourceIds = [...profile.viewedResources]
      if (resourceIds.length > 0) {
        const resourcesRes = await db.collection('resources')
          .where({ _id: _.in(resourceIds) })
          .get()

        resourcesRes.data.forEach(resource => {
          const isFavorite = profile.favoriteResources.has(resource._id)
          const weight = isFavorite ? 3 : 1

          if (resource.type) {
            profile.typePreferences[resource.type] = 
              (profile.typePreferences[resource.type] || 0) + weight
          }

          const categories = resource.categories || [resource.category].filter(Boolean)
          categories.forEach(cat => {
            profile.categoryScores.set(cat, 
              (profile.categoryScores.get(cat) || 0) + weight)
          })

          const tags = resource.tags || []
          tags.forEach(tag => {
            profile.tagScores.set(tag, 
              (profile.tagScores.get(tag) || 0) + weight * 0.5)
          })
        })
      }

      return profile
    } catch (error) {
      console.error('获取用户画像失败:', error)
      return null
    }
  }

  calculateResourceScore(resource, profile) {
    let score = 0

    const typeScore = profile.typePreferences[resource.type] || 0
    score += typeScore * 2

    const categories = resource.categories || [resource.category].filter(Boolean)
    categories.forEach(cat => {
      score += (profile.categoryScores.get(cat) || 0) * 1.5
    })

    const tags = resource.tags || []
    tags.forEach(tag => {
      score += profile.tagScores.get(tag) || 0
    })

    const hotBonus = Math.min((resource.hotScore || 0) * 0.1, 10)
    score += hotBonus

    return score
  }

  async getContentBasedRecommendations(profile, limit = 10) {
    try {
      const categories = Array.from(profile.categoryScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cat]) => cat)

      const tags = Array.from(profile.tagScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag]) => tag)

      const conditions = [{ status: 'published' }]
      
      if (categories.length > 0) {
        conditions.push({ categories: _.in(categories) })
      }

      const preferredType = profile.typePreferences.avatar > profile.typePreferences.wallpaper 
        ? 'avatar' : 'wallpaper'
      conditions.push({ type: preferredType })

      const excludedIds = [...profile.viewedResources]
      if (excludedIds.length > 0) {
        conditions.push({ _id: _.nin(excludedIds) })
      }

      const candidatesRes = await db.collection('resources')
        .where(_.and(conditions))
        .orderBy('hotScore', 'desc')
        .limit(Math.min(limit * 3, 100))
        .get()

      const candidates = candidatesRes.data.map(resource => ({
        ...resource,
        score: this.calculateResourceScore(resource, profile)
      }))

      candidates.sort((a, b) => b.score - a.score)

      return candidates.slice(0, limit)
    } catch (error) {
      console.error('内容推荐失败:', error)
      return []
    }
  }

  async getSimilarUsers(profile, limit = 5) {
    try {
      const allUsers = await db.collection('events')
        .aggregate()
        .group({
          _id: '$_openid',
          count: _.sum(1)
        })
        .match({ count: _.gte(this.MIN_INTERACTIONS) })
        .limit(50)
        .end()

      const users = allUsers.list || []
      return users.filter(u => u._id !== profile.openid).slice(0, limit)
    } catch (error) {
      console.error('获取相似用户失败:', error)
      return []
    }
  }

  async getCollaborativeFilteringRecommendations(profile, limit = 10) {
    try {
      const similarUsers = await this.getSimilarUsers(profile)
      if (similarUsers.length === 0) return []

      const userIds = similarUsers.map(u => u._id)
      
      const [favoritesRes, eventsRes] = await Promise.all([
        db.collection('favorites')
          .where({ _openid: _.in(userIds) })
          .limit(100)
          .get(),
        db.collection('events')
          .where({ 
            _openid: _.in(userIds),
            type: 'pv'
          })
          .limit(200)
          .get()
      ])

      const resourceCounts = new Map()
      
      favoritesRes.data.forEach(fav => {
        if (fav.resourceId) {
          resourceCounts.set(fav.resourceId, (resourceCounts.get(fav.resourceId) || 0) + 3)
        }
      })

      eventsRes.data.forEach(event => {
        if (event.resourceId) {
          resourceCounts.set(event.resourceId, (resourceCounts.get(event.resourceId) || 0) + 1)
        }
      })

      const excludedIds = [...profile.viewedResources]
      const candidateIds = Array.from(resourceCounts.entries())
        .filter(([id]) => !excludedIds.includes(id))
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit * 2)
        .map(([id]) => id)

      if (candidateIds.length === 0) return []

      const resourcesRes = await db.collection('resources')
        .where({ 
          _id: _.in(candidateIds),
          status: 'published'
        })
        .get()

      return resourcesRes.data.map(resource => ({
        ...resource,
        score: resourceCounts.get(resource._id) || 0
      }))
    } catch (error) {
      console.error('协同过滤推荐失败:', error)
      return []
    }
  }

  async getHotRecommendations(profile, limit = 10) {
    try {
      const preferredType = profile.typePreferences.avatar >= profile.typePreferences.wallpaper 
        ? 'avatar' : 'wallpaper'

      const excludedIds = [...profile.viewedResources]
      
      const conditions = [{ status: 'published' }, { type: preferredType }]
      if (excludedIds.length > 0) {
        conditions.push({ _id: _.nin(excludedIds) })
      }

      const res = await db.collection('resources')
        .where(_.and(conditions))
        .orderBy('hotScore', 'desc')
        .limit(limit)
        .get()

      return res.data.map(resource => ({ ...resource, score: resource.hotScore || 0 }))
    } catch (error) {
      console.error('热门推荐失败:', error)
      return []
    }
  }

  async getRecommendations(openid, limit = 10) {
    const cacheKey = `rec_${openid}`
    const cached = globalUserCache[cacheKey]
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data
    }

    try {
      const profile = await this.getUserProfile(openid)
      
      let hotRecs
      if (!profile || profile.viewedResources.size < this.MIN_INTERACTIONS) {
        hotRecs = await this.getHotRecommendations({
          typePreferences: { avatar: 1, wallpaper: 1 },
          viewedResources: new Set()
        }, limit)
      } else {
        const [contentRecs, cfRecs] = await Promise.all([
          this.getContentBasedRecommendations(profile, Math.ceil(limit * 0.6)),
          this.getCollaborativeFilteringRecommendations(profile, Math.ceil(limit * 0.4))
        ])

        const seenIds = new Set()
        const recommendations = []

        const allCandidates = [...contentRecs, ...cfRecs]
        allCandidates.forEach(resource => {
          if (!seenIds.has(resource._id)) {
            seenIds.add(resource._id)
            recommendations.push(resource)
          }
        })

        hotRecs = recommendations.slice(0, limit)
      }
      
      globalUserCache[cacheKey] = { data: hotRecs, timestamp: Date.now() }
      return hotRecs
    } catch (error) {
      console.error('推荐失败:', error)
      return []
    }
  }

  async getRelatedResources(resourceId, limit = 6) {
    try {
      const resourceRes = await db.collection('resources').doc(resourceId).get()
      if (!resourceRes.data) return []

      const resource = resourceRes.data
      const conditions = []

      if (resource.type) {
        conditions.push({ type: resource.type })
      }

      const categories = resource.categories || [resource.category].filter(Boolean)
      if (categories.length > 0) {
        conditions.push({ categories: _.in(categories) })
      }

      conditions.push({ _id: _.neq(resourceId) })

      const res = await db.collection('resources')
        .where(_.and(conditions))
        .orderBy('hotScore', 'desc')
        .limit(limit * 2)
        .get()

      return res.data.slice(0, limit)
    } catch (error) {
      console.error('相关资源推荐失败:', error)
      return []
    }
  }
}

const engine = new RecommendationEngine()

exports.main = async (event, context) => {
  const { action, resourceId, limit = 10 } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    if (action === 'personalized') {
      const recommendations = await engine.getRecommendations(openid, limit)
      
      const data = recommendations.map(item => ({
        id: item._id,
        _id: item._id,
        title: item.title,
        type: item.type,
        coverUrl: item.coverUrl,
        originUrl: item.originUrl || item.coverUrl,
        categories: item.categories || [item.category].filter(Boolean),
        tags: item.tags || [],
        hotScore: item.hotScore || 0,
        downloads: item.downloads || 0,
        favorites: item.favorites || 0,
        createdAt: item.createdAt || null
      }))

      return {
        success: true,
        data,
        message: data.length > 0 ? '推荐获取成功' : '暂无推荐内容'
      }
    }

    if (action === 'related' && resourceId) {
      const related = await engine.getRelatedResources(resourceId, limit)
      
      const data = related.map(item => ({
        id: item._id,
        _id: item._id,
        title: item.title,
        type: item.type,
        coverUrl: item.coverUrl,
        originUrl: item.originUrl || item.coverUrl,
        categories: item.categories || [item.category].filter(Boolean),
        tags: item.tags || [],
        hotScore: item.hotScore || 0,
        downloads: item.downloads || 0,
        favorites: item.favorites || 0,
        createdAt: item.createdAt || null
      }))

      return {
        success: true,
        data,
        message: data.length > 0 ? '相关资源获取成功' : '暂无相关资源'
      }
    }

    return {
      success: false,
      message: '无效的操作'
    }
  } catch (error) {
    console.error('推荐云函数错误:', error)
    return {
      success: false,
      message: error.message || '推荐服务异常'
    }
  }
}
