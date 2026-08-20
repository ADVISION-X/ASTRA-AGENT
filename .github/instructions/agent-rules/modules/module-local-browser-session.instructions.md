---
name: "GrassEye Browser Authority Infrastructure"
description: "Governs the single production Chrome authority chain, execution-bound leases, exact target/document identity, Native Messaging transport, managed profile/process identity, release activation, HA handover and cross-repo browser proof."
applyTo: "src/lib/browser/**,src/lib/local-runtime/workbench-browser-authority-support.ts,src/lib/local-runtime/workbench-assembly.ts,src/lib/local-runtime/workbench-status.ts,src/capabilities/**,src/plugins/**,scripts/audit/domains/local-browser-session/**,scripts/acceptance/local-browser-*.ts,.github/workflows/browser-*.yml"
---

# GrassEye Browser Authority Infrastructure｜终态法案

status: active  
version: 2026-08-20.1  
capabilityDomain: `local-browser-session`  
constitutional objective: **生产世界中未认证 Browser session / 半成品 BrowserController / 长期 TargetSession 不可表示。**

本文件原位替代 2026-08-18.5 过渡版本。与本文件冲突的旧法条、旧施工图、旧 API、旧 audit 绑定和旧 generated PASS 均无效；必须迁移引用后物理退出，不得保留兼容桥或第二真相。

## 0. 生产信任边界与唯一语义

本文的“永远禁止”只在以下生产根信任成立时作机器可验证承诺：

- 运行字节属于已签名、未吊销的 `BrowserArtifactSetIdentity`；
- 当前 `BrowserActivationTuple` 精确签名、未过期、未被撤销且 release sequence 不低于本机 minimum accepted sequence；
- OS/kernel/credential store/release signing root 未被判定失陷；
- Browser Worker、Chrome process、专用 profile、managed policy 与 installed extension tree 完整性读回通过；
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
                              -> AuthenticatedControllerHostChannel
                                  -> one signed Rust Native Host process
                                      -> one Chrome Native Messaging Port
                                          -> fixed-id MV3 NativePortActor
                                              -> governed CommandRegistry
                                                  -> chrome.debugger
                                                      -> exact target / exact document
```

控制面：

```txt
browserctl
  -> InstallVerifier / ManagedPolicyReadback
  -> BrowserProcessSupervisor
  -> BrowserInfrastructureSupervisor
  -> TransportActor + TransportReducer
  -> TransportAuthenticator
  -> BrowserAuthorityIssuer
  -> Repair / Activation / Rollback owner
```

禁止：第二 Browser transport、第二 Native Host、第二 Controller IPC、Playwright/CDP 公共旁路、AppleScript/JXA、系统鼠标键盘、clipboard、native picker、active-tab/current-page/first-page/URL-first fallback、业务模块自行重连、运行时 capability intersection、永久 legacy bridge。

## 2. Owner 与对象模型

唯一 owner：

| 责任 | owner |
|---|---|
| install / verify / doctor / repair / activate / rollback | `browserctl` |
| 专用 Chrome process/profile | `BrowserProcessSupervisor` |
| socket/Host/Port/control-state/reconnect | `BrowserInfrastructureSupervisor` + one `TransportActor/Reducer` |
| authority candidate / commit / revoke | `BrowserAuthorityIssuer` |
| 业务 authority admission | `BrowserAuthorityBroker` |
| exact target/document lease | `BrowserTargetLeaseManager` |
| command queue/permit/send/completion | `BrowserCommandActor` |
| extension command execution | MV3 `CommandRegistry` |
| software bytes identity | `BrowserArtifactSetIdentity` |
| exact runnable combination | `BrowserActivationTuple` |
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
  | { readonly kind: "CONNECTING_HOST"; readonly connectionGeneration: bigint }
  | { readonly kind: "AUTHENTICATING_TRANSPORT"; readonly nativePortEpoch: bigint }
  | { readonly kind: "PROBING_CAPABILITIES"; readonly transcriptHash: string }
  | { readonly kind: "AUTHORITY_AVAILABLE"; readonly authorityRefHash: string; readonly activationTupleHash: string }
  | { readonly kind: "DRAINING"; readonly reason: string }
  | { readonly kind: "BACKOFF"; readonly attempt: number; readonly nextProbeAtMonotonicNs: bigint }
  | { readonly kind: "REPAIR_REQUIRED"; readonly code: BrowserInfrastructureErrorCode }
  | { readonly kind: "STOPPING" };
```

