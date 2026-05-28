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
              <th>角色</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="4" class="text-center py-8 text-[var(--text-sub)]">
                加载中...
              </td>
            </tr>
            <tr v-else-if="admins.length === 0">
              <td colspan="4" class="text-center py-8 text-[var(--text-sub)]">
                暂无管理员
              </td>
            </tr>
            <tr v-else v-for="admin in admins" :key="admin._id">
              <td class="font-medium">{{ admin.username }}</td>
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
          <div class="form-control">
            <label class="label"><span class="label-text">用户名</span></label>
            <input 
              v-model="adminForm.username" 
              type="text" 
              class="input" 
              placeholder="请输入用户名"
              :disabled="!!editingAdmin"
            />
          </div>
          
          <div v-if="!editingAdmin" class="form-control">
            <label class="label"><span class="label-text">密码</span></label>
            <input 
              v-model="adminForm.password" 
              type="password" 
              class="input" 
              placeholder="请输入密码"
            />
          </div>
          
          <div v-if="editingAdmin" class="form-control">
            <label class="label"><span class="label-text">新密码（留空则不修改）</span></label>
            <input 
              v-model="adminForm.newPassword" 
              type="password" 
              class="input" 
              placeholder="请输入新密码"
            />
          </div>
          
          <div class="form-control">
            <label class="label"><span class="label-text">角色</span></label>
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
import { db, serverDate } from '../utils/cloudbase'
import CryptoJS from 'crypto-js'

const loading = ref(false)
const saving = ref(false)
const admins = ref<any[]>([])
const showDialog = ref(false)
const editingAdmin = ref<any>(null)
const adminForm = ref({
  username: '',
  password: '',
  newPassword: '',
  role: 'admin'
})

const currentUsername = computed(() => {
  const auth = localStorage.getItem('custom_admin_auth')
  if (auth) {
    try {
      const admin = JSON.parse(auth)
      return admin.username || ''
    } catch (e) {
      return ''
    }
  }
  return ''
})

const loadAdmins = async () => {
  loading.value = true
  try {
    const res = await db.collection('admins').orderBy('createdAt', 'desc').get()
    admins.value = res.data || []
  } catch (error) {
    console.error('加载管理员失败:', error)
    ElMessage.error('加载管理员失败')
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
    role: admin.role || 'admin'
  }
  showDialog.value = true
}

const hashPassword = (password: string) => {
  return CryptoJS.SHA256(password).toString()
}

const saveAdmin = async () => {
  if (!adminForm.value.username.trim()) {
    ElMessage.warning('请输入用户名')
    return
  }

  if (!editingAdmin.value && !adminForm.value.password.trim()) {
    ElMessage.warning('请输入密码')
    return
  }

  saving.value = true
  try {
    if (editingAdmin.value) {
      const updateData: any = {
        role: adminForm.value.role,
        updateTime: serverDate()
      }

      if (adminForm.value.newPassword.trim()) {
        updateData.password = hashPassword(adminForm.value.newPassword)
      }

      await db.collection('admins').doc(editingAdmin.value._id).update({
        data: updateData
      })
    } else {
      const existing = await db.collection('admins').where({
        username: adminForm.value.username
      }).get()

      if (existing.data.length > 0) {
        ElMessage.warning('用户名已存在')
        return
      }

      await db.collection('admins').add({
        data: {
          username: adminForm.value.username,
          password: hashPassword(adminForm.value.password),
          role: adminForm.value.role,
          createdAt: serverDate()
        }
      })
    }

    showDialog.value = false
    await loadAdmins()
  } catch (error) {
    console.error('保存管理员失败:', error)
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

const deleteAdmin = async (admin: any) => {
  if (!confirm(`确定要删除管理员 "${admin.username}" 吗？`)) {
    return
  }

  try {
    await db.collection('admins').doc(admin._id).remove()
    await loadAdmins()
  } catch (error) {
    console.error('删除管理员失败:', error)
    ElMessage.error('删除失败')
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
