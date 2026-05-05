# Blocker List

## BLOCKER-1: Latest Accepted Traces Stop At `COMMAND_ACCEPTED`

### 1. Live Evidence

Latest Facebook trace:

- `traceId=trace_e555f140-1580-4aef-9b01-43ecacb0f32f`
- `runId=commander_command_311b3de7-ad54-4b5e-af96-2c419e9797d1:run`
- `selectedMapId=facebook.seeding-video.discovery.meta.v1`

Latest TikTok trace:

- `traceId=trace_feb01658-a755-4837-a635-ade1c146fb32`
- `runId=commander_command_52abe135-b468-4c61-9e39-0b98b0e2ad0d:run`
- `selectedMapId=tiktok.seeding-video.discovery.meta.v1`

Both latest traces show the same visible boundary chain:

```txt
HUMAN_COMMAND_VALIDATED
MISSION_READINESS_CHECK_STARTED
MISSION_PREFLIGHT_STARTED
MISSION_PREFLIGHT_PASSED
COMMANDER_COMMAND_ENVELOPE_BUILT
NERVE_BUS_ENVELOPE_CREATED
NERVE_BUS_DISPATCH_STARTED
ORCHESTRATION_START_RECEIVED
MISSION_ACTIVATION_SNAPSHOT_FROZEN success
COMMAND_ACCEPTED success
```

Immediately missing afterward for both traces:

```txt
MAP_STEP_SELECTED
STEP_PRECONDITION_CHECKED
STEP_DISPATCH_STARTED
CAPABILITY_CALL_STARTED
CAPABILITY_CALL_COMPLETED / FAILED / REVIEW_REQUIRED
POST_ACTION_VERIFICATION_*
FORENSICS_RECORD_*
STEP_TRANSITION_EVALUATED
MISSION_FINALIZED / FAILED / REVIEW_REQUIRED / STOPPED
```

### 2. Actual Behavior

The command is accepted after Orchestration receives the frozen activation snapshot, but the governed mission loop never becomes visible in structured runtime logs. The selected maps are not empty or trivial maps: both latest traces use active builtin maps whose `initialStepId` is a real open step, not `finalize-mission`.

### 3. Law And Blueprint Requirement

- Law file: `.github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md`
- lawId: `GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3`
- Requirement: step execution must be map-driven, bounded, auditable, PAV-after-action enforced, Forensics routing enforced.
- lawId: `GRASSEYE-ORCHESTRATION-CAPABILITY-008-V3`
- Requirement: result and runtime proof must preserve dispatch, transition, loop, and finalization chain.
- Blueprint file: `docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md`
- Blueprint requirement: Orchestration story chain includes step dispatch through Nerve Bus, transition evaluation, and Forensics persistence request; Runtime Proof section requires transition and finalization proof fields.
- Blueprint file: `docs/法案辅助文件/GrassEye 结构化日志与运行证明施工图.md`
- Blueprint requirement: terminal relay is display only, but governed runtime proof must still exist as structured payload and read-model truth.

### 4. Production Root

- `src/capabilities/orchestration/runtime/orchestration-executor-loop-iteration.ts`
	- `runMissionLoopIteration` dispatches steps and evaluates transitions, but emits no step-phase structured runtime event.
- `src/capabilities/orchestration/runtime/step-dispatcher.ts`
	- step dispatch executes ability / AI / review / finalize routing, but emits no `STEP_DISPATCH_STARTED` or `CAPABILITY_CALL_*` event.
- `src/lib/local-runtime/structured-log-terminal.ts`
	- terminal relay is ready to mirror `MAP_STEP_SELECTED`, `CAPABILITY_CALL_*`, `STEP_TRANSITION_EVALUATED`, and mission-finalization event names, but these events are not produced by the loop.

### 5. Why Enforcement Did Not Block It

- `scripts/audit/domains/orchestration-capability/run-governed-runtime-checks.ts` checks frozen activation, proof fields, and gate presence, but not emitted loop-phase events.
- `scripts/audit/domains/orchestration-capability/negative-proof-harness.ts` mutates start-boundary and gate conditions, but not post-acceptance event emission.
- `grep` over `scripts/audit/**` found no audit coverage for `MAP_STEP_SELECTED`, `STEP_PRECONDITION_CHECKED`, `CAPABILITY_CALL_STARTED`, or `STEP_TRANSITION_EVALUATED`.

### 6. Fix Layer, Not In This Phase

- Production code: yes.
- Inspector: yes.
- Negative proof: yes.
- Law change: no.

## BLOCKER-2: Action Timeline And Evidence Read Models Stay Empty After Acceptance

### 1. Live Evidence

- Live `/api/runtime/actions` returned `[]`.
- Live `/api/runtime/snapshot` returned:
	- `mission.status=idle`
	- `runtime.runtimeStatus=idle`
	- `evidencePacketCount=0`
	- `browseLedgerCount=0`
	- `candidateCount=0`
	- `reviewQueue=[]`

