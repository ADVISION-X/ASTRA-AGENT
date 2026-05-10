---
name: "GrassEye Screenshot Capability"
description: "Use when governing the independent Screenshot Ability Group, governed screenshot capture, screenshot artifact truth, coordinate-space truth, scale mapping, AI-input preparation, privacy/session gates, artifact persistence handoff, and the boundary that prevents AI, Visual Target, Geometry Guard, Page State, PAV, browser helpers, or platform adapters from owning screenshot truth."
applyTo: ".github/instructions/cursor-rules/modules/module-screenshot-capability.instructions.md, src/capabilities/screenshot/**, docs/法案辅助文件/GrassEye Screenshot 能力组施工图.md, scripts/audit/domains/screenshot-capability/**"
---

# GrassEye Screenshot Capability FINAL

Scope: governs governed screenshot capture, screenshot artifact truth, coordinate-space truth, scale mapping, AI-input preparation, coordinate-grid rendering, and artifact handoff.
Boundary: this module governs image truth only. It does not govern AI reasoning, retired chain truth, retired selection choices, or action execution.
Authority: this file is authoritative only for the screenshot-capability domain.

Core doctrine:
- Screenshot is image truth, not image meaning.
- Screenshot owns coordinate-grid rendering and gridSpecRef generation.
- AI may return grid cell ids; Screenshot never turns them into executable action truth by itself.

## Law GRASSEYE-SCREENSHOT-CAPABILITY-001-V2

status: active
tier: P0
capabilityDomain: screenshot-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Screenshot input must carry short-chain mission truth, source proof, and image policy only.

### 主题

Screenshot 输入合同

### 法条

Every ScreenshotAbilityInput must be traceable to the governed mission chain that requested the capture or preparation.

Required input fields:
- missionId
- runId
- sessionId when applicable
- roundId when applicable
- stepId
- capabilityCallId
- nerveBusEnvelopeId
- inputRef
- sourceRef when applicable
- sourceProof
- idempotencyKey
- timeoutMs when applicable
- privacyPolicy
- capturePolicy

Required:
- no source proof, no transformed artifact success.
- no scaleMapping, no AI-input or coordinate-grid success.
- coordinate-grid artifact and gridSpecRef must be emitted only after governed source proof is known.
- AI may output grid cell ids only; raw executable x/y is forbidden.

Forbidden:
- retired selection field, retired selection version field, retired package field, retired package version field, retired binding field, legacy route-plan field, or retired branch-token field as screenshot truth.
- evidence-grade capture being gated by retired branch-token field.
- Screenshot deciding targets, geometry safety, page meaning, or business truth.

## Law GRASSEYE-SCREENSHOT-CAPABILITY-002-V2

status: active
tier: P0
capabilityDomain: screenshot-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Screenshot proof must preserve artifact truth, coordinate truth, and short-chain mission refs only.

### 主题

Screenshot 证明短链化

### 法条

Screenshot proof must preserve artifact identity and mission chain refs without retired map fields.

Required proof fields:
- missionId
- runId
- roundId when applicable
- stepId
- capabilityCallId
- sourceScreenshotEvidenceRef when applicable
- gridSpecRef when applicable
- capturePhaseMs
- imageProcessingPhaseMs
- artifactStoragePhaseMs
- totalScreenshotStepMs
- status
- failureReason or reviewRequiredReason when applicable

Forbidden:
- retired binding field in screenshot proof.
- retired selection field or retired selection version field in screenshot proof.
- retired package field or retired package version field in screenshot proof.
- retired branch-token field-controlled artifact truth.

## Final Readiness Gate

The Screenshot law is ready only when image truth is source-proof driven, coordinate-grid aware, and free of route-label or selected-map runtime truth.
