---
name: "GrassEye Orchestration Capability"
description: "Use when governing the independent Orchestration Ability Group, governed mission command consumption, frozen operational map selection, mission state, step state, branch evaluation, Nerve Bus dispatch, map package activation snapshot, step execution loop, review escalation, finalization, and the boundary that prevents Commander, maps, runtime helpers, platform adapters, Forensics, or legacy browse-flow chains from owning mission flow."
applyTo: ".github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md, src/capabilities/orchestration/**, docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md, scripts/audit/domains/orchestration-capability/**, src/capabilities/commander-console/**, src/capabilities/nerve-bus/**, src/features/platform-action/**, src/lib/local-runtime/**"
---

# GrassEye Orchestration Capability FINAL

Scope: governs the independent Orchestration Ability Group, governed mission command consumption, operational map package selection, frozen activation snapshot, mission state ownership, step state ownership, branch evaluation, Nerve Bus dispatch, step loop, review escalation, mission finalization, map-level proof, and Orchestration owner evidence.

Boundary: this module governs only mission flow and map-driven orchestration. It does not govern human command UI, Commander public surface, Nerve Bus transport internals, primitive actions, AI runtime internals, screenshot/image processing, browser control, Forensics storage internals, product judgement, or platform business adapters.

Authority: this file is authoritative only for the `orchestration-capability` domain.

Architecture phase: `Static Capability Package Architecture`.

Future architecture compatibility: `Controlled Pluggable Map Package`, not free code plugin runtime.

Core doctrine:
- Orchestration is the commander of mission flow, not the human console.
- Commander receives human command; Orchestration receives governed mission command.
- Orchestration owns mission state, step state, selected operational map, branch decision, review escalation, and finalization.
- Orchestration dispatches only through Nerve Bus.
- Orchestration consumes maps as frozen declarative data packages, not executable plugins.
- Map package is route data, not owner, not runtime, not child ability.
- Orchestration must never use latest active map lookup after activation.
- Orchestration must never silently default platform/map.
- Orchestration must never build raw prompts; promptContractId comes from frozen active map step.
- Orchestration must never hide finalization under Forensics.
- No activationSnapshotRef, no runtime-ready mission.
- No Nerve Bus envelope, no governed step dispatch.
- No post-action verification after action step, no action step completion.
- No active Orchestration law without inspector + runner + real-code-inspection.

---

## Global Orchestration Baseline

All active Orchestration laws in this file are:

```yaml
status: active
tier: P0
capabilityDomain: orchestration-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection
```

Required package:

```txt
src/capabilities/orchestration/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── registry.ts
├── index.ts
├── internal.ts
├── ports/
├── shared/
├── runtime/
├── maps/
└── children/
```

Required children:

```txt
start-mission
pause-mission
resume-mission
stop-mission
emergency-stop
execute-map-step
evaluate-step-transition
finalize-mission
```

Required enforcement:

```txt
scripts/audit/domains/orchestration-capability/
├── manifest.json
├── inspector.ts
├── run-inspector.ts
└── owner-inspection-harness.ts
```

Forbidden:
- `manual-first` as active enforcement for this domain.
- `evidenceMode: law` as sufficient evidence.
- verify scripts as release truth.
- capability-check.ts under Orchestration root.
- detached inspector.
- warning-only P0.
- generated fake PASS.
- empty/missing real-code-inspection.
- legacy browse-flow as runtime owner.
- agent-runtime as mission owner.
- platform adapter as flow owner.
- maps as executable plugins.

---

## Law GRASSEYE-ORCHESTRATION-CAPABILITY-001-V3

status: active  
tier: P0  
capabilityDomain: orchestration-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Orchestration is the only owner of mission flow, operational map selection, mission state, step state, branch evaluation, and finalization.

### 主题

总调度主权唯一

### 法条

Orchestration Ability Group is the only owner of governed mission flow.

