/**
 * 测试 CI 图片处理 URL 生成
 * 用于调试 imageMogr2 参数格式问题
 * 
 * 根据 TCB 官方文档：https://docs.cloudbase.net/storage/extension
 * 正确格式：tempUrl&imageMogr2/thumbnail/500x/format/webp/quality/80
 * 不需要 URL 编码，不需要 = 号
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  const { testUrl } = event

  if (!testUrl) {
    return {
      success: false,
      message: '请提供 testUrl 参数（cloud:// 链接）'
    }
  }

  try {
    // 1. 生成临时签名 URL
    const result = await cloud.getTempFileURL({
      fileList: [testUrl],
      maxAge: 7200
    })

    if (!result.fileList || result.fileList.length === 0) {
      return {
        success: false,
        message: '生成临时 URL 失败',
        detail: result
      }
    }

    const fileInfo = result.fileList[0]
    const tempUrl = fileInfo.tempFileURL

    if (!tempUrl) {
      return {
        success: false,
        message: '临时 URL 为空',
        fileInfo
      }
    }

    // 2. 提取文件路径
    const cloudPrefix = 'cloud://'
    const pathWithoutPrefix = testUrl.slice(cloudPrefix.length)
    const firstSlash = pathWithoutPrefix.indexOf('/')
    const filePath = firstSlash === -1 ? pathWithoutPrefix : pathWithoutPrefix.slice(firstSlash + 1)

    // 3. 测试不同的 imageMogr2 参数格式
    const tests = []

    // 格式 1: 只缩放（官方推荐格式）
    tests.push({
      name: '只缩放 (thumbnail/500x)',
      params: 'imageMogr2/thumbnail/500x',
      url: `${tempUrl}&imageMogr2/thumbnail/500x`,
      isRecommended: true
    })

    // 格式 2: 缩放 + 质量
    tests.push({
      name: '缩放 + 质量 (thumbnail/500x/quality/80)',
      params: 'imageMogr2/thumbnail/500x/quality/80',
      url: `${tempUrl}&imageMogr2/thumbnail/500x/quality/80`
    })

    // 格式 3: 缩放 + 转 WebP
    tests.push({
      name: '缩放 + 转 WebP (thumbnail/500x/format/webp)',
      params: 'imageMogr2/thumbnail/500x/format/webp',
      url: `${tempUrl}&imageMogr2/thumbnail/500x/format/webp`
    })

    // 格式 4: 缩放 + 转 WebP + 质量（当前代码使用的格式）
    tests.push({
      name: '缩放 + 转 WebP + 质量 (推荐)',
      params: 'imageMogr2/thumbnail/500x/format/webp/quality/80',
      url: `${tempUrl}&imageMogr2/thumbnail/500x/format/webp/quality/80`,
      isRecommended: true
    })

    // 格式 5: 错误格式 - URL 编码
    const encodedParams = encodeURIComponent('imageMogr2/thumbnail/500x/format/webp/quality/80')
    tests.push({
      name: '错误格式：URL 编码',
      params: 'imageMogr2/thumbnail/500x/format/webp/quality/80',
      url: `${tempUrl}&imageMogr2=${encodedParams}`,
      isError: true
    })

    return {
      success: true,
      testUrl,
      tempUrl,
      filePath,
      tests,
      usage: '请在浏览器中打开 tests[].url 进行测试，看哪个能正常返回图片',
      note: '临时 URL 有效期 2 小时，请及时测试'
    }

  } catch (error) {
    return {
      success: false,
      message: error.message,
      stack: error.stack
    }
  }
}
