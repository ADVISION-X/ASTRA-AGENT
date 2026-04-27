---
name: "GrassEye Local App Shell"
description: "Use when defining GrassEye local application form, local runtime shell, desktop packaging boundary, or SaaS/browser-extension/CLI exclusion."
applyTo: ".github/instructions/cursor-rules/modules/module-local-app-shell.instructions.md, src/app/**, src/lib/local-runtime/**, src/features/operator-control/**"
---

# GrassEye Local App Shell

Scope: governs GrassEye application form, local runtime shell, desktop packaging boundary, and non-SaaS execution posture.
Boundary: this module governs only the application shell and local runtime form.
Excludes: browser action implementation, AI model invocation, OCR implementation, database schema design, and UI component design.
Authority: this file is authoritative only for the local-app-shell capability domain.

---

## Law GRASSEYE-LOCAL-APP-SHELL-001-V1

status: active
tier: P0
capabilityDomain: local-app-shell
enforcementMode: manual-first
evidenceMode: law

summary: GrassEye is a local-first desktop workbench, not a SaaS crawler, browser plugin, or remote automation service.

### 主题

本地桌面工作台形态

### 法条

GrassEye phase-one must keep its executable product form as a local-first desktop workbench: local operator UI, local agent runtime, local browser session, local AI boundary, and local evidence storage.

Required direction:
- Phase-one implementation may use a localhost web console as the operator UI.
- The final product form targets a macOS local desktop application shell.
- Operator UI, agent runtime, browser control, AI execution, and evidence storage must remain local by default.
- Real-platform browser session must run through a local real Chrome persistent profile rather than an ephemeral browser context.
- Desktop packaging must wrap the local runtime rather than convert GrassEye into a SaaS system.

### 禁止

FORBIDDEN:
- SaaS-hosted execution as the phase-one default product form.
- Remote browser automation service holding user sessions, cookies, screenshots, or product evidence.
- Desktop or local workbench surfaces becoming a remote browser host for user profiles.
- Browser extension as the sole phase-one product shell.
- CLI-only operation as the primary operator experience.
- Public internet exposure of the local operator console or agent runtime.

---

## Law GRASSEYE-LOCAL-APP-SHELL-002-V1

status: active
tier: P0
capabilityDomain: local-app-shell
enforcementMode: manual-first
evidenceMode: law

summary: local shell components must stay separated so UI, agent runtime, browser control, AI execution, and data storage do not collapse into one mixed owner.

### 主题

本地运行壳分层

### 法条

GrassEye local runtime must keep clear shell boundaries between operator UI, agent runtime, browser control, local AI gateway, and local data store.

Required direction:
- Operator UI is responsible for control, review, and status presentation.
- Agent runtime is responsible for bounded observe -> classify -> act -> record orchestration.
- Browser control is responsible only for governed browser actions through approved seams.
- Local AI boundary is responsible only for governed AI task execution and structured outputs.
- Local data boundary is responsible only for evidence, records, retention, deletion, and export.

### 禁止

FORBIDDEN:
- UI components directly owning browser automation, local AI calls, or product opportunity truth.
- Browser controller owning product scoring, comment intelligence, or operator approval.
- Local AI gateway owning platform actions or persistence truth.
- One process or file becoming an unreviewable mixed owner for UI, agent, browser, AI, and data.

---

## Law GRASSEYE-LOCAL-APP-SHELL-003-V1

status: active
tier: P0
capabilityDomain: local-app-shell
enforcementMode: manual-first
evidenceMode: law

summary: desktop packaging is a wrapper around the local workbench, not a new architecture or second runtime chain.

### 主题

桌面封装边界

### 法条

Future macOS desktop packaging must preserve the local workbench chain instead of creating a second runtime architecture.

Required direction:
- Electron, Tauri, SwiftUI, or equivalent desktop packaging choices remain packaging layers until separately approved.
- Packaging must start, stop, and supervise local components without taking over their business authority.
- Desktop packaging must not duplicate agent runtime, platform adapter, local AI, or data ownership.
- Packaging choice must remain replaceable without rewriting the GrassEye core chain.

### 禁止

FORBIDDEN:
- Electron, Tauri, SwiftUI, or any desktop shell becoming a second business architecture.
- Packaging layer duplicating platform action, local AI, or data-store logic.
- Packaging-specific shortcuts that bypass local-app-shell, security-privacy, platform-action, or local-data boundaries.
- Treating the desktop wrapper as permission to expose local services publicly.

---

## Law GRASSEYE-LOCAL-APP-SHELL-004-V1

status: active
tier: P0
capabilityDomain: local-app-shell
enforcementMode: manual-first
evidenceMode: law

summary: GrassEye startup must remain a bounded local bootstrap path that checks prerequisites, starts the local workbench, and opens the local operator page without becoming a repair or business-logic bucket.

### 主题

受治理启动入口

### 法条

GrassEye startup must be a bounded local bootstrap path for dependency readiness, local service startup, health confirmation, and opening the local operator console.

Required direction:
- Startup may check Node, npm, package metadata, lockfile presence, node_modules readiness, service health, and local page availability.
- Startup may run dependency installation only when the local dependency state is missing, stale, or inconsistent with package metadata.
- Startup must force-clear listener ownership on the canonical localhost port before each runtime launch so every startup begins from a clean port state.
- Startup must open the local operator console only after the local service health check passes.
- Startup must print clear status, failure reason, and next action when it cannot complete.

### 禁止

FORBIDDEN:
- Startup scripts owning Agent business logic, platform adapter logic, local AI reasoning, OCR logic, product-signal logic, or data truth.
- Startup scripts silently changing architecture, phase files, laws, generated artifacts, database schema, or runtime evidence.
- Startup scripts performing major dependency upgrades without explicit operator approval.
- Startup scripts hiding failed dependency install, failed service startup, or failed health checks.
- Startup scripts reusing an old listener on the canonical startup port instead of reclaiming clean ownership first.
- Startup scripts becoming a catch-all repair script.

---

## 模块边界声明

This law file does not govern:
- How platform clicks are implemented.
- Which local AI model is selected.
- How OCR is implemented.
- Which database schema is used.
- How UI components are visually designed.