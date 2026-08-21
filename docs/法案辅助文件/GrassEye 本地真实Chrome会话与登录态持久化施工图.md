# GrassEye Browser Authority 生产终态施工图

版本：2026-08-21.1<br>
状态：active final-state blueprint  
上级权威：`.github/instructions/agent-rules/modules/module-local-browser-session.instructions.md`  
目标方案：`docs/项目方案/AGENT-插件生产级实施方案.md`

> 本施工图只投影终态，不描述“可上线阶段”。任何未落地项均为实现缺口，不能用过渡对象、兼容层或第二链路合法化。
>
> 不提供本地可执行文件、Native Messaging 或 Apple 签名/公证链；它们不得出现在最终候选中。

## 1. 终态图

```txt
xuanxue durable job + current writer fence
  -> BrowserAuthorityBroker
      -> AuthenticatedBrowserAuthorityLease
          -> BrowserTargetLeaseManager
                  -> BrowserTargetLease
                      -> BrowserCommandActor
                          -> WorkbenchExtensionChannel
                              -> exact Workbench page session
                                  -> CWS MV3 ExtensionExternalPortActor
                                      -> CommandRegistry
                                          -> chrome.debugger exact target/document
```

控制面唯一图：

```txt
BrowserExtensionReleaseVerifier
 -> verify CWS release identity + release security policy
 -> verify approved local profile + installed extension identity + page-session issuer
 -> BrowserInfrastructureSupervisor
     -> exclusive BrowserOwnerLock
     -> TransportActor / Reducer
     -> TransportAuthenticator
     -> BrowserAuthorityIssuer
     -> retry / repair / activation / rollback
```

## 2. 目录终态

```txt
src/lib/browser/
  browser-authority-api.ts
  profile/
    browser-profile-config.ts
    browser-profile-state.ts
    dedicated-profile-policy.ts
    browser-profile-enrollment.ts
    browser-profile-enrollment-receipt.ts
    browser-profile-process-attestation.ts
    managed-policy-readback.ts
    browser-process-supervisor.ts
  infrastructure/
    browser-infrastructure-supervisor.ts
    browser-control-state.ts
    browser-owner-lock.ts
    browser-authority-broker.ts
    browser-authority-lease.ts
    browser-authority-issuer.ts
    browser-authority-certificate.ts
    browser-authority-liveness-lease.ts
    browser-worker-membership.ts
    browser-worker-handover.ts
    browser-retry-policy.ts
    browser-repair.ts
  transport/
    transport-event.ts
    transport-reducer.ts
    transport-actor.ts
    transport-authenticator.ts
    transport-transcript.ts
    command-permit.ts
    reply-channel-token.ts
    authenticated-heartbeat.ts
    browser-command-admission-budget.ts
    workbench-extension-channel.ts
  exact-target/
    browser-target-ref.ts
    browser-document-ref.ts
    browser-target-lease.ts
    browser-target-lease-manager.ts
    browser-command-actor.ts
    browser-mutation-intent-journal.ts
    browser-dom-intent.ts
    browser-file-artifact-grant.ts
    browser-artifact-stream.ts
  protocol/
    browser-protocol.schema.json
    browser-authority-certificate.schema.json
    browser-authority-liveness-lease.schema.json
    browser-profile-enrollment.schema.json
    browser-file-artifact-grant.schema.json
    browser-capabilities.json
    browser-errors.json
    generated/
      browser-protocol.generated.ts
  release/
    cws-extension-release-identity.ts
    cws-extension-release-proof.ts
    browser-release-security-policy.schema.json
    browser-rollback-receipt.schema.json
    browser-build-inputs.schema.json
    browser-sbom.schema.json
    browser-provenance.schema.json
    browser-previous-activation-snapshot.schema.json
    pinned-browser-toolchain.json
    browser-build.config.json
  chrome-extension/
    manifest.json
    service-worker.ts
    external-port-actor.ts
    command-registry.ts
    command-permit-validator.ts
    debugger-runtime.ts
    exact-target-runtime.ts
    dom-intent-runtime.ts
    artifact-stream.ts
    authenticated-heartbeat.ts
scripts/
  audit/domains/local-browser-session/
    manifest.json
    inspector.ts
    local-browser-check-coverage.acceptance.ts
  acceptance/
    local-browser-terminal-contract.acceptance.ts
    local-browser-rule-mutants.acceptance.ts
    local-browser-property-model.acceptance.ts
    local-runtime-browser-authority.acceptance.ts
    local-browser-real-chrome-terminal.acceptance.ts
```

