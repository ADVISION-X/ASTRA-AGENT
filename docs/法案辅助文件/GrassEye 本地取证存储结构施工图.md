# GrassEye 本地取证存储结构施工图

## 统一身份与冻结边界

- 本文件是当前主题的建设级落地映射或冻结说明，不新增 lawId，不修改冻结法案。
- 本文件只服从当前 14 个 active ability groups、5 个 foundation laws、1 个 support governance domain；若与 Kernel / Index / 法案冻结基线冲突，以 Kernel / Index / 冻结基线为准。
- 若本文档涉及 support boundary、共享子契约或已退役主题，只能从属于现有父能力组或冻结结论，不得借此恢复独立 owner、phase gate、audit plan 或 runner。
- 若与 .github/instructions/cursor-rules/** 或 docs/法案辅助文件/GrassEye 法案冻结基线.md 冲突，以冻结法案与现行 owner law 为准。

## 定位

本图只描述本地 schema、artifact 布局和 storage adapter 边界。

Forensics Persistence 拥有公共写账主权。
local-persistence-schema 是 Forensics Persistence 内部 schema 子契约。

## 核心对象

- ForensicsRecordEnvelope
- ForensicsRecordRef
- ForensicsArtifactRef
- runtime_snapshot records
- export-set metadata
- artifact file store

## 统一字段

- recordId
- recordType
- sessionId
- roundId
- videoVisitId
- sourceAbilityGroupId
- createdAt
- storageRef
- schemaVersion
- integrityHash

## 结构原则

- 结构化记录与 artifact 引用分离，但必须可回连。
- payload 是被清洗后的 plain payload，不是旧业务 owner 类型。
- Browser profile、cookies、session 数据与 evidence store 严格分离。
- export-set 可以存在，但只能消费已持久化的 Forensics records。

## storage adapter 边界

允许：
- composition root 注入临时 adapter，把旧 store 映射到 ForensicsStoragePort。
- 中立 schema 与文件布局工具位于 src/lib/storage 或 schema 辅助路径。

禁止：
- 任何独立 local-data owner 回流。
- src/capabilities/forensics-persistence/shared/store 继续存在。
- EvidenceStoreService、operator snapshot、review mutation 成为 Forensics 内部主权。

## 验收信号

建对表现：
- 任一 record 都能回连 parentRefs、artifactRefs、storageRef 和 integrityHash
- 写入路径由 Forensics façade 统一进入
- schema 和 storage adapter 都不再暴露旧业务 owner 类型

漂移信号：
- schema helper 绕过 Forensics façade 直接写 browse ledger、evidence packet、failed record、runtime snapshot
- 旧 LocalAiTaskResult、ActionLog、AgentRound 成为持久化主权词汇
- verify 脚本成为 schema 验收链
