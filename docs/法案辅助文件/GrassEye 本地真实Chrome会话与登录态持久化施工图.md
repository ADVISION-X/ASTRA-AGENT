# GrassEye Browser Authority 生产施工图

版本：2026-08-18.5  
状态：active construction blueprint  
权威：`.github/instructions/agent-rules/modules/module-local-browser-session.instructions.md`

> 本施工图描述 Browser 插件责任区的唯一终态。它不建立第二真相；与 active law 冲突时以 active law 为准。

## 1. 终态目标与绝对边界

生产运行态永远只有：

```txt
AUTHORITY_ABSENT
AUTHENTICATED_AUTHORITY_PRESENT
```

`browserSession 未认证` 不是一个失败状态，而是一个被类型、组合根、协议和法案共同禁止的对象形态。认证前不存在 Browser session、Browser target session 或页面命令能力；只有 Browser infrastructure control plane。

任何根信任、release、profile、Chrome process、Controller、Host、Port、Extension、heartbeat 或命令证书不能证明时，唯一合法结果是 `AUTHORITY_ABSENT + BLOCKED`。不得降级、fallback、伪造 ready 或为了继续业务而返回未认证 Browser 能力。

## 2. 唯一生产拓扑

```txt
GrassEye composition root
  -> resolve BrowserProfileEnrollment
  -> BrowserProcessSupervisor
      -> enrolled Chrome executable
         --user-data-dir=<explicit>
         --profile-directory=<explicit>
  -> CurrentChromeBrowserController.create()
      -> BrowserCommandRuntime.create()
          -> BrowserNativeTransportServer
              -> 0600 <dataDir>/browser-runtime/controller-native.sock
                  -> grasseye-browser-host (self-contained Rust)
                      -> Chrome Native Messaging
                          -> fixed-id MV3 extension
                              -> NativePortActor(nativePortEpoch)
                                  -> chrome.debugger
                                      -> exact target / exact document
```

Browser 只拥有基础设施、认证 authority、target/document identity 与页面原子动作。它不拥有业务顺序、AI 判断、provider verdict、Evidence 真相、网站 job lease 或发布 verdict。

禁止：Playwright 生产旁路、直接 CDP 公共入口、AppleScript/JXA、active-tab/current-page fallback、系统鼠标键盘、clipboard、native picker、第二 Native Host、第二 localhost/WebSocket 浏览器通道。

## 3. 文件责任区

```txt
src/lib/browser/
  authority/
    browser-authority-certificate.ts
    browser-authority-issuer.ts
  profile/
    browser-profile-enrollment.ts
    browser-profile-config.ts
    browser-process-supervisor.ts
  release/
    browser-release-identity.ts
  transport/
    browser-session-crypto.ts
    command-permit.ts
  exact-target/
    browser-command-runtime.ts
    browser-native-transport-server.ts
    browser-native-transport-protocol.ts
    browser-file-artifact-grant.ts
    browser-target-registry.ts
    browser-target-ref.ts
  chrome-extension/
    manifest.json
    protocol.ts
    service-worker-session-crypto.ts
    service-worker-native-transport.ts
    service-worker-command-execution.ts
    service-worker.ts
    ... dedicated DOM/input helpers
  native-messaging-host/
    Cargo.toml
    crates/host/**
    crates/browserctl/**
    install.mjs                # thin prebuilt browserctl launcher only
```

退休文件必须物理退出：

```txt
src/lib/browser/local-browser-session.ts
src/types/local-browser-session.ts
src/lib/browser/native-messaging-host/host.mjs
src/lib/browser/native-messaging-host/controller-channel.mjs
```

## 4. Composition root：认证以后才有业务对象

法定顺序：

```txt
resolve explicit enrolled profile
-> ensure enrolled Chrome process
-> bind owner-only Controller socket
-> Chrome starts fixed-id extension
-> Extension starts NativePortActor
-> Host validates caller origin + enrolled Chrome process ancestry
-> Controller/Extension mutual handshake
-> Controller sends pending authority grant
-> Extension verifies grant and sends grant ACK
-> Controller verifies ACK
-> BrowserAuthorityIssuer.commit()
-> AUTHENTICATED_AUTHORITY_PRESENT
-> BrowserCommandRuntime factory resolves
-> BrowserController factory resolves
-> create AI Gateway / video / browser-dependent owners
-> expose HTTP server
```

因此：