最终候选不得包含：`BrowserTargetSession`、`BrowserController.createTargetSession`、`targetSessionsByOwner`、任意脚本执行合同、raw-path wire contract、第二 Browser transport、Native Messaging、Native Host、本地 macOS launcher、Apple 签名/公证门、runtime capability intersection 或 production fixture authority。

### 2.1 施工图与法案的逐项落点

以下表只把现役法案已经定义的对象落到唯一终态路径；它不新建 owner，也不降低法条。

| 法案对象 | 唯一终态路径 |
| --- | --- |
| 业务 Browser 入口 | `src/lib/browser/browser-authority-api.ts` → `infrastructure/browser-authority-broker.ts` |
| control state / issuer / liveness | `src/lib/browser/infrastructure/browser-control-state.ts`、`browser-authority-issuer.ts`、`browser-authority-liveness-lease.ts`；每个 execution authority lease 在 target 或 artifact 动作前同时核验 certificate 与其同 epoch liveness lease |
| 专用 profile / process | `src/lib/browser/profile/browser-profile-enrollment.ts`、`browser-process-supervisor.ts` |
| exact target / document / command | `src/lib/browser/exact-target/**` + `transport/command-permit.ts` |
| 唯一 CWS MV3 / Workbench page 传输 | `src/lib/browser/chrome-extension/**` + `transport/workbench-extension-channel.ts` + `src/app/workbench-browser-extension-channel-*.ts` |
| CWS release identity / policy / proof | `src/lib/browser/release/**` |
| health / errors / metrics | `src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts` 只发布 `browserInfrastructure` / `browserAuthority`；`protocol/browser-errors.json` 是唯一 Browser error-code 合同；运行指标只由 infrastructure supervisor 的有界 telemetry 输出 |
| 26 项 Browser 核心 + 1 项 P0 隐私 machine-blocking 质检 | `scripts/audit/domains/local-browser-session/manifest.json` + `inspector.ts`，每项独立 receipt，只通过现有 generated-plan runner 生成 |
| 终态验收 | `scripts/acceptance/local-browser-terminal-contract.acceptance.ts`、`local-browser-rule-mutants.acceptance.ts`、`local-browser-property-model.acceptance.ts`、`local-runtime-browser-authority.acceptance.ts`、`local-browser-real-chrome-terminal.acceptance.ts`；只证明各自合同，不拥有生产逻辑 |

`BrowserProcessSupervisor` 的唯一目标路径固定为：

```txt
src/lib/browser/profile/browser-process-supervisor.ts
```

任何第二个 process supervisor、browser public API、transport、controller 或审计 runner 都是法案违反，不是替代实现。

### 2.2 MV3 的唯一外部活入口

`src/lib/browser/chrome-extension/manifest.json` 的 `background.service_worker = service-worker.js`
对应唯一的源码入口 `src/lib/browser/chrome-extension/service-worker.ts`。它不是 package script、
也不是 inspector 内部白名单：只由 `APEX-LOCAL-BROWSER-003-V3` 的
`codePurityLiveness.externalEntryFiles` 投影进 generated law registry，再由 Code Purity 的
symbol graph 向下证明其静态 import 子图。

Browser owner inspector 必须同时确认 MV3 manifest、`service-worker.js` 和
`service-worker.ts` 三者精确对应。任何第二 service worker、改以 package script 伪造活性、
或在 inspector 源码另存 exemption 数组，都属于第二链，必须失败。

## 3. Composition Root

Base Workbench 不以“Chrome 此刻在线”决定进程能否存在。它只构造 Browser infrastructure control plane 与 `BrowserAuthorityBroker`：

