# GrassEye Orchestration 总指挥能力组施工图 FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-ORCHESTRATION-BLUEPRINT-FINAL
owner: orchestration-capability
documentType: construction-blueprint
lawAuthority: module-orchestration-capability.instructions.md
architecturePhase: Static Capability Package Architecture
futureCompatibleWith: Controlled Pluggable Map Package
status: active
replace:
  - docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md
mustNotCreate:
  - new lawId
  - new ability group
  - map child ability
  - browse-flow owner
  - agent-runtime mission owner
  - platform-flow owner
  - forensics-finalizer owner
  - commander-state owner
```

本施工图是 `module-orchestration-capability.instructions.md` 的建设级落地映射。  
本施工图不新增 lawId，不修改冻结法案，不重新分配主权。  
若本文档与 Orchestration 法案冲突，以 Orchestration 法案为最高权威。

---

## 1. 定位

Orchestration 是 GrassEye 的总指挥能力组。

它负责：

```txt
接收 governed mission command
选择且冻结 operational map
推进 mission state
推进 step state
通过 Nerve Bus 调度能力组
评估 branch / transition
升级 human review
执行 pause/resume/stop/emergency-stop/finalize
生成 mission/step/dispatch/transition/runtime proof
```

它不负责：

```txt
接收原始人类命令
作为 Commander UI
直接执行浏览器动作
直接调用子能力 implementation
直接调用 primitive port
构造 raw prompt
执行 AI runtime
写 Forensics storage
做产品判断
做截图/点击/滚动/输入
```

一句话：

```txt
Orchestration 负责“按冻结地图指挥任务怎么走”，不是动作执行器，也不是人类控制台。
```

---

## 2. 故事链路位置

```txt
Human
→ Commander Console
→ governed mission command envelope
→ Nerve Bus / governed transport
→ Orchestration
→ frozen operational map
→ step dispatch through Nerve Bus
→ ability group result
→ transition evaluation
→ next step / review / finalization
→ Forensics persistence request
```

边界关系：

```txt
Commander Console 接人类命令。
Orchestration 选地图、管任务状态、派发步骤、评估分支。
Nerve Bus 负责 envelope dispatch。
各能力组执行自己的窄能力。
PAV 验证动作后结果。
Forensics 保存证据链。
```

---

## 3. 标准包结构

```txt
src/capabilities/orchestration/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── registry.ts
├── index.ts
├── internal.ts
├── ports/
│   ├── orchestration-clock-port.ts
│   ├── orchestration-idempotency-port.ts
│   ├── orchestration-map-store-port.ts
│   ├── orchestration-nerve-bus-port.ts
│   └── orchestration-state-port.ts
├── shared/
│   ├── orchestration-failure.ts
│   ├── orchestration-map.ts
│   ├── orchestration-policy.ts
│   ├── orchestration-proof.ts
│   ├── orchestration-result.ts
│   ├── orchestration-step.ts
│   └── orchestration-transition.ts
├── runtime/
│   ├── mission-command-gate.ts
│   ├── mission-state-policy-gate.ts
│   ├── map-selection-gate.ts
│   ├── map-validation-gate.ts
│   ├── orchestration-frozen-activation.ts
│   ├── orchestration-map-store.ts
│   ├── mission-state-store.ts
│   ├── orchestration-nerve-bus-adapter.ts
│   ├── step-dispatcher.ts
│   ├── step-dispatch-timeout-gate.ts
│   ├── transition-evaluator.ts
│   ├── loop-guard.ts
│   ├── orchestration-post-action-verification.ts
│   ├── orchestration-proof-builder.ts
│   ├── orchestration-result-builder.ts
│   ├── orchestration-executor-start.ts
│   ├── orchestration-executor-loop.ts
│   ├── orchestration-executor-loop-iteration.ts
│   ├── orchestration-executor-resume.ts
│   ├── orchestration-executor-commands.ts
│   ├── orchestration-executor.ts
│   └── orchestration-dispatch-failure.ts
├── children/
│   ├── start-mission/
│   ├── pause-mission/
│   ├── resume-mission/
│   ├── stop-mission/
│   ├── emergency-stop/
│   ├── execute-map-step/
│   ├── evaluate-step-transition/
│   ├── request-human-review/
│   └── finalize-mission/
└── maps/
    └── data-only operational map packages
