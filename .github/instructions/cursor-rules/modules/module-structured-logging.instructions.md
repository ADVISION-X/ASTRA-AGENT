---
name: "GrassEye Structured Logging"
description: "Use when defining runtime event logs, action logs, live proof logs, log schema, log persistence, and structured owner evidence."
applyTo: ".github/instructions/cursor-rules/modules/module-structured-logging.instructions.md, src/capabilities/forensics-persistence/**, src/lib/local-runtime/**, src/types/structured-log.ts, scripts/audit/domains/forensics-persistence-capability/**"
---

# GrassEye Structured Logging

Scope: governs structured runtime events, structured action logs, log schema, and proof discipline.
Boundary: this module governs logging rules only as a Forensics child sub-contract, not as an independent owner.
Excludes: public persistence ownership, business decisions, browser action implementation, and AI reasoning.
Authority: this file is authoritative only for the forensics-persistence-capability domain as the structured logging child sub-contract.

## Law GRASSEYE-STRUCTURED-LOGGING-001-V1

status: retired
tier: P0
capabilityDomain: forensics-persistence-capability
enforcementMode: manual-first
evidenceMode: law

summary: structured-logging is a Forensics child sub-contract for log discipline, not an active owner.

### 主题

结构化日志纪律

### 法条

GrassEye runtime and action proof must use structured log schemas that are traceable to ability-group execution, while Forensics Persistence remains the public writer of those records.

Required direction:
- StructuredRuntimeEvent and StructuredActionLog must carry abilityGroupId, childAbilityId when applicable, sessionId, roundId, videoVisitId when applicable, status, reason, refs, and timestamps.
- runtime code may emit structured payloads, but persisted log truth flows through Forensics Persistence.
- Legacy src/features/local-data references may survive only as forbidden drift markers or migration notes; active storage paths must be Forensics-owned or neutral infrastructure.
- structured logs must remain exportable, queryable, and deletion-aware.
- startup-entrypoint may display terminal summaries derived from governed structured logs, but terminal display is not persisted log truth.

### 禁止

FORBIDDEN:
- console output or free-text reports acting as runtime truth.
- structured-logging becoming a second persistence owner.
- verify scripts or ad-hoc quality scripts acting as logging enforcement truth.
- startup terminal relay becoming a replacement for structured log records.

---

## Law GRASSEYE-STRUCTURED-LOGGING-002-V2

status: retired
tier: P0
capabilityDomain: forensics-persistence-capability
enforcementMode: manual-first
evidenceMode: law

summary: owner evidence must link to Forensics record refs and may not depend on hidden round finalizers.

### 主题

owner evidence 必须回连 Forensics 记录，不得依赖藏在 Forensics 里的 round finalizer。

### 法条

Structured logging payloads must remain traceable to persisted Forensics records through record refs, artifact refs, and debug proof ids.

Required clarification:
- legitimate Forensics internal implementation may exist, but public persisted log truth must be represented through structured Forensics records and refs.

### 禁止

FORBIDDEN:
- hidden round finalizers or hidden runtime finalization paths that create logging truth without public Forensics record refs.
- runtime snapshot writes that do not produce a real runtime_snapshot persisted record.
- Forensics internal runtime helpers becoming an untraceable second finalization path.

---

## Law GRASSEYE-STRUCTURED-LOGGING-003-V1

status: retired
tier: P0
capabilityDomain: forensics-persistence-capability
enforcementMode: manual-first
evidenceMode: law

summary: DEBUG level runtime transparency must expose what was sent, what was received, and why a decision or failure happened.

### 主题

DEBUG 级实战透明化

### 法条

GrassEye runtime must support structured DEBUG events that expose not only that something happened, but what happened, what was sent, what was received, what refs or proofs were involved, and what owner is responsible for the next action.

Required direction:
- StructuredRuntimeEvent must support level: DEBUG, INFO, WARN, and ERROR.
- DEBUG events must be structured payloads, not free text.
- DEBUG events must carry traceId, spanId, eventId, eventType, owner, ownerResponsible when applicable, abilityGroupId when applicable, childAbilityId when applicable, missionId when applicable, roundId when applicable, videoVisitId when applicable, mapId when applicable, stepId when applicable, taskTemplateId when applicable, status, reason, refs, timestamps, and durationMs.
- terminal relay may display DEBUG events, but persisted truth must flow through Forensics Persistence.
- DEBUG payloads must include enough context for root-cause analysis without relying on hidden in-memory state.

### 禁止

FORBIDDEN:
- console.log-only DEBUG.
- promptLength-only AI visibility.
- free-text terminal logs acting as proof.
- DEBUG events without traceId or eventId.
- DEBUG events that omit ownerResponsible when reporting failure.
- terminal relay becoming the source of persisted truth.

---

## Law GRASSEYE-STRUCTURED-LOGGING-004-V1

status: retired
tier: P0
capabilityDomain: forensics-persistence-capability
enforcementMode: manual-first
evidenceMode: law

