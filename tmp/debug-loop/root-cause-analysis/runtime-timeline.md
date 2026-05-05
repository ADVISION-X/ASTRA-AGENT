# Runtime Timeline

Source: latest real terminal log pasted from `npm run grasseye:start`, runId `2026-05-05T05:41:00.956Z`, plus live `/api/runtime/logs` snapshot from `http://127.0.0.1:4173/api/runtime/logs`. This is a real runtime log source, not a simulated test log.

## Startup / Shell

| Event | Status | Evidence | Judgment |
|---|---|---|---|
| dependency_check | PASS | `[GRASSEYE][STARTUP][PASS] bootstrap dependency_check passed dependency readiness passed runId=2026-05-05T05:41:00.956Z` | Executed and passed. |
| update_preflight_check | PASS | `[GRASSEYE][STARTUP][PASS] bootstrap update_preflight_check passed update preflight passed runId=2026-05-05T05:41:00.956Z` | Executed and passed. |
| map_package_readiness_check | PASS | `[GRASSEYE][MAP_PACKAGE][PASS] map_package_readiness map_package_readiness_check passed map package readiness passed before app shell start ... refs=packageId=builtin.facebook-seeding-video-discovery,packageId=builtin.tiktok-seeding-video-discovery` | Builtin packages passed readiness before shell start. |
| local_ai_runtime_presence_check | PASS | `[GRASSEYE][AI][PASS] local_ai_runtime local_ai_runtime_presence_check passed local AI runtime presence passed ... refs=vision=ready:qwen2.5vl:3b,ocr=ready:apple-vision-or-paddleocr,commentUnderstanding=ready:qwen2.5:3b,productSignal=ready:qwen2.5:3b` | Executed and passed. |
| local_ai_model_roster_check | PASS | `[GRASSEYE][AI][PASS] local_ai_runtime local_ai_model_roster_check passed local AI model roster check passed ...` | Executed and passed. |
| local_ai_start_or_connect | PASS | `[GRASSEYE][AI][PASS] local_ai_runtime local_ai_start_or_connect passed local AI start/connect passed ...` | Executed and passed. |
| local_ai_health_probe | PASS | `[GRASSEYE][AI][PASS] local_ai_runtime local_ai_health_probe passed local AI health probe passed ...` | Executed and passed. |
| ai_capability_readiness_gate | PASS | `[GRASSEYE][AI][PASS] local_ai_runtime ai_capability_readiness_gate passed AI capability readiness gate passed ...` | Executed and passed. |
| port_clear | PASS | `[GRASSEYE][STARTUP][PASS] bootstrap port_clear passed port 127.0.0.1:4173 is ready ...` | Executed and passed. |
| app_server start | PASS | `[GRASSEYE][SERVICE][PASS] app_server app_server ready local app shell process started for http://127.0.0.1:4173` | Executed and passed. |
| APP_SHELL_HEALTH_CHECK_STARTED | STARTED | `[GRASSEYE][APP][EVENT] app_shell APP_SHELL_HEALTH_CHECK_STARTED started waiting for health at http://127.0.0.1:4173/api/runtime/health` | Executed. |
| APP_SHELL_HEALTH_PASSED | PASS | `[GRASSEYE][APP][PASS] app_shell APP_SHELL_HEALTH_PASSED passed Commander Console reachable at http://127.0.0.1:4173 ... refs="components=4,contentType=text/html; charset=utf-8"` | Shell reachable. |
| open_console | PASS | `[GRASSEYE][COMMANDER][PASS] commander_console open_console passed opened Commander Console via Google Chrome ...` | Executed and passed. |
| mission_runtime_available | PASS | `[GRASSEYE][MISSION][PASS] mission_runtime mission_runtime_available passed mission runtime is available after startup gate passed ...` | Mission runtime reports available. |
| terminal_structured_log_relay | PASS | `[GRASSEYE][RUNTIME][PASS] startup_entrypoint terminal_structured_log_relay ready terminal structured log relay active ... refs=/api/runtime/logs,/api/runtime/actions,/api/runtime/mission-readiness` | Relay active. |

## Mission Command

