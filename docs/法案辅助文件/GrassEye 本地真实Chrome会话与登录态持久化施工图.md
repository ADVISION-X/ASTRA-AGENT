# GrassEye 本地真实 Chrome 会话与登录态持久化施工图

版本：2026-08-22.3
状态：active final-state blueprint
上级权威：`.github/instructions/agent-rules/modules/module-local-browser-session.instructions.md`
法案：`APEX-LOCAL-BROWSER-001-V4`、`002-V4`、`003-V6`、`004-V4`、`005-V4`

> 本施工图只投影终态结构、owner、合同、状态与验收边界。它不保留迁移阶段、兼容接口或第二链路，也不以当前源码偏差降低法案。

## 1. 唯一物理链

```txt
owning Plugin fixed flow
-> injected Browser public facade
-> BrowserAuthorityBroker
-> claim-bound SessionWorkspaceBindingV6 + authenticated BrowserAuthorityLease
-> exact BrowserTargetLease + BrowserDocumentRef
-> BrowserCommandActor
-> ws://127.0.0.1:4173/browser-authority/v1
-> fixed-directory unpacked MV3 Extension
-> fixed SiteActionRegistry / CommandRegistry
-> exact Chrome target/document
-> ActionReceipt / mutation journal
-> owning Plugin business outcome
```

控制面只有现有 App Server 的一个 WebSocket upgrade。Extension 是唯一 socket owner，Agent 不反向连接 Extension；认证中断后由操作者使用 Workbench 新密钥重新配对，不存在无凭证假重连。物理 provider tab 恰好一个，mutation lock 恰好一个；provider 等待不占 lock，但任何 Browser action 都必须串行。

物理不存在：external Port、`externally_connectable`、Workbench page relay、open/inbound/next polling、SSE、CWS runtime、Native Messaging、Native Host、第二 listener、第二 Browser transport、previous-protocol consumer、per-job Browser approval、active/front/first-tab fallback。

## 2. Owner 矩阵

| 真相 | 唯一 owner | 只负责 | 禁止 |
| --- | --- | --- | --- |
| Session Workspace | operator claim + `browser-session-workspace.ts` | 人工配对并认领后，绑定当前 connection generation 与固定 profile/release/directory/site policy | 独立批准、墙上时间到期、自动续期、逐 job approval、进入 Cloud fence |
| Browser authority | Broker/Issuer/Supervisor | authenticated PRESENT/ABSENT、certificate、liveness、revoke | 业务步骤、heartbeat mint authority |
| exact target/document | `browser-target-lease-manager.ts` | 当前 authority epoch 下唯一 Target/Document 和三次复核 | URL-first、title、active tab、raw tab/window 身份 |
| Site action | Extension `command-registry.ts` | 固定 actionId、schema、field safety budget、artifact resource budget、mutation class、postcondition | prompt/message byte ceiling、任意 JS、raw CDP、caller selector/coordinate |
| mutation journal | `browser-mutation-intent-journal.ts` | PREPARED/fsync/SEND/terminal 与 identity binding | 自动 replay、业务 verdict |
| UNKNOWN outcome | owning Plugin | 真实页面正反证据、唯一性、有界性与 `OutcomeResolutionReceipt` | transport/UI/worker 推测成功 |
| Cloud writer fence | xuanxue cloud durable owner | job/attempt/device/leaseVersion/token binding 与 terminal CAS | 混入 Workspace hash、由 Browser owner签发 |
| Browser proof | AGENT Browser owner；网站 Dynamic Proof 只消费 | authority window、action receipt、handover、UNKNOWN count | 第二 Browser verdict、冒充业务结果 |

App、Route、Mediator、Cloud Worker、AI Input Gateway 和 DOM Automation 都不得 import Browser private runtime。所有 consumer 只从 `src/lib/browser/browser-authority-api.ts` 进入；public facade 不重导出 socket、Chrome id、transport actor、raw command 或 registry 私有实现。

## 3. 目录与唯一落点

