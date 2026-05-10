---
name: "GrassEye Screenshot Capability"
description: "Use when governing the independent Screenshot Ability Group, governed screenshot capture, screenshot artifact truth, coordinate-space truth, scale mapping, AI-input preparation, privacy/session gates, artifact persistence handoff, and the boundary that prevents AI, Visual Target, Geometry Guard, Page State, PAV, browser helpers, or platform adapters from owning screenshot truth."
applyTo: ".github/instructions/cursor-rules/modules/module-screenshot-capability.instructions.md, src/capabilities/screenshot/**, docs/法案辅助文件/GrassEye Screenshot 能力组施工图.md, scripts/audit/domains/screenshot-capability/**"
---

# GrassEye Screenshot Capability FINAL

Scope: governs the independent Screenshot Ability Group, screenshot capture and image-processing children, screenshot artifacts, image-kind taxonomy, coordinate-space taxonomy, scale mapping, source screenshot inheritance, screenshot owner evidence, artifact refs, browser/session/privacy gates, and Screenshot ownership boundaries.

Boundary: this module governs only screenshot/image artifact truth. It does not govern AI reasoning, OCR semantics, visual target detection, Geometry Guard decisions, click/scroll/text execution, Page State classification, Post-action Verification decisions, Forensics final persistence truth, Orchestration branching, product judgement, or comment extraction.

Authority: this file is authoritative only for the `screenshot-capability` domain.

Architecture phase: `Static Capability Package Architecture`.

Core doctrine:
- Screenshot is the eye-capture layer.
- Screenshot captures and transforms governed image evidence.
- Screenshot must preserve coordinate truth whenever pixels are cropped, resized, optimized, or prepared for AI.
- Screenshot may prepare AI input but must never perform AI judgement.
- Screenshot may output artifacts but must not decide targets, geometry safety, action success, page state, or business truth.
- `ai_input`, contact sheet, crop, resize, and coordinate-grid outputs are non-executable screenshot evidence.
- Screenshot must own coordinate-grid rendering and `gridSpecRef` generation for visual mission input.
- Coordinate-grid artifact and `gridSpecRef` must be emitted only after governed source proof, source coordinate space, and source screenshot evidence are known; pending provenance placeholders are forbidden.
- AI may output grid cell ids such as `A30` or `C50`, never raw executable `x/y`; `gridSpecRef` is the only decoder contract from AI grid cells to source viewport coordinates before Mouse Click, Text Input, and Forensics own execution and recording.
- Product-presence observation on the current video must stay lightweight: current-video capture/prepare flows use `ai_input` evidence policy, `preservePixels=false`, max AI width <= 720, and timeout/budget <= 1500ms.
- Product-presence `observation_lightweight` must prefer direct viewport region screencapture, must not fall back to full-screen source capture on the lightweight path, and must not keep full-screen source files as governed artifacts.
- Product-presence `observation_lightweight` prepare-ai-input must use lightweight JPEG encoding with quality in the 60-70 range and `mozjpeg=false`; evidence-grade encoding belongs only after a positive governed evidence branch.
- Screenshot runtime proof must expose `capturePhaseMs`, `imageProcessingPhaseMs`, `artifactStoragePhaseMs`, `outputBoundaryPhaseMs`, and `totalScreenshotStepMs` so screenshot latency stays auditable by phase.
- Screenshot must not force Route Plan or maps to reintroduce frame-specific 3s/6s/10s sampling steps just to feed `product_presence_judgment`.
- Evidence-grade screenshot capture belongs after a positive governed routeLabel branch such as `product_yes` / `read-comments-and-save-evidence`, not before AI product judgement completes.
- No source proof, no transformed artifact success.
- No scaleMapping, no AI-input/crop/resize success.
- No chain fields, no production-ready screenshot result.
- No active Screenshot law without inspector + runner + real-code-inspection.

---

## Global Screenshot Baseline

All active Screenshot laws in this file are:

```yaml
status: active
tier: P0
capabilityDomain: screenshot-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection
```

Required package:

```txt
src/capabilities/screenshot/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── registry.ts
├── index.ts
├── ports/
├── adapters/
├── shared/
├── runtime/
└── children/
```

Required children:

