---
name: "GrassEye Mouse Scroll Capability"
description: "Use when governing the independent Mouse Scroll Ability Group, governed browser/desktop/region scroll execution, Geometry Guard approved anchor/region consumption, primitive scroll port boundary, scroll magnitude policy, idempotency, repeat limits, timeout/cancellation, post-action verification handoff, and the boundary that prevents Mouse Scroll from computing coordinates, remapping geometry, claiming scroll-result truth, or writing final action logs."
applyTo: ".github/instructions/cursor-rules/modules/module-mouse-scroll-capability.instructions.md, src/capabilities/mouse-scroll/**, docs/法案辅助文件/GrassEye Mouse Scroll 能力组施工图.md, scripts/audit/domains/mouse-scroll-capability/**, src/lib/local-runtime/**, src/lib/browser/**, src/features/platform-action/**"
---

# GrassEye Mouse Scroll Capability FINAL

Scope: governs the independent Mouse Scroll Ability Group, governed scroll input, Geometry Guard approved executable anchor/region consumption, explicit direction/magnitude/repeat policy, primitive scroll execution through port, idempotency, timeout/cancellation, primitive execution proof, post-action verification handoff, and Mouse Scroll runtime proof.

Boundary: this module governs only primitive scroll execution after Geometry Guard has allowed executable anchor/region geometry. It does not govern screenshot capture, target detection, coordinate mapping, scale mapping, AI execution, click execution, comment capture, product classification, page-state truth, post-action verification truth, next-video verification, Forensics final action-log persistence, map branching, browser controller ownership, or platform business verbs.

Authority: this file is authoritative only for the `mouse-scroll-capability` domain.

Architecture phase: `Static Capability Package Architecture`.

Core doctrine:
- Mouse Scroll is the wheel.
- Orchestration decides why scrolling is needed.
- Geometry Guard decides whether anchor/region geometry is executable.
- Mouse Scroll only consumes Geometry Guard `allow` with normalized executable anchor/region.
- Mouse Scroll executes governed primitive scroll through `MouseScrollPrimitivePort`.
- Mouse Scroll success means primitive scroll accepted/executed only; it is not page-state truth and not “next video changed” truth.
- Real-platform scroll-next-video primitive adapters must use ACTION AND THEN observable landing semantics: execute the scroll, then poll cheap browser-native video identity/URL evidence until the page shows video identity change; timeout is only a large deadlock fallback and must never be the technical proof of success.
- Post-action Verification verifies what happened after the scroll.
- Forensics persists final action logs; Mouse Scroll emits runtime proof and scrollExecutionRef only.
- No Geometry Guard allow, no scroll.
- No explicit direction/magnitude/repeat, no scroll.
- No primitive port, no scroll.
- No post-action verification handoff, no success.
- No chain fields, no production-ready scroll result.
- No hidden scroll-until-found loop.
- No retry/fallback inside Mouse Scroll.
- No fixed debug wait as scroll-next-video success strategy.
- No active Mouse Scroll law without inspector + runner + negative proof.

---

## Global Mouse Scroll Baseline

All active Mouse Scroll laws in this file are:

```yaml
status: active
tier: P0
capabilityDomain: mouse-scroll-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof
```

Required package:

```txt
src/capabilities/mouse-scroll/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── registry.ts
├── index.ts
├── ports/
├── shared/
├── runtime/
└── children/
```

Required children:

```txt
scroll-browser-viewport
scroll-desktop-screen
scroll-region
```

Required enforcement:

```txt
scripts/audit/domains/mouse-scroll-capability/
├── manifest.json
├── inspector.ts
├── run-inspector.ts
└── negative-proof-harness.ts
```

