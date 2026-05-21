---
name: "GrassEye Mouse Scroll Capability"
description: "Use when governing the independent Mouse Scroll Ability Group, governed browser/desktop/region scroll execution, Geometry Guard approved anchor/region consumption, primitive scroll port boundary, scroll magnitude policy, idempotency, repeat limits, timeout/cancellation, post-action verification handoff, and the boundary that prevents Mouse Scroll from computing coordinates, remapping geometry, claiming scroll-result truth, or writing final action logs."
applyTo: ".github/instructions/cursor-rules/modules/module-mouse-scroll-capability.instructions.md, src/capabilities/mouse-scroll/**, docs/法案辅助文件/GrassEye Mouse Scroll 能力组施工图.md, scripts/audit/domains/mouse-scroll-capability/**, src/lib/local-runtime/**, src/lib/browser/**"
---

# GrassEye Mouse Scroll Capability FINAL

Scope: governs primitive scroll execution after Geometry Guard has approved executable geometry or region anchors.
Boundary: this module governs primitive scroll only. It does not own coordinate discovery, retired chain truth, semantic success, or final persistence truth.
Authority: this file is authoritative only for the mouse-scroll-capability domain.

Core doctrine:
- Mouse Scroll executes governed scrolls.
- Geometry Guard approves executable geometry.
- Semantic scroll truth belongs to the next AI round, not to Mouse Scroll.

## Law GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V3

status: active
tier: P0
capabilityDomain: mouse-scroll-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Mouse Scroll input must carry short-chain mission truth plus approved executable geometry only.

### 主题

滚动输入链路完整性

### 法条

Every MouseScrollAbilityInput must be traceable to the governed mission chain that requested the scroll.

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
- geometryGuardProof
- geometryGuardRef
- guardDecision = allow
- direction
- magnitude
- repeatCount
- idempotencyKey
- timeoutMs when applicable

Required:
- missing stepId, capabilityCallId, nerveBusEnvelopeId, inputRef, or geometry guard approval must fail closed.
- post-action observation packaging may run when policy requires it, but semantic success remains outside Mouse Scroll.

Forbidden:
- retired selection field, retired selection version field, retired package field, retired package version field, retired binding field, legacy route-plan field, or retired branch-token field fields.
- primitive scroll before Geometry Guard approval.
- Mouse Scroll claiming semantic action success.
- universal mandatory PAV as scroll success truth.

## Law GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V3

status: active
tier: P0
capabilityDomain: mouse-scroll-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Mouse Scroll proof must preserve primitive scroll truth and short-chain mission refs only.

### 主题

滚动证明短链化

### 法条

Mouse Scroll proof must preserve primitive execution truth without retired map fields.

Required proof fields:
- missionId
- runId
- roundId when applicable
- stepId
- capabilityCallId
- geometryGuardRef
- direction
- magnitude
- repeatCount
- status
- failureReason or reviewRequiredReason when applicable

Forbidden:
- retired binding field in scroll proof.
- retired selection field or retired selection version field in scroll proof.
- retired package field or retired package version field in scroll proof.
- retired branch-token field or retired deterministic flow planning as scroll truth.

## Final Readiness Gate

The Mouse Scroll law is ready only when scroll execution uses short-chain refs plus Geometry Guard approval and does not revive retired map fields.