```txt
create base runtime
-> verify browser install/profile contract
-> start BrowserInfrastructureSupervisor
-> create BrowserAuthorityBroker (no raw command surface)
-> register browser-dependent mission factories
-> expose only browserInfrastructure / browserAuthority health
```

### 3.1 Health / Errors / Metrics 的终态边界

Health component 只有两个合法值：`browserInfrastructure`、`browserAuthority`。不得恢复
`browserSession`、`transportReady`、`session not authenticated` 或 `wait for authentication`
等旧生产语义。

`protocol/browser-errors.json` 必须覆盖 CWS install、origin、extension、release identity、transcript、
capability、profile、process、policy、liveness、worker-fence、dual-active、backpressure、file-grant、
rollback、revocation、permit、target、document、devtools、outcome-unknown、repair；错误代码不是
第二状态机，最终 authority 仍只为 `ABSENT` 或 `PRESENT`。

唯一 Browser telemetry 必须证明以下零值：未认证 authority 签发、无有效 authority command、
stale-event side effect、旧 completion 写入新 port、非幂等自动重放、错误 profile/process 签发、
liveness 到期后 command、authority 缺失时动作、dual-active worker、被撤销或回退 release identity 激活、
Browser admission budget 违规。验收同时验证 supported-runtime-window availability ≥99.99%、
authority issuance p99 ≤5s、recoverable chain rebuild p99 ≤10s、revoke→ABSENT p99 ≤10ms，
并要求 unbounded queue/cache/stream=0。上述健康、错误与指标只由
`browser-infrastructure-supervisor.ts` 的 owner 输出；`ACC-032` 的 deterministic terminal
contract 和 `ACC-036`/`ACC-037` 的 HA/soak receipts 分别验证结构边界和运行读数。

Browser-dependent job admission：

```txt
cloud job readable
-> current lease/fence valid
-> Broker returns current AuthenticatedBrowserAuthorityLease
-> writer lane admitted
-> exact target lease acquired
-> governed commands execute
```

Authority ABSENT 时 base runtime 可 degraded 运行，但 Browser-dependent worker 不领取 Browser writer lane，业务不能持有半成品 Browser object。

## 4. Transport Reducer

所有 I/O callback 只提交 `BrowserTransportEvent`。Reducer 维护唯一：

```txt
controlState
authoritySlot
supervisorEpoch
controllerIncarnation
connectionGeneration
appServerEpoch
externalPortEpoch
sequence
currentSourceChannelToken
```

每个 event 先执行 generation/fence check，再允许 state mutation。Disconnect/expiry reducer transition 第一行语义必须 revoke current authority；后续才 fail pending、invalidate leases、log、cleanup、schedule reconnect。

## 5. Authentication Commit

Authority 只从 `AUTH_PROOF_COMMITTED` reducer event 产生。固定 `WORKBENCH_PAGE_PATH = "/"` 与 `WORKBENCH_EXTENSION_CHANNEL_PORT_NAME = "grasseye-browser-authority-v1"`。MV3 manifest 的 `permissions` 只能是 `debugger`，`host_permissions` 必须为空，`externally_connectable.matches` 只能是 `http://127.0.0.1/*`。握手顺序固定为：验证 CWS item、installed extension ID/version、source/package hash、manifest permission/origin policy；签发一次性 page-session grant；根 Workbench 页面以固定 extension ID 和固定 port 名称连接；MV3 以 URL 语义严格验证 `port.sender.url` 的协议 `http:`、host `127.0.0.1`、当前 App Server port 和 path `/`；actor 收到该 Port 的第一帧后，在获得 authority、接受命令或产生浏览器副作用之前验证 grant、release identity 与双向 transcript。任何一步缺失均不 commit。所有字段 hash 进入 certificate。

页面与唯一 App Server 只有三个同源承载 route：`POST /api/browser-extension-channel/open`、`POST /api/browser-extension-channel/inbound`、`GET /api/browser-extension-channel/next`。它们均要求当前 grant，且只调用 Workbench Handle 的窄 channel facade；它们不得生成 command、selector、target、permit、业务状态或成功结论。断开、刷新、grant 过期、release identity 漂移、reply token/sequence 不一致、liveness 到期或 writer fence 失效时，第一动作必须 revoke 为 `ABSENT`，不得重绑 Port 或重放 mutation。