Forbidden:
- `manual-first` as active enforcement for this domain.
- `evidenceMode: law` as sufficient evidence.
- verify scripts as release truth.
- capability-check.ts under Mouse Scroll root.
- detached inspector.
- warning-only P0.
- generated fake PASS.
- empty/missing negative proof.
- legacy visual-action scroll path.
- platform-action scroll owner.
- BrowserController in public contract.
- scroll-next-video primitive relying on fixed wait instead of ACTION AND THEN observable browser identity polling.

---

## Law GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V2

status: active
tier: P0
capabilityDomain: mouse-scroll-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Mouse Scroll is the only owner of governed primitive scroll execution.

### 主题

滚动执行主权唯一

### 法条

Mouse Scroll Ability Group is the only owner of governed primitive scroll execution.

Required:
- All governed scroll execution must flow through `src/capabilities/mouse-scroll`.
- Public entry is `MouseScrollAbilityGroup.execute(input)`.
- Orchestration, platform adapters, local runtime, workbench, Visual Target, AI, Geometry Guard, Screenshot, Page State, PAV, and BrowserController must not own governed scroll execution truth.
- BrowserController may exist only behind `MouseScrollPrimitivePort` adapter at composition boundary.
- PlatformAction may request a scroll but may not own scroll strategy or primitive execution.
- Mouse Scroll emits `scrollExecutionRef`, `primitiveExecutionRefs`, `postActionVerificationHandoffRef`, and runtime proof.
- Forensics owns persisted final action-log truth.

### 禁止

FORBIDDEN:
- platform adapter directly calling browser scroll primitive.
- agent runtime directly calling browser scroll primitive.
- BrowserController appearing in Mouse Scroll public contract.
- BrowserActionResult / BrowserActionId appearing in Mouse Scroll public contract or result.
- final action-log write inside Mouse Scroll.
- platform business verbs inside Mouse Scroll:
  - `scroll_next_video`
  - `continue_next`
  - `scroll_until_found`
  - `open_comments`
  - `capture_comment_region`
  - `capture_video_region`
- duplicate scroll helpers outside Mouse Scroll Ability Group.

Required inspector:
- External scroll-owner scan.
- BrowserController public contract ban.
- Platform adapter direct primitive call ban.
- Runtime/workbench composition boundary check.
- Forensics action-log write ban.
- Business verb ban.

Required negative proof:
- Add BrowserController to public contract → FAIL.
- Platform adapter directly calls primitive scroll → FAIL.
- Mouse Scroll writes final actionLogRef → FAIL.
- Add `scroll-next-video` child → FAIL.

---

## Law GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V2

status: active
tier: P0
capabilityDomain: mouse-scroll-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Mouse Scroll boundary stays pure and cannot compute coordinates, remap geometry, verify outcomes, or perform foreign owner work.

### 主题

纯滚动边界

### 法条

Mouse Scroll only validates Geometry Guard approved executable scroll input, applies scroll policy, resolves explicit delta, executes through `MouseScrollPrimitivePort`, records primitive proof, returns typed result, and creates PAV handoff.

Allowed:
- input schema gate.
- Geometry Guard proof gate.
- scroll policy gate.
- magnitude/delta resolver.
- pre-scroll safety gate.
- idempotency gate.
- primitive scroll through `MouseScrollPrimitivePort`.
- timeout/cancellation of primitive call.
- post-action verification handoff builder.
- runtime proof/result builder.

Forbidden:
- screenshot capture.
- target detection.
- AI execution.
- DOM/BOM lookup.
- page-state classification.
- product classification.
- post-action verification decision.
- Forensics final write.
- coordinate generation.
- bbox computation.
- scaleMapping.
- imageEvidence remapping.
- aiInput/contactSheet/regionCrop remapping.
- retry/fallback.
- hidden scroll-until-found loop.
- BrowserController direct import.
- browserAction / fallbackUsed result leakage.

Required inspector:
- Forbidden import graph.
- Forbidden symbol checks: screenshot, ai, visual-target, scaleMapping, imageEvidence, querySelector, document, window, cookie, localStorage, sessionStorage, BrowserController, writeActionLog, postActionVerification decision.
- Retry/fallback/until-found ban.
- BrowserAction result leakage ban.

