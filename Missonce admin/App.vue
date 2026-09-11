<script>
/**
 * App.vue —— Missonce Admin (uni-app)
 * 初始化云开发、恢复登录态、计算状态栏高度。
 * 全局样式 1:1 平移自 miniprogramadmin/app.wxss（设计系统统一）。
 */
import cloud from './utils/cloud'
import appGlobal from './utils/app-global'

export default {
  onLaunch() {
    // 恢复登录态
    const restored = cloud.restoreSession()
    if (restored) appGlobal.setAdmin(restored)
    const savedToken = cloud.getToken()
    if (savedToken) appGlobal.setToken(savedToken)

    // 初始化云开发（双模式：小程序 wx.cloud / App 端 js-sdk）
    const readyPromise = cloud.initCloud()
      .then(function () {
        appGlobal.setCloudReady(true)
        return cloud.checkAuth()
      })
      .then(function (admin) {
        if (!admin) {
          uni.reLaunch({ url: '/pages/login/login' })
        }
      })
      .catch(function (err) {
        console.error('[app] 云开发初始化失败', err)
      })
    appGlobal.setCloudReadyPromise(readyPromise)

    // 状态栏 / 导航栏高度
    try {
      const sysInfo = (uni.getWindowInfo && uni.getWindowInfo()) || uni.getSystemInfoSync()
      appGlobal.setStatusBarHeight(sysInfo.statusBarHeight || 20)
      const menuButton = uni.getMenuButtonBoundingClientRect ? uni.getMenuButtonBoundingClientRect() : null
      if (menuButton && menuButton.top) {
        appGlobal.setNavBarHeight(
          (menuButton.top - appGlobal.state.statusBarHeight) * 2 + menuButton.height
        )
      } else {
        appGlobal.setNavBarHeight(44)
      }
    } catch (e) {
      appGlobal.setStatusBarHeight(20)
      appGlobal.setNavBarHeight(44)
    }
  },
}
</script>

<style lang="scss">
/* ============================================
 * Missonce Admin — 全局样式（1:1 平移自 miniprogramadmin/app.wxss）
 * 设计方向：清晰运营风格 · 主色：#07C160（微信绿）
 * ============================================ */

