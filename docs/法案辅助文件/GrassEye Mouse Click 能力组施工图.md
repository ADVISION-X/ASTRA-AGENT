# GrassEye Mouse Click 能力组施工图

## 文件身份

- owner: mouse-click-capability
- 目标：Click 只执行 primitive click，不承担语义真相

## 能力边界

Mouse Click 负责：

```txt
消费 Geometry Guard allow 的 executable geometry
执行 primitive click
返回 click result ref / runtime proof
```

Mouse Click 不负责：

```txt
重算 clickPoint
业务动作语义
retired selection / retired binding state / retired chain truth
PAV 终局真相
```

## 输入最小字段

```txt
missionId
runId
roundId when applicable
stepId
capabilityCallId
nerveBusEnvelopeId
purpose
inputRef
sourceRef
sourceCoordinateProofRef
geometryGuardProof
geometryGuardRef
guardDecision=allow
geometryGuardNormalizedClickPoint
button
clickCount
bounds
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
```

## 输出原则

- click proof 只证明 primitive click 已执行
- semantic success 由下一轮 AI 判断
- PAV 仅在 policy 要求时作为 observation packaging，可有可无

## 漂移信号

```txt
primitive click before Geometry Guard
proof 携带 retired binding field
universal mandatory PAV as click truth
```
