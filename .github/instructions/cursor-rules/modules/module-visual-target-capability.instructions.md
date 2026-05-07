---
name: "GrassEye Visual Target Capability"
description: "Use when governing the independent Visual Target Ability Group, governed visual target normalization, candidate selection, coordinate-space truth, source proof binding, non-executable coordinate handoff, and the boundary that prevents AI, screenshot, geometry, click, scroll, platform adapters, or runtime from owning visual target truth."
applyTo: ".github/instructions/cursor-rules/modules/module-visual-target-capability.instructions.md, src/capabilities/visual-target/**, docs/法案辅助文件/GrassEye Visual Target 视觉目标定位能力组施工图.md, scripts/audit/domains/visual-target-capability/**"
---

# GrassEye Visual Target Capability FINAL

Scope: governs the independent Visual Target Ability Group, target candidate normalization, source-proof binding, candidate selection, coordinate-space normalization, non-executable geometry handoff, metric/region/action target result shaping, and Visual Target runtime proof.

Boundary: this module governs only how governed screenshot/AI/page-state evidence and target candidates become governed VisualTargetResult. It does not govern screenshot capture, AI reasoning, Page State classification, Geometry Guard policy, click/scroll/text execution, DOM/BOM selector lookup, Post-action Verification, Forensics persistence, Orchestration branching, platform action, product judgement, or comment extraction.

Authority: this file is authoritative only for the `visual-target-capability` domain.

Architecture phase: `Static Capability Package Architecture`.

Core doctrine:
- Visual Target is the eye-hand alignment layer, not the hand.
- Visual Target consumes governed candidates and evidence; it does not create screenshots or ask AI.
- Visual Target may normalize bbox/clickPoint candidates into governed target results.
- Visual Target may produce non-executable coordinate handoff for Geometry Guard.
- Visual Target must not claim geometry safety, action executability, click success, page-state truth, or business truth.
- Contact-sheet and AI-input coordinates are never executable truth.
- Geometry Guard decides whether a target can be acted on.
- Mouse Click executes.
- Post-action Verification verifies the result after action.
- No source proof, no target success.
- No chain fields, no production-ready target result.
- No active Visual Target law without inspector + runner + negative proof.

---

## Global Visual Target Baseline

All active Visual Target laws in this file are:

```yaml
status: active
tier: P0
capabilityDomain: visual-target-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof
```

Required package:

```txt
src/capabilities/visual-target/
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
observe-comments-button
observe-not-interested-button
observe-next-video-region
observe-like-button
observe-save-button
observe-comments-panel
observe-close-comments-button
observe-metric-like-count
observe-metric-comment-count
```

Required enforcement:

```txt
scripts/audit/domains/visual-target-capability/
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
- empty or missing negative proof.
- legacy visual-action compatibility universe.

---

## Law GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V2

status: active
tier: P0
capabilityDomain: visual-target-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Visual Target is the only owner of governed visual target result normalization.

### 主题

视觉目标主权唯一

### 法条

Visual Target Ability Group is the only owner of governed visual target normalization and candidate selection.

Required:
- All governed visual target normalization must flow through `src/capabilities/visual-target`.
- Platform adapters, AI, Screenshot, Geometry Guard, Mouse Click, Mouse Scroll, Page State, Orchestration, local runtime, workbench, and deleted visual-action chains must not own target truth.
- Consumers must use Visual Target public contract only.
- Visual Target may output bbox, clickPoint, confidence, coordinateSpace, sourceScreenshotEvidenceRef, sourceAiResultRef, sourceCandidateRef, sourcePageStateProofRef, targetNature, dataQualityFlags, and geometry handoff refs.
- Geometry Guard consumes Visual Target output through public contract only.

### 禁止

FORBIDDEN:
- platform adapters owning target truth.
- click or scroll layers computing target coordinates on their own.
- AI result directly used as executable target.
- Screenshot result directly used as executable target.
- Geometry Guard selecting visual target candidate.
- deleted visual-action chains returning final target truth.
- hidden bbox or clickPoint laundering outside Visual Target.
- adapter-local shadow VisualTarget contracts.

Required inspector:
- Import graph check for second target owners.
- Forbidden target-truth symbol scan outside Visual Target.
- External private import ban.
- Public contract consumption check.

Required negative proof:
- Add platform adapter `computeTargetCoordinates` → FAIL.
- Add mouse-click local bbox computation → FAIL.
- Add AI direct target output consumed by mouse-click → FAIL.
- External import of Visual Target child implementation → FAIL.

---

## Law GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V2

status: active
tier: P0
capabilityDomain: visual-target-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Visual Target boundary stays pure: it validates, normalizes, selects, and builds handoff only.

### 主题

纯视觉定位边界

### 法条

Visual Target may validate source proof, bind candidates, normalize coordinate space, select a target, produce target output, and build non-executable Geometry Guard handoff. It may not perform side effects or foreign owner work.

Allowed:
- source screenshot proof validation.
- AI result proof validation.
- page-state consistency validation.
- candidate source binding.
- coordinate space validation and governed coordinate transform.
- target type policy validation.
- candidate selection.
- ambiguity gate.
- output boundary gate.
- non-executable Geometry Guard handoff builder.
- result/proof builder.

Forbidden:
- screenshot capture.
- AI execution.
- visual model execution.
- click execution.
- scroll execution.
- text input.
- page open/navigation.
- DOM/BOM selector lookup.
- BrowserController use.
- Geometry Guard policy decision.
- Forensics write.
- PAV decision.
- product-video judgement.
- comment extraction.
- Orchestration branch decision.
- Nerve Bus dispatch.
- reading cookies/localStorage/sessionStorage.

Required inspector:
- Forbidden import graph checks under `src/capabilities/visual-target/**`.
- Forbidden symbol checks: captureScreenshot, executeAi, click, scroll, type, openPage, querySelector, document, window, cookie, localStorage, sessionStorage, writeEvidence, dispatchEnvelope, advanceStep.
- No Page State/PAV/Geometry final truth fields.

Required negative proof:
- Visual Target imports screenshot implementation → FAIL.
- Visual Target calls LocalAiGateway → FAIL.
- Visual Target reads `document.querySelector` → FAIL.
- Visual Target calls Geometry Guard implementation → FAIL.

---

## Law GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V2

status: active
tier: P0
capabilityDomain: visual-target-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Visual Target input must carry full chain fields, source proof, candidate proof, and idempotency.

### 主题

输入链路与受治理候选完整性

### 法条

Every `VisualTargetAbilityInput` must be traceable to the mission/map/step/capability call that requested target normalization.

Required input fields:

```txt
abilityGroupId = visual-target
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
targetType
targetNature
sourceProof
candidates
inputRef
idempotencyKey
```

`sourceProof` must include:

```txt
sourceProofRef
screenshot.screenshotEvidenceId
screenshot.screenshotProofRef
screenshot.artifactRef
screenshot.artifactHash
screenshot.imageHash
screenshot.imageWidth
screenshot.imageHeight
screenshot.coordinateSpace
ai.aiResultRef when candidate came from AI
ai.aiProofRef when candidate came from AI
ai.promptContractId or promptContractRef when AI source is used
pageState.pageStateProofRef
pageState.pageStateFingerprint
```

Every candidate must include:

```txt
candidateRef
candidateKind
targetType
boundingBox
clickPoint nullable according to targetNature
confidence
coordinateSpace
sourceProofRef
capturedAt
sourceFrameRef
detectionMethod
isVisible
scaleMapping if coordinateSpace = ai_input or crop/region derived
dataQualityFlags
```

Required:
- Missing `stepId`, `capabilityCallId`, `activationSnapshotRef`, `nerveBusEnvelopeId`, `mapPackageVersion`, or `selectedMapVersion` must fail/review_required; never success.
- Candidate sourceProofRef must bind to `sourceProof.sourceProofRef`, screenshot proof, AI proof, page-state proof, or a governed candidate source proof.
- AI-sourced candidate without aiResultRef/aiProofRef cannot success.
- Contact-sheet candidate must not success as executable target.
- AI-input coordinate candidate cannot become executable without governed scaleMapping and non-executable Geometry Guard handoff.
- Missing idempotencyKey cannot success.

### 禁止

FORBIDDEN:
- Success without sourceScreenshotEvidenceRef/screenshotProofRef.
- Success from AI candidate without AI proof refs.
- Success from candidate without sourceProofRef.
- Success from missing chain fields.
- Fabricated mission/run/step fields.
- Raw candidate payload with unknown coordinate space.
- Adapter-local shadow candidate shape.

Required inspector:
- Schema field existence.
- Candidate proof binding gate.
- AI-source proof gate.
- Screenshot proof gate.
- Chain field gate.

Required negative proof:
- Remove `activationSnapshotRef` from input → FAIL.
- Remove `capabilityCallId` from input → FAIL.
- AI candidate without aiProofRef returns success → FAIL.
- Candidate without sourceProofRef returns success → FAIL.

---

## Law GRASSEYE-VISUAL-TARGET-CAPABILITY-004-V2

status: active
tier: P0
capabilityDomain: visual-target-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: coordinate-space truth must be explicit; Visual Target output is not executable until Geometry Guard.

### 主题

坐标空间与非可执行 handoff

### 法条

Visual Target coordinates must be explicit and non-executable until Geometry Guard.

Allowed coordinate spaces:

```txt
screenshot_original
region_crop
ai_input
contact_sheet
optimized_equivalent
viewport_projected
```

Rules:
- `contact_sheet` is never executable.
- `ai_input` is never directly executable.
- Action targets must not output executable coordinates from `ai_input` or `contact_sheet`.
- If candidate came from `ai_input`, Visual Target must require a scaleMapping that binds AI-input coordinates back to screenshot evidence.
- If candidate came from region/crop, Visual Target must preserve crop offsets and scale mapping.
- Action target success must set:
  - `notExecutableUntilGeometryGuard = true`
  - `geometryGuardHandoffRequired = true`
  - `geometryGuardHandoffRef`
  - `geometryGuardHandoff`
  - `executionBoundary = visual-target-to-geometry-guard`
- Visual Target may provide candidateClickPoint, bbox, and normalized coordinate space only as Geometry Guard input.
- Geometry Guard alone decides executable safety.

### 禁止

FORBIDDEN:
- `requiresGeometryGuard = false` for action target success.
- actionable success with `coordinateSpace = ai_input`.
- actionable success with `coordinateSpace = contact_sheet`.
- Mouse Click consuming Visual Target output without Geometry Guard result.
- Visual Target returning `canClick`, `clickAllowed`, `safeToClick`, `executionAllowed`, or `geometryVerified`.
- Visual Target importing Geometry Guard implementation.

Required inspector:
- Result schema superRefine.
- Coordinate-space gate call.
- Geometry handoff required on action success.
- Forbidden executable field scan.
- Downstream mouse-click requires Geometry Guard, not Visual Target directly.

Required negative proof:
- Action success with `geometryGuardHandoffRequired=false` → FAIL.
- Action success with `coordinateSpace=ai_input` → FAIL.
- Result includes `safeToClick` → FAIL.
- Mouse Click imports Visual Target internal output directly → FAIL.

---

## Law GRASSEYE-VISUAL-TARGET-CAPABILITY-005-V2

status: active
tier: P0
capabilityDomain: visual-target-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Visual Target runtime must use a single gate pipeline and fail closed on ambiguity, stale evidence, source mismatch, and critical data quality.

### 主题

单链门禁与模糊失败

### 法条

Visual Target execution pipeline must be fixed:

```txt
input schema gate
→ child registry gate
→ payload budget gate
→ screenshot proof gate
→ AI result proof gate
→ page-state consistency gate
→ candidate source gate
→ candidate source binding gate
→ target type policy gate
→ coordinate space gate
→ target selection gate
→ ambiguity gate
→ output boundary gate
→ proof builder
→ result builder
```

Required:
- payload budget gate must run before heavy candidate processing.
- screenshot proof gate must validate screenshot evidence and freshness.
- AI proof gate must validate AI candidates when AI source is present.
- page-state gate must detect current-state conflict.
- candidate source gate must reject stale/blocked/invisible/source-mismatched candidates.
- target type policy must match child capability and targetType.
- coordinate-space gate must reject unmappable coordinates.
- selection gate must record score trace.
- ambiguity gate must block/review overlapping or low-gap candidates.
- output boundary gate must block executable/action/geometry claims.
- any gate failure must return typed failed/review result with proof.

Forbidden:
- child direct final result without unified gate chain.
- choosing first candidate without score trace.
- success from ambiguous candidates.
- success with critical data quality flags.
- success with stale screenshot/candidate.
- success with source binding mismatch.
- success without proof.
- fake/fallback/no-op target success.

Required inspector:
- Pipeline call-order check.
- Gate presence check.
- Selection trace and ambiguity trace check.
- Critical data quality fail-closed check.

Required negative proof:
- Remove ambiguity gate → FAIL.
- Candidate source mismatch returns success → FAIL.
- Critical data quality returns success → FAIL.
- Stale screenshot returns success → FAIL.

---

## Law GRASSEYE-VISUAL-TARGET-CAPABILITY-006-V2

status: active
tier: P0
capabilityDomain: visual-target-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Visual Target result and runtime proof must preserve real chain, source refs, candidate refs, gate decisions, coordinate transform trace, and Geometry Guard handoff.

### 主题

结果与运行证明完整性

### 法条

`VisualTargetAbilityResult` and `VisualTargetRuntimeProof` must preserve the same real upstream chain as input.

Required result fields:

```txt
abilityGroupId
childCapabilityId
targetNature
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
targetType
output
failureReason
reviewRequiredReason
statusMessage
debugLogRef
diagnosticPayloadRef
dataQualityFlags
startedAt
endedAt
createdAt
durationMs
runtimeProof
```

Required output fields:
```txt
targetNature
targetId
sourceCandidateRef
sourceScreenshotEvidenceId
sourceScreenshotProofRef
sourceAiResultRef if AI candidate
sourceAiProofRef if AI candidate
sourcePageStateProofRef
coordinateSpace
boundingBox
confidence
candidateClickPoint for action/region when applicable
notExecutableUntilGeometryGuard
geometryGuardHandoffRequired
geometryGuardHandoffRef
geometryGuardHandoff
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
abilityGroupId = visual-target
childCapabilityId
sourceAbilityGroupId
sourceChildCapabilityId
inputRef
outputRef or diagnosticPayloadRef
debugLogRef
structuredRuntimeEventRef
inputPayloadHash
screenshotEvidenceId
screenshotProofRef
screenshotHash
aiResultRef
aiProofRef
aiInputHash
aiOutputPayloadHash
pageStateProofRef
pageStateHash
selectedTargetType
candidateCount
candidateSetHash
rejectedCandidateRefs
candidateScoreTrace
selectionTrace
ambiguityTrace
coordinateTransformTrace
selectedCandidateRef
selectedCandidateHash
coordinateSpace
boundingBox
clickPoint
geometryGuardHandoffRef
notExecutableUntilGeometryGuard
geometryGuardHandoffRequired
startedAt
endedAt
durationMs
status
failureReason
reviewRequiredReason
payloadBudgetDecision
screenshotDecision
aiDecision
pageStateDecision
candidateSourceDecision
candidateSourceBindingDecision
coordinateSpaceDecision
targetTypeDecision
selectionDecision
ambiguityDecision
outputBoundaryDecision
criticalDataQualityDecision
dataQualityFlags
geometryGuardHandoffPolicy
nonExecutableCoordinatePolicy
clock
receivedShapeHash if invalid input
```

Required:
- result/proof/input chain parity.
- no nullable chain fields for valid execution.
- success requires output + outputRef.
- failed/review_required requires output null + diagnosticPayloadRef.
- success requires non-critical data quality.
- invalid input failure may use receivedShapeHash and typed proof.

Forbidden:
- `runtimeProof: null`.
- `status: ok`.
- `status: persisted`.
- fabricated `runId` from sessionId/child/fingerprint.
- `missionId = sessionId` as truth.
- proof/result chain mismatch.
- success without outputRef.
- failed/review_required with output.

Required inspector:
- Schema field checks.
- Result/proof/input parity.
- No fabricated id pattern.
- Success/failure proof invariants.

Required negative proof:
- Remove `activationSnapshotRef` from proof → FAIL.
- Set runId from sessionId + child → FAIL.
- Success without outputRef → FAIL.
- Failed with output → FAIL.

---

## Law GRASSEYE-VISUAL-TARGET-CAPABILITY-007-V2

status: active
tier: P0
capabilityDomain: visual-target-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: child capabilities are narrow target bindings and must use unified Visual Target runtime.

### 主题

子能力窄职责与统一运行链

### 法条

Active child capabilities:

```txt
observe-comments-button
observe-not-interested-button
observe-next-video-region
observe-like-button
observe-save-button
observe-comments-panel
observe-close-comments-button
observe-metric-like-count
observe-metric-comment-count
```

Required:
- Each child has `contract.ts`, `schema.ts`, `implementation.ts`.
- Each child binds one target intent / target type profile.
- Each child uses unified Visual Target executor.
- Child implementation must not execute screenshot/AI/click/scroll/PAV/Forensics/Geometry Guard.
- Child implementation must not directly build final proof/result except through shared executor/result builder.
- Child must not import sibling child implementation.
- Metric children must output metric targetNature and parsed value/metric value.
- Action children must output action targetNature and Geometry Guard handoff.
- Region children must output region targetNature.

Forbidden:
- child returning boolean.
- child selecting target by hardcoded platform coordinates.
- child direct DOM/BOM lookup.
- child hidden platform-specific coordinate formula.
- child direct final target success without executor.
- child importing sibling implementation.

Required inspector:
- Child folder/registry/schema parity.
- Child uses unified executor.
- Forbidden imports/symbols.
- Metric/action/region targetNature correctness.

Required negative proof:
- Child returns boolean → FAIL.
- Child imports sibling implementation → FAIL.
- Child hardcodes platform coordinate constant as final truth → FAIL.
- Metric child returns action targetNature → FAIL.

---

## Law GRASSEYE-VISUAL-TARGET-CAPABILITY-008-V2

status: active
tier: P0
capabilityDomain: visual-target-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Visual Target enforcement must close through owner-local AST/symbol/import-graph inspector, runner, and negative proof.

### 主题

Visual Target 执法唯一入口

### 法条

Visual Target enforcement must close through:

```txt
scripts/audit/domains/visual-target-capability/manifest.json
scripts/audit/domains/visual-target-capability/inspector.ts
scripts/audit/domains/visual-target-capability/run-inspector.ts
scripts/audit/domains/visual-target-capability/negative-proof-harness.ts
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
- No verify script.
- No capability-check.ts under Visual Target root.

Required inspector checks:
```txt
1. Law file is machine-blocking.
2. Public contract is target-normalization only.
3. Input schema includes full chain fields.
4. Source proof includes screenshot/AI/page-state proof refs.
5. Candidate source proof binding gate invoked.
6. Screenshot proof gate invoked.
7. AI proof gate invoked when AI candidates exist.
8. Page-state consistency gate invoked.
9. Coordinate-space gate invoked.
10. Target selection and ambiguity gates invoked.
11. Output boundary blocks executable/geometry/PAV truth.
12. Action success requires Geometry Guard handoff.
13. Result/proof/input chain parity.
14. Children use unified runtime.
15. No forbidden imports/symbols/DOM/BOM.
16. No second visual target owner in platform/runtime/AI/click/scroll.
17. ALL active Visual Target laws in registry/matrix/audit-plan/runner.
18. negative-proof-harness executed.
```

Required negative proof:
```txt
manual-first enforcement reintroduced
remove capabilityCallId from input
remove activationSnapshotRef from input
remove nerveBusEnvelopeId from input
AI candidate without aiProofRef returns success
candidate without sourceProofRef returns success
coordinateSpace ai_input action success
coordinateSpace contact_sheet action success
geometryGuardHandoffRequired false on action success
result adds safeToClick
critical data quality returns success
ambiguous candidates return success
proof runId from sessionId/child
proof missing activationSnapshotRef
child imports screenshot implementation
child imports Geometry Guard implementation
child returns boolean
external import of child implementation
platform adapter computes target coordinates
mouse-click computes target bbox directly
remove negative proof invocation
turn P0 into warning-only
```

---

## Final Readiness Gate

Visual Target is READY only when:

```txt
law/blueprint/inspector/generated/runner agree
all active Visual Target laws are machine-blocking
Visual Target public contract is target-normalization only
input chain fields complete
source proof/candidate proof binding complete
coordinate-space policy blocks ai_input/contact_sheet executable truth
action success always requires Geometry Guard handoff
target selection and ambiguity gates fail closed
result/proof/input chain parity passes
children are narrow target bindings
owner-local inspector PASS
negative proof PASS
ALL active law enforcement PASS
CI-FULL PASS
```
