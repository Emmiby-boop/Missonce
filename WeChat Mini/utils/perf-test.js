// 性能测试工具 - 启动自动运行
// 测试维度：启动速度 / 页面切换 / 网络请求 / 存储性能 / 缓存命中
// 运行环境：开发者工具模拟器 + 真机预览

import { ENV_ID } from '../config/constants.js'

// ============ 性能打点 ============
const marks = {}
const measures = {}

export const perf = {
  mark(name) {
    marks[name] = Date.now()
  },

  measure(name, startMark, endMark) {
    if (!marks[startMark] || !marks[endMark]) return -1
    const duration = marks[endMark] - marks[startMark]
    measures[name] = duration
    return duration
  },

  getMark(name) {
    return marks[name] || 0
  },

  getMeasure(name) {
    return measures[name] || 0
  },

  clear() {
    Object.keys(marks).forEach(k => delete marks[k])
    Object.keys(measures).forEach(k => delete measures[k])
  }
}

// ============ 测试套件 ============
const testResults = {
  device: null,
  startTime: 0,
  endTime: 0,
  tests: [],
  summary: {}
}

// 设备信息采集
async function collectDeviceInfo() {
  const sysInfo = wx.getSystemInfoSync()
  return {
    model: sysInfo.model,
    system: sysInfo.system,
    platform: sysInfo.platform,
    SDKVersion: sysInfo.SDKVersion,
    version: sysInfo.version,
    screenWidth: sysInfo.screenWidth,
    screenHeight: sysInfo.screenHeight,
    pixelRatio: sysInfo.pixelRatio,
    networkType: 'unknown'
  }
}

// 网络类型
function getNetworkType() {
  return new Promise(resolve => {
    wx.getNetworkType({
      success: res => resolve(res.networkType),
      fail: () => resolve('unknown')
    })
  })
}

// 单次测试计时器
class Timer {
  constructor(name) {
    this.name = name
    this.startTime = 0
    this.endTime = 0
  }

  start() {
    this.startTime = Date.now()
  }

  end() {
    this.endTime = Date.now()
    return this.endTime - this.startTime
  }

  result(category, value, unit = 'ms') {
    return {
      name: this.name,
      category,
      value,
      unit,
      timestamp: Date.now()
    }
  }
}

// ============ 测试用例 ============

// 1. 启动性能测试（被动采集，启动打点存于 app.globalData._perfLaunch / 首页打点在本模块）
function testStartupPerformance() {
  // 🔥 app.js 不再顶层 import 本模块（省启动解析），启动耗时从 globalData._perfLaunch 回读
  let launchStart = perf.getMark('launch_start')
  let launchEnd = perf.getMark('launch_end')
  try {
    const app = typeof getApp === 'function' ? getApp() : null
    const launchMem = app && app.globalData && app.globalData._perfLaunch
    if (launchMem && launchMem.start) launchStart = launchStart || launchMem.start
    if (launchMem && launchMem.end) launchEnd = launchEnd || launchMem.end
  } catch (e) {}
  const firstShow = perf.getMark('first_show')
  const firstDataReady = perf.getMark('first_data_ready')

  const results = []
  if (launchStart && launchEnd) {
    results.push({
      name: 'App.onLaunch 耗时',
      category: '启动',
      value: launchEnd - launchStart,
      unit: 'ms',
      timestamp: Date.now()
    })
  }
  if (launchStart && firstShow) {
    results.push({
      name: '首屏渲染（onLaunch→首页onShow）',
      category: '启动',
      value: firstShow - launchStart,
      unit: 'ms',
      timestamp: Date.now()
    })
  }
  if (launchStart && firstDataReady) {
    results.push({
      name: '首页数据就绪（onLaunch→列表数据）',
      category: '启动',
      value: firstDataReady - launchStart,
      unit: 'ms',
      timestamp: Date.now()
    })
  }
  return results
}

