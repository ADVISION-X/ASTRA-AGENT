---
name: "GrassEye Commander Console Capability"
description: "Use when governing the Commander Console Ability Group, human command entry, governed HumanCommandEnvelope transport, mission dashboard read models, runtime proof timeline, review queue, task-template UX, map import UX, and the boundary that prevents Commander from becoming Orchestration, Forensics, AI, or browser/action owner."
applyTo: ".github/instructions/cursor-rules/modules/module-commander-console-capability.instructions.md, src/capabilities/commander-console/**, src/app/task-api-handlers.ts, src/app/candidate-api-handlers.ts, src/lib/local-runtime/workbench.ts, src/lib/local-app-shell/**, scripts/audit/domains/commander-console-capability/**, docs/法案辅助文件/GrassEye Commander Console 总司令控制台能力组施工图.md"
---

# GrassEye Commander Console Capability FINAL

Scope: governs the independent Commander Console Ability Group, human command entry, governed command envelope creation, read-only commander dashboards, review-disposition entry, task-template start UX, map-import UX, runtime proof timeline, evidence/browse/failed-record read models, and audit-facing console surfaces.

Boundary: Commander Console governs only human entry and read-model presentation. It does not own mission truth, map progression, Nerve Bus delivery truth, AI runtime truth, browser/action execution, page-state truth, Forensics persistence truth, evidence packet truth, candidate mutation truth, or runtime snapshot truth.

Authority: this file is authoritative only for the `commander-console-capability` domain.

Architecture phase: `Static Capability Package Architecture`.

Core doctrine:
- Commander Console is the cockpit for humans, not the engine.
- Commander receives human intent and emits governed command envelopes.
- Commander reads governed truth and renders Commander-owned view records.
- Commander does not execute maps, advance steps, call AI, write Forensics, touch browser/action primitives, or mutate candidates directly.
- Human command entry has one owner: Commander Console.
- Action and mission execution have other owners: Orchestration, Nerve Bus, action abilities, PAV, Forensics.
- No silent map/platform default.
- No raw runtime truth as Commander public contract.
- No command or review path outside Commander.
- No active Commander law without inspector + runner + negative proof.

---

## Global Commander Baseline

All active Commander laws in this file are:

```yaml
status: active
tier: P0
capabilityDomain: commander-console-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof
```

Required package:

```txt
src/capabilities/commander-console/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── registry.ts
├── index.ts
├── ports/
├── shared/
├── runtime/
└── children/
```

Required enforcement:

```txt
scripts/audit/domains/commander-console-capability/
├── manifest.json
├── inspector.ts
├── run-inspector.ts
└── negative-proof-harness.ts
```

Forbidden:
- `manual-first` as active enforcement for this domain.
- `evidenceMode: law` as sufficient evidence.
- verify scripts as release truth.
- detached inspector.
- warning-only P0.
- generated fake PASS.
- empty negative proof.

---

## Law GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V2

status: active  
tier: P0  
capabilityDomain: commander-console-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: Commander Console is the only owner of human command entry and review-disposition entry.

### 主题

人类命令入口主权唯一

### 法条

Human mission commands and human review decisions must enter through Commander Console.

Allowed human command types:

```txt
start-mission
pause-mission
resume-mission
stop-mission
emergency-stop
approve-candidate
reject-candidate
mark-review-required
inspect-record-detail
```

Required:
- Task API routes call Commander public interface.
- Candidate review API routes call Commander public interface.
- Commander emits governed HumanCommandEnvelope through CommandTransportPort.
- Commander never holds raw Orchestration ability object.
- Commander never directly mutates candidate/review/storage.
- Commander public root is `src/capabilities/commander-console`.

Forbidden:
- `task-api-handlers` calling workbench.startTask/pauseTask/stopTask or agent runtime command methods.
- `candidate-api-handlers` calling setCandidateDisposition/resetLocalStore/deleteCandidate.
- operator-control/workbench/startup owning command truth.
- local shell becoming second command owner.
- Commander exposing raw OrchestrationAbilityGroup.
- hidden human-command paths outside Commander.

Required inspector:
- External command-entry call graph.
- Forbidden direct command APIs.
- Public surface check.
- Commander transport-only command path.

Required negative proof:
- Task handler directly calls workbench.startTask → FAIL.
- Candidate handler calls setCandidateDisposition → FAIL.
- Commander public contract exposes raw OrchestrationAbilityGroup → FAIL.

---

## Law GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2

status: active  
tier: P0  
capabilityDomain: commander-console-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: Commander command envelope must be explicit, map/platform-safe, idempotent, timeout-governed, and semantically validated.

### 主题

HumanCommandEnvelope 机器门禁

