---
name: "GrassEye Platform Action"
description: "Use when defining allowed GrassEye platform actions, action rate limits, auditability, or anti-abuse boundaries."
applyTo: ".github/instructions/cursor-rules/modules/module-platform-action.instructions.md, src/lib/browser/**"
---

# GrassEye Platform Action

Scope: governs platform profiles, platform hints, platform metadata, URL and identity rules, and anti-abuse boundaries after the old action-owner folder is retired.
Boundary: this module governs platform description and adapter orchestration material only as an Open child sub-contract, not as an independent owner.
Excludes: open ownership, screenshot ownership, page-state ownership, visual target ownership, geometry policy, click primitives, scroll primitives, outcome verification, and mission decisions.
Authority: this file is authoritative only for the open-capability domain as the platform-profile and hints sub-contract.

## Law GRASSEYE-PLATFORM-ACTION-001-V1

status: retired
tier: P0
capabilityDomain: open-capability
enforcementMode: manual-first
evidenceMode: law

summary: platform-action is an Open child sub-contract for platform profiles only, not an active owner.

### 主题

平台适配边界

### 法条

Platform-action may define platform profiles, adapter hints, platform metadata, view descriptions, and rate limits, but it must not own governed action execution or keep a surviving action-owner folder.

Required direction:
- src/features/platform-action must not survive as an active owner path after migration.
- Any retained platform profile, identity, hint, URL, or view material must migrate under the owning ability groups, such as open/shared, page-state/shared, visual-target, or geometry-guard/shared.
- Platform-specific UI differences may describe labels, heuristics, or profiles only; action execution must go through Open, Screenshot, Visual Target, Geometry Guard, Mouse Click, Mouse Scroll, Page State, and Post-action Verification public contracts.
- Platform adapters may sequence public contracts from Open, Screenshot, Visual Target, Geometry Guard, Mouse Click, Mouse Scroll, Page State, and Post-action Verification.
- Geometry Guard must stay the only geometry verdict owner.

### 禁止

FORBIDDEN:
- platform-action owning open, click, scroll, page-state, visual-target, geometry policy, post-action verification truth, screenshot truth, or region capture truth.
- platform-action generating action plans out of Geometry Guard.
- platform-action importing Geometry Guard child implementations directly.
- PlatformAdapter exposing openComments, clickNotInterested, continueNext, captureVideoRegion, captureCommentRegion, observeCurrentVideo, or other action methods as its own public sovereignty.
- platform-action importing BrowserController to execute governed actions directly.
- platform-action selecting mission maps or browse branches.
- platform-action reviving visual-action, browse-flow, or agent-runtime ownership language.

## Law GRASSEYE-PLATFORM-ACTION-002-V1

status: retired
tier: P0
capabilityDomain: open-capability
enforcementMode: manual-first
evidenceMode: law

summary: retained platform profile material must stay finite, auditable, and non-executing.

### 主题

有限边界与反滥用

### 法条

Any retained platform profile material must stay finite, auditable, and non-executing, with no hidden DOM or abuse path.

Required direction:
- Platform rate limits, identity rules, URL rules, and view hints must be traceable to the governed ability inputs that consume them.
- Real-platform execution must stay inside the ability-group and local-browser-session boundaries rather than a platform-action owner.
- Profile logic must be replaceable without reviving src/features/platform-action or a PlatformAdapter action surface.

### 禁止

FORBIDDEN:
- DOM or selector fallback as production acceptance.
- stealth, anti-detection, captcha bypass, or abuse tooling.
- duplicate action helpers that bypass ability-group contracts.
- compat, bridge, legacy, alias, or re-export wrappers that preserve the old platform-action folder identity.