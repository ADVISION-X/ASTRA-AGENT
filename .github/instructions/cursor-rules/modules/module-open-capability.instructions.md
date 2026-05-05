---
name: "GrassEye Open Capability"
description: "Use when governing the independent Open Ability Group, target opening, navigation attempt proof, real Chrome session handoff, URL safety, target policy, idempotency, timeout/cancellation, page-state handoff, and the boundary that prevents platform adapters/startup/runtime from owning open truth."
applyTo: ".github/instructions/cursor-rules/modules/module-open-capability.instructions.md, src/capabilities/open/**, docs/法案辅助文件/GrassEye Open 能力组施工图.md, scripts/audit/domains/open-capability/**"
---

# GrassEye Open Capability FINAL

Scope: governs the independent Open Ability Group, child open abilities, open request/result contract, target policy, URL safety, real Chrome session gate, navigation attempt, timeout/cancellation, idempotency, page-state handoff, open runtime proof, and open ownership boundaries.

Boundary: this module governs only **opening a governed target** and producing an open attempt/result/proof. It does not govern current page-state truth, action-result verification truth, screenshot capture, AI execution, visual target detection, coordinate/mouse action, text input, Forensics persistence truth, map branching, mission progression, product judgement, or comment extraction.

Authority: this file is authoritative only for the `open-capability` domain.

Architecture phase: `Static Capability Package Architecture`.

Core doctrine:
- Open is the door hand.
- Open may open a governed target, not decide whether the page is ready.
- Open success means a governed navigation/open attempt produced a structured handoff; it is not final page-state truth.
- Page State owns current-state truth after Open.
- Post-action Verification owns action-result truth after Open when a map requires outcome verification.
- Open must never silently pick a platform/map/page.
- Open must never read cookies, DOM/BOM, or private browser state directly.
- Open must never become platform adapter, browser controller, Orchestration, Page State, PAV, Screenshot, AI, or Forensics.
- No page-state handoff, no Open success.
- No runtime proof, no Open result.
- No active Open law without inspector + runner + negative proof.

---

## Global Open Baseline

All active Open laws in this file are:

```yaml
status: active
tier: P0
capabilityDomain: open-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof
```

