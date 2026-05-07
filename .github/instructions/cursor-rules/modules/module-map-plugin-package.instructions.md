---
name: "GrassEye Map Plugin Package Governance"
description: "Use when governing controlled declarative operational-map packages, task-template packages, Map Authoring Input Package, user-requirement map authoring, AI-generated map quarantine, prompt binding, capability/output-schema/safety/evidence catalog validation, activation snapshots, rollback, ordinary/developer task feeds, and the boundary that prevents maps from becoming runtime code, child abilities, prompt owners, or second Orchestration."
applyTo: ".github/instructions/cursor-rules/modules/module-map-plugin-package.instructions.md, src/map-plugins/**, docs/法案辅助文件/GrassEye 地图插件包治理施工图.md, docs/法案辅助文件/GrassEye Map Prompt Contract Governance 施工图.md, docs/法案辅助文件/GrassEye Map Authoring Input Package 施工图.md, scripts/audit/domains/map-plugin-package/**, src/capabilities/orchestration/**, src/capabilities/ai/**, src/capabilities/commander-console/**"
---

# GrassEye Map Plugin Package Governance FINAL

## 0. Module Identity

Scope: governs controlled declarative operational-map packages, task-template packages, user-requirement map authoring schema support, AI-generated map draft/quarantine lifecycle, package validation, prompt binding, capability catalog binding, activation snapshot, active registry, ordinary/developer task-template feeds, rollback, and map-package audit enforcement.

Boundary: this module governs the `map-plugin-package` support-governance domain only. It does not create a new ability group, does not modify the 14 active ability groups, does not own mission execution, does not own prompt content, does not execute AI, does not dispatch Nerve Bus, does not call ability implementations, and does not mutate Orchestration mission state.

Authority: this file is authoritative only for the `map-plugin-package` governance domain.

Architecture phase:

```txt
Static Capability Package Architecture
+ Pluginized Map Package Architecture
+ Map-Driven Prompt Contract Architecture
+ Nerve Bus Governed Transport
+ Forensics-backed Runtime Proof
```

Core doctrine:

- Map package is route data, not runtime.
- Map package is the route-map system, not an execution tool.
- Map package is not an ability group and not a child capability.
- Ability Groups are execution tools.
- Orchestration is the dispatcher that follows frozen activated route maps.
- AI Capability is the map authoring assistant and Prompt Contract owner.
- Commander Console is the user command, review, explanation, automation-gate pass, activation, and task-selection surface.
- Map Plugin Package may reference `promptContractId`, but never owns prompt text.
- Commander may display, review, approve, activate, disable, and rollback through governed ports only.
- AI-generated maps are draft/quarantine only until validation and automation gate pass.
- Built-in map packages must pass the same lifecycle gates as imported packages.
- No map package may become active without validation report, automation gate, activation proof, activation record, and frozen activation snapshot.
- No active map law without inspector + runner + negative proof.

---

## Global Map Plugin Baseline

All active Map Plugin laws in this file are:

```yaml
status: active
tier: P0
capabilityDomain: map-plugin-package
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof
```

Canonical roots:

```txt
src/map-plugins/**
scripts/audit/domains/map-plugin-package/**
docs/法案辅助文件/GrassEye 地图插件包治理施工图.md
docs/法案辅助文件/GrassEye Map Prompt Contract Governance 施工图.md
docs/法案辅助文件/GrassEye Map Authoring Input Package 施工图_FINAL.md
.github/instructions/cursor-rules/modules/module-map-plugin-package.instructions.md
```

Required top-level package:

```txt
src/map-plugins/
├── authoring/
├── builtins/
├── import/
├── registry/
├── schema/
├── shared/
└── validation/
```

Required enforcement:

```txt
scripts/audit/domains/map-plugin-package/
├── manifest.json
├── inspector.ts
├── run-inspector.ts
└── negative-proof-harness.ts
```

Forbidden active truth:

- `manual-first` as active enforcement.
- `evidenceMode: law` as sufficient evidence.
- verify scripts as release truth.
- capability-check.ts as readiness truth.
- detached inspector.
- warning-only P0.
- generated fake PASS.
- empty/missing negative proof.
- map-plugin-package listed as one of the 14 active ability groups.
- map-plugin-package modeled as a child capability.
- map-plugin-package executing runtime logic.
- map-plugin-package calling external AI API.
- map-plugin-package reading API keys/secrets.

---

## Law GRASSEYE-MAP-PLUGIN-001-V2

status: active  
tier: P0  
capabilityDomain: map-plugin-package  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: map packages are declarative route data consumed by Orchestration, not runtime code, child abilities, or new owners.

### 主题

地图插件包声明式主权边界

### 法条

Map packages are declarative route data packages consumed by Orchestration. They are not runtime code, not ability plugins, not child capabilities, and not new owners.

Required:

- map packages must remain JSON/data-only.
- map packages must declare one operational map kind: `routePlanBoundMap` for production automation or `genericDiagnosticMap` for isolated diagnostics.
- `routePlanBoundMap` may declare only the deterministic entry spine, AI handoff, Prompt Contract refs, input refs, output refs, and `routePlanId`.
- `routePlanBoundMap` must not own routeLabel action-chain steps or AI success routing; Route Plan is the only owner of `routeLabel -> step chain -> ability group/child capability`.
- `genericDiagnosticMap` may declare diagnostic steps and transitions, but it must not bind a Route Plan or enter the production automation main chain.
- operational maps must not define constraint logic: policy, proofPolicy, successCondition, failureBranch, reviewBranch, postActionVerification, transition.condition, allowedAbilityGroups, failureBranches, reviewBranches, sequencePolicy, timeout, retry, or human-review routing are forbidden.
- one map plus the referenced Prompt Contract is the complete map; AI branch semantics belong to Prompt Contract output and production runtime consumption, not map condition DSL.
- Route Plan is the single source of muscle-memory action chains. Maps may declare `routePlanId`, but must not duplicate Route Plan-owned steps, transitions, route labels, or branch semantics.
- automation maps must strictly forbid request-human-review, human-review, manual-review, operator-review, review_required terminal routing, or any step that waits for a person.
- map packages must not expand the frozen ability-group constitution.
- registry governs import, quarantine, validation, automation gate, activation, rollback, and active-read access only.
- registry must not execute abilities, mutate mission state, dispatch steps, dispatch Nerve Bus, or decide branches.
- built-in packages must pass the same import/quarantine/validation/automation-gate/activation pipeline as imported packages.
- ordinary UI consumes taskTemplate records, not map internals.
- developer UI may inspect packageId, activationId, mapId, dependency chain, validation findings, internal runtime identifiers, and activation proof.

