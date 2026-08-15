# GrassEye 精确标签页本地 Chrome 会话施工图

版本：2026-08-14
状态：active construction blueprint
权威：`.github/instructions/agent-rules/modules/module-local-browser-session.instructions.md`

## 1. 唯一责任区

```txt
src/lib/browser/**
  one BrowserController
  one in-memory target registry
  one private Native Messaging transport
  one MV3 extension
  one bounded PhysicalFocusLease owner
```

Browser 只负责浏览器目标、文档世代、低层命令、连接生命周期和焦点租约，不拥有业务步骤、AI 判断、业务状态、Evidence 真相或 Runtime Log 真相。

## 2. 唯一四跳链路

```txt
CurrentChromeBrowserController
  -> 0600 <dataDir>/browser-runtime/controller-native.sock
      -> com.grasseye.browser Native host
          -> Chrome Native Messaging
              -> fixed-id MV3 service worker
                  -> chrome.debugger
                      -> exact target
```

- Controller 创建 socket、内存 nonce、session id 和 command correlation。
- Native host 只转发有界消息；不保存 target、业务状态、证据或 secret。
- MV3 worker 只枚举 target、attach/detach debugger、发送 CDP 命令和返回事件。
- target registry 只在 Controller 进程内把 raw ids 映射为 opaque refs。
- 任一 hop 断连即失效全部 refs；mutation 已发出但未确认时返回 `OUTCOME_UNKNOWN`，绝不自动重放。

## 3. 文件落位

```txt
src/lib/browser/exact-target/
  browser-target-ref.ts
  browser-command-contract.ts
  browser-target-registry.ts
  browser-native-transport-protocol.ts
  browser-native-transport-server.ts
  browser-command-runtime.ts
  physical-focus-lease.ts

src/lib/browser/chrome-extension/
  manifest.json
  protocol.ts
  service-worker.ts
  tsconfig.json
  build.mjs
  dist/                       # build output, never source truth

src/lib/browser/native-messaging-host/
  host.mjs
  controller-channel.mjs
  manifest.template.json
  install.mjs
```

现役 `browser-controller.ts`、`current-chrome-browser-controller*.ts` 只保留 target-bound 主链。旧 active-tab helpers、URL-first、first-page、AppleScript/JXA 页面动作和 CDP file-input 旁路在原子 cutover 物理删除。

## 4. 身份合同

```ts
type BrowserTargetRef = string & { readonly __brand: "BrowserTargetRef" };
type BrowserDocumentRef = string & { readonly __brand: "BrowserDocumentRef" };

interface ControlledBrowserTarget {
  targetRef: BrowserTargetRef;
  documentRef: BrowserDocumentRef;
  origin: string;
  lifecycle: "attached" | "navigating" | "detached" | "closed";
}
```

- `BrowserTargetRef` 绑定 controller session、target raw id、获准 origin 和 target generation。
- `BrowserDocumentRef` 额外绑定 frame/document loader generation。
- opaque ref 只可由 registry mint/resolve；调用方不得解析、构造或持久化。
- navigation committed、frame replacement、detach、target close、extension reload、controller restart 都使旧 document ref 失效。
- evidence/log 只记录 opaque ref、origin、generation 和 command id，不记录 raw ids。

## 5. Public BrowserController

```ts
interface BrowserController {
  acquireTarget(input: AcquireTargetInput): Promise<ControlledBrowserTarget>;
  navigateTarget(input: NavigateTargetInput): Promise<ControlledBrowserTarget>;
  evaluateTarget<T>(input: TargetDocumentCommand): Promise<T>;
  clickTarget(input: TargetDocumentPointCommand): Promise<BrowserActionResult>;
  clickDomTarget(input: TargetDocumentIdentityCommand): Promise<BrowserActionResult>;
  fillDomTarget(input: TargetDocumentIdentityTextCommand): Promise<BrowserActionResult>;
  textTarget(input: TargetDocumentTextCommand): Promise<BrowserActionResult>;
  scrollTarget(input: TargetDocumentScrollCommand): Promise<BrowserActionResult>;
  captureTargetScreenshot(input: TargetDocumentCommand): Promise<BrowserActionResult>;
  setTargetFileInputFiles(input: TargetDocumentFileInputCommand): Promise<BrowserActionResult>;
  withPhysicalFocusLease<T>(input: PhysicalFocusLeaseInput, action: () => Promise<T>): Promise<T>;
  releaseTarget(targetRef: BrowserTargetRef): Promise<void>;
}
```

所有页面动作都必须同时携带 `targetRef + documentRef`。普通页面动作通过 CDP 对后台 target 执行，不激活 Chrome、不切换用户当前标签页。

## 6. 命令与失败语义

每条 command envelope 最少包含：

