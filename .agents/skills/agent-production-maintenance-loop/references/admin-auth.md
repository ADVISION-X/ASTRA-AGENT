# 网站管理员认证权威

## 是否需要登录

`run-one` 和 `run-primary` 需要有效的网站管理员会话。正式订单入口要求 authenticated commercial session；平台测试订单的免支付、全域资源和 AI 能力由该 session 对应的 `platform_system_operator` grants 提供。

`plan` 不需要登录。`diagnose` 只读取日志、store 或 Browser WAL 时不需要；必须打开管理员页面时才需要。

## 唯一查找位置

- 登录页：当前网站 origin 下的 `/admin/login`。
- 凭据文件：`/Users/nexgen/Documents/xuanxue-web/.env.local`。
- 账号键：`PLATFORM_ADMIN_EMAIL`。
- 密码键：`PLATFORM_ADMIN_PASSWORD`。
- 固定 principal：`platform-system-operator`。
- 必须返回的账号类型：`platform_system_operator`。
- 登录成功事实：`POST /api/account/login` 成功、返回账号类型正确，并进入 `/admin/system-status`。

该 `.env.local` 是 Git ignored 的本机凭据权威，权限必须保持 `0600`。密码在数据库中只有 hash，不能从数据库反查明文。

## 使用规则

1. 优先复用当前浏览器里仍有效的管理员 session；先检查当前账号类型，不重复登录。
2. 需要登录时，只允许现役具名 helper 在进程内消费上述两个环境变量且不向 Codex、工具参数、stdout/stderr 或日志返回值，或者由用户在现有 Chrome 中自行完成登录。不得让 Codex 读取密码后再传给 Browser；当前没有这种 helper 且没有可复用或用户完成的 session 时返回 `PLATFORM_ADMIN_SECRET_INJECTION_UNAVAILABLE`。
3. 不得 `cat`、`sed`、`rg`、`echo`、截图或日志输出变量值，也不得把值写入 Skill、命令参数、补丁、报告、聊天或新文件。文件或键缺失时返回 `PLATFORM_ADMIN_CREDENTIAL_SOURCE_MISSING`，不要扩大搜索范围。
4. 登录返回 401、账号类型不符或未进入 `/admin/system-status` 时返回 `PLATFORM_ADMIN_LOGIN_FAILED`；不要自动重试、猜密码或触发账号锁定。
5. `pnpm platform-admin:bootstrap`、`rotate-credential`、`sync-capabilities` 和 `revoke` 会改变账号、grants 或 session。它们不是查找凭据的手段，只有用户另行明确授权相应管理动作时才可执行。
6. 现役 `scripts/platform-admin.ts verify` 需要其声明的数据库连接环境。数据库 authority 未加载时，只报告验证缺口，不得为了验证账号改写数据库配置或另造连接路径。

当前仓库没有面向本 Skill、可把上述 secret 安全注入现有维护 Chrome session 的通用登录 helper；测试或 Dynamic Proof 的专用浏览器脚本不得改作本 Skill 登录旁路。因此当前只有“复用已认证 session”或“用户在现有 Chrome 中完成登录”两条可用路径。以后若现役认证 Owner 提供正式 helper，只在本节明确登记其名称、Owner 和不泄密后置条件后使用。
