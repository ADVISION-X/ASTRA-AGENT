---
name: "GrassEye Map Plugin Package Governance"
description: "Use when governing controlled declarative operational-map packages, task-template packages, map authoring, AI-generated map quarantine, prompt binding, catalog validation, activation snapshots, rollback, and the boundary that prevents maps from becoming runtime code, child abilities, prompt owners, or second Orchestration."
applyTo: ".github/instructions/cursor-rules/modules/module-map-plugin-package.instructions.md, src/map-plugins/**, docs/法案辅助文件/GrassEye 地图插件包治理施工图.md, docs/法案辅助文件/GrassEye Map Prompt Contract Governance 施工图.md, scripts/audit/domains/map-plugin-package/**, src/capabilities/orchestration/**, src/capabilities/ai/**, src/capabilities/commander-console/**"
---

# GrassEye Map Plugin Package Governance FINAL

Scope: governs controlled declarative operational-map packages, task-template packages, map authoring prompt builder, AI-generated map draft/quarantine lifecycle, package validation, prompt binding, capability catalog binding, activation snapshot, active registry, ordinary/developer task-template feeds, rollback, and map-package audit enforcement.

Boundary: this module governs the `map-plugin-package` support-governance domain only. It does not create a new ability group, does not modify the 14 active ability groups, does not own mission execution, does not own prompt content, does not execute AI, does not dispatch Nerve Bus, does not call ability implementations, and does not mutate Orchestration mission state.

Authority: this file is authoritative only for the map-plugin-package governance domain.

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
- Map package is not an ability group and not a child capability.
- Orchestration owns mission flow, map consumption, branch evaluation, step dispatch, and finalization.
- AI Capability owns Prompt Contract Catalog and prompt execution contracts.
- Map Plugin Package may reference promptContractId, but never owns prompt text.
- Commander may display, review, approve, activate, disable, and rollback through governed ports only.
- AI-generated maps are draft/quarantine only until validation and human approval pass.
- Built-in map packages must pass the same lifecycle gates as imported packages.
- No map package may become active without validation report, human approval, activation record, and frozen activation snapshot.
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

Forbidden:
- `manual-first` as active enforcement.
- `evidenceMode: law` as sufficient evidence.
- verify scripts as release truth.
- capability-check.ts as readiness truth.
- detached inspector.
- warning-only P0.
- generated fake PASS.
- empty/missing negative proof.

---

## Law GRASSEYE-MAP-PLUGIN-001-V2

status: active  
tier: P0  
capabilityDomain: map-plugin-package  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: map packages are declarative data packages consumed by Orchestration, not runtime code, child abilities, or new owners.

### 主题

地图插件包声明式主权边界

### 法条

Map packages are declarative data packages consumed by Orchestration. They are not runtime code, not ability plugins, not child capabilities, and not new owners.

Required:
- map packages must remain JSON/data-only.
- map packages may define task template, route steps, transitions, dependencies, compatibility, policy, prompt bindings, and proof policy.
- map packages must not expand the frozen ability-group constitution.
- registry governs import, quarantine, validation, approval, activation, rollback, and active-read access only.
- registry must not execute abilities, mutate mission state, dispatch steps, or decide branches.
- built-in packages must pass the same import/quarantine/validation/approval/activation pipeline as imported packages.
- ordinary UI consumes taskTemplate records, not map internals.
- developer UI may inspect packageId, activationId, mapId, dependency chain, validation findings, and internal runtime identifiers.

Forbidden:
- map package as child ability.
- map package as public owner.
- map registry executing abilities.
- map registry mutating Orchestration mission state.
- map registry dispatching Nerve Bus.
- built-in package active by side door.
- ordinary-mode UI depending on mapId or requestedPlatformId as start key.
- map plugin package importing Orchestration static map truth as package authority.

Required inspector:
- AST/import-graph check for no Orchestration runtime import as schema authority.
- source scan for map-as-child patterns.
- ordinary/developer feed boundary check.
- built-in activation lifecycle check.

Required negative proof:
- Model map package as child ability → FAIL.
- Registry dispatches Nerve Bus → FAIL.
- Built-in map active without quarantine/validation/activation record → FAIL.
- Ordinary task feed requires mapId as launch key → FAIL.

