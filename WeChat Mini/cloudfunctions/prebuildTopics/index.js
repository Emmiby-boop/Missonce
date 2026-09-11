const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 预构建专题列表缓存
// 设计：每 10 分钟定时拉取 status=active 的专题列表，批量解析封面 fileID，
// 写入 topics_cache 集合（单文档 _id='v1'），供小程序前端直读库读取，
// 跳过 callFunction 链路（约省 100-300ms），实现冷启动秒开。

exports.main = async (event, context) => {
  const startTime = Date.now()
  try {
    console.log('[prebuildTopics] 开始预构建专题列表缓存')

    // 1. 查询所有 active 专题（最多 100 条，覆盖常规规模）
    const topicsRes = await db.collection('topics')
      .where({ status: 'active' })
      .orderBy('sort', 'asc')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()

    const rawTopics = topicsRes.data || []
    console.log(`[prebuildTopics] 查询到 ${rawTopics.length} 个 active 专题`)

    // 2. 批量解析封面 fileID → tempURL（避免前端逐个解析）
    const coverFileIDs = rawTopics
      .map(item => item.cover || item.coverUrl || item.image)
      .filter(url => typeof url === 'string' && url.startsWith('cloud://'))
    const coverUrlMap = new Map()
    if (coverFileIDs.length > 0) {
      try {
        const uniqueFileIDs = [...new Set(coverFileIDs)]
        const coverUrlRes = await cloud.getTempFileURL({
          fileList: uniqueFileIDs.map(fileID => ({ fileID, maxAge: 3600 * 24 * 7 }))
        })
        ;(coverUrlRes.fileList || []).forEach(f => {
          if (f.tempFileURL) coverUrlMap.set(f.fileID, f.tempFileURL)
        })
      } catch (coverErr) {
        console.warn('[prebuildTopics] 批量解析封面URL失败:', coverErr.message || coverErr)
      }
    }

    // 3. 组装最终数据（结构与 getTopics 列表接口保持一致）
    const topics = rawTopics.map(item => {
      const rawCover = item.cover || item.coverUrl || item.image || ''
      const resolvedCover = rawCover && rawCover.startsWith('cloud://')
        ? (coverUrlMap.get(rawCover) || rawCover)
        : rawCover

      // 从 layout 提取手动选择的资源ID和网格列数
      let manualIds = []
      let gridColumns = 3
      if (item.layout && item.layout.modules) {
        const gridModule = item.layout.modules.find(m => m.type === 'resource-grid')
        if (gridModule && gridModule.config) {
          if (gridModule.config.sourceType === 'manual' && Array.isArray(gridModule.config.manualIds)) {
            manualIds = gridModule.config.manualIds
          }
          if (gridModule.config.columns) {
            gridColumns = gridModule.config.columns
          }
        }
      }
      if (manualIds.length === 0 && Array.isArray(item.resourceIds) && item.resourceIds.length > 0) {
        manualIds = item.resourceIds
      }

      return {
        id: item._id,
        _id: item._id,
        title: item.title,
        coverUrl: resolvedCover,
        cover: resolvedCover,
        description: item.description || item.desc,
        desc: item.desc || item.description,
        sort: item.sort || 0,
        createdAt: item.createdAt,
        status: item.status || 'active',
        isFeatured: item.isFeatured || false,
        badge: item.badge || '',
        filterType: item.filterType || 'tag',
        filterValue: item.filterValue || '',
        resourceType: item.resourceType || 'all',
        contentType: item.contentType || 'auto',
        defaultSort: item.defaultSort || 'latest',
        // 跳转类型相关字段（小程序端 onTopicTap 依赖这两个字段路由）
        linkType: item.linkType || 'resource',
        linkUrl: item.linkUrl || '',
        manualIds,
        gridColumns
      }
    })

    // 4. 写入 topics_cache 集合（单文档 v1，前端直读库）
    const cacheData = {
      data: topics,
      updatedAt: db.serverDate(),
      totalCount: topics.length
    }
    try {
      await db.collection('topics_cache').doc('v1').set({
        data: cacheData
      })
      console.log('[prebuildTopics] topics_cache 写入成功')
    } catch (e) {
      // 集合不存在时尝试 add（首次部署）
      console.warn('[prebuildTopics] topics_cache 写入失败，尝试 add:', e.message)
      try {
        await db.collection('topics_cache').add({
          data: { _id: 'v1', ...cacheData }
        })
        console.log('[prebuildTopics] topics_cache 首次写入成功')
      } catch (addErr) {
        console.error('[prebuildTopics] topics_cache 写入彻底失败:', addErr.message)
      }
    }

    const cost = Date.now() - startTime
    console.log(`[prebuildTopics] ✅ 预构建完成，耗时: ${cost}ms，共 ${topics.length} 个专题`)

    return {
      success: true,
      cost,
      topicsCount: topics.length,
      updatedAt: new Date().toISOString()
    }

  } catch (err) {
    console.error('[prebuildTopics] ❌ 预构建失败:', err)
    return {
      success: false,
      error: err.message || String(err)
    }
  }
}
