# GrassEye 地图插件包治理施工图 FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-MAP-PLUGIN-PACKAGE-BLUEPRINT-FINAL
owner: map-plugin-package
documentType: construction-blueprint
lawAuthority: module-map-plugin-package.instructions.md
architecturePhase: Static Capability Package Architecture
supportArchitecture:
  - Pluginized Map Package Architecture
  - Map-Driven Prompt Contract Architecture
  - Nerve Bus Governed Transport
  - Forensics-backed Runtime Proof
status: active
replace:
  - docs/法案辅助文件/GrassEye 地图插件包治理施工图.md
  - docs/法案辅助文件/GrassEye Map Prompt Contract Governance 施工图.md
mustNotCreate:
  - new ability group
  - map-prompt-contract ability group
  - map runtime owner
  - prompt owner inside map
  - second orchestration
  - code plugin runtime
```

本施工图是 `module-map-plugin-package.instructions.md` 的建设级落地映射。  
本施工图不新增能力组，不修改 14 个 active ability groups。  
Prompt Contract Governance 是跨边界治理契约，不是新 owner，不是新执行链。  
若本文档与 Map Plugin 法案冲突，以 Map Plugin 法案为最高权威。

---

## 1. 定位

Map Plugin Package 是地图插件包治理域。

它负责：
```txt
map package schema
task-template package schema
operational map package schema
prompt binding declaration
AI-generated map draft/quarantine
import / quarantine / validation / approval / activation / rollback
active registry read model
ordinary/developer task feed
map authoring prompt builder
capability catalog generated read model
map validation report
activation snapshot proof
```

它不负责：
```txt
不拥有 mission flow
不推进 mission step
不执行 prompt
不拥有 prompt 内容
不调用 AI
不调用能力组
不发送 Nerve Bus
不写 Forensics 存储
不成为 Orchestration child capability
不扩展 14 个 active ability groups
```

一句话：
```txt
地图包是路线，不是运行时；Prompt Contract 是引用，不是地图里的 prompt 文本。
```

---

## 2. 架构位置

正式架构：
```txt
Static Capability Package Architecture
+ Pluginized Map Package Architecture
+ Map-Driven Prompt Contract Architecture
+ Nerve Bus Governed Transport
+ Forensics-backed Runtime Proof
```

链路：
```txt
Commander Console
→ task template / import / approval / activation request
→ Map Plugin Package registry + validators
→ active approved map + activationSnapshotRef
→ Orchestration consumes frozen active map
→ Nerve Bus dispatches steps
→ AI resolves promptContractId through AI Prompt Contract Catalog
→ Forensics records map/prompt/proof refs
```

---

## 3. Canonical Package Structure

```txt
src/map-plugins/
├── authoring/
│   ├── capability-catalog/
│   ├── map-authoring-prompt-builder.ts
│   ├── map-authoring-request.schema.ts
│   ├── map-authoring-response.schema.ts
│   ├── map-authoring-safety-policy.ts
│   └── map-authoring-template.ts
├── builtins/
├── import/
│   ├── map-package-importer.ts
│   ├── map-package-quarantine.ts
│   ├── map-package-activation.ts
│   └── map-package-rollback.ts
├── registry/
│   ├── active-map-registry.ts
│   ├── map-plugin-registry.ts
│   ├── quarantined-map-registry.ts
│   ├── map-activation-record.ts
│   ├── map-rollback-record.ts
│   └── map-version-store.ts
├── schema/
│   ├── map-plugin-package.schema.ts
│   ├── map-plugin-manifest.schema.ts
│   ├── task-template-package.schema.ts
│   ├── operational-map-package.schema.ts
│   ├── operational-map-step.schema.ts
│   ├── operational-map-transition.schema.ts
│   ├── prompt-bindings.schema.ts
│   └── orchestration-consumer.schema.ts
├── shared/
└── validation/
```

---

## 4. Owner Boundary

### Map Plugin Package

负责：
```txt
map package schema
prompt binding declaration
import/quarantine/validation/approval/activation/rollback lifecycle
AI-generated map draft/quarantine management
active registry read model
task template feeds
```

不负责：
```txt
prompt 内容
AI 执行
能力组调用
Nerve Bus dispatch
mission state mutation
branch decision
```

### AI Capability

负责：
```txt
Prompt Contract Catalog
Prompt Contract Registry
promptContractId 解析
promptHash / outputSchemaRef / forbiddenOutputs / confidence policy
AI result schema validation
```

Map 只能引用 `promptContractId`。

### Orchestration

负责：
```txt
消费 active approved map
冻结 activationSnapshotRef
推进 mission state / step state
通过 Nerve Bus dispatch
按 outputSchemaRef 声明字段 branch
```

### Commander Console

负责：
```txt
显示 ordinary task feed
显示 developer validation/proof details
发起 import / approval / activation / rollback request
展示 prompt contract 摘要
```

不允许直接写 active registry。

### Forensics Persistence

负责记录：
```txt
mapId
packageId
activationId
activationSnapshotRef
stepId
promptContractId
promptHash
outputSchemaRef
authoringPromptRef
authoringModelRef
capabilityCatalogVersion
promptCatalogVersion
validationReportRef
humanApprovalRef
```

---

## 5. Map Package Schema

`MapPackage` 必须包含：
```yaml
manifest: required
taskTemplate: required
operationalMap: required
dependencies: required
compatibility: required
policy: required
promptBindings: required
changelog: string
signature: optional
```

Cross-section parity：
```txt
manifest.mapId == operationalMap.mapId
manifest.taskTemplateId == taskTemplate.taskTemplateId
taskTemplate.version == manifest.packageVersion
```

---

## 6. Manifest Schema

`manifest` 必须包含：
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
approvalStatus: draft | quarantined | approved | rejected
aiGenerated: boolean
authoringPromptRef: required-if-aiGenerated
authoringModelRef: required-if-aiGenerated
capabilityCatalogVersion: required-if-approved-or-aiGenerated
promptCatalogVersion: required-if-approved-or-aiGenerated
validationReportRef: required-if-approved
humanApprovalRef: required-if-approved
```

