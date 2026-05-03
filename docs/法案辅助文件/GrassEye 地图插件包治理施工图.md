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
  - Forensics-backed Runtime Proof
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
→ Commander human review
→ human approval
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

Orchestration 只消费 active approved frozen activation map。  
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
│   ├── map-package-approval.ts
│   ├── map-package-activation.ts
│   └── map-package-rollback.ts
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
└── negative-proof-harness.ts
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
approvalStatus: draft | quarantined | approved | rejected | disabled
aiGenerated: boolean
authoringPromptRef: required when aiGenerated
authoringModelRef: required when aiGenerated
authoringRunId: required when aiGenerated
authoringProofRef: required when aiGenerated
userRequirementRef: required when aiGenerated
sourceRequirementHash: required when aiGenerated
capabilityCatalogVersion: required when approved or aiGenerated
promptCatalogVersion: required when approved or aiGenerated
validationReportRef: required when approved
humanApprovalRef: required when approved
```

Forbidden:

```txt
approvalStatus=approved without humanApprovalRef
approvalStatus=approved without validationReportRef
aiGenerated=true without authoringProofRef
aiGenerated=true with approvalStatus=approved at generation time
```

---

## 5. Operational Map Step Model

Each step must contain:

```yaml
stepId: required
capabilityId: orchestration
childCapabilityId: required
stepKind: ai | action | observation | review | branch | finalization
targetAbilityGroupId: required
inputRefs: list
outputRefPolicy: required
promptContractId: required for AI step
timeoutPolicy: required
proofPolicy: required
successCondition: required
failureBranch: required
reviewBranch: required
postActionVerification: required for action step
```

Rules:

```txt
AI step must have promptContractId.
Action step must obey capability catalog PAV/geometry/review requirements.
Steps may reference only known abilityGroupId/childCapabilityId from capability catalog.
```

---

## 6. Prompt Binding

Each AI step must have matching prompt binding:

```yaml
stepId: required
promptContractId: required
requiredInputRefs: list
outputSchemaRef: required
confidencePolicy: required
reviewPolicy: required
failureBranch: required
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

Allowed fields:

```yaml
conditionType: comparison
leftRef: status | schemaFieldRef:<fieldName>
operator: equals | notEquals | exists | notExists | greaterThan | lessThan | confidenceAbove | confidenceBelow | statusIs | reviewRequired
rightValue: scalar or null
onTrue: stepId
onFalse: stepId
```

Validation:

```txt
leftRef=status may reference only allowed status field
schemaFieldRef:<fieldName> must exist in outputSchemaRef declared fields
numeric operators require numeric value
exists/notExists/reviewRequired require null rightValue
ambiguous transition fails/review
no transition fails/review
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
external transmission approval
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
approvalStatus: draft
availabilityPolicy: draft
```

Forbidden in AI output:

```txt
approvalStatus=approved
active=true
activationSnapshotRef
humanApprovalRef
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
You cannot emit humanApprovalRef.
You cannot emit validationReportRef.
You cannot emit activationSnapshotRef.
You cannot invent abilityGroupId.
You cannot invent childCapabilityId.
You cannot invent promptContractId.
You must use only capabilityCatalog and promptContractCatalog.
If requirement is unclear, output requiredClarifications.
If current abilities are insufficient, output needsCapabilityExpansion.
If operation sends/deletes/buys/submits/modifies user data, add review gate.
If operation involves commit/send/publish behavior, require explicit human confirmation.
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

### 10.3 Human Approval

Required:

```txt
humanApprovalRef
approvedBy
approvedAt
approvalReason
acceptedRiskWarnings
```

Commander owns approval UI.  
Map Plugin stores approval record through governed registry API.

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
approvedBy: required
activatedAt: required
reason: required
humanApprovalRef: required
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
activation without humanApprovalRef
activation without activationProofRef
production built-in active by side door
```

---

### 10.5 Rollback

Rollback must produce:

```txt
rollbackRecordRef
previousActivationId
previousActivationSnapshotRef
newActiveActivationId
reason
rolledBackAt
rolledBackBy
```

Rollback must preserve previous activation history.

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
defaultRunLimit
maxAllowedRunLimit
safetyLevel
userVisibleCapabilities
availability
defaultHumanGoal
```

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
humanReviewPoints
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
requiresReviewGate
sensitiveOperation
supportedTargets
forbiddenResponsibilities
```

Rules:

```txt
map may reference only routableByMap=true entries
action step with PAV requirement must include PAV
geometry step with geometry requirement must include geometry proof
sensitive operation requires review gate
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
missionStateMutation
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
humanApprovalRef
activationProofRef
activationSnapshotRef
mapPackageHash
operationalMapHash
capabilityCatalogVersion
promptCatalogVersion
rollbackRecordRef when rollback
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
└── negative-proof-harness.ts
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
18. negative proof executed.
```

---

## 17. Negative Proof Minimum

Must fail → rollback → pass:

```txt
manual-first enforcement reintroduced
map package modeled as child ability
registry dispatches Nerve Bus
builtin package active without lifecycle proof
builtin auto-active in production
activate unapproved map
activate package with validation issues
active record missing activationSnapshotRef
active record missing activationProofRef
approved manifest without humanApprovalRef
AI-generated package missing authoringPromptRef
AI-generated package missing authoringProofRef
AI output approvalStatus=approved
AI output active=true
AI output contains rawPrompt
AI output contains activationSnapshotRef
AI output references unknown abilityGroupId
AI output references unknown childCapabilityId
AI output references unknown promptContractId
AI generated send/publish flow without review gate
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
remove negative proof invocation
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
active map has validationReportRef + humanApprovalRef + activationProofRef + activationSnapshotRef + hashes
AI-generated maps remain draft/quarantine until validation + human approval
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
owner-local inspector PASS
negative proof PASS
ALL active law enforcement PASS
CI-FULL PASS
```
