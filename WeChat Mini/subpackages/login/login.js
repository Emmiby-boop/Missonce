import { loginWithProfile, checkLoginStatus } from '../../utils/auth'

// 全局应用实例
const app = getApp()

// 小程序配置
const APPID = 'wx78c0b02bd2db5462'
const ENV_ID = 'missonce-99-1gfaff6n002f6ac1'

Page({
  data: {
    isLoading: false,
    error: ''
  },

  onLoad() {
    if (checkLoginStatus()) {
      wx.switchTab({ url: '/pages/index/index' })
    }
  },

  async handleLogin() {
    this.setData({ isLoading: true, error: '' })
    
    try {
      await loginWithProfile()
      
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
