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

## Commander 负责（第五阶段最终交付）

```txt
人类命令入口（start-mission）
人类控制命令入口（pause/resume/stop/emergency-stop）
review_required 停止原因展示与人工再启动入口
mark-review-required 标记入口
最小 mission status 只读视图（show-mission-status）
```

## Commander 不负责

```txt
review queue 系统
candidate disposition（approve / reject）
evidence packet 浏览系统
audit dashboard / audit summary
runtime proof timeline 大系统
capability health / roster dashboard
browse ledger
map / template / import UX
retired navigation-chain parsing
启动真相字段
retired branch-token scheduling
AI runtime truth
browser/action execution
Forensics 写入
```

## 活跃子能力（第五阶段最终交付）

| 子能力 ID | 类型 | 职责 |
|---|---|---|
| issue-human-command | command | start-mission-only 入口 |
| pause-mission | command | 暂停任务 |
| resume-mission | command | 继续任务 |
| stop-mission | command | 停止任务 |
| emergency-stop | command | 紧急停止 |
| mark-review-required | command | 标记需要人工复盘 |
| show-mission-status | read | 最小 mission 状态只读 |

已物理删除（禁止复活）：
- show-mission-dashboard / show-audit-summary / show-browse-ledger / show-evidence-packets / show-failed-records / show-runtime-proof-timeline / show-capability-roster / show-capability-health / inspect-record-detail / show-review-queue / approve-candidate / reject-candidate

## 生产文件约束

```txt
src/capabilities/commander-console/**/*.ts <= 18 文件
scripts/audit/domains/commander-console-capability/**/*.ts <= 3 文件
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
启动绑定字段
retired branch-token field
template-as-runtime field
```

## 漂移信号

```txt
start-mission success without userRequirementText
Commander validates retired navigation-chain truth
Commander envelope depends on retired branch tokens
```