Forbidden:

- map package as child ability.
- map package as public owner.
- map registry executing abilities.
- map registry mutating Orchestration mission state.
- map registry dispatching Nerve Bus.
- built-in package active by side door.
- production registry auto-activating built-in packages on initialization.
- ordinary-mode UI depending on mapId or requestedPlatformId as start key.
- map plugin package importing Orchestration static map truth as package authority.
- map plugin package directly calling AI providers.
- map plugin package directly reading API keys/secrets.

Required inspector:

- AST/import-graph check for no Orchestration runtime import as schema authority.
- source scan for map-as-child patterns.
- ordinary/developer feed boundary check.
- built-in activation lifecycle check.
- production no auto-active builtins check.
- no AI provider/secret resolver imports in map plugin.

Required negative proof:

- Model map package as child ability → FAIL.
- Registry dispatches Nerve Bus → FAIL.
- Built-in map active without quarantine/validation/activation record → FAIL.
- Built-in production auto-activation → FAIL.
- Ordinary task feed requires mapId as launch key → FAIL.
- Map Plugin imports external AI provider adapter → FAIL.
- Map Plugin imports secret resolver → FAIL.

---

## Law GRASSEYE-MAP-PLUGIN-002-V2

status: active  
tier: P0  
capabilityDomain: map-plugin-package  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: map packages must pass import, quarantine, validation, automation gate, activation, active registry, and rollback lifecycle before runtime consumption.

### 主题

地图包生命周期门禁

### 法条

Every map package must pass a governed lifecycle before becoming active.

Required lifecycle:

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
→ automation gate
→ activation proof
→ activation
→ active registry
→ rollback if needed
```

Required activation record fields:

```txt
activationId
activationSnapshotRef
activationSnapshotHash
mapPackageId
mapPackageVersion
mapId
mapVersion
taskTemplateId
requestedPlatformId
gateActor
activatedAt
reason
automationGateRef
validationReportRef
importProofRef
quarantineProofRef
activationProofRef
authoringProofRef when aiGenerated
rollbackRecordRef when rollback
capabilityCatalogVersion
promptCatalogVersion
operationalMapHash
mapPackageHash
```

Required:

- imported package enters quarantine first.
- built-in package enters quarantine first unless explicit dev-only seed mode is active.
- development seed auto-activation must generate `developmentAutomationGateRef`, `validationReportRef`, `activationProofRef`, `activationSnapshotRef`, `mapPackageHash`, and `operationalMapHash`.
- validation issues block activation.
- activationGateStatus must be gate_passed before activation.
- automationGateRef is mandatory for production activation.
- validationReportRef is mandatory for activation.
- activationProofRef is mandatory for activation.
- capabilityCatalogVersion and promptCatalogVersion are mandatory for activation.
- activation creates activationSnapshotRef and activationSnapshotHash.
- rollback preserves activation record and rollback record.
- rollback must not delete activation history.

Forbidden:

- active map without validationReportRef.
- active map without automationGateRef or governed developmentAutomationGateRef.
- active map without activationProofRef.
- active map without activationSnapshotRef.
- active map without capabilityCatalogVersion/promptCatalogVersion.
- active map without mapPackageHash/operationalMapHash.
- unvalidated package active.
- package before automation gate active.
- activation directly from draft without quarantine.
- activation by availabilityPolicy only.
- rollback deleting activation history.
- production default registry auto-activating built-ins.

Required inspector:

- activation path gate check.
- active registry non-null activation fields.
- lifecycle status transition check.
- validation report dependency check.
- built-in production seed ban.
- development seed proof check.

Required negative proof:

- Activate package before automation gate → FAIL.
- Activate package with validation issues → FAIL.
- Active record missing activationSnapshotRef → FAIL.
- Active record missing activationProofRef → FAIL.
- Active record missing mapPackageHash → FAIL.
- Built-in production auto-active → FAIL.
- Rollback deletes activation record → FAIL.

---

## Law GRASSEYE-MAP-PLUGIN-003-V2

status: active  
tier: P0  
capabilityDomain: map-plugin-package  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: map package schema must contain complete governance metadata and must not depend on runtime truth as package authority.

### 主题

Schema 完整性与包治理元数据

### 法条

Map packages must declare complete governance metadata.

Required package sections:

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

Required manifest fields:

```txt
packageId
packageKind = operational-map-package
packageVersion
mapId
taskTemplateId
displayName
author
createdAt
minimumGrassEyeVersion
mapSchemaVersion
activationGateStatus
aiGenerated
authoringPromptRef when aiGenerated
authoringModelRef when aiGenerated
authoringRunId when aiGenerated
authoringProofRef when aiGenerated
userRequirementRef when aiGenerated
sourceRequirementHash when aiGenerated
capabilityCatalogVersion when gate_passed/aiGenerated
promptCatalogVersion when gate_passed/aiGenerated
validationReportRef when gate_passed
automationGateRef when gate_passed
```

Required map step fields:

```txt
stepId
capabilityId = orchestration
childCapabilityId
stepKind
targetAbilityGroupId
inputRefs
outputRefPolicy
promptContractId for AI step
```

Forbidden:

- package schema importing Orchestration static map truth as authority.
- schema default that turns missing governance fields into active-safe values.
- map package declaring timeoutPolicy, timeoutMs, maxDurationMs, primitiveTimeoutMs, or other execution-time budgets.
- map package deciding timeout, wait, retry, polling, or AND THEN fallback behavior. Maps may only choose ability group / child capability / transition truth; production runtime code owns all timeout and observable-condition control.
- gate-passed manifest without validationReportRef.
- gate-passed manifest without automationGateRef.
- gate-passed manifest without activation/validation proof dependencies.
- aiGenerated package without authoringPromptRef/authoringModelRef/authoringRunId/authoringProofRef/userRequirementRef/sourceRequirementHash.
- taskTemplate availability active while manifest activationGateStatus is draft/quarantined/rejected.

Required inspector:

- schema requiredness check.
- gate-passed manifest superRefine check.
- AI-generated authoring chain requiredness check.
- cross-section parity check:
  - manifest.mapId === operationalMap.mapId.
  - manifest.taskTemplateId === taskTemplate.taskTemplateId.
  - taskTemplate.version === packageVersion.
  - promptBindings.stepId references existing AI step.
  - operationalMap step promptContractId matches binding promptContractId.

Required negative proof:

- Gate-passed manifest without automationGateRef → FAIL.
- taskTemplate active while activationGateStatus draft → FAIL.
- schema imports Orchestration static map truth → FAIL.
- AI-generated package missing authoringPromptRef → FAIL.
- AI-generated package missing authoringProofRef → FAIL.
- AI-generated package missing userRequirementRef → FAIL.

---

## Law GRASSEYE-MAP-PLUGIN-004-V2

status: active  
tier: P0  
capabilityDomain: map-plugin-package  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: map packages must never carry executable payloads, runtime code, prompt text, shell scripts, dynamic imports, handlers, or direct ability control.

### 主题

无代码地图与可执行载荷禁令

### 法条

Map packages are no-code operational route packages.

Forbidden package keys:

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
directAbilityCall
directNerveBusDispatch
missionStateMutation
forensicsWrite
```