### 法条

Commander command path must be:

```txt
input schema gate
→ child registry gate
→ command policy gate
→ explicit map/platform gate
→ timeout gate
→ idempotency gate
→ command envelope builder
→ command transport
→ transport semantic gate
→ proof builder
→ result builder
```

Required command envelope fields:

```txt
commandId
commandType
priority
operatorRef
targetMissionId where applicable
targetRecordRef where applicable
requestedPlatformId for start-mission
selectedMapId for start-mission
taskTemplateId optional only before resolved start command
activationId or activationSnapshotRef where available
humanGoal
maxRounds
maxMinutes
operatorNote
payload
idempotencyKey
timeoutMs
```

Start mission:
- Ordinary UX may select taskTemplateId.
- Before emission, governed command envelope must resolve to requestedPlatformId + selectedMapId or fail/review_required.
- If taskTemplateId cannot resolve to approved active map binding, command must fail/review_required.
- No silent default platform.
- No silent default map.
- No `requestedPlatformId ?? "tiktok-web"`.
- No `defaultRequestedPlatformId`.

Review commands:
- approve/reject/mark-review-required require candidate targetRecordRef.
- Review command cannot carry targetMissionId as mutation truth unless law explicitly allows.

Emergency stop:
- priority must be `emergency`.
- commandType must remain `emergency-stop`.
- must not downgrade to `stop-mission`.
- must not be deduped away.
- failed dispatch must produce `hard-stop-dispatch-failed`.
- review-required dispatch must produce `hard-stop-review-required`.

Transport result semantic gate must check:
- result.commandId equals input.commandId.
- accepted requires envelopeRef.
- accepted should have resultEnvelopeRef unless transport law explicitly allows pending result.
- failed requires failureReason.
- review_required requires reviewRequiredReason.
- status must be accepted | failed | review_required.
- unknown status fails.
- schema-valid but semantically mismatched result fails.

Required inspector:
- Start command dual field gate.
- No default platform pattern.
- Transport semantic gate called.
- Timeout/idempotency gates called.
- Emergency hard-stop invariant.

Required negative proof:
- start-mission with only requestedPlatformId → FAIL.
- `requestedPlatformId ?? "tiktok-web"` → FAIL.
- transport accepted without envelopeRef → FAIL.
- emergency-stop downgraded to stop-mission → FAIL.

---

## Law GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V2

status: active  
tier: P0  
capabilityDomain: commander-console-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: Commander read models are read-only Commander-owned view records sourced from governed read-model ports.

### 主题

控制台只读真相边界

### 法条

Commander may display governed truth only through public read-model ports:

```txt
OrchestrationMissionReadModel
ForensicsReadModelPort
CapabilityHealthReadModelPort
AuditReadModelPort
RuntimeProofReadModelPort
MapPackageReadModelPort if map UX is enabled
```

Required:
- Read child path uses strict schema gate.
- Read child path uses read model source gate.
- Read output is transformed to Commander-owned view record.
- Read result includes source proof refs.
- Read result includes readModelSource.
- targetRecordRequired and proofRefRequired are enforced.
- UI-only truth cannot become Commander truth.

Forbidden public contract truth:
- OperatorSnapshotRecord.
- AgentSkillMatrixSnapshot.
- ProductDiscoveryEvidencePacket.
- BrowseRuntimeSnapshot.
- RuntimeDeliveryState.
- LocalAiTaskResult.
- TaskRun.
- activeTaskRunId.
- ProductOpportunityCandidate mutable domain object.

Forbidden:
- Commander writing evidence packet/browse ledger/failed record/structured log.
- Commander inventing runtime truth.
- Commander advancing operational-map state.
- demo/prototype/placeholder data as governed truth.

Required inspector:
- Read-model port import boundary.
- Legacy type ban.
- Commander view record transformation.
- Read proof/source enforcement.

Required negative proof:
- Commander contract exports TaskRun → FAIL.
- Read child returns UI-only summary without proofRef when required → FAIL.
- Commander imports EvidenceStoreService → FAIL.

---

## Law GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V2

status: active  
tier: P0  
capabilityDomain: commander-console-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: Commander must not become Orchestration, Nerve Bus, AI, Forensics, browser/action owner, or storage owner.

### 主题

总司令边界纯洁度

### 法条

Commander root must not import or execute foreign owners.

Forbidden imports/symbols under `src/capabilities/commander-console/**`:
- BrowserController.
- browser primitive owners.
- platform action adapters/runtime.
- local AI runtime / LocalAiGateway.
- AI child/runtime implementations.
- Orchestration implementation/raw ability object.
- Nerve Bus dispatch internals unless a governed command transport port type explicitly permits.
- Forensics storage internals / writer internals.
- screenshot/open/click/scroll/text-input/visual-target/geometry-guard/page-state implementations.
- `src/features/local-data`.
- `src/features/operator-control`.
- deleted workbench rendering payloads.
- storage maintenance helpers.