Required negative proof:
- Add scaleMapping in Mouse Scroll runtime → FAIL.
- Add scroll-until-found loop → FAIL.
- Add BrowserActionId to result → FAIL.
- Add post-action verification decision field → FAIL.

---

## Law GRASSEYE-MOUSE-SCROLL-CAPABILITY-003-V2

status: active
tier: P0
capabilityDomain: mouse-scroll-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Mouse Scroll input must carry full chain fields, Geometry Guard allow proof, explicit direction/magnitude/repeat, safety policy, source refs, idempotency, and timeout policy.

### 主题

滚动输入链路与 Geometry Guard 授权完整性

### 法条

Every `MouseScrollAbilityInput` must be traceable to the mission/map/step/capability call that requested the scroll.

Required input fields:

```txt
abilityGroupId = mouse-scroll
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
purpose
inputRef
sourceRef
sourceCoordinateProofRef
sourceEvidenceRef
sourceTargetRef
sourceVisualTargetResultRef
geometryScrollProof
geometryGuardRef
guardDecision = allow
geometryGuardOutputRef
geometryGuardRuntimeProofRef
geometryGuardNormalizedCoordinateSpace
geometryGuardNormalizedAnchorPoint
geometryGuardNormalizedRegion when region-based
direction
magnitude
customDelta when magnitude=customDelta
repeat
coordinateSpace
anchorPoint
region
regionRef
bounds
safetyPolicy
idempotencyKey
timeoutMs or safetyPolicy.primitiveTimeoutMs
```

Required:
- Missing `stepId`, `capabilityCallId`, `activationSnapshotRef`, `nerveBusEnvelopeId`, `mapPackageVersion`, or `selectedMapVersion` must fail/review_required; never success.
- Missing `inputRef`, `sourceRef`, `sourceCoordinateProofRef`, `sourceTargetRef`, `geometryGuardRef`, `geometryScrollProof`, or idempotencyKey must fail/review_required; never success.
- `geometryScrollProof.abilityGroupId` must equal `geometry-guard`.
- `geometryScrollProof.guardDecision` must equal `allow`.
- `geometryScrollProof.status` must equal `success`.
- `geometryScrollProof.normalizedCoordinateSpace` must match child capability.
- `geometryScrollProof.normalizedAnchorPoint` must be finite and inside bounds.
- Region-based scroll requires `region`, `regionRef`, and `sourceEvidenceRef/sourceTargetRef`.
- `direction` must be explicit.
- `magnitude` must be explicit.
- `customDelta` requires finite `deltaX/deltaY`.
- `repeat` must be finite positive integer and must not exceed policy max.
- `sourceEvidenceRef` is required unless operator manual policy explicitly allows and operatorManualApprovalRef is valid.
- Desktop screen scroll requires explicit policy approval.

### 禁止

FORBIDDEN:
- Success with missing chain fields.
- Success with guardDecision other than allow.
- Success with geometryGuardRef missing.
- Success with raw Visual Target region/anchor.
- Success with aiInput/contactSheet/imageEvidence/regionCrop coordinate.
- Success without idempotencyKey.
- Silent default direction.
- Silent default magnitude.
- Unbounded repeat.
- Hidden scroll-until-found loop.
- Desktop scroll without explicit policy approval.

Required inspector:
- Schema field existence.
- Geometry proof gate.
- Chain field gate.
- Manual approval gate.
- Direction/magnitude/repeat policy gate.
- Desktop scroll policy gate.

Required negative proof:
- Remove activationSnapshotRef from input → FAIL.
- Remove capabilityCallId from input → FAIL.
- guardDecision=review_required returns success → FAIL.
- Missing geometryGuardRef returns success → FAIL.
- repeat above max returns success → FAIL.
- customDelta without finite delta returns success → FAIL.

---

