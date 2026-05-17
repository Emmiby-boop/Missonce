class CloudFunctionPerformance {
  constructor() {
    this.metrics = {}
    this.startTime = Date.now()
    this.databaseQueries = []
    this.lastMilestone = this.startTime
  }

  markMilestone(name) {
    const now = Date.now()
    const elapsed = now - this.startTime
    const sinceLast = now - this.lastMilestone
    this.metrics[name] = { elapsed, sinceLast, timestamp: now }
    this.lastMilestone = now
    console.log(`[Performance] ⏱️  ${name}: ${elapsed}ms (+${sinceLast}ms)`)
  }

  trackDatabaseQuery(collection, operation, startTime) {
    const duration = Date.now() - startTime
    this.databaseQueries.push({ collection, operation, duration, timestamp: Date.now() })
    console.log(`[DB Query] 📊 ${collection}.${operation}: ${duration}ms`)
  }

  getSummary() {
    const totalTime = Date.now() - this.startTime
    const totalDbTime = this.databaseQueries.reduce((sum, q) => sum + q.duration, 0)
    return { totalTime, totalDbTime, dbQueryCount: this.databaseQueries.length, metrics: this.metrics, databaseQueries: this.databaseQueries }
  }

  logSummary() {
    const summary = this.getSummary()
    console.group('[Performance] 📈 云函数执行总结')
    console.log(`总耗时: ${summary.totalTime}ms`)
    console.log(`数据库查询: ${summary.dbQueryCount}次, 总耗时: ${summary.totalDbTime}ms`)
    console.log('里程碑:', summary.metrics)
    console.groupEnd()
    return summary
  }
}

module.exports = CloudFunctionPerformance
