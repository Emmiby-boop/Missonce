import { getStorageAsync, setStorage } from '../storageManager'

/**
 * 首页数据刷新回调
 */
let _homeDataRefreshCallback = null

export const onHomeDataRefresh = (callback) => {
  _homeDataRefreshCallback = callback
  return () => {
    _homeDataRefreshCallback = null
  }
}

const _fetchHomeDataFromCloud = () => {
  return new Promise((resolve) => {
    wx.cloud.getTempFileURL({
      fileList: ['cloud://missonce-99-1gfaff6n002f6ac1.6d69-missonce-99-1gfaff6n002f6ac1-1318542519/miniprogram/home/home_prebuilt_v1.json']
    }).then(res => {
      if (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) {
        const tempUrl = res.fileList[0].tempFileURL
        console.log('[API] 云存储 CDN 链接获取成功:', tempUrl)
        wx.request({
          url: tempUrl,
          dataType: 'json',
          success: (reqRes) => {
            if (reqRes.data && reqRes.data.success) {
              console.log('[API] 云存储直连成功，跳过 callFunction 链路')
              resolve({ result: reqRes.data })
            } else {
              console.warn('[API] 云存储返回数据异常')
              resolve(null)
            }
          },
          fail: (err) => {
            console.warn('[API] 云存储 wx.request 失败:', err)
            resolve(null)
          }
        })
      } else {
        console.warn('[API] 云存储文件不存在，降级')
        resolve(null)
      }
    }).catch((err) => {
      console.warn('[API] getTempFileURL 失败，降级:', err)
      resolve(null)
    })
  })
}

export const getHomeData = async () => {
  const cacheKey = 'home_data_api_cache'
  const now = Date.now()

  // 异步读取缓存
  const cached = await getStorageAsync(cacheKey)
  if (cached && cached.expire > now) {
    console.log('[API] 使用本地缓存: getHomeData')
    return cached.data
  }

  const res = await _fetchHomeDataFromCloud()
  if (res) {
    if (res.result && res.result.success) {
      setStorage(cacheKey, {
        data: res,
        expire: now + 10 * 60 * 1000
      })
      console.log('[API] 已缓存: getHomeData')
      if (_homeDataRefreshCallback) {
        _homeDataRefreshCallback(res)
      }
    }
    return res
  }

  console.log('[API] 云存储直连失败，降级使用云函数 getHomeData')
  const funcRes = await wx.cloud.callFunction({
    name: 'getHomeData'
  })
  
  if (!funcRes) {
    return { result: { success: false, message: '获取首页数据失败' } }
  }
  console.log('[API] getHomeData 返回结果:', funcRes)
  if (funcRes.result && funcRes.result.success) {
    setStorage(cacheKey, {
      data: funcRes,
      expire: now + 10 * 60 * 1000
    })
    console.log('[API] 已缓存: getHomeData')
    if (_homeDataRefreshCallback) {
      _homeDataRefreshCallback(funcRes)
    }
  }
  return funcRes
}

/**
 * 获取页面板块配置（通用）
 */
export const getPageSections = async (page = 'home') => {
  const cacheKey = `page_sections_cache_${page}`
  const now = Date.now()
  
  const cached = await getStorageAsync(cacheKey)
  if (cached && cached.expire > now) {
    return cached.data
  }
  
  const res = await wx.cloud.callFunction({
    name: 'getPageSections',
    data: { page }
  })
  
  setStorage(cacheKey, {
    data: res,
    expire: now + 10 * 60 * 1000
  })
  return res
}

/**
 * 获取轮播图
 */
export const getBanners = async (status = 'active') => {
  const cacheKey = `banners_cache_${status}`
  const now = Date.now()
  
  const cached = await getStorageAsync(cacheKey)
  if (cached && cached.data && cached.expire > now) {
    return cached.data
  }

  try {
    const res = await wx.cloud.callFunction({
      name: 'getBanners',
      data: { status }
    })
    if (res.result && res.result.success) {
      const data = res.result.data
      setStorage(cacheKey, {
        data,
        expire: now + 5 * 60 * 1000
      })
      return data
    }
    throw new Error('云函数返回失败')
  } catch (e) {
    console.warn('云函数获取轮播图失败，尝试降级查库', e)
    const db = wx.cloud.database()
    const res = await db.collection('banners')
      .where({ status })
      .orderBy('sort', 'asc')
      .get()
    const data = res.data
    setStorage(cacheKey, {
      data,
      expire: now + 2 * 60 * 1000
    })
    return data
  }
}

/**
 * 获取每日精选
 */
export const getDailyPicks = async (date = '') => {
  try {
    const res = await wx.cloud.callFunction({
      name: 'getDailyPicks',
      data: { date }
    })
    
    if (res.result && res.result.success) {
      return res.result.data
    }
    throw new Error(res.result?.error || '获取每日精选失败')
  } catch (e) {
    console.error('获取每日精选失败:', e)
    return null
  }
}
