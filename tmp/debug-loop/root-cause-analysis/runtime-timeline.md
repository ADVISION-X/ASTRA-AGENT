# Runtime Timeline - latest real terminal session

## Evidence priority

1. Primary runtime source: `tmp/debug-loop/post-fix-runtime-verification/runtime-log.txt`.
2. Contrast-only stale artifacts:
   - `tmp/debug-loop/root-cause-analysis/current-runtime-log-snapshot.json`
   - `tmp/debug-loop/root-cause-analysis/current-runtime-snapshot.json`
3. Coverage-only audit evidence: `tmp/debug-loop/regression-proofs/BLOCKER-4/inspector-fail-output.txt`.
4. Current production and audit code under `src/**` and `scripts/audit/**`.

## Session identity

- Local session time from the user report: around 2026-05-05 04:12.
- Startup runId carried in the saved raw terminal log: `2026-05-05T04:09:45.504Z`.
- Latest visible task-start chain: `facebook-web` + `facebook.seeding-video.discovery.meta.v1`.
- Blocking signature: `ORCHESTRATION_START_RECEIVED` was observed, then `MISSION_ACTIVATION_SNAPSHOT_FROZEN` failed with a nested Zod issue `path=["runId"]`, `expected=string`, `received=null`, then the command was rejected.

## Primary raw startup chain

