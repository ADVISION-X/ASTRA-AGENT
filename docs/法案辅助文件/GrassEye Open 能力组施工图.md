
GrassEye Open 能力组施工图.md
```

````markdown
# GrassEye Open 能力组施工图 FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-OPEN-BLUEPRINT-FINAL
owner: open-capability
documentType: construction-blueprint
lawAuthority: module-open-capability.instructions.md
architecturePhase: Static Capability Package Architecture
status: active
replace:
  - docs/法案辅助文件/GrassEye Open 能力组施工图.md
mustNotCreate:
  - new lawId
  - new ability group
  - platform-open owner
  - startup-open owner
  - page-state owner
  - post-action-verification owner
  - browser-controller owner
```

本施工图是 `module-open-capability.instructions.md` 的建设级落地映射。
本施工图不新增 lawId，不修改冻结法案，不重新分配主权。
若本文档与 Open 法案冲突，以 Open 法案为最高权威。

---

## 1. 定位

Open Ability Group 是 GrassEye 的“开门能力”。

它负责：

```txt
打开 governed target
解析 target profile
检查 caller policy
检查 URL safety
检查 real Chrome session
执行 browser open attempt
记录 open proof
生成 page-state handoff
返回 structured Open result
打开 governed macOS local program
生成 window/localAppState handoff
```

它不负责：

```txt
判断当前页面是否 feed ready / login wall / safety page
判断动作是否真的达成预期
截图
AI 判断
视觉目标识别
鼠标/键盘动作
本地程序内部操作
证据最终落盘
地图分支
任务推进
产品判断
评论抽取
```

一句话：

```txt
Open 只负责“把门打开”，不负责判断“门后面是不是目标状态”。
```

---

## 2. 故事链路位置

```txt
Orchestration
→ Nerve Bus
→ Open
→ browser open attempt
→ page-state handoff
→ Page State
→ Post-action Verification if map requires outcome verification
→ Forensics
```

Open 的结果是：

```txt
打开尝试 + handoff proof
```

不是：

```txt
页面 ready 真相
动作验证真相
最终业务成功
```

---

## 3. 标准包结构

```txt
src/capabilities/open/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── schema-base.ts
├── schema-core.ts
├── schema-runtime.ts
├── schema-proof.ts
├── registry.ts
├── index.ts
├── ports/
│   ├── open-browser-port.ts
│   ├── open-local-program-port.ts
│   ├── open-clock-port.ts
│   ├── open-idempotency-port.ts
│   └── open-profile-port.ts
├── shared/
│   ├── open-failure.ts
│   ├── open-policy.ts
│   ├── open-proof.ts
│   ├── open-result.ts
│   ├── open-target-profile.ts
│   └── open-url.ts
├── runtime/
│   ├── open-executor.ts
│   ├── open-executor-flow.ts
│   ├── open-executor-preflight.ts
│   ├── target-policy-gate.ts
│   ├── url-safety-gate.ts
│   ├── real-chrome-session-gate.ts
│   ├── open-idempotency.ts
│   ├── open-timeout-policy.ts
│   ├── navigation-runner.ts
│   ├── navigation-runner-support.ts
│   ├── post-open-state-gate.ts
│   ├── open-proof-builder.ts
│   └── open-result-builder.ts
└── children/
    ├── open-tiktok/
    ├── open-facebook/
    ├── open-local-workbench/
    └── open-local-program/
```

---

## 4. Public Contract

Public interface 只允许：

```ts
interface OpenAbilityGroup {
  listChildCapabilityIds(): OpenChildCapabilityId[];
  execute(input: OpenRequest): Promise<OpenResult>;
}
```

允许 public exports：

```txt
createOpenAbilityGroup
OPEN_ABILITY_GROUP_ID
OpenRequest
OpenResult
OpenRuntimeProof
OpenChildCapabilityId
OpenPlatformId
OpenTargetKind
OpenRequestSchema
OpenResultSchema
OpenRuntimeProofSchema
OpenBrowserPort type
OpenProfilePort type
OpenClockPort type
OpenIdempotencyPort type
```

禁止 public exports：

```txt
child implementation
runtime executor internals
BrowserController
platform adapter implementation
post-open gate internals as truth owner
page-state truth type
PAV verification type
Forensics writer type
```

---

## 5. Input Model