## Law GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V2

status: active
tier: P0
capabilityDomain: mouse-scroll-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Scroll direction, magnitude, delta, and repeat are input/policy only, not child capability or hidden loop.

### 主题

滚动幅度是输入参数，不是子能力

### 法条

Mouse Scroll child topology is fixed. Direction/magnitude/repeat are input and policy only.

Required children:
```txt
scroll-browser-viewport
scroll-desktop-screen
scroll-region
```

Required magnitude values:
```txt
small
halfPage
onePage
twoPages
customDelta
```

Required direction values:
```txt
up
down
left
right
```

Required:
- `small`, `halfPage`, `onePage`, `twoPages`, and `customDelta` are input values only.
- `direction` is input only.
- `repeat` is input only.
- repeat max is policy-bound.
- Magnitude constants may be defined only in `shared/scroll-magnitude.ts`.
- `scroll-next-video` is Orchestration intent, not Mouse Scroll child.
- `scroll-until-found` is forbidden.
- No hidden loop may continue until visual/page-state condition changes.

### 禁止

FORBIDDEN:
- child capabilities named `scroll-one-page`, `scroll-two-pages`, `scroll-next-video`, `scroll-until-found`.
- child capabilities named `vertical-wheel-scroll`, `horizontal-wheel-scroll`.
- direction-specific child roots.
- magnitude-specific child roots.
- unbounded while/for loop until found.
- fallback magnitude guessing.
- hidden repeat not reflected in input/proof.

Required inspector:
- Child folder/registry parity.
- Forbidden child roots.
- Magnitude constants location check.
- Hidden loop/until-found symbol scan.
- Repeat proof parity.

Required negative proof:
- Add `scroll-next-video` child → FAIL.
- Move magnitude constants outside shared/scroll-magnitude.ts → FAIL.
- Add hidden `while (!found)` scroll loop → FAIL.
- repeat exceeds max but returns success → FAIL.

---

## Law GRASSEYE-MOUSE-SCROLL-CAPABILITY-005-V2

status: active
tier: P0
capabilityDomain: mouse-scroll-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Mouse Scroll must run one fixed gate pipeline and execute primitive scroll only after all gates pass.

### 主题

单链门禁与 primitive scroll

### 法条

Mouse Scroll execution pipeline must be fixed:

```txt
input schema gate
→ child registry gate
→ Geometry Guard proof gate
→ scroll policy gate
→ delta/magnitude resolver
→ boundary gate
→ pre-scroll safety gate
→ idempotency gate
→ timeout/cancellation gate
→ primitive scroll through MouseScrollPrimitivePort
→ per-iteration primitive result semantic gate
→ PAV handoff builder
→ output boundary gate
→ proof builder
→ result builder
```

Required:
- Unknown child returns typed failure with proof.
- Gate failure returns typed failed/review_required with proof.
- Primitive port is never called when geometry/policy/safety/idempotency gates fail.
- Primitive call must carry AbortSignal.
- Primitive timeout must abort and return typed failure/review.
- Late primitive success after timeout must not overwrite timeout result.
- Primitive iteration count must equal `repeat` only when all iterations succeed.
- Partial primitive failure must fail/review and record per-iteration proof.
- `postActionVerificationRequired = true` on success.
- Success requires `postActionVerificationHandoffRef`.
- Failure/review must not expose executableDelta as success output.

### 禁止

FORBIDDEN:
- retry loop.
- fallback scroll path.
- primitive call before Geometry Guard gate.
- primitive call after duplicate idempotency decision.
- primitive success overriding timeout.
- child direct primitive port call.
- child direct final result/proof.
- raw boolean child result.
- scrolling until external condition found.

Required inspector:
- Pipeline call-order check.
- Primitive call shape.
- AbortSignal usage.
- Retry/fallback/until-found ban.
- Child unified runtime call.