```txt
src/lib/browser/
  browser-authority-api.ts
  infrastructure/
    browser-infrastructure-supervisor.ts
    browser-authority-broker.ts
    browser-authority-issuer.ts
    browser-authority-certificate.ts
    browser-control-state.ts
    browser-owner-lock.ts
  exact-target/
    browser-session-workspace.ts
    browser-site-policy-registry.ts
    browser-target-ref.ts
    browser-target-lease.ts
    browser-target-lease-manager.ts
    browser-command-actor.ts
    browser-mutation-intent-journal.ts
    browser-outcome-resolver.ts
    browser-file-artifact-grant.ts
  transport/
    browser-authority-websocket.ts
    browser-authority-session-crypto.ts
    browser-authority-frame-codec.ts
    transport-actor.ts
    transport-reducer.ts
    transport-authenticator.ts
    command-permit.ts
    browser-command-admission-budget.ts
  chrome-extension/
    manifest.json
    service-worker.ts
    pairing.html
    pairing-popup.ts
    websocket-actor.ts
    websocket-actor-crypto.ts
    extension-target-authority.ts
    command-registry.ts
    command-permit-validator.ts
    exact-target-runtime.ts
    dom-intent-runtime.ts
    debugger-runtime.ts
  release/
    extension-directory-hash-v1.ts
    unpacked-extension-release-identity.ts
```

`service-worker.ts` 与 `pairing-popup.ts` 是分别由 MV3 manifest 和 `pairing.html` 装载的两个精确 Browser 外部源码入口，并由 `APEX-LOCAL-BROWSER-001-V4.codePurityLiveness.externalEntryFiles` 投影给 Code Purity。`service-worker.ts -> websocket-actor.ts` 是该法条唯一声明的 side-effect import；它只负责启动唯一 actor，不构成第二 transport。其他 extension 文件必须从这两个入口的 import 图可达。

任何第二 Broker、Workspace owner、WebSocket actor、reconnect loop、Target manager、CommandRegistry、journal、outcome resolver 或 Browser public API 都是第二链。

## 4. Session Workspace

`SessionWorkspaceBindingV6` 只绑定：

```txt
workspaceRef
authorityRef / authorityEpoch / connectionGeneration
operatorClaimRef
profileEnrollmentHash
extensionId
releaseBuildId
extensionDirectoryHash
sitePolicyHash
establishedAt
```

- 人工配对后第一次成功认领 HTTPS 标签页时原子建立 Workspace；没有第二个批准按钮或批准 API。
- Workspace 和认证 certificate 不设置墙上时间到期，也不后台续期；普通空闲或长时间生产不能撤权。
- 真实 socket disconnect、Workbench/Extension/Chrome restart、Extension reload、profile/release/directory/site-policy/connection identity drift、explicit revoke 立即使 Workspace 失效。
- 重启后 operator 重新配对并认领，系统为新 connection generation 建立新 Workspace，生产 owner 必须从最早未完成 job 的持久 checkpoint 继续，不得先执行较新的任务。
- Workspace 不授予某个 job 的业务许可；每条 Browser command 仍要有当前 Cloud lease/fence、Authority、Target、Document 和 action permit。
- `workspaceApprovalHash` 不进入 Cloud `executionFenceHash`；两者只在 command/journal/proof 上并列绑定。

## 5. Pairing、认证与 liveness

固定握手：256-bit 一次性 pairing secret -> P-256 ECDSA mutual challenge -> P-256 ECDH -> RFC8785 JCS transcript -> HKDF directional keys -> AES-GCM directional frames。pairing secret 只参与握手，不进入日志、evidence、receipt 或持久业务状态。

认证完成时 Extension 必须立即调用一次 `chrome.runtime.getPlatformInfo()` 作为同 Service Worker 存活脉冲；之后每 20 秒先执行该脉冲、再在唯一 authenticated WebSocket 上发送 heartbeat；不设置 alarm、offscreen document 或第二 keepalive。只有连续 45 分钟未收到有效 heartbeat 才能 hard expiry。认证握手 deadline 只约束握手帧；认证 certificate 与 Workspace 只绑定当前连接，不设置运行时长上限；每次执行必须查询唯一 WebSocket 的当前 heartbeat 状态。认领成功后空闲、20 秒心跳间隔、普通 runtime diagnostic 都不允许主动 close/revoke。真实 socket disconnect 必须在下一次人工配对前清掉 session/permit/Target/Document 并物理 detach 旧 debugger；一次性密钥认证后销毁，不持久化、不自动续权、不假重连。所有程序主动 close 必须携带明确 close code/reason；无程序 reason 的 peer `1001` 直接归类为 Chrome/worker 外部终止。liveness 只维持已经认证的 PRESENT，不能 mint authority。MAC、sequence、AAD、nonce、release/profile、second active client 或认证 deadline 任一不合法时，顺序固定为：关闭 socket -> revoke Authority/Target/Document -> pending command 归类 terminal/UNKNOWN -> 保持 ABSENT。

