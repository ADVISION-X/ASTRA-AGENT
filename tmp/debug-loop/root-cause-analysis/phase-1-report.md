# GrassEye Phase 1 Report

Final status: `LOG_BLOCKER_ANALYSIS_READY`

No production source, law, blueprint, or inspector files were modified. This report updates only `tmp/debug-loop/root-cause-analysis/*`.

## Inputs Used

- User terminal log from `npm run grasseye:start`, runId `2026-05-05T02:59:11.394Z`.
- Current workspace source under `src/**`.
- Law files under `.github/instructions/cursor-rules/**`.
- Blueprints under `docs/法案辅助文件/**`.
- Audit scripts under `scripts/audit/**`.
- Current package scripts and git diff status.
- Existing runtime/debug artifacts under `.debug-loop/**` and `tmp/debug-loop/**`; current supplied terminal log is the authoritative runtime source for this analysis because the supplied run contains the latest reproduced blocker.

## Runtime Timeline Summary

Startup dependency check, update preflight, map package readiness, local AI readiness, app shell health, Commander Console open, mission runtime availability, terminal structured log relay, and waiting-for-human-command all passed.

Both Facebook and TikTok task starts followed the same chain:

```txt
HUMAN_COMMAND_VALIDATED
MISSION_READINESS_CHECK_STARTED
MISSION_PREFLIGHT_STARTED
MISSION_PREFLIGHT_PASSED
COMMANDER_COMMAND_ENVELOPE_BUILT
NERVE_BUS_ENVELOPE_CREATED
NERVE_BUS_DISPATCH_STARTED
COMMAND_REJECTED
```

Both rejected commands failed with:

```txt
"code": "invalid_type",
"expected": "string",
"received": "null",
"path": [
  "runId"
],
"message": "Expected string, received null"
```

## Blockers

1. P0: Mission preflight passes, Nerve Bus dispatch starts, then command rejects because `runId` is null.
2. P0: Mission preflight is too shallow for the selected command/result/proof contract.
3. P1: `COMMAND_REJECTED` terminal log lacks ownerResponsible, actionableMessage, and schema-owner fields.
4. P1: Downstream lifecycle/PAV/Forensics/final mission events are absent because the command rejects immediately after dispatch.

## Root Cause Highlights

- `src/capabilities/commander-console/runtime/commander-command-outcomes.ts:createTransportOutcome` materializes transport outcomes with `runId: null`.
- `src/capabilities/commander-console/shared/commander-result.ts:CommanderExecutionOutcome` permits nullable runId.
- `src/capabilities/commander-console/shared/commander-runtime-proof-schema.ts:RuntimeProofSchemaBase` allows nullable runId.
- `src/capabilities/orchestration/schema.ts:RuntimeProofSchema` omits runId.
- `src/capabilities/orchestration/runtime/orchestration-proof-builder.ts` has no runId input or proof identity field.
- `src/lib/local-app-shell/task-start-flow.ts` and `src/lib/local-runtime/workbench-status.ts` allow preflight to pass without validating the downstream command/result/proof contract.
- `src/lib/local-runtime/workbench-human-command.ts:handleHumanCommandEnvelope` propagates raw Zod failure as command rejection without enough owner/schema metadata.
- `src/lib/local-runtime/structured-log-terminal.ts` mirrors runtime events, but the rendered terminal rejection line lacks owner/actionable fields required for operator diagnosis.

## Enforcement Gap Summary

- Nerve Bus inspector checks local Nerve Bus source shape for runId, but not cross-owner symbol flow from Commander outcome and Orchestration proof.
- Commander inspector does not cover `createTransportOutcome` runId derivation or nullable Commander runtime proof.
- Orchestration inspector does not assert that runtime proof schema/builder carries runId.
- Structured logging inspector does not validate rendered terminal blocking-event payloads.
- Existing negative proofs do not mutate production code to force `runId:null` or missing terminal owner/actionable and then require audit failure.

## Priority Order

1. P0 `runId:null` after dispatch.
2. P0 readiness/preflight passed before command rejection.
3. P1 missing owner/actionable/schema owner in rejection logs.
4. P1 missing downstream lifecycle/PAV/Forensics/final events due to upstream rejection.

## Report Files

- `tmp/debug-loop/root-cause-analysis/runtime-timeline.md`
- `tmp/debug-loop/root-cause-analysis/blocker-list.md`
- `tmp/debug-loop/root-cause-analysis/law-blueprint-mapping.md`
- `tmp/debug-loop/root-cause-analysis/root-cause-matrix.md`
- `tmp/debug-loop/root-cause-analysis/enforcement-gap-matrix.md`
- `tmp/debug-loop/root-cause-analysis/phase-1-report.md`

LOG_BLOCKER_ANALYSIS_READY
