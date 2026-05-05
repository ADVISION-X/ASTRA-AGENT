# Runtime Timeline

Source set:
- User-provided terminal log from `npm run grasseye:start` on 2026-05-05.
- Latest local debug-loop bundle found at `.debug-loop/runs/debug-2026-05-03T20-30-49-789Z/iteration-001/`.
- Source files inspected read-only. No source/law/blueprint/inspector edits were made.

## Observed Startup Chain

```txt
[GRASSEYE][STARTUP][EVENT] bootstrap dependency_check started checking dependency readiness
[GRASSEYE][STARTUP][EVENT] bootstrap dependency_runtime detected node=24.4.1 npm=11.4.2
[GRASSEYE][STARTUP][PASS] bootstrap dependency_check passed dependency readiness passed durationMs=158
[GRASSEYE][STARTUP][EVENT] bootstrap update_preflight_check started no controlled update requested; validating update preflight
[GRASSEYE][STARTUP][PASS] bootstrap update_preflight_check passed update preflight passed durationMs=0
[GRASSEYE][AI][EVENT] local_ai_runtime local_ai_runtime_presence_check started checking local AI runtime presence
[GRASSEYE][AI][EVENT] local_ai_runtime local_ai_model_roster_check started checking required local AI model roster
[GRASSEYE][AI][EVENT] local_ai_runtime local_ai_start_or_connect started starting or connecting governed local AI runtime
[GRASSEYE][AI][EVENT] local_ai_runtime local_ai_health_probe started probing governed local AI readiness
[GRASSEYE][AI][PASS] local_ai_runtime local_ai_runtime_presence_check passed local AI runtime presence passed refs=vision=ready:qwen2.5vl:3b,ocr=ready:apple-vision-or-paddleocr,commentUnderstanding=ready:qwen2.5:3b,productSignal=ready:qwen2.5:3b durationMs=235
[GRASSEYE][AI][PASS] local_ai_runtime local_ai_model_roster_check passed local AI model roster check passed refs=vision=ready:qwen2.5vl:3b,ocr=ready:apple-vision-or-paddleocr,commentUnderstanding=ready:qwen2.5:3b,productSignal=ready:qwen2.5:3b durationMs=235
[GRASSEYE][AI][PASS] local_ai_runtime local_ai_start_or_connect passed local AI start/connect passed refs=vision=ready:qwen2.5vl:3b,ocr=ready:apple-vision-or-paddleocr,commentUnderstanding=ready:qwen2.5:3b,productSignal=ready:qwen2.5:3b durationMs=235
[GRASSEYE][AI][PASS] local_ai_runtime local_ai_health_probe passed local AI health probe passed refs=vision=ready:qwen2.5vl:3b,ocr=ready:apple-vision-or-paddleocr,commentUnderstanding=ready:qwen2.5:3b,productSignal=ready:qwen2.5:3b durationMs=235
[GRASSEYE][AI][PASS] local_ai_runtime ai_capability_readiness_gate passed AI capability readiness gate passed refs=vision=ready:qwen2.5vl:3b,ocr=ready:apple-vision-or-paddleocr,commentUnderstanding=ready:qwen2.5:3b,productSignal=ready:qwen2.5:3b durationMs=235
[GRASSEYE][STARTUP][EVENT] bootstrap port_clear started clearing 127.0.0.1:4173
[GRASSEYE][STARTUP][PASS] bootstrap port_clear passed port 127.0.0.1:4173 is ready durationMs=37
[GRASSEYE][SERVICE][EVENT] app_server app_server starting starting local app shell on http://127.0.0.1:4173
[GRASSEYE][SERVICE][PASS] app_server app_server ready local app shell process started for http://127.0.0.1:4173 durationMs=1
[GRASSEYE][APP][EVENT] app_shell APP_SHELL_HEALTH_CHECK_STARTED started waiting for health at http://127.0.0.1:4173/api/runtime/health
[GRASSEYE][SERVICE][EVENT] internal:app-server:dev stdout stream > grasseye-local-workbench@0.1.0 internal:app-server:dev
[GRASSEYE][SERVICE][EVENT] internal:app-server:dev stdout stream > tsx src/app/server.ts
```

## Fatal Event

```txt
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed ZodError: [
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed "received": "child-capability-package", failureReason="\"received\": \"child-capability-package\","
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed "code": "invalid_literal", failureReason="\"code\": \"invalid_literal\","
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed "expected": "operational-map-package", failureReason="\"expected\": \"operational-map-package\","
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed "path": [
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed "manifest",
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed "packageKind"
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed "message": "Invalid literal value, expected \"operational-map-package\""
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed at readBuiltin (/Users/nexgen/Documents/GrassEye -AI-AGENT/src/map-plugins/builtins/index.ts:8:27)
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed at loadBuiltinMapPackages (/Users/nexgen/Documents/GrassEye -AI-AGENT/src/map-plugins/builtins/index.ts:14:5)
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed at seedBuiltinDevelopmentActivation (/Users/nexgen/Documents/GrassEye -AI-AGENT/src/map-plugins/registry/map-plugin-registry.ts:106:32)
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed at createBuiltinSeededRegistry (/Users/nexgen/Documents/GrassEye -AI-AGENT/src/map-plugins/registry/map-plugin-registry.ts:140:5)
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed at getDevelopmentMapPluginRegistry (/Users/nexgen/Documents/GrassEye -AI-AGENT/src/map-plugins/registry/map-plugin-registry.ts:165:20)
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed at createDefaultOrchestrationMapStore (/Users/nexgen/Documents/GrassEye -AI-AGENT/src/capabilities/orchestration/runtime/orchestration-default-map-store.ts:5:39)
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed at createOrchestrationAbilityGroup (/Users/nexgen/Documents/GrassEye -AI-AGENT/src/capabilities/orchestration/ability-group.ts:95:65)
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed at createWorkbenchOrchestration (/Users/nexgen/Documents/GrassEye -AI-AGENT/src/lib/local-runtime/workbench-orchestration.ts:5:3)
[GRASSEYE][STARTUP][FAIL] startup_entrypoint bootstrap_failed failed startup bootstrap failed failureReason="Local service exited before health check passed with code 1."
[GRASSEYE][SERVICE][EVENT] app_server SERVICE_STOP_REQUESTED started stopping local service with SIGTERM
[GRASSEYE][SERVICE][PASS] app_server SERVICE_SHUTDOWN_COMPLETED passed local service stopped with SIGTERM
```

