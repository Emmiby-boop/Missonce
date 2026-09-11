import { db } from './cloudbase'
import { useAuthStore } from '../stores/auth'

/**
 * 记录管理员操作审计日志
 * 写入 audit_logs 集合，供 LogsPage 查看
 */
export const logAudit = async (action: string, target: string, detail?: Record<string, unknown>) => {
  try {
    const authStore = useAuthStore()
    await db.collection('audit_logs').add({
      data: {
        adminUsername: authStore.username || 'unknown',
        action,       // e.g. 'create_admin', 'delete_admin', 'save_config', 'delete_resource'
        target,       // e.g. 'admins', 'sys_config', 'resources'
        detail: detail || null,
        createdAt: new Date().toISOString(),
        timestamp: Date.now()
      }
    })
  } catch (e) {
    // 审计日志写入失败不应阻塞主流程
    console.warn('[Audit] 审计日志写入失败:', e)
  }
}