Forbidden behavior:
- direct `orchestration.startMission/pauseMission/resumeMission/stopMission/emergencyStop`.
- direct map step advancement.
- direct Forensics write.
- direct browser action.
- direct AI call.
- direct candidate mutation.
- direct runtime snapshot building.

Required inspector:
- Import graph check.
- Symbol call check.
- Browser/action/AI/Forensics/Orchestration boundary ban.
- Local shell render-only check.
- Startup bootstrap-only check.

Required negative proof:
- Commander imports BrowserController → FAIL.
- Commander directly calls orchestration.startMission → FAIL.
- Commander writes Forensics record → FAIL.
- Startup triggers start mission → FAIL.

---

## Law GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-005-V2

status: active  
tier: P0  
capabilityDomain: commander-console-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: Commander package must have one canonical root, real child folders, one child registry, one runtime pipeline, and no compat bridge.

### 主题

唯一 canonical root 与真实子能力

### 法条

Commander root is:

```txt
src/capabilities/commander-console
```

Required active children:

```txt
issue-human-command
show-capability-roster
show-capability-health
show-mission-dashboard
show-operational-map-progress
show-runtime-proof-timeline
show-evidence-packets
show-browse-ledger
show-failed-records
show-review-queue
show-audit-summary
pause-mission
resume-mission
stop-mission
emergency-stop
approve-candidate
reject-candidate
mark-review-required
inspect-record-detail
```

Required:
- Each child has `contract.ts`, `schema.ts`, `implementation.ts`.
- Registry contains all children and only existing children.
- Command children call unified command executor.
- Read children call unified read executor.
- `ability-group.ts` is thin.
- `contract.ts` public interface exposes only `listChildAbilityIds()` and `execute(input)`.
- `index.ts` has no export-star.
- No dual-root / compat / legacy / bridge Commander paths.

Forbidden active source:
- `src/features/operator-control`.
- runtime-skill-catalog.ts.
- runtime-skill-resolution.ts.
- build-runtime-skill-matrix-snapshot.ts.
- build-browse-runtime-snapshot.ts.
- build-pending-analysis-candidate.ts.
- children.ts flat fake child table.
- verify scripts as release gate.

Required inspector:
- Root structure.
- Child registry parity.
- Public surface.
- No export-star.
- No legacy file names.
- No compat bridge.

Required negative proof:
- Add external import of child implementation → FAIL.
- Add export * in index → FAIL.
- Add flat children.ts → FAIL.

---

## Law GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V2

status: active  
tier: P0  
capabilityDomain: commander-console-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: Commander runtime result and proof must preserve command/read chain and must never use fake success, null proof, warning-only pass, or throw from public boundary.

### 主题

控制台 proof 与结果完整性

### 法条

Every Commander execution must return a governed result:

```txt
status: success | failed | review_required
abilityGroupId = commander-console
childCapabilityId
operatorRef
runtimeProof
dataQualityFlags
```

Runtime proof must include:

```txt
proofId
abilityGroupId
childCapabilityId
childKind
operatorRef
inputRef
outputRef or diagnosticPayloadRef
commandId or readRequestId
commandEnvelopeRef if command dispatched
resultEnvelopeRef if transport returned it
readModelSource if read
targetRecordRef where applicable
evidenceRefs
startedAt
endedAt
durationMs
status
failureReason if failed
reviewRequiredReason if review_required
boundaryDecision
commandDecision or readDecision
transportDecision if command
hardStopDecision if emergency path
policyDecision
dataQualityFlags
```

Required:
- public execute never throws.
- unknown child returns typed failed result with proof.
- invalid input returns typed failed result with proof.
- command gate failure returns failed result with receipt and proof.
- transport failure returns failed/review result with receipt and proof.
- read model failure returns failed result with proof.
- runtimeProof cannot be null.
- fake/fallback/no-op success forbidden.

Forbidden:
- `runtimeProof: null`.
- naked throw escaping `execute`.
- `return null` as success.
- `status: ok`.
- `status: persisted`.
- warning-only pass.
- output without proof.
- failure without reason.
- review_required without reason.

Required inspector:
- Result/proof schema enforcement.
- Unknown child proof.
- Public boundary non-throw.
- Fake success/escape detection.

Required negative proof:
- Remove RuntimeProofSchema.parse → FAIL.
- return runtimeProof:null → FAIL.
- make unknown child throw → FAIL.
- convert failed to success without proof → FAIL.

