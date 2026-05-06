# Runtime Timeline

- `2026-05-06T10:16:17.515Z` real `npm run grasseye:start` started.
- Startup passed: `dependency_check`, `update_preflight_check`, `map_package_readiness_check`, local AI readiness gates, `port_clear`, `app_server`, `APP_SHELL_HEALTH_PASSED`, `open_console`, `mission_runtime_available`, `terminal_structured_log_relay`, `waiting_for_human_command`.
- User-side task trigger used `POST /api/tasks/start` with `taskTemplateId=tiktok-seeding-video-discovery`.
- Command chain passed: `HUMAN_COMMAND_VALIDATED`, `MISSION_READINESS_CHECK_STARTED`, `MISSION_PREFLIGHT_STARTED`, `MISSION_PREFLIGHT_PASSED`, `COMMAND_ACCEPTED`, `COMMANDER_COMMAND_ENVELOPE_BUILT`, `NERVE_BUS_ENVELOPE_CREATED`, `NERVE_BUS_DISPATCH_STARTED`.
- Mission entered Orchestration and froze activation snapshot `activation-snapshot:3a8494dc-19f3-4d27-8d88-cf3f36564551:1.0.0:1.0.0`.
- `capture-video-viewport` completed successfully.
- `prepare-ai-input` was selected, dispatched to Screenshot, and failed with `prepare-ai-input proof requires scaleMapping`.
