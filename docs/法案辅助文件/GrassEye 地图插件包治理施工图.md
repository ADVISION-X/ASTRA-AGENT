# GrassEye 地图插件包治理施工图 FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-MAP-PLUGIN-PACKAGE-BLUEPRINT-FINAL
documentType: construction-blueprint
owner: map-plugin-package
ownerType: support-governance-domain
status: active
lawAuthority: module-map-plugin-package.instructions.md
architecturePhase:
  - Static Capability Package Architecture
  - Pluginized Map Package Architecture
  - Map-Driven Prompt Contract Architecture
  - Nerve Bus Governed Transport
  - Forensics-backed owner evidence
replace:
  - docs/法案辅助文件/GrassEye 地图插件包治理施工图.md
notAbilityGroup: true
notRuntimeOwner: true
notPromptOwner: true
notExecutionOwner: true
```

本施工图是 `module-map-plugin-package.instructions.md` 的建设级落地映射。

本施工图不新增 lawId，不新增能力组，不修改 14 个 active ability groups。  
若本文档与 Map Plugin 法案冲突，以 Map Plugin 法案为最高权威。

---

## 1. 核心定位

```txt
map-plugins 是“路线图系统”。
能力组是“执行工具”。

地图插件包治理红线：

- 生产自动化地图必须是 `routePlanBoundMap`。
- `routePlanBoundMap` 只能声明入口脊柱、AI 交付、Prompt Contract 引用、输入/输出 refs、`routePlanId`；入口脊柱允许一个 AI“准备工作”步骤与其 fail-closed 本地 transition。
- Production `routePlanBoundMap` allowed entry spine: open target, capture startup viewport/evidence, prepare startup AI input, startup-preparation AI, product-judgment AI handoff, fail-closed transition, and `routePlanId`.
- Production `routePlanBoundMap` forbidden internals: frame-specific capture steps, frame-specific prepare steps, frame-specific refs, comment chain, click chain, PAV chain, evidence persistence chain, and next-video advance chain.
- Route Plan 是肌肉记忆唯一来源，独占 `routeLabel -> 步骤链 -> 能力组/子能力`。
- 地图只负责把任务带到 AI 判断点；AI 输出受控 `routeLabel` 后，Route Plan 独占后续肌肉记忆与能力调度。
- `genericDiagnosticMap` 只能用于隔离诊断，可以写诊断步骤和 transitions，但不得绑定 Route Plan，也不得进入生产自动化主链。
- 地图禁止写任何约束逻辑、判断逻辑、超时策略、重试策略、证据保留策略、后动作验证策略、人工审核动作。
- 一个地图 + 对应 Prompt Contract，才是完整地图。
- AI 判断语义必须进入 Prompt Contract 和 Output Schema；生产代码只负责运行边界、超时兜底、证据交付和失败终止。
- 启动阶段 login/safety/captcha/feed-ready 的 YES/NO 继续判断必须进入 AI Prompt Contract，不得由 page-state step 担任入口脊柱 owner。
- 自动化地图严厉禁止 request-human-review、human-review、manual-review、operator-review、review_required 终态或任何等待人的步骤。
- Route Plan 是调度肌肉记忆的唯一来源。地图只能引用 `routePlanId`，不得复制 Route Plan 已经拥有的步骤、transition、routeLabel 或动作链。
Orchestration 是“按路线图调度工具的人”。
AI 是“帮用户画路线图的人”。
Commander 是“用户下命令和确认路线图的界面”。
```

map-plugin-package 的身份：

```txt
Support Governance Domain
Task Map DSL Infrastructure
Map Package Lifecycle Governance
Prompt Binding Governance
Activation Snapshot Infrastructure
```

它不是：

```txt
Ability Group
Child Capability
Runtime Executor
AI Provider
Prompt Owner
Orchestration
Nerve Bus Dispatcher
Forensics Writer
```

---

## 2. 系统协作链路

### 2.1 用户需求到地图草案

```txt
Commander Console
→ 用户输入自然语言需求
→ Commander 补入系统二元默认选项
→ Commander 创建 map-authoring request
→ Nerve Bus governed transport
→ AI Capability
→ AI 使用 map-authoring-from-user-requirement-v1 Prompt Contract
→ AI 输出 MapAuthoringCandidate JSON
→ Map Plugin 接收 candidate
→ schema gate
→ draft normalizer
→ quarantine
```

Map Plugin 不直接调用 AI API，不读取 API key，不选择模型。

用户需求转地图的源头必须包含：

```txt
naturalLanguageGoal
product_yes outcome options:
  1 read-comments
  2 save-evidence
  3 read-comments-and-save-evidence
  4 finish-current-video
