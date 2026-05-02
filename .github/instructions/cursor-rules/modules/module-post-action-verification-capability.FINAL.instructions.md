---
name: "GrassEye Post-action Verification Capability"
description: "Use when governing the independent Post-action Verification Ability Group, action-result verification truth, before/after evidence binding, observation proof, verification decision, and the boundary that prevents open/click/scroll/text-input/page-state from claiming verified outcome truth."
applyTo: ".github/instructions/cursor-rules/modules/module-post-action-verification-capability.instructions.md, src/capabilities/post-action-verification/**, docs/法案辅助文件/GrassEye Post-action Verification 动作后验证能力组施工图.md, scripts/audit/domains/post-action-verification-capability/**"
---

# GrassEye Post-action Verification Capability FINAL

Scope: governs the independent Post-action Verification Ability Group, its child verification capabilities, verification decisions, before/after evidence binding, action proof binding, observation proof binding, and verification runtime proof.

Boundary: this module governs only action-result verification after an action has already executed and after bounded observations/evidence have been collected. It does not capture screenshots, execute AI, detect visual targets, click, scroll, input text, open pages, own page-state truth, write final evidence packets, or decide the next mission step.

Authority: this file is authoritative only for the `post-action-verification-capability` domain.

Architecture phase: `Static Capability Package Architecture`.

Core doctrine:
- Action execution success is not outcome truth.
- Page State is current-state truth, not action-result truth.
- Post-action Verification is the only owner of governed action-result verification.
- Post-action Verification consumes action refs, before/after evidence refs, observation refs, expected outcome, and verification policy.
- Post-action Verification returns verified / failed / review_required plus proof.
- Post-action Verification does not execute actions and does not persist final evidence truth.
- No action can be considered verified without a Post-action Verification result or explicit governed review.
- No proof, no verification.
- No before/after or bounded observation support, no verified success.
- No active PAV law without inspector + runner + negative proof.

---

## Global Post-action Verification Baseline

All active Post-action Verification laws in this file are:

```yaml
status: active
tier: P0
capabilityDomain: post-action-verification-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof
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
├── shared/
├── runtime/
└── children/
```

Required enforcement:

