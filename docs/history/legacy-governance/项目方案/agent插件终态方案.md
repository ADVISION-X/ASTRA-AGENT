# 《AGENT 插件终态方案》

版本：V5.1-FROZEN-DESIGN
日期：2026-08-21
状态：`FULLY_FROZEN_DESIGN / LAW_CHANGE_REQUIRED / REPLAN_REQUIRED / IMPLEMENTATION_IN_PROGRESS_NOT_VERIFIED / NOT_PRODUCTION_VERIFIED`
适用范围：用户本人这台 macOS 上的 GrassEye AGENT、固定 Chrome Profile、固定 unpacked MV3 Extension，以及玄学 AI 生产工单所需的 Cloud Worker、Plugin、Browser Authority 和本机执行链
跨仓配套：`/Users/nexgen/Documents/xuanxue-web/docs/项目方案/周天-AGENT通讯终态方案.md`

> 本文只拥有 AGENT 本地生产与 Chrome 执行终态。
>
> 玄学网站业务入口只允许周天 Cloud Durable Job → AGENT 主动出站 claim。Extension 的 loopback WebSocket 只属于 AGENT ↔ Chrome Browser Execution Plane，绝不接受周天网页、Cloud 或其他 caller 的浏览器遥控。
>
> 用户每次 Chrome 生产会话只批准一次生产工位；每个工单仍以独立 Cloud lease、`executionFenceHash`、target/document lease 和 mutation journal 失败关闭。

---

# 0. 终态裁决与当前阻断

## 0.1 唯一目标

建设一条长期在用户本机运行、零新增付费依赖、可恢复、可审计的 Chrome 生产执行链：

```text
周天 Cloud Durable Job
→ AGENT Cloud Worker 主动认证/claim
→ mediator/xuanxue-ai-production route
→ xuanxue-ai-production Plugin 固定 Flow
→ AI Input Gateway / BrowserAuthorityBroker
→ SESSION_APPROVED_PRODUCTION_WORKSPACE
→ executionFenceHash
→ exact BrowserTargetLease + BrowserDocumentRef
→ ws://127.0.0.1:4173/browser-authority/v1
→ fixed-directory unpacked MV3 Extension
→ fixed SiteActionRegistry / CommandRegistry
→ exact ChatGPT tab/document
→ durable receipt / checkpoint / evidence / result
→ AGENT 主动回传周天 Cloud
```

## 0.2 当前 LAW-GAP

AGENT 本地工作树中的现役 `module-xuanxue-ai-production`、Kernel/Index、Workbench API Boundary 施工图和 generated truth 仍规定：

```text
周天网站 → LNA/HMAC → AGENT 入站整单
并物理删除 cloud worker
```

这与周天项目总法案、跨仓 Cloud Pull 主链和本 V5 方案正面冲突。另一个冲突是现役 Browser law 的逐 job operator claim，而本方案明确采用会话级生产工位批准。

周天当前 AI Boundary 还要求默认至少十个独立 Web Chat 同时在途；本 V5 首个生产基线固定 `max_browser_in_flight = 1`。后续法案重编必须物理替换这一并发义务，不能用配置或隐藏模式同时保留两个基线。

因此当前状态固定为：

```text
LAW_CHANGE_REQUIRED
BLOCKED_CANDIDATE_CONFLICT
REPLAN_REQUIRED
NOT_PRODUCTION_VERIFIED
```

项目方案不得越过 active law 直接授权生产代码。施工前必须以新 lawId 删除式替换冲突法案、施工图、owner manifest、inspector 和 acceptance，再由现有 builder 生成唯一 audit truth。

## 0.3 八项冻结决定

1. 玄学业务入口只用 Cloud Pull，不用 LNA/localhost/HMAC 入站。
2. 保留 Cloud Worker、enrollment、claim、lease、staging、publication 和 recovery。
3. 本机 Browser transport 只用一个认证 loopback WebSocket。
4. Chrome 授权只用 `SESSION_APPROVED_PRODUCTION_WORKSPACE`，不保留逐工单批准模式。
5. 协议只存在 `xuanxue-ai-production-v5`，不兼容 v4。
6. 每个 `(jobId, attemptId, leaseVersion)` 恰好存在一个 immutable `executionFenceHash`；每个 attempt 同一时刻最多一个 ACTIVE fence。
7. V5 首个生产基线只有一个物理 ChatGPT tab、一个 mutation lock、一个 browser in-flight job。
8. 任何未决 mutation 不自动重放；原设备自动恢复，跨设备只能人工审计后新建 attempt。

---

# 第一部分：边界与 Owner

## 1.1 Cloud Worker

