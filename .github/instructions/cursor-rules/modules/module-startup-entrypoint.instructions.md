---
name: "GrassEye Startup Entrypoint"
description: "Use when defining the unique GrassEye startup source, launch-grasseye bootstrap, grasseye:start command, Commander Console opening, terminal structured startup logs, or startup-entrypoint audit ownership."
applyTo: ".github/instructions/cursor-rules/modules/module-startup-entrypoint.instructions.md, scripts/startup/**, scripts/audit/domains/commander-console-capability/**, docs/法案辅助文件/GrassEye 唯一启动入口与终端结构化日志施工图.md, package.json"
---

# GrassEye Startup Entrypoint

Scope: governs the unique local bootstrap source, canonical startup command, Commander Console opening handoff, startup health gating, and terminal structured startup log display.
Boundary: this module governs startup bootstrap only as a Commander Console child sub-contract, not as an independent owner.
Excludes: human command entry, mission execution, command transport, AI task execution, capability-child execution, and record persistence ownership.
Authority: this file is authoritative only for the commander-console-capability domain as the startup bootstrap child sub-contract.

## Law GRASSEYE-STARTUP-ENTRYPOINT-001-V1

status: retired
tier: P0
capabilityDomain: commander-console-capability
enforcementMode: manual-first
evidenceMode: law
alias: APEX-STARTUP-001-V1

summary: startup-entrypoint is the commander-console bootstrap child sub-contract, not an active owner.

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
- startup calling capability children or AI task runtime.
- startup writing final evidence, browse ledger, or packet truth.
- startup invoking scripts/verify or acting as a CI substitute.

## Law GRASSEYE-STARTUP-ENTRYPOINT-002-V1

status: retired
tier: P0
capabilityDomain: commander-console-capability
enforcementMode: manual-first
evidenceMode: law
alias: APEX-STARTUP-002-V1

summary: Startup opens Commander Console but does not own Commander Console truth.

### 主题

启动只打开总司令页面

### 法条

Startup may open the Commander Console URL after the Commander Console shell probe passes, but Commander Console remains the only owner of human command entry and console read models.

Required direction:
- startup may open only the Commander Console local URL.
- Commander Console owns human command entry, review entry, and console read models.
- Local App Shell renders the Commander Console page but does not delegate command truth to startup.

### 禁止

FORBIDDEN:
- startup owning human command truth.
- startup owning mission state truth.
- startup owning evidence truth.
- startup opening deleted historical console routes as active roots.

## Law GRASSEYE-STARTUP-ENTRYPOINT-003-V1

status: retired
tier: P0
capabilityDomain: commander-console-capability
enforcementMode: manual-first
evidenceMode: law
alias: APEX-STARTUP-003-V1

summary: Terminal structured logs are display channel only.

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

## Law GRASSEYE-STARTUP-ENTRYPOINT-004-V1

status: retired
tier: P0
capabilityDomain: commander-console-capability
enforcementMode: manual-first
evidenceMode: law
alias: APEX-STARTUP-004-V1

summary: startup governance is enforced through the commander-console-capability inspector as a child-contract check.

### 主题

启动执法走 audit 不走 verify

### 法条

Startup-entrypoint enforcement must close through its owner inspector and the generated audit runner only.

Required direction:
- startup bootstrap checks are enforced by the commander-console-capability inspector as the startup child-contract checker.
- startup-entrypoint checks must use AST, symbol, or import-graph analysis for decisive boundary checks.
- any startup-specific helper checks remain subordinate evidence for the commander-console-capability inspector rather than a separate owner root.
- startup validation may include controlled manual launch checks, but release truth remains audit plus repository gates.

### 禁止

FORBIDDEN:
- scripts/verify as startup health proof.
- smoke or acceptance scripts acting as startup enforcement truth.
- startup audit falling back to regex-only, grep-only, or includes-only final verdicts.

## Law GRASSEYE-STARTUP-ENTRYPOINT-005-V1

status: active
tier: P0
capabilityDomain: commander-console-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: startup must complete update preflight and local AI readiness gate before mission runtime becomes available.

### 主题

启动前更新检查与本地 AI 就绪门禁

### 法条

GrassEye startup must run one governed bootstrap readiness chain before mission runtime becomes available.

Required startup order:
- dependency_check
- update_preflight_check
- local_ai_runtime_presence_check
- local_ai_model_roster_check
- local_ai_start_or_connect
- local_ai_health_probe
- ai_capability_readiness_gate
- local_app_service_start
- commander_console_open
- mission_runtime_available

Required direction:
- scripts/startup/launch-grasseye.mjs remains the only canonical startup entrypoint.
- startup must run update preflight before local app service start or Commander Console open.
- update preflight must be explicit, structured-logged, and proof-backed.
- startup must obtain local AI readiness only through the governed startup helper and the governed local-ai readiness contract.
- startup must verify required local AI model roles before mission runtime becomes available.
- startup must use typed failureReason values for local AI startup failure:
	- LOCAL_AI_RUNTIME_NOT_FOUND
	- LOCAL_AI_RUNTIME_START_FAILED
	- LOCAL_AI_MODEL_MISSING
	- LOCAL_AI_MODEL_UNHEALTHY
	- LOCAL_AI_READINESS_TIMEOUT
	- UPDATE_PREFLIGHT_FAILED
- Commander Console may open only after the Commander Console shell probe passes.
- mission runtime must remain unavailable when local AI readiness fails.
- startup terminal structured logs must include phase, component, eventType, status, message, refs, durationMs, and failureReason.
- startup must not invoke AI business inference, AI judgement, mission flow, or fake/mock/heuristic AI fallback as success.

### 禁止

FORBIDDEN:
- starting local app service or opening Commander before ai_capability_readiness_gate passes.
- marking mission runtime available while local AI readiness failed.
- silently skipping update preflight or model roster check.
- silently degrading local AI startup into fake success.
- startup directly importing AI runtime internals outside the governed startup helper or readiness contract.
- debug-loop replacing startup as the local AI bootstrap owner.
- scattered local AI startup paths across ability groups or consumers.

Required inspector:
- check startup launch order keeps update preflight and local AI readiness before service start and mission runtime availability.
- check startup reads typed local AI readiness result and fail-closes when readiness fails.
- check startup helper delegates to the governed local AI readiness probe.
- check debug-loop and consumers do not start local AI runtime ad hoc.

Required negative proof:
- move local AI readiness after service start or Commander open -> FAIL.
- remove update_preflight_check -> FAIL.
- remove local_ai_model_roster_check -> FAIL.
- remove fail-closed throw from startup readiness gate -> FAIL.
- bypass the governed local AI readiness probe -> FAIL.
- debug-loop starts local AI runtime directly -> FAIL.