```txt
scripts/audit/domains/post-action-verification-capability/
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

## Law GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V2

status: active  
tier: P0  
capabilityDomain: post-action-verification-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: Post-action Verification is the only owner of governed action-result truth.

### 主题

动作结果验证主权唯一

### 法条

Post-action Verification Ability Group is the only owner of governed action-result verification.

Required direction:
- Open, Mouse Click, Mouse Scroll, Text Input, Browser Controller, platform adapters, Page State, AI, Visual Target, Screenshot, and Orchestration must not claim verified action outcome truth.
- Primitive action success means only: action was dispatched or attempted.
- Page State means only: current observed page state.
- AI / Visual Target / Screenshot / Page State observations may support verification, but may not replace Post-action Verification.
- Orchestration may branch on PAV result; it may not fabricate PAV result.
- Forensics may persist PAV result; it may not decide verification.

### 禁止

FORBIDDEN:
- Mouse Click treating primitiveExecutionRef/browserActionId as verified outcome.
- Mouse Scroll treating scrollExecutionRef/browserActionId as verified outcome.
- Open treating navigation attempt as verified page-opened result.
- Text Input treating primitive input success as verified text accepted.
- Page State being used as a substitute for action-result verification.
- AI free-text output being treated as action-result truth.
- Orchestration fabricating verificationDecision.
- Forensics fabricating verificationDecision.
- Any action ability returning `verified` or `verificationDecision`.

Required inspector:
- Import graph and symbol checks for verificationDecision outside PAV.
- Action ability schemas must not expose final verified outcome.
- Orchestration must consume PAV result, not fabricate it.
- Page State cannot export action-result verification truth.

Required negative proof:
- Add `verificationDecision: "verified"` to mouse-click result → FAIL.
- Add page-state-only action success branch → FAIL.
- Add Orchestration fabricated PAV result → FAIL.

---

## Law GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-002-V2

status: active  
tier: P0  
capabilityDomain: post-action-verification-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: PAV boundary stays pure and cannot execute actions, capture evidence, call AI, or persist final evidence.

### 主题

纯验证边界

### 法条

Post-action Verification consumes governed inputs and returns a verification decision. It may not execute side effects.

Allowed:
- Read bounded evidence through read ports.
- Read observation records through read ports.
- Compare before/after refs.
- Validate action proof.
- Validate evidence source proof.
- Validate expected outcome.
- Apply confidence and verification policy.
- Build verification proof and result.

Forbidden:
- Screenshot capture.
- AI execution.
- Visual target detection.
- Page-state collection.
- Browser/DOM/BOM read.
- Click/scroll/input/open execution.
- Comment collection.
- Forensics final evidence write.
- Nerve Bus dispatch.
- Mission step advancement.
- Product yes/no decision.

Required inspector:
- Forbidden imports: screenshot/open/mouse/text-input/browser/page-state/ai/forensics/orchestration implementation.
- Forbidden method symbols: click, scroll, type, openPage, captureScreenshot, executeAi, writeEvidence, dispatchEnvelope, advanceStep.
- External private PAV path import ban.

Required negative proof:
- Add screenshot capture import → FAIL.
- Add browser controller import → FAIL.
- Add Forensics writer call → FAIL.
- Add Nerve Bus dispatch → FAIL.

---

## Law GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V2

status: active  
tier: P0  
capabilityDomain: post-action-verification-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: PAV input must carry action proof, source action refs, expected outcome, before/after evidence, observations, and chain fields.

### 主题

验证输入链路完整性

### 法条

PAV input must be fully traceable to the action it verifies and the map step that requested verification.

Every `PostActionVerificationAbilityInput` must include:

```txt
abilityGroupId = post-action-verification
childCapabilityId
requestedBy = orchestration
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
sourceAbilityGroupId
sourceChildCapabilityId
sourceActionType
expectedOutcome
actionProof
beforeAfterEvidence
observationSet
verificationPolicy
confidencePolicy
inputRef
idempotencyKey
```

`actionProof` must include:

```txt
actionProofRef
actionLogRef or actionRecordRef
sourceRuntimeProofRef
sourceActionResultRef or sourceActionOutputRef
sourceAbilityGroupId
sourceChildCapabilityId
actionType
actionStatus
primitiveExecutionRef/navigationAttemptRef/scrollExecutionRef where applicable
startedAt
endedAt
selfReportedOnly
```

Required direction:
- Missing actionLogRef/actionRecordRef cannot be verified.
- selfReportedOnly cannot produce verified.
- forbidden action source cannot produce verified.
- missing sourceRuntimeProofRef cannot produce verified.
- missing chain fields cannot produce success.

### 禁止

FORBIDDEN:
- PAV input without stepId.
- PAV input without capabilityCallId.
- PAV input without activationSnapshotRef.
- PAV input without actionProofRef.
- Verified result from selfReportedOnly action.
- Verified result without action log or action record.
- Verified result from forbidden source ability.

Required inspector:
- Schema field checks.
- Runtime proof chain field checks.
- Action proof gate call-order checks.

Required negative proof:
- Remove capabilityCallId → FAIL.
- Remove activationSnapshotRef → FAIL.
- selfReportedOnly returns verified → FAIL.
- missing actionLogRef returns verified → FAIL.

---

## Law GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-004-V2

status: active  
tier: P0  
capabilityDomain: post-action-verification-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: PAV must verify with bounded observations and evidence; before/after requirements must be enforced by policy.

### 主题

before/after 与观察证据门禁

### 法条

PAV must use bounded evidence and governed observations. Verification policy decides which evidence is required.

Observation sources may include only governed refs from:
- page-state
- visual-target
- ai
- screenshot
- post-action-verification runtime signal

Evidence refs may include:
- screenshot
- page_state
- ai_observation
- visual_target
- screenshot_diff
- runtime_signal
- action_log
- source_runtime_proof

Required:
- Every observation must have `sourceProofRef`.
- Every evidence ref must have source ability and capturedAt.
- before/after comparison must be required when `expectedOutcome.requiresBeforeAfterComparison = true`.
- visual evidence must be required when `expectedOutcome.requiresVisualEvidence = true`.
- after evidence must be required when `verificationPolicy.requireAfterEvidence = true`.
- verified result must have supporting evidence/observation/source proof refs.
- verified result must not rely only on runtime self-report.
- contradictory observations must produce failed or review_required, not verified.

### 禁止

FORBIDDEN:
- Verified without supporting evidence refs.
- Verified without supporting observation refs.
- Verified without supporting source proof refs.
- Verified with only self-reported action completion.
- Verified when before/after evidence required but missing.
- Verified when observation source proof is missing.
- Verified with contradictory evidence.

Required inspector:
- Schema policy fields.
- Evidence source gate call.
- Observation proof binding gate call.
- Before/after gate call.
- Success output support refs check.

Required negative proof:
- Remove supportingSourceProofRefs from verified output → FAIL.
- Verify with no afterEvidence when required → FAIL.
- Verify contradictory observations → FAIL.

---

## Law GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-005-V2

status: active  
tier: P0  
capabilityDomain: post-action-verification-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: PAV must return typed verification decision only: verified, failed, or review_required.

### 主题

验证决策唯一类型

### 法条

Post-action Verification result must use one of:

```txt
verificationDecision: verified | failed | review_required
status: success | failed | review_required
```

Status mapping:
- `verificationDecision = verified` requires `status = success`.
- `verificationDecision = failed` requires `status = failed`.
- `verificationDecision = review_required` requires `status = review_required`.

Success requirements:
- output exists.
- output.actionResultVerifiedRef exists.
- runtimeProof exists.
- runtimeProof.status equals result.status.
- runtimeProof.verificationDecision equals result.verificationDecision.
- outputBoundaryDecision = allow.
- criticalDataQualityDecision = allow.
- confidence >= confidencePolicy.minimumConfidence.
- evidence/observation/source-proof support refs exist.

Failure/review requirements:
- output must be null.
- diagnosticPayloadRef must exist.
- failureReason or reviewRequiredReason must exist.
- runtimeProof must exist.

### 禁止

FORBIDDEN:
- `status: persisted`.
- `status: ok`.
- `verificationDecision: ok`.
- `warning-only acceptance`.
- `no-op acceptance`.
- `runtimeProof: null`.
- `success` with `review_required` decision.
- `success` with critical data quality flags.
- `failed/review_required` exposing verified output.

Required inspector:
- Result schema superRefine checks.
- Result builder call checks.
- Output-boundary gate checks.
- Decision gate checks.

Required negative proof:
- Return status ok → FAIL.
- Return success with review_required → FAIL.
- Return runtimeProof:null → FAIL.
- Return failed with output → FAIL.

---

## Law GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-006-V2

status: active  
tier: P0  
capabilityDomain: post-action-verification-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: PAV runtime proof must preserve the same chain as input and result, without fabricated mission/run truth.

### 主题

验证运行证明链路完整性

### 法条

`PostActionRuntimeProof` must preserve real upstream chain fields, not fabricated ids.

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
actionProofRef
actionLogRef or actionRecordRef
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
inputRef
outputRef or diagnosticPayloadRef
debugLogRef
structuredRuntimeEventRef optional
inputPayloadHash
actionProofHash
expectedOutcomeHash
beforeEvidenceHash
afterEvidenceHash
observationSetHash
startedAt
endedAt
durationMs
status
verificationDecision
confidence
failureReason
reviewRequiredReason
inputDecision
actionProofDecision
evidenceSourceDecision
beforeAfterDecision
policyDecision
outputBoundaryDecision
criticalDataQualityDecision
observationBindingDecision
beforeAfterPairDecision
verificationDecisionTrace
dataQualityFlags
clock
```

