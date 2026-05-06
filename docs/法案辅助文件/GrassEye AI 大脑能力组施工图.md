# GrassEye AI 大脑能力组施工图 FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-AI-BRAIN-BLUEPRINT-FINAL
owner: ai-capability
documentType: construction-blueprint
lawAuthority: module-ai-capability.instructions.md
architecturePhase: Static Capability Package Architecture
futurePhase: Pluggable Capability Architecture
status: active
replace:
  - docs/法案辅助文件/GrassEye AI 大脑能力组施工图.md
mustNotCreate:
  - new lawId
  - new ability group
  - independent local-ai owner
  - prompt side-channel
```

本施工图是 `module-ai-capability.instructions.md` 的建设级落地映射。
本施工图不新增 lawId，不修改冻结法案，不重新分配主权。
若本文档与 `module-ai-capability.instructions.md` 冲突，以 `module-ai-capability.instructions.md` 为最高权威。
若本文档与旧 AI 施工图、旧本地 AI 施工图、旧 local-ai-runtime 说明、旧 generated artifact 冲突，以当前 AI 法案最终版为准。

---

## 1. 核心定位

AI 是 GrassEye 的大脑能力组。

AI 负责：

```txt
看
想
判断
总结
抽取
分类
结构化输出
质量评估
输出边界判断
```

AI 不负责：

```txt
点击
滚动
输入
打开页面
控制浏览器
选择地图
推进流程
发送 Nerve Bus envelope
写 Forensics
修改候选
决定最终 mission
跳过人工审核
```

一句话：

```txt
AI 是大脑，但不是皇帝。
```

---

## 2. 与故事链路的关系

GrassEye 的故事链路必须保持：

```txt
Human Intent
→ Commander Console
→ Map Package
→ Orchestration
→ Nerve Bus
→ AI Capability
→ Structured AI Result
→ Orchestration Branch
→ Action Ability Group
→ Post-Action Verification
→ Forensics Persistence
→ Human Review
```

AI 只出现在：

```txt
Nerve Bus 传来的 governed AI request
→ AI 内部执行
→ governed AI result 返回
```

AI 不能向外扩张为：

```txt
AI → Browser
AI → Forensics Writer
AI → Map Mutation
AI → Mission Final Decision
AI → Action Execution
```

---

## 3. 架构阶段

当前阶段：

```txt
Static Capability Package Architecture
```

当前阶段允许：

```txt
固定 AI 能力组
固定 child registry
固定 prompt contract registry
固定 local runtime adapter
固定 paid/future disabled provider shell
固定 machine-blocking inspector
```

当前阶段禁止：

```txt
动态加载 AI provider 插件
动态加载 prompt runtime 插件
AI 自动创建 active map
AI 自动提升 paid/future provider
AI 自治式执行动作
```

未来阶段：

```txt
Pluggable Capability Architecture
```

未来阶段必须另有法案、施工图、审批和执法后才能启用。

---

## 4. 目录结构标准包

AI 能力组必须维持以下标准包：

```txt
src/capabilities/ai/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── schema-core.schema.ts
├── schema-runtime.schema.ts
├── registry.ts
├── task-router.ts
├── model-roster.ts
├── index.ts
├── ports/
├── children/
│   ├── local-vision-ai/
│   ├── local-text-ai/
│   ├── local-ocr-ai/
│   ├── paid-vision-ai/
│   ├── paid-analysis-ai/
│   └── future-api-ai/
├── prompt-contracts/
├── runtime/
├── runtime-adapters/
└── shared/
```

每类文件的唯一职责：

| 文件/目录 | 唯一职责 | 禁止 |
|---|---|---|
| `ability-group.ts` | 薄入口、组合、调用统一 executor | 业务判断、prompt、provider 调用 |
| `contract.ts` | AI public contract | 暴露 LocalAi 内部类型 |
| `schema*.ts` | schema / type / strict validation | runtime 执行 |
| `registry.ts` | child registry truth | 动态拼接 provider |
| `task-router.ts` | taskType → childCapabilityId 路由 | prompt 正文、provider fallback |
| `model-roster.ts` | 读取受治理 model roster | 成为 local-ai config 真相 |
| `prompt-contracts/` | Prompt Contract 唯一来源 | 动作指令、浏览器操作 |
| `runtime/` | AI pipeline gates | 越权调用其它能力 |
| `runtime-adapters/` | local / provider adapter | 构造最终 AI success |
| `children/` | child capability binding | 绕过统一 executor |

---

## 5. AI Public Contract

AI 对外只允许暴露治理合同。

允许 public exports：

```txt
createAiAbilityGroup
AI_ABILITY_GROUP_ID
AiAbilityInput
AiAbilityResult
AiTaskType
AiProviderPolicy
AiCostPolicy
AiDataPolicy
AiSafetyPolicy
AiQualityPolicy
AiRuntimeProof
getAiTaskRoutingTable
loadAiModelRoster
AI schema validators
```

禁止 public exports：

```txt
LocalAiGateway
LocalAiTaskRequest
LocalAiTaskResult
LocalAiTaskType
prompt-registry raw helper
runtime-task-execution
capability-check
verify*
children implementation
runtime adapter implementation
legacy LocalAi result translator
prompt-contract shortcut
```

最低 public methods：

```txt
listChildCapabilityIds()
execute(input)
getHealth()
getRuntimeHealth()
getPromptContract(promptContractId)
getModelRoster()
```

`routeTask(taskType)` 可以作为 read-only helper，但不得绕过 `execute(input)`。

---

## 6. AI Input 机器字段

AI request 必须包含链路字段。

```yaml
AiAbilityInputRequiredFields:
  ownership:
    abilityGroupId: ai
    requestedBy: orchestration
    transportedBy: nerve-bus
  routing:
    taskType: required
    childCapabilityId: resolved-by-ai-router
    promptContractId: required
    promptContractVersion: required
    promptCatalogVersion: required
    expectedOutputSchema: required
  chain:
    missionId: required
    runId: required-or-sessionId
    sessionId: required-or-runId
    roundId: required-or-visitId
    stepId: required
    capabilityCallId: required

  例外：

  ```txt
  taskType = map_authoring
  requestedBy = commander-console
  transportedBy = commander-console
  only for Commander Map Lab draft generation
  ```
    nerveBusEnvelopeId: required
    activationSnapshotRef: required
    mapPackageId: required
    mapPackageVersion: required
    selectedMapId: required
    selectedMapVersion: required
  input:
    inputModality: required
    inputRefs: non-empty
    evidenceRefs: optional-but-tracked
  policy:
    providerPolicy: required
    costPolicy: required
    dataPolicy: required
    safetyPolicy: required
    qualityPolicy: required
    payloadBudgetPolicy: required
    timeoutPolicy: required
