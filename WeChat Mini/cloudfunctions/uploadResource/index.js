const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 加载数据库配置
let VALID_CATEGORIES = new Set(['其他']);
let VALID_TAGS_WHITELIST = new Set([]);

async function loadConfig() {
  try {
    const tagsConfigRes = await db.collection('sys_config').doc('tags_whitelist').get().catch(() => null);
    if (tagsConfigRes && tagsConfigRes.data && Array.isArray(tagsConfigRes.data.tags)) {
      VALID_TAGS_WHITELIST = new Set(tagsConfigRes.data.tags);
      console.log('已从数据库加载标签白名单，数量:', tagsConfigRes.data.tags.length);
    }

    const catsConfigRes = await db.collection('sys_config').doc('categories_whitelist').get().catch(() => null);
    if (catsConfigRes && catsConfigRes.data && Array.isArray(catsConfigRes.data.categories)) {
      VALID_CATEGORIES = new Set(catsConfigRes.data.categories);
      console.log('已从数据库加载分类白名单，数量:', catsConfigRes.data.categories.length);
    }
  } catch (err) {
    console.error('加载系统配置失败，使用默认配置:', err);
  }
}

// 微信内容安全校验
async function checkImageSecurity(imageUrl, addLog) {
  try {
    // 仅针对云存储文件进行校验
    if (!imageUrl || !imageUrl.startsWith('cloud://')) {
      return true;
    }
    
    addLog('开始内容安全校验', imageUrl);

    // 1. 下载文件
    const fileRes = await cloud.downloadFile({
      fileID: imageUrl
    });
    const buffer = fileRes.fileContent;
    
    // 2. 校验大小 (imgSecCheck 限制 1MB)
    if (buffer.length > 1024 * 1024) {
      addLog('图片超过1MB，跳过同步校验');
      return true;
    }

    // 3. 调用微信安全接口
    const result = await cloud.openapi.security.imgSecCheck({
      media: {
        contentType: 'image/png', // 默认类型，微信会自动识别
        value: buffer
      }
    });

    if (result && result.errCode === 0) {
      addLog('内容安全校验通过');
      return true;
    } else {
      throw new Error('内容包含违规信息');
    }
  } catch (err) {
    // 87014: 内容含有违法违规内容
    if (err.errCode === 87014) {
      throw new Error('图片内容违规，请重新上传');
    }
    // 其他错误(如调用频率限制)，暂时放行但记录
    addLog('安全校验异常(放行):', err);
    return true;
  }
}

