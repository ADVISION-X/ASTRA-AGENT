# GrassEye 结构化日志与运行证明施工图

## 统一身份与冻结边界

- 本文件是当前主题的建设级落地映射或冻结说明，不新增 lawId，不修改冻结法案。
- 本文件只服从当前 13 个 active ability groups 与 4 个 active support laws，不重新分配主权。
- 若本文档涉及 support boundary、共享子契约或已退役主题，只能从属于现有父能力组或冻结结论，不得借此恢复独立 owner、phase gate、audit plan 或 runner。
- 若与 .github/instructions/cursor-rules/** 或 docs/法案辅助文件/GrassEye 法案冻结基线.md 冲突，以冻结法案与现行 owner law 为准。

## 定位

本图只描述 Forensics Persistence 之下的结构化日志字段纪律、runtime proof 和写账关系。

Structured Logging 子边界负责日志 schema 与可追溯性。
Forensics Persistence 负责把这些 payload 持久化成 record envelope。

## 日志类型

- structured_runtime_event
- structured_action_log
- runtime_snapshot

## 最低字段

- abilityGroupId
- childAbilityId
- sessionId
- roundId
- videoVisitId
- status
- reason
- createdAt
- inputRefs
- outputRefs
- evidenceRefs
- dataQualityFlags

## 运行证明

runtimeProof 至少应包含：
- proofId
- emittedAt
- sourceAbilityGroupId
- sourceChildCapabilityId
- actionExecutionRef
- primitiveExecutionRef
- primitiveExecutionRefs
- inputRecordRefs
- outputRecordRefs
- artifactRefs
- integrityStatus
- debugLogRef

## 持久化关系

- structured_runtime_event 和 structured_action_log 由上游生成 payload。
- Forensics 把 payload 包装成 ForensicsRecordEnvelope 后写入。
- runtime_snapshot 是独立 recordType，不得用 structured_runtime_event 假装替代。
- browse ledger、evidence packet、failed record 必须能回连到结构化日志记录。
- ability group 不得把 browserActionId 假装成 actionLogRef；真正的 actionLogRef 由 Forensics 写入后回填。
- Mouse Scroll 只能先返回 scrollExecutionRef、primitiveExecutionRefs 和 runtimeProof，不能伪造持久化 actionLogRef。

## 禁止边界

- 不把 console output 当 runtime truth。
- 不把 structured-logging 写成独立 owner 或第二 persistence owner。
- 不把 runtime finalizer 藏进 Forensics 目录。
- 不允许 verify 脚本成为日志执法主链。

## 验收信号

建对表现：
- 任一终结记录都能回连到结构化日志 record refs
- debug proof 与 persisted record ref 对齐
- 日志纪律与写账主权清晰分离

漂移信号：
- console 文本充当运行真相
- 旧 round finalizer 继续驻留在 Forensics 根内
- runtime snapshot 不是独立 record