// 2. 存储性能测试
async function testStoragePerformance() {
  const results = []
  const testKey = 'perf_test_key'
  const testData = { a: 1, b: 'test', c: [1, 2, 3], d: { x: 1 } }

  // 同步写入 100 次
  let syncWriteStart = Date.now()
  for (let i = 0; i < 100; i++) {
    wx.setStorageSync(testKey + i, testData)
  }
  const syncWriteTime = Date.now() - syncWriteStart
  results.push({
    name: 'setStorageSync × 100',
    category: '存储-同步',
    value: syncWriteTime,
    unit: 'ms',
    timestamp: Date.now()
  })

  // 同步读取 100 次
  let syncReadStart = Date.now()
  for (let i = 0; i < 100; i++) {
    wx.getStorageSync(testKey + i)
  }
  const syncReadTime = Date.now() - syncReadStart
  results.push({
    name: 'getStorageSync × 100',
    category: '存储-同步',
    value: syncReadTime,
    unit: 'ms',
    timestamp: Date.now()
  })

  // 异步写入 100 次
  const asyncWriteStart = Date.now()
  await new Promise(resolve => {
    let count = 0
    const total = 100
    for (let i = 0; i < total; i++) {
      wx.setStorage({
        key: testKey + '_async' + i,
        data: testData,
        complete: () => {
          count++
          if (count === total) resolve()
        }
      })
    }
  })
  const asyncWriteTime = Date.now() - asyncWriteStart
  results.push({
    name: 'setStorage × 100（并发）',
    category: '存储-异步',
    value: asyncWriteTime,
    unit: 'ms',
    timestamp: Date.now()
  })

  // 异步读取 100 次
  const asyncReadStart = Date.now()
  await new Promise(resolve => {
    let count = 0
    const total = 100
    for (let i = 0; i < total; i++) {
      wx.getStorage({
        key: testKey + '_async' + i,
        complete: () => {
          count++
          if (count === total) resolve()
        }
      })
    }
  })
  const asyncReadTime = Date.now() - asyncReadStart
  results.push({
    name: 'getStorage × 100（并发）',
    category: '存储-异步',
    value: asyncReadTime,
    unit: 'ms',
    timestamp: Date.now()
  })

  // 清理测试数据
  for (let i = 0; i < 100; i++) {
    wx.removeStorageSync(testKey + i)
    wx.removeStorageSync(testKey + '_async' + i)
  }

  return results
}

// 3. 网络请求性能测试
async function testNetworkPerformance() {
  const results = []

  if (!wx.cloud) {
    results.push({
      name: '云开发未初始化',
      category: '网络',
      value: 0,
      unit: 'skip',
      timestamp: Date.now()
    })
    return results
  }

  // 3.1 云函数调用耗时（callFunction）—— 模拟首页真实调用（includeMeta: false 跳过元数据）
  const cfTimer = new Timer('云函数调用')
  cfTimer.start()
  try {
    await wx.cloud.callFunction({
      name: 'getResources',
      data: { page: 1, pageSize: 1, includeMeta: false }
    })
    const cfTime = cfTimer.end()
    results.push({
      name: '云函数 callFunction（首页场景 includeMeta:false）',
      category: '网络-云函数',
      value: cfTime,
      unit: 'ms',
      timestamp: Date.now()
    })
  } catch (e) {
    const cfTime = cfTimer.end()
    results.push({
      name: '云函数 callFunction（失败）',
      category: '网络-云函数',
      value: cfTime,
      unit: 'ms (failed)',
      timestamp: Date.now()
    })
  }

  // 🔥 3.1.1 对比测试：完整调用（includeMeta: true，包含 getAllTags 全表扫描）
  const cfFullTimer = new Timer('云函数完整调用')
  cfFullTimer.start()
  try {
    await wx.cloud.callFunction({
      name: 'getResources',
      data: { page: 1, pageSize: 1, includeMeta: true }
    })
    const cfFullTime = cfFullTimer.end()
    results.push({
      name: '云函数 callFunction（完整 includeMeta:true）',
      category: '网络-云函数',
      value: cfFullTime,
      unit: 'ms',
      timestamp: Date.now()
    })
  } catch (e) {}

  // 3.2 数据库直接查询耗时（加 where 条件避免全表扫描告警）
  const dbTimer = new Timer('数据库查询')
  dbTimer.start()
  try {
    const db = wx.cloud.database()
    const _ = db.command
    // 🔥 加 status 过滤避免空 where 全表扫描告警
    await db.collection('resources').where({ status: 'published' }).limit(1).get()
    const dbTime = dbTimer.end()
    results.push({
      name: '数据库查询（where+limit(1)）',
      category: '网络-数据库',
      value: dbTime,
      unit: 'ms',
      timestamp: Date.now()
    })
  } catch (e) {
    const dbTime = dbTimer.end()
    results.push({
      name: '数据库查询（失败）',
      category: '网络-数据库',
      value: dbTime,
      unit: 'ms (failed)',
      timestamp: Date.now()
    })
  }

  // 🔥 3.2.1 预热云函数：避免冷启动干扰后续并发/串行测试
  try {
    await wx.cloud.callFunction({
      name: 'getResources',
      data: { page: 1, pageSize: 1, includeMeta: false }
    })
  } catch (e) {}

  // 3.3 并发请求测试（同时发起 5 个 callFunction，已预热过，模拟首页场景）
  const concurrentStart = Date.now()
  const concurrentTasks = []
  for (let i = 0; i < 5; i++) {
    concurrentTasks.push(
      wx.cloud.callFunction({
        name: 'getResources',
        data: { page: 1, pageSize: 1, includeMeta: false }
      }).catch(() => {})
    )
  }
  await Promise.all(concurrentTasks)
  const concurrentTime = Date.now() - concurrentStart
  results.push({
    name: '并发 5 个云函数调用（预热后）',
    category: '网络-并发',
    value: concurrentTime,
    unit: 'ms',
    timestamp: Date.now()
  })

  // 3.4 串行对比（5 个串行调用，已预热过，模拟首页场景）
  const serialStart = Date.now()
  for (let i = 0; i < 5; i++) {
    try {
      await wx.cloud.callFunction({
        name: 'getResources',
        data: { page: 1, pageSize: 1, includeMeta: false }
      })
    } catch (e) {}
  }
  const serialTime = Date.now() - serialStart
  results.push({
    name: '串行 5 个云函数调用（预热后）',
    category: '网络-串行',
    value: serialTime,
    unit: 'ms',
    timestamp: Date.now()
  })

  return results
}

