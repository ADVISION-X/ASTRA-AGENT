---
name: "GrassEye Local App Shell"
description: "Use when defining GrassEye local application form, local runtime shell, desktop packaging boundary, or SaaS/browser-extension/CLI exclusion."
applyTo: ".github/instructions/cursor-rules/modules/module-local-app-shell.instructions.md, src/app/**, src/lib/local-runtime/**, src/lib/local-runtime/runtime-executor.ts, src/lib/local-runtime/runtime-bootstrap.ts, src/lib/local-runtime/runtime-state.ts, src/lib/local-runtime/runtime-step-support.ts, src/capabilities/commander-console/**, docs/法案辅助文件/GrassEye 本地应用形态与运行壳施工图.md"
---

# GrassEye Local App Shell

Scope: governs GrassEye application form, local runtime shell, desktop packaging boundary, and non-SaaS execution posture.
Boundary: this module governs the local shell only as a Commander Console child sub-contract, not as an independent owner.
Excludes: Commander Console ownership, Orchestration command truth, browser action implementation, AI execution, and persistence ownership.
Authority: this file is authoritative only for the commander-console-capability domain as the local app shell child sub-contract.

## Law GRASSEYE-LOCAL-APP-SHELL-001-V1

status: retired
tier: P0
capabilityDomain: commander-console-capability
enforcementMode: manual-first
evidenceMode: law

summary: local-app-shell is a commander-console child sub-contract for local shell form, not an active owner.

### 主题

本地工作台形态

### 法条

GrassEye phase-four must remain a local-first desktop workbench with local operator UI, local browser session, local AI execution, local evidence storage, and full-law audit enforcement.

Required direction:
- localhost operator console is an allowed shell form during the current implementation window.
- the final product form targets a macOS local desktop shell.
- operator UI and local shell stay local by default.

### 禁止

FORBIDDEN:
- SaaS-hosted execution.
- remote browser hosting.
- browser-extension-only or CLI-only primary product form.

## Law GRASSEYE-LOCAL-APP-SHELL-002-V1

status: retired
tier: P0
capabilityDomain: commander-console-capability
enforcementMode: manual-first
evidenceMode: law

summary: shell layers must stay separated from command and mission truth.

### 主题

本地壳分层

### 法条

Local shell components may host UI, startup wiring, and runtime supervision, but they must not own Commander Console or Orchestration truth.

Required direction:
- human command enters Commander Console.
- mission state and step transitions belong to Orchestration.
- shell code may compose these boundaries but must not replace them.
- local shell and src/lib support paths may supervise runtime state, but shell-side execution slices must not be reintroduced as src/lib/local-runtime/runtime-executor.ts, runtime-bootstrap.ts, runtime-state.ts, or runtime-step-support.ts.
- src/lib/local-app-shell is the canonical render boundary for Commander Console HTML, styles, scripts, and locale-aware presentation helpers.

### 禁止

FORBIDDEN:
- shell files becoming a second command owner.
- local shell holding mission truth or map truth.
- local shell holding evidence truth, review truth, or candidate disposition truth.
- src/features/operator-control or workbench folders acting as an active shell root.
- src/lib/local-runtime/runtime-executor.ts, runtime-bootstrap.ts, runtime-state.ts, or runtime-step-support.ts becoming a shell-side execution chain for mission flow, AI judgment routing, browse branching, or packet finalization.

## Law GRASSEYE-LOCAL-APP-SHELL-003-V1

status: retired
tier: P0
capabilityDomain: commander-console-capability
enforcementMode: manual-first
evidenceMode: law

summary: desktop packaging is a wrapper, not a second architecture.

### 主题

桌面封装边界

### 法条

Desktop packaging may wrap the local workbench chain but must not duplicate business ownership.

Required direction:
- packaging choices remain replaceable.
- packaging starts, stops, and supervises local components only.

### 禁止

FORBIDDEN:
- packaging layer duplicating runtime, AI, or persistence ownership.
- packaging layer bypassing security or privacy boundaries.

## Law GRASSEYE-LOCAL-APP-SHELL-004-V1

status: retired
tier: P0
capabilityDomain: commander-console-capability
enforcementMode: manual-first
evidenceMode: law

summary: startup is a bounded local bootstrap path.

### 主题

启动入口边界

### 法条

Local App Shell may be the page that startup opens, but startup-entrypoint is the canonical owner of bootstrap.

Required direction:
- startup-entrypoint may open only the Commander Console local URL during shell bootstrap.
- root-page rendering may consume Commander Console read models through Local App Shell render helpers only.
- Local App Shell must remain render-only after bootstrap completes.

### 禁止

FORBIDDEN:
- Local App Shell owning startup command truth or canonical startup process supervision.
- startup owning mission decisions, AI reasoning, or persistence truth.
- startup or shell code directly issuing governed start, pause, stop, reset-store, or review commands outside Commander Console public methods.

## src/lib/local-runtime assembly boundary

src/lib/local-runtime must remain a small local assembly/facade layer and must not exceed the responsibilities of wiring public capability contracts into the local workbench.

FORBIDDEN in src/lib/local-runtime:
- mission flow or round loop logic
- AI prompt construction or AI judgment
- Nerve Bus AI special routes
- Forensics finalization or evidence packet building
- Commander read-model universe
- map-chain, binding, or RuntimePlan support
- page-state, visual-target, or PAV support systems
- candidate approval, review continuation, or audit dashboard logic