```

禁止：

```txt
browse-next-video child
product-video-detection child
comment-evidence child
raw browser/action child
capability-check.ts
verify-*.ts as release gate
legacy browse-flow runtime
```

---

## 4. Public Contract

Public interface 只允许：

```ts
interface OrchestrationAbilityGroup {
  listChildCapabilityIds(): OrchestrationChildCapabilityId[];
  execute(input: OrchestrationAbilityInput): Promise<OrchestrationAbilityResult>;
}
```

允许 public exports：

```txt
createOrchestrationAbilityGroup
ORCHESTRATION_ABILITY_GROUP_ID
OrchestrationAbilityInput
OrchestrationAbilityResult
OrchestrationRuntimeProof
MissionCommand
MissionState
OperationalMap
OperationalStep
Transition
Orchestration public schemas
Orchestration port types
```

禁止 public exports/imports：

```txt
child implementation
runtime executor internals as external API
Commander Console internals
Nerve Bus internals beyond port
Forensics runtime internals
browser primitive implementations
platform adapter implementation
raw prompt builder
legacy browse-flow helpers
```

---

## 5. Mission Command Input

`OrchestrationAbilityInput` / mission command 必须包含：

```yaml
OrchestrationAbilityInput:
  abilityGroupId: orchestration
  childCapabilityId: required
  commandKind: start-mission | pause-mission | resume-mission | stop-mission | emergency-stop | submit-review-decision
  requestedBy: commander-console | nerve-bus
  missionId: required
  runId: required
  sessionId: required
  roundId: optional
  videoVisitId: optional
  requestedPlatformId: required-for-start
  preferredMapId: optional
  selectedMapId: optional
  taskTemplateId: optional
  activationId: optional
  humanGoal: required-for-start
  commanderCommandRef: required
  commanderEnvelopeRef: required
  nerveBusEnvelopeId: required
  sourceRef: required
  inputRef: required
  idempotencyKey: required
```

Start mission 不允许：

```txt
requestedPlatformId missing
selectedMap/preferredMap/taskTemplate/activation 全部缺失
defaultRequestedPlatformId
requestedPlatformId ?? "tiktok-web"
selectedMapId ?? defaultMapId
```

---

## 6. Mission State

`MissionState` 必须包含：

```yaml
MissionState:
  missionId: required
  runId: required
  sessionId: required
  missionStatus: idle | pending | running | paused | completed | failed | review_required | stopped
  currentStepId: required-if-running
  previousStepId: optional
  selectedMapId: required
  selectedMapVersion: required
  mapPackageId: required
  mapPackageVersion: required
  activationId: required
  activationSnapshotRef: required
  promptContractVersion: required-if-ai-steps
  capabilityCatalogVersion: required
  platformProfileVersion: required
  selectedMapSource: required
  compatibilityDecision: required
  stateRevision: required
  stateHash: required
  payloadRefs: required
  branchHistory: list
  stepHistory: list
  emergencyStopLatched: boolean
  reviewState: optional
  createdAt: required
  updatedAt: required
```

运行中不得 nullable：

```txt
selectedMapVersion
mapPackageVersion
activationSnapshotRef
capabilityCatalogVersion
```

---

## 7. Map Package Lifecycle

Operational map lifecycle：

```txt
import
→ quarantine
→ schema validation
→ dependency validation
→ transition closure validation
→ capability registry validation
→ prompt contract validation
→ platform profile validation
→ compatibility validation
→ dry-run validation
→ human approval
→ activation
→ active registry
→ rollback
```

每个 active map record 必须包含：

```yaml
ActiveOperationalMapRecord:
  mapId: required
  mapVersion: required
  packageId: required
  packageVersion: required
  activationId: required
  activationSnapshotRef: required
  promptContractVersion: required
  capabilityCatalogVersion: required
  platformProfileVersion: required
  approvedBy: required
  approvedAt: required
  compatibilityDecision: required
  operationalMap: required
  rollbackRecordRef: optional
