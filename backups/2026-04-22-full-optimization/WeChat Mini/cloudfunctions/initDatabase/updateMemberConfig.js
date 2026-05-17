const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

// 会员配置
exports.main = async (event, context) => {
  try {
    const { isAdmin } = event

    if (!isAdmin) {
      return { success: false, message: '需要管理员权限' }
    }

    // 会员等级配置
    const memberLevels = [
      {
        level: 'bronze',
        name: '铜卡会员',
        pointsRequired: 500,
        duration: 30 * 24 * 60 * 60 * 1000, // 30天
        features: [
          '每日免费下载次数 +1',
          '去广告',
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
          '去广告',
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
          '去广告',
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
          '去广告',
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