Forbidden executable string markers:

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

Allowed natural language:

- displayName.
- description.
- humanReadableExplanation.
- riskWarnings.
- validationHints.
- userVisibleCapabilities.
- plain-language task explanations.

Required:

- validation must scan all JSON object keys recursively.
- validation must scan suspicious string values only for executable markers.
- validation must not fail ordinary natural-language words like `messages`, `template`, `instruction`, `instructions`, or `content` when they appear inside human-readable explanation fields.
- validation must fail closed on executable map package field.
- generated maps must be checked with same rules.

Forbidden runtime patterns:

- map package imports JS/TS modules.
- map package contains function body or serialized function string.
- map package executes shell script.
- map package dispatches Nerve Bus directly.
- map package calls ability group directly.
- map package mutates mission state.
- map package writes Forensics directly.
- map package carries hidden runtime instructions in prompt binding.

Required inspector:

- JSON schema forbidden-key traversal.
- AST check for map package code imports.
- executable marker scan.
- natural-language field false-positive prevention check.
- negative proof with package injection.

Required negative proof:

- Add rawPrompt to map package → FAIL.
- Add functionBody to map package → FAIL.
- Add eval string → FAIL.
- Add direct ability call field → FAIL.
- Add Nerve Bus dispatch field → FAIL.
- Add ordinary humanReadableExplanation containing “message content template” → PASS.

---

## Law GRASSEYE-MAP-PLUGIN-005-V2

status: active  
tier: P0  
capabilityDomain: map-plugin-package  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: map packages may reference prompt contracts but must not own prompt content or create prompt double-truth.

### 主题

Prompt Contract 引用与双真相防线

### 法条

Map package may bind AI steps to prompt contracts, but prompt content is owned by AI Capability Prompt Contract Catalog.

Required AI step binding:

```txt
stepId
promptContractId
requiredInputRefs
outputSchemaRef
```

Required:

- every AI step must have promptContractId.
- every AI step must have matching promptBindings item.
- prompt binding promptContractId must match step.promptContractId.
- promptContractId must exist in Prompt Contract Catalog.
- outputSchemaRef must exist.
- outputSchemaRef must match Prompt Contract Catalog entry.
- requiredInputRefs must be produced by earlier steps or initial command refs.
- branch condition may only reference outputSchemaRef-declared fields or allowed status fields.
- promptHash is recorded in Forensics proof after AI execution.
- map authoring prompt contract must be owned by AI Capability, not Map Plugin Package.

Forbidden:

- rawPrompt/systemPrompt/userPrompt in map package.
- prompt text in Orchestration.
- prompt text in map adapter.
- prompt text in Nerve Bus.
- hardcoded prompt selection in Orchestration.
- AI runtime using map-specific hidden prompt outside Prompt Contract Catalog.
- map binding with outputSchemaRef that differs from prompt contract outputSchemaRef.
- branch over undeclared AI output field.
- raw expression string, eval, Function constructor in branch DSL.

Required inspector:

- prompt binding parity check.
- prompt catalog reference check.
- outputSchemaRef reference check.
- raw prompt/key ban across map package, Orchestration, AI runtime, map adapter, Nerve Bus.
- branch declared-field check.

Required negative proof:

- Delete promptContractId → FAIL.
- Delete prompt binding → FAIL.
- Use unknown promptContractId → FAIL.
- Delete outputSchemaRef → FAIL.
- Add rawPrompt → FAIL.
- Hardcode prompt in Orchestration → FAIL.
- Branch reads undeclared AI output field → FAIL.

---

## Law GRASSEYE-MAP-PLUGIN-006-V2

status: active  
tier: P0  
capabilityDomain: map-plugin-package  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: AI-generated map packages must be authored against governed catalogs and remain draft/quarantine until all gates and automation gate pass.

### 主题

AI 生成地图 draft/quarantine 门禁

### 法条

AI-generated maps are candidate packages only. They are never executable truth on generation.

Map Plugin Package may provide:

- map authoring input schema.
- map authoring prompt payload builder.
- AI output schema.
- draft package normalizer.
- draft/quarantine persistence interface.
- validation pipeline.
- explanation view model builder.

Map Plugin Package must not:

- call external AI API.
- choose AI provider.
- read API keys.
- transmit user requirement to provider.
- execute generated map.
- activate generated map directly.

Required authoring input:

```txt
userRequirement
userRequirementRef
sourceRequirementHash
capabilityCatalog
promptContractCatalog
mapPackageSchema
securityPolicy
outputFormat
targetPlatformId
requestedTaskCategory
```

Required AI-authoring output chain:

```txt
authoringRunId
userRequirementRef
sourceRequirementHash
providerPolicyRef
promptContractId = map-authoring-from-user-requirement-v1
promptContractVersion
promptHash
capabilityCatalogVersion
promptCatalogVersion
mapPackageSchemaVersion
securityPolicyRef
outputFormatVersion
generatedAt
authoringProofRef
```

Required authoring output:

```txt
candidate map package JSON only
humanReadableExplanation
riskWarnings
validationHints
requiredClarifications
needsCapabilityExpansion
promptBindings
aiGenerated = true
activationGateStatus = draft
availabilityPolicy = draft
draftStatus = draft | needs_clarification | needs_capability_expansion
```

Required lifecycle:

```txt
draft
→ quarantine
→ schema validation
→ capability validation
→ prompt contract validation
→ safety validation
→ dry-run validation
→ automation gate
→ activation
```

Required:

- generated map may reference only catalog-listed abilityGroupId/childCapabilityId.
- generated map may reference only catalog-listed promptContractId.
- generated map cannot active itself.
- generated map cannot spoof aiGenerated=false.
- generated map cannot spoof activationGateStatus=gate_passed.
- generated map cannot emit activationSnapshotRef.
- generated map cannot emit automationGateRef.
- generated map cannot emit validationReportRef.
- generated map cannot bypass Commander review.
- if capability is unavailable, `needsCapabilityExpansion=true`.
- if requirement is unclear, `requiredClarifications` must be non-empty.
- if operation sends/deletes/buys/submits/modifies user data, automated gate must be added.
- if operation involves Text Input commit/send/publish semantics, explicit automated gate must be required.

