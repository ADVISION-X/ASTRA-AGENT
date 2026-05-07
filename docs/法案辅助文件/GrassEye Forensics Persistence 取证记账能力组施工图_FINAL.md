# GrassEye Forensics Persistence 取证记账能力组施工图 FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-FORENSICS-PERSISTENCE-BLUEPRINT-FINAL
owner: forensics-persistence-capability
documentType: construction-blueprint
lawAuthority: module-forensics-persistence-capability.instructions.md
architecturePhase: Static Capability Package Architecture
status: active
replace:
  - docs/法案辅助文件/GrassEye Forensics Persistence 取证记账能力组施工图.md
mustNotCreate:
  - new lawId
  - new ability group
  - local-data owner
  - runtime finalizer owner
  - storage public owner
```

本施工图是 `module-forensics-persistence-capability.instructions.md` 的建设级落地映射。
本施工图不新增 lawId，不修改冻结法案，不重新分配主权。
若本文档与 Forensics 法案冲突，以 Forensics 法案为最高权威。

---

## 1. 定位

Forensics Persistence 是 GrassEye 的账房、档案室、记忆链。

它只负责：

```txt
写 record envelope
写 artifact refs
关联 parent refs
关联 source refs
生成 record ref
生成 storage ref
计算 integrity hash
执行 persistence policy
执行 integrity policy
finalize browse ledger envelope
finalize evidence packet envelope
finalize failed record envelope
update runtime snapshot envelope
返回 runtimeProof
```

它不负责：

```txt
AI 判断
OCR 判断
页面状态判断
动作后验证
截图
点击
滚动
输入
打开页面
地图分支判断
产品 yes/no 判断
候选构造
运行状态推导
Commander review 决策
```

一句话：

```txt
Forensics 只记发生过的证据，不替任何能力组做判断。
```

---

## 2. 故事链路位置

Forensics 位于链路末端与复盘层：

```txt
Orchestration
→ Nerve Bus
→ Capability Group / AI / Action
→ Post-Action Verification
→ Forensics Persistence
→ Human Review / Replay / Audit
```

Forensics 必须能回答：

```txt
这次记录来自哪个 mission？
来自哪个 map version？
来自哪个 step？
由哪个 capability call 产生？
AI 用了哪个 prompt contract？
动作是否经过 post-action verification？
这个 record 的 parent refs 和 artifact refs 是什么？
这个 record 的 integrity hash 是什么？
```

---

## 3. 标准包结构

目标结构：

```txt
src/capabilities/forensics-persistence/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── registry.ts
├── record-id.ts
├── index.ts
├── ports/
│   ├── forensics-storage-port.ts
│   ├── forensics-artifact-storage-port.ts
│   └── forensics-clock-port.ts
├── shared/
│   ├── forensics-base-schema.ts
│   ├── forensics-envelope-builder.ts
│   ├── forensics-proof-builder.ts
│   ├── forensics-result-builder.ts
│   ├── forensics-executor.ts
│   ├── forensics-policy-gate.ts
│   ├── forensics-integrity-gate.ts
│   ├── forensics-idempotency.ts
│   └── forensics-hash-builder.ts
└── children/
    ├── write-structured-runtime-event/
    ├── write-structured-action-log/
    ├── write-evidence-record/
    ├── write-ai-result-record/
    ├── finalize-browse-ledger/
    ├── finalize-evidence-packet/
    ├── finalize-failed-record/
    └── update-runtime-snapshot/