```txt
capture-browser-viewport
capture-desktop-screen
capture-region
optimize-lossless
prepare-ai-input
prepare-visual-mission-input
```

Required enforcement:

```txt
scripts/audit/domains/screenshot-capability/
├── manifest.json
├── inspector.ts
├── run-inspector.ts
└── owner-inspection-harness.ts
```

Forbidden:
- `manual-first` as active enforcement for this domain.
- `evidenceMode: law` as sufficient evidence.
- verify scripts as release truth.
- detached inspector.
- warning-only P0.
- generated fake PASS.
- empty or missing real-code-inspection.
- legacy screenshot drawer ownership.

---

## Law GRASSEYE-SCREENSHOT-CAPABILITY-001-V2

status: active
tier: P0
capabilityDomain: screenshot-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Screenshot Ability Group is the only owner of governed screenshot capture, image artifact truth, coordinate-space truth, and scale mapping.

### 主题

截图主权唯一

### 法条

Screenshot Ability Group is the only owner of governed screenshot capture and screenshot artifact truth.

Required:
- All governed screenshot operations must flow through `src/capabilities/screenshot` public interface.
- Screenshot truth includes artifact kind, image kind, coordinate space, source screenshot inheritance, scale mapping, artifact refs, output hash, and owner evidence.
- Browser helpers, platform adapters, local AI adapters, visual target, geometry guard, page state, PAV, orchestration, and Forensics must not own screenshot truth.
- BrowserController may exist only behind `ScreenshotCapturePort` / screenshot adapter boundary.
- `src/features/platform-action/screenshot-drawer` and any deleted historical screenshot drawer path must not survive as active owner.

Forbidden:
- platform-action owning screenshot strategy.
- browser helpers exposing governed screenshot result directly.
- local-ai resizing/cropping screenshot artifacts independently.
- visual-target producing screenshot artifacts.
- geometry-guard modifying screenshot artifact truth.
- hidden screenshot artifact universes outside Screenshot.
- adapter-local `ScreenshotArtifact` contracts.
- direct execution of contact sheet, crop, or AI-input coordinates.

Required inspector:
- Import graph check for second screenshot owners.
- Forbidden historical path check.
- Public contract ownership check.
- BrowserController only behind ScreenshotCapturePort adapter.

Required real-code-inspection:
- Add platform-action screenshot drawer active path → FAIL.
- Add local-ai resize/crop helper producing governed screenshot artifact → FAIL.
- Add direct BrowserController capture outside screenshot adapter → FAIL.

---

## Law GRASSEYE-SCREENSHOT-CAPABILITY-002-V2

status: active
tier: P0
capabilityDomain: screenshot-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Screenshot boundary stays pure: capture, lossless optimize, crop/region, AI input preparation, artifact refs, and proof only.

### 主题

纯截图边界

### 法条

Screenshot may capture images, optimize lossless outputs, crop regions, prepare AI input, store artifact refs through screenshot artifact port, and return structured screenshot proof.

Allowed:
- capture browser viewport through `ScreenshotCapturePort`.
- capture desktop screen through governed capture adapter.
- capture region from governed source image.
- optimize lossless output.
- prepare AI input by crop/resize with scaleMapping.
- write screenshot artifact refs through `ScreenshotArtifactPort`.
- produce screenshot owner evidence and structured result.

Forbidden:
- AI judgement.
- OCR semantics.
- visual target detection.
- coordinate action.
- Geometry Guard decision.
- click/scroll/text input.
- Page State classification.
- Post-action Verification decision.
- product classification.
- comment extraction.
- Orchestration branch decision.
- Forensics final evidence packet construction.
- DOM/BOM query.
- cookie/localStorage/sessionStorage reads.

Required inspector:
- Forbidden imports/symbols under `src/capabilities/screenshot/**`.
- DOM/BOM/cookie read ban.
- Screenshot result field ban for AI/VisualTarget/PAV/PageState truth.

Required real-code-inspection:
- Screenshot imports AI runtime → FAIL.
- Screenshot imports visual-target implementation → FAIL.
- Screenshot reads `document.cookie` → FAIL.
- Screenshot result includes `targetCoordinates` or `verificationDecision` → FAIL.

---

