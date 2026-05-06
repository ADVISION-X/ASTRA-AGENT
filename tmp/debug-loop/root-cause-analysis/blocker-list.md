# Blocker List

Phase: Runtime Log Blocker Mining & Root Cause Analysis
Boundary: analysis only; no production code, law, blueprint, inspector, or negative-proof harness was changed.

## Evidence Precedence

1. Authoritative runtime evidence:
   - `tmp/debug-loop/post-fix-runtime-verification/runtime-log.txt`
   - `tmp/debug-loop/post-fix-runtime-verification/runtime-logs-api.json`
   - `tmp/debug-loop/post-fix-runtime-verification/task-trigger-summary.md`
   - `tmp/debug-loop/post-fix-runtime-verification/task-start-response-current-tiktok.json`
2. Supporting command-proof corroboration only:
   - `tmp/debug-loop/post-fix-runtime-verification/task-start-response-current-facebook.json`
3. Historical / non-authoritative only:
   - older markdown already present in this folder
   - older mixed snapshots in the same verification bundle

## P0 Confirmed

### BLOCKER-RUNTIME-1: Screenshot `prepare-ai-input` failed-path proof is schema-invalid because `scaleMapping` is enforced unconditionally

Priority: P0

Affected latest real mission:

- `tiktok-seeding-video-discovery`
- `selectedMapId=tiktok.seeding-video.discovery.meta.v1`
- authoritative failed run: `commander_command_9412137b-5123-45ef-bf1d-23c550b4dfba:run`

Repeated within the same verification bundle:

- `commander_command_89508c2b-4391-4f44-a98f-766f0c6ce39a:run`

Latest runtime evidence:

- `capture-video-viewport` completed successfully.
- Orchestration then selected `prepare-ai-input`.
- `CAPABILITY_CALL_FAILED` emitted:

```txt
message: prepare-ai-input proof requires scaleMapping
path: ["scaleMapping"]
```

- `STEP_TRANSITION_EVALUATED prepare-ai-input:failed` succeeded.
- `MISSION_FAILED` followed immediately after the same step.

What this disproves:

- startup is not the stop point
- command acceptance is not missing
- the older `prepare-ai-input` missing-`source` failure is no longer the first blocker in the latest run
- map transition closure is not the current stop point for the selected web mission

Direct owner boundary:

- Screenshot runtime proof / result construction and validation

Primary code path:

- `src/capabilities/screenshot/screenshot-schema-refinements.ts`
  - `validateScreenshotRuntimeProofPrepareAiInput(...)` rejects `prepare-ai-input` whenever `scaleMapping` is null, without checking `status`
- `src/capabilities/screenshot/runtime/screenshot-dispatch-failure.ts`
  - `buildScreenshotFailureRuntimeProof(...)` hardcodes `scaleMapping: null` on non-success proofs
- `src/capabilities/screenshot/runtime/screenshot-execution-success-helpers.ts`
  - `resolvePrepareAiInputScaleMapping(...)` proves the success path already knows how to compute the mapping
- `src/capabilities/screenshot/runtime/screenshot-proof-builder.ts`
  - non-success proofs already preserve `diagnosticPayloadRef`, which matches the blueprint expectation for non-success outcomes

Why this is the live P0:

- the authoritative runtime log stops exactly at Screenshot `prepare-ai-input`
- the failure reproduced across multiple runs inside the same verification bundle
- Orchestration did its job correctly after the step failure; the blocking truth remains inside Screenshot proof validation

What remains intentionally unresolved in Phase 1:

- a deeper image-processing or output-boundary failure may still exist underneath
- current runtime evidence cannot prove that deeper cause because the failed proof is rejected earlier by the schema refinement

Required future fix layers:

- production code
- screenshot inspector
- screenshot negative proof

## P1 Confirmed

### BLOCKER-LOG-1: Commander command-ingress transparency is incomplete; required start events are missing and accepted-command proof fields are inconsistent

Priority: P1

Latest runtime evidence:

- `HUMAN_COMMAND_VALIDATED` exists in both the terminal relay and API bundle.
- `COMMAND_ACCEPTED` exists in both the terminal relay and API bundle.
- `HUMAN_COMMAND_DRAFTED` does not appear in the latest terminal relay.
- `HUMAN_COMMAND_DRAFTED` does not appear in the latest API bundle.
- `HUMAN_COMMAND_RECEIVED` does not appear in the latest terminal relay.
- `HUMAN_COMMAND_RECEIVED` does not appear in the latest API bundle.
- `task-start-response-current-tiktok.json` accepted receipt runtime proof has `missionId: null` and `traceId: null`.
- `task-start-response-current-facebook.json` accepted receipt runtime proof has the same null shape.
- `runtime-logs-api.json` contains multiple `COMMAND_ACCEPTED` shapes, including an accepted command event whose payload still carries `missionId: null`.

Why this is not the P0 stop point:

- the mission still dispatches through Commander, Nerve Bus, and Orchestration
- the selected mission reaches Screenshot execution and fails later at `prepare-ai-input`

Why it is still a real blocker:

- Phase 1 requires a complete user-command-to-mission timeline
- the latest real bundle cannot prove the full command ingress path from received request through accepted mission identity without reconstructing across mixed artifacts
- accepted-command proof / log fields are not consistent enough to serve as single-source mission provenance

Direct owner boundary:

- Local App Shell task-start logging
- Commander accepted receipt / runtime proof construction
- Commander structured runtime-event payload building

Primary code path:

- `src/lib/local-app-shell/task-start-flow.ts`
  - `runTaskStartFlow(...)` calls `recordTaskStartDraftEvents(...)`
- `src/lib/local-app-shell/task-start-support.ts`
  - `recordTaskStartDraftEvents(...)` defines both `HUMAN_COMMAND_DRAFTED` and `HUMAN_COMMAND_RECEIVED`
  - `recordTaskStartCommandAccepted(...)` emits a pre-dispatch `COMMAND_ACCEPTED` shape without mission/run identity fields on the payload input
- `src/capabilities/commander-console/runtime/commander-command-outcomes.ts`
  - `createTransportOutcome(...)` keeps `traceId: null` in the accepted receipt proof path
- `src/capabilities/commander-console/runtime/commander-proof-builder.ts`
  - `buildCommanderRuntimeProof(...)` copies the nullable receipt fields into the final runtime proof
- `src/lib/local-runtime/workbench-commander-debug.ts`
  - `buildCommanderDebugIdentity(...)` allows `missionId` to remain null in the structured event payload even though the forensics write request itself falls back to `traceId`

Required future fix layers:

- production code
- structured logging enforcement
- commander inspector
- commander negative proof

## P2

No additional current P2 blocker was elevated from the latest real runtime bundle.

## Historical / Non-Current Findings

### HISTORICAL-NONCURRENT-1: The older `prepare-ai-input` missing-`source` blocker is no longer the first failure

- The latest authoritative run reached and completed `capture-video-viewport`.
- The latest authoritative run then failed on `prepare-ai-input proof requires scaleMapping`.
- The old `invalid_type -> path ["source"] -> Required` story must therefore stay historical in this phase package.

### HISTORICAL-NONCURRENT-2: Earlier mirroring blockers were not exercised by the selected authoritative web rerun

- The latest selected mission is `tiktok-web`.
- This Phase 1 package therefore does not re-promote old mirroring open / map-closure blockers as current blockers without fresh runtime evidence from the same bundle.
