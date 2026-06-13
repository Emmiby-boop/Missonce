<template>
  <div class="space-y-6">
    <!-- 搜索区域 -->
    <section class="glass-panel">
      <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h2 class="panel-title">用户管理</h2>
          <p class="panel-sub">搜索用户并管理会员状态，让指定用户免广告下载</p>
        </div>
      </div>

      <div class="flex gap-3 items-end">
        <div class="flex-1 min-w-0" style="max-width: 400px">
          <label class="form-label">用户 ID 后六位</label>
          <input
            v-model="searchKeyword"
            type="text"
            class="form-input"
            placeholder="例如 EWUM8（不区分大小写）"
            maxlength="20"
            @keyup.enter="handleSearch"
          />
        </div>
        <button class="btn-primary" @click="handleSearch" :disabled="searching">
          {{ searching ? '搜索中...' : '搜索' }}
        </button>
        <button class="btn-soft" @click="handleLoadAll" :disabled="loadingAll">
          {{ loadingAll ? '加载中...' : '查看全部用户' }}
        </button>
      </div>
    </section>

    <!-- 搜索结果 -->
    <section class="glass-panel" v-if="hasSearched">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-semibold">
          {{ searchKeyword ? `搜索结果（${users.length} 条）` : `全部用户（${totalCount} 条）` }}
        </h3>
        <div v-if="pagination.total > pagination.limit" class="flex gap-2">
          <button
            class="btn-soft text-xs"
            :disabled="pagination.page <= 1"
            @click="pagination.page--; loadUserList()"
          >上一页</button>
          <span class="text-sm text-[var(--text-sub)] leading-8">
            {{ pagination.page }} / {{ Math.ceil(pagination.total / pagination.limit) }}
          </span>
          <button
            class="btn-soft text-xs"
            :disabled="pagination.page * pagination.limit >= pagination.total"
            @click="pagination.page++; loadUserList()"
          >下一页</button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>昵称</th>
              <th>用户 ID</th>
              <th>注册时间</th>
              <th>最后登录</th>
              <th>积分</th>
              <th>会员等级</th>
              <th>到期时间</th>
              <th>签到</th>
              <th>剩余下载</th>
              <th>免广告</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loadingUsers">
              <td colspan="11" class="text-center py-8 text-[var(--text-sub)]">
                加载中...
              </td>
            </tr>
            <tr v-else-if="users.length === 0">
              <td colspan="11" class="text-center py-8 text-[var(--text-sub)]">
                {{ searchKeyword ? '未找到匹配的用户' : '暂无用户数据' }}
              </td>
            </tr>
            <tr v-else v-for="user in users" :key="user._openid">
              <td>
                <div class="flex items-center gap-2">
                  <img
                    v-if="user.avatarUrl"
                    :src="user.avatarUrl"
                    class="w-8 h-8 rounded-full object-cover"
                  />
                  <div>
                    <span class="font-medium">{{ user.nickName }}</span>
                    <div v-if="!user.hasPointsRecord" class="text-xs text-orange-500">
                      未激活
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <code class="text-xs bg-[var(--bg-body)] px-2 py-1 rounded cursor-pointer select-all" :title="'点击复制: ' + user._openid">
                  ...{{ user._openid.slice(-6) }}
                </code>
              </td>
              <td class="text-sm text-[var(--text-sub)] whitespace-nowrap">
                {{ formatDateTime(user.registeredAt) }}
              </td>
              <td class="text-sm text-[var(--text-sub)] whitespace-nowrap">
                {{ formatDateTime(user.lastLoginAt) }}
              </td>
              <td class="font-medium">{{ user.points }}</td>
              <td>
                <span
                  class="badge"
                  :class="memberBadgeClass(user.memberLevel)"
                >
                  {{ memberLevelText(user.memberLevel) }}
                </span>
              </td>
              <td class="text-sm text-[var(--text-sub)]">
                {{ formatExpireDate(user.memberExpireDate, user.memberLevel) }}
              </td>
              <td class="text-sm text-[var(--text-sub)]">
                {{ user.checkInDays }}天
                <span v-if="user.totalCheckInDays && user.totalCheckInDays !== user.checkInDays" class="text-xs text-[var(--text-sub)] opacity-60">
                  / 累计{{ user.totalCheckInDays }}天
                </span>
              </td>
              <td class="text-sm">
                <span :class="(user.downloadsRemaining || 0) > 0 ? 'text-green-600 font-medium' : 'text-[var(--text-sub)]'">
                  {{ user.downloadsRemaining || 0 }}
                </span>
              </td>
              <td>
                <span
                  class="badge"
                  :class="user.skipAd ? 'badge-green' : 'badge-default'"
                >
                  {{ user.skipAd ? '已跳过' : '正常' }}
                </span>
              </td>
              <td>
                <button class="btn-soft text-xs" @click="openEditDialog(user)">
                  管理会员
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 编辑会员弹窗 -->
    <div v-if="showEditDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div class="w-full max-w-md rounded-2xl bg-[var(--bg-card)] p-6 shadow-xl">
        <h3 class="text-lg font-bold mb-2">管理会员</h3>
        <p class="text-sm text-[var(--text-sub)] mb-6">
          用户：{{ editUser?.nickName }}
          <code class="text-xs bg-[var(--bg-body)] px-1.5 py-0.5 rounded ml-1">
            ...{{ editUser?._openid?.slice(-6) }}
          </code>
        </p>

        <div class="space-y-4">
          <!-- 当前状态 -->
          <div class="bg-[var(--bg-body)] rounded-lg p-3 text-sm">
            <div class="grid grid-cols-2 gap-2">
              <span class="text-[var(--text-sub)]">当前会员等级</span>
              <span class="font-medium text-right">{{ memberLevelText(editUser?.memberLevel) }}</span>
              <span class="text-[var(--text-sub)]">当前积分</span>
              <span class="font-medium text-right">{{ editUser?.points }}</span>
              <span class="text-[var(--text-sub)]">到期时间</span>
              <span class="font-medium text-right">{{ formatExpireDate(editUser?.memberExpireDate, editUser?.memberLevel) }}</span>
              <span class="text-[var(--text-sub)]">免广告</span>
              <span class="font-medium text-right">{{ editUser?.skipAd ? '已跳过' : '正常' }}</span>
            </div>
          </div>

          <!-- 会员等级选择 -->
          <div class="form-group">
            <label class="form-label">会员等级</label>
            <select v-model="editForm.memberLevel" class="form-input">
              <option value="none">非会员</option>
              <option value="weekly">周卡会员（7天）</option>
              <option value="monthly">月卡会员（30天）</option>
              <option value="quarterly">季卡会员（90天）</option>
              <option value="yearly">年卡会员（365天）</option>
              <option value="lifetime">终身会员</option>
            </select>
          </div>

          <!-- 过期时间（非终身时显示） -->
          <div class="form-group" v-if="editForm.memberLevel !== 'none' && editForm.memberLevel !== 'lifetime'">
            <label class="form-label">到期时间</label>
            <input
              v-model="editForm.memberExpireDate"
              type="date"
              class="form-input"
            />
            <p class="text-xs text-[var(--text-sub)] mt-1">
              留空则根据会员等级自动计算
            </p>
          </div>

          <!-- 积分调整（可选） -->
          <div class="form-group">
            <label class="form-label">积分余额（可选）</label>
            <input
              v-model.number="editForm.points"
              type="number"
              class="form-input"
              placeholder="修改用户积分，留空不修改"
              min="0"
            />
          </div>

          <!-- 免广告开关 -->
          <div class="form-group">
            <label class="form-label">跳过广告（调试用）</label>
            <label class="flex items-center gap-3 cursor-pointer select-none">
              <div
                class="relative w-11 h-6 rounded-full transition-colors duration-200"
                :class="editForm.skipAd ? 'bg-green-500' : 'bg-gray-300'"
                @click="editForm.skipAd = !editForm.skipAd"
              >
                <div
                  class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                  :class="editForm.skipAd ? 'translate-x-5' : ''"
                ></div>
              </div>
              <span class="text-sm text-[var(--text-sub)]">
                {{ editForm.skipAd ? '已开启 — 用户无需观看任何广告' : '已关闭 — 正常展示广告' }}
              </span>
            </label>
          </div>

          <!-- 重置激励广告次数 -->
          <div class="form-group pt-2 border-t border-[var(--border-color)]">
            <label class="form-label">重置今日广告次数</label>
            <p class="text-xs text-[var(--text-sub)] mb-2">
              删除该用户今天的观看激励视频记录，用户可重新观看赚取积分。
              相应的积分也会被扣减（每次 20 积分）。
            </p>
            <button
              class="btn-soft text-sm"
              :class="resettingAd ? 'opacity-50 cursor-not-allowed' : ''"
              :disabled="resettingAd"
              @click="resetWatchAdCount"
            >
              {{ resettingAd ? '重置中...' : '重置今日广告次数' }}
            </button>
            <span v-if="resetAdResult" class="ml-3 text-sm" :class="resetAdResult.success ? 'text-green-600' : 'text-red-500'">
              {{ resetAdResult.message }}
            </span>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-3">
          <button class="btn-soft" @click="showEditDialog = false" :disabled="saving">
            取消
          </button>
          <button class="btn-primary" @click="saveMembership" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { callCloudFunction } from '../utils/cloudbase'