```txt
protocolVersion
controllerSessionId
commandId
targetRef
documentRef
originConstraint
mutationClass = observation | idempotent_mutation | non_idempotent_mutation
deadlineAt
payload
```

Terminal errors：

```txt
TARGET_NOT_FOUND
TARGET_AMBIGUOUS
TARGET_FOREIGN_SESSION
TARGET_ORIGIN_MISMATCH
DOCUMENT_STALE
TARGET_CLOSED
TRANSPORT_DISCONNECTED
EXTENSION_VERSION_MISMATCH
DEVTOOLS_ATTACHMENT_CONFLICT
COMMAND_TIMEOUT
OUTCOME_UNKNOWN
FOCUS_LEASE_DENIED
OPERATOR_INTERRUPTED
```

Observation 可以由 owning caller 重新从 checkpoint 发起；任何 mutation 在 terminal receipt 不确定时只进入 `OUTCOME_UNKNOWN`，禁止 transport 自动重试。

## 7. MV3 与 Native Messaging

- `manifest_version=3`。
- 固定 public key 产生稳定 extension id。
- 权限只包含 `debugger`、`nativeMessaging`、必要 tabs 和明确 provider host permissions。
- 禁止 cookies、storage、password、webRequest body、任意远程代码。
- Native host manifest `allowed_origins` 只有固定 extension origin。
- Native 消息遵守 Chrome 4-byte length framing，并设置 request/response size 上限。
- Controller、host、extension protocol version 必须完全一致。

### 7.1 evaluate 唯一表达式合同

Public `BrowserTargetSession.evaluate({ script })` 的 `script` 是函数体，不是可直接交给 CDP 的表达式。唯一转换点位于 exact-target Browser owner：

```txt
caller function body
  -> toBrowserEvaluationExpression
      -> exactly one immediately-invoked function expression
          -> evaluate_target
              -> MV3 Runtime.evaluate(expression)
```

固定规则：

- 只在 `src/lib/browser/exact-target/**` 包装一次。
- Native host 与 MV3 worker 只转发/执行已规范化 expression，不再包裹。
- `evaluate_target` 的 `mutationClass` 固定为 `observation`。
- 通用 click/scroll/text 分别走 `click_target`、`scroll_target`、`text_target`；DOM click/fill 只走 `click_dom_target`、`fill_dom_target`，上传走 `set_file_input_files`。
- `click_dom_target` / `fill_dom_target` 在同一命令中完成 selector 唯一解析、当前 identity 对比、可交互性核对和 mutation，不接收先前观察出的坐标。
- 禁止 caller-local wrapper、`eval`、`new Function`、双模式或失败回退。
- top-level `return` 必须在 deterministic acceptance 和真实 Chrome 中得到证明。
- duplicate/out-of-order commandId、nonce/version/origin/size 错误全部 fail closed。

## 8. 安装、升级、卸载

`install.mjs` 执行：

```txt
build extension
-> verify fixed extension id and source hash
-> render absolute Native host manifest
-> chmod owner-only
-> install into Chrome NativeMessagingHosts
-> emit install receipt
```

升级必须先停止新的 Browser command，等待有界在途观察完成；未决 mutation 进入 `OUTCOME_UNKNOWN`。新旧 protocol 不一致时不启动 consumer。卸载先阻断新命令、detach debugger、停止 host/socket，再删除注册 manifest 和 build 目录。

Startup 法定入口不参与安装、升级、卸载或 provider 激活。

## 9. PhysicalFocusLease

允许 reason code：

```txt
native_file_picker
os_pointer_action
os_keyboard_action
```

规则：

- 绑定 exact target/window/document。
- 最大 15 秒。
- 用户主动切走、window bounds/identity 改变或超时即取消。
- 用户打断后不重抢。
- `os_keyboard_action` 的文件剪贴板粘贴由 Browser owner 执行：扩展先精确激活 target/window，动作前后都核对 active tab + focused window；AI capability 不得直接调用 AppleScript/JXA。
- provider generation wait 永不持有。
- navigate/evaluate/click/fill/scroll/screenshot/DOM file-input 永不申请。

## 10. Consumer 迁移

```txt
Business Flow acquires exact target
-> passes opaque target/document refs to DOM or owning capability
-> every action returns the same identity receipt
-> navigation returns a new document ref
-> caller discards all prior DomElementRef values
```

AI Input Gateway 仍只控制一个物理 ChatGPT target，但每次 mutation/patrol 都用同一个 opaque targetRef；等待回答时释放 mutation lease。各业务 target 互不影响。

## 11. Audit owner

```txt
scripts/audit/domains/local-browser-session/
  manifest.json
  inspector.ts
  inspector-old-path-zero.ts
```

Inspector 使用 ts-morph AST/symbol 证明：

