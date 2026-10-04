# 小辣椒头像 — 增量复审报告

**复审日期**：2026-10-04  
**复审范围**：① 2026-09-11 `CODE_REVIEW.md` 的 P0 结论是否落地；② 2026-09-11 之后 23 个未提交改动引入的新问题  
**说明**：本报告不重复旧报告已覆盖的全量内容，只做**修复状态核验 + 增量审查**。

---

## 零、结论先看

| 项                       | 结论                                          |
| ----------------------- | ------------------------------------------- |
| 旧报告 7 个 P0 漏洞           | **全部未修复**（逐条码级核验，见第一节）                      |
| 增量改动新引入的缺陷              | 发现 2 个，**已在本次复审中修复并验证通过**（见第二节）             |
| Mini admin 三个 `.vue` 修复 | **已上线**（本地 dist 与线上入口一致 `main-VTks0koY.js`） |
| 小程序端改动（触感震动 / SVG 图标）   | **未发版**，需开发者工具上传                            |
| 本轮修复的全部云函数 + Mini admin    | **已全部部署上线**（2026-10-04：9 个云函数 + CloudBase 托管 + 自有服务器 missonce.cc） |

> 📌 **后续进展**：7 个 P0 **全部完成代码修复、提交并已部署上线**（2026-10-04）。  
> - `8a64f75`：P0-1 / P0-3（含密钥轮换）/ P0-4 / P0-6  
> - `a14872e`：P0-2（保留并修复验证码登录）/ P0-5（SSRF）/ P0-7（分享码越权）+ 顺带修复 P1-2 Token 校验失效  
> 部署后经 invoke 实测：代理签名 `PROXY_SIGN_SECRET` 两端一致（非 `MISCONFIGURED`）；`getHomeTabs` 返回 `fixed_recommend`/`fixed_latest` 主键；`withAdmin` 加固的 4 个函数均正确拒绝未授权调用。  
> **仍需你操作**：部署 `adminAuth` 后，用账号密码登录后台 → 点顶栏盾牌图标「**账号安全**」→ 发送验证码并启用（写入 `authUid`），之后验证码登录即生效（账号密码登录不受影响）。

## 一、旧报告 P0 修复状态核验（初版结论：7/7 未修复）

初版结论为**全部未修复**（下表「初版复核证据」列保留当时的取证记录）；7 项均已在该日后续修复，见「当前修复状态」列与第六节部署清单。

| #    | 问题                | 位置                                                         | 状态   | 本日复核证据                                                                                 |
| ---- | ----------------- | ---------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------- |
| P0-1 | 可为任意管理员签发超管 Token | `adminAuth/index.js:308-349`                               | ❌ 未修 | `callerOpenid` 为空时的 `else` 分支仍在，只加了 ObjectId 正则，仍「查到存在就签发」，直接 `generateToken(adminId)` |
| P0-2 | 管理员手机号免密登录        | `adminAuth/index.js:486-604`                               | ⚠️ 初版未修 | 全文无 `sms` / `验证码` / `verifyCode`，仅凭 phone / username / uid / `_openid` 匹配即签发           |
| P0-3 | 代理签名密钥硬编码         | `proxyDownload/index.js:35`<br />`getProxySign/index.js:7` | ❌ 未修 | 两处均为 `process.env.PROXY_SIGN_SECRET \|\| 'missonce-proxy-sign-key-v2'`，明文仍在源码与 Git 历史  |
| P0-4 | 广告配置接口无鉴权         | `adConfigManager/index.js`                                 | ❌ 未修 | `ensureAdmin()` 仍是空壳（注释自认不校验）且**在整个文件中从未被调用**，唯一拦截是 `denyIfMiniProgram()`              |
| P0-5 | 任意 URL SSRF       | `testAiConnection/index.js:7-50`                           | ⚠️ 初版未修 | 完全信任客户端传的 `API_URL` / `API_KEY`，`url.parse` 后直接 `https.request`，无白名单                   |
| P0-6 | AI 盗刷             | `aiGenerateText/index.js`                                  | ❌ 未修 | 全文鉴权关键词搜索**仅命中第 51 行 `max_tokens: 500`**，`OPENID` / `admin` / `quota` / `limit` 一律为空   |
| P0-7 | 分享码 admin 动作零鉴权   | `shareCode/index.js:41-49`                                 | ⚠️ 初版未修 | 注释写着「需 adminToken 鉴权」但三分支直接执行，无 token 校验                                               |

