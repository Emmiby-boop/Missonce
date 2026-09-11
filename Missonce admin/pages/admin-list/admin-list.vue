<template>
  <view class="page-container admin-list-page">
    <!-- 加载骨架 -->
    <block v-if="loading">
      <view class="list-card" v-for="n in 3" :key="n">
        <view class="list-item">
          <mc-skeleton height="76rpx" width="76rpx" radius="50%" />
          <view class="list-item-text">
            <mc-skeleton height="30rpx" width="40%" radius="12rpx" style="margin-bottom: 12rpx;" />
            <mc-skeleton height="24rpx" width="55%" radius="12rpx" />
          </view>
        </view>
      </view>
    </block>

    <!-- 错误状态 -->
    <mc-error
      v-else-if="loadError"
      text="管理员列表加载失败"
    >
      <mc-btn type="ghost" size="sm" @click="loadList">重试</mc-btn>
    </mc-error>

    <!-- 列表 -->
    <block v-else-if="list.length > 0">
      <view class="list-card">
        <view
          class="list-item"
          v-for="item in list"
          :key="item._id"
          @longpress="onLongPress(item)"
        >
          <view class="admin-avatar" :style="{ background: 'var(--pri)' }">{{ item.initial }}</view>
          <view class="list-item-text">
            <view class="list-item-title">{{ item.username }}</view>
            <view class="list-item-desc">{{ item.phone }}<text v-if="item.email"> · {{ item.email }}</text></view>
          </view>
          <view class="list-item-right">
            <view class="badge" :class="item.roleBadge">{{ item.roleLabel }}</view>
          </view>
        </view>
      </view>
      <view class="list-tip">长按管理员可删除</view>
    </block>

    <!-- 空状态 -->
    <mc-empty v-else text="暂无管理员">
      <mc-btn type="primary" size="sm" @click="onShowAddSheet">添加管理员</mc-btn>
    </mc-empty>
  <!-- 浮动添加按钮 -->
  <view class="fab" v-if="!loading && !loadError" @tap="onShowAddSheet">
    <mc-icon :path="icons.plus" color="#FFFFFF" :size="44" />
  </view>

  <!-- 编辑管理员底部弹层 -->
  <view class="sheet-mask" v-if="showEditSheet" @tap="onHideEditSheet">
    <view class="sheet" @tap.stop>
      <view class="sheet-header">
        <text class="sheet-title">编辑管理员</text>
        <view class="sheet-close" @tap="onHideEditSheet">
          <mc-icon :path="icons.x" color="#B8B8C8" :size="32" />
        </view>
      </view>

      <view class="sheet-body">
        <view class="input-group">
          <text class="input-label">用户名</text>
          <view class="picker-row">
            <text class="picker-value">{{ editForm.username }}</text>
          </view>
        </view>

        <mc-input
          v-model="editForm.newPassword"
          label="新密码（留空不改）"
          :password="true"
          placeholder="不修改请留空"
        />

        <mc-input
          v-model="editForm.phone"
          label="手机号"
          type="number"
          :maxlength="11"
          placeholder="请输入手机号"
        />

        <mc-input
          v-model="editForm.email"
          label="邮箱"
          type="text"
          placeholder="用于邮箱验证码登录"
        />
      </view>

      <view class="sheet-footer">
        <mc-btn type="default" @click="onHideEditSheet">取消</mc-btn>
        <mc-btn type="primary" :loading="saving" :disabled="saving" @click="onUpdateAdmin">保存</mc-btn>
      </view>
    </view>
  </view>

  <!-- 添加管理员底部弹层 -->
  <view class="sheet-mask" v-if="showAddSheet" @tap="onHideAddSheet">
    <view class="sheet" @tap.stop>
      <view class="sheet-header">
        <text class="sheet-title">添加管理员</text>
        <view class="sheet-close" @tap="onHideAddSheet">
          <mc-icon :path="icons.x" color="#B8B8C8" :size="32" />
        </view>
      </view>

      <view class="sheet-body">
        <mc-input
          v-model="form.username"
          label="用户名"
          placeholder="请输入用户名"
        />

        <mc-input
          v-model="form.password"
          label="密码"
          :password="true"
          placeholder="至少 6 位"
        />

        <view class="input-group">
          <text class="input-label">角色</text>
          <picker mode="selector" :range="roleOptions" :value="form.roleIndex" @change="onRoleChange">
            <view class="picker-row">
              <text class="picker-value">{{ form.roleLabel }}</text>
              <text class="picker-arrow-text">▾</text>
            </view>
          </picker>
        </view>

        <mc-input
          v-model="form.phone"
          label="手机号（可选）"
          type="number"
          :maxlength="11"
          placeholder="请输入手机号"
        />

        <mc-input
          v-model="form.email"
          label="邮箱（可选）"
          type="text"
          placeholder="用于邮箱验证码登录"
        />
      </view>

      <view class="sheet-footer">
        <mc-btn type="default" @click="onHideAddSheet">取消</mc-btn>
        <mc-btn type="primary" :loading="saving" :disabled="saving" @click="onAddAdmin">添加</mc-btn>
      </view>
    </view>
  </view>
  </view>
