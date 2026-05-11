---
name: "GrassEye Runtime Log Spine"
description: "Use when defining runtime event logs, action logs, live proof logs, log schema, log persistence, and structured owner evidence."
applyTo: ".github/instructions/cursor-rules/modules/module-structured-logging.instructions.md, src/lib/runtime-logs/**, src/capabilities/ai/runtime/model-call.ts, src/capabilities/ai/children/visual-mission-judge-once.ts, src/lib/local-ai/call-local-model.ts, scripts/audit/domains/runtime-logging/**"
---

# GrassEye Runtime Log Spine

Scope: governs the single structured runtime event spine for the entire GrassEye system.
Boundary: this module is a neutral observation spine, NOT a capability group, NOT a persistence owner, NOT an event bus, NOT a dashboard, NOT a metrics system.
Authority: this file is the sole authoritative law for structured runtime logging. No parallel logging law may exist.

---

## Law GRASSEYE-RUNTIME-LOG-SPINE-001-V1

status: active
tier: P0
capabilityDomain: runtime-logging
enforcementMode: automated
evidenceMode: law

summary: Runtime Log Spine is a neutral observation spine, not an owner.

### 主题

日志系统不是 owner

### 法条

Runtime Log Spine (src/lib/runtime-logs/) exists as a neutral, transparent observation channel.

Required:
- Runtime Log Spine must NOT import capability group internals, browser controllers, Forensics persistence write paths, or Orchestration state.
- Runtime Log Spine must NOT execute platform actions, write business data, or make AI decisions.
- Runtime Log Spine must NOT become a second persistence owner.
- Every module must receive runtimeLogger as an injected dependency, not import a global singleton directly.
- Forensics long-term persistence of log records is achieved only by calling forensics-persistence append-record, not by the logger itself.

### 禁止

FORBIDDEN:
- logger importing forensics-persistence private write paths.
- logger importing Orchestration mission state directly.
- logger making browser or platform calls.
- logger becoming a capability group with its own ability contract.
- logger acting as an event bus or metrics aggregator.

---

## Law GRASSEYE-RUNTIME-LOG-SPINE-002-V1

status: active
tier: P0
capabilityDomain: runtime-logging
enforcementMode: automated
evidenceMode: law

summary: FLOW / DEBUG / TRACE three-tier mode must exist and be runtime-switchable.

### 主题

三档模式

### 法条

The Runtime Log Spine must support exactly three visibility modes:

- FLOW: default production mode. Shows only mission lifecycle backbone events. Must be readable without scrolling noise.
- DEBUG: shows FLOW events plus AI four-piece events, capability boundary events, geometry proof, browser action, forensics record append.
- TRACE: shows all events including full prompt refs, raw response refs, duration breakdown, all owner boundaries.

Required:
- FLOW is the default when GRASSEYE_LOG_MODE env var is unset.
- DEBUG is activated by GRASSEYE_LOG_MODE=DEBUG.
- TRACE is activated by GRASSEYE_LOG_MODE=TRACE.
- Mode must be runtime-configurable without code changes.
- Every RuntimeLogEvent must declare modeVisibility: Array<"FLOW" | "DEBUG" | "TRACE">.

### 禁止

FORBIDDEN:
- Hardcoding TRACE or DEBUG mode in production startup.
- Hiding mode config behind a code change requirement.
- Emitting events with no modeVisibility field.

---

## Law GRASSEYE-RUNTIME-LOG-SPINE-003-V1

status: active
tier: P0
capabilityDomain: runtime-logging
enforcementMode: automated
evidenceMode: law

summary: AI I/O must be fully transparent through AI four-piece structured events.

### 主题

AI 四件套必须透明

### 法条

Every AI model invocation must emit four governed structured events in order:

1. AI_REQUEST_DEBUG — emitted before callLocalModel is invoked.
   Required fields: promptHash, promptPreview, modelName, runtimeName, imagePaths/refs, promptLength, timeoutMs, traceId, spanId, missionId when applicable.

2. AI_RAW_RESPONSE_DEBUG — emitted immediately after model returns, before any parsing.
   Required fields: rawOutputHash, rawResponsePreview, durationMs, status.

3. AI_PARSE_RESULT_DEBUG — emitted after JSON/schema parsing.
   Required fields: schemaStatus, parserErrors, actionCount, schemaIssueCount, durationMs.

4. AI_ERROR_DEBUG — emitted before any AI failure is thrown or returned to caller.
   Required fields: errorKind/reason, failureReason, ownerResponsible, actionableMessage.

Required:
- AI_REQUEST_DEBUG must precede any callLocalModel call.
- AI_RAW_RESPONSE_DEBUG must be emitted before raw response text can be discarded.
- AI_PARSE_RESULT_DEBUG must be emitted after every parse attempt, success or failure.
- AI_ERROR_DEBUG must be emitted before every AI failure path exits.

### 禁止

FORBIDDEN:
- Model call before AI_REQUEST_DEBUG.
- Raw response silently discarded before AI_RAW_RESPONSE_DEBUG.
- Parse result not reported via AI_PARSE_RESULT_DEBUG.
- AI failure path exiting without AI_ERROR_DEBUG.
- Logging only promptLength without promptHash.

---

## Law GRASSEYE-RUNTIME-LOG-SPINE-004-V1

status: active
tier: P0
capabilityDomain: runtime-logging
enforcementMode: automated
evidenceMode: law

summary: Every runtime log event must carry required identity fields and secrets must be redacted.

### 主题

统一结构与 redaction

### 法条

Every RuntimeLogEvent must carry:
- eventId (auto-generated by logger)
- traceId
- eventType (from canonical RuntimeLogEventType enum only)
- owner (from canonical RuntimeLogOwner type only)
- level (debug | info | warn | error)
- createdAt (auto-generated by logger)
- modeVisibility (at least one mode)

Redaction rules:
- Secrets, cookies, tokens, authorization headers, passwords, API keys, session cookies must never appear in terminal or file bundle output.
- Base64 image content must never appear in terminal output.
- Permitted in debug bundles: hash, size, dimensions, artifactRef, file basename, redacted path.
- AI prompts may be stored in file bundle only after redaction of any embedded secrets.

### 禁止

FORBIDDEN:
- Events without eventId, traceId, eventType, owner, or createdAt.
- Inventing a new eventType outside the canonical RuntimeLogEventType enum.
- Secrets or base64 images in terminal output.
- Bypassing redactRuntimeLogPayload before file bundle write.

---

## Law GRASSEYE-RUNTIME-LOG-SPINE-005-V1

status: active
tier: P0
capabilityDomain: runtime-logging
enforcementMode: automated
evidenceMode: law

summary: Terminal relay is display-only. File debug bundle and Forensics refs are governed truth.

### 主题

terminal 不是 truth

### 法条

Terminal sink is for real-time human observation only.

Required:
- Terminal output must never be treated as persisted log truth.
- File debug bundle (JSONL at data/runtime-logs/<missionId>/<runId>.jsonl or tmp/runtime-logs/<runId>.jsonl) is the governed debug record.
- If long-term evidence is needed, Orchestration must hand log refs to Forensics Persistence via the forensics append-record API.
- console.log, console.error, console.warn, and console.debug must not appear in production source files except in src/lib/runtime-logs/sinks.ts (terminal sink) and CLI entrypoints.

### 禁止

FORBIDDEN:
- console.log debug patches in capability groups or runtime modules.
- Terminal relay replacing Forensics log records as mission truth.
- Free-text terminal prints acting as proof of execution.
- Debug log patches left behind after debug sessions.