---

## Law GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-007-V2

status: active  
tier: P0  
capabilityDomain: commander-console-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: Commander task-template and map-import UX may display governed map lifecycle but must not become map execution, validation, activation, or runtime truth.

### 主题

地图包导入与任务模板 UX 边界

### 法条

Commander may expose task-template and map-import UX through governed map-package ports or APIs.

Ordinary users may see:
```txt
displayName
description
version
availability
safetyLevel
run limits
start button
```

Developer/Map Manager may see:
```txt
packageId
mapId
activationId
activationSnapshotRef
stepId
childCapabilityId
dependency list
validation findings
compatibility matrix
promptContractId
```

Required:
- Ordinary start may use taskTemplateId.
- Commander must resolve taskTemplateId through governed approved-active binding port/API.
- Runtime command envelope must contain requestedPlatformId + selectedMapId or fail/review_required.
- Quarantined/disabled/draft maps cannot appear as runnable ordinary tasks.
- AI-generated maps must remain draft-only unless map-package law allows approved activation.
- Commander may request import/approval/activation/disable/rollback through governed ports only.
- Commander preflight summary is not final validation truth.

Forbidden:
- ordinary mode exposing internal mapId/stepId/childCapabilityId/promptContractId.
- Commander directly writing active registry or approval records.
- Commander executing draft AI map.
- shell owning map selection truth.
- Commander treating UI preflight as final map validation truth.

Required inspector:
- Ordinary vs developer field separation.
- No direct active registry mutation.
- Start command map/platform resolution.
- Draft/quarantine runnable ban.

Required negative proof:
- Ordinary task list exposes mapId → FAIL.
- Commander writes active registry → FAIL.
- Draft map marked runnable → FAIL.

---

## Law GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-008-V2

status: active  
tier: P0  
capabilityDomain: commander-console-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: Commander enforcement must close through owner-local AST/symbol/import-graph inspector, generated artifacts, runner, and negative proof.

### 主题

Commander 执法唯一入口

### 法条

Commander enforcement must close through:

```txt
scripts/audit/domains/commander-console-capability/manifest.json
scripts/audit/domains/commander-console-capability/inspector.ts
scripts/audit/domains/commander-console-capability/run-inspector.ts
scripts/audit/domains/commander-console-capability/negative-proof-harness.ts
```

Required:
- Inspector uses ts-morph AST-level checks.
- Inspector uses symbol and import-graph checks.
- Inspector uses schema-level checks for command/result/proof.
- Inspector verifies active law coverage in registry/matrix/audit-plan/runner.
- Negative proof reports fail → rollback → pass.
- CI-FULL must be green for delivery.
- No grep/regex/includes as final judgment.
- No warning-only P0.
- No detached inspector.
- No empty negative proof.
- No generated fake PASS.

Required inspector checks:
```txt
1. Law file is machine-blocking.
2. Public interface only listChildAbilityIds + execute.
3. Start-mission requires requestedPlatformId + selectedMapId after template resolution.
4. No default platform.
5. Transport semantic gate validates commandId/envelopeRef/failure/review.
6. Timeout gate and idempotency gate exist and are invoked.
7. Emergency stop cannot downgrade or dedupe away.
8. Read models come through read-model ports only.
9. No legacy public truth types.
10. No forbidden foreign owner imports.
11. Child registry parity.
12. Runtime proof never null.
13. Public execute never throws.
14. External APIs route through Commander public interface.
15. Local shell render-only.
16. Startup bootstrap-only.
17. ALL active Commander laws in registry/matrix/audit-plan/runner.
18. negative-proof-harness executed.
```

Required negative proof:
```txt
manual-first enforcement reintroduced
start-mission only requestedPlatformId
requestedPlatformId ?? "tiktok-web"
transport accepted without envelopeRef
transport commandId mismatch
emergency-stop downgraded
read model returns UI-only truth
Commander imports BrowserController
Commander imports Forensics storage internals
external imports Commander child
runtimeProof:null
public execute throw
remove negative proof invocation
turn P0 into warning-only
```

---

## Final Readiness Gate

Commander Console is READY only when:

```txt
law/blueprint/inspector/generated/runner agree
all active Commander laws are machine-blocking
human command entry is Commander-only
public surface is execute-only
start command has explicit platform/map after template resolution
no silent defaults
transport semantic gate enforced
timeout/idempotency gates enforced
emergency stop hard path enforced
read models are read-only and proof-backed
no foreign owner imports
no legacy truth types
task-template UX does not own map truth
owner-local inspector PASS
negative proof PASS
ALL active law enforcement PASS
CI-FULL PASS
```