Forbidden:
- runId generated from proofFingerprint only.
- missionId generated from sessionId.
- missing stepId/capabilityCallId/activationSnapshotRef.
- runtimeProof chain different from result chain.
- success proof without outputRef.
- failed/review proof without diagnosticPayloadRef.

Required inspector:
- Schema field existence.
- Proof builder source-of-truth check.
- No fabricated runId/missionId pattern.
- Proof/result/input chain parity.

Required negative proof:
- Set runId = proofFingerprint → FAIL.
- Set missionId = sessionId → FAIL.
- Remove activationSnapshotRef → FAIL.
- Success without outputRef → FAIL.

---

## Law GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-007-V2

status: active  
tier: P0  
capabilityDomain: post-action-verification-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: child capabilities must be narrow verification behaviors and must use unified executor/runtime proof path.

### 主题

子能力窄职责与统一执行链

### 法条

Active child capabilities:

```txt
verify-page-opened
verify-comments-panel-opened
verify-comments-panel-closed
verify-video-changed-after-scroll
verify-not-interested-result
verify-target-state-changed
```

Required:
- Each child has `contract.ts`, `schema.ts`, `implementation.ts`.
- Each child returns child assessment only, not final PAV result.
- Each child uses only observations/evidence already provided through PAV runtime context/read port.
- Each child cannot call screenshot/AI/page-state/visual-target/open/mouse/text-input implementations.
- Each child cannot write Forensics.
- Each child cannot decide Orchestration next step.
- All final result/proof construction occurs in unified runtime path.