```txt
[GRASSEYE][STARTUP][EVENT] bootstrap dependency_check started checking dependency readiness runId=2026-05-05T04:09:45.504Z
[GRASSEYE][STARTUP][EVENT] bootstrap dependency_runtime detected node=24.4.1 npm=11.4.2 runId=2026-05-05T04:09:45.504Z
[GRASSEYE][STARTUP][PASS] bootstrap dependency_check passed dependency readiness passed runId=2026-05-05T04:09:45.504Z durationMs=159
[GRASSEYE][STARTUP][EVENT] bootstrap update_preflight_check started no controlled update requested; validating update preflight runId=2026-05-05T04:09:45.504Z
[GRASSEYE][STARTUP][PASS] bootstrap update_preflight_check passed update preflight passed runId=2026-05-05T04:09:45.504Z durationMs=0
[GRASSEYE][MAP_PACKAGE][EVENT] map_package_readiness map_package_readiness_check started checking governed builtin map package readiness runId=2026-05-05T04:09:45.504Z
[GRASSEYE][MAP_PACKAGE][PASS] map_package_readiness map_package_readiness_check passed map package readiness passed before app shell start ownerResponsible=map-plugin-package runId=2026-05-05T04:09:45.504Z refs=packageId=builtin.facebook-seeding-video-discovery,packageId=builtin.tiktok-seeding-video-discovery durationMs=459
[GRASSEYE][AI][EVENT] local_ai_runtime local_ai_runtime_presence_check started checking local AI runtime presence runId=2026-05-05T04:09:45.504Z
[GRASSEYE][AI][EVENT] local_ai_runtime local_ai_model_roster_check started checking required local AI model roster runId=2026-05-05T04:09:45.504Z
[GRASSEYE][AI][EVENT] local_ai_runtime local_ai_start_or_connect started starting or connecting governed local AI runtime runId=2026-05-05T04:09:45.504Z
[GRASSEYE][AI][EVENT] local_ai_runtime local_ai_health_probe started probing governed local AI readiness runId=2026-05-05T04:09:45.504Z
[GRASSEYE][AI][PASS] local_ai_runtime local_ai_runtime_presence_check passed local AI runtime presence passed runId=2026-05-05T04:09:45.504Z refs=vision=ready:qwen2.5vl:3b,ocr=ready:apple-vision-or-paddleocr,commentUnderstanding=ready:qwen2.5:3b,productSignal=ready:qwen2.5:3b durationMs=299
[GRASSEYE][AI][PASS] local_ai_runtime local_ai_model_roster_check passed local AI model roster check passed runId=2026-05-05T04:09:45.504Z refs=vision=ready:qwen2.5vl:3b,ocr=ready:apple-vision-or-paddleocr,commentUnderstanding=ready:qwen2.5:3b,productSignal=ready:qwen2.5:3b durationMs=299
[GRASSEYE][AI][PASS] local_ai_runtime local_ai_start_or_connect passed local AI start/connect passed runId=2026-05-05T04:09:45.504Z refs=vision=ready:qwen2.5vl:3b,ocr=ready:apple-vision-or-paddleocr,commentUnderstanding=ready:qwen2.5:3b,productSignal=ready:qwen2.5:3b durationMs=299
[GRASSEYE][AI][PASS] local_ai_runtime local_ai_health_probe passed local AI health probe passed runId=2026-05-05T04:09:45.504Z refs=vision=ready:qwen2.5vl:3b,ocr=ready:apple-vision-or-paddleocr,commentUnderstanding=ready:qwen2.5:3b,productSignal=ready:qwen2.5:3b durationMs=299
[GRASSEYE][AI][PASS] local_ai_runtime ai_capability_readiness_gate passed AI capability readiness gate passed runId=2026-05-05T04:09:45.504Z refs=vision=ready:qwen2.5vl:3b,ocr=ready:apple-vision-or-paddleocr,commentUnderstanding=ready:qwen2.5:3b,productSignal=ready:qwen2.5:3b durationMs=299
[GRASSEYE][STARTUP][EVENT] bootstrap port_clear started clearing 127.0.0.1:4173 runId=2026-05-05T04:09:45.504Z
[GRASSEYE][STARTUP][EVENT] bootstrap port_clear_detail event Clearing listener(s) on 127.0.0.1:4173 (attempt 1/3). runId=2026-05-05T04:09:45.504Z
[GRASSEYE][STARTUP][EVENT] bootstrap port_clear_detail event Sent SIGTERM to listener PID 69877. runId=2026-05-05T04:09:45.504Z
[GRASSEYE][STARTUP][PASS] bootstrap port_clear passed port 127.0.0.1:4173 is ready runId=2026-05-05T04:09:45.504Z durationMs=564
[GRASSEYE][SERVICE][EVENT] app_server app_server starting starting local app shell on http://127.0.0.1:4173 runId=2026-05-05T04:09:45.504Z
[GRASSEYE][SERVICE][PASS] app_server app_server ready local app shell process started for http://127.0.0.1:4173 runId=2026-05-05T04:09:45.504Z durationMs=2
[GRASSEYE][APP][EVENT] app_shell APP_SHELL_HEALTH_CHECK_STARTED started waiting for health at http://127.0.0.1:4173/api/runtime/health runId=2026-05-05T04:09:45.504Z
[GRASSEYE][SERVICE][EVENT] internal:app-server:dev stdout stream > grasseye-local-workbench@0.1.0 internal:app-server:dev
[GRASSEYE][SERVICE][EVENT] internal:app-server:dev stdout stream > tsx src/app/server.ts
[GRASSEYE][SERVICE][EVENT] internal:app-server:dev stdout stream GrassEye Commander Console shell listening on http://127.0.0.1:4173
[GRASSEYE][APP][PASS] app_shell APP_SHELL_HEALTH_PASSED passed Commander Console reachable at http://127.0.0.1:4173 runId=2026-05-05T04:09:45.504Z refs="components=4,contentType=text/html; charset=utf-8" durationMs=1627
[GRASSEYE][COMMANDER][EVENT] commander_console open_console_detail event Opened http://127.0.0.1:4173 in Google Chrome (/Applications/Google Chrome.app)
[GRASSEYE][COMMANDER][PASS] commander_console open_console passed opened Commander Console via Google Chrome runId=2026-05-05T04:09:45.504Z refs="browserPath=/Applications/Google Chrome.app"
[GRASSEYE][MISSION][PASS] mission_runtime mission_runtime_available passed mission runtime is available after startup gate passed runId=2026-05-05T04:09:45.504Z refs=vision=ready:qwen2.5vl:3b,ocr=ready:apple-vision-or-paddleocr,commentUnderstanding=ready:qwen2.5:3b,productSignal=ready:qwen2.5:3b
[GRASSEYE][RUNTIME][PASS] startup_entrypoint terminal_structured_log_relay ready terminal structured log relay active runId=2026-05-05T04:09:45.504Z refs=/api/runtime/logs,/api/runtime/actions,/api/runtime/mission-readiness
[GRASSEYE][RUNTIME][EVENT] startup_entrypoint waiting_for_human_command ready waiting for human command at http://127.0.0.1:4173 runId=2026-05-05T04:09:45.504Z
```

## Primary raw task-start chain

