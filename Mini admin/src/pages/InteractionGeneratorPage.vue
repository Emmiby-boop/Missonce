<template>
  <div class="space-y-8">
    <section class="glass-panel">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="panel-title">互动数据生成</h2>
          <p class="panel-sub">AI模拟真实用户生成点赞、浏览、评论数据</p>
        </div>
        <div class="flex gap-2">
          <button class="btn-soft" @click="loadStats" :disabled="loading">
            <span v-if="loading" class="inline-block animate-spin mr-2">⟳</span>
            刷新统计
          </button>
        </div>
      </div>
    </section>

    <!-- 统计概览 -->
    <section class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <div class="stat-card">
        <div class="stat-icon">👍</div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.totalLikes }}</div>
          <div class="stat-label">总点赞数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">👁️</div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.totalViews }}</div>
          <div class="stat-label">总浏览数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">💬</div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.totalComments }}</div>
          <div class="stat-label">总评论数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📦</div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.resourcesWithoutInteraction }}</div>
          <div class="stat-label">无互动资源</div>
        </div>
      </div>
    </section>

    <!-- 生成配置 -->
    <section class="glass-panel">
      <h3 class="text-lg font-semibold mb-4">生成配置</h3>
      
      <div class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <label class="field">
          <span>资源类型</span>
          <select v-model="config.type" class="input">
            <option value="all">全部</option>
            <option value="avatar">仅头像</option>
            <option value="wallpaper">仅壁纸</option>
          </select>
        </label>
        
        <label class="field">
          <span>生成模式</span>
          <select v-model="config.mode" class="input">
            <option value="empty">仅无互动资源</option>
            <option value="all">所有资源</option>
            <option value="random">随机选择</option>
          </select>
        </label>
        
        <label class="field">
          <span>资源数量限制</span>
          <input type="number" v-model.number="config.limit" class="input" min="1" max="100" />
        </label>
        
        <label class="field">
          <span>每资源点赞范围</span>
          <div class="flex gap-2 items-center">
            <input type="number" v-model.number="config.likeMin" class="input flex-1" min="0" />
            <span>~</span>
            <input type="number" v-model.number="config.likeMax" class="input flex-1" min="0" />
          </div>
        </label>
        
        <label class="field">
          <span>每资源浏览范围</span>
          <div class="flex gap-2 items-center">
            <input type="number" v-model.number="config.viewMin" class="input flex-1" min="0" />
            <span>~</span>
            <input type="number" v-model.number="config.viewMax" class="input flex-1" min="0" />
          </div>
        </label>
        
        <label class="field">
          <span>每资源评论范围</span>
          <div class="flex gap-2 items-center">
            <input type="number" v-model.number="config.commentMin" class="input flex-1" min="0" />
            <span>~</span>
            <input type="number" v-model.number="config.commentMax" class="input flex-1" min="0" />
          </div>
        </label>
      </div>
      
      <div class="mt-4 flex gap-3">
        <button 
          class="btn-primary" 
          @click="startGenerate" 
          :disabled="generating"
        >
          <span v-if="generating" class="inline-block animate-spin mr-2">⟳</span>
          {{ generating ? `生成中 ${progress.current}/${progress.total}` : '开始生成' }}
        </button>
        <button 
          class="btn-soft" 
          @click="clearTestData" 
          :disabled="generating"
        >
          清除测试数据
        </button>
      </div>
    </section>

    <!-- AI 评论配置 -->
    <section class="glass-panel">
      <h3 class="text-lg font-semibold mb-4">AI 评论配置</h3>
      
      <div class="grid gap-4">
        <label class="field">
          <span>评论风格</span>
          <select v-model="config.commentStyle" class="input">
            <option value="casual">轻松活泼</option>
            <option value="sincere">真诚自然</option>
            <option value="enthusiastic">热情洋溢</option>
            <option value="minimalist">简洁文艺</option>
          </select>
        </label>
        
        <label class="field">
          <span>自定义评论提示词（可选）</span>
          <textarea 
            v-model="config.customPrompt" 
            class="input min-h-[80px]" 
            placeholder="例如：请用00后网络流行语风格评论..."
          ></textarea>
        </label>
        
        <div class="flex items-center gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="config.useAI" class="checkbox" />
            <span>使用 AI 生成评论内容</span>
          </label>
          <span class="text-xs text-[var(--text-sub)]">
            {{ config.useAI ? '将调用 AI 模型生成评论' : '使用预设评论模板' }}
          </span>
        </div>
      </div>
    </section>

    <!-- 生成日志 -->
    <section class="glass-panel" v-if="logs.length > 0">
      <h3 class="text-lg font-semibold mb-4">生成日志</h3>
      <div class="log-container">
        <div v-for="(log, index) in logs" :key="index" class="log-item" :class="log.type">
          <span class="log-time">{{ log.time }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
    </section>

    <!-- 进度条 -->
    <div v-if="generating" class="progress-container">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <div class="progress-text">
        {{ Math.round(progressPercent) }}% - {{ progress.status }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { callCloudFunction } from '../utils/cloudbase'

// 统计数据
const stats = ref({
  totalLikes: 0,
  totalViews: 0,
  totalComments: 0,
  resourcesWithoutInteraction: 0
})

// 配置
const config = ref({
  type: 'all',
  mode: 'empty',
  limit: 20,
  likeMin: 5,
  likeMax: 30,
  viewMin: 50,
  viewMax: 300,
  commentMin: 1,
  commentMax: 5,
  useAI: true,
  commentStyle: 'casual',
  customPrompt: ''
})

// 状态
const loading = ref(false)
const generating = ref(false)
const logs = ref<Array<{ time: string; message: string; type: string }>>([])
const progress = ref({ current: 0, total: 0, status: '' })

const progressPercent = computed(() => {
  if (progress.value.total === 0) return 0
  return (progress.value.current / progress.value.total) * 100
})

// 添加日志
function addLog(message: string, type: 'info' | 'success' | 'error' = 'info') {
  const now = new Date()
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
  logs.value.unshift({ time, message, type })
  // 保留最近 100 条
  if (logs.value.length > 100) logs.value.pop()
}

// 加载统计
async function loadStats() {
  loading.value = true
  try {
    const res = await callCloudFunction('interactionStats', { action: 'getStats' })
    if (res?.success) {
      stats.value = res.data
    }
  } catch (e) {
    console.error('加载统计失败:', e)
  } finally {
    loading.value = false
  }
}

// 开始生成
async function startGenerate() {
  if (generating.value) return
  
  generating.value = true
  logs.value = []
  progress.value = { current: 0, total: 0, status: '初始化...' }
  
  addLog('开始生成互动数据...', 'info')
  
  try {
    const res = await callCloudFunction('generateInteractionData', {
      action: 'generate',
      config: config.value
    })
    
    if (res?.success) {
      const data = res.data
      addLog(`生成完成！处理了 ${data.processed} 个资源`, 'success')
      addLog(`点赞: ${data.likes}, 浏览: ${data.views}, 评论: ${data.comments}`, 'success')
      
      // 刷新统计
      await loadStats()
    } else {
      addLog(`生成失败: ${res?.message}`, 'error')
    }
  } catch (e: any) {
    addLog(`错误: ${e.message}`, 'error')
  } finally {
    generating.value = false
    progress.value = { current: 0, total: 0, status: '' }
  }
}

// 清除测试数据
async function clearTestData() {
  if (!confirm('确定要清除所有测试数据吗？此操作不可恢复。')) return
  
  addLog('开始清除测试数据...', 'info')
  
  try {
    const res = await callCloudFunction('generateInteractionData', { action: 'clear' })
    if (res?.success) {
      addLog(`清除完成！删除了 ${res.data.deleted} 条记录`, 'success')
      await loadStats()
    }
  } catch (e: any) {
    addLog(`清除失败: ${e.message}`, 'error')
  }
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: var(--bg-card);
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.stat-icon {
  font-size: 32px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
}

.stat-label {
  font-size: 14px;
  color: var(--text-sub);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field span {
  font-size: 14px;
  color: var(--text-sub);
}

.input {
  padding: 10px 14px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-base);
  color: var(--text-main);
  font-size: 14px;
}

.input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.log-container {
  max-height: 300px;
  overflow-y: auto;
  background: var(--bg-base);
  border-radius: 8px;
  padding: 12px;
}

.log-item {
  display: flex;
  gap: 12px;
  padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px solid var(--border-color);
}

.log-item:last-child {
  border-bottom: none;
}

.log-item.success {
  color: #10b981;
}

.log-item.error {
  color: #ef4444;
}

.log-time {
  color: var(--text-sub);
  font-family: monospace;
}

.progress-container {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 400px;
  max-width: calc(100% - 40px);
  padding: 16px;
  background: var(--bg-card);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}

.progress-bar {
  height: 8px;
  background: var(--bg-base);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent-color);
  transition: width 0.3s ease;
}

.progress-text {
  text-align: center;
  margin-top: 8px;
  font-size: 14px;
  color: var(--text-sub);
}

.checkbox {
  width: 18px;
  height: 18px;
  accent-color: var(--accent-color);
}
</style>
