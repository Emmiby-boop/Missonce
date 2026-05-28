const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 默认语录（首次自动播种用，与旧版保持一致）
const DEFAULT_QUOTES = [
  '保持热爱，奔赴山海',
  '生活明朗，万物可爱',
  '这一刻的温柔属于你',
  '今日份的好心情',
  '未来可期，人间值得',
  '愿你眼中有光，心中有爱',
  '所有的运气都藏在努力里',
  '你是自己的光，不需要别人照亮',
  '别慌，月亮也正在大海某处迷茫',
  '万物皆有裂痕，那是光照进来的地方',
  '星光不问赶路人，时光不负有心人',
  '这世界很酷，你也要有骨气',
  '你若盛开，清风自来',
  '愿你遍历山河，觉得人间值得',
  '满怀希望，就会所向披靡',
  '你当像鸟飞往你的山',
  '知足且上进，温柔且坚定',
  '日子常新，未来不远',
  '山海自有归期，风雨自有相逢',
  '热爱可抵岁月漫长',
  '心之所向，素履以往',
  '凡是过去，皆为序章',
  '慢慢来，谁不是翻山越岭去爱',
  '且将新火试新茶，诗酒趁年华',
  '要有最朴素的生活，与最遥远的梦想',
  '愿你此生尽兴，赤诚善良',
  '生如夏花之绚烂',
  '不乱于心，不困于情',
  '愿你有软肋，也有盔甲',
  '不畏将来，不念过往',
]

exports.main = async () => {
  try {
    const col = db.collection('poster_quotes')

    // 检查是否已有数据
    const { total } = await col.count()

    if (total === 0) {
      // 首次调用：播种默认语录
      for (const text of DEFAULT_QUOTES) {
        await col.add({ data: { text, createdAt: Date.now() } })
      }
      return { quotes: DEFAULT_QUOTES, seeded: true }
    }

    // 已有数据：返回所有
    const { data } = await col.limit(100).get()
    const quotes = data.map(doc => doc.text)
    return { quotes, total }

  } catch (err) {
    console.error('getPosterQuotes 失败:', err)
    // 降级：返回默认语录
    return { quotes: DEFAULT_QUOTES, fallback: true, error: err.message }
  }
}
