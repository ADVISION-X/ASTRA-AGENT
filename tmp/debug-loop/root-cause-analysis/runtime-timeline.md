# GrassEye Phase 1 Runtime Timeline

Scope: user supplied terminal log from `npm run grasseye:start`, runId `2026-05-05T02:59:11.394Z`, plus current source/law/blueprint/audit inspection. No production, law, blueprint, or inspector files were modified.

## Startup Chain

```txt
[GRASSEYE][STARTUP][EVENT] bootstrap dependency_check started checking dependency readiness runId=2026-05-05T02:59:11.394Z
[GRASSEYE][STARTUP][EVENT] bootstrap dependency_runtime detected node=24.4.1 npm=11.4.2 runId=2026-05-05T02:59:11.394Z
[GRASSEYE][STARTUP][PASS] bootstrap dependency_check passed dependency readiness passed runId=2026-05-05T02:59:11.394Z durationMs=176
[GRASSEYE][STARTUP][EVENT] bootstrap update_preflight_check started no controlled update requested; validating update preflight runId=2026-05-05T02:59:11.394Z
[GRASSEYE][STARTUP][PASS] bootstrap update_preflight_check passed update preflight passed runId=2026-05-05T02:59:11.394Z durationMs=0
[GRASSEYE][MAP_PACKAGE][EVENT] map_package_readiness map_package_readiness_check started checking governed builtin map package readiness runId=2026-05-05T02:59:11.394Z
[GRASSEYE][MAP_PACKAGE][PASS] map_package_readiness map_package_readiness_check passed map package readiness passed before app shell start ownerResponsible=map-plugin-package runId=2026-05-05T02:59:11.394Z refs=packageId=builtin.facebook-seeding-video-discovery,packageId=builtin.tiktok-seeding-video-discovery durationMs=465
```

```txt
[GRASSEYE][AI][EVENT] local_ai_runtime local_ai_runtime_presence_check started checking local AI runtime presence runId=2026-05-05T02:59:11.394Z
[GRASSEYE][AI][EVENT] local_ai_runtime local_ai_model_roster_check started checking required local AI model roster runId=2026-05-05T02:59:11.394Z
[GRASSEYE][AI][EVENT] local_ai_runtime local_ai_start_or_connect started starting or connecting governed local AI runtime runId=2026-05-05T02:59:11.394Z
[GRASSEYE][AI][EVENT] local_ai_runtime local_ai_health_probe started probing governed local AI readiness runId=2026-05-05T02:59:11.394Z
[GRASSEYE][AI][PASS] local_ai_runtime local_ai_runtime_presence_check passed local AI runtime presence passed runId=2026-05-05T02:59:11.394Z refs=vision=ready:qwen2.5vl:3b,ocr=ready:apple-vision-or-paddleocr,commentUnderstanding=ready:qwen2.5:3b,productSignal=ready:qwen2.5:3b durationMs=241
[GRASSEYE][AI][PASS] local_ai_runtime local_ai_model_roster_check passed local AI model roster check passed runId=2026-05-05T02:59:11.394Z refs=vision=ready:qwen2.5vl:3b,ocr=ready:apple-vision-or-paddleocr,commentUnderstanding=ready:qwen2.5:3b,productSignal=ready:qwen2.5:3b durationMs=241
[GRASSEYE][AI][PASS] local_ai_runtime local_ai_start_or_connect passed local AI start/connect passed runId=2026-05-05T02:59:11.394Z refs=vision=ready:qwen2.5vl:3b,ocr=ready:apple-vision-or-paddleocr,commentUnderstanding=ready:qwen2.5:3b,productSignal=ready:qwen2.5:3b durationMs=241
[GRASSEYE][AI][PASS] local_ai_runtime local_ai_health_probe passed local AI health probe passed runId=2026-05-05T02:59:11.394Z refs=vision=ready:qwen2.5vl:3b,ocr=ready:apple-vision-or-paddleocr,commentUnderstanding=ready:qwen2.5:3b,productSignal=ready:qwen2.5:3b durationMs=241
[GRASSEYE][AI][PASS] local_ai_runtime ai_capability_readiness_gate passed AI capability readiness gate passed runId=2026-05-05T02:59:11.394Z refs=vision=ready:qwen2.5vl:3b,ocr=ready:apple-vision-or-paddleocr,commentUnderstanding=ready:qwen2.5:3b,productSignal=ready:qwen2.5:3b durationMs=241
```

