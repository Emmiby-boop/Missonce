<template>
  <div class="home-page">
    <div class="home-container">
      <div class="brand-section">
        <div class="brand-logo">
          <span class="brand-dot"></span>
        </div>
        <h1 class="brand-title">Mini Admin</h1>
        <p class="brand-sub">CloudBase 云开发后台管理系统</p>
      </div>

      <div class="action-card glass-panel">
        <div class="card-content">
          <h2 class="welcome-title">欢迎使用</h2>
          <p class="welcome-desc">
            这是一个基于 Vue 3 + Tailwind CSS + CloudBase 构建的现代化后台管理系统。
            提供了一套完整的 UI 设计规范和丰富的功能组件。
          </p>
          
          <div class="features-grid">
            <div class="feature-item">
              <div class="feature-icon">⚡</div>
              <div class="feature-text">快速响应</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">🎨</div>
              <div class="feature-text">现代化 UI</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">📱</div>
              <div class="feature-text">多端适配</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">☁️</div>
              <div class="feature-text">云开发</div>
            </div>
          </div>

          <div class="action-buttons">
            <router-link to="/login" class="btn-primary start-btn">
              立即开始
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </router-link>
          </div>
        </div>
      </div>
      
      <div class="footer-info">
        <p>© 2024 Mini Admin. All rights reserved.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// HomePage component
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-body);
  padding: 20px;
}

.home-container {
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.brand-section {
  text-align: center;
}

.brand-logo {
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  box-shadow: 0 12px 24px rgba(7, 193, 96, 0.25);
}

.brand-dot {
  width: 16px;
  height: 16px;
  background: #fff;
  border-radius: 50%;
}

.brand-title {
  font-size: 32px;
  font-weight: 800;
  color: var(--text-main);
  margin: 0 0 8px;
  letter-spacing: -0.5px;
}

.brand-sub {
  font-size: 16px;
  color: var(--text-sub);
  margin: 0;
}

.action-card {
  background: var(--bg-card);
  padding: 40px;
  border-radius: 24px;
  box-shadow: 0 20px 40px -4px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--border-color);
}

.welcome-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 12px;
  text-align: center;
}

.welcome-desc {
  font-size: 15px;
  color: var(--text-sub);
  line-height: 1.6;
  text-align: center;
  margin-bottom: 32px;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.feature-item {
  background: var(--bg-body);
  padding: 16px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.3s ease;
}

.feature-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.feature-icon {
  font-size: 20px;
}

.feature-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-main);
}

.start-btn {
  width: 100%;
  padding: 14px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--primary);
  color: white;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(7, 193, 96, 0.3);
}

.start-btn:hover {
  background: var(--primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(7, 193, 96, 0.4);
}

.footer-info {
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
