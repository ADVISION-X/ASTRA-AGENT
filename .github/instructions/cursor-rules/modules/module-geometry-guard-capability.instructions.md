---
name: "GrassEye Geometry Guard Capability"
description: "Use when governing the independent Geometry Guard Ability Group, executable coordinate safety gating, coordinate-space validation, bbox/click-point legality, scale mapping, viewport/screen bounds validation, normalized executable geometry output, and the boundary that prevents Visual Target, Mouse Click, Mouse Scroll, Screenshot, AI, platform adapters, or browser helpers from owning geometry safety truth."
applyTo: ".github/instructions/cursor-rules/modules/module-geometry-guard-capability.instructions.md, src/capabilities/geometry-guard/**, docs/法案辅助文件/GrassEye Geometry Guard 几何安全守卫能力组施工图.md, scripts/audit/domains/geometry-guard-capability/**, src/capabilities/mouse-click/**, src/capabilities/mouse-scroll/**, src/capabilities/visual-target/**"
---

# GrassEye Geometry Guard Capability FINAL

Scope: governs the independent Geometry Guard Ability Group, executable geometry safety gating, coordinate-space validation, bbox/click-point legality, scale mapping, bounds validation, normalized executable geometry output, geometry guard references, and owner evidence.

Boundary: this module governs only whether a governed geometry input is safe and normalized for an execution space. It does not govern browser control, screenshot capture, target detection, visual target selection, coordinate action planning, action execution, AI reasoning, platform business verbs, post-action verification, Forensics persistence, Orchestration branching, product judgement, or comment extraction.

Authority: this file is authoritative only for the `geometry-guard-capability` domain.

Architecture phase: `Static Capability Package Architecture`.

Core doctrine:
- Geometry Guard is the geometry safety gate only.
- Visual Target says: “this looks like the target.”
- Geometry Guard says: “this coordinate is / is not safe for execution space.”
- Mouse Click / Mouse Scroll execute only Geometry Guard approved executable geometry.
- Geometry Guard must not plan actions, choose targets, execute actions, verify action results, or own browser state.
- `aiInput` and `contactSheet` coordinates are never directly executable.
- `regionCrop` must map back to governed source evidence before executable normalization.
- No silent clamp.
- No guessed deviceScaleFactor.
- No action type decides geometry verdict.
- No source proof, no allow.
- No chain fields, no production-ready geometry result.
- No active Geometry Guard law without inspector + runner + real-code-inspection.

---

## Global Geometry Guard Baseline

All active Geometry Guard laws in this file are:

```yaml
status: active
tier: P0
capabilityDomain: geometry-guard-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection
```

Required package:

```txt
src/capabilities/geometry-guard/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── schema-foundation.ts
├── schema-input.ts
├── schema-output.ts
├── schema-result.ts
├── schema-runtime-proof.ts
├── registry.ts
├── index.ts
├── ports/
├── shared/
├── runtime/
└── children/
```

Required children:

```txt
validate-coordinate-space
validate-bbox-integrity
validate-click-point
validate-scale-mapping
map-ai-input-to-viewport
map-region-to-source
validate-browser-viewport-bounds
validate-desktop-screen-bounds
```

Required enforcement:

```txt
scripts/audit/domains/geometry-guard-capability/
├── manifest.json
├── inspector.ts
├── run-inspector.ts
└── owner-inspection-harness.ts
```

Forbidden:
- `manual-first` as active enforcement for this domain.
- `evidenceMode: law` as sufficient evidence.
- verify scripts as release truth.
- capability-check.ts under Geometry Guard root.
- detached inspector.
- warning-only P0.
- generated fake PASS.
- empty/missing real-code-inspection.
- compatibility/legacy visual-action geometry chain.

---

## Law GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V3

status: active
tier: P0
capabilityDomain: geometry-guard-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Geometry Guard is the only owner of governed executable geometry safety gating.

### 主题

几何安全门禁唯一主权

### 法条

Geometry Guard Ability Group is the only owner of governed coordinate safety gating and executable geometry normalization.

Required:
- All governed executable coordinate safety decisions must flow through `src/capabilities/geometry-guard`.
- Public result must expose only `guardDecision = allow | block | review_required`.
- Public result may emit `normalizedCoordinateSpace`, `normalizedClickPoint`, `normalizedBbox`, `appliedScaleMapping`, `geometryGuardRef`, `failureReason`, `reviewRequiredReason`, `dataQualityFlags`, and `runtimeProof`.
- Mouse Click and Mouse Scroll may consume only Geometry Guard approved executable geometry.
- Visual Target may provide non-executable handoff; it must not replace Geometry Guard.
- Screenshot may provide image evidence and scaleMapping; it must not replace Geometry Guard.
- AI may provide candidate data upstream; it must not replace Geometry Guard.
- Platform adapters, runtime, and browser helpers must not own geometry safety truth.