socket callback、Port callback、heartbeat、challenge response、command completion、timeout、process exit、activation/update request 只能投递 typed event；只有 `TransportActor/Reducer` 可以改变 control state、sequence、authority slot、current connection、reconnect schedule 或 shutdown。

每个 event 在任何副作用前至少验证：

```txt
artifactSetHash
activationTupleHash
profileEnrollmentHash
chromeProcessIncarnationHash
supervisorEpoch
controllerIncarnation
connectionGeneration
hostProcessEpoch
nativePortEpoch
authorityEpoch (post-auth only)
sourceChannelToken
```

## 4. Profile / Chrome Process / Managed Policy

生产必须使用受管专用 Browser Worker profile。`browserctl enroll-profile` 是唯一 enrollment owner。Enrollment 至少绑定：

```txt
profileRef
userDataDir
profileDirectory
Chrome channel / executable
profile stable identity hash
extensionId
installed extension tree digest
ExtensionSettings.force_installed readback
updateUrl readback
permission/host-permission policy hash
Controller install identity
```

`BrowserProcessSupervisor` 必须记录批准 Chrome process incarnation/start token/process tree。Native Host 每次启动都必须 attestation 自身 parent Chrome process incarnation，并绑定 enrollment。相同 extension ID 在错误 profile/process 启动时仍不得签发 authority。

生产不允许 silent Default、`last_used` 猜测、个人日常 profile、复制 profile/cookie/password、两个 Worker 共用 profile/dataDir。测试例外必须由显式 test artifact/profile 隔离，production bundle 不得引用 fixture authority。

## 5. Transport Authentication / Authority Certificate

认证顺序固定为：

```txt
verify installed artifact + exact active tuple + release security policy
-> acquire exclusive controller owner lock
-> start/verify approved Chrome process
-> Chrome starts fresh signed Host for one Native Port
-> Host validates caller origin + process/profile attestation
-> Host and Controller authenticate local IPC identity
-> ExtensionHello(extension id/version/artifact digest/port epoch/supported tuple ids)
-> ControllerChallenge(controller nonce/incarnation/generation/exact tuple/transcript prefix)
-> ExtensionConfirmation(bind both nonces/port/tuple)
-> HostAttestation(bind caller/host/process/profile/IPC/full transcript)
-> CapabilityProbe(command registry/permission/origin/framing)
-> AUTH_PROOF_COMMITTED
-> BrowserAuthorityIssuer.commit()
-> authority slot ABSENT -> PRESENT
```

握手任一步失败：authority 保持 ABSENT；整条 Host/Port chain 关闭；不 mint target lease；不领取 Browser writer lane。

`BrowserAuthorityCertificateV1` 至少绑定：

```txt
authorityRef / authorityEpoch
artifactSetHash / activationTupleHash / releaseSecurityPolicyHash
profileEnrollmentHash / chromeProcessIncarnationHash
controllerIncarnationHash / connectionGeneration / hostProcessEpoch / nativePortEpoch
extensionId / extensionVersion / protocolRevision
capabilitySetHash / permissionPolicyHash / originPolicyHash
livenessPolicyHash / commandAdmissionBudgetHash / artifactStreamBudgetHash
authTranscriptHash / keyEpoch / livenessLeaseEpoch
issuedAtMonotonicNs / issuerMac
```

Certificate 只存在内存，不跨进程恢复，不写 nonce/install secret/raw Chrome id。`commandFrameKey` 对一个 nativePortEpoch 不可变；禁止在线 rekey。

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

任一 Host/Port/Controller/Chrome discontinuity、hard expiry、sleep/wake discontinuity、process/profile/policy/tree/tuple 漂移发生时，第一同步动作必须是：

```txt
BrowserAuthorityIssuer.revokeCurrent(cause)
-> authority slot = ABSENT
-> cancel permits
-> invalidate all target/document leases
-> classify in-flight mutations
-> diagnostics / cleanup / reconnect
```

reconnect 的唯一 owner 是 `BrowserInfrastructureSupervisor`，采用 signed retry policy + bounded full jitter。Extension disconnect 只能报告关闭并触发一次 wake-up token；`chrome.alarms` 仅作 worker wake-up 补偿，不拥有退避或认证真相。

Controller IPC 断开后 Host 进程必须退出并关闭 Native Port。禁止旧 Host/Port rebind 新 Controller。

## 7. Controller Owner Lock / Stale Socket