Required negative proof:
- Remove geometry proof gate → FAIL.
- Primitive call before preflight → FAIL.
- Remove AbortSignal → FAIL.
- Add retry loop → FAIL.
- Child calls primitive port directly → FAIL.
- Partial primitive failure still success → FAIL.

---

## Law GRASSEYE-MOUSE-SCROLL-CAPABILITY-006-V2

status: active
tier: P0
capabilityDomain: mouse-scroll-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Mouse Scroll result must mean primitive scroll only and must hand off to Post-action Verification.

### 主题

滚动结果语义与 PAV handoff

### 法条

Mouse Scroll success means primitive scroll execution success only.

Required result semantics:
- `status = success | failed | review_required`.
- Success requires:
  - output exists.
  - outputRef exists.
  - scrollExecutionRef exists.
  - primitiveExecutionRefs non-empty.
  - perIterationPrimitiveProofs length equals repeat.
  - executableDelta exists.
  - postActionVerificationRequired = true.
  - postActionVerificationHandoffRef exists.
  - runtimeProof exists.
- Failure/review requires:
  - output = null.
  - diagnosticPayloadRef exists.
  - failureReason or reviewRequiredReason exists.
  - runtimeProof exists.
- Mouse Scroll may not claim PAV truth.
- Mouse Scroll may not emit final actionLogRef.
- Mouse Scroll may not treat primitiveExecutionRefs as final Forensics actionLogRef.

### 禁止

FORBIDDEN result fields:
- verificationDecision.
- scrollResultVerifiedRef.
- actionResultVerifiedRef.
- nextVideoVerified.
- pageStateVerified.
- finalActionLogRef.
- browserActionId.
- browserActionResult.
- fallbackUsed.
- retryCount > 0.
- maxRetry > 0 as executable policy.

Required inspector:
- Result schema superRefine.
- Success handoff required.
- PAV truth field ban.
- Forensics final action log ban.
- Retry/fallback field ban.

Required negative proof:
- Success without postActionVerificationHandoffRef → FAIL.
- Add verificationDecision to result → FAIL.
- Add nextVideoVerified to result → FAIL.
- Add finalActionLogRef to result → FAIL.
- Set retryCount=1 in success proof → FAIL.

---

## Law GRASSEYE-MOUSE-SCROLL-CAPABILITY-007-V2

status: active
tier: P0
capabilityDomain: mouse-scroll-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Mouse Scroll result and runtime proof must preserve real upstream chain, gate decisions, primitive refs, repeat proofs, timeout/cancellation, idempotency, and PAV handoff.

### 主题

滚动结果与运行证明完整性

### 法条

`MouseScrollAbilityResult` and `MouseScrollRuntimeProof` must preserve the same real upstream chain as input.

Required result fields:

```txt
status = success | failed | review_required
abilityGroupId = mouse-scroll
childCapabilityId
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
attemptRef
scrollExecutionRef
primitiveExecutionRefs
geometryGuardRef
geometryGuardProofRef
geometryGuardRuntimeProofRef
geometryGuardOutputRef
sourceCoordinateProofRef
sourceEvidenceRef
sourceTargetRef
sourceVisualTargetResultRef
regionRef
coordinateSpace
direction
magnitude
repeat
requestedDelta
executableDelta
output
failureReason
reviewRequiredReason
diagnosticPayloadRef
debugLogRef
policyDecision
geometryDecision
safetyDecision
primitiveDecision
timeoutDecision
abortDecision
idempotencyDecision
postActionVerificationRequired
postActionVerificationHandoffRef
dataQualityFlags
statusMessage
startedAt
endedAt
durationMs
runtimeProof
```

