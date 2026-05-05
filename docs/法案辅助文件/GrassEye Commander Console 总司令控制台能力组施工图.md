# GrassEye Commander Console 总司令控制台能力组施工图 FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-COMMANDER-CONSOLE-BLUEPRINT-FINAL
owner: commander-console-capability
documentType: construction-blueprint
lawAuthority: module-commander-console-capability.instructions.md
architecturePhase: Static Capability Package Architecture
status: active
replace:
  - docs/法案辅助文件/GrassEye Commander Console 总司令控制台能力组施工图.md
mustNotCreate:
  - new lawId
  - new ability group
  - operator-control root
  - second command owner
  - second orchestration owner
  - direct storage owner
```

本施工图是 `module-commander-console-capability.instructions.md` 的建设级落地映射。
本施工图不新增 lawId，不修改冻结法案，不重新分配主权。
若本文档与 Commander 法案冲突，以 Commander 法案为最高权威。

---

## 1. 定位

Commander Console 是人的驾驶舱。

它负责：

```txt
人类命令入口
人类 review 决策入口
任务模板开始入口
地图包导入/审批状态展示入口
系统状态展示
能力健康展示
运行证明时间线展示
证据包 / browse ledger / failed record read model 展示
审计摘要展示
```

它不负责：

```txt
推进 map step
拥有 mission truth
拥有 evidence truth
拥有 browse ledger truth
拥有 Forensics storage truth
拥有 AI runtime truth
拥有 browser/action truth
拥有 page-state truth
构造 ProductOpportunityCandidate
维护 mechanical skill catalog
构造 runtime snapshot
执行动作
```

一句话：

```txt
Commander 只做人类入口和仪表盘，不做发动机。
```

---

## 2. 故事链路位置

```txt
Human
→ Commander Console
→ HumanCommandEnvelope
→ CommandTransportPort
→ Nerve Bus
→ Orchestration / governed review path
→ Capability Groups
→ Forensics / Read Models
→ Commander Console view
```

Commander 只能站在链路两端：

```txt
入口：把人类意图变成 governed command envelope
出口：把 governed read models 变成 Commander view records
```

Commander 不得站在中间替 Orchestration / Nerve Bus / AI / Forensics 工作。

---

## 3. 标准包结构

```txt
src/capabilities/commander-console/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── registry.ts
├── index.ts
├── ports/
│   ├── command-transport-port.ts
│   ├── mission-read-model-port.ts
│   ├── forensics-read-model-port.ts
│   ├── capability-health-read-model-port.ts
│   ├── audit-read-model-port.ts
│   ├── runtime-proof-read-model-port.ts
│   ├── map-package-read-model-port.ts
│   └── commander-clock-port.ts
├── shared/
│   ├── commander-result.ts
│   ├── commander-proof.ts
│   ├── commander-runtime-proof-schema.ts
│   ├── commander-command-policy.ts
│   ├── commander-transport-schema.ts
│   ├── commander-view-schema.ts
│   └── commander-view-types.ts
├── runtime/
│   ├── commander-console-executor.ts
│   ├── commander-command-gate.ts
│   ├── commander-read-gate.ts
│   ├── commander-timeout-gate.ts
│   ├── commander-idempotency-gate.ts
│   ├── commander-transport-semantic-gate.ts
│   ├── commander-command-child-executor.ts
│   ├── commander-read-child-executor.ts
│   ├── commander-proof-builder.ts
│   ├── commander-result-builder.ts
│   └── commander-dispatch-failure.ts
└── children/
    ├── issue-human-command/
    ├── show-capability-roster/
    ├── show-capability-health/
    ├── show-mission-dashboard/
    ├── show-operational-map-progress/
    ├── show-runtime-proof-timeline/
    ├── show-evidence-packets/
    ├── show-browse-ledger/
    ├── show-failed-records/
    ├── show-review-queue/
    ├── show-audit-summary/
    ├── pause-mission/
    ├── resume-mission/
    ├── stop-mission/
    ├── emergency-stop/
    ├── approve-candidate/
    ├── reject-candidate/
    ├── mark-review-required/
    └── inspect-record-detail/
