# GrassEye Geometry Guard 几何安全守卫能力组施工图

## 文件身份

- owner: geometry-guard-capability
- 目标：固定 Geometry Guard 为唯一 executable coordinate safety gate

## 能力边界

Geometry Guard 负责：

```txt
coordinate-space validation
scaleMapping validation
bbox / clickPoint legality
normalized executable geometry
```

Geometry Guard 不负责：

```txt
action planning
retired selection / retired chain truth
screenshot truth
business verbs
primitive execution
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
sourceScreenshotEvidenceRef when applicable
sourceVisualTargetResultRef when applicable
sourceCoordinateSpace
requestedExecutionSpace
bbox or clickPoint
imageSize
viewportSize
screenSize
deviceScaleFactor
scaleMapping
safetyPolicy
idempotencyKey
```

## 输出原则

- public result 只输出 normalized executable geometry
- Geometry Guard 不得输出 action recipe / fallback recipe / platform verb
- Geometry Guard proof 只保留 geometry truth 与短链 mission refs

禁止字段：

```txt
retired package field
retired package version field
retired selection field
retired selection version field
retired binding field
retired branch-token field
运行计划字段
```

## 漂移信号

```txt
Geometry Guard 生成 action plan
proof 携带 retired binding field
Geometry Guard 声称 screenshot / AI / business truth
```