## Required Event Coverage

| Event | Status | Reason |
| --- | --- | --- |
| startup dependency_check | OBSERVED_PASS | Startup reached dependency gate and passed. |
| update_preflight_check | OBSERVED_PASS_TOO_BROAD | Only controlled dependency update preflight ran; no map package schema/lifecycle preflight observed. |
| local_ai_runtime_presence_check | OBSERVED_PASS | AI runtime presence passed. |
| local_ai_model_roster_check | OBSERVED_PASS | Required local model roster passed. |
| local_ai_start_or_connect | OBSERVED_PASS | Local AI runtime start/connect passed. |
| local_ai_health_probe | OBSERVED_PASS | Local AI health probe passed. |
| ai_capability_readiness_gate | OBSERVED_PASS | AI capability readiness gate passed. |
| app shell health | OBSERVED_STARTED_THEN_FAILED | Health check started; service exited before health passed. |
| commander console open | LOG_EVENT_MISSING | System did not execute to this stage because app shell failed before health passed. |
| mission_runtime_available | LOG_EVENT_MISSING | System did not execute to this stage because `verifyAppHealth` threw before `markMissionRuntimeAvailable`. |
| HUMAN_COMMAND_RECEIVED / HUMAN_COMMAND_VALIDATED | LOG_EVENT_MISSING | System did not execute to command input stage. |
| MISSION_READINESS_CHECK_STARTED | LOG_EVENT_MISSING | System did not execute to mission readiness API stage. |
| MISSION_PREFLIGHT_STARTED | LOG_EVENT_MISSING | System did not execute to mission preflight stage. |
| MISSION_PREFLIGHT_PASSED / FAILED | LOG_EVENT_MISSING | System did not execute to mission preflight stage. |
| COMMANDER_COMMAND_ENVELOPE_BUILT | LOG_EVENT_MISSING | System did not execute to command envelope build. |
| NERVE_BUS_ENVELOPE_CREATED | LOG_EVENT_MISSING | System did not execute to Nerve Bus dispatch. |
| NERVE_BUS_DISPATCH_STARTED | LOG_EVENT_MISSING | System did not execute to Nerve Bus dispatch. |
| COMMAND_ACCEPTED / COMMAND_REJECTED | LOG_EVENT_MISSING | System did not execute to command semantic gate. |
| ORCHESTRATION_START_RECEIVED | LOG_EVENT_MISSING | System did not execute to Orchestration start. |
| MISSION_ACTIVATION_SNAPSHOT_FROZEN | LOG_EVENT_MISSING | System did not execute to mission activation. |
| MAP_STEP_SELECTED | LOG_EVENT_MISSING | System did not execute to map step selection. |
| CAPABILITY_CALL_STARTED | LOG_EVENT_MISSING | System did not execute to capability call. |
| CAPABILITY_CALL_COMPLETED / FAILED / REVIEW_REQUIRED | LOG_EVENT_MISSING | System did not execute to capability call. |
| POST_ACTION_VERIFICATION_STARTED / PASSED / FAILED | LOG_EVENT_MISSING | System did not execute to PAV. |
| FORENSICS_RECORD_WRITE_REQUESTED / WRITTEN | LOG_EVENT_MISSING | System did not execute to forensics write. |
| STEP_TRANSITION_EVALUATED | LOG_EVENT_MISSING | System did not execute to transition evaluation. |
| MISSION_FINALIZED / FAILED / REVIEW_REQUIRED / STOPPED | LOG_EVENT_MISSING | System did not execute to mission finalization. |

## Debug Bundle Correlation

Latest debug bundle is not the same failure:

```txt
.debug-loop/runs/debug-2026-05-03T20-30-49-789Z/iteration-001/stdout.log
{
  "status": "PASS",
  "scenarioId": "facebook-auth-check",
  "successSignals": [
    "authStatus=AUTH_OK",
    "pageState=platform_ready"
  ],
  "blockingSignals": [],
  "runtimeEvents": [],
  "rootCause": null,
  "command": {
    "command": "/opt/homebrew/Cellar/node/24.4.1/bin/node",
    "exitCode": 0,
    "timedOut": false,
    "failureReason": null
  }
}
```

Decision: current startup failure is evidenced by the user-provided terminal log, not by the latest debug-loop bundle. The latest bundle is stale/unrelated for this blocker.