Required package:

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
├── shared/
├── runtime/
└── children/
```

Required children:

```txt
open-tiktok
open-facebook
open-local-workbench
open-local-program
```

Required enforcement:

```txt
scripts/audit/domains/open-capability/
├── manifest.json
├── inspector.ts
├── run-inspector.ts
└── negative-proof-harness.ts
```

Forbidden:
- `manual-first` as active enforcement for this domain.
- `evidenceMode: law` as sufficient evidence.
- verify scripts as release truth.
- detached inspector.
- warning-only P0.
- generated fake PASS.
- empty negative proof.

---

## Law GRASSEYE-OPEN-CAPABILITY-001-V2

status: active
tier: P0
capabilityDomain: open-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Open Ability Group is the only owner of governed open behavior.

### 主题

唯一打开主权

### 法条

Open Ability Group is the only owner of governed open behavior.

Required:
- All governed target opening must flow through `src/capabilities/open`.
- Open root must expose one canonical public contract.
- `open-tiktok`, `open-facebook`, `open-local-workbench`, and `open-local-program` must exist as child capabilities.
- Startup may open local workbench only through Open public surface.
- Platform adapters may consume Open results only through public contract.
- Agent runtime, local shell, startup, platform adapters, and deleted historical owners must not own platform-open truth.

Forbidden:
- PlatformAdapter owning `openFeed`, `openTargetPage`, `openPlatform`, or hidden open helpers.
- Startup owning platform-open truth.
- Local shell owning open truth.
- Agent runtime owning open behavior.
- Adapter-specific shadow open result contracts.
- Shell-owned duplicate open helpers.
- Open child importing another open child implementation.

Required inspector:
- Import graph checks for second open owners.
- Symbol checks for shadow open helper names outside Open.
- Startup/local shell route check.
- Child registry and folder parity.

Required negative proof:
- Add `openFeed` to platform adapter → FAIL.
- Add startup platform open helper → FAIL.
- Add direct import of open child implementation from another child → FAIL.

---

## Law GRASSEYE-OPEN-CAPABILITY-002-V2

status: active
tier: P0
capabilityDomain: open-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Open boundary stays pure and cannot own state, verification, AI, screenshot, visual target, action, Forensics, or mission branching truth.

### 主题

纯打开边界

### 法条

Open only opens the target, records open attempt proof, produces page-state handoff, and returns structured Open result.

Allowed:
- target profile resolution
- target URL safety check
- real Chrome session gate
- navigation/open attempt through OpenBrowserPort
- idempotency reserve/commit/release
- timeout/cancellation for navigation
- post-open preliminary classification only as non-authoritative handoff metadata
- page-state handoff ref creation
- runtime proof/result construction

Forbidden:
- screenshot capture
- AI call
- visual target detection
- coordinate/mouse/text action
- page-state final classification
- post-action verification decision
- Forensics final write
- product judgement
- comment extraction
- Orchestration branch decision
- DOM/BOM lookup
- cookie/localStorage/sessionStorage read
- raw BrowserController usage outside OpenBrowserPort

Required inspector:
- Forbidden imports under `src/capabilities/open/**`.
- Forbidden symbols: screenshot, ai, visual-target, mouse, text-input, forensics, orchestration, querySelector, document/window/cookie/localStorage/sessionStorage.
- Page-state/PAV truth field ban.

Required negative proof:
- Open imports screenshot implementation → FAIL.
- Open reads `document.cookie` → FAIL.
- Open result exposes `verificationDecision` → FAIL.
- Open claims `feed_ready` as authoritative Page State → FAIL.

---

## Law GRASSEYE-OPEN-CAPABILITY-003-V2

status: active
tier: P0
capabilityDomain: open-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Open input must carry governed chain fields, target profile context, source proof, timeout, and idempotency.

### 主题

Open 输入链路完整性

### 法条

Every `OpenRequest` must be traceable to the mission/map/step/capability call that requested the open.

Required input fields:

```txt
abilityGroupId = open
childCapabilityId
requestedBy
sourceAbilityGroupId
sourceChildCapabilityId
missionId
runId
sessionId
roundId or visitId
videoVisitId where available
stepId
mapPackageId
mapPackageVersion
selectedMapId
selectedMapVersion
activationSnapshotRef
capabilityCallId
nerveBusEnvelopeId
platformId
targetKind
reason
targetUrl or targetProfileRef
targetTitle optional
sourceRef
inputRef
idempotencyKey
timeoutMs
```

Required:
- Missing `stepId`, `capabilityCallId`, `activationSnapshotRef`, `nerveBusEnvelopeId`, `mapPackageVersion`, or `selectedMapVersion` must fail/review_required; never success.
- `targetUrl` must be resolved only through target profile + explicit request policy.
- `sourceRef` must identify the upstream command/map step/request proof.
- Open must not fabricate mission/run/map/step chain fields.
- Invalid input failure must include receivedShapeHash and typed proof.

Forbidden:
- Silent default platform.
- Silent default URL.
- `requestedBy` not in caller allowlist.
- Success without chain fields.
- Success without idempotencyKey.
- Success without timeoutMs.

Required inspector:
- Schema field existence.
- Input gate call order.
- No default platform/URL pattern.
- Invalid input failure proof.

Required negative proof:
- Remove `activationSnapshotRef` from input → FAIL.
- Remove `capabilityCallId` from input → FAIL.
- Remove `nerveBusEnvelopeId` from input → FAIL.
- Add `targetUrl ?? DEFAULT_TIKTOK_URL` → FAIL.

---

## Law GRASSEYE-OPEN-CAPABILITY-004-V2

status: active
tier: P0
capabilityDomain: open-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Open must run a fixed target/profile/session/navigation/idempotency/timeout/page-state-handoff pipeline.

### 主题

Open 单链执行管线

### 法条

Open execution pipeline must be fixed:

```txt
input schema gate
→ child registry gate
→ target profile gate
→ caller policy gate
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

Required:
- `child registry gate` must reject unknown child.
- `target profile gate` must reject missing/fake profiles.
- `caller policy gate` must reject unauthorized caller.
- `URL safety gate` must allow only governed schemes/hosts.
- `real Chrome session gate` must require persistent real browser session unless local-workbench profile explicitly allows local mode.
- `idempotency gate` must prevent duplicate open runs according to policy.
- `timeout/cancellation gate` must propagate AbortSignal and enforce hard timeout.
- `after-session snapshot gate` must be safe and typed.
- `post-open preliminary gate` must be non-authoritative.
- `page-state handoff builder` must produce handoff ref on success.

Forbidden:
- fake allow decision.
- fake target profile.
- fallback invalid URL as success.
- raw browser open without timeout.
- raw browser open without AbortSignal.
- browser open success overriding timeout.
- duplicate in-flight continuing execution.
- post-open gate becoming Page State truth.
- child direct final result/proof.

Required inspector:
- Pipeline call order.
- Required gate presence.
- Timeout/AbortSignal presence.
- Idempotency execution presence.
- Post-open non-authoritative proof.

Required negative proof:
- Remove URL safety gate → FAIL.
- Remove real Chrome session gate → FAIL.
- Remove idempotency gate → FAIL.
- Remove timeout AbortSignal → FAIL.
- Make post-open gate authoritative → FAIL.

---

## Law GRASSEYE-OPEN-CAPABILITY-005-V2

status: active
tier: P0
capabilityDomain: open-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Open success requires page-state handoff and must not claim page-state readiness or action-result verification.

### 主题

Page State handoff 必须存在但不得越权

### 法条

Open success requires a Page State handoff, but Open must not claim final Page State or action-result truth.

Required success fields:

```txt
pageStateHandoffRequired = true
pageStateHandoffRef
browserSessionRef
browserProfileRef
openAttemptRef
navigationAttemptRef
openedUrl
targetUrl
redirectChain
loginStateBefore
loginStateAfter as raw session metadata only
```

Post-open preliminary classifications may include only:

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

Required:
- `postOpenDecision.authoritative = false`.
- `success` requires `pageStateHandoffRef`.
- Login/security/captcha/permission walls must return review_required, not success.
- Wrong domain and blank invalid page must fail/review_required.
- Page State decides feed-ready/login-required/safety-page final truth.
- PAV decides whether open achieved expected outcome when required by map.

Forbidden:
- Open returning `feed_ready`.
- Open returning `page_state_verified`.
- Open returning `verificationDecision`.
- Open returning `actionResultVerifiedRef`.
- Open success without pageStateHandoffRef.
- Open success on login wall/security wall.
- Open treating documentReadyState as final state truth.

Required inspector:
- Result schema superRefine.
- Post-open gate non-authoritative field.
- Forbidden PAV/Page-State truth fields.
- Success handoff required.

Required negative proof:
- Open success without pageStateHandoffRef → FAIL.
- Login wall returns success → FAIL.
- Result includes verificationDecision → FAIL.
- Result includes feed_ready → FAIL.

---

## Law GRASSEYE-OPEN-CAPABILITY-006-V2

status: active
tier: P0
capabilityDomain: open-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Open result and runtime proof must preserve real upstream chain, gate decisions, browser attempt refs, timeout/cancellation, idempotency, and page-state handoff.

### 主题

Open 结果与运行证明完整性

### 法条

`OpenResult` and `OpenRuntimeProof` must preserve the same real upstream chain as input.

Required `OpenResult` fields:

```txt
abilityGroupId
childCapabilityId
platformId
targetKind
status = success | failed | review_required
missionId
runId
sessionId
roundId or visitId
videoVisitId
stepId
mapPackageId
mapPackageVersion
selectedMapId
selectedMapVersion
activationSnapshotRef
capabilityCallId
nerveBusEnvelopeId
targetUrl
openedUrl
targetTitle
pageTitleAfter
pageStateHandoffRequired
output
failureReason
reviewRequiredReason
diagnosticPayloadRef if failed/review
runtimeProof
dataQualityFlags
```

Required `OpenRuntimeProof` fields:

```txt
proofId
missionId
runId
sessionId
roundId or visitId
videoVisitId
stepId
mapPackageId
mapPackageVersion
selectedMapId
selectedMapVersion
activationSnapshotRef
capabilityCallId
nerveBusEnvelopeId
abilityGroupId = open
childCapabilityId
platformId
targetKind
sourceAbilityGroupId
sourceChildCapabilityId
inputRef
outputRef or diagnosticPayloadRef
targetProfileRef
targetUrl
targetUrlSource
openedUrl
redirectChain
browserProfileRef
browserMode
profileVerificationStatus
browserSessionRef
loginStateBefore
loginStateAfter
pageTitleAfter
idempotencyKey
idempotencyDecision
openAttemptRef
navigationCallId
navigationAttemptRef
timeoutDecision
abortDecision
circuitBreakerState
targetPolicyDecision
urlSafetyDecision
sessionDecision
navigationDecision
postOpenDecision
preliminaryOpenClassification
pageStateHandoffRequired
pageStateHandoffRef
sourceRef
sessionSnapshotAvailable
sessionSnapshotFailureReason
startedAt
endedAt
durationMs
status
failureReason
reviewRequiredReason
dataQualityFlags
clock
receivedShapeHash if invalid input
```

Required:
- result/proof/input chain parity.
- `success` requires output + outputRef + pageStateHandoffRef.
- `failed/review_required` requires output null + diagnosticPayloadRef.
- `runtimeProof.status === result.status`.
- No nullable chain fields for valid execution.
- Invalid input failure may use receivedShapeHash and typed proof.

Forbidden:
- `runtimeProof: null`.
- `status: ok`.
- `status: persisted`.
- fabricated runId/missionId/stepId from source names or fingerprints.
- proof/result chain mismatch.
- success with critical data quality flags.
- failed/review_required with output.

Required inspector:
- Schema field checks.
- Result/proof/input parity.
- No fabricated chain pattern.
- Success/failure proof invariants.

Required negative proof:
- Remove `activationSnapshotRef` from proof → FAIL.
- Set runId from fingerprint → FAIL.
- Success without outputRef → FAIL.
- Failed with output → FAIL.

---

## Law GRASSEYE-OPEN-CAPABILITY-007-V2

status: active
tier: P0
capabilityDomain: open-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: child capabilities are narrow target-open bindings and must use unified Open runtime.

### 主题

子能力窄职责与统一运行链

### 法条

Active child capabilities:

```txt
open-tiktok
open-facebook
open-local-workbench
open-local-program
```

Required:
- Each child has `contract.ts`, `schema.ts`, `implementation.ts`.
- Each child binds one governed target profile.
- Each child uses unified `executeOpenChildFlow` or equivalent single Open runtime path.
- Web/workbench child implementation must not open directly except through runtime OpenBrowserPort.
- Local program child implementation must not open directly except through governed OpenLocalProgramPort.
- Child must not call another child.
- Child must not build final proof/result except through shared Open result/proof builder.
- Local workbench may allow localhost only through its own governed target profile.
- Local workbench must not represent macOS local program launch.
- Local program must not use localhost/workbench URL fallback.

Forbidden:
- child importing sibling child implementation.
- child hardcoding unrelated platform URL outside target profile.
- child returning raw boolean.
- child building `OpenRuntimeProof` directly.
- child direct BrowserController import.
- child direct page-state/PAV claim.
- child direct local app launch outside OpenLocalProgramPort.
- child using `open-local-workbench` for `targetKind=local-program`.

Required inspector:
- Child folder/registry/schema parity.
- Child implementation unified runtime call.
- No sibling imports.
- No raw browser/controller import.
- No final proof builder inside child if law requires centralized builder.

Required negative proof:
- Child imports sibling implementation → FAIL.
- Child returns boolean → FAIL.
- Child imports BrowserController → FAIL.
- Child sets pageState verified field → FAIL.
- open-local-program imports OpenBrowserPort as local program execution channel → FAIL.
- open-local-program uses raw shell app launch → FAIL.

---

## Law GRASSEYE-OPEN-CAPABILITY-009-V1

status: active  
tier: P0  
capabilityDomain: open-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: Open must support governed macOS local program launch as a first-class target and must not confuse local program opening with local workbench URL opening.

### 主题

本地程序打开主权

### 法条

Open Ability Group must support governed macOS local program launch as a first-class Open child capability.

Required:
- `open-local-program` must exist as an Open child capability.
- `open-local-program` must open only governed local application targets.
- `open-local-workbench` remains only for localhost workbench URLs.
- `open-local-workbench` must not be used to represent macOS local program launch.
- `open-facebook` and `open-tiktok` remain web-platform open children, not native app launch children.
- Local program target profile must include:
  - `platformId = macos-local`
  - `targetKind = local-program`
  - `appName`
  - `bundleId` or governed `appPath`
  - `targetProfileRef`
  - `allowedLaunchMethod`
  - `requiresUserVisibleWindow = true`
  - `requiresPostOpenWindowHandoff = true`
  - `allowedCaller`
  - `timeoutPolicy`
  - `idempotencyPolicy`
  - `proofPolicy`
- Open may call only a governed `OpenLocalProgramPort` for local program launch.
- Open success must produce:
  - `localProgramOpenAttemptRef`
  - `appLaunchAttemptRef`
  - `appName`
  - `bundleId` or governed `appPath`
  - `windowHandoffRef`
  - `localAppStateHandoffRef`
  - `runtimeProof`
- Open must not decide internal app state.
- Open must not click/type/scroll/screenshot inside the app.
- App internal state belongs to Page State / Screenshot / Visual Target / PAV after handoff.

Forbidden:
- using `open-local-workbench` to open macOS apps.
- treating localhost workbench as local program.
- launching arbitrary app without governed profile.
- shelling out arbitrary command from map.
- accepting raw user-provided shell command as app launch.
- `open -a ${userInput}` with unvalidated app name.
- direct AppleScript / osascript in map package.
- local program Open deciding app internal page/state.
- local program Open clicking or typing inside the app.
- local program Open reading app private data.
- local program Open bypassing Page State / Screenshot / Visual Target handoff.
- debug-loop launching local program directly for mission runtime.

Required inspector:
- `open-local-program` child folder/registry/schema/contract exists.
- target profile distinguishes `local-workbench` from `local-program`.
- `open-local-workbench` cannot be used with `targetKind=local-program`.
- `open-local-program` uses governed `OpenLocalProgramPort`, not arbitrary shell command.
- appName/bundleId/appPath must come from governed target profile.
- success requires `windowHandoffRef` and `localAppStateHandoffRef`.
- no direct click/type/screenshot/AI logic in `open-local-program`.
- map/scenario/debug-loop cannot bypass Open for local program launch.

Required negative proof:
- map uses `open-local-workbench` for `targetKind=local-program` → FAIL.
- `open-local-program` launches raw user command → FAIL.
- `open-local-program` uses unvalidated `open -a ${input}` → FAIL.
- `open-local-program` succeeds without `windowHandoffRef` → FAIL.
- `open-local-program` succeeds without `localAppStateHandoffRef` → FAIL.
- `open-local-program` clicks/types inside app → FAIL.
- debug-loop opens local program directly during mission-runtime → FAIL.

---

## Law GRASSEYE-OPEN-CAPABILITY-008-V2

status: active
tier: P0
capabilityDomain: open-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Open enforcement must close through owner-local AST/symbol/import-graph inspector, runner, and negative proof.

### 主题

Open 执法唯一入口

### 法条

Open enforcement must close through:

```txt
scripts/audit/domains/open-capability/manifest.json
scripts/audit/domains/open-capability/inspector.ts
scripts/audit/domains/open-capability/run-inspector.ts
scripts/audit/domains/open-capability/negative-proof-harness.ts
```

Required:
- Inspector must use ts-morph AST-level checks.
- Inspector must use symbol and import-graph checks.
- Inspector must use schema-level checks.
- Inspector must include anti-escape checks.
- Inspector must verify active law coverage in registry/matrix/audit-plan/runner.
- Negative proof must run and report fail → rollback → pass.
- CI-FULL must be green for delivery.
- No grep/regex/includes as final judgment.
- No warning-only P0.
- No detached inspector.
- No empty negative proof.
- No generated fake PASS.
- No verify script.
- No capability-check.ts under Open root.

Required inspector checks:
```txt
1. Law file is machine-blocking.
2. Open public contract is open-only.
3. Input schema includes full chain fields.
4. Target profile gate invoked.
5. Caller policy gate invoked.
6. URL safety gate invoked.
7. Real Chrome session gate invoked.
8. Idempotency gate invoked.
9. Timeout/AbortSignal gate invoked.
10. Browser open happens only through OpenBrowserPort.
11. Page-state handoff required on success.
12. Open result has no Page State/PAV truth fields.
13. Result/proof/input chain parity.
14. Children use unified runtime.
15. No forbidden imports/symbols/cookies/DOM/BOM.
16. External second-open owners forbidden.
17. ALL active Open laws in registry/matrix/audit-plan/runner.
18. negative-proof-harness executed.
```

Required negative proof:
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
```

---

## Final Readiness Gate

Open is READY only when:

```txt
law/blueprint/inspector/generated/runner agree
all active Open laws are machine-blocking
Open public contract is open-only
input chain fields complete
target profile/caller/url/session/idempotency/timeout pipeline enforced
browser open goes only through OpenBrowserPort
timeout hard-fails with AbortSignal
page-state handoff required on success
Open does not own Page State/PAV truth
result/proof/input chain parity passes
children are narrow target-open bindings
owner-local inspector PASS
negative proof PASS
ALL active law enforcement PASS
CI-FULL PASS
```