AGENT Cloud Worker 只负责：

- dependency preflight 后主动连接周天。
- 提交 Device Contract Proof 和真实 capacity。
- claim、heartbeat、checkpoint、artifact、result、failure、recovery transport。
- 将合法 claimed job 交给唯一 mediator route。

它不得：

- 拥有产品动作图或业务阶段。
- 直接调用 Browser、Extension 或 DOM。
- 自建第二 job store、第二 lease 或第二 recovery truth。
- 根据 HTTP 错误文字重放业务动作。

## 1.2 Mediator 与 Plugin

固定入口：

```text
Cloud Worker
→ mediator/xuanxue-ai-production route
→ xuanxue-ai-production Plugin public facade
```

Mediator 只做 claimed-job schema 校验和转发。Plugin 唯一拥有：

- 本地 durable order。
- 固定产品动作图。
- checkpoint、raw response、result 和 business terminal。
- Browser Authority 的调用时机。
- human/review gate。
- `OUTCOME_UNKNOWN` 的业务裁决。

Cloud Worker、Local Runtime、App Shell、Browser owner 和 AI 不得替代 Plugin 决定下一步。

## 1.3 Browser Authority

Browser owner 唯一拥有：

- fixed unpacked Extension release identity。
- pairing、session crypto、WebSocket、liveness 和 revoke。
- ProductionWorkspaceApproval。
- exact target/document lease。
- fixed command permit、artifact 子协议和 mutation journal。

Browser owner不拥有业务步骤、模型结论、Cloud terminal、Evidence 真相或恢复业务裁决。

## 1.4 其他网站与 External API Boundary

AGENT 面向其他已经获准 Job 的 External API Boundary 保持其独立 owner，不因玄学业务改为 Cloud Pull 而整体删除。

固定边界：

- `xuanxue-ai-production` 不登记 site HMAC ingress，不接受 localhost 业务 route。
- 其他网站只能按各自 active law 使用 exact known-job route。
- External API Boundary 永远不得成为 Browser relay 或 capability-facing API。
- 未来网站不能复制玄学 Cloud Worker，也不能借玄学合同取得浏览器物理资源。

## 1.5 四本账

| 真相 | 唯一 Owner | 不得替代 |
| --- | --- | --- |
| 业务状态 | xuanxue-ai-production Plugin / 周天 Cloud 各自边界 | Evidence、日志、UI |
| 实际动作 Evidence | Forensics Persistence | 业务状态、日志、Audit |
| 诊断日志 | Runtime Log Spine | Evidence、业务终局 |
| 合规与动态证明 | 唯一 Audit / Dynamic Proof owner | 业务结果、相互替代 |

---

# 第二部分：V5 跨仓接入

## 2.1 Canonical Contract

唯一跨仓协议：

```text
xuanxue-ai-production-v5
```

唯一 schema 与 contract manifest 由周天 `packages/ai-contracts` 产生。AGENT 只消费不可变 bundle 和机械生成 validator，不维护手写平行类型。

版本、manifest、product contract、action graph、browser protocol 或 extension release identity 任一漂移：

```text
capacity = 0
claim = blocked
Browser action count = 0
```

不得默认字段、忽略未知字段、dual read、dual write 或 previous protocol window。

## 2.2 CloudExecutionGrantV5 校验

Plugin admission 前必须精确验证：

```text
protocolVersion
contractManifestHash
jobId
attemptId
localOrderIdentity
productId
productContractHash
actionGraphVersion + actionGraphHash
frozenSubjectRef + frozenSubjectHash
inputManifestRef + inputManifestHash
requiredDeviceId
leaseOwner
leaseToken format
leaseVersion > 0
leaseExpiresAt
serverNow
allowed checkpoint/result contracts
```

`localOrderIdentity` 是 Cloud 为本次 `jobId + attemptId + requiredDeviceId` 签发的跨仓关联身份，不是本地路径、数据库主键或本地状态 owner。Plugin 必须将它与本地生成的 `localOrderId` 一对一持久化绑定，并在 fence、checkpoint 和 result 中携带其 hash。

严禁出现：

```text
tab/window/document
conversation/title/marker
selector/coordinate/javascript/CDP
browserCommand/nextAction/workflow/flowStep
local path/profile path
raw workspace approval
caller concurrency
arbitrary callback
```

## 2.3 本地 Durable Order

任何 Browser action 前必须 fsync：

```text
jobId + attemptId
deviceId
leaseVersion + leaseTokenHash
contractManifestHash
product/action graph identity
frozenSubjectHash + inputManifestHash
localOrderId
localOrderIdentityHash
checkpoint
workspaceApprovalIdHash（取得后）
executionFenceHash（绑定后）
journal refs
raw response / artifact refs
terminal intent / receipt
```

