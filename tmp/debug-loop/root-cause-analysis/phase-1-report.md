# Phase 1 Report

Status: `LOG_BLOCKER_ANALYSIS_READY`

Scope: Runtime Log Blocker Mining & Root Cause Analysis only. No production code, law files, blueprints, inspectors, or negative proofs were modified. Generated analysis artifacts only under `tmp/debug-loop/root-cause-analysis/`.

## Inputs Used

- Latest real terminal log pasted from `npm run grasseye:start`, runId `2026-05-05T05:41:00.956Z`.
- Live runtime API: `http://127.0.0.1:4173/api/runtime/logs`.
- Live mission readiness API: `http://127.0.0.1:4173/api/runtime/mission-readiness`.
- Latest startup failure bundle list under `tmp/debug-loop/startup-failures/`.
- Existing post-fix runtime verification artifacts under `tmp/debug-loop/post-fix-runtime-verification/`.
- Current git diff/status.
- Law files under `.github/instructions/cursor-rules/**`.
- Blueprints under `docs/法案辅助文件/**`.
- Audit scripts under `scripts/audit/**`.
- Production code under `src/**`.

## Summary

Startup is not currently blocked. Dependency readiness, map package readiness, local AI readiness, port clear, app server start, app shell health, console open, and mission runtime availability all passed.

The active P0 blocker is command dispatch: MissionReadiness and preflight passed, Commander built a command envelope, Nerve Bus dispatched `start-mission`, Orchestration received it, then the command was rejected with `failureReason=invalid_input`. This violates the Orchestration blueprint requirement that final command shape / binding failures be caught before Nerve Bus envelope creation.

The key observability problem is that the runtime log does not expose the actual failing map step/capability. `MISSION_ACTIVATION_SNAPSHOT_FROZEN` is marked failed even though it contains an activation snapshot ref, because the event status follows the returned mission state rather than snapshot-freeze proof semantics.

An adjacent live runtime API attempt shows a concrete first-step class of failure: Open can reject after preflight with `open requires targetUrl or explicit targetProfileRef ...; silent profile defaulting is forbidden`. Open is doing the right thing locally; upstream propagation/preflight did not prove the target binding reached the first open input.

## Blockers

1. P0: Preflight passed, Nerve Bus dispatched, then `COMMAND_REJECTED failureReason=invalid_input`.
2. P1: `MISSION_ACTIVATION_SNAPSHOT_FROZEN failed` is semantically contradictory when snapshot ref exists.
3. P1: Required loop phase structured logs are missing after Orchestration start.
4. P0: Adjacent runtime proof shows Open target binding can be missing after preflight.

## Root Cause Files

- `src/lib/local-app-shell/task-start-flow.ts`
- `src/lib/local-runtime/workbench-human-command.ts`
- `src/lib/local-runtime/workbench-human-command-debug-events.ts`
- `src/capabilities/orchestration/runtime/orchestration-executor-loop-iteration.ts`
- `src/capabilities/orchestration/runtime/orchestration-nerve-bus-envelope-builders.ts`
- `src/lib/local-runtime/workbench-open-dispatch-input.ts`
- `src/capabilities/open/runtime/target-policy-gate.ts`

## Enforcement Gap Files

- `scripts/audit/domains/orchestration-capability/start-mission-boundary-checks.ts`
- `scripts/audit/domains/orchestration-capability/run-governed-runtime-checks.ts`
- `scripts/audit/domains/orchestration-capability/negative-proof-harness.ts`
- `scripts/audit/domains/commander-console-capability/run-startup-readiness-gate-checks.ts`
- `scripts/audit/domains/commander-console-capability/negative-proof-harness.ts`
- `scripts/audit/domains/open-capability/run-open-runtime-checks.ts`
- `scripts/audit/domains/open-capability/negative-proof-harness.ts`

## Generated Files

- `tmp/debug-loop/root-cause-analysis/runtime-timeline.md`
- `tmp/debug-loop/root-cause-analysis/blocker-list.md`
- `tmp/debug-loop/root-cause-analysis/law-blueprint-mapping.md`
- `tmp/debug-loop/root-cause-analysis/root-cause-matrix.md`
- `tmp/debug-loop/root-cause-analysis/enforcement-gap-matrix.md`
- `tmp/debug-loop/root-cause-analysis/phase-1-report.md`

## READY Criteria Check

- 所有日志阻塞点已列出: yes.
- 每个阻塞点都有日志证据: yes; missing phase events are explicitly marked `LOG_EVENT_MISSING`.
- 每个阻塞点都有法案/施工图对照: yes.
- 每个阻塞点都有生产代码根因文件: yes.
- 每个阻塞点都有 inspector / negative proof 缺口分析: yes.
- 每个阻塞点都有“为什么没拦住”的归类: yes.
- 没有进行代码修复: yes.