构建器在 bundle 前生成唯一 `releaseBuildId` 并编译进 `service-worker.js`，固定目录外 release record 保存同一值。PAIR_HELLO 的签名/MAC transcript 必须携带该值，Workbench 必须与启动时冻结的 release record 精确比较。这样磁盘已经更新但 Chrome 仍运行缓存旧 Service Worker 时，旧 worker 在认证门直接失败，不能凭相同 `1.0.0` 版本号伪装成当前构建。

普通 Extension `unhandledrejection`、worker error、action runtime error 使用 authenticated `DIAGNOSTIC` frame 上报并形成 `BROWSER_EXTENSION_FAILURE`；它只写脱敏诊断，不改变 Authority/Target/Document。认证 frame 解密、MAC、sequence、AAD、nonce、canonical body 或 exact identity 失败才使用 `REVOKE`。禁止把日志上报实现成主动断开链路。

## 6. Authority、Target、Document 三次准入

```txt
Admission
-> Before Send
-> Completion
```

每次验证必须同时成立：Workspace 未撤销且仍绑定当前 connection generation、Authority certificate/liveness 连续、Cloud lease/fence 当前、target 候选恰好一个、document generation 当前、site policy 和 capability 匹配、actionId 注册、相对 TTL 有余量、原 reply channel 未漂移。

navigation、document generation change、debugger detach、target close、operator takeover、authority revoke、Workspace revoke、lease/fence expiry 或 release/profile drift 使旧 Target/Document 立即失效。零候选、多候选、相邻假目标、正反证据冲突或到界不明确只允许 `failed | review_required`，不得猜测 target。

同一 Target 的站内 navigation 由 Extension 生成递增的 `navigationEpoch` 和新 `documentRef`。Extension 必须在 navigation terminal REPLY 前，经唯一 authenticated WebSocket 发送同 targetRef 的 TARGET_CLAIM 更新并等到 Agent acknowledgement；Broker 先替换当前 Document，旧 Document 再失败关闭。该更新是现役 Exact Document 生命周期的一部分，不是第二 target、第二认领链或自动续权。

AI 双候选或多 conversation 只能在 Provider 等待阶段并存。每个排队后的 Browser action 在签发 Permit 前都调用 Broker 注入的 `resolveCurrentTarget`，用当前 claim 刷新该 execution lease 的 Document；因此先创建的 execution 不会在别的 conversation 导航后继续携带旧 documentRef。刷新只读唯一 Broker，不创建全局 target cache、第二 registry 或自动重试。

## 7. 固定 SiteActionRegistry

Browser wire 只承载：

```txt
actionId
opaque workspace/authority/target/document/permit refs
typed owner-admitted payload or artifact grant ref
relative commandTtlMs
sequence / reply-channel binding
```

这里的 sequence 必须分成两个命名域：`requestSequence` 是 authenticated WebSocket transport frame 序号，只用于 pending frame correlation；`permitSequence` 是 target lease 内的 command permit 序号，只用于 command identity。Extension 的 REPLY 同时回显二者与 `replyChannelToken`，Agent 分别校验；READY、TARGET_CLAIM acknowledgement、heartbeat 或 diagnostic 插入 transport 序列后，不得拿 transport 序号与 permit 序号比较。

每个 registry entry 固定声明：site policy、capability、request/response schema、mutation class、field safety budget、artifact resource budget、target/document requirement、business/browser postcondition、human gate、evidence 和 acceptance。field safety budget 与 artifact resource budget 不得成为 prompt/message byte ceiling。

wire 和 caller 物理禁止：URL、selector、coordinate、tab/window/title/marker/conversation、absolute monotonic deadline、raw file path、JavaScript、CDP/debugger command、`eval`、`new Function`、browserCommand、nextAction、actionPlan、workflow 或 concurrency。

Extension private implementation 可以为固定 actionId 保存站点结构知识，但 selector 不是 public alias，不得由 Cloud、website、AI、Plugin 或 capability 动态拼接。未注册 actionId 返回 `BROWSER_CAPABILITY_REJECTED`，不得转入 generic executor。