## Law GRASSEYE-SCREENSHOT-CAPABILITY-003-V2

status: active
tier: P0
capabilityDomain: screenshot-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Screenshot input must carry full chain fields, source proof, privacy policy, capture policy, idempotency, and timeout.

### 主题

截图输入链路完整性

### 法条

Every `ScreenshotAbilityInput` must be traceable to the mission/map/step/capability call that requested the screenshot or image transform.

Required input fields:

```txt
abilityGroupId = screenshot
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
source
sourceProof where source is stored_image / region / optimize / ai_input transform
pageStateProof when browser/page source requires current-state support
privacyPolicy
capturePolicy
inputRef
idempotencyKey
timeoutMs or capturePolicy.maxDurationMs
```

Startup bootstrap exception:
- AI-first startup browser viewport capture may omit `pageStateProof` only for the first governed bootstrap capture when `capturePolicy.allowFirstCaptureWithoutPageStateProof = true` and the request carries governed open-handoff support.
- Screenshot must not fabricate or backfill fake `pageStateProof` just to satisfy startup bootstrap.

Source proof for transformed artifacts must include:

```txt
proofRef
sourceKind
sourceStorageRef or sourceArtifactRef
sourceScreenshotEvidenceId
sourceHash
coordinateSpace
sourceWidth
sourceHeight
sessionId
roundId
videoVisitId
stepId
capabilityCallId
pageStateProofRef where applicable
browserSessionRef where applicable
```

Stored image `sourceProof` must match `ScreenshotSourceProofSchema` exactly. Outer governed runtime chain fields such as `missionId`, `runId`, `mapPackageId`, `mapPackageVersion`, `selectedMapId`, `selectedMapVersion`, `activationSnapshotRef`, `nerveBusEnvelopeId`, `idempotencyKey`, and `timeoutMs` belong to `ScreenshotAbilityInput`, runtime proof, Orchestration structured runtime events, and Forensics proof chain. They must not be copied into `source.sourceProof`.

Required:
- Missing `stepId`, `capabilityCallId`, `activationSnapshotRef`, `nerveBusEnvelopeId`, `mapPackageVersion`, or `selectedMapVersion` must fail/review_required; never success.
- Missing `inputRef` cannot success.
- Missing `idempotencyKey` cannot success.
- Missing timeout policy cannot success.
- Stored image / crop / optimize / prepare-ai-input must have sourceProof.
- Stored image source handoff must keep `sourceProof` inside the strict Screenshot public source-proof contract.
- Browser viewport capture must have browser session proof unless the child law explicitly allows desktop/local diagnostic mode.
- Desktop capture must require privacy policy approval unless lawfully allowed as local diagnostic.

Forbidden:
- nullable mission/run/step fields in valid execution success.
- sourceProof without sourceScreenshotEvidenceId for transformed artifacts.
- sourceProof carrying outer governed runtime chain fields such as missionId/runId/map ids/activation/envelope/idempotency/timeout.
- widening `ScreenshotSourceProofSchema`, using passthrough, or filtering inside prepare-ai-input to hide adapter pollution.
- fabricated mission/run/step ids.
- silent first-capture without page-state/browser proof unless policy explicitly returns review_required.
- success without idempotencyKey.

Required inspector:
- Schema field existence.
- Input gate call order.
- Source-proof requirement by child.
- Privacy policy gate presence.
- Timeout/idempotency field requirement.
- Stored image source handoff pollution check: `buildSourceProof` must not emit outer governed runtime chain fields.

Required real-code-inspection:
- Remove `activationSnapshotRef` from input → FAIL.
- Remove `capabilityCallId` from input → FAIL.
- Remove `nerveBusEnvelopeId` from input → FAIL.
- prepare-ai-input without sourceProof returns success → FAIL.
- Add `missionId` or `runId` to stored_image `sourceProof` builder → FAIL.
- Widen `ScreenshotSourceProofSchema` to hide source handoff pollution → FAIL.

---

## Law GRASSEYE-SCREENSHOT-CAPABILITY-004-V2

status: active
tier: P0
capabilityDomain: screenshot-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Screenshot coordinate spaces and scale mapping must be explicit, lossless where claimed, and non-executable until downstream governance.

### 主题

