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
legacy route-plan field
retired branch-token field
legacy template field
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