禁止：
```txt
approved without validationReportRef
approved without humanApprovalRef
aiGenerated without authoringPromptRef
taskTemplate active while manifest not approved
```

---

## 7. Task Template Schema

Ordinary task feed 只允许暴露：
```txt
taskTemplateId
displayName
description
recommended
taskCategory
version
defaultRunLimit
maxAllowedRunLimit
safetyLevel
userVisibleCapabilities
availability
defaultHumanGoal
```

Developer feed 可暴露：
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
validation findings
dependency chains
compatibility matrix
```

禁止：
```txt
ordinary mode exposing mapId
ordinary mode exposing stepId
ordinary mode exposing childCapabilityId
ordinary mode exposing promptContractId
ordinary start flow requiring requestedPlatformId
```

---

## 8. Operational Map Step Schema

每个 step 必须包含：
```yaml
stepId: required
capabilityId: orchestration
childCapabilityId: required
stepKind: ability | ai | review | finalize
targetAbilityGroupId: required-if-ability-or-ai
inputRefs: list
outputRefPolicy.storeAs: list
promptContractId: required-if-ai-step
successCondition: required
failureBranch: required
reviewBranch: required
postActionVerification: required-if-action-step
timeoutPolicy.maxDurationMs: required
proofPolicy.requiresRuntimeProof: true
```

动作 step 必须满足：
```txt
mouse-click requires visual-target + geometry-guard + PAV
mouse-scroll requires geometry-guard + PAV
text-input requires approved text + target + geometry + PAV
forensics persistence required for evidence outputs
```

---

## 9. Prompt Binding Schema

每个 AI step 必须有 matching prompt binding：
```yaml
stepId: required
promptContractId: required
requiredInputRefs: non-empty
outputSchemaRef: required
confidencePolicy: required
reviewPolicy: required
failureBranch: required
```

禁止字段：
```txt
rawPrompt
systemPrompt
userPrompt
promptText
executablePromptLogic
handler
functionBody
script
exec
shell
```

---

## 10. Prompt Contract Catalog Boundary

Prompt Contract 归 AI Capability。

Map validation 必须检查：
```txt
promptContractId exists
step.promptContractId matches binding.promptContractId
binding.outputSchemaRef matches Prompt Contract Catalog outputSchemaRef
requiredInputRefs are produced by previous steps or initial refs
failureBranch exists
reviewBranch exists
```

Orchestration 只把 `promptContractId + inputRefs` 交给 Nerve Bus / AI。  
AI runtime 通过 Prompt Contract Catalog 解析 prompt 内容。  
地图包不保存 raw prompt。

---

## 11. Branch Condition DSL

允许字段：
```yaml
conditionType: comparison
leftRef: declared output field or status
operator: equals | notEquals | exists | notExists | greaterThan | lessThan | confidenceAbove | confidenceBelow | statusIs | reviewRequired
rightValue: string | number | boolean | null
onTrue: optional
onFalse: optional
```

约束：
```txt
branch 只能引用 outputSchemaRef 声明字段
status 字段是受控内置字段
numeric operator requires numeric rightValue
exists/notExists/reviewRequired requires rightValue=null
exactly one transition may match
ambiguous transition -> review/fail
no transition -> review/fail
```

禁止：
```txt
raw expression string
function body
eval
Function constructor
JavaScript expression
raw AI natural-language branch
```

---

## 12. Lifecycle Pipeline

固定生命周期：
```txt
import
→ quarantine
→ schema validation
→ dependency validation
→ transition closure validation
→ capability registry validation
→ prompt contract validation
→ platform profile validation
→ version requirement validation
→ security validation
→ dry-run validation
→ validation report
→ human approval
→ activation
→ active registry
→ rollback
```

Activation 必须写：
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
approvedBy: required
activatedAt: required
reason: required
humanApprovalRef: required
validationReportRef: required
capabilityCatalogVersion: required
promptCatalogVersion: required
operationalMapHash: required
mapPackageHash: required
```

