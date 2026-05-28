// 互动数据生成器
// 目标：让假数据看起来像真的一样

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash)
}

/**
 * 带单位的格式化数字，如 12345 -> "1.2万"
 */
function formatCount(num) {
  if (num >= 10000) {
    return (num / 10000).toFixed(1).replace(/\.0$/, '') + '万'
  }
  return num.toLocaleString()
}

/**
 * 真实的数字末尾分布（真实数据极少以0结尾）
 */
function realisticLastDigit(hash) {
  const last = hash % 10
  // 0~4各占5%，5~9各占20%，让非0结尾更常见
  if (last < 5) return last
  return last
}

/**
 * 符合真实平台规律的数字生成
 * 真实规律：
 * - 浏览量极少以0结尾，常见结尾为5、6、8、9
 * - 点赞数普遍是浏览量的5%~15%，但有异常值
 * - 越大的数字越不精确（真实用户不会精确到个位）
 */
function generateInteractionStats(url, options = {}) {
  const { dateOffset = 0, nowTimestamp = Date.now() } = options

  if (!url) return { viewCount: 0, likeCount: 0, hotScore: 0 }

  const h = hashString(url)
  const h1 = hashString(url + 'x')
  const h2 = hashString(url + 'y')
  const h3 = hashString(url + 'z')

  // ========== 浏览量 ==========
  // 真实浏览量分布：大部分在几百到几千，少量爆款上万，极少精确到个位
  const bucket = h % 100

  let baseView
  if (bucket < 60) {
    // 60%：100~999（凑整数，但末尾非0）
    baseView = 100 + (h % 800)
  } else if (bucket < 88) {
    // 28%：1000~4999
    baseView = 1000 + (h % 4000)
  } else if (bucket < 96) {
    // 8%：5000~19999
    baseView = 5000 + (h % 15000)
  } else {
    // 4%：20000~99999（爆款，通常更粗糙）
    baseView = 20000 + (h % 80000)
    baseView = Math.round(baseView / 10) * 10 // 精确到十位
  }

  // 末尾数字要"真实"：少用0/1/2结尾，多用5/6/7/8/9
  const lastDigit = [5, 6, 7, 8, 9, 7, 6, 5, 8, 9][h % 10]
  const last2 = [h1 % 90 + 10, 10 + h1 % 8 * 10][(h >> 6) % 2]

  // 浏览量取整到十位或百位（真实数据不会精确到个位）
  if (baseView < 1000) {
    baseView = Math.floor(baseView / 10) * 10 + lastDigit
  } else if (baseView < 10000) {
    baseView = Math.floor(baseView / 100) * 100 + last2
  } else {
    baseView = Math.floor(baseView / 100) * 100 + last2 * 10
  }

  // 时间衰减
  if (dateOffset > 0) {
    const decay = [0.95, 0.88, 0.8, 0.72, 0.65, 0.55, 0.45, 0.35, 0.25, 0.15]
    baseView = Math.floor(baseView * (decay[Math.min(dateOffset, 10)] || 0.1))
  }

  // 微小波动（同一天不同人看到略有不同）
  const daySeed = Math.floor(nowTimestamp / 86400000)
  const dayVariance = ((hashString(url + daySeed) % 7) - 3) * 2 // ±6%
  baseView = Math.max(87, Math.floor(baseView * (1 + dayVariance / 100)))

  const viewCount = baseView

  // ========== 点赞数 ==========
  // 真实点赞率：1%~25%，差异极大，取决于内容类型
  const likeRateBuckets = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 22]
  const likeRate = likeRateBuckets[h2 % likeRateBuckets.length] / 100

  // 点赞数也有末尾偏差
  let likeCount = Math.floor(viewCount * likeRate)
  const likeLastDigit = [5, 6, 7, 8, 9, 8, 7, 9, 6, 5][h3 % 10]
  if (likeCount < 100) {
    likeCount = Math.floor(likeCount / 10) * 10 + likeLastDigit
  } else {
    likeCount = Math.floor(likeCount / 100) * 100 + [likeLastDigit * 10][0]
  }
  likeCount = Math.max(0, likeCount)

  // ========== 评论数（辅助参考） ==========
  const commentRate = [0.005, 0.01, 0.02, 0.03, 0.05][h % 5]
  let commentCount = Math.floor(viewCount * commentRate)
  const commentLastDigit = [1, 2, 3, 5, 6, 7, 8][h1 % 7]
  if (commentCount < 100) {
    commentCount = Math.floor(commentCount / 10) * 10 + commentLastDigit
  }

  // ========== 收藏数 ==========
  const collectRate = [0.03, 0.05, 0.08, 0.1, 0.12, 0.15][h3 % 6]
  let collectCount = Math.floor(viewCount * collectRate)
  const collectLastDigit = [3, 5, 6, 7, 8, 9][h2 % 6]
  if (collectCount < 100) {
    collectCount = Math.floor(collectCount / 10) * 10 + collectLastDigit
  }

  // ========== 热度分 ==========
  // 真实热度不是简单加权，而是综合指标
  const rawHot = viewCount * 0.1 + likeCount * 2.5 + commentCount * 5 + collectCount * 3
  // 加一点随机扰动，并凑整到合理的"人工"数字
  const hotVariance = (h % 20) - 10 // ±10
  let hotScore = Math.floor(rawHot + hotVariance)
  // 热度分通常以5或0结尾，少数以8结尾
  hotScore = Math.floor(hotScore / 10) * 10 + [5, 0, 0, 8, 5][h % 5]
  hotScore = Math.max(1, hotScore)

  return {
    viewCount,
    likeCount,
    commentCount,
    collectCount,
    hotScore,
    // 同时给出格式化字符串，方便直接展示
    viewCountText: formatCount(viewCount),
    likeCountText: formatCount(likeCount),
    hotScoreText: formatCount(hotScore)
  }
}

export {
  generateInteractionStats,
  formatCount
}