```

禁止：

```txt
src/features/operator-control
compat commander root
legacy bridge root
flat children.ts as fake registry
verify scripts as release truth
```

---

## 4. Public Contract

Public interface 只允许：

```ts
interface CommanderConsoleAbilityGroup {
  listChildAbilityIds(): CommanderConsoleChildAbilityId[];
  execute(input: CommanderConsoleInput): Promise<GovernedCommanderConsoleResult>;
}
```

允许 public exports：

```txt
createCommanderConsoleAbilityGroup
COMMANDER_CONSOLE_ABILITY_GROUP_ID
CommanderConsoleInput
CommanderConsolePublicResult
CommanderHumanCommandEnvelope
Commander view record types
Commander schema validators
```

禁止 public exports：

```txt
raw OrchestrationAbilityGroup
CommandTransportPort implementation
Forensics storage internals
runtime executor internals
child implementation
EvidenceStoreService
LocalAiGateway
BrowserController
TaskRun
RuntimeDeliveryState
ProductOpportunityCandidate
```

---

## 5. Command Path

Command pipeline：

```txt
input schema gate
→ child registry gate
→ command policy gate
→ explicit map/platform gate
→ timeout gate
→ idempotency gate
→ command envelope builder
→ command transport
→ transport semantic gate
→ command receipt builder
→ proof builder
→ result builder
```

Command children：

```txt
issue-human-command
pause-mission
resume-mission
stop-mission
emergency-stop
approve-candidate
reject-candidate
mark-review-required
```

All command children must call:

```txt
executeCommanderCommandChild
```

Forbidden:

```txt
child directly calls transport
child directly calls orchestration
child directly writes Forensics
child directly mutates candidate
```

---

## 6. Start Mission

User-facing ordinary mode may start via:

```txt
taskTemplateId
```

Developer mode may show:

```txt
mapId
packageId
activationId
activationSnapshotRef
stepId
childCapabilityId
promptContractId
```

But the emitted HumanCommandEnvelope for `start-mission` must contain:

```txt
requestedPlatformId
selectedMapId
```

and should contain when available:

```txt
taskTemplateId
activationId
activationSnapshotRef
```

Forbidden:

```txt
defaultRequestedPlatformId
requestedPlatformId ?? "tiktok-web"
silent default map
silent default platform
start-mission success without requestedPlatformId
start-mission success without selectedMapId
```

---

## 7. Review Commands

Review commands:

```txt
approve-candidate
reject-candidate
mark-review-required
```

Required:

```txt
targetRecordRef.recordType = candidate
targetRecordRef.recordId
operatorRef
operatorNote optional
```

Forbidden:

```txt
direct setCandidateDisposition
direct ProductOpportunityCandidate mutation
direct Forensics storage write
review command without candidate ref
```

---

## 8. Emergency Stop

Emergency stop rules:

```txt
commandType = emergency-stop
priority = emergency
idempotencyPolicy = hard-stop-non-dedupe
hardStopDecision required
```

Forbidden:

```txt
downgrade to stop-mission
dedupe away emergency-stop
transport failure treated as success
review_required treated as success
```

---

## 9. Read Path

Read pipeline:

```txt
input schema gate
→ read model source gate
→ read model port
→ output schema gate
→ evidence/proof ref gate
→ Commander view record builder
→ proof builder
→ result builder
```

Read children：

```txt
show-capability-roster
show-capability-health
show-mission-dashboard
show-operational-map-progress
show-runtime-proof-timeline
show-evidence-packets
show-browse-ledger
show-failed-records
show-review-queue
show-audit-summary
inspect-record-detail
```

All read children must call:

```txt
executeCommanderReadChild
```

Read model ports:

```txt
OrchestrationMissionReadModel
ForensicsReadModelPort
CapabilityHealthReadModelPort
AuditReadModelPort
RuntimeProofReadModelPort
MapPackageReadModelPort if needed
```

Forbidden:

```txt
UI-only runtime truth
direct EvidenceStoreService
direct local-data
legacy runtime snapshot as public truth
TaskRun / activeTaskRunId naming
```

---

## 10. Runtime Proof

`CommanderRuntimeProof` must include:

```yaml
proofId: required
abilityGroupId: commander-console
childCapabilityId: required
childKind: command | read
operatorRef: required
inputRef: required
outputRef: optional
diagnosticPayloadRef: optional
commandId: optional
readRequestId: optional
commandEnvelopeRef: optional
resultEnvelopeRef: optional
readModelSource: optional
targetRecordRef: optional
evidenceRefs: list
startedAt: required
endedAt: required
durationMs: required
status: success | failed | review_required
failureReason: required-if-failed
reviewRequiredReason: required-if-review_required
boundaryDecision: required
commandDecision: required-if-command
readDecision: required-if-read
transportDecision: required-if-command
hardStopDecision: required-if-emergency
policyDecision: required
timeoutDecision: required
idempotencyDecision: required
dataQualityFlags: list
```

Forbidden:

```txt
runtimeProof:null
success without proof
failed without failureReason
review_required without reviewRequiredReason
public execute throw
```

---

## 11. Transport Semantic Gate

`CommandTransportResult` must be semantically validated:

```txt
result.commandId === command.commandId
accepted requires envelopeRef
failed requires failureReason
review_required requires reviewRequiredReason
status enum only
resultEnvelopeRef policy applied
```

Forbidden:

```txt
schema parse only
commandId mismatch accepted
accepted without envelopeRef
failed without reason
review_required without reason
```

---

## 12. Timeout / Idempotency

Each child contract has:

```txt
maxDurationMs
idempotencyPolicy
```

These fields must be executed, not just metadata.

Timeout:
```txt
timeout starts before command/read execution
timeout produces typed failed/review result
proof records timeoutDecision
```

Idempotency:
```txt
idempotent-read for read children
dedupe-command for normal commands
hard-stop-non-dedupe for emergency-stop
duplicate command cannot execute twice
duplicate hard-stop cannot be swallowed
proof records idempotencyDecision
```

---

## 13. Map Package / Task Template UX

Commander can show:

```txt
quarantine
validation
approve
active
rollback
draft-only
disabled
not runnable
Map Lab natural-language authoring -> preview -> human approve -> governed activate -> return to start surface
```

Commander cannot:

```txt
validate maps as final truth
write active registry
execute maps
activate maps directly without governed port/API
make draft AI map runnable
```

Ordinary start surface:

```txt
displayName
description
version
availability
safetyLevel
run limits
start button
```

Developer/Map Manager:

```txt
packageId
mapId
activationId
activationSnapshotRef
stepId
childCapabilityId
dependency list
validation findings
compatibility matrix
promptContractId
Map Lab draft explanation / required clarifications / risk warnings / validation hints
approve / activate actions only through governed Map Lab API
```

---

## 14. Boundary Bans

Commander root cannot import:

```txt
BrowserController
src/lib/browser/**
src/capabilities/ai/**/implementation
src/capabilities/orchestration/**/implementation
src/capabilities/forensics-persistence/**/storage
src/capabilities/open/children/**
src/capabilities/screenshot/**
src/capabilities/mouse-click/**
src/capabilities/mouse-scroll/**
src/capabilities/text-input/**
src/capabilities/visual-target/**
src/capabilities/geometry-guard/**
src/capabilities/page-state/**/implementation
src/features/local-data
src/features/operator-control
```

---

## 15. 执法系统

Must exist:

```txt
scripts/audit/domains/commander-console-capability/manifest.json
scripts/audit/domains/commander-console-capability/inspector.ts
scripts/audit/domains/commander-console-capability/run-inspector.ts
scripts/audit/domains/commander-console-capability/negative-proof-harness.ts
```

Inspector must use:

```txt
ts-morph
AST-level
symbol-level
import graph-level
schema-level
anti-escape
generated artifact aware
runner-connected
negative-proof-backed
```

Forbidden:

```txt
regex final judgment
grep final judgment
includes final judgment
manual-only proof
warning-only P0
detached inspector
empty negative proof
```

---

## 16. Inspector 必查

```txt
1. Law file machine-blocking.
2. Public interface only listChildAbilityIds + execute.
3. Child registry/folder/schema parity.
4. Command child uses executeCommanderCommandChild.
5. Read child uses executeCommanderReadChild.
6. Start command explicit requestedPlatformId + selectedMapId after template resolution.
7. No silent default platform/map.
8. Emergency stop hard path.
9. Timeout gate invoked.
10. Idempotency gate invoked.
11. Transport semantic gate invoked.
12. Read proof/source gate invoked.
13. No forbidden owner imports.
14. No legacy public truth types.
15. External task/candidate APIs call Commander public interface.
16. Local shell render-only.
17. Startup bootstrap-only.
18. runtimeProof non-null.
19. public execute non-throwing.
20. ALL active laws in registry/matrix/audit-plan/runner.
21. negative proof executed.
```

---

## 17. Negative Proof 最低清单

Must fail → rollback → pass:

```txt
manual-first enforcement reintroduced
start-mission only requestedPlatformId
start-mission only selectedMapId
requestedPlatformId ?? "tiktok-web"
transport accepted without envelopeRef
transport commandId mismatch
emergency-stop downgraded to stop-mission
emergency-stop idempotency changed to dedupe-command
read model returns UI-only proofless truth
Commander imports BrowserController
Commander imports Forensics storage internals
Commander imports AI runtime
Commander directly calls orchestration.startMission
Commander directly writes Forensics
Task handler calls workbench.startTask
Candidate handler calls setCandidateDisposition
index.ts export *
runtimeProof:null
public execute throw
remove negative proof invocation
turn P0 into warning-only
```

---

## 18. READY 标准

### 18.1 start-mission runId 传输契约补充

正确链路：

```txt
Commander commandId
-> CommandTransportResultSchema.runId
-> CommanderTransportSemanticResult.runId
-> createTransportOutcome.runId
-> Commander runtimeProof.runId
-> Local App Shell COMMAND_ACCEPTED / COMMAND_REJECTED refs
```

禁止链路：

```txt
MISSION_PREFLIGHT_PASSED 后 createTransportOutcome 写入 runId:null
semantic failure / review_required path 写入 CommanderTransportSemanticResult.runId:null
command child runtimeProof 对 command proof 接受 runId:null
COMMAND_REJECTED 只暴露 raw ZodError 而没有 ownerResponsible/actionableMessage
transport result 不带 runId 仍被 semantic gate 接受
```

inspector 必须覆盖：

```txt
CommandTransportResultSchema 必须声明 runId
Commander transport semantic gate 必须读取并验证 input.result.runId
Commander transport semantic gate 的 schema failure / semantic failure / review_required builder 必须继承 commandId 派生的 non-null runId 或 transport runId，不得写 null
createTransportOutcome 必须从 transport.runId 写入 outcome.runId
dispatched command outcome 不得出现 runId:null
RuntimeProofSchema 必须对 childKind=command 拒绝 runId:null
Local App Shell 写 COMMAND_REJECTED 时必须把 commandEnvelopeRef/resultEnvelopeRef/runtimeProofRef 放入 refs/proofRefs
```

negative proof 必须覆盖：

```txt
删除 CommandTransportResultSchema.runId 必须 FAIL
把 createTransportOutcome.runId 改回 null 必须 FAIL
把 buildSemanticFailure / buildSemanticReviewRequired 的 runId 改回 null 必须 FAIL
把 command proof runId 校验删除必须 FAIL
删除 COMMAND_REJECTED refs/proofRefs 传播必须 FAIL
```

READY 标准补充：

```txt
start-mission dispatch result has non-null runId
Commander runtime proof preserves the same runId
terminal and runtime debug API COMMAND_REJECTED include ownerResponsible/actionableMessage plus command/result/proof refs when dispatch fails
```

Commander READY only when:

```txt
Commander 法案 / 施工图 / inspector / generated / runner 口径一致
ALL active law enforcement PASS
CI-FULL PASS
human command entry Commander-only
public surface execute-only
start command explicit platform/map
no silent default
transport semantic gate hard
timeout/idempotency real
emergency-stop hard path
read models proof-backed
no foreign owner imports
no legacy truth types
negative proof PASS
```

---

## 19. 运行日志闭环补充：start-mission 接受边界不得等待整场任务

本节只补齐 `issue-human-command` 的执行细节，不新增 lawId。

### 正确链路

```txt
Commander Console receives start-mission
→ validates requestedPlatformId / selectedMapId / taskTemplateId / activationSnapshotRef
→ builds command envelope and Nerve Bus envelope
→ Orchestration receives command
→ activation snapshot frozen
→ COMMAND_ACCEPTED emitted as command-acceptance truth
→ issue-human-command returns governed accepted receipt
→ mission loop continues asynchronously and emits mission-level runtime events
```

`issue-human-command` 的 5000ms timeout 只保护命令接受、transport semantic gate、idempotency 和 receipt 构建边界。它不得等待整场 mission loop 到 terminal status。

### 禁止链路

```txt
COMMAND_ACCEPTED
→ await orchestrationAbilityGroup.startMission until mission terminal state
→ issue-human-command timeout
→ COMMAND_REJECTED for the same command
```

同一个 start command 一旦已经记录 `COMMAND_ACCEPTED`，后续任务 review/fail/completed 只能作为 mission-level truth 记录，不得再生成 command-level `COMMAND_REJECTED`。

### Inspector 应覆盖

- AST 检查 `handleStartMission` 不得 `await runtime.orchestrationAbilityGroup.startMission(...)`。
- AST 检查 `handleStartMission` 必须在记录 `COMMAND_ACCEPTED` 后以 background promise 启动 mission loop。
- AST 检查 background promise 必须带 rejection guard，避免 unhandled rejection。
- 保留 timeout gate、idempotency gate、transport semantic gate、runtime proof refs 原有检查。

### Negative Proof 应覆盖

- 将 background `startMission` 改回 `await runtime.orchestrationAbilityGroup.startMission(...)` 必须 FAIL。
- 删除 timeout gate 仍必须 FAIL。
- 删除 command/result/proof refs 仍必须 FAIL。

### 结构化日志必备字段

`COMMAND_ACCEPTED` 必须包含：

```txt
traceId
runId
missionId
selectedMapId
requestedPlatformId
activationSnapshotRef
ownerResponsible
actionableMessage
resultEnvelopeRef / runtimeProofRef where available
```

任务后续进入 `MISSION_REVIEW_REQUIRED` / `MISSION_FAILED` / `MISSION_FINALIZED` 时，必须使用 mission event，不得反写 command rejected。

### READY 标准

- 真实重启后，start-mission 可在 5000ms Commander child timeout 内返回 accepted receipt。
- 最新日志不得出现同一 `commandId/runId` 先 `COMMAND_ACCEPTED` 后 `COMMAND_REJECTED`。
- 如果任务之后因安全页、captcha、policy 或真实平台状态进入 review，必须是 mission-level `review_required`。
- 修复后必须真实重启、真实触发任务、重新执行第一阶段日志分析。

---

## 20. 漂移信号

```txt
Commander 直连 Orchestration
Commander 直连 Forensics storage
Commander 直连 AI/local runtime
Commander 直连 Browser/action
Map Lab UI 直连 AI child/provider/runtime adapter
Map Lab UI 直改 map registry / quarantine / activation internals
task-api-handlers 绕过 Commander
candidate-api-handlers 绕过 Commander
Commander 使用 TaskRun / activeTaskRunId
Commander 使用 ProductOpportunityCandidate
start mission 自动补 tiktok-web
transport result 只 schema parse
```

---

## 21. 最终原则

```txt
Commander 只接收人类命令。
Commander 只发 governed envelope。
Commander 只读 governed read model。
Commander 不执行、不判断、不落盘、不推进地图。
```
