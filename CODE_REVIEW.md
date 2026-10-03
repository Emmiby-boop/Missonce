# 小辣椒头像项目 — 全面代码审查报告

**审查日期**：2026-09-11
**审查范围**：`WeChat Mini`（小程序 + 61 个云函数）、`Mini admin`（Vue3 后台）、`Missonce admin`（uni-app 后台）
**代码规模**：自有代码约 9.7 万行（小程序 44,242 / Mini admin 29,457 / Missonce admin 23,726），云函数 48 个入口共 9,411 行

---

## 零、先纠正一件事：现有的 `security-report.json` 是无效报告

`WeChat Mini/security-report.json` 声称扫描 311 个文件发现 98 个漏洞，但：

- `duration: 0.076s` —— 0.076 秒扫完 311 个文件，物理上不可能完成任何真实分析
- 98 条 findings 只有 3 种类型：`console.log`（CWE-532）、`Math.random()`（CWE-330）、`wx-server-sdk ~2.6.3`（Outdated SDK）
- **所有条目的 remediation 都是同一句** "Move secrets to environment variables or CloudBase config." —— 模板填充
- 大量 findings 指向 `package-lock.json`（把 lock 文件里的 `Math.random` 当业务代码漏洞）
- 真实的高危问题（见下）**一条都没扫出来**

**建议：删除该文件，或在其位置标注为不可用。** 留着会让人误以为安全已受控。真正的审查结论见下文。

---

## 一、P0 严重漏洞（可直接越权 / 数据泄露 / 资损）

### P0-1 任何人可为任意管理员签发超管 Token（核弹级）
`cloudfunctions/adminAuth/index.js:308-349`

```js
if (callerOpenid) {
  // ✅ 有 openid 时：校验调用者本人就是该 adminId
} else {
  // ❌ 无 openid 时：只查 adminId 是否存在，存在就签发
  const r = await db.collection('admins').doc(adminId).get()
  adminExists = !!r.data
}
const result = await generateToken(adminId)   // :346 直接签发
```

无 `openid` 的场景包括：Web 端调用、服务端调用、任何非小程序来源。**攻击者只要知道任一管理员的 `_id`**（24 位 ObjectId，可从日志/分享链接/`admin_operation_logs` 等处泄露），就能拿到超管 token，进而调用全部 `withAdmin` 云函数——整个后台失守。

修复：删除 else 分支，无登录态直接拒绝。

```js
if (action === 'generateToken') {
  if (!callerOpenid) return { success: false, message: '未登录' }
  if (!adminId) return { success: false, message: '缺少 adminId' }
  const callerRes = await db.collection('admins').where({ _openid: callerOpenid }).limit(1).get()
  if (!callerRes.data.length || callerRes.data[0]._id !== adminId) {
    return { success: false, message: '禁止为他人生成 Token' }
  }
  return { success: true, data: await generateToken(adminId) }
}
```

### P0-2 管理员手机号免密登录
`cloudfunctions/adminAuth/index.js:486-604`（关键分支 `:502-545`、`:589`）

仅凭 `phone` / `username` / `uid` / `_openid` 匹配到记录即 `generateToken`，**无密码、无短信验证码**。枚举管理员手机号即可撞出超管 token。

修复：接入短信验证码，校验 `sms_codes` 集合中未使用且未过期的记录；或直接下线 `loginByPhone`。

### P0-3 代理签名密钥硬编码在源码里
```js
cloudfunctions/proxyDownload/index.js:35
cloudfunctions/getProxySign/index.js:7

const SIGN_SECRET = process.env.PROXY_SIGN_SECRET || 'missonce-proxy-sign-key-v2'
```

默认值 `'missonce-proxy-sign-key-v2'` 明文写在仓库里。只要环境变量没配（`||` 兜底生效），**任何人都能用这个字符串算出合法签名**，把 `proxyDownload` 当免费 HTTP 代理 / SSRF 跳板。这与去水印项目 `proxyDownload/index.js:13`（默认空串）是同一类问题，同系列项目应一起治理。

修复（两处同改）：
```js
const SIGN_SECRET = process.env.PROXY_SIGN_SECRET
if (!SIGN_SECRET) throw new Error('未配置 PROXY_SIGN_SECRET')
```
并在部署后立即**轮换密钥**（假定当前密钥已泄露）。

### P0-4 广告配置接口无鉴权（与去水印项目同款问题）
`cloudfunctions/adConfigManager/index.js:71-83`

