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