```

缺失以下字段不得 success：

```txt
promptContractId
promptContractVersion
promptCatalogVersion
stepId
capabilityCallId
activationSnapshotRef
inputRefs
expectedOutputSchema
```

处理方式：

```txt
missing governance field → failed or review_required
never → success
```

---

## 7. AI Result 机器字段

AI result 必须统一：

```yaml
AiAbilityResult:
  status: success | failed | review_required
  abilityGroupId: ai
  childCapabilityId: required
  taskType: required
  outputAuthority: authoritative | non_authoritative
  promptContractId: required
  promptContractVersion: required
  promptCatalogVersion: required
  expectedOutputSchema: required
  modelProvider: required
  modelName: required
  modelRole: required
  runtime: required
  output: null-or-structured
  rawOutputRef: required-or-rawOutputHash
  rawOutputHash: required-or-rawOutputRef
  schemaValidationStatus: valid | invalid | not_applicable
  schemaIssueCount: number
  confidence: number-or-null
  qualityDecision: pass | fail | review_required
  outputBoundaryDecision: allow | block
  failureReason: required-if-failed
  reviewRequiredReason: required-if-review_required
  dataQualityFlags: list
  inputRefs: list
  outputRefs: list
  evidenceRefs: list
  durationMs: number
  costEstimate: optional
  debugLogRef: optional
  runtimeProof: required
