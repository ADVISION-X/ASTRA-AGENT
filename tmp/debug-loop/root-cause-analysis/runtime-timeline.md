# Runtime Timeline

Phase: Runtime Log Blocker Mining & Root Cause Analysis
Boundary: analysis only; no production, law, blueprint, inspector, or negative-proof code changed.

## Evidence Ordering

Primary evidence:

- `tmp/debug-loop/post-fix-runtime-verification/runtime-log.txt`
- `tmp/debug-loop/post-fix-runtime-verification/runtime-logs-api.json`
- `tmp/debug-loop/post-fix-runtime-verification/task-trigger-summary.md`

Supporting ingress-proof evidence:

- `tmp/debug-loop/post-fix-runtime-verification/task-start-response-current-tiktok.json`
- `tmp/debug-loop/post-fix-runtime-verification/task-start-response-current-facebook.json`

Historical only:

- older markdown already present under `tmp/debug-loop/root-cause-analysis/`
- older mixed snapshots in the verification bundle

## Startup Timeline

The latest real runtime restart began at `2026-05-06T10:16:17.515Z`.

Startup passed these gates before any task dispatch:

1. `dependency_check`
2. `update_preflight_check`
3. `map_package_readiness_check`
4. local AI readiness gates
5. `port_clear`
6. `app_server`
7. `APP_SHELL_HEALTH_PASSED`
8. `open_console`
9. `mission_runtime_available`
10. `terminal_structured_log_relay`
11. `waiting_for_human_command`

Conclusion:

- startup is not the current blocker

## Command Path Timeline

Selected authoritative task:

- `taskTemplateId=tiktok-seeding-video-discovery`
- `requestedPlatformId=tiktok-web`
- `selectedMapId=tiktok.seeding-video.discovery.meta.v1`
- `commandId=commander_command_9412137b-5123-45ef-bf1d-23c550b4dfba`
- `runId=commander_command_9412137b-5123-45ef-bf1d-23c550b4dfba:run`

Observed command / preflight sequence:

1. `HUMAN_COMMAND_VALIDATED`
2. `MISSION_READINESS_CHECK_STARTED`
3. `MISSION_PREFLIGHT_STARTED`
4. `MISSION_PREFLIGHT_PASSED`
5. `COMMANDER_COMMAND_ENVELOPE_BUILT`
6. `NERVE_BUS_ENVELOPE_CREATED`
7. `NERVE_BUS_DISPATCH_STARTED`
8. `ORCHESTRATION_START_RECEIVED`
9. `MISSION_ACTIVATION_SNAPSHOT_FROZEN`
10. `COMMAND_ACCEPTED`

Observed forensics continuity during command start:

- `FORENSICS_RECORD_WRITE_REQUESTED`
- `FORENSICS_RECORD_WRITTEN`

Conclusion:

- Commander, Nerve Bus, Orchestration start, and Forensics write flow are all active in the latest real bundle

## Mission Loop Timeline

Observed governed step sequence for the authoritative run:

1. `open-tiktok-feed` selected, dispatched, executed, and completed successfully
2. `verify-tiktok-feed-open` selected and completed successfully
3. `detect-login-state` selected and completed successfully
4. `detect-safety-page` selected and completed successfully
5. `detect-feed-ready` selected and completed successfully
6. `capture-video-viewport` selected, dispatched, executed, and completed successfully
7. `prepare-ai-input` selected
8. `STEP_PRECONDITION_CHECKED` passed for `prepare-ai-input`
9. `STEP_DISPATCH_STARTED` for Screenshot `prepare-ai-input`
10. `CAPABILITY_CALL_STARTED` for Screenshot `prepare-ai-input`
11. `CAPABILITY_CALL_FAILED` with `prepare-ai-input proof requires scaleMapping`
12. `STEP_TRANSITION_EVALUATED prepare-ai-input:failed` succeeded
13. `MISSION_FAILED`

Conclusion:

- the authoritative mission reaches Screenshot child execution after full startup and mission dispatch
- the first live execution blocker is Screenshot `prepare-ai-input`

## Cross-Run Consistency Inside The Same Bundle

The API bundle contains the same `prepare-ai-input proof requires scaleMapping` failure on:

- `commander_command_89508c2b-4391-4f44-a98f-766f0c6ce39a:run`
- `commander_command_9412137b-5123-45ef-bf1d-23c550b4dfba:run`

Conclusion:

- the Screenshot blocker is not a single-run artifact

## LOG_EVENT_MISSING Findings

### LOG_EVENT_MISSING-1: `HUMAN_COMMAND_DRAFTED`

- required by the command-ingress transparency contract
- not present in the latest terminal relay
- not present in the latest API bundle
- code path for emission exists in `recordTaskStartDraftEvents(...)`

### LOG_EVENT_MISSING-2: `HUMAN_COMMAND_RECEIVED`

- required by the command-ingress transparency contract
- not present in the latest terminal relay
- not present in the latest API bundle
- code path for emission exists in `recordTaskStartDraftEvents(...)`

### LOG_EVENT_INCONSISTENT-1: `COMMAND_ACCEPTED`

- present in multiple forms
- at least one accepted-command payload in the API bundle still carries `missionId: null`
- accepted HTTP receipt runtime proofs in both `current-facebook` and `current-tiktok` artifacts carry `missionId: null` and `traceId: null`
- later mission-bound `COMMAND_ACCEPTED` records do carry stronger correlation data

Conclusion:

- the ingress timeline is reconstructible only by combining multiple artifacts
- this is sufficient to elevate a P1 observability / proof-chain blocker

## Historical / Non-Current Timeline Notes

- the old `prepare-ai-input` missing-`source` blocker is not the first failure in the latest authoritative run
- earlier mirroring blockers were not exercised by the selected authoritative web rerun and therefore stay historical in this package