import { ElMessage } from 'element-plus'

// 搜索相关
const searchKeyword = ref('')
const searching = ref(false)
const loadingAll = ref(false)
const loadingUsers = ref(false)
const hasSearched = ref(false)
const users = ref<any[]>([])
const totalCount = ref(0)

// 分页
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
})

// 编辑弹窗
const showEditDialog = ref(false)
const saving = ref(false)
const resettingAd = ref(false)
const resetAdResult = ref<{ success: boolean; message: string } | null>(null)
const editUser = ref<any>(null)
const editForm = reactive({
  memberLevel: 'none',
  memberExpireDate: '',
  points: '' as number | string,
  skipAd: false
})

// 会员等级映射
const MEMBER_LEVELS: Record<string, string> = {
  none: '非会员',
  weekly: '周卡',
  monthly: '月卡',
  quarterly: '季卡',
  yearly: '年卡',
  lifetime: '终身'
}

function memberLevelText(level?: string) {
  return MEMBER_LEVELS[level || 'none'] || level || '未知'
}

function memberBadgeClass(level?: string) {
  if (level === 'lifetime') return 'badge-purple'
  if (level === 'yearly') return 'badge-blue'
  if (level === 'quarterly') return 'badge-cyan'
  if (level === 'monthly') return 'badge-green'
  if (level === 'weekly') return 'badge-yellow'
  return 'badge-default'
}

