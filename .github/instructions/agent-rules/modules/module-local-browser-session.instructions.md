---
name: "GrassEye Browser Authority Infrastructure"
description: "Governs the production exact-target Chrome authority, extension, Native Host, profile enrollment, release identity and fail-closed lifecycle."
applyTo: "src/lib/browser/**, src/lib/local-runtime/workbench-browser-support.ts, src/lib/local-runtime/workbench-assembly.ts, src/lib/local-runtime/workbench-status.ts, src/lib/local-runtime/workbench.ts, src/app/server.ts, scripts/audit/domains/local-browser-session/**, scripts/acceptance/local-browser-*.ts"
---

# GrassEye Browser Authority Infrastructure

status: active  
version: 2026-08-18.4  
constitutional objective: `browserSession 未认证` 在生产类型、对象、API、运行态和证据中不可表示。

## 0. 唯一合法生产语义

浏览器数据面只有两个状态：

```txt
AUTHORITY_ABSENT
AUTHENTICATED_AUTHORITY_PRESENT
```

不存在第三种状态。禁止创建、返回、注入、缓存或展示“已经存在但尚未认证”的 BrowserSession、BrowserController 数据面、TargetSession 或兼容对象。

认证前允许存在的只有 Browser infrastructure control plane：profile enrollment、process supervisor、listener、Native Host transport candidate、challenge、pending authority candidate。它们没有页面命令接口、没有 target/document ref mint 权、不能注入任何业务 owner。

`AuthenticatedBrowserAuthority` 必须在 Controller challenge、Extension transcript proof、Controller authority grant、Extension grant ACK 全部成功后才由唯一 `BrowserAuthorityIssuer.commit()` 原子变成 PRESENT。握手任一步失败、Port/Host/Controller/Chrome 断裂、liveness lease 到期、profile/process/release/protocol 身份漂移，第一同步副作用必须是 revoke authority；随后才能 fail pending、写日志、detach、重连或清理。

## 1. 唯一生产链

```txt
Business owner
  -> BrowserController（仅在 Authority PRESENT 后由 composition root 构造）
      -> exact-target BrowserCommandRuntime
          -> 0600 controller-native.sock
              -> signed/self-contained Rust Native Host
                  -> Chrome Native Messaging
                      -> fixed-id MV3 extension
                          -> one NativePortActor per port epoch
                              -> chrome.debugger
                                  -> exact target + exact document generation
```

禁止第二 BrowserController、Playwright/CDP 公共旁路、AppleScript/JXA、系统鼠标键盘、clipboard、active-tab/current-page/URL-first fallback、第二 Native Host、第二 localhost/WebSocket transport、load-unpacked 生产链。

## 2. 运行身份

每条生产命令必须同时绑定：

```txt
releaseIdentity
protocolVersion
profileEnrollmentId
controllerSessionId
connectionGeneration
nativePortEpoch
authorityId
authorityCertificateHash
commandId
sequence
deadlineAt
mutationClass
```

Controller 与 Extension 每个 Port epoch 使用临时 P-256 ECDH，HKDF-SHA256 导出 frame key；command/response 使用 AES-256-GCM，AAD 至少包含 authorityId + generation + portEpoch + sequence。Extension authentication、authority grant、grant ACK、heartbeat 使用同一临时密钥的 HMAC proof。Native Host 不拥有密钥、target、业务状态或 evidence，只转发有界消息并验证外层 release/protocol/caller/profile process identity。

旧 generation、旧 port、旧 authority、旧 permit、旧异步 completion、旧 heartbeat 和迟到 disconnect 在任何状态修改或页面副作用前必须被拒绝。

## 3. Profile 与 Chrome process enrollment

生产必须显式提供并验证：

```txt
GRASSEYE_CHROME_USER_DATA_DIR
GRASSEYE_BROWSER_PROFILE_REF
GRASSEYE_BROWSER_PROFILE_DIRECTORY
GRASSEYE_CHROME_EXECUTABLE
fixed extension id = mepfnlhndaiihhfejbbhfehegpbdnipl
releaseIdentity = grasseye-browser-runtime-2026-08-18-v2
```

BrowserProcessSupervisor 只启动/连接该专用 Chrome：`--user-data-dir` 与 `--profile-directory` 必须显式出现。Rust Native Host 必须验证 Chrome 传入 caller origin，并在 Unix ancestry 中证明 Host 来源于同一 enrolled Chrome executable/user-data-dir/profile-directory。正确扩展 ID 但错误 profile/process 仍必须 fail closed。

禁止 silent managed default、读取 last_used 后猜 profile、普通个人 Chrome profile、错误 channel/process tree 获得 Authority。

## 4. Extension 与命令安全