```

禁止目录：

```txt
src/capabilities/forensics-persistence/runtime/
src/capabilities/forensics-persistence/shared/store/
src/capabilities/forensics-persistence/mock/
```

禁止文件：

```txt
capability-check.ts
verify-*.ts
old round finalizer files
old EvidenceStoreService owner files
legacy normalize functions that import old business types
```

---

## 4. Public Contract

只允许公开 Forensics-native 概念：

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

禁止公开：

```txt
ProductDiscoveryEvidencePacket
BrowseLedgerEntry
RoundStructuralLog
RoundLifecycleEvent
LocalAiTaskResult
ActionLog
AgentRound
TaskRun
RuntimeDeliveryState
ProductOpportunityCandidate
EvidenceStoreService
```

Public group surface：

```txt
listChildCapabilityIds()
execute(input)
```

如果保留便捷 wrapper，例如：

```txt
writeStructuredRuntimeEvent()
writeStructuredActionLog()
writeEvidenceRecord()
writeAiResultRecord()
finalizeBrowseLedger()
finalizeEvidencePacket()
finalizeFailedRecord()
updateRuntimeSnapshot()
```

则必须证明它们只是 `execute(input)` 的 thin wrapper，不得绕过 registry/executor/proof。

---

## 5. Record Envelope

`ForensicsRecordEnvelope` 必须包含：

```yaml
ForensicsRecordEnvelope:
  recordId: required
  recordType: required
  missionId: required
  runId: required
  sessionId: required
  roundId: required
  videoVisitId: optional
  stepId: required
  mapPackageId: required
  mapPackageVersion: required
  selectedMapId: required
  selectedMapVersion: required
  activationSnapshotRef: required
  capabilityCallId: required
  sourceAbilityGroupId: required
  sourceChildCapabilityId: required
  createdAt: required
  payload: cleaned_plain_payload
  inputRefs: list
  outputRefs: list
  sourceRecordRefs: list
  parentRefs: list
  artifactRefs: list
  promptContractId: required-if-ai-record
  promptContractVersion: required-if-ai-record
  promptCatalogVersion: required-if-ai-record
  actionRef: required-if-action-record
  postActionVerificationRef: required-if-action-record
  decisionRef: optional
  schemaVersion: required
  integrityHash: required
  dataQualityFlags: list
  idempotencyKey: required
```

禁止：

```txt
payload as legacy business object truth
record envelope without capabilityCallId
AI record without prompt refs
action record without postActionVerificationRef
success without integrityHash
```

---

## 6. Runtime Proof

`ForensicsRuntimeProof` 必须包含：

```yaml
ForensicsRuntimeProof:
  proofId: required
  abilityGroupId: forensics-persistence
  childCapabilityId: required
  recordType: required
  recordId: required
  missionId: required
  runId: required
  sessionId: required
  roundId: required
  stepId: required
  mapPackageId: required
  mapPackageVersion: required
  selectedMapId: required
  selectedMapVersion: required
  activationSnapshotRef: required
  capabilityCallId: required
  sourceAbilityGroupId: required
  sourceChildCapabilityId: required
  idempotencyKey: required
  inputRefs: list
  outputRefs: list
  inputRecordRefs: list
  outputRecordRefs: list
  parentRefs: list
  artifactRefs: list
  storageRef: optional
  integrityHash: required-if-success
  policyDecision: required
  integrityDecision: required
  startedAt: required
  endedAt: required
  durationMs: required
  status: success | failed | review_required
  failureReason: required-if-failed
  reviewRequiredReason: required-if-review_required
  dataQualityFlags: list
