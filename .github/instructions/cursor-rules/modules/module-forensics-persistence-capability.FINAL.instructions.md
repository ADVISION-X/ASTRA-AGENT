---
name: "GrassEye Forensics Persistence Capability"
description: "Use when governing the Forensics Persistence Ability Group, append-only evidence ledger, record-envelope write authority, chain-proof persistence, artifact refs, runtime snapshot updates, and storage-port boundaries."
applyTo: ".github/instructions/cursor-rules/modules/module-forensics-persistence-capability.instructions.md, src/capabilities/forensics-persistence/**, scripts/audit/domains/forensics-persistence-capability/**, docs/法案辅助文件/GrassEye Forensics Persistence 取证记账能力组施工图.md"
---

# GrassEye Forensics Persistence Capability FINAL

Scope: governs the independent Forensics Persistence Ability Group, append-only evidence ledger writes, Forensics-native record envelopes, artifact refs, chain proof, record sealing, runtime snapshot persistence, and storage-port boundaries.

Boundary: this module governs only persistence truth. It does not govern screenshot capture, OCR/AI reasoning, page-state truth, orchestration branching, Nerve Bus transport, platform actions, post-action verification truth, or Commander UI review decisions.

Authority: this file is authoritative only for the `forensics-persistence-capability` domain.

Architecture phase: `Static Capability Package Architecture`.

Core doctrine:
- Forensics is the memory, ledger, and archive room.
- Forensics writes facts that have already been governed elsewhere.
- Forensics links records; it does not judge business truth.
- Forensics must preserve chain context: map, step, capability call, prompt, action, verification, decision, parent refs, artifact refs.
- Forensics must be append-only unless a specific record type is governed as replace-by-round/session.
- No proof, no persistence truth.
- No chain refs, no production-ready Forensics record.
- No legacy business type can become Forensics public contract truth.
- No write path outside Forensics may be treated as final evidence truth.
- No active Forensics law without inspector + runner + negative proof.

---

## Global Forensics Baseline

All active Forensics laws in this file are:

```yaml
status: active
tier: P0
capabilityDomain: forensics-persistence-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof
```

Required package:

```txt
src/capabilities/forensics-persistence/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── registry.ts
├── record-id.ts
├── index.ts
├── ports/
├── children/
├── shared/
└── no runtime/
```

Required enforcement:

```txt
scripts/audit/domains/forensics-persistence-capability/
├── manifest.json
├── inspector.ts
├── run-inspector.ts
└── negative-proof-harness.ts
```

Forbidden:
- `manual-first` as active enforcement for this domain.
- `evidenceMode: law` as sufficient evidence.
- verify scripts as release truth.
- detached inspector.
- warning-only P0.
- generated fake PASS.
- negative-proof missing or empty.

---

## Law GRASSEYE-FORENSICS-PERSISTENCE-001-V2

status: active  
tier: P0  
capabilityDomain: forensics-persistence-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: Forensics Persistence is the only final evidence-ledger owner and must not be bypassed by local-data, runtime, workbench, Commander, AI, or action abilities.

### 主题

取证记账主权唯一

### 法条

Forensics Persistence is the only governed owner of final evidence-ledger writes, AI-result record persistence, structured runtime/action log persistence, browse-ledger entry finalization, evidence-packet sealing, failed-record sealing, runtime-snapshot persistence, artifact refs, and record-ref generation.

Required direction:
- Public root: `src/capabilities/forensics-persistence`.
- All final Forensics writes must enter through the Forensics public contract.
- Forensics public contract must be Forensics-native.
- Local runtime, workbench, structured log emitters, action abilities, AI, Commander, and Orchestration must not own final persistence truth.
- Any old store may exist only as an external composition-root adapter to `ForensicsStoragePort`, not as public persistence owner.
- `src/features/local-data` must not survive as active owner of evidence packet, browse ledger, AI result, failed record, runtime snapshot, operator snapshot, or candidate persistence truth.

### 禁止

