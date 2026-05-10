# GrassEye AI 大脑能力组施工图

## 文件身份

- owner: ai-capability
- 目标：把 AI 固定为 Visual Mission Judge，而不是旧式 retired branch-token field / map branch 解释器
- 口径：AI 只思考，不执行动作；AI 输出受治理 decision 与 actionCode 计划

## 主链位置

```txt
userRequirementText + selectedPlatforms
→ PlatformRegistry
→ MuscleMemoryCatalog
→ Prompt Contract Registry
→ Visual Mission Judge
→ governed decision + actions[].actionCode + reason
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

禁止：

```txt
retired branch-token field
legacy route-plan field
retired selection field
retired selection version field
retired binding field
raw x/y
free-form browser instruction
```

## Prompt Contract 真相

- promptContractId 来自 Prompt Contract Registry 与 visual mission context
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
