---
name: "GrassEye Mouse Click Capability"
description: "Use when governing the independent Mouse Click Ability Group, governed browser/desktop click execution, Geometry Guard approved coordinate consumption, primitive click port boundary, click safety policy, idempotency, timeout/cancellation, post-action verification handoff, and the boundary that prevents Mouse Click from computing coordinates, remapping geometry, claiming action-result truth, or writing final action logs."
applyTo: ".github/instructions/cursor-rules/modules/module-mouse-click-capability.instructions.md, src/capabilities/mouse-click/**, docs/法案辅助文件/GrassEye Mouse Click 能力组施工图.md, scripts/audit/domains/mouse-click-capability/**, src/lib/local-runtime/**, src/lib/browser/**, src/features/platform-action/**"
---

# GrassEye Mouse Click Capability FINAL

Scope: governs the independent Mouse Click Ability Group, governed click input, Geometry Guard approved executable coordinate consumption, primitive click execution through port, click safety policy, idempotency, timeout/cancellation, primitive execution proof, post-action verification handoff, and Mouse Click owner evidence.

Boundary: this module governs only primitive click execution after Geometry Guard has allowed executable geometry. It does not govern screenshot capture, target detection, coordinate mapping, scale mapping, AI execution, comment capture, product classification, page-state truth, post-action verification truth, Forensics final action-log persistence, map branching, browser controller ownership, or platform business verbs.

Authority: this file is authoritative only for the `mouse-click-capability` domain.

Architecture phase: `Static Capability Package Architecture`.

Core doctrine:
- Mouse Click is the finger.
- Geometry Guard decides whether a coordinate is executable.
- Mouse Click only consumes Geometry Guard `allow` with normalized executable coordinates.
- Mouse Click executes one governed primitive click through `MouseClickPrimitivePort`.
- Mouse Click success means primitive click accepted/executed only; it is not action-result truth.
- Mouse Click public success contract must expose clickResultRef and preserve Geometry Guard lineage refs needed by downstream Post-action Verification.
- Mouse Click success must emit postActionVerificationHandoffRef and must not require Nerve Bus, Route Plan, or proof-summary layers to reconstruct that handoff.
- Post-action Verification verifies what happened after the click.
- Forensics persists final action logs; Mouse Click emits owner evidence and actionExecutionRef only.
- No Geometry Guard allow, no click.
- No primitive port, no click.
- No post-action verification handoff, no success.
- No chain fields, no production-ready click result.
- No retry/fallback inside Mouse Click.
- No active Mouse Click law without inspector + runner + real-code-inspection.

---

## Global Mouse Click Baseline

All active Mouse Click laws in this file are:

```yaml
status: active
tier: P0
capabilityDomain: mouse-click-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection
```

Required package:

```txt
src/capabilities/mouse-click/
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
click-browser-coordinate
click-desktop-coordinate
```

Required enforcement:

```txt
scripts/audit/domains/mouse-click-capability/
├── manifest.json
├── inspector.ts
├── run-inspector.ts
└── owner-inspection-harness.ts
```

Forbidden:
- `manual-first` as active enforcement for this domain.
- `evidenceMode: law` as sufficient evidence.
- verify scripts as release truth.
- capability-check.ts under Mouse Click root.
- detached inspector.
- warning-only P0.
- generated fake PASS.
- empty/missing real-code-inspection.
- legacy visual-action click path.
- platform-action click owner.
- BrowserController in public contract.

## Law GRASSEYE-MOUSE-CLICK-CAPABILITY-RESULT-CONTRACT-V1

status: active
tier: P0
capabilityDomain: mouse-click-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Mouse Click Result Contract is the canonical primitive-execution bridge from Geometry Guard Result into Post Action Verification Result.

### 主题

Mouse Click Result Contract

### 法条

Mouse Click success means primitive click execution only.
Mouse Click success must output canonical MouseClickResult.
MouseClickResult must include postActionVerificationRequired=true.
MouseClickResult must include postActionVerificationHandoffRef.
Mouse Click Result is the only public bridge from Geometry Guard Result into Post Action Verification Result.
Mouse Click must not claim page state, comments panel opened, verificationDecision, or final action truth.

Required:
- success output must expose `clickResultRef`, `actionExecutionRef`, `primitiveExecutionRef`, `geometryGuardRef`, `geometryGuardProofRef`, `sourceCoordinateProofRef`, `sourceTargetRef`, `normalizedClickPoint`, `coordinateSpace`, `button`, and `clickCount`.
- success output must preserve Geometry Guard lineage refs needed by Post Action Verification.
- downstream PAV consumers must enter through `postActionVerificationHandoffRef` or `clickResultRef` public contract rather than proof-summary scatter fields.