FORBIDDEN:
- Direct final writes outside Forensics.
- Treating Forensics as a helper hidden in `src/features/local-data`.
- Treating terminal logs as persistence truth.
- Treating BrowserController/action abilities as final action-log writers.
- Treating AI results as persisted truth without Forensics envelope.
- Commander importing storage internals.
- Runtime/Workbench bypassing Forensics public contract.
- Old store APIs on Forensics public surface: `resetLocalStore`, `getOperatorSnapshot`, `setCandidateDisposition`, `deleteCandidate`, `saveCandidate`, `rebuildAdvancedAiExportSet`.

Required inspector:
- Import graph check for forbidden external writes.
- Public export check.
- Forbidden old API check.
- Storage-port boundary check.
- Runner coverage.

Required negative proof:
- Add direct `saveEvidencePacket` outside Forensics → FAIL.
- Add Commander import of Forensics storage internals → FAIL.
- Add `resetLocalStore` to Forensics public surface → FAIL.

---

## Law GRASSEYE-FORENSICS-PERSISTENCE-002-V2

status: active  
tier: P0  
capabilityDomain: forensics-persistence-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: child abilities must be persistence behaviors and every child must write exactly one governed Forensics record type.

### 主题

子能力按写账行为治理

### 法条

Forensics child capabilities are persistence behaviors, not business domains.

Active children:

| childCapabilityId | recordType | operation |
|---|---|---|
| write-structured-runtime-event | structured_runtime_event | append-record |
| write-structured-action-log | structured_action_log | append-record |
| write-evidence-record | evidence_record | append-record |
| write-ai-result-record | ai_result_record | append-record |
| finalize-browse-ledger | browse_ledger_entry | append-record or replace-by-round if lawfully configured |
| finalize-evidence-packet | evidence_packet | append-record or replace-by-round if lawfully configured |
| finalize-failed-record | failed_record | append-record or replace-by-round if lawfully configured |
| update-runtime-snapshot | runtime_snapshot | update-runtime-snapshot |

Required direction:
- Registry is the single child truth.
- Each child must bind one recordType.
- Each child must call the unified Forensics executor.
- Child implementation must not own write logic directly.
- Child payload schema must be Forensics-native cleaned payload schema.
- External modules must not import `children/**`.

### 禁止

FORBIDDEN:
- Platform/business-domain child ids.
- Child ids based on deleted historical owners.
- Children returning fake persisted result.
- Children writing directly to storage.
- External import of `children/**`.
- `capability-check.ts` or `verify-*` under Forensics root.

Required inspector:
- Registry-child folder parity.
- Child recordType parity.
- External child import ban.
- Child implementation uses unified executor.

Required negative proof:
- Add external import of child implementation → FAIL.
- Add child not in registry → FAIL.
- Add child with mismatched recordType → FAIL.

---

## Law GRASSEYE-FORENSICS-PERSISTENCE-003-V2

status: active  
tier: P0  
capabilityDomain: forensics-persistence-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: Forensics writes and links records only; it must not reason, verify, decide, act, or reconstruct business truth.

### 主题

只写账，不判断，不动作

### 法条

Forensics may validate envelopes, check refs, write artifacts, write records, seal records, link parent refs, compute integrity hashes, and return record refs. It may not analyze content, decide next action, evaluate page state, verify post-action truth, reason about AI output, reconstruct product opportunity candidates, or mutate runtime delivery truth.

Allowed:
- Envelope validation.
- Parent/artifact/source ref validation.
- Integrity hashing.
- Record envelope write.
- Runtime snapshot write.
- Artifact ref write.
- Append/replace policy execution.
- Generic read/list by Forensics storage port if public contract allows read model support.

Forbidden:
- AI reasoning.
- OCR reasoning.
- Page-state reasoning.
- Post-action verification.
- Screenshot capture.
- Click/scroll/input/open.
- Product yes/no judgement.
- Candidate construction.
- RuntimeDeliveryState mutation.
- AgentRound mutation.
- Business finalizer logic.
- Hidden recomputation of business truth while sealing records.

Required inspector:
- Forbidden import graph: AI impl, browser/action impl, screenshot/open/mouse/text/page-state/orchestration impl.
- Forbidden symbol check: business-decision functions, candidate builders, runtime state mutators.
- Record payload plain-envelope check.

