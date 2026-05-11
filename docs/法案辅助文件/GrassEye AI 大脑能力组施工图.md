# GrassEye AI 大脑能力组施工图

## 文件身份

- owner: ai-capability
- 目标：把 AI 固定为 Visual Mission Judge，而不是旧式 retired branch-token field / map branch 解释器
- 口径：AI 只思考，不执行动作；AI 输出受治理 decision 与 actionCode 计划令牌

## 主链位置

```txt
userRequirementText + selectedPlatforms
→ PlatformRegistry
→ MuscleMemoryCatalog
→ visual-mission-judge-v1
→ Visual Mission Judge
→ governed decision + actions[].actionCode + reason
```

## 无记忆连续性

```txt
AI 在每一轮都是 stateless across rounds
系统连续性只能来自 Round Mission Packet + Current Visual Evidence
Prompt 必须显式声明：Do not assume memory from previous AI calls
如果当前轮证据不足，AI 不得向人类索要普通下一步决策；应返回 STOP_REVIEW_REQUIRED 或其他受治理恢复 actionCode
```

## AI 必须负责

```txt
页面语义判断
blocker / readiness 判断
产品与业务判断
风险标记
下一步受治理动作计划
```

## AI 不得负责

```txt
直接点击 / 滚动 / 输入 / 打开
Nerve Bus dispatch
Forensics 写入
mission state 推进
retired selection / retired deterministic flow planning / retired branch-token field 真相
```

## 输出合同

```txt
decision
reason
confidence
riskFlags
actions[].actionCode
actions[].input
inputRefs
outputRefs
runtimeProof
```

## action-plan token 边界

AI 可以输出以下受治理 planning tokens：

```txt
actions[].actionCode
actions[].required
actions[].reason
actions[].input.gridCell
actions[].input.key
```

这些字段是 action-plan tokens only，不是 execution authority。
它们必须先经 Orchestration / ActionPlan Decoder / Scheduler 解码，能力组才允许执行。

禁止：

```txt
retired branch-token field
legacy route-plan field
retired selection field
retired selection version field
retired binding field
raw x/y
free-form browser instruction
raw browser command
arbitrary URL to open
Nerve Bus envelope
Forensics write request
```

Review semantics:
- `review_required` 是受治理状态，不是自动继续路径。
- `STOP_REVIEW_REQUIRED` 可以作为合法 actionCode 被 AI 提议，用于要求系统停止本轮、写入 Forensics，并交给 Commander Console 暴露人工处理原因。

## Prompt Contract 真相

- promptContractId 来自单一受治理 prompt contract：visual-mission-judge-v1
- 不得来自 retired packaged step、retired deterministic flow 或 retired binding state
- outputSchemaRef 必须与 promptContractId 同步受治理

## 审计信号

建对表现：

```txt
AI 输出 actionCode
AI 输出可复盘 reason
AI proof 只保留 mission/run/round/step/prompt truth
```

漂移信号：

```txt
AI 输出 retired branch-token field
AI proof 携带 retired chain binding truth
AI runtime 按 retired packaged step 选 prompt
```
