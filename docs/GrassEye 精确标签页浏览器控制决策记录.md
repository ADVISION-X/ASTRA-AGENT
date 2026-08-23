# GrassEye 精确标签页浏览器控制决策记录

版本：2026-08-14
状态：authorized-for-construction
来源：用户对《GrassEye 精确标签页浏览器控制与 Chrome 扩展驱动重构项目实现方案》的全项目一次性授权

## DG-001 — 授权范围

- 允许修改命中 active law、施工图、质检 owner/inspector/acceptance、生产代码和唯一生成链的源文件。
- 允许物理删除旧 active-tab、URL-first、first-page、AppleScript/JXA 页面控制旁路及其消费者。
- generated audit artifacts 只能由现役 builder 重建，禁止手工修改。
- 不授权提交、推送、部署或生产发布。

## DG-002 — 唯一 owner

- 唯一 Browser infrastructure owner：`src/lib/browser/**`。
- 唯一控制器：现役 `CurrentChromeBrowserController` 实例，重构后仍只装配为一个 `BrowserController`。
- 唯一治理域：`local-browser-session`；不得建立新 capability root、第二 transport owner 或第二 BrowserController。

## DG-003 — Extension、Native host 与权限

- 采用私有 Chrome MV3 扩展、Native Messaging 和 `chrome.debugger`。
- 扩展必须携带固定 public key，由该 key 派生稳定 extension id；Native host `allowed_origins` 只允许这个 id。
- Native host 名称固定为 `com.grasseye.browser`。
- macOS 注册位置固定为 `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.grasseye.browser.json`；manifest 内 host path 必须是安装时解析出的仓库绝对路径。
- controller 与 host 通过 `<dataDir>/browser-runtime/controller-native.sock` 通信；目录和 socket 权限为 owner-only，连接 nonce 只存在内存。
- 接受 `nativeMessaging`、`debugger` 与所需 provider host permissions；拒绝 cookies、storage、password、token 权限。
- 安装、升级、卸载由明确的 Browser infrastructure 脚本负责；Startup 不负责安装或业务激活。

## DG-004 — PhysicalFocusLease

- 普通 navigate/evaluate/click/fill/scroll/screenshot/DOM file-input 永远不申请焦点。
- 只允许 `native_file_picker`、`os_pointer_action`、`os_keyboard_action` 三个 reason code。
- 单次最长 15 秒；等待 provider 生成时不得持有。
- 用户主动切走、窗口身份变化或租约超时后立即取消，禁止自动重抢。
- 任何焦点动作前必须精确匹配目标 window/document；歧义时 fail closed。

## DG-005 — 插件干预

- 6 个现役命中插件各自由自己的 plugin task state owner 实现 revisioned pause/cancel/takeover/resume；App、Route、Mediator、Local Runtime 只解析和转发。
- 新任务在安全点后 2 秒内停止发出下一条 Browser/AI/下载命令；已提交外部副作用只等待 owning checkpoint 或既有 provider timeout。
- stale revision 拒绝且不改变状态；不确定 mutation 进入 `OUTCOME_UNKNOWN` / `review_required`，禁止自动重放。
- `xuanxue-ai-production` 只采用本地 Workbench 整单入口；不得接受 stageId，cloud worker 不得增加人工控制入口。
- Product Mining 原“禁止人工控制”法条获准改为 owner-governed 整单干预，不建立第二恢复链。

## DG-005A — 栏目退役与现役分母

- 用户已物理删除 `pick3-is-blind-eval`、`lottery-ticket-plan`、`video-download-artifact`、`amazon-product-sync`、`amazon-product-fee-sync`、`amazon-listing-edit-read-sync` 六个不再使用的产品栏目；本项目不得恢复其 App、Mediator、Plugin、法案、施工图、验收或审计入口。
- `video-download` capability 继续作为通用平台视频下载能力保留；它不等于已退役的 `video-download-artifact` 产品。
- 逐插件干预现役分母固定为 3：`amazon-invoice-upload`、`amazon-product-mining`、`xuanxue-ai-production`。

## DG-006 — 原子退休

旧 active-tab 与旁路必须在同一 cutover 物理归零。禁止 wrapper、bridge、fallback、shadow、mode switch 或旧 API alias。

## DG-007 — Startup 边界

`npm run grasseye:start` 继续只负责依赖、端口、App server、health 和打开 Workbench；不得安装扩展、注册 Native host、启动业务任务或执行质检。
