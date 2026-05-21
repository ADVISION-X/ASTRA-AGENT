---
name: "GrassEye Text Input Capability"
description: "Use when governing the independent Text Input Ability Group, approved text writing, verified input target handoff, governed type/press-key/clear execution, sensitive text redaction, primitive proof, and the boundary that prevents Text Input from generating text, locating targets, verifying final page state, owning clipboard lifecycle, or owning browser/session truth."
applyTo: ".github/instructions/cursor-rules/modules/module-text-input-capability.instructions.md, src/capabilities/text-input/**, docs/法案辅助文件/GrassEye Text Input 输入能力组施工图.md, scripts/audit/domains/text-input-capability/**"
---

# GrassEye Text Input Capability FINAL

Scope: governs approved text writing, approved key press, and clear of focused input. Returns primitive write proof only.
Boundary: this module governs writing only. It does not own text generation, target discovery, clipboard lifecycle, semantic success, or retired chain truth.
Authority: this file is authoritative only for the text-input-capability domain.

Core doctrine:
- Text Input writes approved text or keys.
- Text generation belongs outside Text Input.
- Semantic success belongs to the next AI round, not to Text Input.

Current active Text Input child capabilities (simple-machine phase):
- type-approved-text-once
- press-approved-key-once
- clear-focused-input-once

Not active in current phase (not Text Input children):
- paste-text: deferred — clipboard lifecycle is not part of current Text Input simplicity.
- replace-input: composed as clear-focused-input-once + type-approved-text-once by AI/Orchestration.
- commit-input: expressed as press-approved-key-once(approvedKey=Enter) — not a separate child.
- press-navigation-key: expressed as press-approved-key-once with approved key allowlist — not a separate child.
- clipboard lifecycle: belongs to a future clipboard capability, not Text Input.

## Law GRASSEYE-TEXT-INPUT-CAPABILITY-001-V2

status: active
tier: P0
capabilityDomain: text-input-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Text Input input must carry short-chain mission truth plus approved text and verified target refs only.

### 主题

输入能力合同

### 法条

Every TextInputAbilityInput must be traceable to the governed mission chain that requested the write.

Required input fields:
- missionId
- runId
- sessionId when applicable
- roundId when applicable
- stepId
- capabilityCallId
- nerveBusEnvelopeId
- inputRef
- targetRef
- approvedText or approvedKey
- writeMode
- idempotencyKey
- timeoutMs when applicable

Required:
- missing stepId, capabilityCallId, nerveBusEnvelopeId, inputRef, or targetRef must fail closed.
- approvedText is required for text write modes.
- approvedKey is required for press-key modes.
- approvedText or approvedKey must come from a governed upstream caller payload that has already passed contract validation; Text Input treats approved payload fields as immutable execution inputs.

Forbidden:
- retired selection field, retired selection version field, retired package field, retired package version field, retired binding field, legacy route-plan field, or retired branch-token field fields.
- Text Input generating text by itself.
- Text Input claiming final page-state or semantic success.

## Law GRASSEYE-TEXT-INPUT-CAPABILITY-002-V2

status: active
tier: P0
capabilityDomain: text-input-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Text Input proof must preserve primitive write truth and short-chain mission refs only.

### 主题

输入证明短链化

### 法条

Text Input proof must preserve primitive execution truth without retired map fields.

Required proof fields:
- missionId
- runId
- roundId when applicable
- stepId
- capabilityCallId
- targetRef
- writeMode
- status
- failureReason or reviewRequiredReason when applicable

Forbidden:
- retired binding field in text-input proof.
- retired selection field or retired selection version field in text-input proof.
- retired package field or retired package version field in text-input proof.
- retired branch-token field or retired deterministic flow planning as text-input truth.

## Final Readiness Gate

The Text Input law is ready only when write execution uses short-chain refs and does not revive retired map fields.
