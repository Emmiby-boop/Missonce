<template>
  <div class="space-y-6">
    <section class="glass-panel">
      <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h2 class="panel-title">管理员管理</h2>
          <p class="panel-sub">管理后台管理员账号</p>
        </div>
        <button class="btn-primary" @click="toggleAddDialog">
          添加管理员
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>手机号</th>
              <th>角色</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="5" class="text-center py-8 text-[var(--text-sub)]">
                加载中...
              </td>
            </tr>
            <tr v-else-if="admins.length === 0">
              <td colspan="5" class="text-center py-8 text-[var(--text-sub)]">
                暂无管理员
              </td>
            </tr>
            <tr v-else v-for="admin in admins" :key="admin._id">
              <td class="font-medium">{{ admin.username }}</td>
              <td class="text-[var(--text-sub)] text-sm">
                {{ admin.phone || '-' }}
              </td>
              <td>
                <span class="badge badge-success">{{ admin.role || 'admin' }}</span>
              </td>
              <td class="text-[var(--text-sub)] text-sm">
                {{ formatDate(admin.createdAt) }}
              </td>
              <td>
                <div class="flex gap-2">
                  <button class="btn-soft text-xs" @click="editAdmin(admin)">
                    编辑
                  </button>
                  <button 
                    v-if="admin.username !== currentUsername" 
                    class="btn-soft text-xs text-red-500 hover:bg-red-50" 
                    @click="deleteAdmin(admin)"
                  >
                    删除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 添加/编辑管理员对话框 -->
    <div v-if="showDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div class="w-full max-w-md rounded-2xl bg-[var(--bg-card)] p-6 shadow-xl transition-all">
        <h3 class="text-lg font-bold mb-6">
          {{ editingAdmin ? '编辑管理员' : '添加管理员' }}
        </h3>
        
        <div class="space-y-4">
          <div class="field">
            <label class="form-label">用户名</label>
            <input
              v-model="adminForm.username"
              type="text"
              class="input"
              placeholder="请输入用户名"
              :disabled="!!editingAdmin"
            />
          </div>

          <div v-if="!editingAdmin" class="field">
            <label class="form-label">密码</label>
            <input
              v-model="adminForm.password"
              type="password"
              class="input"
              placeholder="请输入密码"
            />
          </div>

          <div v-if="editingAdmin" class="field">
            <label class="form-label">新密码（留空则不修改）</label>
            <input
              v-model="adminForm.newPassword"
              type="password"
              class="input"
              placeholder="请输入新密码"
            />
          </div>

          <div class="field">
            <label class="form-label">手机号（用于手机号登录）</label>
            <input
              v-model="adminForm.phone"
              type="tel"
              maxlength="11"
              class="input"
              placeholder="请输入手机号（可留空）"
            />
          </div>

          <div class="field">
            <label class="form-label">角色</label>
            <select v-model="adminForm.role" class="input">
              <option value="admin">管理员</option>
              <option value="superadmin">超级管理员</option>
            </select>
          </div>
        </div>

        <div class="mt-8 flex justify-end gap-3">
          <button class="btn-soft" @click="showDialog = false" :disabled="saving">
            取消
          </button>
          <button class="btn-primary" @click="saveAdmin" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { db, callCloudFunction } from '../utils/cloudbase'
import { useAuthStore } from '../stores/auth'
import { logAudit } from '../utils/audit'
import { useMessage } from 'naive-ui'
import { confirmDeleteDialog } from '../composables/useDialog'

const message = useMessage()

const authStore = useAuthStore()

const loading = ref(false)
const saving = ref(false)
const admins = ref<any[]>([])
const showDialog = ref(false)
const editingAdmin = ref<any>(null)
const adminForm = ref({
  username: '',
  password: '',
  newPassword: '',
  phone: '',
  role: 'admin'
})

const currentUsername = computed(() => authStore.username)

const loadAdmins = async () => {
  loading.value = true
  try {
    const res = await db.collection('admins').orderBy('createdAt', 'desc').get()
    admins.value = res.data || []
  } catch (error) {
    console.error('加载管理员失败:', error)
    message.error('加载管理员失败')
  } finally {
    loading.value = false
  }
}

const formatDate = (date: any) => {
  if (!date) return '-'
  const d = new Date(date)
  return d.toLocaleString('zh-CN')
}

const toggleAddDialog = () => {
  editingAdmin.value = null
  adminForm.value = {
    username: '',
    password: '',
    newPassword: '',
    phone: '',
    role: 'admin'
  }
  showDialog.value = true
}

const editAdmin = (admin: any) => {
  editingAdmin.value = admin
  adminForm.value = {
    username: admin.username,
    password: '',
    newPassword: '',
    phone: admin.phone || '',
    role: admin.role || 'admin'
  }
  showDialog.value = true
}

const saveAdmin = async () => {
  if (!adminForm.value.username.trim()) {
    message.warning('请输入用户名')
    return
  }

  if (!editingAdmin.value && !adminForm.value.password.trim()) {
    message.warning('请输入密码')
    return
  }

  saving.value = true
  try {
    if (editingAdmin.value) {
      // 通过云函数更新管理员（密码由服务端 bcrypt 哈希）
      await callCloudFunction('adminAuth', {
        action: 'manageAdmins',
        data: {
          action: 'update',
          id: editingAdmin.value._id,
          role: adminForm.value.role,
          phone: adminForm.value.phone,
          ...(adminForm.value.newPassword.trim() ? { newPassword: adminForm.value.newPassword } : {})
        }
      })
    } else {
      // 通过云函数创建管理员（密码由服务端 bcrypt 哈希）
      await callCloudFunction('adminAuth', {
        action: 'manageAdmins',
        data: {
          action: 'create',
          username: adminForm.value.username,
          password: adminForm.value.password,
          phone: adminForm.value.phone,
          role: adminForm.value.role
        }
      })
    }

    showDialog.value = false
    await loadAdmins()
    message.success(editingAdmin.value ? '更新成功' : '创建成功')
    logAudit(
      editingAdmin.value ? 'update_admin' : 'create_admin',
      'admins',
      { username: adminForm.value.username, role: adminForm.value.role }
    )
  } catch (error) {
    console.error('保存管理员失败:', error)
    message.error((error as Error).message || '保存失败')
  } finally {
    saving.value = false
  }
}

const deleteAdmin = async (admin: any) => {
  const confirmed = await confirmDeleteDialog(`确定要删除管理员 "${admin.username}" 吗？`)
  if (!confirmed) return

  try {
    await callCloudFunction('adminAuth', {
      action: 'manageAdmins',
      data: {
        action: 'delete',
        id: admin._id
      }
    })
    await loadAdmins()
    message.success('删除成功')
    logAudit('delete_admin', 'admins', { username: admin.username, role: admin.role })
  } catch (error) {
    console.error('删除管理员失败:', error)
    message.error((error as Error).message || '删除失败')
  }
}

onMounted(() => {
  loadAdmins()
})
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

.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
}

.badge-success {
  background: #dcfce7;
  color: #166534;
}
</style>