Required negative proof:
- Add AI reasoning function to Forensics → FAIL.
- Add browser action import → FAIL.
- Add ProductOpportunityCandidate construction → FAIL.

---

## Law GRASSEYE-FORENSICS-PERSISTENCE-004-V2

status: active  
tier: P0  
capabilityDomain: forensics-persistence-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: Forensics public contract must be Forensics-native and must not leak legacy business or runtime type sovereignty.

### 主题

Forensics public contract 原生化

### 法条

Forensics public contract must expose only Forensics-native concepts:

```txt
ForensicsPersistenceAbilityInput
ForensicsPersistenceAbilityResult
ForensicsRecordEnvelope
ForensicsRecordRef
ForensicsArtifactRef
ForensicsRecordType
ForensicsPersistencePolicy
ForensicsIntegrityPolicy
ForensicsFailure
ForensicsRuntimeProof
ForensicsStoragePort
ForensicsArtifactStoragePort
```

Record types:

```txt
structured_runtime_event
structured_action_log
evidence_record
ai_result_record
browse_ledger_entry
evidence_packet
failed_record
runtime_snapshot
```

Payload enters Forensics as cleaned plain payload under a ForensicsRecordEnvelope or child input. Legacy business objects must not become Forensics public truth.

### 禁止

FORBIDDEN public contract imports / exports:
- `../../types/evidence-packet`
- `../../types/local-ai`
- `../../types/platform-action`
- `../../types/task-run`
- `../../types/runtime`
- `../../types/stored-ai-result`
- `ProductDiscoveryEvidencePacket`
- `BrowseLedgerEntry`
- `RoundLifecycleEvent`
- `RoundStructuralLog`
- `LocalAiTaskResult`
- `ActionLog`
- `AgentRound`
- `TaskRun`
- `RuntimeDeliveryState`
- `ProductOpportunityCandidate`

Notes:
- A child may accept a cleaned payload that was derived upstream, but the schema must be Forensics-native and must not import the legacy public type as contract truth.
- If an old type is temporarily unavoidable, it must stay in an external adapter outside the Forensics canonical root and must be reported as remediation debt.

Required inspector:
- Import ban in `contract.ts`, `schema.ts`, `children/**/schema.ts`, `index.ts`.
- Export ban for legacy types.
- Payload schema legacy-type ban.

Required negative proof:
- Import `BrowseLedgerEntrySchema` in child schema → FAIL.
- Import `ActionLogSchema` in write-structured-action-log schema → FAIL.
- Export `ProductDiscoveryEvidencePacket` from contract → FAIL.

---

## Law GRASSEYE-FORENSICS-PERSISTENCE-005-V2

status: active  
tier: P0  
capabilityDomain: forensics-persistence-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: every Forensics record and result must preserve the full execution chain and must be replayable.

### 主题

链路证据完整性

### 法条

Forensics must not only persist "result". It must persist linkable execution chain.

Every Forensics input, record envelope, stored record, result, and runtimeProof must carry or derive:

```txt
missionId
runId
sessionId
roundId or visitId
videoVisitId where available
stepId
mapPackageId
mapPackageVersion
selectedMapId
selectedMapVersion
activationSnapshotRef
capabilityCallId
sourceAbilityGroupId
sourceChildCapabilityId
inputRefs
outputRefs
sourceRecordRefs
parentRefs
artifactRefs
promptContractId if AI record
promptContractVersion if AI record
promptCatalogVersion if AI record
actionRef if action log / action-related record
postActionVerificationRef if action-related record
decisionRef if branch/finalization record
idempotencyKey
recordId
integrityHash
```

Required direction:
- `ForensicsRecordEnvelope` must include chain fields, not only session/round/source ability.
- `ForensicsRuntimeProof` must include chain fields.
- Action records must link to postActionVerificationRef.
- AI records must link to prompt contract refs.
- Map/run records must link to activationSnapshotRef.
- Missing required chain fields must fail or review_required according to policy; must not success.

### 禁止