Unix/macOS：先持有 process-lifetime exclusive `flock/fcntl` owner lock，再检查 socket。只有当前进程拿到 owner lock，且 inode/path/uid/mode 证明 endpoint stale 时才允许删除。拿不到锁必须返回 `BROWSER_CONTROLLER_ALREADY_OWNED`，绝不 unlink。

Windows adapter 使用 named mutex + named pipe ACL 的等价语义。socket 文件本身不是认证凭证。

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

navigation committed/document generation change、debugger detach、target close、operator takeover、authority revoke、writer fence失效、activation tuple变化均立即使 lease stale。新 authority 必须重新 acquire exact target/document；不得恢复旧 opaque refs。

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
authorityRef / authorityEpoch / certificateHash / activationTupleHash
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

## 11. Native Messaging Framing / Artifact Stream / File Grant

Chrome outer frame 固定 4-byte unsigned native-endian length + UTF-8 JSON。

内部预算：

```txt
Host -> Extension control <= 256 KiB
Extension -> Host control <= 256 KiB
Extension -> Host artifact chunk <= 4 MiB
Host -> Extension artifact payload = forbidden
```

控制帧与 artifact stream 分离，三端常量必须由同一 canonical protocol schema/codegen 生成。

业务协议不得接受 raw path。唯一文件合同 `BrowserFileArtifactGrantV1` 至少绑定：

```txt
grantRef / authorityEpoch / executionFenceHash
approvedRootHash / canonicalRealpathHash
deviceIdHash / inodeHash / byteLength / contentHash
expiresAtMonotonicNs
```

Controller 在 grant 签发与命令发送前分别 `open/fstat/hash` readback，拒绝 symlink/root escape/inode-size-hash drift/expiry。Wire 只传 opaque grant/artifact refs，不传 raw/resolved path。artifact stream 使用 owner-only 0600 staging、content hash、total/concurrency/TTL budget、atomic complete marker、确定性销毁。

## 12. MV3 Extension / Rust Host

Extension 顶层同步注册 listener；每 Port 一个不可变 `NativePortActor`。Actor 拥有 port epoch、handshake、authority binding、sequence、bounded receipt cache、liveness；Port 断开后内存真相全部销毁。异步 completion 只能投递原 actor 原 port。

Rust Host 必须自包含、签名/公证；只负责 Native Messaging framing、方向预算、caller/profile/process attestation、authenticated Controller IPC、bounded diagnostics 和 byte forwarding。Host 不保存 target、command receipt、业务队列、evidence 或 secret；Controller IPC 断开立即退出。

## 13. Release Identity / Activation / Anti-Rollback

发布身份永久分层：

1. `BrowserArtifactSetIdentityV1`：软件字节、签名、公证、protocol/registry/policy hashes、toolchain/SBOM/provenance；
2. `BrowserActivationTupleV1`：Controller/Host/Extension exact runnable combination + capability/policy/budget + Chrome/platform range；
3. `BrowserReleaseSecurityPolicyV1`：monotonic releaseSequence、minimumAccepted、revoked artifact/tuple、current/previous bounded window；
4. `BrowserReleaseProofManifestV1`：candidate/governance/audit/real-Chrome/soak/xuanxue cross-repo evidence binding，不改变软件字节。

Runtime 不做 capability intersection，只选择一个签名 exact tuple。

CWS 更新采用有限 current + previous dual-tuple activation window；N+1 extension 可临时同时理解 N/N+1 tuple，但同一时刻只激活一个。回滚切 activation tuple，不依赖把 Chrome 已安装 extension 立即降级。previous 有明确截止与删除门，被 revocation 命中的 artifact/tuple 永不因 previous slot 复活。

Production `extensionVerifiedCrxHash` 不得为 null；Verified CRX Uploads、publisher 强认证/最小成员、permission freeze、managed policy readback 均是发布硬门。

核心 Host/launcher/extension 使用 hermetic/pinned build-once；两个独立 builder 必须复现相同 hash，proof 后禁止同版本重建不同字节。

## 14. Browser Worker HA / Handover

网站请求只持久化 job，不同步依赖单机插件。生产至少一 active + 一 hot-standby Browser Worker，两个 Worker 使用独立机器身份/dataDir/profile/enrollment；每个 Worker 各自仍只有本法规定的一条 Browser 链。

系统唯一选主真相是 xuanxue 已存在的数据库 job/execution lease/fence；Browser 层不得另建 election owner。一个 browser-required execution 同一时刻最多一个 Worker 持当前 writer fence。standby 无 writer fence 时禁止触碰该 job/provider conversation。

