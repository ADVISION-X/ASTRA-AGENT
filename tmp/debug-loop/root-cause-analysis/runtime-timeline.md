# Runtime Timeline

Phase: Runtime Log Blocker Mining & Root Cause Analysis  
Boundary: analysis only; no production/law/blueprint/inspector code changed.

## Sources

- Latest real terminal log pasted by operator for run `2026-05-05T12:22:23.900Z`.
- Corroborating runtime bundle: `tmp/debug-loop/post-fix-runtime-verification/runtime-log-b5-rerun-2.txt`.
- Corroborating runtime snapshot: `tmp/debug-loop/root-cause-analysis/current-runtime-log-snapshot.json`.

## Startup Chain

| Event | Status | Evidence |
|---|---|---|
| dependency_check | PASS | `[GRASSEYE][STARTUP][PASS] bootstrap dependency_check passed ... runId=2026-05-05T12:22:23.900Z` |
| update_preflight_check | PASS | `[GRASSEYE][STARTUP][PASS] bootstrap update_preflight_check passed ...` |
| map_package_readiness_check | PASS | `[GRASSEYE][MAP_PACKAGE][PASS] map_package_readiness ... refs=packageId=builtin.facebook...,packageId=builtin.tiktok...` |
| local_ai_runtime_presence_check | PASS | `[GRASSEYE][AI][PASS] local_ai_runtime local_ai_runtime_presence_check ...` |
| local_ai_model_roster_check | PASS | `[GRASSEYE][AI][PASS] local_ai_runtime local_ai_model_roster_check ...` |
| local_ai_start_or_connect | PASS | `[GRASSEYE][AI][PASS] local_ai_runtime local_ai_start_or_connect ...` |
| local_ai_health_probe | PASS | `[GRASSEYE][AI][PASS] local_ai_runtime local_ai_health_probe ...` |
| ai_capability_readiness_gate | PASS | `[GRASSEYE][AI][PASS] local_ai_runtime ai_capability_readiness_gate ...` |
| port_clear | PASS | `[GRASSEYE][STARTUP][PASS] bootstrap port_clear passed port 127.0.0.1:4173 is ready ...` |
| app_server start | PASS | `[GRASSEYE][SERVICE][PASS] app_server app_server ready local app shell process started ...` |
| APP_SHELL_HEALTH_CHECK_STARTED | PRESENT | `[GRASSEYE][APP][EVENT] app_shell APP_SHELL_HEALTH_CHECK_STARTED ...` |
| APP_SHELL_HEALTH_PASSED | PASS | `[GRASSEYE][APP][PASS] app_shell APP_SHELL_HEALTH_PASSED ...` |
| open_console | PASS | `[GRASSEYE][COMMANDER][PASS] commander_console open_console passed ...` |
| mission_runtime_available | PASS | `[GRASSEYE][MISSION][PASS] mission_runtime mission_runtime_available ...` |
| terminal_structured_log_relay | PASS | `[GRASSEYE][RUNTIME][PASS] startup_entrypoint terminal_structured_log_relay ready ...` |

## Facebook Mission Chain

