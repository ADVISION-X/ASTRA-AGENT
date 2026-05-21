---
name: "GrassEye Local Persistence Schema"
description: "Use when defining local SQLite schema, evidence file store layout, persistence relationships, export set storage, and local data boundaries."
applyTo: ".github/instructions/agent-rules/modules/module-local-persistence-schema.instructions.md, docs/法案辅助文件/GrassEye 本地取证存储结构施工图.md, src/lib/storage/**, src/types/local-persistence.ts, scripts/audit/domains/forensics-persistence-capability/**"
---

# GrassEye Local Persistence Schema

Scope: governs local SQLite schema, evidence file store layout, record relationships, export-set storage, and persistence object boundaries.
Boundary: this module governs schema truth only as a Forensics support sub-contract, not as an independent owner.
Excludes: public write ownership, browser behavior, AI reasoning, and platform action semantics.
Authority: this file is authoritative only for the forensics-persistence-capability domain as the local persistence schema support sub-contract.

## Law GRASSEYE-LOCAL-PERSISTENCE-SCHEMA-001-V1

status: active
tier: P0
capabilityDomain: forensics-persistence-capability
enforcementMode: manual-first
evidenceMode: law

summary: local-persistence-schema is an active Forensics support sub-contract for schema truth, not an execution owner.

### 主题

本地结构化存储边界

### 法条

GrassEye persistence schema defines tables, file-store layout, record relationships, retention fields, export boundaries, and deletion requirements, while Forensics Persistence remains the public writer of schema-backed records.

Required direction:
- Structured records must use local SQLite or an equivalent governed local structured store.
- Large evidence artifacts must use a governed evidence file store with storageRef.
- Browser profiles stay separate from evidence storage.
- The canonical local root remains .grasseye-local and must be gitignored.
- Schema helpers and storage-state definitions must not keep src/features/local-data alive as an owner path.
- If storage-state, record-ref, artifact-ref, or export-set schemas are retained, they must live under Forensics-owned storage-port modules or neutral shared schema files.

### 禁止

FORBIDDEN:
- scattered JSON files as persistence truth.
- cookies, sessions, tokens, or passwords in persistence tables.
- schema helpers acting as public write owners.
- src/features/local-data surviving as the canonical schema home.

---

## Law GRASSEYE-LOCAL-PERSISTENCE-SCHEMA-002-V2

status: active
tier: P0
capabilityDomain: forensics-persistence-capability
enforcementMode: manual-first
evidenceMode: law

summary: schema terms must align to ForensicsRecordEnvelope and artifact refs rather than legacy domain objects.

### 主题

schema 词汇必须围绕 envelope、record ref、artifact ref，而不是旧业务对象。

### 法条

Local persistence schema must model record envelopes, record refs, artifact refs, integrity metadata, export metadata, and deletion relations in Forensics-native terms.

### 禁止

FORBIDDEN:
- Schema sovereignty based on ProductDiscoveryEvidencePacket, LocalAiTaskResult, ActionLog, AgentRound, TaskRun, RuntimeDeliveryState, or ProductOpportunityCandidate.
- runtime_snapshot being modeled as a disguised structured_runtime_event without its own record type.
