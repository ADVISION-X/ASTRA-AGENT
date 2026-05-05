# Root Cause Matrix

| 序号 | 问题点 | 阻塞阶段 | 法案要求 | 施工图要求 | 生产根因文件 | 执法缺口文件 | 为什么没拦住 | 修复优先级 |
|---|---|---|---|---|---|---|---|---|
| 1 | `COMMAND_ACCEPTED` 后同命令又 `COMMAND_REJECTED` timeout | Commander command result | Commander command timeout must be governed and semantically valid | Timeout gate typed; local shell command accepted/rejected refs | `src/capabilities/commander-console/children/issue-human-command/contract.ts`; `src/capabilities/commander-console/runtime/commander-command-child-executor.ts`; `src/lib/local-runtime/workbench-human-command.ts` | `scripts/audit/domains/commander-console-capability/run-commander-runtime-checks.ts`; `scripts/audit/domains/commander-console-capability/negative-proof-harness.ts` | D/E/H: timeout existence checked, not async scope or accepted-then-rejected temporal contradiction | P0 |
| 2 | `detect-safety-page` normal page lacks governed observation refs | Page State safety check | Observation-required child success must retain observationRefs; no critical flags on success | `detect-safety-page` based on page_marker/platform_capture; output boundary forbids missing refs | `src/capabilities/page-state/children/detect-safety-page/implementation.ts`; `src/lib/local-runtime/workbench-page-state-dispatch-input.ts`; `src/capabilities/page-state/page-state-result-validation.ts` | `scripts/audit/domains/page-state-capability/required-shape.ts`; `scripts/audit/domains/page-state-capability/anti-escape.ts`; `scripts/audit/domains/page-state-capability/negative-proof-mutations.ts` | C/D/E: child-specific negative-observation dataflow not covered | P0 |
| 3 | Missing `CAPABILITY_CALL_STARTED` / review finalization event taxonomy | Runtime timeline | Structured runtime lifecycle must be reconstructable | Runtime events/proofs must carry traceable lifecycle | Orchestration runtime step/event emitters under `src/capabilities/orchestration/runtime/**` | Structured logging / orchestration audit coverage | E/H: field checks exist, lifecycle taxonomy negative proof not identified | P1 |
| 4 | Review log omits Page State diagnostic/proof refs | Review triage | Page State review/failed result must retain diagnosticPayloadRef/runtimeProof | Output/proof model keeps diagnostic and proof refs | Orchestration review event mapper and Page State result projection path | Page State + structured logging inspectors | C/H: proof existence checked more than proof surfacing in terminal logs | P1 |
| 5 | Event owner label ambiguity for target ability group | Operator readability | Owner/actionable must be clear | Logs should identify owner and target ability | Orchestration review event formatting | Structured logging inspector | P2 expression issue; not execution blocking | P2 |

## P0 Repair Scope For Next Phase

Default next phase should repair only:

1. Commander command-acceptance timeout scope.
2. `detect-safety-page` normal-page negative-observation support.

P1/P2 are backlog unless they prevent verifying the P0 fix.
