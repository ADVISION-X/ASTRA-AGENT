---
name: "GrassEye Browser Authority Infrastructure"
description: "Governs the single production Chrome authority chain, execution-bound leases, exact target/document identity, CWS MV3 to local Workbench page transport, release identity, HA handover and cross-repo browser proof."
applyTo: "src/lib/browser/**,src/lib/local-runtime/workbench-browser-authority-support.ts,src/lib/local-runtime/workbench-assembly.ts,src/lib/local-runtime/workbench-status.ts,src/capabilities/**,src/plugins/**,scripts/audit/domains/local-browser-session/**,scripts/acceptance/local-browser-*.ts,.github/workflows/browser-*.yml"
---

# GrassEye Browser Authority Infrastructure｜终态法案

status: active  
version: 2026-08-21.1
capabilityDomain: `local-browser-session`  
constitutional objective: **生产世界中未认证 Browser session / 半成品 BrowserController / 长期 TargetSession 不可表示。**

本文件原位替代 2026-08-18.5 过渡版本。与本文件冲突的旧法条、旧施工图、旧 API、旧 audit 绑定和旧 generated PASS 均无效；必须迁移引用后物理退出，不得保留兼容桥或第二真相。

## 0.1 生产传输与发行边界

生产 Browser 产品只包含两端：已经通过 Chrome Web Store 审核并由用户从 Chrome Web Store 安装的固定 ID MV3 扩展，以及本机唯一 Workbench 在 `http://127.0.0.1/` 提供的页面端点。Apple Developer Program、Developer ID Application、签名和公证均不是产品条件。

唯一传输固定为：

```txt
BrowserAuthorityBroker / BrowserCommandActor
  -> WorkbenchExtensionChannel（唯一 local app HTTP owner）
      -> 受限 Workbench 页面会话（仅承载、无业务决策）
          -> chrome.runtime.connect(extensionId, exactPortName)
              -> MV3 ExtensionExternalPortActor
                  -> CommandRegistry
                      -> chrome.debugger exact target/document
```

Workbench 页面必须由本机唯一 App Server 签发短期一次性 page-session grant；它只能连接固定 extension ID、固定 port 名称和精确 `127.0.0.1` page path。MV3 必须同时校验 manifest `externally_connectable`、`port.sender.url`、page-session transcript、CWS extension ID/version 和原 reply channel。页面只转发已经由 Browser owner 签发的 schema-bound frame；它不得产生命令、selector、target、permit、业务状态或成功结论。

固定常量为：`WORKBENCH_PAGE_PATH = "/"` 与 `WORKBENCH_EXTENSION_CHANNEL_PORT_NAME = "grasseye-browser-authority-v1"`。`port.sender.url` 必须以 URL 语义精确解析为 `http://127.0.0.1:<当前 App Server port>/`；manifest 的 match pattern 只负责把连接送到 service worker，不能替代该完整校验。

生产严禁：`nativeMessaging` permission、`runtime.connectNative`、`native-messaging-host/**`、任何 native Host、任何 Apple 签名/公证门、`load-unpacked` 生产链、第二 extension transport、第二 local page channel、通配外部 origin、CWS 审核中或未安装版本的 READY 声明。

## 0. 生产信任边界与唯一语义

本文的“永远禁止”只在以下生产根信任成立时作机器可验证承诺：

- 运行的 extension bytes 属于已审核、未撤销的 `CwsExtensionReleaseIdentity`；
- 当前 CWS item/extension ID/version/source-package hash/permission-origin policy 与本机 minimum accepted release sequence 精确一致；
- OS/kernel/credential store/release signing root 未被判定失陷；
- Browser Worker、Chrome process、专用 profile、唯一 App Server page-session 和 installed extension identity 完整性读回通过；
- xuanxue execution writer fence 当前有效。

任一根信任不能证明时，唯一结果是：

```txt
AUTHORITY_ABSENT
+ browser work BLOCKED / not admitted
```

Browser 数据面只有：

```txt
ABSENT
PRESENT(AuthenticatedBrowserAuthority)
```

连接中、认证中、退避中、修复中、启动中只属于 `BrowserInfrastructureControlState`，都不是 session，也没有页面命令能力。

## 1. 唯一生产拓扑

