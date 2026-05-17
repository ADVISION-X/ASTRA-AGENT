---
name: "GrassEye Geometry Guard Capability"
description: "Use when governing the independent Geometry Guard Ability Group, executable coordinate safety gating, coordinate-space validation, bbox/click-point legality, scale mapping, viewport/screen bounds validation, normalized executable geometry output, and the boundary that prevents Mouse Click, Mouse Scroll, Screenshot, AI, platform profiles, or browser helpers from owning geometry safety truth."
applyTo: ".github/instructions/cursor-rules/modules/module-geometry-guard-capability.instructions.md, src/capabilities/geometry-guard/**, docs/法案辅助文件/GrassEye Geometry Guard 几何安全守卫能力组施工图.md, scripts/audit/domains/geometry-guard-capability/**, src/capabilities/mouse-click/**, src/capabilities/mouse-scroll/**"
---

# GrassEye Geometry Guard Capability FINAL

Scope: governs executable coordinate safety gating, coordinate-space validation, scale mapping validation, and normalized executable geometry output.
Boundary: this module governs geometry safety only. It does not own action planning, retired chain truth, screenshot truth, or primitive execution.
Authority: this file is authoritative only for the geometry-guard-capability domain.

Core doctrine:
- Geometry Guard is the only executable coordinate safety gate.
- Geometry Guard validates and normalizes; it does not choose actions.
- Geometry Guard must not revive retired selection choices, retired package chains, retired binding states, or retired branch tokens.

## Law GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V2

status: active
tier: P0
capabilityDomain: geometry-guard-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Geometry Guard input must carry short-chain mission truth plus governed coordinate evidence only.

### 主题

Geometry Guard 输入合同

### 法条

Every GeometryGuardAbilityInput must be traceable to the governed mission chain that requested executable geometry gating.

Required input fields:
- missionId
- runId
- sessionId when applicable
- roundId when applicable
- stepId
- capabilityCallId
- nerveBusEnvelopeId
- inputRef
- sourceRef
- sourceScreenshotEvidenceRef when applicable
- sourceVisualTargetResultRef when applicable
- sourceCoordinateSpace
- requestedExecutionSpace
- bbox or clickPoint when applicable
- imageSize
- viewportSize
- screenSize
- deviceScaleFactor
- scaleMapping
- safetyPolicy
- idempotencyKey

Required:
- missing stepId, capabilityCallId, nerveBusEnvelopeId, inputRef, or sourceRef must fail closed.
- missing idempotencyKey must fail closed.
- public result may emit normalized executable geometry only after successful validation.

Forbidden:
- retired selection field, retired selection version field, retired package field, retired package version field, retired binding field, legacy route-plan field, or retired branch-token field truth.
- Geometry Guard generating action plans, fallback recipes, or business verbs.
- Geometry Guard claiming screenshot, target, or semantic truth.

## Law GRASSEYE-GEOMETRY-GUARD-CAPABILITY-002-V2

status: active
tier: P0
capabilityDomain: geometry-guard-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Geometry Guard proof must preserve normalized geometry truth and short-chain refs only.

### 主题

Geometry Guard 证明短链化

### 法条

Geometry Guard proof must preserve normalized geometry truth without retired map fields.

Required proof fields:
- missionId
- runId
- roundId when applicable
- stepId
- capabilityCallId
- geometryGuardRef
- normalizedCoordinateSpace
- normalizedClickPoint or normalizedBbox when applicable
- status
- failureReason or reviewRequiredReason when applicable

Forbidden:
- retired binding field in geometry proof.
- retired selection field or retired selection version field in geometry proof.
- retired package field or retired package version field in geometry proof.
- action plan truth in geometry proof.

## Final Readiness Gate

The Geometry Guard law is ready only when executable geometry truth is short-chain, safety-only, and free of retired map fields.