Required:
- Human command enters Commander Console first.
- Commander Console emits governed mission command through Nerve Bus or governed transport envelope.
- Orchestration receives governed mission command only after Commander gate.
- Orchestration owns:
  - mission command consumption
  - selected operational map
  - map activation snapshot consumption
  - mission state
  - step state
  - currentStepId
  - previousStepId
  - branchTaken
  - review escalation
  - mission finalization
  - final round status
- Review decisions may enter Orchestration only through governed review command.
- Commander must not mutate Orchestration state directly.
- Startup may bootstrap runtime but must not issue mission start/pause/resume/stop/emergency-stop directly.

### 禁止

FORBIDDEN:
- PlatformAdapter owning mission flow.
- open/page-state/action ability owning mission flow.
- deleted agent-runtime chains owning mission state.
- workbench/runtime helper directly advancing step.
- Commander directly holding raw OrchestrationAbilityGroup as public contract truth.
- human command bypassing Commander Console.
- startup-entrypoint directly issuing mission control commands.
- Orchestration recovering missing platform/map truth through hardcoded defaults.
- `requestedPlatform ?? "tiktok-web"`.
- `defaultRequestedPlatformId`.
- `selectedMapId ?? defaultMapId`.
- review-runtime state regression outside governed review command.

Required inspector:
- External mission-owner scan.
- Commander direct Orchestration import/hold ban.
- Startup mission-control command ban.
- Default platform/map fallback ban.
- Review regression source check.

Required real-code-inspection:
- Add startup direct startMission call → FAIL.
- Add `requestedPlatform ?? "tiktok-web"` → FAIL.
- Commander imports raw OrchestrationAbilityGroup → FAIL.
- Workbench directly advances step → FAIL.

---

## Law GRASSEYE-ORCHESTRATION-CAPABILITY-002-V3

status: active  
tier: P0  
capabilityDomain: orchestration-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Operational maps are declarative approved packages consumed by Orchestration, not executable code, child abilities, or second runtimes.

### 主题

作战地图是受控声明式数据包

### 法条

Operational maps are governed declarative map packages. Orchestration remains the only execution owner.

