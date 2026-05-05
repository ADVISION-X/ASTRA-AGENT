# Blocker List

Phase: Runtime Log Blocker Mining & Root Cause Analysis
Boundary: analysis only; no production code, law, blueprint, inspector, or negative-proof harness was changed.

## Evidence Precedence

1. Primary evidence: `docs/Codex提示词/终端日志复制.md`, latest real startup/runtime run, `runId=2026-05-05T17:10:09.996Z`.
2. Cross-check only: `tmp/debug-loop/post-fix-runtime-verification/runtime-log.txt`, earlier run, `runId=2026-05-05T17:03:56.478Z`.
3. Mixed / non-authoritative summary only: `tmp/debug-loop/post-fix-runtime-verification/runtime-snapshot.json`, because it aggregates older screenshot parity failures together with current open / transition failures.

## P0 Confirmed

### BLOCKER-RUNTIME-1: Web maps fail at `prepare-ai-input` because required `source` is never built

Priority: P0
Affected missions:

- `facebook-web`
- `tiktok-web`

Latest log evidence:

- Latest terminal log reaches `COMMAND_ACCEPTED` and multiple `CAPABILITY_CALL_STARTED` events before failure.
- Facebook web fails at `prepare-ai-input` with:

```txt
failureReason="[
  {
    \"code\": \"invalid_type\",
    \"expected\": \"object\",
    \"received\": \"undefined\",
    \"path\": [\"source\"],
    \"message\": \"Required\"
  }
]"
```

- TikTok web later fails with the same error.

Actual behavior proved before the stop point:

- Startup passed.
- `COMMAND_ACCEPTED` exists.
- `CAPABILITY_CALL_STARTED` exists.
- Open succeeded.
- Page-state checks succeeded.
- `capture-video-viewport` succeeded.
- Failure happens only when the map advances to screenshot child `prepare-ai-input`.

Direct owner boundary:

- Local runtime screenshot dispatch adapter feeding Screenshot input.

Primary code path:

- `src/lib/local-runtime/workbench-screenshot-dispatch-input.ts`
  - `buildPrepareAiInputCommand()` returns common fields plus `childCapabilityId: "prepare-ai-input"`.
  - It does not build `source`.
- `src/capabilities/screenshot/schema.ts`
  - `PrepareAiInputInputSchema` requires `source: ScreenshotStoredImageSourceSchema`.
- `src/capabilities/screenshot/children/prepare-ai-input/implementation.ts`
  - Execution immediately dereferences `request.source.sourceStorageRef` and `request.source.sourceProof`, confirming `source` is not optional at execution time either.

Why this is the current blocker:

- The latest real run shows `source` failure, not `videoVisitId` failure.
- The earlier 17:03 runtime log cross-check reproduces the same `source` failure family on web maps.

### BLOCKER-RUNTIME-2: Mirroring maps fail first because `OpenLocalProgramPort` is not wired into the Open runtime

Priority: P0
Affected missions:

- `iphone-mirroring-facebook-app`
- `iphone-mirroring-tiktok-app`

Latest log evidence:

- Both mirroring missions reach `COMMAND_ACCEPTED`, `MAP_STEP_SELECTED open-iphone-mirroring`, and `CAPABILITY_CALL_STARTED`.
- The first direct step failure is:

```txt
failureReason="OpenLocalProgramPort is not configured"
```

Actual behavior proved before the stop point:

- Startup passed.
- Mission preflight passed.
- Orchestration selected the governed map and dispatched the open step.
- Failure occurs inside governed Open execution, not during startup or command acceptance.

Direct owner boundary:

- Open runtime composition in local runtime.

Primary code path:

- `src/lib/local-runtime/workbench-open-runtime.ts`
  - `createOpenRuntime()` passes `browser` and `profilePort` into `createOpenAbilityGroup(...)`.
  - It does not pass `localProgram`.
- `src/capabilities/open/contract.ts`
  - `CreateOpenAbilityGroupInput` allows optional `localProgram?: OpenLocalProgramPort`.
- `src/capabilities/open/runtime/open-runtime-context.ts`
  - `localProgram` is only added to runtime context when present.
- `src/capabilities/open/runtime/local-program-runner.ts`
  - `runLocalProgramLaunch()` fails closed with `OpenLocalProgramPort is not configured` when `context.localProgram` is absent.

Why this is the first mirroring blocker:

- It is the first concrete runtime failure emitted on both mirroring maps.
- The later transition error is downstream of this failure, not the first cause.

### BLOCKER-RUNTIME-3: Mirroring maps are missing failure / review transition closure for `open-iphone-mirroring`

Priority: P0 secondary blocker
Affected missions:

- `iphone-mirroring-facebook-app`
- `iphone-mirroring-tiktok-app`

Latest log evidence:

- Immediately after `OpenLocalProgramPort is not configured`, Orchestration emits:

```txt
failureReason="Map \"iphone.mirroring.facebook.seeding-video.discovery.v1\" has no matching transition from step \"open-iphone-mirroring\" for status \"failed\"."
```

- The TikTok mirroring map emits the same shape.

Actual behavior:

- The map step declares `failureBranch` and `reviewBranch` on `open-iphone-mirroring`.
- When the step actually returns `failed`, Orchestration cannot find a matching transition and terminates the mission on transition evaluation failure.

Direct owner boundary:

- Builtin map package closure, not Open execution.

Primary code path:

- `src/capabilities/orchestration/runtime/transition-evaluator.ts`
  - Builds the exact `no matching transition` failure.
- `src/map-plugins/builtins/iphone-mirroring-facebook-seeding-video-discovery.meta.map-package.json`
  - Step `open-iphone-mirroring` declares `failureBranch: "open-iphone-mirroring:failed"` and `reviewBranch: "open-iphone-mirroring:review"`.
  - Top-level `failureBranches` / `reviewBranches` omit those ids.
  - `transitions` also omit matching `open-iphone-mirroring:failed` and `open-iphone-mirroring:review`.
- `src/map-plugins/builtins/iphone-mirroring-tiktok-seeding-video-discovery.meta.map-package.json`
  - Same defect.
- `src/map-plugins/builtins/macos-local-program-open-smoke.meta.map-package.json`
  - Contains the expected `open-iphone-mirroring:failed` and `open-iphone-mirroring:review` transitions and serves as the control sample.

Why this remains a real blocker even though it is secondary:

- It converts the original open failure into a second terminal governance failure.
- It prevents the declared failure / review path from closing correctly.
- It masks the upstream open failure in final mission truth.

## Historical / Non-Current Evidence

### HISTORICAL-NONCURRENT-1: Screenshot `videoVisitId` parity defect remains in older mixed evidence, but not in the latest real run

This issue still appears in:

- stale RCA markdown already present in this folder
- `tmp/debug-loop/post-fix-runtime-verification/runtime-snapshot.json` failedRecords

It does not appear as the first blocker in the latest 17:10 terminal run.

Therefore:

- it must not be reported as the current primary blocker
- it can only be carried as historical / mixed evidence

## Not Current Blockers

The latest real evidence disproves these older narratives as current blockers:

- startup stop point
- missing `COMMAND_ACCEPTED`
- missing `CAPABILITY_CALL_STARTED`
- screenshot `videoVisitId` parity as the only current blocker