function formatExpireDate(date: any, level?: string) {
  if (level === 'lifetime') return '永久'
  if (!date) return '-'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('zh-CN')
}

function formatDateTime(date: any): string {
  if (!date) return '-'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '-'
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

// 搜索用户
async function handleSearch() {
  const keyword = searchKeyword.value.trim()
  if (!keyword) {
    ElMessage.warning('请输入用户 ID 后六位')
    return
  }

  searching.value = true
  hasSearched.value = true

  try {
    const res = await callCloudFunction('adminUserManager', {
      action: 'searchUser',
      keyword
    })

    users.value = res.data || []
    totalCount.value = res.total || 0
    pagination.total = res.total || 0
  } catch (error: any) {
    console.error('搜索用户失败:', error)
    ElMessage.error(error.message || '搜索失败')
    users.value = []
    totalCount.value = 0
  } finally {
    searching.value = false
  }
}

// 加载全部用户
async function handleLoadAll() {
  searchKeyword.value = ''
  pagination.page = 1
  await loadUserList()
}

async function loadUserList() {
  loadingAll.value = true
  loadingUsers.value = true
  hasSearched.value = true

  try {
    const res = await callCloudFunction('adminUserManager', {
      action: 'getUserList',
      page: pagination.page,
      limit: pagination.limit
    })

    users.value = res.data || []
    totalCount.value = res.total || 0
    pagination.total = res.total || 0
  } catch (error: any) {
    console.error('加载用户列表失败:', error)
    ElMessage.error(error.message || '加载失败')
    users.value = []
    totalCount.value = 0
  } finally {
    loadingAll.value = false
    loadingUsers.value = false
  }
}

// 打开编辑弹窗
function openEditDialog(user: any) {
  editUser.value = user
  editForm.memberLevel = user.memberLevel || 'none'
  editForm.memberExpireDate = ''
  editForm.points = ''
  editForm.skipAd = !!user.skipAd
  resetAdResult.value = null
  showEditDialog.value = true
}

// 重置今日广告次数
async function resetWatchAdCount() {
  if (!editUser.value) return

  resettingAd.value = true
  resetAdResult.value = null

  try {
    const res = await callCloudFunction('adminUserManager', {
      action: 'resetWatchAdCount',
      userOpenid: editUser.value._openid
    })

    resetAdResult.value = {
      success: res?.success,
      message: res?.message || '操作完成'
    }

    if (res?.success) {
      ElMessage.success(res.message || '重置成功')
    } else {
      ElMessage.warning(res.message || '重置失败')
    }
  } catch (error: any) {
    resetAdResult.value = {
      success: false,
      message: error.message || '请求失败'
    }
    ElMessage.error(error.message || '请求失败')
  } finally {
    resettingAd.value = false
  }
}

// 保存会员设置
async function saveMembership() {
  if (!editUser.value) return

  saving.value = true

  try {
    const params: any = {
      action: 'updateMembership',
      userOpenid: editUser.value._openid,
      memberLevel: editForm.memberLevel,
    }

    if (editForm.memberExpireDate) {
      params.memberExpireDate = editForm.memberExpireDate
    }

    if (editForm.points !== '' && Number(editForm.points) >= 0) {
      params.points = Number(editForm.points)
    }

    params.skipAd = editForm.skipAd

    const res = await callCloudFunction('adminUserManager', params)

    ElMessage.success(res.message || '更新成功')
    showEditDialog.value = false

    // 刷新列表
    if (searchKeyword.value.trim()) {
      await handleSearch()
    } else if (hasSearched.value) {
      await loadUserList()
    }
  } catch (error: any) {
    console.error('更新会员失败:', error)
    ElMessage.error(error.message || '更新失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table thead {
  background: var(--bg-body);
}

.data-table th {
  padding: 12px 16px;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-sub);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 2px solid var(--border-color);
  white-space: nowrap;
}

.data-table td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  font-size: 14px;
  color: var(--text-main);
}

.data-table tbody tr:hover {
  background: var(--bg-body);
}

/* Badge 样式 */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
}

.badge-default {
  background: #f3f4f6;
  color: #6b7280;
}

.badge-yellow {
  background: #fef3c7;
  color: #92400e;
}

.badge-green {
  background: #dcfce7;
  color: #166534;
}

.badge-cyan {
  background: #cffafe;
  color: #155e75;
}

.badge-blue {
  background: #dbeafe;
  color: #1e40af;
}

.badge-purple {
  background: #ede9fe;
  color: #5b21b6;
}
</style>
