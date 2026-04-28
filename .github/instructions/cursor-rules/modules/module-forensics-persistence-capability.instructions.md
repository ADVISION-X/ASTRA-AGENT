---
name: "GrassEye Forensics Persistence Capability"
description: "Use when defining the independent Forensics Persistence Ability Group, evidence-ledger write authority, runtime snapshot updates, or the storage-port boundary relative to local-data and structured logging."
applyTo: ".github/instructions/cursor-rules/modules/module-forensics-persistence-capability.instructions.md, src/capabilities/forensics-persistence/**, scripts/audit/domains/forensics-persistence-capability/**, docs/法案辅助文件/GrassEye Forensics Persistence 取证记账能力组施工图.md, src/lib/local-runtime/**"
---

# GrassEye Forensics Persistence Capability

Scope: governs the independent Forensics Persistence Ability Group, its child persistence writers, and the storage-port boundary.
Boundary: this module governs only evidence-ledger writing, packet finalization, failed-record finalization, AI-result persistence truth, structured runtime/action log persistence truth, and runtime snapshot persistence.
Excludes: screenshot capture, OCR reasoning, AI reasoning, orchestration decisions, platform actions, and post-action verification truth.
Authority: this file is authoritative only for the forensics-persistence-capability domain.

---

## Law GRASSEYE-FORENSICS-PERSISTENCE-001-V1

status: active
tier: P0
capabilityDomain: forensics-persistence-capability
enforcementMode: manual-first
evidenceMode: law

summary: Forensics Persistence is the only evidence-ledger owner, not a local-data helper.

alias: APEX-FORENSICS-001-V1

### 主题

取证记账主权唯一归 Forensics Persistence

### 法条

Forensics Persistence is an independent GrassEye Ability Group. It is the only governed owner of evidence-ledger writes, AI-result persistence truth, final packet sealing, failed-record sealing, runtime snapshot persistence, structured runtime/action log persistence truth, and operator-snapshot persistence truth.

Required direction:
- The public root is src/capabilities/forensics-persistence.
- Local runtime composition, structured logging emitters, and ability-group callers must not directly own final persistence writes once this group exists.
- Evidence packet, browse ledger, AI result, structured runtime event, structured action log, failed record, runtime snapshot, and operator snapshot truth must flow through the Forensics Persistence public contract.
- src/features/local-data must not survive as an active feature root after migration.
- The Forensics Persistence public contract must expose one group interface and one internal child registry.

### 禁止

FORBIDDEN:
- Treating Forensics Persistence as a helper hidden inside src/features/local-data.
- Letting deleted historical owners or feature modules directly own final Browse Ledger, Evidence Packet, Failed Record, runtime snapshot, or operator-snapshot persistence truth.
- Letting local-data remain the public owner of saveEvidencePacket, saveBrowseLedgerEntry, saveAiResult, saveStructuredRuntimeEvent, saveStructuredActionLog, getOperatorSnapshot, or resetLocalStore.
- Replacing this owner with verify scripts.

---

## Law GRASSEYE-FORENSICS-PERSISTENCE-002-V1

status: active
tier: P0
capabilityDomain: forensics-persistence-capability
enforcementMode: manual-first
evidenceMode: law

summary: Forensics Persistence child abilities are persistence behaviors, not business domains.

alias: APEX-FORENSICS-002-V1

### 主题

子能力按写账行为治理

### 法条

Forensics Persistence child abilities must be organized by persistence behavior.

Required direction:
- Active child capabilities are write-structured-runtime-event, write-structured-action-log, write-evidence-record, write-ai-result-record, finalize-browse-ledger, finalize-evidence-packet, finalize-failed-record, and update-runtime-snapshot.
- Child ids must not be replaced by business-domain names.
- External callers must enter through the group facade and must not import children directly.

### 禁止