```txt
xuanxue durable ai_production_jobs
  -> current database execution lease / writer fence
      -> exactly one elected Browser Worker for that execution
          -> BrowserAuthorityBroker
              -> AuthenticatedBrowserAuthorityLease
                  -> BrowserTargetLeaseManager
                      -> exact BrowserTargetLease + BrowserDocumentRef
                          -> BrowserCommandActor
                              -> WorkbenchExtensionChannel
                                  -> one exact local Workbench page session
                                      -> fixed-id CWS MV3 ExtensionExternalPortActor
                                          -> governed CommandRegistry
                                              -> chrome.debugger
                                                  -> exact target / exact document
```

控制面：

```txt
BrowserExtensionReleaseVerifier
  -> CwsInstallIdentityReadback / WorkbenchPageSessionIssuer
  -> BrowserProcessSupervisor
  -> BrowserInfrastructureSupervisor
  -> TransportActor + TransportReducer
  -> TransportAuthenticator
  -> BrowserAuthorityIssuer
  -> Repair / Activation / Rollback owner
```

禁止：第二 Browser transport、Native Messaging/Native Host、第二 Workbench page channel、第二 Controller IPC、Playwright/CDP 公共旁路、AppleScript/JXA、系统鼠标键盘、clipboard、native picker、active-tab/current-page/first-page/URL-first fallback、业务模块自行重连、运行时 capability intersection、永久 legacy bridge。

## 2. Owner 与对象模型

唯一 owner：

| 责任 | owner |
|---|---|
| CWS release verify / installed readback / repair | `BrowserExtensionReleaseVerifier` |
| 专用 Chrome process/profile | `BrowserProcessSupervisor` |
| Workbench page channel/Port/control-state/reconnect | `BrowserInfrastructureSupervisor` + one `TransportActor/Reducer` |
| authority candidate / commit / revoke | `BrowserAuthorityIssuer` |
| 业务 authority admission | `BrowserAuthorityBroker` |
| exact target/document lease | `BrowserTargetLeaseManager` |
| command queue/permit/send/completion | `BrowserCommandActor` |
| extension command execution | MV3 `CommandRegistry` |
| CWS software bytes identity | `CwsExtensionReleaseIdentity` |
| exact runnable combination | `CwsExtensionReleaseIdentity` + current page-session policy |
| anti-rollback/revocation | `BrowserReleaseSecurityPolicy` |
| release evidence verdict input | `BrowserReleaseProofManifest` |
| cloud job/execution/lease/fence/business verdict | `xuanxue-web` AI production owner |
| browser dynamic proof consumption | xuanxue `DynamicProofController` through the one `AgentRuntimeReceipt` |

生产类型必须体现：

```ts
type BrowserAuthoritySlot =
  | { readonly kind: "ABSENT" }
  | { readonly kind: "PRESENT"; readonly authority: AuthenticatedBrowserAuthority };
```

禁止生产类型、标识符或正式 API：

```txt
UnauthenticatedBrowserSession
LocalBrowserSessionState
BrowserTargetSession
BrowserController.createTargetSession
BrowserStateSnapshot.transportReady
waitUntilReady
READY_COMPATIBLE
```

`BrowserAuthorityBroker` 是业务唯一 Browser 能力入口。业务不得持有 raw Supervisor、raw Transport、raw Controller socket、Native Port、Chrome raw ids 或可跨 authority epoch 长期复用的 target object。

## 3. Infrastructure Control State / Actor / Reducer

唯一控制面状态机：

```ts
type BrowserInfrastructureControlState =
  | { readonly kind: "OFFLINE" }
  | { readonly kind: "VERIFYING_INSTALL"; readonly attempt: number }
  | { readonly kind: "STARTING_CHROME"; readonly processEpoch: bigint }
  | { readonly kind: "BINDING_OWNER"; readonly supervisorEpoch: bigint }
  | { readonly kind: "CONNECTING_WORKBENCH_PAGE"; readonly connectionGeneration: bigint }
  | { readonly kind: "AUTHENTICATING_TRANSPORT"; readonly externalPortEpoch: bigint }
  | { readonly kind: "PROBING_CAPABILITIES"; readonly transcriptHash: string }
  | { readonly kind: "AUTHORITY_AVAILABLE"; readonly authorityRefHash: string; readonly releaseIdentityHash: string }
  | { readonly kind: "DRAINING"; readonly reason: string }
  | { readonly kind: "BACKOFF"; readonly attempt: number; readonly nextProbeAtMonotonicNs: bigint }
  | { readonly kind: "REPAIR_REQUIRED"; readonly code: BrowserInfrastructureErrorCode }
  | { readonly kind: "STOPPING" };
```