Forbidden:

- AI-generated map active directly.
- generated package with activationGateStatus=gate_passed.
- generated package with aiGenerated=false.
- generated package containing automationGateRef.
- generated package containing validationReportRef.
- generated package containing activationSnapshotRef.
- generated map with unknown abilityGroupId/childCapabilityId.
- generated map with unknown promptContractId.
- generated map with raw prompt.
- generated map with executable logic.
- generated map with commit/send/publish without automated gate.

Required inspector:

- authoring prompt builder output schema check.
- generated draft/quarantine check.
- catalog reference check.
- authority spoofing check.
- userRequirementRef/sourceRequirementHash chain check.
- automated gate for sensitive/commit actions.

Required negative proof:

- AI generated map with aiGenerated=false → FAIL.
- AI generated map with activationGateStatus=gate_passed → FAIL.
- AI generated map active immediately → FAIL.
- AI generated map emits activationSnapshotRef → FAIL.
- AI generated map references missing capability → FAIL.
- AI generated map references missing promptContractId → FAIL.
- AI generated map sends/publishes without automated gate → FAIL.

---

## Law GRASSEYE-MAP-PLUGIN-007-V2

status: active  
tier: P0  
capabilityDomain: map-plugin-package  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: capability catalog is a generated read model used for authoring and validation; it must not become runtime truth or a second ability registry.

### 主题

Capability Catalog 只读生成模型

### 法条

Capability Catalog is a generated read model, not runtime ability authority.

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

Required:

- map authoring prompt builder may use capability catalog as read-only input.
- map validation must verify referenced abilityGroupId/childCapabilityId exists in catalog and is routableByMap.
- action capabilities must carry requiresPostActionVerification=true.
- coordinate-action capabilities must carry requiresGeometryProof=true.
- sensitive operations must carry requiresAutomationGate=true.
- text-input commit/send/publish-like flows must require Route Plan automated gates.
- unknown capability must become `needsCapabilityExpansion`, not fabricated capability.

Forbidden:

- capability catalog as runtime dispatcher.
- capability catalog expanding ability-group constitution.
- generated catalog manually edited as source truth.
- map references ability/child not in catalog.
- map routes to ability with routableByMap=false.
- action step without PAV when catalog requires it.
- geometry action without geometry proof when catalog requires it.
- sensitive operation without automated gate when catalog requires it.

Required inspector:

- generated catalog marker check.
- catalog entry required fields check.
- map validation against catalog.
- action/PAV and geometry gate check.
- sensitive/automated gate check.
- no manual-edit generated catalog check.

Required negative proof:

- Map references missing ability child → FAIL.
- Map routes to routableByMap=false → FAIL.
- Action step missing PAV → FAIL.
- Geometry action step missing geometry proof → FAIL.
- Sensitive operation missing automated gate → FAIL.
- Manual edit of generated catalog accepted → FAIL.

---

## Law GRASSEYE-MAP-PLUGIN-008-V2

status: active  
tier: P0  
capabilityDomain: map-plugin-package  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: branch condition DSL must be schema-declared, closed, non-executable, and able to reference declared outputSchemaRef fields.

### 主题

Branch Condition DSL 闭合与非执行

### 法条

Branch conditions are declarative DSL, not code.

Allowed condition fields:

```txt
conditionType
leftRef
operator
rightValue
onTrue
onFalse
```

Allowed leftRef:

```txt
status
schemaFieldRef:<fieldName>
```

Allowed conditionType:

```txt
comparison
```

Branch DSL is diagnostic-only for `genericDiagnosticMap`. Production `routePlanBoundMap` must not use Branch DSL; it may only bind Prompt Contract `routeLabel` to the Route Plan allowed labels.

Allowed diagnostic operators:

```txt
equals
notEquals
exists
notExists
greaterThan
lessThan
confidenceAbove
confidenceBelow
statusIs
```

Required:

- `leftRef=status` may reference only allowed status fields.
- `leftRef=schemaFieldRef:<fieldName>` must reference a field declared by the relevant outputSchemaRef.
- numeric operators require numeric rightValue.
- exists/notExists require rightValue=null.
- exactly one transition may match during Orchestration evaluation.
- ambiguous transition must fail.
- no transition must fail.
- branch DSL must be validated at map-validation time.
- branch runtime evaluation belongs to Orchestration, not Map Plugin Package.

Forbidden:

- raw expression string.
- function body.
- eval.
- Function constructor.
- JavaScript expression in condition.
- branch reading undeclared payload field.
- branch reading raw AI natural language.
- branch deciding mission next step outside Orchestration transition evaluator.
- unvalidated arbitrary string leftRef.

Required inspector:

- schema DSL check.
- outputSchemaRef declared-field check.
- forbidden expression/function/eval check.
- ambiguity/no-transition negative proof hook.

Required negative proof:

- Add raw expression string → FAIL.
- Add function body to condition → FAIL.
- Branch references undeclared field → FAIL.
- Branch uses arbitrary leftRef without schema declaration → FAIL.
- Ambiguous transition returns success → FAIL.

---

## Law GRASSEYE-MAP-PLUGIN-009-V2

status: active  
tier: P0  
capabilityDomain: map-plugin-package  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: ordinary and developer map surfaces must stay separate, and Commander must not activate or mutate maps without governed validation/automation-gate path.

### 主题

Task Template UX 与内部地图标识隔离

### 法条

Map packages expose task-template UX while internal runtime identifiers remain internal unless developer mode is active.

Required ordinary feed fields:

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

Required developer feed may include:

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

Required:

- ordinary runnable task must resolve through active gate-passed binding.
- quarantined/draft/disabled/rejected map packages must not appear as runnable ordinary tasks.
- ordinary feed must not require mapId or requestedPlatformId as launch key.
- Commander Console may request import, automation-gate pass, activation, disable, and rollback only through governed ports/APIs.
- Commander preflight summary is not final validation truth.
- user-facing map explanation must be plain language and must not expose runtime internals by default.

Forbidden:

- ordinary mode exposing mapId.
- ordinary mode exposing stepId.
- ordinary mode exposing childCapabilityId.
- ordinary mode exposing promptContractId.
- ordinary mode exposing activationSnapshotRef.
- ordinary mode exposing package dependency graph.
- ordinary mode requiring mapId/requestedPlatformId as launch key.
- Commander directly writing active registry.
- Commander directly writing automation-gate records.
- Commander executing draft-only AI map.
- Commander bypassing validator.