`pendingAuthority` 不是业务对象；commit 之前 Broker 永远返回 unavailable。

## 6. Liveness

Workbench page/Extension 双 watchdog 使用同一 generated policy。Heartbeat 只续 PRESENT。Hard expiry、sleep/wake discontinuity、event-loop stall、silent half-open、max authority age 都触发完整撤销和 fresh page/Port/authority window，不在线 rekey。

## 7. Exact Target / DOM Intent

每个 TargetLease 与 authority epoch + execution fence 绑定。DOM observation 不接收 script string；只接收 versioned intent，例如：

```ts
type BrowserDomIntent =
  | { kind: "inspect"; selector: string; fields: readonly BrowserDomField[] }
  | { kind: "find"; locator: BrowserSemanticLocator; maxMatches: number }
  | { kind: "readText"; selector: string; maxChars: number }
  | { kind: "readAttribute"; selector: string; name: string; maxChars: number };
```

Extension 根据 registry 执行固定逻辑，不执行任意 JavaScript expression。

## 8. Command Admission / Mutation Journal

Actor 先验证 execution fence + authority + capability + target/document + deadline + queue budget，再签发 permit。Send 前再次确认 source channel/authority；completion 再确认原 reply token/sequence/authority。

Mutation journal `PREPARED -> fsync -> send -> terminal`。non-idempotent uncertain 必须 `OUTCOME_UNKNOWN`，transport 无 replay 权。

## 9. Workbench Page Framing / Artifact Stream

Canonical schema 生成 TypeScript limits。Workbench page 与 MV3 的 control frame 双向 <=256KiB；Extension→Workbench page artifact chunk <=4MiB；Workbench page 不得向 extension 发送 artifact payload。截图、附件等大对象不放 control JSON，使用 content-addressed stream。

File input：业务先向 Browser owner申请 artifact grant；grant 内部保存 canonical path/inode/hash，但 wire 只传 grantRef/content identity。发送前二次 readback，完成或 TTL 到期后确定性销毁。

## 10. Profile / Process / Policy

`BrowserExtensionReleaseVerifier` 创建 dedicated profile enrollment。Production verify 每次读回 CWS item/review receipt、extension ID/version、source/package hash、permission/origin policy 与 installed extension identity；`BrowserProcessSupervisor` 产生 process incarnation。page-session attestation 必须绑定批准 process start token；错误 profile/process 或错误 Workbench origin 即使 extension ID 相同也不能进入 `AUTH_PROOF_COMMITTED`。

## 11. Owner Lock

`BrowserOwnerLock` 在创建 page-session 之前 acquire。只有锁持有者能终结过期内存 grant；活 owner 的 grant 永远不会被另一进程接管或复用。

## 12. Release

Build-once 输出 immutable CWS package。`CwsExtensionReleaseIdentity` 绑定 CWS item、extension ID/version、审核 receipt、上传包/source hash 与 manifest permission/origin policy；SecurityPolicy 决定 minimum sequence/revocation/current+previous protocol window；ProofManifest 绑定治理、静态、真实 Chrome、soak 与跨仓证据。纯治理变化只重签 ProofManifest，不重建 software bytes。

CWS N/N+1 异步更新只允许有限 current + previous protocol window；同一时刻只接受一个 installed release identity。Rollback 只改变最低接受序列和协议兼容策略，不依赖 extension downgrade。

## 13. HA / Writer Fence

xuanxue 现有 `lease_owner + lease_token_hash + lease_version + lease_expires_at` 是选主根。终态将 execution fence 定义为不可伪造的 current lease binding hash，并在 checkpoint/handover receipt 中封存。AGENT Browser 不建自己的云端 election。

Failover 只从 sealed checkpoint + new lease version/fence 开始。每个 authority window绑定一个 worker/fence；窗口之间零 browser action。

