import cloudbase from "@cloudbase/js-sdk";

/**
 * CloudBase 配置
 * 注意：ACCESS_KEY 暴露在前端代码中是 CloudBase Web SDK 的限制
 * 生产环境建议：配置安全规则限制 IP/域名访问，或使用云函数中转
 */
export const ENV_ID = import.meta.env.VITE_ENV_ID || "missonce-99-1gfaff6n002f6ac1";
export const REGION = import.meta.env.VITE_REGION || "ap-shanghai";
export const ACCESS_KEY = import.meta.env.VITE_ACCESS_KEY || "";

export const app = cloudbase.init({
  env: ENV_ID,
  region: REGION,
  accessKey: ACCESS_KEY, 
  auth: { detectSessionInUrl: true },
  timeout: 300000 // 全局请求超时设置为 5 分钟 (300000ms)
} as any);

export const authClient = app.auth({
  persistence: "session",
  persistenceLevel: "session",
  detectSessionInUrl: true,
} as any);

export const db = app.database();
export const _ = db.command;
export const serverDate = () => (db as any).serverDate();

export const getLoginState = async () => authClient.getLoginState();

export const ensureLogin = async () => {
  const state = await authClient.getLoginState();
  return state || null;
};

export const ensureAuthUser = async () => {
  const state = await authClient.getLoginState();
  const isAnonymous = Boolean((state?.user as any)?.isAnonymous);
  
  // Check for custom admin auth (Email/Scan login)
  const customAuth = localStorage.getItem('custom_admin_auth');
  if (customAuth) {
    try {
       const admin = JSON.parse(customAuth);
       if (admin) {
         // Return a mock state object
         return {
           user: {
             uid: admin.uid || admin._openid || 'custom_admin',
             isAnonymous: false,
             customAdmin: admin
           },
           loginType: 'CUSTOM'
         };
       }
    } catch (e) {
      console.error("Invalid custom auth token", e);
      localStorage.removeItem('custom_admin_auth');
    }
  }

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

export const fetchAdminProfile = async () => {
  try {
    const state = await ensureAuthUser();
    
    // If using custom auth, return the stored profile directly
    if ((state as any).loginType === 'CUSTOM') {
      return (state.user as any).customAdmin;
    }

    const uid = state.user?.uid;
    if (!uid) return null;
    const { data } = await db.collection("admins").where({ uid }).limit(1).get();

    if (!data || data.length === 0) {
      console.warn(`当前用户 (${uid}) 未在 admins 集合中找到。`);
      
      // 尝试通过云函数自动注册
      try {
        console.log("尝试调用云函数 addAdmin 添加当前用户为管理员...");
        const res = await app.callFunction({
          name: "addAdmin",
          data: { uid }
        });
        
        console.log("addAdmin 云函数响应:", res);
        
        if (res.result && res.result.success) {
           console.log("云函数添加管理员成功！");
           // 重试获取
           const retry = await db.collection("admins").where({ uid }).limit(1).get();
           return retry.data?.[0] || null;
        } else {
           console.error("云函数添加管理员失败:", res.result?.message || "未知错误");
        }
      } catch (fnErr) {
        console.error("调用 addAdmin 云函数失败:", fnErr);
      }
    }

    return data?.[0] || null;
  } catch (err) {
    console.warn("查询管理员信息失败", err);
    return null;
  }
};

export const requireAdmin = async () => {
  const profile = await fetchAdminProfile();
  if (!profile) {
    throw new Error("当前账号无管理员权限，请在 admins 集合配置");
  }
  return profile;
};

export const logEvent = async (params: { type: string; page?: string; ext?: any }) => {
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
    localStorage.removeItem('custom_admin_auth');
    await authClient.signOut();
  } catch (err) {
    console.error("退出失败", err);
    throw err;
  }
};

// --- Added for Login.vue compatibility ---

let pendingAuthData: any = null;

export const sendPhoneCode = async (phone: string) => {
  // Alias for requestPhoneOtp with side effect to store context
  const data = await requestPhoneOtp(phone);
  pendingAuthData = data;
  return data;
};

export const loginWithPhoneCode = async (phone: string, code: string) => {
  if (!pendingAuthData || !pendingAuthData.verifyOtp) {
    // If context is missing, try to call sendPhoneCode first or fail
    // In strict mode, we should fail.
    // However, the user might have refreshed? No, JS state is lost on refresh.
    // Just fail and ask to resend.
    throw new Error("请先获取验证码");
  }
  
  // Call verifyOtp
  // Try passing code as `code` (standard) and `token` (seen in signUpWithOtp) to be safe
  const res = await pendingAuthData.verifyOtp({ 
    code,
    phone,
    token: code // Backup if it expects 'token'
  });
  
  return res;
};

// --- New Auth Methods ---

export const callCloudFunction = async (name: string, data: any) => {
  try {
    const res = await app.callFunction({
      name,
      data
    });
    if (res.result && res.result.success === false) {
      throw new Error(res.result.message || 'Unknown error in cloud function');
    }
    return res.result;
  } catch (error: any) {
    console.error(`Call cloud function ${name} failed:`, error);
    throw error;
  }
};

export const sendLoginEmail = async (email: string) => {
  return callCloudFunction('sendEmail', { email });
};

export const verifyEmailLogin = async (email: string, code: string) => {
  return callCloudFunction('adminAuth', { 
    action: 'verifyEmail',
    email,
    code
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
  loginWithPhoneCode
};