coordinateSpace 与 scaleMapping 硬门禁

### 法条

Screenshot artifacts must preserve coordinate meaning across every capture, crop, resize, optimization, and AI-input preparation.

Allowed image kinds:

```txt
evidence_original
evidence_optimized
ai_input
region_crop
contact_sheet
coordinate_grid
visual_mission_input
```

Allowed coordinate spaces:

```txt
browser_viewport_pixels
desktop_screen_pixels
source_image_pixels
region_crop_pixels
ai_input_pixels
optimized_equivalent_pixels
contact_sheet_pixels
coordinate_grid_pixels
grid_cell_index_space
```

Required:
- `evidence_original` preserves original coordinate space.
- `evidence_optimized` must preserve pixel dimensions and coordinate space equivalent to source.
- `optimize-lossless` must not change width/height/coordinate space.
- `region_crop` must carry sourceScreenshotEvidenceId, crop offset, source dimensions, target dimensions, scaleX, scaleY.
- `prepare-ai-input` must carry sourceScreenshotEvidenceId, scaleMapping, source dimensions, target dimensions, crop offset, scaleX, scaleY.
- `prepare-visual-mission-input` must carry sourceScreenshotEvidenceId, inherited source scale mapping, coordinate-grid artifact proof, `gridSpecRef`, and `visualMissionInputRef`.
- `ai_input_pixels`, `contact_sheet_pixels`, and `coordinate_grid_pixels` are never executable coordinate truth.
- `grid_cell_index_space` is a governed AI-to-system location language, never executable mouse truth by itself.
- `coordinate_grid` is a governed screenshot-derived artifact and decoder language layer, not final evidence packet truth.
- Any resize/crop that changes coordinate meaning must produce scaleMapping.
- Visual Target and Geometry Guard must use scaleMapping before executable coordinate reasoning.
- Mouse Click must continue to consume Geometry Guard proof-gated executable coordinates, never AI raw `x/y`.

Forbidden:
- `prepare-ai-input` success without scaleMapping.
- `prepare-visual-mission-input` success without `gridSpecRef` / `visualMissionInputRef` / coordinate-grid artifact proof.
- crop/region success without sourceScreenshotEvidenceId.
- lossless optimize changing dimensions.
- contactSheet used as executable coordinate space.
- ai_input used as executable coordinate space.
- coordinate_grid used as executable coordinate space.
- gridSpec generated outside Screenshot.
- coordinate grid rendered outside Screenshot.
- pending visual-mission provenance placeholders.
- AI raw `x/y` accepted as executable mouse coordinate.
- Mouse Click consuming AI raw coordinates without Screenshot decoder + Geometry Guard proof.
- hidden resizing/cropping policies outside Screenshot.
- scaleMapping with null sourceScreenshotEvidenceId for transformed artifacts.

Required inspector:
- Result schema superRefine for imageKind/coordinateSpace/scaleMapping.
- owner evidence scaleMapping checks.
- Child-specific coordinate policy checks.
- Forbidden executable coordinate field scan.

Required real-code-inspection:
- prepare-ai-input success without scaleMapping → FAIL.
- region crop success without sourceScreenshotEvidenceId → FAIL.
- optimize-lossless changes dimensions → FAIL.
- ai_input marked executable → FAIL.

---

## Law GRASSEYE-SCREENSHOT-CAPABILITY-005-V2

status: active
tier: P0
capabilityDomain: screenshot-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Screenshot runtime must use one fixed gate pipeline and fail closed on privacy, source, session, timeout, artifact, and output-boundary violations.

### 主题

截图单链执行管线

### 法条

Screenshot execution pipeline must be fixed:

```txt
input schema gate
→ child registry gate
→ privacy policy gate
→ source proof gate
→ browser session gate where capture-browser-viewport
→ page-state handoff/support gate where required
→ region proof gate where region/crop
→ payload budget gate
→ timeout/cancellation gate
→ capture runner or image-processing runner
→ scale-mapping gate
→ artifact storage gate
→ output boundary gate
→ proof builder
→ result builder
```

