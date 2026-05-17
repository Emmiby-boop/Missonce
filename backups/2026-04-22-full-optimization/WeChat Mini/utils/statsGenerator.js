function generateInteractionStats(url) {
  if (!url) {
    return {
      viewCount: 0,
      likeCount: 0
    }
  }

  const hash = url.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0)
  }, 0)

  const baseViewCount = Math.abs(hash % 1000) + 100
  const baseLikeCount = Math.floor(baseViewCount * 0.1)

  return {
    viewCount: baseViewCount,
    likeCount: baseLikeCount
  }
}

module.exports = {
  generateInteractionStats
}