## 14. Cross-Repo Proof

`AgentRuntimeReceiptV2` 对 browser-required execution包含：

```txt
AgentBrowserAuthorityProofV2
  windows[]
    worker identity/fence
    authority certificate
    profile/process
    CWS release identity/security policy
    auth transcript/liveness
    connection/port/capability
    first/last command sequence
    action receipt subtree
    closed reason
  elected worker chain hash
  handover receipt chain hash
  browser action Merkle root
  no_action_during_authority_absence=true
  unresolved_outcome_unknown_count=0
```

Dynamic Proof 仍是唯一网站动态 verdict；Browser proof 是 receipt 内 evidence，不产生第二 verdict。

## 15. Quality Mapping

26 个 Browser 核心 checkIds 与 1 个独立的现役 P0 隐私 checkId 必须在唯一 `local-browser-session` manifest 中逐项绑定并由同一 inspector 逐项运行；禁止 `owner-assertion-set` 代替 P0，也禁止一个 broad check 代替多个 ID。

```txt
browser-auth/no-unauth-session-type
browser-auth/no-transport-ready-boolean
browser-auth/no-preauth-command-surface
browser-auth/no-fire-and-forget-startup
browser-auth/authority-mint-only-after-proof
browser-auth/revoke-before-side-effects
browser-channel/no-page-session-rebind
browser-channel/original-reply-channel
browser-channel/no-native-host-surface
browser-auth/authority-liveness-lease
browser-auth/no-command-after-liveness-expiry
browser-auth/heartbeat-cannot-mint-authority
browser-auth/production-fixture-zero
browser-profile/dedicated-production-profile
browser-profile/installed-extension-readback
browser-profile/exact-workbench-origin-readback
browser-release/cws-release-identity
browser-release/cws-identity-proof-separation
browser-release/cws-review-and-installed-readback
browser-release/no-apple-signing-gate
browser-release/anti-rollback-and-revocation
browser-release/reproducible-build-identity
browser-cross-repo/authority-proof-v2
browser-cross-repo/ordered-authority-window-chain
browser-command/bounded-admission-budget
browser-file/artifact-grant-no-raw-path
browser-old-path/retired-zero
```

每项必须具有自己的 source evidence 和负例、性质、model、mutant 或运行时证据；generated truth 只由现有 builder/runner 生成。负面类型测试必须证明 Supervisor/ControlState 无 command/createTarget，旧 Session 类型不可导入，revoked lease不能执行。

`chrome-extension/authenticated-heartbeat.ts` 只保存 heartbeat 的静态认证边界：它不能 mint 或恢复 authority，且在尚无本次真实 Chrome 帧观察时不取得独立运行入口。

Property/model 必须随机证明 auth failure->ABSENT、disconnect先revoke、stale event零副作用、old completion不跨Port、heartbeat不能mint、wrong process/policy不能mint、budget reject、revoked CWS release identity reject、handover窗口间零动作。

每个 check 都必须有独立负例；page framing/auth/file/admission fuzz 覆盖0/1/n-1/n/n+1、truncated JSON、乱序/重复chunk/hash drift。

## 16. Real Chrome / Release Gate

同一 CWS-reviewed package 覆盖 Stable/CfT、wrong install/origin/id/hash/release identity/profile/process/policy、Workbench page/MV3/Chrome crash、sleep/wake/half-open、HA handover、update/rollback、foreground isolation、navigation stale、DevTools conflict、CJK/繁中/日韩/RTL/emoji/contenteditable/shadow DOM/iframe/file、大对象与反压。

核心 transport/auth/profile/HA变更要求168h连续soak；非核心 capability/release至少24h。auth storm、stale side effect、old reply->new Port、auto mutation replay任一发生，soak 证据失效。

最终只有同一 candidate/CWS package/release identity/proof/cross-repo receipt hash 闭合，required checks/branch protection 实际开启，独立复核 blocking finding=0，才可从 BLOCKED 转为 PRODUCTION_APPROVED。未审核、未安装或仅 load-unpacked 的版本一律 `NOT_PRODUCTION_VERIFIED`。