FORBIDDEN:
- Child ids based on platform names, page names, or deleted historical owner names.
- External imports of children/**.
- capability-check.ts or verify-* style self-certification under this root.

---

## Law GRASSEYE-FORENSICS-PERSISTENCE-003-V1

status: active
tier: P0
capabilityDomain: forensics-persistence-capability
enforcementMode: manual-first
evidenceMode: law

summary: Forensics Persistence writes and links records; it does not judge or act.

alias: APEX-FORENSICS-003-V1

### 主题

只写账不判断不动作

### 法条

Forensics Persistence may write, replace, seal, and relate governed records. It may not analyze content, decide next actions, capture screenshots, click, scroll, or verify action truth.

Required direction:
- The group receives already-governed payloads and writes them with explicit parent refs, artifact refs, and persistence policy.
- The group may seal Browse Ledger, Evidence Packet, Failed Record, and runtime snapshot outputs.
- The group may expose Commander-facing read-model support only through Commander-specific view ports while keeping record truth under Forensics-controlled state.
- Commander-facing review queue, evidence packet, browse ledger, and failed-record projections must remain read models only; candidate construction and record mutation stay outside Commander Console.
- Storage ports remain internal and replaceable.
- Structured action-log persistence belongs to Forensics Persistence even when the upstream ability group emits actionExecutionRef and runtimeProof.
- Mouse Scroll may emit scrollExecutionRef, primitiveExecutionRefs, and runtimeProof only; Forensics owns the persisted actionLogRef.

### 禁止

FORBIDDEN:
- AI reasoning, OCR reasoning, page-state reasoning, or action verification inside Forensics Persistence.
- Importing screenshot, mouse, open, platform-action, or AI child implementations into this root.
- Hidden recomputation of business truth while sealing records.
- Treating startup terminal logs as a persistence substitute or final evidence writer.
- Commander Console importing Forensics storage internals or raw store maintenance helpers instead of a read-model port or governed command transport.
- Commander Console constructing ProductOpportunityCandidate, mutating review status directly, or treating Forensics record shapes as Commander-owned public contract truth.
- Mouse Click, Mouse Scroll, Open, or BrowserController treating browserActionId as the final Forensics actionLogRef.
- Mouse Scroll writing or faking its own final actionLogRef.

---

## Law GRASSEYE-FORENSICS-PERSISTENCE-004-V1

status: active
tier: P0
capabilityDomain: forensics-persistence-capability
enforcementMode: manual-first
evidenceMode: law

summary: local-data folder identity is retired; only internal storage-port materials may survive under Forensics Persistence.

alias: APEX-FORENSICS-004-V1

### 主题

旧 local-data 物理删除并迁入 Forensics 内部端口

### 法条

The local-data folder identity must be removed. Any useful storage implementation, state schema, artifact persistence, reference builders, retention logic, or export helpers must migrate under src/capabilities/forensics-persistence as internal storage-port material.

Required direction:
- EvidenceStoreService may survive only as a private storage-port implementation under the Forensics Persistence root with no public owner status and no old path.
- Workbench wiring must construct the storage port from Forensics-owned modules and inject it into the Forensics Persistence Ability Group.
- Operator snapshot reads must route through Forensics Persistence or a Commander Console read model fed by Forensics-owned state.
- src/features/local-data must not exist after migration.

### 禁止

FORBIDDEN:
- Reintroducing public evidence-packet or browse-ledger writes directly on EvidenceStoreService.
- Leaving storage state, refs, artifacts, maintenance, or export logic under src/features/local-data.
- Creating bridge, compat, or legacy persistence owners.
- Adding a second persistence stack beside the governed local store.

---

## Law GRASSEYE-FORENSICS-PERSISTENCE-005-V1

status: active
tier: P0
capabilityDomain: forensics-persistence-capability
enforcementMode: manual-first
evidenceMode: law

summary: Forensics Persistence enforcement must use inspector law, not verify scripts.

alias: APEX-FORENSICS-005-V1

### 主题

执法走 inspector 不走 verify

### 法条

Forensics Persistence enforcement must be implemented by a domain inspector under scripts/audit/domains/forensics-persistence-capability.

Required direction:
- The inspector must check required shape, forbidden shape, boundary attack, and anti-escape attack.
- No verify-* script may be introduced for this domain.
- No capability-check.ts file may exist under src/capabilities/forensics-persistence.

### 禁止

FORBIDDEN:
- verify-forensics-persistence-capabilities.ts
- capability-check.ts anywhere under src/capabilities/forensics-persistence
- Using verify scripts as release truth or legal owner proof

---

## Law GRASSEYE-FORENSICS-PERSISTENCE-006-V2

status: active
tier: P0
capabilityDomain: forensics-persistence-capability
enforcementMode: manual-first
evidenceMode: law
alias: APEX-FORENSICS-006-V2

summary: Forensics public contract must be Forensics-native and must not leak legacy type sovereignty.

### 主题

Forensics public contract 只能暴露 Forensics 自己的契约概念。

### 法条

Forensics Persistence public contract must use only Forensics-native record-envelope, record-ref, artifact-ref, policy, failure, and runtime-proof concepts.

Required direction:
- Public contract terms are ForensicsPersistenceAbilityInput, ForensicsPersistenceAbilityResult, ForensicsRecordEnvelope, ForensicsRecordRef, ForensicsArtifactRef, ForensicsRecordType, ForensicsPersistencePolicy, integrityPolicy, failureReason, and runtimeProof.
- Payload enters Forensics as cleaned plain payload under ForensicsRecordEnvelope and not as imported legacy business contract truth.
- Record types are structured_runtime_event, structured_action_log, evidence_record, ai_result_record, browse_ledger_entry, evidence_packet, failed_record, and runtime_snapshot.

### 禁止

FORBIDDEN:
- Importing ../../types/evidence-packet, ../../types/local-ai, ../../types/platform-action, ../../types/task-run, ../../types/runtime, or ProductOpportunityCandidate into src/capabilities/forensics-persistence/contract.ts.
- Exposing ProductDiscoveryEvidencePacket, BrowseLedgerEntry, RoundLifecycleEvent, RoundStructuralLog, LocalAiTaskResult, ActionLog, AgentRound, TaskRun, RuntimeDeliveryState, or ProductOpportunityCandidate as Forensics public contract truth.

---

## Law GRASSEYE-FORENSICS-PERSISTENCE-007-V2

status: active
tier: P0
capabilityDomain: forensics-persistence-capability
enforcementMode: manual-first
evidenceMode: law
alias: APEX-FORENSICS-007-V2

summary: Forensics storage port must be a generic record store and old store ownership must stay outside the canonical root.

### 主题

storage port 只能是通用 record store，不得把旧 store 整体搬入 Forensics。

### 法条

Forensics storage must remain behind a generic record-store port. Any temporary adapter from an old store must stay outside the Forensics canonical root.

Required direction:
- ForensicsStoragePort must revolve around writeRecord, readRecord, listRecords, writeArtifactRef, and updateRuntimeSnapshot or an equivalent generic record-store interface.
- Forensics child capabilities must write ForensicsRecordEnvelope values and return recordRef, storageRef, failureReason, debugLogRef, and runtimeProof.
- local-data may supply an adapter only through the composition root.

### 禁止

FORBIDDEN:
- src/capabilities/forensics-persistence/shared/store.
- EvidenceStoreService as a Forensics-owned public owner.
- saveAiResult(LocalAiTaskResult), saveActionLog(ActionLog), saveEvidencePacket(ProductDiscoveryEvidencePacket), saveAgentRound(AgentRound), saveCandidate(ProductOpportunityCandidate), rebuildAdvancedAiExportSet, resetLocalStore, getOperatorSnapshot, setCandidateDisposition, or deleteCandidate on the Forensics public surface.

---

## Law GRASSEYE-FORENSICS-PERSISTENCE-008-V2

status: active
tier: P0
capabilityDomain: forensics-persistence-capability
enforcementMode: manual-first
evidenceMode: law
alias: APEX-FORENSICS-008-V2

summary: Forensics must write envelopes only and may not host round finalizers or legacy runtime closures.

### 主题

Forensics 只写 envelope，不得收留 runtime finalizer。

### 法条

Forensics may persist records, validate refs, and seal packets only. It may not host orchestration round finalizers, RuntimeDeliveryState mutation logic, or business-judgment reconstruction.

Required direction:
- finalize-browse-ledger writes browse_ledger_entry envelope only.
- finalize-evidence-packet writes evidence_packet envelope only.
- finalize-failed-record writes failed_record envelope only.
- update-runtime-snapshot writes runtime_snapshot envelope only.
- record ids must be created by Forensics policy or accepted as lawful upstream ids with explicit source metadata.

### 禁止

FORBIDDEN:
- src/capabilities/forensics-persistence/runtime.
- Guessing record ids from unknown record keys.
- Returning record: unknown, status: persisted as the only outcome, or debugLogRef hardcoded to null.
- AI reasoning, page-state reasoning, round decision logic, ProductOpportunityCandidate construction, AgentRound mutation, or RuntimeDeliveryState mutation inside Forensics.