product_no outcome options:
  1 skip-current-video
  2 mark-not-interested-then-continue
  3 publish-default-smile-comment-then-continue
  4 stop-task
selected/default:
  product_yes -> read-comments-and-save-evidence
  product_no -> skip-current-video
```

这些选项进入 Map Authoring Input Package 的 `userRequirement.binaryOutcomePolicy`，再进入运行期 Prompt Contract。地图只暴露路线标签；调度只机械匹配 AI 输出的 `routeLabel`，不得把 `product_yes/product_no` 硬编码成下一步。

二元选项到动作链的匹配表不写在地图中，必须写入 Route Plan。地图只声明 `routePlanId`。生产调度读取 Route Plan 后机械执行 `routeLabel -> step chain`，不得在 Orchestration 内新增第二套匹配表。

---

### 2.2 地图验证到激活

```txt
draft map package
→ quarantine
→ schema validation
→ dependency validation
→ transition closure validation
→ capability catalog validation
→ prompt contract validation
→ platform profile validation
→ version requirement validation
→ security validation
→ dry-run validation
→ validation report
→ Commander governed activation
→ automation gate
→ activation proof
→ activation record
→ activationSnapshotRef
→ active registry
→ ordinary task feed
```

---

### 2.3 运行激活地图

```txt
Commander task selection
→ governed mission command
→ Nerve Bus
→ Orchestration
→ frozen active map
→ step dispatch through Nerve Bus
→ ability groups execute
→ PAV / Forensics proof
```

Orchestration 只消费 active gate-passed frozen activation map。  
Map Plugin 不运行地图。

---

## 3. 标准目录结构

```txt
src/map-plugins/
├── authoring/
│   ├── map-authoring-ai-output.schema.ts
│   ├── map-authoring-draft-normalizer.ts
│   ├── map-authoring-prompt-builder.ts
│   ├── map-authoring-template.ts
│   └── map-explanation-view-builder.ts
├── builtins/
│   └── *.map-package.json
├── import/
│   ├── map-package-importer.ts
│   ├── map-package-quarantine.ts
│   ├── map-package-automation-gate.ts
│   ├── map-package-activation.ts
│   └── map-package-re-inspect.ts
├── registry/
│   ├── active-map-registry.ts
│   ├── map-plugin-registry.ts
│   ├── map-task-feed.ts
│   └── map-developer-feed.ts
├── schema/
│   ├── map-package.schema.ts
│   ├── map-manifest.schema.ts
│   ├── task-template.schema.ts
│   ├── operational-map.schema.ts
│   ├── operational-map-step.schema.ts
│   ├── operational-map-transition.schema.ts
│   ├── operational-map-payload.schema.ts
│   └── prompt-binding.schema.ts
├── shared/
│   ├── capability-catalog.generated.ts
│   ├── map-package-proof.ts
│   ├── map-package-status.ts
│   ├── map-plugin-errors.ts
│   ├── map-plugin-types.ts
│   └── prompt-contract-catalog-ref.ts
└── validation/
    ├── map-package-validator.ts
    ├── map-schema-validator.ts
    ├── map-dependency-validator.ts
    ├── map-transition-closure-validator.ts
    ├── map-capability-catalog-validator.ts
    ├── prompt-contract-step-validator.ts
    ├── map-platform-profile-validator.ts
    ├── map-version-requirement-validator.ts
    ├── map-security-validator.ts
    └── map-dry-run-validator.ts