Required inspector:

- ordinary feed field allowlist.
- developer feed boundary.
- Commander registry write ban.
- runnable task active/gate-passed check.
- draft/quarantine/disabled feed ban.
- user explanation/internal id separation check.

Required negative proof:

- Ordinary feed exposes mapId → FAIL.
- Ordinary feed exposes promptContractId → FAIL.
- Ordinary launch requires requestedPlatformId → FAIL.
- Commander directly writes active registry → FAIL.
- Draft map appears runnable → FAIL.

---

## Law GRASSEYE-MAP-PLUGIN-010-V2

status: active  
tier: P0  
capabilityDomain: map-plugin-package  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: map activation, validation, automation gate, prompt binding, and authoring must produce Forensics-compatible proof records.

### 主题

地图治理证据与 Forensics 证明

### 法条

Map governance operations must be proof-backed and Forensics-compatible.

Required proof records:

```txt
importProofRef
quarantineProofRef
validationReportRef
automationGateRef
activationId
activationProofRef
activationSnapshotRef
activationSnapshotHash
mapPackageHash
operationalMapHash
capabilityCatalogVersion
promptCatalogVersion
rollbackRecordRef when rollback
authoringProofRef when aiGenerated
```

Forensics proof must be able to record:

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
authoringRunId
authoringProofRef
userRequirementRef
sourceRequirementHash
capabilityCatalogVersion
promptCatalogVersion
validationReportRef
automationGateRef
activationProofRef
```

Required:

- validation report must include validator names, pass/fail, issue list, severity, and generatedAt.
- activation proof must include exact package hash and operational map hash.
- activation proof must include validationReportRef and automationGateRef/developmentAutomationGateRef.
- rollback proof must preserve previous activation and new active state.
- prompt binding proof must carry promptContractId and outputSchemaRef.
- evidence chain must reference hashes/refs, not raw prompt body.
- AI-generated map activation must include authoringProofRef and userRequirementRef.

Forbidden:

- active map without activation proof.
- validation pass without issue list.
- automation gate without automationGateRef.
- prompt proof without promptHash from AI Prompt Contract Catalog.
- raw prompt stored in map package proof.
- rollback without rollback record.
- AI-generated map activation without authoringProofRef.
- proof containing raw API key, raw prompt body, or raw user secret.

Required inspector:

- proof record schema check.
- activation hash field check.
- validation report field check.
- Forensics-compatible fields check.
- secret/raw prompt leak ban.

Required negative proof:

- Activation proof missing mapPackageHash → FAIL.
- Validation report missing validator list → FAIL.
- Rollback without rollback record → FAIL.
- Forensics proof missing promptContractId for AI step → FAIL.
- AI-generated activation missing authoringProofRef → FAIL.
- Map proof contains raw prompt body → FAIL.

---

## Law GRASSEYE-MAP-PLUGIN-011-V2

status: active  
tier: P0  
capabilityDomain: map-plugin-package  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: user-facing map explanation must translate route data into understandable task flow without exposing runtime internals in ordinary mode.

### 主题

用户通俗地图解释视图

### 法条

Map Plugin Package must support a user-facing explanation view model, but this explanation is display data only and not runtime authority.

Required user explanation fields:

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

Required:

- explanation must be generated from draft/validated map package and validation findings.
- explanation must not become runtime truth.
- explanation must not contain raw prompt body.
- explanation must not expose stepId/childCapabilityId/promptContractId/activationSnapshotRef in ordinary mode.
- explanation must include capability limitations and requiredClarifications when present.
- explanation must include needsCapabilityExpansion when current ability catalog cannot fulfill user requirement.
- developer view may expose technical details separately.

Forbidden:

- ordinary explanation exposing runtime internals.
- explanation used as Orchestration runtime route.
- explanation containing executable instructions.
- explanation hiding validation failures.
- explanation claiming AI map is safe/active before validation and activation.

Required inspector:

- ordinary explanation allowlist check.
- raw prompt/runtime internal leak ban.
- explanation derived from map/validation data only.
- validation failure visibility check.

Required negative proof:

- Ordinary explanation exposes stepId → FAIL.
- Ordinary explanation exposes promptContractId → FAIL.
- Explanation claims active while draft → FAIL.
- Explanation hides validation failure → FAIL.
- Explanation contains rawPrompt → FAIL.

---

## Law GRASSEYE-MAP-PLUGIN-012-V2

status: active  
tier: P0  
capabilityDomain: map-plugin-package  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: map-plugin-package enforcement must close through owner-local AST/schema/reference inspector, runner, and negative proof.

### 主题

Map Plugin 执法唯一入口

### 法条

Map Plugin enforcement must close through:

```txt
scripts/audit/domains/map-plugin-package/manifest.json
scripts/audit/domains/map-plugin-package/inspector.ts
scripts/audit/domains/map-plugin-package/run-inspector.ts
scripts/audit/domains/map-plugin-package/negative-proof-harness.ts
```

Required:

- inspector uses ts-morph AST-level checks for TS source boundaries.
- inspector uses JSON/schema traversal for map package data.
- inspector uses reference checks for capabilityCatalog and promptContractCatalog.
- inspector uses import-graph checks for owner boundaries.
- inspector uses anti-escape checks for executable payload and authority spoofing.
- inspector verifies active law coverage in registry/matrix/audit-plan/runner.
- negative proof must run and report fail → rollback → pass.
- CI-FULL must be green for delivery.

Forbidden:

- grep-only final judgment.
- regex-only final judgment.
- includes-only final judgment.
- warning-only P0.
- detached inspector.
- empty negative proof.
- generated fake PASS.
- verify script as release truth.
- capability-check.ts as readiness truth.

Required inspector checks:

```txt
1. Law file is machine-blocking.
2. map-plugin-package is not an ability group.
3. Maps are data-only, not child abilities.
4. Built-ins pass same lifecycle gates and cannot production auto-active.
5. Import/quarantine/validation/automation-gate/activation/rollback present.
6. Active record contains activationSnapshotRef, activationProofRef, validationReportRef, automationGateRef, hashes, catalog versions.
7. Approved/active map requires automationGateRef and validationReportRef.
8. AI-generated maps contain authoring chain and remain draft/quarantine until automation gate.
9. Map package has complete manifest/task/operational/dependency/compatibility/policy/promptBinding sections.
10. No executable payload/rawPrompt/handler/function/eval/import/script/shell.
11. Natural-language explanation fields are not falsely blocked by prompt/executable scanner.
12. Prompt bindings match AI steps and Prompt Contract Catalog.
13. Branch condition DSL uses declared outputSchemaRef fields only.
14. Capability Catalog references are valid and routableByMap.
15. PAV/Geometry/Review requirements from catalog are enforced.
16. Ordinary/developer feed boundary is enforced.
17. Commander cannot direct-write active registry or automation-gate records.
18. Forensics-compatible proof fields exist.
19. User-facing explanation hides runtime internals and exposes validation risks.
20. ALL active Map Plugin laws in registry/matrix/audit-plan/runner.
21. negative-proof-harness executed.
```

Required negative proof:

```txt
manual-first enforcement reintroduced
map package modeled as child ability
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
remove negative proof invocation
turn P0 into warning-only
```

---

## Final Readiness Gate

Map Plugin Package is READY only when:

```txt
law/blueprint/inspector/generated/runner agree
all active map-plugin laws are machine-blocking
map-plugin-package is support-governance domain, not ability group
map packages remain data-only
no map package becomes a child ability or runtime owner
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
owner-local inspector PASS
negative proof PASS
ALL active law enforcement PASS
CI-FULL PASS
```


---

# Map Authoring Input Package FULL-MERGED Supplement

> This supplement is part of the same active `map-plugin-package` law file.  
> It does not retire or compress the previous V2 laws.  
> It adds the missing first-class input contract required for advanced AI to generate GrassEye-compatible draft maps.

## Supplemental Doctrine

- Advanced AI map authoring is not valid unless driven by a complete Map Authoring Input Package.
- User requirement alone is insufficient for production-grade map generation.
- Capability Catalog tells AI what it can use.
- Prompt Contract Catalog tells AI how AI judgment steps are governed.
- Output Schema Catalog tells AI which fields may be used for map branching.
- Map Package Schema tells AI how to write the route.
- Safety and Automation Gate Policies tell AI which actions must pause for user authorization.
- Evidence, PAV, and Forensics Policies tell AI how actions must be proven and retained.
- Target Platform Profile tells AI what platform constraints, login assumptions, rate limits, and prohibited operations apply.
- If any required input package component is missing, AI map authoring must stop with `BLOCKED_AUTHORING_INPUT_INCOMPLETE`.
- AI must never infer missing system capabilities, missing prompt contracts, missing output fields, missing automation-gate rules, or missing evidence rules from natural language.

---

## Law GRASSEYE-MAP-PLUGIN-013-V2

status: active  
tier: P0  
capabilityDomain: map-plugin-package  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: advanced AI map generation must receive a complete Map Authoring Input Package; missing catalogs or policies must block generation.

### 主题

Map Authoring Input Package 完整输入契约

### 法条

Advanced AI map generation is valid only when driven by a complete Map Authoring Input Package.

Required top-level input package fields:

```txt
inputPackageId
inputPackageVersion
generatedAt
requesterRef
userRequirement
userRequirementRef
sourceRequirementHash
targetPlatformProfileRef
targetPlatformProfile
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
exampleMaps
validationPolicy
expectedDraftStatus
```

Required:
- `userRequirement` must describe the user goal in natural language and preserve target platform, allowed automation scope, required confirmations, failure handling, evidence preference, and run limits when provided.
- `capabilityCatalog` must contain ability groups and child capabilities with ids, codes, descriptions, inputs, outputs, boundaries, routableByMap, proof/PAV/automation-gate requirements, sideEffectLevel, and forbidden responsibilities.
- `promptContractCatalog` must contain promptContractId, versions, inputSchemaRef, outputSchemaRef, allowedInputRefs, dataPolicy, providerPolicy, binary decision policy for branchable prompts, redactionPolicy, and forensicsPolicy.
- `outputSchemaCatalog` must declare all branchable output fields for each outputSchemaRef.
- `mapPackageSchema` must define manifest, taskTemplate, operationalMap kind, routePlanBoundMap binding fields, genericDiagnosticMap diagnostic fields, promptBindings, lifecycle status, and draft/activation fields.
- `mapAuthoringOutputSchema` must define the exact AI output shape.
- `safetyPolicy` and `automationGatePolicy` must define all operations that require Route Plan automated gate.
- `evidencePolicy`, `pavPolicy`, and `forensicsPolicy` must define proof refs, screenshot retention, PAV handoff, evidence packet, redaction, and no-raw-secret rules.
- `targetPlatformProfile` must define platform constraints, login/auth expectations, supported targets, prohibited operations, rate limits, security/captcha pause behavior, and automation gate rules.
- `exampleMaps` must be optional but, when present, must be schema-valid and marked `exampleOnly=true`.
- The AI map authoring prompt must be built only from this input package or refs derived from it.
- The prompt template may hardcode generation rules only; it must not hardcode ability-group or child-capability lists.
- `MapAuthoringInputPackage.capabilityCatalog` is the only ability truth consumed by advanced AI map authoring.
- `abilityGroupId`, `childCapabilityId`, child codes, schema refs, routability, proof requirements, PAV requirements, and review requirements must come from governed `capabilityCatalog` entries, not manual prompt text.
- Adding, deleting, renaming, or changing a child capability must update the capability registry and generated capability catalog, not the prompt template.
- Missing or stale capability catalog truth must return `BLOCKED_CAPABILITY_CATALOG_STALE`.
- Missing required field must return `BLOCKED_AUTHORING_INPUT_INCOMPLETE`.
- Incomplete user requirement must return `requiredClarifications`.
- Missing capability must return `needsCapabilityExpansion`.
- AI must not generate a map when required package fields are missing.

Forbidden:
- advanced AI map generation with only userRequirement + freeform prompt.
- generation without capabilityCatalog.
- generation without promptContractCatalog.
- generation without outputSchemaCatalog.
- generation without mapPackageSchema.
- generation without mapAuthoringOutputSchema.
- generation without safetyPolicy or automationGatePolicy.
- generation without evidencePolicy, pavPolicy, or forensicsPolicy.
- generation without targetPlatformProfile.
- examples treated as active maps.
- hardcoded ability-group lists inside map-authoring prompt template.
- hardcoded child-capability lists inside map-authoring prompt template.
- manual duplicated ability descriptions inside prompt body.
- prompt text acting as a second capability catalog.
- AI instructed to infer missing system capabilities from natural language.
- AI instructed to infer missing prompt contracts or output fields.
- AI instructed to infer automation-gate/evidence rules from natural language.

Required inspector:
- MapAuthoringInputPackageSchema required fields.
- catalog completeness checks.
- outputSchemaCatalog declared branch-field checks.
- mapPackageSchema and mapAuthoringOutputSchema presence checks.
- safety/automationGate/evidence/PAV/Forensics/platform policy presence.
- authoring prompt builder uses input package, not ad-hoc string.
- prompt template contains rules only and reads ability data from governed capabilityCatalog input.
- stale capability catalog blocks authoring.
- missing input package blocks generation.
- exampleMaps exampleOnly and not active checks.

Required negative proof:
- Remove capabilityCatalog → FAIL.
- Remove promptContractCatalog → FAIL.
- Remove outputSchemaCatalog → FAIL.
- Remove mapPackageSchema → FAIL.
- Remove mapAuthoringOutputSchema → FAIL.
- Remove safetyPolicy → FAIL.
- Remove automationGatePolicy → FAIL.
- Remove evidencePolicy → FAIL.
- Remove pavPolicy → FAIL.
- Remove forensicsPolicy → FAIL.
- Remove targetPlatformProfile → FAIL.
- Hardcode childCapabilityId list in prompt template → FAIL.
- Build authoring prompt from manual capability text instead of governed capabilityCatalog → FAIL.
- Remove capability catalog freshness block → FAIL.
- Build authoring prompt from userRequirement only → FAIL.
- Treat exampleMap as active map → FAIL.

---

## Law GRASSEYE-MAP-PLUGIN-014-V2

status: active  
tier: P0  
capabilityDomain: map-plugin-package  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: capability catalog must be detailed enough for advanced AI to generate maps without inventing abilities.

### 主题

能力清单细粒度契约

### 法条

The Capability Catalog used for map authoring must describe every routable ability group and child capability in machine-readable detail.

Required ability group fields:

```txt
abilityGroupId
abilityGroupCode
displayName
description
ownerDomain
routableByMap
publicContractRef
inputSchemaRef
outputSchemaRef
forbiddenResponsibilities
children
```

Required child capability fields:

```txt
childCapabilityId
childCapabilityCode
displayName
description
inputSchemaRef
outputSchemaRef
requiredInputRefs
producedOutputRefs
requiresGeometryProof
requiresTargetProof
requiresFocusProof
requiresApprovedText
requiresPostActionVerification
requiresAutomationGate
sensitiveOperation
sideEffectLevel = none | read | write | submit | delete | purchase
allowedStepKinds
supportedTargetKinds
forbiddenResponsibilities
proofRequirements
failureModes
```

Required:
- every map-routable child capability must be declared with explicit childCapabilityId and childCapabilityCode.
- action children must declare PAV requirements.
- coordinate-action children must declare Geometry Guard requirements.
- visual-target children must declare target proof outputs and must not click/write.
- screenshot children must declare capture proof, image refs, retention policy needs, and no judgment ownership.
- text-input children must declare approvedText, target/focus proof, sensitive text, commit/automation gate, and PAV requirements.
- mouse-click children must declare geometry proof and PAV requirements.
- mouse-scroll children must declare scroll bounds and post-scroll verification policy.
- AI children must declare promptContract/outputSchema requirements.
- Orchestration children must declare map/step dispatch boundary and must not execute primitives directly.
- Nerve Bus children must declare transport envelope/result/proof refs and must not make business decisions.
- Forensics children must declare evidence/proof refs and must not make product/business decisions.
- non-routable children must be blocked from map generation.
- ability catalog must be generated or governed; AI must not modify it.

Forbidden:
- ability entry without abilityGroupId.
- child entry without childCapabilityId.
- child capability without inputSchemaRef/outputSchemaRef.
- vague capability descriptions with no boundary.
- missing forbiddenResponsibilities.
- missing proof/PAV/automation-gate requirements.
- AI-generated map referencing unknown abilityGroupId or childCapabilityId.
- AI-generated map referencing routableByMap=false capability.
- AI inventing capability because userRequirement asks for it.

Required inspector:
- capability catalog schema requiredness.
- routable child reference validation.
- action/PAV/geometry/text-input/review requirement checks.
- no unknown ability in generated draft.
- no non-routable ability in generated draft.
- missing boundary/forbiddenResponsibilities checks.

Required negative proof:
- capability child without outputSchemaRef → FAIL.
- capability child without forbiddenResponsibilities → FAIL.
- text-input child missing approvedText requirement → FAIL.
- action child missing PAV requirement → FAIL.
- coordinate child missing geometry proof requirement → FAIL.
- AI map references unknown childCapabilityId → FAIL.
- AI map references routableByMap=false child → FAIL.

---

## Law GRASSEYE-MAP-PLUGIN-015-V2

status: active  
tier: P0  
capabilityDomain: map-plugin-package  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: prompt contract and output schema catalogs must define every AI step and branchable field used by maps.

### 主题

Prompt Contract 与 Output Schema Catalog 契约

### 法条

Map AI steps must bind to prompt contracts and output schemas declared in the Map Authoring Input Package.

Required Prompt Contract Catalog fields:

```txt
promptContractId
promptContractVersion
promptHash
displayName
description
inputSchemaRef
outputSchemaRef
allowedInputRefs
dataPolicy
providerPolicy
binaryDecisionPolicy for branchable prompts
redactionPolicy
forensicsPolicy
forbiddenOutputs
branchableOutputFields
```

Required Output Schema Catalog fields:

```txt
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

