# GrassEye Map Prompt Contract Governance 施工图 MAP-AUTHORING FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-MAP-PROMPT-CONTRACT-GOVERNANCE-BLUEPRINT-MAP-AUTHORING-FINAL
documentType: governance-blueprint
owner: ai-capability
relatedSupportDomain: map-plugin-package
status: active
notAbilityGroup: true
notMapRuntime: true
replace:
  - docs/法案辅助文件/GrassEye Map Prompt Contract Governance 施工图.md
```

Prompt 内容归 AI Capability。  
Map Plugin Package 只引用 `promptContractId`，不拥有 prompt 内容。  
Map Authoring Input Package 给 AI 提供上下文，但不把 prompt 内容写进地图。

---

## 1. 核心边界

```txt
AI Capability owns Prompt Contract Catalog.

Map/Prompt Contract boundary:

- 生产自动化地图必须使用 `routePlanBoundMap`，只能声明入口脊柱、AI 交付、Prompt Contract 引用、输入/输出 refs、`routePlanId`。
- 禁止地图出现任何约束逻辑。
- 一个地图 + 对应 Prompt Contract，才是完整地图。
- 地图只引用 Prompt Contract；Prompt Contract 定义 AI 问题、输入、输出结构、二元判断语义和可分支输出字段。
- 自动化地图严厉禁止加入任何人工审查的动作，必须自动化完成。
- 启动入口脊柱允许一个 AI“准备工作”步骤输出 YES/NO + `routeLabel` + `nonExecutableSummary`，地图只可在入口脊柱内做 fail-closed 本地 transition；Route Plan 仍然独占启动通过后的 `routeLabel -> step chain`。
- Prompt Contract 输出 `routeLabel`；Route Plan 负责启动通过后的 `routeLabel -> step chain`。地图不得写 IF/ELSE，也不得复制 Route Plan 步骤、transition、routeLabel 或动作链。
- 生产代码负责超时、重试、JSON 无效、证据交付、后动作验证和失败终止。
Map Plugin Package references promptContractId.
Map Plugin Package validates promptContractId/outputSchemaRef references.
Orchestration consumes frozen active map and sends promptContractId through Nerve Bus.
Nerve Bus transports promptContractId/outputSchemaRef only.
Forensics records promptContractId/promptVersion/promptHash/outputSchemaRef/proof refs.
```

Forbidden：

```txt
rawPrompt in map package
systemPrompt/userPrompt/promptText in map package
prompt text hardcoded in Orchestration
prompt text hardcoded in Nerve Bus
prompt text hidden in map adapter
AI runtime using map-specific hidden prompt outside Prompt Contract Catalog
Map Plugin Package selecting provider
Map Plugin Package reading API key
```

---

## 2. Prompt Contract Catalog Entry

Each prompt contract must define：

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
binaryDecisionPolicy: required when prompt output is branchable
redactionPolicy: required
forensicsPolicy: required
forbiddenOutputs: list
branchableOutputFields: list
exampleInputRefs: optional
exampleOutput: optional
```

Minimum contracts：

```txt
map-authoring-from-user-requirement-v1
vision.productPresence.v1
visual-target-identification-v1
page-state-understanding-v1
post-action-verification-v1
```

---

## 3. Map Authoring Prompt Contract

`map-authoring-from-user-requirement-v1` must consume：

```txt
MapAuthoringInputPackage
```

Required input refs：

```txt
userRequirementRef
capabilityCatalog
promptContractCatalog
outputSchemaCatalog
mapPackageSchema
mapAuthoringOutputSchema
safetyPolicy
automationGatePolicy
evidencePolicy
pavPolicy
forensicsPolicy
targetPlatformProfile
exampleMaps
```

It must instruct AI：

