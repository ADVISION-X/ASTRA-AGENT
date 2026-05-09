---
name: "GrassEye Post-action Verification Capability"
description: "Use when governing the independent Post-action Verification Ability Group, post-action observation packaging, before/after evidence binding, observation proof, and the boundary that keeps final semantic judgment in AI rather than PAV."
applyTo: ".github/instructions/cursor-rules/modules/module-post-action-verification-capability.instructions.md, src/capabilities/post-action-verification/**, docs/法案辅助文件/GrassEye Post-action Verification 动作后验证能力组施工图.md, scripts/audit/domains/post-action-verification-capability/**"
---

# GrassEye Post-action Verification Capability FINAL

Scope: governs the independent Post-action Verification Ability Group as the owner of post-action observation packaging, before/after evidence binding, observation proof binding, and observation-package owner evidence integrity.

Boundary: this module governs only the packaging of governed post-action observations after an action has already executed and after bounded observations or evidence have already been collected. It does not execute actions, capture screenshots, call AI, detect visual targets, read DOM/BOM directly, write final evidence, or decide the final semantic action outcome.

Authority: this file is authoritative only for the post-action-verification-capability domain.

Architecture phase: Static Capability Package Architecture.

Core doctrine:
- Action execution success is not outcome truth.
- AI is the final semantic action-result judgment source when a mission needs semantic yes/no.
- Post-action Verification owns only post-action observation package integrity after the action.
- Post-action Verification consumes action refs, before/after evidence refs, governed observations, expected outcome, and verification policy.
- Post-action Verification returns a typed observation package or a fail-closed diagnostic.
- PAV public result and runtime-proof surfaces must not expose verificationDecision, confidence, confidencePolicy, minimumConfidence, or actionResultVerifiedRef.
- Explicit governed review is not a valid substitute for PAV in production automation.
- No bounded observations, no source proof, no package success.
- No active PAV law without inspector + runner + real-code-inspection.

---

## Global Post-action Verification Baseline

All active Post-action Verification laws in this file are:

```yaml
status: active
tier: P0
capabilityDomain: post-action-verification-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection
```

Required package:

```txt
src/capabilities/post-action-verification/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── registry.ts
├── index.ts
├── ports/
│   ├── post-action-evidence-read-port.ts
│   └── post-action-verification-clock-port.ts
├── shared/
│   ├── post-action-evidence.ts
│   ├── post-action-observation.ts
│   ├── post-action-policy.ts
│   ├── post-action-proof.ts
│   ├── post-action-result.ts
│   ├── post-action-types.ts
│   └── post-action-url.ts
├── runtime/
│   ├── post-action-decision-gate.ts
│   ├── post-action-result-builders.ts
│   ├── post-action-runtime-proof-builder.ts
│   ├── post-action-verification-executor.ts
│   └── post-action-verification-runtime-context.ts
└── children/
    └── post-action-observation-child.ts
```

Required enforcement:

```txt
scripts/audit/domains/post-action-verification-capability/
├── manifest.json
├── inspector.ts
├── run-inspector.ts
└── owner-inspection-harness.ts
```

Forbidden:
- manual-first as active enforcement for this domain.
- evidenceMode: law as sufficient evidence.
- verify scripts as release truth.
- detached inspector.
- warning-only P0.
- generated fake PASS.
- empty real-code-inspection.

---

## Law GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V2

status: active
tier: P0
capabilityDomain: post-action-verification-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: PAV is the only owner of governed post-action observation-package truth, while AI remains the final semantic judgment source.

### 主题

动作后观察包主权唯一

### 法条

Post-action Verification Ability Group is the only owner of governed post-action observation-package truth after an action has executed.

Required direction:
- Open, Mouse Click, Mouse Scroll, Text Input, Browser Controller, platform adapters, Page State, Screenshot, Visual Target, AI, Orchestration, and Forensics must not fabricate post-action observation-package truth.
- Primitive action success means only: an action attempt or primitive execution completed.
- Page State means only: current observed page/runtime state.
- AI observations may support PAV packaging, and AI remains the final semantic action-result judgment source when a mission needs semantic yes/no.
- Orchestration may branch on AI judgment and on PAV package status; it may not fabricate PAV output refs, package summaries, or runtime-proof fields.
- Forensics may persist PAV results; it may not decide semantic action outcome.
- No post-action surface may expose verificationDecision or confidencePolicy as a valid PAV contract.

### 禁止

