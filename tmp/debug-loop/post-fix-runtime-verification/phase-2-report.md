# Phase 2 Fix & Recurrence Prevention Report

## FIX-1: Builtin child-capability package reached runtime

### 1. 修复了什么

- Production: `src/map-plugins/builtins/index.ts`, `src/map-plugins/import/map-package-approval.ts`, `src/map-plugins/registry/map-plugin-registry.ts`
- Inspector: `scripts/audit/domains/map-plugin-package/anti-escape.ts`, `scripts/audit/domains/map-plugin-package/negative-proof-harness.ts`
- Blueprint: `docs/法案辅助文件/GrassEye 地图插件包治理施工图.md`
- Proof: `tmp/debug-loop/regression-proofs/BLOCKER-1`

### 2. 根因修复说明

The builtin loader no longer lets a raw Zod failure surface without owner/actionable/package context. Builtin parse and development approval failures now expose package file, expected/received kind, validation issue path, owner, and remediation.

### 3. 防复发证据

Production mutation changed a builtin package to `child-capability-package`; `npm run audit:map-plugin-package` failed. Rollback then passed.

## FIX-2: Startup did not gate map package readiness

### 1. 修复了什么

- Production: `scripts/startup/launch-grasseye.mjs`, `scripts/startup/lib/map-package-readiness.mjs`, `scripts/startup/lib/map-package-readiness-probe.ts`
- Inspector: `scripts/audit/domains/commander-console-capability/run-startup-readiness-gate-checks.ts`
- Negative proof: `scripts/audit/domains/commander-console-capability/negative-proof-harness.ts`
- Blueprint: `docs/法案辅助文件/GrassEye 唯一启动入口与终端结构化日志施工图.md`
- Proof: `tmp/debug-loop/regression-proofs/BLOCKER-2`

### 2. 根因修复说明

Startup now runs `map_package_readiness_check` after update preflight and before AI/app-server readiness. Removing that call makes the commander-console audit fail.

### 3. 防复发证据

Production mutation removed the map-package readiness gate; `npm run audit:commander-console` failed. Rollback then passed.

## FIX-3: Failure logs lacked actionable owner/package context

### 1. 修复了什么

- Production: `scripts/startup/lib/terminal-structured-log.mjs`, `scripts/startup/lib/startup-failure-bundle.mjs`, `scripts/startup/lib/startup-failure-handler.mjs`
- Inspector: commander-console startup readiness gate checks
- Blueprint: `docs/法案辅助文件/GrassEye 唯一启动入口与终端结构化日志施工图.md`
- Proof: `tmp/debug-loop/regression-proofs/BLOCKER-3`, `tmp/debug-loop/regression-proofs/BLOCKER-4`

### 2. 根因修复说明

Startup failures now preserve `ownerResponsible`, `actionableMessage`, `runId`, and failure bundle refs instead of emitting only raw stderr.

### 3. 防复发证据

Mutations that bypassed diagnostic parsing or startup failure bundle persistence failed owner inspectors. Rollbacks passed.

## FIX-4: Post-fix targetProfileRef contract drift

### 1. 修复了什么

- Production: `src/map-plugins/builtins/*seeding-video-discovery.meta.map-package.json`, `src/map-plugins/validation/map-platform-profile-validator.ts`, `src/lib/local-app-shell/task-start-binding.ts`, `src/lib/local-app-shell/task-start-flow.ts`, `src/lib/local-runtime/workbench-human-command-dispatch.ts`, `src/lib/local-runtime/workbench-human-command.ts`, `src/lib/local-runtime/workbench-open-dispatch-input.ts`, `src/capabilities/commander-console/shared/commander-transport-schema.ts`, `src/capabilities/orchestration/schema.ts`, `src/capabilities/orchestration/runtime/orchestration-executor-command-support.ts`, `src/capabilities/orchestration/runtime/orchestration-state-support.ts`
- Inspector: `scripts/audit/domains/map-plugin-package/negative-proof-harness.ts`
- Proof: `tmp/debug-loop/regression-proofs/POST-FIX-TARGET-PROFILE`

### 2. 根因修复说明

The selected task binding now carries explicit open target profiles through Commander, Orchestration, payload refs, and open dispatch. Builtin validation rejects a task template whose initial open child and `targetProfileRef` drift apart.

### 3. 防复发证据

Production mutation changed Facebook `targetProfileRef` back to `facebook-web:persistent-local-profile`; `npm run audit:map-plugin-package` failed with `taskTemplate.targetProfileRef: invalid_platform_profile`. Rollback passed.

## Command Results

- PASS: `npm run typecheck`
- PASS: `npm run lint`
- PASS: `npm run audit:build`
- PASS: `npm run audit:map-plugin-package`
- PASS: `npm run audit:commander-console`
- PASS: `git diff --check`
- FAIL: `npm run audit` at `audit-system` code-purity
- FAIL: `npm run ci:full` at `audit-system` code-purity
- MISSING SCRIPT: `npm run audit:meta`
- MISSING SCRIPT: `npm run audit:runner`

## Remaining Risk

No Phase-1 P0 startup/map-package blocker remains. Full READY is blocked by audit-system code-purity findings outside the original runtime blocker set.

Final status: `FIX_AND_RECURRENCE_PREVENTION_NOT_READY`.
