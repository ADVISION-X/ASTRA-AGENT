---
name: "GrassEye Page State Capability"
description: "Use when governing the independent Page State Ability Group as raw page/runtime observation packaging only, and the boundary that prevents Page State, open, runtime, PAV, Screenshot, Visual Target, or adapters from claiming visual/page/business interpretation."
applyTo: ".github/instructions/cursor-rules/modules/module-page-state-capability.instructions.md, src/capabilities/page-state/**, docs/法案辅助文件/GrassEye Page State 页面状态感知能力组施工图.md, scripts/audit/domains/page-state-capability/**"
---

# GrassEye Page State Capability FINAL

Scope: governs the independent Page State Ability Group, raw current-page/runtime observation packaging, evidence-backed observation output, and page-state owner evidence. Page State no longer owns current-page classification, page readiness, login-state classification, safety-page detection, feed/video stability detection, modal/comment panel state classification, page abnormality classification, or platform page-kind classification.

Boundary: this module governs only the question: **what raw evidence about the page/runtime has been packaged for AI or downstream proof**. It does not govern page meaning, blocker meaning, action execution, action-result semantic verification, screenshot capture, AI execution, visual-target detection, comment extraction, product classification, evidence finalization, map branching, or mission progression.

Authority: this file is authoritative only for the `page-state-capability` domain.

Architecture phase: `Static Capability Package Architecture`.

Core doctrine:
- Page State is raw observation packaging, not perception, classification, or action-result verification.
- Page State consumes governed snapshots, raw runtime observations, open handoff refs, and evidence refs.
- Page State returns a structured raw observation package with proof.
- Page State does not capture screenshots, call AI, run visual target detection, click, scroll, type, open pages, query DOM/BOM, write Forensics, or choose the next step.
- Open/action abilities may say “I attempted/did an action”; Page State may only say “these raw fields/evidence refs were packaged”; AI decides what the page looks like and what it means.
- No observation support, no page-state success.
- No source proof, no governed observation.
- No chain fields, no production-ready Page State result.
- No active Page State law without inspector + runner + real-code-inspection.

---

## Global Page State Baseline

All active Page State laws in this file are:

```yaml
status: active
tier: P0
capabilityDomain: page-state-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection
```

Required package:

```txt
src/capabilities/page-state/
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

Required enforcement:

```txt
scripts/audit/domains/page-state-capability/
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
- empty real-code-inspection.

---

## Law GRASSEYE-PAGE-STATE-CAPABILITY-001-V2

status: active  
tier: P0  
capabilityDomain: page-state-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Page State is raw observation packaging only; AI owns all visual/page/business interpretation.

### 主题

页面原始观察打包边界唯一

### 法条

Page State Ability Group is the owner of governed raw page/runtime observation packaging only. AI Capability is the only owner of governed current-page, visual, blocker, readiness, target-identity, and business interpretation.

AI-only interpretations include:

```txt
logged_in
login_required
safety_wall
captcha_challenge
feed_ready
feed_not_ready
video_stable
video_unstable
comments_panel_open
comments_panel_closed
modal_overlay_present
modal_overlay_absent
page_abnormal
page_normal
platform_feed
platform_video_page
platform_unknown
wrong_domain
unknown_page
local_workbench
```

Required:
- All visual/page/business interpretation flows through AI Prompt Contract execution.
- Open, platform adapters, local runtime, workbench, Orchestration, PAV, Screenshot, Visual Target, and Page State may carry raw evidence but must not own final page-state truth.
- Page State packages currentUrl, currentTitle, browserLoginState, source refs, open handoff refs, and raw runtime signals only.
- Page State must not classify the current page as login, captcha, safety wall, feed, video, comment panel, abnormal, normal, correct, ready, stable, or wrong domain.
- Page State must not judge whether an action succeeded.
- Page State result may be consumed by AI, Orchestration, PAV, Commander, and Forensics as raw observation/proof only.

Forbidden:
- Page State, Open, platform adapter, local runtime, Workbench, Orchestration, PAV, Screenshot, or Visual Target deciding feed-ready/login-wall/safety-page/captcha/page-kind/page-correct/page-stable truth by itself.
- URL helpers deriving feed-ready/page-correct/platform-feed truth.
- `feedReady`, `pageReady`, `pageStateType = platform_feed`, `safety_wall present/absent`, `captcha present/absent`, `decision = allow` from page meaning, or confidence scores for page meaning outside AI.
- Platform adapter owning login/safety/feed-ready summary helpers.
- Agent runtime owning current-page classification truth.
- PAV replacing AI current-state interpretation.
- Action completion used as page-state proof.
- Page State owning startup entry-spine yes/no continuation for login-wall, safety-wall, captcha, or feed-ready routing.
- Duplicate page-state helpers outside Page State Ability Group.

