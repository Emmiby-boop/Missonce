const cloud = require('wx-server-sdk')
const https = require('https')
const url = require('url')

// 默认 AI 配置 (兜底 - 实际配置请在数据库 sys_config/ai_config 中管理)
let QWEN_CONFIG = {
  API_KEY: process.env.QWEN_API_KEY || '', 
  MODEL: 'qwen-vl-plus', // 默认使用更快的 plus 模型
  API_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
};

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 合法主分类白名单 (默认空 - 实际配置请在数据库 sys_config/categories_whitelist 中管理)
let VALID_CATEGORIES = new Set(['其他']);

// 默认标签白名单 (默认空 - 实际配置请在数据库 sys_config/tags_whitelist 中管理)
let VALID_TAGS_WHITELIST = new Set([]);

// 默认 AI 提示词 (空)
let AI_SYSTEM_PROMPT = '';

// 加载数据库配置
async function loadConfig() {
  try {
    const aiConfigRes = await db.collection('sys_config').doc('ai_config').get().catch(() => null);
    if (aiConfigRes && aiConfigRes.data) {
      // 支持数据库字段名带空格或不带空格的情况
      QWEN_CONFIG = {
        API_KEY: aiConfigRes.data['API KEY'] || aiConfigRes.data.API_KEY || QWEN_CONFIG.API_KEY,
        MODEL: aiConfigRes.data.MODEL || QWEN_CONFIG.MODEL,
        API_URL: aiConfigRes.data['API URL'] || aiConfigRes.data.API_URL || QWEN_CONFIG.API_URL
      };
      
      if (aiConfigRes.data.SYSTEM_PROMPT) {
        AI_SYSTEM_PROMPT = aiConfigRes.data.SYSTEM_PROMPT;
      }
      console.log('已从数据库加载 AI 配置:', { model: QWEN_CONFIG.MODEL, url: QWEN_CONFIG.API_URL });
    }

    const tagsConfigRes = await db.collection('sys_config').doc('tags_whitelist').get().catch(() => null);
    if (tagsConfigRes && tagsConfigRes.data && Array.isArray(tagsConfigRes.data.tags)) {
      VALID_TAGS_WHITELIST = new Set(tagsConfigRes.data.tags);
    }

    const catsConfigRes = await db.collection('sys_config').doc('categories_whitelist').get().catch(() => null);
    if (catsConfigRes && catsConfigRes.data && Array.isArray(catsConfigRes.data.categories)) {
      VALID_CATEGORIES = new Set(catsConfigRes.data.categories);
    }
  } catch (err) {
    console.error('加载系统配置失败，使用默认配置:', err);
  }
}

