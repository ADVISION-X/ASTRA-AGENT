# Runtime Timeline

Phase: Runtime Log Blocker Mining & Root Cause Analysis  
Boundary: analysis only; no production, law, blueprint, inspector, or negative-proof code changed.

## Sources

- Latest real terminal log: docs/Codex提示词/终端日志复制.md
- Cross-check targets rejected as stale when they contradicted the latest log:
  - tmp/debug-loop/root-cause-analysis/blocker-list.md
  - tmp/debug-loop/root-cause-analysis/runtime-timeline.md
  - tmp/debug-loop/root-cause-analysis/current-runtime-log-snapshot.json
- Production code cross-check:
  - src/capabilities/orchestration/runtime/orchestration-nerve-bus-envelope-builders.ts
  - src/lib/local-runtime/workbench-ability-command-executor.ts
  - src/lib/local-runtime/workbench-action-dispatch-inputs.ts
  - src/capabilities/screenshot/runtime/screenshot-input-gate.ts
  - src/capabilities/orchestration/runtime/orchestration-loop-iteration-events.ts

## Reset From Stale Artifacts

Existing analysis files in this folder still described older blockers, but the latest real log disproves them as the current runtime stop point:

- The latest run does not show the old Commander accepted-then-timeout contradiction.
- The latest run does not show the old detect-safety-page review_required failure.
- The latest run shows both Facebook and TikTok missions reaching capture-video-viewport and failing there with screenshot input schema errors.

Current truth is therefore downstream in the screenshot dispatch/input chain.

## Startup Chain

| Event | Status | Evidence |
|---|---|---|
| dependency_check | PASS | dependency readiness passed |
| update_preflight_check | PASS | update preflight passed |
| map_package_readiness_check | PASS | builtin Facebook and TikTok map packages ready |
| local_ai_runtime_presence_check | PASS | local AI runtime presence passed |
| local_ai_model_roster_check | PASS | required model roster passed |
| local_ai_start_or_connect | PASS | local AI start/connect passed |
| local_ai_health_probe | PASS | local AI health probe passed |
| ai_capability_readiness_gate | PASS | AI capability readiness gate passed |
| port_clear | PASS | 127.0.0.1:4173 ready |
| app_server start | PASS | local app shell process started |
| APP_SHELL_HEALTH_CHECK_STARTED | PRESENT | waiting for health at /api/runtime/health |
| APP_SHELL_HEALTH_PASSED | PASS | Commander Console reachable |
| open_console | PASS | Commander Console opened via Google Chrome |
| mission_runtime_available | PASS | mission runtime available after startup gate |
| terminal_structured_log_relay | PASS | terminal structured log relay active |
| waiting_for_human_command | READY | startup completed and shell waits for operator input |

## Facebook Mission Chain

