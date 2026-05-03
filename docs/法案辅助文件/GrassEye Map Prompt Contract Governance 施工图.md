# GrassEye Map Prompt Contract Governance 施工图 FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-MAP-PROMPT-CONTRACT-GOVERNANCE-BLUEPRINT-FINAL
documentType: governance-blueprint
owner: ai-capability
relatedSupportDomain: map-plugin-package
status: active
notAbilityGroup: true
notMapRuntime: true
```

本文件定义 Map-Driven Prompt Contract 的治理结构。  
Prompt 内容归 AI Capability。  
Map Plugin Package 只引用 `promptContractId`，不拥有 prompt 内容。

---

## 1. 核心边界

```txt
AI Capability owns Prompt Contract Catalog.
Map Plugin Package references promptContractId.
Orchestration consumes frozen active map and sends promptContractId through Nerve Bus.
Nerve Bus transports promptContractId/outputSchemaRef only.
Forensics records promptContractId/promptHash/outputSchemaRef/proof refs.
```

Forbidden:

```txt
rawPrompt in map package
systemPrompt/userPrompt/promptText in map package
prompt text hardcoded in Orchestration
prompt text hardcoded in Nerve Bus
prompt text hidden in map adapter
AI runtime using map-specific hidden prompt outside Prompt Contract Catalog
```

---

## 2. Required Prompt Contract Types

Minimum required prompt contracts:

```txt
map-authoring-from-user-requirement-v1
product-video-classification-v1
visual-target-identification-v1
page-state-understanding-v1
post-action-verification-v1
```

Each prompt contract must define:

```txt
promptContractId
promptContractVersion
promptHash
inputSchemaRef
outputSchemaRef
allowedInputRefs
dataPolicy
providerPolicy
reviewPolicy
failurePolicy
redactionPolicy
forensicsPolicy
```

---

## 3. Map Authoring Prompt Contract

`map-authoring-from-user-requirement-v1` must instruct AI:

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

## 4. AI Output Schema Contract

`map-authoring-from-user-requirement-v1` output must match:

```txt
MapAuthoringAiOutputSchema
```

Required fields:

```txt
authoringRunId
userRequirementRef
sourceRequirementHash
providerPolicyRef
promptContractId
promptContractVersion
promptHash
capabilityCatalogVersion
promptCatalogVersion
mapPackageSchemaVersion
securityPolicyRef
outputFormatVersion
generatedAt
authoringProofRef
draftPackage
humanReadableExplanation
riskWarnings
validationHints
requiredClarifications
needsCapabilityExpansion
promptBindings
draftStatus
```

Forbidden output:

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

## 5. Prompt Binding

Each map AI step must bind:

```txt
stepId
promptContractId
requiredInputRefs
outputSchemaRef
confidencePolicy
reviewPolicy
failureBranch
```

Rules:

```txt
promptContractId exists in Prompt Contract Catalog
outputSchemaRef matches Prompt Contract Catalog
requiredInputRefs are available from prior steps or initial command refs
branch DSL reads only outputSchemaRef-declared fields
```

---

## 6. Forensics Proof

For each AI step, Forensics must be able to record:

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
```

Raw prompt body must not be stored in map package proof.

---

## 7. Negative Proof

Must fail:

```txt
map contains rawPrompt
map step missing promptContractId
prompt binding missing outputSchemaRef
promptContractId unknown
outputSchemaRef mismatch
Orchestration hardcodes prompt text
Nerve Bus carries raw prompt body
branch reads undeclared output field
AI map authoring output emits activationSnapshotRef
AI map authoring output emits approvalStatus=approved
```

---

## 8. READY 标准

Prompt Contract Governance READY only when:

```txt
AI owns Prompt Contract Catalog
Map references promptContractId only
Map package contains no raw prompt
AI authoring prompt contract exists
AI authoring output schema strict
Prompt binding validates against catalog
Branch DSL validates against outputSchemaRef
Forensics records prompt refs/hashes/outputSchemaRef
negative proof PASS
CI-FULL PASS
```