```txt
[GRASSEYE][STARTUP][EVENT] bootstrap port_clear started clearing 127.0.0.1:4173 runId=2026-05-05T02:59:11.394Z
[GRASSEYE][STARTUP][PASS] bootstrap port_clear passed port 127.0.0.1:4173 is ready runId=2026-05-05T02:59:11.394Z durationMs=33
[GRASSEYE][SERVICE][EVENT] app_server app_server starting starting local app shell on http://127.0.0.1:4173 runId=2026-05-05T02:59:11.394Z
[GRASSEYE][SERVICE][PASS] app_server app_server ready local app shell process started for http://127.0.0.1:4173 runId=2026-05-05T02:59:11.394Z durationMs=1
[GRASSEYE][APP][EVENT] app_shell APP_SHELL_HEALTH_CHECK_STARTED started waiting for health at http://127.0.0.1:4173/api/runtime/health runId=2026-05-05T02:59:11.394Z
[GRASSEYE][SERVICE][EVENT] internal:app-server:dev stdout stream > grasseye-local-workbench@0.1.0 internal:app-server:dev
[GRASSEYE][SERVICE][EVENT] internal:app-server:dev stdout stream > tsx src/app/server.ts
[GRASSEYE][SERVICE][EVENT] internal:app-server:dev stdout stream GrassEye Commander Console shell listening on http://127.0.0.1:4173
[GRASSEYE][APP][PASS] app_shell APP_SHELL_HEALTH_PASSED passed Commander Console reachable at http://127.0.0.1:4173 runId=2026-05-05T02:59:11.394Z refs="components=4,contentType=text/html; charset=utf-8" durationMs=1110
[GRASSEYE][COMMANDER][EVENT] commander_console open_console_detail event Opened http://127.0.0.1:4173 in Google Chrome (/Applications/Google Chrome.app)
[GRASSEYE][COMMANDER][PASS] commander_console open_console passed opened Commander Console via Google Chrome runId=2026-05-05T02:59:11.394Z refs="browserPath=/Applications/Google Chrome.app"
[GRASSEYE][MISSION][PASS] mission_runtime mission_runtime_available passed mission runtime is available after startup gate passed runId=2026-05-05T02:59:11.394Z refs=vision=ready:qwen2.5vl:3b,ocr=ready:apple-vision-or-paddleocr,commentUnderstanding=ready:qwen2.5:3b,productSignal=ready:qwen2.5:3b
[GRASSEYE][RUNTIME][PASS] startup_entrypoint terminal_structured_log_relay ready terminal structured log relay active runId=2026-05-05T02:59:11.394Z refs=/api/runtime/logs,/api/runtime/actions,/api/runtime/mission-readiness
[GRASSEYE][RUNTIME][EVENT] startup_entrypoint waiting_for_human_command ready waiting for human command at http://127.0.0.1:4173 runId=2026-05-05T02:59:11.394Z
```

## Facebook Task Chain

