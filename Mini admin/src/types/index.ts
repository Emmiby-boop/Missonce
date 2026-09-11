export interface AdminUser {
  _id: string;
  username: string;
  role: 'admin' | 'superadmin';
  phone?: string;
  email?: string;
  avatarUrl?: string;
  createdAt?: string;
}

export interface CustomAdmin {
  uid?: string;
  _openid?: string;
  username?: string;
  phone?: string;
  customAdmin?: AdminUser;
}

export interface LoginState {
  user?: {
    uid: string;
    phone?: string;
    isAnonymous?: boolean;
    customAdmin?: AdminUser;
  };
  loginType?: string;
}

export interface CloudFunctionResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  reason?: string;
}

/* 专题布局设计器相关类型 */

export type ModuleType = 'header' | 'resource-grid';
export type SourceType = 'filter' | 'manual';
export type ResourceType = 'all' | 'wallpaper' | 'avatar';

export interface HeaderConfig {
  height: number;
  showTitle: boolean;
  showDescription: boolean;
}

export interface GridConfig {
  count: number;
  columns: number;
  gap: number;
  radius: number;
  sourceType: SourceType;
  manualIds?: string[];
}

export interface HeaderModule {
  id: string;
  type: 'header';
  marginBottom: number;
  config: HeaderConfig;
}

export interface GridModule {
  id: string;
  type: 'resource-grid';
  marginBottom: number;
  config: GridConfig;
}

export type LayoutModule = HeaderModule | GridModule;

export interface LayoutData {
  type: string;
  backgroundColor: string;
  padding: number;
  modules: LayoutModule[];
}

export interface TopicConfig {
  title: string;
  description: string;
  cover: string;
  coverFileID: string;
  resourceType: ResourceType;
  defaultSort: 'latest' | 'hot' | 'random';
  filterType: 'tag' | 'category';
  filterValue: string;
  status: 'active' | 'inactive';
  sort: number;
  /** 该专题详情页资源列表的显示列数（2~4，默认 3） */
  gridColumns: number;
}

/* 专题管理相关类型 */

export type TopicLinkType = 'resource' | 'page' | 'webview';
export type TopicBadge = '' | 'hot' | 'new' | 'limited';
export type TopicStatus = 'active' | 'inactive';

export interface TopicItem {
  _id: string;
  title: string;
  description?: string;
  cover?: string;
  coverFileID?: string;
  filterType?: 'tag' | 'category';
  filterValue?: string;
  status: TopicStatus;
  sort: number;
  resourceType?: string;
  defaultSort?: string;
  isFeatured?: boolean;
  badge?: string;
  linkType?: TopicLinkType;
  linkUrl?: string;
  /** 该专题点进去后资源列表的显示列数（2~4，默认 3） */
  gridColumns?: number;
}

export type ResourceMap = Record<string, string>;

export interface ResourceItem {
  _id: string;
  title?: string;
  type?: string;
  coverUrl?: string;
  originUrl?: string;
  previewUrl?: string;
}

export interface LayoutVersion {
  _id: string;
  createdAt: number;
  createdBy: string;
}

export interface TempFileUrlItem {
  fileID: string;
  tempFileURL: string;
}

/* ─── 数据模型类型（P2-1 TypeScript 类型补全）────────────── */

/** 资源数据模型 */
export interface Resource {
  _id: string;
  title: string;
  type: 'wallpaper' | 'avatar';
  url: string;
  coverUrl?: string;
  originUrl?: string;
  previewUrl?: string;
  categories?: string[];
  tags?: string[];
  status: number;          // 0=待审 1=已发布 2=拒绝 3=已删除
  isGif?: boolean;
  downloadCount?: number;
  viewCount?: number;
  likeCount?: number;
  hotScore?: number;
  createdAt?: string | number;
  updatedAt?: string | number;
}

/** 分类数据模型 */
export interface Category {
  _id: string;
  name: string;
  type?: 'wallpaper' | 'avatar' | 'all';
  order?: number;
  icon?: string;
}

/** 标签数据模型 */
export interface Tag {
  _id: string;
  name: string;
  type?: 'wallpaper' | 'avatar' | 'all';
  order?: number;
  count?: number;
}

/** 通知数据模型 */
export interface Notification {
  _id: string;
  title: string;
  content?: string;
  contentHtml?: string;
  coverImage?: string;
  summary?: string;
  type?: 'announcement' | 'update' | 'activity';
  isActive?: boolean;
  createdAt?: string | number;
}

/** 系统配置数据模型 */
export interface SysConfig {
  _id: string;
  key: string;
  value: unknown;
  updatedAt?: string | number;
  updatedBy?: string;
}

/** CloudBase 数据库查询结果 */
export interface DbResult<T = unknown> {
  data: T[];
  total?: number;
  requestId?: string;
}

/** CloudBase add 操作返回 */
export interface DbAddResult {
  id?: string;
  _id?: string;
  requestId?: string;
}

/** CloudBase 云函数返回结果（扩展） */
export interface CloudFunctionError {
  success: false;
  message: string;
  reason?: string;
}

/** 带类型的 CloudBase 用户状态 */
export interface CloudBaseUserState {
  uid: string;
  phone?: string;
  isAnonymous?: boolean;
  customAdmin?: AdminUser;
  sessionToken?: string;
}

export interface CloudBaseLoginState {
  user?: CloudBaseUserState;
  loginType?: string;
}
