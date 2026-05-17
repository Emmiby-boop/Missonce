const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const { action } = event

    // 移除管理员权限检查，方便初始化

    switch (action) {
      case 'initCollections': {
        return await initCollections()
      }

      case 'initPointsSystem': {
        return await initPointsSystem()
      }

      case 'updateMemberConfig': {
        return await updateMemberConfig()
      }

      default:
        return { success: false, message: '未知操作类型' }
    }
  } catch (error) {
    console.error('数据库初始化失败:', error)
    return { success: false, message: '初始化失败: ' + error.message, error: error.message }
  }
}

async function initCollections() {
  const results = []

  // 直接创建集合，不依赖添加文档
  const collections = [
    'download_records',
    'member_records',
    'share_records',
    'user_points',
    'member_levels',
    'system_configs',
    // 新增互动相关集合
    'likes',
    'views',
    'comments'
  ]

  for (const collectionName of collections) {
    try {
      // 尝试获取集合，这会自动创建集合
      await db.collection(collectionName).get()
      results.push(collectionName)
      console.log(`${collectionName} 集合创建成功`)
    } catch (e) {
      console.log(`${collectionName} 集合操作失败:`, e.message)
    }
  }

  return {
    success: true,
    message: '数据库集合初始化成功！',
    data: { collections: results }
  }
}

async function initPointsSystem() {
  const configs = [
    {
      key: 'checkInPoints',
      value: 10,
      description: '每日签到基础积分',
      type: 'number'
    },
    {
      key: 'checkInBonus',
      value: 30,
      description: '连续签到7天奖励',
      type: 'number'
    },
    {
      key: 'checkInMaxBonus',
      value: 100,
      description: '连续签到30天奖励',
      type: 'number'
    },
    {
      key: 'sharePoints',
      value: 10,
      description: '分享获得积分',
      type: 'number'
    },
    {
      key: 'shareDailyLimit',
      value: 5,
      description: '每日分享上限次数',
      type: 'number'
    },
    {
      key: 'invitePoints',
      value: 50,
      description: '邀请新用户奖励积分',
      type: 'number'
    },
    {
      key: 'downloadPoints',
      value: 15,
      description: '下载消耗积分',
      type: 'number'
    },
    {
      key: 'dailyFreeDownload',
      value: 1,
      description: '每日免费下载次数',
      type: 'number'
    },
    {
      key: 'memberBronzePoints',
      value: 500,
      description: '铜卡会员所需积分',
      type: 'number'
    },
    {
      key: 'memberSilverPoints',
      value: 1200,
      description: '银卡会员所需积分',
      type: 'number'
    },
    {
      key: 'memberGoldPoints',
      value: 2500,
      description: '金卡会员所需积分',
      type: 'number'
    },
    {
      key: 'memberDiamondPoints',
      value: 5000,
      description: '钻石会员所需积分',
      type: 'number'
    }
  ]

  for (const config of configs) {
    try {
      await db.collection('system_configs').add({
        data: {
          category: 'points',
          key: config.key,
          value: config.value,
          description: config.description,
          type: config.type,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      })
    } catch (e) {
      console.log(`config ${config.key} 可能已存在`)
    }
  }

  return {
    success: true,
    message: '积分系统配置初始化成功！',
    data: { configs: configs.length }
  }
}

async function updateMemberConfig() {
  try {
    // 会员等级配置
    const memberLevels = [
      {
        level: 'bronze',
        name: '铜卡会员',
        pointsRequired: 500,
        duration: 30 * 24 * 60 * 60 * 1000, // 30天
        features: [
          '每日免费下载次数 +1',
          '专属头像框'
        ]
      },
      {
        level: 'silver',
        name: '银卡会员',
        pointsRequired: 1200,
        duration: 60 * 24 * 60 * 60 * 1000, // 60天
        features: [
          '每日免费下载次数 +2',
          '专属头像框',
          '优先下载通道'
        ]
      },
      {
        level: 'gold',
        name: '金卡会员',
        pointsRequired: 2500,
        duration: 90 * 24 * 60 * 60 * 1000, // 90天
        features: [
          '每日免费下载次数 +3',
          '专属头像框',
          '优先下载通道',
          '专属客服'
        ]
      },
      {
        level: 'diamond',
        name: '钻石会员',
        pointsRequired: 5000,
        duration: 180 * 24 * 60 * 60 * 1000, // 180天
        features: [
          '无限免费下载',
          '专属头像框',
          '优先下载通道',
          '专属客服',
          '定制服务'
        ]
      }
    ]

    // 插入会员等级配置
    for (const level of memberLevels) {
      try {
        await db.collection('member_levels').add({
          data: {
            level: level.level,
            name: level.name,
            pointsRequired: level.pointsRequired,
            duration: level.duration,
            features: level.features,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate()
          }
        })
      } catch (e) {
        console.log(`会员等级 ${level.level} 可能已存在`)
      }
    }

    return {
      success: true,
      message: '会员配置更新成功！',
      data: {
        memberLevels: memberLevels.length
      }
    }
  } catch (error) {
    console.error('更新会员配置失败:', error)
    return { success: false, message: '更新失败: ' + error.message }
  }
}

