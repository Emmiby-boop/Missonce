import cloudbase from "@cloudbase/js-sdk";
import type { CloudBaseLoginState, CloudFunctionError, AdminUser, CloudBaseUserState } from "../types";

/**
 * CloudBase 配置
 * 安全说明：ACCESS_KEY 已移除，敏感操作通过云函数中转
 * 前端仅保留基础初始化，数据库操作依赖安全规则
 */

/** CloudBase init 配置（SDK 类型定义不完整，补充扩展字段） */
interface CloudBaseInitConfig {
  env: string;
  region?: string;
  auth?: { detectSessionInUrl?: boolean };
  timeout?: number;
}

/** CloudBase auth 配置（SDK 类型定义不完整，补充扩展字段） */
interface CloudBaseAuthConfig {
  persistence: "session" | "local" | "none";
  persistenceLevel?: "session" | "local" | "none";
  detectSessionInUrl?: boolean;
}

/** 带有 serverDate 方法的数据库实例 */
interface DbWithServerDate {
  serverDate(): unknown;
  collection(name: string): unknown;
  command: unknown;
  RegExp(opts: { regexp: string; options?: string }): unknown;
}

export const ENV_ID = import.meta.env.VITE_ENV_ID || "missonce-99-1gfaff6n002f6ac1";
export const REGION = import.meta.env.VITE_REGION || "ap-shanghai";

export const app = cloudbase.init({
  env: ENV_ID,
  region: REGION,
  auth: { detectSessionInUrl: true },
  timeout: 300000 // 全局请求超时设置为 5 分钟 (300000ms)
} as CloudBaseInitConfig);

export const authClient = app.auth({
  persistence: "session",
  persistenceLevel: "session",
  detectSessionInUrl: true,
} as CloudBaseAuthConfig);

export const db = app.database();
export const _ = db.command;
export const serverDate = () => (db as unknown as DbWithServerDate).serverDate();

// 安全加固：localStorage 仅存储服务端签发的 sessionToken，admin profile 不落盘
// admin profile 通过 fetchAdminProfile() 调用 adminAuth.verifyToken 从服务端获取，仅存内存
const TOKEN_STORAGE_KEY = 'admin_session_token';

export const getLoginState = async (): Promise<CloudBaseLoginState> => {
  // 安全说明：仅当存在服务端签发的 sessionToken 时才认为已登录
  // sessionToken 通过 adminAuth.generateToken 在登录成功后获得（HMAC 签名，无法伪造）
  // 注：原 adminSession 已合并到 adminAuth
  const sessionToken = localStorage.getItem(TOKEN_STORAGE_KEY);

  if (sessionToken) {
    // 仅返回最小化状态对象，admin 详情由 fetchAdminProfile 从服务端拉取
    return {
      user: {
        uid: 'custom_admin',
        isAnonymous: false,
        sessionToken: sessionToken
      },
      loginType: 'CUSTOM'
    } as CloudBaseLoginState;
  }

  // 兼容性清理：移除旧版本可能残留的明文 admin profile
  if (localStorage.getItem('custom_admin_auth')) {
    localStorage.removeItem('custom_admin_auth');
  }

  return authClient.getLoginState() as Promise<CloudBaseLoginState>;
};

export const ensureLogin = async () => {
  const state = await getLoginState();
  return state || null;
};

export const ensureAuthUser = async () => {
  const state = await getLoginState();
  const isAnonymous = Boolean((state?.user as CloudBaseUserState | undefined)?.isAnonymous);

  if (!state || !state.user || isAnonymous) {
    throw new Error("UNAUTH");
  }
  return state;
};

// 手机验证码登录，使用官方 signInWithOtp / verifyOtp 流程
export const requestPhoneOtp = async (phone: string) => {
  const { data } = await authClient.signInWithOtp({ phone });
  return data; // data 包含 verifyOtp 方法
};

// 注册逻辑可在调用方通过 signUp + verifyOtp 完成；保留封装以兼容旧代码
export const signUpWithOtp = async (params: { phone: string; code: string; password?: string }) => {
  const { data } = await authClient.signUp({ phone: params.phone, password: params.password });
  if (!data?.verifyOtp) {
    throw new Error("注册失败，未获取到验证码校验会话");
  }
  return data.verifyOtp({ token: params.code });
};