- MV3 固定 extension ID、固定 release/protocol、`minimum_chrome_version`。
- 一个 Native Port 对应一个不可变 `NativePortActor`；禁止全局 mutable `nativePort/authenticatedNonce/lastAcceptedSequence` 作为跨世代真相。
- extension 只接受当前 actor 当前 authority 的 command permit；异步 completion 只能回原 actor 原 port。
- `evaluate_target` 仅为 observation；MV3 必须使用 CDP `throwOnSideEffect=true`。mutation 只能走专用命令。
- URL 在 Controller policy 与 Extension high-privilege end 双重验证；Extension 不接受 `file:`、任意 host 或未批准 HTTP。
- 普通字符输入使用 `Input.insertText`，不得用平台相关 Meta/Ctrl 猜测 Unicode 输入。
- file input 只接受 BrowserFileArtifactGrant；raw path 不得成为 wire contract。
- non-idempotent mutation 发出后若终局不确定，只能 `OUTCOME_UNKNOWN`；transport 永不自动 replay。

## 5. Liveness、失效和恢复

固定默认：

```txt
heartbeatIntervalMs = 1000
softDrainAfterMs = 3500
hardExpiryMs = 5000
watchdogTickMaxMs = 250
maxAuthorityAgeMs = 8h
```

Heartbeat 只能延长已经 commit 的 Authority liveness，永远不能从 ABSENT 创建 Authority。静默半开、Host 假活、event-loop stall、sleep/wake/clock discontinuity 或 authority age 到期都必须撤销当前 Authority。

任一 revoke 同步使所有 target/document refs 与当前 exact-target lease epoch 失效。恢复必须经过全新 Port epoch、全新 challenge、全新 grant+ACK 和新 Authority；旧 target/document ref 永不复活。调用方只能从明确业务 checkpoint 发起新的 `open/acquireTarget`。

## 6. Native Messaging 与消息预算

Chrome Native Messaging 外层必须遵守 4-byte native-endian length framing。内部更严格预算固定为：

```txt
Host -> Extension control frame <= 256 KiB
Extension -> Host <= 48 MiB
Controller <-> Host line <= 64 MiB
```

控制面不得为未来功能无限放大。大对象必须最终走 content-addressed artifact stream；任何超限/截断/非法 JSON/identity mismatch 都 fail closed。

## 7. 安装与发布

生产 Native Host 是 Rust 自包含预构建二进制。目标机器禁止从源码 build/transpile Native Host，禁止 Node shebang、nvm/Homebrew Node 路径成为 Native Host 运行依赖。

`install.mjs` 只允许调用预构建 `grasseye-browserctl`。browserctl 必须执行：

```txt
read signed/prebuilt artifact
-> stage immutable release dir
-> hash readback
-> write 0600 connection config
-> write exact allowed_origins manifest
-> write activation receipt
-> atomic rename/fsync
-> verify installed bytes/config/manifest
```

生产 extension 使用固定 Chrome Web Store identity；load-unpacked 只能用于开发/真实页面前验，不得成为 production artifact。

## 8. Composition root

`createWorkbenchAssembly()` 必须是 Authority admission gate：

```txt
resolve explicit profile enrollment
-> ensure enrolled Chrome process
-> start Controller listener
-> complete Extension/Controller mutual auth + grant ACK
-> AUTHENTICATED_AUTHORITY_PRESENT
-> only now construct AI Gateway / video / browser-dependent business owners
-> only now expose HTTP server
```

因此 production health 不得存在名为 `browserSession` 的 component，不得出现 `transportReady`，不得输出“session not authenticated / wait for authentication”。Authority 缺席时只能报告 `browserAuthority = absent/BLOCKED`；此时浏览器业务 owner 尚未构造或其旧 authority epoch 已失效。

```apex-law
{
  "lawId": "APEX-LOCAL-BROWSER-001-V2",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "local-browser-session",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance+real-chrome",
  "summary": "The unique Browser owner binds every page action to opaque exact target/document identities and never uses foreground identity or a second browser path.",
  "required": [
    "One BrowserController owns all raw Chrome identities and mints opaque target/document refs only under a committed AuthenticatedBrowserAuthority.",
    "Every page command binds one exact target and current document generation; navigation/lifecycle invalidates prior document refs.",
    "Background exact-target work leaves non-target foreground state unchanged.",
    "Old authority target/document refs never revive after revoke or reconnect."
  ],
  "forbidden": [
    "second BrowserController or browser transport",
    "active-tab, first-page, current-page or URL-first fallback",
    "raw Chrome identity outside src/lib/browser",
    "foreground focus, OS pointer, OS keyboard, clipboard or native picker as page identity"
  ],
  "clauses": [{
    "clauseId": "apex-local-browser-001-v2-requirement",
    "statement": "All page actions use one authenticated exact-target authority and opaque target/document identity.",
    "evidenceMode": "real-chrome",
    "ownerDomain": "local-browser-session"
  }]
}
```