### 2. Actual Behavior

Even after accepted Facebook and TikTok mission-start traces, the current read models show no structured action log, no evidence packet, no browse ledger, and no candidate output. That means the Commander dashboard has no governed post-acceptance trail to display.

### 3. Law And Blueprint Requirement

- Blueprint file: `docs/法案辅助文件/GrassEye 结构化日志与运行证明施工图.md`
- Blueprint requirement:
	- `structured_action_log` is a governed log type.
	- structured runtime and action payloads are generated upstream and persisted through Forensics.
	- browse ledger and evidence packet flows must be able to link back to structured records.
- Blueprint file: `docs/法案辅助文件/GrassEye Commander Console 总司令控制台能力组施工图.md`
- Blueprint requirement: Commander displays governed runtime proof timeline, evidence packets, browse ledger, failed records, and other proof-backed read models.
- Law file: `.github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md`
- lawId: `GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3`
- Requirement: evidence output must route to Forensics Persistence through governed request.

### 4. Production Root

- `src/lib/local-runtime/workbench-runtime.ts`
	- `/api/runtime/actions` is backed directly by `evidenceStore.listStructuredActionLogs(tail)`.
- `src/capabilities/forensics-persistence/contract.ts`
	- `writeStructuredActionLog` exists as a contract surface.
- Current repository search result:
	- `writeStructuredActionLog(` has no producer call sites outside the Forensics contract definition.
	- `structured_action_log` exists as schema / child / storage definitions only.

This means the action timeline is currently structurally empty: the read endpoint exists, but no production path writes to it.

### 5. Why Enforcement Did Not Block It

- `scripts/audit/domains/forensics-persistence-capability/run-forensics-structured-log-runtime-checks.ts` focuses on command flow, AI debug wiring, terminal relay fields, health, and exit events.
- `scripts/audit/domains/structured-logging/run-structured-logging-checks.ts` inspects ownership of `writeStructuredActionLog` calls if they exist, but does not require a non-empty producer set.

### 6. Fix Layer, Not In This Phase

- Production code: yes.
- Inspector: yes.
- Negative proof: yes.
- Law change: no.

## BLOCKER-3: Success-Path Runtime Proof Does Not Close Into Commander Read Models

### 1. Live Evidence

- Latest accepted traces instruct the operator to "Monitor the mission page and runtime proof timeline."
- Live `/api/runtime/snapshot.runtimeProof` contains only task-start events, not step / transition / finalization proof.
- Live `/api/runtime/snapshot.mission` is already back to `idle` after accepted traces.

### 2. Actual Behavior

The system produces accepted task-start evidence, but Commander cannot read back a governed post-acceptance proof chain. The runtime proof timeline is derived from structured runtime events only, so silent success-path execution remains invisible.

### 3. Law And Blueprint Requirement

- Law file: `.github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md`
- lawId: `GRASSEYE-ORCHESTRATION-CAPABILITY-008-V3`
- Requirement: result, proof, state, and input parity must preserve the real upstream chain.
- Blueprint file: `docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md`
- Blueprint requirement: Runtime Proof section requires transition and finalization proof fields; ready gate requires `result/proof/state/input chain parity`.
- Blueprint file: `docs/法案辅助文件/GrassEye Commander Console 总司令控制台能力组施工图.md`
- Blueprint requirement: Commander should display proof-backed runtime proof timeline, not UI-only proofless truth.

### 4. Production Root

- `src/capabilities/orchestration/runtime/orchestration-executor-loop-iteration.ts`
	- failure paths append `lastRuntimeProofRef/runtimeProofRefs` into mission state;
	- `buildTransitionSuccessOutcome` does not append success-path proof refs before persisting state.
- `src/capabilities/orchestration/runtime/orchestration-transition-success-proof.ts`
	- builds a transition success proof object, but this proof is not connected to Commander read models by persisted runtime-event output.
- `src/lib/local-runtime/workbench-commander-runtime-proof-read-model.ts`
	- runtime proof timeline is a projection of `structuredRuntimeEvents`, not orchestration proof objects.

### 5. Why Enforcement Did Not Block It

- `scripts/audit/domains/orchestration-capability/run-governed-runtime-checks.ts` verifies schema/gate structure, not success-path proof persistence into read models.
- `scripts/audit/domains/commander-console-capability/run-commander-runtime-checks.ts` verifies Commander runtime gates and proof shapes, not post-acceptance runtime-proof timeline parity.

### 6. Fix Layer, Not In This Phase

- Production code: yes.
- Inspector: yes.
- Negative proof: yes.
- Law change: no.

## Historical Context, Not Current Primary Blocker

- `tmp/debug-loop/post-fix-runtime-verification/remaining-blockers.md` already records that the original `runId=null` rejection stopped recurring in an accepted scenario.
- Live failed records still preserve older `runId=null`, `targetProfileRef`, and Open target binding errors, but the latest real traces are accepted task-start traces. They are recurrence background, not the leading current blocker.