本地路径由 storage owner 生成，不能来自 Cloud、网页、Plugin input 或 wire。

## 2.4 ExecutionFenceBindingV1

唯一围栏算法与周天方案保持逐字段一致：

```text
executionFenceHash = SHA-256(canonical JCS(
  protocolVersion
  + contractManifestHash
  + jobId
  + attemptId
  + deviceId
  + leaseVersion
  + localOrderIdentityHash
  + localOrderIdHash
  + extensionReleaseIdentityHash
  + sitePolicyHash
  + actionGraphHash
  + frozenSubjectHash
  + inputManifestHash
))
```

顺序不可改变：

```text
local order fsync
→ workspace approval valid
→ derive fence
→ Cloud CAS bind fence
→ exact target/document lease
→ mutation PREPARED+fsync
→ send
```

Cloud CAS 成功前 Browser mutation count 必须为零。fence 不能刷新、迁移或跨 leaseVersion 复活。

Fence 基数固定为：

```text
(jobId, attemptId, leaseVersion) -> exactly one immutable executionFenceHash
attemptId -> at most one ACTIVE executionFenceHash
```

Heartbeat 只续当前 writer lease，不改变 `leaseVersion`，因此 fence 不变。原设备 recovery/reclaim 如果令 `leaseVersion N -> N+1`，旧 fence 必须永久 `RETIRED`，新 leaseVersion 必须重新完成本地 fsync 与 Cloud fence CAS，CAS 成功前新 Browser mutation count 仍为零。跨设备 handover 必须创建新 attempt。

`workspaceApprovalIdHash` 不属于 Cloud writer fence。它必须继续绑定每条 `BrowserCommandFrameV5`、Mutation Journal、Action Receipt 和 Dynamic Proof，使本地人工授权与 Cloud writer execution 在证明层汇合，而不互相成为对方的生命周期 owner。

## 2.5 BrowserCommandFrameV5

每条 command 与其原通道 receipt 必须在同一强制合同中完整绑定：

```text
protocolVersion
executionFenceHash
workspaceApprovalIdHash
authorityEpoch
targetLeaseId
targetLeaseVersion
targetIdentityHash
documentId / documentRefHash
commandId
commandSeq
nonce
  commandTtlMs
sitePolicyId + sitePolicyHash
actionId + controlId
mutationClass
payloadHash
artifactManifestHash（如适用）
```

任一字段缺失、错配、重放、sequence gap、nonce reuse、target/document 漂移或 TTL 越界都必须在副作用前拒绝。字段不得被拆成可选上下文，Plugin、Cloud 和外部 caller 均不能生成物理资源字段。

## 2.6 Deadline

Cloud writer grant 和每次成功续约 writer lease 的 heartbeat response 必须返回同一份权威时钟样本：

```text
serverNow
leaseExpiresAt
leaseVersion
```

AGENT 必须用本进程 monotonic clock 记录 `requestSentMonoAgent` 与 `responseReceivedMonoAgent`，并固定：

```text
fullRoundTripMs = responseReceivedMonoAgent - requestSentMonoAgent
safetyMarginMs = 10_000
remainingMs = leaseExpiresAt - serverNow - fullRoundTripMs - safetyMarginMs
cloudDeadlineMonoAgent = responseReceivedMonoAgent + max(0, remainingMs)
```

Heartbeat 续约如果缺少上述任一字段、返回不同 `leaseVersion`、时间倒退或计算后 `remainingMs <= 0`，不得延长权限，必须停止新 Browser action 并 reconcile。

`cloudDeadlineMonoAgent` 只属于 AGENT 进程，绝不能发送给 Extension。Browser Wire 只发送非负整数毫秒 `commandTtlMs`。AGENT 在发送前计算：

```text
commandTtlMs <= min(
  cloudDeadlineMonoAgent - agentSendMono,
  latest authenticated Workspace remaining,
  latest authenticated Authority remaining,
  latest authenticated Target/Document remaining,
  actionPolicyMaxMs
) - browserFrameTransitBudgetMs
```

`browserFrameTransitBudgetMs` 必须来自当前 contract manifest 的固定上限，并由最新认证 loopback RTT 样本证明未超界；缺样本、超界、结果非正数或超过 `actionPolicyMaxMs` 均不得发送。Extension 收到帧后只用自己的 monotonic clock建立：

```text
extensionDeadlineMono = extensionReceiveMono + commandTtlMs
```

Extension 还必须以自己拥有的 Workspace、Authority、Target/Document 与 action policy 本地剩余窗口再次取最小值；任一窗口先到期都在副作用前拒绝。