Required:
- Privacy policy gate runs before desktop/fullscreen capture.
- Source proof gate runs before stored-image transform.
- Browser session gate runs before browser viewport capture.
- Region proof gate validates crop bounds and sourceScreenshotEvidenceId.
- Timeout/cancellation gate must propagate AbortSignal where port supports it and enforce hard timeout.
- Artifact storage gate must run before success result.
- Output boundary gate must reject AI/VisualTarget/PAV/PageState truth fields.
- Every gate failure returns typed failed/review result with proof.

Forbidden:
- child direct final result/proof.
- capture without privacy gate.
- browser capture without browser session gate.
- image processing without source proof.
- success without artifact storage.
- timeout success race.
- fake/fallback/no-op screenshot success.
- runtimeProof null.

Required inspector:
- Pipeline call-order check.
- Gate presence check.
- Timeout/AbortSignal check.
- Artifact storage proof check.
- Fake success ban.

Required real-code-inspection:
- Remove privacy gate → FAIL.
- Remove source proof gate → FAIL.
- Remove artifact storage gate → FAIL.
- Timeout returns success → FAIL.

---

## Law GRASSEYE-SCREENSHOT-CAPABILITY-006-V2

status: active
tier: P0
capabilityDomain: screenshot-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Screenshot result and owner evidence must preserve real chain, artifact refs, hashes, source refs, scale mapping, gate decisions, and parity.

### 主题

截图结果与运行证明完整性

### 法条

`ScreenshotResult` and `ScreenshotRuntimeProof` must preserve the same real upstream chain as input.

Required result fields:

```txt
abilityGroupId
childCapabilityId
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
output
failureReason
reviewRequiredReason
diagnosticPayloadRef if failed/review
runtimeProof
dataQualityFlags
```

Required output fields:

```txt
artifactRef
evidenceId
pageUrl
pageTitle
width
height
originalWidth
originalHeight
imageKind
coordinateSpace
scaleMapping when transformed
sourceScreenshotEvidenceId when transformed
screenId
sourceHash
outputHash
regionLabel
regionType
contentLines
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
abilityGroupId = screenshot
childCapabilityId
sourceAbilityGroupId
sourceChildCapabilityId
inputRef
outputRef or diagnosticPayloadRef
sourceProofRef
pageStateProofRef
browserSessionRef
screenshotEvidenceId
artifactRef
sourceArtifactRef
sourceScreenshotEvidenceId
sourceHash
outputHash
sourceWidth
sourceHeight
outputWidth
outputHeight
coordinateSpace
sourceCoordinateSpace
scaleMapping
region
idempotencyKey
timeoutDecision
abortDecision
privacyDecision
sourceDecision
browserSessionDecision
pageStateDecision
regionDecision
captureDecision
imageProcessingDecision
scaleMappingDecision
artifactDecision
outputBoundaryDecision
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
- success requires output + outputRef + artifactRef + screenshotEvidenceId + outputHash + dimensions.
- failed/review_required requires output null + diagnosticPayloadRef.
- runtimeProof.status equals result.status.
- no nullable chain fields for valid execution.
- invalid input failure may use receivedShapeHash and typed proof.

Forbidden:
- `runtimeProof: null`.
- `status: ok`.
- `status: persisted`.
- fabricated runId/missionId/stepId from source names or fingerprints.
- proof/result chain mismatch.
- success without outputRef.
- success without artifactRef.
- failed/review_required with output.

Required inspector:
- Schema field checks.
- Result/proof/input parity.
- No fabricated id pattern.
- Success/failure proof invariants.

Required real-code-inspection:
- Remove `activationSnapshotRef` from proof → FAIL.
- Set runId from sessionId + child → FAIL.
- Success without artifactRef → FAIL.
- Failed with output → FAIL.

---

## Law GRASSEYE-SCREENSHOT-CAPABILITY-007-V2

status: active
tier: P0
capabilityDomain: screenshot-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Screenshot child capabilities are narrow capture/transform bindings and must use unified Screenshot runtime.

### 主题

子能力窄职责与统一运行链

### 法条

Active child capabilities:

```txt
capture-browser-viewport
capture-desktop-screen
capture-region
optimize-lossless
prepare-ai-input
prepare-visual-mission-input
```

Required:
- Each child has `contract.ts`, `schema.ts`, `implementation.ts`.
- Each child uses unified Screenshot executor/runtime.
- Child implementation must not build final proof/result directly unless delegated to shared builder by the unified runtime.
- Child must not import sibling child implementation.
- Child must not import AI, Visual Target, Geometry Guard, Mouse, PAV, Forensics, Orchestration, or BrowserController directly.
- `capture-browser-viewport` must use browser capture port only.
- `capture-desktop-screen` must use governed capture port and privacy gate.
- `capture-region`, `optimize-lossless`, and `prepare-ai-input` must use source proof and image-processing port.
- `prepare-visual-mission-input` must use source proof, image-processing port, governed coordinate-grid artifact storage, and Screenshot-owned structured refs.

Forbidden:
- child returning boolean.
- child direct BrowserController import.
- child direct filesystem artifact universe outside artifact port.
- child hardcoded crop/resize without scaleMapping.
- child direct final success without artifact storage.
- child importing sibling implementation.

Required inspector:
- Child folder/registry/schema parity.
- Child uses unified executor.
- Forbidden imports/symbols.
- Child-specific operation checks.

Required real-code-inspection:
- Child returns boolean → FAIL.
- Child imports BrowserController → FAIL.
- Child imports sibling implementation → FAIL.
- prepare-ai-input hardcodes resize without scaleMapping → FAIL.
- prepare-visual-mission-input returns raw executable `x/y` instead of grid-cell decoder material → FAIL.

---

## Law GRASSEYE-SCREENSHOT-CAPABILITY-008-V2

status: active
tier: P0
capabilityDomain: screenshot-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Screenshot enforcement must close through owner-local AST/symbol/import-graph inspector, runner, and real-code-inspection.

### 主题

Screenshot 执法唯一入口

### 法条

Screenshot enforcement must close through:

```txt
scripts/audit/domains/screenshot-capability/manifest.json
scripts/audit/domains/screenshot-capability/inspector.ts
scripts/audit/domains/screenshot-capability/run-inspector.ts
scripts/audit/domains/screenshot-capability/owner-inspection-harness.ts
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
- No verify script.
- No capability-check.ts under Screenshot root.