- `createWorkbenchAssembly()` 是 Browser Authority admission gate。
- `CurrentChromeBrowserController` private constructor，只能通过 async `create()` 获得。
- `BrowserCommandRuntime` 只能通过 async `create()` 获得。
- HTTP server `listen()` 必须位于 `workbench.init()` 成功之后。
- Authority 缺席时可以报告 `browserAuthority=absent/BLOCKED`，但不存在 `browserSession` 对象或 `transportReady=false` 的正常运行态。

## 5. Profile 与 Chrome process identity

首次 profile enrollment 必须显式注入：

```txt
GRASSEYE_CHROME_USER_DATA_DIR
GRASSEYE_BROWSER_PROFILE_REF
GRASSEYE_BROWSER_PROFILE_DIRECTORY
GRASSEYE_CHROME_EXECUTABLE
```

唯一 enrollment owner 是 `browserctl enroll-profile`。它将首次输入固化为 owner-only、0600 的 canonical `BrowserProfileEnrollmentReceipt`；之后 Workbench、Native Host、browserctl install/verify 和 startup preflight 只读取并验证该 Receipt，不能让 `.env.local` 成为第二套长期 runtime truth。

`BrowserProfileEnrollment` 内容寻址绑定：

```txt
platform
profileRef
userDataDir
profileDirectory
chromeExecutablePath
extensionId
releaseIdentity
Local State identity hash（由 profile directory 与 `profile.info_cache[profileDirectory]` 的稳定身份字段计算；不哈希会随 Chrome 正常运行变化的整份文件）
```

BrowserProcessSupervisor 启动 operator-designated enrolled Chrome 时必须携带精确 `--user-data-dir` 和 `--profile-directory`。Rust Host 在读取 owner-only config 后向上检查进程 ancestry；只有来自同一 enrolled Chrome executable/user-data-dir/profile-directory 的 Host 才可连接 Controller socket。

本机 `GRASSEYE_BROWSER_RUNTIME_MODE=test` 允许已有 Chrome 因单实例复用而缺少显式参数时，使用同一 executable 与 macOS `lsof` 对 enrolled `userDataDir/profileDirectory` 的实际持有关系完成额外证明；production 仍要求 ancestry 中存在显式参数。

用户明确选择并 enrollment 的 `Default` 或 `Profile N` 都可以成为 operator-designated profile；正确 extension ID 但错误 profile/process 不能获得 Authority。

## 6. ReleaseIdentity

当前冻结发布家族 tuple：

```txt
protocolVersion = grasseye-browser-v2
releaseIdentity = grasseye-browser-runtime-2026-08-18-v2
extensionId = mepfnlhndaiihhfejbbhfehegpbdnipl
extensionVersion = 2.0.0
nativeHostName = com.grasseye.browser
minimumChromeVersion = 120
releaseSequence = 3
minimumAcceptedReleaseSequence = 3
```

`releaseIdentity` 是 Profile Enrollment 绑定的发布家族身份；`releaseSequence` 是该家族内不可回滚序列；
`artifactSetSha256` 是具体签名 ArtifactSet 的字节身份。本轮保持 releaseIdentity/protocol 为 v2，
仅将序列提升至 3，因此既拒绝 seq2 Runtime，也不要求重新 enrollment 现有 Default Profile。

Controller、Extension、Host、browserctl、profile enrollment 必须读到同一 tuple。混合版本不进行兼容猜测，直接 fail closed。

未来版本不得通过永久 legacy bridge 兼容；只允许经过签名兼容矩阵证明的有限 N/N-1 activation window，并由 release security policy 明确吊销与最低接受序列。

## 7. 双向认证与 Authority 原子提交

每个 Native Port 是一个独立 epoch：

```txt
nativePortEpoch = monotonic extension-local epoch
connectionGeneration = monotonic Controller connection generation
```

认证流程：

```txt
Extension hello
  {extensionId, extensionVersion, releaseIdentity, extensionInstanceId, nativePortEpoch}

Controller challenge
  {controllerSessionId, generation, portEpoch, challengeId, nonce, controller ECDH public key}

Extension proof
  - ephemeral P-256 key
  - ECDH shared secret
  - HKDF-SHA256
  - HMAC(auth transcript)

Controller verifies proof
  -> BrowserAuthorityIssuer.prepare(candidate)
  -> candidate is NOT current authority

Controller authority_grant
  -> HMAC(grant transcript)

Extension verifies grant
  -> authority_grant_ack with HMAC
  -> only then marks local actor authority-present

Controller verifies ACK
  -> BrowserAuthorityIssuer.commit(candidate)
  -> only now current authority is PRESENT
```