| Event | Status | Evidence | Judgment |
|---|---|---|---|
| HUMAN_COMMAND_RECEIVED | LOG_EVENT_MISSING | Latest terminal log begins at `HUMAN_COMMAND_VALIDATED`; no `HUMAN_COMMAND_RECEIVED` line is present in the pasted latest run. | Either not emitted to terminal relay or naming is inconsistent. |
| HUMAN_COMMAND_VALIDATED | PASS | `[GRASSEYE][RUNTIME][PASS] runtime HUMAN_COMMAND_VALIDATED success requestedPlatformId=facebook-web; selectedMapId=facebook.seeding-video.discovery.meta.v1 ... traceId=trace_754fb9d8-03f7-4e98-8487-e27f10a52490 ... refs=trace_754...,attempt_087...,task_start` | Command binding validated. |
| MISSION_READINESS_CHECK_STARTED | EVENT | `[GRASSEYE][RUNTIME][EVENT] runtime MISSION_READINESS_CHECK_STARTED started MissionReadiness is scoped to the selected task binding, not the app shell. ...` | Executed. |
| MISSION_PREFLIGHT_STARTED | EVENT | `[GRASSEYE][RUNTIME][EVENT] runtime MISSION_PREFLIGHT_STARTED started Mission preflight is checking readiness before command dispatch. ...` | Executed. |
| MISSION_PREFLIGHT_PASSED | PASS | `[GRASSEYE][RUNTIME][PASS] runtime MISSION_PREFLIGHT_PASSED success Mission preflight passed. Commander Console can dispatch the governed human command. ...` | Preflight passed. |
| COMMANDER_COMMAND_ENVELOPE_BUILT | PASS | `[GRASSEYE][RUNTIME][PASS] runtime COMMANDER_COMMAND_ENVELOPE_BUILT success taskTemplateId resolved to requestedPlatformId=facebook-web; selectedMapId=facebook.seeding-video.discovery.meta.v1; activationSnapshotRef=activation-snapshot:890e5f4e-fb8e-40de-847b-498aee7f8fcb:1.0.0:1.0.0 ...` | Envelope was built with activation snapshot in the reason text, but the structured field `activationSnapshotRef` is absent from the terminal line. |
| NERVE_BUS_ENVELOPE_CREATED | PASS | `[GRASSEYE][RUNTIME][PASS] runtime NERVE_BUS_ENVELOPE_CREATED success Nerve Bus governed envelope created for start-mission. ... traceId=commander_command_9d6d1c09-eb8b-4a22-9908-beebcd32c018 ...` | Transport envelope created. |
| NERVE_BUS_DISPATCH_STARTED | EVENT | `[GRASSEYE][RUNTIME][EVENT] runtime NERVE_BUS_DISPATCH_STARTED started Dispatching start-mission via CommandTransportPort. ...` | Dispatch started. |
| COMMAND_ACCEPTED | LOG_EVENT_MISSING | No `COMMAND_ACCEPTED` in latest terminal log. | System did not reach accepted terminal outcome; command later rejected. |
| ORCHESTRATION_START_RECEIVED | EVENT | `[GRASSEYE][RUNTIME][EVENT] runtime ORCHESTRATION_START_RECEIVED started Orchestration received governed start-mission command from Nerve Bus. ...` | Orchestration received the start command. |
| MISSION_ACTIVATION_SNAPSHOT_FROZEN | FAIL | `[GRASSEYE][RUNTIME][FAIL] runtime MISSION_ACTIVATION_SNAPSHOT_FROZEN failed activationSnapshotRef=activation-snapshot:890e5f4e-fb8e-40de-847b-498aee7f8fcb:1.0.0:1.0.0; selectedMapId=facebook.seeding-video.discovery.meta.v1 failureReason=invalid_input ...` | The log name says frozen snapshot, but status is failed because mission state failed immediately after start. |
| COMMAND_REJECTED | FAIL | `[GRASSEYE][RUNTIME][FAIL] runtime COMMAND_REJECTED failed COMMAND_REJECTED failureReason=invalid_input ... actionableMessage="Inspect the latest debug bundle and fix the blocking dependency before retrying." ...` | P0: preflight passed and Nerve Bus dispatched, but command rejected. |

## Mission Loop Events

| Event | Status | Judgment |
|---|---|---|
| MAP_STEP_SELECTED | LOG_EVENT_MISSING | No terminal/runtime event in latest run. The system either failed before a separately logged step-selected event, or the loop has no structured event emission for this phase. Production code in `src/capabilities/orchestration/runtime/orchestration-executor-loop-iteration.ts` dispatches steps but does not call `recordCommanderDebugEvent`. |
| STEP_PRECONDITION_CHECKED | LOG_EVENT_MISSING | No structured event found. |
| CAPABILITY_CALL_STARTED | LOG_EVENT_MISSING | No structured event found. |
| CAPABILITY_CALL_COMPLETED / FAILED / REVIEW_REQUIRED | LOG_EVENT_MISSING | No structured event found; only final command rejection surfaced. |
| POST_ACTION_VERIFICATION_STARTED / PASSED / FAILED / REVIEW_REQUIRED | LOG_EVENT_MISSING | No structured event found; first action did not reach verifiable PAV in latest terminal log. |
| FORENSICS_RECORD_WRITE_REQUESTED | LOG_EVENT_MISSING | No structured event found. |
| FORENSICS_RECORD_WRITTEN | LOG_EVENT_MISSING | No structured event found. |
| STEP_TRANSITION_EVALUATED | LOG_EVENT_MISSING | No structured event found. |
| MISSION_FINALIZED / STOPPED / FAILED / REVIEW_REQUIRED | LOG_EVENT_MISSING | No terminal event; command rejection is the final visible state. |

## Adjacent Historical Runtime API Evidence

Live `/api/runtime/logs` contained older command attempts showing the same command lifecycle class:

```txt
eventType=MISSION_PREFLIGHT_PASSED status=success runId=null missionId=null mapId=tiktok.seeding-video.discovery.meta.v1 taskTemplateId=tiktok-seeding-video-discovery
eventType=COMMANDER_COMMAND_ENVELOPE_BUILT status=success reason="taskTemplateId resolved to requestedPlatformId=tiktok-web; selectedMapId=tiktok.seeding-video.discovery.meta.v1; activationSnapshotRef=activation-snapshot:c4c34629-8e33-4b29-89ab-fa9942ec9a6e:1.0.0:1.0.0"
eventType=COMMAND_REJECTED status=failed failureReason="open requires targetUrl or explicit targetProfileRef open-target-profile:open-tiktok; silent profile defaulting is forbidden"
```

This is not substituted for the latest run; it is used as adjacent proof that the mission loop can fail immediately at the first open step when target URL/profile propagation is incomplete.
