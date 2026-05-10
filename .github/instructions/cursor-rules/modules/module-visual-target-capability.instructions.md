---
name: "GrassEye Visual Target Capability"
description: "Use when governing the independent Visual Target Ability Group, governed visual target normalization, candidate selection, coordinate-space truth, source proof binding, non-executable coordinate handoff, and the boundary that prevents AI, screenshot, geometry, click, scroll, platform adapters, or runtime from owning visual target truth."
applyTo: ".github/instructions/cursor-rules/modules/module-visual-target-capability.instructions.md, src/capabilities/visual-target/**, docs/法案辅助文件/GrassEye Visual Target 视觉目标定位能力组施工图.md, scripts/audit/domains/visual-target-capability/**"
---

# GrassEye Visual Target Capability FINAL

Scope: governs governed visual target packaging, candidate normalization, source proof binding, and non-executable target handoff.
Boundary: this module governs target packaging only. It does not own page meaning, action planning, executable geometry truth, or primitive execution.
Authority: this file is authoritative only for the visual-target-capability domain.

Core doctrine:
- Visual Target finds governed candidates.
- Visual Target does not approve execution.
- Executable coordinate truth begins only after Geometry Guard.

## Law GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V2

status: active
tier: P0
capabilityDomain: visual-target-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Visual Target input must carry screenshot/source truth plus short-chain mission refs only.

### 主题

Visual Target 输入合同

### 法条

Every VisualTargetAbilityInput must be traceable to the screenshot/source truth that requested target packaging.

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
- sourceScreenshotEvidenceRef
- scaleMapping
- targetPolicy
- idempotencyKey

Required:
- missing stepId, capabilityCallId, nerveBusEnvelopeId, inputRef, or sourceRef must fail closed.
- sourceScreenshotEvidenceRef is required for screenshot-based targeting.
- public output must remain non-executable.

Forbidden:
- retired selection field, retired selection version field, retired package field, retired package version field, retired binding field, retired branch-token field, or retired deterministic flow planning truth.
- heuristic target generation that bypasses governed source proof.
- Visual Target approving execution or owning business verbs.

## Law GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V2

status: active
tier: P0
capabilityDomain: visual-target-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Visual Target proof must preserve source proof and candidate refs without retired map fields.

### 主题

Visual Target 证明短链化

### 法条

Visual Target proof must preserve source evidence, candidate refs, and short-chain mission refs only.

Required proof fields:
- missionId
- runId
- roundId when applicable
- stepId
- capabilityCallId
- sourceScreenshotEvidenceRef
- targetResultRef
- candidateRefs
- status
- failureReason or reviewRequiredReason when applicable

Forbidden:
- retired binding field in visual-target proof.
- retired selection field or retired selection version field in visual-target proof.
- retired package field or retired package version field in visual-target proof.
- executable click or scroll truth in visual-target proof.

## Final Readiness Gate

The Visual Target law is ready only when target packaging is source-proof bound, non-executable, and free of retired map truth.