Failover：旧 writer lease失效 -> unresolved mutation裁决 -> sealed business checkpoint -> new execution fence -> new authority lease -> fresh target/document -> new authority window。`OUTCOME_UNKNOWN` 未被业务 owner真实裁决前禁止 complete 或隐式重放。

## 15. Cross-Repo Browser Proof

AGENT Browser 只证明低层基础设施身份和动作，不证明报告/上传/翻译/业务成功。

xuanxue 的唯一 `AgentRuntimeReceiptV2` 对 browser-required job 必须内嵌 `AgentBrowserAuthorityProofV2`，它由有序 `AgentBrowserAuthorityWindowProofV2[]` 组成；每 window 绑定 worker fence、authority certificate、profile/process、artifact/tuple/security policy、auth transcript/liveness、generation/port/capability、command sequence 与 action receipt subtree。Window handover 之间不得有浏览器动作。

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
{"lawId":"APEX-LOCAL-BROWSER-001-V2","status":"active","tier":"P0","capabilityDomain":"local-browser-session","enforcementMode":"machine-blocking","evidenceMode":"law+blueprint+ast+model+real-chrome","summary":"Every page action is admitted only through an execution-bound authenticated authority lease and exact target/document lease; foreground identity, raw Chrome identity leakage and a second browser path are impossible.","required":["BrowserAuthorityBroker is the only business Browser entry","every BrowserTargetLease is authority-epoch and execution-fence bound","navigation/lifecycle/authority/fence changes invalidate prior target/document refs","background exact-target work preserves non-target foreground state"],"forbidden":["BrowserTargetSession","BrowserController.createTargetSession","active-tab/current-page/URL-first fallback","raw Chrome ids outside Browser owner","second browser transport or OS interaction fallback"],"clauses":[{"clauseId":"apex-local-browser-001-v2-exact-authority-lease","statement":"All page actions require a current authority lease plus exact target/document lease and stale leases cannot produce side effects.","evidenceMode":"model+acceptance+real-chrome","ownerDomain":"local-browser-session"}]}
```

```apex-law
{"lawId":"APEX-LOCAL-BROWSER-002-V2","status":"active","tier":"P0","capabilityDomain":"local-browser-session","enforcementMode":"machine-blocking","evidenceMode":"law+blueprint+ast+model+real-chrome","summary":"Within each Browser Worker, Browser command authority does not exist before authentication proof is atomically committed; any discontinuity revokes before every other side effect.","required":["data plane is only ABSENT or PRESENT","one TransportActor/Reducer owns control mutation","BrowserAuthorityIssuer is the only mint/revoke owner","authenticated heartbeat renews only PRESENT authority","wrong profile/process/policy/tree or liveness expiry keeps authority ABSENT","revoke occurs before callbacks cleanup diagnostics or reconnect"],"forbidden":["UnauthenticatedBrowserSession","transportReady","pre-auth command surface","fire-and-forget startup","Host controller rebind","heartbeat minting authority","online Port rekey"],"clauses":[{"clauseId":"apex-local-browser-002-v2-authority-atomicity","statement":"Authentication proof commit is the only ABSENT-to-PRESENT transition and revoke is the first discontinuity side effect.","evidenceMode":"model+acceptance+real-chrome","ownerDomain":"local-browser-session"}]}
```

```apex-law
{"lawId":"APEX-LOCAL-BROWSER-003-V2","status":"active","tier":"P0","capabilityDomain":"local-browser-session","enforcementMode":"machine-blocking","evidenceMode":"law+blueprint+ast+acceptance+real-chrome","summary":"The fixed-id MV3 extension plus one self-contained Rust Native Host is the only production page-action chain; each Native Port has one immutable actor and replies never cross port epochs.","required":["one NativePortActor per Port","original source/reply channel captured for async completion","Controller IPC discontinuity terminates Host and Port","production fixture authority is physically unreachable"],"forbidden":["global cross-port auth truth","old completion sent to new Port","second Native Host","Playwright/JXA/AppleScript/system input fallback","load-unpacked production chain"],"clauses":[{"clauseId":"apex-local-browser-003-v2-single-chain","statement":"One authenticated Native Messaging chain owns every production browser side effect and old-port work cannot enter the current chain.","evidenceMode":"model+acceptance+real-chrome","ownerDomain":"local-browser-session"}]}
```

```apex-law
{"lawId":"APEX-LOCAL-BROWSER-004-V2","status":"active","tier":"P0","capabilityDomain":"local-browser-session","enforcementMode":"machine-blocking","evidenceMode":"law+schema+ast+fuzz+real-chrome","summary":"Browser commands are versioned governed capabilities with bounded admission and declarative DOM intent; arbitrary evaluation, raw file paths and unbounded queues or streams do not exist in production.","required":["canonical protocol/schema/codegen is the only wire contract","each command binds capability execution fence target/document permit and deadline","control frames are <=256KiB and artifact chunks <=4MiB","mutation intent journal fsyncs PREPARED before send","file actions use TTL authority/fence-bound grants and content-addressed streams"],"forbidden":["evaluate(script)","evaluate_target arbitrary expression","eval/new Function/remote code","raw/resolved path in production wire","unbounded queue/cache/artifact stream","automatic non-idempotent replay"],"clauses":[{"clauseId":"apex-local-browser-004-v2-governed-command-plane","statement":"Only schema-bound capability commands admitted by the current authority/execution/target fences may execute.","evidenceMode":"model+acceptance+real-chrome","ownerDomain":"local-browser-session"}]}
```

```apex-law
{"lawId":"APEX-LOCAL-BROWSER-005-V1","status":"active","tier":"P0","capabilityDomain":"local-browser-session","enforcementMode":"machine-blocking","evidenceMode":"law+artifact+signature+readback+real-chrome+soak","summary":"Production browser bytes, exact activation, anti-rollback policy and release proof are separate signed identities; a release is usable only when installed bytes/profile/policy/Chrome identity and the exact tuple all read back correctly.","required":["ArtifactSetIdentity ActivationTuple ReleaseSecurityPolicy and ReleaseProofManifest are distinct","minimum release sequence and revocation are monotonic hard gates","Verified CRX hash is non-null in production","current+previous activation window is bounded","core artifacts are hermetic build-once and reproducible by two builders","owner lock and installed identity readback are mandatory"],"forbidden":["capability intersection READY_COMPATIBLE","rollback below minimum sequence","revoked tuple revival","proof-after-rebuild bytes","unsigned/unnotarized production Host","CWS downgrade required for local rollback"],"clauses":[{"clauseId":"apex-local-browser-005-v1-release-identity","statement":"Only one signed exact activation over verified immutable bytes may mint Browser authority.","evidenceMode":"artifact+real-chrome","ownerDomain":"local-browser-session"}]}
```

```apex-law
{"lawId":"APEX-LOCAL-BROWSER-006-V1","status":"active","tier":"P0","capabilityDomain":"local-browser-session","enforcementMode":"machine-blocking","evidenceMode":"law+cross-repo-contract+runtime+fault-injection","summary":"For one browser-required execution at most one Browser Worker may hold the current xuanxue writer fence; failover starts only from a sealed checkpoint with a new fence and every browser action is provable inside an ordered authenticated authority window in the single AgentRuntimeReceipt.","required":["xuanxue database lease/fence is the only election truth","active and standby use independent profiles and identities","handover waits for old fence invalidation and sealed checkpoint","no browser action occurs between authority windows","unresolved OUTCOME_UNKNOWN blocks complete","AgentRuntimeReceipt remains the only runtime receipt owner"],"forbidden":["second Browser election owner","dual active execution","profile copy between workers","implicit mutation replay on failover","second Agent runtime receipt or dynamic verdict"],"clauses":[{"clauseId":"apex-local-browser-006-v1-cross-repo-fence-proof","statement":"Execution fencing, safe handover and ordered authority-window proof jointly prevent dual writers and unprovable browser actions.","evidenceMode":"model+acceptance+real-chrome","ownerDomain":"local-browser-session"}]}
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
browser-auth/no-host-controller-rebind
browser-auth/original-reply-channel
browser-auth/exact-activation-tuple
browser-auth/authority-liveness-lease
browser-auth/no-command-after-liveness-expiry
browser-auth/heartbeat-cannot-mint-authority
browser-auth/production-fixture-zero
browser-profile/dedicated-production-profile
browser-profile/process-enrollment-attestation
browser-profile/force-install-policy-readback
browser-release/artifact-activation-proof-separation
browser-release/verified-crx-hard-gate
browser-release/anti-rollback-and-revocation
browser-release/reproducible-build-identity
browser-install/safe-stale-socket-recovery
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
