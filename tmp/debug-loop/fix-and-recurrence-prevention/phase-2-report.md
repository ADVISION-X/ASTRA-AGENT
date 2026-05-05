# GrassEye Phase 2 Fix, Recurrence Prevention, and Fresh Verification Report

Final status: `PHASE_2_NOT_READY_NEW_P0_BLOCKER`

## Source Phase 1 Reports

- `tmp/debug-loop/root-cause-analysis/phase-1-report.md`
- `tmp/debug-loop/root-cause-analysis/root-cause-matrix.md`
- `tmp/debug-loop/root-cause-analysis/enforcement-gap-matrix.md`

## FIX-1: Screenshot dispatch chain and page-state proof handoff

### 1. 修复了什么

- 生产文件:
  - `src/lib/local-runtime/workbench-screenshot-dispatch-input.ts`
  - `src/lib/local-runtime/workbench-action-dispatch-inputs.ts`
- 施工图文件:
  - `docs/法案辅助文件/GrassEye Screenshot 能力组施工图.md`
- inspector 文件:
  - `scripts/audit/domains/_shared/screenshot-dispatch-adapter-check.ts`
  - `scripts/audit/domains/screenshot-capability/required-shape.ts`
  - `scripts/audit/domains/screenshot-capability/config.ts`
- negative proof 文件:
  - `scripts/audit/domains/screenshot-capability/negative-proof-harness.ts`
  - `tmp/debug-loop/regression-proofs/BLOCKER-SCREENSHOT-DISPATCH-CHAIN/*`

### 2. 为什么这是根因修复，不是表面修复

Phase 1 的 screenshot blocker 不是 screenshot owner 本体先坏掉，而是 local-runtime 到 screenshot owner 的 governed chain 没有完整映射。修复后 screenshot request 会带上完整 envelope chain，并在 `capture-browser-viewport` 路径补齐 page-state proof handoff。Fresh runtime 已经证明这一根因被移除，因为新的真实失败不再是 chain 字段缺失，而是更深一层的 screenshot runtimeProof 约束冲突。

### 3. 防复发证据

- Screenshot owner audit: PASS.
- 生产突变验证: `tmp/debug-loop/regression-proofs/BLOCKER-SCREENSHOT-DISPATCH-CHAIN/inspector-fail-output.txt`
- 回滚后恢复: `tmp/debug-loop/regression-proofs/BLOCKER-SCREENSHOT-DISPATCH-CHAIN/rollback-proof.txt`

## FIX-2: Orchestration must emit explicit `CAPABILITY_CALL_STARTED`

### 1. 修复了什么

- 生产文件:
  - `src/capabilities/orchestration/runtime/orchestration-loop-iteration-events.ts`
  - `src/capabilities/orchestration/runtime/orchestration-loop-iteration-event-shared.ts`
- 施工图文件:
  - `docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md`
- inspector 文件:
  - `scripts/audit/domains/orchestration-capability/mission-loop-event-semantics-checks.ts`
- negative proof 文件:
  - `scripts/audit/domains/orchestration-capability/negative-proof-harness.ts`
  - `tmp/debug-loop/regression-proofs/BLOCKER-ORCHESTRATION-CAPABILITY-CALL-STARTED/*`

### 2. 为什么这是根因修复，不是表面修复

Phase 1 的 Orchestration blocker 是生命周期语义不完整: `STEP_DISPATCH_STARTED` 已出现，但普通能力步骤没有显式 `CAPABILITY_CALL_STARTED`。修复后 Orchestration 在普通能力步骤进入 owner 执行前稳定落这个事件。Fresh runtime 已在 Facebook 和 TikTok 的 screenshot step 上观测到该事件，说明根因修复已经在真实任务里生效。

### 3. 防复发证据

- Orchestration owner audit: PASS.
- 生产突变验证: `tmp/debug-loop/regression-proofs/BLOCKER-ORCHESTRATION-CAPABILITY-CALL-STARTED/inspector-fail-output.txt`
- 回滚后恢复: `tmp/debug-loop/regression-proofs/BLOCKER-ORCHESTRATION-CAPABILITY-CALL-STARTED/rollback-proof.txt`

## Static Command Matrix

- `npm run audit:build`: PASS.
- `npm run audit`: FAIL-FAST at unrelated `audit-system` fake enforcement.
- `npm run typecheck`: FAIL on non-current-owner TypeScript errors listed in `tmp/debug-loop/fix-verification/non-current-owner-ci-blockers.md`.
- `npm run lint`: FAIL because lint delegates to typecheck.
- `npm run ci:full`: FAIL-FAST at typecheck.

These failures remain real, but they are outside the two phase-1 blocker roots fixed in this session.

## Real Restart and Fresh Runtime Verification

- Real restart succeeded on port `4173`.
- Fresh `mission-readiness.json` reported `status=ready`.
- Real Facebook task trigger returned success with `transportStatus=accepted`.
- Real TikTok task trigger returned success with `transportStatus=accepted`.
- Fresh runtime proved both original blockers resolved:
  - old screenshot dispatch-chain blocker not observed
  - old missing `CAPABILITY_CALL_STARTED` blocker not observed

## Fresh Re-analysis Result

Fresh runtime exposed a new shared blocker after the old blockers were removed:

- current blocker: screenshot runtimeProof rejects null `videoVisitId`
- failing step: `capture-video-viewport`
- affected maps:
  - `facebook.seeding-video.discovery.meta.v1`
  - `tiktok.seeding-video.discovery.meta.v1`
- fresh analysis folder:
  - `tmp/debug-loop/post-fix-runtime-verification/fresh-root-cause-analysis/`

## Remaining NOT_READY Reasons

- A new screenshot-owner P0 blocker remains in production: `videoVisitId is required in runtimeProof`.
- `npm run audit`, `npm run typecheck`, `npm run lint`, and `npm run ci:full` are still not globally green because of unrelated baseline failures.

## Next Minimal Actions

1. Fix screenshot runtimeProof `videoVisitId` contract mismatch at the owner level.
2. Add screenshot-owner recurrence prevention for nullable `videoVisitId` parity between schema, refine rules, and first-capture map semantics.
3. Rerun real restart plus fresh Facebook and TikTok task triggers after the screenshot fix.
