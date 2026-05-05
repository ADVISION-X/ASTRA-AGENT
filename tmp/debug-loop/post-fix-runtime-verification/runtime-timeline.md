# Post-Fix Runtime Timeline

## Startup

- `dependency_check`: PASS, `runId=2026-05-05T02:40:30.654Z`
- `update_preflight_check`: PASS
- `map_package_readiness_check`: PASS before app shell start, `ownerResponsible=map-plugin-package`, refs include `builtin.facebook-seeding-video-discovery` and `builtin.tiktok-seeding-video-discovery`
- `local_ai_runtime_presence_check`: PASS
- `local_ai_model_roster_check`: PASS
- `local_ai_start_or_connect`: PASS
- `local_ai_health_probe`: PASS
- `ai_capability_readiness_gate`: PASS
- `APP_SHELL_HEALTH_PASSED`: PASS
- `mission_runtime_available`: PASS

## Task Start

- `HUMAN_COMMAND_VALIDATED`: PASS for `requestedPlatformId=facebook-web`, `selectedMapId=facebook.seeding-video.discovery.meta.v1`
- `MISSION_READINESS_CHECK_STARTED`: logged
- `MISSION_PREFLIGHT_STARTED`: logged
- `MISSION_PREFLIGHT_PASSED`: PASS
- `COMMANDER_COMMAND_ENVELOPE_BUILT`: PASS with `activationSnapshotRef=activation-snapshot:d2eca47c-2050-41ea-bb4a-ab42c98dba59:1.0.0:1.0.0`
- `NERVE_BUS_ENVELOPE_CREATED`: PASS
- `NERVE_BUS_DISPATCH_STARTED`: logged
- Final task response: `review_required`, not `failed`; reason `issue-human-command timed out after 5000ms.`

## Accepted Review-Required Boundary

The post-fix scenario no longer fails for:

- builtin map package kind mismatch
- missing map package startup readiness gate
- missing `targetProfileRef`
- unrecognized `targetProfileRef` schema field
- silent target profile defaulting

The remaining runtime result is a guarded timeout review, with structured log fields:

- `ownerResponsible="Commander Console / Nerve Bus / Orchestration"`
- `actionableMessage="Open the review queue and inspect the guarded command result before retrying."`
- trace/attempt refs present in the terminal log