### 禁止

FORBIDDEN:
- `plan-coordinate-action`.
- `calibrate-browser-geometry` as public child owner.
- `verify-browser-geometry` as public child owner.
- action plans, action recipes, fallback modes, target-action allowlists.
- `actionPlan`, `fallbackMode`, `requestedActionType`, `TARGET_ACTION_ALLOWLIST`.
- business verbs inside Geometry Guard: `open_comments`, `continue_next`, `click_not_interested`, `capture_video_region`, `capture_comment_region`, `like_or_save_candidate`.
- Mouse Click or Mouse Scroll computing bbox/clickPoint from raw image evidence.
- Visual Target output treated as directly executable geometry.
- platform adapter geometry decision helper.

Required inspector:
- Import graph check for second geometry owners.
- Forbidden symbol/literal scan.
- Mouse Click / Mouse Scroll downstream consumption check.
- Visual Target to Geometry Guard public handoff check.
- Geometry Guard public surface check.

Required real-code-inspection:
- Add `plan-coordinate-action` child → FAIL.
- Add `fallbackMode` to result → FAIL.
- Add Mouse Click scaleMapping remap → FAIL.
- Add platform adapter `isCoordinateSafe` → FAIL.

---

## Law GRASSEYE-GEOMETRY-GUARD-CAPABILITY-002-V3

status: active
tier: P0
capabilityDomain: geometry-guard-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Geometry Guard public contract must stay clean, native, and independent.

### 主题

合同纯度与旧类型隔离

### 法条

Geometry Guard public contract must own its own geometry types and must not inherit action, browser, visual-action, or platform ownership.

Public contract may expose:

```txt
GeometryGuardAbilityInput
GeometryGuardAbilityResult
GeometryCoordinateSpace
GeometryExecutionSpace
GeometryScaleMapping
GeometryBbox
GeometryClickPoint
GeometryGuardDecision
GeometryGuardFailureReason
GeometryGuardSafetyPolicy
GeometryGuardRuntimeProof
```

Required input concepts:
```txt
sourceCoordinateSpace
requestedExecutionSpace
bbox
clickPoint
imageSize
viewportSize
screenSize
deviceScaleFactor
scaleMapping
sourceScreenshotEvidenceRef
sourceTargetRef
sourceAiResultRef
sourcePageStateProofRef
sourceVisualTargetResultRef
sourceGeometryHandoffRef
```

Coordinate spaces must remain distinct:
```txt
browserViewport
desktopScreen
imageEvidence
aiInput
regionCrop
contactSheet
```

### 禁止

FORBIDDEN public contract imports / exports:
- `BrowserController`.
- `PlatformActionType`.
- `../../types/visual-action`.
- old `VisualTarget` types as public truth.
- Mouse Click / Mouse Scroll execution types.
- raw browser session types.
- `actionPlan`.
- `fallbackMode`.
- `requestedActionType`.
- target-action allowlists.

Required inspector:
- Public contract import ban.
- Public export ban.
- Type ownership check.
- `index.ts` export-star ban.
- Private runtime/children import ban outside Geometry Guard root.

Required real-code-inspection:
- Import `BrowserController` in contract → FAIL.
- Export old `VisualTarget` type → FAIL.
- Add `requestedActionType` to result → FAIL.
- Add `export *` in index → FAIL.

---

## Law GRASSEYE-GEOMETRY-GUARD-CAPABILITY-003-V3

status: active
tier: P0
capabilityDomain: geometry-guard-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Geometry Guard input must carry full chain fields, source refs, coordinate evidence, idempotency, and policy.

### 主题

输入链路与证据完整性

### 法条

Every `GeometryGuardAbilityInput` must be traceable to the mission/map/step/capability call that requested executable geometry gating.

Required input fields:

```txt
abilityGroupId = geometry-guard
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
sourceScreenshotEvidenceRef
sourceTargetRef
sourceAiResultRef
sourcePageStateProofRef
sourceVisualTargetResultRef
sourceGeometryHandoffRef
sourceCoordinateSpace
requestedExecutionSpace
bbox
clickPoint
imageSize
viewportSize
screenSize
deviceScaleFactor
scaleMapping
safetyPolicy
dataQualityFlags
idempotencyKey
```