本机墙钟、Extension 墙钟和浏览器页面时间不得延长权限。

---

# 第三部分：会话级生产工位

## 3.1 用户动作

用户完成登录并打开唯一目标 ChatGPT 标签页后，通过顶层 Extension action 点击一次，产生：

```text
ProductionWorkspaceApprovalV1
mode = SESSION_APPROVED_PRODUCTION_WORKSPACE
```

它绑定 Chrome 生产会话与目标工位，不绑定单个 job。批准有效期间，多个工单可以顺序执行，不再逐工单点击。

## 3.2 固定绑定

Approval 只由 Extension/Browser owner 创建并保存在 `chrome.storage.session` 会话态 owner 中。它只绑定稳定层：

```text
workspaceApprovalId
approved profile/session identity
stable extension ID
releaseBuildId
ExtensionDirectoryHashV1
canonical manifest hash
browser protocol hash
exact ChatGPT origin
exact tab
sitePolicyId + sitePolicyHash
issuedAt
absoluteExpiresAt
```

最长 TTL 固定 8 小时。不得自动续期、刷新、后台重新批准或由 Cloud/Plugin 创建。

原始 profile/tab/document/approval secret 只在 Browser owner 内存在；对 Plugin、Cloud、日志和公开 Evidence 仅暴露 `PRESENT/ABSENT` 与不可逆 binding hash。

动态执行层不属于Workspace。每次Authority建立或document变化后，由Browser owner另行签发短时 `BrowserTargetLease / BrowserDocumentRef / CommandPermit`，绑定 `authorityEpoch + current document identity + executionFenceHash + workspaceApprovalIdHash + sitePolicyHash + target/document lease version + owner-local expiry`；任何旧动态lease都不能因为Workspace仍在而复活。

## 3.3 失效矩阵

| 事件 | Workspace | Target/Document | 后续动作 |
| --- | --- | --- | --- |
| 8 小时到期 | revoke | revoke | 必须重新人工批准 |
| Chrome 重启 | absent | revoke | 重新 pairing/批准 |
| Extension Reload/升级/禁用/重装 | absent | revoke | identity readback、pairing、批准 |
| Extension bytes/permission/hash 漂移 | absent | revoke | repair required |
| 标签页关闭 | revoke | revoke | 重新人工批准 |
| 离开获准 origin | revoke | revoke | 失败关闭 |
| Service Worker restart / socket reconnect | retain（仅当会话态字节、稳定绑定和TTL仍可证明） | revoke | 重新认证并签发新动态 lease；不自动延长Workspace |
| 同一获准tab内 same-origin reload/navigation 或 document generation 改变 | retain | revoke | 重新读取页面并签发新document lease |
| authority epoch 改变 | retain（稳定绑定仍成立时） | revoke | 重新认证并签发新authority/target/document lease |
| AGENT deviceId、credential、local runtime identity 或本机生产身份改变 | revoke | revoke | 重新设备/本机准入与批准 |
| 用户主动撤销 | revoke | revoke | action count = 0 |

Service Worker 单独休眠、restart 或 socket reconnect 不自动撤销 session approval，但 WebSocket authority 必须重新恢复为 PRESENT；旧 Authority、Target、Document 和 Command Permit 一律失效。只有原 Workspace 的会话态字节、稳定绑定与绝对 TTL 全部仍可证明时才可保留；任何无法证明项都按 absent 处理。same-tab same-origin reload/navigation 也只保留 Workspace，绝不保留旧 document observation、lease、element ref 或 permit。

## 3.4 Capacity 与 Claim 顺序

只有以下全部成立，Cloud Worker 才能报告一个 Browser capacity：

```text
dependency preflight PASS
Plugin ready
local store writable
Browser Authority PRESENT
Workspace Approval PRESENT
no unresolved mutation
no active browser job
exact V5 contracts
```

V5 固定：

```text
max_browser_in_flight = 1
physical_provider_tabs = 1
mutation_lock = 1
```

不得先 claim 后等待用户批准；不得把 max 值理解成必须领取数量。

---

# 第四部分：唯一 Browser Transport

## 4.1 物理边界

唯一链：

```text
BrowserAuthorityBroker
→ existing App Server exact WebSocket upgrade
→ ws://127.0.0.1:4173/browser-authority/v1
← Extension Service Worker 主动连接
→ fixed registry
→ exact target/document
```

唯一 listener 仍是 `src/app/create-workbench-server.ts`。不得新建第二 server、第二 port、第二 WebSocket、第二 reconnect actor、polling、SSE 或 page relay。

