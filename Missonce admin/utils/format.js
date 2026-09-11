/**
 * 格式化工具（uni-app 适配版）
 * 原 miniprogramadmin/utils/format.js，wx.* 调用统一替换为 uni.*
 */

/** 格式化数字（1234 → 1.2k / 1234567 → 1.2M） */
function formatNumber(num) {
  if (num === null || num === undefined) return '0'
  const n = Number(num)
  if (isNaN(n)) return '0'
  if (n < 1000) return String(n)
  if (n < 1000000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
}

/** 格式化日期时间 */
function formatTime(ts) {
  if (!ts) return ''
  const date = new Date(ts)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前'

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  if (y === now.getFullYear()) return `${m}-${d}`
  return `${y}-${m}-${d}`
}

/** 格式化完整日期时间 */
function formatDateTime(ts) {
  if (!ts) return ''
  const date = new Date(ts)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

/** 资源状态映射 */
const RESOURCE_STATUS = {
  0: { label: '待审核', badge: 'badge--orange' },
  1: { label: '已发布', badge: 'badge--green' },
  2: { label: '已拒绝', badge: 'badge--red' },
  3: { label: '已删除', badge: 'badge--gray' },
}

/** 专题状态映射 */
const TOPIC_STATUS = {
  active: { label: '已发布', badge: 'badge--green' },
  inactive: { label: '已下架', badge: 'badge--gray' },
}

/** 通知类型映射 */
const NOTIFICATION_TYPE = {
  announcement: { label: '公告', badge: 'badge--blue' },
  update: { label: '更新', badge: 'badge--green' },
  activity: { label: '活动', badge: 'badge--orange' },
}

/** 获取状态标签 */
function getStatusLabel(statusMap, status) {
  return statusMap[status] || { label: '未知', badge: 'badge--gray' }
}

/** 手机号脱敏 */
function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

/** 用户名首字（用于头像） */
function getInitial(name) {
  if (!name) return 'A'
  return name.charAt(0).toUpperCase()
}

/** 根据用户名生成头像渐变色 */
function getAvatarColor(name) {
  const colors = [
    'linear-gradient(135deg, #7C5CFC, #a78bfa)',
    'linear-gradient(135deg, #10AEFF, #60d5f7)',
    'linear-gradient(135deg, #FF9500, #ffc56d)',
    'linear-gradient(135deg, #07C160, #4ade80)',
    'linear-gradient(135deg, #FA5151, #ff8a8a)',
  ]
  if (!name) return colors[0]
  const hash = name.charCodeAt(0)
  return colors[hash % colors.length]
}

/** 防抖 */
function debounce(fn, delay) {
  if (delay === undefined) delay = 300
  var timer = null
  var debounced = function () {
    var args = arguments
    var self = this
    if (timer) clearTimeout(timer)
    timer = setTimeout(function () { fn.apply(self, args) }, delay)
  }
  debounced.cancel = function () {
    if (timer) clearTimeout(timer)
    timer = null
  }
  return debounced
}

/** 显示 toast */
function toast(title, icon, duration) {
  icon = icon || 'none'
  duration = duration || 2000
  if (typeof uni !== 'undefined' && uni.showToast) {
    uni.showToast({ title: title, icon: icon, duration: duration })
  } else {
    console.log('[toast]', title)
  }
}

/** 显示 loading */
var _loadingCount = 0
function showLoading(title) {
  title = title || '加载中…'
  if (typeof uni !== 'undefined' && uni.showLoading) {
    uni.showLoading({ title: title, mask: true })
  } else {
    _loadingCount++
    console.log('[loading]', title)
  }
}

/** 隐藏 loading */
function hideLoading() {
  if (typeof uni !== 'undefined' && uni.hideLoading) {
    uni.hideLoading()
  } else {
    if (_loadingCount > 0) _loadingCount--
    console.log('[loading hidden]')
  }
}

/** 确认对话框 */
function confirm(content, title) {
  title = title || '提示'
  return new Promise(function (resolve) {
    if (typeof uni !== 'undefined' && uni.showModal) {
      uni.showModal({
        title: title,
        content: content,
        success: function (res) { resolve(res.confirm) },
      })
    } else if (typeof window !== 'undefined' && window.confirm) {
      resolve(window.confirm(content))
    } else {
      resolve(true)
    }
  })
}

export {
  formatNumber,
  formatTime,
  formatDateTime,
  RESOURCE_STATUS,
  TOPIC_STATUS,
  NOTIFICATION_TYPE,
  getStatusLabel,
  maskPhone,
  getInitial,
  getAvatarColor,
  debounce,
  toast,
  showLoading,
  hideLoading,
  confirm,
}

export default {
  formatNumber,
  formatTime,
  formatDateTime,
  RESOURCE_STATUS,
  TOPIC_STATUS,
  NOTIFICATION_TYPE,
  getStatusLabel,
  maskPhone,
  getInitial,
  getAvatarColor,
  debounce,
  toast,
  showLoading,
  hideLoading,
  confirm,
}