Required:
- Missing `stepId`, `capabilityCallId`, `activationSnapshotRef`, `nerveBusEnvelopeId`, `mapPackageVersion`, or `selectedMapVersion` must fail/review_required; never success.
- Missing `inputRef` or `sourceRef` must fail/review_required; never success.
- Missing idempotencyKey must fail/review_required; never success.
- `sourceScreenshotEvidenceRef` is required for image evidence, aiInput, regionCrop, contactSheet, or transformed coordinate sources.
- `sourceTargetRef` or `sourceVisualTargetResultRef` is required when input comes from Visual Target.
- `sourceAiResultRef` is required when sourceCoordinateSpace is `aiInput` or source came from AI candidate.
- Invalid input failure must include typed proof and `receivedShapeHash`.

### 禁止

FORBIDDEN:
- Fabricated missionId/runId/stepId.
- Success with missing chain fields.
- Success without source refs.
- Success without idempotencyKey.
- Silent default sourceCoordinateSpace.
- Silent default requestedExecutionSpace.
- Adapter-local shadow input shape.

Required inspector:
- Schema field existence.
- Input gate call.
- Chain field gate.
- Source ref gate.
- Invalid input proof with receivedShapeHash.

Required real-code-inspection:
- Remove `activationSnapshotRef` from input → FAIL.
- Remove `capabilityCallId` from input → FAIL.
- Remove `nerveBusEnvelopeId` from input → FAIL.
- Success without `sourceRef` → FAIL.
- Success without `idempotencyKey` → FAIL.

---

## Law GRASSEYE-GEOMETRY-GUARD-CAPABILITY-004-V3

status: active
tier: P0
capabilityDomain: geometry-guard-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Geometry Guard must validate finite geometry, coordinate space, scale mapping, bounds, click safety, and execution target without silent clamp.

### 主题

坐标空间、映射、边界与点击安全执法

### 法条

Geometry Guard consumes evidence-backed geometry only and must refuse unsafe or ambiguous coordinate transitions.

Required:
- `coordinateSpace` must be explicit.
- bbox must contain finite x, y, width, height.
- bbox.width and bbox.height must be greater than 0.
- clickPoint must contain finite x and y.
- clickPoint must be inside bbox when clickPoint is required.
- requested execution into `browserViewport` or `desktopScreen` must emit `normalizedClickPoint`.
- requested execution into `desktopScreen` must require `deviceScaleFactor`.
- sourceCoordinateSpace `aiInput` requires scaleMapping before allow.
- sourceCoordinateSpace `regionCrop` requires mapping back to governed source before allow.
- `contactSheet` coordinates must not be directly executable.
- Geometry Guard must not silently clamp coordinates.
- Missing evidence may downgrade to review_required only if policy allows; it must never be hidden.
- output `geometryGuardRef`, `guardDecision`, `normalizedClickPoint`, and `normalizedCoordinateSpace` are the downstream execution authority.

### 禁止

FORBIDDEN:
- allowing `aiInput` into executable spaces without scaleMapping.
- allowing `contactSheet` directly into browserViewport or desktopScreen.
- allowing `regionCrop` without source mapping.
- silent clamp.
- guessed deviceScaleFactor.
- action type deciding geometry verdict.
- allowing clickPoint outside bbox.
- allowing bbox out of source/target bounds.
- `Math.max/min` clamp used to “fix” coordinates after validation failure.

Required inspector:
- Coordinate-space gate.
- Bounds gate.
- Scale-mapping gate.
- Click-safety gate.
- No silent clamp patterns.
- Device scale factor gate.
- ContactSheet block.

Required real-code-inspection:
- `aiInput` without scaleMapping returns allow → FAIL.
- `contactSheet` returns allow into browserViewport → FAIL.
- Missing deviceScaleFactor for desktopScreen returns allow → FAIL.
- Silent clamp introduced → FAIL.
- clickPoint outside bbox returns allow → FAIL.

---

## Law GRASSEYE-GEOMETRY-GUARD-CAPABILITY-005-V3

status: active
tier: P0
capabilityDomain: geometry-guard-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Geometry Guard must use one fixed gate pipeline and must remain side-effect free.

### 主题

单链管线与无副作用

### 法条

Geometry Guard execution pipeline must be fixed:

```txt
input schema gate
→ child registry gate
→ source evidence gate
→ coordinate space gate
→ bbox integrity gate
→ click point gate
→ scale mapping gate
→ bounds gate
→ transform gate
→ execution-space gate
→ output boundary gate
→ proof builder
→ result builder
```

