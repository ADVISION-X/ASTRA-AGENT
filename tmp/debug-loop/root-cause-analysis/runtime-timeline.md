# Runtime Timeline

Status: Phase 1 blocker set is confirmed from the latest full real terminal run, the local Forensics state store, the active governed map packages, the current production code paths, and the current inspector implementations.

## Primary Evidence Set

- Latest full real startup/task terminal run:
  - source: conversation transcript terminal notification for `npm run grasseye:start`
  - transcript file: `/Users/nexgen/Library/Application Support/Code/User/workspaceStorage/52fcb0a45da9d53d15815e6cdc89969b/GitHub.copilot-chat/transcripts/854f4c1e-dcf3-4761-8e43-6071aa24ca87.jsonl`
  - latest full block located by transcript grep output at line `1844`
  - startup runId: `2026-05-05T07:25:44.447Z`
- Local Forensics persistence store:
  - `/Users/nexgen/Library/Application Support/GrassEye/local-data/phase-04-full-enforcement/state.json`
  - grep confirmed `HUMAN_COMMAND_DRAFTED` at lines `27467` and `44123`
  - grep confirmed `HUMAN_COMMAND_RECEIVED` at lines `27571` and `44227`
  - grep found `structuredActionLogs` beginning at line `57926`
  - grep found no persisted matches for `POST_ACTION_VERIFICATION_STARTED`, `FORENSICS_RECORD_WRITE_REQUESTED`, or `FORENSICS_RECORD_WRITTEN`
- Active governed maps:
  - `src/map-plugins/builtins/facebook-seeding-video-discovery.meta.map-package.json`
  - `src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json`
- Production control paths used for root cause confirmation:
  - `src/lib/local-app-shell/task-start-binding.ts`
  - `src/lib/local-app-shell/task-start-flow.ts`
  - `src/lib/local-runtime/workbench-commander-command-transport.ts`
  - `src/lib/local-runtime/workbench-human-command.ts`
  - `src/lib/local-runtime/workbench-human-command-debug-events.ts`
  - `src/capabilities/orchestration/runtime/orchestration-executor-command-support.ts`
  - `src/capabilities/orchestration/runtime/orchestration-executor-loop-iteration.ts`
  - `src/capabilities/orchestration/runtime/loop-guard.ts`
  - `scripts/startup/launch-grasseye.mjs`
  - `scripts/startup/lib/service-process.mjs`

## Disconfirmed Older Hypotheses

- `HUMAN_COMMAND_DRAFTED` missing: false.
- `HUMAN_COMMAND_RECEIVED` missing: false.
- Structured action log producer absent: false.
- Empty map or finalize-only map selected: false.
- Startup readiness blocked mission start: false.

The older copied terminal file under `docs/Codex提示词/终端日志复制.md` is not complete enough to decide event absence by itself. The later full transcript run and the local Forensics state supersede it for presence/absence judgments.

## Latest Real Sequence

### 1. Startup passes

Observed in the latest real run:

```txt
dependency_check passed
update_preflight_check passed
map_package_readiness_check passed
local_ai_runtime_presence_check passed
local_ai_model_roster_check passed
local_ai_start_or_connect passed
local_ai_health_probe passed
ai_capability_readiness_gate passed
port_clear passed
app_server ready
APP_SHELL_HEALTH_PASSED
mission_runtime_available
terminal_structured_log_relay ready
waiting_for_human_command
```

Judgment: latest primary blockers are not dependency/bootstrap/app-shell readiness failures.

### 2. Human command chain is present

Observed in the same latest run:

```txt
HUMAN_COMMAND_DRAFTED
HUMAN_COMMAND_RECEIVED
HUMAN_COMMAND_VALIDATED
MISSION_READINESS_CHECK_STARTED
MISSION_PREFLIGHT_STARTED
MISSION_PREFLIGHT_PASSED
COMMANDER_COMMAND_ENVELOPE_BUILT
NERVE_BUS_ENVELOPE_CREATED
NERVE_BUS_DISPATCH_STARTED
```

Judgment: the command-entry chain is real and persisted. Older “command receipt missing” analysis is falsified.

### 3. Orchestration runs into the detect-safety-page stop condition

Observed in the same latest run:

```txt
ORCHESTRATION_START_RECEIVED
MAP_STEP_SELECTED open-facebook-reels
STEP_PRECONDITION_CHECKED success
STEP_DISPATCH_STARTED
CAPABILITY_CALL_COMPLETED success
STEP_TRANSITION_EVALUATED success

MAP_STEP_SELECTED verify-facebook-reels-open
STEP_PRECONDITION_CHECKED success
STEP_DISPATCH_STARTED
ACTION PASS open_target_page
POST_ACTION_VERIFICATION_PASSED
STEP_TRANSITION_EVALUATED success

MAP_STEP_SELECTED detect-login-state
STEP_PRECONDITION_CHECKED success
STEP_DISPATCH_STARTED
CAPABILITY_CALL_COMPLETED success
STEP_TRANSITION_EVALUATED success

MAP_STEP_SELECTED detect-safety-page
STEP_PRECONDITION_CHECKED failed: Loop guard prevented step "detect-safety-page" from dispatching
MISSION_FINALIZED success: terminal status "completed"
MISSION_ACTIVATION_SNAPSHOT_FROZEN success
COMMAND_ACCEPTED success
SERVICE_UNEXPECTED_EXIT failed: code 143
SERVICE_EXIT_CLASSIFICATION failed: code 143
```

Judgment: the latest run does not “disappear after accept”. It actually runs three steps, then stops incorrectly at `detect-safety-page`, logs terminal completion, logs two late commander-side boundary events, and finally classifies service exit `143` as failure.

## Negative Evidence From Latest Real Data

Confirmed absent from the persisted local Forensics store:

- `POST_ACTION_VERIFICATION_STARTED`
- `FORENSICS_RECORD_WRITE_REQUESTED`
- `FORENSICS_RECORD_WRITTEN`

Confirmed present in the persisted local Forensics store:

- `HUMAN_COMMAND_DRAFTED`
- `HUMAN_COMMAND_RECEIVED`
- `POST_ACTION_VERIFICATION_PASSED`
- `structuredActionLogs`

Judgment: the current transparency gap is narrower than the older draft analysis. Command-entry events and action logs exist. The missing events are the PAV start event and the explicit Forensics write-request/write-complete events.

## Timeline Verdict

Current blockers proven by the latest real run:

1. `maxRounds` is being consumed as a per-step budget, causing `detect-safety-page` to be loop-guard blocked and the mission to finalize as `completed` too early.
2. `MISSION_ACTIVATION_SNAPSHOT_FROZEN` is emitted after `MISSION_FINALIZED`, so the activation-snapshot event is chronologically false.
3. `COMMAND_ACCEPTED` is emitted after mission terminalization, so “accepted” currently means “the whole mission command call already finished”, not “transport accepted”.
4. `POST_ACTION_VERIFICATION_STARTED` is missing from real persisted proof.
5. `FORENSICS_RECORD_WRITE_REQUESTED` / `FORENSICS_RECORD_WRITTEN` are missing from real persisted proof.
6. Startup-entrypoint classifies post-ready service exit `143` as unexpected failure.