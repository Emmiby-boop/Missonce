/**
 * 资源列表状态管理
 * 封装资源列表查询/筛选/分页逻辑，跨页面共享列表状态
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '../utils/cloudbase'
import { PAGINATION } from '../constants'
import type { ResourceItem } from '../types'
import { resourceService } from '../services/cloudBaseService'
import { logger } from '../utils/logger'

export interface ResourceFilter {
  type: string        // 'all' | 'wallpaper' | 'avatar'
  status: number | null // null=全部, 0=待审, 1=已发布, 2=拒绝, 3=已删除
  keyword: string
  tag: string
  category: string
}

export const useResourcesStore = defineStore('resources', () => {
  // ─── State ──────────────────────────────────────
  const list = ref<ResourceItem[]>([])
  const total = ref(0)
  const loading = ref(false)
  const page = ref(PAGINATION.DEFAULT_PAGE)
  const pageSize = ref(PAGINATION.DEFAULT_PAGE_SIZE)
  const filter = ref<ResourceFilter>({
    type: 'all',
    status: null,
    keyword: '',
    tag: '',
    category: '',
  })

  // ─── Computed ───────────────────────────────────
  const totalPages = computed(() => Math.ceil(total.value / pageSize.value) || 1)
  const hasMore = computed(() => page.value < totalPages.value)

  // ─── Helpers ────────────────────────────────────
  function buildWhere(): Record<string, unknown> {
    const where: Record<string, unknown> = {}
    const f = filter.value

    if (f.type && f.type !== 'all') {
      where.type = f.type
    }
    if (f.status !== null) {
      where.status = f.status
    }
    if (f.keyword) {
      where.title = db.RegExp({ regexp: f.keyword, options: 'i' })
    }
    if (f.tag) {
      where.tags = f.tag
    }
    if (f.category) {
      where.categories = f.category
    }
    return where
  }

  // ─── Actions ────────────────────────────────────

  /** 加载资源列表 */
  async function fetchList(reset = false): Promise<void> {
    if (reset) {
      page.value = PAGINATION.DEFAULT_PAGE
    }
    loading.value = true
    try {
      const where = buildWhere()
      const skip = (page.value - 1) * pageSize.value

      const { data, total: count } = await resourceService.list<ResourceItem>({
        where,
        orderBy: 'createdAt',
        orderDir: 'desc',
        skip,
        limit: pageSize.value,
      })

      list.value = data
      total.value = count
    } catch (e) {
      logger.error('[resources store] 加载列表失败', e)
      list.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  /** 更新筛选条件并重新加载 */
  async function setFilter(patch: Partial<ResourceFilter>): Promise<void> {
    filter.value = { ...filter.value, ...patch }
    await fetchList(true)
  }

  /** 翻页 */
  async function goToPage(p: number): Promise<void> {
    if (p < 1 || p > totalPages.value) return
    page.value = p
    await fetchList()
  }

  /** 更新单条资源 */
  async function updateResource(id: string, data: Partial<Omit<ResourceItem, '_id'>>): Promise<void> {
    await resourceService.updateWithTimestamp(id, data)
    // 同步本地列表中的数据
    const idx = list.value.findIndex(r => r._id === id)
    if (idx >= 0) {
      list.value[idx] = { ...list.value[idx], ...data } as ResourceItem
    }
  }

  /** 删除单条资源 */
  async function removeResource(id: string): Promise<void> {
    await resourceService.remove(id)
    list.value = list.value.filter(r => r._id !== id)
    total.value = Math.max(0, total.value - 1)
  }

  /** 批量更新资源状态 */
  async function batchUpdateStatus(ids: string[], status: number): Promise<void> {
    await resourceService.batchUpdate(ids, { status })
    list.value = list.value.map(r =>
      ids.includes(r._id) ? { ...r, status } : r
    )
  }

  /** 批量删除资源 */
  async function batchRemove(ids: string[]): Promise<void> {
    await resourceService.batchRemove(ids)
    list.value = list.value.filter(r => !ids.includes(r._id))
    total.value = Math.max(0, total.value - ids.length)
  }

  /** 重置筛选和分页 */
  function reset(): void {
    filter.value = { type: 'all', status: null, keyword: '', tag: '', category: '' }
    page.value = PAGINATION.DEFAULT_PAGE
    list.value = []
    total.value = 0
  }

  return {
    list,
    total,
    loading,
    page,
    pageSize,
    filter,
    totalPages,
    hasMore,
    fetchList,
    setFilter,
    goToPage,
    updateResource,
    removeResource,
    batchUpdateStatus,
    batchRemove,
    reset,
  }
})