### 当前修复状态（2026-10-04 05:20 更新）

| #    | 当前状态              | 修复方式                                                                                                          |
| ---- | ----------------- | ------------------------------------------------------------------------------------------------------------- |
| P0-1 | ✅ 已修，**待部署**      | 删除无 openid 时的签发分支，无登录态一律拒绝。该 action 前端无调用方，令牌发放实际由 `loginByAccount`/`loginByPhone`/`refreshToken` 承担          |
| P0-2 | ✅ 已修，**待部署**      | 保留验证码登录：后端读平台注入 `TCB_UUID`/`TCB_ISANONYMOUS_USER` 判定调用者已通过短信验证；匹配只认可信 `authUid` 锚点（不再 phone 命中即自动绑定，防抢占）；移除不可信 uid/_openid 兜底与回填；新增 `bindPhoneLogin`/`unbindPhoneLogin` 绑定入口 |
| P0-3 | ✅ 已修，**待部署**（含轮换） | 移除明文兜底改 fail-closed；新密钥为 32 字节随机串，经 `cloudbaserc.json` 的 `envVariables` 下发（该文件在 `.gitignore`，密钥不入库）           |
| P0-4 | ✅ 已修，**待部署**      | 用 `withAdmin` 包裹 `exports.main`；Mini admin 的 `callCloudFunction` 已自动注入 `adminToken`，前端无感                      |
| P0-5 | ✅ 已修，**待部署**      | `withAdmin` 鉴权 + https 域名白名单（内置 5 家 AI 服务商，可用 `AI_ALLOWED_HOSTS` 追加）+ 移除 `rawBody` 回显 + 校验与请求统一用 WHATWG `URL`（避免畸形 URL 绕过） |
| P0-6 | ✅ 已修，**待部署**      | `withAdmin` 鉴权 + `prompt` 1000 字 / `systemPrompt` 2000 字长度护栏；唯一调用方 `QuotesPage.vue` 已走 `callFunctionWithAuth` |
| P0-7 | ✅ 已修，**待部署**      | `withAdmin` 包裹，用 `exclude` 保留 `encode`/`decode` 给普通用户正常使用                                          |

> P0-3 的旧明文密钥 `'missonce-proxy-sign-key-v2'` 已随公开仓库泄露，即便不改代码也应视为失效——轮换是必须动作。

**修复优先级**：7 个 P0 全部已修复提交，统一待部署上线（详见第六节命令清单）。

---

## 二、增量审查：发现 2 个缺陷（已修复）

### A-1 【P1】AI 自动命名从未生效（静默失效）

**位置**：`cloudfunctions/analyzeResource/index.js`

两根链条对不上导致功能死掉：

1. `ResourceUploader.vue` 改动后，落库 `title` = 云存储随机名 `20261003-223612-a3f9k2.gif`，`originalFileName` = `下载1.gif`
2. `analyzeResource` 判定用户是否手写的条件是 `resource.title !== resource.originalFileName`

两者**天然恒不相等** → `userTitled` 恒为 `true` → AI 标题**一次都不会被写入**。  
你为此加的提示词改写（`AIKeyManager.vue`）和结果清洗逻辑全部空转，且不报错、无日志异常，属于最难发现的那种失败。

**修复思路**（根因方案，而非补丁）：不再用「title 与原始文件名是否相等」推断，改为**反向识别系统自动命名格式**，并兼容历史数据：

```js
const AUTO_NAME_RE = /^\d{8}-\d{6}-[a-z0-9]{4,8}\.[a-z0-9]{1,5}$/i;
const currentTitle = String(resource.title || '').trim();
const isSystemNamed = AUTO_NAME_RE.test(currentTitle);          // ① 新流程：随机存储名
const sameAsOriginal = !!resource.originalFileName
  && currentTitle === String(resource.originalFileName).trim(); // ② 历史数据：title 仍是原始名
const titledByUser = !isSystemNamed && !sameAsOriginal;         // ③ 其余一律视为用户手写
```

修复中还处理了一处衍生问题：原 `else if` 分支引用了已删除的变量 `userTitled`，若仅替换判定逻辑而漏改，会直接 **ReferenceError 导致整个 AI 分析失败**。已同步改为 `titledByUser`。

**验证**（5 条用例矩阵，全部通过）：

