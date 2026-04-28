---
name: "GrassEye Mouse Click Capability"
description: "Use when defining the independent Mouse Click Ability Group, click contracts, click safety policy, click proof, or governed browser/screen click execution ownership."
applyTo: ".github/instructions/cursor-rules/modules/module-mouse-click-capability.instructions.md, src/capabilities/mouse-click/**, docs/法案辅助文件/GrassEye Mouse Click 能力组施工图.md, scripts/audit/domains/mouse-click-capability/**"
---

# GrassEye Mouse Click Capability

Scope: governs the independent Mouse Click Ability Group, click contracts, click proof, and governed click ownership.
Boundary: this module governs only click input validation, primitive click execution, proof emission, and result ownership.
Excludes: screenshot capture, visual target detection, AI execution, comment capture, product classification, and outcome verification.
Authority: this file is authoritative only for the mouse-click-capability domain.

## Law GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V1

status: active
tier: P0
capabilityDomain: mouse-click-capability
enforcementMode: manual-first
evidenceMode: law
legacyAlias: APEX-MOUSE-CLICK-001-V1

summary: Mouse Click Ability Group is the only owner of governed mouse click capability.

### 主题

点击主权唯一

### 法条

Mouse Click Ability Group is the only owner of governed mouse click capability.

### 禁止

FORBIDDEN:
- platform adapters, visual-target, or AI layers owning click truth.
- agent-runtime or visual-action legacy paths owning click execution.
- BrowserController appearing in the Mouse Click public contract.
- BrowserActionResult appearing in the Mouse Click public contract.

## Law GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1

status: active
tier: P0
capabilityDomain: mouse-click-capability
enforcementMode: manual-first
evidenceMode: law
legacyAlias: APEX-MOUSE-CLICK-002-V1

summary: Mouse Click boundary stays pure.

### 主题

纯边界

### 法条

Mouse Click only validates Geometry Guard-authorized click input, executes the primitive click through MouseClickPrimitivePort, records structured proof, and returns MouseClickResult.

Required direction:
- Mouse Click public entry accepts only browserViewport or desktopScreen execution coordinates.
- Mouse Click public input must require geometryGuardRef and guardDecision = allow.
- button and clickCount are governed input parameters rather than child-capability ids.
- Mouse Click child capabilities are only click-browser-coordinate and click-desktop-coordinate.
- Mouse Click public result returns actionExecutionRef, primitiveExecutionRef, debugLogRef, and runtimeProof.

### 禁止

FORBIDDEN:
- screenshot capture.
- target detection.
- product classification.
- post-action verification.
- imageEvidence or aiInput coordinates as executable click truth.
- scaleMapping or coordinate remapping inside Mouse Click.
- fallbackUsed, browserAction, or BrowserActionId leaking through Mouse Click results.
- final action-log writes inside Mouse Click.

## Law GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V1

status: active
tier: P0
capabilityDomain: mouse-click-capability
enforcementMode: manual-first
evidenceMode: law
legacyAlias: APEX-MOUSE-CLICK-003-V1

summary: Mouse Click accepts only pre-validated coordinates.

### 主题

受保护输入

### 法条

Mouse Click accepts only explicit, Geometry Guard-authorized coordinate inputs and does not claim action-result truth.

Required direction:
- geometryGuardRef is mandatory on every governed click input.
- guardDecision must equal allow before the primitive may execute.
- sourceEvidenceRef or sourceTargetRef is required unless operatorManualApprovalRef is present under an allowOperatorManual policy.
- right click requires explicit allowRightClick = true.
- double click requires explicit allowDoubleClick = true.
- Mouse Click success means primitive execution success only and never means post-action verification success.
- contactSheet, aiInput, imageEvidence, or regionCrop coordinates must not bypass Geometry Guard-approved mapping into executable spaces.

### 禁止

FORBIDDEN:
- click policy hidden in browser primitives.
- click helpers inferring coordinates on their own.
- click execution claiming final success beyond its immediate result.
- accepting imageEvidence with scaleMapping as a substitute for Geometry Guard approval.
- retry or fallback paths without an explicit upstream policy owner.
- direct execution of contactSheet or aiInput coordinates.

## Law GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V1

status: active
tier: P0
capabilityDomain: mouse-click-capability
enforcementMode: manual-first
evidenceMode: law
legacyAlias: APEX-MOUSE-CLICK-004-V1

summary: Mouse Click is enforced by owner inspector and audit runner only.

### 主题

执法链唯一

### 法条

Mouse Click enforcement closes through the owner inspector and audit runner only.

### 禁止

FORBIDDEN:
- scripts/verify, verify-* scripts, or ad-hoc quality scripts as mouse-click acceptance.
- capability-check.ts under src/capabilities/mouse-click.

## Law GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1

status: active
tier: P0
capabilityDomain: mouse-click-capability
enforcementMode: manual-first
evidenceMode: law

summary: Mouse Click canonical topology is one primitive-port root with two execution children.

### 主题

固定拓扑

### 法条

Mouse Click canonical topology is contract.ts, ability-group.ts, registry.ts, primitive-port.ts, index.ts, shared/*, and children/*/implementation.ts.

Required direction:
- shared must include click-policy.ts, click-result.ts, click-failure.ts, runtime-proof.ts, and coordinate.ts.
- children must contain only click-browser-coordinate/implementation.ts and click-desktop-coordinate/implementation.ts.

### 禁止

FORBIDDEN:
- click-left-point, click-right-point, or double-click-left-point child roots.
- compat, bridge, legacy, or v2 roots.
- barrel exports of child implementations.
