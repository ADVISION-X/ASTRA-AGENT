---
name: "GrassEye Post-action Verification Capability"
description: "Use when defining the independent Post-action Verification Ability Group, action-result verification contracts, verification decisions, or removing verification truth from open, click, scroll, platform-action, and agent runtime."
applyTo: ".github/instructions/cursor-rules/modules/module-post-action-verification-capability.instructions.md, src/capabilities/post-action-verification/**, docs/法案辅助文件/GrassEye Post-action Verification 动作后验证能力组施工图.md, scripts/audit/domains/post-action-verification-capability/**"
---

# GrassEye Post-action Verification Capability

Scope: governs the independent Post-action Verification Ability Group, its contracts, verification decisions, and verification-proof ownership.
Boundary: this module governs only action-result verification after an action has already executed or produced bounded observations.
Excludes: screenshot capture, AI execution, visual target detection, click execution, scroll execution, page-state ownership, and evidence finalization.
Authority: this file is authoritative only for the post-action-verification-capability domain.

## Law GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V1

status: active
tier: P0
capabilityDomain: post-action-verification-capability
enforcementMode: manual-first
evidenceMode: law
legacyAlias: APEX-POSTVERIFY-001-V1

summary: Post-action Verification Ability Group is the only owner of governed action-result verification.

### 主题

动作后验证主权

### 法条

Post-action Verification Ability Group is the only owner of governed action-result verification.

### 禁止

FORBIDDEN:
- open, click, scroll, platform-action, or deleted agent-runtime chains claiming outcome truth.
- page-state being used as a substitute for action-result verification.

## Law GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-002-V1

status: active
tier: P0
capabilityDomain: post-action-verification-capability
enforcementMode: manual-first
evidenceMode: law
legacyAlias: APEX-POSTVERIFY-002-V1

summary: Post-action Verification boundary stays pure.

### 主题

纯边界

### 法条

Post-action Verification consumes action refs, expected outcome, and bounded observations, then returns verification decisions and proof.

### 禁止

FORBIDDEN:
- screenshot capture.
- target detection.
- click or scroll execution.
- evidence packet finalization.

## Law GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V1

status: active
tier: P0
capabilityDomain: post-action-verification-capability
enforcementMode: manual-first
evidenceMode: law
legacyAlias: APEX-POSTVERIFY-003-V1

summary: Verification must stay unique and traceable.

### 主题

结果真相唯一

### 法条

Verification decisions must remain unique, typed, and traceable to action execution refs, persisted action-log refs, and evidence refs.

Required direction:
- Mouse Click primitive success is only an execution fact and is not verification truth.
- Mouse Scroll primitive success is only an execution fact and is not verification truth.
- Post-action Verification consumes actionExecutionRef or persisted action-log refs and decides verified, failed, or review_required.

### 禁止

FORBIDDEN:
- duplicate verification truth in open, platform-action, mouse-click, mouse-scroll, or shell layers.
- warning-only or no-op acceptance paths.
- Mouse Click treating primitiveExecutionRef or browserActionId as a verified business result.
- Mouse Scroll treating scrollExecutionRef, primitiveExecutionRefs, or browserActionId as a verified business result.

## Law GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-004-V1

status: active
tier: P0
capabilityDomain: post-action-verification-capability
enforcementMode: manual-first
evidenceMode: law
legacyAlias: APEX-POSTVERIFY-004-V1

summary: Post-action Verification is enforced by owner inspector and audit runner only.

### 主题

执法链唯一

### 法条

Post-action Verification enforcement closes through the owner inspector and audit runner only.

### 禁止

FORBIDDEN:
- scripts/verify, verify-* scripts, or ad-hoc quality scripts as post-action-verification acceptance.
