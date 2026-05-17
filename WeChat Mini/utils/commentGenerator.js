function generateInteractionStats(url) {
  if (!url) {
    return {
      viewCount: 0,
      likeCount: 0,
      commentCount: 0
    }
  }

  const hash = url.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0)
  }, 0)
  
  const baseViewCount = Math.abs(hash % 1000) + 100
  const baseLikeCount = Math.floor(baseViewCount * 0.1)
  const baseCommentCount = Math.floor(baseViewCount * 0.05)

  return {
    viewCount: baseViewCount,
    likeCount: baseLikeCount,
    commentCount: baseCommentCount
  }
}

function generateComments(url, type = 'avatar') {
  if (!url) {
    return []
  }

  const commentTemplates = [
    '太好看了！',
    '这个头像很有创意',
    '喜欢这个风格',
    '收藏了',
    '求原图',
    '这个配色很棒',
    '简约又好看',
    '非常适合做头像',
    '设计感很强',
    '推荐给朋友了'
  ]

  const userNames = [
    '用户A', '用户B', '用户C', '用户D', '用户E',
    '头像爱好者', '设计师', '路人甲', '收藏家', '艺术生'
  ]

  const hash = url.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0)
  }, 0)

  const commentCount = Math.abs(hash % 10) + 3
  const comments = []

  for (let i = 0; i < commentCount; i++) {
    const commentIndex = (hash + i) % commentTemplates.length
    const userIndex = (hash + i * 2) % userNames.length
    const timeOffset = Math.abs(hash + i * 7) % 30

    comments.push({
      id: `comment_${i}_${Date.now()}`,
      content: commentTemplates[commentIndex],
      userName: userNames[userIndex],
      avatarUrl: '/images/default-avatar.png',
      createTime: new Date(Date.now() - timeOffset * 24 * 60 * 60 * 1000).toISOString(),
      likes: Math.abs((hash + i * 3) % 50)
    })
  }

  return comments
}

module.exports = {
  generateInteractionStats,
  generateComments
}
