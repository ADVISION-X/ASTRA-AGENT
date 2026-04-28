---
name: "GrassEye Visual Target Capability"
description: "Use when defining the independent GrassEye visual target ability group, target result normalization, candidate selection, coordinate truth, or visual-target audit ownership."
applyTo: ".github/instructions/cursor-rules/modules/module-visual-target-capability.instructions.md, src/capabilities/visual-target/**, docs/法案辅助文件/GrassEye Visual Target 视觉目标定位能力组施工图.md, scripts/audit/domains/visual-target-capability/**"
---

# GrassEye Visual Target Capability

Scope: governs the independent visual target ability group, target result normalization, target candidate selection, and visual target ownership boundaries.
Boundary: this module governs how target candidates become governed VisualTargetResult only.
Excludes: screenshot capture, AI public ownership, geometry policy ownership, mouse click, mouse scroll, and outcome verification.
Authority: this file is authoritative only for the visual-target-capability domain.

## Law GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1

status: active
tier: P0
capabilityDomain: visual-target-capability
enforcementMode: manual-first
evidenceMode: law

summary: Visual Target Ability Group is the only owner of governed visual target result normalization.

### 主题

视觉目标主权

### 法条

Visual Target Ability Group is the only owner of governed visual target detection and normalization.

Required direction:
- Visual Target may output bbox, clickPoint, confidence, coordinateSpace, sourceScreenshotEvidenceRef, sourceAiResultRef, sourceCandidateRef, and dataQualityFlags.
- Visual Target may mark requiresGeometryGuard when executable validation is still needed.
- Geometry Guard must consume Visual Target output through public contract only.

### 禁止

FORBIDDEN:
- platform adapters owning target truth.
- click or scroll layers computing target coordinates on their own.
- deleted visual-action chains returning final target truth.
- Visual Target deciding allow, block, or review_required for execution.
- Visual Target mapping contactSheet or aiInput directly into executable browser coordinates as final truth.

## Law GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V1

status: active
tier: P0
capabilityDomain: visual-target-capability
enforcementMode: manual-first
evidenceMode: law

summary: Visual Target boundary stays pure.

### 主题

纯边界

### 法条

Visual Target only validates, normalizes, selects, and returns target results.

### 禁止

FORBIDDEN:
- screenshot capture.
- geometry policy ownership.
- click or scroll execution.
- post-action verification.
- DOM or BOM selector lookup as target truth.

## Law GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V1

status: active
tier: P0
capabilityDomain: visual-target-capability
enforcementMode: manual-first
evidenceMode: law

summary: Visual Target consumes governed evidence and returns typed contracts.

### 主题

受治理证据输入

### 法条

Visual Target consumes screenshot evidence refs, AI candidate refs, coordinate space, and target type, and returns a typed VisualTargetResult.

### 禁止

FORBIDDEN:
- adapter-local shadow contracts.
- hidden bbox or clickPoint laundering outside the group.
- old visual-action compatibility universes.

## Law GRASSEYE-VISUAL-TARGET-CAPABILITY-004-V1

status: active
tier: P0
capabilityDomain: visual-target-capability
enforcementMode: manual-first
evidenceMode: law

summary: Visual Target is enforced by owner inspector and audit runner only.

### 主题

执法链唯一

### 法条

Visual Target enforcement closes through the owner inspector and audit runner only.

### 禁止

FORBIDDEN:
- scripts/verify, verify-* scripts, or ad-hoc quality scripts as visual-target acceptance.