握手中途任何断开或 proof mismatch 都只会清除 pending candidate；业务从未见到未认证 authority。

## 8. 加密帧与 Command Permit

每个 Port epoch 的临时 session key 只存在内存：

```txt
P-256 ECDH
-> HKDF-SHA256
-> frame key
-> AES-256-GCM command/response frames
```

AAD 固定绑定：

```txt
authorityId
connectionGeneration
nativePortEpoch
sequence
```

每条 command permit 固定绑定：

```txt
authorityId
authorityCertificateHash
connectionGeneration
nativePortEpoch
commandId
sequence
deadlineAt
permitHash
```

旧 port、旧 generation、旧 authority、旧 permit、旧 completion 即使迟到，也无法通过当前 actor/current connection/current authority 校验，更无法产生当前 frame 的有效认证标签。

## 9. Port Actor 与并发规则

MV3 不再用跨世代全局 `nativePort/authenticatedNonce/lastAcceptedSequence` 作为真相。每次 `connectNative()` 返回一个独立 `NativePortActor`。Actor 自己拥有：port、nativePortEpoch、extensionInstanceId、one-time handshake、committed authority binding、sequence、bounded receipt cache、heartbeat timer。

异步命令完成后只允许回到捕获它的原 Actor 原 Port。`activeActor !== this` 时，迟到消息、disconnect 和 completion 全部无副作用退出。

Controller 同理：每个 socket connection 是独立 `ConnectionState`。只有 `this.connection === connection` 的事件才可修改当前状态。

## 10. Liveness 与撤销顺序

默认：

```txt
heartbeatIntervalMs = 1000
softDrainAfterMs = 3500
hardExpiryMs = 5000
watchdogTickMaxMs = 250
maxAuthorityAgeMs = 8h
```

Heartbeat 是已认证 Authority 的续活证明，不是认证入口。它永远不能从 ABSENT 生成 Authority。

任一 discontinuity 的顺序必须是：

```txt
revoke current authority
-> invalidate registry / target / document / target-session epoch
-> reject pending command
-> detach/cleanup/log
-> schedule reconnect wake
```

禁止先 reconnect、先 reset global state、先回调业务再 revoke。

8 小时 authority 最大年龄到达时禁止在线 rekey。必须有界 drain 到 checkpoint、revoke 整链、全新 Port、全新 handshake、新 Authority。

## 11. Exact target/document identity

`BrowserTargetRef` 与 `BrowserDocumentRef` 永远 opaque。raw tab/window/frame/debugger id 只存在 `src/lib/browser/**`。

- target ref 至少绑定 controller/authority epoch、raw tab identity、approved origin、target generation。
- document ref 额外绑定 frame/loader generation。
- navigation、detach、tab close、Extension reload、Authority revoke 都使旧 document ref 失效。
- Authority revoke 后旧 target/document ref 永不恢复；显式业务 checkpoint 只能重新 acquire 新 ref。
- non-idempotent mutation 的 uncertain result 不能因为重连而自动重试。

## 12. Observation 与 mutation 隔离

Public `evaluate({script})` 保留给现有只读观察消费者，但唯一规范化点是 Browser owner：

```txt
function body
-> toBrowserEvaluationExpression
-> evaluate_target
-> MV3 Runtime.evaluate(
     throwOnSideEffect = true,
     userGesture = false
   )
```

因此 generic evaluate 在高权限执行器层机械禁止页面 mutation。

所有 mutation 使用专用命令：`navigate_target/click_target/click_dom_target/fill_dom_target/scroll_target/text_target/set_file_input_files/close_target`。

Point click 先 side-effect-free 验证 receiver，再通过 CDP `Input.dispatchMouseEvent`。Unicode/CJK/emoji 文本通过 `Input.insertText`。DOM click/fill 必须在同一命令完成 selector 唯一解析、identity 重验和 mutation。

## 13. URL 与权限双层准入

Controller/business policy 不是唯一防线。MV3 high-privilege executor 自己必须拒绝：

```txt
file:
chrome:
chrome-extension:
data:
javascript:
任意未批准 host
非本机 plain-http
```