FORBIDDEN:
- Mouse Click treating primitiveExecutionRef or browserActionId as final semantic outcome truth.
- Mouse Scroll treating scrollExecutionRef or browserActionId as final semantic outcome truth.
- Open treating navigation attempt as final semantic page-opened truth.
- Page State being used as a substitute for semantic action-result judgment.
- AI free-text output bypassing PAV package binding.
- Orchestration fabricating post-action package refs or runtime-proof refs.
- Forensics fabricating post-action package refs or runtime-proof refs.
- PAV input, output, or runtimeProof exposing verificationDecision, confidence, confidencePolicy, minimumConfidence, or actionResultVerifiedRef.

Required inspector:
- Import-graph and symbol checks for legacy verificationDecision or confidencePolicy fields on PAV and action-result surfaces.
- Action ability schemas must not expose final semantic outcome fields.
- Orchestration must consume PAV package status, not fabricate it.
- Page State cannot export PAV package truth.

Required real-code-inspection:
- Add verificationDecision to PAV output -> FAIL.
- Add confidencePolicy to PAV input -> FAIL.
- Add page-state-only final action-truth branch -> FAIL.

---

## Law GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-002-V2

status: active
tier: P0
capabilityDomain: post-action-verification-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: PAV boundary stays pure and cannot execute actions, capture evidence, call AI, or persist final evidence.

### 主题

纯观察包边界

### 法条

Post-action Verification consumes governed inputs and returns packaging status plus package or diagnostic. It may not execute side effects.

Allowed:
- Read bounded evidence through read ports.
- Read governed observations through read ports.
- Validate action proof refs.
- Validate evidence bindings and source proof refs.
- Enforce before/after and visual-evidence requirements.
- Build result and owner evidence.

Forbidden:
- Screenshot capture.
- AI execution.
- Visual target detection.
- Page-state collection.
- Browser, DOM, or BOM reads.
- Click, scroll, input, or open execution.
- Comment collection.
- Forensics final evidence write.
- Nerve Bus dispatch.
- Mission step advancement.
- Final semantic product yes/no judgment.

Required inspector:
- Forbidden imports: screenshot, open, mouse, text-input, browser, page-state, ai, forensics, orchestration implementation.
- Forbidden symbols: click, scroll, type, openPage, captureScreenshot, executeAi, writeEvidence, dispatchEnvelope, advanceStep.
- External private PAV path import ban.

Required real-code-inspection:
- Add screenshot implementation import -> FAIL.
- Add browser controller import -> FAIL.
- Add AI runtime call -> FAIL.
- Add Forensics writer call -> FAIL.
- Add Nerve Bus dispatch -> FAIL.

---

## Law GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V2

status: active
tier: P0
capabilityDomain: post-action-verification-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: PAV input must carry complete chain fields, action proof, governed observations, and packaging policy without confidence-policy drift.

### 主题

输入链路完整性

### 法条

Every PostActionVerificationAbilityInput must be fully traceable to the action it packages and the map step that requested packaging.

Every PostActionVerificationAbilityInput must include:

```txt
abilityGroupId = post-action-verification
childCapabilityId
requestedBy = orchestration
missionId
runId
sessionId
roundId or null
videoVisitId or null
stepId
mapPackageId
mapPackageVersion
selectedMapId
selectedMapVersion
activationSnapshotRef
capabilityCallId
nerveBusEnvelopeId
sourceAbilityGroupId
sourceChildCapabilityId
sourceActionType
expectedOutcome
actionProof
beforeAfterEvidence
observationSet
verificationPolicy
inputRef
idempotencyKey
```

Current phase-four sourceAbilityGroupId surface is limited to:

```txt
open
mouse-click
mouse-scroll
```

actionProof must include:

```txt
actionProofRef
actionLogRef or actionRecordRef
sourceRuntimeProofRef
sourceActionResultRef or sourceActionOutputRef
sourceAbilityGroupId
sourceChildCapabilityId
actionType
actionStatus
primitiveExecutionRef or navigationAttemptRef or scrollExecutionRef where applicable
sessionId
roundId or null
videoVisitId or null
startedAt
endedAt
selfReportedOnly
```

Required direction:
- Missing actionLogRef or actionRecordRef cannot produce package success.
- selfReportedOnly cannot produce package success unless verificationPolicy.allowSelfReportedSuccess = true.
- Missing sourceRuntimeProofRef cannot produce package success.
- Missing chain fields cannot produce package success.
- confidencePolicy and minimumConfidence are not valid PAV input concepts.

### 禁止