```js
async function ensureAdmin() {
  // 当前项目暂不强制校验管理员表，返回上下文中的 uid 供记录使用
  return { uid }
}
```
`ensureAdmin()` 不仅自认不校验，而且**在整个文件里从未被调用**。唯一的拦截是 `:29` 的 `denyIfMiniProgram()` —— 只挡 `SOURCE` 含 `wx` 的调用，任何非小程序来源（curl、云函数调用）可直接执行：

`create` / `update` / `delete` / `batchCreate` / `batchEnable` / `setMiniProgramPages` / `ensureCollections` / `adUnit:add` / `adUnit:update` / `adUnit:delete` / `adUnit:backup`

攻击后果与去水印项目一致：**替换 adUnitId 截走广告收益**，或塞违规广告导致小程序被封。

修复：用 fail-closed 的 `withAdmin` 包裹 `exports.main`。

### P0-5 `testAiConnection`：无鉴权 + 任意 URL SSRF
`cloudfunctions/testAiConnection/index.js:7-50`

`:8` 完全信任客户端传入的 `API_URL` / `API_KEY` / `messages`，`:25` `url.parse` 后直接 `https.request`，且响应体 `rawBody` 会回显 500 字符。可当作探测内网的 HTTP 代理（云函数内网可达数据库、元数据服务）。

修复：加管理员鉴权 + 目标 host 白名单（仅 `dashscope.aliyuncs.com`），响应体不再回显。

### P0-6 `aiGenerateText` 无任何鉴权与限流 → AI 费用盗刷
`cloudfunctions/aiGenerateText/index.js:86-109`

全文件无 `OPENID` / `admins` / `withAdmin` 校验，`prompt` 长度无限制，单次输出 500 token。任何人可循环调用刷爆通义千问账单。

修复：
```js
const openid = cloud.getWXContext().OPENID
if (!openid) return { success: false, error: '未登录' }
if (!prompt || prompt.length > 500) return { success: false, error: 'prompt 过长' }
// 按 openid 做每日配额（复用 proxyDownload 的 rate_limit 逻辑）
```

### P0-7 `shareCode` 的 admin 动作零鉴权
`cloudfunctions/shareCode/index.js:41-49`（注释写着"需 adminToken 鉴权"但没实现）

`adminList:109` / `adminStats:162` / `adminDelete:221` —— 任意用户可拉取并删除全部分享码记录。

修复：三个分支用 fail-closed `withAdmin` 包裹。

---

## 二、P1 高

### P1-1 13 个云函数的 `withAdmin` 是 fail-open
全项目有 **16 份 `withAdmin.js` 副本**，其中 13 份逻辑完全相同且为 fail-open：token 校验失败后降级查 `_openid`，而 `_openid` 在无登录态时为空，实际等于放行。

涉及：`adminNotifications` `adminUserManager` `uploadResource` `updateResource` `manageAdConfig` `manageAvatarFrames` `manageTopics` `manageTopicLayout` `managePointsConfig` `manageHomeTabs` `manageDailyPicks` `manageConfig`

> 只有 `adminSecurityConfig/withAdmin.js`、`analyzeResource` 等 3 份是 fail-closed。

修复：**删掉 16 份副本，抽成共享模块**（见第四节冗余治理），统一用 `adminSecurityConfig/withAdmin.js` 的 fail-closed 版本。

### P1-2 `verifyToken` / `logout` 永久失效（真实 Bug）
`cloudfunctions/adminAuth/index.js:356`、`:650` 调用 `verifyAndGetAdmin({ token })` 传的是**对象**，而 `:60` 第一行是 `typeof token !== 'string'` → 直接返回 `TOKEN_EMPTY`。

后果：Web 后台的令牌校验与登出链路完全断裂，令牌无法吊销。改为 `verifyAndGetAdmin(token)`。

### P1-3 `operationsAssistant` 自研鉴权与 `adminAuth` 格式不兼容
`operationsAssistant/index.js:39-54` 只认 3 段式 `adminId.ts.sig`，而 `adminAuth` 签发的是 4 段式（`adminId.ts.version.sig`，见 `:64-69`）→ 恒返回 null，回退 openid 校验。两套签名实现（`:22-33` 与 `adminAuth:21-37`）还各自重复一份。

