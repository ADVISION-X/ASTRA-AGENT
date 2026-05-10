---
name: "GrassEye Mouse Click Capability"
description: "Use when governing the independent Mouse Click Ability Group, governed browser/desktop click execution, Geometry Guard approved coordinate consumption, primitive click port boundary, click safety policy, idempotency, timeout/cancellation, post-action verification handoff, and the boundary that prevents Mouse Click from computing coordinates, remapping geometry, claiming action-result truth, or writing final action logs."
applyTo: ".github/instructions/cursor-rules/modules/module-mouse-click-capability.instructions.md, src/capabilities/mouse-click/**, docs/法案辅助文件/GrassEye Mouse Click 能力组施工图.md, scripts/audit/domains/mouse-click-capability/**, src/lib/local-runtime/**, src/lib/browser/**, src/features/platform-action/**"
---

# GrassEye Mouse Click Capability FINAL

Scope: governs primitive click execution after Geometry Guard has approved executable geometry.
Boundary: this module governs primitive click only. It does not own coordinate discovery, retired chain truth, semantic success, or final persistence truth.
Authority: this file is authoritative only for the mouse-click-capability domain.

Core doctrine:
- Mouse Click executes governed clicks.
- Geometry Guard approves executable geometry.
- Semantic action truth belongs to the next AI round, not to Mouse Click.

## Law GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V3

status: active
tier: P0
capabilityDomain: mouse-click-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Mouse Click input must carry short-chain mission truth plus approved executable geometry only.

### 主题

点击输入链路完整性

### 法条

Every MouseClickAbilityInput must be traceable to the governed mission chain that requested the click.

Required input fields:
- missionId
- runId
- sessionId when applicable
- roundId when applicable
- stepId
- capabilityCallId
- nerveBusEnvelopeId
- purpose
- inputRef
- sourceRef
- sourceCoordinateProofRef
- sourceEvidenceRef when applicable
- sourceTargetRef when applicable
- geometryGuardProof
- geometryGuardRef
- guardDecision = allow
- geometryGuardOutputRef
- geometryGuardNormalizedCoordinateSpace
- geometryGuardNormalizedClickPoint
- button
- clickCount
- bounds
- idempotencyKey
- timeoutMs when applicable

Required:
- missing stepId, capabilityCallId, nerveBusEnvelopeId, inputRef, or geometry guard approval must fail closed.
- Mouse Click must not recompute bbox or clickPoint.
- post-action observation packaging may run when policy requires it, but semantic success remains outside Mouse Click.

Forbidden:
- retired selection field, retired selection version field, retired package field, retired package version field, retired binding field, legacy route-plan field, or retired branch-token field fields.
- primitive click before Geometry Guard approval.
- Mouse Click claiming semantic action success.
- universal mandatory PAV as click success truth.

## Law GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V3

status: active
tier: P0
capabilityDomain: mouse-click-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Mouse Click proof must preserve primitive click truth and short-chain mission refs only.

### 主题

点击证明短链化

### 法条

Mouse Click proof must preserve primitive execution truth without retired map fields.

Required proof fields:
- missionId
- runId
- roundId when applicable
- stepId
- capabilityCallId
- geometryGuardRef
- click coordinate ref
- button
- clickCount
- status
- failureReason or reviewRequiredReason when applicable

Forbidden:
- retired binding field in click proof.
- retired selection field or retired selection version field in click proof.
- retired package field or retired package version field in click proof.
- retired branch-token field or retired deterministic flow planning as click truth.

## Final Readiness Gate

The Mouse Click law is ready only when click execution uses short-chain refs plus Geometry Guard approval and does not revive retired map fields.