控制帧和 artifact chunk 使用同一 socket 的判别子协议；wire 不传 raw file path。

## 4.2 安装与 Release Identity

最终部署方式是用户本机 fixed-directory `Load unpacked`：

```text
.grasseye-local/browser-build/extension
```

PRESENT 必须读回：

```text
stable extension ID（manifest key 推导）
manifest version/permissions
releaseBuildId
ExtensionDirectoryHashV1
canonical manifest hash
browser protocol hash
SitePolicy registry hash
Chrome executable/channel/version
approved profile identity
```

升级和回退都只能整体替换同一冻结 Agent+Extension 候选，然后由用户手动 Reload、重新配对、重新批准并重跑真实 Chrome。禁止单端回退、CWS fallback、旧协议兼容或旧 artifact 复活。

## 4.3 Pairing 与 Session Crypto

首次 pairing 使用高熵一次性 secret 和双向挑战。认证 session 固定采用现役 Browser owner 冻结的：

```text
P-256 ECDSA challenge
P-256 ECDH
RFC8785 JCS transcript
HKDF directional keys
AES-GCM directional nonce/AAD
authority epoch
strict directional sequence
issuedAt/deadline
```

每帧必须绑定 exact release、authority、direction、sequence、fence、target/document 和 deadline。pre-auth、bad MAC、nonce reuse、replay、sequence gap、wrong release/profile/Chrome、第二 active client、budget overflow任一发生：关闭 socket、revoke leases、authority=ABSENT。

Device credential、Cloud lease token和 Browser session key是三种不同边界，禁止互相传播。

## 4.4 Liveness 与 Reconnect

固定机器合同：

```text
heartbeat = 20s
MV3 alarm wake-up = 30s
soft drain = 35s
hard expiry = 45s
```

Extension actor是唯一 reconnect owner。App Server、Agent、Plugin、Cloud Worker和UI都不得替它重连。断线先 revoke authority/target/permit，再按有限退避建立新 session。

Workspace approval能否保留只按 3.3 矩阵判断；它绝不能因为 socket reconnect 自动延长。

---

# 第五部分：精确目标与固定动作

## 5.1 Target/Document Lease

Workspace approval只是工位准入，不是执行 lease。每个 job 在 fence 成功绑定后，由 Browser owner为当前获准 tab/document签发短时：

```text
BrowserTargetLease
BrowserDocumentRef
CommandPermit
```

它们必须绑定：

```text
executionFenceHash
workspaceApprovalIdHash
authorityEpoch
sitePolicyHash
targetRefHash
documentRefHash
leaseVersion
issuedAt + owner-local expiry
```

任何 owner-local monotonic expiry 都只在创建它的进程内比较，不得把绝对 monotonic 数值放上 Browser Wire。跨进程只传相对 TTL，由接收进程用自己的 monotonic clock重建本地 expiry，并继续受 2.6 的 Cloud、Workspace、Authority、Target/Document 与 action policy 最小窗口约束。

目标候选必须恰好为一个。零个、多个、相邻目标冲突、document漂移或到界不明确，均 `failed/review_required`，禁止 current-tab、first-tab、title/URL-first 猜测恢复。

## 5.2 三次 Admission

以下必须在三个时点重复验证：

```text
Admission
Before Send
Completion
```

每次同时确认：

- authority、workspace、Cloud lease、fence 全部有效。
- target/document 正向身份成立。
- 相邻假目标、错误 origin、loading/stale/duplicate 状态全部排除。
- action/permit/payload/deadline/sequence 精确。
- 候选唯一且在固定预算内结束。

## 5.3 Fixed Registry

Command Registry 每个 action 必须声明：

```text
sitePolicyId/version/hash
actionId + controlId
request/response schema
mutation class
payload/artifact budgets
target/document requirements
browser postcondition
business postcondition owner
human gate
evidence contract
acceptance IDs
```

Wire、Cloud、Plugin input 和外部 caller 绝对禁止传入：

```text
arbitrary JavaScript
raw CDP/debugger method
arbitrary URL
selector / coordinate
tab/window/document/title/marker/conversation
nextAction / actionPlan / workflow
raw/resolved file path
```

BrowserCommandActor只执行一个固定原子动作，不决定业务步骤。

---

# 第六部分：Mutation Journal 与终态确认

## 6.1 固定状态机

每个 mutation 只能按以下顺序：

```text
PREPARED(
  commandId,
  executionFenceHash,
  authority/workspace/target/document bindings,
  mutationClass,
  payloadHash
)
→ durable append + fsync
→ SEND
→ TERMINAL_SUCCESS | TERMINAL_FAILURE | OUTCOME_UNKNOWN
```