// 内存缓存：避免每次路由跳转都查云端（30 秒内复用）
// 安全加固：admin profile 仅存内存，不落盘 localStorage
let _adminProfileCache: AdminUser | null = null
let _adminProfileCacheTs = 0
const ADMIN_PROFILE_CACHE_TTL = 30 * 1000

export const fetchAdminProfile = async () => {
  try {
    // 命中内存缓存（30 秒内）
    const now = Date.now()
    if (_adminProfileCache && (now - _adminProfileCacheTs) < ADMIN_PROFILE_CACHE_TTL) {
      return _adminProfileCache
    }

    // 安全加固：仅通过服务端签发的 Token 校验，admin profile 从服务端实时获取
    const sessionToken = localStorage.getItem(TOKEN_STORAGE_KEY);

    if (sessionToken) {
      try {
        // 调用 adminAuth.verifyToken 服务端校验（HMAC-SHA256 签名，不可伪造）
        const res = await app.callFunction({
          name: 'adminAuth',
          data: { action: 'verifyToken', token: sessionToken }
        });
        if (res?.result?.success && res.result.data?.admin) {
          // Token 有效，admin 信息仅写入内存缓存（不落盘 localStorage）
          const admin = res.result.data.admin;
          _adminProfileCache = admin
          _adminProfileCacheTs = Date.now()
          return admin;
        } else {
          // 安全加固：Token 无效/过期，必须清除登录态，不允许降级
          console.warn('[CloudBase] Token 无效或已过期，清除登录态');
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          _adminProfileCache = null
          _adminProfileCacheTs = 0
        }
      } catch (e) {
        // 安全加固：服务端校验失败（网络异常等），必须清除登录态，不允许降级使用本地缓存
        // 说明：即使网络异常，也不信任本地凭证，避免攻击者通过阻断网络绕过 Token 校验
        console.warn('[CloudBase] Token 服务端校验失败，清除登录态（不降级）', e);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        _adminProfileCache = null
        _adminProfileCacheTs = 0
      }
    } else {
      // 无 Token，清理可能残留的旧版本明文 admin profile
      if (localStorage.getItem('custom_admin_auth')) {
        localStorage.removeItem('custom_admin_auth');
      }
    }

    // 不再自动调用 addAdmin —— 未注册管理员应直接拒绝，而非自动添加
    return null;
  } catch (err) {
    console.warn("查询管理员信息失败", err);
    return null;
  }
};

// 清除管理员 profile 内存缓存（logout 时调用）
export const invalidateAdminProfileCache = () => {
  _adminProfileCache = null
  _adminProfileCacheTs = 0
}

export const requireAdmin = async () => {
  const profile = await fetchAdminProfile();
  if (!profile) {
    throw new Error("当前账号无管理员权限，请联系超管在 admins 集合配置");
  }
  return profile;
};

export const logEvent = async (params: { type: string; page?: string; ext?: Record<string, unknown> }) => {
  try {
    const state = await ensureLogin();
    const uid = state?.user?.uid || "anonymous";
    await db.collection("events").add({
      type: params.type,
      page: params.page || window.location.hash.replace("#", "") || "/",
      ext: params.ext || null,
      uid,
      ts: serverDate(),
    });
  } catch (err) {
    console.warn("埋点写入失败", err);
  }
};

export const logout = async () => {
  try {
    // 安全加固：仅清除 token，admin profile 本就不落盘
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    // 兼容性清理：移除旧版本可能残留的明文 admin profile
    localStorage.removeItem('custom_admin_auth');
    invalidateAdminProfileCache()
    await authClient.signOut();
  } catch (err) {
    console.error("退出失败", err);
    throw err;
  }
};

// --- Added for Login.vue compatibility ---

let pendingAuthData: unknown = null;

export const sendPhoneCode = async (phone: string) => {
  // Alias for requestPhoneOtp with side effect to store context
  const data = await requestPhoneOtp(phone);
  pendingAuthData = data;
  return data;
};