```

禁止：

```txt
runtimeProof:null
runId fabricated only from sourceAbilityGroupId
missionId fabricated from sourceAbilityGroupId
runtimeProof chain different from envelope chain
```

---

## 7. Record Types

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

每类 record 的附加要求：

| recordType | 必填链路 |
|---|---|
| structured_runtime_event | stepId, capabilityCallId, sourceAbilityGroupId |
| structured_action_log | actionRef, postActionVerificationRef, capabilityCallId |
| evidence_record | artifactRefs or inputRefs, capabilityCallId |
| ai_result_record | promptContractId, promptContractVersion, promptCatalogVersion, capabilityCallId |
| browse_ledger_entry | decisionRef, parentRefs |
| evidence_packet | parentRefs, artifactRefs, decisionRef |
| failed_record | failureReason, parentRefs |
| runtime_snapshot | runId, missionId, resumeCheckpointRef if applicable |

---

## 8. Storage Port

`ForensicsStoragePort` 必须是通用 record store：

```ts
writeRecord(envelope): Promise<StoredForensicsRecord>
readRecord(ref): Promise<StoredForensicsRecord | null>
listRecords(query): Promise<StoredForensicsRecord[]>
updateRuntimeSnapshot(envelope): Promise<StoredForensicsRecord>
```

`ForensicsArtifactStoragePort`：

```ts
writeArtifactRef(ref): Promise<ForensicsArtifactRef>
```

Artifact promotion / retention 主权：

```txt
Screenshot artifacts 默认只是临时运行材料。
只有 Forensics 可以把它们正式提升为 promoted-evidence / legal-hold-evidence。
```

`ForensicsArtifactRef` 必须额外保留：

```txt
artifactLifecycleManifestRef
retentionClass
promotionStatus
artifactHash
byteSize
promotedByRecordRef
pinnedByRecordRefs
legalHoldReason
cleanupLedgerRef
refCount
cleanupEligible
```

Cleanup / GC 只能由 Forensics cleanup ledger 裁决，并且必须同时满足：

```txt
manifest exists
transient or diagnostic class only
expired
mission not active
AI / Visual Target / PAV not pending
not promoted
not pinned
no legal hold
refCount = 0
```

禁止：

```txt
saveAiResult(LocalAiTaskResult)
saveActionLog(ActionLog)
saveEvidencePacket(ProductDiscoveryEvidencePacket)
saveAgentRound(AgentRound)
saveCandidate(ProductOpportunityCandidate)
resetLocalStore()
getOperatorSnapshot()
setCandidateDisposition()
deleteCandidate()
```

旧 store 只能作为外部 composition-root adapter 注入，不得成为 Forensics root 的 public owner。

---

## 9. Child Capability 职责

| child | 职责 | 禁止 |
|---|---|---|
| write-structured-runtime-event | 写 structured_runtime_event envelope | 推导 runtime state |
| write-structured-action-log | 写 structured_action_log envelope | 验证动作真假 |
| write-evidence-record | 写 evidence_record envelope / artifact refs | OCR/AI 判断 |
| write-ai-result-record | 写 ai_result_record envelope | 解释 AI 输出 |
| finalize-browse-ledger | 写 browse_ledger_entry envelope | 产品结论重算 |
| finalize-evidence-packet | 写 evidence_packet envelope | 组装业务候选 |
| finalize-failed-record | 写 failed_record envelope | 推导失败原因之外的业务结论 |
| update-runtime-snapshot | 写 runtime_snapshot envelope | 成为 Orchestration 状态机 |

---

## 10. Pipeline

所有 child 必须走统一 executor：

```txt
input schema gate
→ child registry gate
→ record type gate
→ persistence policy gate
→ integrity policy gate
→ idempotency gate
→ artifact write gate
→ envelope builder
→ storage write gate
→ output schema gate
→ proof builder
→ result builder
```

禁止：

```txt
child implementation 直接写 storage
child implementation 直接构造 final result
failure path 无 proof
unknown child 无 proof
```

---

## 11. Policy / Integrity

Persistence policy：

```yaml
ForensicsPersistencePolicy:
  mode: append | replace-by-round | replace-by-session
  allowPartialRefs: boolean
  allowExternalArtifactRef: boolean
  onArtifactWriteFailure: failed | review_required
```

Integrity policy：

```yaml
ForensicsIntegrityPolicy:
  requireSourceRecordRefs: boolean
  requireParentRefs: boolean
  requireArtifactRefs: boolean
  requireStorageRef: boolean
  requireActivationSnapshotRef: boolean
  requireCapabilityCallId: boolean
  requirePostActionVerificationRef: boolean
  requirePromptContractRefs: boolean
