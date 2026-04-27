# GrassEye 本地真实 Chrome 会话与登录态持久化施工图

## 1. 定位

真实平台 Agent 必须运行在本机真实 Chrome 持久化 Profile 中。
登录态由 Chrome Profile 本地保存。
GrassEye 只复用 profile，不读取 cookies。

## 2. 为什么不能用临时浏览器

- 临时 Chromium 每次启动都会丢失登录态。
- 真实平台 Agent 无法稳定运行连续无人值守主链。
- 用户会被迫在每次运行时重新登录。
- 登录挑战、CAPTCHA 与风控概率会被放大。
- 系统无法形成长期、稳定、可审计的本地授权环境。

## 3. 正确启动模式

GrassEye 必须支持 real_chrome_persistent 模式：

- 使用系统真实 Chrome executable。
- 使用专用持久化 userDataDir。
- 建议路径：.grasseye-local/browser-profiles/<platform>/。
- 该路径必须 gitignored。
- 用户第一次运行时手动登录。
- 后续运行复用同一 profile。
- Workbench 必须显示 profile status。

## 4. Profile 与 cookies 边界

必须明确：

- cookies、session、token 只能保存在 Chrome 本地 Profile 内。
- GrassEye 不读取 cookies。
- GrassEye 不导出 cookies。
- GrassEye 不打印 cookies。
- GrassEye 不上传 cookies。
- GrassEye 不把 cookies 写入 evidence、packet、ledger、logs。
- Logs 只允许写 profileRef，不允许写 cookie 内容。

## 5. 启动状态机

CHECK_REAL_CHROME_AVAILABLE
-> CHECK_PROFILE_DIR
-> LAUNCH_REAL_CHROME_WITH_PERSISTENT_PROFILE
-> OPEN_TARGET_PAGE
-> DETECT_LOGIN_STATE
-> IF LOGGED_IN: CONTINUE_AGENT
-> IF LOGIN_REQUIRED: OPERATOR_LOGIN_REQUIRED
-> IF CAPTCHA_OR_SAFETY: REVIEW_REQUIRED

## 6. 禁止模式

禁止：

- chromium.launch 临时 profile 作为真实平台模式。
- browser.newContext 临时 context 作为真实平台模式。
- incognito 或 private mode。
- headless default for real-platform。
- storageState 导出 cookies。
- context.cookies() 读取 cookies。
- addCookies 注入 cookies。
- localStorage 或 sessionStorage dump。
- cookie、session、token 写日志。
- cookie、session、token 写 Evidence Packet。
- cookie、session、token 写 Browse Ledger。
- remote browser service。
- cloud browser。
- proxy、account、fingerprint、captcha bypass。

## 7. Workbench 必须显示

- browserMode
- browserExecutable
- browserProfileRef
- browserProfileStatus
- loginState
- lastLoginCheckAt
- loginRequiredReason
- reviewRequiredReason

## 8. 结构化日志要求

必须记录：

- check_real_chrome_available
- check_profile_dir
- launch_real_chrome_with_profile
- open_target_page
- detect_login_state
- operator_login_required
- browser_profile_reused
- browser_profile_unavailable
- review_required

日志只允许记录 profileRef，不允许记录 cookies。