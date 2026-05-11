---
name: "GrassEye Visual Target Capability"
description: "Use when governing the independent Visual Target Ability Group, governed non-executable visual target packaging for AI-selected or system-supplied candidates, source proof binding, non-executable coordinate handoff, and the boundary that prevents AI, screenshot, geometry, click, scroll, platform adapters, or runtime from owning visual target truth."
applyTo: ".github/instructions/cursor-rules/modules/module-visual-target-capability.instructions.md, src/capabilities/visual-target/**, docs/法案辅助文件/GrassEye Visual Target 视觉目标定位能力组施工图.md, scripts/audit/domains/visual-target-capability/**"
---

# GrassEye Visual Target Capability FINAL

Scope: governs non-executable visual target packaging for AI-selected or system-supplied candidates, source proof binding, and target ref generation.
Boundary: this module governs target packaging only. It does not own page meaning, action planning, executable geometry truth, primitive execution, or business target discovery.
Authority: this file is authoritative only for the visual-target-capability domain.

Core doctrine:
- Visual Target packages AI-selected or system-supplied candidates. It does not discover business targets.
- Visual Target does not select actions. It does not identify business UI elements (buttons, panels, metrics).
- Visual Target does not approve execution.
- Executable coordinate truth begins only after Geometry Guard.
- Final semantic truth belongs to AI Visual Mission Judge, not Visual Target.
- Visual Target is an optional non-executable packaging step. It must not become a mandatory gate between AI and Geometry Guard.

Current active Visual Target child capabilities:
- package-grid-cell-target-once
- package-grid-region-target-once
- package-bbox-target-once (optional)

Forbidden child capabilities (must never be restored):
- observe-like-button
- observe-save-button
- observe-comments-button
- observe-close-comments-button
- observe-comments-panel
- observe-next-video-region
- observe-next-item-target-candidate
- observe-not-interested-button
- observe-metric-like-count
- observe-metric-comment-count

## Law GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V3

status: active
tier: P0
capabilityDomain: visual-target-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Visual Target input must carry AI-selected or system-supplied candidate plus screenshot/source truth plus short-chain mission refs only.

### 主题

Visual Target 输入合同

### 法条

Every VisualTargetAbilityInput must be traceable to the screenshot/source truth and the AI-selected or system-supplied candidate that requested target packaging.

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
- gridCell or gridRegion or bbox (depending on child)
- selectedBy (ai | system)
- idempotencyKey

Required:
- missing stepId, capabilityCallId, nerveBusEnvelopeId, inputRef, or sourceRef must fail closed.
- sourceScreenshotEvidenceRef is required for all Visual Target children.
- public output must remain non-executable (nonExecutable = true).
- selectedBy must be present and must be "ai" or "system".

Forbidden:
- retired selection field, retired selection version field, retired package field, retired package version field, retired binding field, retired branch-token field, or retired deterministic flow planning truth.
- heuristic target generation or business button detection that bypasses AI selection.
- targetPolicy as a business heuristic (target detection belongs to AI).
- Visual Target approving execution or owning business verbs.
- observe-like-button, observe-save-button, observe-comments-button, observe-close-comments-button, observe-comments-panel, observe-next-video-region, observe-next-item-target-candidate, observe-not-interested-button, observe-metric-like-count, observe-metric-comment-count as child capabilities.

## Law GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V3

status: active
tier: P0
capabilityDomain: visual-target-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Visual Target proof must preserve source proof and candidate refs without retired map fields. Proof must only certify non-executable target package creation.

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
- candidateRef
- status
- failureReason or reviewRequiredReason when applicable

Forbidden:
- retired binding field in visual-target proof.
- retired selection field or retired selection version field in visual-target proof.
- retired package field or retired package version field in visual-target proof.
- executable click or scroll truth in visual-target proof.
- business semantic truth (likeButtonTruth, commentButtonTruth, saveButtonTruth, nextVideoTruth, metricTruth) in visual-target proof.
- page meaning or visual semantic success in visual-target proof.
- AI correctness judgment in visual-target proof.

## Law GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V1

status: active
tier: P0
capabilityDomain: visual-target-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Visual Target file count must not exceed 14. Audit inspector file count must not exceed 3.

### 主题

Visual Target 文件数量控制

### 法条

- src/capabilities/visual-target total file count must be <= 14.
- scripts/audit/domains/visual-target-capability total file count must be <= 3.
- Exceeding 18 files in src/capabilities/visual-target is an automatic FAIL.
- Exceeding 5 files in scripts/audit/domains/visual-target-capability is an automatic FAIL.

## Final Readiness Gate

The Visual Target law is ready only when:
1. target packaging is source-proof bound, non-executable, and free of retired map truth.
2. active children are only package-grid-cell-target-once, package-grid-region-target-once, and optionally package-bbox-target-once.
3. no business observation child exists.
4. no gate universe exists (target-selection-gate, page-state-consistency-gate, ambiguity-gate, ai-result-proof-gate, candidate-readiness-gate, candidate-source-gate, visual-target-chain, visual-target-executor, execution-stage-runners).
5. Visual Target does not import mouse-click, geometry-guard, screenshot, ai, or orchestration runtime.
6. Visual Target is not a mandatory gate between AI and Geometry Guard.
