<template>
  <div class="page-config">
    <div class="page-header-block">
      <h1 class="page-title">页面管理</h1>
      <p class="page-subtitle">控制小程序页面的显示/隐藏</p>
    </div>

    <NSpin :show="loading">
      <!-- TabBar 页面 -->
      <NCard title="底部导航栏" class="config-card">
        <div class="page-list">
          <div
            v-for="(page, key) in tabPages"
            :key="key"
            class="page-item"
          >
            <div class="page-item-left">
              <div
                class="page-avatar"
                :class="page.enabled ? 'avatar-on' : 'avatar-off'"
              >
                {{ (page.title || key.split('/').pop() || '?').charAt(0) }}
              </div>
              <div>
                <div class="page-name">{{ page.title || key }}</div>
                <div class="page-path">{{ key }}</div>
              </div>
            </div>
            <NSwitch
              :value="page.enabled"
              @update:value="(v: boolean) => togglePage(key, v)"
            />
          </div>
        </div>
      </NCard>

      <!-- 子页面 -->
      <NCard title="子页面" class="config-card">
        <div class="page-list">
          <div
            v-for="(page, key) in subPages"
            :key="key"
            class="page-item"
          >
            <div class="page-item-left">
              <div
                class="page-avatar"
                :class="page.enabled ? 'avatar-on-sub' : 'avatar-off'"
              >
                {{ (page.title || key.split('/').pop() || '?').charAt(0) }}
              </div>
              <div>
                <div class="page-name">{{ page.title || key }}</div>
                <div class="page-path">{{ key }}</div>
              </div>
            </div>
            <NSwitch
              :value="page.enabled"
              @update:value="(v: boolean) => togglePage(key, v)"
            />
          </div>
        </div>
      </NCard>

      <!-- 说明 -->
      <NCard title="说明" class="config-card">
        <div class="tips">
          <p>1. 关闭底部导航栏页面后，小程序不会显示该 Tab</p>
          <p>2. 关闭子页面后，相关入口会隐藏</p>
          <p>3. 修改立即生效，用户下次打开小程序时生效</p>
        </div>
      </NCard>
    </NSpin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NSpin, NCard, NSwitch, useMessage } from 'naive-ui'
import mediaApi from '../services/mediaApi'

const message = useMessage()

const loading = ref(false)
const pageConfig = ref<Record<string, any>>({})

const tabPages = computed(() => {
  const result: Record<string, any> = {}
  for (const [key, val] of Object.entries(pageConfig.value)) {
    if (val.tab) result[key] = val
  }
  return result
})

const subPages = computed(() => {
  const result: Record<string, any> = {}
  for (const [key, val] of Object.entries(pageConfig.value)) {
    if (!val.tab) result[key] = val
  }
  return result
})

const loadConfig = async () => {
  loading.value = true
  try {
    const data = await mediaApi.getPageConfig()
    pageConfig.value = data.data?.pages || {}
  } catch (e) {
    console.error('加载页面配置失败:', e)
  } finally {
    loading.value = false
  }
}

const togglePage = async (key: string, enabled: boolean) => {
  // 保留原有 tab/title 字段，只更新 enabled，避免覆盖丢失字段
  const oldPage = pageConfig.value[key] || {}
  const newPage = { ...oldPage, enabled }
  pageConfig.value[key] = newPage
  try {
    const pages: Record<string, any> = {}
    pages[key] = newPage
    await mediaApi.savePageConfig({ pages })
    message.success(`${newPage.title || key} 已${enabled ? '启用' : '禁用'}`)
  } catch (e: any) {
    message.error(e.message || '保存失败')
    pageConfig.value[key].enabled = !enabled
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped>
.page-config {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.page-header-block {
  margin-bottom: 4px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--text-main);
  line-height: 1.2;
}

.page-subtitle {
  margin: 8px 0 0;
  font-size: 14px;
  color: var(--text-sub);
}

.config-card {
  margin-bottom: 16px;
}

.page-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.page-item-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.avatar-on {
  background: rgba(7, 193, 96, 0.1);
  color: #07c160;
}

.avatar-on-sub {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.avatar-off {
  background: #f3f4f6;
  color: #9ca3af;
}

.page-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-main);
}

.page-path {
  font-size: 12px;
  color: var(--text-sub);
}

.tips {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  color: var(--text-sub);
}

.tips p {
  margin: 0;
}
</style>
