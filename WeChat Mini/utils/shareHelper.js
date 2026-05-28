import { getStorage } from './storageManager.js'

const app = getApp()

function showShareMenu() {
  wx.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline']
  })
}

function onShareAppMessage(options, config = {}) {
  const { title, imageUrl, path } = config
  
  const defaultTitle = '小辣椒动态头像壁纸，海量精美素材免费下载！'
  const defaultPath = '/pages/index/index'
  const defaultImage = ''

  return {
    title: title || defaultTitle,
    path: path || defaultPath,
    imageUrl: imageUrl || defaultImage,
    ...options
  }
}

function onShareTimeline(options, config = {}) {
  const { title, imageUrl, query } = config
  
  const defaultTitle = '小辣椒动态头像壁纸，海量精美素材免费下载！'
  const defaultImage = ''

  return {
    title: title || defaultTitle,
    query: query || '',
    imageUrl: imageUrl || defaultImage,
    ...options
  }
}

function copyLink(pagePath, query = '') {
  const fullPath = query ? `${pagePath}?${query}` : pagePath
  const link = `https://missonce.com${fullPath}`
  
  wx.setClipboardData({
    data: link,
    success: () => {
      wx.showToast({
        title: '链接已复制',
        icon: 'success'
      })
    },
    fail: () => {
      wx.showToast({
        title: '复制失败',
        icon: 'none'
      })
    }
  })
}

function getInviteParams() {
  try {
    const userInfo = getStorage('userInfo')
    if (userInfo && userInfo.openid) {
      return `inviter=${userInfo.openid}`
    }
  } catch (e) {
    console.error('获取邀请参数失败:', e)
  }
  return ''
}

async function handleInvite() {
  try {
    const userInfo = getStorage('userInfo')
    if (!userInfo || !userInfo.openid) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return false
    }

    const res = await wx.cloud.callFunction({
      name: 'userPoints',
      data: {
        action: 'getInviteStatus'
      }
    })

    if (res.result && res.result.success) {
      const data = res.result.data
      if (data.canInvite) {
        return true
      } else {
        wx.showToast({ title: '今日邀请已达上限', icon: 'none' })
        return false
      }
    }
  } catch (e) {
    console.error('检查邀请状态失败:', e)
  }
  return true
}

function processInviteQuery(query) {
  if (!query) return null
  
  const params = new URLSearchParams(query)
  const inviter = params.get('inviter')
  
  if (inviter && inviter.length > 10) {
    return inviter
  }
  return null
}

async function bindInviter(inviterOpenid) {
  if (!inviterOpenid) return false
  
  try {
    const currentUser = getStorage('userInfo')
    if (!currentUser || !currentUser.openid) {
      return false
    }

    if (currentUser.openid === inviterOpenid) {
      return false
    }

    const res = await wx.cloud.callFunction({
      name: 'userPoints',
      data: {
        action: 'bindInviter',
        inviterOpenid: inviterOpenid
      }
    })

    if (res.result && res.result.success) {
      if (res.result.rewarded) {
        wx.showToast({
          title: '绑定成功',
          icon: 'success'
        })
      }
      return true
    }
  } catch (e) {
    console.error('绑定邀请人失败:', e)
  }
  return false
}

export {
  showShareMenu,
  onShareAppMessage,
  onShareTimeline,
  copyLink,
  getInviteParams,
  handleInvite,
  processInviteQuery,
  bindInviter
}
