/**
 * 通用 CloudBase 集合 Service 基类
 *
 * 抽象 DB 操作，让页面组件不直接操作数据库。
 * 用法：const resourceService = new CloudBaseService('resources');
 */
import { db, serverDate } from '../utils/cloudbase';
import type { DbAddResult } from '../types';

export class CloudBaseService {
  protected collection: string;

  constructor(collection: string) {
    this.collection = collection;
  }

  /** 获取集合引用 */
  protected get col() {
    return db.collection(this.collection);
  }

  /** 查询总数 */
  async count(where: Record<string, unknown> = {}): Promise<number> {
    const res = Object.keys(where).length > 0
      ? await this.col.where(where).count()
      : await this.col.count();
    return res.total || 0;
  }

  /** 查询列表 */
  async list<T = unknown>(options: {
    where?: Record<string, unknown>;
    orderBy?: string;
    orderDir?: 'asc' | 'desc';
    skip?: number;
    limit?: number;
  } = {}): Promise<{ data: T[]; total: number }> {
    const { where = {}, orderBy, orderDir = 'desc', skip = 0, limit = 20 } = options;

    let query = Object.keys(where).length > 0
      ? this.col.where(where)
      : this.col;

    if (orderBy) {
      query = query.orderBy(orderBy, orderDir);
    }

    const [countRes, listRes] = await Promise.all([
      Object.keys(where).length > 0
        ? this.col.where(where).count()
        : this.col.count(),
      query.skip(skip).limit(limit).get(),
    ]);

    return {
      data: (listRes.data || []) as T[],
      total: countRes.total || 0,
    };
  }

  /** 根据 ID 获取单条 */
  async getById<T = unknown>(id: string): Promise<T | null> {
    const res = await this.col.doc(id).get();
    return (res.data?.[0] as T) || null;
  }

  /** 根据字段值查询单条 */
  async getByField<T = unknown>(field: string, value: unknown): Promise<T | null> {
    const res = await this.col.where({ [field]: value }).limit(1).get();
    return (res.data?.[0] as T) || null;
  }

  /** 新增文档 */
  async create(data: Record<string, unknown>): Promise<string> {
    const res = await this.col.add(data) as DbAddResult;
    return res.id || res._id || '';
  }

  /** 新增并返回带时间戳的文档 */
  async createWithTimestamp(data: Record<string, unknown>): Promise<string> {
    return this.create({
      ...data,
      createdAt: serverDate(),
      updatedAt: serverDate(),
    });
  }

  /** 更新文档 */
  async update(id: string, data: Record<string, unknown>): Promise<void> {
    await this.col.doc(id).update(data);
  }

  /** 更新文档并自动更新 updatedAt */
  async updateWithTimestamp(id: string, data: Record<string, unknown>): Promise<void> {
    await this.col.doc(id).update({ ...data, updatedAt: serverDate() });
  }

  /** 删除文档 */
  async remove(id: string): Promise<void> {
    await this.col.doc(id).remove();
  }

  /** 批量删除 */
  async batchRemove(ids: string[]): Promise<void> {
    await Promise.all(ids.map(id => this.col.doc(id).remove()));
  }

  /** 批量更新 */
  async batchUpdate(ids: string[], data: Record<string, unknown>): Promise<void> {
    await Promise.all(ids.map(id => this.col.doc(id).update(data)));
  }

  /** 批量更新并自动更新 updatedAt */
  async batchUpdateWithTimestamp(ids: string[], data: Record<string, unknown>): Promise<void> {
    await this.batchUpdate(ids, { ...data, updatedAt: serverDate() });
  }

  /** 批量更新状态 */
  async batchUpdateStatus(ids: string[], status: number): Promise<void> {
    await this.batchUpdate(ids, { status });
  }

  /** 批量添加标签（向 tags 数组追加） */
  async batchAddTag(ids: string[], tag: string): Promise<void> {
    await Promise.all(ids.map(async id => {
      const item = await this.getById<{ tags?: string[] }>(id);
      if (item) {
        const tags = item.tags || [];
        if (!tags.includes(tag)) {
          tags.push(tag);
          await this.update(id, { tags });
        }
      }
    }));
  }