| 场景                 | title                        | originalFileName | 结果        |
| ------------------ | ---------------------------- | ---------------- | --------- |
| 上传未命名（新流程）         | `20261003-223612-a3f9k2.gif` | `下载1.gif`        | AI 覆盖命名 ✅ |
| 用户手填中文标题           | `赛博晚霞`                       | `下载1.gif`        | 保留用户标题 ✅  |
| 历史数据 title=原始名     | `下载1.gif`                    | `下载1.gif`        | AI 覆盖命名 ✅ |
| 历史数据无 originalName | `IMG_20260101.jpg`           | —                | 保留标题（保守）✅ |
| 用户标题含符号            | `赛博晚霞-限定版`                   | `下载1.gif`        | 保留用户标题 ✅  |

### A-2 【P1】`getHomeTabs` 三条兜底路径仍返回无主键虚拟 Tab

**位置**：`cloudfunctions/getHomeTabs/index.js`

上一个会话根治了「固定 Tab 是无 `_id` 的虚拟对象」这一根因（改为自愈写入真实文档 + 确定性主键）。但**三条兜底分支漏改**，老坑仍在：

- 自愈失败时的降级返回
- 集合为空的返回
- 最外层 catch 的返回

这三处仍拼出不带 `_id` / `id` 的对象。关键在于：**一旦 `add()` 因数据库权限等原因失败，就会每次都走降级**，前端又拿到无主键 Tab，管理后台「缺少标识、无法编辑」的问题原样复现。

**修复**：新增统一 helper `toDefaultApiTabs()`，三处兜底全部改为携带确定性 `_id` / `id`。降级的 `merged` 也补上主键，使 `sortForDisplay` 的置顶排序能正确识别。

**验证**：断言「全部带 `_id`/`id`」与「推荐固定置顶」均 PASS；两个文件 `node --check` 语法通过，无变量残留。

---

## 三、经核实**不是**问题（避免过度告警）

| 疑点                                                                   | 结论                                                                                                                                 |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `preview-common.js` 是 CommonJS，却 `require` 了 ES module 的 `haptic.js` | **安全**。同文件早已 `require('../utils/api.js')`（该文件本身是 ESM）且长期正常运行；`project.config.json` 开了 `es6:true` + `enhance:true`，工具统一转译，具名解构可正常工作 |
| `utils/haptic.js` 实现质量                                               | 良好。`SCENE_PROFILES` 集中管手感、后续连击走 `fire()` 绕过节流的设计是对的、iOS 连击上限裁剪正确；唯一瑕疵是 `setTimeout` 未回收（页面卸载后极小概率多震一次，影响可忽略）                       |
| `HomeTabsPage.vue` 的 `item-key="id"` + `tabId()` 兼容取值 + 编辑拦截         | **正确**，与已部署的 `getHomeTabs`（同时返回 `_id` 和 `id`）配合良好                                                                                  |

**顺带记录一处注释与实现不符**（未改动，建议下次顺手修）：  
`utils/api/interactions.js` 注释写「点赞成功用 medium，取消用更轻的 light」，实际调用的是 `hapticSuccess()`（heavy×3）/ `hapticCancel()`（medium×1）。

---

## 四、部署状态同步（重点）

| 模块                                    | 改动是否在线上 | 需做什么                                                      |
| ------------------------------------- | ------- | --------------------------------------------------------- |
| Mini admin 三个 `.vue`                  | ✅ 已上线   | 无需操作                                                      |
| `analyzeResource`、`getHomeTabs`（本次修复） | ❌ 未部署   | 需重新 deploy                                                |
| 小程序端：触感震动 + `menu-haptic.svg`         | ❌ 未发版   | 开发者工具上传并提交审核                                              |
| `home_tabs` 历史重复数据                    | ⚠️ 未清理  | 后台手动删重复 tag Tab，**保留 `fixed_recommend` / `fixed_latest`** |

### 云函数部署命令（在 `WeChat Mini/` 目录执行）