Required:
- Map package must be data-only.
- Production automation maps must be `routePlanBoundMap`.
- `routePlanBoundMap` may declare only the deterministic entry spine, including one AI-owned startup preparation step and its fail-closed local routeLabel transitions before Route Plan takeover, AI handoff, Prompt Contract refs, input/output refs, platform/profile constraints, dependency refs, and `routePlanId`.
- Route Plan is the single source for post-startup routeLabel action chains and owns `routeLabel -> step chain -> ability group/child capability` after the startup preparation gate has passed.
- Orchestration may mechanically consume the startup preparation routeLabel and Route Plan labels only; it must not infer readiness from login, safety, captcha, or feed heuristics, and it must not branch from AI free text.
- Generic diagnostic maps may declare diagnostic steps and transitions, but they must not bind Route Plan or enter production automation execution.
- Map package must not execute code.
- Map package must not import TypeScript modules.
- Map package must not dispatch Nerve Bus.
- Map package must not call ability implementations.
- Map package must not mutate mission state.
- Map package must not write Forensics.
- Operational maps are not child capabilities.
- Operational maps must not expand fixed ability-group catalog.
- Active map truth comes only from approved active map registry.

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
→ compatibility validation
→ dry-run validation
→ Commander governed automation gate
→ activation proof
→ activation
→ active registry
→ re-inspect if needed
```

Required validation gates:
```txt
schema validation
dependency validation
transition closure validation
capability registry validation
prompt contract validation
platform profile validation
compatibility validation
dry-run validation
```

### 禁止

FORBIDDEN:
- maps modeled as Orchestration child capabilities.
- map package containing executable code.
- map package importing `.ts`, `.js`, `.mjs`, `.tsx`, `.jsx`.
- map package holding function bodies.
- map package dispatching Nerve Bus directly.
- map package writing Forensics records directly.
- map package bypassing validation.
- unvalidated map package becoming active.
- unapproved map package becoming active.
- AI generated draft map executing without validation and Commander governed automation gate.
- legacy static TypeScript maps acting as active runtime selection truth.
- maps becoming platform-specific browse-flow narratives.

Required inspector:
- Map directory data-only check.
- Forbidden TS import/call expression check inside map package.
- Active registry source check.
- Validation gate presence.
- No map as child capability.

Required real-code-inspection:
- Add executable function inside map package → FAIL.
- Add map package direct Nerve Bus dispatch → FAIL.
- Activate unapproved map → FAIL.
- Add map as Orchestration child → FAIL.

---

## Law GRASSEYE-ORCHESTRATION-CAPABILITY-003-V3

status: active  
tier: P0  
capabilityDomain: orchestration-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Orchestration must freeze map activation snapshot and must not reselect latest map during mission execution.

### 主题

冻结激活快照与禁止 latest lookup

### 法条

Once a mission starts, Orchestration must freeze the selected map package truth.

Required activation fields:
```txt
activationId
activationSnapshotRef
mapPackageId
mapPackageVersion
selectedMapId
selectedMapVersion
promptContractVersion
capabilityCatalogVersion
platformProfileVersion
selectedMapSource
compatibilityDecision
activationApprovedBy
activationApprovedAt
```

Required:
- `start-mission` must select exactly one active approved map.
- `start-mission` must freeze activationSnapshotRef.
- mission state must store activationSnapshotRef.
- step dispatch proof must carry activationSnapshotRef.
- loop proof must carry activationSnapshotRef.
- result proof must carry activationSnapshotRef.
- all step outputs must be traceable to activationSnapshotRef.
- re-inspect must preserve activation record and re-inspect record.
- running mission must not perform latest active map lookup.
- resuming mission must load map by frozen activationSnapshotRef or activation record, not by latest active map.

### 禁止

FORBIDDEN:
- owner evidence only records selectedMapId but lacks activationSnapshotRef.
- selectedMapVersion nullable in valid mission execution.
- mapPackageVersion nullable in valid mission execution.
- promptContractVersion nullable when map contains AI steps.
- capabilityCatalogVersion nullable in valid mission execution.
- running step reloads latest active map by mapId.
- resume mission selects latest active map instead of frozen activation.
- cross-step backfill without activationSnapshotRef.
- state update that drops activationSnapshotRef.

Required inspector:
- Schema field requiredness for valid execution.
- State write/read frozen activation check.
- Resume path latest lookup ban.
- Proof parity check.
- No nullable activation chain in valid execution.

Required real-code-inspection:
- Remove activationSnapshotRef from mission state → FAIL.
- owner evidence missing activationSnapshotRef → FAIL.
- Resume calls latest active map lookup → FAIL.
- selectedMapVersion nullable on running state → FAIL.

---

## Law GRASSEYE-ORCHESTRATION-CAPABILITY-004-V3

status: active  
tier: P0  
capabilityDomain: orchestration-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Orchestration dispatches only through Nerve Bus envelopes and public ability group contracts.

### 主题

Nerve Bus 调度出口唯一

### 法条

Orchestration must dispatch governed work only through Nerve Bus.

Required:
- Ability steps dispatch through `OrchestrationNerveBusPort.sendCommandToAbility`.
- AI steps dispatch through `OrchestrationNerveBusPort.sendRequestToAi`.
- Every dispatch must produce nerveBusEnvelopeId.
- Every dispatched step proof must record nerveBusEnvelopeId.
- Every ability input generated from Orchestration must include:
  - missionId
  - runId
  - sessionId
  - roundId/videoVisitId when available
  - stepId
  - mapPackageId
  - mapPackageVersion
  - selectedMapId
  - selectedMapVersion
  - activationSnapshotRef
  - capabilityCallId
  - nerveBusEnvelopeId
  - sourceRef
  - inputRef
  - idempotencyKey
- Dispatch timeout must return typed failed proof.
- Late Nerve Bus result must not overwrite timeout failure.

### 禁止

FORBIDDEN:
- direct cross-group imports.
- direct child ability implementation imports.
- hidden skill catalogs.
- browse chains.
- adapter-owned next-step logic.
- Orchestration calling primitive ports.
- Orchestration calling browser controllers.
- Orchestration calling Forensics runtime internals.
- Nerve Bus dispatch without envelopeId.
- dispatch result accepted without envelope semantic check.
- AI prompt dispatch without promptContractId from map step.
- Any `sendReviewRequestToCommander`, runtime review dispatch, or Commander review request from Orchestration.

Required inspector:
- Direct cross-group import ban.
- Nerve Bus port usage check.
- EnvelopeId required in result/proof.
- Dispatch payload chain fields.
- Timeout gate check.
- Envelope semantic gate check.

Required real-code-inspection:
- Orchestration imports open child implementation → FAIL.
- Ability dispatch without nerveBusEnvelopeId → FAIL.
- Direct call to Mouse Click implementation → FAIL.
- AI dispatch without promptContractId → FAIL.

---

## Law GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3

status: active  
tier: P0  
capabilityDomain: orchestration-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Orchestration step execution must follow the active map and enforce preconditions, PAV after actions, evidence routing, loop guard, and transition closure.

### 主题

地图驱动步骤执行与转移闭环

### 法条

Step execution must be map-driven, bounded, and auditable.

Required:
- Current step must exist in frozen selected map.
- Step targetAbilityGroupId and childCapabilityId must match active capability catalog.
- Step dependencies must be satisfied before dispatch.
- AI vision step must require prior prepare-ai-input.
- mouse-click step must require visual-target and geometry-guard handoff.
- mouse-scroll step must require geometry-guard handoff.
- text-input step must require approved text and verified input target handoff.
- Every real action step, including open, click, scroll, and text-input, must require a subsequent post-action-verification result. No explicit policy reason may replace PAV for real external actions.
- Evidence output must route to Forensics Persistence through governed request.
- Transition evaluation must consume only declared output schema fields.
- AI branch decisions must rely only on declared outputSchemaRef fields.
- Exactly one transition may match, otherwise fail.
- No transition match must fail.
- Loop guard must enforce maxRounds/maxMinutes/maxStepCount.
- Emergency-stop must short-circuit loop and latch state.

### 禁止

FORBIDDEN:
- branch decision reading undeclared payload fields.
- AI branch over raw natural-language reasoning.
- action step without PAV.
- evidence output bypassing Forensics.
- hidden next-step logic outside transition evaluator.
- while true mission loop without loop guard.
- loop continues after emergency stop.
- transition ambiguity success.
- no transition treated as success.
- static browse-flow hardcoded decision tree.
- runtime review route, human review dispatch, or review-decision route inside production automation.

Required inspector:
- Precondition gates.
- PAV-after-action gate.
- Forensics routing gate.
- Transition evaluator declared-field check.
- Loop guard check.
- Emergency stop gate.

Required real-code-inspection:
- Mouse click step without PAV → FAIL.
- Branch reads undeclared AI output field → FAIL.
- Remove loop guard → FAIL.
- Ambiguous transition returns success → FAIL.
- Evidence output bypasses Forensics → FAIL.

---

## Law GRASSEYE-ORCHESTRATION-CAPABILITY-006-V3

status: active  
tier: P0  
capabilityDomain: orchestration-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Prompt selection is map-owned and frozen; Orchestration must not build raw prompts or hardcode prompt selection.

### 主题

Prompt 选择服从冻结地图

### 法条

Prompt selection must come only from the frozen active approved map step.

Required:
- AI step must carry promptContractId from map step.
- AI step must carry promptContractVersion from activation snapshot.
- AI step must carry outputSchemaRef.
- Orchestration may pass promptContractId to Nerve Bus.
- Orchestration may not build prompt text.
- Orchestration may not concatenate prompt strings.
- Orchestration may not choose prompt by hardcoded model/task logic.
- Orchestration may not select prompt from latest prompt catalog during running mission.
- Prompt contract mismatch must fail.

### 禁止

FORBIDDEN:
- raw prompt string building inside Orchestration.
- `prompt = "..."`
- template literal prompt construction.
- AI step without promptContractId.
- AI step without outputSchemaRef.
- hardcoded prompt selection.
- latest prompt lookup during running mission.
- promptContractId sourced from AI runtime instead of map.

Required inspector:
- Raw prompt construction ban.
- AI dispatch prompt source check.
- outputSchemaRef required.
- prompt version frozen check.

Required real-code-inspection:
- Add raw prompt template in Orchestration → FAIL.
- AI step without outputSchemaRef → FAIL.
- Prompt selected from latest catalog at runtime → FAIL.
- Hardcoded promptContractId in dispatcher → FAIL.

---

## Law GRASSEYE-ORCHESTRATION-CAPABILITY-007-V3

status: active  
tier: P0  
capabilityDomain: orchestration-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Orchestration may request persistence but must not hide finalization, branch, candidate, or delivery-state ownership under Forensics.

### 主题

Forensics 只记账，不替总调度裁决

### 法条

Orchestration may send cleaned payloads to Forensics Persistence for storage, but Orchestration remains the owner of mission flow and finalization.

Required:
- Orchestration owns branch decisions.
- Orchestration owns mission outcome.
- Orchestration owns review escalation.
- Orchestration owns final round status.
- Orchestration may build a persistence request.
- Orchestration may forward only cleaned payload refs, `artifactLifecycleManifestRef`, and `artifactHash` to Forensics.
- Orchestration must propagate Screenshot quota/backpressure and cleanup-blocker outcomes as typed failed outcomes, not silent retries.
- Orchestration may request promotion or cleanup only through Forensics public contract / Nerve Bus request.
- Orchestration must not mark screenshot artifacts as `promoted-evidence` or `legal-hold-evidence`.
- Forensics returns persistence refs.
- Forensics must not own AgentRound regression.
- Forensics must not own RuntimeDeliveryState regression.
- Forensics must not own product candidate construction.
- Forensics must not own round outcome judgment.

### 禁止

FORBIDDEN:
- Importing `src/capabilities/forensics-persistence/runtime/**`.
- Treating Forensics as mission finalizer.
- Forensics deciding branchTaken.
- Forensics mutating mission state.
- hiding round finalization logic in Forensics directory.
- Orchestration writing Forensics storage directly.
- Orchestration bypassing Forensics public contract.
- Orchestration self-promoting screenshot retention.
- Orchestration dropping screenshot quota/backpressure or cleanup-blocker failures.

Required inspector:
- Forensics runtime import ban.
- Finalizer owner scan.
- Persistence request through public contract/Nerve Bus only.
- Mission state regression outside Orchestration ban.
- Screenshot retention/promotion boundary text presence.

Required real-code-inspection:
- Import Forensics runtime in Orchestration → FAIL.
- Move finalize-round judgment under Forensics → FAIL.
- Forensics mutates mission state → FAIL.
- Orchestration writes storage directly → FAIL.

---

## Law GRASSEYE-ORCHESTRATION-CAPABILITY-008-V3

status: active  
tier: P0  
capabilityDomain: orchestration-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Orchestration result and owner evidence must preserve command, map activation, state transition, dispatch envelope, branch, loop, timeout, idempotency, and finalization chain.

### 主题

总调度结果与运行证明完整性

### 法条

Every Orchestration result/proof must preserve the real upstream chain.

Required command/input fields:
```txt
abilityGroupId = orchestration
childCapabilityId
commandKind
missionId
runId
sessionId
roundId or visitId
videoVisitId where available
requestedPlatformId
selectedMapId or taskTemplateId or activationId
commanderCommandRef
commanderEnvelopeRef
nerveBusEnvelopeId from Commander-to-Orchestration command
sourceRef
inputRef
idempotencyKey
```

Required mission state fields:
```txt
missionId
runId
sessionId
currentStepId
previousStepId
stateRevision
stateHash
selectedMapId
selectedMapVersion
mapPackageId
mapPackageVersion
activationId
activationSnapshotRef
promptContractVersion
capabilityCatalogVersion
platformProfileVersion
missionStatus
emergencyStopLatched
reviewState
```

Required step proof fields:
```txt
proofId
missionId
runId
sessionId
roundId or visitId
videoVisitId
stepId
previousStepId
mapPackageId
mapPackageVersion
selectedMapId
selectedMapVersion
activationId
activationSnapshotRef
promptContractVersion
capabilityCatalogVersion
targetAbilityGroupId
targetChildCapabilityId
capabilityCallId
nerveBusEnvelopeId
idempotencyKey
sequenceNo
stateRevisionBefore
stateRevisionAfter
stateHashBefore
stateHashAfter
dispatchDecision
dispatchTimeoutDecision
dispatchResultStatus
transitionEvaluationDecision
transitionId
branchTaken
loopDecision
finalizationDecision
failureReason
reviewRequiredReason
startedAt
endedAt
durationMs
```

Required:
- result/proof/state/input parity.
- no nullable activation/map chain fields for valid running mission.
- dispatch proof must include nerveBusEnvelopeId.
- transition proof must include transitionId and declared decision source.
- finalization proof must include finalizationDecision.
- invalid input failure may use receivedShapeHash and typed proof.

### 禁止

FORBIDDEN:
- runtimeProof:null.
- status: ok.
- status: persisted.
- fabricated runId from missionId/step/fingerprint.
- missionId = sessionId unless explicitly received as such from input.
- success without activationSnapshotRef.
- step success without nerveBusEnvelopeId.
- transition success without transitionId.
- failed/review result with success output.
- missing stateRevisionBefore/After.
- nullable selectedMapVersion in valid running mission.

Required inspector:
- Schema field checks.
- State/proof/result parity.
- No fabricated chain pattern.
- Activation chain non-null in valid execution.
- Dispatch envelope proof invariant.
- Finalization proof invariant.

Required real-code-inspection:
- Remove activationSnapshotRef from proof → FAIL.
- Step success without nerveBusEnvelopeId → FAIL.
- Set runId from missionId + stepId → FAIL.
- selectedMapVersion nullable on running state → FAIL.
- Transition success without transitionId → FAIL.

---

## Law GRASSEYE-ORCHESTRATION-CAPABILITY-009-V3

status: active  
tier: P0  
capabilityDomain: orchestration-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Orchestration children are mission lifecycle and transition actions only and must use unified runtime.

### 主题

子能力只做 mission lifecycle 与 transition

### 法条

Active child capabilities:

```txt
start-mission
pause-mission
resume-mission
stop-mission
emergency-stop
execute-map-step
evaluate-step-transition
finalize-mission
```

Required:
- Each child has `contract.ts`, `schema.ts`, `implementation.ts`.
- Each child delegates through unified Orchestration runtime/state/dispatch services.
- Child does not call foreign ability implementation.
- Child does not dispatch Nerve Bus directly unless through Orchestration runtime port.
- Child does not own maps as child.
- Child does not build final proof/result directly when unified builder applies.
- `emergency-stop` must latch state and prevent further dispatch.
- `pause/resume/stop` must be governed state transitions, not raw regressions.
- Orchestration must not expose `request-human-review`, `submitReviewDecision`, or any review-decision route. Automation failures terminate as `failed`.

### 禁止

FORBIDDEN:
- map package children.
- browse-next-video child under Orchestration.
- product-video-detection child under Orchestration.
- comment-evidence child under Orchestration.
- raw browser/action children.
- child importing open/page-state/AI/action implementations.
- child returning boolean.
- child bypassing state policy gate.
- child bypassing Nerve Bus port for dispatch.
- `request-human-review` child, registry entry, schema value, or public method.

Required inspector:
- Child folder/registry/schema parity.
- Forbidden child roots.
- Child unified runtime call.
- Foreign implementation import ban.
- Emergency latch check.

Required real-code-inspection:
- Add browse-next-video child → FAIL.
- Child imports open implementation → FAIL.
- emergency-stop does not latch state → FAIL.
- request-human-review exists anywhere in Orchestration child/registry/schema/public method surface → FAIL.

---

## Law GRASSEYE-ORCHESTRATION-CAPABILITY-010-V3

status: active  
tier: P0  
capabilityDomain: orchestration-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Orchestration enforcement must close through owner-local AST/symbol/import-graph inspector, runner, and real-code-inspection.

### 主题

Orchestration 执法唯一入口

### 法条

Orchestration enforcement must close through:

```txt
scripts/audit/domains/orchestration-capability/manifest.json
scripts/audit/domains/orchestration-capability/inspector.ts
scripts/audit/domains/orchestration-capability/run-inspector.ts
scripts/audit/domains/orchestration-capability/owner-inspection-harness.ts
```

Required:
- Inspector must use ts-morph AST-level checks.
- Inspector must use symbol and import-graph checks.
- Inspector must use schema-level checks.
- Inspector must include anti-escape checks.
- Inspector must verify active law coverage in registry/matrix/audit-plan/runner.
- real-code-inspection must run and report fail → re-inspect → pass.
- CI-FULL must be green for delivery.
- No grep/regex/includes as final judgment.
- No warning-only P0.
- No detached inspector.
- No empty/missing real-code-inspection.
- No generated fake PASS.
- No capability-check.ts.
- No verify script as release truth.

Required inspector checks:
```txt
1. Law file is machine-blocking.
2. Public contract is mission/map/step flow only.
3. Commander entry boundary enforced.
4. No silent platform/map fallback.
5. Map package data-only and lifecycle validation enforced.
6. Activation snapshot frozen and non-null in valid execution.
7. No latest active map lookup during running mission/resume.
8. Dispatch only through Nerve Bus port.
9. Dispatch payload/proof includes envelopeId and chain fields.
10. Step preconditions and PAV-after-action enforced.
11. Transition evaluation declared-field only.
12. PromptContractId/outputSchemaRef sourced from frozen map.
13. No raw prompt building.
14. Forensics finalizer boundary enforced.
15. Result/proof/state/input parity.
16. Children use unified runtime.
17. No forbidden imports/symbols/legacy browse-flow.
18. ALL active Orchestration laws in registry/matrix/audit-plan/runner.
19. owner-inspection-harness executed.
```

Required real-code-inspection:
```txt
manual-first enforcement reintroduced
remove activationSnapshotRef from mission state
remove activationSnapshotRef from proof
selectedMapVersion nullable on running state
resume calls latest active map lookup
requestedPlatform fallback to tiktok-web
selectedMap fallback to defaultMap
step success without nerveBusEnvelopeId
direct import of open child implementation
direct import of forensics runtime
AI step builds raw prompt
AI step without outputSchemaRef
branch reads undeclared AI output field
mouse-click step without PAV
evidence output bypasses Forensics
ambiguous transition returns success
remove loop guard
emergency-stop continues dispatch
add browse-next-video child
map package contains executable function
activate unapproved map
capability-check.ts added
remove real-code-inspection invocation
turn P0 into warning-only
```

---

## Final Readiness Gate

Orchestration is READY only when:

```txt
law/blueprint/inspector/generated/runner agree
all active Orchestration laws are machine-blocking
Commander entry boundary enforced
mission command cannot silently default platform/map
map package lifecycle and validation gates enforced
activationSnapshotRef frozen and non-null in valid execution
no latest active map lookup during running mission/resume
dispatch only through Nerve Bus envelope
step payload/proof carries full chain fields
PAV-after-action and Forensics routing enforced
transition evaluation uses declared output schema fields only
prompt selection comes from frozen map step only
Forensics cannot own finalization/branch/mission state
result/proof/state/input chain parity passes
children are narrow lifecycle/transition actions
owner-local inspector PASS
real-code-inspection PASS
ALL active law enforcement PASS
CI-FULL PASS
```