Required:
- Unknown child returns typed failed result with proof.
- Every gate failure returns typed failed/review_required result with proof.
- Every gate decision must enter runtimeProof.
- Child implementations call unified Geometry Guard runtime.
- Child implementations cannot construct final proof/result directly.
- Geometry Guard must not perform side effects.

Forbidden:
- direct BrowserController usage.
- screenshot capture.
- AI execution.
- Visual Target execution.
- click or scroll execution.
- Page State / PAV decision.
- Forensics write.
- Orchestration branch.
- Nerve Bus dispatch.
- child direct final result.
- child returning raw boolean.
- child importing sibling implementation.
- child importing Mouse Click / Scroll / Screenshot / AI / Visual Target / Forensics / Orchestration.

Required inspector:
- Pipeline call-order check.
- Required gate presence.
- Child unified-runtime check.
- Forbidden imports/symbols.
- Unknown child proof check.

Required real-code-inspection:
- Remove coordinate-space gate → FAIL.
- Remove scale-mapping gate → FAIL.
- Child returns boolean → FAIL.
- Child builds final result directly → FAIL.
- Geometry Guard imports BrowserController → FAIL.

---

## Law GRASSEYE-GEOMETRY-GUARD-CAPABILITY-006-V3

status: active
tier: P0
capabilityDomain: geometry-guard-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Geometry Guard result and owner evidence must preserve real upstream chain, gate decisions, refs, and normalized geometry.

### 主题

结果与运行证明完整性

### 法条

`GeometryGuardAbilityResult` and `GeometryGuardRuntimeProof` must preserve the same real upstream chain as input.

Required result fields:

```txt
status = success | failed | review_required
abilityGroupId = geometry-guard
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
geometryGuardRef
guardDecision = allow | block | review_required
output
normalizedCoordinateSpace
normalizedClickPoint
normalizedBbox
appliedScaleMapping
sourceScreenshotEvidenceRef
sourceTargetRef
sourceAiResultRef
sourcePageStateProofRef
sourceVisualTargetResultRef
failureReason
reviewRequiredReason
diagnosticPayloadRef
debugLogRef
runtimeProof
policyDecision
sourceEvidenceDecision
coordinateSpaceDecision
boundsDecision
scaleDecision
transformDecision
executionSpaceDecision
outputBoundaryDecision
dataQualityFlags
statusMessage
startedAt
endedAt
durationMs
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
abilityGroupId = geometry-guard
childCapabilityId
sourceAbilityGroupId
sourceChildCapabilityId
inputRef
sourceRef
outputRef or diagnosticPayloadRef
sourceScreenshotEvidenceRef
sourceTargetRef
sourceAiResultRef
sourcePageStateProofRef
sourceVisualTargetResultRef
sourceCoordinateSpace
requestedExecutionSpace
normalizedCoordinateSpace
sourceBounds
targetBounds
bboxBefore
bboxAfter
clickPointBefore
clickPointAfter
scaleMappingRef
appliedScaleMappingHash
deviceScaleFactor
idempotencyKey
sourceEvidenceDecision
coordinateSpaceDecision
policyDecision
boundsDecision
scaleDecision
transformDecision
executionSpaceDecision
outputBoundaryDecision
startedAt
endedAt
durationMs
status
guardDecision
failureReason
reviewRequiredReason
dataQualityFlags
receivedShapeHash if invalid input
```

Required:
- result/proof/input chain parity.
- no nullable chain fields for valid execution.
- `allow` requires output + outputRef.
- `block/review_required/failed` requires diagnosticPayloadRef.
- `runtimeProof.status === result.status`.
- `runtimeProof.guardDecision === result.guardDecision`.
- invalid input failure may use receivedShapeHash and typed proof.

### 禁止

FORBIDDEN:
- runtimeProof:null.
- status: ok.
- status: persisted.
- fabricated runId from sessionId/child/fingerprint.
- missionId = sessionId.
- success/allow without outputRef.
- failed/review result with output.
- proof/result chain mismatch.

Required inspector:
- Schema field checks.
- Result/proof/input parity.
- No fabricated chain pattern.
- Success/failure proof invariants.
- Gate decision fields.

Required real-code-inspection:
- Remove activationSnapshotRef from proof → FAIL.
- Set runId from sessionId + child → FAIL.
- `allow` without outputRef → FAIL.
- failed result with output → FAIL.
- runtimeProof null → FAIL.

---

## Law GRASSEYE-GEOMETRY-GUARD-CAPABILITY-007-V3

status: active
tier: P0
capabilityDomain: geometry-guard-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: downstream execution owners must consume only Geometry Guard approved executable geometry and must not redo mapping.

### 主题

下游执行边界

### 法条

