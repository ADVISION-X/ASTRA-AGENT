# GrassEye Phase 2 Fix & Recurrence Prevention Report

Final status: FIX_AND_RECURRENCE_PREVENTION_NOT_READY

## Source Phase 1 Reports

- tmp/debug-loop/root-cause-analysis/phase-1-report.md
- tmp/debug-loop/root-cause-analysis/root-cause-matrix.md
- tmp/debug-loop/root-cause-analysis/enforcement-gap-matrix.md

## FIX-1: Command transport result must preserve non-null runId

### 1. 修复了什么

- 生产文件:
  - src/capabilities/commander-console/shared/commander-transport-schema.ts
  - src/capabilities/commander-console/runtime/commander-transport-semantic-gate.ts
  - src/lib/local-runtime/workbench-commander-command-transport.ts
  - src/capabilities/commander-console/runtime/commander-command-outcomes.ts
  - src/capabilities/commander-console/runtime/commander-command-transport-failure.ts
- 施工图文件:
  - docs/法案辅助文件/GrassEye Commander Console 总司令控制台能力组施工图.md
- inspector 文件:
  - scripts/audit/domains/commander-console-capability/run-commander-runtime-checks.ts
  - scripts/audit/domains/commander-console-capability/negative-proof-harness.ts
- negative proof 文件:
  - tmp/debug-loop/regression-proofs/BLOCKER-1/*

### 2. 为什么这是根因修复，不是表面修复

Phase 1 的失败点是 command dispatch 后，Commander transport semantic gate 解析结果时看到 `runId:null`，导致 `COMMAND_REJECTED`。修复后 transport schema 要求 result runId，workbench transport 从 Nerve Bus command envelope 透传 runId，Commander outcome 失败/超时路径也生成非空 runId，不再把 null 写进 command result envelope。

### 3. 防复发证据

- 生产突变: 在真实生产文件中把 `createTransportOutcome` 的 runId 改回 null。
- 突变后 inspector FAIL: tmp/debug-loop/regression-proofs/BLOCKER-1/inspector-fail-output.txt
- 回滚后 inspector PASS: tmp/debug-loop/regression-proofs/BLOCKER-1/rollback-proof.txt
- Anti-escape: Commander owner negative-proof harness 新增 transport schema removal 与 runId-null mutation；尚未完成删除 inspector/manifest binding 的显式生产突变验证，因此最终 NOT_READY。

## FIX-2: Mission preflight must cover selected command/result/proof contract

### 1. 修复了什么

- 生产文件:
  - src/lib/local-runtime/workbench-contract.ts
  - src/lib/local-runtime/workbench-status.ts
  - src/lib/local-app-shell/task-start-flow.ts
- 施工图文件:
  - docs/法案辅助文件/GrassEye Commander Console 总司令控制台能力组施工图.md
- inspector 文件:
  - scripts/audit/domains/commander-console-capability/run-startup-readiness-gate-checks.ts
  - scripts/audit/domains/commander-console-capability/negative-proof-harness.ts
- negative proof 文件:
  - tmp/debug-loop/regression-proofs/BLOCKER-2/*

### 2. 为什么这是根因修复，不是表面修复

Phase 1 显示 Mission preflight passed 后才由 command semantic gate 发现契约不完整。修复后 task start flow 把 `taskTemplateId`、`activationSnapshotRef`、`targetProfileRef` 传入 mission-start preflight，preflight 增加 `commandTransportContract` 组件，缺少任务绑定/激活快照/目标 profile 时必须在 dispatch 前阻断。

### 3. 防复发证据

- 生产突变: 从真实生产文件 `src/lib/local-runtime/workbench-status.ts` 删除 `commandTransportContract` component。
- 突变后 inspector FAIL: tmp/debug-loop/regression-proofs/BLOCKER-2/inspector-fail-output.txt
- 回滚后 inspector PASS: tmp/debug-loop/regression-proofs/BLOCKER-2/rollback-proof.txt
- Anti-escape: Commander startup readiness gate inspector 用 AST 检查 task-start-flow 参数与 workbench-status preflight component；尚未完成 manifest unbinding/delete-inspector 显式验证。

## FIX-3: COMMAND_REJECTED terminal relay must include owner/actionable/run identity

### 1. 修复了什么

- 生产文件:
  - src/types/structured-log.ts
  - src/lib/local-runtime/structured-log-payload.ts
  - src/lib/local-runtime/workbench-commander-debug.ts
  - scripts/startup/lib/terminal-structured-log.mjs
- 施工图文件:
  - docs/法案辅助文件/GrassEye 唯一启动入口与终端结构化日志施工图.md
- inspector 文件:
  - scripts/audit/domains/commander-console-capability/run-startup-readiness-gate-checks.ts
  - scripts/audit/domains/forensics-persistence-capability/run-forensics-structured-log-runtime-checks.ts
  - scripts/audit/domains/structured-logging/run-structured-logging-checks.ts
- negative proof 文件:
  - tmp/debug-loop/regression-proofs/BLOCKER-3/*

### 2. 为什么这是根因修复，不是表面修复

Phase 1 的 terminal log 对 `COMMAND_REJECTED` 缺 owner/actionable/schema owner 与 run identity，导致只能看到 Zod 失败而不能定位治理责任。修复后 structured log schema/payload/terminal relay 都保留 runId、ownerResponsible、actionableMessage、traceId、selectedMapId、activationSnapshotRef。

### 3. 防复发证据

- 生产突变: 从真实 startup terminal relay 删除 `ownerResponsible` 透传。
- 突变后 inspector FAIL: tmp/debug-loop/regression-proofs/BLOCKER-3/inspector-fail-output.txt
- 回滚后 inspector PASS: tmp/debug-loop/regression-proofs/BLOCKER-3/rollback-proof.txt
- Anti-escape: Commander startup readiness inspector 已用 AST 覆盖 terminal relay 关键字段；structured-logging/forensics domain 仍有既存基线失败，最终 NOT_READY。

## FIX-4: Runtime proof chain must carry command runId after acceptance

### 1. 修复了什么

- 生产文件:
  - src/lib/local-runtime/workbench-human-command.ts
  - src/capabilities/orchestration/schema.ts
  - src/capabilities/orchestration/runtime/orchestration-executor-command-support.ts
  - src/capabilities/orchestration/runtime/orchestration-state-support.ts
  - src/capabilities/orchestration/runtime/orchestration-proof-builder.ts
  - src/capabilities/orchestration/runtime/orchestration-executor-loop.ts
  - src/capabilities/orchestration/runtime/orchestration-execute-result.ts
  - src/capabilities/orchestration/runtime/orchestration-dispatch-failure.ts
  - src/capabilities/orchestration/runtime/orchestration-loop-proof-builders.ts
  - src/capabilities/orchestration/runtime/orchestration-transition-success-proof.ts
- 施工图文件:
  - docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md
- inspector 文件:
  - scripts/audit/domains/orchestration-capability/run-governed-runtime-checks.ts
  - scripts/audit/domains/orchestration-capability/negative-proof-harness.ts
- negative proof 文件:
  - tmp/debug-loop/regression-proofs/BLOCKER-4/*

### 2. 为什么这是根因修复，不是表面修复

Phase 1 的 command 被拒挡住了 downstream lifecycle；修复后 command runId 从 human command envelope 进入 MissionCommand、MissionState.activeTaskRunId、RuntimeProofSchema 与 proof builder identity，确保 accepted command 后的 orchestration proof 链可关联到同一个 run。

### 3. 防复发证据

- 生产突变: 从真实生产文件 `orchestration-proof-builder.ts` 删除 `runId: input.runId`。
- 突变后 inspector FAIL: tmp/debug-loop/regression-proofs/BLOCKER-4/inspector-fail-output.txt
- 回滚后 inspector PASS: tmp/debug-loop/regression-proofs/BLOCKER-4/rollback-proof.txt
- Anti-escape: Orchestration owner inspector 检查 RuntimeProofSchema、BuildProofInput、proof builder symbol-level emission；尚未完成删除 inspector/negative proof/manifest binding 显式验证。

## Command Results

- npm run audit:build: PASS, see tmp/debug-loop/fix-and-recurrence-prevention/command-results/audit-build.txt
- npm run audit: FAIL at map-plugin-package negative-proof harness, see tmp/debug-loop/fix-and-recurrence-prevention/command-results/audit.txt
- npm run audit:meta: MISSING_SCRIPT
- npm run audit:runner: MISSING_SCRIPT
- npm run typecheck: FAIL in AI capability files, see tmp/debug-loop/fix-and-recurrence-prevention/command-results/typecheck.txt
- npm run lint: FAIL because lint delegates to typecheck, see tmp/debug-loop/fix-and-recurrence-prevention/command-results/lint.txt
- npm run ci:full: FAIL at typecheck, see tmp/debug-loop/fix-and-recurrence-prevention/command-results/ci-full.txt
- git diff --check: PASS, see tmp/debug-loop/fix-and-recurrence-prevention/command-results/git-diff-check.txt

## Post-Fix Runtime Verification

- Runtime log: tmp/debug-loop/post-fix-runtime-verification/runtime-log.txt
- Runtime timeline: tmp/debug-loop/post-fix-runtime-verification/runtime-timeline.md
- Remaining blockers: tmp/debug-loop/post-fix-runtime-verification/remaining-blockers.md
- Verification summary: tmp/debug-loop/post-fix-runtime-verification/verification-summary.md

Observed current-code scenario on port 4183: `POST /api/tasks/start` for `facebook-seeding-video-discovery` returned `transportStatus=accepted`, and terminal structured logs emitted `COMMAND_ACCEPTED` with runId, ownerResponsible, actionableMessage, traceId, selectedMapId, and activationSnapshotRef. The original `runId=null` COMMAND_REJECTED did not recur in the final verification command.

## Remaining NOT_READY Reasons

- Full `npm run audit` fails at `map-plugin-package` negative proof harness before the rest of the plan can pass.
- `npm run typecheck`, `npm run lint`, and `npm run ci:full` fail in AI capability files outside the phase-1 blocker root cause set.
- Explicit anti-escape mutation checks for deleting inspector / deleting negative proof / unbinding manifest / warning-only downgrade were not completed for every touched owner.
- Structured-logging and forensics domain checks still have stale or failing baseline paths, so they cannot be used as complete proof for BLOCKER-3.

## Next Minimal Actions

1. Repair the existing `map-plugin-package` negative-proof harness failure so full audit can progress.
2. Repair the AI capability typecheck errors reported in command-results/typecheck.txt.
3. Complete anti-escape mutation proofs for inspector deletion, negative proof deletion, manifest unbinding, owner mapping deletion, and machine-blocking downgrade.
4. Rerun the full script matrix and keep the 4183 runtime scenario green.