```txt
[GRASSEYE][RUNTIME][PASS] runtime HUMAN_COMMAND_VALIDATED success requestedPlatformId=facebook-web; selectedMapId=facebook.seeding-video.discovery.meta.v1 ownerResponsible="Commander Console" actionableMessage="Run mission preflight before dispatching the governed human command." traceId=trace_7e641c3a-9ca2-4040-b710-ad0782104a78 runId=trace_7e641c3a-9ca2-4040-b710-ad0782104a78 selectedMapId=facebook.seeding-video.discovery.meta.v1 refs=trace_7e641c3a-9ca2-4040-b710-ad0782104a78,attempt_37797f99-1285-4d94-872b-9ccff13de06d,task_start
[GRASSEYE][RUNTIME][EVENT] runtime MISSION_READINESS_CHECK_STARTED started MissionReadiness is scoped to the selected task binding, not the app shell. ownerResponsible="Commander Console / Orchestration / Map Plugin Registry" actionableMessage="Check selected task map binding, browser, local AI, platform target, human goal, and run limits." traceId=trace_7e641c3a-9ca2-4040-b710-ad0782104a78 runId=trace_7e641c3a-9ca2-4040-b710-ad0782104a78 selectedMapId=facebook.seeding-video.discovery.meta.v1 refs=trace_7e641c3a-9ca2-4040-b710-ad0782104a78,attempt_37797f99-1285-4d94-872b-9ccff13de06d,task_start
[GRASSEYE][RUNTIME][EVENT] runtime MISSION_PREFLIGHT_STARTED started Mission preflight is checking readiness before command dispatch. ownerResponsible="Commander Console / Orchestration" actionableMessage="Verify browser session, local AI, map binding, and Forensics storage before mission start." traceId=trace_7e641c3a-9ca2-4040-b710-ad0782104a78 runId=trace_7e641c3a-9ca2-4040-b710-ad0782104a78 selectedMapId=facebook.seeding-video.discovery.meta.v1 refs=trace_7e641c3a-9ca2-4040-b710-ad0782104a78,attempt_37797f99-1285-4d94-872b-9ccff13de06d,task_start
[GRASSEYE][RUNTIME][PASS] runtime MISSION_PREFLIGHT_PASSED success Mission preflight passed. Commander Console can dispatch the governed human command. ownerResponsible="Commander Console / Nerve Bus" actionableMessage="Dispatch the governed human command through Commander Console and Nerve Bus." traceId=trace_7e641c3a-9ca2-4040-b710-ad0782104a78 runId=trace_7e641c3a-9ca2-4040-b710-ad0782104a78 selectedMapId=facebook.seeding-video.discovery.meta.v1 refs=trace_7e641c3a-9ca2-4040-b710-ad0782104a78,attempt_37797f99-1285-4d94-872b-9ccff13de06d,task_start
[GRASSEYE][RUNTIME][PASS] runtime COMMANDER_COMMAND_ENVELOPE_BUILT success taskTemplateId resolved to requestedPlatformId=facebook-web; selectedMapId=facebook.seeding-video.discovery.meta.v1; activationSnapshotRef=activation-snapshot:8eb45f5d-09d1-4fd3-b717-1f062abac7ea:1.0.0:1.0.0 ownerResponsible="Commander Console" actionableMessage="Send the governed command through CommandTransportPort and Nerve Bus." traceId=trace_7e641c3a-9ca2-4040-b710-ad0782104a78 runId=trace_7e641c3a-9ca2-4040-b710-ad0782104a78 selectedMapId=facebook.seeding-video.discovery.meta.v1 refs=trace_7e641c3a-9ca2-4040-b710-ad0782104a78,attempt_37797f99-1285-4d94-872b-9ccff13de06d,task_start
[GRASSEYE][RUNTIME][PASS] runtime NERVE_BUS_ENVELOPE_CREATED success Nerve Bus governed envelope created for start-mission. ownerResponsible="Commander Console / Nerve Bus" actionableMessage="Dispatch through Nerve Bus governed transport." traceId=commander_command_badff92f-01a1-4913-bb71-f553d8de8230 runId=commander_command_badff92f-01a1-4913-bb71-f553d8de8230 selectedMapId=facebook.seeding-video.discovery.meta.v1 refs=commander_command_badff92f-01a1-4913-bb71-f553d8de8230,commander_command_badff92f-01a1-4913-bb71-f553d8de8230,task_start
[GRASSEYE][RUNTIME][EVENT] runtime NERVE_BUS_DISPATCH_STARTED started Dispatching start-mission via CommandTransportPort. ownerResponsible="Nerve Bus" actionableMessage="Wait for governed result envelope and semantic gate validation." traceId=commander_command_badff92f-01a1-4913-bb71-f553d8de8230 runId=commander_command_badff92f-01a1-4913-bb71-f553d8de8230 selectedMapId=facebook.seeding-video.discovery.meta.v1 refs=commander_command_badff92f-01a1-4913-bb71-f553d8de8230,commander_command_badff92f-01a1-4913-bb71-f553d8de8230,task_start
[GRASSEYE][RUNTIME][EVENT] runtime ORCHESTRATION_START_RECEIVED started Orchestration received governed start-mission command from Nerve Bus. ownerResponsible=Orchestration actionableMessage="Freeze activation snapshot and select the governed operational map." traceId=commander_command_badff92f-01a1-4913-bb71-f553d8de8230:facebook.seeding-video.discovery.meta.v1:commander_command_badff92f-01a1-4913-bb71-f553d8de8230:run runId=commander_command_badff92f-01a1-4913-bb71-f553d8de8230:run selectedMapId=facebook.seeding-video.discovery.meta.v1 refs=commander_command_badff92f-01a1-4913-bb71-f553d8de8230:facebook.seeding-video.discovery.meta.v1:commander_command_badff92f-01a1-4913-bb71-f553d8de8230:run,commander-console:commander_command_badff92f-01a1-4913-bb71-f553d8de8230:attempt:1,task_start
[GRASSEYE][RUNTIME][FAIL] runtime MISSION_ACTIVATION_SNAPSHOT_FROZEN failed Mission start completed without a frozen activation snapshot. failureReason="[\n  {\n    \"code\": \"invalid_type\",\n    \"expected\": \"string\",\n    \"received\": \"null\",\n    \"path\": [\n      \"runId\"\n    ],\n    \"message\": \"Expected string, received null\"\n  }\n]" ownerResponsible="Orchestration / Map Plugin Registry" actionableMessage="Inspect Orchestration map selection and activation snapshot proof before retrying." traceId=commander_command_badff92f-01a1-4913-bb71-f553d8de8230:facebook.seeding-video.discovery.meta.v1:commander_command_badff92f-01a1-4913-bb71-f553d8de8230:run runId=commander_command_badff92f-01a1-4913-bb71-f553d8de8230:run selectedMapId=facebook.seeding-video.discovery.meta.v1 refs=commander_command_badff92f-01a1-4913-bb71-f553d8de8230:facebook.seeding-video.discovery.meta.v1:commander_command_badff92f-01a1-4913-bb71-f553d8de8230:run,commander-console:commander_command_badff92f-01a1-4913-bb71-f553d8de8230:attempt:1,task_start
[GRASSEYE][RUNTIME][FAIL] runtime COMMAND_REJECTED failed COMMAND_REJECTED failureReason="[\n  {\n    \"code\": \"invalid_type\",\n    \"expected\": \"string\",\n    \"received\": \"null\",\n    \"path\": [\n      \"runId\"\n    ],\n    \"message\": \"Expected string, received null\"\n  }\n]" ownerResponsible="Commander Console / Nerve Bus / Orchestration" actionableMessage="Inspect the latest debug bundle and fix the blocking dependency before retrying." traceId=trace_7e641c3a-9ca2-4040-b710-ad0782104a78 runId=commander_command_badff92f-01a1-4913-bb71-f553d8de8230:run selectedMapId=facebook.seeding-video.discovery.meta.v1 refs=trace_7e641c3a-9ca2-4040-b710-ad0782104a78,attempt_37797f99-1285-4d94-872b-9ccff13de06d,task_start
```