socket callback、Port callback、heartbeat、challenge response、command completion、timeout、process exit、activation/update request 只能投递 typed event；只有 `TransportActor/Reducer` 可以改变 control state、sequence、authority slot、current connection、reconnect schedule 或 shutdown。

每个 event 在任何副作用前至少验证：

```txt
releaseIdentityHash
profileEnrollmentHash
chromeProcessIncarnationHash
supervisorEpoch
controllerIncarnation
connectionGeneration
appServerEpoch
externalPortEpoch
authorityEpoch (post-auth only)
sourceChannelToken
```

## 4. Profile / Chrome Process / Managed Policy

生产必须使用获准专用 Browser Worker profile。`BrowserExtensionReleaseVerifier` 是唯一 enrollment/readback owner。Enrollment 至少绑定：

```txt
profileRef
userDataDir
profileDirectory
Chrome channel / executable
profile stable identity hash
extensionId
installed extension ID/version readback
CWS item/review receipt ref
page-origin policy hash
permission/host-permission policy hash
Workbench page-session issuer identity
```

`BrowserProcessSupervisor` 必须记录批准 Chrome process incarnation/start token/process tree。唯一 App Server 的 page-session issuer 必须绑定当前 enrollment、Chrome process 和安装的 extension identity；相同 extension ID 在错误 profile/process 或错误 Workbench origin 中仍不得签发 authority。

生产不允许 silent Default、`last_used` 猜测、个人日常 profile、复制 profile/cookie/password、两个 Worker 共用 profile/dataDir。测试例外必须由显式 test artifact/profile 隔离，production bundle 不得引用 fixture authority。

## 5. Transport Authentication / Authority Certificate

认证顺序固定为：

```txt
verify CWS release identity + release security policy
-> acquire exclusive page-channel owner lock
-> start/verify approved Chrome process and App Server page-session issuer
-> Workbench root page connects the fixed CWS MV3 external Port
-> MV3 validates sender URL, fixed port name and fresh page-session opening
-> ExtensionHello(extension id/version/release identity/source-channel token)
-> ControllerChallenge(controller nonce/incarnation/generation/release identity/transcript prefix)
-> ExtensionConfirmation(bind both nonces/Port/release identity)
-> WorkbenchPageAttestation(bind current grant/origin/profile/process/full transcript)
-> CapabilityProbe(command registry/permission/origin/framing)
-> AUTH_PROOF_COMMITTED
-> BrowserAuthorityIssuer.commit()
-> authority slot ABSENT -> PRESENT
```

握手任一步失败：authority 保持 ABSENT；整条 page/Port chain 关闭；不 mint target lease；不领取 Browser writer lane。

`BrowserAuthorityCertificateV1` 至少绑定：

```txt
authorityRef / authorityEpoch
releaseIdentityHash / releaseSecurityPolicyHash
profileEnrollmentHash / chromeProcessIncarnationHash
controllerIncarnationHash / connectionGeneration / appServerEpoch / externalPortEpoch
extensionId / extensionVersion / protocolRevision
capabilitySetHash / permissionPolicyHash / originPolicyHash / pageSessionGrantHash
livenessPolicyHash / commandAdmissionBudgetHash / artifactStreamBudgetHash
authTranscriptHash / keyEpoch / livenessLeaseEpoch
issuedAtMonotonicNs / issuerMac
```

Certificate 只存在内存，不跨进程恢复，不写 nonce/install secret/raw Chrome id。`commandFrameKey` 对一个 externalPortEpoch 不可变；禁止在线 rekey。

## 6. Liveness / Revoke / Recovery

机器合同默认：

```txt
heartbeatIntervalMs = 1000
softDrainAfterMs = 3500
hardExpiryMs = 5000
watchdogTickMaxMs = 250
maxAuthorityAgeMs = 8h
```

Heartbeat 必须由当前 frame key 认证，绑定 authority epoch、lease epoch、严格递增 sequence；它只能续租 PRESENT authority，永远不能 mint authority。

任一 page-session/Port/Controller/Chrome discontinuity、hard expiry、sleep/wake discontinuity、process/profile/policy/release identity 漂移发生时，第一同步动作必须是：

```txt
BrowserAuthorityIssuer.revokeCurrent(cause)
-> authority slot = ABSENT
-> cancel permits
-> invalidate all target/document leases
-> classify in-flight mutations
-> diagnostics / cleanup / reconnect
```

