# GrassEye Orchestration 总指挥能力组施工图

## 文件身份

- owner: orchestration-capability
- 目标：把运行主权从 retired package chain / retired deterministic flow / retired branch-token field 切到 visual mission context + AI action plan
- 口径：Orchestration 只负责 mission flow、loop guard、dispatch order、finalize

## Retired Vocabulary Table

| 抽象词 | 实际禁止字段 |
| --- | --- |
| retired branch-token field | routeLabel |
| legacy route-plan field | routePlanId |
| retired selection field | selectedMapId / selectedMapVersion |
| retired binding field | activationId / activationSnapshotRef |
| retired package chain | mapPackageId / mapPackageVersion / map-plugin-package |
| retired template flow | taskTemplateId / taskTemplate |

## 新主链

```txt
userRequirementText + selectedPlatforms
→ PlatformRegistry + MuscleMemoryCatalog + Visual Mission Prompt Contract
→ screenshot original + coordinate grid
→ AI Visual Mission Judge
→ governed decision + actions[].actionCode
→ decoder / scheduler
→ owning capability group
→ Forensics record
→ next round
```

## Orchestration 必须负责

```txt
mission state
round state
currentStepId / previousStepId
loop guard
stop / finalize
Nerve Bus dispatch order
```

## Orchestration 不得负责

```txt
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

## 执行阶段语义

- currentStepId / previousStepId 只表示 visual mission round 内部执行阶段，不得对应 retired packaged step。
- branchTaken 如果存在，只能来自声明过的 decision / riskFlags / actions 字段，不得来自 routeLabel 或其他 retired branch token。
- step state 是调度元数据，不是 retired declarative flow package 的回流主权。
- `review_required` 表示当前轮自动链路必须停止，不得隐式继续。
- `STOP_REVIEW_REQUIRED` 是合法 actionCode，用于硬停止并把人工处理转交 Commander Console。

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

- branch 只能消费声明过的 decision / riskFlags / actions 字段
- unknown actionCode = fail closed
- composite actionCode 只能由系统展开
- click / scroll / text-input 必须走 owning capability public contract
- PAV 只能按 policy 作为 observation packaging，可有可无，不再是动作后必经 gate
- review_required / STOP_REVIEW_REQUIRED 都必须写入 Forensics，并停止自动继续

## 审计信号

建对表现：

```txt
mission flow 不依赖 map truth
AI step 依赖 promptContractId/outputSchemaRef
action scheduling 依赖 actionCode
```

漂移信号：

```txt
retired branch-token field 机械分支
retired chain frozen truth
Mouse click step without Geometry Guard
所有动作后强制 PAV
```
