const cloud = require('wx-server-sdk')

class CloudCache {
  constructor(options = {}) {
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000
    this.collectionName = options.collectionName || 'cloud_cache'
    this.db = cloud.database()
  }

  async get(key) {
    try {
      const res = await this.db.collection(this.collectionName).where({ key }).get()
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
      const existing = await this.db.collection(this.collectionName).where({ key }).get()
      if (existing.data.length > 0) {
        await this.db.collection(this.collectionName).doc(existing.data[0]._id).update({
          data: { value, expireAt, updatedAt: this.db.serverDate() }
        })
      } else {
        await this.db.collection(this.collectionName).add({
          data: { key, value, expireAt, createdAt: this.db.serverDate(), updatedAt: this.db.serverDate() }
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
      const res = await this.db.collection(this.collectionName).where({ key }).get()
      if (res.data.length > 0) {
        await this.db.collection(this.collectionName).doc(res.data[0]._id).remove()
      }
      return true
    } catch (err) {
      console.error(`[Cache] Delete error:`, err)
      return false
    }
  }
}

module.exports = CloudCache
