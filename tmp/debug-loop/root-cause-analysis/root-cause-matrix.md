# Root Cause Matrix

| 序号 | 当前问题 | 直接证据 | 生产根因 | 执法缺口 | 为什么没拦住 | 修复优先级 |
|---|---|---|---|---|---|---|
| 1 | 接受命令后没有 step 级证明链 | Latest Facebook/TikTok traces both end at `COMMAND_ACCEPTED`; no `MAP_STEP_SELECTED`, `CAPABILITY_CALL_*`, `STEP_TRANSITION_EVALUATED`, or mission outcome event appears afterward. | `src/capabilities/orchestration/runtime/orchestration-executor-loop-iteration.ts` and `src/capabilities/orchestration/runtime/step-dispatcher.ts` execute the loop but emit no step-phase structured runtime event; `src/lib/local-runtime/structured-log-terminal.ts` only mirrors event names if producers exist. | `scripts/audit/domains/orchestration-capability/run-governed-runtime-checks.ts`; `scripts/audit/domains/orchestration-capability/negative-proof-harness.ts` | Inspectors validate schema/gate presence, not post-acceptance event emission or live phase sequence. | P0 |
| 2 | 动作时间线为空 | Live `/api/runtime/actions` returned `[]` after accepted traces. | `src/lib/local-runtime/workbench-runtime.ts` exposes actions from `evidenceStore.listStructuredActionLogs`; repository search shows no producer call sites for `writeStructuredActionLog(` outside the Forensics contract definition. | `scripts/audit/domains/forensics-persistence-capability/run-forensics-structured-log-runtime-checks.ts`; `scripts/audit/domains/structured-logging/run-structured-logging-checks.ts` | Existing checks validate ownership/shape if calls exist, but do not require that at least one production action-log writer exists. | P0 |
| 3 | Commander proof timeline只剩 task_start 事件 | Live `/api/runtime/snapshot.runtimeProof` shows task-start entries only; mission/runtime are already `idle` after acceptance. | `src/capabilities/orchestration/runtime/orchestration-executor-loop-iteration.ts` failure branches persist `lastRuntimeProofRef/runtimeProofRefs`, but success path does not; `src/lib/local-runtime/workbench-commander-runtime-proof-read-model.ts` projects only `structuredRuntimeEvents`. | `scripts/audit/domains/orchestration-capability/run-governed-runtime-checks.ts`; `scripts/audit/domains/commander-console-capability/run-commander-runtime-checks.ts` | No inspector asserts success-path proof persistence or Commander read-model parity after accepted mission start. | P1 |
| 4 | 当前 accepted trace 使用的不是空地图 | Latest accepted traces use `facebook.seeding-video.discovery.meta.v1` and `tiktok.seeding-video.discovery.meta.v1`; both builtin maps declare `initialStepId` as real open steps. | Builtin map packages under `src/map-plugins/builtins/*.meta.map-package.json` start with `open-facebook-reels` and `open-tiktok-feed`, not `finalize-mission`. | No direct enforcement gap here; this row removes a false hypothesis. | The silence after acceptance cannot be dismissed as a finalize-only map or empty map selection artifact. | Supporting evidence |

## Production Root Cause Notes

1. `src/capabilities/orchestration/runtime/orchestration-executor-loop-iteration.ts`
	- dispatches steps and evaluates transitions;
	- emits no step-level structured runtime event;
	- persists proof refs only on failure branches.

2. `src/capabilities/orchestration/runtime/orchestration-transition-success-proof.ts`
	- builds success proof objects;
	- does not itself make them Commander-visible.

3. `src/lib/local-runtime/workbench-commander-runtime-proof-read-model.ts`
	- runtime proof timeline is a view over `structuredRuntimeEvents`, not over Orchestration proof objects.

4. `src/lib/local-runtime/workbench-runtime.ts`
	- `/api/runtime/actions` is a pure read of persisted `structuredActionLogs`.

5. `src/capabilities/forensics-persistence/contract.ts`
	- `writeStructuredActionLog` exists as a capability contract;
	- no production writer currently calls it.

## Root Cause Classification

- Confirmed observability gap: yes.
- Confirmed structured action-log producer gap: yes.
- Confirmed success-path proof/read-model gap: yes.
- Confirmed startup blocker: no.
- Confirmed `runId=null` as current leading blocker: no.