summary: every AI model request must emit a structured AI_REQUEST_DEBUG event before the model call.

### 主题

AI 投喂内容必须可追踪

### 法条

Before any AI model call, GrassEye must emit a governed AI_REQUEST_DEBUG event.

Required fields:
- provider
- model
- modelRole
- runtime
- taskType
- abilityGroupId
- childAbilityId when applicable
- promptContractId
- promptVersion
- outputSchemaRef
- systemPromptHash
- userPromptHash
- promptDebugRef
- promptFullText by default for governed AI debug records
- promptPreview by default for terminal scanability
- imageRefs
- imagePaths or artifactRefs
- imageHashes
- imageBytes
- imageDimensions
- sourceScreenshotEvidenceId
- aiInputArtifactRef
- tokenEstimate when available
- timeoutMs
- traceId
- spanId
- missionId, roundId, and stepId when applicable

Required direction:
- terminal summaries may show prompt hash, prompt preview, prompt length, image refs, sizes, and model metadata.
- governed debug records must preserve complete system prompt and user prompt in terminal and or debug bundle by default.
- base64 image content must never be printed to terminal.
- secrets, cookies, tokens, and credentials must be redacted before terminal display or persistence.

### 禁止

FORBIDDEN:
- model call before AI_REQUEST_DEBUG.
- logging only promptLength without promptHash and promptDebugRef.
- hiding prompt text with no full-debug path.
- passing arbitrary image path to AI without aiInputArtifactRef for vision tasks.
- AI adapter resizing or compressing images while bypassing Screenshot prepare-ai-input.

---

## Law GRASSEYE-STRUCTURED-LOGGING-005-V1

status: retired
tier: P0
capabilityDomain: forensics-persistence-capability
enforcementMode: manual-first
evidenceMode: law

summary: every AI model response must emit structured raw and normalized debug events before parser output is allowed to hide raw model output.

### 主题

AI 原始回复和解析结果必须可追踪

### 法条

After an AI model returns, GrassEye must emit a governed AI_RAW_RESPONSE_DEBUG event with full rawResponseText before raw output can be discarded, parsed-only, or transformed. If parser code normalizes, repairs, assembles, or fills any model field, GrassEye must then emit AI_NORMALIZED_RESPONSE_DEBUG as a separate event before terminal AI_RESPONSE_DEBUG.

Required fields:
- provider
- model
- modelRole
- rawResponseText by default
- rawResponsePreview for terminal scanability
- rawResponseHash
- rawResponseRef
- parsedJson
- parsedDecision
- parserErrors
- confidence
- dataQualityFlags
- modelDurationMs
- status
- failureReason
- reviewRequiredReason
- traceId

Forbidden:
- gating rawResponseText or promptFullText behind GRASSEYE_DEBUG_AI_IO.
- emitting only normalized parsedJson when raw model text was malformed, partial, or repaired.
- spanId
- missionId, roundId, and stepId when applicable

Required direction:
- raw response must remain available through rawResponseRef or a debug bundle when full terminal output is disabled.
- parser errors must be logged as structured fields.
- parsed output cannot become the only record of model response.

### 禁止

FORBIDDEN:
- parser swallowing raw response.
- raw response unavailable in full debug mode.
- model response logged only as a success or failure summary.
- parsedJson without rawResponseHash.
- AI failure without structured AI_ERROR_DEBUG.

---

## Law GRASSEYE-STRUCTURED-LOGGING-006-V1

status: retired
tier: P0
capabilityDomain: forensics-persistence-capability
enforcementMode: manual-first
evidenceMode: law

summary: AI failures must report exact cause, actual and max values, missing preconditions, owner responsible, and required upstream action.

### 主题

AI 失败必须可行动

### 法条

When an AI request is blocked, rejected, timed out, malformed, over budget, parser-failed, or model-failed, GrassEye must emit AI_ERROR_DEBUG.

Required fields:
- errorKind
- rejectedBy
- limitType when applicable
- actualValue when applicable
- maxAllowedValue when applicable
- missingPrecondition
- upstreamRequiredAction
- ownerResponsible
- actionableMessage
- promptContractId when applicable
- aiInputArtifactRef when applicable
- sourceScreenshotEvidenceId when applicable
- traceId
- spanId
- missionId, roundId, and stepId when applicable
- failureReason
- reviewRequiredReason

Required direction:
- oversized image failures must name the actual image bytes and allowed max bytes.
- missing prepare-ai-input must name Screenshot as ownerResponsible and the Orchestration or map dependency as the required upstream chain.
- AI readiness failures must name Local AI Runtime or AI Capability as ownerResponsible.

### 禁止

FORBIDDEN:
- throwing AI failure before AI_ERROR_DEBUG.
- reporting image-too-large without actualValue and maxAllowedValue.
- reporting AI unavailable without ownerResponsible.
- reporting failure without actionableMessage.
- using terminal text as the only failure record.

