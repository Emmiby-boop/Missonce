const cloud = require('wx-server-sdk')

cloud.init({
  env: 'missonce-99-1gfaff6n002f6ac1'
})

const db = cloud.database()

async function init() {
  try {
    console.log('初始化数据库...')
    
    // 初始化相关集合
    const collections = ['download_records', 'member_records', 'share_records', 'user_points', 'member_levels', 'system_configs']
    
    for (const collectionName of collections) {
      try {
        await db.collection(collectionName).get()
        console.log(`${collectionName} 集合创建成功`)
      } catch (e) {
        console.log(`${collectionName} 集合操作失败:`, e.message)
      }
    }
    
    // 初始化积分系统配置
    const pointsConfigRes = await db.collection('system_configs').where({ category: 'points' }).get()
    if (pointsConfigRes.data.length === 0) {
      const configs = [
        { key: 'checkInPoints', value: 10, description: '每日签到基础积分', type: 'number' },
        { key: 'checkInBonus', value: 30, description: '连续签到7天奖励', type: 'number' },
        { key: 'checkInMaxBonus', value: 100, description: '连续签到30天奖励', type: 'number' },
        { key: 'sharePoints', value: 10, description: '分享获得积分', type: 'number' },
        { key: 'shareDailyLimit', value: 5, description: '每日分享上限次数', type: 'number' },
        { key: 'invitePoints', value: 50, description: '邀请新用户奖励积分', type: 'number' },
        { key: 'downloadPoints', value: 15, description: '下载消耗积分', type: 'number' },
        { key: 'dailyFreeDownload', value: 1, description: '每日免费下载次数', type: 'number' },
        { key: 'memberBronzePoints', value: 500, description: '铜卡会员所需积分', type: 'number' },
        { key: 'memberSilverPoints', value: 1200, description: '银卡会员所需积分', type: 'number' },
        { key: 'memberGoldPoints', value: 2500, description: '金卡会员所需积分', type: 'number' },
        { key: 'memberDiamondPoints', value: 5000, description: '钻石会员所需积分', type: 'number' }
      ]
      
      for (const config of configs) {
        await db.collection('system_configs').add({
          data: {
            category: 'points',
            ...config,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate()
          }
        })
      }
      console.log('积分系统配置初始化成功')
    }
    
    console.log('数据库初始化完成')
  } catch (error) {
    console.error('初始化失败:', error)
  }
}

init()