  /** 按关键字搜索（基于 db.RegExp） */
  async search<T = unknown>(keyword: string, fields: string[], options: {
    limit?: number;
    orderBy?: string;
    orderDir?: 'asc' | 'desc';
  } = {}): Promise<T[]> {
    const { limit = 20, orderBy, orderDir = 'desc' } = options;
    const where: Record<string, unknown> = {};
    const regex = db.RegExp({ regexp: keyword, options: 'i' });
    const primaryField = fields[0];
    if (primaryField) {
      where[primaryField] = regex;
    }
    let query = this.col.where(where);
    if (orderBy) query = query.orderBy(orderBy, orderDir);
    const res = await query.limit(limit).get();
    return (res.data || []) as T[];
  }

  /** 查询全部（不分页，注意数据量） */
  async getAll<T = unknown>(where: Record<string, unknown> = {}, orderBy?: string, orderDir: 'asc' | 'desc' = 'asc'): Promise<T[]> {
    let query = Object.keys(where).length > 0
      ? this.col.where(where)
      : this.col;
    if (orderBy) query = query.orderBy(orderBy, orderDir);
    const res = await query.limit(1000).get();
    return (res.data || []) as T[];
  }
}

// ─── 专用 Service ──────────────────────────────────

/** 资源 Service（扩展资源相关业务方法） */
export class ResourceService extends CloudBaseService {
  constructor() {
    super('resources');
  }

  /** 批量添加分类 */
  async batchAddCategory(ids: string[], category: string): Promise<void> {
    await Promise.all(ids.map(async id => {
      const item = await this.getById<{ categories?: string[] }>(id);
      if (item) {
        const categories = item.categories || [];
        if (!categories.includes(category)) {
          categories.push(category);
          await this.update(id, { categories });
        }
      }
    }));
  }

  /** 按类型和状态查询 */
  async getByTypeStatus(type: string, status: number, limit = 20): Promise<{ data: unknown[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (type && type !== 'all') where.type = type;
    if (status !== undefined) where.status = status;
    return this.list({ where, limit, orderBy: 'createdAt', orderDir: 'desc' });
  }
}

/** 专题 Service */
export class TopicService extends CloudBaseService {
  constructor() {
    super('topics');
  }

  /** 按排序获取启用的专题 */
  async getActiveTopics(): Promise<unknown[]> {
    return this.getAll({ status: 'active' }, 'sort', 'asc');
  }

  /** 切换专题状态 */
  async toggleStatus(id: string, status: 'active' | 'inactive'): Promise<void> {
    await this.update(id, { status });
  }

  /** 切换精选状态 */
  async toggleFeatured(id: string, isFeatured: boolean): Promise<void> {
    await this.update(id, { isFeatured });
  }
}

/** 通知 Service */
export class NotificationService extends CloudBaseService {
  constructor() {
    super('notifications');
  }

  /** 获取活跃通知 */
  async getActiveNotifications(): Promise<unknown[]> {
    return this.getAll({ isActive: true }, 'createdAt', 'desc');
  }
}

/** 分类 Service */
export class CategoryService extends CloudBaseService {
  constructor() {
    super('categories');
  }

  /** 按排序获取全部分类 */
  async getAllSorted(): Promise<unknown[]> {
    return this.getAll({}, 'order', 'asc');
  }
}

/** 标签 Service */
export class TagService extends CloudBaseService {
  constructor() {
    super('tags');
  }

  /** 按排序获取全部标签 */
  async getAllSorted(): Promise<unknown[]> {
    return this.getAll({}, 'order', 'asc');
  }
}

// ─── 预定义 Service 实例 ──────────────────────────
export const resourceService = new ResourceService();
export const categoryService = new CategoryService();
export const tagService = new TagService();
export const bannerService = new CloudBaseService('banners');
export const adminService = new CloudBaseService('admins');
export const eventService = new CloudBaseService('events');
export const logService = new CloudBaseService('logs');
export const quoteService = new CloudBaseService('quotes');
export const notificationService = new NotificationService();
export const topicService = new TopicService();
export const userService = new CloudBaseService('users');

export default CloudBaseService;
