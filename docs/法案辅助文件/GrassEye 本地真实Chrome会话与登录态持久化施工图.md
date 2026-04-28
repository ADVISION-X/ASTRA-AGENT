# GrassEye 本地真实Chrome会话与登录态持久化施工图

## 定位

真实平台运行必须基于本机真实 Chrome 持久化 profile。

本图只描述浏览器会话底层边界，不定义 open、page-state 或 post-action verification 主权。

## 正确模式

- 使用系统真实 Chrome executable
- 使用本地持久化 userDataDir 和 profile directory
- browserMode = real_chrome_persistent
- browserProfileDirectory = .grasseye-local/browser-profiles/<platform>/
- profile 目录必须 gitignored
- 用户在本地浏览器内手动登录
- GrassEye 只复用 profile，不读取 cookies
- GrassEye 不读取 cookies

## current Chrome handoff

- 当前本地浏览器 handoff 是固定页面打开的简单主路径
- handoff policy id: HANDOFF_FIXED_URL_TO_CURRENT_LOCAL_BROWSER
- handoff slug: handoff_fixed_url_to_current_local_browser
- handoff primitive: open <url>
- macOS shell primitive: open -a <Chrome.app> <url>
- 打开浏览器必须有单一来源代码文件
- launch 启动本地服务与打开 workbench 页面，不得依赖 平台级 open owner、测试脚本或旧降级浏览器路径

## profile metadata

- profile.last_used 必须可记录为 profile 元数据
- browserProfileDirectory 必须贯穿 server -> workbench -> current Chrome controller
- 先复制一个受控 profile 再打开 URL 只允许作为未来可替换策略说明，不能回流旧 dedicated-profile downgrade path

## 责任分层

- 固定 URL 打开：由 Open Ability Group 负责
- 浏览器 profile 复用：由 Open Ability Group 内部的 local-browser-session 子边界提供
- 页面状态识别：由 Page State 负责
- 动作结果判断：由 Post-action Verification 负责

## 可记录信息

- profileRef
- profile path metadata
- browserMode
- loginState

## 禁止边界

- 不读取 cookies、sessions、tokens、passwords
- 不把 local-browser-session 写成独立 owner 或 open 主权
- 不把 local-browser-session 写成 page-state owner
- 不把 local-browser-session 写成 post-action verification owner
- 不允许 verify 脚本作为浏览器会话验收链
- 如果 current Chrome handoff 失败，任务必须立刻进入 `review_required`
- 不允许回流 removed downgrade path、Playwright 浏览器控制器或 dedicated profile env key

## 验收信号

建对表现：

- 真实平台运行复用本地持久化 profile
- 登录态由浏览器 profile 自身保存
- 文档不再把会话层写成能力主权

漂移信号：

- storageState / cookie 导出重新进入主链
- headless 默认成为真实平台验收路径
- 文档重新把打开、状态判断、结果验证写到会话层
- current Chrome handoff 不再是单一来源，或浏览器打开路径分散到多个 helper
