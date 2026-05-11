# GrassEye 本地AI分工与提示词施工图 FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-LOCAL-AI-PROMPT-BLUEPRINT-FINAL
owner: ai-capability
documentType: internal-construction-blueprint
lawAuthority: module-ai-capability.instructions.md
parentBlueprint: GrassEye AI 大脑能力组施工图 FINAL
architecturePhase: Static Capability Package Architecture
status: active
replace:
  - docs/法案辅助文件/GrassEye 本地AI分工与提示词施工图.md
mustNotCreate:
  - independent local-ai owner
  - independent prompt owner
  - independent model owner
  - second AI sovereignty
```

本施工图只描述 AI Ability Group 内部的本地运行时分工、模型角色、Prompt Contract Registry、local-ai bridge 与 runtime adapter。  
本文件不新增 lawId，不修改冻结法案，不恢复 local-ai-runtime 独立主权。  
若本文档与 `module-ai-capability.instructions.md` 或《GrassEye AI 大脑能力组施工图 FINAL》冲突，以 AI 法案最终版为准。

---

## 1. 基本定位

`src/lib/local-ai` 是 AI 能力组内部执行边界。  
`src/capabilities/ai` 是 AI 公开主权入口。  
`src/capabilities/ai/runtime-adapters/local-ai-runtime-adapter.ts` 是唯一 AI-owned local runtime adapter。

关系：

```txt
AI Ability Group public execute
→ AI runtime pipeline
→ local-ai-runtime-adapter
→ src/lib/local-ai internal runtime
→ raw runtime output
→ AI schema/quality/boundary/proof/result
```

禁止关系：

```txt
app/workbench/orchestration/nerve-bus → src/lib/local-ai
retired package chain → src/lib/local-ai prompt registry
local-ai → final AiAbilityResult
local-ai → Forensics writer
local-ai → browser/action ability
```

---

## 2. 本地 AI 的职责边界

本地 AI 可以：

```txt
执行本地视觉判断
执行本地启动准备判断
执行本地文本总结
执行本地 OCR 清洗
返回 raw runtime output
返回 runtime metadata
报告模型健康
报告模型不可用
响应 AbortSignal
```

本地 AI 不可以：

```txt
决定 map branch
构造 final AI result
构造 authoritative output
跳过 schema gate
跳过 output boundary gate
选择 paid/future provider
写 Forensics
执行浏览器动作
```

当前本地视觉 Prompt Contract 必须覆盖两类受治理任务：

```txt
vision.pagePreparation
vision.productPresence
```

---

## 3. 模型角色

当前本地模型角色：

| modelRole | 用途 | 默认 child |
|---|---|---|
| visual-observation | 图像观察、产品存在判断、视觉候选分析 | local-vision-ai |
| ocr-extraction | OCR 清洗、文字结构化 | local-ocr-ai |
| text-reasoning | 评论总结、产品信号总结、普通文本分析 | local-text-ai |
| schema-validation | schema-only 辅助校验 | local-text-ai 或内部 schema validator |

禁止：

```txt
一个模型角色同时服务无关任务且无 promptContractId 区分
按模型角色绕过 prompt contract
按 taskType 直接拼 prompt
```

---

## 4. AI TaskType 与 Local Runtime Task 的映射

Public AI taskType（当前最终口径）：

```txt
visual_mission_judgment
visual_mission_action_plan
schema_validation_only
```

以下历史 taskType 只能作为 local-ai-runtime-adapter 内部 bridge 映射的源端，不得出现在 AI public contract 或 Orchestration / Nerve Bus 中：

```txt
# 已退役 / 过渡残留，不得成为 AI 主权口径
# product_presence_judgment    → 已并入 visual_mission_judgment
# visual_observation           → 已并入 visual_mission_judgment
# visual_target_candidate_analysis → 已并入 visual_mission_judgment
# ocr_cleanup                  → 已并入 visual_mission_judgment / local-ocr-ai bridge
# comment_signal_summary       → 已并入 visual_mission_judgment
# product_signal_summary       → 已并入 visual_mission_judgment
# evidence_packet_analysis     → paid-analysis-ai provider_disabled，未来另行解锁
```

Local runtime 内部可以存在旧任务名，但只能在 bridge 内映射。

映射表必须：

```yaml
TaskBridgeMapping:
  source: AiTaskType
  target: LocalAiTaskType
  promptContractId: required
  promptContractVersion: required
  expectedOutputSchema: required
  modelRole: required
  childCapabilityId: required
  mappingOwner: local-ai-runtime-adapter