```apex-law
{
  "lawId": "APEX-LOCAL-BROWSER-002-V2",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "local-browser-session",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance+model+real-chrome",
  "summary": "Unauthenticated browserSession is unrepresentable; browser capability exists only after mutual authority commit and is revoked before all teardown side effects.",
  "codePurityLiveness": {
    "externalEntryFiles": [
      "src/lib/browser/chrome-extension/build.mjs",
      "src/lib/browser/chrome-extension/service-worker.ts",
      "src/lib/browser/native-messaging-host/crates/host/src/main.rs",
      "src/lib/browser/native-messaging-host/crates/browserctl/src/main.rs"
    ]
  },
  "required": [
    "Production data-plane state is exactly AUTHORITY_ABSENT or AUTHENTICATED_AUTHORITY_PRESENT.",
    "BrowserAuthorityIssuer commits only after challenge, transcript proof, authority grant and Extension grant ACK all match the same release/profile/controller/generation/port epoch.",
    "Each Native Port has one actor; stale port message/disconnect/completion cannot mutate current authority, sequence or target state.",
    "Every command carries an authority-bound permit and an authenticated encrypted frame.",
    "Heartbeat can renew only an existing committed authority; expiry/release/disconnect revokes authority before failing pending work or reconnecting.",
    "Composition root creates browser-dependent business owners only after authority commit; HTTP server startup is downstream of this gate."
  ],
  "forbidden": [
    "BrowserSession object with authenticated=false, transportReady=false or waiting-for-auth state",
    "browserSession production health component",
    "global nativePort/authenticatedNonce/lastAcceptedSequence as cross-port truth",
    "nonce echo as the complete authentication proof",
    "old port completion posted to current port",
    "heartbeat creating authority",
    "mutation automatic replay after transport uncertainty"
  ],
  "clauses": [{
    "clauseId": "apex-local-browser-002-v2-requirement",
    "statement": "Unauthenticated browser capability is structurally impossible and all browser work is authority-bound.",
    "evidenceMode": "model+acceptance+real-chrome",
    "ownerDomain": "local-browser-session"
  }]
}
```

```apex-law
{
  "lawId": "APEX-LOCAL-BROWSER-003-V2",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "local-browser-session",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance+real-chrome",
  "summary": "The fixed-id MV3 extension is the only page/file action executor and exposes no physical-focus fallback.",
  "required": [
    "Navigate, observe, click, fill, scroll, screenshot and file input execute only through the exact-target MV3 transport.",
    "File input consumes a bounded file artifact grant and exact DOM receiver.",
    "Retired focus/native-picker/AppleScript/JXA paths remain physically absent."
  ],
  "forbidden": [
    "focus lease or focus-target command",
    "native picker or system clipboard",
    "OS pointer/keyboard page transport",
    "second file upload path"
  ],
  "clauses": [{
    "clauseId": "apex-local-browser-003-v2-requirement",
    "statement": "Only the fixed-id authenticated MV3 executor may perform browser page/file actions.",
    "evidenceMode": "real-chrome",
    "ownerDomain": "local-browser-session"
  }]
}
```

```apex-law
{
  "lawId": "APEX-LOCAL-BROWSER-004-V2",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "local-browser-session",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance+real-chrome",
  "summary": "Generic evaluation is side-effect-free observation while every mutation uses a dedicated exact-target command.",
  "required": [
    "BrowserTargetSession.evaluate function body is normalized exactly once by Browser owner.",
    "MV3 Runtime.evaluate for evaluate_target uses throwOnSideEffect=true and cannot mutate page state.",
    "Dedicated mutation commands perform receiver revalidation and mutation atomically under the same target/document authority.",
    "Unicode text uses Input.insertText and point click uses CDP input after side-effect-free receiver validation."
  ],
  "forbidden": [
    "generic evaluate mutation",
    "eval or Function constructor",
    "synthetic HTMLElement.click as the generic point click executor",
    "platform-specific Meta/Ctrl guessing for arbitrary text"
  ],
  "clauses": [{
    "clauseId": "apex-local-browser-004-v2-requirement",
    "statement": "Observation and mutation are mechanically separated at the high-privilege browser executor.",
    "evidenceMode": "real-chrome",
    "ownerDomain": "local-browser-session"
  }]
}
```

```apex-law
{
  "lawId": "APEX-LOCAL-BROWSER-005-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "local-browser-session",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance+artifact+real-chrome",
  "summary": "Browser runtime release/profile/install identity is immutable, prebuilt and fail-closed across Chrome and OS evolution.",
  "required": [
    "Extension ID, extension version, protocol, release identity, Native Host binary hash, profile enrollment and controller candidate are one release tuple.",
    "Production Native Host is a self-contained prebuilt Rust binary; target machines never compile/transpile it.",
    "Native Host caller origin and enrolled Chrome process ancestry are validated before Controller IPC.",
    "browserctl installs owner-only config/manifest and content-addressed host bytes using atomic write/readback.",
    "Chrome minimum version and compatibility matrix changes require current-artifact proof before production activation."
  ],
  "forbidden": [
    "Node shebang Native Host",
    "install-time source transpilation",
    "silent default profile",
    "load-unpacked production extension",
    "mixed release/protocol tuple",
    "unsigned or unverified production artifact activation"
  ],
  "clauses": [{
    "clauseId": "apex-local-browser-005-v1-requirement",
    "statement": "Only one immutable verified browser release/profile tuple may receive production authority.",
    "evidenceMode": "artifact+real-chrome",
    "ownerDomain": "local-browser-session"
  }]
}
```