### 禁止

FORBIDDEN:
- Mouse Click result exposing `verificationDecision`, `actionResultVerifiedRef`, `pageStateVerified`, `finalActionLogRef`, `fallbackUsed`, or retry success fields.
- Mouse Click claiming comments panel opened or final business truth.
- Mouse Click consuming raw Visual Target bbox/clickPoint or AI candidate geometry.

Required inspector:
- Required-shape check for MouseClickResult success fields and `postActionVerificationHandoffRef`.
- Forbidden-field check for verification or final-action truth fields.
- Downstream handoff check ensuring PAV input builders resolve MouseClickResult public handoff.

Required real-code-inspection:
- Remove postActionVerificationHandoffRef from success output -> FAIL.
- Add `verificationDecision` to MouseClickResult -> FAIL.
- Add Mouse Click path that consumes raw Visual Target clickPoint -> FAIL.

---

## Law GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V2

status: active
tier: P0
capabilityDomain: mouse-click-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Mouse Click is the only owner of governed primitive click execution.

### 主题

点击执行主权唯一

### 法条

Mouse Click Ability Group is the only owner of governed primitive click execution.

Required:
- All governed click execution must flow through `src/capabilities/mouse-click`.
- Public entry is `MouseClickAbilityGroup.execute(input)`.
- Orchestration, platform adapters, local runtime, workbench, Visual Target, AI, Geometry Guard, Screenshot, Page State, and PAV must not own click execution truth.
- BrowserController may exist only behind `MouseClickPrimitivePort` adapter at composition boundary.
- PlatformAction may request a click but may not own click strategy or primitive execution.
- Mouse Click emits `actionExecutionRef`, `primitiveExecutionRef`, `postActionVerificationHandoffRef`, and owner evidence.
- Forensics owns persisted final action-log truth.

### 禁止

FORBIDDEN:
- platform adapter directly calling browser click primitive.
- agent runtime directly calling browser click primitive.
- Visual Target or AI layer owning click truth.
- BrowserController in Mouse Click public contract.
- BrowserActionResult / BrowserActionId in Mouse Click public contract or result.
- final action-log write inside Mouse Click.
- platform business verbs inside Mouse Click: `open_comments`, `click_not_interested`, `like_or_save_candidate`, `continue_next`.

Required inspector:
- External click-owner scan.
- BrowserController public contract ban.
- Platform adapter direct primitive call ban.
- Runtime/workbench composition boundary check.
- Forensics action-log write ban.

Required real-code-inspection:
- Add BrowserController to public contract → FAIL.
- Platform adapter directly calls primitive click → FAIL.
- Mouse Click writes final actionLogRef → FAIL.
- Add platform business verb child → FAIL.

---

## Law GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V2

status: active
tier: P0
capabilityDomain: mouse-click-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Mouse Click boundary stays pure and cannot compute coordinates, remap geometry, verify outcomes, or perform foreign owner work.

### 主题

纯点击边界

### 法条

Mouse Click only validates Geometry Guard approved executable click input, applies click policy, executes through `MouseClickPrimitivePort`, records primitive proof, returns typed result, and creates PAV handoff.

Allowed:
- input schema gate.
- Geometry Guard proof gate.
- click policy gate.
- pre-click safety gate.
- idempotency gate.
- primitive click through `MouseClickPrimitivePort`.
- timeout/cancellation of primitive call.
- post-action verification handoff builder.
- owner evidence/result builder.

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
- BrowserController direct import.
- browserAction / fallbackUsed result leakage.

Required inspector:
- Forbidden import graph.
- Forbidden symbol checks: screenshot, ai, visual-target, scaleMapping, imageEvidence, querySelector, document, window, cookie, localStorage, sessionStorage, BrowserController, writeActionLog, postActionVerification decision.
- Retry/fallback ban.
- BrowserAction result leakage ban.

Required real-code-inspection:
- Add scaleMapping in Mouse Click runtime → FAIL.
- Add retry loop → FAIL.
- Add BrowserActionId to result → FAIL.
- Add post-action verification decision field → FAIL.

---

## Law GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V2

status: active
tier: P0
capabilityDomain: mouse-click-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Mouse Click input must carry full chain fields, Geometry Guard allow proof, executable coordinate, safety policy, source refs, idempotency, and timeout policy.

