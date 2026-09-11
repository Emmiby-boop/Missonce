/**
 * 获取每日精选
 */
export const getDailyPicks = async (date = '') => {
  try {
    const res = await wx.cloud.callFunction({
      name: 'getDailyPicks',
      data: { date }
    })

    if (res.result && res.result.success) {
      return res.result.data
    }
    throw new Error(res.result?.error || '获取每日精选失败')
  } catch (e) {
    console.error('获取每日精选失败:', e)
    return null
  }
}