## Contrast-only stale stored artifacts

The stored 03:04 and 03:28 artifacts do not describe the latest authoritative chain and must not be treated as primary truth for this phase.

```json
{
  "eventType": "MISSION_PREFLIGHT_PASSED",
  "createdAt": "2026-05-05T03:04:50.936Z",
  "traceId": "trace_78089910-c8b7-4b62-bd52-913bdaa77d97",
  "runId": null,
  "mapId": "tiktok.seeding-video.discovery.meta.v1",
  "refs": []
}
```

```json
{
  "mission": { "status": "idle", "missionId": null },
  "failedRecords": [
    {
      "primary": "COMMAND_REJECTED",
      "secondary": "task_start",
      "detail": "Expected string, received null at path runId"
    }
  ]
}
```

Key contradiction:

- Latest raw terminal log: non-null `runId` survives `HUMAN_COMMAND_VALIDATED -> MISSION_PREFLIGHT_PASSED -> COMMANDER_COMMAND_ENVELOPE_BUILT -> NERVE_BUS_ENVELOPE_CREATED -> ORCHESTRATION_START_RECEIVED`.
- Stale `current-runtime-log-snapshot.json`: earlier stored debug rows already show `runId: null` at Commander-side events and empty refs.
- Conclusion: stored repo snapshots are historical corroboration only. The latest root-cause analysis must anchor on the raw terminal log, not the old snapshot files.

