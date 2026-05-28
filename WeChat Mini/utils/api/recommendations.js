/**
 * 获取个性化推荐资源
 */
export const getPersonalizedRecommendations = async (limit = 10) => {
  try {
    const res = await wx.cloud.callFunction({
      name: 'getRecommendations',
      data: {
        action: 'personalized',
        limit
      }
    })
    
    if (res.result && res.result.success) {
      return res.result.data
    }
    throw new Error(res.result?.message || '获取推荐失败')
  } catch (e) {
    console.error('获取个性化推荐失败:', e)
    const db = wx.cloud.database()
    try {
      const fallback = await db.collection('resources')
        .orderBy('hotScore', 'desc')
        .limit(limit)
        .get()
      return fallback.data
    } catch (err) {
      return []
    }
  }
}

/**
 * 获取相关推荐资源
 */
export const getRelatedRecommendations = async (resourceId, limit = 6) => {
  try {
    const res = await wx.cloud.callFunction({
      name: 'getRecommendations',
      data: {
        action: 'related',
        resourceId,
        limit
      }
    })
    
    if (res.result && res.result.success) {
      return res.result.data
    }
    throw new Error(res.result?.message || '获取相关推荐失败')
  } catch (e) {
    console.error('获取相关推荐失败:', e)
    return []
  }
}
