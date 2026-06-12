const { db, _, createPointRecord, getOrCreateUser } = require('../shared')

async function addPoints(openid, event) {
  const amount = event.amount
  const type = event.type || 'manual'
  const description = event.description || ''
  
  if (!amount || amount <= 0) {
    return { success: false, error: '积分数量必须大于0' }
  }

  try {
    const user = await getOrCreateUser(openid)

    await db.collection('user_points').doc(user._id).update({
      data: {
        points: _.inc(amount),
        totalPoints: _.inc(amount),
        updatedAt: new Date()
      }
    })

    await createPointRecord(openid, type, amount, user.points + amount, description || `${type} +${amount}积分`)

    return {
      success: true,
      data: {
        points: user.points + amount,
        totalPoints: user.totalPoints + amount,
        addedAmount: amount
      }
    }
  } catch (e) {
    console.error('addPoints 错误:', e)
    return { success: false, error: e.message }
  }
}

async function deductPoints(openid, event) {
  const amount = event.amount
  const type = event.type || 'manual'
  const description = event.description || ''
  
  if (!amount || amount <= 0) {
    return { success: false, error: '积分数量必须大于0' }
  }

  try {
    const userRes = await db.collection('user_points').where({ _openid: openid }).limit(1).get()
    if (userRes.data.length === 0) {
      return { success: false, error: '用户不存在' }
    }

    const user = userRes.data[0]
    if (user.points < amount) {
      return { success: false, error: '积分不足', currentPoints: user.points }
    }

    await db.collection('user_points').doc(user._id).update({
      data: {
        points: _.inc(-amount),
        updatedAt: new Date()
      }
    })

    await createPointRecord(openid, type, -amount, user.points - amount, description || `${type} -${amount}积分`)

    return {
      success: true,
      data: {
        points: user.points - amount,
        deductedAmount: amount
      }
    }
  } catch (e) {
    console.error('deductPoints 错误:', e)
    return { success: false, error: e.message }
  }
}

async function getRecords(openid, event) {
  const page = event.page || 1
  const limit = event.limit || 20
  
  try {
    const skip = (page - 1) * limit

    const res = await db.collection('point_records')
      .where({ _openid: openid })
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(limit)
      .get()

    return {
      success: true,
      data: res.data,
      hasMore: res.data.length === limit
    }
  } catch (e) {
    console.error('getRecords 错误:', e)
    return { success: true, data: [], hasMore: false }
  }
}

module.exports = { addPoints, deductPoints, getRecords }
