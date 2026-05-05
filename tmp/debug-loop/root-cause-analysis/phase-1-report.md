# GrassEye Phase 1 - Runtime Log Blocker Mining & Root Cause Analysis

Final status: `LOG_BLOCKER_ANALYSIS_READY`

## Inputs used

1. Latest saved real terminal log: `tmp/debug-loop/post-fix-runtime-verification/runtime-log.txt`.
2. Contrast-only stored artifacts:
   - `tmp/debug-loop/root-cause-analysis/current-runtime-log-snapshot.json`
   - `tmp/debug-loop/root-cause-analysis/current-runtime-snapshot.json`
3. Audit output: `tmp/debug-loop/regression-proofs/BLOCKER-4/inspector-fail-output.txt`.
4. Law files under `.github/instructions/cursor-rules/**`.
5. Blueprints under `docs/法案辅助文件/**`.
6. Audit scripts under `scripts/audit/**`.
7. Production code under `src/**`.

## Evidence separation

This phase uses a strict evidence priority:

1. The authoritative runtime chain is the latest real terminal session captured in `tmp/debug-loop/post-fix-runtime-verification/runtime-log.txt`.
2. The stored `current-runtime-log-snapshot.json` and `current-runtime-snapshot.json` are historical corroboration only. They are not the latest truth because they conflict with the raw terminal session and represent older 03:04 / 03:28 state.
3. Current worktree hardening under `src/**` and `scripts/audit/**` is treated as in-flight mitigation context, not as proof that the live blocker is resolved.

## Timeline

See `tmp/debug-loop/root-cause-analysis/runtime-timeline.md`.

## Blockers

See `tmp/debug-loop/root-cause-analysis/blocker-list.md`.

Priority order:

1. `P0` - `ORCHESTRATION_START_RECEIVED` already happened, but `MISSION_ACTIVATION_SNAPSHOT_FROZEN` failed because a deeper object still exposed `runId=null`.
2. `P0` - `MISSION_PREFLIGHT_PASSED` happened before the actual failing contract was fully proven.
3. `P1` - persisted runtime/debug evidence is stale or under-linked, so logs alone cannot localize the nested null source.
4. `P1` - owner-local enforcement is being hardened in the current worktree, but there is no fresh real rerun proving the live blocker is already machine-blocked.

## Key root-cause conclusion

The primary blocker is no longer a startup problem. Startup, map readiness, AI readiness, app shell health, console opening, and mission runtime availability all passed.

The latest authoritative runtime chain is:

```txt
HUMAN_COMMAND_VALIDATED
-> MISSION_READINESS_CHECK_STARTED
-> MISSION_PREFLIGHT_STARTED
-> MISSION_PREFLIGHT_PASSED
-> COMMANDER_COMMAND_ENVELOPE_BUILT
-> NERVE_BUS_ENVELOPE_CREATED
-> NERVE_BUS_DISPATCH_STARTED
-> ORCHESTRATION_START_RECEIVED
-> MISSION_ACTIVATION_SNAPSHOT_FROZEN failed(path=runId/null)
-> COMMAND_REJECTED
```

This matters because it falsifies the older repository narrative that `runId` was already lost on the Commander side before Orchestration start.

Current code inspection shows:

- `src/lib/local-runtime/workbench-human-command.ts` passes `envelope.runId` into `startMission(...)`.
- `src/capabilities/orchestration/runtime/orchestration-executor-command-support.ts` sets `activeTaskRunId: command.runId` in the initial mission state.
- `src/capabilities/orchestration/runtime/orchestration-proof-builder.ts` emits `runId: input.runId` into the runtime proof.
- `src/capabilities/orchestration/schema.ts` requires non-null `runId` on both `MissionCommandSchema` and `RuntimeProofSchema`.

Therefore this phase can conclude, without guessing, that:

1. The latest live failure does not prove a Commander-side boundary drop before Orchestration start.
2. The null is now narrowed to a deeper nested object inside the Orchestration activation-snapshot / result / proof path, or to a code state older than the current dirty worktree hardening.
3. The current logs still do not surface that exact failing nested object. That observability gap is itself an active blocker.

## Law / blueprint mapping

See `tmp/debug-loop/root-cause-analysis/law-blueprint-mapping.md`.

## Root-cause matrix

See `tmp/debug-loop/root-cause-analysis/root-cause-matrix.md`.

## Enforcement-gap matrix

See `tmp/debug-loop/root-cause-analysis/enforcement-gap-matrix.md`.

## Analysis boundaries

- No production source code was modified in this phase.
- No law files were modified in this phase.
- No blueprint files were modified in this phase.
- No inspector files were modified in this phase.
- No repair patch was generated in this phase.
- Only the analysis markdown files under `tmp/debug-loop/root-cause-analysis/` were rewritten.

## Final determination

All required phase-1 analysis artifacts are now rebuilt around the latest authoritative real runtime chain, with stale stored artifacts explicitly separated from current worktree hardening.

`LOG_BLOCKER_ANALYSIS_READY`