Extension manifest permissions 是静态上限；service worker 的 runtime allowlist 是第二道高权限准入。未来新增 provider 必须先更新 capability/权限法案与当前真实 Chrome 证据，不能依靠 wildcard 预留万能权限。

## 14. FileArtifactGrant

Wire 不接受 raw `filePath`。Controller 先生成：

```txt
BrowserFileArtifactGrant
  grantId
  realpath
  device/inode
  size
  sha256
  approvedRoot
  issuedAt
```

签发时必须 `realpath -> approved root check -> regular file -> size bound -> hash -> second stat -> reject symlink/race/content drift`。

Extension 只消费 grant 中已批准 path，仍需精确 target/document 与唯一 DOM receiver。未来跨机器/大附件必须升级为 content-addressed artifact stream，不在控制帧中放任意大 payload。

## 15. Native Messaging framing 与预算

外层 Chrome Native Messaging：4-byte unsigned native-endian length + UTF-8 JSON。

内部预算：

```txt
Host -> Extension control frame <= 256 KiB
Extension -> Host <= 48 MiB
Controller <-> Host newline frame <= 64 MiB
```

任何零长度、超限、短 header、截断 body、非法 JSON、protocol/release mismatch 都 fail closed。

## 16. Rust Native Host

生产 Host `grasseye-browser-host` 职责只有：校验 Chrome caller origin、owner-only config/socket/uid、enrolled Chrome process ancestry、外层 release/protocol identity、Native Messaging framing、stdio↔Controller bounded relay。

Host 禁止拥有 authority verdict、target registry、business state、evidence、retry policy、provider secrets、session key。

生产不再使用 Node shebang Host；Node/nvm/Homebrew 变化不能改变 Host 可执行性。

## 17. browserctl 安装事务

`install.mjs` 只是预构建 `grasseye-browserctl` launcher。目标机器禁止从源码构建 Host。

browserctl 的控制面职责至少包括：

```txt
enroll-profile  # 首次显式输入 -> canonical enrollment receipt
install         # Receipt + signed artifact -> installed activation receipt
verify/doctor   # 只读验证完整 release/profile tuple
repair          # 显式控制面修复，不由 grasseye:start 触发
```

browserctl：

```txt
verify signed ArtifactSet V2
-> verify browserctl / Host / canonical Extension tree bytes
-> stage immutable release dir
-> sha256 readback
-> write owner-only connection config
-> write exact allowed_origins NativeMessagingHosts manifest
-> fsync + atomic rename
-> write activation receipt
-> verify installed bytes/config/manifest/profile tuple
```

ArtifactSet V2 是唯一发布真相，受签名 manifest 至少包含 release tuple、sourceCommitSha、builderIdentity、
Host hash、browserctl hash、Extension manifest hash 与 extensionTreeSha256。Extension tree 递归遍历时只允许
regular file，拒绝 symlink/special file；每个文件生成 `{path,size,sha256}`，路径使用 relative POSIX path，
按路径排序、canonical serialization 后 SHA-256。

activation receipt 必须从已验证 ArtifactSet 继承 `releaseSequence`、
`minimumAcceptedReleaseSequence`、`extensionTreeSha256` 和 `artifactSetSha256`。Node Runtime 必须验证
`Receipt ↔ verified ArtifactSet ↔ current release constants ↔ Profile Enrollment` 全部精确一致；旧 V1
ArtifactSet 或缺字段 receipt 不得补字段兼容，只能通过显式 repair 替换。

连接 config 与 activation receipt 至少绑定 releaseIdentity、protocolVersion、extensionId、profileRef、userDataDir、profileDirectory、chromeExecutablePath、controller socket path、host path/hash。

生产发布的进一步硬门仍包括代码签名、公证、Verified CRX/CWS identity、SBOM/provenance、anti-rollback/revocation policy 与 same-artifact proof。

本地测试模式只在显式设置 `GRASSEYE_BROWSER_RUNTIME_MODE=test` 时启用；它允许 Apple Development/Personal Team 签名并跳过 macOS 公证与 `spctl`，但仍必须验证 ArtifactSet 文件哈希、release tuple、Enrollment Receipt、Native Host doctor、Authority handshake 和 exact-target。所有 Browser Runtime 入口统一读取 `shell/process.env > .env.local > .env > production`；缺省模式永远是 production，测试模式不得进入生产发布链。

## 18. 失败语义