---

## Law GRASSEYE-STRUCTURED-LOGGING-007-V1

status: retired
tier: P0
capabilityDomain: forensics-persistence-capability
enforcementMode: manual-first
evidenceMode: law

summary: user command flow must emit structured debug events from UI command receipt through mission preflight acceptance or rejection.

### 主题

用户点击和任务预检必须透明

### 法条

Commander Console command flow must emit structured events showing the full path from user action to mission preflight result.

Required events:
- HUMAN_COMMAND_DRAFTED
- HUMAN_COMMAND_RECEIVED
- HUMAN_COMMAND_VALIDATED
- MISSION_PREFLIGHT_STARTED
- MISSION_PREFLIGHT_PASSED
- MISSION_PREFLIGHT_FAILED
- COMMAND_ACCEPTED
- COMMAND_REJECTED

Required direction:
- clicking Start must never be silent.
- if a command is rejected, the event must include failureReason, ownerResponsible, actionableMessage, and inspect or debug refs.
- Commander Console may display these events, but it does not own persisted log truth.

### 禁止

FORBIDDEN:
- Start button no-op without a backend structured event.
- command rejection without an actionable error.
- UI-only frontend logs as proof.
- silent fallback to a default map or platform.

---

## Law GRASSEYE-STRUCTURED-LOGGING-008-V1

status: retired
tier: P0
capabilityDomain: forensics-persistence-capability
enforcementMode: manual-first
evidenceMode: law

summary: App shell liveness and mission readiness must be logged separately.

### 主题

App 壳健康与任务可运行性必须分层

### 法条

GrassEye must separate AppShellHealth from MissionReadiness in both runtime behavior and structured logging.

Required direction:
- AppShellHealth logs whether the local app shell is alive and reachable.
- MissionReadiness logs whether a selected task can start.
- Local AI unavailable may block mission start but must not be treated as app shell bootstrap failure.
- terminal must clearly display degraded readiness without killing the app shell.
- UI must show actionable readiness failures.

Required events:
- APP_SHELL_HEALTH_CHECK_STARTED
- APP_SHELL_HEALTH_PASSED
- MISSION_READINESS_CHECK_STARTED
- MISSION_READINESS_PASSED
- MISSION_READINESS_DEGRADED
- MISSION_READINESS_FAILED
- LOCAL_AI_READINESS_DEGRADED

### 禁止

FORBIDDEN:
- localAi unreachable causing app_server SIGTERM.
- mission readiness failure reported as app liveness failure.
- UI showing healthy while readiness is blocking.
- readiness failure hidden as a generic warning.

---

## Law GRASSEYE-STRUCTURED-LOGGING-009-V1

status: retired
tier: P0
capabilityDomain: forensics-persistence-capability
enforcementMode: manual-first
evidenceMode: law

summary: service shutdown and unexpected exits must be classified and linked to last runtime events.

### 主题

服务退出必须分类和追责

### 法条

GrassEye startup-entrypoint and local app shell must emit structured service exit events.

Required events:
- SERVICE_SHUTDOWN_REQUESTED
- SERVICE_SHUTDOWN_COMPLETED
- SERVICE_UNEXPECTED_EXIT
- SERVICE_EXIT_CLASSIFICATION

Required fields:
- exitCode
- signal
- pid
- startedAt
- endedAt
- lastRuntimeEventId
- lastCommandEventId
- lastAiEventId
- lastMissionId
- lastRoundId
- lastStepId
- likelyCauseRef
- crashBundleRef when available

### 禁止

FORBIDDEN:
- SIGTERM without structured classification.
- unexpected exit visible only as terminal text.
- service shutdown reason not linked to a prior structured event.
- startup-entrypoint killing app shell for mission readiness degradation.

---

## Enforcement Handoff Requirements

Structured logging enforcement must hand off to audit domains that can check runtime-debug transparency without inventing a second logging owner.

Required domains:
- scripts/audit/domains/structured-logging/
- scripts/audit/domains/runtime-debug-transparency/
- scripts/audit/domains/ai-capability/
- scripts/audit/domains/startup-health-debug-transparency/

Required checks:
- AI_REQUEST_DEBUG before model call.
- AI_RESPONSE_DEBUG after model call.
- AI_ERROR_DEBUG before throw or reject.
- promptHash, promptDebugRef, and full-mode path.
- rawResponseHash, rawResponseRef, and full-mode path.
- image refs, hashes, bytes, and dimensions.
- terminal relay debug support.
- Forensics record refs and debug bundle refs.
- no console.log-only debug.
- no promptLength-only visibility.
- no localAi unreachable app_server SIGTERM.

real-code-inspection requirements:
- promptLength-only logging is non-compliant.
- parser-only persistence that drops raw response is non-compliant.
- terminal relay without Forensics refs is non-compliant.
- full-debug mode that cannot reveal prompt or raw response through a governed path is non-compliant.
