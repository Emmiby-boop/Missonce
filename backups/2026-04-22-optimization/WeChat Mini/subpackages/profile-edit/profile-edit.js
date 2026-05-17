import { saveUserToDB, uploadUserAvatar } from '../../utils/auth.js'

Page({
  data: {
    nickName: '',
    avatarUrl: '/images/default-avatar.png',
    saving: false
  },

  onLoad() {
    const userInfo = wx.getStorageSync('userInfo') || {}
    this.setData({
      nickName: userInfo.nickName || `用户${Math.floor(100000 + Math.random() * 900000)}`,
      avatarUrl: userInfo.avatarUrl || '/images/default-avatar.png'
    })
  },

  onNickInput(e) {
    // 双向绑定输入
    this.setData({ nickName: e.detail.value })
  },
  
  onNickChange(e) {
    // 监听昵称填写完成（支持微信昵称一键填入）
    const nick = e.detail.value
    if (nick) {
      this.setData({ nickName: nick })
    }
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    this.setData({ avatarUrl })
  },

  chooseAvatar() {
    // 兼容旧方法，但主要依赖 open-type="chooseAvatar"
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        if (res.tempFilePaths && res.tempFilePaths.length) {
          this.setData({ avatarUrl: res.tempFilePaths[0] })
        }
      }
    })
  },

  async saveProfile() {
    const openid = wx.getStorageSync('openid')
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    const nick = this.data.nickName.trim()
    if (!nick) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    try {
      // 1. Upload Avatar
      const avatarFinal = await uploadUserAvatar(this.data.avatarUrl, openid)
      
      // 2. Prepare User Data
      const userInfo = {
        openid,
        nickName: nick,
        avatarUrl: avatarFinal
      }

      // 3. Save to DB (using auth.js)
      await saveUserToDB(userInfo)

      // 4. Update Local Storage
      const merged = { ...wx.getStorageSync('userInfo'), nickName: nick, avatarUrl: avatarFinal, openid }
      wx.setStorageSync('userInfo', merged)
      
      const userCache = wx.getStorageSync('user') || {}
      wx.setStorageSync('user', { ...userCache, nickName: nick, avatarUrl: avatarFinal, _id: openid })
      
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => wx.navigateBack({ delta: 1 }), 400)
    } catch (e) {
      console.error('保存资料失败', e)
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  }
})