FORBIDDEN:
- PAV input without stepId.
- PAV input without capabilityCallId.
- PAV input without activationSnapshotRef.
- PAV input without actionProof.
- PAV input without verificationPolicy.
- PAV input containing confidencePolicy or minimumConfidence.
- Package success from selfReportedOnly action when allowSelfReportedSuccess = false.
- Package success without action log or action record.

Required inspector:
- Schema field checks.
- owner evidence chain field checks.
- Action proof gate call-order checks.
- Legacy confidence-policy field ban.

Required real-code-inspection:
- Remove capabilityCallId -> FAIL.
- Remove activationSnapshotRef -> FAIL.
- Remove verificationPolicy -> FAIL.
- Add confidencePolicy -> FAIL.
- selfReportedOnly returns success when allowSelfReportedSuccess = false -> FAIL.

---

## Law GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-004-V2

status: active
tier: P0
capabilityDomain: post-action-verification-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: PAV must fail-close on missing or invalid observation support and package only bounded observations with valid source proof.

### 主题

观察包门禁

### 法条

PAV must package only bounded observations and evidence that remain provably bound to the governed action.

Allowed observation kinds:

```txt
page_state
ai_observation
visual_target
screenshot_diff
video_identity
action_completion
runtime_signal
```

Allowed evidence kinds:

```txt
page_state
screenshot
visual_target
ai_observation
runtime_signal
screenshot_diff
video_identity
```

Allowed observation source ability groups:

```txt
page-state
screenshot
visual-target
ai
post-action-verification
```

Allowed verificationPolicy shape:

```txt
verificationMode = visual_evidence | observation_only | before_after_comparison
requireAfterEvidence
requireBeforeAfterComparison
allowSelfReportedSuccess
```

Required direction:
- Every observation must have sourceProofRef.
- supportingObservationRefs must be non-empty for package success.
- supportingSourceProofRefs must be non-empty for package success.
- Every supportingEvidenceRef must pass governed evidence binding when present.
- requireAfterEvidence must fail-close when afterEvidence is missing.
- requiresBeforeAfterComparison must fail-close when beforeEvidence or afterEvidence is missing.
- requiresVisualEvidence must fail-close when visual evidence is missing.
- Missing or invalid source proof must fail-close.
- Packaging success means observation-package integrity passed; it does not mean semantic action outcome was finally judged.

### 禁止

FORBIDDEN:
- Package success without supportingObservationRefs.
- Package success without supportingSourceProofRefs.
- Package success with invalid source proof.
- Package success with invalid evidence binding.
- Package success with missing afterEvidence when required.
- Package success with missing before/after evidence when required.
- Package success with missing visual evidence when required.

Required inspector:
- Schema policy fields.
- Observation proof-binding checks.
- Evidence-binding checks.
- Before/after gate checks.
- Support-ref checks on success path.

Required real-code-inspection:
- Remove supportingSourceProofRefs from success path -> FAIL.
- Return success with no supportingObservationRefs -> FAIL.
- Return success with no afterEvidence when required -> FAIL.
- Return success with invalid source proof -> FAIL.

---

## Law GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-005-V2

status: active
tier: P0
capabilityDomain: post-action-verification-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: PAV result must report packaging status only: success, failed, or review_required.

### 主题

观察包结果模型

### 法条

Post-action Verification result status reports only whether the governed observation package was built successfully.

Valid result statuses:

```txt
success
failed
review_required
```

Success requirements:
- output exists.
- output.packageLabel exists.
- output.observationSummary exists.
- output.postActionObservationRef exists.
- output.actionObservationBundleRef exists.
- output.observationFingerprint exists.
- output.observationRefs is non-empty.
- output.supportingSourceProofRefs is non-empty.
- runtimeProof exists.
- runtimeProof.status equals result.status.
- runtimeProof.processingMode = observation_packaging.
- result does not expose verificationDecision, confidence, confidencePolicy, minimumConfidence, actionResultVerifiedRef, or verifiedByEvidenceKinds.

Failure or review requirements:
- output must be null.
- diagnosticPayloadRef must exist.
- failureReason or reviewRequiredReason must exist.
- runtimeProof must exist.
- runtimeProof.processingMode must be observation_packaging or invalid_input_failure.

Result meaning:
- success means the post-action observation package was built.
- success does not mean the action was semantically verified as successful.

### 禁止

FORBIDDEN:
- status: persisted.
- status: ok.
- verificationDecision on the result surface.
- confidence on the result surface.
- actionResultVerifiedRef on the output surface.
- success with output = null.
- failed or review_required with non-null output.
- success with empty observationRefs.
- success with empty supportingSourceProofRefs.

