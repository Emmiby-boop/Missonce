const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  // Use provided UID or fall back to authenticated user's UID/OPENID
  // event.uid allows passing the UID explicitly from the client
  const uid = event.uid || wxContext.UID || wxContext.OPENID

  if (!uid) {
    return {
      success: false,
      message: 'No UID found in event or context'
    }
  }

  try {
    // Check if already exists
    const countRes = await db.collection('admins').where({ uid }).count()
    if (countRes.total > 0) {
      return {
        success: true,
        message: 'User is already an admin',
        uid
      }
    }

    // Add admin
    const res = await db.collection('admins').add({
      data: {
        uid: uid,
        role: 'super_admin',
        createdAt: new Date(),
        comment: 'Added via addAdmin function'
      }
    })

    return {
      success: true,
      id: res._id,
      message: 'Admin added successfully',
      uid
    }
  } catch (err) {
    console.error(err)
    return {
      success: false,
      error: err.toString(),
      message: 'Failed to add admin'
    }
  }
}
