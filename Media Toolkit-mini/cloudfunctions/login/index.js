// 云函数入口文件 - login
const cloud = require('wx-server-sdk');

cloud.init({
  env: 'missonce-gif-d1gbetd1qd1646e8d'
});

const db = cloud.database();

/**
 * 云函数：用户登录
 * 自动从 cloud.getWXContext() 获取 openid
 * @returns {object} 登录结果
 */
exports.main = async (event, context) => {
  try {
    // 使用 code 换取 openid（云函数自动获取）
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const unionid = wxContext.UNIONID || '';

    if (!openid) {
      return {
        success: false,
        error: '获取 openid 失败'
      };
    }

    // 查询用户是否已存在
    const userCollection = db.collection('users');
    const userResult = await userCollection.where({ openid }).get();
    
    let userInfo = {};
    
    if (userResult.data.length > 0) {
      // 用户已存在，更新登录时间
      userInfo = userResult.data[0];
      await userCollection.doc(userInfo._id).update({
        data: {
          lastLoginTime: db.serverDate(),
          loginCount: db.command.inc(1)
        }
      });
      console.log('[Login] 用户已存在，更新登录时间');
    } else {
      // 新用户，创建记录
      const newUser = {
        openid,
        unionid,
        nickName: '',
        avatarUrl: '',
        createTime: db.serverDate(),
        lastLoginTime: db.serverDate(),
        loginCount: 1
      };
      
      const addResult = await userCollection.add({ data: newUser });
      userInfo = { _id: addResult._id, ...newUser };
      console.log('[Login] 新用户创建成功');
    }

    return {
      success: true,
      data: {
        openid,
        userInfo: {
          _id: userInfo._id,
          nickName: userInfo.nickName,
          avatarUrl: userInfo.avatarUrl
        }
      }
    };
  } catch (err) {
    console.error('[Login] 云函数执行失败:', err);
    return {
      success: false,
      error: err.message || '登录失败'
    };
  }
};