</template>

<script>
import api from '../../utils/api'
import logger from '../../utils/logger'
import { maskPhone, getInitial, toast, showLoading, hideLoading, confirm } from '../../utils/format'

const ROLE_OPTIONS = ['管理员', '超级管理员']
const ROLE_LABEL_TO_VALUE = { '管理员': 'admin', '超级管理员': 'superadmin' }

const ICON_PATHS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
}

export default {
  data() {
    return {
      loading: true,
      loadError: false,
      list: [],
      showAddSheet: false,
      showEditSheet: false,
      saving: false,
      form: {
        username: '',
        password: '',
        roleLabel: '管理员',
        roleIndex: 0,
        phone: '',
        email: '',
      },
      roleOptions: ROLE_OPTIONS,
      currentAdmin: null,
      editForm: {
        _id: '',
        username: '',
        newPassword: '',
        phone: '',
        email: '',
      },
      icons: ICON_PATHS,
    }
  },

  onLoad() {
    this.loadList()
  },

  onPullDownRefresh() {
    this.loadList().finally(() => uni.stopPullDownRefresh())
  },

  methods: {
    async loadList() {
      this.loading = true
      this.loadError = false
      try {
        const res = await api.getAdmins()
        const raw = Array.isArray(res) ? res : (res && res.list ? res.list : [])
        this.list = raw.map((a) => this.formatAdmin(a))
        this.loading = false
      } catch (err) {
        logger.error('[admin-list] 加载失败', err)
        this.loadError = true
        this.loading = false
        toast('加载失败，下拉重试')
      }
    },

    formatAdmin(a) {
      const name = a.username || a.name || '管理员'
      const role = a.role || 'admin'
      return {
        _id: a._id || a.id,
        username: name,
        initial: getInitial(name),
        role,
        roleLabel: role === 'superadmin' ? '超级管理员' : '管理员',
        roleBadge: role === 'superadmin' ? 'badge--purple' : 'badge--blue',
        phone: a.phone ? maskPhone(a.phone) : '未绑定',
        email: a.email || '',
        rawEmail: a.email || '',
        rawPhone: a.phone || '',
      }
    },

    /* ─── 添加管理员 ─── */
    onShowAddSheet() {
      this.showAddSheet = true
      this.form = {
        username: '',
        password: '',
        roleLabel: '管理员',
        roleIndex: 0,
        phone: '',
        email: '',
      }
    },

    onHideAddSheet() {
      this.showAddSheet = false
    },

    onRoleChange(e) {
      const idx = Number(e.detail.value)
      this.form.roleIndex = idx
      this.form.roleLabel = ROLE_OPTIONS[idx]
    },

    async onAddAdmin() {
      const { username, password, roleLabel, phone, email } = this.form
      if (!username.trim()) {
        toast('请输入用户名')
        return
      }
      if (!password || password.length < 6) {
        toast('密码至少 6 位')
        return
      }
      if (phone && !/^1\d{10}$/.test(phone)) {
        toast('请输入正确的手机号')
        return
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        toast('请输入正确的邮箱')
        return
      }

      this.saving = true
      showLoading('添加中…')
      try {
        await api.addAdmin({
          username: username.trim(),
          password,
          role: ROLE_LABEL_TO_VALUE[roleLabel],
          phone: phone || undefined,
          email: email ? email.trim().toLowerCase() : undefined,
        })
        hideLoading()
        toast('添加成功', 'success')
        this.showAddSheet = false
        this.saving = false
        this.loadList()
      } catch (err) {
        logger.error('[admin-list] 添加失败', err)
        hideLoading()
        this.saving = false
        toast(err.message || '添加失败')
      }
    },

    /* ─── 长按编辑/删除 ─── */
    onLongPress(item) {
      if (!item || !item._id) return
      this.currentAdmin = item
      uni.showActionSheet({
        itemList: ['编辑信息', '删除管理员'],
        itemColor: '#1A1A2E',
        success: (res) => {
          if (res.tapIndex === 0) {
            this.showEditSheet(item)
          } else if (res.tapIndex === 1) {
            this.deleteAdmin(item)
          }
        },
      })
    },

    showEditSheet(item) {
      this.showEditSheet = true
      this.editForm = {
        _id: item._id,
        username: item.username,
        newPassword: '',
        phone: item.rawPhone || '',
        email: item.rawEmail || '',
      }
    },

    onHideEditSheet() {
      this.showEditSheet = false
    },

    async onUpdateAdmin() {
      const { _id, newPassword, phone, email } = this.editForm
      if (phone && !/^1\d{10}$/.test(phone)) {
        toast('请输入正确的手机号')
        return
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        toast('请输入正确的邮箱')
        return
      }

      this.saving = true
      showLoading('保存中…')
      try {
        await api.updateAdmin(_id, {
          newPassword: newPassword || undefined,
          phone: phone || '',
          email: email ? email.trim().toLowerCase() : '',
        })
        hideLoading()
        toast('保存成功', 'success')
        this.showEditSheet = false
        this.saving = false
        this.loadList()
      } catch (err) {
        logger.error('[admin-list] 更新失败', err)
        hideLoading()
        this.saving = false
        toast(err.message || '保存失败')
      }
    },

    async deleteAdmin(item) {
      const ok = await confirm('确定删除管理员「' + item.username + '」吗？此操作不可撤销。')
      if (!ok) return
      showLoading('删除中…')
      try {
        await api.removeAdmin(item._id)
        hideLoading()
        toast('已删除', 'success')
        this.loadList()
      } catch (err) {
        logger.error('[admin-list] 删除失败', err)
        hideLoading()
        toast(err.message || '删除失败')
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.admin-list-page {
  padding-bottom: 180rpx;
}

/* 管理员头像 */
.admin-avatar {
  width: 76rpx;
  height: 76rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
  flex-shrink: 0;
  background: var(--pri);
}

/* 提示文字 */
.list-tip {
  text-align: center;
  font-size: 22rpx;
  color: var(--text-tertiary);
  padding: 24rpx 0;
}

/* 浮动按钮图标 */
.fab-icon {
  width: 44rpx;
  height: 44rpx;
}

/* 底部弹层遮罩 */
.sheet-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}

/* 弹层 */
.sheet {
  width: 100%;
  background: var(--bg-card);
  border-radius: 28rpx 28rpx 0 0;
  padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
  animation: sheetUp 0.25s ease-out;
}

@keyframes sheetUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32rpx;
}

.sheet-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.sheet-close {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sheet-close-icon {
  width: 32rpx;
  height: 32rpx;
}

.sheet-body {
  padding-bottom: 16rpx;
}

/* picker 行 */
.picker-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--r-sm);
  padding: 0 28rpx;
}

.picker-value {
  font-size: 28rpx;
  color: var(--text-primary);
}

.picker-arrow-text {
  font-size: 24rpx;
  color: var(--text-tertiary);
}

/* 弹层底部按钮 */
.sheet-footer {
  display: flex;
  gap: 20rpx;
  margin-top: 24rpx;
}

.sheet-footer .mc-btn {
  flex: 1;
}

/* 输入框组标签 */
.input-group {
  margin-bottom: 36rpx;
}

.input-label {
  font-size: 26rpx;
  color: var(--text-secondary);
  margin-bottom: 16rpx;
  font-weight: 500;
}
</style>
