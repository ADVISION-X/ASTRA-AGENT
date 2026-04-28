---
name: "GrassEye Structured Logging"
description: "Use when defining runtime event logs, action logs, live proof logs, log schema, log persistence, and structured runtime proof."
applyTo: ".github/instructions/cursor-rules/modules/module-structured-logging.instructions.md, src/capabilities/forensics-persistence/**, src/lib/local-runtime/**, src/types/structured-log.ts, scripts/audit/domains/forensics-persistence-capability/**"
---

# GrassEye Structured Logging

Scope: governs structured runtime events, structured action logs, log schema, and proof discipline.
Boundary: this module governs logging rules only as a Forensics child sub-contract, not as an independent owner.
Excludes: public persistence ownership, business decisions, browser action implementation, and AI reasoning.
Authority: this file is authoritative only for the forensics-persistence-capability domain as the structured logging child sub-contract.

## Law GRASSEYE-STRUCTURED-LOGGING-001-V1

status: active
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

status: active
tier: P0
capabilityDomain: forensics-persistence-capability
enforcementMode: manual-first
evidenceMode: law

summary: runtime proof must link to Forensics record refs and may not depend on hidden round finalizers.

### 主题

runtime proof 必须回连 Forensics 记录，不得依赖藏在 Forensics 里的 round finalizer。

### 法条

Structured logging payloads must remain traceable to persisted Forensics records through record refs, artifact refs, and debug proof ids.

### 禁止

FORBIDDEN:
- src/capabilities/forensics-persistence/runtime as a logging closure path.
- runtime snapshot writes that do not produce a real runtime_snapshot persisted record.