- 唯一 BrowserController 构造点。
- raw Chrome id 不越界。
- 所有 public page command 要求 target/document refs。
- 普通动作不能调用 FocusLease。
- active-tab、URL-first、first-page 和 AppleScript/JXA 页面动作符号不可达且退休文件不存在。
- extension/host 不能拥有业务状态、evidence 或 secret。
- Startup 未获得安装或业务职责。
- exact-target session 调用唯一 `toBrowserEvaluationExpression`；worker 未实现第二包装器。
- `evaluate_target` 只承载 observation，专用 mutation command 仍绑定同一 target/document。

## 12. Acceptance

### 12.1 真实页面先验与候选回归顺序

任何 BrowserController、MV3 worker、DOM command 或真实页面状态机变更，必须按同一顺序施工：

```txt
使用批准的 Chrome 插件进入本次真实失败页面
  -> 绑定 exact target / current document
  -> 读取动作前结构与 runtime trace
  -> 区分 light DOM、author shadow DOM 和 browser-owned UA shadow DOM
  -> 确认真正接收动作的 node 与动作后状态
  -> 只依据已观察结构删除并重构唯一责任片区
  -> 构建同一候选
  -> 再用批准的 Chrome 插件重跑同一路径
  -> 分别记录 pre-construction evidence 与 post-construction evidence
```

模拟页面只用于把已经观察到的真实拓扑固化成 deterministic regression，不得反过来作为
真实拓扑的来源。真实失败后没有新增页面证据，不允许继续追加猜测性修改。

```txt
local-browser-exact-target-contract.acceptance.ts
local-browser-native-transport.acceptance.ts
local-browser-target-actions.acceptance.ts
local-browser-focus-lease.acceptance.ts
local-browser-real-chrome-scenarios.acceptance.ts
local-browser-business-workday.acceptance.ts
local-browser-atomic-cutover.acceptance.ts
```

真实 Chrome 最小矩阵固定为 `ACC-023B-01` 至 `ACC-023B-10`：

1. 前台打开用户测试页并写入 title/scroll/input marker。
2. 后台受控 target 完成 navigate/evaluate/click/fill/scroll/screenshot。
3. 前台 marker 全部不变。
4. navigation 后旧 document/element ref 必须拒绝。
5. 关闭 target、extension reload、host/controller exit、DevTools 冲突全部 fail closed。
6. native picker 只在 focus lease 内运行；用户切走后不重抢。
7. mutation 断连只返回 `OUTCOME_UNKNOWN`，不重放。
8. 函数体 top-level return 经唯一生产 wrapper 成功返回，且不存在 `Illegal return statement`。
9. DOM click、DOM fill、file-input mutation 只通过各自专用 exact-target command 完成；identity 改变攻击必须 fail closed。
10. 前台非目标 tab 在全部场景中保持 URL、title、scroll 和 input marker 不变。

`text_target` 只保留为通用 Browser 文本命令，不得与先前坐标 click 拼装成 DOM fill。
DOM fill 由单个 `fill_dom_target` 对同一已复核 receiver object 完成聚焦、受信任 CDP 键盘清空与逐字输入、
每步 identity/value 复核以及最终组件非 error/invalid 状态核对；不得用 JS value setter 或 synthetic
`input/change` 把“看起来有值”冒充组件提交，也不得回退到 `click_target + text_target`、
`Input.insertText`、前台系统键盘或第二输入链。

真实 Amazon `kat-file-upload` 的唯一文件接收顺序：

```txt
governed selector 命中隐藏 light-DOM input[type=file] 代理
  -> 沿该节点所属自定义元素查找 open author shadow root
  -> 必须恰好存在一个 enabled input[type=file]
  -> DOM.setFileInputFiles 只作用于这个真实 receiver
  -> Browser 只确认这一次获准文件选择已派发
  -> 业务 owner 观察组件自己的 postcondition
```

零个或多个 shadow receiver fail closed。真实组件可以在消费 change 后同步清空 receiver，
所以 `input.files` 既不是 Browser action 的终态，也不是业务附件真相。不得打开第二套 native
picker、evaluate mutation 或组件专用 fallback；组件 postcondition 只能由现有业务 owner 读取。

## 13. Security Privacy Ownership

`GRASSEYE-SECURITY-PRIVACY-BROWSER-001-V1` 归 `local-browser-session` 唯一 owner：BrowserController 不读取或持久化 cookie、localStorage、sessionStorage、password、token，browser profile 与 evidence storage 物理分离。该条款复用现有 Browser owner inspector 与 acceptance，不增加隐私旁路或第二 browser owner。

## 14. 完成定义

- 四条 active local-browser laws、图纸、owner manifest/inspector、acceptance 和 ci:full 绑定一致。
- 旧链及全部消费者物理归零，没有 wrapper、alias、fallback、mode switch 或第二 transport。
- 同一最终候选通过 typecheck、owner audit、deterministic acceptance、真实 Chrome 和 `npm run ci:full`。
