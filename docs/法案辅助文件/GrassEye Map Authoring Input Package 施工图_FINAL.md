# GrassEye Map Authoring Input Package 施工图 FULL-MERGED FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-MAP-AUTHORING-INPUT-PACKAGE-BLUEPRINT-FULL-MERGED-FINAL
documentType: construction-blueprint
owner: map-plugin-package
relatedOwner:
  - ai-capability
  - commander-console-capability
  - orchestration-capability
  - forensics-persistence-capability
status: active
notAbilityGroup: true
notRuntimeOwner: true
lawAuthority: module-map-plugin-package.instructions.md
```

本文件定义高级 AI 生成 GrassEye 地图所需的完整输入包。  
没有完整输入包，高级 AI 只能生成草稿文字，不能生成可验证、可激活、可执行的 GrassEye 地图。

---

## 1. 目标

Map Authoring Input Package 解决 8 个问题：

```txt
1. 用户要做什么？
2. 系统有哪些能力？
3. AI 可以怎么提问和判断？
4. AI 输出有哪些可分支字段？
5. 地图 JSON 应该怎么写？
6. 哪些动作必须人工确认？
7. 哪些步骤必须 PAV / Forensics / Evidence？
8. 当前平台允许和禁止什么？
```

---

## 2. Required Package Shape

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

Missing required field:

```txt
BLOCKED_AUTHORING_INPUT_INCOMPLETE
```

---

## 3. User Requirement

Required minimum:

```yaml
goal: required
targetPlatform: required
allowedAutomationScope: required
mustAskBefore: list
failureHandlingPreference: optional
evidencePreference: optional
runLimit: optional
```

If missing or ambiguous:

```txt
requiredClarifications
```

---

## 4. Capability Catalog

### 4.1 Ability Group Entry

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

### 4.2 Child Capability Entry

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

AI may reference only known and routable abilityGroupId/childCapabilityId.  
If ability is unavailable:

```txt
needsCapabilityExpansion
```

Capability Catalog Single Truth:

```txt
Prompt template may hardcode rules only; it must not hardcode ability-group or child-capability lists.
Map Authoring Input Package capabilityCatalog is the only ability truth consumed by advanced AI map authoring.
Adding, deleting, renaming, or changing a child capability must update the governed capability registry and generated capability catalog, not prompt body text.
Missing or stale capability catalog truth must block map authoring with BLOCKED_CAPABILITY_CATALOG_STALE.
```

---

## 5. Prompt Contract Catalog

核心边界：

- 生产自动化地图必须使用 `routePlanBoundMap`，只能声明入口脊柱、AI 交付、Prompt Contract 引用、输入/输出 refs、`routePlanId`。
- 禁止地图出现任何约束逻辑。
- 一个地图 + 对应 Prompt Contract，才是完整地图。
- Prompt Contract 定义 AI 问题、输入、输出结构、二元语义和可分支输出字段。
- 生产代码定义超时、重试、JSON 无效、证据保留、后动作验证和失败终止。
- 自动化地图严禁人工审查动作，严禁 review_required 终态。
- Route Plan 是二元选项动作链的唯一来源；地图只能引用 `routePlanId`，不能复制 Route Plan 步骤、transition、routeLabel 或动作链。

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
```

Map Plugin validates references only.  
AI Capability owns the Prompt Contract Catalog and prompt content.

---

## 6. Output Schema Catalog

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

Branch DSL may read only:

```txt
status
schemaFieldRef:<fieldName> where fieldName ∈ branchableFields
```

---

## 7. Map Package Schema

Must define:

```txt
manifest
taskTemplate
operationalMap
step
transition
promptBindings
route-only operationalMap
Prompt Contract references
lifecycle status
draft fields
activation fields
```

---

## 8. Map Authoring Output Schema

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

Forbidden:

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

## 9. Safety / Automation Gate Policy