---

## 13. AI-generated Map Lifecycle

AI-generated map 固定流程：
```txt
draft
→ quarantine
→ schema validation
→ capability validation
→ prompt contract validation
→ safety validation
→ dry-run validation
→ human approval
→ activation
```

AI authoring 输出必须：
```txt
只输出 candidate map package JSON
manifest.aiGenerated=true
manifest.approvalStatus=draft
taskTemplate.availabilityPolicy=draft
超出能力范围输出 needsCapabilityExpansion
范围不清输出 requiredClarifications
```

禁止：
```txt
aiGenerated=false spoof
approvalStatus=approved spoof
AI generated map direct active
unknown ability/child
unknown promptContractId
raw prompt
executable logic
```

---

## 14. Capability Catalog

Capability Catalog 是 generated read model。

每项至少包含：
```yaml
abilityGroupId: required
childCapabilityId: required
displayName: required
description: required
inputSchemaRef: required
outputSchemaRef: required
routableByMap: boolean
requiresGeometryProof: boolean
requiresPostActionVerification: boolean
requiresReviewGate: boolean
sensitiveOperation: boolean
supportedTargets: list
forbiddenResponsibilities: list
```

禁止：
```txt
map references missing capability
map routes to routableByMap=false
action step without PAV
geometry action without geometry proof
manual editing generated catalog as source truth
```

---

## 15. Map Security Validator

必须递归检查 JSON keys / string values。

禁止：
```txt
rawPrompt
systemPrompt
userPrompt
promptText
executablePromptLogic
handler
functionBody
function
script
exec
shell
command
js
ts
mjs
tsx
jsx
import
dynamicImport
require
eval
Function
code
runtime
callback
onRun
onStep
onTransition
```

检查对象：
```txt
manifest
taskTemplate
operationalMap steps
transitions
promptBindings
policy
dependencies
compatibility
signature
```

---

## 16. Forensics Proof

至少记录：
```txt
mapId
packageId
activationId
activationSnapshotRef
stepId
promptContractId
promptHash
outputSchemaRef
authoringPromptRef
authoringModelRef
capabilityCatalogVersion
promptCatalogVersion
validationReportRef
humanApprovalRef
mapPackageHash
operationalMapHash
```

禁止：
```txt
raw prompt body in proof
active map without activation proof
validation pass without issue list
rollback without rollback record
```

