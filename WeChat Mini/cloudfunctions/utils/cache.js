const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

class CloudCache {
  constructor(options = {}) {
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000 // 默认5分钟
    this.collectionName = options.collectionName || 'cloud_cache'
  }

  async get(key) {
    try {
      const res = await db.collection(this.collectionName)
        .where({ key })
        .get()
      
      if (res.data.length > 0) {
        const cacheItem = res.data[0]
        if (cacheItem.expireAt > Date.now()) {
          console.log(`[Cache] ✅ Hit: ${key}`)
          return cacheItem.value
        }
        console.log(`[Cache] ⏰ Expired: ${key}`)
        await this.delete(key)
      }
      console.log(`[Cache] ❌ Miss: ${key}`)
      return null
    } catch (err) {
      console.error(`[Cache] Get error:`, err)
      return null
    }
  }

  async set(key, value, ttl = this.defaultTTL) {
    try {
      const expireAt = Date.now() + ttl
      
      const existing = await db.collection(this.collectionName)
        .where({ key })
        .get()
      
      if (existing.data.length > 0) {
        await db.collection(this.collectionName)
          .doc(existing.data[0]._id)
          .update({
            data: {
              value,
              expireAt,
              updatedAt: db.serverDate()
            }
          })
      } else {
        await db.collection(this.collectionName)
          .add({
            data: {
              key,
              value,
              expireAt,
              createdAt: db.serverDate(),
              updatedAt: db.serverDate()
            }
          })
      }
      console.log(`[Cache] 💾 Set: ${key} (TTL: ${ttl}ms)`)
      return true
    } catch (err) {
      console.error(`[Cache] Set error:`, err)
      return false
    }
  }

  async delete(key) {
    try {
      const res = await db.collection(this.collectionName)
        .where({ key })
        .get()
      
      if (res.data.length > 0) {
        await db.collection(this.collectionName)
          .doc(res.data[0]._id)
          .remove()
      }
      return true
    } catch (err) {
      console.error(`[Cache] Delete error:`, err)
      return false
    }
  }

  async clearExpired() {
    try {
      const res = await db.collection(this.collectionName)
        .where({
          expireAt: db.command.lt(Date.now())
        })
        .get()
      
      const deletePromises = res.data.map(item => 
        db.collection(this.collectionName).doc(item._id).remove()
      )
      
      await Promise.all(deletePromises)
      console.log(`[Cache] 🧹 Cleared ${res.data.length} expired items`)
      return res.data.length
    } catch (err) {
      console.error(`[Cache] Clear expired error:`, err)
      return 0
    }
  }

  async wrap(key, fn, ttl = this.defaultTTL) {
    const cached = await this.get(key)
    if (cached !== null) {
      return cached
    }
    
    const result = await fn()
    await this.set(key, result, ttl)
    return result
  }
}

module.exports = CloudCache