---

## Law GRASSEYE-MAP-PLUGIN-002-V2

status: active  
tier: P0  
capabilityDomain: map-plugin-package  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: map packages must pass import, quarantine, validation, human approval, activation, active registry, and rollback lifecycle before runtime consumption.

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
→ human approval
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
approvedBy
activatedAt
reason
humanApprovalRef
validationReportRef
capabilityCatalogVersion
promptCatalogVersion
operationalMapHash
mapPackageHash
```

Required:
- imported package enters quarantine first.
- validation issues block activation.
- approvalStatus must be approved before activation.
- humanApprovalRef is mandatory for activation.
- validationReportRef is mandatory for activation.
- capabilityCatalogVersion and promptCatalogVersion are mandatory for activation.
- activation creates activationSnapshotRef and activationSnapshotHash.
- rollback preserves activation record and rollback record.

Forbidden:
- active map without validationReportRef.
- active map without humanApprovalRef.
- active map without activationSnapshotRef.
- active map without capabilityCatalogVersion/promptCatalogVersion.
- unvalidated package active.
- unapproved package active.
- activation directly from draft without quarantine.
- activation by availabilityPolicy only.
- rollback deleting activation history.

Required inspector:
- activation path gate check.
- active registry non-null activation fields.
- lifecycle status transition check.
- validation report dependency check.

Required negative proof:
- Activate unapproved package → FAIL.
- Activate package with validation issues → FAIL.
- Active record missing activationSnapshotRef → FAIL.
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
approvalStatus
aiGenerated
authoringPromptRef when aiGenerated
authoringModelRef when aiGenerated
capabilityCatalogVersion when approved/aiGenerated
promptCatalogVersion when approved/aiGenerated
validationReportRef when approved
humanApprovalRef when approved
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
timeoutPolicy
proofPolicy
successCondition
failureBranch
reviewBranch
postActionVerification when action step
```

Forbidden:
- package schema importing Orchestration static map truth as authority.
- schema default that turns missing governance fields into active-safe values.
- approved manifest without validationReportRef.
- approved manifest without humanApprovalRef.
- aiGenerated package without authoringPromptRef/authoringModelRef.
- taskTemplate availability active while manifest approvalStatus is draft/quarantined/rejected.

Required inspector:
- schema requiredness check.
- approved manifest superRefine check.
- cross-section parity check: manifest.mapId === operationalMap.mapId, manifest.taskTemplateId === taskTemplate.taskTemplateId, taskTemplate.version === packageVersion.

Required negative proof:
- Approved manifest without humanApprovalRef → FAIL.
- taskTemplate active while approvalStatus draft → FAIL.
- schema imports Orchestration static map truth → FAIL.
- AI-generated package missing authoringPromptRef → FAIL.

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

Forbidden package fields and values:
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

Forbidden runtime patterns:
- map package imports JS/TS modules.
- map package contains function body or serialized function string.
- map package executes shell script.
- map package dispatches Nerve Bus directly.
- map package calls ability group directly.
- map package mutates mission state.
- map package writes Forensics directly.
- map package carries hidden runtime instructions in prompt binding.

Required:
- validation must scan all JSON object keys recursively.
- validation must scan suspicious string values for executable markers.
- validation must fail closed on suspicious map package field.
- generated maps must be checked with same rules.

Required inspector:
- JSON schema forbidden-key traversal.
- AST check for map package code imports.
- string executable marker scan.
- negative proof with package injection.