Required inspector checks:
```txt
1. Law file is machine-blocking.
2. Public contract is screenshot-only.
3. Input schema includes full chain fields.
4. Source proof required for transformed artifacts.
5. Privacy gate invoked.
6. Browser session gate invoked for browser capture.
7. Source proof gate invoked for transforms.
8. Region proof gate invoked for region/crop.
9. Payload budget gate invoked.
10. Timeout/AbortSignal/hard timeout gate invoked.
11. Artifact storage gate invoked.
12. Scale mapping enforced for prepare-ai-input/region/resize.
13. Output boundary blocks AI/VisualTarget/PAV/PageState truth.
14. Result/proof/input chain parity.
15. Children use unified runtime.
16. No forbidden imports/symbols/DOM/BOM/cookie reads.
17. No second screenshot owner.
18. ALL active Screenshot laws in registry/matrix/audit-plan/runner.
19. owner-inspection-harness executed.
```

Required real-code-inspection:
```txt
manual-first enforcement reintroduced
remove capabilityCallId from input
remove activationSnapshotRef from input
remove nerveBusEnvelopeId from input
prepare-ai-input success without scaleMapping
region crop success without sourceScreenshotEvidenceId
optimize-lossless changes dimensions
success without artifactRef
success without outputHash
failed result with output
Screenshot imports AI runtime
Screenshot imports Visual Target implementation
Screenshot imports BrowserController directly
Screenshot reads document.cookie
platform-action screenshot drawer active path
local-ai resize/crop helper produces artifact truth
child returns boolean
child imports sibling implementation
remove real-code-inspection invocation
turn P0 into warning-only
```

---

## Law GRASSEYE-SCREENSHOT-CAPABILITY-ARTIFACT-LIFECYCLE-V1

status: active
tier: P0
capabilityDomain: screenshot-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Screenshot artifacts are transient runtime materials by default and must carry lifecycle manifest, retention, TTL, quota, physical burn-after-handoff cleanup, and non-self-promotion truth.

### 主题

Artifact Lifecycle / Screenshot Retention 治理

### 法条

