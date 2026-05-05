# Runtime Timeline

Phase: Runtime Log Blocker Mining & Root Cause Analysis
Boundary: analysis only; no production, law, blueprint, inspector, or negative-proof code changed.

## Evidence Ordering

Primary evidence:

- `docs/Codex提示词/终端日志复制.md`
- latest real startup / runtime run
- `runId=2026-05-05T17:10:09.996Z`

Cross-check evidence:

- `tmp/debug-loop/post-fix-runtime-verification/runtime-log.txt`
- earlier but consistent with the same blocker families

Mixed evidence only:

- `tmp/debug-loop/post-fix-runtime-verification/runtime-snapshot.json`
- contains both current blocker families and older screenshot parity failures

## Startup Timeline

The latest real startup log proves startup is not the blocker:

1. `dependency_check`: PASS
2. `update_preflight_check`: PASS
3. `map_package_readiness_check`: PASS
4. local AI presence / roster / health: PASS
5. app shell health gate: PASS
6. Commander Console opened: PASS
7. `mission_runtime_available`: PASS
8. `waiting_for_human_command`: READY

`tmp/debug-loop/startup-failures/` contains older failure bundles, but none override the latest 17:10 startup pass.

## Mission Timeline By Map

### Facebook Web

Key latest-log sequence:

1. `HUMAN_COMMAND_VALIDATED`
2. `MISSION_PREFLIGHT_PASSED`
3. `COMMANDER_COMMAND_ENVELOPE_BUILT`
4. `NERVE_BUS_ENVELOPE_CREATED`
5. `ORCHESTRATION_START_RECEIVED`
6. `MISSION_ACTIVATION_SNAPSHOT_FROZEN`
7. `COMMAND_ACCEPTED`
8. `open-facebook-reels`: success
9. `verify-facebook-reels-open`: success
10. `detect-login-state`: success
11. `detect-safety-page`: success
12. `detect-feed-ready`: success
13. `capture-video-viewport`: success
14. `prepare-ai-input`: `CAPABILITY_CALL_FAILED`
15. `STEP_TRANSITION_EVALUATED prepare-ai-input:failed`: success
16. `MISSION_FAILED`

First blocking failure:

```txt
invalid_type -> path ["source"] -> message "Required"
```

Meaning:

- Open, page-state, screenshot capture, and transition routing all worked up to the `prepare-ai-input` dispatch.
- The stop point is not startup and not missing runtime event emission.

### iPhone Mirroring Facebook App

Key latest-log sequence:

1. `HUMAN_COMMAND_VALIDATED`
2. `MISSION_PREFLIGHT_PASSED`
3. `COMMAND_ACCEPTED`
4. `open-iphone-mirroring`: `CAPABILITY_CALL_STARTED`
5. `open-iphone-mirroring`: `CAPABILITY_CALL_FAILED`
6. `STEP_TRANSITION_EVALUATED`: failed
7. `MISSION_FAILED`

First direct step failure:

```txt
OpenLocalProgramPort is not configured
```

Second derived failure:

```txt
Map "iphone.mirroring.facebook.seeding-video.discovery.v1" has no matching transition from step "open-iphone-mirroring" for status "failed".
```

Meaning:

- The first blocker is missing local-program execution wiring.
- The map then fails its declared failure path closure.

### iPhone Mirroring TikTok App

Key latest-log sequence mirrors the Facebook mirroring run:

1. `HUMAN_COMMAND_VALIDATED`
2. `MISSION_PREFLIGHT_PASSED`
3. `COMMAND_ACCEPTED`
4. `open-iphone-mirroring`: `CAPABILITY_CALL_STARTED`
5. `open-iphone-mirroring`: `CAPABILITY_CALL_FAILED`
6. `STEP_TRANSITION_EVALUATED`: failed
7. `MISSION_FAILED`

First direct step failure:

```txt
OpenLocalProgramPort is not configured
```

Second derived failure:

```txt
Map "iphone.mirroring.tiktok.seeding-video.discovery.v1" has no matching transition from step "open-iphone-mirroring" for status "failed".
```

### TikTok Web

Key latest-log sequence mirrors Facebook web:

1. `HUMAN_COMMAND_VALIDATED`
2. `MISSION_PREFLIGHT_PASSED`
3. `COMMAND_ACCEPTED`
4. `open-tiktok-feed`: success
5. `verify-tiktok-feed-open`: success
6. `detect-login-state`: success
7. `detect-safety-page`: success
8. `detect-feed-ready`: success
9. `capture-video-viewport`: success
10. `prepare-ai-input`: `CAPABILITY_CALL_FAILED`
11. `STEP_TRANSITION_EVALUATED prepare-ai-input:failed`: success
12. `MISSION_FAILED`

First blocking failure:

```txt
invalid_type -> path ["source"] -> message "Required"
```

## Cross-Run Consistency

The earlier 17:03 verification log confirms the same live blocker families:

- web maps still fail on missing `source` at `prepare-ai-input`
- mirroring maps still fail on missing `OpenLocalProgramPort`
- mirroring maps still fail on missing `open-iphone-mirroring:failed` transition closure

What it does not justify:

- treating older mixed `videoVisitId` parity failures as the current primary blocker

## Removed Old Narrative

The latest real evidence disproves these claims as current:

- startup is the stop point
- `COMMAND_ACCEPTED` is missing
- `CAPABILITY_CALL_STARTED` is missing
- screenshot `videoVisitId` parity is the only live blocker

## Current Bottom Line

The latest real runtime proves three current blocker facts:

1. Web maps currently stop at screenshot `prepare-ai-input` because `source` is missing.
2. Mirroring maps first stop because the Open runtime has no `OpenLocalProgramPort` wired.
3. Mirroring maps then hit a second blocking governance defect because `open-iphone-mirroring` has no failed / review transition closure.