Required negative proof:
- Add rawPrompt to map package → FAIL.
- Add functionBody to map package → FAIL.
- Add eval string → FAIL.
- Add direct ability call field → FAIL.
- Add Nerve Bus dispatch field → FAIL.

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
confidencePolicy
reviewPolicy
failureBranch
```

Required:
- every AI step must have promptContractId.
- every AI step must have matching promptBindings item.
- prompt binding promptContractId must match step.promptContractId.
- promptContractId must exist in Prompt Contract Catalog.
- outputSchemaRef must exist.
- outputSchemaRef must match Prompt Contract Catalog entry.
- requiredInputRefs must be produced by earlier steps or initial command refs.
- branch condition may only reference outputSchemaRef-declared fields.
- promptHash is recorded in Forensics proof after AI execution.

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
- raw prompt/key ban across map package, Orchestration, AI runtime, map adapter.
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

summary: AI-generated map packages must be authored against governed catalogs and remain draft/quarantine until all gates and human approval pass.

### 主题

AI 生成地图 draft/quarantine 门禁

### 法条

AI-generated maps are candidate packages only. They are never executable truth on generation.

Required authoring input:
```txt
userRequirement
capabilityCatalog
promptContractCatalog
mapPackageSchema
securityPolicy
outputFormat
```

Required authoring output:
```txt
candidate map package JSON only
aiGenerated = true
approvalStatus = draft
availabilityPolicy = draft
needsCapabilityExpansion when requested ability is outside catalog
requiredClarifications when scope is unclear
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
→ human approval
→ activation
```

Required:
- generated map may reference only catalog-listed abilityGroupId/childCapabilityId.
- generated map may reference only catalog-listed promptContractId.
- generated map cannot active itself.
- generated map cannot spoof aiGenerated=false.
- generated map cannot spoof approvalStatus=approved.
- generated map cannot bypass Commander review.

Forbidden:
- AI-generated map active directly.
- generated package with approvalStatus=approved.
- generated package with aiGenerated=false.
- generated map with unknown abilityGroupId/childCapabilityId.
- generated map with unknown promptContractId.
- generated map with raw prompt.
- generated map with executable logic.

Required inspector:
- authoring prompt builder output schema check.
- generated draft/quarantine check.
- catalog reference check.
- spoofing check.

Required negative proof:
- AI generated map with aiGenerated=false → FAIL.
- AI generated map with approvalStatus=approved → FAIL.
- AI generated map active immediately → FAIL.
- AI generated map references missing capability → FAIL.
- AI generated map references missing promptContractId → FAIL.

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
requiresReviewGate
sensitiveOperation
supportedTargets
forbiddenResponsibilities
```

Required:
- map authoring prompt builder may use capability catalog as read-only input.
- map validation must verify referenced abilityGroupId/childCapabilityId exists in catalog and is routableByMap.
- action capabilities must carry requiresPostActionVerification=true.
- coordinate-action capabilities must carry requiresGeometryProof=true.
- sensitive operations must carry requiresReviewGate=true.

Forbidden:
- capability catalog as runtime dispatcher.
- capability catalog expanding ability-group constitution.
- generated catalog manually edited as source truth.
- map references ability/child not in catalog.
- map routes to ability with routableByMap=false.
- action step without PAV when catalog requires it.
- geometry action without geometry proof when catalog requires it.

Required inspector:
- generated catalog marker check.
- catalog entry required fields check.
- map validation against catalog.
- action/PAV and geometry gate check.

Required negative proof:
- Map references missing ability child → FAIL.
- Map routes to routableByMap=false → FAIL.
- Action step missing PAV → FAIL.
- Geometry action step missing geometry proof → FAIL.
- Manual edit of generated catalog accepted → FAIL.

---

## Law GRASSEYE-MAP-PLUGIN-008-V2

status: active  
tier: P0  
capabilityDomain: map-plugin-package  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: branch condition DSL must be schema-declared, closed, and non-executable.

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

Allowed conditionType:
```txt
comparison
```

Allowed operators:
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
reviewRequired
```

Required:
- leftRef must come from declared outputSchemaRef fields or allowed status field.
- numeric operators require numeric rightValue.
- exists/notExists/reviewRequired require rightValue=null.
- exactly one transition may match during Orchestration evaluation.
- ambiguous transition must fail/review.
- no transition must fail/review.

Forbidden:
- raw expression string.
- function body.
- eval.
- Function constructor.
- JavaScript expression in condition.
- branch reading undeclared payload field.
- branch reading raw AI natural language.
- branch deciding mission next step outside transition evaluator.

Required inspector:
- schema DSL check.
- outputSchemaRef declared-field check.
- forbidden expression/function/eval check.

Required negative proof:
- Add raw expression string → FAIL.
- Add function body to condition → FAIL.
- Branch references undeclared field → FAIL.
- Ambiguous transition returns success → FAIL.

---

## Law GRASSEYE-MAP-PLUGIN-009-V2

status: active  
tier: P0  
capabilityDomain: map-plugin-package  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: ordinary and developer map surfaces must stay separate, and Commander must not activate or mutate maps without governed validation/approval path.

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
```