| Event | Status | Evidence / Notes |
|---|---|---|
| HUMAN_COMMAND_RECEIVED | LOG_EVENT_MISSING | Latest pasted terminal text jumps from waiting_for_human_command to Forensics write requests and HUMAN_COMMAND_VALIDATED. Not promoted to blocker in this phase because code and blueprint both still declare the event, but the latest pasted log alone does not localize the loss. |
| HUMAN_COMMAND_VALIDATED | PASS | requestedPlatformId=facebook-web; selectedMapId=facebook.seeding-video.discovery.meta.v1 |
| MISSION_READINESS_CHECK_STARTED | PRESENT | MissionReadiness is scoped to the selected task binding |
| MISSION_PREFLIGHT_STARTED | PRESENT | Mission preflight is checking readiness before command dispatch |
| MISSION_PREFLIGHT_PASSED | PASS | Commander Console can dispatch the governed human command |
| COMMANDER_COMMAND_ENVELOPE_BUILT | PASS | activationSnapshotRef=activation-snapshot:1aed09b9-262d-415c-982d-f415e5910c05:1.0.0:1.0.0 |
| NERVE_BUS_ENVELOPE_CREATED | PASS | governed envelope created for start-mission |
| NERVE_BUS_DISPATCH_STARTED | PRESENT | start-mission dispatched via CommandTransportPort |
| ORCHESTRATION_START_RECEIVED | PRESENT | Orchestration received governed start-mission command |
| MISSION_ACTIVATION_SNAPSHOT_FROZEN | PASS | activation snapshot frozen and non-null |
| COMMAND_ACCEPTED | PASS | command accepted before mission execution began |
| MAP_STEP_SELECTED open-facebook-reels | PASS | frozen map step selected |
| STEP_PRECONDITION_CHECKED open-facebook-reels | PASS | dispatch and loop guard checks passed |
| CAPABILITY_CALL_STARTED open-facebook-reels | LOG_EVENT_MISSING | Runtime emits STEP_DISPATCH_STARTED and later CAPABILITY_CALL_COMPLETED, but no explicit CAPABILITY_CALL_STARTED event appears in the latest log. Promoted to P1 blocker because code confirms no emitter exists. |
| STEP_DISPATCH_STARTED open-facebook-reels | PRESENT | dispatch to ability group open |
| CAPABILITY_CALL_COMPLETED open-facebook-reels | PASS | step returned success |
| POST_ACTION_VERIFICATION_STARTED verify-facebook-reels-open | PRESENT | governed verification dispatch logged |
| POST_ACTION_VERIFICATION_PASSED verify-facebook-reels-open | PASS | verification returned success |
| detect-login-state | PASS | CAPABILITY_CALL_COMPLETED success |
| detect-safety-page | PASS | CAPABILITY_CALL_COMPLETED success |
| detect-feed-ready | PASS | CAPABILITY_CALL_COMPLETED success |
| MAP_STEP_SELECTED capture-video-viewport | PASS | step selected from frozen operational map |
| STEP_PRECONDITION_CHECKED capture-video-viewport | PASS | dispatch and loop guard checks passed |
| STEP_DISPATCH_STARTED capture-video-viewport | PRESENT | dispatching step to ability group screenshot |
| CAPABILITY_CALL_FAILED capture-video-viewport | FAIL | missing required screenshot input fields: stepId, mapPackageId, mapPackageVersion, selectedMapId, selectedMapVersion, activationSnapshotRef, capabilityCallId, nerveBusEnvelopeId, inputRef |
| STEP_TRANSITION_EVALUATED capture-video-viewport:failed | PASS | failed branch matched |
| MISSION_FAILED | TERMINAL FAIL | mission reached terminal failed after capture-video-viewport |
| FORENSICS_RECORD_WRITE_REQUESTED | PRESENT | repeated throughout the chain |
| FORENSICS_RECORD_WRITTEN | LOG_EVENT_MISSING | Not promoted in this phase. Code and audit declare the event, but latest pasted terminal text does not show it and this phase does not re-run the live mission. |

## TikTok Mission Chain

The TikTok mission repeats the same topology with different selectedMapId and activationSnapshotRef:

- requestedPlatformId=tiktok-web
- selectedMapId=tiktok.seeding-video.discovery.meta.v1
- activationSnapshotRef=activation-snapshot:cdc353c6-9686-4d5c-aae0-d5f8572ab58f:1.0.0:1.0.0

Key terminal sequence:

| Event | Status | Evidence / Notes |
|---|---|---|
| HUMAN_COMMAND_VALIDATED | PASS | TikTok task binding resolved |
| MISSION_PREFLIGHT_PASSED | PASS | preflight passed |
| COMMAND_ACCEPTED | PASS | command accepted before mission execution |
| open-tiktok-feed | PASS | CAPABILITY_CALL_COMPLETED success |
| verify-tiktok-feed-open | PASS | POST_ACTION_VERIFICATION_PASSED success |
| detect-login-state | PASS | CAPABILITY_CALL_COMPLETED success |
| detect-safety-page | PASS | CAPABILITY_CALL_COMPLETED success |
| detect-feed-ready | PASS | CAPABILITY_CALL_COMPLETED success |
| capture-video-viewport STEP_DISPATCH_STARTED | PRESENT | screenshot dispatch starts |
| capture-video-viewport CAPABILITY_CALL_FAILED | FAIL | same missing screenshot chain fields as Facebook |
| MISSION_FAILED | TERMINAL FAIL | mission reached terminal failed after capture-video-viewport |

## Confirmed Blockers From Latest Real Log

1. P0: screenshot capture-video-viewport fails because screenshot ability input arrives without required chain fields.
2. P1: explicit CAPABILITY_CALL_STARTED lifecycle event is missing; operators must infer call start from STEP_DISPATCH_STARTED.

## Logged But Not Promoted In This Phase

These are real LOG_EVENT_MISSING observations in the latest pasted terminal excerpt, but they were not promoted to blockers because the latest log alone does not localize a production root cause strongly enough:

1. HUMAN_COMMAND_RECEIVED is absent from the pasted terminal text even though the local app shell code still records it and the structured logging blueprint requires it.
2. FORENSICS_RECORD_WRITTEN is absent from the pasted terminal text even though the Forensics write boundary code and audit declare it.

## Bottom Line

The current live stop point is no longer Commander or Page State. The latest real runtime reaches the screenshot step on both supported platforms and fails there because the local-runtime screenshot adapter drops governed chain fields before the screenshot ability input gate runs.