page {
  /* ── Primary ── */
  --pri: #07C160;
  --pri-l: #E8F8EE;
  --pri-d: #06AD56;

  /* ── Semantic ── */
  --success: #07C160;
  --danger: #FA5151;
  --danger-l: #FFE8E8;
  --warning: #FF9500;
  --warning-l: #FFF3E0;
  --warning-d: #C77700;
  --info: #10AEFF;
  --info-l: #E8F4FF;
  --purple: #7C5CFC;
  --purple-l: #F0E8FF;
  --cyan: #00B894;
  --cyan-l: #E0F7F4;
  --pink: #E84393;
  --pink-l: #FDF0F5;

  /* ── Neutral (Light) ── */
  --bg-page: #F5F6F8;
  --bg-card: #FFFFFF;
  --bg-elevated: #FFFFFF;
  --text-primary: #1A1A2E;
  --text-secondary: #5A5A6E;
  --text-tertiary: #9A9AAB;
  --border: #EBEBF0;
  --divider: #F0F0F5;

  /* ── Radius ── */
  --r-lg: 20rpx;
  --r-md: 16rpx;
  --r-sm: 12rpx;
  --r-pill: 100rpx;

  /* ── Shadow ── */
  --shadow-card: 0 2rpx 12rpx rgba(0, 0, 0, 0.03);

  /* ── Typography ── */
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue',
    'PingFang SC', 'Noto Sans CJK SC', sans-serif;
  background-color: var(--bg-page);
  color: var(--text-primary);
  font-size: 28rpx;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* ── 深色模式 ── */
@media (prefers-color-scheme: dark) {
  page {
    --bg-page: #0F1117;
    --bg-card: #1A1D28;
    --bg-elevated: #242836;
    --text-primary: #E8E8ED;
    --text-secondary: #8A8FA0;
    --text-tertiary: #6E7385;
    --border: #2A2E3A;
    --divider: #222636;
    --shadow-card: none;
    --pri-l: rgba(7, 193, 96, 0.15);
    --danger-l: rgba(250, 81, 81, 0.15);
    --warning-l: rgba(255, 149, 0, 0.15);
    --info-l: rgba(16, 174, 255, 0.15);
    --purple-l: rgba(124, 92, 252, 0.15);
    --cyan-l: rgba(0, 184, 148, 0.15);
    --pink-l: rgba(232, 67, 147, 0.15);
  }
}

/* ============================================
 * 通用布局
 * ============================================ */
.page-container {
  min-height: 100vh;
  background: var(--bg-page);
  padding: 24rpx 32rpx 40rpx;
  box-sizing: border-box;
}

.page-container--full {
  padding: 0;
}

.section {
  margin-top: 40rpx;
}

.section:first-child {
  margin-top: 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
  padding: 0 4rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.section-more {
  font-size: 24rpx;
  color: var(--text-secondary);
}

/* ============================================
 * 卡片 Card
 * ============================================ */
.card {
  background: var(--bg-card);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.card--padded {
  padding: 32rpx;
}

.card-group {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

/* ============================================
 * 数据卡片 Metric Card
 * ============================================ */
.metric-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
}

.metric-grid--3 {
  grid-template-columns: 1fr 1fr 1fr;
}

.metric-card {
  background: var(--bg-card);
  border-radius: var(--r-lg);
  padding: 28rpx 32rpx;
  box-shadow: var(--shadow-card);
  position: relative;
  overflow: hidden;
}

.metric-card--highlight {
  background: var(--pri);
}

.metric-card--highlight .metric-value,
.metric-card--highlight .metric-label {
  color: #fff;
}

.metric-value {
  font-size: 48rpx;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.metric-label {
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-top: 6rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.metric-trend {
  font-size: 20rpx;
  margin-top: 10rpx;
  display: flex;
  align-items: center;
  gap: 4rpx;
}

.metric-trend--up {
  color: var(--pri);
}

.metric-trend--down {
  color: var(--danger);
}

.metric-trend--warn {
  color: var(--warning);
}

.metric-card--highlight .metric-trend {
  color: rgba(255, 255, 255, 0.8);
}

/* ============================================
 * 列表 List
 * ============================================ */
.list-card {
  background: var(--bg-card);
  border-radius: var(--r-lg);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.list-item {
  display: flex;
  align-items: center;
  padding: 26rpx 32rpx;
  gap: 24rpx;
  border-bottom: 1rpx solid var(--divider);
}

.list-item:last-child {
  border-bottom: none;
}

.list-item--active {
  background: var(--divider);
}

.list-item-icon {
  width: 76rpx;
  height: 76rpx;
  border-radius: var(--r-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.list-item-icon--green { background: var(--pri-l); color: var(--pri); }
.list-item-icon--blue { background: var(--info-l); color: var(--info); }
.list-item-icon--orange { background: var(--warning-l); color: var(--warning); }
.list-item-icon--red { background: var(--danger-l); color: var(--danger); }
.list-item-icon--purple { background: var(--purple-l); color: var(--purple); }
.list-item-icon--cyan { background: var(--cyan-l); color: var(--cyan); }
.list-item-icon--pink { background: var(--pink-l); color: var(--pink); }
.list-item-icon--gray { background: var(--divider); color: var(--text-secondary); }

.list-item-text {
  flex: 1;
  min-width: 0;
}

.list-item-title {
  font-size: 28rpx;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-item-desc {
  font-size: 22rpx;
  color: var(--text-secondary);
  margin-top: 4rpx;
}

.list-item-right {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-shrink: 0;
}

.list-item-count {
  font-size: 24rpx;
  color: var(--text-secondary);
}

.list-item-arrow {
  color: var(--text-tertiary);
  font-size: 28rpx;
}

/* ============================================
 * 状态标签 Badge
 * ============================================ */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4rpx 16rpx;
  border-radius: var(--r-pill);
  font-size: 20rpx;
  font-weight: 500;
  line-height: 1.5;
}

.badge--green { background: var(--pri-l); color: var(--pri); }
.badge--orange { background: var(--warning-l); color: var(--warning-d); }
.badge--red { background: var(--danger-l); color: var(--danger); }
.badge--blue { background: var(--info-l); color: var(--info); }
.badge--gray { background: var(--divider); color: var(--text-secondary); }
.badge--purple { background: var(--purple-l); color: var(--purple); }

/* ============================================
 * 按钮 Button
 * ============================================ */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 32rpx;
  height: 80rpx;
  border-radius: var(--r-sm);
  font-size: 28rpx;
  font-weight: 500;
  border: none;
  line-height: 80rpx;
  transition: opacity 0.2s;
}

.btn::after {
  border: none;
}

.btn--primary {
  background: var(--pri) !important;
  color: #fff !important;
}

.btn--primary:active {
  background: var(--pri-d) !important;
}

.btn--danger { background: var(--danger); color: #fff; }
.btn--ghost { background: var(--pri-l); color: var(--pri); }
.btn--default { background: var(--bg-card); color: var(--text-primary); border: 1rpx solid var(--border); }

.btn--block { width: 100%; }

.btn--sm {
  height: 60rpx;
  font-size: 24rpx;
  padding: 0 24rpx;
  line-height: 60rpx;
}

.btn--pill {
  border-radius: 100rpx;
  box-shadow: 0 4rpx 12rpx rgba(7, 193, 96, 0.3);
}

.btn[disabled] { opacity: 0.5; }

/* ============================================
 * 筛选栏 Filter Bar
 * ============================================ */
.filter-bar {
  display: flex;
  gap: 16rpx;
  overflow-x: auto;
  padding-bottom: 4rpx;
  white-space: nowrap;
}

.filter-bar::-webkit-scrollbar { display: none; }

.filter-chip {
  padding: 12rpx 28rpx;
  border-radius: var(--r-pill);
  font-size: 24rpx;
  font-weight: 500;
  white-space: nowrap;
  background: var(--bg-card);
  color: var(--text-secondary);
  border: 1rpx solid var(--divider);
  flex-shrink: 0;
  transition: all 0.2s;
}

.filter-chip--active {
  background: var(--pri-l);
  color: var(--pri);
  border-color: var(--pri);
}

/* ============================================
 * 开关 Toggle
 * ============================================ */
.toggle {
  width: 84rpx;
  height: 48rpx;
  border-radius: 24rpx;
  background: var(--divider);
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
}

.toggle--on { background: var(--pri); }

.toggle__knob {
  position: absolute;
  top: 4rpx;
  left: 4rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: #fff;
  transition: left 0.2s;
  box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.15);
}

.toggle--on .toggle__knob { left: 40rpx; }

/* ============================================
 * 空状态 / 错误状态
 * ============================================ */
.empty-state, .error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 32rpx;
  gap: 20rpx;
}

.empty-state__icon, .error-state__icon {
  width: 120rpx;
  height: 120rpx;
  opacity: 0.3;
}

.empty-state__text, .error-state__text {
  font-size: 28rpx;
  color: var(--text-secondary);
}

.empty-state__action, .error-state__action { margin-top: 8rpx; }

/* ============================================
 * 底部操作栏 / FAB
 * ============================================ */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-card);
  padding: 20rpx 32rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid var(--border);
  display: flex;
  gap: 20rpx;
  align-items: center;
  z-index: 100;
}

.fab {
  position: fixed;
  bottom: 140rpx;
  right: 32rpx;
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: var(--pri);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 28rpx rgba(7, 193, 96, 0.35);
  z-index: 50;
}

.fab:active { transform: scale(0.92); }

/* ============================================
 * 输入框 Input
 * ============================================ */
.input-group { margin-bottom: 24rpx; }

.input-label {
  font-size: 26rpx;
  color: var(--text-secondary);
  margin-bottom: 12rpx;
  display: block;
}

.input {
  width: 100%;
  height: 88rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--r-sm);
  padding: 0 28rpx;
  font-size: 28rpx;
  color: var(--text-primary);
  box-sizing: border-box;
}

.input:focus { border-color: var(--pri); }

.input::placeholder { color: var(--text-tertiary); }

/* ============================================
 * 设置项 Setting Item
 * ============================================ */
.setting-group {
  background: var(--bg-card);
  border-radius: var(--r-lg);
  margin-bottom: 20rpx;
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.setting-item {
  display: flex;
  align-items: center;
  padding: 28rpx 32rpx;
  gap: 24rpx;
  border-bottom: 1rpx solid var(--divider);
}

.setting-item:last-child { border-bottom: none; }

.setting-icon {
  width: 60rpx;
  height: 60rpx;
  border-radius: var(--r-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.setting-text { flex: 1; font-size: 28rpx; color: var(--text-primary); }
.setting-value { font-size: 24rpx; color: var(--text-secondary); }
.setting-arrow { color: var(--text-tertiary); }

/* ============================================
 * 个人资料卡 Profile Card
 * ============================================ */
.profile-card {
  background: var(--bg-card);
  border-radius: var(--r-lg);
  padding: 40rpx;
  margin-bottom: 24rpx;
  text-align: center;
  box-shadow: var(--shadow-card);
}

.profile-card__avatar {
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background: var(--pri);
  margin: 0 auto 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 40rpx;
  font-weight: 700;
}

.profile-card__name { font-size: 34rpx; font-weight: 600; color: var(--text-primary); }
.profile-card__role { font-size: 24rpx; color: var(--text-secondary); margin-top: 4rpx; }

/* ============================================
 * 通用工具类
 * ============================================ */
.text-primary { color: var(--text-primary); }
.text-secondary { color: var(--text-secondary); }
.text-tertiary { color: var(--text-tertiary); }
.text-danger { color: var(--danger); }
.text-success { color: var(--pri); }
.text-warning { color: var(--warning); }
.text-info { color: var(--info); }

.font-bold { font-weight: 700; }
.font-medium { font-weight: 500; }
.font-sm { font-size: 24rpx; }
.font-xs { font-size: 20rpx; }
.font-lg { font-size: 32rpx; }
.font-xl { font-size: 36rpx; }

.flex { display: flex; }
.flex-center { display: flex; align-items: center; justify-content: center; }
.flex-between { display: flex; align-items: center; justify-content: space-between; }
.flex-col { display: flex; flex-direction: column; }
.flex-1 { flex: 1; min-width: 0; }
.gap-sm { gap: 12rpx; }
.gap-md { gap: 20rpx; }
.gap-lg { gap: 32rpx; }

.mt-sm { margin-top: 12rpx; }
.mt-md { margin-top: 20rpx; }
.mt-lg { margin-top: 32rpx; }
.mt-xl { margin-top: 48rpx; }
.mb-sm { margin-bottom: 12rpx; }
.mb-md { margin-bottom: 20rpx; }
.mb-lg { margin-bottom: 32rpx; }

.text-center { text-align: center; }
.text-right { text-align: right; }
.text-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.text-ellipsis-2 {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* ============================================
 * 动画 / 骨架屏
 * ============================================ */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20rpx); }
  to { opacity: 1; transform: translateY(0); }
}

.fade-in { animation: fadeIn 0.3s ease-out; }

@keyframes shimmer {
  0% { background-position: -468rpx 0; }
  100% { background-position: 468rpx 0; }
}

.skeleton {
  background: linear-gradient(90deg, var(--divider) 25%, var(--bg-card) 50%, var(--divider) 75%);
  background-size: 936rpx 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--r-sm);
}
</style>
