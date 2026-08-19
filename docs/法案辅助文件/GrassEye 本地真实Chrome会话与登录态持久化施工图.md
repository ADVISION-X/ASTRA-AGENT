# GrassEye Browser Authority 生产终态施工图

版本：2026-08-20.1  
状态：active final-state blueprint  
上级权威：`.github/instructions/agent-rules/modules/module-local-browser-session.instructions.md`  
目标方案：`xuanxue-web/docs/项目方案/AGENT-插件生产级方案.md`

> 本施工图只投影终态，不描述“可上线阶段”。任何未落地项均为实现缺口，不能用过渡对象、兼容层或第二链路合法化。

## 1. 终态图

```txt
xuanxue durable job + current writer fence
  -> BrowserAuthorityBroker
      -> AuthenticatedBrowserAuthorityLease
          -> BrowserTargetLeaseManager
              -> BrowserTargetLease
                  -> BrowserCommandActor
                      -> AuthenticatedControllerHostChannel
                          -> signed Rust Host
                              -> one Native Messaging Port
                                  -> MV3 NativePortActor
                                      -> CommandRegistry
                                          -> chrome.debugger exact target/document
```

控制面唯一图：

```txt
browserctl
 -> verify immutable artifacts + release security policy + active tuple
 -> verify managed dedicated profile + Chrome process incarnation
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
  profile/
    browser-profile-config.ts
    browser-profile-state.ts
    dedicated-profile-policy.ts
    browser-profile-enrollment.ts
    browser-profile-enrollment-receipt.ts
    browser-profile-process-attestation.ts
    managed-policy-readback.ts
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
    raw-controller-host-channel.ts
    authenticated-controller-host-channel.ts
    transport-event.ts
    transport-reducer.ts
    transport-actor.ts
    transport-authenticator.ts
    transport-transcript.ts
    command-permit.ts
    reply-channel-token.ts
    authenticated-heartbeat.ts
    browser-command-admission-budget.ts
    browser-native-framing.ts
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
    generated/**
  release/
    browser-artifact-set.schema.json
    browser-activation-tuple.schema.json
    browser-release-proof.schema.json
    browser-release-security-policy.schema.json
    browser-rollback-receipt.schema.json
    active-activation.json
    build-artifacts.mjs
    verify-artifacts.mjs
  chrome-extension/
    service-worker.ts
    native-port-actor.ts
    command-registry.ts
    command-permit-validator.ts
    debugger-runtime.ts
    exact-target-runtime.ts
    dom-intent-runtime.ts
    artifact-stream.ts
    authenticated-heartbeat.ts
  native-messaging-host/
    Cargo.toml
    crates/host/**
    crates/launcher/**
    crates/browserctl/**
    crates/platform-macos/**
    manifests/**
```

退休并在最终候选物理不可达：`BrowserTargetSession`、`BrowserController.createTargetSession`、`targetSessionsByOwner`、arbitrary evaluate contract、raw-path wire contract、old transport server auth boolean/polling model、Host bridge/rebind、runtime capability intersection、production fixture authority。

## 3. Composition Root

Base Workbench 不以“Chrome 此刻在线”决定进程能否存在。它只构造 Browser infrastructure control plane 与 `BrowserAuthorityBroker`：

```txt
create base runtime
-> verify browser install/profile contract
-> start BrowserInfrastructureSupervisor
-> create BrowserAuthorityBroker (no raw command surface)
-> register browser-dependent mission factories
-> expose service health
```

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
hostProcessEpoch
nativePortEpoch
sequence
currentSourceChannelToken
```

每个 event 先执行 generation/fence check，再允许 state mutation。Disconnect/expiry reducer transition 第一行语义必须 revoke current authority；后续才 fail pending、invalidate leases、log、cleanup、schedule reconnect。

## 5. Authentication Commit

Authority 只从 `AUTH_PROOF_COMMITTED` reducer event产生。握手包括 Controller↔Host local identity、Host↔Chrome managed process/profile、Host↔Extension origin/installed-tree、Controller↔Extension exact artifact/tuple/capability transcript。所有字段 hash 进入 certificate。

`pendingAuthority` 不是业务对象；commit 之前 Broker 永远返回 unavailable。

## 6. Liveness

Controller/Extension 双 watchdog 使用同一 generated policy。Heartbeat 只续 PRESENT。Hard expiry、sleep/wake discontinuity、event-loop stall、silent half-open、max authority age 都触发完整撤销和 fresh Host/Port/authority window，不在线 rekey。

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

## 9. Native Messaging / Artifact Stream

Canonical schema生成 TypeScript 与 Rust limits。Control frame 双向 <=256KiB；Extension→Host artifact chunk <=4MiB。截图、附件等大对象不放 control JSON，使用 content-addressed stream。

File input：业务先向 Browser owner申请 artifact grant；grant 内部保存 canonical path/inode/hash，但 wire 只传 grantRef/content identity。发送前二次 readback，完成或 TTL 到期后确定性销毁。

## 10. Profile / Process / Policy

`browserctl enroll-profile` 创建 dedicated managed profile enrollment。Production verify 每次读回 force-install、extension ID/update URL、permission policy、installed extension tree digest；`BrowserProcessSupervisor` 产生 process incarnation。Host attestation 必须包含批准 process start token；错误 profile/process 即使 extension ID 相同也不能进入 AUTH_PROOF_COMMITTED。

## 11. Owner Lock

`BrowserOwnerLock` 在 bind socket 之前 acquire。只有锁持有者能判断和清理 stale inode；活 owner 的 socket 永远不会被另一进程 unlink。

## 12. Release

Build-once 输出 immutable ArtifactSet。ActivationTuple 是三端精确组合；SecurityPolicy 决定 minimum sequence/revocation/current+previous；ProofManifest 绑定治理、静态、真实 Chrome、soak 与跨仓证据。纯治理变化只重签 ProofManifest，不重建 software bytes。

N/N+1 CWS asynchronous update 通过有限 dual-tuple package吸收；activation 同时只有一个 tuple。Rollback 切回 previous tuple，不依赖 extension downgrade。

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
    artifact/activation/security policy
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

26 个独立 checkIds 与法案一一映射，禁止 `owner-assertion-set` 代替 P0。负面类型测试必须证明 Supervisor/ControlState 无 command/createTarget，旧 Session 类型不可导入，revoked lease不能执行。

Property/model 必须随机证明 auth failure->ABSENT、disconnect先revoke、stale event零副作用、old completion不跨Port、heartbeat不能mint、wrong process/policy不能mint、budget reject、revoked tuple reject、handover窗口间零动作。

26 mutants 全杀死；Rust framing/socket/auth/file/admission fuzz覆盖0/1/n-1/n/n+1、short read/write、overflow/truncated JSON、乱序/重复chunk/hash drift。

## 16. Real Chrome / Release Gate

同一 packaged artifact覆盖 Stable/CfT、wrong install/origin/id/hash/tuple/profile/process/policy/tree、Controller/Host/MV3/Chrome crash、sleep/wake/half-open、HA handover、update/rollback、foreground isolation、navigation stale、DevTools conflict、CJK/繁中/日韩/RTL/emoji/contenteditable/shadow DOM/iframe/file、大对象与反压。

核心 transport/auth/profile/HA变更要求168h连续soak；非核心 capability/release至少24h。auth storm、stale side effect、old reply->new Port、auto mutation replay任一发生，soak 证据失效。

最终只有同一 candidate/artifact/tuple/proof/cross-repo receipt hash闭合，required checks/branch protection实际开启，独立复核 blocking finding=0，才可从 BLOCKED 转为 PRODUCTION_APPROVED。