reconnect 的唯一 owner 是 `BrowserInfrastructureSupervisor`，采用固定 retry policy + bounded full jitter。Extension disconnect 只能报告关闭并触发一次 wake-up token；`chrome.alarms` 仅作 worker wake-up 补偿，不拥有退避或认证真相。

page-session 或 Controller channel 断开后必须关闭 external Port。禁止旧 page-session/Port rebind 新 Controller。

## 7. Controller Owner Lock / Stale Socket

本机进程先持有 process-lifetime exclusive `flock/fcntl` owner lock，再创建 page-session 记录。只有当前锁 owner 可以终结过期的内存 session；拿不到锁必须返回 `BROWSER_CONTROLLER_ALREADY_OWNED`，绝不抢占或复用别人的 grant。

Windows adapter 使用 named mutex 的等价语义。grant、URL 或页面本身都不是单独的认证凭证。

## 8. Authority Lease / Execution Fence / Target Lease

Browser-dependent execution 固定顺序：

```txt
read current cloud job
-> validate current device/job/execution lease + writer fence
-> acquire AuthenticatedBrowserAuthorityLease from Broker
-> claim bounded Browser writer lane
-> acquire exact BrowserTargetLease
-> execute governed commands
```

`BrowserAuthorityLease` 必须绑定当前 authority certificate 与 cloud execution binding；writer fence 失效时 lease 立即失效。

`BrowserTargetLease` 至少绑定：

```txt
leaseRef
authorityRef / authorityEpoch
ownerId
agentJobRefHash / agentExecutionRefHash
writerLeaseEpoch / writerFenceHash
targetRef / documentRef
originPolicyRef / capabilitySetHash
lifecycle
```

navigation committed/document generation change、debugger detach、target close、operator takeover、authority revoke、writer fence失效、release identity 或 page-session 变化均立即使 lease stale。新 authority 必须重新 acquire exact target/document；不得恢复旧 opaque refs。

生产禁止 `targetSessionsByOwner` 跨 authority epoch cache。

## 9. Command Registry / Permit / Actor / Admission Budget

生产 command 只能来自 versioned `CommandRegistry`；每项 capability 声明：

```txt
capabilityId + schema version
request/response schema
mutationClass
origin/scheme policy
payload/field limits
target/document requirement
execution fence requirement
browser-side postcondition
owner-side business postcondition
acceptance + real-page evidence
```

禁止 arbitrary `evaluate(script)`、remote code、`eval`、`new Function`、任意 expression contract。通用观察和 DOM 操作只能走声明式 `BrowserDomIntent`。

`BrowserCommandPermit` 至少绑定：

```txt
authorityRef / authorityEpoch / certificateHash / releaseIdentityHash
replyChannelToken
capabilityId
executionBindingHash
targetLeaseRef / documentRef
commandId / sequence / monotonic deadline
mutationClass
commandFrameMac
```

每条命令三次硬校验：Admission、Before Send、Completion；completion 必须回原 reply channel / source port token，永不读取“当前全局 Port”投递旧 completion。

`BrowserCommandAdmissionBudgetV1` 是唯一 queue/bytes/stream 预算，至少包含：

```txt
maxQueuedCommands
maxQueuedBytes
maxInflightObservations
maxInflightMutationsPerTarget = 1
maxArtifactStreams
maxArtifactBytes
fairnessQuantum
```

Deadline 包含排队时间。超限立即 `BROWSER_BACKPRESSURE`，禁止隐藏排队、无界 cache/stream、持有网站 writer lease无限等待。

## 10. Mutation Intent Journal / OUTCOME_UNKNOWN

所有 mutation 在发送前写 0600 append-only bounded journal：

```txt
PREPARED(commandId, authorityCertificateHash, executionFenceHash, mutationClass, payloadHash)
-> fsync
-> send exact frame
-> TERMINAL_SUCCESS | TERMINAL_FAILURE | OUTCOME_UNKNOWN
```

journal 不保存页面正文、输入文本、附件内容、nonce、secret。Controller restart 后无 terminal record 的 mutation 一律 `OUTCOME_UNKNOWN`，transport 永不自动 replay。只有业务 owner 通过真实 postcondition + `OutcomeResolutionReceipt` 可裁决后续恢复。

## 11. Workbench Page Framing / Artifact Stream / File Grant