// 4. setData 性能测试（需要页面实例）
function testSetDataPerformance(pageInstance) {
  return new Promise(resolve => {
    if (!pageInstance || !pageInstance.setData) {
      resolve([])
      return
    }

    const results = []

    // 小数据 setData
    let smallStart = Date.now()
    pageInstance.setData({ _perfTestSmall: Date.now() })
    const smallTime = Date.now() - smallStart
    results.push({
      name: 'setData 小数据（1字段）',
      category: 'setData',
      value: smallTime,
      unit: 'ms',
      timestamp: Date.now()
    })

    // 中等数据 setData
    const mediumData = {}
    for (let i = 0; i < 20; i++) {
      mediumData['_perfTest_' + i] = { a: i, b: 'test' + i, c: [i, i + 1] }
    }
    let mediumStart = Date.now()
    pageInstance.setData(mediumData)
    const mediumTime = Date.now() - mediumStart
    results.push({
      name: 'setData 中等数据（20字段）',
      category: 'setData',
      value: mediumTime,
      unit: 'ms',
      timestamp: Date.now()
    })

    // 大数据 setData（100 字段）
    const largeData = {}
    for (let i = 0; i < 100; i++) {
      largeData['_perfBig_' + i] = { a: i, b: 'test' + i, c: [i, i + 1, i + 2] }
    }
    let largeStart = Date.now()
    pageInstance.setData(largeData)
    const largeTime = Date.now() - largeStart
    results.push({
      name: 'setData 大数据（100字段）',
      category: 'setData',
      value: largeTime,
      unit: 'ms',
      timestamp: Date.now()
    })

    // 清理
    const clearData = {}
    for (let i = 0; i < 20; i++) clearData['_perfTest_' + i] = null
    for (let i = 0; i < 100; i++) clearData['_perfBig_' + i] = null
    clearData._perfTestSmall = null
    pageInstance.setData(clearData)

    resolve(results)
  })
}

// 4. 页面切换性能测试（模拟跳转）
async function testPageNavigation() {
  const results = []

  // 测量 navigateTo 耗时（到预览页）
  const navStart = Date.now()
  const navPromise = new Promise(resolve => {
    wx.navigateTo({
      url: '/subpackages/preview/preview?url=',
      success: () => {
        const navTime = Date.now() - navStart
        results.push({
          name: 'navigateTo 预览页（页面加载）',
          category: '页面切换',
          value: navTime,
          unit: 'ms',
          timestamp: Date.now()
        })
        // 立即返回
        setTimeout(() => {
          wx.navigateBack({
            success: () => {
              const backTime = Date.now() - navStart - navTime
              results.push({
                name: 'navigateBack 返回',
                category: '页面切换',
                value: backTime,
                unit: 'ms',
                timestamp: Date.now()
              })
              resolve()
            },
            fail: () => resolve()
          })
        }, 500)
      },
      fail: (e) => {
        console.warn('[perf] navigateTo 失败:', e)
        // 预览页可能需要参数，跳过
        results.push({
          name: 'navigateTo 预览页（跳过-参数缺失）',
          category: '页面切换',
          value: 0,
          unit: 'skip',
          timestamp: Date.now()
        })
        resolve()
      }
    })
  })

  await navPromise
  return results
}