export const loginWithPhoneCode = async (phone: string, code: string) => {
  const authData = pendingAuthData as { verifyOtp?: (params: Record<string, unknown>) => Promise<unknown> } | null;
  if (!authData || !authData.verifyOtp) {
    throw new Error("请先获取验证码");
  }

  // 1. 先调用 CloudBase SDK 的 verifyOtp 验证手机号
  await authData.verifyOtp({
    code,
    phone,
    token: code
  });

  // 2. 验证成功后，调用 adminAuth.loginByPhone 查 admins 集合并生成 admin session token
  //    前端 SDK 登录态不等于管理员权限，必须经过 adminAuth 云函数校验
  const res = await callCloudFunction('adminAuth', {
    action: 'loginByPhone',
    phone
  }) as { success: boolean; message?: string; admin?: unknown; token?: string };

  if (!res.success || !res.token) {
    throw new Error(res.message || '该手机号未注册为管理员');
  }

  // 3. 保存 admin session token（与账号密码登录保持一致）
  localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
  // 清除 admin profile 内存缓存，让后续 fetchProfile 重新从服务端拉取
  invalidateAdminProfileCache();

  return res;
};

// --- New Auth Methods ---

// 确保 CloudBase 有登录态（匿名 or 正式），无则自动匿名登录
// 安全加固：admin_session_token 仅表示自定义账号登录成功，但 TCB SDK 本身可能没有有效 session
const ensureCredentials = async () => {
  try {
    const state = await authClient.getLoginState();

    // 有 admin_session_token 说明用户已用自定义账号登录，但 TCB SDK session 可能不存在
    // 此时强制匿名登录来获取 TCB 调用权限
    if (!state) {
      try {
        await authClient.signInAnonymously();
      } catch (anonErr: unknown) {
        // 如果匿名登录失败（如环境限制），尝试获取已有 anonymous 登录态
        console.warn('[CloudBase] Anonymous sign-in failed:', (anonErr as Error)?.message);
      }
    }
  } catch (e) {
    console.warn('[CloudBase] ensureCredentials error:', e);
  }
};

export const callCloudFunction = async (name: string, data: Record<string, unknown>) => {
  try {
    await ensureCredentials();
    // 自动注入 adminToken，供 withAdmin 鉴权使用（Web 后台调用必需）
    const sessionToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    const enrichedData = sessionToken
      ? { ...data, adminToken: sessionToken }
      : data;
    const res = await app.callFunction({
      name,
      data: enrichedData || {}
    });

    if (res.result === null || res.result === undefined) {
      throw new Error(`云函数 ${name} 不存在或调用失败`);
    }
    if (res.result.success === false) {
      throw new Error((res.result as CloudFunctionError).message || 'Cloud function error');
    }
    return res.result;
  } catch (error: unknown) {
    console.error(`Call cloud function ${name} failed:`, error);
    throw error;
  }
};

/**
 * 带认证的云函数调用（返回原始结果，不做 success 检查）
 * 自动注入 adminToken，供 withAdmin 鉴权使用
 * 用于需要直接处理原始返回值的场景（如批量操作、上传等）
 */
export const callFunctionWithAuth = async (name: string, data: Record<string, unknown> = {}) => {
  await ensureCredentials();
  const sessionToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  const enrichedData = sessionToken
    ? { ...data, adminToken: sessionToken }
    : data;
  return app.callFunction({
    name,
    data: enrichedData
  });
};

export const loginByAccount = async (username: string, password: string) => {
  return callCloudFunction('adminAuth', {
    action: 'loginByAccount',
    username,
    password
  });
};

export const changePassword = async (username: string, oldPassword: string, newPassword: string) => {
  return callCloudFunction('adminAuth', {
    action: 'changePassword',
    username,
    oldPassword,
    newPassword
  });
};

export default {
  app,
  auth: authClient,
  db,
  _,
  ensureLogin,
  ensureAuthUser,
  logout,
  fetchAdminProfile,
  requireAdmin,
  logEvent,
  requestPhoneOtp,
  signUpWithOtp,
  sendPhoneCode,
  loginWithPhoneCode,
  callFunctionWithAuth
};
