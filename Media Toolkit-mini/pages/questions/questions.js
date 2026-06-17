Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    navBarTotalHeight: 64,
    navBarTotalHeightRpx: 128,
    searchKeyword: '',
    questions: [
      { id: 1, category: '解析问题', question: '为什么提示解析失败？', answer: '解析失败通常由以下原因导致：\n1. 视频链接无效或已过期。\n2. 该视频被原作者设置为私密或已删除。\n3. 暂不支持该平台的视频链接。\n请检查链接后重试。', showAnswer: false },
      { id: 2, category: '解析问题', question: '支持哪些平台的视频解析？', answer: '我们目前支持抖音、快手、小红书、B站、微博等主流短视频平台的无水印提取。更多平台正在持续接入中。', showAnswer: false },
      { id: 3, category: '解析问题', question: '解析视频时提示失败，怎么解决？', answer: '常见原因有2种：① 同时使用的人太多，服务器临时繁忙，建议等1-2分钟再试；② 链接失效或平台限制，这种情况可以直接去「热门榜单」搜索同类素材。', showAnswer: false },
      { id: 4, category: '下载问题', question: '下载的视频保存在哪里？', answer: '在微信小程序中，点击「保存到相册」后，视频会自动保存到您手机的系统相册中。如果您找不到，请检查是否已授予小程序相册访问权限。', showAnswer: false },
      { id: 5, category: '下载问题', question: '下载速度慢怎么办？', answer: '下载速度主要受您的网络环境影响。建议切换到稳定的Wi-Fi网络。如果视频过大，解析和下载可能需要稍长的时间，请耐心等待。', showAnswer: false },
      { id: 6, category: '下载问题', question: '下载后的视频打不开/无法播放？', answer: '大概率是2个问题：① 下载时网络波动导致文件损坏，重新下载一次即可；② 视频格式不兼容，可以用手机自带的「视频播放器」或第三方播放器尝试打开。', showAnswer: false },
      { id: 7, category: '下载问题', question: '下载过程中卡住不动了，怎么处理？', answer: '主要是网络不稳定导致的。先退出当前下载（关闭小程序再重新打开），检查Wi-Fi/5G信号后，重新尝试下载；如果多次卡住，建议换个时间再操作。', showAnswer: false },
      { id: 8, category: '账户与隐私', question: '使用小辣椒去水印精灵收费吗？', answer: '目前基础功能完全免费使用。未来可能会推出针对大批量处理或更高清晰度的增值服务。', showAnswer: false },
      { id: 9, category: '账户与隐私', question: '在哪里能看到已经下载/解析过的视频？', answer: '打开小辣椒去水印精灵首页，进入「历史记录」就能看到所有解析、下载过的视频，还能按时间排序查找。', showAnswer: false },
      { id: 10, category: '账户与隐私', question: '不想要的历史记录，怎么删除？', answer: '有2种方式：① 长按单条记录会弹出「删除」按钮；② 进入「历史记录」页面，点击「清空」即可一键清除全部记录。', showAnswer: false },
      { id: 11, category: '账户与隐私', question: '遇到问题想联系客服，怎么找？', answer: '两种方式都能联系到客服：① 本页面底部点击「联系客服」按钮，直接跳转到微信客服对话；② 设置页面中也有客服入口，客服会及时回复。', showAnswer: false },
      { id: 12, category: '解析问题', question: '免责声明与服务公约', answer: '小辣椒去水印精灵作为中立的技术服务提供者，旨在协助用户个人学习与素材赏析。我们郑重提醒用户，务必合法使用，任何因滥用而导致的侵权行为，责任将由用户自行承担。本程序不存储任何数字影像，资料版权归原平台及作者所有。', showAnswer: false }
    ],
    filteredQuestions: [],
    categoryGroups: []
  },

  onLoad(options) {
    this.calcNavBarHeight();
    this.applyFilters();

    if (options && options.id) {
      setTimeout(() => {
        const targetId = parseInt(options.id);
        const questions = this.data.questions;
        const index = questions.findIndex(q => q.id === targetId);
        if (index !== -1) {
          this.openQuestionByIndex({ currentTarget: { dataset: { index } } });
        }
      }, 500);
    }
  },

  calcNavBarHeight() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      const menuBtn = wx.getMenuButtonBoundingClientRect();
      const statusBarHeight = systemInfo.statusBarHeight || 20;
      const navContentHeight = menuBtn.height + (menuBtn.top - statusBarHeight) * 2;
      const totalHeightPx = statusBarHeight + navContentHeight;
      const rpxFactor = 750 / (systemInfo.screenWidth || 375);
      const totalHeightRpx = Math.round(totalHeightPx * rpxFactor);
      this.setData({
        statusBarHeight: statusBarHeight,
        navBarHeight: navContentHeight,
        navBarTotalHeight: totalHeightPx,
        navBarTotalHeightRpx: totalHeightRpx,
      });
    } catch (e) {
      this.setData({ statusBarHeight: 20, navBarHeight: 44, navBarTotalHeight: 64, navBarTotalHeightRpx: 128 });
    }
  },

  applyFilters() {
    const { questions, searchKeyword } = this.data;
    let list = questions;
    const kw = (searchKeyword || '').trim().toLowerCase();
    if (kw) {
      list = list.filter(q =>
        (q.question || '').toLowerCase().includes(kw) ||
        (q.answer || '').toLowerCase().includes(kw)
      );
    }
    const filteredQuestions = list.map((item) => {
      const idx = questions.findIndex(q => q.id === item.id);
      return { ...item, dataIndex: idx };
    });

    // 按分类分组
    const categoryOrder = ['解析问题', '下载问题', '账户与隐私'];
    const categoryIcons = { '解析问题': '⚡', '下载问题': '↓', '账户与隐私': '🛡' };
    const groups = {};

    filteredQuestions.forEach(q => {
      const cat = q.category || '其他';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(q);
    });

    const categoryGroups = categoryOrder
      .filter(cat => groups[cat] && groups[cat].length > 0)
      .map(cat => ({
        category: cat,
        icon: categoryIcons[cat] || '?',
        items: groups[cat]
      }));

    // 添加不在 order 中的分类
    Object.keys(groups).forEach(cat => {
      if (!categoryOrder.includes(cat)) {
        categoryGroups.push({
          category: cat,
          icon: '?',
          items: groups[cat]
        });
      }
    });

    this.setData({ filteredQuestions, categoryGroups });
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
    this.applyFilters();
  },

  toggleAnswer(e) {
    const dataIndex = e.currentTarget.dataset.index;
    const questions = this.data.questions.slice();
    if (dataIndex < 0 || dataIndex >= questions.length) return;
    questions[dataIndex].showAnswer = !questions[dataIndex].showAnswer;
    this.setData({ questions }, () => this.applyFilters());
  },

  openQuestionByIndex(e) {
    const index = e.currentTarget.dataset.index;
    const questions = this.data.questions.slice();
    questions[index].showAnswer = true;
    this.setData({
      searchKeyword: '',
      questions
    }, () => {
      this.applyFilters();
    });
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  },

  handleContact(e) {
    // 客服消息回调
  },

  onShareAppMessage() {
    return {
      title: '去水印精灵使用指南：解决解析失败、保存失败等常见问题',
      path: '/pages/questions/questions',
      imageUrl: '/images/share-cover.png',
      success: (res) => {},
      fail: (err) => console.error('分享失败', err)
    };
  },

  onShareTimeline() {
    return {
      title: '去水印精灵：热门问题与解答手册',
      query: '',
      imageUrl: '/images/share-cover.png',
      success: (res) => {},
      fail: (err) => console.error('分享失败', err)
    };
  }
});