Required inspector:
- Result schema checks.
- Result builder checks.
- Output-field parity checks.
- Legacy decision or confidence surface bans.

Required real-code-inspection:
- Return status ok -> FAIL.
- Return verificationDecision field -> FAIL.
- Return confidence field -> FAIL.
- Return success with output null -> FAIL.
- Return failed with output -> FAIL.

---

## Law GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-006-V2

status: active
tier: P0
capabilityDomain: post-action-verification-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: PAV owner evidence must preserve input and result chain parity without fabricated ids or legacy decision traces.

### 主题

运行证明链路完整性

### 法条

PostActionRuntimeProof must preserve real upstream chain fields and packaging metadata, not fabricated ids or legacy decision artifacts.

Required proof fields:

```txt
proofId
missionId
runId
sessionId
roundId
videoVisitId
stepId
mapPackageId
mapPackageVersion
selectedMapId
selectedMapVersion
activationSnapshotRef
capabilityCallId
nerveBusEnvelopeId
abilityGroupId = post-action-verification
childCapabilityId
inputRef
actionProofRef
actionLogRef
sourceActionRuntimeProofRef
sourceActionResultRef
sourceActionOutputRef
sourceActionAbilityGroupId
sourceActionChildCapabilityId
actionType
actionStatus
expectedOutcomeType
beforeEvidenceRefs
afterEvidenceRefs
observationRefs
evidenceSourceRefs
outputRef or diagnosticPayloadRef
debugLogRef
structuredRuntimeEventRef optional
inputPayloadHash
actionProofHash
expectedOutcomeHash
beforeEvidenceHash
afterEvidenceHash
observationSetHash
observationFingerprint
receivedShapeHash
startedAt
endedAt
durationMs
status
failureReason
reviewRequiredReason
processingMode
dataQualityFlags
clock
```

Required direction:
- runId and missionId must preserve upstream chain fields.
- success proof must include outputRef.
- failed or review proof must include diagnosticPayloadRef.
- runtimeProof must not expose verificationDecision, confidence, confidencePolicy, minimumConfidence, outputBoundaryDecision, policyDecision, or verificationDecisionTrace.
- processingMode is limited to observation_packaging or invalid_input_failure.

### 禁止

FORBIDDEN:
- runId generated from proof fingerprint only.
- missionId generated from sessionId.
- missing stepId, capabilityCallId, or activationSnapshotRef.
- success proof without outputRef.
- failed or review proof without diagnosticPayloadRef.
- runtimeProof chain different from result chain.
- runtimeProof exposing legacy verificationDecision or confidence fields.

Required inspector:
- Schema field existence.
- Proof builder source-of-truth check.
- No fabricated runId or missionId pattern.
- Proof/result/input chain parity.
- Legacy decision-trace field ban.

Required real-code-inspection:
- Set runId = proofFingerprint -> FAIL.
- Set missionId = sessionId -> FAIL.
- Remove activationSnapshotRef -> FAIL.
- Success without outputRef -> FAIL.
- Add verificationDecisionTrace -> FAIL.

---

## Law GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-007-V2

status: active
tier: P0
capabilityDomain: post-action-verification-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: child capabilities must remain narrow observation providers and flow through one unified executor and proof path.

### 主题

子能力窄职责与统一执行链

### 法条

Active child capability ids are:

```txt
observe-page-open-attempt
observe-comments-panel-open-attempt
observe-comments-panel-close-attempt
observe-not-interested-attempt
observe-target-state-transition
verify-action-result
```

Required direction:
- registry.ts must map every active childCapabilityId to the shared post-action-observation child implementation.
- children/post-action-observation-child.ts is the shared implementation anchor for current active ids.
- Each child returns only child observation data needed to build a package.
- Each child uses only observations and evidence already provided through PAV runtime context or read ports.
- verify-video-changed-after-scroll is physically forbidden. Video-switch semantic truth belongs to AI, never to PAV or hand-written DOM or hash rules.
- Non-AI ability groups must not judge whether before or after video content changed by URL, DOM, perceptual hash, screenshot diff thresholds, or hand-written rules.
- All final result and runtime-proof construction occurs in the unified executor and builders.

### 禁止

FORBIDDEN:
- Child implementation building PostActionVerificationAbilityResult.
- Child implementation building runtimeProof.
- Child implementation calling screenshot, AI, page-state, visual-target, open, mouse, or text-input implementations.
- Child implementation fetching browser, DOM, or BOM directly.
- Child implementation returning raw boolean.