```

Success 必须同时满足：

```txt
schemaValidationStatus = valid
qualityDecision = pass
outputBoundaryDecision = allow
outputAuthority = authoritative
rawOutputRef or rawOutputHash exists
runtimeProof exists
```

Failure / review_required 必须满足：

```txt
outputAuthority = non_authoritative
output = null
failureReason or reviewRequiredReason exists
runtimeProof exists
schemaIssueCount is tracked
```

禁止：

```txt
runtimeProof: null
success without raw output ref/hash
success with schema invalid
success with low confidence below policy
success with outputBoundaryDecision=block
failure without reason
review_required without reason
fallback proof as real proof
```

---

## 8. Prompt Contract Registry

AI 是 Prompt Contract Registry 的唯一 owner。

Prompt Contract 必须存放在：

```txt
src/capabilities/ai/prompt-contracts/**
```

Prompt Contract 必须是机器可读包：

```yaml
PromptContract:
  promptContractId: required
  promptContractVersion: required
  promptCatalogVersion: required
  promptHash: required
  taskType: required
  modelRole: required
  inputContract:
    requiredInputRefs: non-empty
    allowedModalities: list
    maxPayloadBytes: required
  outputContract:
    outputSchemaRef: required
    strict: true
    requiredFields: list
  confidencePolicy:
    minConfidence: required
    belowMin: failed | review_required
  reviewPolicy:
    requiredWhen:
      - low_confidence
      - ambiguous_output
      - sensitive_prompt
      - schema_uncertain
  failurePolicy:
    badJson: failed | review_required
    schemaMismatch: failed | review_required
    modelUnavailable: failed
    timeout: failed
  forbiddenOutputs:
    - click
    - scroll
    - type
    - open_page
    - dispatch_action
    - platform_action
    - browser_action
    - forensics_write
    - coordinate_to_click
    - mouse_click
    - command_to_execute
    - action_intent
  debugPolicy:
    rawOutputRetention: hash | ref
    includePromptHash: true
```

Prompt Contract 禁止：

```txt
要求模型点击
要求模型滚动
要求模型输入
要求模型打开页面
要求模型读取 cookies
要求模型读取 credentials
要求模型绕过安全
要求模型决定最终 mission
要求模型写 Forensics
```

---

## 9. Prompt Contract 单一真相

唯一合法关系：

```txt
Map Package → promptContractId/version → AI Prompt Registry → Prompt Contract
```

禁止：

```txt
Map 内嵌 prompt 正文
Orchestration 内嵌 prompt 正文
Nerve Bus 内嵌 prompt 正文
runtime adapter 内嵌 prompt 正文
local-ai bridge 自己生成 prompt 真相
taskType fallback 拼 prompt
unknown promptContractId throw 穿透
```

`unknown promptContractId` 必须：

```txt
typed failure
with failureKind = prompt_contract_not_found
with runtimeProof
```

不得：

```txt
throw escaping execute
fallback to default prompt
fallback by taskType
success with generic prompt
```

---

## 10. Runtime Pipeline

AI runtime pipeline 必须固定：

```txt
input schema gate
→ chain proof gate
→ prompt registry gate
→ prompt contract integrity gate
→ task router gate
→ provider policy gate
→ data policy gate
→ safety policy gate
→ cost policy gate
→ payload budget gate
→ timeout policy gate
→ runtime health gate
→ idempotency gate
→ runtime adapter call
→ raw output capture
→ JSON extraction
→ schema gate
→ quality gate
→ output boundary gate
→ proof builder
→ result builder
```

每个 gate 的唯一职责：

| Gate | 职责 | 禁止 |
|---|---|---|
| input schema gate | 校验输入 shape | 调 provider |
| chain proof gate | 校验 stepId / capabilityCallId / activationSnapshotRef | 补默认值成功 |
| prompt registry gate | 解析 prompt contract | fallback prompt |
| provider policy gate | 选合法 child/provider | paid fallback |
| payload budget gate | 控制输入大小 | 截断后伪成功 |
| timeout gate | 产生 AbortSignal | 只 Promise.race 不 abort |
| runtime health gate | 检查模型可用 | 假 healthy |
| raw output capture | 保留 ref/hash | 丢 raw output |
| schema gate | 校验输出 schema | 质量判断 |
| quality gate | 判断置信度/歧义 | 执行动作 |
| output boundary gate | 拦截越权动作输出 | 修改 output 伪装通过 |
| proof builder | 构造 proof | 下业务结论 |
| result builder | 组装 result | 执行 provider |

---

## 11. Timeout / Cancellation

`AiRuntimePort` 必须支持 AbortSignal。

合法形式：

```ts
execute(request, signal)
```

或：

```ts
execute({ request, signal })
```

必须满足：

```txt
timeout policy creates AbortController
signal passed to runtime adapter
adapter passes signal to local runtime where possible
timeout calls abort()
timeout result is typed failed
runtime success after timeout cannot overwrite failed result
timeout proof records timeoutDecision=timed_out
adapter without signal support is inspector failure
```

禁止：

```txt
Promise.race only without AbortSignal
timeout fallback success
timeout review_required without proof
model still running and later commits success
```

---

## 12. Provider / Child Capability

Active children：

| childCapabilityId | providerKind | defaultPolicy | runnable |
|---|---|---|---|
| local-vision-ai | local | enabled | yes |
| local-text-ai | local | enabled | yes |
| local-ocr-ai | local | enabled | yes |
| paid-vision-ai | paid | disabled_by_policy | no |
| paid-analysis-ai | paid | policy_guarded | operator-approved only |
| future-api-ai | future | disabled_by_policy | no |

Paid / future provider 执行前必须具备：

```txt
allowPaidProvider = true
provider allowlist match
dataPolicy.allowExternalTransmission = true
costPolicy.maxEstimatedCost exists
operatorApprovalRef exists
providerConfigRef exists
secretRef exists
separate law/review path exists
```

当前阶段禁止：

```txt
hidden cloud fallback
paid fallback to local
future fallback to local
disabled provider success
paid provider success without approval
policy-guarded provider success without config/secret
future provider runnable
```

Disabled provider 合法结果：

```txt
status = failed
failureKind = provider_disabled
runtimeProof exists
```

Policy-guarded provider 在 approval/config/secret 缺失时的合法结果：

```txt
status = failed | review_required
explicit reason = operator_approval_missing | provider_config_missing | provider_secret_missing
runtimeProof exists
```

---

## 13. Local AI Boundary

`src/lib/local-ai` 是 AI 内部执行边界，不是公开主权。

唯一允许 AI root 连接 local-ai 的位置：

```txt
src/capabilities/ai/runtime-adapters/local-ai-runtime-adapter.ts
```

允许：

```txt
runtime-adapter imports LocalAiGateway
runtime-adapter maps governed AI request to LocalAiTaskRequest
runtime-adapter maps LocalAiTaskResult to raw runtime output
runtime-adapter returns adapter-level runtime output
```

禁止：

```txt
ability-group.ts importing LocalAiGateway
model-roster.ts directly owning lib/local-ai config truth
executor importing prompt-registry raw helper
external callers importing LocalAiGateway
local-ai bridge choosing prompt truth
LocalAiTaskType leaking into public AI contract
local adapter constructing final AiAbilityResult
```

Bridge 只能存在于 internal adapter，并且必须证明：

```txt
legacy taskType mapping is not prompt truth
promptVersion/schemaVersion comes from Prompt Contract Catalog
adapter returns raw runtime output, not final success
```

---

## 14. Model Roster

Model Roster 必须是受治理模型清单，不是隐藏配置真相。

必须具备：

```yaml
ModelRosterEntry:
  modelId: required
  providerKind: local | paid | future
  modelRole: required
  enabledByPolicy: boolean
  allowedTaskTypes: list
  maxPayloadBytes: required
  supportsAbortSignal: boolean
  runtimeAdapterId: required
  healthCheckPolicy: required
```

要求：

```txt
model roster 通过 AiModelRosterPort / governed loader 进入 AI
model roster 不能绕过 provider policy
disabled entries cannot execute
runtime adapter must match roster entry
```

---

## 15. JSON / Schema / Quality / Boundary

模型输出处理必须按顺序：

```txt
raw output capture
→ JSON extraction
→ strict schema validation
→ quality gate
→ output boundary gate
```

Bad output 处理：

| 情况 | 结果 |
|---|---|
| empty output | failed / review_required |
| bad JSON | failed / review_required |
| markdown wrapped JSON | extract then validate |
| schema mismatch | failed / review_required |
| extra fields | strict schema fail |
| missing required fields | failed / review_required |
| low confidence | review_required / failed |
| action-like output | failed |

Output Boundary 必须递归检查 object / array。

Forbidden keys / aliases：

```txt
click
clickTarget
scroll
scrollTarget
type
inputText
openPage
open_page
dispatchAction
dispatch_action
platformAction
browserAction
forensicsWrite
writeEvidence
coordinateToClick
mouseClick
commandToExecute
actionIntent
nextAction
execute
```

禁止：

```txt
模型输出 action-like 字段但仍 success
只检查顶层字段
修改 output 后伪装通过
```

---

## 16. Idempotency / Concurrency / Circuit Breaker

AI 长运行必须防重复、过载和故障扩散。

要求：

```yaml
AiIdempotencyKey:
  includes:
    - promptContractId
    - promptContractVersion
    - taskType
    - stepId
    - capabilityCallId
    - inputRefsHash
```

Concurrency / circuit breaker 必须：

```txt
context-owned or port-owned
not uncontrolled module global mutable state
recorded in runtimeProof
typed failure when limited/open
never fallback success
```

禁止：

```txt
module-level activeRuns without governed owner
module-level circuitBreaker without reset / proof / owner
concurrency_limited treated as success
circuit_breaker_open treated as success
```

---

## 17. Proof 与 Forensics 可串链

AI 不写 Forensics，但 AI result 必须可被 Forensics 保存。

runtimeProof 必须包含：

```yaml
AiRuntimeProof:
  proofId: required
  abilityGroupId: ai
  childCapabilityId: required
  taskType: required
  missionId: required
  runId: required-or-sessionId
  sessionId: required-or-runId
  roundId: required-or-visitId
  stepId: required
  capabilityCallId: required
  nerveBusEnvelopeId: required
  mapPackageId: required
  mapPackageVersion: required
  selectedMapId: required
  selectedMapVersion: required
  activationSnapshotRef: required
  promptContractId: required
  promptContractVersion: required
  promptCatalogVersion: required
  promptHash: required
  expectedOutputSchema: required
  inputRefs: list
  outputRefs: list
  evidenceRefs: list
  modelProvider: required
  modelName: required
  modelRole: required
  runtimeAdapterId: required
  rawOutputRef: optional
  rawOutputHash: optional
  schemaValidationStatus: required
  schemaIssueCount: number
  qualityDecision: required
  outputBoundaryDecision: required
  confidence: optional
  timeoutDecision: optional
  providerDecision: required
  costDecision: required
  dataPolicyDecision: required
  safetyDecision: required
  startedAt: required
  endedAt: required
  durationMs: required
  failureKind: optional
  failureReason: optional
  reviewRequiredReason: optional
```

---

## 18. 执法系统

AI owner-local 执法域必须存在：

```txt
scripts/audit/domains/ai-capability/
├── manifest.json
├── inspector.ts
├── run-inspector.ts
└── negative-proof-harness.ts
```

Inspector 必须：

```txt
ts-morph
AST-level
symbol-level
import graph-level
JSON schema-level
generated artifact aware
anti-escape
runner-connected
negative-proof-backed
```

禁止：

```txt
regex as final judgment
grep as final judgment
includes as final judgment
manual-only proof
warning-only P0
detached inspector
fake pass
empty negative proof
```

---

## 19. Inspector 必查项

```txt
1. AI root public exports limited.
2. No external import of AI children/runtime/private helper.
3. AI does not import browser/action/orchestration/forensics implementation.
4. Prompt Contract Registry is single truth.
5. No hardcoded prompt body outside prompt-contract files.
6. promptContractId resolves to registry.
7. unknown promptContractId returns typed failure.
8. promptContractId matches taskType.
9. duplicate prompt contract id fails.
10. disabled provider cannot success.
11. paid/future provider cannot fallback local.
12. AbortSignal reaches AiRuntimePort.
13. bad JSON cannot success.
14. schema mismatch cannot success.
15. low confidence cannot success unless policy allows review_required.
16. output boundary recursively blocks action-like output.
17. success requires rawOutputRef/rawOutputHash.
18. success requires runtimeProof.
19. failure/review_required requires reason.
20. AI input/proof includes stepId/capabilityCallId/activationSnapshotRef.
21. local-ai bridge is adapter-only.
22. no LocalAi public contract leakage.
23. no module-level uncontrolled circuitBreaker/activeRuns.
24. no as any / as unknown as / as never / ts-ignore / eslint-disable.
25. all active AI laws in registry/matrix/audit-plan/runner.
26. negative proof executed.
```

---

## 20. Negative Proof 最低清单

必须 fail → rollback → pass：

```txt
remove promptContractId
unknown promptContractId
mismatch promptContractId/taskType
hardcode prompt in runtime
hardcode prompt in adapter
add prompt body to map-like input
remove stepId
remove capabilityCallId
remove activationSnapshotRef
remove promptCatalogVersion
disabled provider returns success
paid provider falls back to local
future provider returns success
remove AbortSignal from AiRuntimePort
bad JSON returns success
schema mismatch returns success
low confidence returns success
action-like output returns success
remove rawOutputRef/rawOutputHash from success
remove runtimeProof
failure without reason
review_required without reason
AI imports browser/action implementation
AI imports Forensics writer
AI imports Orchestration runtime
export AI child implementation
export LocalAiTaskRequest as public contract
remove negative proof invocation
turn P0 finding into warning-only
```

No negative proof = no PASS.

---

## 21. CI / 命令

AI 能力组交付必须至少运行：

```bash
npm run audit:build
npm run audit:ai
npm run ci:full
```

如果 `audit:ai` 不存在，必须补齐。  
`ci:full` 不全绿，不得交付 PASS。

---

## 22. READY 标准

AI Capability READY 仅当全部成立：

```txt
AI law / blueprint / inspector / generated / runner 口径一致
all active AI laws machine-blocking
prompt registry single truth
prompt contract catalog integrity proven
chain proof fields present
runtime pipeline single-chain
timeout AbortSignal propagated
disabled/paid/future fail-closed
local-ai bridge adapter-only
bad output hardening complete
output boundary recursive
result proof complete
owner-local inspector PASS
negative proof PASS
ALL law enforcement PASS
CI-FULL PASS
```

---

## 23. 漂移信号

发现以下任一项，AI 能力组判定漂移：

```txt
AI 被写回 runtime helper
src/lib/local-ai 重新成为 public AI root
feature 直接挑模型
feature 直连 prompt registry
paid API 隐形 fallback
child capability 被 task 名称替代
AI public contract 复用 LocalAiTaskRequest/Result
capability-check / verify 被当成验收链
runtime prompt hardcode
AI output action command
Forensics import AI prompt contract as truth
```

---

## 24. 最终原则

```txt
AI 只判断，不动作。
AI 只返回结构化结果，不决定流程。
Prompt Contract 是唯一语言契约。
Local AI 是内部运行边界，不是第二个主权。
失败必须被证明，不能伪装成功。
没有 proof 的 AI result，不算真正执行。
```

---

## 25. 实战运行日志透明化补充：AI runtime failure diagnostics

本节只补施工细节，不新增 lawId，不修改冻结法案。

`runtime_execution_failed` 只能作为外层未预期 throw 的 fallback kind，不能作为 AI terminal failure 的唯一可见原因。AI runtime/adapter/child execution 失败必须保留并暴露：

```txt
stepId
taskType
promptContractId
expectedOutputSchema
childCapabilityId
modelProvider
modelName
runtime
runtimeCallId
implementationStatus
errorKind
failureReason
rawOutputRef or rawOutputHash
diagnosticPayloadRef
schemaIssueCount
qualityDecision
outputBoundaryDecision
ownerResponsible
actionableMessage
```

允许的 runtime implementationStatus 至少包括：

```txt
runtime_threw
runtime_timeout
runtime_invalid_response
runtime_http_failed
invalid_output
model_missing
engine_missing
service_unreachable
missing_evidence
prompt_contract_rejected
task_type_mismatch
circuit_breaker_open
concurrency_limited
provider_not_configured
provider_secret_missing
local_ai_unavailable
```

`AI_REQUEST_DEBUG` / `AI_RESPONSE_DEBUG` / `AI_ERROR_DEBUG` 必须进入 structured runtime event sink。AI 不直接 import Forensics internals；composition root 注入 `emitDebugEvent`，Forensics public boundary 负责持久化。

禁止：

```txt
local-ai adapter 自己写 Forensics storage
AI result failureReason 只剩 runtime_execution_failed
invalid_output 被改写成 schema_validation_failed 而丢失 rawOutputRef/runtimeCallId
终端输出 raw image base64/raw prompt/secret/cookie/token
```

Inspector 必须用 AST/symbol/import graph 固化：

```txt
createConfiguredAiAbilityGroup -> createProviderAwareAiRuntimePort({ emitDebugEvent })
createAiExecutionContext 支持 emitDebugEvent 注入
provider-aware adapter -> createLocalAiRuntimePort({ emitDebugEvent })
local adapter -> emitAiErrorDebug(implementationStatus)
AI runtime result resolver 保留具体 implementationStatus
unexpected child throw 暴露 implementationStatus/errorKind/diagnosticPayloadRef
```
