# Root Cause Matrix

| 序号 | 问题点 | 阻塞阶段 | 法案要求 | 施工图要求 | 生产根因文件 | 执法缺口文件 | 为什么没拦住 | 修复优先级 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Built-in map package reached runtime as `child-capability-package` | app shell health before commander open | `GRASSEYE-MAP-PLUGIN-001-V2`, `003-V2`: maps are not child capabilities; `packageKind = operational-map-package` | 地图插件包治理施工图 §4, §17, §18 | `src/map-plugins/builtins/index.ts`; `src/map-plugins/schema/map-plugin-manifest.schema.ts`; `src/map-plugins/registry/map-plugin-registry.ts`; `src/capabilities/orchestration/runtime/orchestration-default-map-store.ts`; `src/capabilities/orchestration/ability-group.ts` | `scripts/audit/domains/map-plugin-package/inspector.ts`; `negative-proof-harness.ts` | G plus C plus H: previous fake PASS bypass, no startup audit gate, insufficient log fields | P0 |
| 2 | Startup readiness/preflight passed without map package readiness | update_preflight_check / app_server start | `GRASSEYE-MAP-PLUGIN-002-V2`: built-ins must pass lifecycle before active/runtime consumption | 地图插件包治理施工图 READY: built-ins pass lifecycle, inspector PASS, negative proof PASS | `scripts/startup/launch-grasseye.mjs` | map-plugin-package inspector not wired into startup; no startup preflight mutation | C plus I: inspector exists but startup bypasses it | P0 |
| 3 | Zod/runtime failure logs do not name package file, owner, or actionable message | service stderr relay / bootstrap_failed | Map package proof/log chain must be diagnosable; Orchestration runtime proof parity | 结构化日志与运行证明施工图 | `scripts/startup/lib/terminal-structured-log.mjs`; `src/map-plugins/builtins/index.ts`; `scripts/startup/lib/health-check.mjs` | no negative proof for diagnosable package parse failure logs | H plus D: line-oriented stderr and no symbol-level logging contract | P1 |
| 4 | Latest debug-loop bundle is unrelated to current startup blocker | forensics/debug bundle discovery | debug-loop evidence must correlate to current run | Debug Loop Boundary 施工图 | `scripts/startup/launch-grasseye.mjs` does not persist startup failure bundle | no inspector rule requiring startup failure bundle correlation | H plus J: separate startup/debug-loop evidence paths | P1 |

## Priority Notes

P0 because:
- readiness/update preflight passed and service started before a map package law violation surfaced.
- map package was modeled as child capability, a direct P0 forbidden state.
- old inspector state contained generated fake PASS for negative proof.

P1 because:
- structured log fields are insufficient for precise package/file ownership.
- debug-loop refs do not correlate to the current startup failure.
