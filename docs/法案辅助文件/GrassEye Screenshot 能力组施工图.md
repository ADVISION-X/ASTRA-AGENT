# GrassEye Screenshot 能力组施工图

## 文件身份

- owner: screenshot-capability
- 目标：Screenshot 固定为图像真相与坐标图提供方
- 口径：Screenshot 负责原图、AI 输入图、坐标图、gridSpecRef，不负责图像语义

## 能力边界

Screenshot 负责：

```txt
capture viewport / desktop / region
prepare ai_input
prepare visual mission input
coordinate_grid_pixels
grid_cell_index_space
gridSpecRef
artifact refs
scaleMapping
```

Screenshot 不负责：

```txt
AI 判断
retired branch-token field 分支
retired selection / retired binding state 真相
click / scroll / text execution
Geometry Guard 判断
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
sourceRef when applicable
sourceProof
privacyPolicy
capturePolicy
idempotencyKey
```

## 输出原则

- AI 只能返回 grid cell id，不得返回 raw x/y
- coordinate-grid artifact 与 gridSpecRef 必须来自受治理 source proof
- evidence-grade capture 的触发条件只能是 actionCode / policy，不得是 retired branch-token field

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

## 漂移信号

```txt
evidence capture 被 retired branch-token field 控制
proof 携带 retired binding field
coordinate grid 被直接当可执行坐标
```