Required inspector:
- Search forbidden state-truth symbols outside AI.
- Import graph check for duplicate page-state helpers.
- Open/platform/runtime/Page State/PAV/Screenshot/Visual Target state-truth ownership ban.
- Action completion as page-state proof ban.

Required real-code-inspection:
- Add feed-ready classifier in any non-AI file → FAIL.
- Add login-wall truth helper in platform adapter → FAIL.
- Use actionCompletion as page-state evidence → FAIL.

---

## Law GRASSEYE-PAGE-STATE-CAPABILITY-002-V2

status: active  
tier: P0  
capabilityDomain: page-state-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Page State boundary is pure and may only package raw governed inputs.

### 主题

页面状态边界纯洁

### 法条

Page State only packages raw observations, summarizes packaging, records proof, and returns raw observation refs.

Allowed:
- Consume governed snapshot.
- Consume governed observations.
- Consume governed evidence refs.
- Consume open handoff proof.
- Resolve platform profile through injected profile port.
- Check freshness.
- Check source binding.
- Preserve raw currentUrl/currentTitle/browserLoginState/sourceEvidenceRefs/openHandoff/runtimeSignalRefs without deriving page meaning.
- Produce owner evidence and structured result.

Forbidden:
- Screenshot capture.
- AI runtime call.
- Visual target detection execution.
- Click execution.
- Scroll execution.
- Text input execution.
- Open/navigation execution.
- Post-action verification decision.
- DOM/BOM lookup.
- BrowserController use.
- Comment extraction.
- Product classification.
- Final evidence persistence.
- Round branch decision.
- Nerve Bus dispatch.
- Forensics write.

Required inspector:
- Forbidden imports under `src/capabilities/page-state/**`.
- Forbidden symbol checks: click, scroll, type, openPage, captureScreenshot, executeAi, writeEvidence, dispatchEnvelope, advanceStep, querySelector, document/window access.
- External private path import ban.

Required real-code-inspection:
- Page State imports screenshot implementation → FAIL.
- Page State calls BrowserController → FAIL.
- Page State calls AI runtime → FAIL.
- Page State writes Forensics → FAIL.

---

## Law GRASSEYE-PAGE-STATE-CAPABILITY-003-V2

status: active  
tier: P0  
capabilityDomain: page-state-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Page State input must carry full chain fields, snapshot proof, observations, evidence refs, policies, and open handoff.

### 主题

输入链路与观察证据完整性

### 法条

Every `PageStateAbilityInput` must be traceable to the map step and capability call that requested the classification.

Required input fields:

```txt
abilityGroupId = page-state
childCapabilityId
requestedBy = orchestration or post-action-verification or commander-read-model if explicitly allowed
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
snapshot
observations
sourceEvidenceRefs
freshnessPolicy
confidencePolicy
statePolicy
openHandoff
inputRef
idempotencyKey
```

Snapshot must include:

```txt
snapshotId
currentUrl
currentTitle
browserLoginState
viewport
scrollOffset
capturedAt
sourceAbilityGroupId
sourceChildCapabilityId
sourceProofRef
```

Open handoff must include:

```txt
openProofRef
browserSessionRef
platformProfileId
```

Required:
- Missing `currentUrl` must fail.
- Missing `stepId/capabilityCallId/activationSnapshotRef/nerveBusEnvelopeId` must fail or review_required; never success.
- Missing `sourceEvidenceRefs` must fail unless child law explicitly allows no-evidence unknown state.
- Every observation must include `sourceProofRef`.
- Snapshot must include `sourceProofRef`.
- `currentUrl` must come from snapshot, not a separate mutable field.

Forbidden:
- Silent success without currentUrl.
- Silent success without snapshot proof.
- Silent success without observation/evidence support.
- Fabricating mission/run/step ids in Page State.
- Accepting raw browser state without source proof.

Required inspector:
- Schema field existence.
- Required chain fields.
- Snapshot proof field.
- Open handoff field.
- Input gate call order.

Required real-code-inspection:
- Remove activationSnapshotRef from input → FAIL.
- Remove capabilityCallId from input → FAIL.
- Remove nerveBusEnvelopeId from input → FAIL.
- Remove snapshot.sourceProofRef → FAIL.

---

## Law GRASSEYE-PAGE-STATE-CAPABILITY-004-V2

status: active  
tier: P0  
capabilityDomain: page-state-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Observations and evidence must be source-bound, fresh, and from allowed owners.

### 主题

观察来源与证据绑定门禁

### 法条

Page State may consume only governed observation/evidence sources.

Allowed observation source owners:

```txt
open
screenshot
visual-target
post-action-verification
runtime-signal
```

Every observation must include:

```txt
observationId
kind
capturedAt
sourceAbilityGroupId
sourceChildCapabilityId
sourceProofRef
payload
```

