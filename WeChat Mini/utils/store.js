/**
 * 轻量级状态管理 - 使用 BehaviorSubject 模式
 * 适合小程序：轻量、简单、响应式
 */

// 状态存储
const store = {}

// 订阅者列表
const subscribers = {}

/**
 * 初始化状态
 * @param {string} key - 状态 key
 * @param {*} initialValue - 初始值
 */
export const createStore = (key, initialValue) => {
  store[key] = initialValue
  subscribers[key] = []
  
  return {
    get: () => store[key],
    
    set: (value) => {
      const oldValue = store[key]
      store[key] = value
      
      // 通知所有订阅者
      if (subscribers[key]) {
        subscribers[key].forEach(callback => {
          try {
            callback(value, oldValue)
          } catch (e) {
            console.error(`[Store] ${key} 订阅者执行失败:`, e)
          }
        })
      }
    },
    
    // 订阅状态变化
    subscribe: (callback) => {
      if (!subscribers[key]) {
        subscribers[key] = []
      }
      subscribers[key].push(callback)
      
      // 返回取消订阅函数
      return () => {
        const index = subscribers[key].indexOf(callback)
        if (index > -1) {
          subscribers[key].splice(index, 1)
        }
      }
    },
    
    // 更新状态（支持函数式更新）
    update: (updater) => {
      if (typeof updater === 'function') {
        this.set(updater(store[key]))
      }
    }
  }
}

/**
 * 获取状态
 * @param {string} key 
 */
export const getState = (key) => {
  return store[key]
}

/**
 * 设置状态
 * @param {string} key 
 * @param {*} value 
 */
export const setState = (key, value) => {
  if (!store[key]) {
    console.warn(`[Store] 状态 ${key} 未初始化，使用默认值`)
    createStore(key, value)
    return
  }
  
  const oldValue = store[key]
  store[key] = value
  
  // 通知订阅者
  if (subscribers[key]) {
    subscribers[key].forEach(callback => {
      try {
        callback(value, oldValue)
      } catch (e) {
        console.error(`[Store] ${key} 订阅者执行失败:`, e)
      }
    })
  }
}

/**
 * 批量设置状态
 * @param {Object} stateMap - { key: value }
 */
export const setStates = (stateMap) => {
  Object.keys(stateMap).forEach(key => {
    setState(key, stateMap[key])
  })
}

/**
 * 订阅状态变化
 * @param {string} key 
 * @param {Function} callback - (newValue, oldValue) => void
 * @returns {Function} 取消订阅函数
 */
export const subscribe = (key, callback) => {
  if (!subscribers[key]) {
    subscribers[key] = []
  }
  subscribers[key].push(callback)
  
  // 返回取消订阅函数
  return () => {
    const index = subscribers[key].indexOf(callback)
    if (index > -1) {
      subscribers[key].splice(index, 1)
    }
  }
}

/**
 * 清除所有订阅者
 * @param {string} key 
 */
export const clearSubscribers = (key) => {
  if (key) {
    subscribers[key] = []
  } else {
    Object.keys(subscribers).forEach(k => {
      subscribers[k] = []
    })
  }
}

// ============ 预定义全局状态 ============

// 用户状态
export const userStore = createStore('user', {
  info: null,
  isLoggedIn: false,
  openid: null
})

// 收藏状态
export const favoritesStore = createStore('favorites', {
  count: 0,
  list: []
})

// 主题状态
export const themeStore = createStore('theme', {
  mode: 'light', // 'light' | 'dark'
  system: false
})

// 首页数据状态
export const homeStore = createStore('home', {
  banners: [],
  sections: [],
  loading: false
})

// 通知状态
export const notificationStore = createStore('notification', {
  unreadCount: 0
})

export default {
  createStore,
  getState,
  setState,
  setStates,
  subscribe,
  userStore,
  favoritesStore,
  themeStore,
  homeStore,
  notificationStore
}
