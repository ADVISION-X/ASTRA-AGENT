---
name: GrassEye Browser Authority Infrastructure
description: Governs the only production Browser authority chain: fixed unpacked MV3 and one authenticated loopback WebSocket.
applyTo: src/lib/browser/**,src/lib/local-runtime/workbench-browser-authority-support.ts,src/lib/local-runtime/workbench-assembly.ts,src/lib/local-runtime/workbench-status.ts,src/capabilities/**,src/plugins/**,scripts/audit/domains/local-browser-session/**,scripts/acceptance/local-browser-*.ts
---

# GrassEye Browser Authority Infrastructure｜终态法案

status: active
version: 2026-08-22.command-diagnostics
capabilityDomain: local-browser-session
constitutional objective: 未认证 Browser session、任意浏览器控制、CWS/page relay/Native Host 或长期 target session 不可表示。

本文件整体取代旧 CWS、page relay、external Port、page-session grant、previous protocol 和 Native Messaging 法条。冲突的 law、blueprint、manifest、acceptance、package script、inspector、generated truth 和 source consumer 必须列全分母后在同一 owner cutover 物理替换或删除；不得 bridge、fallback、dual run、alias 或 shadow implementation。

## 唯一生产拓扑

owning plugin fixed flow -> BrowserAuthorityBroker -> BrowserAuthorityLease + exact BrowserTargetLease + BrowserDocumentRef -> ws://127.0.0.1:4173/browser-authority/v1 -> fixed-directory unpacked MV3 Extension -> fixed SiteActionRegistry/CommandRegistry -> exact Chrome target/document -> evidence + plugin business result。

唯一 listener 是 src/app/create-workbench-server.ts 已有 App Server；它只接受 exact upgrade，不创建第二 HTTP server。控制帧和 artifact 子协议共用这个 socket。Extension actor 是唯一 socket owner，Agent 永不主动建第二 socket；一次性密钥完成认证后不得持久化，也不得伪装成可自动续权，认证中断后只能由操作者使用新密钥重新配对。

生产禁止 Chrome Web Store/CWS review identity、externally_connectable、runtime.onConnectExternal、external Port、Workbench page relay、open/inbound/next polling、SSE、Native Messaging、Native Host、Apple signing/notarization、previous protocol window、任何 fallback/compatibility bridge。

## Authority、安装和配对

Browser 数据面只能为 ABSENT 或 PRESENT。PRESENT 必须同时绑定：

- 固定 unpacked 目录 .grasseye-local/browser-build/extension；
- manifest key 推导的 stable extension ID；
- releaseBuildId、ExtensionDirectoryHashV1、canonical manifest hash、协议 hash、SitePolicy registry hash；
- exact Chrome executable/channel/version 与 approved profile identity；
- 256-bit 一次性 pairing secret、P-256 ECDSA mutual challenge、P-256 ECDH、RFC8785 JCS transcript、HKDF directional keys、AES-GCM directional nonce/AAD、epoch 和严格 sequence；
- 当前 authority epoch、issued/deadline、liveness policy 与 exact socket identity。

首次 pairing、unpacked Load/Reload、extension reinstall、directory/hash/permission/version/Chrome/profile 漂移均使 authority ABSENT 并要求新的 pairing。pairing secret、private key、raw Chrome identifiers、cookies、tokens、page body 或 artifact bytes 不得进入 task state、evidence 或 Runtime Log。

每次构建必须把唯一 `releaseBuildId` 编译进实际 `service-worker.js`；PAIR_HELLO 必须把该 loaded build identity 纳入签名/MAC transcript，Agent 只接受与固定目录外 release record 完全相同的 `releaseBuildId`。只比对 manifest version 或磁盘目录 hash、却不能证明 Chrome 当前加载的 Service Worker 构建，属于禁止的 stale-worker 假认证。

握手失败、预认证 frame 超 budget、MAC/sequence/AAD/nonce/deadline 错误、第二 active client、wrong release/profile/Chrome 任一发生时：关闭 socket、revoke leases、保持 ABSENT、拒绝 Browser-required job。不得降级到 Port、relay 或旧协议。

## Liveness、断线清理与升级

机器合同：认证完成时必须立即执行一次同 Service Worker 的 Chrome extension API 存活脉冲，之后每 20s 先执行同一脉冲、再发送唯一 authenticated WebSocket heartbeat；不得增加 alarm、offscreen document 或第二 keepalive。连续 45 分钟没有收到有效 heartbeat 才能判定 liveness 失效；认证证书和 Session Workspace 只绑定当前 authenticated connection generation，不设置墙上时间到期。认领成功、普通空闲、运行时长、单次 heartbeat 间隔、非认证类 Extension runtime diagnostic 均不得触发主动 close、revoke、重新配对或重新认领。真实 socket disconnect 必须先清除会话、permit、Target/Document，并物理 detach 陈旧 debugger target；不得把旧 target 带入下一次认领。一次性 pairing secret 在认证后销毁，断线后必须回到 ABSENT 并由操作者使用 Workbench 新密钥重新配对；禁止无凭证假重连、secret 持久化或自动续权。任何程序主动 WebSocket close 必须携带可区分的 close code/reason；无该 reason 的 peer `1001` 必须归类为外部 worker/browser 终止，不得冒充业务主动断开。任何真实 sleep/wake、worker termination、Chrome/Agent restart、DevTools detach、release/profile/identity drift 都先 revoke 为 ABSENT，再清理和重建。

Extension 的普通 `unhandledrejection`、worker error、action runtime error 或任何已认证命令的捕获失败，必须通过同一认证 socket 的 encrypted diagnostic frame 上行 Runtime Log Spine，但该 diagnostic 本身不改变 Authority/Target/Document。命令失败 diagnostic 必须绑定原 `COMMAND` sequence，并携带脱敏的命令处理阶段、command kind、intent kind、capability id 与固定 `BROWSER_*` reason；不得包含 selector、页面正文、prompt、raw payload 或 stack。只有认证 frame 的 MAC、sequence、AAD、nonce、deadline、release/profile/identity 或解密/规范化校验失败，才能发送 REVOKE 并清理认证。禁止为了“能看到日志”把普通扩展错误升级成认证撤销。

更新和回退仅允许完整的冻结 unpacked Agent+Extension 新链候选。操作者必须对同一固定目录手动 Reload；系统读回 stable ID、version、permissions、releaseBuildId、ExtensionDirectoryHashV1 与 Chrome/profile。单端回退、协议兼容、old Agent + new extension、new Agent + old CWS artifact 都失败关闭。Chrome identity 漂移后重新验证并从零开始 72 小时 soak。

## Session Workspace、Exact target/document 与固定命令

BrowserAuthorityBroker 是业务唯一 browser entry。operator 每次 Workbench/Extension 连接只需完成一次人工配对并认领一个 HTTPS 标签页；认领成功必须原子建立绑定固定 profile、Extension ID、releaseBuildId、directory hash、sitePolicyHash、Authority epoch 与 connection generation 的 Session Workspace，不得再要求独立批准按钮或 API。Workspace 不按运行时长主动过期，也不得后台续期；它只在真实断线、Workbench/Extension/Chrome 重启或 Reload、release/profile/directory/site-policy/identity 漂移、operator revoke 时随当前连接失效。Plugin 每条命令仍必须重新取得当前 Authority、恰好一个 target 和恰好一个 document；target/document/permit 在 Admission、Before Send、Completion 三处同时检查。Workspace 不是 Cloud fence 输入，且 Browser 命令只携带相对 `commandTtlMs`。

同一已认领 Target 的合法 navigation 会生成新的 Document。Extension 必须先以同一 targetRef、新 documentRef、递增 navigationEpoch 完成 authenticated TARGET_CLAIM 更新并收到 acknowledgement，再返回 navigation REPLY；Agent 必须先更新 Broker 的当前 Document，旧 Document 随即失效。禁止只在 Extension 私有 registry 里推进 Document、让 Agent 保留旧 claim，也禁止要求操作者为同一 Target 的每次站内 navigation 重新手工认领。

多个合法 execution 可以在 Provider 等待阶段并存，但任何排队后的 Browser command 都必须在签 Permit 前从唯一 BrowserAuthorityBroker 重新取得该 execution binding 下的当前 Target/Document；不得复用 execution 创建时缓存的 Document。当前 target 不存在、targetRef/authority/binding 不一致或 navigationEpoch 倒退时立即 `BROWSER_DOCUMENT_INVALID`，不得重试猜测、fallback 或另建共享 target registry。

Workspace 在真实 socket disconnect、Workbench/extension/Chrome restart、extension reload、release/profile/directory/site-policy/identity drift 或 operator revoke 后立即失效；墙上时间和普通空闲不得使它失效。target/document 在 navigation、document generation change、debugger detach、target close、operator takeover、authority revoke、release/Chrome/profile drift、lease/fence expiration 后立即失效。候选为零或多于一、相邻目标冲突、正反证据冲突或超时都 failed/review_required；不得 current-tab/title/URL-first 恢复。

SiteActionRegistry/CommandRegistry 是唯一可执行表。每项声明 site policy、capability、request/response schema、mutation class、field safety budget、artifact resource budget、target/document requirement、business/browser postcondition、human gate 和 evidence/acceptance；这里不得声明 prompt/message byte ceiling。禁止 arbitrary JavaScript、raw CDP/debugger command、arbitrary URL、caller selector/coordinate、caller tab/window/title/marker/conversation/concurrency、eval/new Function/remote code、generic next-action/workflow engine。

BrowserCommandActor 不决定业务步骤。每个 mutation 仅允许一个 inflight target；所有 queue/bytes/artifact stream 使用固定预算，到界失败关闭。

WebSocket transport frame sequence 与 command permit sequence 是两个独立序列，禁止复用、互相比对或由其中一个推导另一个。`REPLY.requestSequence` 只关联唯一 pending transport frame；`REPLY.permitSequence` 与 `replyChannelToken` 共同绑定原 command permit。只有两组绑定分别匹配，BrowserCommandActor 才能接纳 terminal reply；TARGET_CLAIM、heartbeat、diagnostic 等非命令 frame 不得改变 permit sequence 语义。

## 传输字节边界禁区

`65,535` 只是 RFC 6455 从 16-bit 切换到 64-bit 长度字段的编码分界，绝不是业务输入上限。owner schema 与实际 provider/model context 已接纳的完整 command payload，唯一 WebSocket 必须使用同一 authenticated message 的标准 64-bit length 或标准 continuation frame 承载；不得再用 `65,535`、512 KiB、1 MiB 或任何实现常量拒绝它。

registry 的 field safety budget 只约束 action 自己的危险结构字段，artifact resource budget 只约束获准文件资源，二者都不能被 transport 擅自解释成 prompt、重复次数、语言字符数或 message byte ceiling。已知 100 MB provider 投喂只作为“不得自造更小门禁”的回归场景，不形成新的 100 MB 上限。传输层只能因认证/协议非法或底层运行时确实无法表示/分配而失败；不得预设产品字节门槛，不得截断，不得静默丢字，也不得转去 HTTP、artifact、文件、第二 socket 或兼容链。Runtime Log 只记录 length/hash/frame kind/sequence/close reason，不记录 raw prompt/payload。

## Artifact 与 mutation journal

artifact 以同一 socket 的 schema-bound chunk frame 传输，绑定 artifactId、contentHash、length、direction、sequence、budget 和 completion receipt。wire、plugin input、API input、log 和 evidence 都不得接受 raw/resolved file path。

每个 mutation 的固定顺序是 PREPARED(intent hash, authority/lease/fence binding) -> durable append + fsync -> SEND -> CONFIRMED | FAILED | UNKNOWN。断线、重启或无 terminal receipt 时必须为 UNKNOWN。Transport/UI/API Boundary/worker 不得自动重放、推测成功或选择新 target；只有 owning plugin 经真实页面正向确认、反向排除、唯一性和有界性形成 OutcomeResolutionReceipt 后可继续。

所有原子页面动作固定使用 `IF + AND -> THEN`：`IF` 读取同一当前 Document 上的精确目标与状态，`AND` 同时排除相邻文本、错误态、加载态、重复态并证明候选恰好一个，`THEN` 才允许发送恰好一个 mutation。该 mutation 必须由紧随其后的同目标正反读回形成一张专属 OutcomeResolutionReceipt；一张 receipt 不得批量确认此前 mutation，存在未决 mutation 时不得发送下一 mutation。字符串身份需要精确相等时必须使用精确相等语义，禁止用 substring 命中冒充唯一候选。固定 sleep、延迟完成或到达某个时间点都不能使 IF/AND 成立，也不能授权 THEN；deadline/timeout 只负责到界后安全停止为 failed/review_required/recovery_pending。

## Owner 边界

- pairing/session/transport/actor/revoke：local-browser-session。
- authority issue/lease/target/document/command/journal：BrowserAuthorityBroker、BrowserAuthorityIssuer、BrowserTargetLeaseManager、BrowserCommandActor。
- fixed unpacked build/release identity：browser release owner。
- exact WebSocket upgrade：local-app-shell/App Server。
- business flow/outcome：owning plugin。
- ingress HMAC：workbench-api-boundary。
- diagnostic events：Runtime Log Spine。
- actual-action evidence：forensics-persistence。
- law enforcement：scripts/audit 的唯一 generated-plan chain。

No consumer may import browser private runtime. All entry is through the Browser public facade; a public facade cannot re-export raw socket, Chrome id, target, command transport or private actor.

## Proof ceiling

STATIC/Exam 可以证明 schema、AST/symbol boundary、crypto known-answer、frame mutant、journal fault model 和 old-path-zero。真实 Chrome 必须证明 MV3 worker、socket、LNA、target/document、file input、sleep/wake、restart、Reload/update/rollback。business proof 属 plugin 终态。CI-FULL 不证明 Chrome、外部网站、部署或发布。

## 法条

```apex-law
{"lawId":"APEX-LOCAL-BROWSER-001-V4","status":"active","tier":"P0","capabilityDomain":"local-browser-session","enforcementMode":"machine-blocking","evidenceMode":"law+blueprint+ast+exam+real-chrome","summary":"Every Browser side effect and every owner-admitted payload uses one fixed-directory unpacked MV3 and one authenticated loopback WebSocket authority chain without a transport byte ceiling.","codePurityLiveness":{"externalEntryFiles":["src/lib/browser/chrome-extension/service-worker.ts","src/lib/browser/chrome-extension/pairing-popup.ts","src/lib/browser/exact-target/browser-site-policy-registry.ts"],"lawfulSideEffectImports":[{"consumerFilePath":"src/lib/browser/chrome-extension/service-worker.ts","targetFilePath":"src/lib/browser/chrome-extension/websocket-actor.ts"}]},"required":["ABSENT/PRESENT is the only authority data plane","single exact WebSocket upgrade on the existing App Server","RFC 6455 64-bit length and continuation support without a product byte ceiling","stable ID/releaseBuildId/ExtensionDirectoryHashV1/Chrome-profile readback","Extension actor is sole socket owner","the MV3 manifest and pairing page own exactly service-worker.ts and pairing-popup.ts as browser-loaded external source roots","browser-site-policy-registry.ts is the release-hashed SitePolicy source root","service-worker.ts owns exactly one law-declared side-effect import to websocket-actor.ts"],"forbidden":["CWS","externally_connectable","external Port","page relay","Native Messaging","Native Host","second transport","previous protocol","65535/512KiB/1MiB or any implementation byte ceiling","payload truncation"],"clauses":[{"clauseId":"apex-local-browser-001-v4-single-unpacked-websocket","statement":"No browser action or owner-admitted payload is admitted outside the single authenticated unpacked-MV3 WebSocket chain, and transport encoding cannot impose a business byte ceiling.","evidenceMode":"static","ownerDomain":"local-browser-session"}]}
```

```apex-law
{"lawId":"APEX-LOCAL-BROWSER-002-V4","status":"active","tier":"P0","capabilityDomain":"local-browser-session","enforcementMode":"machine-blocking","evidenceMode":"law+schema+exam+real-chrome","summary":"Pairing and session authentication bind exact release, profile, Chrome and directional cryptographic session state before PRESENT.","required":["256-bit pairing secret","P-256 ECDSA/ECDH","RFC8785 JCS","HKDF/AES-GCM directional keys","strict sequence/AAD/deadline","immediate and 20s Chrome extension API liveness pulse","20s authenticated heartbeat/45m missed-heartbeat tolerance","disconnect clears Target/Document and detaches debugger","explicit programmatic WebSocket close reason","non-fatal encrypted extension and authenticated command diagnostics preserve authority and expose command stage and capability identity"],"forbidden":["pre-auth command","global session truth","rekey fallback","agent reconnect","fake credentialless reconnect","pairing-secret persistence","heartbeat authority minting","45-second authority expiry","idle or diagnostic-triggered disconnect","command failure visible only in chrome extensions","second keepalive transport"],"clauses":[{"clauseId":"apex-local-browser-002-v4-auth-liveness","statement":"Only an authentication discontinuity or forty-five minutes without a valid heartbeat revokes authority; successful claim, idle time and non-authentication extension or command diagnostics never proactively close the authenticated channel. Every authenticated command failure reaches the Workbench with its command stage and capability identity. The authenticated worker invokes one Chrome extension API liveness pulse immediately and every twenty seconds before the sole encrypted WebSocket heartbeat. A real disconnect clears the stale target and debugger before operator re-pairing, and every programmatic close carries an explicit reason.","evidenceMode":"acceptance","ownerDomain":"local-browser-session"}]}
```

```apex-law
{"lawId":"APEX-LOCAL-BROWSER-003-V6","status":"active","tier":"P0","capabilityDomain":"local-browser-session","enforcementMode":"machine-blocking","evidenceMode":"law+ast+exam+real-chrome","summary":"Manual pair plus target claim atomically establishes one connection-bound Session Workspace; dynamic Authority/Target/Document leases and a fixed registry are the only browser command authority.","required":["manual pair plus claim is the single operator admission","claim atomically establishes one Workspace per exact authenticated connection identity","Workspace and certificate have no wall-clock expiry","restart recovery resumes the oldest unfinished job after fresh pair plus claim","dynamic exact Authority/Target/Document","three admission checks","one physical tab and one mutation lock","bounded relative commandTtlMs","original receipt channel"],"forbidden":["separate Workspace approval UI or API","per-job operator approval","8h or any wall-clock Workspace/authority expiry","automatic Workspace renewal","newer-job-before-oldest-unfinished recovery","Workspace hash in Cloud fence","absolute monotonic deadline on wire","arbitrary JavaScript","raw CDP","URL/selector/coordinate caller control","physical resource caller control","target guessing"],"clauses":[{"clauseId":"apex-local-browser-003-v6-claim-workspace-restart-resume","statement":"After each restart, a fresh manual pair plus target claim restores the connection-bound Workspace and the owner resumes the oldest unfinished job; only disconnect, restart, reload, identity drift or operator revoke invalidates it.","evidenceMode":"acceptance","ownerDomain":"local-browser-session"}]}
```

```apex-law
{"lawId":"APEX-LOCAL-BROWSER-004-V4","status":"active","tier":"P0","capabilityDomain":"local-browser-session","enforcementMode":"machine-blocking","evidenceMode":"acceptance","summary":"Mutation intent is durable before send; every atomic action is IF plus AND then one mutation, and UNKNOWN is never automatically replayed.","required":["one canonical hash-chain Browser proof journal for lifecycle and commands","PREPARED plus fsync","SEND then CONFIRMED FAILED or UNKNOWN","terminal/readback conflict detection","Plugin-only OutcomeResolutionReceipt with distinct positive and negative evidence refs","IF and AND prove one exact current target before THEN sends one mutation","one receipt resolves exactly its own mutation before another mutation may be sent","timeout only stops unresolved work and never authorizes a production transition","single-socket artifact subprotocol"],"forbidden":["automatic mutation replay","one receipt resolving multiple mutations","a new mutation while an earlier mutation is unresolved","substring identity used where exact text equality is required","fixed sleep or elapsed time used as a success condition","path on wire","transport business verdict","unbounded stream","caller-authored proof envelope","second Browser proof journal"],"clauses":[{"clauseId":"apex-local-browser-004-v4-durable-mutation","statement":"Only the owning Plugin can resolve one UNKNOWN mutation with that same atomic action's real positive and negative terminal evidence; IF plus AND, never elapsed time, authorizes the single THEN mutation and the next action cannot begin before resolution.","evidenceMode":"acceptance","ownerDomain":"local-browser-session"}]}
```

```apex-law
{"lawId":"APEX-LOCAL-BROWSER-005-V4","status":"active","tier":"P0","capabilityDomain":"local-browser-session","enforcementMode":"machine-blocking","evidenceMode":"law+artifact+exam+real-chrome+soak","summary":"Release/update/rollback uses one fixed unpacked identity and never reactivates CWS or a compatibility chain.","required":["manual Reload","release record outside extension directory","exact identity readback","update/rollback re-pair","canonical Browser proof journal binds current candidate, release identity, authenticated authority, exact target/document, completed command and later revocation within thirty minutes","Chrome drift revalidation and 72h soak"],"forbidden":["CWS rollback","dual protocol","single-end rollback","old artifact fallback","arbitrary JSON asserted as real Chrome proof"],"clauses":[{"clauseId":"apex-local-browser-005-v4-release-recovery","statement":"Mismatch keeps authority ABSENT and recovery repairs only the new single chain.","evidenceMode":"artifact+real-chrome","ownerDomain":"local-browser-session"}]}
```

## Machine-blocking check IDs

browser-authority/unpacked-stable-id
browser-authority/exact-single-websocket
browser-authority/no-cws-native-page-relay
browser-authority/pairing-and-directional-crypto
browser-authority/liveness-revoke-before-reconnect
browser-authority/no-agent-reconnect
browser-authority/exact-target-document-three-checks
browser-authority/fixed-registry-no-arbitrary-control
browser-authority/prepared-fsync-outcome-unknown-no-replay
browser-authority/artifact-single-socket-no-path
browser-authority/unpacked-release-update-rollback
browser-authority/chrome-drift-soak

每个 check 都要有唯一 owner inspector、至少一项负例/故障注入或真实 Chrome evidence；任一 finding 为 FAIL。
