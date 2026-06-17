// 云函数入口文件 - syncHistory
const cloud = require('wx-server-sdk');

cloud.init({
  env: 'missonce-gif-d1gbetd1qd1646e8d'
});

const db = cloud.database();
const _ = db.command;

/**
 * 云函数：同步历史记录
 * @param {object} event
 * @param {string} event.action - 'upload' 或 'download'
 * @param {Array} event.history - 历史记录列表（upload 时使用）
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
    const { action, history } = event;
    const historyCollection = db.collection('user_history');

    if (action === 'upload') {
      // 上传历史记录
      if (!history || !Array.isArray(history)) {
        return {
          success: false,
          error: '无效的历史记录数据'
        };
      }

      // 获取用户现有记录
      const existing = await historyCollection.where({ openid }).get();
      
      if (existing.data.length > 0) {
        if (history.length === 0) {
          // 客户端发来空列表 = 用户删除了所有记录，直接清空云端
          await historyCollection.doc(existing.data[0]._id).update({
            data: {
              history: [],
              updateTime: db.serverDate()
            }
          });
          console.log('[SyncHistory] 云端数据已清空');
        } else {
          // 客户端上传的是全量列表（含删除操作），直接覆盖云端
          await historyCollection.doc(existing.data[0]._id).update({
            data: {
              history: history.slice(0, 500),
              updateTime: db.serverDate()
            }
          });
        }
      } else {
        // 创建新记录
        if (history.length > 0) {
          await historyCollection.add({
            data: {
              openid,
              history: history.slice(0, 500),
              createTime: db.serverDate(),
              updateTime: db.serverDate()
            }
          });
        }
      }

      console.log('[SyncHistory] 上传成功，记录数:', history.length);
      return { success: true };

    } else if (action === 'download') {
      // 下载历史记录
      const result = await historyCollection.where({ openid }).get();
      
      if (result.data.length > 0) {
        return {
          success: true,
          data: {
            history: result.data[0].history || []
          }
        };
      }
      
      return {
        success: true,
        data: { history: [] }
      };

    } else {
      return {
        success: false,
        error: '无效的操作类型'
      };
    }
  } catch (err) {
    console.error('[SyncHistory] 云函数执行失败:', err);
    return {
      success: false,
      error: err.message || '同步失败'
    };
  }
};

/**
 * 合并历史记录（去重）
 */
function mergeHistory(localList, cloudList) {
  const merged = new Map();
  
  localList.forEach(item => {
    const key = item.video_id || item.url || '';
    if (key) merged.set(key, item);
  });
  
  cloudList.forEach(item => {
    const key = item.video_id || item.url || '';
    if (key) {
      const existing = merged.get(key);
      if (!existing || (item.timestamp || 0) > (existing.timestamp || 0)) {
        merged.set(key, item);
      }
    }
  });
  
  return Array.from(merged.values())
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}
