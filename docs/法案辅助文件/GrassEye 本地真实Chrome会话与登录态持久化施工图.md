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
- 使用真实 Chrome userDataDir 根目录，并锁定具体 profile directory。
- 建议路径：.grasseye-local/browser-profiles/<platform>/。
- 该路径必须 gitignored。
- 用户第一次运行时手动登录。
- 后续运行复用同一 profile。
- 如果操作者未显式提供 profile directory，允许从 Chrome Local State 中解析 `profile.last_used` 作为最近使用 profile。
- Workbench 必须显示 profile status。

### 3.1 当前本地浏览器 handoff 是固定页面打开的简单主路径

- 对固定页面打开和本地 workbench 页面唤起，优先复用当前本地浏览器应用，而不是为“打开一个 URL”额外新造受控 profile。
- macOS 启动 handoff 的简单主路径是系统 open 命令：`open <url>`。
- `open <url>` 的目标是把固定页面内容交给当前本地浏览器会话处理，从而继承操作者已经存在的登录态、窗口组和浏览器偏好。
- 这条 handoff 只负责“打开到当前本地浏览器会话”，不等于读取 cookies，也不等于 DOM/BOM 接管页面。
- 如果只是为了打开 TikTok、打开 workbench、打开固定入口页，不得把问题复杂化成“先复制一个受控 profile 再打开 URL”。
- 受控持久化 profile 只用于明确声明的专用浏览器会话，不得冒充“当前已经登录的浏览器”。

### 3.2 浏览器打开责任分层

- 固定 URL 打开：走当前本地浏览器 handoff，macOS 使用 `open <url>`。
- 已授权 profile 证明：必须来自操作者明确提供的本地 profile 引用和路径，不能靠静默默认推断。
- 受控真实 Chrome 会话如果要复用操作者当前登录身份，除了 userDataDir 根目录，还必须知道具体 profile directory。
- `userDataDir` 只代表 Chrome 用户数据根目录，不足以证明进入的是当前登录的那个 profile。
- 当操作者只提供 Chrome 根目录时，运行时可以读取 Local State 的 `profile.last_used` 来解析最近使用 profile directory，但不得读取 cookies。
- GrassEye 不得把 `.grasseye-local/browser-profiles/<platform>/` 默认解释为“当前操作者正在使用的已登录浏览器”。
- 如果运行链需要专用 profile，那是单独的受控会话选择问题，不是固定页面打开问题。

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
-> HANDOFF_FIXED_URL_TO_CURRENT_LOCAL_BROWSER
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
- browserProfileDirectory
- browserProfileStatus
- loginState
- lastLoginCheckAt
- loginRequiredReason
- reviewRequiredReason

## 8. 结构化日志要求

必须记录：

- check_real_chrome_available
- check_profile_dir
- handoff_fixed_url_to_current_local_browser
- launch_real_chrome_with_profile
- open_target_page
- detect_login_state
- operator_login_required
- browser_profile_reused
- browser_profile_unavailable
- review_required

日志只允许记录 profileRef，不允许记录 cookies。