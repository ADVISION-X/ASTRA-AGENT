---
name: "GrassEye Startup Entrypoint"
description: "Use when defining the unique GrassEye startup source, launch-grasseye bootstrap, grasseye:start command, Commander Console opening, terminal structured startup logs, or startup-entrypoint audit ownership."
applyTo: ".github/instructions/cursor-rules/modules/module-startup-entrypoint.instructions.md, scripts/startup/**, scripts/audit/domains/commander-console-capability/**, docs/法案辅助文件/GrassEye 唯一启动入口与终端结构化日志施工图.md, package.json"
---

# GrassEye Startup Entrypoint

Scope: governs the unique local bootstrap source, canonical startup command, Commander Console opening handoff, startup readiness gating, and terminal structured startup log display.
Boundary: this module governs startup bootstrap only as a Commander Console child sub-contract, not as an independent owner.
Excludes: human command entry, mission execution, command transport, AI task execution, capability-child execution, and record persistence ownership.
Authority: this file is authoritative only for the commander-console-capability domain as the startup bootstrap child sub-contract.

## Law GRASSEYE-STARTUP-ENTRYPOINT-001-V2

status: active
tier: P0
capabilityDomain: commander-console-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: startup-entrypoint is the only bootstrap source and must never become a second runtime or mission owner.

### 主题

唯一启动来源

### 法条

GrassEye must expose one canonical startup script and one user-facing startup command for local bootstrap.

Required direction:
- scripts/startup/launch-grasseye.mjs is the canonical startup entrypoint.
- package.json exposes exactly one user-facing startup command: grasseye:start.
- startup may check dependencies, clear startup ports, start the local app service, probe the Commander Console shell, open Commander Console, and supervise child-process shutdown.
- startup must surface clear failureReason when bootstrap fails.

### 禁止

FORBIDDEN:
- multiple competing user-facing startup commands.
- startup directly starting governed mission flow.
- startup calling capability children or AI task runtime for business inference.
- startup writing final evidence, browse ledger, or packet truth.
- startup invoking retired deterministic flows, retired selection choices, retired binding states, or retired branch tokens.
- startup invoking scripts/verify or acting as a CI substitute.

## Law GRASSEYE-STARTUP-ENTRYPOINT-002-V2

status: active
tier: P0
capabilityDomain: commander-console-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: startup readiness must be shell/bootstrap readiness only and must not revive retired package chain gates.

### 主题

启动 readiness 只服务启动壳层

### 法条

Startup must run one governed bootstrap readiness chain before mission runtime becomes available.

Required startup order:
- dependency_check
- update_preflight_check
- prompt_contract_registry_check
- muscle_memory_catalog_check
- platform_registry_check
- local_ai_runtime_presence_check
- local_ai_model_roster_check
- local_ai_start_or_connect
- local_ai_health_probe
- ai_capability_readiness_gate
- local_app_service_start
- commander_console_open
- mission_runtime_available

Required direction:
- startup must run update preflight before local app service start or Commander Console open.
- startup must verify Prompt Contract Registry, MuscleMemoryCatalog, and PlatformRegistry are readable before mission runtime becomes available.
- startup must obtain local AI readiness only through the governed startup helper and the governed local-ai readiness contract.
- startup must verify required local AI model roles before mission runtime becomes available.
- startup terminal structured logs must include phase, component, eventType, status, message, refs, durationMs, and failureReason.
- startup must not invoke AI business inference, AI judgment, mission flow, or fake/mock/heuristic fallback as success.

### 禁止

FORBIDDEN:
- legacy startup chain-readiness check as startup truth.
- route-plan or selected-map readiness as startup truth.
- starting local app service or opening Commander before ai_capability_readiness_gate passes.
- marking mission runtime available while governed readiness failed.
- silently skipping registry or model checks.
- startup directly importing AI runtime internals outside the governed startup helper or readiness contract.
- scattered local AI startup paths across ability groups or consumers.

## Law GRASSEYE-STARTUP-ENTRYPOINT-003-V2

status: active
tier: P0
capabilityDomain: commander-console-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: startup may open Commander Console but must not own mission truth, platform truth, or visual judgment truth.

### 主题

启动只打开总司令页面

### 法条

Startup may open the Commander Console URL after the Commander Console shell probe passes, but Commander Console remains the only owner of human command entry and console read models.

Required direction:
- startup may open only the Commander Console local URL.
- startup remains shell-neutral and must not require Facebook/TikTok platform choice during bootstrap.
- startup may surface missionRuntimeAvailable and failureReason, but it must not manufacture mission context.
- mission platform truth begins only when a governed mission command is created.

### 禁止

FORBIDDEN:
- startup owning human command truth.
- startup owning mission state truth.
- startup owning evidence truth.
- startup reconstructing requestedPlatform, retired selection, taskTemplate, or retired chain truth.
- startup doing page semantics, target semantics, or product semantics.

## Law GRASSEYE-STARTUP-ENTRYPOINT-004-V2

status: active
tier: P0
capabilityDomain: commander-console-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: terminal structured logs are display channel only and must show bootstrap readiness truth without becoming a second record system.

### 主题

终端结构化日志只显示不记账

### 法条

Startup must emit terminal structured startup and runtime summaries as a display channel only.

Required direction:
- terminal logs must report startup phase, component, eventType, status, message, refs, durationMs, and failureReason when present.
- startup may relay runtime event summaries from governed read endpoints only.
- Forensics Persistence remains the record owner.
- Structured Logging remains the schema and discipline owner.

### 禁止

FORBIDDEN:
- terminal logs being treated as the evidence store.
- terminal logs replacing Forensics Persistence.
- terminal logs hiding hard failures as warnings or exit code 0.
- startup inventing a second runtime truth that cannot be traced to governed logs.

## Final Readiness Gate

The startup-entrypoint law is ready only when all of the following are true:

1. One canonical startup script and one user-facing startup command exist.
2. Startup readiness checks Prompt Contract Registry, MuscleMemoryCatalog, PlatformRegistry, and local AI readiness instead of any retired package chain gate.
3. Startup does not emit retired branch tokens, retired selection choices, retired binding states, or business judgments.
4. Commander Console opens only after governed bootstrap readiness passes.
5. Terminal logs remain display-only and do not replace Forensics or mission truth.