```bash
# 本轮审查修复的功能缺陷
yes | node_modules/.bin/tcb fn deploy analyzeResource -e missonce-99-1gfaff6n002f6ac1
yes | node_modules/.bin/tcb fn deploy getHomeTabs -e missonce-99-1gfaff6n002f6ac1

# P0 安全修复
yes | node_modules/.bin/tcb fn deploy adminAuth        -e missonce-99-1gfaff6n002f6ac1
yes | node_modules/.bin/tcb fn deploy proxyDownload    -e missonce-99-1gfaff6n002f6ac1
yes | node_modules/.bin/tcb fn deploy getProxySign     -e missonce-99-1gfaff6n002f6ac1
yes | node_modules/.bin/tcb fn deploy adConfigManager  -e missonce-99-1gfaff6n002f6ac1
yes | node_modules/.bin/tcb fn deploy aiGenerateText   -e missonce-99-1gfaff6n002f6ac1
yes | node_modules/.bin/tcb fn deploy shareCode        -e missonce-99-1gfaff6n002f6ac1
yes | node_modules/.bin/tcb fn deploy testAiConnection -e missonce-99-1gfaff6n002f6ac1
```

> ⚠️ **`proxyDownload` 与 `getProxySign` 必须在同一批内都部署成功**。  
> 两者校验的是同一个 `PROXY_SIGN_SECRET`，只部署其中一个会造成签名校验不匹配，  
> 代理下载功能直接全链路失败。
>
> ⚠️ **部署 `proxyDownload` / `getProxySign` 前，先确认环境变量已随 `cloudbaserc.json` 下发**。  
> 这两个函数已改为 fail-closed，若云端拿不到 `PROXY_SIGN_SECRET`，会明确返回  
> `MISCONFIGURED` 而不是悄悄降级（这正是目的），但意味着**功能会停**。  
> 部署后立即用一次真实下载验证。
>
> `tcb fn list` 只显示 20 条，别用它判断函数是否存在；用 `tcb fn invoke` 实测确认。  
> 新增的 `withAdmin.js` 副本已放进 `adConfigManager/`、`aiGenerateText/`、`shareCode/`、`testAiConnection/` 目录，  
> 部署时会随包上传（云函数无法跨目录 require，只能各带一份）。  
> 部署后验证 AI 命名：上传一张不填标题的图 → 触发 `analyzeResource` → 资源标题应变语义中文名（而非 `20261003-223612-xxxx.gif`）。  
> 部署 `adminAuth` 后，请用已有账号密码登录一次，再点顶栏「账号安全」完成 `authUid` 写入；  
> 否则历史管理员的验证码登录会因 `authUid` 尚未绑定而暂时不可用（账号密码登录不受影响）。

---

## 五、Git 提交情况

| commit    | 内容                                                                   |
| --------- | -------------------------------------------------------------------- |
| `aa5de27` | 功能修复：上传显示名、首页 Tab 主键、AI 自动命名失效、触感反馈；删除假安全报告；`.gitignore` 补 `*.bak-*` |
| `8641204` | 文档：全量审查报告、增量复审报告、后台 UI 原型                                            |
| `8a64f75` | 安全：P0-1/3/4/6 四个 P0 鉴权漏洞修复 + 密钥轮换 + `QuotesPage` 错误提示                          |
| `a14872e` | 安全：P0-2 保留并修复验证码登录（authUid 锚点 + 绑定入口）、P0-5 SSRF 白名单、P0-7 分享码鉴权 + 修 P1-2 Token 校验失效 + 前端绑定 UI/构建 |

> 注意：`cloudbaserc.json` 已从 `.gitignore` 排除（含 envId / appId / 签名密钥），**不入库**。  
> 换机器或从仓库全新克隆后，需要本地重建该文件才能部署。

---

## 六、部署结果（2026-10-04 已完成）

### 云函数（9 个，env `missonce-99-1gfaff6n002f6ac1`）
`tcb fn deploy` 全部成功。其中 `getHomeTabs`/`adminAuth`/`testAiConnection`/`proxyDownload` 初轮因**云端与 `cloudbaserc.json` 运行时不一致**导致配置更新失败（含 `PROXY_SIGN_SECRET` 未注入），已将这 4 个函数的运行时改回与云端一致后重部署，配置才成功应用。  
**invoke 实测结论**：
- `getProxySign` / `proxyDownload` 返回 `UNAUTHORIZED`（无微信登录态被拒，生产小程序云调用自带 OPENID 不受影响）→ 证明 `PROXY_SIGN_SECRET` 已注入且非 `MISCONFIGURED`
- `getHomeTabs` 返回 `fixed_recommend` / `fixed_latest` 确定性主键（修复生效）
- `adConfigManager` / `aiGenerateText` / `testAiConnection` / `shareCode`(adminList) 均返回 `UNAUTHORIZED`（withAdmin 生效）；`shareCode`(encode) 公开动作正常返回业务错误（exclude 排除正确）