控制帧在 Workbench page 与 MV3 external Port 之间使用 canonical UTF-8 JSON schema；页面与唯一 App Server 之间只通过三个固定同源 HTTP routes 承载同一 schema。没有 native-endian framing、Native Messaging outer frame 或 native process。

内部预算：

```txt
Workbench page -> Extension control <= 256 KiB
Extension -> Workbench page control <= 256 KiB
Extension -> Workbench page artifact chunk <= 4 MiB
Workbench page -> Extension artifact payload = forbidden
```

控制帧与 artifact stream 分离，两端常量必须由同一 canonical protocol schema/codegen 生成。页面只能 transfer opaque frame；不得解读或改写 permit、target、command payload。

业务协议不得接受 raw path。唯一文件合同 `BrowserFileArtifactGrantV1` 至少绑定：

```txt
grantRef / authorityEpoch / executionFenceHash
approvedRootHash / canonicalRealpathHash
deviceIdHash / inodeHash / byteLength / contentHash
expiresAtMonotonicNs
```

Browser owner 在 grant 签发与命令发送前分别 `open/fstat/hash` readback，拒绝 symlink/root escape/inode-size-hash drift/expiry。Wire 只传 opaque grant/artifact refs，不传 raw/resolved path。artifact stream 使用 owner-only 0600 staging、content hash、total/concurrency/TTL budget、atomic complete marker、确定性销毁。

## 12. MV3 Extension / Workbench Page

Extension 顶层同步注册 `runtime.onConnectExternal` listener；listener 只能先以 URL 语义校验精确 sender URL 与固定 port name。page-session grant 必须由该 Port 的第一帧交给 actor，并在 actor 获得 authority、接受命令或产生任何浏览器副作用之前校验。每个被精确 sender URL、固定 port name 和 page-session transcript 接受的 Port 只有一个不可变 `ExtensionExternalPortActor`。Actor 拥有 port epoch、handshake、authority binding、sequence、bounded receipt cache、liveness；Port 断开后内存真相全部销毁。异步 completion 只能投递原 actor 原 port。

Workbench page 只负责 browser extension external Port 与固定同源 HTTP route 的方向预算和 byte forwarding。它不保存 target、command receipt、业务队列、evidence、secret 或 release truth；Browser owner channel 断开立即使 page session 无效。`runtime.connectNative`、Native Messaging manifest 与 Rust Host 在生产源码中必须不存在。

## 13. Release Identity / Activation / Anti-Rollback

发布身份永久分层：

1. `CwsExtensionReleaseIdentityV1`：CWS item ID、extension ID/version、审核通过 receipt、上传包/source hash、manifest permission/origin policy hash、protocol/registry hashes；
2. `BrowserReleaseSecurityPolicyV1`：monotonic releaseSequence、minimumAccepted、revoked release identity、current/previous protocol compatibility window；
3. `CwsExtensionReleaseProofV1`：candidate/governance/audit/installed identity readback/real-Chrome/soak/xuanxue cross-repo evidence binding，不改变 extension bytes。

Runtime 不做 capability intersection，只接受一个已安装、未撤销的 CWS release identity 和一个 current page-session policy。

CWS 更新采用有限 current + previous protocol compatibility window；同一时刻只接受一个 installed release identity。回滚只切 Browser owner 的最低接受序列和协议兼容策略，不要求把 CWS 已安装扩展降级。previous 有明确截止与删除门，被 revocation 命中的 release identity 永不因 previous slot 复活。

Production CWS item/review receipt、extension ID/version、上传包/source hash、permission/origin freeze 与 installed identity readback 均是发布硬门。没有 Apple Developer Program、Developer ID Application、签名或公证门。

核心 CWS package/source 使用 pinned build-once；两个独立 builder 必须复现同一 source/package hash，proof 后禁止同版本重建不同字节。

## 14. Browser Worker HA / Handover

网站请求只持久化 job，不同步依赖单机插件。生产至少一 active + 一 hot-standby Browser Worker，两个 Worker 使用独立机器身份/dataDir/profile/enrollment；每个 Worker 各自仍只有本法规定的一条 Browser 链。

系统唯一选主真相是 xuanxue 已存在的数据库 job/execution lease/fence；Browser 层不得另建 election owner。一个 browser-required execution 同一时刻最多一个 Worker 持当前 writer fence。standby 无 writer fence 时禁止触碰该 job/provider conversation。

Failover：旧 writer lease失效 -> unresolved mutation裁决 -> sealed business checkpoint -> new execution fence -> new authority lease -> fresh target/document -> new authority window。`OUTCOME_UNKNOWN` 未被业务 owner真实裁决前禁止 complete 或隐式重放。

