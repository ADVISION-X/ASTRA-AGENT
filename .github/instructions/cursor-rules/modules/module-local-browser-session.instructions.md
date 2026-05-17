---
name: "GrassEye Local Browser Session"
description: "Use when defining real Chrome launch, persistent browser profile, local browser session reuse, and browser session privacy boundaries."
applyTo: ".github/instructions/cursor-rules/modules/module-local-browser-session.instructions.md, src/lib/browser/**, src/lib/local-runtime/**, src/capabilities/open/**, scripts/audit/domains/open-capability/**"
---

# GrassEye Local Browser Session

Scope: governs local real Chrome usage, persistent browser profile, browser session reuse, and browser privacy.
Boundary: this module governs browser session identity and persistence only as an Open child sub-contract, not as an independent owner.
Excludes: open ownership, mission decisions, and platform action semantics.
Authority: this file is authoritative only for the open-capability domain as the real-Chrome session child sub-contract.

## Law GRASSEYE-LOCAL-BROWSER-SESSION-001-V1

status: retired
tier: P0
capabilityDomain: open-capability
enforcementMode: manual-first
evidenceMode: law

summary: browser-session is an Open child sub-contract for real-Chrome reuse, not an active owner.

### 主题

真实浏览器会话边界

### 法条

GrassEye real-platform mode must use local real Chrome with a persistent local profile so login state can be reused without exporting cookies, while browser-session remains a low-level boundary consumed by higher owners.

Required direction:
- real-platform mode uses local real Chrome, persistent local profiles, and manual operator login when required.
- real-platform mode must keep one persistent local user profile boundary per governed browser session.
- GrassEye may store profileRef, profile metadata, browserMode, and loginState, but it must not store raw cookies, sessions, or tokens.
- GrassEye must not store raw cookies, and any persisted session metadata must not contain raw cookies or tokens.
- Headless mode must be disabled by default for real-platform acceptance.
- open, page-state, and post-action verification consume browser-session primitives through their own public contracts.

### 禁止

FORBIDDEN:
- local-browser-session becoming the owner of open, current-page truth, or outcome verification.
- cookie export/import, storageState login persistence, or headless-default real-platform acceptance.
- committed profile directories or remote hosted browser sessions.
