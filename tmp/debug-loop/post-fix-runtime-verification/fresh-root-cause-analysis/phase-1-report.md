# Fresh Phase 1 Report

Status: `NEXT_DEBUG_LOOP_REQUIRED`

## Executive Summary

This fresh Phase-1 rerun was executed after a real production fix, owner-inspector hardening, a real restart through `npm run grasseye:start`, and a real governed `POST /api/tasks/start` command.

Confirmed outcomes:

- The original live blocker `prepare-ai-input proof requires scaleMapping` is no longer the first blocker for the current run.
- The repaired runtime now progresses past Screenshot `prepare-ai-input` proof refinement and reaches the stored-image source gate.
- The fresh terminal blocker for the current explicit run is now:
	- `Stored image source dimensions must match sourceProof dimensions.`
- The fresh current-run stop point is still `prepare-ai-input`, but at a deeper owner-local validation surface.
- Commander ingress proof completeness remains partially degraded: the explicit task-start response still carries `runtimeProof.missionId=null` and `runtimeProof.traceId=null`.

## Current Blockers

### P0

- Blocker ID: `BLOCKER-RUNTIME-2`
- First failing step: `prepare-ai-input`
- First terminal event:
	- `CAPABILITY_CALL_FAILED`
	- `failureReason=Stored image source dimensions must match sourceProof dimensions.`
- Terminal mission event:
	- `MISSION_FAILED`
	- `failureReason=Stored image source dimensions must match sourceProof dimensions.`
- Direct control surface:
	- `src/capabilities/screenshot/runtime/screenshot-stored-image-source-gate.ts`
- Nearest upstream writer likely responsible for bad `sourceProof.sourceWidth/sourceHeight`:
	- `src/lib/local-runtime/workbench-screenshot-source-handoff.ts`

### P1

- Blocker ID: `BLOCKER-LOG-1`
- Fresh evidence:
	- explicit `task-start-response.json` still shows commander `runtimeProof.missionId=null`
	- explicit `task-start-response.json` still shows commander `runtimeProof.traceId=null`
- Effect on current loop:
	- did not stop runtime progression after the P0 Screenshot repair
	- still fails the earlier commander ingress transparency expectation and remains open

## What Was Verified Retired

### BLOCKER-RUNTIME-1

Retired for the current run.

Evidence:

- current-run filtered timeline for `commander_command_2617c59a-8d8f-4f8c-bcf9-ee4e3502e19f` contains no `prepare-ai-input proof requires scaleMapping`
- fresh terminal/runtime failure for the same run is now the stored-image/sourceProof dimension mismatch
- owner-local negative proof for the repaired scaleMapping rule fails on mutation and passes after rollback

## Next-Loop Repair Order

1. Fix stored-image sourceProof dimension parity between Screenshot source gate and workbench source handoff.
2. Add Screenshot owner-local inspector coverage for stored-image sourceProof width/height parity and a matching negative proof mutation.
3. Re-run real restart and explicit task trigger to confirm the new Screenshot blocker is retired.
4. Repair Commander ingress proof completeness if `missionId` / `traceId` are still null after runtime unblocks.

## Evidence Set

- `tmp/debug-loop/post-fix-runtime-verification/task-start-response.json`
- `tmp/debug-loop/post-fix-runtime-verification/current-run-timeline-final.json`
- `tmp/debug-loop/post-fix-runtime-verification/runtime-logs-post-trigger-final.json`
- `tmp/debug-loop/post-fix-runtime-verification/fix-verification-summary.md`
- `tmp/debug-loop/regression-proofs/BLOCKER-RUNTIME-1/proof-summary.md`

## Final

NEXT_DEBUG_LOOP_REQUIRED