Required:
- ordinary runnable task must resolve through active approved binding.
- quarantined/draft/disabled map packages must not appear as runnable ordinary tasks.
- Commander Console may request import, approval, activation, disable, and rollback only through governed ports/APIs.
- Commander preflight summary is not final validation truth.

Forbidden:
- ordinary mode exposing mapId/stepId/childCapabilityId/promptContractId/package dependency graph.
- ordinary mode requiring mapId/requestedPlatformId as launch key.
- Commander directly writing active registry.
- Commander directly writing approval records.
- Commander executing draft-only AI map.
- Commander bypassing validator.

Required inspector:
- ordinary feed field allowlist.
- developer feed boundary.
- Commander registry write ban.
- runnable task active/approved check.

Required negative proof:
- Ordinary feed exposes mapId → FAIL.
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

summary: map activation, validation, approval, prompt binding, and authoring must produce Forensics-compatible proof records.

### 主题

地图治理证据与 Forensics 证明

### 法条

Map governance operations must be proof-backed and Forensics-compatible.

Required proof records:
```txt
importProofRef
quarantineProofRef
validationReportRef
humanApprovalRef
activationId
activationSnapshotRef
activationSnapshotHash
mapPackageHash
operationalMapHash
capabilityCatalogVersion
promptCatalogVersion
rollbackRecordRef when rollback
```

Forensics proof must be able to record:
```txt
mapId
packageId
activationId
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

Required:
- validation report must include validator names, pass/fail, issue list, severity, and generatedAt.
- activation proof must include the exact package hash and operational map hash.
- rollback proof must preserve previous activation and new active state.
- prompt binding proof must carry promptContractId and outputSchemaRef.
- evidence chain must reference hashes/refs, not raw prompt body.

Forbidden:
- active map without activation proof.
- validation pass without issue list.
- human approval without humanApprovalRef.
- prompt proof without promptHash from AI Prompt Contract Catalog.
- raw prompt stored in map package proof.
- rollback without rollback record.

Required inspector:
- proof record schema check.
- activation hash field check.
- validation report field check.
- Forensics-compatible fields check.

Required negative proof:
- Activation proof missing mapPackageHash → FAIL.
- Validation report missing validator list → FAIL.
- Rollback without rollback record → FAIL.
- Forensics proof missing promptContractId for AI step → FAIL.

---

## Law GRASSEYE-MAP-PLUGIN-011-V2

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
2. Maps are data-only, not child abilities.
3. Built-ins pass same lifecycle gates.
4. Import/quarantine/validation/approval/activation/rollback present.
5. Active record contains activationSnapshotRef and hashes.
6. Approved/active map requires humanApprovalRef and validationReportRef.
7. Map package has complete manifest/task/operational/dependency/compatibility/policy/promptBinding sections.
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

Required negative proof:
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

## Final Readiness Gate

Map Plugin Package is READY only when:
```txt
law/blueprint/inspector/generated/runner agree
all active map-plugin laws are machine-blocking
map packages remain data-only
no map package becomes a child ability or runtime owner
all built-ins and imported packages pass same lifecycle
active map has validationReportRef + humanApprovalRef + activationSnapshotRef + hashes
AI-generated maps remain draft/quarantine until validation + human approval
prompt binding matches AI step and Prompt Contract Catalog
no raw prompt / executable prompt logic / handler / function body / eval
capability catalog references are valid and routableByMap
branch DSL reads only declared outputSchemaRef fields
ordinary/developer task surfaces are separated
Commander cannot bypass validators/registry ports
Forensics-compatible proof records exist
owner-local inspector PASS
negative proof PASS
ALL active law enforcement PASS
CI-FULL PASS
```
