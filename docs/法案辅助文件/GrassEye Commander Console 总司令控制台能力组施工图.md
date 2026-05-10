# GrassEye Commander Console 总司令控制台能力组施工图

## 文件身份

- owner: commander-console-capability
- 目标：Commander 只保留 human entry 与 read models，不恢复 map-based start contract

## 主链位置

```txt
Human
→ Commander Console
→ HumanCommandEnvelope
→ Nerve Bus
→ Orchestration
→ Capability Groups
→ Forensics / Read Models
→ Commander Console view
```

## Commander 负责

```txt
人类命令入口
review disposition 入口
mission / evidence / audit read model 展示
```

## Commander 不负责

```txt
retired navigation-chain parsing
legacy activation truth
retired branch-token scheduling
AI runtime truth
browser/action execution
```

## start-mission 最小合同

```txt
commandId
commandType
operatorRef
userRequirementText
selectedPlatforms
maxRounds when applicable
maxMinutes when applicable
operatorNote when applicable
payload
idempotencyKey
timeoutMs
```

禁止字段：

```txt
retired navigation-chain fields
legacy activation binding field
retired branch-token field
template-as-runtime field
```

## 漂移信号

```txt
start-mission success without userRequirementText
Commander validates retired navigation-chain truth
Commander envelope depends on retired branch tokens
```