| Event | Status | Evidence |
|---|---|---|
| HUMAN_COMMAND_RECEIVED | LOG_EVENT_MISSING in pasted terminal text | Reason: latest pasted terminal begins at validation for the first Facebook command; corroborating `runtime-log-b5-rerun-2.txt` shows `HUMAN_COMMAND_RECEIVED` for a later API-start path. |
| HUMAN_COMMAND_VALIDATED | PASS | `requestedPlatformId=facebook-web; selectedMapId=facebook.seeding-video.discovery.meta.v1` |
| MISSION_READINESS_CHECK_STARTED | PRESENT | `MissionReadiness is scoped to the selected task binding...` |
| MISSION_PREFLIGHT_STARTED | PRESENT | `Mission preflight is checking readiness before command dispatch.` |
| MISSION_PREFLIGHT_PASSED | PASS | `Mission preflight passed. Commander Console can dispatch...` |
| COMMANDER_COMMAND_ENVELOPE_BUILT | PASS | `taskTemplateId resolved to requestedPlatformId=facebook-web; selectedMapId=facebook...; activationSnapshotRef=activation-snapshot:5cbea339...` |
| NERVE_BUS_ENVELOPE_CREATED | PASS | `Nerve Bus governed envelope created for start-mission.` |
| NERVE_BUS_DISPATCH_STARTED | PRESENT | `Dispatching start-mission via CommandTransportPort.` |
| ORCHESTRATION_START_RECEIVED | PRESENT | `Orchestration received governed start-mission command from Nerve Bus.` |
| MISSION_ACTIVATION_SNAPSHOT_FROZEN | PASS | `activationSnapshotRef=activation-snapshot:5cbea339...` |
| COMMAND_ACCEPTED | PASS | `Governed start-mission command was accepted before mission execution began.` |
| MAP_STEP_SELECTED open-facebook-reels | PASS | `Orchestration selected governed step "open-facebook-reels"` |
| STEP_PRECONDITION_CHECKED open-facebook-reels | PASS | `Step "open-facebook-reels" passed dispatch and loop guard checks.` |
| CAPABILITY_CALL_STARTED | LOG_EVENT_MISSING | Reason: execution logs `STEP_DISPATCH_STARTED`, then terminal result; no separate `CAPABILITY_CALL_STARTED` event name appears. |
| CAPABILITY_CALL_COMPLETED open-facebook-reels | PASS | `Governed step "open-facebook-reels" returned status "success".` |
| POST_ACTION_VERIFICATION_STARTED | PRESENT | `Dispatching post-action verification step "verify-facebook-reels-open"` |
| POST_ACTION_VERIFICATION_PASSED | PASS | `Governed step "verify-facebook-reels-open" returned status "success".` |
| detect-login-state | PASS | `Governed step "detect-login-state" returned status "success".` |
| detect-safety-page | REVIEW_REQUIRED | `Child detect-safety-page requires governed observation refs before success.` |
| request-human-review | REVIEW_REQUIRED | `orchestration requires human review` |
| MISSION_REVIEW_REQUIRED | TERMINAL | `Mission reached terminal status "review_required" after step "request-human-review".` |
| MISSION_FINALIZED / STOPPED / FAILED | LOG_EVENT_MISSING | Reason: terminal status is `MISSION_REVIEW_REQUIRED`; no finalized/stopped/failed event is emitted for this path. |

## TikTok Mission Chain

The TikTok mission repeats the same shape with `selectedMapId=tiktok.seeding-video.discovery.meta.v1` and `activationSnapshotRef=activation-snapshot:ba88b431-31e4-416c-ab1e-991e9987043f:1.0.0:1.0.0`.

Key terminal evidence:

```txt
[GRASSEYE][RUNTIME][PASS] runtime COMMAND_ACCEPTED success Governed start-mission command was accepted before mission execution began. ... selectedMapId=tiktok.seeding-video.discovery.meta.v1
[GRASSEYE][RUNTIME][PASS] runtime POST_ACTION_VERIFICATION_PASSED success Governed step "verify-tiktok-feed-open" returned status "success".
[GRASSEYE][SERVICE][EVENT] internal:app-server:dev stdout stream [grasseye:review] ... "stepId":"detect-safety-page" ... "eventType":"CAPABILITY_CALL_REVIEW_REQUIRED","status":"review_required","failureReason":"Child detect-safety-page requires governed observation refs before success."
[GRASSEYE][SERVICE][EVENT] internal:app-server:dev stdout stream [grasseye:review] ... "eventType":"MISSION_REVIEW_REQUIRED","status":"review_required","reason":"Mission reached terminal status \"review_required\" after step \"request-human-review\"."
```

## Cross-Cut Timeline Anomalies

1. `COMMAND_ACCEPTED` and later `COMMAND_REJECTED` both appear for the same mission command path.
2. `COMMAND_REJECTED` reason is `issue-human-command timed out after 5000ms`, while Orchestration continues and reaches terminal review.
3. `CAPABILITY_CALL_STARTED` is missing as a distinct event; `STEP_DISPATCH_STARTED` is present.
4. `MISSION_REVIEW_REQUIRED` is present, but `MISSION_FINALIZED` is missing for terminal review.