### 主题

点击输入链路与 Geometry Guard 授权完整性

### 法条

Every `MouseClickAbilityInput` must be traceable to the mission/map/step/capability call that requested the click.

Required input fields:

```txt
abilityGroupId = mouse-click
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
geometryGuardProof
geometryGuardRef
guardDecision = allow
geometryGuardOutputRef
geometryGuardRuntimeProofRef
geometryGuardNormalizedCoordinateSpace
geometryGuardNormalizedClickPoint
button
clickCount
bounds
safetyPolicy
idempotencyKey
timeoutMs or safetyPolicy.primitiveTimeoutMs
```

Required:
- Missing `stepId`, `capabilityCallId`, `activationSnapshotRef`, `nerveBusEnvelopeId`, `mapPackageVersion`, or `selectedMapVersion` must fail/review_required; never success.
- Missing `inputRef`, `sourceRef`, `sourceCoordinateProofRef`, `sourceTargetRef`, `geometryGuardRef`, `geometryGuardProof`, or idempotencyKey must fail/review_required; never success.
- `geometryGuardProof.abilityGroupId` must equal `geometry-guard`.
- `geometryGuardProof.guardDecision` must equal `allow`.
- `geometryGuardProof.status` must equal `success`.
- `geometryGuardProof.normalizedCoordinateSpace` must match child capability.
- `geometryGuardProof.normalizedClickPoint` must be finite and inside bounds.
- `sourceEvidenceRef` is required unless operator manual policy explicitly allows and operatorManualApprovalRef is valid.
- right click requires `allowRightClick = true`.
- double click requires `allowDoubleClick = true`.

### 禁止

FORBIDDEN:
- Success with missing chain fields.
- Success with guardDecision other than allow.
- Success with geometryGuardRef missing.
- Success with raw Visual Target clickPoint.
- Success with aiInput/contactSheet/imageEvidence/regionCrop coordinate.
- Success without idempotencyKey.
- Silent default button policy overriding explicit ban.
- Desktop click without explicit policy approval.

Required inspector:
- Schema field existence.
- Geometry proof gate.
- Chain field gate.
- Manual approval gate.
- Right/double click policy gate.
- Desktop click policy gate.

Required real-code-inspection:
- Remove activationSnapshotRef from input → FAIL.
- Remove capabilityCallId from input → FAIL.
- guardDecision=review_required returns success → FAIL.
- Missing geometryGuardRef returns success → FAIL.
- Double click without allowDoubleClick returns success → FAIL.

---

## Law GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V2

status: active
tier: P0
capabilityDomain: mouse-click-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Mouse Click must run one fixed gate pipeline and execute exactly one primitive click only after all gates pass.

### 主题

单链门禁与单次 primitive click

### 法条

Mouse Click execution pipeline must be fixed:

```txt
input schema gate
→ child registry gate
→ Geometry Guard proof gate
→ click policy gate
→ boundary gate
→ pre-click safety gate
→ idempotency gate
→ timeout/cancellation gate
→ primitive click through MouseClickPrimitivePort
→ primitive result semantic gate
→ PAV handoff builder
→ output boundary gate
→ proof builder
→ result builder
```

Required:
- Unknown child returns typed failure with proof.
- Gate failure returns typed failed/review_required with proof.
- Primitive port is called at most once per successful execution.
- Primitive is never called when geometry/policy/safety/idempotency gates fail.
- Primitive call must carry AbortSignal.
- Primitive timeout must abort and return typed failure/review.
- Late primitive success after timeout must not overwrite timeout result.
- `postActionVerificationRequired = true` on success.
- Success requires `postActionVerificationHandoffRef`.
- Failure/review must not expose executableCoordinate.

### 禁止

FORBIDDEN:
- retry loop.
- fallback click path.
- primitive call before Geometry Guard gate.
- primitive call after duplicate idempotency decision.
- primitive success overriding timeout.
- child direct primitive port call.
- child direct final result/proof.
- raw boolean child result.

Required inspector:
- Pipeline call-order check.
- Primitive call count shape.
- AbortSignal usage.
- Retry/fallback ban.
- Child unified runtime call.

Required real-code-inspection:
- Remove geometry proof gate → FAIL.
- Primitive call before preflight → FAIL.
- Remove AbortSignal → FAIL.
- Add retry loop → FAIL.
- Child calls primitive port directly → FAIL.