// 5. 图片加载性能（使用项目真实图片地址，覆盖国内/海外场景）
async function testImageLoadPerformance() {
  const results = []
  // 🔥 使用云存储图片（更贴近项目实际场景）
  const testUrl = 'https://786c-demo-3gz6yqpv0e739c1e-1300414566.tcb.qcloud.la/demo/test-perf.png'

  const timer = new Timer('图片加载')
  timer.start()
  await new Promise(resolve => {
    wx.getImageInfo({
      src: testUrl,
      success: () => resolve(),
      fail: () => resolve()
    })
  })
  const imgTime = timer.end()
  results.push({
    name: '图片加载（云存储测试图）',
    category: '图片',
    value: imgTime,
    unit: imgTime > 5000 ? 'ms (timeout)' : 'ms',
    timestamp: Date.now()
  })

  return results
}

// ============ 主测试入口 ============

export async function runAllTests(options = {}) {
  const { silent = false, onPageInstance = null } = options

  testResults.startTime = Date.now()
  testResults.tests = []

  if (!silent) {
    console.log('%c[性能测试] 开始运行...', 'color:#07c160;font-weight:bold;font-size:14px')
  }

  // 1. 设备信息
  testResults.device = await collectDeviceInfo()
  testResults.device.networkType = await getNetworkType()
  if (!silent) {
    console.log('%c[性能测试] 设备:', 'color:#576b95', testResults.device)
  }

  // 2. 启动性能（从打点读取）
  const startupResults = testStartupPerformance()
  testResults.tests.push(...startupResults)

  // 3. 存储性能
  if (!silent) console.log('%c[性能测试] 测试存储性能...', 'color:#576b95')
  const storageResults = await testStoragePerformance()
  testResults.tests.push(...storageResults)

  // 4. 网络性能
  if (!silent) console.log('%c[性能测试] 测试网络性能...', 'color:#576b95')
  const networkResults = await testNetworkPerformance()
  testResults.tests.push(...networkResults)

  // 5. setData 性能（如有页面实例）
  if (onPageInstance) {
    if (!silent) console.log('%c[性能测试] 测试 setData 性能...', 'color:#576b95')
    const setDataResults = await testSetDataPerformance(onPageInstance)
    testResults.tests.push(...setDataResults)
  }

  // 6. 图片加载
  if (!silent) console.log('%c[性能测试] 测试图片加载...', 'color:#576b95')
  const imgResults = await testImageLoadPerformance()
  testResults.tests.push(...imgResults)

  // 7. 页面切换（最后做，避免干扰）
  if (options.testNavigation !== false) {
    if (!silent) console.log('%c[性能测试] 测试页面切换...', 'color:#576b95')
    const navResults = await testPageNavigation()
    testResults.tests.push(...navResults)
  }

  testResults.endTime = Date.now()

  // 汇总
  generateSummary()

  // 输出报告
  if (!silent) {
    printReport()
  }

  // 保存到 storage
  saveReport()

  return testResults
}

// 生成汇总
function generateSummary() {
  const categories = {}
  testResults.tests.forEach(t => {
    if (!categories[t.category]) categories[t.category] = []
    categories[t.category].push(t)
  })

  testResults.summary = {
    totalTests: testResults.tests.length,
    totalTime: testResults.endTime - testResults.startTime,
    byCategory: {}
  }

  Object.keys(categories).forEach(cat => {
    const items = categories[cat]
    const values = items.filter(i => typeof i.value === 'number' && i.unit === 'ms').map(i => i.value)
    testResults.summary.byCategory[cat] = {
      count: items.length,
      avg: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0,
      max: values.length ? Math.max(...values) : 0,
      min: values.length ? Math.min(...values) : 0
    }
  })
}