Required proof fields:

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
abilityGroupId = mouse-scroll
childCapabilityId
sourceAbilityGroupId
sourceChildCapabilityId
inputRef
sourceRef
outputRef or diagnosticPayloadRef
attemptRef
scrollExecutionRef
rejectionRef
parseErrorRef
receivedShapeHash
geometryGuardRef
geometryGuardProofRef
geometryGuardRuntimeProofRef
geometryGuardOutputRef
sourceCoordinateProofRef
sourceEvidenceRef
sourceTargetRef
sourceVisualTargetResultRef
regionRef
coordinateSpace
sourceCoordinateSpace
requestedExecutionSpace
normalizedCoordinateSpace
anchorPoint
region
bounds
direction
magnitude
requestedDelta
executableDelta
deltaResolutionDecision
deltaCapDecision
repeat
idempotencyKey
idempotencyDecision
runLockId
cancellationTokenRef
resumeCheckpointRef
primitiveCallId
primitiveExecutionRefs
perIterationPrimitiveProofs
primitivePortKind
primitiveStartedAt
primitiveEndedAt
timeoutMs
primitiveTimeoutMs
maxDurationMs
timeoutDecision
abortDecision
circuitBreakerState
scrollSuppressedReason
postActionVerificationRequired
postActionVerificationHandoffRef
verificationRefPolicy
preActionDecision
policyDecision
policyDecisionReason
geometryDecision
geometryDecisionReason
safetyDecision
safetyDecisionReason
primitiveDecision
startedAt
endedAt
durationMs
status
failureReason
reviewRequiredReason
dataQualityFlags
clock
```

Required:
- result/proof/input chain parity.
- no nullable chain fields for valid execution.
- success requires output + outputRef + scrollExecutionRef + primitiveExecutionRefs + PAV handoff.
- failed/review_required requires output null + diagnosticPayloadRef.
- `runtimeProof.status === result.status`.
- invalid input failure may use receivedShapeHash and typed proof.
- `runId`, `missionId`, and `stepId` must come from input, not fabricated from attemptRef/sessionId/child.

### 禁止

FORBIDDEN:
- runtimeProof:null.
- status: ok.
- status: persisted.
- fabricated runId from attemptRef/child/fingerprint.
- missionId = sessionId.
- success without outputRef.
- failed/review result with output.
- proof/result chain mismatch.
- executableDelta in non-success proof.
- postActionVerificationRequired=false on success.

Required inspector:
- Schema field checks.
- Result/proof/input parity.
- No fabricated chain pattern.
- Success/failure proof invariants.
- Gate decision fields.

Required negative proof:
- Remove activationSnapshotRef from proof → FAIL.
- Set runId from attemptRef + child → FAIL.
- Success without primitiveExecutionRefs → FAIL.
- Success without PAV handoff → FAIL.
- Failed with output → FAIL.

---

## Law GRASSEYE-MOUSE-SCROLL-CAPABILITY-008-V2

status: active
tier: P0
capabilityDomain: mouse-scroll-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Mouse Scroll children are narrow primitive bindings and must use unified runtime.

### 主题

子能力窄职责与统一运行链

### 法条

Active child capabilities:

```txt
scroll-browser-viewport
scroll-desktop-screen
scroll-region
```

Required:
- Each child has `contract.ts`, `schema.ts`, `implementation.ts`.
- Each child binds exactly one execution coordinate mode:
  - `scroll-browser-viewport` accepts only `browserViewport`.
  - `scroll-desktop-screen` accepts only `desktopScreen`.
  - `scroll-region` requires governed region + regionRef + Geometry Guard proof.
- Each child delegates through unified Mouse Scroll runtime.
- Child implementation must not call primitive port directly.
- Child implementation must not build final proof/result directly.
- Child implementation must not import sibling child implementation.
- Direction, magnitude, customDelta, and repeat are input fields, not child IDs.

### 禁止

FORBIDDEN:
- scroll-one-page child.
- scroll-two-pages child.
- scroll-next-video child.
- scroll-until-found child.
- vertical-wheel-scroll child.
- horizontal-wheel-scroll child.
- compat/bridge/legacy/v2 roots.
- child direct primitive execution.
- child returning boolean.
- child importing BrowserController.
- child importing Geometry Guard internals.
- child importing Visual Target internals.
- child exposing public barrel.

Required inspector:
- Child folder/registry/schema parity.
- Child unified runtime call.
- Forbidden child roots.
- Sibling import ban.
- Child direct primitive call ban.

Required negative proof:
- Add scroll-one-page child → FAIL.
- Add scroll-until-found child → FAIL.
- Child calls primitive port directly → FAIL.
- Child returns boolean → FAIL.
- Child imports BrowserController → FAIL.

---

## Law GRASSEYE-MOUSE-SCROLL-CAPABILITY-009-V2

status: active
tier: P0
capabilityDomain: mouse-scroll-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Mouse Scroll enforcement must close through owner-local AST/symbol/import-graph inspector, runner, and negative proof.

### 主题

Mouse Scroll 执法唯一入口

### 法条

Mouse Scroll enforcement must close through:

```txt
scripts/audit/domains/mouse-scroll-capability/manifest.json
scripts/audit/domains/mouse-scroll-capability/inspector.ts
scripts/audit/domains/mouse-scroll-capability/run-inspector.ts
scripts/audit/domains/mouse-scroll-capability/negative-proof-harness.ts
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
- No empty/missing negative proof.
- No generated fake PASS.
- No capability-check.ts.
- No verify script as release truth.