```

禁止：

```txt
unapproved map active
unvalidated map active
AI generated draft map active
legacy static TS map selected as active truth
map package contains code
map package calls Nerve Bus
map package mutates state
```

---

## 8. Frozen Activation

Start mission 必须：

```txt
select exactly one active approved map
freeze activationSnapshotRef
freeze selectedMapVersion
freeze mapPackageVersion
freeze promptContractVersion
freeze capabilityCatalogVersion
freeze platformProfileVersion
write frozen fields into MissionState
write frozen fields into RuntimeProof
```

Resume mission 必须：

```txt
load map by activationSnapshotRef / activationId
not latest active map lookup
not reselect by taskTemplateId unless starting a new mission
```

禁止：

```txt
running mission looks up latest active map
resume selects latest map
step dispatch reloads active map by selectedMapId only
runtime proof only stores selectedMapId
cross-step backfill without activationSnapshotRef
```

---

## 9. Dispatch Through Nerve Bus

All step dispatches go through OrchestrationNerveBusPort：

```txt
sendCommandToAbility
sendRequestToAi
sendReviewRequestToCommander
```

Dispatch payload 必须包含：

```yaml
DispatchPayload:
  missionId: required
  runId: required
  sessionId: required
  roundId: optional
  videoVisitId: optional
  stepId: required
  mapPackageId: required
  mapPackageVersion: required
  selectedMapId: required
  selectedMapVersion: required
  activationSnapshotRef: required
  capabilityCallId: required
  nerveBusEnvelopeId: generated/returned
  targetAbilityGroupId: required-if-ability-step
  targetChildCapabilityId: required-if-ability-step
  promptContractId: required-if-ai-step
  promptContractVersion: required-if-ai-step
  outputSchemaRef: required-if-ai-step
  payloadRefs: required
  idempotencyKey: required
  timeoutMs: required
