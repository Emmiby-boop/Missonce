<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="glass-panel">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="panel-title">积分与签到管理</h2>
          <p class="panel-sub">签到/分享/邀请积分规则 · 积分流水 · 手动调整 · 签到统计</p>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 bg-[var(--bg-card)] rounded-xl p-1 border border-[var(--border-color)]">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all"
        :class="activeTab === tab.key ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab: 积分规则配置 -->
    <div v-if="activeTab === 'config'" class="glass-panel space-y-6">
      <div v-if="configLoading" class="animate-pulse space-y-4">
        <div v-for="i in 4" :key="i" class="h-12 bg-[var(--border-color)] rounded-lg"></div>
      </div>
      <template v-else>
        <div v-for="item in configFields" :key="item.key" class="flex items-center justify-between gap-4 py-3 border-b border-[var(--border-color)] last:border-0">
          <div>
            <p class="text-sm font-medium text-[var(--text-main)]">{{ item.label }}</p>
            <p class="text-xs text-[var(--text-sub)] mt-0.5">{{ item.desc }}</p>
          </div>
          <div class="flex items-center gap-2">
            <input
              v-model.number="configForm[item.key]"
              type="number"
              min="0"
              class="w-24 px-3 py-2 text-sm text-right rounded-lg border border-[var(--border-color)] bg-[var(--bg-body)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]"
            />
            <span class="text-xs text-[var(--text-sub)] w-16">{{ item.unit }}</span>
          </div>
        </div>
        <div class="flex justify-end pt-2">
          <button class="btn-primary" :disabled="savingConfig" @click="saveConfig">
            {{ savingConfig ? '保存中...' : '保存配置' }}
          </button>
        </div>
      </template>
    </div>

    <!-- Tab: 积分流水 -->
    <div v-if="activeTab === 'records'" class="space-y-4">
      <!-- Filters -->
      <div class="glass-panel flex flex-wrap gap-3 items-end">
        <div>
          <label class="text-xs text-[var(--text-sub)] block mb-1">用户ID</label>
          <input v-model="recordFilter.userId" placeholder="用户 openid" class="input w-44" />
        </div>
        <div>
          <label class="text-xs text-[var(--text-sub)] block mb-1">类型</label>
          <select v-model="recordFilter.type" class="select w-36">
            <option value="">全部</option>
            <option value="checkin">签到</option>
            <option value="share">分享</option>
            <option value="invite">邀请</option>
            <option value="watch_ad">看广告</option>
            <option value="exchange">兑换</option>
            <option value="admin_adjust">管理员调整</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-[var(--text-sub)] block mb-1">开始日期</label>
          <input v-model="recordFilter.startDate" type="date" class="input w-40" />
        </div>
        <div>
          <label class="text-xs text-[var(--text-sub)] block mb-1">结束日期</label>
          <input v-model="recordFilter.endDate" type="date" class="input w-40" />
        </div>
        <button class="btn-soft" @click="loadRecords(1)">查询</button>
      </div>

      <!-- Table -->
      <div class="glass-panel overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-[var(--text-sub)] border-b border-[var(--border-color)]">
              <th class="py-3 px-4 font-medium">用户</th>
              <th class="py-3 px-4 font-medium">类型</th>
              <th class="py-3 px-4 font-medium">变动</th>
              <th class="py-3 px-4 font-medium">余额</th>
              <th class="py-3 px-4 font-medium">原因</th>
              <th class="py-3 px-4 font-medium">时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="recordsLoading" class="animate-pulse">
              <td colspan="6" class="py-8 text-center text-[var(--text-sub)]">加载中...</td>
            </tr>
            <tr v-else-if="records.length === 0">
              <td colspan="6" class="py-8 text-center text-[var(--text-sub)]">暂无记录</td>
            </tr>
            <tr v-else v-for="r in records" :key="r._id" class="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-hover)]/50">
              <td class="py-3 px-4">
                <div class="flex items-center gap-2">
                  <img v-if="r.avatarUrl" :src="r.avatarUrl" class="w-6 h-6 rounded-full" />
                  <span class="truncate max-w-[120px]">{{ r.nickName }}</span>
                </div>
              </td>
              <td class="py-3 px-4">
                <span class="px-2 py-0.5 rounded text-xs font-medium" :style="typeStyle(r.type)">{{ typeLabel(r.type) }}</span>
              </td>
              <td class="py-3 px-4 font-mono" :class="(r.delta || 0) >= 0 ? 'text-green-500' : 'text-red-500'">
                {{ (r.delta || 0) >= 0 ? '+' : '' }}{{ r.delta || 0 }}
              </td>
              <td class="py-3 px-4 font-mono text-[var(--text-sub)]">{{ r.points || 0 }}</td>
              <td class="py-3 px-4 text-[var(--text-sub)] truncate max-w-[200px]">{{ r.reason || '-' }}</td>
              <td class="py-3 px-4 text-xs text-[var(--text-sub)]">{{ formatTime(r.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
        <!-- Pagination -->
        <div v-if="recordTotal > 0" class="flex items-center justify-between px-4 py-3 border-t border-[var(--border-color)]">
          <span class="text-xs text-[var(--text-sub)]">共 {{ recordTotal }} 条</span>
          <div class="flex gap-2">
            <button class="btn-soft text-xs px-3" :disabled="recordPage <= 1" @click="loadRecords(recordPage - 1)">上一页</button>
            <span class="text-xs text-[var(--text-sub)] leading-8">{{ recordPage }} / {{ Math.ceil(recordTotal / 20) }}</span>
            <button class="btn-soft text-xs px-3" :disabled="recordPage >= Math.ceil(recordTotal / 20)" @click="loadRecords(recordPage + 1)">下一页</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab: 手动调整积分 -->
    <div v-if="activeTab === 'adjust'" class="glass-panel space-y-5">
      <div>
        <label class="text-sm font-medium text-[var(--text-main)] block mb-1.5">用户 OpenID</label>
        <input v-model="adjustForm.userOpenid" placeholder="输入用户 openid" class="input w-full max-w-md" />
      </div>
      <div>
        <label class="text-sm font-medium text-[var(--text-main)] block mb-1.5">积分变动</label>
        <div class="flex items-center gap-2">
          <input v-model.number="adjustForm.delta" type="number" placeholder="正数增加，负数扣减" class="input w-48" />
          <span class="text-xs text-[var(--text-sub)]">积分</span>
        </div>
      </div>
      <div>
        <label class="text-sm font-medium text-[var(--text-main)] block mb-1.5">原因</label>
        <input v-model="adjustForm.reason" placeholder="调整原因" class="input w-full max-w-md" />
      </div>
      <div class="flex gap-3">
        <button class="btn-primary" :disabled="adjusting" @click="doAdjust">
          {{ adjusting ? '处理中...' : '确认调整' }}
        </button>
      </div>
    </div>

    <!-- Tab: 签到统计 -->
    <div v-if="activeTab === 'stats'" class="space-y-4">
      <div class="glass-panel flex items-center gap-3">
        <span class="text-sm text-[var(--text-sub)]">最近天数：</span>
        <select v-model="statsDays" class="select w-24" @change="loadStats">
          <option :value="7">7天</option>
          <option :value="14">14天</option>
          <option :value="30">30天</option>
        </select>
      </div>

      <div v-if="statsLoading" class="glass-panel animate-pulse py-16 text-center text-[var(--text-sub)]">加载中...</div>
      <template v-else-if="statsData">
        <!-- Summary Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="glass-panel text-center">
            <p class="text-2xl font-bold text-[var(--primary)]">{{ statsData.totalCheckIns || 0 }}</p>
            <p class="text-xs text-[var(--text-sub)] mt-1">总签到人数</p>
          </div>
          <div class="glass-panel text-center">
            <p class="text-2xl font-bold text-blue-500">{{ statsData.avgDaily || 0 }}</p>
            <p class="text-xs text-[var(--text-sub)] mt-1">日均签到</p>
          </div>
          <div class="glass-panel text-center">
            <p class="text-2xl font-bold text-purple-500">{{ (statsData.daily || []).reduce((max, d) => Math.max(max, d.count), 0) }}</p>
            <p class="text-xs text-[var(--text-sub)] mt-1">峰值签到</p>
          </div>
          <div class="glass-panel text-center">
            <p class="text-2xl font-bold text-orange-500">{{ Object.keys(statsData.streakDistribution || {}).length }}</p>
            <p class="text-xs text-[var(--text-sub)] mt-1">连签梯度</p>
          </div>
        </div>

        <!-- Daily Chart -->
        <div class="glass-panel">
          <h3 class="text-sm font-semibold text-[var(--text-main)] mb-4">每日签到人数</h3>
          <div class="flex items-end gap-1 h-32">
            <div
              v-for="d in (statsData.daily || [])"
              :key="d.date"
              class="flex-1 rounded-t transition-all hover:opacity-80"
              :style="{
                height: Math.max(4, (d.count / Math.max(...(statsData.daily || []).map(x => x.count), 1)) * 100) + '%',
                background: 'var(--primary)'
              }"
              :title="`${d.date}: ${d.count}人`"
            ></div>
          </div>
          <div class="flex justify-between mt-2 text-xs text-[var(--text-sub)]">
            <span>{{ (statsData.daily || [])[0]?.date }}</span>
            <span>{{ (statsData.daily || [])[(statsData.daily || []).length - 1]?.date }}</span>
          </div>
        </div>

        <!-- Streak Distribution -->
        <div class="glass-panel">
          <h3 class="text-sm font-semibold text-[var(--text-main)] mb-4">连签天数分布</h3>
          <div class="space-y-2">
            <div v-for="(count, bucket) in (statsData.streakDistribution || {})" :key="bucket" class="flex items-center gap-3">
              <span class="text-xs text-[var(--text-sub)] w-16 shrink-0">{{ bucket }} 天</span>
              <div class="flex-1 h-6 bg-[var(--bg-body)] rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all"
                  :style="{
                    width: (count / Math.max(...Object.values(statsData.streakDistribution || {}), 1) * 100) + '%',
                    background: 'linear-gradient(90deg, var(--primary), #34d399)'
                  }"
                ></div>
              </div>
              <span class="text-xs font-mono text-[var(--text-sub)] w-12 text-right">{{ count }}人</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import { callCloudFunction } from '../utils/cloudbase'

const message = useMessage()

const tabs = [
  { key: 'config', label: '辣度值规则' },
  { key: 'records', label: '辣度值流水' },
  { key: 'adjust', label: '手动调整' },
  { key: 'stats', label: '签到统计' }
]
const activeTab = ref('config')

// ====== 积分规则配置 ======
const configLoading = ref(false)
const savingConfig = ref(false)
const configForm = reactive<Record<string, number>>({
  checkInReward: 10,
  shareReward: 10,
  shareDailyLimit: 5,
  inviteReward: 50
})

const configFields = [
  { key: 'checkInReward', label: '签到奖励', desc: '每日签到获得的辣度值', unit: '辣度值/次' },
  { key: 'shareReward', label: '分享奖励', desc: '分享给好友获得的辣度值', unit: '辣度值/次' },
  { key: 'shareDailyLimit', label: '分享每日上限', desc: '每天通过分享最多获得几次奖励', unit: '次/天' },
  { key: 'inviteReward', label: '邀请奖励', desc: '成功邀请一位好友的辣度值', unit: '辣度值/人' }
]
// 注：看广告奖励、每日广告上限 由「下载管理」页面统一配置
// 文案穿插频率 由「文案管理」页面统一配置

async function loadConfig() {
  configLoading.value = true
  try {
    const res = await callCloudFunction('managePointsConfig', { action: 'getConfig' })
    if (res?.data) {
      Object.keys(configForm).forEach(key => {
        if (res.data[key] !== undefined) configForm[key] = res.data[key]
      })
    }
  } catch (e) {
    console.error(e)
  } finally {
    configLoading.value = false
  }
}

async function saveConfig() {
  savingConfig.value = true
  try {
    await callCloudFunction('managePointsConfig', { action: 'updateConfig', data: { ...configForm } })
    message.success('配置已保存')
  } catch (e: any) {
    message.error(e.message || '保存失败')
  } finally {
    savingConfig.value = false
  }
}

// ====== 辣度值流水 ======
const recordFilter = reactive({ userId: '', type: '', startDate: '', endDate: '' })
const records = ref<any[]>([])
const recordsLoading = ref(false)
const recordPage = ref(1)
const recordTotal = ref(0)

async function loadRecords(page = 1) {
  recordPage.value = page
  recordsLoading.value = true
  try {
    const res = await callCloudFunction('managePointsConfig', {
      action: 'getPointsRecords',
      page,
      limit: 20,
      ...recordFilter
    })
    records.value = res?.data || []
    recordTotal.value = res?.total || 0
  } catch (_e: any) {
    message.error('查询失败')
  } finally {
    recordsLoading.value = false
  }
}

// ====== 手动调整 ======
const adjustForm = reactive({ userOpenid: '', delta: 0, reason: '' })
const adjusting = ref(false)

async function doAdjust() {
  if (!adjustForm.userOpenid) return message.warning('请输入用户 OpenID')
  if (!adjustForm.delta || adjustForm.delta === 0) return message.warning('请输入辣度值变动值')
  adjusting.value = true
  try {
    const res = await callCloudFunction('managePointsConfig', {
      action: 'adjustPoints',
      userOpenid: adjustForm.userOpenid,
      delta: adjustForm.delta,
      reason: adjustForm.reason
    })
    message.success(res?.message || '调整成功')
    adjustForm.userOpenid = ''
    adjustForm.delta = 0
    adjustForm.reason = ''
  } catch (e: any) {
    message.error(e.message || '调整失败')
  } finally {
    adjusting.value = false
  }
}

// ====== 签到统计 ======
const statsDays = ref(30)
const statsData = ref<any>(null)
const statsLoading = ref(false)

async function loadStats() {
  statsLoading.value = true
  try {
    const res = await callCloudFunction('managePointsConfig', {
      action: 'getCheckInStats',
      days: statsDays.value
    })
    statsData.value = res?.data || null
  } catch (_e: any) {
    message.error('统计查询失败')
  } finally {
    statsLoading.value = false
  }
}

// ====== 辅助函数 ======
function typeLabel(type: string) {
  const map: Record<string, string> = {
    checkin: '签到', share: '分享', invite: '邀请',
    watch_ad: '看广告', exchange: '兑换', admin_adjust: '管理员调整',
    download: '下载消耗'
  }
  return map[type] || type
}

function typeStyle(type: string) {
  const map: Record<string, Record<string, string>> = {
    checkin: { background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' },
    share: { background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' },
    invite: { background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' },
    watch_ad: { background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' },
    exchange: { background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' },
    admin_adjust: { background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }
  }
  return map[type] || { background: 'rgba(100, 116, 139, 0.1)', color: '#64748b' }
}

function formatTime(t: any) {
  if (!t) return '-'
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

onMounted(() => {
  loadConfig()
  loadRecords()
  loadStats()
})
</script>