发送前没有 PREPARED fsync 是 P0。断线、重启、deadline、receipt 缺失或正反终态冲突都必须 `OUTCOME_UNKNOWN`。

## 6.2 Outcome Resolution

只有 owning Plugin 可以在真实页面上按同一个 bounded observer形成：

```text
正向确认
+ 反向排除
+ 唯一候选
+ 固定次数/截止时间
→ OutcomeResolutionReceipt
```

Transport、Extension、Cloud Worker、UI、日志和AI都不能推测成功、选择新 target或自动重放。

## 6.3 GPT Web 固定边界

- 只使用一个物理 ChatGPT tab。
- V5 同时只有一个 browser job。
- 登录、CAPTCHA、2FA、风控、多 provider tab、未知控件或身份歧义进入 `REVIEW_REQUIRED`。
- raw response在解析、投影、改名或清理前不可变持久化。
- 已捕获 raw response不得重新提交模型。
- AI输出不得控制浏览器下一步。

---

# 第七部分：取消与恢复

## 7.1 取消矩阵

| 状态 | 本机处理 | 业务结果 |
| --- | --- | --- |
| 尚无 mutation | 停止并封存 checkpoint | `CANCELLED` |
| PREPARED 未 SEND | durable close，不发送 | `CANCELLED` |
| 已 SEND 且终态明确 | 停止后续动作，Plugin保存事实并提交terminal proposal | Cloud terminal CAS裁决 |
| 已 SEND 但不明确 | `OUTCOME_UNKNOWN`，不重放 | `REVIEW_REQUIRED` |
| Cloud lease/fence 失效 | Extension拒绝后续command | Cloud reconcile |
| late receipt/result | 隔离，不改变当前 attempt | 原状态不变 |

Cloud cancel不是浏览器撤销命令，不能远程要求Extension点击反向操作。

`CANCELLED / COMPLETED / FAILED / REVIEW_REQUIRED` 只能通过 Cloud 对同一 `jobId + attemptId` 的唯一 terminal CAS 从非终态写入；第一个成功 CAS 获得终态优先级。Plugin只拥有本地页面事实、业务判断和terminal proposal，不拥有Cloud terminal优先级。

同一terminal status且同一payload hash的重复请求必须幂等成功；同一status但不同payload hash必须冲突拒绝；任何后到的不同terminal不得覆盖已存在终态，只能保存为late evidence或no-op/rejected control event。Cloud cancel先赢时后到result不得改写；result先赢时后到cancel不得改写。

## 7.2 Cloud 暂不可达

Cloud 连接中断后：

- 不领取新工单。
- 只允许已经 SEND 的当前不可中断原子动作到达原始 terminal receipt，并立即持久化。
- 当前原子动作结束后必须停止；在无法证明 Cloud lease/fence 仍有效时，后续 Browser action count 必须为零。
- 恢复连接后先 reconcile `jobId + attemptId + deviceId + leaseVersion + executionFenceHash + cancel`，再由 Plugin 决定继续或 `REVIEW_REQUIRED`。
- 禁止把 HTTP retry、socket reconnect 或 heartbeat 当作业务 mutation retry。

## 7.3 原设备自动恢复

必须同时满足：

```text
same deviceId
same local durable ledger owner
same jobId + attemptId
current valid leaseVersion
same executionFenceHash
same contract/action/input identities
no unresolved UNKNOWN mutation
```

缺一项都不自动恢复。Chrome/Extension恢复后必须重新建立合法 Browser Authority、Target/Document lease和Command Permit。若原Workspace会话态字节、稳定绑定与TTL仍成立则保留原approval；若Chrome重启、Extension reload/update/disable、tab关闭、跨出获准origin、release/profile/device漂移、TTL到期或用户撤销使Workspace失效，则必须重新人工批准。新的approval不改变Cloud writer fence。

## 7.4 跨设备移交

AGENT 不自动接管其他设备的 active job。只有Cloud收到人工 `HandoverDecision` 后才能：

1. 撤销旧device credential。
2. 永久关闭旧lease/fence。
3. 审计最后checkpoint/journal/provider proof。
4. UNKNOWN存在则旧attempt=`REVIEW_REQUIRED`且禁止重跑。
5. 已证明无不可重放mutation才建立新attempt/lease。
6. 新设备重新下载、建ledger、批准workspace和绑定新fence。

旧本地receipt永远不能写入新attempt。

---

# 第八部分：日志、Evidence 与隐私

## 8.1 Runtime Log Spine

唯一日志记录脱敏的：

```text
FLOW / DEBUG / TRACE
trace/run/task/stage/event
started/terminal pair
duration/failure class/recovery trail
hash/ref（非秘密）
```