```

Step success requires：

```txt
nerveBusEnvelopeId exists
resultRef or outputRef according to step kind
dispatchResultStatus exists
```

### 9.1 Dispatch Lifecycle Runtime Events

正确链路：

```txt
STEP_DISPATCH_STARTED
-> CAPABILITY_CALL_STARTED (ordinary ability step)
-> CAPABILITY_CALL_COMPLETED / CAPABILITY_CALL_FAILED / CAPABILITY_CALL_REVIEW_REQUIRED
-> STEP_TRANSITION_EVALUATED
-> MISSION_FINALIZED / MISSION_FAILED / MISSION_REVIEW_REQUIRED / MISSION_STOPPED
```

PAV 特例链路：

```txt
STEP_DISPATCH_STARTED
-> POST_ACTION_VERIFICATION_STARTED
-> POST_ACTION_VERIFICATION_PASSED / POST_ACTION_VERIFICATION_FAILED / POST_ACTION_VERIFICATION_REVIEW_REQUIRED
-> STEP_TRANSITION_EVALUATED
```

错误链路：

```txt
把 STEP_DISPATCH_STARTED 当成 capability owner 已开始执行的唯一证明
ordinary ability step 缺少显式 CAPABILITY_CALL_STARTED
terminal mission state 没有映射成明确 runtime eventType
用推断代替结构化 started event
```

---

## 10. Step Preconditions

Action step preconditions：

```txt
AI vision step 前必须有 prepare-ai-input。
mouse-click 前必须有 visual-target + geometry-guard handoff。
mouse-scroll 前必须有 geometry-guard handoff。
text-input 前必须有 approved text + verified input target handoff。
动作后必须有 post-action-verification。
evidence output 必须路由到 forensics-persistence。
```

禁止：

```txt
mouse-click step without PAV
mouse-scroll step without PAV
text-input step without PAV
evidence output bypassing Forensics
action ability result treated as final success without PAV
```

---

## 11. Transition Evaluation

Transition 必须：

```txt
come from frozen map transitions
reference existing fromStepId / toStepId
use declared condition source only
use outputSchemaRef-declared fields only
match exactly one transition
record transitionId
record branchTaken
```

禁止：

```txt
branch reads undeclared payload field
AI branch uses raw natural-language reasoning
ambiguous transition returns success
no transition treated as success
hidden next-step logic outside transition-evaluator
platform adapter next-step logic
```

---

## 12. Prompt Contract

AI step 必须：

```txt
promptContractId from frozen map step
promptContractVersion from activation snapshot
outputSchemaRef from map step
Nerve Bus request carries promptContractId + outputSchemaRef
```

Orchestration 禁止：

```txt
raw prompt string
prompt template construction
hardcoded prompt selection
latest prompt catalog lookup during running mission
AI runtime chooses prompt for Orchestration
```

---

## 13. Loop Guard

Mission loop 必须限制：

```txt
maxRounds
maxMinutes
maxStepCount
maxDispatchTimeoutMs
emergencyStopLatched
reviewRequired
failed state
completed state
```

禁止：

```txt
while true without guard
continue after emergency-stop
continue after review_required unless governed review resume command
continue after failed/completed/stopped
```

---

## 14. Forensics Boundary

Orchestration 可：

```txt
build persistence request
send cleaned payload refs to Forensics through Nerve Bus/public contract
consume persistence refs
forward screenshot artifactLifecycleManifestRef / artifactHash as cleaned refs only
request promotion / cleanup through Forensics public contract only
surface screenshot quota/backpressure as typed fail/review outcomes
```

Orchestration 不可：

```txt
import forensics-persistence/runtime/**
write storage directly
hide finalization inside Forensics
let Forensics mutate mission state
let Forensics decide branchTaken/finalRoundStatus
self-promote screenshot artifacts to promoted-evidence / legal-hold-evidence
drop screenshot quota/backpressure or cleanup-blocker failures
```

---

## 15. Result Model

`OrchestrationAbilityResult` 必须包含：

```yaml
status: success | failed | review_required
abilityGroupId: orchestration
childCapabilityId: required
commandKind: required
missionId: required
runId: required
sessionId: required
roundId: optional
videoVisitId: optional
selectedMapId: required
selectedMapVersion: required
mapPackageId: required
mapPackageVersion: required
activationId: required
activationSnapshotRef: required
promptContractVersion: optional
capabilityCatalogVersion: required
currentStepId: optional
previousStepId: optional
stateRevisionBefore: required
stateRevisionAfter: required
stateHashBefore: optional
stateHashAfter: required
nerveBusEnvelopeId: required-if-dispatched
capabilityCallId: required-if-dispatched
transitionId: required-if-transition
branchTaken: optional
loopDecision: optional
finalizationDecision: optional
output: required-if-success
failureReason: required-if-failed
reviewRequiredReason: required-if-review_required
diagnosticPayloadRef: required-if-not-success
debugLogRef: required
runtimeProof: required
startedAt: required
endedAt: required
durationMs: required
```

---

## 16. Runtime Proof

`OrchestrationRuntimeProof` / step proof 必须包含：

```yaml
proofId: required
missionId: required
runId: required
sessionId: required
roundId: optional
videoVisitId: optional
stepId: required
previousStepId: optional
selectedMapId: required
selectedMapVersion: required
mapPackageId: required
mapPackageVersion: required
activationId: required
activationSnapshotRef: required
promptContractVersion: optional
capabilityCatalogVersion: required
targetAbilityGroupId: optional
targetChildCapabilityId: optional
capabilityCallId: required-if-dispatched
nerveBusEnvelopeId: required-if-dispatched
idempotencyKey: required
sequenceNo: required
stateRevisionBefore: required
stateRevisionAfter: required
stateHashBefore: optional
stateHashAfter: required
dispatchDecision: required
dispatchTimeoutDecision: required
dispatchResultStatus: optional
transitionEvaluationDecision: required-if-transition
transitionId: required-if-transition
transitionConditionSource: optional
transitionConditionExpected: optional
transitionConditionActual: optional
branchTaken: optional
loopDecision: optional
finalizationDecision: optional
startedAt: required
endedAt: required
durationMs: required
status: required
failureReason: optional
reviewRequiredReason: optional
receivedShapeHash: required-if-invalid-input
```

禁止：

```txt
runtimeProof:null
selectedMapVersion nullable in valid running mission
activationSnapshotRef nullable in valid running mission
step success without nerveBusEnvelopeId
transition success without transitionId
runId fabricated from missionId/step
MISSION_PREFLIGHT_PASSED 后才由 MissionCommandSchema 发现 start-mission command shape 无效
```

start-mission preflight 补充：

```txt
Local App Shell 在 Nerve Bus dispatch 前必须用 Orchestration MissionCommandSchema 对最终 start-mission command 形状做 dry-run validation。
dry-run 必须包含 requestedPlatform、selectedMapId/preferredMapId、taskTemplateId、activationId、targetProfileRef、non-null generated runId。
MissionCommandSchema dry-run failed 时必须返回 MISSION_PREFLIGHT_FAILED / COMMAND_REJECTED，不得继续创建 Nerve Bus envelope。
inspector 必须覆盖 task-start-flow 传入 activationId/activationSnapshotRef/targetProfileRef，workbench-status 调用 MissionCommandSchema.safeParse，且存在 missionCommandSchema preflight component。
negative proof 必须覆盖删除 missionCommandSchema component、删除 MissionCommandSchema.safeParse、删除 activationId 传递三类生产突变。
READY 标准：preflight passed 后不允许出现仅因 MissionCommandSchema path=runId/null 导致的 COMMAND_REJECTED。
```

---

## 17. Child Capabilities

| child | 作用 |
|---|---|
| start-mission | 接收 governed mission command，选择并冻结 active approved map |
| pause-mission | 暂停 mission state |
| resume-mission | 以 frozen activation 恢复 mission |
| stop-mission | 停止 mission |
| emergency-stop | latch emergency stop，阻断后续 dispatch |
| execute-map-step | 根据 frozen map 执行当前 step dispatch |
| evaluate-step-transition | 基于声明字段评估 transition |
| request-human-review | 通过 governed review channel 请求人工复核 |
| finalize-mission | 结算 mission outcome |

禁止新增：

```txt
browse-next-video
product-video-detection
comment-evidence
platform-specific action child
raw browser child
```

---

## 18. 执法系统

必须存在：

```txt
scripts/audit/domains/orchestration-capability/manifest.json
scripts/audit/domains/orchestration-capability/inspector.ts
scripts/audit/domains/orchestration-capability/run-inspector.ts
scripts/audit/domains/orchestration-capability/negative-proof-harness.ts
```

Inspector 必须：

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

禁止：

```txt
regex final judgment
grep final judgment
includes final judgment
manual-only proof
warning-only P0
detached inspector
empty negative proof
capability-check.ts as acceptance
verify script as release truth
```

---

## 19. Inspector 必查

```txt
1. Law file is machine-blocking.
2. Commander entry boundary enforced.
3. No silent platform/map fallback.
4. Map package data-only.
5. Map lifecycle validation gates.
6. Activation snapshot frozen and non-null.
7. No latest map lookup during running/resume.
8. Dispatch only through Nerve Bus.
9. Dispatch payload/proof includes full chain fields.
10. Step preconditions enforced.
11. PAV-after-action enforced.
12. Forensics routing enforced.
13. Transition declared-field only.
14. PromptContract/outputSchemaRef sourced from frozen map.
15. No raw prompt building.
16. Forensics cannot own finalization.
17. Result/proof/state/input parity.
18. Children use unified runtime.
19. No forbidden imports/legacy browse-flow.
20. ALL active laws in registry/matrix/audit-plan/runner.
21. negative proof executed.
```

### 19.1 当前 blocker 补充

Orchestration owner inspector 必须额外覆盖：

```txt
recordDispatchStarted emits CAPABILITY_CALL_STARTED for ordinary ability steps
recordDispatchStarted still emits POST_ACTION_VERIFICATION_STARTED for PAV steps
mission-loop event semantics survives file splits and still covers terminal mission event mapping
该条检查必须通过 AST / symbol / structured parser 完成，不能用 grep/includes 作为最终结论
```

---

## 20. Negative Proof 最低清单

必须 fail → rollback → pass：

```txt
manual-first enforcement reintroduced
remove activationSnapshotRef from mission state
remove activationSnapshotRef from proof
selectedMapVersion nullable on running state
resume calls latest active map lookup
requestedPlatform fallback to tiktok-web
selectedMap fallback to defaultMap
step success without nerveBusEnvelopeId
direct import of open child implementation
direct import of forensics runtime
AI step builds raw prompt
AI step without outputSchemaRef
branch reads undeclared AI output field
mouse-click step without PAV
mouse-scroll step without PAV
evidence output bypasses Forensics
ambiguous transition returns success
remove loop guard
emergency-stop continues dispatch
add browse-next-video child
map package contains executable function
activate unapproved map
capability-check.ts added
remove negative proof invocation
turn P0 into warning-only
```

### 20.1 当前 blocker 补充

必须 fail → rollback → pass：

```txt
remove CAPABILITY_CALL_STARTED eventType from orchestration-loop-iteration-events
remove recordCapabilityCallStarted call from recordDispatchStarted
rename terminal mission eventType so runtime semantics no longer exposes MISSION_FAILED / MISSION_FINALIZED / MISSION_REVIEW_REQUIRED / MISSION_STOPPED
```

---

## 21. READY 标准

### 21.1 runtime proof runId 链路补充

正确链路：

```txt
Nerve Bus human_command.runId
-> MissionCommand.runId
-> MissionState.activeTaskRunId
-> RuntimeProofSchema.runId
-> buildOrchestrationRuntimeProof(input.runId)
```

禁止链路：

```txt
MissionCommand 不接收 runId
activeTaskRunId 由 selectedMapId 重新拼接
RuntimeProofSchema 缺 runId
buildOrchestrationRuntimeProof 不能发出 runId
preflight passed 后才发现 runId null
```

inspector 必须覆盖：

```txt
MissionCommandSchema 必须声明 runId
RuntimeProofSchema 必须声明 runId
BuildProofInput 必须声明 runId
buildOrchestrationProofIdentityFields 必须发出 input.runId
```

negative proof 必须覆盖：

```txt
删除 RuntimeProofSchema.runId 必须 FAIL
删除 proof builder 的 runId 发出必须 FAIL
```

READY 标准补充：

```txt
Orchestration accepted mission proof has non-null runId
failure proof has explicit failure runId and owner/actionable log
Mission preflight has commandTransportContract component
```

### 21.2 当前 blocker 补充

```txt
ordinary ability step dispatch has explicit CAPABILITY_CALL_STARTED proof in structured runtime log
PAV step keeps explicit POST_ACTION_VERIFICATION_STARTED proof and is not conflated with ordinary capability start
terminal mission statuses still map to explicit runtime event types after runtime file splits
只有真实 restart + real task + fresh log re-analysis 确认旧的 missing CAPABILITY_CALL_STARTED blocker 消失后，才能把这一条标 READY
```

Orchestration READY 仅当：

```txt
Orchestration 法案 / 施工图 / inspector / generated / runner 口径一致
ALL active law enforcement PASS
CI-FULL PASS
Commander entry boundary enforced
mission command cannot silently default platform/map
map lifecycle and validation gates complete
activationSnapshotRef frozen and non-null in valid execution
no latest active map lookup during running/resume
dispatch only through Nerve Bus envelope
step payload/proof carries full chain fields
PAV-after-action and Forensics routing enforced
transition evaluation uses declared output schema fields only
prompt selection comes from frozen map step only
Forensics cannot own finalization/branch/mission state
result/proof/state/input chain parity
children narrow lifecycle/transition actions
negative proof PASS
```

---

## 22. 漂移信号

```txt
Orchestration proof lacks activationSnapshotRef
selectedMapVersion nullable while running
resume uses latest active map lookup
requestedPlatform defaults to tiktok-web
step success has no nerveBusEnvelopeId
map package contains code
AI step builds raw prompt
branch reads undeclared fields
mouse-click step lacks PAV
Forensics imports become finalizer
browse-next-video child appears
verify script becomes release gate
```

---

## 23. 最终原则

```txt
Commander 接人类命令。
Orchestration 按冻结地图指挥任务。
Nerve Bus 传递 envelope。
各能力组执行窄能力。
PAV 验证动作后结果。
Forensics 记账存证。
地图是路线，不是运行时。
这些不能混。
```

---

## 24. 实战运行日志透明化修复补充：step branch closure

本节只补施工细节，不新增 lawId，不修改冻结法案。

正确链路：

```txt
map package step.failureBranch / step.reviewBranch
-> operationalMap.failureBranches / operationalMap.reviewBranches 登记
-> operationalMap.transitions.transitionId 实体存在
-> runtime STEP_TRANSITION_EVALUATED 能定位到声明分支
```

禁止链路：

```txt
step 声明 failureBranch / reviewBranch 但只在文本里出现
step 声明 failureBranch / reviewBranch 但没有 transitionId
只验证顶层 branch list，不验证每个 step 自己声明的 branch
运行时失败后才发现 no matching transition
```

inspector 应覆盖：

```txt
validateMapTransitionClosure 必须逐 step 检查 failureBranch / reviewBranch
每个 step branch 必须同时存在于对应顶层 branch list 与 transitions.transitionId
postActionVerification 三个 transition id 必须仍指向可达 PAV step
```

negative proof 应覆盖：

```txt
把 iPhone Mirroring open step 的 failureBranch 改成不存在的 transitionId 必须 FAIL
rollback 后同一 inspector 必须 PASS
删除对应 negative proof 或 inspector binding 必须被 anti-escape 拦截
```

结构化日志必备字段：

```txt
MAP_STEP_SELECTED.stepId
CAPABILITY_CALL_FAILED.stepId
STEP_TRANSITION_EVALUATED.transitionId
STEP_TRANSITION_EVALUATED.fromStepId
STEP_TRANSITION_EVALUATED.branchType
STEP_TRANSITION_EVALUATED.failureReason
STEP_TRANSITION_EVALUATED.ownerResponsible
```

READY 标准补充：

```txt
map-plugin-package inspector PASS
生产突变删除/篡改 step branch closure 后 FAIL
rollback 后 PASS
真实 restart + 真实任务触发 + fresh phase-1 日志分析确认不再出现 no matching transition
```

---

## 25. 实战运行日志透明化补充：AI failure passthrough

本节只补施工细节，不新增 lawId，不修改冻结法案。

Orchestration 对 AI step 的职责是 dispatch、接收 result envelope、评估 transition；不得重写 AI runtime 真相。`CAPABILITY_CALL_FAILED` / `CAPABILITY_CALL_REVIEW_REQUIRED` for AI 必须从 AI response envelope / payload refs 透传诊断摘要：

```txt
failureReason
reviewRequiredReason
implementationStatus
runtimeCallId
rawOutputRef
rawOutputHash
diagnosticPayloadRef
schemaIssueCount
qualityDecision
outputBoundaryDecision
```

如果 AI child 返回 failed/review_required，Orchestration 可以进入 failed/review transition，但结构化日志不得只显示 `runtime_execution_failed`。`aiResultRef` 在非 success 情况下应指向 diagnostic payload ref，而不是丢成 null。

禁止：

```txt
Orchestration 将 AI failureReason 覆盖成 generic runtime_execution_failed
Orchestration 直接调用 AI runtime/local-ai adapter
Orchestration 写 raw prompt/raw image/raw response text 到终端
Orchestration 根据 AI free text 推进流程
```
