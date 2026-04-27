---
name: "GrassEye Evidence Packet"
description: "Use when defining the Evidence Packet, forensics handoff, advanced AI handoff boundary, data quality flags, action purpose, or packet schema."
applyTo: ".github/instructions/cursor-rules/modules/module-evidence-packet.instructions.md, docs/法案辅助文件/GrassEye Agent 取证表单与高级AI投喂契约施工图.md, src/types/evidence-packet.ts, src/types/task-run.ts, src/types/platform-action.ts, src/features/local-data/**, scripts/audit/domains/evidence-packet/**, scripts/verify/verify-evidence-packet.mjs"
---

# GrassEye Evidence Packet

Scope: governs the evidence packet, packet export boundary, data quality flags, action purpose, and advanced-AI handoff contract.
Boundary: this module governs what a completed or failed browse round must deliver as structured evidence.
Excludes: browse branching rules, final product analysis, procurement, profitability, ads, and operator business approval.
Authority: this file is authoritative only for the evidence-packet capability domain.

---

## Law GRASSEYE-EVIDENCE-PACKET-001-V1

status: active
tier: P0
capabilityDomain: evidence-packet
enforcementMode: manual-first
evidenceMode: law

summary: product-related rounds must finalize into Evidence Packets, while non-product rounds stay in lightweight browse-ledger records by default.

### 主题

取证包与高级 AI 投喂契约

### 法条

GrassEye must treat the Evidence Packet as the first-class product-related round deliverable for downstream advanced analysis, while keeping ordinary browse rounds lightweight by default.

Required direction:
- Every product-related, operator-marked, review-required, or audit-worthy failed video round must generate an Evidence Packet or explicit failed packet.
- Browse Ledger is the default lightweight record for non-product and ordinary skipped rounds.
- Product_no_high_confidence, duplicate, unstable, and ordinary skipped rounds must finalize into a lightweight Browse Ledger entry by default and must not enter the advanced-AI export set unless explicitly requested.
- Evidence Packet is the only standard handoff material for advanced AI analysis.
- Advanced AI export set must include Evidence Packets by default, not all browse rounds.
- Export summary may include Browse Ledger statistics but must not include non-product screenshots unless explicitly requested.
- Evidence Packet must bind packetId, roundId, videoVisitId, evidenceRefs, actionLogRefs, AI result refs, metrics, comment refs, candidate refs, and nextStep.
- Evidence Packet videoEvidence must support multiFrameEvidenceSetId, sampled frames, contactSheetEvidenceId, samplingStrategy, and validFrameCount.
- Evidence Packet and Browse Ledger must reference structured action logs and runtime event logs.
- Evidence Packet must persist in the governed local persistence schema.
- Evidence Packet stores refs and structured JSON, not raw file blobs.
- Evidence Packet must include dataQualityFlags.
- Action log records must include actionPurpose.
- productPresenceAI must record inputMode, sampledFrameCount, validFrameCount, frameLevelObservations, and aggregateReason.
- Candidate may exist inside the packet only as pending_analysis.
- product_no_high_confidence must not create candidate and must not create full Evidence Packet by default.
- Candidate is an index object inside the packet, not the final commercial conclusion.
- Advanced AI must read roundOutcome, dataQualityFlags, metrics, actionPurpose, comment signals, and evidenceRefs before producing analysis.
- Advanced AI export must not rely on plain logs.
- like or save marker must remain recommendation_tuning_marker and must not be interpreted as purchase intent.
- views or likes must not be interpreted as sales.
- Evidence Packet must remain exportable, deletable, traceable, and free of unnecessary personal identity data.

### 禁止

FORBIDDEN:
- Feeding scattered screenshots, OCR text, or action logs directly into advanced AI as if they were a complete packet.
- Evidence packets without packetId, roundId, or videoVisitId.
- Evidence packets without dataQualityFlags.
- Treating candidate as the final business conclusion.
- Creating full Evidence Packets for every product_no_high_confidence round by default.
- Exporting non-product browse ledger entries to advanced AI as if they were product evidence.
- Polluting advanced AI export set with ordinary skipped rounds.
- Treating browse ledger statistics as product opportunity evidence.
- Treating agent actions, like/save marker, or platform metrics as direct proof of purchase intent or sales.
- Fake evidence packet, fake packet finalization, or fake advanced-AI input.
- Packing unnecessary personal identity information into the evidence packet.

---

## 模块边界声明

This law file does not govern:
- How browse flow decides product_yes, product_no, or uncertain.
- How final higher-level product analysis is performed.