必须覆盖：pairing、socket、workspace、target/document、fence、journal、cancel、recovery、handover和Cloud transport终态。

禁止写入：credential、lease token、session key、cookie、浏览器storage、raw profile/tab/document、完整HTML、raw response正文、私密artifact、raw path或secret-bearing URL。

## 8.2 Evidence

Forensics只记录实际动作、观察、artifact hash和receipt引用。它不决定业务下一步、不替代Plugin state、不产生Audit PASS。

Browser profile、credential store、durable business store、Evidence和Runtime Logs必须物理/权限分层。

---

# 第九部分：删除式迁移

## 9.1 必须保留

```text
xuanxue cloud enrollment/client/credential
Cloud Worker + capacity/claim/lease/heartbeat
staging/publication/result/recovery
xuanxue-ai-production Plugin durable store and fixed flow
single mediator route
single App Server
single Browser Authority and Runtime Log Spine
other law-owned External API routes
```

## 9.2 必须物理删除或替换

```text
xuanxue site HMAC/LNA ingress and localhost route
forbidden outbound/cloud-worker law and inspector expectations
supervised_per_job / OperatorTargetApproval / 60s job-bound mode
CWS identity/review/external Port
Workbench page relay
Native Messaging/Native Host
old transport/polling/SSE
v4/v5 compatibility
bridge/fallback/shadow/dual write
```

不得用 wrapper、alias、reader、disabled flag或历史目录保留旧责任。

## 9.3 法案重编分母

实际代码施工前，至少重编并独立审计：

```text
AGENT Kernel / Index
module-xuanxue-ai-production
module-local-browser-session
module-workbench-api-boundary（仅移除xuanxue依赖，不删除owner）
module-startup-entrypoint
module-runtime-log-spine
周天 AI Boundary 默认至少十个 Web Chat 同时在途的冲突义务
相关施工图
owner manifests / inspectors
acceptance / Exam / real-Chrome declarations
generated law registry / matrix / plan / coverage（builder生成）
```

用户本轮没有授权修改上述文件；本文只列明后续合法施工分母。

---

# 第十部分：验收硬标准

## 10.1 架构与协议

| ID | 必须证明 |
| --- | --- |
| GOV-001 | 两份V5方案hash绑定同一candidate |
| GOV-002 | active law/blueprint/manifest/acceptance全部对齐后才施工 |
| ARCH-001 | xuanxue入口只有Cloud Worker主动出站 |
| ARCH-002 | xuanxue LNA/HMAC/localhost route物理为零 |
| ARCH-003 | 其他External API合法owner未被误删 |
| CONTRACT-001 | 只存在`xuanxue-ai-production-v5` |
| CONTRACT-002 | 同一contractManifestHash与生成validator |
| CONTRACT-003 | forbidden browser/caller fields全部拒绝 |
| CONTRACT-004 | old/malformed/extra/missing fixture失败关闭 |
| CLOUD-001 | Cloud Worker只经mediator进入Plugin |
| CLOUD-002 | Cloud Worker不触碰Browser/private Plugin runtime |
| LEASE-001 | old device/token/version/fence零动作 |
| TIME-001 | grant/heartbeat response返回serverNow+leaseExpiresAt+leaseVersion；AGENT本地deadline、Wire commandTtlMs与Extension本地deadline分层，RTT/safety/transit budget超界均零动作 |
| FENCE-001 | 每个(jobId,attemptId,leaseVersion)恰好一fence、attempt同时最多一ACTIVE fence，Cloud CAS前mutation count=0 |
| FENCE-002 | heartbeat不换fence；leaseVersion变化永久退休旧fence并CAS新fence；全部command/receipt/result绑定当前fence |

## 10.2 Workspace 与 Browser

| ID | 必须证明 |
| --- | --- |
| WORKSPACE-001 | 每Chrome生产会话一次批准、非逐job |
| WORKSPACE-002 | 8h绝对TTL、无自动续期 |
| WORKSPACE-003 | 稳定Workspace与动态Authority/Target/Document分层；restart/reconnect和same-origin document变化只撤销动态层，稳定身份漂移按矩阵撤销Workspace |
| WORKSPACE-004 | raw物理身份不离开Browser owner |
| BROWSER-001 | 单fixed unpacked MV3与单WebSocket |
| BROWSER-002 | Extension actor唯一reconnect owner |
| BROWSER-003 | 单tab、单mutation lock、in-flight=1 |
| TARGET-001 | target/document唯一、无猜测恢复 |
| TARGET-002 | admission/send/completion三次检查 |
| CMD-001 | fixed registry且无任意控制字段 |
| JOURNAL-001 | PREPARED+fsync先于SEND |
| JOURNAL-002 | 无terminal必为UNKNOWN |
| JOURNAL-003 | UNKNOWN不自动重放 |
| ARTIFACT-001 | 同socket、hash/length/sequence/budget、无path |

