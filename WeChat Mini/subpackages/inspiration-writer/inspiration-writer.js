Page({
  data: {
    loading: true,
    scenes: [],
    featuredQuotes: [],
    inputText: '',
    isGenerating: false,
    generatedText: '',
    displayText: '',
    typingIndex: 0,
    typingTimer: null,
    showResult: false,
    currentScene: null
  },

  _isPageActive: false,

  onLoad() {
    this._isPageActive = true
    this.loadConfig()
  },

  onShow() {
    this._isPageActive = true
  },

  onHide() {
    this._isPageActive = false
    this.clearTypingTimer()
  },

  async loadConfig() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'aiGenerateText',
        data: { action: 'getConfig' }
      })

      if (!this._isPageActive) return

      if (res.result.success) {
        this.setData({
          scenes: res.result.config.scenes || [],
          featuredQuotes: res.result.config.featuredQuotes || [],
          loading: false
        })
      } else {
        this.setData({ loading: false })
      }
    } catch (e) {
      console.error('加载配置失败:', e)
      if (this._isPageActive) {
        this.setData({ loading: false })
      }
    }
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  onSceneTap(e) {
    const scene = e.currentTarget.dataset.scene
    this.setData({
      currentScene: scene,
      inputText: scene.prompt
    })
  },

  onQuoteTap(e) {
    const quote = e.currentTarget.dataset.quote
    this.setData({
      generatedText: quote.content,
      displayText: '',
      showResult: true
    })
    this.startTyping(quote.content)
  },

  async onGenerate() {
    const { inputText, isGenerating } = this.data
    if (!inputText.trim()) {
      wx.showToast({ title: '请输入你的想法', icon: 'none' })
      return
    }
    if (isGenerating) return

    this.setData({ isGenerating: true })
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'aiGenerateText',
        data: {
          action: 'generate',
          prompt: inputText
        }
      })

      if (!this._isPageActive) return

      if (res.result.success) {
        this.setData({
          generatedText: res.result.text,
          displayText: '',
          showResult: true
        })
        this.startTyping(res.result.text)
      } else {
        wx.showToast({ title: res.result.error || '生成失败', icon: 'none' })
      }
    } catch (e) {
      console.error('生成失败:', e)
      if (this._isPageActive) {
        wx.showToast({ title: '生成失败', icon: 'none' })
      }
    } finally {
      if (this._isPageActive) {
        this.setData({ isGenerating: false })
      }
    }
  },

  clearTypingTimer() {
    if (this.data.typingTimer) {
      clearInterval(this.data.typingTimer)
      this.setData({ typingTimer: null })
    }
  },

  startTyping(text) {
    this.clearTypingTimer()
    
    if (!text || !this._isPageActive) return
    
    let index = 0
    const timer = setInterval(() => {
      if (!this._isPageActive) {
        clearInterval(timer)
        return
      }
      
      if (index < text.length) {
        const displayText = text.substring(0, index + 1)
        this.setData({ displayText })
        index++
      } else {
        clearInterval(timer)
        this.setData({ typingTimer: null })
      }
    }, 50)
    
    this.setData({ typingTimer: timer })
  },

  onCopy() {
    wx.setClipboardData({
      data: this.data.generatedText,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' })
      }
    })
  },

  onRegenerate() {
    this.onGenerate()
  },

  onBackToList() {
    this.clearTypingTimer()
    this.setData({
      showResult: false,
      displayText: '',
      generatedText: '',
      currentScene: null
    })
  },

  onUnload() {
    this._isPageActive = false
    this.clearTypingTimer()
  }
})