## 15. Cross-Repo Browser Proof

AGENT Browser 只证明低层基础设施身份和动作，不证明报告/上传/翻译/业务成功。

xuanxue 的唯一 `AgentRuntimeReceiptV2` 对 browser-required job 必须内嵌 `AgentBrowserAuthorityProofV2`，它由有序 `AgentBrowserAuthorityWindowProofV2[]` 组成；每 window 绑定 worker fence、authority certificate、profile/process、CWS release identity/security policy、page-session/auth transcript/liveness、generation/port/capability、command sequence 与 action receipt subtree。Window handover 之间不得有浏览器动作。

不得创建第二 AGENT channel、第二 runtime receipt owner 或第二 Dynamic Proof verdict。

## 16. Health / Errors / Metrics

生产 health component 只允许：

```txt
browserInfrastructure
browserAuthority
```

禁止 `browserSession`、`transportReady`、`session not authenticated` / `wait for authentication` 生产语义。

Browser infrastructure error codes 至少覆盖 install/host/origin/extension/tuple/transcript/capability/profile/process/policy/liveness/worker-fence/dual-active/backpressure/file-grant/rollback/revocation/permit/target/document/devtools/outcome-unknown/repair。

绝对零指标：

```txt
unauthenticated_browser_authority_issued_total
command_without_valid_authority_total
stale_event_side_effect_total
old_completion_to_new_port_total
non_idempotent_auto_replay_total
wrong_profile_process_authority_issued_total
command_after_liveness_expiry_total
browser_action_during_authority_absence_total
dual_active_browser_worker_total
revoked_or_rollback_blocked_tuple_activated_total
browser_admission_budget_violation_total
```

运行 SLO：supported-runtime-window authority availability >=99.99%；环境齐备后 authority issuance p99 <=5s；recoverable chain rebuild p99 <=10s；revoke->ABSENT p99 <=10ms；unbounded queue/cache/stream=0。

## 17. 法条

```apex-law
{"lawId":"APEX-LOCAL-BROWSER-001-V3","status":"active","tier":"P0","capabilityDomain":"local-browser-session","enforcementMode":"machine-blocking","evidenceMode":"law+blueprint+ast+model+real-chrome","summary":"Every page action is admitted only through an execution-bound authenticated authority lease and exact target/document lease; the fixed CWS-installed MV3 plus its one Workbench page channel is the only Browser side-effect path.","required":["BrowserAuthorityBroker is the only business Browser entry","every BrowserTargetLease is authority-epoch and execution-fence bound","navigation/lifecycle/authority/fence changes invalidate prior target/document refs","background exact-target work preserves non-target foreground state"],"forbidden":["BrowserTargetSession","BrowserController.createTargetSession","active-tab/current-page/URL-first fallback","raw Chrome ids outside Browser owner","second browser transport or OS interaction fallback","Native Messaging production chain"],"clauses":[{"clauseId":"apex-local-browser-001-v3-exact-authority-lease","statement":"All page actions require a current authority lease plus exact target/document lease and stale leases cannot produce side effects.","evidenceMode":"model+acceptance+real-chrome","ownerDomain":"local-browser-session"}]}
```

```apex-law
{"lawId":"APEX-LOCAL-BROWSER-002-V3","status":"active","tier":"P0","capabilityDomain":"local-browser-session","enforcementMode":"machine-blocking","evidenceMode":"law+blueprint+ast+model+real-chrome","summary":"Within each Browser Worker, Browser command authority does not exist before the CWS identity, exact Workbench page session and authentication proof are atomically committed; any discontinuity revokes before every other side effect.","codePurityLiveness":{"auditInspectionFiles":["src/lib/browser/chrome-extension/authenticated-heartbeat.ts"]},"required":["data plane is only ABSENT or PRESENT","one TransportActor/Reducer owns control mutation","BrowserAuthorityIssuer is the only mint/revoke owner","authenticated heartbeat renews only PRESENT authority","wrong extension/page-session/profile/process/policy/tree or liveness expiry keeps authority ABSENT","revoke occurs before callbacks cleanup diagnostics or reconnect"],"forbidden":["UnauthenticatedBrowserSession","transportReady","pre-auth command surface","fire-and-forget startup","page session rebind","heartbeat minting authority","online Port rekey"],"clauses":[{"clauseId":"apex-local-browser-002-v3-authority-atomicity","statement":"CWS identity plus the exact Workbench page session proof are required for the only ABSENT-to-PRESENT transition; revoke is the first discontinuity side effect.","evidenceMode":"model+acceptance+real-chrome","ownerDomain":"local-browser-session"}]}
```

