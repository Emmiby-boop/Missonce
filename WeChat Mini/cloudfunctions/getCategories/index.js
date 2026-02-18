const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const $ = db.command.aggregate

/**
 * 使用聚合查询从 resources 集合中实时提取所有唯一的单个标签
 */
async function getUniqueTagsFromResources(type) {
  try {
    const match = { status: 'published' }
    if (type && type !== 'all') {
      match.type = type
    }

    // 使用聚合框架：
    // 1. 过滤已发布的对应类型资源
    // 2. 将 tags 数组展开（unwind），使每个标签变成一条独立记录
    // 3. 按标签内容进行分组并统计数量
    // 4. 按数量降序排列
    const res = await db.collection('resources').aggregate()
      .match(match)
      .unwind('$tags')
      .group({
        _id: '$tags',
        count: $.sum(1)
      })
      .sort({
        count: -1
      })
      .limit(200) // 标签导航栏展示前 200 个常用标签
      .end()

    return res.list.map(item => ({
      id: item._id,
      name: item._id,
      key: item._id,
      count: item.count
    }))
  } catch (error) {
    console.error('聚合提取标签失败:', error)
    // 降级处理：如果聚合失败，尝试从 tags 集合读取
    return getTagsFromCollection(type)
  }
}

/**
 * 从 tags 集合获取标签数据（作为备份或特定用途）
 */
async function getTagsFromCollection(type) {
  try {
    const where = { visible: true }
    if (type && type !== 'all') {
      where.type = type
    }
    
    const res = await db.collection('tags')
      .where(where)
      .orderBy('order', 'asc')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()
    
    const uniqueTags = []
    const seenNames = new Set()
    
    for (const item of res.data) {
      const cleanName = String(item.name).trim()
      if (cleanName && !seenNames.has(cleanName)) {
        seenNames.add(cleanName)
        uniqueTags.push({
          id: cleanName,
          name: cleanName,
          key: cleanName,
          type: item.type
        })
      }
    }
    
    return uniqueTags
  } catch (error) {
    console.error('获取标签集合失败:', error)
    return []
  }
}

exports.main = async (event, context) => {
  const { type = 'all', source = 'categories' } = event
  try {
    // 按照用户要求，直接读取并展示图片库中所有出现的独立标签
    if (source === 'tags') {
      const tags = await getUniqueTagsFromResources(type)
      return {
        success: true,
        data: tags
      }
    }

    const where = { visible: true }
    if (type !== 'all') {
      where.type = type
    }
    
    const res = await db.collection('categories').where(where).orderBy('order', 'asc').limit(100).get()
    
    const uniqueItems = []
    const seenNames = new Set()
    
    for (const item of res.data) {
      if (!seenNames.has(item.name)) {
        seenNames.add(item.name)
        uniqueItems.push({
          id: item.key || item.name,
          name: item.name,
          key: item.key || item.name,
          type: item.type
        })
      }
    }
    
    return {
      success: true,
      data: uniqueItems
    }
  } catch (error) {
    console.error('获取分类失败:', error)
    return {
      success: false,
      message: error.message
    }
  }
}
