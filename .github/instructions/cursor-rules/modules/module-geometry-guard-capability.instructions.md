---
name: "GrassEye Geometry Guard Capability"
description: "Use when defining the independent Geometry Guard Ability Group, coordinate safety gating, coordinate-space validation, scale mapping, or executable geometry normalization."
applyTo: ".github/instructions/cursor-rules/modules/module-geometry-guard-capability.instructions.md, src/capabilities/geometry-guard/**, docs/法案辅助文件/GrassEye Geometry Guard 几何安全守卫能力组施工图.md, scripts/audit/domains/geometry-guard-capability/**, src/lib/local-runtime/tiktok-platform/**"
---

# GrassEye Geometry Guard Capability

Scope: governs the independent Geometry Guard Ability Group as the only owner of executable geometry safety gating.
Boundary: this module governs coordinate-space validation, bbox and click-point legality, scale mapping, bounds validation, normalized geometry output, and guard decisions only.
Excludes: browser control, screenshot capture, target detection, action planning, action execution, AI reasoning, platform business verbs, and post-action verification.
Authority: this file is authoritative only for the geometry-guard-capability domain.

## Law GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V2

status: active
tier: P0
capabilityDomain: geometry-guard-capability
enforcementMode: manual-first
evidenceMode: law

summary: Geometry Guard is a coordinate safety gate only.

### 主题

几何安全门禁唯一主权

### 法条

Geometry Guard Ability Group is the only owner of governed coordinate safety gating.

Required direction:
- Geometry Guard answers only whether geometry is executable and how it normalizes into the requested execution space.
- Geometry Guard public result must expose guardDecision with only allow, block, or review_required.
- Geometry Guard public result may emit normalizedCoordinateSpace, normalizedClickPoint, normalizedBbox, appliedScaleMapping, failureReason, dataQualityFlags, and runtimeProof.
- Geometry Guard child surface must be limited to:
	- validate-coordinate-space
	- validate-bbox-integrity
	- validate-click-point
	- validate-scale-mapping
	- map-ai-input-to-viewport
	- map-region-to-source
	- validate-browser-viewport-bounds
	- validate-desktop-screen-bounds

### 禁止

FORBIDDEN:
- plan-coordinate-action.
- calibrate-browser-geometry as a public child owner.
- verify-browser-geometry as a public child owner.
- action plans, action recipes, fallback modes, or target-action allowlists.
- business verbs such as open_comments, continue_next, click_not_interested, capture_video_region, capture_comment_region, or like_or_save_candidate inside Geometry Guard.

## Law GRASSEYE-GEOMETRY-GUARD-CAPABILITY-002-V2

status: active
tier: P0
capabilityDomain: geometry-guard-capability
enforcementMode: manual-first
evidenceMode: law

summary: Geometry Guard public contract must stay clean and independent.

### 主题

合同纯度与旧类型隔离

### 法条

Geometry Guard public contract must own its own coordinate types and must not inherit action or browser-control ownership.

Required direction:
- contract.ts must define GeometryGuardAbilityInput, GeometryGuardAbilityResult, GeometryCoordinateSpace, GeometryScaleMapping, GeometryBbox, GeometryClickPoint, GeometryGuardFailureReason, GeometryGuardSafetyPolicy, and Geometry runtime proof types.
- sourceCoordinateSpace and requestedExecutionSpace must be explicit input fields.
- scaleMapping, imageSize, viewportSize, screenSize, deviceScaleFactor, sourceScreenshotEvidenceRef, sourceTargetRef, and sourceAiResultRef must be supported as governed inputs.
- contactSheet, aiInput, regionCrop, imageEvidence, browserViewport, and desktopScreen must remain distinct coordinate spaces.

### 禁止

FORBIDDEN:
- importing BrowserController in the Geometry Guard public contract.
- importing PlatformActionType in the Geometry Guard public contract.
- importing ../../types/visual-action in the Geometry Guard public contract.
- importing old VisualTarget types into the Geometry Guard public contract.
- actionPlan, fallbackMode, requestedActionType, or target-action allowlists in Geometry Guard result types.

## Law GRASSEYE-GEOMETRY-GUARD-CAPABILITY-003-V2

status: active
tier: P0
capabilityDomain: geometry-guard-capability
enforcementMode: manual-first
evidenceMode: law

summary: Geometry Guard validates mappings and bounds from governed evidence only.

### 主题

映射与边界执法

### 法条

Geometry Guard consumes evidence-backed geometry only and must refuse unsafe or ambiguous coordinate transitions.

Required direction:
- coordinateSpace must be explicit.
- bbox must contain finite x, y, width, and height, with width and height greater than 0.
- clickPoint must contain finite x and y and must be inside bbox.
- requested execution into browserViewport or desktopScreen must emit normalizedClickPoint.
- sourceCoordinateSpace aiInput requires scaleMapping before allow.
- sourceCoordinateSpace regionCrop requires mapping back to a governed source before allow.
- contactSheet coordinates must not be directly executable into browserViewport or desktopScreen.
- Geometry Guard must not silently clamp coordinates.
- Missing evidence may downgrade to review_required but must not be hidden.
- Geometry Guard outputs geometryGuardRef, guardDecision, normalizedClickPoint, and normalizedCoordinateSpace as the only downstream execution authority.
- Mouse Click and Mouse Scroll may consume normalized executable coordinates only and must not redo imageEvidence or scaleMapping mapping.
- Mouse Scroll region execution may consume only a Geometry Guard approved anchorPoint or region reference and must not rebuild mappings from aiInput, contactSheet, or imageEvidence.

### 禁止

FORBIDDEN:
- allowing aiInput coordinates into executable spaces without scaleMapping.
- Mouse Click or Mouse Scroll redoing scaleMapping or imageEvidence remapping downstream.
- allowing contactSheet coordinates directly into browserViewport or desktopScreen.
- silent clamp.
- missing deviceScaleFactor being guessed.
- action type deciding geometry verdict.

## Law GRASSEYE-GEOMETRY-GUARD-CAPABILITY-004-V2

status: active
tier: P0
capabilityDomain: geometry-guard-capability
enforcementMode: manual-first
evidenceMode: law

summary: Geometry Guard must consume evidence and ports, not browser ownership.

### 主题

浏览器主权隔离

### 法条

Geometry Guard is a guard, not a browser operation owner.

Required direction:
- Geometry Guard ability-group creation must accept only policy input such as defaultSafetyPolicy or geometryPolicy.
- Geometry Guard runtime input must carry all geometry evidence needed for validation.
- If live measurements are needed, they must arrive through a thin measurement or evidence port outside the public contract.

### 禁止

FORBIDDEN:
- BrowserController as Geometry Guard context or constructor requirement.
- direct browser operations from Geometry Guard children.
- screenshot, click, scroll, AI, or verification calls from Geometry Guard.

## Law GRASSEYE-GEOMETRY-GUARD-CAPABILITY-005-V2

status: active
tier: P0
capabilityDomain: geometry-guard-capability
enforcementMode: manual-first
evidenceMode: law

summary: Geometry Guard enforcement closes through the owner inspector only.

### 主题

执法链唯一

### 法条

Geometry Guard enforcement closes through the owner inspector, generated audit artifacts, and audit runner only.

Required direction:
- decisive checks must use AST, symbol resolution, or import-graph analysis.
- capability-check and verify files may be referenced only as forbidden-shape targets.

### 禁止

FORBIDDEN:
- capability-check.ts under Geometry Guard.
- verify* functions or verify scripts acting as Geometry Guard acceptance.
- regex-only, grep-only, or includes-only decisive enforcement.
