const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 创建数据库复合索引
 *
 * 部署后在云开发控制台调用云函数，或在代码中 wx.cloud.callFunction({ name: 'updateDatabaseIndexes' })
 */

// 索引定义（根据 getHomeData 冷启动时的实际查询模式）
const INDEX_DEFINITIONS = {
  resources: [
    // 首页：type + status + hotScore/createdAt 排序（最核心）
    {
      name: 'type_status_hotScore_createdAt',
      keys: [
        { name: 'type', direction: 1 },
        { name: 'status', direction: 1 },
        { name: 'hotScore', direction: -1 },
        { name: 'createdAt', direction: -1 }
      ]
    },
    // 分类板块：categories 数组 + status + hotScore
    {
      name: 'categories_status_hotScore',
      keys: [
        { name: 'categories', direction: 1 },
        { name: 'status', direction: 1 },
        { name: 'hotScore', direction: -1 }
      ]
    },
    // 分类板块：categories + status + createdAt
    {
      name: 'categories_status_createdAt',
      keys: [
        { name: 'categories', direction: 1 },
        { name: 'status', direction: 1 },
        { name: 'createdAt', direction: -1 }
      ]
    },
    // 全量热门：status + hotScore + createdAt
    {
      name: 'status_hotScore_createdAt',
      keys: [
        { name: 'status', direction: 1 },
        { name: 'hotScore', direction: -1 },
        { name: 'createdAt', direction: -1 }
      ]
    },
    // 最新资源：status + createdAt
    {
      name: 'status_createdAt',
      keys: [
        { name: 'status', direction: 1 },
        { name: 'createdAt', direction: -1 }
      ]
    },
    // 标签筛选：tags + status + hotScore
    {
      name: 'tags_status_hotScore',
      keys: [
        { name: 'tags', direction: 1 },
        { name: 'status', direction: 1 },
        { name: 'hotScore', direction: -1 }
      ]
    }
  ],

  banners: [
    {
      name: 'status_sort',
      keys: [
        { name: 'status', direction: 1 },
        { name: 'sort', direction: 1 }
      ]
    }
  ],

  home_sections: [
    {
      name: 'enable_sort',
      keys: [
        { name: 'enable', direction: 1 },
        { name: 'sort', direction: 1 }
      ]
    }
  ],

  favorites: [
    {
      name: 'openid_type_createTime',
      keys: [
        { name: '_openid', direction: 1 },
        { name: 'type', direction: 1 },
        { name: 'createTime', direction: -1 }
      ]
    },
    {
      name: 'openid_resourceId',
      keys: [
        { name: '_openid', direction: 1 },
        { name: 'resourceId', direction: 1 }
      ]
    }
  ],

  downloads: [
    {
      name: 'openid_createTime',
      keys: [
        { name: '_openid', direction: 1 },
        { name: 'createTime', direction: -1 }
      ]
    }
  ],

  browse_history: [
    {
      name: 'openid_createTime',
      keys: [
        { name: '_openid', direction: 1 },
        { name: 'createTime', direction: -1 }
      ]
    }
  ],

  topics: [
    {
      name: 'status_sort',
      keys: [
        { name: 'status', direction: 1 },
        { name: 'sort', direction: 1 }
      ]
    }
  ],

  categories: [
    {
      name: 'type_order',
      keys: [
        { name: 'type', direction: 1 },
        { name: 'order', direction: 1 }
      ]
    }
  ],

  tags: [
    {
      name: 'type_order',
      keys: [
        { name: 'type', direction: 1 },
        { name: 'order', direction: 1 }
      ]
    }
  ]
}

exports.main = async (event, context) => {
  const result = {
    success: [],
    skipped: [],
    failed: []
  }

  // 获取环境信息（用于日志）
  const wxContext = cloud.getWXContext()
  const envId = wxContext.ENV || wxContext.env || 'unknown'

  console.log(`[updateDatabaseIndexes] 开始执行，环境: ${envId}`)

  for (const collectionName in INDEX_DEFINITIONS) {
    const indexes = INDEX_DEFINITIONS[collectionName]

    // 确保集合存在
    try {
      await db.createCollection(collectionName)
    } catch (e) {
      // 已存在忽略
    }

    for (const indexDef of indexes) {
      try {
        // 尝试使用 cloud.cloudbase API
        await cloud.cloudbase.databaseCreateIndex({
          collectionName,
          indexes: [indexDef]
        })
        result.success.push(`${collectionName}.${indexDef.name}`)
        console.log(`✅ 创建成功: ${collectionName}.${indexDef.name}`)
      } catch (err) {
        const errMsg = err.errMsg || err.message || JSON.stringify(err) || ''

        // 已存在 → 跳过，不算失败
        if (
          errMsg.includes('exist') ||
          errMsg.includes('Existed') ||
          errMsg.includes('already') ||
          errMsg.includes('duplicate') ||
          err.code === -502001 // 腾讯云定义：索引已存在
        ) {
          result.skipped.push(`${collectionName}.${indexDef.name}`)
          console.log(`⏭️  已存在跳过: ${collectionName}.${indexDef.name}`)
        } else {
          result.failed.push({
            index: `${collectionName}.${indexDef.name}`,
            error: errMsg,
            code: err.code || null
          })
          console.error(`❌ 创建失败: ${collectionName}.${indexDef.name} — ${errMsg}`)
        }
      }
    }
  }

  const summary = {
    totalSuccess: result.success.length,
    totalSkipped: result.skipped.length,
    totalFailed: result.failed.length
  }

  console.log('\n========== 执行结果 ==========')
  console.log(`✅ 成功: ${summary.totalSuccess}`)
  console.log(`⏭️  已存在: ${summary.totalSkipped}`)
  console.log(`❌ 失败: ${summary.totalFailed}`)
  if (result.failed.length > 0) {
    console.log('失败详情:')
    result.failed.forEach(f => console.log(`  ${f.index}: ${f.error}`))
  }
  console.log('==============================\n')

  return { ...result, summary }
}
