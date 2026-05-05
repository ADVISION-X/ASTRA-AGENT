# Phase 1 Report

Status: `LOG_BLOCKER_ANALYSIS_READY`

## Boundary

This phase performed Runtime Log Blocker Mining & Root Cause Analysis only.

- No production code changed.
- No law changed.
- No blueprint changed.
- No inspector changed.
- No negative-proof harness changed.
- No repair patch was generated.

## Evidence Judgment

The latest authoritative evidence is the real terminal log copied into `docs/Codex提示词/终端日志复制.md` with `runId=2026-05-05T17:10:09.996Z`.

That evidence is later than the 17:03 verification bundle and therefore controls current blocker truth.

The 17:03 bundle is still useful as cross-check evidence because it reproduces the same web and mirroring blocker families, but its mixed runtime snapshot cannot override the later terminal run.

## Final Judgment

The latest evidence supports these conclusions:

1. Startup is not the blocker.
2. `COMMAND_ACCEPTED` is present.
3. `CAPABILITY_CALL_STARTED` is present on all four mission families.
4. Web missions currently fail at screenshot `prepare-ai-input` because required `source` is missing.
5. Mirroring missions currently fail first because `OpenLocalProgramPort` is not configured in the composed Open runtime.
6. Mirroring missions then hit a second blocking governance defect because `open-iphone-mirroring` has no failed / review transition closure.
7. Mission preflight and current inspectors failed to block these conditions before runtime.
8. Older screenshot `videoVisitId` parity evidence is historical only and must not be reported as the current live blocker.

## Confirmed Current Blocker Set

### Web blocker

- `prepare-ai-input` fails on both web maps with `invalid_type` at `path ["source"]`.
- Root cause: `src/lib/local-runtime/workbench-screenshot-dispatch-input.ts` does not build `source` for `prepare-ai-input`, while `src/capabilities/screenshot/schema.ts` requires it.

### Mirroring first blocker

- `open-iphone-mirroring` fails on both mirroring maps with `OpenLocalProgramPort is not configured`.
- Root cause: `src/lib/local-runtime/workbench-open-runtime.ts` composes `createOpenAbilityGroup(...)` without `localProgram`, and `src/capabilities/open/runtime/local-program-runner.ts` fails closed when that port is absent.

### Mirroring secondary blocker

- After the Open failure, both mirroring maps fail transition evaluation because the map has no matching `open-iphone-mirroring:failed` transition.
- Root cause: the mirroring builtin map packages declare step-level `failureBranch` / `reviewBranch` but omit matching transitions and top-level branch registration.

## Confirmed Enforcement Gaps

### Screenshot audit blind spot

- Current screenshot adapter inspection validates common chain fields and `capture-browser-viewport` source derivation.
- It does not validate `prepare-ai-input` source derivation.
- Its negative proof has no mutation that deletes `source` from `prepare-ai-input`.

### Open integration blind spot

- Open domain runtime checks live under `src/capabilities/open/**`.
- The actual omission is in `src/lib/local-runtime/workbench-open-runtime.ts`, outside the current owner-local open audit surface.

### Mission preflight blind spot

- `getMissionStartPreflight()` checks command contract, schema, browser, local AI, and data store.
- It does not check whether the selected platform requires local-program execution wiring.
- It therefore passes mirroring starts that should have been blocked before dispatch.

### Map transition closure blind spot

- `validateMapTransitionClosure()` checks top-level branch arrays and PAV policy refs.
- It does not check whether each step-declared `failureBranch` / `reviewBranch` actually resolves to shipped transitions.
- The map negative-proof harness has no mutation covering this missing closure shape.

## Historical Blocker Handling

Older screenshot `videoVisitId` parity failures still appear in stale RCA markdown and in the mixed runtime snapshot.

They are not the first blocker in the latest 17:10 real run.

Therefore this phase records them only as historical / non-current evidence.

## Output Package Status

The Phase 1 RCA package has been refreshed around the latest real runtime truth for:

- `blocker-list.md`
- `runtime-timeline.md`
- `law-blueprint-mapping.md`
- `root-cause-matrix.md`
- `enforcement-gap-matrix.md`
- `phase-1-report.md`

## Next-Phase Default Scope

If Phase 2 begins, the narrow default repair scope should be:

1. repair `prepare-ai-input` source construction
2. repair local-program runtime wiring and preflight coverage
3. repair mirroring map transition closure
4. add negative-proof coverage for all three failure families
