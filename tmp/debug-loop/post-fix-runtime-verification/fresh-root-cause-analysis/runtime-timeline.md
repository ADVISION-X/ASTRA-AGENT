# Fresh Runtime Timeline

Source log: `tmp/debug-loop/post-fix-runtime-verification/runtime-log.txt`

RunId: `2026-05-05T13:01:47.292Z`

## Timeline

- `dependency_check`: PASS after dependency runtime detection (`node=24.4.1`, `npm=11.4.2`).
- `update_preflight_check`: PASS.
- `map_package_readiness_check`: PASS for builtin Facebook and TikTok map packages.
- `local_ai_runtime_presence_check`: STARTED, then FAIL with `LOCAL_AI_READINESS_TIMEOUT`.
- `local_ai_model_roster_check`: STARTED, then PASS, but emitted with `failureReason=LOCAL_AI_READINESS_TIMEOUT` because model roles were known while runtime health was not ready.
- `local_ai_start_or_connect`: STARTED, then FAIL with `LOCAL_AI_READINESS_TIMEOUT`.
- `local_ai_health_probe`: STARTED, then FAIL with `LOCAL_AI_READINESS_TIMEOUT`.
- `ai_capability_readiness_gate`: FAIL with `LOCAL_AI_READINESS_TIMEOUT`.
- `startup_entrypoint bootstrap_failed`: FAIL; startup failure bundle written to `tmp/debug-loop/startup-failures/2026-05-05T13-01-47-292Z`.
- `SERVICE_STOP_REQUESTED`: app server stop requested.
- `SERVICE_SHUTDOWN_COMPLETED`: PASS.

## Missing Events

- `port_clear`: LOG_EVENT_MISSING. Reason: system did not execute past Local AI readiness gate.
- `app_server start`: LOG_EVENT_MISSING. Reason: system did not execute past Local AI readiness gate.
- `APP_SHELL_HEALTH_CHECK_STARTED`: LOG_EVENT_MISSING. Reason: app shell was never started.
- `APP_SHELL_HEALTH_PASSED`: LOG_EVENT_MISSING. Reason: app shell was never started.
- `open_console`: LOG_EVENT_MISSING. Reason: Commander Console was never opened.
- `mission_runtime_available`: LOG_EVENT_MISSING. Reason: startup correctly fail-closed before mission runtime.
- `terminal_structured_log_relay`: LOG_EVENT_MISSING. Reason: startup did not reach runtime relay.
- `waiting_for_human_command`: LOG_EVENT_MISSING. Reason: startup did not reach Commander wait state.
- All mission command and orchestration events: LOG_EVENT_MISSING. Reason: task trigger was forbidden after startup failure.
