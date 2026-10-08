/**
 * 通用对话框/Toast 封装
 * 使用 Naive UI 的 useMessage / useDialog
 * 需要在 NConfigProvider 内使用
 */
import { useMessage, useDialog } from 'naive-ui'

export function useFeedback() {
  const message = useMessage()
  const dialog = useDialog()

  const toast = {
    success(msg: string) {
      message.success(msg)
    },
    error(msg: string) {
      message.error(msg, { duration: 5000 })
    },
    warning(msg: string) {
      message.warning(msg)
    },
    info(msg: string) {
      message.info(msg)
    },
  }

  const confirm = (content: string, title = '提示', type: 'warning' | 'error' | 'info' = 'warning') => {
    return new Promise<boolean>((resolve) => {
      dialog[type]({
        title,
        content,
        positiveText: '确定',
        negativeText: '取消',
        onPositiveClick: () => resolve(true),
        onNegativeClick: () => resolve(false),
        onMaskClick: () => resolve(false),
        onClose: () => resolve(false),
      })
    })
  }

  const confirmDelete = (content = '此操作不可恢复，确定要删除吗？') => {
    return confirm(content, '删除提示', 'error')
  }

  return {
    message,
    dialog,
    toast,
    confirm,
    confirmDelete,
  }
}

// 兼容旧的 useDialog 导出（用于不在 NaiveUI 上下文中的地方）
export { useDialog as useOldDialog }

/**
 * 模块级 dialog 实例注册表
 *
 * 为什么需要它：naive-ui 的 dialog.warning() 返回 DialogReactive（同步对象，恒为 truthy），
 * 不是 Promise —— `const ok = await dialog.warning(...)` 会在弹窗弹出的瞬间就继续往下执行，
 * 用户点「取消」也会照样执行（包括批量删除这类危险操作）。
 * 这里在 App.vue 挂载时注册全局 dialog 实例，业务代码直接 import confirmDialog 即可，
 * 无需在各组件 setup 里 useDialog()。
 */
let _dialogInstance: ReturnType<typeof useDialog> | null = null

export const registerDialogInstance = (dialog: ReturnType<typeof useDialog>) => {
  _dialogInstance = dialog
}

export const confirmDialog = (
  content: string,
  title = '提示',
  type: 'warning' | 'error' | 'info' = 'warning'
): Promise<boolean> => {
  // 兜底：实例还没注册（理论上不会发生，DialogRegistrar 在 App 挂载时即注册）。
  // 用原生 confirm 兜底而不是静默拒绝，避免「点按钮没反应」的体验。
  if (!_dialogInstance) {
    console.warn(`[confirmDialog] dialog 实例未注册，使用原生 confirm 兜底：${title}`)
    return Promise.resolve(window.confirm(`${title}\n\n${content}`))
  }
  return new Promise<boolean>((resolve) => {
    _dialogInstance[type]({
      title,
      content,
      positiveText: '确定',
      negativeText: '取消',
      onPositiveClick: () => resolve(true),
      onNegativeClick: () => resolve(false),
      onMaskClick: () => resolve(false),
      onClose: () => resolve(false),
    })
  })
}

export const confirmDeleteDialog = (content = '此操作不可恢复，确定要删除吗？') => {
  return confirmDialog(content, '删除提示', 'error')
}