---

## 17. Enforcement Package

必须存在：
```txt
scripts/audit/domains/map-plugin-package/manifest.json
scripts/audit/domains/map-plugin-package/inspector.ts
scripts/audit/domains/map-plugin-package/run-inspector.ts
scripts/audit/domains/map-plugin-package/negative-proof-harness.ts
```

Inspector 必须：
```txt
ts-morph AST-level
JSON schema traversal
reference graph check
capability catalog check
prompt contract catalog check
import graph check
anti-escape
negative-proof-backed
runner-connected
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
verify script as release truth
```

---

## 18. Inspector 必查

```txt
1. Law file is machine-blocking.
2. Map packages are data-only, not child abilities.
3. Built-ins pass same lifecycle gates.
4. Import/quarantine/validation/approval/activation/rollback exists.
5. Active record contains activationSnapshotRef and hashes.
6. Approved/active map requires humanApprovalRef and validationReportRef.
7. Manifest/task/operational/dependency/compatibility/policy/promptBinding sections complete.
8. No executable payload/rawPrompt/handler/function/eval/import/script/shell.
9. AI-generated maps remain draft/quarantine until human approval.
10. Prompt bindings match AI steps and Prompt Contract Catalog.
11. Branch condition DSL uses declared schema fields only.
12. Capability Catalog references are valid and routableByMap.
13. PAV/Geometry/Review requirements from catalog are enforced.
14. Ordinary/developer feed boundary is enforced.
15. Commander cannot direct-write active registry or approval records.
16. Forensics-compatible proof fields exist.
17. ALL active Map Plugin laws in registry/matrix/audit-plan/runner.
18. negative-proof-harness executed.
```

---

## 19. Negative Proof 最低清单

```txt
manual-first enforcement reintroduced
map package modeled as child ability
registry dispatches Nerve Bus
builtin package active without lifecycle proof
activate unapproved map
activate package with validation issues
active record missing activationSnapshotRef
approved manifest without humanApprovalRef
AI-generated package missing authoringPromptRef
map package adds rawPrompt
map package adds functionBody
map package adds eval string
delete promptContractId
delete prompt binding
unknown promptContractId
prompt outputSchemaRef mismatch
branch reads undeclared field
raw expression string in condition
AI generated map with aiGenerated=false
AI generated map with approvalStatus=approved
AI generated map active immediately
map references missing capability child
map routes to routableByMap=false
ordinary feed exposes mapId
Commander directly writes active registry
Forensics proof missing activationId
remove negative proof invocation
turn P0 into warning-only
```

---

## 20. READY 标准

Map Plugin Package READY 仅当：
```txt
Map Plugin 法案 / 施工图 / inspector / generated / runner 口径一致
ALL active law enforcement PASS
CI-FULL PASS
map packages remain data-only
no map as child ability/runtime owner
builtins and imports pass same lifecycle
active map has validationReportRef + humanApprovalRef + activationSnapshotRef + hashes
AI-generated maps remain draft/quarantine until validation + human approval
prompt binding matches AI step and Prompt Contract Catalog
no raw prompt / executable prompt logic / handler / function body / eval
capability catalog references valid and routableByMap
branch DSL reads only declared outputSchemaRef fields
ordinary/developer surfaces separated
Commander cannot bypass validators/registry ports
Forensics-compatible proof records exist
negative proof PASS
```

---

## 21. 漂移信号

```txt
map package contains rawPrompt
map package contains handler/functionBody/eval/import
map appears under children
builtin active without activation record
aiGenerated package appears active directly
approvalStatus approved without humanApprovalRef
active map missing activationSnapshotRef
branch condition reads undeclared AI output field
ordinary task feed exposes mapId
Commander writes active registry directly
verify script becomes release gate
```

---

## 22. 最终原则

```txt
地图决定流程，但不执行流程。
Prompt Contract 决定 AI 如何问，但不写在地图里。
AI 执行 Prompt Contract，但不决定 mission 分支。
Orchestration 消费冻结地图，但不拼 prompt。
Commander 负责审核批准，但不绕过 validator。
Forensics 记账存证，但不拥有地图或流程。
```