Required:
- `sourceAbilityGroupId` must be in allowlist.
- `sourceChildCapabilityId` must match allowed child list for that source owner.
- `sourceProofRef` must bind to request evidence chain, open proof, or snapshot proof.
- `capturedAt` must satisfy freshness policy.
- Snapshot capturedAt must satisfy freshness policy.
- Observation set must satisfy observation skew policy.
- Missing observation support for observation-required children must review/fail.
- Source mismatch must review/fail.

Forbidden:
- Observation without sourceProofRef.
- Observation from AI if AI is not explicitly allowed by this law.
- Observation from action ability as action-completion truth.
- Page-state success with stale snapshot.
- Page-state success with stale observation.
- Page-state success with source mismatch.

Required inspector:
- Observation schema.
- Source allowlist.
- Freshness gate.
- Observation proof binding gate.
- Observation-required child policy.

Required real-code-inspection:
- Add observation without sourceProofRef → FAIL.
- Add stale observation and return success → FAIL.
- Add forbidden source owner and return success → FAIL.

---

## Law GRASSEYE-PAGE-STATE-CAPABILITY-005-V2

status: active  
tier: P0  
capabilityDomain: page-state-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Page State output must be evidence-backed and cannot claim action-result verification truth.

### 主题

输出证据支撑与非动作验证

### 法条

`PageStateAbilityResult` must return only current-page state.

Result fields:

```txt
status = success | failed | review_required
decision = proceed | block | review_required | fail
abilityGroupId = page-state
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
output
pageStateType
stateSummary
confidence
evidenceRefs
observationRefs
sourceEvidenceRefs
pageStateFingerprint
previousPageStateFingerprint
failureReason
reviewRequiredReason
dataQualityFlags
diagnosticPayloadRef
debugLogRef
structuredRuntimeEventRef
runtimeProof
```

Success requirements:
- output exists.
- pageStateType exists.
- stateSummary exists.
- confidence >= confidencePolicy.minimumConfidence.
- evidenceRefs/sourceEvidenceRefs exist.
- observationRefs exist when child requires observation support.
- runtimeProof exists.
- runtimeProof.status equals result.status.
- runtimeProof.decision equals result.decision.
- criticalDataQualityDecision = allow.
- outputBoundaryDecision = allow.

Failure/review requirements:
- output = null.
- diagnosticPayloadRef exists.
- failureReason or reviewRequiredReason exists.
- runtimeProof exists.

Forbidden:
- `verified`, `verificationDecision`, `actionResultVerifiedRef` in Page State output/result.
- `status: ok`.
- `status: persisted`.
- silent page-state success.
- success without evidence/source refs.
- success with critical data quality flags.
- failed/review_required with output.
- action completion as proof.

Required inspector:
- Result schema superRefine.
- Output-boundary gate.
- Forbidden action-verification fields.
- Success support refs.
- Failure/review output null.

Required real-code-inspection:
- Add verificationDecision to result → FAIL.
- Return success without evidenceRefs → FAIL.
- Return success with low_confidence flag → FAIL.
- Return failed with output → FAIL.

---

## Law GRASSEYE-PAGE-STATE-CAPABILITY-006-V2

status: active  
tier: P0  
capabilityDomain: page-state-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Page State owner evidence must preserve real chain, gate decisions, source refs, and state fingerprint.

### 主题

页面状态运行证明完整性

### 法条

