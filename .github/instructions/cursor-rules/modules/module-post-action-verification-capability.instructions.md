---
name: "GrassEye Post-action Verification — Support Evidence Boundary"
description: "PAV is a support/transition evidence boundary, not an independent active ability group. Use when reviewing post-action observation packaging, before/after evidence binding, observation proof, and the boundary that keeps final semantic judgment in AI rather than PAV."
applyTo: ".github/instructions/cursor-rules/modules/module-post-action-verification-capability.instructions.md, src/capabilities/post-action-verification/**, docs/法案辅助文件/GrassEye Post-action Verification 动作后验证能力组施工图.md, scripts/audit/domains/post-action-verification-capability/**"
---

# GrassEye Post-action Verification — Support Evidence Boundary

> **Identity**: PAV is a **support / transition evidence boundary**, not an independent active ability group.
> It is listed in the law freeze baseline as a support/transition evidence surface.
> PAV must NOT register as an active CI owner, must NOT appear in MuscleMemoryCatalog, and must NOT
> claim to own action result truth. Final semantic judgment belongs to the next AI Visual Mission Judge round.

Scope: governs post-action observation packaging, before/after evidence binding, and observation-package owner evidence integrity.
Boundary: this module governs observation packaging only. It does not execute actions, call AI, decide semantic success, or own mission branching.
Authority: this file is authoritative only for the post-action-verification-capability domain.

Core doctrine:
- PAV packages governed before/after observations.
- AI remains the final semantic action-result judgment source when semantic truth is needed.
- PAV is not a universal mandatory gate after every real action.
- Final semantic truth belongs to the next AI Visual Mission Judge round, not PAV.

## Law GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V2

status: active
tier: P0
capabilityDomain: post-action-verification-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: PAV input must carry short-chain mission truth plus bounded before/after observation refs only.

### 主题

PAV 输入合同

### 法条

Every PostActionVerificationInput must be traceable to the governed mission chain that requested observation packaging.

Required input fields:
- missionId
- runId
- sessionId when applicable
- roundId when applicable
- stepId
- capabilityCallId
- nerveBusEnvelopeId
- sourceActionResultRef
- sourceActionRuntimeProofRef
- beforeEvidenceRefs
- afterEvidenceRefs
- observationRefs
- verificationPolicy

Required:
- missing source action refs or bounded observation refs must fail closed.
- PAV success must expose observation package refs only.
- PAV may run when action policy requires post-action observation packaging.

Forbidden:
- retired selection field, retired selection version field, retired package field, retired package version field, retired binding field, retired branch-token field, or retired deterministic flow planning fields.
- universal mandatory PAV after every real action.
- PAV exposing final semantic truth, confidence verdicts, or business decisions.
- PAV replacing the next AI round.

## Law GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-002-V2

status: active
tier: P0
capabilityDomain: post-action-verification-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: PAV proof must preserve observation-package truth and short-chain refs only.

### 主题

PAV 证明短链化

### 法条

PAV proof must preserve observation-package truth without retired map fields.

Required proof fields:
- missionId
- runId
- roundId when applicable
- stepId
- capabilityCallId
- postActionVerificationResultRef
- sourceActionResultRef
- observationFingerprint
- packageStatus
- failureReason or reviewRequiredReason when applicable

Forbidden:
- retired binding field in PAV proof.
- retired selection field or retired selection version field in PAV proof.
- retired package field or retired package version field in PAV proof.
- retired branch-token field or retired deterministic flow planning as PAV truth.

## Final Readiness Gate

The PAV law is ready only when it remains an optional bounded observation packager and never becomes semantic branch truth.
