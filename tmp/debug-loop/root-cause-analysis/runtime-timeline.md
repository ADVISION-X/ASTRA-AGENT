# Runtime Timeline

Status: latest primary blocker is no longer startup failure or `runId=null`. The current blocker is post-acceptance proof collapse: the command is accepted, but no step/action/finalization chain becomes visible afterward.

## Sources

- Latest real terminal log pasted from `npm run grasseye:start`, startup runId `2026-05-05T06:06:28.324Z`.
- Live read-only runtime endpoints:
	- `http://127.0.0.1:4173/api/runtime/logs`
	- `http://127.0.0.1:4173/api/runtime/actions`
	- `http://127.0.0.1:4173/api/runtime/snapshot`
	- `http://127.0.0.1:4173/api/runtime/mission-readiness`
- Historical context only:
	- `tmp/debug-loop/startup-failures/2026-05-05T05-32-13-380Z/startup-failure.json`
	- `tmp/debug-loop/post-fix-runtime-verification/remaining-blockers.md`

## 1. Startup And Readiness

| Surface | Status | Evidence | Judgment |
|---|---|---|---|
| dependency_check | PASS | Latest pasted log starts with dependency/runtime readiness PASS under runId `2026-05-05T06:06:28.324Z`. | Startup is not blocked here. |
| map_package_readiness | PASS | Latest pasted log reports builtin Facebook/TikTok map package readiness PASS. | Active builtin maps are loaded and approved. |
| local_ai_runtime | PASS | Latest pasted log reports local AI presence, roster, start/connect, and health probe PASS. | Local AI is not the current blocker. |
| app shell / console | PASS | Latest pasted log reports app server ready, app shell health passed, Commander Console opened, mission runtime available. | Shell and console are healthy. |
| mission-readiness endpoint | READY | Live `/api/runtime/mission-readiness` returned `status=ready` with mission, browserController, localAi, and dataStore all `ok=true`. | Current environment is ready to accept mission preflight. |

Judgment: current blocker is not startup, bootstrap, shell reachability, or readiness.

## 2. Latest Accepted Facebook Trace

Trace identity:

- `traceId=trace_e555f140-1580-4aef-9b01-43ecacb0f32f`
- `runId=commander_command_311b3de7-ad54-4b5e-af96-2c419e9797d1:run`
- `selectedMapId=facebook.seeding-video.discovery.meta.v1`
- `activationSnapshotRef=activation-snapshot:3561c46d-c41d-4b02-a900-75004c958334:1.0.0:1.0.0`

Observed event chain:

1. `HUMAN_COMMAND_VALIDATED`
2. `MISSION_READINESS_CHECK_STARTED`
3. `MISSION_PREFLIGHT_STARTED`
4. `MISSION_PREFLIGHT_PASSED`
5. `COMMANDER_COMMAND_ENVELOPE_BUILT`
6. `NERVE_BUS_ENVELOPE_CREATED`
7. `NERVE_BUS_DISPATCH_STARTED`
8. `ORCHESTRATION_START_RECEIVED`
9. `MISSION_ACTIVATION_SNAPSHOT_FROZEN` with status `success`
10. `COMMAND_ACCEPTED` with status `success`

Judgment: the latest Facebook start path is accepted all the way through the Commander / Nerve Bus / Orchestration task-start boundary.

## 3. Latest Accepted TikTok Trace

Trace identity:

- `traceId=trace_feb01658-a755-4837-a635-ade1c146fb32`
- `runId=commander_command_52abe135-b468-4c61-9e39-0b98b0e2ad0d:run`
- `selectedMapId=tiktok.seeding-video.discovery.meta.v1`
- `activationSnapshotRef=activation-snapshot:97f67205-11bc-4bbd-9507-dda1090c1cc6:1.0.0:1.0.0`

Observed event chain:

1. `HUMAN_COMMAND_VALIDATED`
2. `MISSION_READINESS_CHECK_STARTED`
3. `MISSION_PREFLIGHT_STARTED`
4. `MISSION_PREFLIGHT_PASSED`
5. `COMMANDER_COMMAND_ENVELOPE_BUILT`
6. `NERVE_BUS_ENVELOPE_CREATED`
7. `NERVE_BUS_DISPATCH_STARTED`
8. `ORCHESTRATION_START_RECEIVED`
9. `MISSION_ACTIVATION_SNAPSHOT_FROZEN` with status `success`
10. `COMMAND_ACCEPTED` with status `success`

Judgment: the latest TikTok start path also reaches accepted mission dispatch, not rejection.

## 4. Missing Post-Acceptance Events

No later structured runtime events were found after either accepted trace for:

- `MAP_STEP_SELECTED`
- `STEP_PRECONDITION_CHECKED`
- `STEP_DISPATCH_STARTED`
- `CAPABILITY_CALL_STARTED`
- `CAPABILITY_CALL_COMPLETED`
- `CAPABILITY_CALL_FAILED`
- `CAPABILITY_CALL_REVIEW_REQUIRED`
- `POST_ACTION_VERIFICATION_STARTED`
- `POST_ACTION_VERIFICATION_PASSED`
- `POST_ACTION_VERIFICATION_FAILED`
- `POST_ACTION_VERIFICATION_REVIEW_REQUIRED`
- `FORENSICS_RECORD_WRITE_REQUESTED`
- `FORENSICS_RECORD_WRITTEN`
- `STEP_TRANSITION_EVALUATED`
- `MISSION_FINALIZED`
- `MISSION_STOPPED`
- `MISSION_FAILED`
- `MISSION_REVIEW_REQUIRED`

Judgment: the runtime visibly reaches task-start acceptance, then loses the governed mission loop proof chain.

## 5. Live Read Models After Acceptance

- Live `/api/runtime/actions` returned `[]`.
- Live `/api/runtime/snapshot` returned:
	- `mission.status=idle`
	- `runtime.runtimeStatus=idle`
	- `runtime.currentStep=null`
	- `evidencePacketCount=0`
	- `browseLedgerCount=0`
	- `candidateCount=0`
	- `reviewQueue=[]`
- Live `/api/runtime/snapshot.runtimeProof` contains only task-start structured runtime events such as:
	- `Orchestration received governed start-mission command from Nerve Bus.`
	- `activationSnapshotRef=...; selectedMapId=...`
	- `command accepted`
- Live `/api/runtime/snapshot.failedRecords` still contains older historical failures including:
	- `invalid_input`
	- `Expected string, received null` at `runId`
	- `Unrecognized key(s) in object: 'targetProfileRef'`
	- `open requires targetUrl or explicit targetProfileRef ...`

Judgment: after accepted task-start traces, the Commander read models still do not show any action logs, evidence packets, browse ledger entries, or non-task-start proof events.

## 6. Historical But Non-Primary Context

- `tmp/debug-loop/startup-failures/2026-05-05T05-32-13-380Z/startup-failure.json` records a stale `fetch failed` startup case. It does not match the current healthy startup run.
- `tmp/debug-loop/post-fix-runtime-verification/remaining-blockers.md` already records that the original `runId=null` rejection did not recur in an accepted post-fix scenario.

Final judgment: the leading current blocker is `COMMAND_ACCEPTED` followed by no step/action/finalization proof chain, not the older startup or `runId=null` failures.