### P1-4 SSRF 防护不完整
`proxyDownload/index.js:52-53` 黑名单未覆盖 `172.17-31.x`、`169.254.169.254`、`::1`、`0:0:0:0:0:0:0:1`、十进制/八进制 IP 写法；且未做 DNS 重绑定防护（应先解析 IP 再校验、再用 IP 直连）。

### P1-5 数据库查询注入 / ReDoS
`getResources/index.js:296` `db.RegExp({ regexp: cleanKeyword })` 未转义用户输入 → 正则注入，可构造灾难性回溯拖垮全表查询。

修复：`cleanKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`，并限制长度（如 ≤ 30）。

### P1-6 上传无类型/大小校验
`uploadResource/index.js:190`、`:54-57`、`:74-82`：无扩展名白名单、无大小上限；`coverUrl` 用客户端传来的 `cloud://` 路径（可指向他人文件）；且 **>1MB 直接跳过安全校验，异常时也"放行"**。

修复：扩展名白名单 + 大小上限 + 强制 `imgSecCheck`，异常按失败处理而非放行。

### P1-7 积分可并发刷取
`userPoints/handlers/share.js:28-49`、`checkin.js:96-108` 采用"先 count 后写"，非原子操作，并发请求可突破每日上限。

修复：改条件更新（`where({ count: _.lt(MAX) }).update({ count: _.inc(1) })`）+ 唯一索引。
另：`toggleInteraction/index.js:58` `...payload` 让客户端任意字段落库，可批量刷 `hotScore` 操纵榜单。

### P1-8 Missonce admin 明文密码落盘 + 无页面级鉴权
- `Missonce admin/pages/login/login.vue:271` `storage.set(REMEMBER_KEY, { username, password })` —— 勾选"记住密码"后**明文密码**进 localStorage，`:159` 回填。
- **28 个页面无任何 `onShow` 守卫**，仅 `App.vue:19-31` 在 `onLaunch` 做一次 `checkAuth()`。`pages/` 下 `checkAuth|requireAuth|verifyToken` **0 命中**。H5 端改 hash 或小程序 deep-link 冷启动即可绕过。
- `utils/cloud.js:983-984` token 与 admin profile 一起落盘，`:946-976` `restoreSession()` 直接信任本地缓存。

### P1-9 Mini admin 开放注册 + 密钥模板隐患
- `Mini admin/src/main.ts:56` `/register` 路由 + `:99` 守卫白名单直接放行，`pages/Register.vue:183` `signUpWithOtp()` —— **任何人可无邀请码自助注册**。
- `Mini admin/.env.example:12` 定义 `VITE_ACCESS_KEY`。Vite 的 `VITE_` 前缀会被**内联进前端 bundle**，模板本身在引导把长期密钥打进产物（注释里也承认"会暴露在前端"）。应删除该行。
- `src/components/AdminSidebar.vue:30` `<span v-html="item.icon">` —— 当前图标来自本地常量安全，但一旦接口下发即成存储型 XSS。
- token 存 localStorage（`utils/cloudbase.ts:55/61/253`），非 httpOnly Cookie。

### P1-10 硬编码云环境 ID / AppID
`Mini admin/src/utils/cloudbase.ts:33`、`package.json:11`、`cloudbaserc.json:3` 与 `Missonce admin/utils/cloud.js:23-24` 均硬编码 `missonce-99-1gfaff6n002f6ac1` 与 `wx78c0b02bd2db5462`。虽非密钥，但环境切换需改代码，且泄露了后端环境标识。

---

## 三、P2 中（工程质量）

### 小程序端