```yaml
highRiskOperations:
  sendMessage: automationGateRequired
  submitForm: automationGateRequired
  purchasePayment: automationGateRequired
  deleteContent: automationGateRequired
  modifyUserData: automationGateRequired
  bulkAction: automationGateRequiredWithRateLimit
  textInputCommit: automationGateRequired
externalAiTransmission:
  userRequirement: externalTransmissionGateRequired
aiGeneratedMapActivation:
  governedActivationProofRequired: true
```

---

## 10. Evidence / PAV / Forensics Policy

```yaml
actionStep:
  requiresRuntimeProof: true
  requiresPavWhenCatalogRequires: true
mouseClick:
  successRequiresPavHandoff: true
textInput:
  successRequiresPavHandoff: true
screenshot:
  requiresRetentionPolicy: true
aiStep:
  requiresAiProofRef: true
  requiresPromptContractRefs: true
evidenceCandidate:
  requiresEvidencePacketRef: true
forensics:
  storesRefsAndHashesOnly: true
  forbidsRawSecrets: true
  forbidsRawPromptBody: true
  forbidsRawSensitiveText: true
  forbidsRawClipboardText: true
```

---

## 11. Platform Profile

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

---

## 12. Example Maps

Rules:

```txt
exampleOnly=true
schema-valid
not active
not gate_passed
not imported without lifecycle
must not contain rawPrompt
must not contain activationSnapshotRef
```

---

## 13. Authoring Prompt Use

The map authoring prompt must receive either:

```txt
full MapAuthoringInputPackage
```

or refs to all required parts.

It must not receive only userRequirement.

Prompt skeleton may be hardcoded, but ability-group, child-capability, schema, and policy facts must come from the governed input package catalogs at build time.

---

## 14. Missing Input Handling

If required package field is missing:

```txt
BLOCKED_AUTHORING_INPUT_INCOMPLETE
```

AI must not generate map.

If user requirement unclear:

```txt
requiredClarifications
```

If ability unavailable:

```txt
needsCapabilityExpansion
```

---

## 15. User-facing Explanation Requirements

Required fields:

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

Ordinary mode must not expose:

```txt
stepId
childCapabilityId
promptContractId
activationSnapshotRef
internal dependency graph
rawPrompt
```

---

## 16. Inspector Requirements

Inspector must check:

```txt
MapAuthoringInputPackage required fields
userRequirement.binaryOutcomePolicy required
binary outcome selected route labels included in sourceRequirementHash
capabilityCatalog completeness
promptContractCatalog completeness
outputSchemaCatalog completeness
mapPackageSchema presence
mapAuthoringOutputSchema presence
safetyPolicy presence
automationGatePolicy presence
evidencePolicy presence
pavPolicy presence
forensicsPolicy presence
targetPlatformProfile presence
exampleMaps exampleOnly
authoring prompt builder not userRequirement-only
missing package blocks generation
prompt template contains rules only and no duplicated ability catalog text
stale capability catalog blocks authoring
```

Negative proof must include:

```txt
remove binaryOutcomePolicy
remove selected routeLabel from binary outcome policy
remove capabilityCatalog
remove promptContractCatalog
remove outputSchemaCatalog
remove mapPackageSchema
remove mapAuthoringOutputSchema
remove safetyPolicy
remove automationGatePolicy
remove evidencePolicy
remove pavPolicy
remove forensicsPolicy
remove targetPlatformProfile
build prompt from userRequirement only
exampleMap active
```

---

## 17. READY 标准

Map Authoring Input Package READY only when:

```txt
all required fields present
userRequirement carries natural language goal plus selected/default binary outcome options
selectedPositiveRouteLabel and selectedNegativeRouteLabel are present and hash-covered
capabilityCatalog detailed
promptContractCatalog present
outputSchemaCatalog present
mapPackageSchema present
mapAuthoringOutputSchema present
safety/automationGate/evidence/PAV/Forensics policies present
platformProfile present
example maps marked exampleOnly
missing package blocks generation
negative proof PASS
```