```txt
[GRASSEYE][RUNTIME][PASS] runtime HUMAN_COMMAND_VALIDATED success requestedPlatformId=facebook-web; selectedMapId=facebook.seeding-video.discovery.meta.v1 refs=trace_ba03ebd9-6c7c-4e3e-b012-0e8b9919e2c5,attempt_7916201c-bc3a-4df0-8fc1-c1fe54fca0be,task_start
[GRASSEYE][RUNTIME][EVENT] runtime MISSION_READINESS_CHECK_STARTED started MissionReadiness is scoped to the selected task binding, not the app shell. refs=trace_ba03ebd9-6c7c-4e3e-b012-0e8b9919e2c5,attempt_7916201c-bc3a-4df0-8fc1-c1fe54fca0be,task_start
[GRASSEYE][RUNTIME][EVENT] runtime MISSION_PREFLIGHT_STARTED started Mission preflight is checking readiness before command dispatch. refs=trace_ba03ebd9-6c7c-4e3e-b012-0e8b9919e2c5,attempt_7916201c-bc3a-4df0-8fc1-c1fe54fca0be,task_start
[GRASSEYE][RUNTIME][PASS] runtime MISSION_PREFLIGHT_PASSED success Mission preflight passed. Commander Console can dispatch the governed human command. refs=trace_ba03ebd9-6c7c-4e3e-b012-0e8b9919e2c5,attempt_7916201c-bc3a-4df0-8fc1-c1fe54fca0be,task_start
[GRASSEYE][RUNTIME][PASS] runtime COMMANDER_COMMAND_ENVELOPE_BUILT success taskTemplateId resolved to requestedPlatformId=facebook-web; selectedMapId=facebook.seeding-video.discovery.meta.v1; activationSnapshotRef=activation-snapshot:e090cb41-1d0e-4c06-99f9-5d1f6693cfa1:1.0.0:1.0.0 refs=trace_ba03ebd9-6c7c-4e3e-b012-0e8b9919e2c5,attempt_7916201c-bc3a-4df0-8fc1-c1fe54fca0be,task_start
[GRASSEYE][RUNTIME][PASS] runtime NERVE_BUS_ENVELOPE_CREATED success Nerve Bus governed envelope created for start-mission. refs=commander_command_9cb93859-3d30-47af-9d89-baed35b0ced8,commander_command_9cb93859-3d30-47af-9d89-baed35b0ced8,task_start
[GRASSEYE][RUNTIME][EVENT] runtime NERVE_BUS_DISPATCH_STARTED started Dispatching start-mission via CommandTransportPort. refs=commander_command_9cb93859-3d30-47af-9d89-baed35b0ced8,commander_command_9cb93859-3d30-47af-9d89-baed35b0ced8,task_start
[GRASSEYE][RUNTIME][FAIL] runtime COMMAND_REJECTED failed COMMAND_REJECTED failureReason="[\n  {\n    \"code\": \"invalid_type\",\n    \"expected\": \"string\",\n    \"received\": \"null\",\n    \"path\": [\n      \"runId\"\n    ],\n    \"message\": \"Expected string, received null\"\n  }\n]" refs=trace_ba03ebd9-6c7c-4e3e-b012-0e8b9919e2c5,attempt_7916201c-bc3a-4df0-8fc1-c1fe54fca0be,task_start
```

## TikTok Task Chain

```txt
[GRASSEYE][RUNTIME][PASS] runtime HUMAN_COMMAND_VALIDATED success requestedPlatformId=tiktok-web; selectedMapId=tiktok.seeding-video.discovery.meta.v1 refs=trace_c650cbbe-4aa1-41aa-8fcf-bcd8741837e3,attempt_529b8306-c9cf-4010-85bc-4fa91d5b1ecc,task_start
[GRASSEYE][RUNTIME][EVENT] runtime MISSION_READINESS_CHECK_STARTED started MissionReadiness is scoped to the selected task binding, not the app shell. refs=trace_c650cbbe-4aa1-41aa-8fcf-bcd8741837e3,attempt_529b8306-c9cf-4010-85bc-4fa91d5b1ecc,task_start
[GRASSEYE][RUNTIME][EVENT] runtime MISSION_PREFLIGHT_STARTED started Mission preflight is checking readiness before command dispatch. refs=trace_c650cbbe-4aa1-41aa-8fcf-bcd8741837e3,attempt_529b8306-c9cf-4010-85bc-4fa91d5b1ecc,task_start
[GRASSEYE][RUNTIME][PASS] runtime MISSION_PREFLIGHT_PASSED success Mission preflight passed. Commander Console can dispatch the governed human command. refs=trace_c650cbbe-4aa1-41aa-8fcf-bcd8741837e3,attempt_529b8306-c9cf-4010-85bc-4fa91d5b1ecc,task_start
[GRASSEYE][RUNTIME][PASS] runtime COMMANDER_COMMAND_ENVELOPE_BUILT success taskTemplateId resolved to requestedPlatformId=tiktok-web; selectedMapId=tiktok.seeding-video.discovery.meta.v1; activationSnapshotRef=activation-snapshot:01ed033f-f4b9-4128-9b54-f2cb3d87fa10:1.0.0:1.0.0 refs=trace_c650cbbe-4aa1-41aa-8fcf-bcd8741837e3,attempt_529b8306-c9cf-4010-85bc-4fa91d5b1ecc,task_start
[GRASSEYE][RUNTIME][PASS] runtime NERVE_BUS_ENVELOPE_CREATED success Nerve Bus governed envelope created for start-mission. refs=commander_command_36628d81-0fbc-4baa-a692-392e6dadf4ec,commander_command_36628d81-0fbc-4baa-a692-392e6dadf4ec,task_start
[GRASSEYE][RUNTIME][EVENT] runtime NERVE_BUS_DISPATCH_STARTED started Dispatching start-mission via CommandTransportPort. refs=commander_command_36628d81-0fbc-4baa-a692-392e6dadf4ec,commander_command_36628d81-0fbc-4baa-a692-392e6dadf4ec,task_start
[GRASSEYE][RUNTIME][FAIL] runtime COMMAND_REJECTED failed COMMAND_REJECTED failureReason="[\n  {\n    \"code\": \"invalid_type\",\n    \"expected\": \"string\",\n    \"received\": \"null\",\n    \"path\": [\n      \"runId\"\n    ],\n    \"message\": \"Expected string, received null\"\n  }\n]" refs=trace_c650cbbe-4aa1-41aa-8fcf-bcd8741837e3,attempt_529b8306-c9cf-4010-85bc-4fa91d5b1ecc,task_start
```