`PageStateRuntimeProof` must preserve the same real upstream chain as input and result.

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
abilityGroupId = page-state
childCapabilityId
inputRef
outputRef or diagnosticPayloadRef
debugLogRef
structuredRuntimeEventRef optional
snapshotId
snapshotProofRef
openHandoffProofRef
browserSessionRef
platformProfileId
resolvedPlatformProfileId
matchedHost
sourceAbilityGroupId
sourceChildCapabilityId
observationRefs
sourceEvidenceRefs
inputPayloadHash
snapshotHash
observationHash
pageStateFingerprint
previousPageStateFingerprint
currentUrl
currentTitle
classificationSource
inputDecision
payloadBudgetDecision
sourceBindingDecision
observationBindingDecision
freshnessDecision
platformDecision
classificationDecision
outputBoundaryDecision
criticalDataQualityDecision
proceedDecision
startedAt
endedAt
durationMs
status
decision
failureReason
reviewRequiredReason
dataQualityFlags
receivedShapeHash
```

Forbidden:
- nullable missionId/runId/stepId/capabilityCallId/activationSnapshotRef/nerveBusEnvelopeId in valid runtime result proof.
- runtimeProof chain different from result chain.
- proofId generated without input/snapshot/observation hash.
- success proof without outputRef.
- failed/review proof without diagnosticPayloadRef.
- fabricated missionId/runId from source names or fingerprint only.
- invalid input failure without receivedShapeHash.

Required inspector:
- Proof schema fields.
- Proof/result/input parity.
- No fabricated id pattern.
- Gate-decision fields.
- Invalid input proof includes receivedShapeHash.

Required real-code-inspection:
- Remove activationSnapshotRef from proof → FAIL.
- Set runId from fingerprint only → FAIL.
- Success without outputRef → FAIL.
- Failed without diagnosticPayloadRef → FAIL.

---

## Law GRASSEYE-PAGE-STATE-CAPABILITY-007-V2

status: active  
tier: P0  
capabilityDomain: page-state-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: child capabilities are narrow state classifiers and must use unified runtime gates.

### 主题

子能力窄职责与统一执行链

### 法条

Active children:

```txt
detect-login-state
detect-safety-page
detect-feed-ready
detect-video-stable
detect-comment-panel-state
detect-modal-overlay-state
detect-page-abnormality
detect-platform-page-kind
```

Required:
- Each child has `contract.ts`, `schema.ts`, `implementation.ts`.
- Each child returns `PageStateChildDetection`, not final `PageStateAbilityResult`.
- Each child consumes only `PageStateAbilityInput` and resolved profile from context.
- Each child cannot call screenshot, AI, visual-target, open, click, scroll, text-input, PAV, Forensics, Orchestration, Nerve Bus, BrowserController, DOM/BOM.
- Each child cannot build runtimeProof.
- Each child cannot use platform-specific hardcoded paths except through governed platform profile.
- Each child must use observations and policies, not hidden runtime truth.
- All final result/proof construction occurs in unified runtime path.

Forbidden:
- Child implementation building final result/proof.
- Child direct foreign ability import.
- Child returning boolean.
- Child using URL string includes for platform identity.
- Child hardcoding TikTok-only feed/video paths.
- Child reading DOM/BOM.

Required inspector:
- Child folder/registry/schema parity.
- Child return type.
- Forbidden imports/symbols.
- No platform path hardcode.

Required real-code-inspection:
- Child imports screenshot implementation → FAIL.
- Child returns boolean → FAIL.
- Child hardcodes TikTok path → FAIL.
- Child builds runtimeProof → FAIL.

---

## Law GRASSEYE-PAGE-STATE-CAPABILITY-008-V2

status: active  
tier: P0  
capabilityDomain: page-state-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Page State enforcement must close through owner-local AST/symbol inspector, runner, and real-code-inspection.

### 主题

Page State 执法唯一入口

### 法条

Page State enforcement must close through:

```txt
scripts/audit/domains/page-state-capability/manifest.json
scripts/audit/domains/page-state-capability/inspector.ts
scripts/audit/domains/page-state-capability/run-inspector.ts
scripts/audit/domains/page-state-capability/owner-inspection-harness.ts
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
- No empty real-code-inspection.
- No generated fake PASS.
- No verify script.
- No capability-check.ts under Page State root.

Required inspector checks:
```txt
1. Law file is machine-blocking.
2. Page State public contract is current-state only.
3. Input schema includes full chain fields.
4. Observation source allowlist.
5. Snapshot/open handoff proof required.
6. Freshness gate invoked.
7. Observation proof binding gate invoked.
8. Platform profile gate invoked.
9. Payload budget gate invoked.
10. Output boundary gate invoked.
11. owner evidence chain fields and parity.
12. Child registry parity and narrow child behavior.
13. No forbidden foreign imports.
14. No action-result verification fields.
15. No verify scripts or capability-check files.
16. ALL active Page State laws in registry/matrix/audit-plan/runner.
17. owner-inspection-harness executed.
```

Required real-code-inspection:
```txt
manual-first enforcement reintroduced
remove capabilityCallId from input
remove activationSnapshotRef from input
remove nerveBusEnvelopeId from input
remove snapshot.sourceProofRef
observation without sourceProofRef
forbidden observation owner returns success
stale snapshot returns success
success without evidenceRefs
success with low_confidence flag
result adds verificationDecision
failed result with output
proof runId from fingerprint
proof missing activationSnapshotRef
child imports screenshot implementation
child returns boolean
child hardcodes TikTok feed path
external import of child implementation
add verify-page-state-capabilities.ts
turn P0 into warning-only
remove real-code-inspection invocation
```

---

## Final Readiness Gate

Page State is READY only when:

```txt
law/blueprint/inspector/generated/runner agree
all active Page State laws are machine-blocking
Page State public contract is current-state only
input chain fields complete
snapshot/open handoff proof required
observations source-bound and fresh
output evidence-backed
action-result verification fields absent
runtimeProof preserves real chain and gate decisions
children are narrow classifiers
owner-local inspector PASS
real-code-inspection PASS
ALL active law enforcement PASS
CI-FULL PASS
```