| 位置 | 问题 |
|------|------|
| `utils/storageManager.js:177-187` | 冷启动 `getStorage` 同步返回 null（异步回填），而 `USER`/`USER_INFO` 在 deferred 列表（`:40-49`，延迟 1000ms 预热）→ 首秒内 `profile.js:252`、`tools.js:167`、`favorites.js:54` 全部误判未登录，登录态闪烁 |
| `app.json:32-49` | 4 个 tab 页全部配置 `"packages": ["subpackages"]`，wifi 下一次性下载整个分包（16 个页面）→ **分包机制形同虚设** |
| `utils/image.js:73` / `waterfall.wxml:1-34` / `home-feed.js:12-16` | 图片 URL 优化**三套实现**且参数冲突（JS 动态宽 vs WXS 硬编码 300x/500x），首页走 WXS，与 `image.js` 计算值不一致 |
| `behaviors/preview-common.js:49` | 模块顶层启动 5 分钟 interval，但 `_stopCacheCleanup()` 只在 `onUnloadCommon()` 调用 → 两预览页共用模块，preview 卸载即停掉 wallpaper 的清理 → 内存泄漏 |
| `utils/perf-test.js`（20KB） | 纯测试代码，动态 require 但小程序不摇树，**已进主包** |
| `pages/profile/profile.js:211,785-789` | 绕过 `storageManager` 直接 `wx.setStorage` → 内存缓存与磁盘不一致，下次读到旧值 |
| `pages/index/modules/home-cache.js:140-197`、`profile.js:465/550/598/730/931` | 频繁写大对象进 storage，无节流 |
| `utils/perf-test.js:48` | 裸调 `wx.getSystemInfoSync()` 无 try/catch、无 `getDeviceInfo` 降级（同项目 `device.js:12`、`storageManager.js:108` 都做了正确降级） |
| `utils/logger.js:13-27` | 正式版 `debug/log/info/warn` 全被 `isProd()` 吞掉 → **线上问题完全无法观测** |
| `utils/performance.js:19-37` | 空壳：`endPageLoad` 只 `console.group()`，传入的 `extraInfo` 未使用，4 个页面在调用但零产出 |
| `utils/auth.js:142-144/187-188/292-293` | `USER` 与 `USER_INFO` 存同一对象，双写双读 |

> 澄清：`utils/auth.js:100` 的 `Math.random()` 仅用于生成默认昵称（`` `用户${...}` ``），**不用于 session/token，不是安全漏洞**。登录链路是 `wx.login()` → code → 云函数换 openid，设计正确。

### 云函数端

- `adminAuth/index.js:19` Token TTL 24h 偏长且无服务端会话表，无法主动吊销
- `adminAuth/index.js:160` 遗留无盐 SHA256 密码校验（应强制一次性升级后删除）
- `deleteResources/index.js:81-89` 只认 openid 不认 adminToken → Web 后台不可用（功能缺陷）
- `updateUserInfo/index.js:28` `nickName` 无长度/字符过滤 → 昵称污染
- `manageConfig/index.js:26` `getAll` 无 limit，全表拉取
- `updateResource/index.js:56/64/88` 打印完整 `event`（含 token）到日志
- `getResources/index.js:339` limit 上限 100（合理，无需改）

---

## 四、冗余代码治理

### 4.1 最严重：16 份 `withAdmin.js` 副本

`cloudfunctions/` 下存在 **16 个内容高度雷同的 `withAdmin.js`**（13 份 fail-open 完全相同，3 份 fail-closed）。这意味着：
- 每次修改鉴权逻辑要改 16 处
- 13 个地方存在 fail-open 降级，任何一处遗漏都是越权入口
- 新增云函数时大概率复制错版本

**修复：抽到 `cloudfunctions/shared/withAdmin.js`（fail-closed 单一版本），其余 15 份全部删除改为 require。这一项能同时消灭 P0/P1 中的多个越权面。**

同类重复：
- `cloud.init` + `cloud.database()` 在 **~48 个 index.js** 中逐字重复
- `sign()` / `safeEqual()` 在 `adminAuth:21-37` 与 `operationsAssistant:22-33` 重复
- `clearResourceCache()` 在 `updateResource:14-38` 与 `deleteResources:16-34` 重复
- `checkMemberStatus()` 在 `login:9-21` 与 `userPoints/shared.js:110-125` 重复
- `loadConfig()` 在 `uploadResource:14-36` 与 `analyzeResource:26-55` 重复
- 响应封装 `{success, message}` **无任何统一工具**

### 4.2 两套功能重合 85~90% 的管理后台

| 实体 | Mini admin (38 页) | Missonce admin (28 页) |
|---|---|---|
| 资源 | `ResourcesPage` `AvatarFramesPage` | `resource-list` `resource-detail` `resource-upload` `recycle-bin` |
| 首页 | `HomeTabsPage` `DailyPicksPage` | `home-tabs` `daily-picks` |
| 专题 | `TopicsPage` `TopicLayoutDesigner` | `topic-list` |
| 广告 | `PageAdsManager` | `ad-config` |
| 用户 | `UserManagerPage` | `user-list` `user-detail` |
| 公告 | `NotificationsPage` | `notification-list` `notification-edit` |
| 配置 | `PointsConfig` `ContactConfig` `AIConfig` … | `points-config` `app-config` `ai-config` |