Required inspector:
- Child id parity with shared/post-action-types.ts.
- Registry parity with shared child implementation.
- Child return-type checks.
- No forbidden imports.
- No final result or proof builder call in child code.

Required real-code-inspection:
- Child imports screenshot implementation -> FAIL.
- Child returns boolean -> FAIL.
- Child builds final result -> FAIL.
- Add verify-video-changed-after-scroll -> FAIL.

---

## Law GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-008-V2

status: active
tier: P0
capabilityDomain: post-action-verification-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: PAV enforcement must close through owner-local AST and symbol inspectors, runner, and real-code-inspection.

### 主题

PAV 执法唯一入口

### 法条

PAV enforcement must close through:

```txt
scripts/audit/domains/post-action-verification-capability/manifest.json
scripts/audit/domains/post-action-verification-capability/inspector.ts
scripts/audit/domains/post-action-verification-capability/run-inspector.ts
scripts/audit/domains/post-action-verification-capability/owner-inspection-harness.ts
```

Required:
- Inspector must use ts-morph AST-level checks.
- Inspector must use symbol and import-graph checks.
- Inspector must use schema-level checks.
- Inspector must include anti-escape checks.
- Inspector must verify active law coverage in registry, matrix, audit plan, and runner.
- real-code-inspection must run and report fail -> re-inspect -> pass.
- CI-FULL must be green for delivery.

Forbidden:
- verify scripts as release truth.
- grep, regex, or includes-only final judgment.
- warning-only P0.
- detached inspector.
- empty real-code-inspection.
- generated fake PASS.
- capability-check.ts under PAV root.

Required real-code-inspection:
- Remove inspector from runner -> FAIL.
- Convert P0 finding to warning-only -> FAIL.
- Use regex-only final check -> FAIL.
- Add capability-check.ts -> FAIL.

---

## Required Enforcement Checklist

Inspector must check:

```txt
1. Law file uses machine-blocking + law+inspector+real-code-inspection.
2. Public ability-group is thin and execute-only.
3. Contract does not expose runtime context or child execute internals.
4. Child registry matches schema and shared/post-action-types.ts.
5. External modules do not import children/** or runtime/** private paths.
6. PAV root does not import screenshot, open, click, scroll, text-input, page-state, ai, forensics, or orchestration implementations.
7. PAV does not call browser, DOM, or BOM APIs.
8. Input schema includes missionId, runId, stepId, capabilityCallId, activationSnapshotRef, and nerveBusEnvelopeId.
9. Input schema contains verificationPolicy and does not contain confidencePolicy.
10. Action proof requires actionLogRef or actionRecordRef.
11. selfReportedOnly cannot succeed unless allowSelfReportedSuccess = true.
12. Observation support requires sourceProofRef.
13. Success output contains observationRefs and supportingSourceProofRefs.
14. before/after and visual-evidence requirements are enforced.
15. RuntimeProof contains chain fields and no fabricated runId or missionId.
16. Result, proof, and input chain parity holds.
17. Failed or review_required output is null and diagnosticPayloadRef exists.
18. Child implementation cannot build final result or proof.
19. All active PAV laws remain covered in registry, matrix, audit plan, and runner.
20. owner-inspection-harness executed.
```

---

## Required real-code-inspection

The PAV real-code-inspection must fail -> re-inspect -> pass for:

```txt
manual-first enforcement reintroduced
remove capabilityCallId from input
remove activationSnapshotRef from input
remove nerveBusEnvelopeId from input
add confidencePolicy to input
selfReportedOnly returns success when allowSelfReportedSuccess = false
missing actionLogRef returns success
success with no supportingSourceProofRefs
success with no supportingObservationRefs
success with missing afterEvidence when required
success with invalid source proof
success with output = null
runtimeProof = null
runId built from proofFingerprint only
missionId built from sessionId
child imports screenshot implementation
child builds final result
external imports runtime private path
page-state claims final action truth
PAV output exposes verificationDecision
remove real-code-inspection invocation
turn P0 into warning-only
```

---

## Final Readiness Gate

PAV is READY only when:

```txt
law, blueprint, inspector, generated artifacts, and runner agree
all active PAV laws are machine-blocking
PAV public contract is observation-package native
input, action, evidence, and observation chain fields are complete
success output has observation and source-proof support
action primitive success does not equal semantic action truth
AI remains final semantic judgment source
runtimeProof preserves real upstream chain without legacy decision fields
children are narrow observation providers
owner-local inspector PASS
real-code-inspection PASS
all active law enforcement PASS
CI-FULL PASS
```