`OpenRequest` 必须包含：

```yaml
OpenRequest:
  abilityGroupId: open
  childCapabilityId: required
  requestedBy: orchestration | commander-console | startup-local-workbench
  sourceAbilityGroupId: required
  sourceChildCapabilityId: optional
  missionId: required
  runId: required
  sessionId: required
  roundId: optional
  videoVisitId: optional
  stepId: required
  mapPackageId: required
  mapPackageVersion: required
  selectedMapId: required
  selectedMapVersion: required
  activationSnapshotRef: required
  capabilityCallId: required
  nerveBusEnvelopeId: required
  platformId: required
  targetKind: required
  reason: required
  targetUrl: optional
  targetTitle: optional
  targetProfileRef: required for local-program, optional for URL targets
  sourceRef: required
  inputRef: required
  idempotencyKey: required
  timeoutMs: required
```

缺失以下字段不得 success：

```txt
stepId
capabilityCallId
activationSnapshotRef
nerveBusEnvelopeId
mapPackageVersion
selectedMapVersion
sourceRef
inputRef
idempotencyKey
timeoutMs
```

Invalid input failure 必须有：

```txt
receivedShapeHash
diagnosticPayloadRef
runtimeProof
```

---

## 6. Target Profile

`OpenTargetProfile` 必须区分 URL target 与 local program target，不得用假 URL 填充本地程序 profile。

URL / workbench target profile 必须定义：

```yaml
OpenTargetProfile:
  childCapabilityId: required
  targetKind: required
  platformId: required
  allowedHostnames: non-empty
  defaultUrl: required
  defaultTitle: required
  purpose: required
  allowedCaller: non-empty
  requiresNerveBus: boolean
  requiresRealChromeSession: boolean
  allowsLocalhost: boolean
  maxOpenDurationMs: required
  allowedSchemes: http | https
  postOpenStatePolicy: required
  pageStateHandoffRequired: true
  allowReplay: boolean
  timeoutPolicy: required
  idempotencyPolicy: required
  boundaryPolicy: required
  proofPolicy: required
  outputPolicy: required
  failurePolicy: required
```

Local program target profile 必须支持：

```yaml
LocalProgramOpenTargetProfile:
  childCapabilityId: open-local-program
  platformId: macos-local
  targetKind: local-program
  targetProfileRef: required
  appName: required
  bundleId: optional
  appPath: optional
  allowedLaunchMethod: macos-open-application
  requiresUserVisibleWindow: true
  requiresPostOpenWindowHandoff: true
  pageStateHandoffRequired: true
  localAppStateHandoffRequired: true
  allowedCaller: non-empty
  requiresNerveBus: true
  requiresRealChromeSession: false
  allowsLocalhost: false
  maxOpenDurationMs: required
  allowReplay: boolean
  timeoutPolicy: required
  idempotencyPolicy: required
  boundaryPolicy: required
  proofPolicy: required
  outputPolicy: required
  failurePolicy: required
```

Target profile 是 governed profile，不是 silent fallback。

禁止：

```txt
targetUrl ?? DEFAULT_TIKTOK_URL
platformId ?? tiktok
targetProfileRef fabricated
fake allow decision
fake target profile
fake localhost URL for local-program
```

---

## 7. Runtime Pipeline

Open executor 必须固定：

```txt
input schema gate
→ child registry gate
→ target profile gate
→ caller policy gate
→ target-kind dispatch gate
```

Web / workbench branch:

```txt
→ URL safety gate
→ real Chrome session gate
→ idempotency gate
→ timeout/cancellation gate
→ browser open attempt through OpenBrowserPort
→ after-session snapshot gate
→ post-open preliminary gate
→ page-state handoff builder
→ output boundary gate
→ proof builder
→ result builder
```

Local program branch:

```txt
local program profile gate
→ app launch safety gate
→ idempotency gate
→ timeout/cancellation gate
→ OpenLocalProgramPort.openLocalProgram
→ local program window snapshot gate
→ localAppState handoff builder
→ page-state/local-app-state handoff builder
→ proof builder
→ result builder
```

禁止：

```txt
child direct final result
child direct proof
executor skipping URL safety
executor skipping session gate
executor skipping idempotency
executor skipping timeout
browser open without AbortSignal
success without page-state handoff
local-program branch uses OpenBrowserPort
local-program branch uses URL fallback
local-program branch opens localhost workbench
local-program branch executes map step internally
```

