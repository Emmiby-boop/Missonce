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