Mouse Click and Mouse Scroll may consume only Geometry Guard approved executable geometry.

Required:
- Mouse Click executable coordinate input must contain `geometryGuardRef`.
- Mouse Click executable coordinate input must contain `guardDecision = allow`.
- Mouse Click must consume `normalizedClickPoint` from Geometry Guard result.
- Mouse Click must not consume raw Visual Target bbox/clickPoint directly.
- Mouse Click must not redo scaleMapping, imageEvidence mapping, aiInput mapping, or contactSheet mapping.
- Mouse Scroll region execution may consume only Geometry Guard approved anchorPoint or region reference.
- Mouse Scroll must not rebuild mappings from aiInput, contactSheet, or imageEvidence.
- Any direct raw coordinate from AI / Visual Target to Mouse Click must fail enforcement.

### 禁止

FORBIDDEN:
- Mouse Click computing executable coordinate from Visual Target output.
- Mouse Click computing executable coordinate from AI bbox.
- Mouse Scroll mapping aiInput/contactSheet/regionCrop by itself.
- Mouse Click or Mouse Scroll importing Geometry Guard internals instead of public result contract.
- direct execution on `sourceCoordinateSpace = aiInput`.
- direct execution on `sourceCoordinateSpace = contactSheet`.

Required inspector:
- Mouse Click input/result schema boundary.
- Mouse Scroll input/result schema boundary.
- Forbidden remap symbol scan downstream.
- Public Geometry Guard result consumption check.

Required real-code-inspection:
- Mouse Click consumes raw Visual Target clickPoint → FAIL.
- Mouse Click remaps aiInput scaleMapping → FAIL.
- Mouse Scroll remaps imageEvidence → FAIL.
- Mouse Click executes without geometryGuardRef → FAIL.

---

## Law GRASSEYE-GEOMETRY-GUARD-CAPABILITY-008-V3

status: active
tier: P0
capabilityDomain: geometry-guard-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Geometry Guard enforcement must close through owner-local AST/symbol/import-graph inspector, runner, and real-code-inspection.

### 主题

Geometry Guard 执法唯一入口

### 法条

Geometry Guard enforcement must close through:

```txt
scripts/audit/domains/geometry-guard-capability/manifest.json
scripts/audit/domains/geometry-guard-capability/inspector.ts
scripts/audit/domains/geometry-guard-capability/run-inspector.ts
scripts/audit/domains/geometry-guard-capability/owner-inspection-harness.ts
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
2. Public contract is geometry-only and native.
3. Input schema includes full chain fields.
4. Result/proof/input chain parity.
5. Coordinate spaces distinct.
6. aiInput requires scaleMapping before allow.
7. contactSheet cannot allow executable coordinates.
8. regionCrop requires source mapping before allow.
9. desktopScreen requires deviceScaleFactor.
10. no silent clamp.
11. output includes guardDecision and normalized executable geometry only when allow.
12. children use unified runtime.
13. no forbidden imports/symbols/business verbs.
14. downstream Mouse Click / Mouse Scroll consume only Geometry Guard approved geometry.
15. ALL active Geometry Guard laws in registry/matrix/audit-plan/runner.
16. owner-inspection-harness executed.
```

Required real-code-inspection:
```txt
manual-first enforcement reintroduced
remove capabilityCallId from input
remove activationSnapshotRef from input
remove nerveBusEnvelopeId from input
aiInput without scaleMapping returns allow
contactSheet returns allow into browserViewport
missing deviceScaleFactor returns allow for desktopScreen
silent clamp introduced
clickPoint outside bbox returns allow
result adds fallbackMode
result adds requestedActionType
proof runId from sessionId/child
proof missing activationSnapshotRef
allow without outputRef
failed with output
child imports BrowserController
child returns boolean
Mouse Click remaps Visual Target raw clickPoint
Mouse Scroll remaps aiInput
capability-check.ts added
remove real-code-inspection invocation
turn P0 into warning-only
```

---

## Final Readiness Gate

Geometry Guard is READY only when:

```txt
law/blueprint/inspector/generated/runner agree
all active Geometry Guard laws are machine-blocking
public contract is geometry-only and native
input chain fields complete
source refs and idempotency complete
aiInput/contactSheet/regionCrop rules enforced
desktopScreen deviceScaleFactor enforced
no silent clamp
result/proof/input chain parity passes
allow result has normalized executable geometry and outputRef
downstream Mouse Click/Mouse Scroll cannot bypass Geometry Guard
children are narrow geometry gates
owner-local inspector PASS
real-code-inspection PASS
ALL active law enforcement PASS
CI-FULL PASS
```