exports.main = async (event) => {
  // 预加载配置
  await loadConfig();

  const { 
    type, 
    title, 
    category, 
    categories = [], 
    tags = [], 
    coverUrl, 
    originUrl,
    hotScore = 0,
    status = 'published',
    action, // 新增参数
    id,     // 新增参数
    skipAI  // 新增参数
  } = event

  const logs = []
  const addLog = (msg, data) => {
    // 针对数据进行脱敏和长度限制，防止日志过大导致云函数返回失败
    let safeData = data;
    if (data && typeof data === 'object') {
        try {
            const str = JSON.stringify(data);
            if (str.length > 1000) {
                safeData = str.substring(0, 1000) + '... (truncated)';
            }
        } catch (e) {
            safeData = '[Circular or Unserializable Object]';
        }
    } else if (typeof data === 'string' && data.length > 1000) {
        safeData = data.substring(0, 1000) + '... (truncated)';
    }
    
    console.log(msg, safeData || '')
    logs.push({ msg, data: safeData })
  }

  addLog('uploadResource 接收参数:', {
    type,
    title,
    category,
    categories,
    tags,
    coverUrl,
    originUrl,
    hotScore,
    status,
    action,
    id,
    skipAI
  })

  
  // --- 模式 2: 仅进行 AI 识别并更新 (已废弃，直接转调用 analyzeResource) ---
  if (action === 'analyze' && id) {
    addLog('转发至 analyzeResource 函数处理', { id });
    return await cloud.callFunction({
        name: 'analyzeResource',
        data: { id }
    });
  }

  try {
    // 验证必填字段
    if (!title || !coverUrl) {
      return {
        success: false,
        message: '缺少必要参数 (title, coverUrl)',
        debugLogs: logs.map(l => l.msg)
      }
    }

    // 自动打标签逻辑
    let finalTags = [...tags]
    let finalType = type; // 默认为传入的 type
    let finalCategory = category;
    let finalCategories = [...categories];

    // 强制检测动态头像逻辑 (基于文件后缀)
    const isGif = coverUrl && coverUrl.toLowerCase().endsWith('.gif');
    if (isGif) {
        addLog('检测到 GIF 格式，强制标记为动态头像');
        if (!finalTags.includes('动态头像')) finalTags.push('动态头像');
        if (!finalCategories.includes('动态头像')) finalCategories.push('动态头像');
        finalType = 'avatar';
    }

    // 如果未指定类型，给个默认值 (防止插入失败)
    if (!finalType || finalType === 'auto') {
        finalType = 'wallpaper'; // 默认保底，后续 AI 会修正
    }
    
    // 去重
    finalCategories = [...new Set(finalCategories)].filter(Boolean);
    if (!finalCategory && finalCategories.length > 0) {
        finalCategory = finalCategories[0];
    }
    finalTags = [...new Set(finalTags)].filter(Boolean);

    addLog('初步分类:', finalCategories)
    addLog('初步标签:', finalTags)
    
    // 安全校验 (仅在发布/新增时校验)
    if (coverUrl) {
       await checkImageSecurity(coverUrl, addLog);
    }

    // 插入资源数据
    const res = await db.collection('resources').add({
      data: {
        type: finalType,
        title,
        category: finalCategory,
        categories: finalCategories,
        tags: finalTags,
        coverUrl,
        originUrl: originUrl || coverUrl,
        hotScore,
        downloads: 0,
        favorites: 0,
        status,
        aiStatus: 'pending', // 标记为等待 AI 分析
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    })

    addLog('资源上传成功，ID:', res._id)
    
    // 异步触发 AI 分析 (不等待结果)
    if (!skipAI) {
        cloud.callFunction({
            name: 'analyzeResource',
            data: { id: res._id }
        }).catch(err => {
            console.error('触发 AI 分析失败:', err);
        });
        addLog('已触发后台 AI 分析任务');
    }

    // 优化：并行处理分类和标签的同步，防止超时
    const syncTasks = [];

    // 自动同步新分类到 categories 集合（去重）
    if (finalCategories.length > 0) {
      for (const catName of finalCategories) {
        if (!catName) continue;
        syncTasks.push((async () => {
            try {
              const countRes = await db.collection('categories').where({ name: catName }).count();
              if (countRes.total === 0) {
                await db.collection('categories').add({
                  data: {
                    name: catName,
                    type: finalType,
                    order: 99,
                    visible: true,
                    createdAt: db.serverDate()
                  }
                });
                console.log(`自动创建新分类: ${catName}`);
              }
            } catch (e) {
              // 忽略非致命错误，不中断上传流程
              console.warn(`检查/创建分类警告: ${catName}`, e.message);
            }
        })());
      }
    }

    // 自动同步新标签到 tags 集合（去重）
    if (finalTags.length > 0) {
      for (const tagName of finalTags) {
        if (!tagName) continue;
        
        // 过滤：只有在白名单内的标签才会被添加到全局标签库
        if (!VALID_TAGS_WHITELIST.has(tagName)) continue;

        syncTasks.push((async () => {
            try {
              // 检查同类型下是否已存在该标签
              const countRes = await db.collection('tags').where({ 
                name: tagName,
                type: finalType 
              }).count();
              
              if (countRes.total === 0) {
                await db.collection('tags').add({
                  data: {
                    name: tagName,
                    type: finalType, // 存入标签所属类型
                    order: 99,
                    visible: true,
                    createdAt: db.serverDate()
                  }
                });
                console.log(`自动创建新标签: ${tagName} (类型: ${finalType})`);
              }
            } catch (e) {
               // 忽略非致命错误，不中断上传流程
              console.warn(`检查/创建标签警告: ${tagName}`, e.message);
            }
        })());
      }
    }
    
    // 等待所有同步任务完成，但加上超时保护（比如只等 3 秒，即使失败也不影响主流程）
    // 关键优化：不再 await Promise.race 阻塞返回，而是让它们在后台跑（虽然云函数环境可能会冻结，但通常能跑完小任务）
    // 或者如果必须等待，缩短超时时间
    try {
        await Promise.race([
            Promise.all(syncTasks),
            new Promise(r => setTimeout(r, 2000)) // 缩短为 2 秒，尽快返回前端
        ]);
    } catch (err) {
        console.warn('同步分类/标签超时', err.message);
    }
    
    // 简化返回日志，防止回包过大导致云函数报错
    // 移除详细日志返回，只返回关键信息
    
    return {
      success: true,
      data: res._id,
      // debugLogs: simpleLogs // 移除 debugLogs 以减少回包体积
    }
  } catch (error) {
    console.error('上传资源失败:', error)
    // 错误情况下也要简化日志
    const simpleLogs = logs.map(l => l.msg);
    return {
      success: false,
      message: '上传资源失败',
      error: error.message,
      debugLogs: simpleLogs
    }
  }
}
