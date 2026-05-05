# Root Cause Matrix

| 序号 | 问题点 | 阻塞阶段 | 法案要求 | 施工图要求 | 生产根因文件 | 执法缺口文件 | 为什么没拦住 | 修复优先级 |
|---|---|---|---|---|---|---|---|---|
| 1 | `capture-video-viewport` 进入 Screenshot Ability 前丢失链路字段 | mission-loop -> screenshot dispatch | Screenshot law `GRASSEYE-SCREENSHOT-CAPABILITY-003-V2` 要求 Screenshot 输入必须携带完整 chain fields；Orchestration law `GRASSEYE-ORCHESTRATION-CAPABILITY-004-V3` 要求 ability input 由 Orchestration 生成时必须包含 full dispatch chain | Screenshot 输入边界要求 `stepId/mapPackageId/mapPackageVersion/selectedMapId/selectedMapVersion/activationSnapshotRef/capabilityCallId/nerveBusEnvelopeId/inputRef` 必填；Orchestration dispatch payload 也要求 full chain fields | `src/lib/local-runtime/workbench-action-dispatch-inputs.ts::buildScreenshotCommand`；控制路径经 `src/lib/local-runtime/workbench-ability-command-executor.ts`；上游完整链由 `src/capabilities/orchestration/runtime/orchestration-nerve-bus-envelope-builders.ts` 生成 | `scripts/audit/domains/screenshot-capability/config.ts`；`project-access.ts`；`required-shape.ts`；`negative-proof-harness.ts` | C/D/E：Screenshot owner audit 只看 `src/capabilities/screenshot/**`，没有覆盖 local-runtime adapter 映射，也没有相应 mutation | P0 |
| 2 | 缺少显式 `CAPABILITY_CALL_STARTED` 事件，runtime 生命周期需要靠推断拼接 | runtime timeline / mission-loop observability | Structured logging law `GRASSEYE-STRUCTURED-LOGGING-003-V1` 要求 structured DEBUG 事件足以支撑 RCA；Orchestration law `GRASSEYE-ORCHESTRATION-CAPABILITY-004-V3` 要求 dispatch 语义显式可追踪 | Orchestration dispatch 施工图要求保留 step execution chain；结构化日志施工图要求不能静默跳过 operator-visible stage | `src/capabilities/orchestration/runtime/orchestration-loop-iteration-events.ts::recordDispatchStarted`；终端 relay 期望由 `src/lib/local-runtime/structured-log-terminal.ts` 可见 | `scripts/audit/domains/orchestration-capability/mission-loop-event-semantics-checks.ts`；`scripts/audit/domains/orchestration-capability/negative-proof-harness.ts` | C/D/E：inspector 只强制 `STEP_DISPATCH_STARTED`，没有把 capability-start taxonomy 设为必需；negative proof 也没覆盖 | P1 |

## Priority Discipline

- P0 repair scope for next phase: only row 1 by default.
- P1 enters backlog unless it blocks proof of the P0 fix.
- No confirmed P2 blocker was identified from the latest real runtime log.