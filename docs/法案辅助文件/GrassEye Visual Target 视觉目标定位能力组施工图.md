# GrassEye Visual Target 视觉目标定位能力组施工图

## 文件身份

- owner: visual-target-capability
- 目标：只输出 non-executable target package，不承担执行主权

## 能力边界

Visual Target 负责：

```txt
candidate detection
candidate normalization
source proof binding
target result ref
```

Visual Target 不负责：

```txt
页面语义
业务动作词汇
executable geometry
primitive click / scroll
retired selection / retired chain truth
```

## 输入最小字段

```txt
missionId
runId
roundId when applicable
stepId
capabilityCallId
nerveBusEnvelopeId
inputRef
sourceRef
sourceScreenshotEvidenceRef
scaleMapping
targetPolicy
idempotencyKey
```

## 输出原则

- 输出只能是 non-executable candidates
- executable truth 必须交给 Geometry Guard
- Visual Target 不得自造 heuristic target policy
- Final semantic truth belongs to AI Visual Mission Judge

禁止字段：

```txt
retired package field
retired package version field
retired selection field
retired selection version field
retired binding field
retired branch-token field
legacy route-plan field
```

## 漂移信号

```txt
proof 携带 retired chain binding truth
candidate 直接作为 click truth
Visual Target 生成业务动作计划
```