```

禁止：

```txt
LocalAiTaskType 出现在 AI public contract
LocalAiTaskType 泄漏到 Orchestration / Nerve Bus
taskType fallback 选择 prompt
mapping 内硬编码 prompt 正文
mapping 内硬编码 promptVersion 作为真相
```

---

## 5. Prompt Contract Registry 内部分工

Prompt Contract Registry 属于 AI 能力组。

允许路径：

```txt
src/capabilities/ai/prompt-contracts/**
```

Prompt Contract 文件必须是：

```txt
machine-readable
strict schema
hashable
versioned
auditable
owned by ai-capability
```

Prompt Contract 最低字段：

```yaml
PromptContract:
  promptContractId: string
  promptContractVersion: string
  promptCatalogVersion: string
  promptHash: string
  taskType: AiTaskType
  modelRole: string
  inputContract:
    requiredInputRefs: string[]
    allowedModalities: string[]
    maxPayloadBytes: number
  outputContract:
    outputSchemaRef: string
    strict: true
  forbiddenOutputs: string[]
  confidencePolicy:
    minConfidence: number
    belowMin: failed | review_required
  reviewPolicy:
    requiredWhen: string[]
  failurePolicy:
    badJson: failed | review_required
    schemaMismatch: failed | review_required
    timeout: failed
    modelUnavailable: failed
  debugPolicy:
    rawOutputRetention: hash | ref
    includePromptHash: true
```

禁止：

```txt
外部模块直连 src/lib/local-ai/prompt-registry.ts
AI runtime 里写 prompt 正文
adapter 里写 prompt 正文
map 里写 prompt 正文
同一个 promptContractId 重复定义
promptContractId 不带 version/hash
```

---

## 6. Prompt 内容治理

Prompt 正文只能存在于 Prompt Contract 文件或其受治理模板中。  
所有 Prompt 必须是“提问/判断/提取/总结”性质。

Prompt 可以要求：

```txt
判断是否存在产品
提取可见文本
总结评论购买意图
输出结构化 JSON
标记不确定性
输出 confidence
说明证据来源
```

Prompt 禁止要求：

```txt
点击
滚动
输入
打开页面
绕过登录
读取 cookies
读取 credentials
执行平台动作
写入证据
决定最终 mission
跳过人工审核
输出可执行命令
```

Prompt 中不得出现：

```txt
Click the button
Scroll the page
Type into input
Open the page
Use browser
Send command
Write evidence
Bypass security
Ignore review
Final decision
```

如果 Prompt 确实需要描述画面中“按钮存在”，只能表达为结构化观察，不得表达为动作命令。

---

## 7. Prompt Hash / Catalog Version

每个 Prompt Contract 必须生成：

```txt
promptHash
promptContractVersion
promptCatalogVersion
```

用途：

```txt
runtimeProof
Forensics chain
drift audit
replay
debug
CI validation
```

要求：

```txt
promptHash 由 prompt 正文 + output schema ref + policy 生成
promptCatalogVersion 由 catalog build 生成
runtimeProof 必须记录 promptHash
AI result 必须记录 promptContractVersion / promptCatalogVersion
```

禁止：

```txt
只记录 promptContractId
运行时临时生成 hash 但不入 catalog
adapter 自己维护 promptVersion
LocalAiGateway 自己定义 schemaVersion 真相
```

---

## 8. Local Runtime Adapter

唯一合法 local runtime adapter：

```txt
src/capabilities/ai/runtime-adapters/local-ai-runtime-adapter.ts
```

职责：

```txt
接收 governed AiRuntimeAdapterRequest
读取 Prompt Contract resolved payload
读取 model roster decision
转换为 LocalAiTaskRequest
调用 LocalAiGateway
接收 LocalAiTaskResult
返回 raw adapter output
```

禁止：

```txt
构造 final AiAbilityResult
决定 success authority
跳过 schema gate
跳过 quality gate
跳过 output boundary gate
写 Forensics
执行动作
选择地图
fallback paid/future provider
```

Adapter 输出必须是中间态：

```yaml
LocalAiAdapterOutput:
  rawOutputText: string | null
  rawOutputRef: string | null
  rawOutputHash: string | null
  runtimeMetadata: object
  providerStatus: completed | failed | timed_out | unavailable
  failureReason: optional
```

---

## 9. AbortSignal / Timeout

Local AI 必须接受取消信号。

```yaml
LocalAiRuntimeRequest:
  promptContractId: required
  promptHash: required
  taskType: required
  modelRole: required
  inputRefs: required
  signal: AbortSignal
  timeoutMs: number
```

要求：

```txt
AI timeout gate 创建 AbortController
local-ai-runtime-adapter 接收 signal
LocalAiGateway 尽量接收 signal
底层模型调用不支持 signal 时必须有 wrapper cancellation proof
timeout 后返回 failed/timed_out
timeout 后 late success 不得覆盖 failure
```

禁止：

```txt
只 Promise.race
底层继续运行并 commit success
timeout fallback success
timeout no proof
```

---

## 10. Model Roster 分工

Model roster 只描述可用模型，不拥有 prompt 真相。

最低字段：

```yaml
ModelRosterEntry:
  modelId: string
  providerKind: local | paid | future
  modelRole: string
  enabledByPolicy: boolean
  allowedTaskTypes: string[]
  runtimeAdapterId: string
  supportsAbortSignal: boolean
  maxPayloadBytes: number
  healthCheckPolicy: object
```

本地模型 roster 可以读取 `src/lib/local-ai` 配置，但必须通过 AI-owned loader/adapter。

禁止：

```txt
model-roster.ts 直接成为 lib/local-ai config public truth
model roster 决定 prompt
model roster 决定 final result
disabled model execute
paid/future fallback
```

---

## 11. Runtime Health

本地 AI runtime 必须可健康检查。

状态：

```txt
healthy
degraded
unavailable
disabled_by_policy
```

健康检查必须影响执行：

```txt
healthy → 可执行
degraded → 可执行但 proof 标记 degraded
unavailable → failed model_unavailable
disabled_by_policy → failed provider_disabled
```

禁止：

```txt
unavailable fallback success
health check 失败但继续 success
disabled provider review_required 冒充可执行
```

---

## 12. Payload Budget

本地模型输入必须受预算控制。

必须检查：

```txt
inputRefs count
image count
image size
text length
token estimate
payload bytes
maxPayloadBytes from Prompt Contract / model roster
```

预算超限：

```txt
failed payload_too_large
或 review_required payload_budget_exceeded
```

禁止：

```txt
随意截断后 success
丢弃输入证据后 success
payload budget 只写日志不阻断
```

---

## 13. Raw Output Capture

所有本地模型输出必须捕获 raw output。

要求：

```txt
rawOutputRef or rawOutputHash 必须存在
empty output 必须 failed/review_required
raw output 进入 proof
raw output 不得直接作为 authoritative result
```

禁止：

```txt
raw output lost
raw output 直接写 final result
adapter 清洗后丢原始输出
```

---

## 14. JSON Extraction

本地模型可能返回：

```txt
pure JSON
markdown fenced JSON
JSON + explanation
bad JSON
empty output
```

处理规则：

```txt
pure JSON → extract
markdown fenced JSON → extract then validate
JSON + explanation → extract only if deterministic
bad JSON → failed/review_required
empty output → failed
```

禁止：

```txt
bad JSON success
解释文字 success
string output success when object required
```

---

## 15. Schema Gate

Schema Gate 必须使用 Prompt Contract 的 `outputSchemaRef`。

要求：

```txt
strict schema
extra fields fail
missing required fail
type mismatch fail
schemaIssueCount recorded
schema issues enter proof
```

禁止：

```txt
unknown schema fallback
schema mismatch success
adapter schema validation as final truth
```

---

## 16. Quality Gate

Quality Gate 必须处理：

```txt
confidence
uncertainty
ambiguous evidence
insufficient input
contradictory frames
low visual quality
model self-reported uncertainty
```

结果：

```txt
pass
review_required
failed
```

禁止：

```txt
low confidence success
ambiguous output success
insufficient evidence success
```

---

## 17. Output Boundary Gate

本地模型输出不得包含动作权。

递归禁止字段：

```txt
click
scroll
type
input
openPage
open_page
dispatchAction
platformAction
browserAction
writeEvidence
forensicsWrite
execute
command
nextAction
coordinateToClick
mouseClick
```

处理：

```txt
action-like output → failed output_boundary_violation
```

禁止：

```txt
只查顶层
改名绕过
action-like output review_required 但仍作为有效 output
```

---

## 18. Disabled / Paid / Future

本地 AI 不允许替 paid/future provider 兜底。

禁止：

```txt
paid-analysis-ai → local-text-ai fallback
future-api-ai → local fallback
disabled provider → success
```

如果 taskType 路由到 disabled provider：

```txt
status = failed
failureKind = provider_disabled
runtimeProof exists
```

当前 `evidence_packet_analysis` 如仍指向 `paid-analysis-ai`，必须默认 failed/provider_disabled，除非未来另有法案解锁。

---

## 19. 本地 AI 运行证明

每次 local runtime 调用必须产生 adapter proof：

```yaml
LocalAiAdapterProof:
  adapterId: local-ai-runtime-adapter
  localTaskType: required
  aiTaskType: required
  promptContractId: required
  promptContractVersion: required
  promptHash: required
  modelRole: required
  modelId: required
  runtimeProvider: required
  inputRefs: list
  rawOutputRef: optional
  rawOutputHash: optional
  startedAt: required
  endedAt: required
  durationMs: required
  timeoutDecision: optional
  healthDecision: required
  payloadBudgetDecision: required
  failureReason: optional
```

该 proof 是 AI runtimeProof 的组成部分，不是 Forensics 最终记录。

---

## 20. 文件边界

允许 `src/lib/local-ai` 包含：

```txt
LocalAiGateway
local model config
local runtime execution helpers
local prompt rendering internals if governed by Prompt Contract
local model health check
local adapter helpers
```

禁止 `src/lib/local-ai` 包含：

```txt
AI public contract
final AiAbilityResult builder
Forensics writer
browser controller
platform action
map branch decision
mission state regression
```

允许 `src/capabilities/ai/runtime-adapters` 导入：

```txt
src/lib/local-ai/**
```

禁止其它 AI root 文件直接导入：

```txt
src/lib/local-ai/**
```

除非 AI 法案明确列入 allowlist。

---

## 21. 执法要求

AI inspector 必须检查本施工图。

最低 AST / symbol / import graph 检查：

```txt
external modules do not import src/lib/local-ai
only local-ai-runtime-adapter imports LocalAiGateway
AI public contract does not export LocalAiTaskRequest/Result/Type
prompt body exists only in prompt-contract files
local adapter does not build final AiAbilityResult
LocalAiTaskType only appears in bridge
disabled provider cannot success
AbortSignal reaches adapter
bad output cannot success
action-like output cannot success
```

JSON / schema-level 检查：

```txt
Prompt Contract schema complete
duplicate promptContractId fails
missing promptHash fails
missing outputSchemaRef fails
forbiddenOutputs missing action keys fails
```

---

## 22. real-code-inspection 最低清单

必须 fail → re-inspect → pass：

```txt
external app imports LocalAiGateway
orchestration imports local prompt registry
AI public index exports LocalAiTaskRequest
local adapter builds final AiAbilityResult
promptContractId missing promptHash
duplicate promptContractId
hardcoded prompt in adapter
bad JSON returns success
low confidence returns success
action-like output returns success
timeout without AbortSignal
paid-analysis falls back to local
disabled provider returns success
remove outputSchemaRef
remove requiredInputRefs
remove real-code-inspection invocation
```

---

## 23. 验收信号

建对表现：

```txt
app/workbench/orchestration/nerve-bus 只能走 AI facade
prompt contract catalog 可审计
promptHash 进入 proof
local runtime 只返回 raw adapter output
final result 由 AI runtime builder 构造
bad output 被拦截
disabled provider fail-closed
CI-FULL PASS
```

漂移信号：

```txt
app 或 adapter 直连模型
外部代码直连 prompt registry
local-ai-runtime 被写成独立主权
一个 prompt 服务多个无关任务且无 contract 区分
LocalAiTaskType 泄漏到 public contract
adapter 直接 success
runtime adapter 选择地图或动作
```

---

## 24. 最终原则

```txt
本地 AI 只是执行边界。
Prompt Contract 才是语言契约。
AI Capability 才是公开主权。
Adapter 只返回 raw output。
最终结果必须经过 schema、quality、boundary、proof。
```