## Required Event Coverage

| Required event | Observed | Classification |
|---|---:|---|
| startup dependency_check | YES | executed and structured |
| update_preflight_check | YES | executed and structured |
| local_ai_runtime_presence_check | YES | executed and structured |
| local_ai_model_roster_check | YES | executed and structured |
| local_ai_start_or_connect | YES | executed and structured |
| local_ai_health_probe | YES | executed and structured |
| ai_capability_readiness_gate | YES | executed and structured |
| app shell health | YES | executed and structured |
| commander console open | YES | executed and structured |
| mission_runtime_available | YES | executed and structured |
| HUMAN_COMMAND_RECEIVED | LOG_EVENT_MISSING | likely executed earlier in app shell but not present in terminal excerpt; runtime mirror may not relay draft/received event for this run |
| HUMAN_COMMAND_VALIDATED | YES | executed and structured |
| MISSION_READINESS_CHECK_STARTED | YES | executed and structured |
| MISSION_PREFLIGHT_STARTED | YES | executed and structured |
| MISSION_PREFLIGHT_PASSED / FAILED | YES: PASSED | preflight passed before command rejection |
| COMMANDER_COMMAND_ENVELOPE_BUILT | YES | executed and structured |
| NERVE_BUS_ENVELOPE_CREATED | YES | executed and structured |
| NERVE_BUS_DISPATCH_STARTED | YES | executed and structured |
| COMMAND_ACCEPTED / COMMAND_REJECTED | YES: REJECTED | rejected after dispatch with runId null schema failure |
| ORCHESTRATION_START_RECEIVED | LOG_EVENT_MISSING | system did not reach an accepted orchestration start, or start failed before this event was emitted |
| MISSION_ACTIVATION_SNAPSHOT_FROZEN | LOG_EVENT_MISSING | command rejected before mission state activation freeze was visible |
| MAP_STEP_SELECTED | LOG_EVENT_MISSING | command rejected before map execution |
| CAPABILITY_CALL_STARTED | LOG_EVENT_MISSING | command rejected before capability call |
| CAPABILITY_CALL_COMPLETED / FAILED / REVIEW_REQUIRED | LOG_EVENT_MISSING | no capability call reached |
| POST_ACTION_VERIFICATION_STARTED / PASSED / FAILED | LOG_EVENT_MISSING | no action step reached |
| FORENSICS_RECORD_WRITE_REQUESTED / WRITTEN | LOG_EVENT_MISSING | no forensics write event in current terminal chain |
| STEP_TRANSITION_EVALUATED | LOG_EVENT_MISSING | no map step transition reached |
| MISSION_FINALIZED / FAILED / REVIEW_REQUIRED / STOPPED | LOG_EVENT_MISSING | command rejected before mission lifecycle finalized |

