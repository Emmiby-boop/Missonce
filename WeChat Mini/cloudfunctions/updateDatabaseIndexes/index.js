const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 自动创建/更新数据库索引
 * 注意：wx-server-sdk 的 db.createIndexes 在部分环境可能不支持或版本过低
 * 这里改用 HTTP API 方式调用，或者使用 db.collection().createIndexes() 的正确语法
 * 
 * 修正：wx-server-sdk 中并没有直接暴露 createIndexes 方法给 collection，
 * 需要使用 db.createCollection 自带索引创建，或者使用 HTTP API。
 * 但云函数内网调用 HTTP API 需要凭证。
 * 
 * 替代方案：尝试使用 db.command.aggregate 但这也不能建索引。
 * 
 * 正确方案：云函数中暂不支持直接代码创建索引（除了 createCollection 时），
 * 必须通过 HTTP API 调用 `databaseCreateIndex` 接口。
 * 
 * 为简化操作，这里改为打印出“需要手动创建的索引建议”，或者尝试使用 cloud.openapi.cloudbase.databaseCreateIndex (如果存在)
 * 实际上 cloud.openapi.cloudbase 包含 databaseCreateIndex。
 */
exports.main = async (event, context) => {
  const result = {
    success: [],
    failed: [],
    manualRequired: false,
    suggestions: {}
  }
  
  // 获取当前环境ID
  const { ENV } = cloud.getWXContext()

  // 定义需要的索引结构
  const indexes = {
    // 资源表
    resources: [
      {
        name: 'status_hotScore',
        unique: false,
        keys: [
          { name: 'status', direction: '1' },
          { name: 'hotScore', direction: '-1' }
        ]
      },
      {
        name: 'status_createdAt',
        unique: false,
        keys: [
          { name: 'status', direction: '1' },
          { name: 'createdAt', direction: '-1' }
        ]
      },
      {
        name: 'type_status',
        unique: false,
        keys: [
          { name: 'type', direction: '1' },
          { name: 'status', direction: '1' }
        ]
      },
      {
        name: 'category_status',
        unique: false,
        keys: [
          { name: 'category', direction: '1' },
          { name: 'status', direction: '1' }
        ]
      },
      {
        name: 'tags_status',
        unique: false,
        keys: [
          { name: 'tags', direction: '1' },
          { name: 'status', direction: '1' }
        ]
      },
      // 优化 URL 查找
      {
        name: 'coverUrl',
        unique: false,
        keys: [
          { name: 'coverUrl', direction: '1' }
        ]
      },
      {
        name: 'originUrl',
        unique: false,
        keys: [
          { name: 'originUrl', direction: '1' }
        ]
      }
    ],
    topics: [
      {
        name: 'status_sort',
        unique: false,
        keys: [
          { name: 'status', direction: '1' },
          { name: 'sort', direction: '1' }
        ]
      }
    ],
    // 收藏表
    favorites: [
      {
        name: 'openid_createTime',
        unique: false,
        keys: [
          { name: '_openid', direction: '1' },
          { name: 'createTime', direction: '-1' }
        ]
      },
      {
        name: 'openid_type',
        unique: false,
        keys: [
          { name: '_openid', direction: '1' },
          { name: 'type', direction: '1' }
        ]
      },
      {
        name: 'openid_resourceId',
        unique: false,
        keys: [
          { name: '_openid', direction: '1' },
          { name: 'resourceId', direction: '1' }
        ]
      },
      {
        name: 'openid_url',
        unique: false,
        keys: [
          { name: '_openid', direction: '1' },
          { name: 'url', direction: '1' }
        ]
      }
    ],
    // 下载记录表
    downloads: [
      {
        name: 'openid_createTime',
        unique: false,
        keys: [
          { name: '_openid', direction: '1' },
          { name: 'createTime', direction: '-1' }
        ]
      }
    ],
    // 浏览历史表
    browse_history: [
      {
        name: 'openid_createTime',
        unique: false,
        keys: [
          { name: '_openid', direction: '1' },
          { name: 'createTime', direction: '-1' }
        ]
      }
    ],
    // 标签表
    tags: [
      {
        name: 'type_order',
        unique: false,
        keys: [
          { name: 'type', direction: '1' },
          { name: 'order', direction: '1' }
        ]
      },
      {
        name: 'name_unique',
        unique: true, 
        keys: [
          { name: 'name', direction: '1' }
        ]
      }
    ],
    // 分类表
    categories: [
      {
        name: 'type_order',
        unique: false,
        keys: [
          { name: 'type', direction: '1' },
          { name: 'order', direction: '1' }
        ]
      },
      {
        name: 'name_unique',
        unique: true,
        keys: [
          { name: 'name', direction: '1' }
        ]
      }
    ],
    // 轮播图表
    banners: [
      {
        name: 'status_sort',
        unique: false,
        keys: [
          { name: 'status', direction: '1' },
          { name: 'sort', direction: '1' }
        ]
      }
    ],
    // 首页板块配置表
    home_sections: [
      {
        name: 'enable_sort',
        unique: false,
        keys: [
          { name: 'enable', direction: '1' },
          { name: 'sort', direction: '1' }
        ]
      }
    ]
  }

  try {
    for (const collectionName in indexes) {
      const collectionIndexes = indexes[collectionName]
      
      // 尝试创建集合
      try {
        await db.createCollection(collectionName).catch(() => {})
      } catch(e) {}

      for (const indexDef of collectionIndexes) {
        try {
          // 使用 cloud.openapi.cloudbase.databaseCreateIndex (如果不受支持则回退)
          // 注意：openapi 调用可能需要权限，且只能在云函数中调用
          // 这里的 keys 格式需要转换为 openapi 要求的格式
          
          await cloud.openapi.cloudbase.databaseCreateIndex({
            env: ENV,
            collectionName: collectionName,
            indexes: [
              {
                name: indexDef.name,
                unique: indexDef.unique,
                keys: indexDef.keys
              }
            ]
          })
          
          result.success.push(`${collectionName}.${indexDef.name}`)
        } catch (err) {
           if (err.errCode === -501000 || (err.errMsg && err.errMsg.includes('exist'))) {
              result.success.push(`${collectionName}.${indexDef.name} (exists)`)
           } else {
              console.error(`创建索引失败: ${collectionName}.${indexDef.name}`, err)
              result.failed.push({
                index: `${collectionName}.${indexDef.name}`,
                error: err.errMsg || err.message
              })
              if ((err.errMsg && err.errMsg.includes('INVALID_WX_ACCESS_TOKEN')) || (err.message && err.message.includes('INVALID_WX_ACCESS_TOKEN'))) {
                result.manualRequired = true
              }
           }
        }
      }
    }
    
    if (result.manualRequired) {
      result.suggestions = indexes
    }
    return result

  } catch (err) {
    console.error('执行索引更新脚本失败', err)
    return {
      success: result.success,
      failed: result.failed,
      error: err.message,
      manualRequired: true
    }
  }
}