FORBIDDEN:
- Only writing `recordRef`.
- Record envelope missing `stepId` / `capabilityCallId`.
- AI record missing prompt contract refs.
- Action record missing postActionVerificationRef.
- RuntimeProof and record envelope becoming two different truth chains.
- Generated runId/missionId from unrelated fields as production proof.
- Success without integrityHash.

Required inspector:
- Schema fields existence.
- Result/proof/envelope parity.
- Record-type-specific chain required fields.
- Action record postActionVerificationRef.
- AI record prompt contract refs.
- Activation snapshot ref.

Required negative proof:
- Remove `capabilityCallId` from envelope → FAIL.
- Save AI record without promptContractId → FAIL.
- Save action log without postActionVerificationRef → FAIL.
- Success without integrityHash → FAIL.

---

## Law GRASSEYE-FORENSICS-PERSISTENCE-006-V2

status: active  
tier: P0  
capabilityDomain: forensics-persistence-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: storage must be a generic record-store port and old store ownership must stay outside the canonical Forensics root.

### 主题

通用 record-store port

### 法条

Forensics storage must remain behind generic ports:

```txt
ForensicsStoragePort.writeRecord
ForensicsStoragePort.readRecord
ForensicsStoragePort.listRecords
ForensicsStoragePort.updateRuntimeSnapshot
ForensicsArtifactStoragePort.writeArtifactRef
```

Required direction:
- Child capabilities write `ForensicsRecordEnvelope` values.
- Storage ports return `ForensicsRecordRef`, `storageRef`, `artifactRefs`, and failure info.
- Old store adapters may be injected from composition root only.
- Old store adapters must not become Forensics public contract truth.
- `src/capabilities/forensics-persistence/shared/store` is forbidden.
- `src/capabilities/forensics-persistence/runtime` is forbidden unless explicitly converted to non-runtime internal helper by law; current phase forbids it.

### 禁止

FORBIDDEN:
- `EvidenceStoreService` as Forensics public owner.
- `saveAiResult(LocalAiTaskResult)`.
- `saveActionLog(ActionLog)`.
- `saveEvidencePacket(ProductDiscoveryEvidencePacket)`.
- `saveAgentRound(AgentRound)`.
- `saveCandidate(ProductOpportunityCandidate)`.
- `rebuildAdvancedAiExportSet`.
- `resetLocalStore`.
- `getOperatorSnapshot`.
- `setCandidateDisposition`.
- `deleteCandidate`.
- `src/capabilities/forensics-persistence/runtime`.
- `src/capabilities/forensics-persistence/shared/store`.

Required inspector:
- Forbidden directory check.
- Storage port shape check.
- Forbidden storage API symbol check.
- Old store adapter boundary check.

Required negative proof:
- Add `runtime/` under Forensics → FAIL.
- Add `shared/store` → FAIL.
- Add `saveAiResult(LocalAiTaskResult)` → FAIL.

---

## Law GRASSEYE-FORENSICS-PERSISTENCE-007-V2

status: active  
tier: P0  
capabilityDomain: forensics-persistence-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: Forensics writes must be policy-gated, integrity-gated, idempotent, and append-safe.

### 主题

写账门禁与幂等

### 法条

Every Forensics write must pass:

```txt
input schema gate
→ record type gate
→ persistence policy gate
→ integrity policy gate
→ idempotency gate
→ artifact write gate
→ storage write gate
→ output schema gate
→ proof builder
→ result builder
```

Required:
- Every write has idempotencyKey.
- Append writes must be append-only.
- Replace writes must be explicit and limited to governed modes.
- Runtime snapshot update must use `update-runtime-snapshot` storage operation.
- Integrity gate must validate required parent refs / source refs / artifact refs / storage refs.
- Artifact write failure must obey `onArtifactWriteFailure`.
- Policy/integrity decisions must appear in result and runtimeProof.
- Unknown child failure must produce proof.

Forbidden:
- Silent overwrite.
- Success after failed artifact write when policy says failed.
- Success without idempotencyKey.
- `record: unknown`.
- `status: persisted` as sole outcome.
- `debugLogRef` hardcoded to null as proof substitute.
- `runtimeProof: null`.