### 7.1 投喂传输禁区

- `65,535` 只决定 RFC 6455 使用 16-bit 还是 64-bit length，不能触发拒绝。
- owner schema 与 provider/model window 已接纳的完整 prompt command，使用同一 authenticated WebSocket message 的 64-bit frame 或标准 continuation frame 原样传输。
- Agent、App Server、Browser transport、Extension、AI Input Gateway 与 xuanxue production flow 均不得设置 64 KiB、256 KiB、512 KiB、1 MiB、100 MB 或其他 prompt/message byte ceiling；100 MB 只是已知回归场景，不是新门槛。
- 禁止截断、拆成多个业务 prompt、静默丢字、自动摘要、HTTP/file/artifact fallback、第二 socket 或 compatibility path。
- 允许保留与投喂无关的 artifact/file identity 大小、媒体处理资源和下载资源安全边界；它们不得反向限制 prompt command。
- Runtime Log 必须记录失败 frame kind/sequence、encoded byte length、close/error code 与 reason；不得记录 raw prompt/payload。

## 8. Deadline 与有界停止

Cloud grant 提供 `serverNow` 和 `leaseExpiresAt`。Cloud Worker 使用完整 request RTT 与固定 10 秒安全边际计算本地 monotonic budget；跨进程只传剩余相对 TTL。Browser command 的 `commandTtlMs` 不得超过 Cloud budget、Workspace 剩余 TTL、Authority/Target/Document/permit 剩余 TTL 中的最小值。

Extension 只用自己的 monotonic clock 扣减 `commandTtlMs`；wall clock rollback、sleep/wake discontinuity、reconnect 或 document drift 都不能延长权限。到界先终止动作并撤销相应租约，禁止继续观察、滚动、搜索或切第二动作。

## 9. Mutation Journal 与 UNKNOWN

每个 mutation journal entry 必须绑定：

```txt
candidateHash / contractManifestHash
jobId / attemptId / deviceId / leaseVersion / executionFenceHash
localOrderId / workspaceApprovalHash
authorityCertificateHash / targetRefHash / documentRefHash
actionId / commandSequence / commandTtlMs
payloadHash / artifactRefs / preparedAtMonotonic
```

```txt
PREPARED
-> durable append + fsync
-> SEND
-> CONFIRMED | FAILED | UNKNOWN
```

只有 Extension 的原 reply channel、同 sequence、同 identity terminal receipt 才能写 `CONFIRMED | FAILED`。断线、进程崩溃、response loss、late/duplicate/conflicting receipt、completion identity drift 一律 `UNKNOWN`。Transport、Worker、UI、API、retry loop 不得 replay。

owning Plugin 的 `OutcomeResolutionReceipt` 必须同时证明：目标业务身份和目标终态成立；已知相邻假目标、错误态、加载态、过期态、重复态全部不成立；候选恰好一个；在固定次数/截止时间内结束。无法闭合即 `review_required`，Cloud terminal complete 不可写入。

## 10. Artifact 与文件输入

大对象走同一 authenticated WebSocket 的单一 artifact subprotocol，不进入 control JSON。file grant 在 Agent 内绑定 canonical path/inode/hash/size，但 wire 只发送 opaque grant ref 和 content identity；Extension 根据固定 file-input actionId 消费。发送前重验文件身份，完成/TTL/revoke 后确定性销毁 grant。

禁止 raw path 上线、base64 大对象塞入 command、系统文件选择器、OS 鼠标键盘、DOM value assignment、第二 file transport 或把 `file-selected` 当业务 upload success。

## 11. 状态与失败矩阵

| 事件 | Browser 状态 | Pending mutation | 允许恢复 |
| --- | --- | --- | --- |
| auth 未完成/失败 | `ABSENT` | 零 side effect | operator 重新 pairing |
| heartbeat 过期/socket 断开 | 先 revoke 为 `ABSENT` | 已 SEND 无 terminal -> `UNKNOWN` | 新认证 window；UNKNOWN 先由 Plugin 裁决 |
| Workspace 到期/revoke | `ABSENT` | 未 SEND -> failed；已 SEND 按 receipt/UNKNOWN | operator 新签 Workspace，不续期 |
| navigation/document drift | Authority 可在，旧 Document 失效 | 当前动作 failed/UNKNOWN | 同 execution 重新观察并取得新 Document |
| Cloud lease/fence 失效 | writer action count=0 | 未 SEND failed；已 SEND 不得覆盖 Cloud terminal | 人工 handover 新 attempt/fence |
| zero/multi target | 不签 TargetLease | 零 side effect | 真实页面消歧或 `review_required` |
| release/profile/directory drift | `ABSENT` | 全部 lease 撤销 | exact readback + re-pair；无旧链 fallback |