Terminal/fail-closed errors 至少包括：

```txt
BROWSER_AUTHORITY_ABSENT
TRANSPORT_DISCONNECTED
TARGET_NOT_FOUND
TARGET_AMBIGUOUS
TARGET_ORIGIN_MISMATCH
DOCUMENT_STALE
DEVTOOLS_ATTACHMENT_CONFLICT
COMMAND_TIMEOUT
OUTCOME_UNKNOWN
BROWSER_BACKPRESSURE
```

- observation 可由 owning business checkpoint 再次发起。
- idempotent mutation 的 retry 只能由 owning business policy 对新 Authority/新 refs 显式决定。
- non-idempotent mutation 发出后没有 terminal receipt => `OUTCOME_UNKNOWN`，transport 不重放。
- 任何旧 authority object 不能因为网络恢复自动变有效。

## 19. Audit owner

```txt
scripts/audit/domains/local-browser-session/
  manifest.json
  inspector.ts
  inspector-old-path-zero.ts
```

P0 checkIds 必须拆分证明：

```txt
no-unauth-session-type
no-transport-ready-boolean
composition-authority-gate
authority-mutual-commit
authority-revoke-before-side-effects
native-port-actor-generation-fence
command-permit-frame-binding
profile-process-enrollment
protocol-release-identity
side-effect-free-observation
file-artifact-grant
rust-native-host-only
retired-path-zero
```

Static Audit 不宣称证明真实时序本身；property/model/fuzz、deterministic acceptance 与真实 Chrome 各自拥有自己的证据主权。

## 20. Quality / mutant matrix

质检定义必须能杀死至少以下反例；本次施工不要求执行它们：

1. pre-auth 构造 BrowserController 数据面。
2. `transportReady=false` 成为合法 session 状态。
3. health component 重新叫 `browserSession`。
4. Controller 在 grant ACK 前 commit Authority。
5. heartbeat 从 ABSENT 创建 Authority。
6. disconnect 先回调/重连后 revoke。
7. 旧 Port disconnect 清理新 Port state。
8. 旧 Port completion 回到新 Port。
9. 重复 challenge 重置 sequence。
10. command 无 permit。
11. command permit 使用旧 certificate hash。
12. response generation/port/sequence mismatch 仍被接受。
13. AEAD/AAD 任一字段篡改仍执行。
14. wrong release/protocol 被接受。
15. wrong extension id 被接受。
16. correct extension id + wrong Chrome profile 被接受。
17. wrong Chrome process ancestry 被 Host 接受。
18. authority hard expiry 后仍执行命令。
19. generic evaluate 可产生 side effect。
20. raw file path 进入 wire contract。
21. symlink/file drift 不被 grant 阻断。
22. Host 恢复 Node/shebang 生产链。
23. active-tab/current-page/focus fallback 复活。
24. non-idempotent uncertain mutation 自动重放。
25. second Controller 抢占同一 socket。
26. proof 后重建同版本不同字节仍获发布准入。
27. ArtifactSet V1、缺 artifactSetSha256 receipt 或 release sequence 回滚仍获准入。
28. 任一 Extension regular file 增删改名后 tree identity 不变。

## 21. 真实 Chrome 证明边界

未来执行真实 Chrome 证明时，同一候选至少覆盖 foreground marker 不变、Extension reload/worker restart、Host crash/Controller restart、stale Port challenge/disconnect/completion、heartbeat silent half-open/sleep-wake、wrong profile/process/release/protocol、stale target/document ref、DevTools conflict、mutation disconnect=>`OUTCOME_UNKNOWN` no replay、Unicode/CJK/emoji input、file grant drift、packaged artifact identity。

历史 screenshot、另一个 build 或 load-unpacked 结果不能证明当前发布 artifact。

## 22. 长期扩展规则

未来八字、奇门、合婚、起名、本地化、报告复核、Amazon、Deep Research 或其他业务需要更多网页能力时，只能增加 versioned command capability、declarative input schema、owner policy、permission/origin requirement、business postcondition、audit binding、acceptance/real-page proof。

不得修改或复制 Authority state model、mutual auth/grant ACK、NativePortActor generation fence、command permit/AEAD frame、Native Messaging main chain、Rust Host trust boundary、profile enrollment、ReleaseIdentity、exact target/document identity。

这就是“一劳永逸”的边界：功能可以持续增长，连接和信任地基不再被每个新功能重新发明。
