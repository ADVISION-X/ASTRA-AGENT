# GrassEye Mouse Scroll 能力组施工图

## 文件身份

- owner: mouse-scroll-capability
- 目标：Scroll 只执行 primitive scroll，不承担语义真相

## 能力边界

Mouse Scroll 负责：

```txt
消费 Geometry Guard allow 的 executable geometry / region anchor
执行 primitive scroll
返回 scroll result ref / runtime proof
```

Mouse Scroll 不负责：

```txt
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
geometryGuardProof
geometryGuardRef
guardDecision=allow
direction
magnitude
repeatCount
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
```

## 输出原则

- scroll proof 只证明 primitive scroll 已执行
- semantic success 由下一轮 AI 判断
- PAV 仅在 policy 要求时作为 observation packaging，可有可无

## 漂移信号

```txt
primitive scroll before Geometry Guard
proof 携带 retired binding field
universal mandatory PAV as scroll truth
```
