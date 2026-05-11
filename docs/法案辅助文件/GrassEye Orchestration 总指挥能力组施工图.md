# GrassEye Orchestration 总指挥能力组施工图

## 文件身份

- owner: orchestration-capability
- 目标：执行 AI 提议的登记能力序列，而不是维护业务套餐
- 口径：Orchestration 只负责 decode、validate、inject refs、dispatch、record result、stop/review on failure

## 最终定义

Orchestration executes AI-proposed registered capability sequence.
Orchestration does not own business-process packages.
Orchestration does not own semantic shortcut flows.
Orchestration does not decide whether a video is seeding/product/comment-worthy.

## 新主链

```txt
userRequirementText + selectedPlatforms
→ PlatformRegistry + MuscleMemoryCatalog + Visual Mission Prompt Contract
→ screenshot original + coordinate grid
→ AI Visual Mission Judge
→ governed decision + registered capability sequence
→ decoder / validator / scheduler
→ owning capability group
→ Forensics record
→ next round
```

当前代码若仍使用 `actions[].actionCode`，该字段只可作为 registry entry id 的 transport 字段。

## Orchestration 必须负责

```txt
mission state
round state
currentStepId / previousStepId
loop guard
decode capability sequence
validate registry membership and input schema
inject system refs
dispatch order
record result
stop / finalize / review handoff
```

## Orchestration 不得负责

```txt
business-process package ownership
semantic shortcut flow ownership
legacy declarative flow package
retired chain script
retired branch-token field branching
retired binding state
raw prompt construction
semantic page/product judgment
universal mandatory PAV
```

## mission state 最小字段

```txt
missionId
runId
sessionId when applicable
roundId when applicable
currentStepId
previousStepId
promptContractId when applicable
outputSchemaRef when applicable
selectedPlatforms
status
```

## Round Mission Packet 连续性

```txt
每轮 Visual Mission AI 调用前，Orchestration 必须 build + record + inject Round Mission Packet
dispatchInput 必须带 roundMissionPacketJson
payloadRefs 必须带 roundMissionPacketRef
Round Mission Packet 必须包含 mission / round / currentEvidence / constraints / allowedActions
constraints 必须保留 noHumanInLoop / requireCoordinateGridForVisualActions / noRawCoordinates / stopWhenBlocked / stopWhenUnsafe
```

禁止：

```txt
不注入 Round Mission Packet 就发起下一轮 AI
让 AI 靠上一轮记忆接任务
review_required 后隐式继续自动链路
```

## 执行阶段语义

- currentStepId / previousStepId 只表示 visual mission round 内部执行阶段，不得对应 retired packaged step。
- branchTaken 如果存在，只能来自声明过的 decision / riskFlags / actions 字段，不得来自任何 retired branch token。
- step state 是调度元数据，不是 retired declarative flow package 的回流主权。
- `review_required` 表示当前轮自动链路必须停止，不得隐式继续。
- `STOP_REVIEW_REQUIRED_ONCE` 或等价的登记停止条目，用于硬停止并把人工处理转交 Commander Console。

禁止字段：

```txt
retired selection field
retired selection version field
retired package field
retired package version field
retired binding field
legacy route-plan field
retired branch-token field
legacy template field
```

## 调度原则

- branch 只能消费声明过的 decision / riskFlags / actions 字段。
- unknown or unregistered capability entry = fail closed。
- semantic action、composite、package、workflow 若仍出现在代码，只能被视为 transitional residue。
- click / scroll / text-input 必须走 owning capability public contract。
- gridCell 执行必须先走 Geometry Guard。
- PAV 只能按 policy 作为 observation packaging，可有可无，不再是动作后必经 gate。
- review_required 与登记停止条目都必须写入 Forensics，并停止自动继续。

## 原子调度示例

产品成立时：

```txt
CAPTURE_VIEWPORT_ONCE
SAVE_EVIDENCE_RECORD_ONCE
LEFT_CLICK_GRID_CELL_ONCE(likeButtonGridCell)
LEFT_CLICK_GRID_CELL_ONCE(commentButtonGridCell)
```

非产品时：

```txt
LEFT_CLICK_GRID_CELL_ONCE(nextButtonGridCell)
```

## 审计信号

建对表现：

```txt
mission flow 不依赖 map truth
AI step 依赖 promptContractId/outputSchemaRef
action scheduling 依赖 capability registry
```

漂移信号：

```txt
retired branch-token field 机械分支
retired chain frozen truth
semantic package 成为调度权威
Mouse click step without Geometry Guard
所有动作后强制 PAV
```
