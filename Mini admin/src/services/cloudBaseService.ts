/**
 * 通用 CloudBase 集合 Service 基类
 *
 * 抽象 DB 操作，让页面组件不直接操作数据库。
 * 用法：const resourceService = new CloudBaseService('resources');
 */
import { db, _ } from '../utils/cloudbase';

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
  async count(where: Record<string, any> = {}): Promise<number> {
    const res = Object.keys(where).length > 0
      ? await this.col.where(where).count()
      : await this.col.count();
    return res.total || 0;
  }

  /** 查询列表 */
  async list(options: {
    where?: Record<string, any>;
    orderBy?: string;
    orderDir?: 'asc' | 'desc';
    skip?: number;
    limit?: number;
  } = {}): Promise<{ data: any[]; total: number }> {
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
      data: listRes.data || [],
      total: countRes.total || 0,
    };
  }

  /** 根据 ID 获取单条 */
  async getById(id: string): Promise<any | null> {
    const res = await this.col.doc(id).get();
    return res.data?.[0] || null;
  }

  /** 新增文档 */
  async create(data: Record<string, any>): Promise<string> {
    const res = await this.col.add(data);
    return res.id || res._id || '';
  }

  /** 更新文档 */
  async update(id: string, data: Record<string, any>): Promise<void> {
    await this.col.doc(id).update(data);
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
  async batchUpdate(ids: string[], data: Record<string, any>): Promise<void> {
    await Promise.all(ids.map(id => this.col.doc(id).update(data)));
  }
}

// 预定义常用 Service 实例
export const resourceService = new CloudBaseService('resources');
export const categoryService = new CloudBaseService('categories');
export const tagService = new CloudBaseService('tags');
export const bannerService = new CloudBaseService('banners');
export const adminService = new CloudBaseService('admins');
export const eventService = new CloudBaseService('events');
export const logService = new CloudBaseService('logs');
export const quoteService = new CloudBaseService('quotes');
export const notificationService = new CloudBaseService('notifications');

export default CloudBaseService;