### Mini admin 托管
- CloudBase 静态托管：110 文件，**部署地址** https://missonce-99-1gfaff6n002f6ac1-1318542519.tcloudbaseapp.com
- 自有服务器 `95.41.29.150`：`/www/wwwroot/missonce/`（域名 `missonce.cc` / `www.missonce.cc`），备份 `missonce.bak-20261004-114112`，覆盖解压后新入口 `main-C19L_dGg.js`，宝塔锁定的 `.user.ini` 与 `.well-known` 均保留
- 三个端点 curl 实测均返回 `main-C19L_dGg.js` ✅

### 补充修复：绑定入口不可见（同日 12:05 上线）
用户反馈「账号密码登录后找不到启用验证码登录的入口」。根因：绑定入口此前只放在**登录页**，且仅当「已有会话又停留在登录页」才显示，账号密码登录成功后即跳转后台，用户无从发现。
- 新增 `adminAuth.securityStatus` 动作（需 token，返回手机号与启用状态）
- `AdminTopbar` 新增「账号安全」盾牌入口（登录后始终可见）；`AppInner` 新增账号安全弹窗（发送验证码→启用 / 停用）
- 已重新构建并部署：`adminAuth` 云函数 + CloudBase 托管(109 文件) + 自有服务器（备份 `missonce.bak-20261004-120547`），三端点新入口 `main-7p23CVzG.js` ✅

### 补充修复：令牌字段名不匹配导致「启用验证码登录」恒提示缺登录态（同日 12:20 上线）

用户反馈：账号密码登录成功、短信验证码也能正常收到，但点「启用」仍报 `启用失败：缺少登录态，请先用账号密码登录`。

**根因（字段名不一致）**：前端 `callCloudFunction` / `callFunctionWithAuth` 统一注入的令牌字段是 **`adminToken`**（供 `withAdmin` 使用），而 `adminAuth` 主 handler 只解构了 `event.token`：

```js
const { action, token, ... } = event   // ← event.adminToken 被忽略，token 恒为 undefined
```

受影响动作：`bindPhoneLogin` / `unbindPhoneLogin` / `securityStatus`（点「启用」报错的直接原因）。
`verifyToken` 之所以一直正常，是因为 `fetchAdminProfile` 是**显式**以 `{ action: 'verifyToken', token: sessionToken }` 调用的，恰好命中了 `token` 字段——这个「一半能用、一半不能用」的错位把问题掩盖了。

**修复**（`adminAuth/index.js`）：

```js
const { action, adminId, username, password, phone } = event
const token = event.token || event.adminToken || ''   // 两个字段都兼容
```

**验证**：重部署 `adminAuth`（Nodejs20.19）后 invoke 实测——
- 不带令牌：`{"success":false,"message":"缺少登录态，请先用账号密码登录"}`（预期）
- 带 `adminToken` 字段（伪造值）：`{"success":false,"reason":"TOKEN_SIGNATURE_MISMATCH"}` → **证明 `adminToken` 已被正确读取**，不再落在「缺少登录态」分支

> 前端无需重新构建，刷新页面即可。

> 遗留隐患（未改动以控制部署面）：`withAdmin.js`（20 份副本）的 `verifyCaller` 同样只认 `event.adminToken`。当前前端调用点统一注入该字段，功能正常；若日后有调用方改用 `token`，会复现同类「鉴权不通过」。

### 仍需人工操作
1. **绑定启用验证码登录**：用账号密码登录后台 → 顶栏盾牌图标「**账号安全**」→ 发送验证码并启用（写入 `authUid`），之后验证码登录即生效（账号密码登录不受影响）
2. **真实下载验证**：在微信小程序内实测一次代理下载（抖音等），确认签名链路端到端可用（CLI 无 OPENID 无法模拟，需真机）
3. **小程序发版**：触感反馈与 `menu-haptic.svg` 图标仍在本地，需开发者工具上传
4. **遗留**：`home_tabs` 历史重复 tag Tab 需后台手动清理（保留 `fixed_recommend`/`fixed_latest`）；`withAdmin.js` 副本已扩散到 20 份，建议收敛为共享依赖