// 调用通义千问 AI 进行视觉识别
async function analyzeImageWithQwen(imageUrl, type, filename = '') {
  if (!QWEN_CONFIG.API_KEY) {
    console.log('通义千问 API Key 未配置，跳过 AI 识别');
    return null;
  }

  try {
    // 缩略图处理：添加云存储缩略图参数，减少传输量，加速识别
    // 假设 imageUrl 是 HTTP 链接，如果支持 CDN 参数，加上 /thumbnail/800x
    // 这里简单处理，如果 URL 包含 tcb.qcloud.la 或 myqcloud.com，尝试加参数
    let processUrl = imageUrl;
    if ((imageUrl.includes('tcb.qcloud.la') || imageUrl.includes('myqcloud.com')) && !imageUrl.includes('?')) {
        // 使用 /thumbnail/800x 进行压缩 (适用于 COS)
        // 注意：具体规则需根据云存储配置，这里尝试通用的万象优图参数或 cloudbase 缩放
        // 为了稳妥，暂时不加后缀，依赖 AI 模型本身的处理能力，或者在获取 tempFileURL 时指定 rule
    }

    console.log('开始调用通义千问 AI 进行识别...', { model: QWEN_CONFIG.MODEL, url: processUrl, type });

    const postData = JSON.stringify({
      model: QWEN_CONFIG.MODEL,
      messages: [
        {
          role: "system",
          content: AI_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: [
            { type: "text", text: `图片文件名/标题: "${filename}"。\n用户上传时的选择类型是: ${type || '未指定'}。\n请分析这张图片，严格区分【头像】和【壁纸】。如果是静态图片(jpg/png)，绝对不要标记为"动态头像"。\n\n另外，请识别图片的主色调，从以下颜色中选择最接近的1-3个：红色、橙色、黄色、绿色、青色、蓝色、紫色、粉色、黑色、白色。` },
            {
              type: "image_url",
              image_url: {
                "url": processUrl
              }
            }
          ]
        }
      ],
      stream: false
    });

    const responseData = await new Promise((resolve, reject) => {
      const parsedUrl = url.parse(QWEN_CONFIG.API_URL);
      const req = https.request({
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${QWEN_CONFIG.API_KEY}`,
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 60000 // 60 秒超时 (异步任务可以更久)
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Qwen API request timed out (60s)'));
      });
      
      req.on('error', (e) => reject(e));
      req.write(postData);
      req.end();
    });

    if (responseData.statusCode !== 200) {
      throw new Error(`Qwen API request failed: ${responseData.statusCode} ${responseData.body}`);
    }

    const data = JSON.parse(responseData.body);
    const content = data.choices[0].message.content;
    
    // 尝试解析 JSON
    let jsonStr = content;
    if (content.includes('```json')) {
      jsonStr = content.split('```json')[1].split('```')[0].trim();
    } else if (content.includes('```')) {
      jsonStr = content.split('```')[1].split('```')[0].trim();
    }
    
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }
    
    const result = JSON.parse(jsonStr);
    console.log('通义千问 AI 识别解析结果:', result);
    return result;

  } catch (err) {
    console.error('通义千问 AI 识别发生错误:', err.message);
    return null;
  }
}

exports.main = async (event, context) => {
  // 加载配置
  await loadConfig();

  // 1. 获取参数 (支持直接调用 或 数据库触发器)
  let resourceId = null;
  let triggerType = 'manual';

  if (event.id) {
    resourceId = event.id;
  } else if (event.data && event.data._id) {
    // 数据库触发器结构
    resourceId = event.data._id;
    triggerType = 'database';
  }

  if (!resourceId) {
    return { success: false, message: '缺少资源 ID' };
  }

  console.log(`开始处理资源分析任务: ${resourceId} (触发方式: ${triggerType})`);

  try {
    // 2. 获取资源详情
    const resData = await db.collection('resources').doc(resourceId).get();
    if (!resData.data) throw new Error('资源不存在');
    
    const resource = resData.data;
    
    // 检查是否需要分析 (例如已经有 AI 分析结果，或者是手动跳过的)
    // 如果是 create 触发，或者 status 是 analyzing，则进行分析
    // 这里简单策略：只要调用了就尝试分析，除非 skipAI 为 true
    if (resource.skipAI) {
      console.log('资源标记为跳过 AI，结束任务');
      return { success: true, message: 'Skipped' };
    }

    const currentUrl = resource.originUrl || resource.coverUrl;
    if (!currentUrl) {
       throw new Error('资源没有图片链接');
    }

    // 3. 获取临时链接
    let imageUrlForAI = currentUrl;
    if (currentUrl.startsWith('cloud://')) {
        const fileRes = await cloud.getTempFileURL({
           fileList: [currentUrl]
        });
        if (fileRes.fileList && fileRes.fileList[0].tempFileURL) {
           imageUrlForAI = fileRes.fileList[0].tempFileURL;
        } else {
           throw new Error('无法获取云文件临时链接');
        }
    }

    // 4. 执行 AI 分析
    const aiResult = await analyzeImageWithQwen(imageUrlForAI, resource.type, resource.title);
    
    if (!aiResult) {
       // 分析失败，标记状态为 published (虽然没有AI标签，但也让它可用)
       // 或者标记为 ai_failed
       await db.collection('resources').doc(resourceId).update({
         data: {
           aiStatus: 'failed',
           updatedAt: db.serverDate()
         }
       });
       return { success: false, message: 'AI 分析无结果' };
    }

    // 5. 处理结果
    const newTags = aiResult.tags || [];
    let newCategories = [];
    if (aiResult.categories && Array.isArray(aiResult.categories)) {
        newCategories = aiResult.categories;
    } else if (aiResult.category) {
        newCategories = [aiResult.category];
    }

    // 严格校验主分类
    newCategories = newCategories.filter(c => VALID_CATEGORIES.has(c));
    if (newCategories.length === 0) {
        newCategories.push('其他');
    }

    // GIF 修正
    if (resource.type === 'avatar' && (currentUrl.toLowerCase().endsWith('.gif') || aiResult.detected_type === 'dynamic_avatar')) {
        if (!newCategories.includes('动态头像')) {
            newCategories.push('动态头像');
        }
    }
    
    // 直接使用新识别的标签和分类（覆盖模式）
    const finalTags = [...new Set(newTags)];
    const finalCategories = [...new Set(newCategories)];
    
    let updateData = {
      tags: finalTags,
      categories: finalCategories,
      aiAnalysis: aiResult,
      aiStatus: 'success', // 标记 AI 分析成功
      updatedAt: db.serverDate()
    };
    
    if (aiResult.colors && Array.isArray(aiResult.colors)) {
      updateData.colors = aiResult.colors;
    }
    
    // 自动修正主分类
    if (!resource.category && finalCategories.length > 0) {
      updateData.category = finalCategories[0];
    }
    
    // 自动修正类型 (如果 AI 判定不同且原类型为 auto)
    if (aiResult.detected_type && (!resource.type || resource.type === 'auto')) {
        updateData.type = aiResult.detected_type;
    }

    // 6. 更新资源
    await db.collection('resources').doc(resourceId).update({ data: updateData });

    // 7. 异步同步分类和标签 (不等待)
    syncCategoriesAndTags(finalCategories, finalTags, updateData.type || resource.type);

    return { success: true, message: 'AI 分析完成并更新' };

  } catch (err) {
    console.error('分析任务失败:', err);
    return { success: false, error: err.message };
  }
}

async function syncCategoriesAndTags(categories, tags, type) {
    // 自动同步新分类
    for (const catName of categories) {
        if (!catName) continue;
        try {
            const c = await db.collection('categories').where({ name: catName }).count();
            if (c.total === 0) {
                await db.collection('categories').add({
                    data: { name: catName, type, visible: true, createdAt: db.serverDate() }
                });
            }
        } catch(e) {}
    }
    // 自动同步新标签
    for (const tagName of tags) {
        if (!tagName) continue;
        if (!VALID_TAGS_WHITELIST.has(tagName)) continue;
        try {
            const c = await db.collection('tags').where({ name: tagName, type }).count();
            if (c.total === 0) {
                await db.collection('tags').add({
                    data: { name: tagName, type, visible: true, createdAt: db.serverDate() }
                });
            }
        } catch(e) {}
    }
}