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
review_required 原因展示与人工再启动入口
```

## Commander 不负责

```txt
retired navigation-chain parsing
legacy activation truth
retired branch-token scheduling
AI runtime truth
browser/action execution
```

## review gate 语义

```txt
review_required = 受治理停止状态，不自动继续
STOP_REVIEW_REQUIRED = 合法 actionCode，要求系统停止并把人工处理交还 Commander
human review gate = Commander Console / 人工再启动层，不属于自动化链路中的隐式继续节点
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

## Human Command Boundary

```txt
issue-human-command = start-mission only
boundaryDecision = command-transport-only
schema requires requestedPlatformId + governed initialPayload
Commander 活跃 command surface = issue-human-command / pause-mission / resume-mission / stop-mission / emergency-stop / mark-review-required
```

禁止：

```txt
roundId
roundIndex
previousRoundId
currentPhase
aiResultRef
approve-candidate 重新回流到 command surface
reject-candidate 重新回流到 command surface
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