Required inspector checks:
```txt
1. Law file is machine-blocking.
2. Public contract is scroll-only and primitive-port based.
3. Input schema includes full chain fields.
4. Geometry Guard proof requires guardDecision=allow.
5. Source coordinate/source target/source evidence policy enforced.
6. Direction/magnitude/customDelta/repeat policy enforced.
7. No coordinate generation/remapping/scaleMapping inside Mouse Scroll.
8. Primitive scroll only through MouseScrollPrimitivePort.
9. AbortSignal/timeout gate enforced.
10. Idempotency gate enforced.
11. No retry/fallback/until-found path.
12. Success requires PAV handoff.
13. Result/proof/input chain parity.
14. Children use unified runtime.
15. No forbidden imports/symbols/business verbs.
16. External platform/runtime cannot bypass Mouse Scroll.
17. ALL active Mouse Scroll laws in registry/matrix/audit-plan/runner.
18. negative-proof-harness executed.
```

Required negative proof:
```txt
manual-first enforcement reintroduced
remove capabilityCallId from input
remove activationSnapshotRef from input
remove nerveBusEnvelopeId from input
guardDecision=review_required returns success
missing geometryGuardRef returns success
repeat above max returns success
customDelta without finite delta returns success
desktop scroll without desktop approval returns success
remove AbortSignal
add retry loop
add scroll-until-found loop
add scaleMapping to Mouse Scroll runtime
add browserActionId to result
success without postActionVerificationHandoffRef
proof runId from attemptRef/child
proof missing activationSnapshotRef
child calls primitive port directly
child returns boolean
platform adapter directly calls primitive scroll
capability-check.ts added
remove negative proof invocation
turn P0 into warning-only
```

---

## Final Readiness Gate

Mouse Scroll is READY only when:

```txt
law/blueprint/inspector/generated/runner agree
all active Mouse Scroll laws are machine-blocking
public contract is scroll-only and primitive-port based
input chain fields complete
Geometry Guard allow proof required
no coordinate remapping/generation/scaleMapping inside Mouse Scroll
direction/magnitude/customDelta/repeat policies enforced
primitive scroll only through MouseScrollPrimitivePort
AbortSignal/timeout/idempotency enforced
no hidden scroll-until-found/retry/fallback
success requires scrollExecutionRef + primitiveExecutionRefs + PAV handoff
result/proof/input chain parity passes
children are narrow primitive bindings
external platform/runtime cannot bypass Mouse Scroll
owner-local inspector PASS
negative proof PASS
ALL active law enforcement PASS
CI-FULL PASS
```
