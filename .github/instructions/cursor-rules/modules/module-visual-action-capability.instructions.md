---
name: "GrassEye Visual Action Capability"
description: "Use when defining visual target detection, coordinate action capability, target catalog, geometry guarded click execution, and post-action verification."
applyTo: ".github/instructions/cursor-rules/modules/module-visual-action-capability.instructions.md, src/features/platform-action/**, src/features/vision/**, src/lib/browser/**, src/types/visual-action.ts, scripts/audit/domains/visual-action-capability/**, scripts/verify/verify-visual-action-capability.mjs"
---

# GrassEye Visual Action Capability

Scope: governs visual target detection, coordinate action readiness, target catalog, geometry-guarded coordinate actions, and post-action verification.
Boundary: this module governs how visual targets become safe browser actions.
Excludes: product analysis, final business decisions, AI model installation, and DOM selector semantics.
Authority: this file is authoritative only for the visual-action-capability domain.

## Law GRASSEYE-VISUAL-ACTION-CAPABILITY-001-V1

status: active
tier: P0
capabilityDomain: visual-action-capability
enforcementMode: manual-first
evidenceMode: law

summary: real-platform actions must be driven by governed visual targets, geometry guards, coordinate action policy, and post-action verification.

### 主题

视觉目标与坐标动作生产级能力

### 法条

GrassEye real-platform mode must treat visual target detection and coordinate execution as the primary action path.

Required direction:
- Every real-platform action must start from screenshot evidence or a governed visual target source.
- Every clickable target must have targetType, boundingBox, clickPoint, confidence, sourceScreenshotEvidenceId, and uncertainty.
- Every coordinate action must pass geometry guard before execution.
- Every coordinate action must pass action policy before execution.
- DOM / Playwright semantic execution may exist only as operator-approved bounded fallback.
- Every coordinate action must write StructuredActionLog.
- Every coordinate action must capture or reference before/after evidence when possible.
- Every action must have post-action verification or explicit unable_to_verify reason.
- Visual target confidence thresholds must be explicit per targetType.
- Visual action capability is the only production action capability for real-platform mode.
- Visual target failure must not silently fallback to DOM.
- When visual target detection fails, runtime must skip, retry, or review rather than blindly click.

FORBIDDEN:
- Runtime-owned raw coordinates.
- Runtime-owned selectors.
- Coordinate clicks without boundingBox.
- Coordinate clicks without source screenshot evidence.
- Coordinate clicks without confidence.
- Coordinate clicks without geometry guard.
- Coordinate action success without post-action verification or explicit unable_to_verify reason.
- Hidden or explicit DOM fallback after visual failure.
- Treating DOM selector path as real-platform acceptance.
- Stealth, anti-detection, fingerprint spoofing, captcha bypass, proxy pool, or account pool behavior.

## 模块边界声明

This law file does not govern:
- Product analysis conclusions.
- AI model installation choices.
- Final business decisions.