Required:
- every AI step must have promptContractId.
- every prompt binding must have outputSchemaRef.
- promptContractId must exist in Prompt Contract Catalog.
- outputSchemaRef must exist in Output Schema Catalog.
- outputSchemaRef in prompt binding must match prompt contract outputSchemaRef.
- branch DSL may reference only `branchableFields` or allowed status fields.
- Prompt Contract Catalog is owned by AI Capability.
- Map Plugin validates references only; it does not own prompt content.
- Forensics proof records promptContractId, promptVersion, promptHash, outputSchemaRef, aiInputRefs, aiOutputRef, and aiProofRef.
- map-authoring-from-user-requirement-v1 must consume a complete Map Authoring Input Package.

Forbidden:
- rawPrompt/systemPrompt/userPrompt/promptText in map package.
- prompt text hardcoded in Orchestration/Nerve Bus/map adapter.
- branch reads undeclared AI output field.
- branch reads raw AI natural language.
- outputSchemaRef mismatch between prompt contract and binding.
- AI generated map invents promptContractId or outputSchemaRef.
- Map Plugin Package selecting AI provider.
- Map Plugin Package reading API key.

Required inspector:
- prompt binding parity.
- prompt catalog reference check.
- output schema catalog reference check.
- branchable field check.
- raw prompt ban across map/orchestration/nerve bus/map adapter.
- Forensics proof field check.
- map-authoring input package prompt contract reference check.