```

Required audit domain:

```txt
scripts/audit/domains/map-plugin-package/
├── manifest.json
├── inspector.ts
├── run-inspector.ts
└── owner-inspection-harness.ts
```

---

## 4. Map Package Schema

### 4.1 Required package sections

```txt
manifest
taskTemplate
operationalMap
dependencies
compatibility
policy
promptBindings
changelog
signature
```

### 4.2 Manifest

Required:

```yaml
packageId: required
packageKind: operational-map-package
packageVersion: required
mapId: required
taskTemplateId: required
displayName: required
author: required
createdAt: required
minimumGrassEyeVersion: required
mapSchemaVersion: required
activationGateStatus: draft | quarantined | gate_passed | rejected | disabled
aiGenerated: boolean
authoringPromptRef: required when aiGenerated
authoringModelRef: required when aiGenerated
authoringRunId: required when aiGenerated
authoringProofRef: required when aiGenerated
userRequirementRef: required when aiGenerated
sourceRequirementHash: required when aiGenerated
capabilityCatalogVersion: required when gate_passed or aiGenerated
promptCatalogVersion: required when gate_passed or aiGenerated
validationReportRef: required when gate_passed
automationGateRef: required when gate_passed
```

Forbidden:

```txt
activationGateStatus=gate_passed without automationGateRef
activationGateStatus=gate_passed without validationReportRef
aiGenerated=true without authoringProofRef
aiGenerated=true with activationGateStatus=gate_passed at generation time
```

---

## 5. Operational Map Step Model

This model is diagnostic-only. It may be used by `genericDiagnosticMap` for governed debugging surfaces, but it is forbidden as the production action chain for `routePlanBoundMap`.

Production `routePlanBoundMap` may declare only:

```yaml
mapKind: routePlanBoundMap
initialStepId: entry spine step
routePlanId: required
AI handoff step: promptContractId + inputRefs/outputRefPolicy only
promptBindings: required
```

Production `routePlanBoundMap` allowed entry spine:

```yaml
open target: allowed
capture startup viewport/evidence: allowed
prepare startup AI input: allowed
startup-preparation AI: allowed
product-judgment AI handoff: allowed
fail-closed transition: allowed
routePlanId: required
```

Production `routePlanBoundMap` forbidden internals:

```yaml
frame-specific capture steps: forbidden
frame-specific prepare steps: forbidden
frame-specific refs: forbidden
comment chain: forbidden
click chain: forbidden
PAV chain: forbidden
evidence persistence chain: forbidden
next-video advance chain: forbidden
```

Operational Map Step Model 如果用于生产 map，只能表达入口交接，不得表达肌肉动作链。`genericDiagnosticMap` 可以诊断，但不得绑定 Route Plan，不得进入生产主链。

Production `routePlanBoundMap` must not declare action, observation, review, branch, or finalization step chains; Route Plan is the only owner of `routeLabel -> step chain -> abilityGroup/childCapability`.

Diagnostic-only steps must contain:

```yaml
stepId: required
capabilityId: orchestration
childCapabilityId: required
stepKind: ai | action | observation | branch | finalization
targetAbilityGroupId: required
inputRefs: list
outputRefPolicy: required
promptContractId: required for AI step
Route-only map shape: required
stepId: required
targetAbilityGroupId: required for ability/AI execution step
childCapabilityId: required
promptContractId: required only for AI step
inputRefs/outputRefPolicy: required evidence handoff only
transition: fromStepId + onStatus + toStepId/finalStatus only
Forbidden in map: proofPolicy, successCondition, failureBranch, reviewBranch, postActionVerification, transition.condition
```

Rules:

```txt
AI step must have promptContractId.
Action step must obey capability catalog PAV/geometry requirements.
Steps may reference only known abilityGroupId/childCapabilityId from capability catalog.
Map step must not declare timeoutPolicy / timeoutMs / maxDurationMs / primitiveTimeoutMs.
Map step must not decide wait, retry, polling, or AND THEN fallback behavior.
Timeout and observable-condition control belong only to production runtime code.
```

---

## 6. Prompt Binding

Each AI step must have matching prompt binding:

```yaml
stepId: required
promptContractId: required
requiredInputRefs: list
outputSchemaRef: required
```

Rules:

```txt
step.promptContractId === promptBinding.promptContractId
promptContractId exists in AI Prompt Contract Catalog
outputSchemaRef matches Prompt Contract Catalog entry
requiredInputRefs are produced by previous steps or initial command refs
```

Forbidden:

```txt
rawPrompt
systemPrompt
userPrompt
promptText
prompt body inside map
hidden prompt inside adapter
prompt text in Orchestration
```

---

## 7. Branch Condition DSL

Branch DSL is diagnostic-only. It is allowed only in `genericDiagnosticMap` and must not enter production `routePlanBoundMap`.

Production `routePlanBoundMap` uses only `routeLabelMatch`: Orchestration reads the AI `routeLabel`, verifies it is declared by the Prompt Contract and allowed by the bound Route Plan, then mechanically executes the Route Plan chain. No arbitrary `schemaFieldRef` Branch DSL, review branch, or map-owned transition branch is allowed in production route-plan-bound automation.

Allowed fields:

```yaml
conditionType: comparison
leftRef: status | schemaFieldRef:<fieldName>
operator: equals | notEquals | exists | notExists | greaterThan | lessThan | confidenceAbove | confidenceBelow | statusIs
rightValue: scalar or null
onTrue: stepId
onFalse: stepId
```

Validation:

```txt
leftRef=status may reference only allowed status field
schemaFieldRef:<fieldName> must exist in outputSchemaRef declared fields
numeric operators require numeric value
exists/notExists require null rightValue
ambiguous transition fails
no transition fails
```

Forbidden:

```txt
raw expression string
function body
eval
Function
JavaScript expression
undeclared payload field
raw AI natural language as branch truth
```

---

## 8. AI-Generated Map Authoring

### 8.1 Map Plugin responsibility

Map Plugin owns:

```txt
authoring input schema
authoring prompt payload builder
AI output schema
draft normalizer
quarantine
validation
plain-language explanation view model
```

Map Plugin does not own:

```txt
external AI provider execution
API key
provider selection
cost policy
external transmission automated gate
AI model choice
```

These belong to AI Capability and Security/Privacy.

---

### 8.2 Required authoring input

```yaml
userRequirement: required
userRequirementRef: required
sourceRequirementHash: required
capabilityCatalog: required
promptContractCatalog: required
mapPackageSchema: required
securityPolicy: required
outputFormat: required
targetPlatformId: required
requestedTaskCategory: optional
```

---

### 8.3 Required AI output

```yaml
authoringRunId: required
userRequirementRef: required
sourceRequirementHash: required
providerPolicyRef: required
promptContractId: map-authoring-from-user-requirement-v1
promptContractVersion: required
promptHash: required
capabilityCatalogVersion: required
promptCatalogVersion: required
mapPackageSchemaVersion: required
securityPolicyRef: required
outputFormatVersion: required
generatedAt: required
authoringProofRef: required
draftPackage: required
humanReadableExplanation: required
riskWarnings: list
validationHints: list
requiredClarifications: list
needsCapabilityExpansion: boolean
promptBindings: list
draftStatus: draft | needs_clarification | needs_capability_expansion
```

Generated package must set:

```yaml
aiGenerated: true
activationGateStatus: draft
availabilityPolicy: draft
```

Forbidden in AI output:

```txt
activationGateStatus=gate_passed
active=true
activationSnapshotRef
automationGateRef
validationReportRef
rawPrompt
functionBody
eval
script
import
require
unknown abilityGroupId
unknown childCapabilityId
unknown promptContractId
```

---

## 9. Map Authoring Prompt Builder

Prompt builder must instruct advanced AI:

```txt
You are GrassEye Map Authoring Agent.
You generate declarative operational-map package candidates only.
You cannot write code.
You cannot write raw prompts.
You cannot execute tools.
You cannot call APIs.
You cannot activate maps.
You cannot approve maps.
You cannot emit automationGateRef.
You cannot emit validationReportRef.
You cannot emit activationSnapshotRef.
You cannot invent abilityGroupId.
You cannot invent childCapabilityId.
You cannot invent promptContractId.
You must use only capabilityCatalog and promptContractCatalog.
If requirement is unclear, output requiredClarifications.
If current abilities are insufficient, output needsCapabilityExpansion.
If operation sends/deletes/buys/submits/modifies user data, add automated gate.
If operation involves commit/send/publish behavior, require explicit automated gate.
Return strict JSON matching MapAuthoringAiOutputSchema.
```

---

## 10. Lifecycle

### 10.1 Import

Input:

```txt
package file / generated candidate / built-in seed
```

Output:

```txt
importProofRef
quarantined package record
```

Rules:

```txt
all packages enter quarantine first
built-ins do not bypass quarantine in production
```

---

### 10.2 Validation

Validation gates:

```txt
schema validation
dependency validation
transition closure validation
capability catalog validation
prompt contract validation
platform profile validation
version requirement validation
security validation
dry-run validation
```

Output:

```txt
validationReportRef
validator list
pass/fail
issue list
severity
generatedAt
```

Activation blocked if any P0/P1 issue remains.

---

### 10.3 Automation Gate

Required:

```txt
automationGateRef
gateActor
gatePassedAt
automationGateReason
acceptedRiskWarnings
```

Commander owns automation-gate UI.  
Map Plugin stores automation-gate record through governed registry API.

---

### 10.4 Activation

Required activation record:

```yaml
activationId: required
activationSnapshotRef: required
activationSnapshotHash: required
mapPackageId: required
mapPackageVersion: required
mapId: required
mapVersion: required
taskTemplateId: required
requestedPlatformId: required
gateActor: required
activatedAt: required
reason: required
automationGateRef: required
validationReportRef: required
importProofRef: required
quarantineProofRef: required
activationProofRef: required
authoringProofRef: required when aiGenerated
capabilityCatalogVersion: required
promptCatalogVersion: required
operationalMapHash: required
mapPackageHash: required
```

Forbidden:

```txt
activation by availabilityPolicy only
activation from draft
activation without validationReportRef
activation without automationGateRef
activation without activationProofRef
production built-in active by side door
```

---

### 10.5 re-inspect

re-inspect must produce:

```txt
re-inspectRecordRef
previousActivationId
previousActivationSnapshotRef
newActiveActivationId
reason
rolledBackAt
rolledBackBy
```

re-inspect must preserve previous activation history.

---

## 11. Ordinary / Developer Feed

### 11.1 Ordinary feed

Allowed fields only:

```txt
taskTemplateId
displayName
description
recommended
taskCategory
version
safetyLevel
userVisibleCapabilities
availability
defaultHumanGoal
```

Task templates must not carry run-limit ownership fields such as `defaultRunLimit` or `maxAllowedRunLimit`. Launch defaults belong to APP settings, not to map packages.

Must not expose:

```txt
mapId
stepId
childCapabilityId
promptContractId
activationSnapshotRef
package dependency graph
requestedPlatformId as launch key
```

Draft/quarantine/rejected/disabled maps must not appear as runnable tasks.

---

### 11.2 Developer feed

May include:

```txt
packageId
packageVersion
activationId
activationSnapshotRef
mapId
mapVersion
taskTemplateId
requestedPlatformId
platformProfileRef
targetProfileRef
dependency chains
validation findings
compatibility matrix
promptContractId
stepId
childCapabilityId
```

---

## 12. User-facing Map Explanation View

Ordinary user explanation must include:

```txt
taskName
plainLanguageGoal
whatThisTaskWillDo
humanReadableSteps
whenItWillPause
permissionsAndLoginNeeds
evidenceToBeSaved
screenshotRetentionSummary
aiJudgmentRisk
automationGatePoints
safetyWarnings
activationReadinessSummary
```

It must not expose by default:

```txt
stepId
childCapabilityId
promptContractId
activationSnapshotRef
mapPackageHash
internal dependency graph
```

Developer mode may expose technical details separately.

Explanation is display data only. It is not runtime truth.

---

## 13. Capability Catalog

Capability Catalog is generated read model.

Required entry fields:

```txt
abilityGroupId
childCapabilityId
displayName
description
inputSchemaRef
outputSchemaRef
routableByMap
requiresGeometryProof
requiresPostActionVerification
requiresAutomationGate
sensitiveOperation
supportedTargets
forbiddenResponsibilities
```

Rules:

```txt
map may reference only routableByMap=true entries
action step with PAV requirement must include PAV
geometry step with geometry requirement must include geometry proof
sensitive operation requires automated gate
unknown requirement produces needsCapabilityExpansion
```

---

## 14. Security Validator

Must block executable payloads:

```txt
rawPrompt
systemPrompt
userPrompt
promptText
functionBody
eval
script
import
require
onRun
onStep
onTransition
directAbilityCall
directNerveBusDispatch
missionStateregression
```

Must scan executable markers:

```txt
eval(
require(
import(
Function(
=>
function 
javascript:
child_process
npm run
node 
bash 
sh 
osascript
```

Must not false-positive ordinary explanation text containing words such as:

```txt
message
messages
template
instruction
instructions
content
```

when they are in human-readable fields.

---

## 15. Forensics-compatible Proof

Required proof chain:

```txt
importProofRef
quarantineProofRef
validationReportRef
automationGateRef
activationProofRef
activationSnapshotRef
mapPackageHash
operationalMapHash
capabilityCatalogVersion
promptCatalogVersion
re-inspectRecordRef when re-inspect
authoringProofRef when aiGenerated
userRequirementRef when aiGenerated
sourceRequirementHash when aiGenerated
```

Proof must store refs/hashes, not raw prompt body or API key.

---

## 16. Enforcement

Required audit domain:

```txt
scripts/audit/domains/map-plugin-package/
├── manifest.json
├── inspector.ts
├── run-inspector.ts
└── owner-inspection-harness.ts
```

Inspector must use:

```txt
ts-morph AST
JSON/schema traversal
reference checks
import graph checks
anti-escape checks
```

Must verify:

```txt
1. map-plugin-package not ability group.
2. maps data-only.
3. no executable payload.
4. no raw prompt.
5. built-ins pass lifecycle.
6. production built-ins not auto-active.
7. activation fields complete.
8. AI authoring chain complete.
9. AI generated maps draft/quarantine only.
10. prompt bindings match AI steps and Prompt Contract Catalog.
11. branch DSL declared-field only.
12. capability catalog references valid/routable.
13. PAV/Geometry/Review requirements enforced.
14. ordinary/developer feed boundary.
15. user explanation hides internals.
16. Forensics proof fields complete.
17. ALL active laws in registry/matrix/audit-plan/runner.
18. real-code-inspection executed.
19. builtin loader wraps schema failures with packageFile, ownerResponsible, expectedPackageKind, receivedPackageKind, and actionableMessage before startup consumes them.
```

---

## 17. real-code-inspection Minimum

Must fail → re-inspect → pass:

```txt
manual-first enforcement reintroduced
map package modeled as child ability
builtin loader direct parse diagnostic bypass
registry dispatches Nerve Bus
builtin package active without lifecycle proof
builtin auto-active in production
activate map before automation gate passes
activate package with validation issues
active record missing activationSnapshotRef
active record missing activationProofRef
gate-passed manifest without automationGateRef
AI-generated package missing authoringPromptRef
AI-generated package missing authoringProofRef
AI output activationGateStatus=gate_passed
AI output active=true
AI output contains rawPrompt
AI output contains activationSnapshotRef
AI output references unknown abilityGroupId
AI output references unknown childCapabilityId
AI output references unknown promptContractId
AI generated send/publish flow without automated gate
map package adds functionBody
map package adds eval string
map package adds direct ability call
delete promptContractId
delete prompt binding
unknown promptContractId
prompt outputSchemaRef mismatch
branch reads undeclared field
raw expression string in condition
map references missing capability child
map routes to routableByMap=false
action step missing PAV
geometry step missing geometry proof
ordinary feed exposes mapId
ordinary feed exposes promptContractId
ordinary explanation exposes stepId
Commander directly writes active registry
Forensics proof missing activationId
Forensics proof missing authoringProofRef for AI map
remove real-code-inspection invocation
turn P0 into warning-only
```

---

## 18. READY 标准

Map Plugin Package READY only when:

```txt
law/blueprint/inspector/generated/runner agree
map-plugin-package is support governance, not ability group
maps are data-only
no runtime/child ability behavior
all built-ins and imported packages pass same lifecycle
production registry does not auto-active builtins
active map has validationReportRef + automationGateRef + activationProofRef + activationSnapshotRef + hashes
AI-generated maps remain draft/quarantine until validation + automation gate
AI-generated maps include full authoring chain
authoring prompt prevents authority spoofing and capability invention
prompt binding matches AI step and Prompt Contract Catalog
no raw prompt / executable prompt logic / handler / function body / eval
security validator blocks executable payload without blocking ordinary explanation text
capability catalog references are valid and routableByMap
branch DSL reads only declared outputSchemaRef fields
ordinary/developer task surfaces are separated
user-facing explanation is plain-language and hides runtime internals
Commander cannot bypass validators/registry ports
Forensics-compatible proof records exist
builtin parse failures are diagnosable before app shell health, with ownerResponsible=map-plugin-package and packageFile/actionableMessage refs
owner-local inspector PASS
real-code-inspection PASS
ALL active law enforcement PASS
CI-FULL PASS
```


---

# Map Authoring Input Package FULL-MERGED Supplement

本补充章节不删除、不压缩前文地图插件包治理施工图。  
它只补齐高级 AI 生成 GrassEye 可验证地图所需的完整输入包与校验要求。

## A. 为什么需要输入包

高级 AI 生成地图不能只依赖用户自然语言需求。

必须同时获得：

```txt
用户需求
能力清单
Prompt Contract 清单
Output Schema / 分支字段清单
地图 JSON Schema
安全与人工确认规则
PAV / Forensics / 证据规则
平台约束
示例地图
```

否则高级 AI 只能生成“看起来像地图”的草案，无法保证可验证、可激活、可运行。

---

## B. Map Authoring Input Package 标准结构

```yaml
inputPackageId: required
inputPackageVersion: required
generatedAt: required
requesterRef: required

userRequirement: required
userRequirementRef: required
sourceRequirementHash: required

targetPlatformProfileRef: required
targetPlatformProfile: required

capabilityCatalog: required
promptContractCatalog: required
outputSchemaCatalog: required

mapPackageSchema: required
mapAuthoringOutputSchema: required

safetyPolicy: required
automationGatePolicy: required
evidencePolicy: required
pavPolicy: required
forensicsPolicy: required
privacyPolicy: required
secretPolicy: required
rateLimitPolicy: required

exampleMaps: optional
validationPolicy: required
expectedDraftStatus: draft
```

缺少任何 required 字段：

```txt
BLOCKED_AUTHORING_INPUT_INCOMPLETE
```

不得继续生成地图。

---

## C. Capability Catalog 细则

### C.1 Ability Group Entry

```yaml
abilityGroupId: required
abilityGroupCode: required
displayName: required
description: required
ownerDomain: required
routableByMap: boolean
publicContractRef: required
inputSchemaRef: required
outputSchemaRef: required
forbiddenResponsibilities: non-empty list
children: non-empty list
```

### C.2 Child Capability Entry

```yaml
childCapabilityId: required
childCapabilityCode: required
displayName: required
description: required
inputSchemaRef: required
outputSchemaRef: required
requiredInputRefs: list
producedOutputRefs: list
requiresGeometryProof: boolean
requiresTargetProof: boolean
requiresFocusProof: boolean
requiresApprovedText: boolean
requiresPostActionVerification: boolean
requiresAutomationGate: boolean
sensitiveOperation: boolean
sideEffectLevel: none | read | write | submit | delete | purchase
allowedStepKinds: list
supportedTargetKinds: list
forbiddenResponsibilities: non-empty list
proofRequirements: list
failureModes: list
```

AI 只能引用 catalog 中 `routableByMap=true` 的能力。  
能力不足时必须输出 `needsCapabilityExpansion=true`，不得发明能力。

Capability Catalog Single Truth:

```txt
Prompt template may hardcode rules only; it must not hardcode ability-group or child-capability lists.
Map Authoring Input Package capabilityCatalog is the only ability truth consumed by advanced AI map authoring.
Adding, deleting, renaming, or changing a child capability must update the governed capability registry and generated capability catalog, not prompt body text.
Missing or stale capability catalog truth must block map authoring with BLOCKED_CAPABILITY_CATALOG_STALE.
```

---

## D. Prompt Contract Catalog 与 Output Schema Catalog

### D.1 Prompt Contract Entry

```yaml
promptContractId: required
promptContractVersion: required
promptHash: required
displayName: required
description: required
inputSchemaRef: required
outputSchemaRef: required
allowedInputRefs: list
dataPolicy: required
providerPolicy: required
binaryDecisionPolicy: required when the prompt produces branchable judgment
redactionPolicy: required
forensicsPolicy: required
forbiddenOutputs: list
branchableOutputFields: list
```

### D.2 Output Schema Entry

```yaml
outputSchemaRef: required
schemaVersion: required
declaredFields: list
branchableFields: list
fieldTypes: map
requiredFields: list
reviewFields: list
confidenceFields: list
forbiddenFields: list
exampleOutput: optional
```

`genericDiagnosticMap` branch 只能引用：

```txt
status
schemaFieldRef:<fieldName> where fieldName ∈ branchableFields
```

`routePlanBoundMap` 禁止使用 Branch DSL，只能使用 Prompt Contract 声明的 `routeLabel` 与 Route Plan allowed labels 做机械匹配。

禁止：

```txt
raw expression
function body
eval
Function
undeclared output field
raw AI natural language branch
```

---

## E. Safety / Automation Gate Policy

必须定义：

```txt
send message → automation gate required
submit form → automation gate required
purchase/payment → automation gate required
delete content → automation gate required
modify user data → automation gate required
bulk action → automation gate + rate limit required
text-input commit/send/publish semantics → Route Plan automated gate required
external AI transmission of userRequirement → externalTransmissionGate required
AI-generated map activation → governed activation proof required
```

---

## F. Evidence / PAV / Forensics Policy

必须定义：

```txt
mouse-click success requires PAV handoff
text-input success requires PAV handoff
action step requires owner evidence
AI step requires aiProofRef + promptContract refs
candidate/evidence capture requires evidencePacketRef or Forensics write request
screenshot step requires retention policy
Forensics stores refs/hashes only
raw API keys/cookies/secrets/raw prompt/raw sensitive text/raw clipboard text must not enter proof/log/map package
```

---

## G. Platform Profile

必须定义：

```yaml
platformId: required
platformName: required
loginRequired: boolean
authCheckPolicy: required
securityCheckPolicy: required
supportedTargets: list
prohibitedOperations: list
rateLimitPolicyRef: required
captchaPolicy: required
automationGatePolicyRef: required
safetyPauseConditions: list
```

AI 不得生成违反 platform profile 的地图步骤。

---

## H. Authoring Prompt Builder 约束

生成地图的高级 AI 提示词必须写死：

```txt
You receive a complete Map Authoring Input Package.
You generate declarative operational-map package candidates only.
You cannot write code.
You cannot write raw prompts.
You cannot execute tools.
You cannot call APIs.
You cannot activate maps.
You cannot approve maps.
You cannot emit automationGateRef.
You cannot emit validationReportRef.
You cannot emit activationSnapshotRef.
You cannot invent abilityGroupId.
You cannot invent childCapabilityId.
You cannot invent promptContractId.
You cannot invent outputSchemaRef.
You must use only capabilityCatalog, promptContractCatalog, outputSchemaCatalog, and policy catalogs.
You must treat capabilityCatalog as the only ability truth and must not rely on manually duplicated ability text.
If requirement is unclear, output requiredClarifications.
If current abilities are insufficient, output needsCapabilityExpansion.
If capabilityCatalog is missing, stale, or inconsistent with governed capability truth, return BLOCKED_CAPABILITY_CATALOG_STALE.
If operation sends/deletes/buys/submits/modifies user data, add automated gate.
If operation involves commit/send/publish behavior, require explicit automated gate.
Return strict JSON matching MapAuthoringAiOutputSchema.
```

---

## I. AI 生成地图输出要求

AI 输出必须是 draft candidate：

```yaml
aiGenerated: true
activationGateStatus: draft
availabilityPolicy: draft
```

禁止：

```txt
activationGateStatus=gate_passed
active=true
activationSnapshotRef
automationGateRef
validationReportRef
rawPrompt
functionBody
eval
script
import
require
unknown abilityGroupId
unknown childCapabilityId
unknown promptContractId
unknown outputSchemaRef
```

---

## J. User-facing Explanation

解释视图必须从 draftPackage + validation findings + policy catalogs 生成。

Required:

```txt
taskName
plainLanguageGoal
whatThisTaskWillDo
humanReadableSteps
whatWillNotBeDone
whenItWillPause
permissionsAndLoginNeeds
platformAssumptions
evidenceToBeSaved
screenshotRetentionSummary
aiJudgmentRisk
automationGatePoints
safetyWarnings
capabilityLimitations
needsCapabilityExpansionSummary
requiredClarificationsSummary
activationReadinessSummary
```

普通用户视图禁止暴露：

```txt
stepId
childCapabilityId
promptContractId
activationSnapshotRef
internal dependency graph
rawPrompt
```

---

## K. READY 增补标准

Map Authoring 能力 READY only when:

```txt
Map Authoring Input Package complete
capabilityCatalog detailed
promptContractCatalog present
outputSchemaCatalog present
mapPackageSchema present
mapAuthoringOutputSchema present
safety/automationGate/evidence/PAV/Forensics/platform policies present
prompt template contains rules only and no duplicated ability catalog text
stale capability catalog blocks authoring
AI output schema strict
AI generated maps draft/quarantine only
high-risk actions require automated gates
action steps require PAV
evidence steps require Forensics/evidence policy
ordinary explanation hides internals
activation proof and activationSnapshotRef required before runnable
inspector PASS
real-code-inspection PASS
```

## L. Runtime Debug Loop 补充：route-only closure

正确链路：
- 每个 step 只能声明调用能力组、子能力、输入输出引用，以及 AI step 的 Prompt Contract 引用。
- 每个 transition 只能声明 fromStepId、onStatus、toStepId/finalStatus。
- AI 分支语义来自 Prompt Contract 输出，生产运行时消费 AI decision 后选择路线。

禁止链路：
- step 声明 failureBranch/reviewBranch/successCondition/postActionVerification/proofPolicy。
- transition 声明 condition。
- top-level 声明 failureBranches/reviewBranches/sequencePolicy/proofPolicy/policy。
- Orchestration 在运行时猜测 fallback transition。

inspector 应覆盖：
- `validateMapTransitionClosure()` 必须检查 route-only step 可达性和 transition 指向闭合。
- schema/audit 必须物理禁止地图约束字段复发。

real-code-inspection 应覆盖：
- 向 step 注入 `successCondition` / `failureBranch` / `reviewBranch` / `postActionVerification` / `proofPolicy` 必须失败。
- 向 transition 注入 `condition` 必须失败。

结构化日志必备字段：
- mapId、stepId、transitionId、fromStepId、status、matchedTransition、ownerResponsible、actionableMessage。

READY 标准：
- 真实重启后 map 路线不得依赖任何地图约束逻辑。
- 修复后必须真实触发任务并重新执行第一阶段日志分析。