---

## Law GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V2

status: active
tier: P0
capabilityDomain: mouse-click-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Mouse Click result must mean primitive click only and must hand off to Post-action Verification.

### 主题

点击结果语义与 PAV handoff

### 法条

Mouse Click success means primitive execution success only.

Required result semantics:
- `status = success | failed | review_required`.
- Success requires:
  - output exists.
  - outputRef exists.
  - actionExecutionRef exists.
  - primitiveExecutionRef exists.
  - normalizedClickPoint exists.
  - coordinateSpace is `browserViewport` or `desktopScreen`.
  - postActionVerificationRequired = true.
  - postActionVerificationHandoffRef exists.
  - runtimeProof exists.
- Failure/review requires:
  - output = null.
  - diagnosticPayloadRef exists.
  - failureReason or reviewRequiredReason exists.
  - runtimeProof exists.
- Mouse Click may not claim PAV truth.
- Mouse Click may not emit final actionLogRef.
- Mouse Click may not treat primitiveExecutionRef as final Forensics actionLogRef.

### 禁止

FORBIDDEN result fields:
- verificationDecision.
- actionResultVerifiedRef.
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

Required real-code-inspection:
- Success without postActionVerificationHandoffRef → FAIL.
- Add verificationDecision to result → FAIL.
- Add finalActionLogRef to result → FAIL.
- Set retryCount=1 in success proof → FAIL.

---

## Law GRASSEYE-MOUSE-CLICK-CAPABILITY-006-V2

status: active
tier: P0
capabilityDomain: mouse-click-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Mouse Click result and owner evidence must preserve real upstream chain, gate decisions, primitive refs, timeout/cancellation, idempotency, and PAV handoff.

### 主题

点击结果与运行证明完整性

### 法条

`MouseClickAbilityResult` and `MouseClickRuntimeProof` must preserve the same real upstream chain as input.

Required result fields:

