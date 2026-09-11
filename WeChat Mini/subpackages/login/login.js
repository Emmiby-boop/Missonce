import { loginWithProfile, checkLoginStatus } from '../../utils/auth'

const app = getApp()

Page({
  data: {
    avatarUrl: '',
    nickName: '',
    isLoading: false,
    error: ''
  },

  onLoad() {
    if (checkLoginStatus()) {
      wx.switchTab({ url: '/pages/index/index' })
    }
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    this.setData({ avatarUrl })
  },

  onNicknameInput(e) {
    this.setData({ nickName: e.detail.value })
  },

  async handleLogin() {
    const { avatarUrl, nickName } = this.data

    if (!avatarUrl) {
      this.setData({ error: '请选择头像' })
      return
    }

    if (!nickName.trim()) {
      this.setData({ error: '请输入昵称' })
      return
    }

    this.setData({ isLoading: true, error: '' })

    try {
      await loginWithProfile({
        nickName: nickName.trim(),
        avatarUrl: avatarUrl
      })

      wx.showToast({ title: '登录成功', icon: 'success' })

      setTimeout(() => {
        wx.navigateBack({
          fail: () => {
            wx.switchTab({ url: '/pages/index/index' })
          }
        })
      }, 1500)
    } catch (err) {
      console.error('登录流程异常:', err)
      this.setData({
        isLoading: false,
        error: err.message || '登录服务异常，请重试'
      })
    }
  }
})
