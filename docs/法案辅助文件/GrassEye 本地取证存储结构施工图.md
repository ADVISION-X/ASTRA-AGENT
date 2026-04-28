# GrassEye 本地取证存储结构施工图

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