Required negative proof:
- AI step missing promptContractId → FAIL.
- outputSchemaRef missing from catalog → FAIL.
- prompt outputSchemaRef mismatch → FAIL.
- branch reads undeclared field → FAIL.
- rawPrompt in map → FAIL.
- hardcoded prompt in Orchestration → FAIL.
- invented promptContractId → FAIL.
- invented outputSchemaRef → FAIL.

---

## Law GRASSEYE-MAP-PLUGIN-016-V2

status: active  
tier: P0  
capabilityDomain: map-plugin-package  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: safety, automation gate, evidence, PAV, Forensics, privacy, secret, rate-limit, and platform policies must be first-class inputs to map authoring.

### 主题

安全授权与证据策略一等输入

### 法条

Advanced AI map generation must receive explicit policy catalogs and must not infer safety/evidence behavior from userRequirement alone.

Required policy catalogs:

```txt
safetyPolicy
automationGatePolicy
evidencePolicy
pavPolicy
forensicsPolicy
privacyPolicy
secretPolicy
rateLimitPolicy
targetPlatformProfile
```

Required safety/automation gate rules:
- send message → automation gate required.
- submit form → automation gate required.
- purchase/payment → automation gate required.
- delete content → automation gate required.
- modify user data → automation gate required.
- bulk action → automation gate + rate limit required.
- text-input commit/send/publish semantics → Route Plan automated gate required.
- external AI transmission of userRequirement → externalTransmissionGate required.
- activation of AI-generated map → automation gate required.