---

## 8. Timeout / Cancellation

Open navigation must enforce:

```txt
AbortController created
AbortSignal passed to OpenBrowserPort.open
hard timeout race exists
timeout aborts signal
timeout returns typed failed/review result
late browser success cannot overwrite timed_out result
timeoutDecision recorded in proof
```

禁止：

```txt
Promise.race without AbortSignal
AbortSignal without hard timeout
timeout later overwritten by success
timeout without proof
```

---

## 9. Idempotency

Open idempotency policy：

```yaml
OpenIdempotencyPolicy:
  allowReplay: boolean
  scope: session_target_round_video_visit
  duplicateStatus: review_required
  ttlMs: positive
  maxReservations: positive
```

Required:

```txt
duplicate in-flight must not execute browser open.
already-on-target may return governed result only if freshness policy passes.
idempotency decision must enter proof.
failure after reservation must release/record according to port policy.
```

Forbidden:

```txt
duplicate continues execution.
duplicate returns fake success.
idempotencyKey fabricated after execution.
```

---

## 10. Page State Handoff

Open success requires:

```txt
pageStateHandoffRequired = true
pageStateHandoffRef exists
browserSessionRef exists
browserProfileRef exists
openAttemptRef exists
navigationAttemptRef exists
```

Post-open gate is only preliminary:

```yaml
postOpenDecision:
  authoritative: false
```

Open may preliminarily classify:

```txt
unknown
login_wall
captcha_wall
permission_wall
security_wall
blank_page
wrong_domain
local_workbench
platform_feed
```

But final truth belongs to:

```txt
Page State → current state
PAV → action result
```

Forbidden Open result fields:

```txt
feed_ready
login_required_verified
safety_page_verified
verificationDecision
verified
actionResultVerifiedRef
page_state_verified
```

---

## 11. Result Model

`OpenResult` 必须包含：

```yaml
OpenResult:
  abilityGroupId: open
  childCapabilityId: required
  platformId: required
  targetKind: required
  status: success | failed | review_required
  missionId: required
  runId: required
  sessionId: required
  roundId: optional
  videoVisitId: optional
  stepId: required
  mapPackageId: required
  mapPackageVersion: required
  selectedMapId: required
  selectedMapVersion: required
  activationSnapshotRef: required
  capabilityCallId: required
  nerveBusEnvelopeId: required
  targetUrl: optional
  openedUrl: optional
  targetTitle: optional
  pageTitleAfter: optional
  pageStateHandoffRequired: boolean
  output: required-if-success
  failureReason: required-if-failed
  reviewRequiredReason: required-if-review_required
  diagnosticPayloadRef: required-if-not-success
  runtimeProof: required
  dataQualityFlags: list
```

Success:

```txt
output exists
outputRef exists
pageStateHandoffRef exists
runtimeProof exists
critical data quality flags absent
```

Failure/review:

```txt
output = null
diagnosticPayloadRef exists
reason exists
runtimeProof exists
```

---

## 12. Runtime Proof

`OpenRuntimeProof` 必须包含：

```yaml
OpenRuntimeProof:
  proofId: required
  missionId: required
  runId: required
  sessionId: required
  roundId: optional
  videoVisitId: optional
  stepId: required
  mapPackageId: required
  mapPackageVersion: required
  selectedMapId: required
  selectedMapVersion: required
  activationSnapshotRef: required
  capabilityCallId: required
  nerveBusEnvelopeId: required
  abilityGroupId: open
  childCapabilityId: required
  platformId: required
  targetKind: required
  sourceAbilityGroupId: required
  sourceChildCapabilityId: optional
  inputRef: required
  outputRef: required-if-success
  diagnosticPayloadRef: required-if-not-success
  targetProfileRef: required
  targetUrl: required
  targetUrlSource: required
  openedUrl: optional
  redirectChain: list
  browserProfileRef: required
  browserMode: required
  profileVerificationStatus: required
  browserSessionRef: required
  loginStateBefore: required
  loginStateAfter: required
  pageTitleAfter: optional
  idempotencyKey: required
  idempotencyDecision: required
  openAttemptRef: required
  navigationCallId: required
  navigationAttemptRef: required
  timeoutDecision: required
  abortDecision: required
  circuitBreakerState: required
  targetPolicyDecision: required
  urlSafetyDecision: required
  sessionDecision: required
  navigationDecision: required
  postOpenDecision: required
  preliminaryOpenClassification: required
  pageStateHandoffRequired: true
  pageStateHandoffRef: required-if-success
  sourceRef: required
  sessionSnapshotAvailable: boolean
  sessionSnapshotFailureReason: optional
  startedAt: required
  endedAt: required
  durationMs: required
  status: required
  failureReason: optional
  reviewRequiredReason: optional
  dataQualityFlags: list
  clock: required
  receivedShapeHash: required-if-invalid-input
```

