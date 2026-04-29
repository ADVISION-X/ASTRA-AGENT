# GrassEye Forensics Persistence 取证记账能力组施工图

## 统一身份与冻结边界

- 本文件是当前主题的建设级落地映射或冻结说明，不新增 lawId，不修改冻结法案。
- 本文件只服从当前 13 个 active ability groups 与 4 个 active support laws，不重新分配主权。
- 若本文档涉及 support boundary、共享子契约或已退役主题，只能从属于现有父能力组或冻结结论，不得借此恢复独立 owner、phase gate、audit plan 或 runner。
- 若与 .github/instructions/cursor-rules/** 或 docs/法案辅助文件/GrassEye 法案冻结基线.md 冲突，以冻结法案与现行 owner law 为准。

## 定位

Forensics Persistence 是账房和档案室。

它只负责：
- 写 record envelope
- 关联 parent refs
- 保存 artifact refs
- finalize browse ledger
- finalize evidence packet
- finalize failed record
- update runtime snapshot
- 返回 record ref、storage ref、runtime proof、failure reason

它不负责：
- product_yes 或 product_no 判断
- AI 业务结论生成
- AgentRound 终局更新
- RuntimeDeliveryState 决策与推导
- ProductOpportunityCandidate 构造
- Commander Console operator snapshot 主权
- resetLocalStore、setCandidateDisposition、deleteCandidate
- advanced AI export 业务组装

## public contract

Forensics public contract 只能暴露以下概念：
- ForensicsPersistenceAbilityInput
- ForensicsPersistenceAbilityResult
- ForensicsRecordEnvelope
- ForensicsRecordRef
- ForensicsArtifactRef
- ForensicsRecordType
- ForensicsPersistencePolicy
- integrityPolicy
- failureReason
- runtimeProof

不得直接暴露：
- ProductDiscoveryEvidencePacket
- BrowseLedgerEntry
- RoundStructuralLog
- RoundLifecycleEvent
- LocalAiTaskResult
- ActionLog
- AgentRound
- TaskRun
- RuntimeDeliveryState
- ProductOpportunityCandidate

## record envelope

ForensicsRecordEnvelope 最低字段：
- recordId
- recordType
- sessionId
- roundId
- videoVisitId
- sourceAbilityGroupId
- createdAt
- payload
- parentRefs
- artifactRefs
- schemaVersion
- integrityHash

recordType 受治理枚举：
- structured_runtime_event
- structured_action_log
- evidence_record
- ai_result_record
- browse_ledger_entry
- evidence_packet
- failed_record
- runtime_snapshot

## result model

ForensicsPersistenceAbilityResult 最低字段：
- status: success | failed | review_required
- abilityGroupId
- childCapabilityId
- recordType
- recordRef
- storageRef
- parentRefs
- artifactRefs
- failureReason
- debugLogRef
- runtimeProof
- dataQualityFlags

禁止：
- record: unknown
- status 只有 persisted
- debugLogRef 永远是 null

## storage port

ForensicsStoragePort 必须是通用 record store：
- writeRecord
- readRecord
- listRecords
- writeArtifactRef
- updateRuntimeSnapshot

如果当前仍需兼容旧 store，只允许在 Forensics 外部 composition root 放临时 adapter。

不得出现：
- shared/store
- EvidenceStoreService public owner
- saveAiResult(LocalAiTaskResult)
- saveActionLog(ActionLog)
- saveEvidencePacket(ProductDiscoveryEvidencePacket)
- saveAgentRound(AgentRound)
- saveCandidate(ProductOpportunityCandidate)
- resetLocalStore
- getOperatorSnapshot
- setCandidateDisposition
- deleteCandidate

## 子能力职责

write-structured-runtime-event：写 structured_runtime_event envelope。

write-structured-action-log：写 structured_action_log envelope。

write-evidence-record：写 evidence_record envelope，并保存 artifact refs。

write-ai-result-record：写 ai_result_record envelope，但 payload 必须是调用方清洗后的 plain payload。

finalize-browse-ledger：只校验 refs 并写 browse_ledger_entry envelope。

finalize-evidence-packet：只校验 refs 并写 evidence_packet envelope。

finalize-failed-record：只校验 refs 并写 failed_record envelope。

update-runtime-snapshot：只写 runtime_snapshot envelope。

## topology

目标结构：

src/capabilities/forensics-persistence/
	contract.ts
	ability-group.ts
	registry.ts
	storage-ports.ts
	record-id.ts
	index.ts
	shared/
		record-envelope.ts
		record-ref.ts
		artifact-ref.ts
		persistence-result.ts
		persistence-policy.ts
		integrity-policy.ts
		failure.ts
		runtime-proof.ts
	children/
		write-structured-runtime-event/
		write-structured-action-log/
		write-evidence-record/
		write-ai-result-record/
		finalize-browse-ledger/
		finalize-evidence-packet/
		finalize-failed-record/
		update-runtime-snapshot/

必须删除：
- runtime/
- shared/store/
- old round finalizer files
- old EvidenceStoreService owner files
- legacy normalize functions

## 验收信号

建对表现：
- 所有 Forensics 写入都走 envelope
- 所有结果都返回 recordRef、storageRef、runtimeProof
- Forensics 不再 import 旧 evidence-packet、local-ai、platform-action、task-run、runtime 类型作为 public contract
- Local Persistence Schema 只作为 Forensics 内部 schema 子契约，不再存在 local-data owner

漂移信号：
- Forensics 内仍存在 runtime/ 或 shared/store/
- 仍出现 LocalAiTaskResult、ActionLog、AgentRound、RuntimeDeliveryState 作为正向所有权类型
- 仍出现 resetLocalStore、getOperatorSnapshot、setCandidateDisposition、advancedAiExports
- verify 脚本被写成执法链