**Mini admin 是 Missonce admin 的功能超集**（多出媒体解析、下载管理、商城、布局设计器、运营看板等 10+ 模块，且带 TS、RBAC、vitest，质量明显更高）。

**建议：保留 Mini admin 作为唯一主后台。** Missonce admin 仅在"移动端巡检"是真需求时保留并降级为只读，否则废弃（可省下 23,726 行代码的维护成本）。

顺带的依赖问题：
- `@cloudbase/js-sdk` 两个后台大版本分裂（Mini `^2.7.0` vs Missonce `^3.6.2`），同一云环境两套 SDK 行为不一致
- Mini admin `package.json:35` `vuedraggable ^4.1.0` 是 **Vue2 版本**，Vue3 应用装它是典型误装（应为 `vuedraggable@next` 或 `vue-draggable-plus`）

### 4.3 小程序端死代码清单

**建议直接删除**

| 文件 / 代码 | 依据 |
|---|---|
| `subpackages/store/`（整目录） | 无任何 `navigateTo` 指向，`app.json:26` 仅注册 |
| `subpackages/group-qr/`（整目录） | 同上，`app.json:27` 仅注册 |
| `utils/perf-test.js`（20KB） | 纯测试代码，误入生产主包 |
| `components/waterfall/waterfall.js:38-41,47-51,129-170` + `waterfall.wxml` 的 vscroll 模块 | `enableVirtualScroll` 全项目无一处开启，约 80 行死代码 |
| `components/waterfall/waterfall.js:116-118` `_splitAds` | 恒返回 `{ads:[], others:items}`，已无意义 |
| `behaviors/preview-common.js:225-245` | `onShareAppMessage`/`onShareTimeline` 被 `preview.js:782`、`wallpaper-preview.js:848` 完全覆盖，永不执行 |
| `pages/index/index.js:598-602` | 空 `onHide`/`onUnload` |
| `utils/api.js:46-58` default export | 无 CommonJS 调用方 |
| `utils/performance.js` | 空壳（或改造后保留） |

**建议合并**

| 目标 | 说明 |
|---|---|
| 16 份 `withAdmin.js` → `shared/withAdmin.js` | **最高优先级** |
| `utils/cache.js` → `utils/storageManager.js` | 唯一使用方是 `daily-picks.js`，加带 TTL 的 `getWithExpire/setWithExpire` |
| `waterfall.wxml` 的 WXS `optimizeUrl` → 删除 | 统一走 `utils/image.js:41 optimizeImageUrls` |
| `home-announce.js` → `services/notificationService.js` | 消除 `getNotifications` 的双份封装与双份去重 |
| `preview.js:782-830` 与 `wallpaper-preview.js:848-895` | 分享逻辑参数化收进 `behaviors/preview-common.js` |
| 6 处分享配置 → `config/share.js` | `index/preview/wallpaper-preview/points/tools/profile` 近乎同构 |
| 4 处 `onPullDownRefresh` → `behaviors/refreshable.js` | index / resource-list / daily-picks / topics |
| 4 处分页加载 → `behaviors/paginated.js` | `home-feed.js` 三份 `loadXxxResources` 可减为一份参数化实现 |
| 4 处日期格式化 → `utils/format.ts` | Mini admin 的 4 个页面各自实现 |

**死组件（可删）**：
- Missonce admin：`components/mc-badge/`、`components/mc-list-item/`（全库 0 引用）
- Mini admin：`src/components/animations/` 13 个里 9 个未使用 —— `BlurText` `Counter` `DecryptedText` `Magnetic` `RotatingText` `SpotlightCard` `StarBorder` `StepperFlow` `TrueFocus`

**构建产物**：`Missonce admin/unpackage/` **11.51 MB**（含 `app-service.js` 2.13MB）已落盘，虽被 `.gitignore` 忽略，建议清理并加入 CI 检查。

---

## 五、做得好的地方

客观地说，项目有几块质量相当扎实，不应在重构中被破坏：