## Required event coverage

| Required event | Observed | Assessment |
|---|---:|---|
| dependency_check | YES | executed and passed |
| update_preflight_check | YES | executed and passed |
| map_package_readiness_check | YES | executed and passed |
| local_ai_runtime_presence_check | YES | executed and passed |
| local_ai_model_roster_check | YES | executed and passed |
| local_ai_start_or_connect | YES | executed and passed |
| local_ai_health_probe | YES | executed and passed |
| ai_capability_readiness_gate | YES | executed and passed |
| port_clear | YES | executed and passed |
| app_server start | YES | executed and passed |
| APP_SHELL_HEALTH_CHECK_STARTED | YES | observed |
| APP_SHELL_HEALTH_PASSED | YES | observed |
| open_console | YES | observed |
| mission_runtime_available | YES | observed |
| terminal_structured_log_relay | YES | observed |
| HUMAN_COMMAND_RECEIVED | LOG_EVENT_MISSING | latest saved terminal excerpt starts at `HUMAN_COMMAND_VALIDATED`; no visible structured runtime line for the receive boundary |
| HUMAN_COMMAND_VALIDATED | YES | observed |
| MISSION_READINESS_CHECK_STARTED | YES | observed |
| MISSION_PREFLIGHT_STARTED | YES | observed |
| MISSION_PREFLIGHT_PASSED / FAILED | YES | passed |
| COMMANDER_COMMAND_ENVELOPE_BUILT | YES | observed |
| NERVE_BUS_ENVELOPE_CREATED | YES | observed |
| NERVE_BUS_DISPATCH_STARTED | YES | observed |
| COMMAND_ACCEPTED / COMMAND_REJECTED | YES | `COMMAND_REJECTED` observed |
| ORCHESTRATION_START_RECEIVED | YES | observed |
| MISSION_ACTIVATION_SNAPSHOT_FROZEN | YES | observed as failed |
| MAP_STEP_SELECTED | LOG_EVENT_MISSING | mission loop never advanced beyond activation snapshot failure |
| STEP_PRECONDITION_CHECKED | LOG_EVENT_MISSING | mission loop never advanced beyond activation snapshot failure |
| CAPABILITY_CALL_STARTED | LOG_EVENT_MISSING | mission loop never advanced beyond activation snapshot failure |
| CAPABILITY_CALL_COMPLETED / FAILED / REVIEW_REQUIRED | LOG_EVENT_MISSING | mission loop never advanced beyond activation snapshot failure |
| POST_ACTION_VERIFICATION_STARTED / PASSED / FAILED / REVIEW_REQUIRED | LOG_EVENT_MISSING | mission loop never advanced beyond activation snapshot failure |
| FORENSICS_RECORD_WRITE_REQUESTED | LOG_EVENT_MISSING | latest terminal relay does not expose a corresponding structured runtime line |
| FORENSICS_RECORD_WRITTEN | LOG_EVENT_MISSING | latest terminal relay does not expose a corresponding structured runtime line |
| STEP_TRANSITION_EVALUATED | LOG_EVENT_MISSING | mission loop never advanced beyond activation snapshot failure |
| MISSION_FINALIZED / STOPPED / FAILED / REVIEW_REQUIRED | LOG_EVENT_MISSING | command was rejected before the governed mission loop reached finalization or review closure |