## 12. Evidence、日志与跨仓 receipt

日志只记录 opaque ref、hash、sequence、状态、reason code 与 duration；pairing secret、session key、device token、cookie、password、用户输入、provider response 和 raw file path 不得记录。

`AgentRuntimeReceiptV5` 的 Browser-required 分支包含有序 `AgentBrowserAuthorityProofV5` windows。每个 window 绑定两仓 candidate、Cloud attempt/lease/fence、Workspace、authority certificate、profile/process/release/artifact、WebSocket generation、Target/Document、first/last command sequence、ActionReceipt subtree 与 closed reason。window 间 action 数为零；`unresolved_outcome_unknown_count=0` 才能 complete。

xuanxue-web `DynamicProofController` 只验证同候选 receipt 和原始 evidence，不读取或控制本地 AGENT，不产生第二 Browser verdict，也不能代替 owning Plugin 的业务终态。

## 13. 质检与证明分层

Static/Exam 必须覆盖：

1. one unpacked MV3 / one WebSocket / one socket actor / one tab / one mutation lock；
2. Session Workspace identity、无墙上时间到期与全部真实失效事件；
3. P-256/JCS/HKDF/AES-GCM known-answer、frame/AAD/nonce/sequence/deadline mutants；
4. Authority/Target/Document 三次准入与零/多候选；
5. registry-only action、wire 禁字段与 unknown action fail-close；
6. Cloud fence 与 Workspace 分离；
7. PREPARED+fsync、response loss、late/duplicate/conflicting receipt、UNKNOWN no replay；
8. artifact grant 无 raw path、预算和销毁；
9. old Port/CWS/Native/previous protocol/per-job approval consumer 为零；
10. secret/PII 日志 redaction。

真实 Chrome 必须另证 pairing/liveness、MV3 service-worker restart、Extension reload、Chrome restart、sleep/wake、exact target/document、固定 GPT Web action、file input、disconnect/清理/人工重配对、release update/rollback 和真实 UNKNOWN resolution。真实 Provider/Cloud/DB、fault、72 小时 soak、push 与 release 各自需要对应授权与同候选 receipt。

`scripts/acceptance/xuanxue-ai-production.real-chrome.ts` 只核验唯一 Cloud Worker → Mediator → Plugin → Browser Authority 真实旅程产出的 V5 evidence envelope 和 `AgentRuntimeReceiptV5`；它不创建 BrowserController、不连接第二 WebSocket、不执行 Provider，也不铸造动态证据。`src/capabilities/ai-input-gateway/acceptance/xuanxue-ai-production-real-proof-verify.ts` 独立核验同一 real-run-root 下的真实 Provider checkpoint。两者均由该条款标记为 deferred dynamic evidence，普通 CI 不得执行或冒充通过。

`typecheck`、Static、acceptance、Exam、CI-FULL 都不能替代真实 Chrome。未获得真实页面前后取证的状态必须写 `UNKNOWN / NOT_PRODUCTION_VERIFIED`，不得按截图、历史 selector、浏览器常识或模拟 DOM 实现后续动作。

## 14. 终态删除分母

```txt
BrowserController.createTargetSession
BrowserTargetSession / per-job Browser approval
runtime.onConnectExternal / externally_connectable / external Port
Workbench page relay / open-inbound-next routes
CWS / Native Messaging / Native Host
previous protocol / compatibility transport / alias / fallback
activeTab / frontWindow / firstTab / URL-first identity
caller selector / coordinate / arbitrary JS / raw CDP / raw file path
automatic UNKNOWN replay / transport business verdict
```

只有上述删除分母、active law、施工图、owner inspector、acceptance、两仓同候选 CI 与真实 Chrome/Provider/Dynamic receipts 分层闭合，才能作出相应层级的 PASS；任何较低层证据不得外推为生产可用或发布完成。
