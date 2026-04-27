---
name: "GrassEye Structured Logging"
description: "Use when defining runtime event logs, action logs, live proof logs, log schema, log persistence, and structured runtime proof."
applyTo: ".github/instructions/cursor-rules/modules/module-structured-logging.instructions.md, src/features/agent/**, src/features/local-data/**, src/lib/local-runtime/**, src/types/structured-log.ts, scripts/audit/domains/structured-logging/**, scripts/verify/verify-structured-logging.mjs"
---

# GrassEye Structured Logging

Scope: governs structured runtime events, structured action logs, live proof logs, log schema, log persistence, and runtime proof.
Boundary: this module governs logging truth only.
Excludes: product analysis, AI reasoning, browser action implementation, OCR extraction, and final business decisions.
Authority: this file is authoritative only for the structured-logging capability domain.

## Law GRASSEYE-STRUCTURED-LOGGING-001-V1

status: active
tier: P0
capabilityDomain: structured-logging
enforcementMode: manual-first
evidenceMode: law

summary: Agent runtime truth must be proven by structured logs, not console output, natural-language reports, or fake PASS claims.

### 主题

结构化运行日志与执行证明

### 法条

GrassEye Agent must emit structured runtime events and structured action logs for every governed browse-round step and platform action.

Required direction:
- Every governed Agent step must emit a StructuredRuntimeEvent.
- Every governed platform or runtime action must emit a StructuredActionLog.
- Structured logs must carry sessionId, roundId, videoVisitId when applicable.
- Structured logs must carry step, actionType, actionPurpose, status, reason, createdAt, and refs.
- Failed logs must include failureReason.
- Review logs must include reviewRequiredReason.
- Evidence-related logs must include evidenceRefs or explicit unavailable reason.
- Visual action logs must include visualTargetId, targetType, boundingBox, confidence, geometryStatus, beforeEvidenceId, afterEvidenceId, and verificationResult.
- Structured logs may include browserProfileRef and loginState.
- Structured logs persist in structured_runtime_events and structured_action_logs or equivalent governed tables.
- Packet / ledger finalization must be traceable through structured logs.
- scroll_next_video must be proven by structured logs before the next round starts.
- Runtime snapshot may summarize structured logs but must not replace them.
- Live proof must be derived from structured logs.
- Console output is not persistence truth.

### 禁止

FORBIDDEN:
- console.log as runtime truth.
- Plain text logs as acceptance proof.
- Fake structured logs.
- Success logs written before actions actually complete.
- Action success logs without result proof.
- Action logs without actionPurpose.
- Round logs without roundId.
- Video-round logs without videoVisitId.
- Failed logs without failureReason.
- review_required logs without reviewRequiredReason.
- Raw cookie, session, or token values inside structured logs.
- Replacing runtime structured logs with audit reports.
- Claiming live PASS without structured log sequence proof.

## 模块边界声明

This law file does not govern:
- Product analysis conclusions.
- Browser action implementation details.
- OCR extraction or AI reasoning internals.