Required inspector:
- Pipeline call order.
- Policy/integrity/idempotency/proof presence.
- No fake persisted result.
- Unknown child proof.

Required negative proof:
- Remove idempotencyKey → FAIL.
- Artifact write fails but result success → FAIL.
- Unknown child without proof → FAIL.

---

## Law GRASSEYE-FORENSICS-PERSISTENCE-008-V2

status: active  
tier: P0  
capabilityDomain: forensics-persistence-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: Forensics enforcement must be AST/symbol/import-graph based and connected to runner and negative proof.

### 主题

Forensics 执法唯一入口

### 法条

Forensics enforcement must close through:

```txt
scripts/audit/domains/forensics-persistence-capability/manifest.json
scripts/audit/domains/forensics-persistence-capability/inspector.ts
scripts/audit/domains/forensics-persistence-capability/run-inspector.ts
scripts/audit/domains/forensics-persistence-capability/negative-proof-harness.ts
```

Required:
- Inspector must be ts-morph AST level.
- Inspector must include symbol and import-graph checks.
- Inspector must include schema-level checks for record envelope/proof/result.
- Inspector must include anti-escape checks.
- Inspector must verify active law coverage in registry/matrix/audit-plan/runner.
- Negative proof must run and report fail → rollback → pass.
- CI-FULL must be green for delivery.

Forbidden:
- verify scripts as release truth.
- grep/regex/includes as final judgment.
- warning-only P0.
- detached inspector.
- empty negative proof.
- generated fake PASS.
- capability-check.ts under Forensics root.

Required negative proof:
- Remove inspector from runner → FAIL.
- Convert P0 to warning-only → FAIL.
- Use regex-only final check → FAIL.
- Add `capability-check.ts` → FAIL.

---

## Required Enforcement Checklist

The inspector must check:

```txt
1. Public root exists.
2. No runtime/ directory.
3. No shared/store directory.
4. Public contract exports only Forensics-native concepts.
5. No legacy business type imports in contract/schema/children schema/index.
6. Child registry matches active child folders.
7. Child implementations use unified executor.
8. External modules do not import children/**.
9. No forbidden imports: AI impl, screenshot/open/mouse/text/page-state/browser/orchestration impl.
10. No business decision symbols.
11. No old store APIs.
12. Record envelope has full chain fields.
13. Runtime proof has full chain fields.
14. Result/proof/envelope parity.
15. AI record requires promptContractId/version/catalogVersion.
16. Action log requires actionRef and postActionVerificationRef.
17. ActivationSnapshotRef exists where required.
18. IntegrityHash exists on success.
19. Policy/integrity/idempotency gates are used.
20. Unknown child result has proof.
21. No runtimeProof:null.
22. All active Forensics laws are in registry/matrix/audit-plan/runner.
23. negative-proof-harness is executed.
```

---

## Required Negative Proof

The Forensics negative proof must fail → rollback → pass for:

```txt
add runtime/ directory
add shared/store directory
import BrowseLedgerEntrySchema in child schema
import ActionLogSchema in child schema
import LocalAiTaskResult in contract
export ProductDiscoveryEvidencePacket
add saveAiResult(LocalAiTaskResult)
add resetLocalStore
add getOperatorSnapshot
add ProductOpportunityCandidate construction
save AI record without promptContractId
save action log without postActionVerificationRef
remove capabilityCallId from envelope
remove activationSnapshotRef from proof
remove integrityHash from success
return status:persisted
return record:unknown
return runtimeProof:null
external import of children implementation
add capability-check.ts
remove negative proof invocation
turn P0 into warning-only
```

---

## Final Readiness Gate

Forensics Persistence is READY only when:

```txt
law/blueprint/inspector/generated/runner agree
all active Forensics laws are machine-blocking
Forensics public contract is Forensics-native
no legacy business type leaks into public or child schemas
no runtime/ or shared/store in canonical root
record envelope and runtimeProof preserve full chain
AI record prompt refs enforced
action log postActionVerificationRef enforced
storage port generic and adapter-only
policy/integrity/idempotency/proof gates pass
owner-local inspector PASS
negative proof PASS
ALL active law enforcement PASS
CI-FULL PASS
```
