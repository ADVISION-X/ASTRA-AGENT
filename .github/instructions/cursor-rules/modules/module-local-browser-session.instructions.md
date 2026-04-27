---
name: "GrassEye Local Browser Session"
description: "Use when defining real Chrome launch, persistent browser profile, local login state reuse, and browser session privacy boundaries."
applyTo: ".github/instructions/cursor-rules/modules/module-local-browser-session.instructions.md, src/lib/browser/**, src/lib/local-runtime/**, src/features/agent/**, src/features/platform-action/**, scripts/audit/domains/local-browser-session/**, scripts/verify/verify-local-browser-session.mjs"
---

# GrassEye Local Browser Session

Scope: governs local real Chrome usage, persistent browser profile, browser session reuse, and login-state privacy.
Boundary: this module governs browser session identity and persistence only.
Excludes: platform action semantics, product analysis, AI reasoning, OCR, and final business decisions.
Authority: this file is authoritative only for the local-browser-session capability domain.

## Law GRASSEYE-LOCAL-BROWSER-SESSION-001-V1

status: active
tier: P0
capabilityDomain: local-browser-session
enforcementMode: manual-first
evidenceMode: law

summary: real-platform mode must use local real Chrome with a persistent local profile so login state can be reused without exposing cookies.

### 主题

本地真实 Chrome 与登录态持久化

### 法条

GrassEye real-platform mode must launch or connect to a local real Chrome browser with a persistent local user profile. Login state must be preserved by the local Chrome profile, not by GrassEye reading or exporting cookies.

Required direction:
- Real-platform mode must use local real Chrome, not temporary Chromium, incognito, or ephemeral contexts.
- Browser profile must be persistent across runs.
- User must manually log in inside the local Chrome profile when required.
- GrassEye may store profileRef, profile path metadata, browserMode, and loginState.
- GrassEye must not store raw cookies, sessions, tokens, passwords, or localStorage dumps.
- Browser profile directories must stay local and must be excluded from repository truth.
- Headless mode must be disabled by default for real-platform mode.
- Login challenge, CAPTCHA, safety page, or unknown account state must route to operator review.
- Runtime snapshot must expose browserMode, browserProfileRef, profileStatus, and loginState.
- Structured logs may record browser profile reuse status but must not contain raw cookies or tokens.

FORBIDDEN:
- Temporary browser contexts as real-platform acceptance.
- Incognito or private mode as real-platform acceptance.
- Headless default for real-platform acceptance.
- Exporting Playwright storageState as login persistence.
- Reading cookies through context.cookies() or equivalent.
- Injecting cookies through addCookies() or equivalent.
- Dumping localStorage or sessionStorage for login persistence.
- Writing cookies, session, token, or passwords into logs, evidence, Browse Ledger, Evidence Packet, or reports.
- Remote hosted browser sessions as phase-three default.
- Cookie or session copying between machines or profiles.
- CAPTCHA bypass, login-protection bypass, fingerprint spoofing, proxy pools, or account pools.