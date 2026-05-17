import { getStorage } from '../../utils/storageManager.js'

Page({
  data: {
    activeTab: 'records',
    points: 0,
    totalPoints: 0,
    records: [],
    loading: true,
    loadingMore: false,
    hasMore: true,
    page: 1,
    isCheckedIn: false,
    checkInReward: 10,
    shareReward: 10,
    inviteReward: 50,

    shareDailyLimit: 5,
    showInviteModal: false,
    inviteInfo: {
      rewardPoints: 50,
      todayInvites: 0,
      totalInvites: 0,
      validInvites: 0,
      canInvite: true,
      rules: [
        '邀请好友通过您的分享链接进入，即可绑定邀请关系',
        '好友完成3次下载或3天签到后，奖励自动发放',
        '多邀多得，邀请奖励无上限',
        '如有作弊行为，将取消奖励资格'
      ]
    },
    isMember: false,
    memberLevel: 'none',
    memberName: '',
    memberDaysRemaining: 0,
    memberPrices: {
      weekly: 500,
      monthly: 1800,
      quarterly: 4800,
      yearly: 16800,
      lifetime: 50000
    },
    exchangeOptions: {},
    activeExchangeTab: 'members',
    memberOption: {
      level: '',
      price: 0
    },
    watchAdPoints: 20,
    watchAdDailyLimit: 15
  },

  onLoad() {
    this.loadConfigs()
    this.loadUserInfo()
    this.loadRecords()
    this.loadInviteInfo()
    this.loadExchangeOptions()
  },

  onShow() {
    this.loadUserInfo()
  },

  goBack() {
    wx.navigateBack()
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    
    if (tab === 'records' && this.data.records.length === 0) {
      this.loadRecords()
    }
  },

  switchToVip() {
    this.setData({ activeTab: 'vip' })
  },

  async loadConfigs() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { action: 'getConfigs' }
      })

      if (res.result && res.result.success && res.result.data) {
        const configs = res.result.data
        this.setData({
          checkInReward: configs.checkInPoints || 10,
          shareReward: configs.sharePoints || 10,
          inviteReward: configs.inviteRewardPoints || 50,
          shareDailyLimit: configs.shareDailyLimit || 5,
          watchAdPoints: configs.watchAdPoints || 20,
          watchAdDailyLimit: configs.watchAdDailyLimit || 15,

          memberPrices: {
            weekly: configs.memberWeeklyPoints || 500,
            monthly: configs.memberMonthlyPoints || 1800,
            quarterly: configs.memberQuarterlyPoints || 4800,
            yearly: configs.memberYearlyPoints || 16800,
            lifetime: configs.memberLifetimePoints || 50000
          }
        })
      }
    } catch (e) {
      console.error('加载配置失败:', e)
    }
  },
 

  async loadUserInfo() {
    try {
      const [userRes, memberRes] = await Promise.all([
        wx.cloud.callFunction({
          name: 'userPoints',
          data: { action: 'getUserInfo' }
        }),
        wx.cloud.callFunction({
          name: 'userPoints',
          data: { action: 'getMemberStatus' }
        })
      ])

      if (userRes.result && userRes.result.success) {
        const data = userRes.result.data
        this.setData({
          points: data.points,
          totalPoints: data.totalPoints,
          isCheckedIn: data.isCheckedIn || false,
          openid: data._openid
        })
      }

      if (memberRes.result && memberRes.result.success) {
        const member = memberRes.result.data
        this.setData({
          isMember: member.isMember,
          memberLevel: member.level || 'none',
          memberDaysRemaining: member.daysRemaining || 0,
          memberName: this.getMemberName(member.level)
        })
      }
    } catch (e) {
      console.error('加载用户信息失败:', e)
    }
  },

  getMemberName(level) {
    const names = {
      weekly: '周卡会员',
      monthly: '月卡会员',
      quarterly: '季卡会员',
      yearly: '年卡会员',
      lifetime: '终身会员'
    }
    return names[level] || ''
  },

  watchAdForPoints() {
    try {
      const comp = this.selectComponent('#rewardAdComp')
      if (comp && comp.showRewarded) {
        comp.showRewarded()
      } else {
        wx.showToast({ title: '广告未就绪', icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: '广告未就绪', icon: 'none' })
    }
  },

  switchExchangeTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeExchangeTab: tab })
  },

  async loadExchangeOptions() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { action: 'getExchangeOptions' }
      })
      if (res.result && res.result.success) {
        this.setData({ exchangeOptions: res.result.data })
      }
    } catch (e) {
      console.error('加载兑换选项失败:', e)
    }
  },

  async loadRecords() {
    this.setData({ loading: true, page: 1, records: [] })
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { 
          action: 'getRecords',
          page: 1,
          limit: 20
        }
      })

      if (res.result && res.result.success) {
        this.setData({
          records: res.result.data,
          hasMore: res.result.hasMore,
          page: 1
        })
      }
    } catch (e) {
      console.error('加载记录失败:', e)
    } finally {
      this.setData({ loading: false })
    }
  },

  async loadMore() {
    if (this.data.loadingMore || !this.data.hasMore) return

    this.setData({ loadingMore: true })
    
    try {
      const nextPage = this.data.page + 1
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { 
          action: 'getRecords',
          page: nextPage,
          limit: 20
        }
      })

      if (res.result && res.result.success) {
        this.setData({
          records: [...this.data.records, ...res.result.data],
          hasMore: res.result.hasMore,
          page: nextPage
        })
      }
    } catch (e) {
      console.error('加载更多失败:', e)
    } finally {
      this.setData({ loadingMore: false })
    }
  },

  async handleCheckIn() {
    if (this.data.isCheckedIn) {
      wx.showToast({ title: '今日已签到', icon: 'none' })
      return
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { action: 'checkIn' }
      })

      if (res.result && res.result.success) {
        wx.showToast({ 
          title: '签到成功！+' + res.result.points + '积分',
          icon: 'success'
        })
        this.setData({
          isCheckedIn: true,
          points: this.data.points + res.result.points
        })
        this.loadRecords()
      } else {
        wx.showToast({ title: res.result.error || '签到失败', icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: '签到失败', icon: 'none' })
    }
  },

  handleShare() {
    wx.showToast({ title: '分享成功后自动获得积分', icon: 'none' })
  },

  inviteFriend() {
    const userInfo = getStorage('userInfo')
    if (!userInfo || !userInfo.openid) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    this.setData({ showInviteModal: true })
  },

  closeInviteModal() {
    this.setData({ showInviteModal: false })
  },

  onRewardedFinished(e) {
    const detail = (e && e.detail) || {}
    if (detail && detail.success) {
      this.loadUserInfo()
      this.loadRecords()
    }
  },

  async loadInviteInfo() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'userPoints',
        data: { action: 'getInviteStatus' }
      })

      if (res.result && res.result.success) {
        this.setData({
          inviteInfo: res.result.data,
          inviteReward: res.result.data.rewardPoints || 50
        })
      }
    } catch (e) {
      console.error('获取邀请信息失败:', e)
    }
  },

  onShareAppMessage() {
    const userInfo = getStorage('userInfo')
    const inviterParam = userInfo && userInfo.openid ? '?inviter=' + userInfo.openid : ''
    return {
      title: '小辣椒动态头像壁纸，海量精美素材免费下载！',
      path: '/pages/index/index' + inviterParam,
      imageUrl: '/images/share-cover.png'
    }
  },

  onShareTimeline() {
    const userInfo = getStorage('userInfo')
    const inviterParam = userInfo && userInfo.openid ? 'inviter=' + userInfo.openid : ''
    return {
      title: '小辣椒动态头像壁纸，海量精美素材免费下载！',
      query: inviterParam,
      imageUrl: '/images/share-cover.png'
    }
  },

  showMemberModal() {
    this.setData({ activeTab: 'vip' })
  },

  async exchangeMember(e) {
    const level = e.currentTarget.dataset.level
    const price = this.data.memberPrices[level]

    if (this.data.points < price) {
      wx.showModal({
        title: '积分不足',
        content: '兑换' + this.getMemberName(level) + '需要 ' + price + ' 积分，当前积分 ' + this.data.points + '，是否前往赚取积分？',
        success: (res) => {
          if (res.confirm) {
            this.setData({ activeTab: 'rules' })
          }
        }
      })
      return
    }

    wx.showModal({
      title: '确认兑换',
      content: '确定用 ' + price + ' 积分兑换' + this.getMemberName(level) + '？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const res = await wx.cloud.callFunction({
              name: 'userPoints',
              data: {
                action: 'exchangeMember',
                level: level
              }
            })

            if (res.result && res.result.success) {
              wx.showToast({ title: '兑换成功！', icon: 'success' })
              this.loadUserInfo()
              this.loadRecords()
            } else {
              wx.showToast({ title: res.result.error || '兑换失败', icon: 'none' })
            }
          } catch (e) {
            wx.showToast({ title: '兑换失败', icon: 'none' })
          }
        }
      }
    })
  },



  formatTime(dateStr) {
    if (!dateStr) return ''
    
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    
    return `${year}-${month}-${day} ${hours}:${minutes}`
  }
})