```apex-law
{"lawId":"APEX-LOCAL-BROWSER-003-V3","status":"active","tier":"P0","capabilityDomain":"local-browser-session","enforcementMode":"machine-blocking","evidenceMode":"law+blueprint+ast+acceptance+real-chrome","summary":"The fixed-id CWS-installed MV3 extension plus one exact local Workbench page external Port is the only production page-action chain; each Port has one immutable ExtensionExternalPortActor and replies never cross port epochs.","codePurityLiveness":{"externalEntryFiles":["src/lib/browser/chrome-extension/service-worker.ts","src/lib/browser/protocol/generated/browser-protocol.generated.ts"],"externalEntryExports":[{"filePath":"src/lib/browser/protocol/generated/browser-protocol.generated.ts","exportName":"BROWSER_PROTOCOL_REVISION"},{"filePath":"src/lib/browser/protocol/generated/browser-protocol.generated.ts","exportName":"BROWSER_ARTIFACT_CHUNK_MAX_BYTES"},{"filePath":"src/lib/browser/protocol/generated/browser-protocol.generated.ts","exportName":"BROWSER_COMMAND_DEFAULT_DEADLINE_MS"},{"filePath":"src/lib/browser/protocol/generated/browser-protocol.generated.ts","exportName":"BROWSER_PROTOCOL_SCHEMA_SHA256"},{"filePath":"src/lib/browser/protocol/generated/browser-protocol.generated.ts","exportName":"BrowserErrorCode"},{"filePath":"src/lib/browser/protocol/generated/browser-protocol.generated.ts","exportName":"isBrowserCapabilityId"}]},"required":["one ExtensionExternalPortActor per accepted Port","exact 127.0.0.1 sender URL plus short-lived page-session grant","original source/reply channel captured for async completion","production fixture authority is physically unreachable","the exact MV3 manifest service worker is the only law-owned external Browser extension entry"],"forbidden":["global cross-port auth truth","old completion sent to new Port","Native Messaging permission or connectNative","native-messaging-host production path","second external page channel","Playwright/JXA/AppleScript/system input fallback","load-unpacked production chain","package-script or inspector-local liveness substitute for the MV3 manifest entry"],"clauses":[{"clauseId":"apex-local-browser-003-v3-single-chain","statement":"One authenticated CWS MV3 to exact Workbench-page channel owns every production browser side effect; Native Host and old-port work are physically unreachable.","evidenceMode":"model+acceptance+real-chrome","ownerDomain":"local-browser-session"}]}
```

```apex-law
{"lawId":"APEX-LOCAL-BROWSER-004-V3","status":"active","tier":"P0","capabilityDomain":"local-browser-session","enforcementMode":"machine-blocking","evidenceMode":"law+schema+ast+fuzz+real-chrome","summary":"Browser commands are versioned governed capabilities with bounded admission and declarative DOM intent; the Workbench page may forward but never create commands, permits, targets, selectors or authority.","required":["canonical protocol/schema/codegen is the only wire contract","each command binds capability execution fence target/document permit and deadline","control frames are <=256KiB and artifact chunks <=4MiB","mutation intent journal fsyncs PREPARED before send","file actions use TTL authority/fence-bound grants and content-addressed streams"],"forbidden":["evaluate(script)","evaluate_target arbitrary expression","eval/new Function/remote code","raw/resolved path in production wire","unbounded queue/cache/artifact stream","automatic non-idempotent replay","Workbench-page generated command or permit"],"clauses":[{"clauseId":"apex-local-browser-004-v3-governed-command-plane","statement":"Only schema-bound capability commands admitted by the current authority/execution/target fences may execute; the page channel only carries those frames.","evidenceMode":"model+acceptance+real-chrome","ownerDomain":"local-browser-session"}]}
```