Screenshot artifacts are runtime materials by default, not permanent evidence.

Required:
- Only product-selection evidence images formally accepted by Forensics/evidence-store may be retained as long-lived evidence; every other Screenshot-created file is ephemeral runtime material.
- Every governed success output/proof must carry `artifactLifecycleManifestRef`, `retentionClass`, `expiresAt`, `deleteAfter`, `artifactHash`, `byteSize`, `promotionStatus`, and `cleanupEligible`.
- Screenshot must persist a governed `ScreenshotArtifactLifecycleManifest` for every stored artifact.
- Screenshot must physically delete ephemeral work files after artifact handoff; this includes full-screen source captures, browser viewport work files, region/optimize work files, and AI-input prep work files.
- Screenshot must also physically delete non-evidence work files after artifact handoff failure or output-boundary failure; cleanup failure must fail closed.
- The only file allowed to survive Screenshot cleanup is the retained artifact `storageRef` itself; final long-term evidence retention remains Forensics-owned.
- Default retention classes are:
	- browser/desktop capture and lossless optimize → `transient-capture`
	- region crop → `transient-region`
	- AI input prep → `transient-ai-input`
	- diagnostic-only screenshot artifacts → `diagnostic-debug`
- Default TTL is `24h` for transient classes and `7d` for `diagnostic-debug`.
- Screenshot-emitted `promotionStatus` must start as `not_promoted`.
- Screenshot success output must never emit `promoted-evidence` or `legal-hold-evidence` retention classes.
- Artifact budget/backpressure gate must enforce:
	- `maxArtifactsPerMission`
	- `maxArtifactsPerRound`
	- `maxArtifactsPerVideoVisit`
	- `maxBytesPerMission`
	- `maxBytesPerRound`
	- `maxBytesPerVideoVisit`
	- `maxPendingTransientBytes`
	- `maxPendingTransientArtifacts`
- Cleanup eligibility must stay false until all of the following are true:
	- lifecycle manifest exists
	- artifact class is transient or diagnostic
	- artifact is expired
	- mission is not active
	- AI / Visual Target / PAV are not pending
	- artifact is not promoted
	- artifact is not pinned by Forensics
	- artifact has no legal hold
	- `refCount = 0`

Forbidden:
- treating Screenshot artifacts as permanent evidence by default.
- leaving `/tmp/grasseye-screenshot-*`, browser capture work files, or full-screen source captures behind after their governed handoff completes.
- using logs, manual cleanup, or debug scripts as a substitute for production-code physical deletion.
- success without lifecycle manifest ref.
- success without `artifactHash` or `byteSize`.
- success without `expiresAt` / `deleteAfter` for transient or diagnostic artifacts.
- Screenshot self-promotion to `promoted-evidence` or `legal-hold-evidence`.
- raw base64 as persisted artifact truth in output/proof.
- returning success after artifact budget/backpressure is exceeded.

Required inspector:
- Lifecycle schema field presence.
- Artifact budget/backpressure gate presence.
- Artifact storage gate writes lifecycle manifest.
- Execution phase invokes physical ephemeral work-file cleanup.
- Cleanup bypass is covered by real-code-inspection.
- Output boundary gate validates manifest parity and self-promotion ban.

Required real-code-inspection:
- Remove `artifactLifecycleManifestRef` from success output → FAIL.
- Remove `artifactHash` from proof/output → FAIL.
- Set Screenshot `promotionStatus` to `promoted` by default → FAIL.
- Remove ephemeral work-file cleanup after artifact handoff → FAIL.
- Artifact budget exceeded but Screenshot still returns success → FAIL.

---

## Final Readiness Gate

Screenshot is READY only when:

```txt
law/blueprint/inspector/generated/runner agree
all active Screenshot laws are machine-blocking
Screenshot public contract is screenshot-only
input chain fields complete
source proof and page-state/browser proof gates are enforced where required
privacy/session/source/region/timeout/artifact pipeline enforced
coordinate-space and scaleMapping policy blocks executable misuse
prepare-ai-input always preserves scaleMapping
result/proof/input chain parity passes
children are narrow capture/transform bindings
owner-local inspector PASS
real-code-inspection PASS
ALL active law enforcement PASS
CI-FULL PASS
```
