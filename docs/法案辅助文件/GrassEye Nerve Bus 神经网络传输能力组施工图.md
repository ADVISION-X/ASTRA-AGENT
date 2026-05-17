# GrassEye Nerve Bus 神经网络传输能力组施工图

## 文件身份

- owner: nerve-bus-capability
- 目标：只保留 mission/run/round/step/prompt/action 的短链 transport truth
- 口径：Nerve Bus 只运输，不制造业务真相

## envelope 最小字段

```txt
missionId
runId
sessionId when applicable
roundId when applicable
stepId
capabilityCallId
requestedBy
targetAbilityGroupId
targetChildCapabilityId when applicable
promptContractId when applicable
outputSchemaRef when applicable
inputRef
idempotencyKey
```

禁止字段：

```txt
retired package field
retired package version field
retired selection field
retired selection version field
retired binding field
运行计划字段
retired branch-token field
模板字段
```

## AI transport 原则

- AI request 必须携带 promptContractId
- AI result 必须携带 status / outputRef / failureReason
- Nerve Bus 不能拼 prompt body
- Nerve Bus 不能补 platform/map 默认值

## 审计信号

建对表现：

```txt
envelope 只保留短链字段
transfer proof 不含 retired map truth
```

漂移信号：

```txt
transport without promptContractId
transport proof with retired binding field
retired branch-token field 成为 envelope branch truth
```


## 附录：极简化施工补充（Phase 5 Final Delivery）

### 核心原则补充

Nerve Bus 不按方向拆 child。
- 禁止: orchestration-to-ai, ai-to-orchestration, commander-to-orchestration, orchestration-to-commander, orchestration-to-ability, ability-to-orchestration
- 方向属于 envelope 字段 (requestedBy / targetAbilityGroupId / targetChildCapabilityId)，不是 child capability

Nerve Bus 不维护 queue / sequence store / retry / fallback 系统。
- 当前阶段只提供 generic governed envelope transport (synchronous path)
- 任何 queue/sequence 系统须另开法案和施工图后才能启用

当前阶段 active child surface:
- dispatch-governed-envelope
- return-governed-result
或合并为一个: transport-governed-envelope

目标文件数:
- src/capabilities/nerve-bus/**/* <= 14 files
- scripts/audit/domains/nerve-bus-capability/**/* <= 3 files

Nerve Bus 只负责:
1. 接收 governed command envelope
2. 校验短链字段
3. 校验 forbidden retired fields 不存在
4. 调用目标能力组 public dispatcher
5. 包装 governed result envelope
6. 输出 transfer proof