Required evidence/PAV/Forensics rules:
- action step requires PAV when catalog says so.
- mouse-click success requires PAV handoff.
- text-input success requires PAV handoff.
- screenshot step requires retention policy.
- product candidate/evidence capture steps require evidencePacketRef or Forensics write request.
- AI steps must record aiProofRef and promptContract refs.
- map activation must record validationReportRef, governedActivationProofRef, activationSnapshotRef, and hashes.
- raw API keys, cookies, secrets, raw prompt body, raw sensitive text, and raw clipboard text must not enter proof/log/map package.
- Forensics stores refs/hashes, not raw sensitive content.

Required platform profile rules:
- target platform id.
- login/auth expectations.
- prohibited operations.
- supported targets.
- rate limit.
- safety pause conditions.
- captcha/security check behavior.
- automation gate requirements.

Forbidden:
- generated map with high-risk side effect and no Route Plan automated gate.
- generated map with action step and missing PAV requirement.
- generated map with evidence step and missing evidence policy.
- generated map with screenshot step and missing retention policy.
- generated map that persists raw secrets or raw sensitive text.
- generated map that assumes platform login bypass.
- generated map that ignores targetPlatformProfile constraints.
- external AI authoring without transmission gate when policy requires it.

Required inspector:
- high-risk operation automated gate check.
- action/PAV policy check.
- evidence/Forensics policy check.
- screenshot retention policy check.
- no raw secret/sensitive text proof check.
- platform profile reference check.
- external transmission automated gate check.
- AI-generated map activation gate check.

Required negative proof:
- send-message map without Route Plan automated gate → FAIL.
- text-input commit without Route Plan automated gate → FAIL.
- mouse-click action without PAV → FAIL.
- evidence step without Forensics/evidence policy → FAIL.
- screenshot step without retention policy → FAIL.
- raw secret in proof → FAIL.
- external AI authoring without transmission gate → FAIL.
- AI-generated map activation without governed activation proof → FAIL.

---

## Law GRASSEYE-MAP-PLUGIN-017-V2

status: active  
tier: P0  
capabilityDomain: map-plugin-package  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: map-plugin-package enforcement must prove Map Authoring Input Package completeness, generated-map safety, and lifecycle boundaries in addition to existing map package governance.

### 主题

Map Authoring 执法闭环

### 法条

Map Plugin Package enforcement must close Map Authoring Input Package completeness and generated-map safety through owner-local audit.

Required inspector coverage additions:
1. Map Authoring Input Package schema exists.
2. Map Authoring Input Package has all required fields.
3. UserRequirement includes binaryOutcomePolicy with product_yes/product_no option catalogs and selected route labels.
4. capabilityCatalog is detailed and child-capability complete.
5. promptContractCatalog and outputSchemaCatalog are present and referenced.
6. mapPackageSchema and mapAuthoringOutputSchema are present.
7. safety/automationGate/evidence/PAV/Forensics/privacy/secret/rateLimit/platform policies are present.
8. authoring prompt builder uses only input package fields.
9. generated map output is draft/quarantine only.
10. generated map cannot invent ability/prompt/schema ids.
11. generated map high-risk operations require automated gates, not human review in automation maps.
12. generated map action steps require PAV where production catalogs require it.
13. generated map evidence steps require evidence/Forensics policies.
14. generated map screenshot steps require retention policy.
15. ordinary/developer feed boundary remains enforced.
16. activation proof and frozen snapshot fields remain enforced.
17. user explanation schema and no runtime-internal leakage remain enforced.
18. no raw prompt/secret/sensitive text leakage.
19. Orchestration matches AI routeLabel mechanically and must not infer next action from product_yes/product_no.
20. all active map-plugin laws in registry/matrix/audit-plan/runner.
21. negative-proof-harness executed.

Required negative proof additions:

```txt
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
remove binaryOutcomePolicy
remove selected routeLabel
Prompt Contract missing routeLabel for binary product decision
Orchestration reintroduces product_yes/product_no route inference
capability child without boundary
capability child without forbiddenResponsibilities
AI output unknown childCapabilityId
AI output unknown promptContractId
AI output unknown outputSchemaRef
AI output branch over undeclared output field
AI output active=true
AI output activationGateStatus=gate_passed
AI output activationSnapshotRef
AI output rawPrompt
AI output high-risk action without Route Plan gate
AI output action without PAV
AI output evidence step without Forensics/evidence policy
AI output screenshot step without retention policy
ordinary feed exposes mapId
draft map appears runnable
Map Plugin imports AI provider adapter
Map Plugin imports secret resolver
Commander direct active registry write
remove negative proof invocation
turn P0 into warning-only
```

Final readiness additions:

```txt
Map Authoring Input Package complete
capabilityCatalog detailed
promptContractCatalog present
outputSchemaCatalog present
mapPackageSchema present
mapAuthoringOutputSchema present
safety/evidence/PAV/Forensics/platform policies enforced
automation gate enforced
AI generated maps draft-only
catalog references valid
activation proof enforced
ordinary feed safe
inspector PASS
negative proof PASS
CI-FULL PASS
```