```txt
status = success | failed | review_required
abilityGroupId = mouse-click
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
actionExecutionRef
primitiveExecutionRef
geometryGuardRef
geometryGuardProofRef
sourceCoordinateProofRef
sourceEvidenceRef
sourceTargetRef
sourceVisualTargetResultRef
coordinateSpace
button
clickCount
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
abilityGroupId = mouse-click
childCapabilityId
sourceAbilityGroupId
sourceChildCapabilityId
inputRef
sourceRef
outputRef or diagnosticPayloadRef
attemptRef
actionExecutionRef
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
coordinateSpace
sourceCoordinateSpace
requestedExecutionSpace
normalizedCoordinateSpace
requestedCoordinate
executableCoordinate
bounds
sourceBounds
targetBounds
button
clickCount
idempotencyKey
idempotencyDecision
runLockId
cancellationTokenRef
resumeCheckpointRef
primitiveCallId
primitiveExecutionRef
primitivePortKind
primitiveStartedAt
primitiveEndedAt
timeoutMs
primitiveTimeoutMs
maxDurationMs
timeoutDecision
abortDecision
circuitBreakerState
clickSuppressedReason
postActionVerificationRequired
postActionVerificationHandoffRef
verificationRefPolicy
preActionDecision
policyDecision
policyDecisionReason
geometryDecision
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
- success requires output + outputRef + actionExecutionRef + primitiveExecutionRef + PAV handoff.
- failed/review_required requires output null + diagnosticPayloadRef.
- `runtimeProof.status === result.status`.
- invalid input failure may use receivedShapeHash and typed proof.
- `runId`, `missionId`, `stepId` must come from input, not fabricated from attemptRef/sessionId/child.

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
- executableCoordinate in non-success proof.
- postActionVerificationRequired=false on success.

Required inspector:
- Schema field checks.
- Result/proof/input parity.
- No fabricated chain pattern.
- Success/failure proof invariants.
- Gate decision fields.

Required real-code-inspection:
- Remove activationSnapshotRef from proof → FAIL.
- Set runId from attemptRef + child → FAIL.
- Success without primitiveExecutionRef → FAIL.
- Success without PAV handoff → FAIL.
- Failed with output → FAIL.

---

## Law GRASSEYE-MOUSE-CLICK-CAPABILITY-007-V2

status: active
tier: P0
capabilityDomain: mouse-click-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Mouse Click children are narrow primitive bindings and must use unified runtime.

### 主题

子能力窄职责与统一运行链

### 法条

Active child capabilities:

```txt
click-browser-coordinate
click-desktop-coordinate
```

Required:
- Each child has `contract.ts`, `schema.ts`, `implementation.ts`.
- Each child binds exactly one execution coordinate space.
- `click-browser-coordinate` accepts only `browserViewport`.
- `click-desktop-coordinate` accepts only `desktopScreen`.
- Each child delegates through unified Mouse Click runtime.
- Child implementation must not call primitive port directly.
- Child implementation must not build final proof/result directly.
- Child implementation must not import sibling child implementation.
- Button and clickCount are input fields, not child IDs.

### 禁止

FORBIDDEN:
- click-left-point child.
- click-right-point child.
- double-click-left-point child.
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

Required real-code-inspection:
- Add click-left-point child → FAIL.
- Child calls primitive port directly → FAIL.
- Child returns boolean → FAIL.
- Child imports BrowserController → FAIL.

---

## Law GRASSEYE-MOUSE-CLICK-CAPABILITY-008-V2

status: active
tier: P0
capabilityDomain: mouse-click-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Mouse Click enforcement must close through owner-local AST/symbol/import-graph inspector, runner, and real-code-inspection.

### 主题

Mouse Click 执法唯一入口

### 法条

Mouse Click enforcement must close through:

```txt
scripts/audit/domains/mouse-click-capability/manifest.json
scripts/audit/domains/mouse-click-capability/inspector.ts
scripts/audit/domains/mouse-click-capability/run-inspector.ts
scripts/audit/domains/mouse-click-capability/owner-inspection-harness.ts
```

Required:
- Inspector must use ts-morph AST-level checks.
- Inspector must use symbol and import-graph checks.
- Inspector must use schema-level checks.
- Inspector must include anti-escape checks.
- Inspector must verify active law coverage in registry/matrix/audit-plan/runner.
- real-code-inspection must run and report fail → re-inspect → pass.
- CI-FULL must be green for delivery.
- No grep/regex/includes as final judgment.
- No warning-only P0.
- No detached inspector.
- No empty/missing real-code-inspection.
- No generated fake PASS.
- No capability-check.ts.
- No verify script as release truth.

Required inspector checks:
```txt
1. Law file is machine-blocking.
2. Public contract is click-only and primitive-port based.
3. Input schema includes full chain fields.
4. Geometry Guard proof requires guardDecision=allow.
5. Source coordinate proof/source target/source evidence policy enforced.
6. Right/double/desktop click policy enforced.
7. No coordinate generation/remapping/scaleMapping inside Mouse Click.
8. Primitive click only through MouseClickPrimitivePort.
9. AbortSignal/timeout gate enforced.
10. Idempotency gate enforced.
11. No retry/fallback path.
12. Success requires PAV handoff.
13. Result/proof/input chain parity.
14. Children use unified runtime.
15. No forbidden imports/symbols/business verbs.
16. External platform/runtime cannot bypass Mouse Click.
17. ALL active Mouse Click laws in registry/matrix/audit-plan/runner.
18. owner-inspection-harness executed.
```

Required real-code-inspection:
```txt
manual-first enforcement reintroduced
remove capabilityCallId from input
remove activationSnapshotRef from input
remove nerveBusEnvelopeId from input
guardDecision=review_required returns success
missing geometryGuardRef returns success
double click without allowDoubleClick returns success
right click without allowRightClick returns success
desktop click without desktop approval returns success
remove AbortSignal
add retry loop
add scaleMapping to Mouse Click runtime
add browserActionId to result
success without postActionVerificationHandoffRef
proof runId from attemptRef/child
proof missing activationSnapshotRef
child calls primitive port directly
child returns boolean
platform adapter directly calls primitive click
capability-check.ts added
remove real-code-inspection invocation
turn P0 into warning-only
```

---

## Final Readiness Gate

Mouse Click is READY only when:

```txt
law/blueprint/inspector/generated/runner agree
all active Mouse Click laws are machine-blocking
public contract is click-only and native
input chain fields complete
Geometry Guard allow proof required
no coordinate remapping/generation inside Mouse Click
right/double/desktop policies enforced
primitive click only through MouseClickPrimitivePort
AbortSignal/timeout/idempotency enforced
success requires actionExecutionRef + primitiveExecutionRef + PAV handoff
result/proof/input chain parity passes
children are narrow primitive bindings
external platform/runtime cannot bypass Mouse Click
owner-local inspector PASS
real-code-inspection PASS
ALL active law enforcement PASS
CI-FULL PASS
```