### 禁止

FORBIDDEN:
- Child implementation building `PostActionVerificationAbilityResult`.
- Child implementation building runtimeProof.
- Child calling foreign ability implementations.
- Child fetching browser/DOM/BOM directly.
- Child returning raw boolean.
- Child returning no-op verified.

Required inspector:
- Child folder parity.
- Child return type check.
- No forbidden imports.
- No final result builder call in child.

Required negative proof:
- Child imports screenshot implementation → FAIL.
- Child returns boolean → FAIL.
- Child builds final result → FAIL.

---

## Law GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-008-V2

status: active  
tier: P0  
capabilityDomain: post-action-verification-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: PAV enforcement must close through owner-local AST/symbol inspector, runner, and negative proof.

### 主题

PAV 执法唯一入口

### 法条

PAV enforcement must close through:

```txt
scripts/audit/domains/post-action-verification-capability/manifest.json
scripts/audit/domains/post-action-verification-capability/inspector.ts
scripts/audit/domains/post-action-verification-capability/run-inspector.ts
scripts/audit/domains/post-action-verification-capability/negative-proof-harness.ts
```

Required:
- Inspector must use ts-morph AST-level checks.
- Inspector must use symbol/import-graph checks.
- Inspector must use schema-level checks.
- Inspector must include anti-escape checks.
- Inspector must verify active law coverage in registry/matrix/audit-plan/runner.
- Negative proof must run and report fail → rollback → pass.
- CI-FULL must be green for delivery.

Forbidden:
- verify scripts as release truth.
- grep/regex/includes as final judgment.
- warning-only P0.
- detached inspector.
- empty negative proof.
- generated fake PASS.
- capability-check.ts under PAV root.

Required negative proof:
- Remove inspector from runner → FAIL.
- Convert P0 finding to warning-only → FAIL.
- Use regex-only final check → FAIL.
- Add `capability-check.ts` → FAIL.

---

## Required Enforcement Checklist

Inspector must check:

```txt
1. Law file uses machine-blocking + law+inspector+negative-proof.
2. Public ability-group is thin and execute-only.
3. Contract does not expose runtime context or child execute internals.
4. Child registry matches schema and folders.
5. External modules do not import children/** or runtime/** private paths.
6. PAV root does not import screenshot/open/click/scroll/text-input/page-state/ai/forensics/orchestration implementations.
7. PAV does not call browser/DOM/BOM APIs.
8. Input schema includes missionId/runId/stepId/capabilityCallId/activationSnapshotRef/nerveBusEnvelopeId.
9. Action proof requires actionLogRef or actionRecordRef.
10. selfReportedOnly cannot verify.
11. Evidence/observation refs require sourceProofRef.
12. Verified output requires evidenceRefs/observationRefs/supportingSourceProofRefs.
13. before/after requirements are enforced.
14. Output boundary blocks verified if critical data quality flags exist.
15. RuntimeProof contains chain fields and no fabricated runId/missionId.
16. Result/proof/input chain parity.
17. Failed/review_required output is null and diagnosticPayloadRef exists.
18. Child implementation cannot build final result/proof.
19. ALL active PAV laws in registry/matrix/audit-plan/runner.
20. negative-proof-harness executed.
```

---

## Required Negative Proof

The PAV negative proof must fail → rollback → pass for:

```txt
manual-first enforcement reintroduced
remove capabilityCallId from input
remove activationSnapshotRef from input
remove nerveBusEnvelopeId from input
selfReportedOnly returns verified
missing actionLogRef returns verified
verified with no supportingSourceProofRefs
verified with missing afterEvidence when required
success with review_required decision
success with critical data quality flags
runtimeProof:null
runId built from proofFingerprint only
missionId built from sessionId
child imports screenshot implementation
child builds final result
external imports runtime private path
page-state claims verificationDecision
mouse-click returns verified
remove negative proof invocation
turn P0 into warning-only
```

---

## Final Readiness Gate

PAV is READY only when:

```txt
law/blueprint/inspector/generated/runner agree
all active PAV laws are machine-blocking
PAV public contract is verification-native
input/action/evidence chain fields complete
verified result requires source proof support
action primitive success cannot equal verification truth
page-state cannot substitute verification
runtimeProof preserves real upstream chain
children are narrow assessment providers
owner-local inspector PASS
negative proof PASS
ALL active law enforcement PASS
CI-FULL PASS
```
