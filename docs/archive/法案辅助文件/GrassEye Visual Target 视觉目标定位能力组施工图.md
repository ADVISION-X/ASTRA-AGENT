# GrassEye Visual Target 视觉目标定位能力组施工图

## 文件身份

- owner: visual-target-capability
- 目标：只输出 non-executable target package，不承担执行主权

## 核心定位

Visual Target = AI 已选视觉目标的 non-executable 包装器。

它只负责：

```txt
接收 AI 已选的 gridCell / gridRegion / bbox candidate；
绑定 screenshot/source proof；
生成 targetRef / candidateRef；
保证这个 targetRef 不能直接执行（nonExecutable = true）；
交给 Geometry Guard 或后续能力使用。
```

## 能力边界

Visual Target 负责：

```txt
AI-selected candidate packaging
candidate normalization
source proof binding
target result ref
nonExecutable flag enforcement
```

Visual Target 不负责：

```txt
页面语义
业务动作词汇
candidate detection（业务按钮检测属于 AI）
business target discovery（like/comment/save/next/metric 检测）
executable geometry
primitive click / scroll
retired selection / retired chain truth
target heuristic
page-state consistency
AI result correctness
PAV
```

## 重要原则

```txt
Visual Target 不检测业务按钮。
Visual Target 不观察 like/comment/save/next。
Visual Target 不拥有 target discovery。
AI Visual Mission Judge owns visual semantic selection.
Visual Target is optional non-executable packaging.
Visual Target must not become mandatory between AI and Geometry Guard.
```

## 当前激活 child 能力

```txt
package-grid-cell-target-once   — 封装 AI 已选 gridCell
package-grid-region-target-once — 封装 AI 已选 gridRegion
package-bbox-target-once        — 封装 AI 已选 bbox（可选）
```

## 禁止的 child 能力

```txt
observe-like-button
observe-save-button
observe-comments-button
observe-close-comments-button
observe-comments-panel
observe-next-video-region
observe-next-item-target-candidate
observe-not-interested-button
observe-metric-like-count
observe-metric-comment-count
```

原因：这些是业务语义目标。业务语义属于 AI Visual Mission Judge。

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
gridCell / gridRegion / bbox（取决于 child）
selectedBy = ai | system
selectionReason?
idempotencyKey
timeoutMs?
```

## 禁止输入字段

```txt
mapId
runtimePlanId
routePlanId
activationId
templateId
selectedMapId
bindingPackageId
bindingVersion
bindingSnapshotRef
branchToken
deterministicFlowPlan
businessVerb
actionPlan
targetPolicy（作为业务启发式）
pageStateTruth
visualMeaning
semanticTarget
likeButtonTruth
commentButtonTruth
saveButtonTruth
nextVideoTruth
metricTruth
executableX
executableY
normalizedClickPoint
clickResult
scrollResult
postActionVerification
```

## 输出原则

- 输出只能是 non-executable target package（nonExecutable = true）
- executable truth 必须交给 Geometry Guard
- Visual Target 不得自造 heuristic target policy
- Final semantic truth belongs to AI Visual Mission Judge

### targetPackage 字段

```txt
targetRef
sourceScreenshotEvidenceRef
gridSpecRef?
gridCell?
gridRegion?
bbox?
sourceCoordinateSpace
selectedBy
selectionReason?
nonExecutable = true
createdAt
```

## 证明字段

Visual Target proof 只证明 non-executable target package 已从 source evidence 创建：

```txt
proofId
abilityGroupId = visual-target
childCapabilityId
missionId
runId
sessionId?
roundId?
stepId
capabilityCallId
nerveBusEnvelopeId
inputRef
sourceRef
sourceScreenshotEvidenceRef
targetResultRef
candidateRef
status
failureReason?
reviewRequiredReason?
startedAt
endedAt
durationMs
```

禁止 proof 证明：

```txt
business success
page meaning
AI correctness
button identity
metric correctness
target semantic truth
executable coordinate truth
click success
geometry safety
PAV truth
```

## 文件数量限制

```txt
src/capabilities/visual-target <= 14 文件（超过 18 自动 FAIL）
scripts/audit/domains/visual-target-capability <= 3 文件（超过 5 自动 FAIL）
```

## 漂移信号

```txt
proof 携带 retired chain binding truth
candidate 直接作为 click truth
Visual Target 生成业务动作计划
出现 observe-* 业务 child
出现 gate universe（target-selection-gate 等）
出现 executable coordinate 字段
Visual Target 成为 AI→Geometry Guard 的强制通路
```