- **小程序缓存分层**：L1 内存 / L2 storage / L3 home_cache / L4 网络，设计清晰
- **低端机渲染上限**：首页 pageSize=20 且低端机 cap=60，有意识地控制渲染压力
- **瀑布流用增量 setData 路径更新**，而非全量刷新
- **列表图片已全量 `lazy-load`**，`lazyCodeLoading: "requiredComponents"` 已开启
- **云函数侧 env 缺失即抛错**：`adminAuth/index.js:14-17`、`operationsAssistant/index.js:16-19` 写法正确（对比 `proxyDownload` 的 `|| '默认密钥'` 是反例）
- **Mini admin 路由守卫** `main.ts:97-136` 覆盖完整，`:125` 有 `requireRole: 'superadmin'` RBAC，`:89` 有 404 兜底
- **无** `eval` / `new Function` / `rejectUnauthorized`；`OpsImageLoader.vue:144` 的 `innerHTML` 是硬编码常量 SVG，无注入面
- 仓库内**没有真实的 `.env` 或密钥文件**，只有 `.env.example` 模板

---

## 六、修复排期

### 第 1 天：止血（P0，建议当天发版）
1. `adminAuth` 删除 `generateToken` 的 else 分支（P0-1）
2. `adminAuth` 手机号登录接入短信验证码或下线（P0-2）
3. `proxyDownload` / `getProxySign` 删除硬编码密钥兜底 + **轮换密钥**（P0-3）
4. `adConfigManager` 用 fail-closed `withAdmin` 包裹（P0-4）
5. `testAiConnection` 加鉴权 + host 白名单（P0-5）
6. `aiGenerateText` 加登录态 + prompt 长度限制 + 配额（P0-6）
7. `shareCode` 三个 admin 分支加鉴权（P0-7）

### 第 2-3 天：鉴权体系收敛
8. 删除 16 份 `withAdmin.js`，统一为 `shared/withAdmin.js`（fail-closed）—— 同时解决 P1-1 与冗余 4.1
9. 修 `verifyAndGetAdmin({ token })` → `verifyAndGetAdmin(token)`（P1-2）
10. `operationsAssistant` 对齐 4 段式 token 格式（P1-3）
11. `getResources` 正则转义（P1-5）、`uploadResource` 类型/大小校验（P1-6）、积分改条件更新（P1-7）

### 第 1 周：后台与小程序
12. Missonce admin 删除明文密码存储 + 补页面级 `onShow` 守卫 + 停止缓存 admin profile（P1-8）
13. Mini admin 关闭 `/register` 或加邀请码门禁、删除 `.env.example` 的 `VITE_ACCESS_KEY`、去掉 `v-html`（P1-9）
14. 修复 `storageManager` 冷启动返回 null（P2，用户体验最直观）
15. `app.json` 收紧 preloadRule（P2，首屏体积收益明显）
16. 统一图片 URL 处理为 `utils/image.js` 一套（P2）
17. 删除 `security-report.json`

### 第 2-4 周：架构与冗余
18. 决策 Missonce admin 去留（建议废弃，保留 Mini admin）
19. 删除小程序端死代码与 9 个死组件
20. 抽取 behaviors：`refreshable` / `paginated` / 分享配置
21. `utils/logger.js` 生产环境保留 warn 以上输出，接入真实上报
22. 统一 `@cloudbase/js-sdk` 版本，替换 `vuedraggable@4.1.0`
23. 清理 `unpackage/` 并加入 CI 检查

---

## 七、问题统计

| 级别 | 数量 | 关键词 |
|------|------|--------|
| 🔴 P0 | 7 | 任意签发超管 Token、手机号免密登录、硬编码签名密钥、广告接口无鉴权、SSRF、AI 盗刷、分享码可删 |
| 🟠 P1 | 10 | 13 份 fail-open withAdmin、verifyToken 失效、两套 token 格式、SSRF 名单不全、正则注入、上传无校验、积分可刷、明文密码、开放注册、硬编码 envId |
| 🟡 P2 | 17 | storage 冷启动、preloadRule 全量、图片处理三套、定时器泄漏、测试代码进主包、日志被吞、事件含 token 打印 |
| ♻️ 冗余 | — | **16 份 withAdmin 副本**、两套后台重合 85~90%、13 处重复逻辑、9+2 个死组件、11.51MB 构建产物 |

### 最需要立刻处理的三件事

1. **`adminAuth/index.js:327-344`** —— 无 openid 分支直接签发超管 token，整个后台可被接管，改动量 10 行。
2. **`proxyDownload/index.js:35` + `getProxySign/index.js:7`** —— 签名密钥明文在仓库里，且去水印项目有同款问题，改完必须轮换密钥。
3. **16 份 `withAdmin.js` 收敛为 1 份 fail-closed** —— 这一项同时消灭一个 P0、一个 P1 和最大的一处冗余，是投入产出比最高的改动。
