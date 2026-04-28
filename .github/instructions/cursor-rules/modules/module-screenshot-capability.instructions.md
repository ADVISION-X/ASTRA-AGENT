---
name: "GrassEye Screenshot Capability"
description: "Use when defining the independent GrassEye screenshot ability group, screenshot contracts, image kinds, coordinate mapping, screenshot artifacts, or screenshot audit ownership."
applyTo: ".github/instructions/cursor-rules/modules/module-screenshot-capability.instructions.md, src/capabilities/screenshot/**, docs/法案辅助文件/GrassEye Screenshot 能力组施工图.md, scripts/audit/domains/screenshot-capability/**"
---

# GrassEye Screenshot Capability

Scope: governs the independent screenshot ability group, screenshot contracts, screenshot artifact classes, and screenshot ownership boundaries.
Boundary: this module governs screenshot truth only.
Excludes: product classification, visual target detection, coordinate action, OCR semantics, and round branch decisions.
Authority: this file is authoritative only for the screenshot-capability domain.

## Law GRASSEYE-SCREENSHOT-CAPABILITY-001-V1

status: active
tier: P0
capabilityDomain: screenshot-capability
enforcementMode: manual-first
evidenceMode: law

summary: Screenshot Ability Group is the only owner of governed screenshot capability.

### 主题

截图主权唯一

### 法条

Screenshot Ability Group is the only owner of governed screenshot capability.

Required direction:
- all governed screenshot operations flow through the Screenshot Ability Group public interface.
- screenshot truth includes image kind, coordinate space, and scale mapping.
- ai_input and region crops must retain enough mapping metadata for Geometry Guard to reason about executable spaces.

### 禁止

FORBIDDEN:
- platform-action, browser helpers, or local-ai adapters owning screenshot truth.
- direct execution of contactSheet or ai_input coordinates without Geometry Guard review.

## Law GRASSEYE-SCREENSHOT-CAPABILITY-002-V1

status: active
tier: P0
capabilityDomain: screenshot-capability
enforcementMode: manual-first
evidenceMode: law

summary: Screenshot boundary stays pure.

### 主题

纯边界

### 法条

Screenshot group may capture viewport, screen, and region images, optimize lossless outputs, and prepare AI input, but it must stay pure.

### 禁止

FORBIDDEN:
- visual target detection.
- geometry guard decisions.
- click or scroll execution.
- product classification or action-result verification.

## Law GRASSEYE-SCREENSHOT-CAPABILITY-003-V1

status: active
tier: P0
capabilityDomain: screenshot-capability
enforcementMode: manual-first
evidenceMode: law

summary: Screenshot artifacts must stay structured and traceable.

### 主题

证据结构化

### 法条

Screenshot results must remain structured, typed, and traceable to evidence refs and coordinate mapping.

Required direction:
- screenshot artifacts must distinguish evidence_original, evidence_optimized, and ai_input classes when applicable.
- child capabilities stay inside the group registry.
- contactSheet must remain a non-executable evidence representation.
- scaleMapping and sourceScreenshotEvidenceId must survive every crop or resize operation that changes coordinate meaning.

### 禁止

FORBIDDEN:
- adapter-local artifact universes.
- hidden resizing or cropping policies outside the Screenshot Ability Group.

## Law GRASSEYE-SCREENSHOT-CAPABILITY-004-V1

status: active
tier: P0
capabilityDomain: screenshot-capability
enforcementMode: manual-first
evidenceMode: law

summary: Screenshot capability is enforced by owner inspector and audit runner only.

### 主题

执法链唯一

### 法条

Screenshot capability enforcement closes through the owner inspector and audit runner only.

### 禁止

FORBIDDEN:
- scripts/verify, verify-* scripts, or ad-hoc quality scripts as screenshot-capability acceptance.