## 10.3 故障、安全与恢复

| ID | 必须证明 |
| --- | --- |
| AUTH-001 | pairing/session crypto已知答案与恶意frame拒绝 |
| AUTH-002 | wrong release/profile/Chrome/second client保持ABSENT |
| LIVE-001 | 20/30/35/45秒liveness合同真实成立 |
| CANCEL-001 | 取消矩阵与Cloud terminal CAS竞态逐项故障注入；首写获胜、同payload幂等、不同payload冲突、late terminal不覆盖 |
| RECOVERY-001 | kill Agent/Chrome/Extension后原设备有界恢复 |
| RECOVERY-002 | raw response已存在时模型调用次数不增加 |
| RECOVERY-003 | foreign device自动恢复为零 |
| HANDOVER-001 | 新attempt前旧device/lease/fence永久关闭 |
| HANDOVER-002 | UNKNOWN阻断跨设备重跑 |
| DOUBLEWRITE-001 | 断网/expiry/重复claim/late result双写为零 |
| PRIVACY-001 | secrets/browser storage/raw path零日志零Evidence |
| SECONDCHAIN-001 | CWS/Port/relay/Native/polling/SSE/compat全部为零 |

## 10.4 证据层

必须分开报告：

```text
Static Audit
Exam / crypto / protocol / mutation fault model
AGENT ci:full
xuanxue-web ci:full
Real Chrome Dynamic Proof
Cross-repo end-to-end business proof
72h soak
push / release
```

真实 Chrome 至少验证：Load/Reload、pairing、workspace approval、同工位连续多job、TTL、document reload、origin离开、Service Worker终止、WebSocket断线、Chrome/Agent重启、提交、回答捕获、取消、UNKNOWN和恢复。

Chrome版本漂移后必须重新准入并从零开始72小时soak。

---

# 第十一部分：反复杂化红线

每次新增设计必须回答：

```text
唯一owner是谁？
是否新增第二入口/transport/store/lease/runner？
是否能删除旧责任而不是兼容？
是否有明确终态、负例和有界停止？
是否绑定同一candidate和真实证据？
```

以下任一出现即拒绝：

- 同时存在Cloud Pull与xuanxue LNA。
- 同时存在session approval与per-job approval。
- 同时存在v4与v5。
- 同时存在WebSocket与Port/relay/Native。
- Cloud、AI或caller可以指定浏览器物理资源。
- transport、UI或日志拥有业务恢复权。
- mutation未知时自动重试。
- 用配置、feature flag、disabled代码或retired目录保存第二链。
- 用静态PASS冒充真实Chrome、业务、发布或READY。

---

# 第十二部分：重新迭代路线

旧实施方案、旧14个WO、旧181文件清单和旧18条acceptance已经失去候选绑定，不得恢复或补丁续跑。

新施工图与工作单必须从以下十阶段重新生成：

```text
P0 双仓candidate与authority freeze
P1 active law/blueprint/owner/acceptance删除式重编
P2 canonical V5 contract bundle
P3 Cloud job/device/claim/lease主链验证
P4 Cloud Worker→mediator→Plugin
P5 single WebSocket/unpacked release identity
P6 ProductionWorkspaceApproval/target/document
P7 fence/journal/cancel/recovery/handover
P8 old xuanxue LNA and old Browser transport zero
P9 Static/Exam/CI/Real Chrome/E2E/72h soak
```

每一阶段只向新单链前进；失败不恢复旧实现。

---

# 最终定案

> **AGENT 通过 Cloud Worker主动领取周天完整工单，经唯一mediator进入xuanxue-ai-production Plugin；用户每次Chrome生产会话批准一次固定ChatGPT生产工位；每个(jobId, attemptId, leaseVersion)在Cloud绑定唯一不可变executionFenceHash后，才可通过单一认证WebSocket和固定命令对精确target/document执行；Workspace稳定授权与Authority/Target/Document动态lease分层，Cloud terminal由首个成功CAS唯一裁决；任何身份、lease、workspace、document、deadline或mutation结果不明确都失败关闭。**

本文不是实现完成声明：

```text
DESIGN CONTRACT: FULLY_FROZEN_DESIGN
ACTIVE LAW ALIGNMENT: REQUIRED
IMPLEMENTATION: IN_PROGRESS_NOT_VERIFIED
CHROME_VERIFIED: false
PRODUCTION READY: false
```
