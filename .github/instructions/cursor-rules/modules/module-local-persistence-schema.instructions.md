---
name: "GrassEye Local Persistence Schema"
description: "Use when defining local SQLite schema, evidence file store layout, persistence relationships, export set storage, and local data boundaries."
applyTo: ".github/instructions/cursor-rules/modules/module-local-persistence-schema.instructions.md, docs/法案辅助文件/GrassEye 本地取证存储结构施工图.md, src/features/local-data/**, src/lib/storage/**, src/types/local-persistence.ts, scripts/audit/domains/local-persistence-schema/**, scripts/verify/verify-local-persistence-schema.mjs"
---

# GrassEye Local Persistence Schema

Scope: governs local SQLite schema, evidence file store layout, record relationships, export set storage, and persistence boundaries.
Boundary: this module governs where GrassEye records are stored and how local persistence objects relate.
Excludes: browser behavior, AI reasoning, platform action semantics, final product analysis, and Chrome cookie handling.
Authority: this file is authoritative only for the local-persistence-schema capability domain.

## Law GRASSEYE-LOCAL-PERSISTENCE-SCHEMA-001-V1

status: active
tier: P0
capabilityDomain: local-persistence-schema
enforcementMode: manual-first
evidenceMode: law

summary: GrassEye 取证记录必须落入本地结构化存储和证据文件存储，不能散落成不可追溯的临时对象。

### 主题

本地取证存储结构与字段主权

### 法条

GrassEye must persist browse sessions, video rounds, structured runtime events, structured action logs, evidence records, multi-frame evidence sets, AI results, browse ledger entries, evidence packets, candidates, and export sets in a governed local persistence schema.

Required direction:
- Structured records must use local SQLite or equivalent governed local structured store.
- Large evidence artifacts must use governed evidence file store with storageRef in database.
- The canonical local root is .grasseye-local.
- .grasseye-local must be gitignored.
- Evidence Packet must bind screenshots, OCR, AI results, action logs, metrics, comment refs, and candidate refs.
- Browse Ledger must remain lightweight and separate from Evidence Packet.
- product_no_high_confidence must not create full Evidence Packet by default.
- Export sets must include Evidence Packets by default and Browse Ledger summary only.
- Browser profiles must stay separate from evidence storage.
- Persistence schema must support deletion, retention, deduplication, and export.
- Runtime implementation must not treat in-memory objects as persistence truth.

FORBIDDEN:
- Scattered JSON files as canonical persistence truth.
- Temporary memory state as persistence truth.
- Screenshots stored as database BLOB by default.
- Cookies / session / token / passwords in any persistence table.
- Browser profile directories committed to repository.
- Product_no rounds creating full Evidence Packets by default.
- Evidence records without storageRef or hash.
- Action logs without actionPurpose.
- Failed records without failureReason.
- Review records without reviewRequiredReason.