```apex-law
{"lawId":"APEX-LOCAL-BROWSER-005-V2","status":"active","tier":"P0","capabilityDomain":"local-browser-session","enforcementMode":"machine-blocking","evidenceMode":"law+artifact+readback+real-chrome+soak","summary":"Production browser identity is the CWS-reviewed fixed-id MV3 release plus its immutable source/package evidence, permission freeze, installed identity readback and release proof; no native executable signing or Apple notarization is a production condition.","required":["CwsExtensionReleaseIdentity ReleaseSecurityPolicy and ReleaseProofManifest are distinct","CWS item ID extension ID version source/package hash and permission/origin policy hash are bound","minimum release sequence and revocation are monotonic hard gates","CWS review approval and installed identity readback are mandatory","current+previous protocol compatibility is bounded without a second active channel","proof is bound to the exact reviewed extension version"],"forbidden":["capability intersection READY_COMPATIBLE","rollback below minimum sequence","revoked release identity revival","proof-after-rebuild bytes","Native Host signature/notarization or Apple Developer Program production gate","CWS downgrade required for local rollback","load-unpacked production release"],"clauses":[{"clauseId":"apex-local-browser-005-v2-release-identity","statement":"Only the exact CWS-reviewed installed extension identity plus the exact page-origin policy and release proof may mint Browser authority; Apple Developer Program membership is not required.","evidenceMode":"artifact+real-chrome","ownerDomain":"local-browser-session"}]}
```

```apex-law
{"lawId":"APEX-LOCAL-BROWSER-006-V2","status":"active","tier":"P0","capabilityDomain":"local-browser-session","enforcementMode":"machine-blocking","evidenceMode":"law+cross-repo-contract+runtime+fault-injection","summary":"For one browser-required execution at most one Browser Worker may hold the current xuanxue writer fence; failover starts only from a sealed checkpoint with a new fence and every browser action is provable inside an ordered CWS-extension authority window in the single AgentRuntimeReceipt.","required":["xuanxue database lease/fence is the only election truth","active and standby use independent profiles and identities","handover waits for old fence invalidation and sealed checkpoint","no browser action occurs between authority windows","unresolved OUTCOME_UNKNOWN blocks complete","AgentRuntimeReceipt remains the only runtime receipt owner"],"forbidden":["second Browser election owner","dual active execution","profile copy between workers","implicit mutation replay on failover","second Agent runtime receipt or dynamic verdict","Native Host failover channel"],"clauses":[{"clauseId":"apex-local-browser-006-v2-cross-repo-fence-proof","statement":"Execution fencing, safe handover and ordered CWS-extension authority-window proof jointly prevent dual writers and unprovable browser actions.","evidenceMode":"model+acceptance+real-chrome","ownerDomain":"local-browser-session"}]}
```

## 18. Machine-blocking check IDs

Browser law coverage must be explicit; the following IDs are independently required and may not be replaced by one broad owner assertion:

```txt
browser-auth/no-unauth-session-type
browser-auth/no-transport-ready-boolean
browser-auth/no-preauth-command-surface
browser-auth/no-fire-and-forget-startup
browser-auth/authority-mint-only-after-proof
browser-auth/revoke-before-side-effects
browser-channel/no-page-session-rebind
browser-channel/original-reply-channel
browser-release/cws-release-identity
browser-auth/authority-liveness-lease
browser-auth/no-command-after-liveness-expiry
browser-auth/heartbeat-cannot-mint-authority
browser-auth/production-fixture-zero
browser-profile/dedicated-production-profile
browser-profile/installed-extension-readback
browser-profile/exact-workbench-origin-readback
browser-release/cws-identity-proof-separation
browser-release/cws-review-and-installed-readback
browser-release/anti-rollback-and-revocation
browser-release/no-apple-signing-gate
browser-channel/no-native-host-surface
browser-cross-repo/authority-proof-v2
browser-cross-repo/ordered-authority-window-chain
browser-command/bounded-admission-budget
browser-file/artifact-grant-no-raw-path
browser-old-path/retired-zero
```

所有 P0 check 必须有独立 source evidence、negative/property/mutant 或 runtime evidence。Static Audit 不得冒充真实 Chrome、CWS、OS 更新、HA failover 或 soak。

## 19. 生产封口

任何以下情况继续 BLOCKED：任一 001～006 法条未绑定独立 check、旧 Session/evaluate/raw-path 调用面仍可达、cross-repo Browser Proof V2 未闭合、发布 identity/tuple/security policy 不同源、wrong profile/process 能 mint、dual active 可发生、真实 Chrome故障矩阵或 required soak 不完整、branch protection/required checks/readback 缺失。

只有所有硬门、同 candidate artifact/tuple/proof、真实环境证据和独立审计同时闭合，才允许 `PRODUCTION_APPROVED`。
