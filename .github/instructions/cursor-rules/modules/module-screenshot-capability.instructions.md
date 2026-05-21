---
name: "GrassEye Screenshot Capability"
description: "Use when governing the independent Screenshot Ability Group, governed screenshot capture, coordinate-grid rendering, gridSpecRef generation, minimal artifact refs, and image proof. Screenshot is the image-and-grid provider only — not AI, page-state, business semantic, or visual-target owner."
applyTo: ".github/instructions/cursor-rules/modules/module-screenshot-capability.instructions.md, src/capabilities/screenshot/**, docs/法案辅助文件/GrassEye Screenshot 能力组施工图.md, scripts/audit/domains/screenshot-capability/**"
---

# GrassEye Screenshot Capability FINAL

Scope: governs governed screenshot capture, coordinate-grid rendering, gridSpecRef generation, and minimal artifact refs.
Boundary: this module governs image truth only. It does not govern AI reasoning, page-state truth, visual-target truth, PAV, business semantics, action planning, or artifact lifecycle universes.
Authority: this file is authoritative only for the screenshot-capability domain.

Core doctrine:
- Screenshot is image truth, not image meaning.
- Screenshot owns coordinate-grid rendering and gridSpecRef generation.
- Screenshot hands gridSpecRef and screenshot evidence to Geometry Guard or other governed consumers; Screenshot itself never turns them into executable x/y truth.
- AI may return grid cell ids; Screenshot never turns them into executable action truth by itself.
- Screenshot implementation must remain a small image-capture and coordinate-grid provider.
- Screenshot must NOT contain page-state handoff, visual-target truth, post-action verification, AI prompt preparation, business semantic output, artifact lifecycle universe, or multi-phase executor systems.
- Active children: capture-browser-viewport, capture-grid-region, render-coordinate-grid ONLY.
- Forbidden children: capture-desktop-screen, prepare-ai-input, prepare-visual-mission-input, optimize-lossless.
- src/capabilities/screenshot file count MUST remain <= 20. Exceeding 25 is a hard FAIL.
- scripts/audit/domains/screenshot-capability file count MUST remain <= 3.

## Law GRASSEYE-SCREENSHOT-CAPABILITY-001-V3

status: active
tier: P0
capabilityDomain: screenshot-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Screenshot is a camera + coordinate-grid provider only. Small, focused, no subsystems.

### 主题

Screenshot 大道至简原则

### 法条

Screenshot ONLY provides:
1. Browser viewport screenshot capture.
2. Optional grid-region / crop-region capture.
3. Coordinate grid image rendering.
4. gridSpecRef generation.
5. screenshotRef / coordinateGridScreenshotRef / artifactRef output.
6. Screenshot proof (image/artifact/gridSpec truth only).

Screenshot MUST NOT provide:
- AI judgment or prompt preparation.
- page-state truth or visual-target truth.
- post-action verification.
- business semantic output.
- artifact lifecycle universe.
- multi-phase executor system.
- executable coordinate mapping (x/y decision belongs to Geometry Guard).

Required input fields per child:
- missionId, runId, stepId, capabilityCallId, nerveBusEnvelopeId, inputRef, idempotencyKey
- browserSessionRef (for capture children)
- sourceScreenshotRef (for render-coordinate-grid and capture-grid-region)
- privacyPolicy, capturePolicy (for capture children)
- gridPolicy (for render-coordinate-grid)
- timeoutMs when applicable

Forbidden input fields (absolute):
- mapId, runtimePlanId, routePlanId, activationId, templateId, selectedMapId
- bindingPackageId, bindingPackageVersion, selectedBindingId, bindingVersion
- bindingSnapshotRef, branchToken, deterministicFlowPlan
- pageStateRef, pageStateTruth, visualTargetRef, visualTargetTruth
- postActionVerificationRef, PAV, targetCandidateRef
- businessTruth, actionPlan, clickResult

## Law GRASSEYE-SCREENSHOT-CAPABILITY-002-V3

status: active
tier: P0
capabilityDomain: screenshot-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Screenshot proof proves image/artifact/gridSpec truth only.

### 主题

Screenshot 证明仅证图像事实

### 法条

Screenshot proof MUST contain:
- proofId, abilityGroupId = screenshot, childCapabilityId
- missionId, runId, stepId, capabilityCallId, nerveBusEnvelopeId
- inputRef, artifactRef, gridSpecRef (when applicable)
- totalScreenshotStepMs, capturePhaseMs, gridRenderPhaseMs, artifactWritePhaseMs (when applicable)
- status: success | failed | review_required
- failureReason, reviewRequiredReason (when applicable)
- startedAt, endedAt, durationMs

Screenshot proof MUST NOT assert:
- AI correctness, business success, target truth, page state truth
- click success, geometry safety, PAV truth, prompt readiness

Forbidden proof fields:
- retired binding field, retired selection field, retired package field, retired branch-token field
- any map/route/plan field

## Final Readiness Gate

The Screenshot law is satisfied only when:
1. src/capabilities/screenshot contains <= 20 files.
2. Active children are exactly: capture-browser-viewport, capture-grid-region, render-coordinate-grid.
3. No page-state/visual-target/PAV/business/executable-coordinate fields exist in screenshot schemas.
4. Inspector passes with <= 3 audit files.
5. typecheck passes.
