// 云函数入口文件 - updateProfile
const cloud = require('wx-server-sdk');

cloud.init({
  env: 'missonce-gif-d1gbetd1qd1646e8d'
});

const db = cloud.database();

/**
 * 云函数：更新用户资料
 * @param {object} event
 * @param {string} event.nickName - 用户昵称
 * @param {string} event.avatarUrl - 用户头像
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!openid) {
    return {
      success: false,
      error: '未获取到用户身份'
    };
  }

  try {
    const { nickName, avatarUrl } = event;
    
    const userCollection = db.collection('users');
    const result = await userCollection.where({ openid }).update({
      data: {
        nickName: nickName || '',
        avatarUrl: avatarUrl || '',
        updateTime: db.serverDate()
      }
    });

    return {
      success: true,
      updated: result.stats.updated
    };
  } catch (err) {
    console.error('[UpdateProfile] 更新失败:', err);
    return {
      success: false,
      error: err.message || '更新失败'
    };
  }
};
