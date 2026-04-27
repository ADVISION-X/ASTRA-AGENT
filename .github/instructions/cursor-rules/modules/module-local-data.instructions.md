---
name: "GrassEye Local Data"
description: "Use when defining local-first evidence storage, data relationships, retention, deduplication, deletion, or export boundaries."
applyTo: ".github/instructions/cursor-rules/modules/module-local-data.instructions.md, src/features/local-data/**, src/lib/storage/**"
---

# GrassEye Local Data

Scope: governs local-first evidence records, retention boundaries, and traceable deletion.
Boundary: this module governs data relationships and lifecycle, not browser behavior or scoring logic.
Excludes: platform action rules, model behavior, UI presentation, and remote data pipelines.
Authority: this file is authoritative only for the local-data capability domain.

---

## Law GRASSEYE-LOCAL-DATA-001-V1

status: active
tier: P0
capabilityDomain: local-data
enforcementMode: manual-first
evidenceMode: law

summary: phase-one data stays local-first, minimal, deduplicated, traceable, and deletable.

### 主题

本地优先与证据可追溯

### 法条

Local data must preserve the relationship between raw evidence, extracted text, AI judgment, action logs, and product opportunity records without widening storage scope.

Required direction:
- Store only the minimum evidence needed to explain and review a product opportunity.
- Local evidence storage must remain tied to the local workbench and support review, deletion, retention, and export without requiring SaaS storage.
- Local Data must follow the Local Persistence Schema.
- Keep raw screenshots, OCR text, AI results, action logs, and product records traceably linked.
- Evidence storage root is .grasseye-local by default.
- Structured records belong in the governed local structured store.
- Evidence files belong in the governed evidence file store.
- Local Data owns persistence of structured logs or delegates to a governed structured log store.
- Evidence Packet must exist as the upper index object that binds screenshots, OCR, AI results, action logs, metrics, comment refs, and candidate refs into one exportable packet.
- MultiFrameVideoEvidenceSet must be the upper index object for first-question video evidence whenever product-presence sampling spans multiple frames.
- Local Data must distinguish lightweight Browse Ledger entries from full Evidence Packets.
- Structured logs must be exportable, queryable by sessionId / roundId / videoVisitId, and deletable under retention rules.
- Non-product browse entries must not widen evidence storage by default.
- Full screenshots and comments should not be stored for product_no_high_confidence by default unless needed for review.
- product_no browse entries should keep lightweight hashes, summaries, and frame availability records by default rather than long-term full multi-frame storage.
- Deduplicate repeat observations so one video does not spawn multiple primary records.
- Data must support deletion, bounded retention, and explicit export boundaries.
- Local Data must not invent ad hoc persistence paths.

### 禁止

FORBIDDEN:
- Saving unnecessary full-screen captures or unnecessary personal data.
- Infinite accumulation without retention or cleanup boundaries.
- Treating remote storage as the default phase-one evidence store.
- Writing conclusions that cannot be traced back to evidence.
- Treating temporary cache output as final truth.

---

## 模块边界声明

This law file does not govern:
- Which platform action should happen next.
- Whether a signal is commercially approved.