// 打印报告
function printReport() {
  console.log('%c\n========== 性能测试报告 ==========', 'color:#07c160;font-weight:bold;font-size:14px')
  console.log('%c设备: ' + testResults.device.model + ' / ' + testResults.device.system, 'color:#576b95')
  console.log('%c网络: ' + testResults.device.networkType + ' / SDK ' + testResults.device.SDKVersion, 'color:#576b95')
  console.log('%c测试总耗时: ' + testResults.summary.totalTime + 'ms', 'color:#576b95')

  console.log('%c\n---------- 测试详情 ----------', 'color:#fa9d3b;font-weight:bold')
  testResults.tests.forEach(t => {
    const color = t.unit === 'ms (failed)' ? 'color:#fa5151' :
                  t.unit === 'skip' ? 'color:#888' :
                  t.value > 1000 ? 'color:#fa5151' :
                  t.value > 500 ? 'color:#fa9d3b' : 'color:#07c160'
    console.log('%c' + t.name.padEnd(36) + ' ' + t.value + ' ' + t.unit, color)
  })

  console.log('%c\n---------- 分类汇总 ----------', 'color:#fa9d3b;font-weight:bold')
  Object.keys(testResults.summary.byCategory).forEach(cat => {
    const s = testResults.summary.byCategory[cat]
    console.log('%c' + cat.padEnd(16) + ' ' + s.count + '项  avg=' + s.avg + 'ms  max=' + s.max + 'ms  min=' + s.min + 'ms', 'color:#576b95')
  })

  // 性能评估
  console.log('%c\n---------- 性能评估 ----------', 'color:#fa9d3b;font-weight:bold')
  const startupLaunch = testResults.tests.find(t => t.name === 'App.onLaunch 耗时')
  if (startupLaunch) {
    if (startupLaunch.value < 500) console.log('%c✓ 启动速度优秀（<500ms）', 'color:#07c160')
    else if (startupLaunch.value < 1500) console.log('%c△ 启动速度一般（500-1500ms）', 'color:#fa9d3b')
    else console.log('%c✗ 启动速度慢（>1500ms），建议优化', 'color:#fa5151')
  }

  const syncStorage = testResults.tests.find(t => t.name === 'getStorageSync × 100')
  if (syncStorage) {
    if (syncStorage.value < 50) console.log('%c✓ 同步存储性能优秀（100次<50ms）', 'color:#07c160')
    else if (syncStorage.value < 200) console.log('%c△ 同步存储性能一般（100次50-200ms）', 'color:#fa9d3b')
    else console.log('%c✗ 同步存储阻塞严重（100次>200ms），建议改异步', 'color:#fa5151')
  }

  const cfCall = testResults.tests.find(t => t.name === '云函数 callFunction（getResources）')
  if (cfCall && cfCall.unit === 'ms') {
    if (cfCall.value < 300) console.log('%c✓ 云函数调用快（<300ms）', 'color:#07c160')
    else if (cfCall.value < 800) console.log('%c△ 云函数调用一般（300-800ms）', 'color:#fa9d3b')
    else console.log('%c✗ 云函数调用慢（>800ms），建议检查云函数逻辑', 'color:#fa5151')
  }

  const concurrent = testResults.tests.find(t => t.name === '并发 5 个云函数调用')
  const serial = testResults.tests.find(t => t.name === '串行 5 个云函数调用')
  if (concurrent && serial && concurrent.unit === 'ms' && serial.unit === 'ms') {
    const speedup = (serial.value / concurrent.value).toFixed(2)
    console.log('%c→ 并发 vs 串行加速比: ' + speedup + 'x (' + serial.value + 'ms → ' + concurrent.value + 'ms)', 'color:#576b95')
  }

  console.log('%c\n=================================\n', 'color:#07c160;font-weight:bold;font-size:14px')
}

// 保存报告到 storage
function saveReport() {
  try {
    wx.setStorage({
      key: 'perf_test_report',
      data: {
        ...testResults,
        savedAt: Date.now()
      }
    })
  } catch (e) {
    console.warn('[perf] 保存报告失败:', e)
  }
}

// 获取上次报告
export function getLastReport() {
  return new Promise(resolve => {
    wx.getStorage({
      key: 'perf_test_report',
      success: res => resolve(res.data),
      fail: () => resolve(null)
    })
  })
}

// 手动打点（供 app.js / 首页调用）
export function mark(name) {
  perf.mark(name)
}

export function measure(name, startMark, endMark) {
  return perf.measure(name, startMark, endMark)
}

// 默认导出
export default {
  mark,
  measure,
  runAllTests,
  getLastReport,
  perf
}