禁止：

```txt
runtimeProof:null
runId from fingerprint
missionId from source owner
missing activationSnapshotRef
success proof without outputRef
failed proof with outputRef
```

---

## 13. Child Capabilities

| child | target | platform | special rule |
|---|---|---|---|
| open-tiktok | TikTok web feed/page | tiktok-web | no localhost |
| open-facebook | Facebook web feed/page | facebook-web | no localhost |
| open-local-workbench | local workbench URL | local-workbench | localhost allowed only by profile; not a macOS app |
| open-local-program | governed macOS local program | macos-local | app profile required; no arbitrary shell command |

| profile | app | platform | special rule |
|---|---|---|---|
| macos-app:iphone-mirroring | iPhone Mirroring | macos-local | opens app/window only; Facebook App inside iPhone is handled by visual chain |

Every child must:

```txt
have contract/schema/implementation
bind to one target profile
call unified open runtime
avoid sibling import
avoid direct BrowserController
avoid final Page State/PAV truth
avoid direct shell/app launch outside OpenLocalProgramPort
avoid click/type/screenshot inside local program
```

---

## 14. 边界

### Page State

Open only creates handoff.
Page State decides current page state.

### PAV

Open only reports open attempt.
PAV verifies whether expected open outcome occurred.

### Screenshot / Visual Target / AI

Open does not call them.

### Orchestration

Orchestration calls Open.
Open does not branch mission.

### Forensics

Open does not write final evidence.
Open returns proof refs for Forensics to persist later.

---

## 15. 执法系统

Must exist:

```txt
scripts/audit/domains/open-capability/manifest.json
scripts/audit/domains/open-capability/inspector.ts
scripts/audit/domains/open-capability/run-inspector.ts
scripts/audit/domains/open-capability/negative-proof-harness.ts
```

Inspector must use:

```txt
ts-morph
AST-level
symbol-level
import graph-level
schema-level
anti-escape
generated artifact aware
runner-connected
negative-proof-backed
```

Forbidden:

```txt
regex final judgment
grep final judgment
includes final judgment
manual-only proof
warning-only P0
detached inspector
empty negative proof
verify script as release truth
```

---

## 16. Inspector 必查

```txt
1. Law file is machine-blocking.
2. Public contract open-only.
3. Input schema includes full chain fields.
4. Target profile gate invoked.
5. Caller policy gate invoked.
6. URL safety gate invoked.
7. Real Chrome session gate invoked.
8. Idempotency gate invoked.
9. Timeout/AbortSignal gate invoked.
10. Browser open only through OpenBrowserPort.
11. Page-state handoff required on success.
12. Post-open gate non-authoritative.
13. No Page State/PAV truth fields in Open result.
14. Result/proof/input chain parity.
15. Children use unified runtime.
16. No forbidden imports/symbols/cookie/DOM/BOM.
17. No second open owner in platform/startup/runtime.
18. ALL active laws in registry/matrix/audit-plan/runner.
19. negative proof executed.
20. open-local-program child/port/profile/proof exists.
21. open-local-workbench cannot represent local-program.
22. local-program success requires windowHandoffRef/localAppStateHandoffRef.
23. map/scenario/debug-loop cannot bypass Open for local program launch.
```

---

## 17. Negative Proof 最低清单

Must fail → rollback → pass:

```txt
manual-first enforcement reintroduced
remove capabilityCallId from input
remove activationSnapshotRef from input
remove nerveBusEnvelopeId from input
targetUrl fallback to DEFAULT_TIKTOK_URL
URL safety gate removed
real Chrome session gate removed
timeout AbortSignal removed
duplicate in-flight continues execution
Open success without pageStateHandoffRef
login wall returns success
result adds verificationDecision
result adds feed_ready
proof runId from fingerprint
proof missing activationSnapshotRef
child imports sibling implementation
child imports BrowserController
Open imports screenshot implementation
Open reads document.cookie
external platform adapter adds openFeed
startup owns platform open helper
turn P0 into warning-only
remove negative proof invocation
remove open-local-program from required children
remove open-local-program from registry
remove macos-local from OPEN_PLATFORM_IDS
remove local-program from OPEN_TARGET_KINDS
map uses open-local-workbench with targetKind=local-program
open-local-program launches raw user command
open-local-program uses unvalidated open -a input
open-local-program succeeds without windowHandoffRef
open-local-program succeeds without localAppStateHandoffRef
open-local-program imports mouse-click
open-local-program imports screenshot
open-local-program uses localhost fake URL
debug-loop opens local program directly in mission-runtime
```

---

## 18. READY 标准

Open READY 仅当：

```txt
Open 法案 / 施工图 / inspector / generated / runner 口径一致
ALL active law enforcement PASS
CI-FULL PASS
input chain fields complete
target/profile/url/session/idempotency/timeout pipeline complete
browser open only through OpenBrowserPort
timeout hard-fails with AbortSignal
page-state handoff required
Open has no Page State/PAV truth
result/proof/input chain parity
children narrow target-open bindings
negative proof PASS
```

---

## 19. 漂移信号

```txt
Platform adapter declares openFeed/openTargetPage
Startup opens platform directly
Open proof lacks activationSnapshotRef
Open result exposes feed_ready
Open success lacks pageStateHandoffRef
Open reads document.cookie
Open child imports BrowserController
Open targetUrl fallback uses DEFAULT_TIKTOK_URL
open-local-workbench claims targetKind local-program
open-local-program uses localhost fake URL
debug-loop directly launches Mac app during mission-runtime
verify script becomes release gate
```

---

## 20. 最终原则

```txt
Open 是“打开目标”。
Page State 是“现在页面是什么”。
PAV 是“打开动作是否达成预期”。
Screenshot/Visual Target 是“我看见了”。
Orchestration 是“下一步怎么走”。
这些不能混。

Open local-program 只负责打开 Mac 程序和生成窗口 handoff。
程序内部页面状态由 Page State 判断。
程序内部画面由 Screenshot 采集。
程序内部按钮由 Visual Target 定位。
坐标安全由 Geometry Guard 验证。
点击/输入/滚动由对应能力组执行。
动作结果由 PAV 验证。
证据由 Forensics 记录。
```
````

## 21. Runtime Debug Loop 补充：OpenLocalProgramPort wiring

正确链路：
- Workbench Open runtime 必须向 `createOpenAbilityGroup()` 注入 governed `OpenLocalProgramPort`。
- iPhone Mirroring/macOS local-program map 必须从 `open-local-program` 开始，并由 Open owner 生成 `windowHandoffRef` 与 `localAppStateHandoffRef`。
- mission preflight 必须在用户命令 dispatch 前检查 local-program readiness。

禁止链路：
- `open-local-workbench` 冒充 local-program。
- map package、debug-loop、Commander 或 Orchestration 直接 shell/open/osascript 启动 app。
- Open 成功结果缺少 window/local app state handoff refs。

inspector 应覆盖：
- `workbench-open-runtime.ts` 必须注入 `createGovernedMacOSOpenLocalProgramAdapter()`。
- `workbench-status.ts` 必须包含 local-program readiness block。
- local-program execution helper 不得 `shell: true`。
- capability catalog 必须保留 `macos-local/local-program-window/desktop-screen` supported targets。

negative proof 应覆盖：
- 删除 OpenLocalProgramPort 注入。
- 删除 readiness block。
- 删除 `windowHandoffRef` 或 `localAppStateHandoffRef`。
- 将 local-program helper 改为 shell execution。

结构化日志必备字段：
- childCapabilityId、targetProfileRef、bundleId、openAttemptRef、appLaunchAttemptRef、windowHandoffRef、localAppStateHandoffRef、ownerResponsible、actionableMessage。

READY 标准：
- 真实重启后 mirroring task 不再出现 `OpenLocalProgramPort is not configured`。
- 修复后必须真实触发任务并重新执行第一阶段日志分析。