```

---

## 12. Result Model

`ForensicsPersistenceAbilityResult`：

```yaml
status: success | failed | review_required
abilityGroupId: forensics-persistence
childCapabilityId: required
recordType: required
recordRef: required
storageRef: optional
artifactRefs: list
output: persisted-output-or-null
failureReason: required-if-failed
reviewRequiredReason: required-if-review_required
runtimeProof: required
integrityDecision: required
policyDecision: required
dataQualityFlags: list
```

Success 必须：

```txt
output exists
recordRef exists
runtimeProof exists
integrityHash exists
policyDecision.status valid
integrityDecision.status passed or review_required
```

Failure 必须：

```txt
output = null
failureReason exists
runtimeProof exists
```

Review required 必须：

```txt
reviewRequiredReason exists
runtimeProof exists
```

---

## 13. 与其它能力组边界

### AI

AI 返回 governed result。
Forensics 保存 cleaned plain payload。
Forensics 不 import AI prompt contract 或 LocalAiTaskResult。

### Post-Action Verification

PAV 判断动作后状态。
Forensics 只保存 PAV ref。
Forensics 不验证动作是否真的成功。

### Orchestration

Orchestration 决定流程。
Forensics 只保存 refs 与 snapshots。
Forensics 不推进 map step。

### Commander

Commander 读 Forensics read model。
Commander 不 import storage internals。
Commander 不修改 Forensics records。

### Nerve Bus

Nerve Bus 传输。
Forensics 不发送 Nerve Bus envelope。
Forensics 不替 Nerve Bus 做 command transport。

---

## 14. 执法系统

必须存在：

```txt
scripts/audit/domains/forensics-persistence-capability/manifest.json
scripts/audit/domains/forensics-persistence-capability/inspector.ts
scripts/audit/domains/forensics-persistence-capability/run-inspector.ts
scripts/audit/domains/forensics-persistence-capability/negative-proof-harness.ts
```

Inspector 必须：

```txt
ts-morph
AST-level
symbol-level
import graph-level
schema-level
anti-escape
generated artifact aware
runner-connected
negative-proof-backed
```

禁止：

```txt
regex final judgment
grep final judgment
includes final judgment
manual-only proof
warning-only P0
detached inspector
empty negative proof
```

---

## 15. Inspector 必查

```txt
1. No runtime/ directory.
2. No shared/store directory.
3. No mock/ production path.
4. Public contract Forensics-native only.
5. No legacy business type imports in contract/schema/children schema/index.
6. Registry child parity.
7. Child implementation uses unified executor.
8. External import of children/** forbidden.
9. No action/browser/AI/orchestration implementation imports.
10. No candidate/runtime state/business decision symbols.
11. No old store API symbols.
12. Envelope contains chain fields.
13. Proof contains chain fields.
14. Result/envelope/proof chain parity.
15. AI record requires prompt refs.
16. Action log requires postActionVerificationRef.
17. Success requires integrityHash.
18. Unknown child returns proof.
19. All active law coverage in registry/matrix/audit-plan/runner.
20. Negative proof executed.
```

---

## 16. Negative Proof 最低清单

必须 fail → rollback → pass：

```txt
add runtime/ directory
add shared/store directory
import BrowseLedgerEntrySchema
import ActionLogSchema
import LocalAiTaskResult
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
external import children implementation
add capability-check.ts
remove negative proof invocation
turn P0 into warning-only
```

---

## 17. READY 标准

Forensics READY 仅当：

```txt
Forensics 法案 / 施工图 / inspector / generated / runner 口径一致
ALL active law enforcement PASS
CI-FULL PASS
Forensics public contract 原生化
无 legacy type 泄漏
无 runtime/ 和 shared/store
record envelope / runtimeProof 链路字段完整
AI record prompt refs 强制
action record postActionVerificationRef 强制
storage port 通用
统一 executor pipeline
negative proof PASS
```

---

## 18. 漂移信号

```txt
Forensics 内出现 runtime/
Forensics 内出现 shared/store/
child schema import evidence-packet/platform-action/local-ai 类型
Forensics public contract 暴露 ProductDiscoveryEvidencePacket / ActionLog / LocalAiTaskResult
Forensics 构造 ProductOpportunityCandidate
Forensics 修改 RuntimeDeliveryState
Forensics 判断 product_yes/product_no
Forensics 写 actionLogRef 但无 postActionVerificationRef
Forensics 保存 AI record 但无 promptContractId
verify 脚本成为验收链
```

---

## 19. 最终原则

```txt
Forensics 只记账，不判断。
Forensics 只写 envelope，不收留 finalizer。
Forensics 只持有 record truth，不持有业务 truth。
Forensics 必须能让每一条证据回到 map、step、capability call、prompt/action/verification。
```

---

## 20. 实战运行日志透明化补充：write idempotency proof

本节只补施工细节，不新增 lawId，不修改冻结法案。

Forensics 写账可以对每个 runtime event 记录 `FORENSICS_RECORD_WRITE_REQUESTED` / `FORENSICS_RECORD_WRITTEN` / `FORENSICS_RECORD_WRITE_REVIEW_REQUIRED`，但终端摘要必须足够判断是否正常写账、重复写账、dedupe 或 durability review。

`FORENSICS_RECORD_WRITE_REQUESTED` refs 至少包含：

```txt
sourceEventId
sourceEventType
sourceOwner
recordKind
pendingRecordId
idempotencyKey
dedupeDecision=pending
```

`FORENSICS_RECORD_WRITTEN` refs 至少包含：

```txt
sourceEventId
sourceEventType
recordKind
recordId
recordRef
idempotencyKey
dedupeDecision=written or deduped
storageRef
durabilityMode=durable or memory_only
```

当 Forensics child result 为 `review_required` 时，不得输出 `FORENSICS_RECORD_WRITTEN status=success`。必须输出 `FORENSICS_RECORD_WRITE_REVIEW_REQUIRED status=review_required`；如果 `storageRef=MISSING`，终端摘要必须明确 `durabilityMode=memory_only` 或进入 durability review，不得把该记录描述成 durable persisted proof。

禁止：

```txt
为了减少日志关闭 Forensics 写账
为了通过审计删除 write requested/written event
终端输出完整大 payload
重复 idempotencyKey 产生第二条业务账
```
## Durable Write Boundary Addendum

- `FORENSICS_RECORD_WRITE_REVIEW_REQUIRED` is not durable proof, even when a `storageRef` is present in diagnostic refs.
- When `storageRef`, `recordRef`, runtime proof, idempotency key, and core chain fields are complete, structured writes should emit `FORENSICS_RECORD_WRITTEN status=success` with `durabilityMode=durable`.

## Phase-05 Structured Write Closure Addendum

- The structured write boundary applies to all owners using Forensics public contracts, not only AI debug events. Commander Console, Nerve Bus, Orchestration, Page State, Screenshot, PAV, AI, and other governed callers must not leave durable accounting at `FORENSICS_RECORD_WRITE_REQUESTED`.
- A pending request must terminate as `FORENSICS_RECORD_WRITTEN` or `FORENSICS_RECORD_WRITE_REVIEW_REQUIRED`. Failed child results must still produce a terminal boundary event with `forensicsResultStatus`, `recordId`, `recordRef`, `idempotencyKey`, `dedupeDecision`, `durabilityMode`, and `storageRef` so runtime logs can distinguish storage failure from pending acceptance.
- `review_required` is reserved for memory-only storage, missing chain refs under an explicit review policy, artifact write downgrade, or other durability conditions requiring human review.
- Boundary refs must continue to include `sourceEventId`, `sourceEventType`, `sourceOwner`, `recordKind`, `recordId`, `recordRef`, `idempotencyKey`, `dedupeDecision`, `storageRef`, and `durabilityMode`.

## Storage Health Probe Addendum

- Durable Forensics storage must initialize the parent data directory and `state.json` before any structured runtime write. `ENOENT` for `state.json` is a storage implementation failure, not a valid review state.
- Evidence store health must execute a real durable write probe against the governed state store. If that probe fails, the health result must be `ok=false` with a typed reason such as `forensics_storage_write_failed`.
- Commander mission readiness and mission start preflight must consume this Forensics health result. A failed durable write probe must block executable mission dispatch instead of allowing later proof events to degrade into `storageRef=MISSING`.