```txt
You are GrassEye Map Authoring Agent.
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
You must treat capabilityCatalog as the only ability truth and must not rely on a hardcoded ability list inside prompt text.
If requirement is unclear, output requiredClarifications.
If current abilities are insufficient, output needsCapabilityExpansion.
If capabilityCatalog is missing, stale, or inconsistent with governed capability truth, return BLOCKED_CAPABILITY_CATALOG_STALE.
If operation sends/deletes/buys/submits/modifies user data, add automated gate.
If operation involves commit/send/publish behavior, require explicit automated gate.
Return strict JSON matching MapAuthoringAiOutputSchema.
```

---

## 4. MapAuthoringAiOutputSchema

Required：

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
outputSchemaCatalogVersion: required
mapPackageSchemaVersion: required
securityPolicyRef: required
safetyPolicyRef: required
automationGatePolicyRef: required
evidencePolicyRef: required
pavPolicyRef: required
forensicsPolicyRef: required
platformProfileRef: required
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

Forbidden：

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

## 5. Output Schema Catalog

Every outputSchemaRef used by prompt contracts must exist in Output Schema Catalog.

Required：

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

Production `routePlanBoundMap` may read only:

```txt
AI-provided routeLabel where routeLabel is declared by Prompt Contract output schema and allowed by the bound Route Plan
```

`genericDiagnosticMap` Branch DSL may read only:

```txt
status
schemaFieldRef:<fieldName> where fieldName ∈ branchableFields
```

---

## 6. Prompt Binding

Each map AI step must bind：

```txt
stepId
promptContractId
requiredInputRefs
outputSchemaRef
```

Rules：

```txt
promptContractId exists in Prompt Contract Catalog
outputSchemaRef exists in Output Schema Catalog
outputSchemaRef matches Prompt Contract Catalog
requiredInputRefs are available from prior steps or initial command refs
branch DSL reads only outputSchemaRef-declared branchable fields
```

---

## 7. Forensics Proof

For each AI step, Forensics must record refs/hashes：

```txt
promptContractId
promptContractVersion
promptHash
outputSchemaRef
aiInputRefs
aiOutputRef
aiProofRef
modelPolicyRef/providerPolicyRef
activationSnapshotRef
mapPackageId
mapPackageVersion
stepId
capabilityCallId
authoringProofRef when map authoring
userRequirementRef when map authoring
sourceRequirementHash when map authoring
```

Forbidden：

```txt
raw prompt body in map proof
API key in proof/log/map
raw user secret in proof/log/map
```

---

## 8. real-code-inspection

Must fail：

```txt
map contains rawPrompt
map step missing promptContractId
prompt binding missing outputSchemaRef
promptContractId unknown
outputSchemaRef unknown
outputSchemaRef mismatch
Orchestration hardcodes prompt text
Nerve Bus carries raw prompt body
branch reads undeclared output field
AI map authoring output emits activationSnapshotRef
AI map authoring output emits activationGateStatus=gate_passed
AI map authoring output references unknown outputSchemaRef
Map Authoring Input Package missing outputSchemaCatalog
Map Authoring Input Package missing safetyPolicy
Map Authoring Input Package missing evidencePolicy
```

---

## 9. READY 标准

Prompt Contract Governance READY only when：

```txt
AI owns Prompt Contract Catalog
Map references promptContractId only
Map package contains no raw prompt
Map Authoring Input Package is complete
AI authoring prompt contract consumes complete input package
AI authoring output schema strict
Prompt binding validates against Prompt Contract Catalog
OutputSchemaRef validates against Output Schema Catalog
Branch DSL validates against branchableFields
Forensics records prompt refs/hashes/outputSchemaRef
real-code-inspection PASS
CI-FULL PASS
```


---

# Map Authoring Input Package Prompt Contract Supplement

本补充章节不替代 Prompt Contract Governance 原文。  
它补齐 map-authoring-from-user-requirement-v1 对完整输入包、Output Schema Catalog、政策目录和 Forensics proof 的要求。

## A. map-authoring-from-user-requirement-v1 Required Inputs

```txt
MapAuthoringInputPackage
```

Required input refs:

```txt
userRequirementRef
sourceRequirementHash
capabilityCatalog
promptContractCatalog
outputSchemaCatalog
mapPackageSchema
mapAuthoringOutputSchema
safetyPolicy
automationGatePolicy
evidencePolicy
pavPolicy
forensicsPolicy
privacyPolicy
secretPolicy
rateLimitPolicy
targetPlatformProfile
exampleMaps
validationPolicy
```

Missing any required input:

```txt
BLOCKED_AUTHORING_INPUT_INCOMPLETE
```

## B. Prompt Text Requirements

The prompt contract must instruct advanced AI:

```txt
You are GrassEye Map Authoring Agent.
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
If requirement is unclear, output requiredClarifications.
If current abilities are insufficient, output needsCapabilityExpansion.
If operation sends/deletes/buys/submits/modifies user data, add automated gate.
If operation involves commit/send/publish behavior, require explicit automated gate.
Return strict JSON matching MapAuthoringAiOutputSchema.
```

## C. MapAuthoringAiOutputSchema Required Fields

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
outputSchemaCatalogVersion: required
mapPackageSchemaVersion: required
securityPolicyRef: required
safetyPolicyRef: required
automationGatePolicyRef: required
evidencePolicyRef: required
pavPolicyRef: required
forensicsPolicyRef: required
platformProfileRef: required
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

Forbidden output:

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

## D. Output Schema Catalog Binding

Every outputSchemaRef used by map-authoring or normal AI steps must exist in Output Schema Catalog.

Required output schema entry:

```yaml
outputSchemaRef
schemaVersion
declaredFields
branchableFields
fieldTypes
requiredFields
reviewFields
confidenceFields
forbiddenFields
exampleOutput
```

Production `routePlanBoundMap` may read only:

```txt
AI-provided routeLabel where routeLabel is declared by Prompt Contract output schema
```

`genericDiagnosticMap` Branch DSL may read status/schemaFieldRef only for diagnostic maps and must not route production automation.

For product-presence binary routing:

```txt
decision: product_yes | product_no
routeLabel: selected userRequirement.binaryOutcomePolicy route label
reason: evidence-backed explanation
confidence: model-owned confidence
nonExecutableSummary: log-only summary, never an action instruction
```

Orchestration must not infer routes from `product_yes`, `product_no`, `reason`, `confidence`, or `nonExecutableSummary`. It may only match `routeLabel` mechanically against Route Plan labels.

## E. Forensics Proof Requirements

For map authoring, Forensics must be able to record:

```txt
promptContractId
promptContractVersion
promptHash
outputSchemaRef
authoringRunId
authoringProofRef
userRequirementRef
sourceRequirementHash
capabilityCatalogVersion
promptCatalogVersion
outputSchemaCatalogVersion
mapPackageSchemaVersion
safetyPolicyRef
automationGatePolicyRef
evidencePolicyRef
pavPolicyRef
forensicsPolicyRef
platformProfileRef
aiInputRefs
aiOutputRef
```

Forbidden:

```txt
raw prompt body
API key
raw user secret
raw sensitive text
```

## F. real-code-inspection Additions

Must fail:

```txt
Prompt Contract missing routeLabel for binary product decision
Orchestration infers product_yes/product_no into next action
hardcoded ability-group list inside map-authoring prompt template
hardcoded child-capability list inside map-authoring prompt template
build authoring prompt from duplicated static ability text instead of governed capabilityCatalog
remove capability catalog freshness block
```

```txt
Map Authoring Input Package missing capabilityCatalog
Map Authoring Input Package missing promptContractCatalog
Map Authoring Input Package missing outputSchemaCatalog
Map Authoring Input Package missing safetyPolicy
Map Authoring Input Package missing evidencePolicy
Map Authoring Input Package missing targetPlatformProfile
AI map authoring output emits activationSnapshotRef
AI map authoring output emits activationGateStatus=gate_passed
AI map authoring output references unknown outputSchemaRef
AI map authoring output branches over undeclared field
```
